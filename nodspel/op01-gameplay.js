/**
 * OP-01 gameplay presentation adapter, separate from legacy human/operator.js.
 *
 * A real Mixamo-rigged character with eight embedded animation clips. Gameplay
 * hitboxes, damage, movement speed, weapon stats and aiming assistance remain
 * owned by the raid logic, not by character art.
 *
 * One skeleton, one AnimationMixer. LOD1/LOD2 geometry/materials are swapped
 * onto the already-skinned LOD0 mesh; there are no extra animated skeletons
 * and the hand-mounted weapon stays aligned while LODs switch.
 */
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

export const OP01_GAME_PATHS=Object.freeze([
  '../assets/operators/OP01_Game_LOD0.glb',
  '../assets/operators/OP01_Game_LOD1.glb',
  '../assets/operators/OP01_Game_LOD2.glb'
]);
const REQUIRED_CLIPS=Object.freeze(['idle','run','aim','shoot','hit','dash','death','hero_pose']);
export const OP01_CHARACTER=Object.freeze({
  id:'op01',height:1.78,scale:1,
  clips:Object.fromEntries(REQUIRED_CLIPS.map(id=>[id,id])),
  rig:{spine:'mixamorig:Spine',head:'mixamorig:Head',forearm:'mixamorig:RightForeArm',
    leftHand:'mixamorig:LeftHand',rightHand:'mixamorig:RightHand'},
  weapon:{bone:'mixamorig:RightHand',muzzle:'muzzle'},
  rim:{color:'#75cfcc',strength:.30,power:2.4},
  accessories:false
});

function named(scene,rawName){
  let match=null;
  scene.traverse(n=>{
    if(!match&&(n.name===rawName||n.userData?.name===rawName))match=n;
  });
  return match;
}
function characterMeshes(scene){
  const parts=[];
  scene.traverse(n=>{if(n.isSkinnedMesh)parts.push(n);});
  return parts;
}
function weaponMesh(scene){
  // Multi-primitive GLBs use a Group for the complete weapon. It must
  // remain attached to RightHand with the muzzle socket on the group.
  return named(scene,'OP01_Carbine');
}
function compatibleRig(main,other){
  const a=main.skeleton?.bones,b=other.skeleton?.bones;
  if(!a||!b||a.length!==41||b.length!==a.length)return false;
  return a.every((bone,i)=>(bone.userData?.name||bone.name)===(b[i].userData?.name||b[i].name));
}
function tuneMaterials(mesh,low=false){
  mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    if(!mat)return;
    mat.fog=false;
    if(mat.map){mat.map.colorSpace=THREE.SRGBColorSpace;mat.map.anisotropy=low?1:4;}
  }
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

