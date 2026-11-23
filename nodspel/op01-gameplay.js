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
import {pbrEnvironment} from './environment-look.js?v=2.28.71';
import {GLTFLoader} from './vendor/GLTFLoader.js';

export const OP01_GAME_PATHS=Object.freeze([
  '../assets/operators/OP01_Game_LOD0.glb',
  '../assets/operators/OP01_Game_LOD1.glb',
  '../assets/operators/OP01_Game_LOD2.glb'
]);
const REQUIRED_CLIPS=Object.freeze(['idle','run','aim','shoot','hit','dash','death','hero_pose']);
// Opt-in visual-only A/B variants. 100% is today's shipped 1.30x OP01 silhouette.
// Never use this value for physics, aiming, movement or player collision.
export const OP01_SCALE_PERCENTAGES=Object.freeze([100,120,135,150]);
// Rim is shader lighting, not an always-visible geometric outline or gameplay effect.
export const OP01_RIM_STRENGTHS=Object.freeze([.16,.24,.32]);
export const OP01_CHARACTER=Object.freeze({
  // Larger silhouette in top-down gameplay; does not change physics.
  id:'op01',height:1.78,scale:1.30,
  clips:Object.fromEntries(REQUIRED_CLIPS.map(id=>[id,id])),
  rig:{spine:'mixamorig:Spine',head:'mixamorig:Head',forearm:'mixamorig:RightForeArm',
    leftHand:'mixamorig:LeftHand',rightHand:'mixamorig:RightHand'},
  weapon:{bone:'mixamorig:RightHand',muzzle:'muzzle'},
  rim:{color:'#b6c4ca',strength:.32,power:2.6},
  // Brightness lift (v2.28.68): OP01's albedo is near-black (coat ~3% grey), so the PBR environment fill
  // alone is not enough at top-down scale. colorBoost multiplies the albedo (keeps the lighting and shading),
  // envMapIntensity scales the environment fill/reflections and emissiveLift adds a small texture-tinted floor.
  light:{colorBoost:2.2,envMapIntensity:1.8,emissiveLift:.12,untexturedFloor:'#2c3238'},
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
// A neutral cool rim restores the hood/coat silhouette at the real top-down
// gameplay scale. This is material lighting, not a cyan neon contour or an
// extra draw call, and is shared by all three skinned LOD atlases.
const rimmed=new WeakSet();
function addRim(material,strengthUniform){
  if(rimmed.has(material)||!material?.isMeshStandardMaterial)return;
  rimmed.add(material);
  const rim=OP01_CHARACTER.rim;
  material.onBeforeCompile=shader=>{
    shader.uniforms.op01RimColor={value:new THREE.Color(rim.color)};
    // Share the live uniform across all four skinned parts and streamed LODs.
    // Changing preset updates the rendered shader without material recompilation.
    shader.uniforms.op01RimStrength=strengthUniform;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vOP01RimNormal;\nvarying vec3 vOP01RimView;')
      .replace('#include <project_vertex>','vOP01RimNormal=normalize(normalMatrix*objectNormal);vOP01RimView=-(modelViewMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vOP01RimNormal;\nvarying vec3 vOP01RimView;\nuniform vec3 op01RimColor;\nuniform float op01RimStrength;')
      .replace('#include <dithering_fragment>','float op01Edge=pow(1.0-clamp(dot(normalize(vOP01RimNormal),normalize(vOP01RimView)),0.0,1.0),'+rim.power+');\n gl_FragColor.rgb+=op01RimColor*op01Edge*op01RimStrength;\n#include <dithering_fragment>');
  };
  material.customProgramCacheKey=()=>"op01-neutral-rim-adjustable-v2";
  material.needsUpdate=true;
}
const lifted=new WeakSet();
function liftMaterial(mat){
  if(lifted.has(mat)||!mat.isMeshStandardMaterial)return;
  lifted.add(mat);
  const {colorBoost,envMapIntensity,emissiveLift,untexturedFloor}=OP01_CHARACTER.light;
  pbrEnvironment(mat,envMapIntensity);
  mat.color.multiplyScalar(colorBoost);
  // Authored glows (cyan light strip etc.) keep their own emissive. Otherwise tint the lift by the albedo
  // so it brightens the authored colours instead of greying them out.
  if(mat.emissive.getHex()===0){
    if(mat.map&&!mat.emissiveMap){mat.emissiveMap=mat.map;mat.emissive.setScalar(emissiveLift);}
    else if(!mat.map)mat.emissive.set(untexturedFloor).multiplyScalar(emissiveLift*2); // flat-colour gear (pack, weapon)
  }
  mat.needsUpdate=true;
}
function tuneMaterials(mesh,low=false,strengthUniform){
  mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    if(!mat)return;
    mat.fog=false;
    if(mat.map){mat.map.colorSpace=THREE.SRGBColorSpace;mat.map.anisotropy=low?1:4;}
    liftMaterial(mat);
    if(mesh.isSkinnedMesh)addRim(mat,strengthUniform);
  }
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

/** OP01 visual facing policy. Aiming overrides movement immediately.
 * After releasing aim, rotate back toward movement gradually. When still,
 * retain the last meaningful direction. A shot holds briefly before easing.
 * No influence on physics, player collisions, or projectile calculations.
 */
export function createOP01FacingLatch(){
  const facing={x:0,z:-1};
  let yaw=Math.PI,initialized=false,locked=false,steering=false,shotHold=0;
  const TURN_RATE=3.25;  // maximum radians per second
  const TURN_EASE=.20;  // smooth final approach
  const SNAP_EPS=.025;
  const SHOT_HOLD=.14;  // avoid the first-frame post-fire snap
  function face(x,z){
    if(!Number.isFinite(x)||!Number.isFinite(z))return false;
    const len=Math.hypot(x,z);
    if(len<.001)return false;
    yaw=Math.atan2(x,z);
    facing.x=x/len;facing.z=z/len;initialized=true;
    return true;
  }
  function record(x,z){
    if(!face(x,z))return false;
    locked=true;steering=true;shotHold=SHOT_HOLD;
    return true;
  }
  function resolve(aiming,walking,aim,dt=1/60,moving=true){
    const step=clamp(Number(dt)||0,0,.25);
    if(aiming&&aim&&face(aim.x,aim.z)){
      steering=true;
      return facing; // live aim is always absolute priority
    }
    if(!initialized)face(walking?.x??0,walking?.z??-1);
    if(!moving){
      steering=false; // preserve last facing while stationary
      return facing;
    }
    if(shotHold>0){
      shotHold=Math.max(0,shotHold-step);
      steering=true;return facing;
    }
    if(!walking||!Number.isFinite(walking.x)||!Number.isFinite(walking.z)
      ||Math.hypot(walking.x,walking.z)<.001){
      steering=false;return facing;
    }
    const target=Math.atan2(walking.x,walking.z);
    const diff=delta(target,yaw); // shortest direction across +/- PI
    if(Math.abs(diff)<=SNAP_EPS){
      face(walking.x,walking.z);
      steering=false;
    }else{
      const eased=Math.abs(diff)*(1-Math.exp(-step/TURN_EASE));
      const amount=Math.min(Math.abs(diff),TURN_RATE*step,eased);
      yaw+=Math.sign(diff)*amount;
      facing.x=Math.sin(yaw);facing.z=Math.cos(yaw);
      steering=true;
    }
    return facing;
  }
  return {
    record,resolve,
    reset(){
      locked=false;steering=false;shotHold=0;initialized=false;
      yaw=Math.PI;facing.x=0;facing.z=-1;
    },
    get locked(){return locked;}, // QA: has fired since last reset
    get steering(){return steering;},
    get direction(){return facing;}
  };
}

export function createOP01GameplayOperator(gltf,{dashDuration=null,quality='standard',loadLODs=null}={}){
  if(!gltf?.scene)throw new Error('OP01 gameplay GLB has no scene');
  const clips=new Map(gltf.animations.map(c=>[c.name,c]));
  for(const clip of REQUIRED_CLIPS)if(!clips.has(clip))throw new Error('OP01 gameplay GLB missing '+clip);
  const model=gltf.scene,root=new THREE.Group();
  root.name='OP01-rigged-player';
  const rimStrengthUniform={value:OP01_CHARACTER.rim.strength};
  function setRimStrength(value){
    const strength=Number(value);
    if(!OP01_RIM_STRENGTHS.includes(strength))return false;
    rimStrengthUniform.value=strength;
    root.userData.op01RimStrength=strength;
    return true;
  }
  setRimStrength(OP01_CHARACTER.rim.strength);
  // Scale the complete presentation hierarchy, including hands, rifle and
  // muzzle. The enclosing gameplay player group, collision and speed stay
  // unchanged; menu/Deploy uses a separate GLB and is unaffected.
  function setVisualScalePercent(value){
    const percent=Number(value);
    if(!OP01_SCALE_PERCENTAGES.includes(percent))return false;
    root.scale.setScalar(OP01_CHARACTER.scale*percent/100);
    root.userData.operatorScalePercent=percent;
    return true;
  }
  setVisualScalePercent(100);
  root.add(model);
  const skinnedParts=characterMeshes(model),mesh=skinnedParts[0],weapon=weaponMesh(model);
  const spine=named(model,'mixamorig:Spine');
  const hand=named(model,'mixamorig:RightHand');
  const supportHand=named(model,'mixamorig:LeftHand');
  const head=named(model,'mixamorig:Head');
  if(skinnedParts.length!==4||!weapon||!spine||!hand||!supportHand||!head)throw new Error('OP01 is missing body pieces, carbine or Mixamo bones');
  if(mesh.skeleton.bones.length!==41)throw new Error('OP01 expected a 41-bone Mixamo rig');

  // Source mesh and animation are 1.78m tall. No procedural hood/jacket is
  // attached: those already exist in the authored skin and would double up.
  for(const part of skinnedParts)tuneMaterials(part,quality==='low',rimStrengthUniform);
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

  // Keep the entire four-part skinned silhouette visible behind foreground
  // terrain. One cloned primitive hid the coat/gear at many angles, making
  // OP01 look dismembered when passing behind the Swedish granite blockers.
  const outlineMaterial=new THREE.MeshBasicMaterial({
    color:'#75cfcc',wireframe:true,transparent:true,opacity:.23,
    depthTest:false,depthWrite:false,toneMapped:false,fog:false
  });
  const outlines=skinnedParts.map(part=>{
    const outline=part.clone(false);
    outline.name='OP01-occlusion-outline';
    outline.material=outlineMaterial;
    outline.castShadow=false;outline.receiveShadow=false;outline.visible=false;
    outline.renderOrder=7;
    part.parent.add(outline);
    return outline;
  });

  const upperNodes=new Set();
  spine.traverse(n=>upperNodes.add(n.name));
  const mixer=new THREE.AnimationMixer(model),actions={lower:{},upper:{}},current={lower:null,upper:null};
  const currentName={lower:null,upper:null};
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
  // Aiming while retreating must not play forward-running footsteps. Reuse
  // the authored running lower-body clip with a separate reverse-time action;
  // the upper body keeps its independently aimed/two-hand rifle pose.
  const backTracks=clips.get('run').tracks.filter(t=>!upperNodes.has(t.name.split('.')[0])).map(t=>t.clone());
  actions.lower.back=mixer.clipAction(new THREE.AnimationClip('op01-lower-back',duration('run'),backTracks));
  let shotLeft=0,hitLeft=0;
  const forward=new THREE.Vector3(),spineAxis=new THREE.Vector3();
  const worldUp=new THREE.Vector3(0,1,0),gunForward=new THREE.Vector3(0,0,-1);
  const worldQ=new THREE.Quaternion(),turnQ=new THREE.Quaternion();
  const scratch=new THREE.Vector3(),scratchTop=new THREE.Vector3();

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
    skinnedParts.forEach((part,i)=>{outlines[i].geometry=part.geometry;});
    lod=index;
    root.userData.lod=lod;
    return true;
  }
  function updateLOD(camera,viewportHeight){
    if(!camera||!Number.isFinite(viewportHeight)||viewportHeight<=0)return lod;
    root.updateMatrixWorld(true);
    const foot=scratch.set(0,0,0).applyMatrix4(root.matrixWorld);
    // Project the actual scaled visual height, not the unscaled source rig.
    // This keeps LOD thresholds consistent with the larger silhouette.
    const top=scratchTop.set(0,OP01_CHARACTER.height,0).applyMatrix4(root.matrixWorld).project(camera);
    const b=foot.project(camera);
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
      other.forEach(part=>tuneMaterials(part,quality==='low',rimStrengthUniform));
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
      state==='back'?-1:state==='dash'&&dashDuration?duration('dash')/dashDuration:1);
    if(state==='back')next.time=duration('run');
    next.play();
    if(old)next.crossFadeFrom(old,.11,false);
    current[layer]=next;currentName[layer]=state;
  }
  function reset(){
    mixer.stopAllAction();
    current.lower=current.upper=null;currentName.lower=currentName.upper=null;
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
    for(const layer of ['upper','lower'])if(current[layer]===actions[layer].hit)
      current[layer].reset().play();
  }
  function update(dt,{moving=false,dashing=false,dead=false,aiming=false,interacting=false,
    keepFacing=false,walkYaw=0,aimYaw=walkYaw}={}){
    dt=clamp(Number(dt)||0,0,.1);
    shotLeft=Math.max(0,shotLeft-dt);
    hitLeft=Math.max(0,hitLeft-dt);
    const state=dead?'death':hitLeft>0?'hit':dashing?'dash':shotLeft>0?'shoot':
      interacting?'interact':moving?'run':'idle';
    // A latched aim/shot owns the upper-body facing even when the move stick
    // remains pressed. Run/back legs keep their independent movement heading.
    const weaponReady=aiming||shotLeft>0||keepFacing;
    const bodyYaw=weaponReady?aimYaw:moving?walkYaw:aimYaw;
    const back=moving&&weaponReady&&Math.abs(delta(aimYaw,walkYaw))>Math.PI/2;
    // Reverse the *legs* while retreating, never turn the whole model around.
    // A 180-degree root flip was the source of visible facing snap-back.
    root.rotation.y=bodyYaw-(root.parent?.rotation.y??0);
    const special=dead||dashing||hitLeft>0;
    change('lower',dead?'death':dashing?'dash':hitLeft>0&&!moving?'hit':moving?(back?'back':'run'):'idle');
    change('upper',dead?'death':dashing?'dash':hitLeft>0?'hit':shotLeft>0?'shoot':
      aiming||interacting||keepFacing?'aim':moving?'run':'idle');
    mixer.update(dt);

    // Mixamo's aim clip is authored for its own forward direction; rotate
    // the upper torso only to align the actual hand-mounted rifle with the
    // game's aim ray. Running legs remain animated independently.
    if(!special&&weaponReady){
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
    for(const outline of outlines)outline.visible=!!visible;
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
  function healthAnchor(target){
    // Follow the actual animated hood/head, not just the logical player XZ
    // center. This continues to work with the 1.30x OP01 visual root.
    root.updateMatrixWorld(true);
    head.getWorldPosition(target);
    target.y+=.32*root.scale.y;
    return target;
  }
  // Read-only QA surface used only by the explicit ?op01QA=1 test session.
  // No reference to this debug method is retained by normal gameplay code.
  function poseDiagnostics(){
    root.updateMatrixWorld(true);
    const tip=muzzle.getWorldPosition(new THREE.Vector3());
    const origin=weapon.getWorldPosition(new THREE.Vector3());
    const support=weapon.worldToLocal(supportHand.getWorldPosition(new THREE.Vector3()));
    return {lod,lower:currentName.lower,upper:currentName.upper,
      visualScale:root.scale.x,visualHeight:OP01_CHARACTER.height*root.scale.y,
      scaleVariantPercent:root.userData.operatorScalePercent,
      rimStrength:root.userData.op01RimStrength,
      muzzle:tip.toArray(),direction:tip.sub(origin).normalize().toArray(),
      supportHandLocal:support.toArray(),outlines:outlines.length,
      outlineVisible:outlines.some(o=>o.visible),mixerTime:mixer.time};
  }
  reset();
  return {
    root,model,mixer,actions,character:OP01_CHARACTER,weapon,socket:weapon.parent,muzzle,
    update,shoot,hit,reset,setOccluded,weaponPose,gripWorld,healthAnchor,poseDiagnostics,
    setVisualScalePercent,setRimStrength,
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
