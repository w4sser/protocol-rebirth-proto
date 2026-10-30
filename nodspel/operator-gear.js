import * as THREE from './vendor/three.module.js';

function material(color){return new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.12,fog:false});}
function block(parent,name,size,position,mat){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.name=name;mesh.position.set(...position);mesh.castShadow=true;parent.add(mesh);return mesh;
}
// Original primitive geometry, dedicated CC0. +Z is forward, origin is the trigger hand.
export function createCarbine(){
  const gun=new THREE.Group();gun.name='carbine';
  const dark=material('#242d34'),metal=material('#35434a');
  block(gun,'receiver',[.12,.15,.3],[0,.055,.09],dark);
  block(gun,'handguard',[.105,.12,.28],[0,.06,.35],metal);
  block(gun,'barrel',[.045,.045,.28],[0,.075,.61],dark);
  block(gun,'stock',[.1,.16,.22],[0,.035,-.17],dark);
  block(gun,'grip',[.075,.15,.08],[0,-.08,0],dark).rotation.x=-.2;
  block(gun,'magazine',[.08,.19,.11],[0,-.1,.17],metal).rotation.x=.15;
  block(gun,'sight',[.065,.065,.09],[0,.155,.1],dark);
  const muzzle=new THREE.Object3D();muzzle.name='muzzle';muzzle.position.set(0,.075,.75);gun.add(muzzle);
  const support=new THREE.Object3D();support.name='handguard-grip';support.position.set(0,-.015,.25);gun.add(support);
  return gun;
}

// Bone space in the source GLBs is centimetres with a 100x armature scale.
// Compensate once so these dimensions remain in character-world units.
function mount(model,boneName,name){
  model.updateWorldMatrix(true,true);const bone=model.getObjectByName(boneName);
  if(!bone)throw new Error(`Operator attachment bone missing: ${boneName}`);
  const group=new THREE.Group();group.name=name;
  group.scale.set(1,1,1).divide(bone.getWorldScale(new THREE.Vector3()));bone.add(group);return group;
}
export function addOperatorGear(model,character){
  const hood=mount(model,character.rig.head,'hood');
  const cloth=material('#969b98');cloth.flatShading=true;
  // Open face, faceted rear shell and crown. The face stays visible from the front.
  const rear=new THREE.Mesh(new THREE.SphereGeometry(.27,8,6,Math.PI,Math.PI),cloth);
  rear.scale.set(1,1.15,.88);rear.position.set(0,.1,-.015);hood.add(rear);
  const crown=new THREE.Mesh(new THREE.SphereGeometry(.27,8,4,0,Math.PI*2,0,Math.PI*.4),cloth);
  crown.scale.set(1,1.15,.88);crown.position.copy(rear.position);hood.add(crown);
  for(const x of [-.23,.23])block(hood,'hood-cheek',[.075,.3,.23],[x,.04,.015],cloth);
  // The CC0 source wears rolled sleeves/shorts. Original shells give this
  // skin a full jacket and trousers without modifying any source material.
  const jacket=mount(model,character.rig.chest,'jacket');
  block(jacket,'jacket-body',[.51,.46,.34],[0,-.14,0],cloth);
  const pants=material('#233244'),boot=material('#242d34');
  function cover(boneName,endName,name,radius,mat,booted=false){
    const bone=model.getObjectByName(boneName),end=model.getObjectByName(endName);
    const length=bone.getWorldPosition(new THREE.Vector3()).distanceTo(end.getWorldPosition(new THREE.Vector3()));
    const group=mount(model,boneName,name);
    const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius*.88,length,6),mat);
    sleeve.position.y=length/2;sleeve.castShadow=true;group.add(sleeve);
    if(booted)block(group,'boot',[radius*2.1,.22,.27],[0,length-.055,.025],boot);
  }
  for(const side of ['L','R']){
    cover(`UpperArm${side}`,`LowerArm${side}`,'jacket-sleeve',.105,cloth);
    cover(`LowerArm${side}`,`Wrist${side}`,'jacket-cuff',.095,cloth);
    cover(`UpperLeg${side}`,`LowerLeg${side}`,'trousers',.125,pants);
    cover(`LowerLeg${side}`,`LowerLeg${side}_end`,'trouser-leg',.105,pants,true);
  }
  const pack=mount(model,character.rig.chest,'backpack'),teal=material('#304e57'),trim=material('#52656a');
  block(pack,'pack-body',[.53,.58,.25],[0,-.12,-.27],teal);
  block(pack,'pack-pocket',[.39,.25,.09],[0,-.23,-.435],teal);
  block(pack,'pack-flap',[.55,.1,.29],[0,.19,-.29],trim);
  for(const x of [-.18,.18])block(pack,'shoulder-strap',[.065,.51,.055],[x,-.055,-.13],trim);
  hood.traverse(n=>{if(n.isMesh)n.castShadow=true;});
}