export function createOP01GameplayOperator(gltf,{dashDuration=null,quality='standard',loadLODs=null}={}){
  if(!gltf?.scene)throw new Error('OP01 gameplay GLB has no scene');
  const clips=new Map(gltf.animations.map(c=>[c.name,c]));
  for(const clip of REQUIRED_CLIPS)if(!clips.has(clip))throw new Error('OP01 gameplay GLB missing '+clip);
  const model=gltf.scene,root=new THREE.Group();
  root.name='OP01-rigged-player';
  root.add(model);
  const skinnedParts=characterMeshes(model),mesh=skinnedParts[0],weapon=weaponMesh(model);
  const spine=named(model,'mixamorig:Spine');
  const hand=named(model,'mixamorig:RightHand');
  if(skinnedParts.length!==4||!weapon||!spine||!hand)throw new Error('OP01 is missing body pieces, carbine or Mixamo bones');
  if(mesh.skeleton.bones.length!==41)throw new Error('OP01 expected a 41-bone Mixamo rig');

  // Source mesh and animation are 1.78m tall. No procedural hood/jacket is
  // attached: those already exist in the authored skin and would double up.
  for(const part of skinnedParts)tuneMaterials(part,quality==='low');
  weapon.traverse(n=>{if(n.isMesh)tuneMaterials(n,quality==='low');});
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model);
  const h=bounds.max.y-bounds.min.y;
  if(!Number.isFinite(h)||h<.5||h>4)throw new Error('Invalid OP01 height '+h);
  const scale=OP01_CHARACTER.height/h;
  model.scale.multiplyScalar(scale);
  model.position.y-=bounds.min.y*scale;

  // Carbine is authored as a child of the right-hand bone. Its local -Z
  // is the barrel forward axis and the tip is approximately z=-0.66m.
  const muzzle=new THREE.Object3D();
  muzzle.name='muzzle';
  muzzle.position.set(0,.095,-.655);
  weapon.add(muzzle);

  // Existing gameplay requires a silhouette through occluding foreground
  // terrain. The lightweight wireframe shares the existing skinned rig.
  const outlineMaterial=new THREE.MeshBasicMaterial({
    color:'#75cfcc',wireframe:true,transparent:true,opacity:.23,
    depthTest:false,depthWrite:false,toneMapped:false,fog:false
  });
  const outline=mesh.clone(false);
  outline.name='OP01-occlusion-outline';
  outline.material=outlineMaterial;
  outline.castShadow=false;outline.receiveShadow=false;outline.visible=false;
  outline.renderOrder=7;
  mesh.parent.add(outline);

  const upperNodes=new Set();
  spine.traverse(n=>upperNodes.add(n.name));
  const mixer=new THREE.AnimationMixer(model),actions={lower:{},upper:{}},current={lower:null,upper:null};
  for(const [state,source]of clips){
    for(const layer of ['lower','upper']){
      const tracks=source.tracks.filter(t=>upperNodes.has(t.name.split('.')[0])===(layer==='upper')).map(t=>t.clone());
      const action=mixer.clipAction(new THREE.AnimationClip('op01-'+layer+'-'+state,source.duration,tracks));
      if(['shoot','hit','dash','death'].includes(state)){
        action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
      }
      actions[layer][state]=action;
    }
  }
  const duration=state=>clips.get(state)?.duration??0;
  let shotLeft=0,hitLeft=0;
  const forward=new THREE.Vector3(),spineAxis=new THREE.Vector3();
  const worldUp=new THREE.Vector3(0,1,0),gunForward=new THREE.Vector3(0,0,-1);
  const worldQ=new THREE.Quaternion(),turnQ=new THREE.Quaternion();
  const poseQuat=new THREE.Quaternion();
  const handPoint=new THREE.Vector3(),scratch=new THREE.Vector3();

  const lodResources=[
    {parts:skinnedParts.map(part=>({geometry:part.geometry,material:part.material}))},
    null,null
  ];
  let lod=0,loadingLODs=null;
  root.userData.lod=0;
  root.userData.characterId='op01';
  function setLOD(index){
    if(index===lod||!lodResources[index])return false;
    skinnedParts.forEach((part,i)=>{
      part.geometry=lodResources[index].parts[i].geometry;
      part.material=lodResources[index].parts[i].material;
    });
    outline.geometry=mesh.geometry;
    lod=index;
    root.userData.lod=lod;
    return true;
  }
  function updateLOD(camera,viewportHeight){
    if(!camera||!Number.isFinite(viewportHeight)||viewportHeight<=0)return lod;
    root.updateMatrixWorld(true);
    const foot=scratch.set(0,0,0).applyMatrix4(root.matrixWorld);
    const height=foot.clone().add(new THREE.Vector3(0,OP01_CHARACTER.height,0));
    const b=foot.clone().project(camera),top=height.project(camera);
    const pixels=Math.abs(b.y-top.y)*viewportHeight*.5;
    // Hysteresis avoids rapid toggles around boundaries.
    let target=lod;
    if(lod===0 && pixels<165)target=1;
    else if(lod===1 && pixels>195)target=0;
    else if(lod===1 && pixels<60)target=2;
    else if(lod===2 && pixels>82)target=1;
    // Pick the nearest loaded resource, never leave the character invisible.
    if(!lodResources[target])target=lodResources[1]?1:0;
    setLOD(target);
    return lod;
  }
  async function preloadLODs(loader){
    if(loadingLODs)return loadingLODs;
    loadingLODs=Promise.allSettled([1,2].map(async i=>{
      const url=new URL(OP01_GAME_PATHS[i],import.meta.url).href;
      const extra=await loader.loadAsync(url);
      const other=characterMeshes(extra.scene);
      if(other.length!==skinnedParts.length||!other.every((part,j)=>compatibleRig(skinnedParts[j],part)))
        throw new Error('OP01 LOD '+i+' incompatible skeleton or mesh layout');
      other.forEach(part=>tuneMaterials(part,quality==='low'));
      lodResources[i]={parts:other.map(part=>({geometry:part.geometry,material:part.material}))};
      return i;
    })).then(r=>{
      const bad=r.filter(x=>x.status==='rejected');
      if(bad.length)console.warn('OP01 LOD streaming fallback:',bad.map(x=>String(x.reason)).join('; '));
      return lodResources.map((x,i)=>x?i:null).filter(x=>x!==null);
    });
    return loadingLODs;
  }
  const readyLODs=typeof loadLODs==='function'?loadLODs(preloadLODs):Promise.resolve([0]);

  function change(layer,state){
    const old=current[layer],next=actions[layer][state]||actions[layer].idle;
    if(old===next)return;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(
      state==='dash'&&dashDuration?duration('dash')/dashDuration:1).play();
    if(old)next.crossFadeFrom(old,.11,false);
    current[layer]=next;
  }
  function reset(){
    mixer.stopAllAction();
    current.lower=current.upper=null;
    shotLeft=hitLeft=0;
    change('lower','idle');change('upper','idle');
    mixer.update(0);
  }
  function shoot(){
    shotLeft=duration('shoot');
    if(current.upper===actions.upper.shoot)current.upper.reset().play();
  }
  function hit(){
    hitLeft=duration('hit');
    if(current.upper===actions.upper.hit)current.upper.reset().play();
  }
  function update(dt,{moving=false,dashing=false,dead=false,aiming=false,interacting=false,
    walkYaw=0,aimYaw=walkYaw}={}){
    dt=clamp(Number(dt)||0,0,.1);
    shotLeft=Math.max(0,shotLeft-dt);
    hitLeft=Math.max(0,hitLeft-dt);
    const state=dead?'death':hitLeft>0?'hit':dashing?'dash':shotLeft>0?'shoot':
      interacting?'interact':moving?'run':'idle';
    const bodyYaw=moving?walkYaw:aimYaw;
    const back=moving&&aiming&&Math.abs(delta(aimYaw,bodyYaw))>Math.PI/2;
    root.rotation.y=(bodyYaw+(back?Math.PI:0))-(root.parent?.rotation.y??0);
    const special=dead||dashing||hitLeft>0;
    change('lower',dead?'death':dashing?'dash':hitLeft>0&&!moving?'hit':moving?'run':'idle');
    change('upper',dead?'death':dashing?'dash':hitLeft>0?'hit':shotLeft>0?'shoot':
      aiming||interacting?'aim':moving?'run':'idle');
    mixer.update(dt);

    // Mixamo's aim clip is authored for its own forward direction; rotate
    // the upper torso only to align the actual hand-mounted rifle with the
    // game's aim ray. Running legs remain animated independently.
    if(!special&&(aiming||shotLeft>0)){
      root.updateMatrixWorld(true);
      forward.copy(gunForward).transformDirection(weapon.matrixWorld);
      const weaponYaw=Math.atan2(forward.x,forward.z);
      const correction=delta(aimYaw,weaponYaw);
      spine.parent.getWorldQuaternion(worldQ);
      spineAxis.copy(worldUp).applyQuaternion(worldQ.invert());
      spine.quaternion.premultiply(turnQ.setFromAxisAngle(spineAxis,correction));
      spine.updateMatrixWorld(true);
    }
    return state;
  }
  function setOccluded(visible,color){
    if(color)outlineMaterial.color.set(color);
    outline.visible=!!visible;
  }
  function weaponPose(position,quaternion){
    root.updateMatrixWorld(true);
    weapon.getWorldPosition(position);
    forward.copy(gunForward).transformDirection(weapon.matrixWorld);
    quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),forward);
  }
  function gripWorld(target){
    root.updateMatrixWorld(true);
    return hand.getWorldPosition(target);
  }
  reset();
  return {
    root,model,mixer,actions,character:OP01_CHARACTER,weapon,socket:weapon.parent,muzzle,
    update,shoot,hit,reset,setOccluded,weaponPose,gripWorld,
    setLOD,updateLOD,preloadLODs,readyLODs,
    currentLOD:()=>lod
  };
}
export async function loadOP01GameplayOperator({quality='standard',dashDuration=null}={}){
  const loader=new GLTFLoader();
  const gltf=await loader.loadAsync(new URL(OP01_GAME_PATHS[0],import.meta.url).href);
  return createOP01GameplayOperator(gltf,{
    quality,dashDuration,
    loadLODs:fn=>fn(loader)
  });
}
