import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import '../data/raid-operator.js?v=2.11.0';

const ART=globalThis.DATA.raidOperator;
export const OPERATOR_CLIPS=ART.clips;
export function selectSkin(search=''){
  return new URLSearchParams(search).get('skin')==='robot'?'robot':'human';
}
export function animationState({dead=false,hit=false,dashing=false,moving=false,shooting=false}={}){
  return dead?'death':hit?'hit':dashing?'dash':shooting?'shoot':moving?'run':'idle';
}
export function clipForState(state){return OPERATOR_CLIPS[state]??OPERATOR_CLIPS.idle;}
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

// Cheap fresnel rim light (onBeforeCompile, no extra draw calls): brightens silhouette edges facing
// away from the camera so the operator pops against the ground instead of blending into it. Patched
// once per material (GLTF submeshes share materials by part) and also excludes it from scene fog -
// like other gameplay-critical meshes (world.js), the player sits right at the fog's near edge (see
// art.js), so leaving it fogged like the environment would read as the player washing out, not the mood.
const RIM_COLOR=new THREE.Color('#75cfcc');
const rimPatched=new WeakSet();
function addRim(material){
  if(rimPatched.has(material))return;rimPatched.add(material);
  material.fog=false;
  material.onBeforeCompile=shader=>{
    shader.uniforms.rimColor={value:RIM_COLOR};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vRimNormal;\nvarying vec3 vRimView;')
      .replace('#include <project_vertex>','vRimNormal=normalize(normalMatrix*objectNormal);vRimView=-(modelViewMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vRimNormal;\nvarying vec3 vRimView;\nuniform vec3 rimColor;')
      .replace('#include <dithering_fragment>','float rimEdge=pow(1.0-clamp(dot(normalize(vRimNormal),normalize(vRimView)),0.0,1.0),2.4);\n\tgl_FragColor.rgb+=rimColor*rimEdge*.7;\n#include <dithering_fragment>');
  };
  material.needsUpdate=true;
}
// The source rig's Abdomen is the first spine bone. Partition every clip at that
// bone, so no upper-body action can overwrite the running legs or root motion.
export function createHumanOperator(gltf,{dashDuration=null}={}){
  const model=gltf.scene,root=new THREE.Group();root.add(model);
  const bounds=new THREE.Box3().setFromObject(model),scale=ART.height/(bounds.max.y-bounds.min.y);
  model.scale.multiplyScalar(scale);model.position.y=-bounds.min.y*scale;
  model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;
    for(const m of Array.isArray(n.material)?n.material:[n.material])addRim(m);}});
  const meshes=[];model.traverse(n=>{if(n.isSkinnedMesh)meshes.push(n);});
  const outlineMaterial=new THREE.MeshBasicMaterial({color:'white',wireframe:true,transparent:true,opacity:.22,depthTest:false,depthWrite:false,toneMapped:false,fog:false});
  const outlines=meshes.map(mesh=>{
    const outline=mesh.clone(false);outline.material=outlineMaterial;outline.castShadow=false;outline.receiveShadow=false;
    outline.visible=false;outline.renderOrder=7;mesh.parent.add(outline);return outline;
  });
  const spine=model.getObjectByName('Abdomen');
  if(!spine)throw new Error('Operator is missing the Abdomen spine bone');
  const hand=model.getObjectByName('WristR'),forearm=model.getObjectByName('LowerArmR');
  const upperNames=new Set();spine.traverse(n=>upperNames.add(n.name));
  const mixer=new THREE.AnimationMixer(model),actions={lower:{},upper:{}};
  const clips=new Map(gltf.animations.map(c=>[c.name.split('|').at(-1),c]));
  for(const [state,name] of Object.entries(OPERATOR_CLIPS)){
    const source=clips.get(name);if(!source)throw new Error(`Operator clip missing: ${name}`);
    for(const layer of ['lower','upper']){
      const tracks=source.tracks.filter(t=>upperNames.has(t.name.split('.')[0])===(layer==='upper')).map(t=>t.clone());
      const action=mixer.clipAction(new THREE.AnimationClip(`${layer}:${state}`,source.duration,tracks));
      if(['death','hit','dash','shoot'].includes(state)){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}
      actions[layer][state]=action;
    }
  }
  const current={lower:null,upper:null};let shotLeft=0,hitLeft=0;
  const spineBind=spine.quaternion.clone(),spinePose=spineBind.clone(),axis=new THREE.Vector3(),worldQ=new THREE.Quaternion(),turn=new THREE.Quaternion();
  const handPoint=new THREE.Vector3(),elbowPoint=new THREE.Vector3();
  // This rig's wrist points along local +Y; -X is the top of the grip.
  // Convert the weapon's +Z barrel/+Y top into that bone coordinate system.
  const gripRotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0,0,-1),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0)));
  function change(layer,state){
    const old=current[layer],next=actions[layer][state];if(old===next)return;
    next.reset().setEffectiveTimeScale(state==='dash'&&dashDuration?clips.get('Roll').duration/dashDuration:1).setEffectiveWeight(1).play();
    if(old)next.crossFadeFrom(old,.1,false);
    current[layer]=next;
  }
  function reset(){
    mixer.stopAllAction();current.lower=current.upper=null;shotLeft=hitLeft=0;
    spine.quaternion.copy(spineBind);spinePose.copy(spineBind);change('lower','idle');change('upper','idle');mixer.update(0);spinePose.copy(spine.quaternion);
  }
  function shoot(){shotLeft=clips.get('Gun_Shoot').duration;const a=actions.upper.shoot;if(current.upper===a)a.reset().play();}
  function hit(){hitLeft=clips.get('HitRecieve').duration;for(const layer of ['lower','upper'])if(current[layer]===actions[layer].hit)current[layer].reset().play();}
  function update(dt,{moving=false,dashing=false,dead=false,aiming=false,walkYaw=0,aimYaw=walkYaw}={}){
    shotLeft=Math.max(0,shotLeft-dt);hitLeft=Math.max(0,hitLeft-dt);
    const state=animationState({dead,hit:hitLeft>0,dashing,moving});
    let bodyYaw=moving?walkYaw:aimYaw,back=false;
    if(moving&&aiming&&Math.abs(angleDelta(aimYaw,bodyYaw))>Math.PI/2){bodyYaw+=Math.PI;back=true;}
    root.rotation.y=bodyYaw-(root.parent?.rotation.y??0);
    const special=['death','hit','dash'].includes(state);
    change('lower',state==='run'&&back?'back':state);
    change('upper',special?state:shotLeft>0?'shoot':aiming?'aim':state);
    // Restore the animation pose before advancing; procedural yaw must never accumulate.
    spine.quaternion.copy(spinePose);mixer.update(dt);spinePose.copy(spine.quaternion);
    if(!special&&(aiming||shotLeft>0)){
      root.updateMatrixWorld(true);spine.getWorldQuaternion(worldQ);
      // Run and Idle_Gun use different Body rotations. Measure the actual arm
      // heading so this correction includes that difference as well as root yaw.
      hand.getWorldPosition(handPoint);forearm.getWorldPosition(elbowPoint);handPoint.sub(elbowPoint);
      const armYaw=Math.atan2(handPoint.x,handPoint.z);
      axis.set(0,1,0).applyQuaternion(worldQ.invert());
      spine.quaternion.multiply(turn.setFromAxisAngle(axis,angleDelta(aimYaw,armYaw)));
    }
    return state;
  }
  reset();
  return {root,model,mixer,actions,update,shoot,hit,reset,
    setOccluded(visible,color){if(color)outlineMaterial.color.set(color);for(const outline of outlines)outline.visible=visible;},
    weaponPose(position,quaternion){hand.getWorldPosition(position);hand.getWorldQuaternion(quaternion).multiply(gripRotation);},
    gripWorld(target){root.updateMatrixWorld(true);return hand.getWorldPosition(target);}};
}
export async function loadHumanOperator(options){
  return createHumanOperator(await new GLTFLoader().loadAsync(new URL(ART.asset,import.meta.url).href),options);
}