// A short CCD solve builds a rifle hold over the source upper-body animation.
// Running legs stay animated; arm corrections start from that frame's pose.
function solveArm(model,joints,wrist,target){
  const origin=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3(),parentQ=new THREE.Quaternion(),delta=new THREE.Quaternion();
  for(let i=0;i<16;i++)for(let j=joints.length-1;j>=0;j--){
    const joint=joints[j];joint.updateWorldMatrix(true,true);joint.getWorldPosition(origin);wrist.getWorldPosition(from).sub(origin).normalize();to.copy(target).sub(origin).normalize();
    joint.parent.getWorldQuaternion(parentQ);delta.setFromUnitVectors(from,to);
    joint.quaternion.premultiply(parentQ.clone().invert().multiply(delta).multiply(parentQ));
  }
  model.updateWorldMatrix(true,true);
}
export function riflePose(model,character,aimYaw){
  const upper=model.getObjectByName(character.rig.rightArm[0]),lower=model.getObjectByName(character.rig.forearm),hand=model.getObjectByName(character.weapon.bone);
  const target=upper.getWorldPosition(new THREE.Vector3());
  target.add(new THREE.Vector3(Math.sin(aimYaw)*.12+Math.cos(aimYaw)*.12,-.25,Math.cos(aimYaw)*.12-Math.sin(aimYaw)*.12));
  solveArm(model,[upper,lower],hand,target);
  const grip=new THREE.Quaternion().setFromEuler(new THREE.Euler(...character.weapon.rotation));
  const desired=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),aimYaw).multiply(grip.invert());
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired));
  model.updateWorldMatrix(true,true);
}
export function supportHand(model,character,gun){
  const target=gun.getObjectByName('handguard-grip').getWorldPosition(new THREE.Vector3());
  const wrist=model.getObjectByName(character.rig.leftHand),joints=character.rig.leftArm.map(name=>model.getObjectByName(name));
  solveArm(model,joints,wrist,target);
  const grip=new THREE.Quaternion().setFromEuler(new THREE.Euler(...character.weapon.rotation));
  const desired=gun.getWorldQuaternion(new THREE.Quaternion()).multiply(grip.invert());
  wrist.quaternion.copy(wrist.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired));
  // Curl the support fingers beneath the handguard instead of leaving an open palm.
  for(const finger of ['Index','Middle','Ring','Pinky'])for(const joint of [2,3]){
    const bone=model.getObjectByName(`${finger}${joint}L`);
    if(bone)bone.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),1.1);
  }
  model.updateWorldMatrix(true,true);
}

// Keep the original robot gun geometry while giving it the same socket contract.
export function createRobotSocket(gun,character){
  gun.name=character.weapon.bone;
  const socket=new THREE.Group();socket.name='weapon-socket';
  gun.updateWorldMatrix(true,false);
  socket.position.fromArray(character.weapon.offset).divide(gun.getWorldScale(new THREE.Vector3()));
  socket.rotation.set(...character.weapon.rotation);gun.add(socket);
  const muzzle=new THREE.Object3D();muzzle.name=character.weapon.muzzle;socket.add(muzzle);return muzzle;
}
