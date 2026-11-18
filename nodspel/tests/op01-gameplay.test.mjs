import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {createOP01GameplayOperator,OP01_CHARACTER} from '../op01-gameplay.js';
import {createOP01DeployGrip} from '../../ui/raid-prep-op01.mjs';

async function parse(name){
  // Node has no image decoder. Preserve the actual GLB geometry, skin and
  // animation bytes while removing only texture bindings in this test fixture.
  // Browser/production GLBs are never modified.
  const bytes=await readFile(new URL('../../assets/operators/'+name,import.meta.url));
  const jsonLength=bytes.readUInt32LE(12);
  const json=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
  json.materials=(json.materials||[]).map(m=>({
    name:m.name,
    pbrMetallicRoughness:{baseColorFactor:[.5,.5,.5,1],metallicFactor:0,roughnessFactor:1}
  }));
  const encoded=Buffer.from(JSON.stringify(json));
  assert(encoded.length<=jsonLength,'stripping texture bindings must fit the original GLB JSON chunk');
  const prepared=Buffer.from(bytes);
  prepared.fill(0x20,20,20+jsonLength);
  encoded.copy(prepared,20);
  return new GLTFLoader().parseAsync(prepared.buffer.slice(prepared.byteOffset,prepared.byteOffset+prepared.byteLength),'');
}
test('authored OP01 has weapon, 41-bone rig and all gameplay actions',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const operator=createOP01GameplayOperator(gltf,{dashDuration:.55});
  assert.equal(operator.character.id,'op01');
  assert.equal(operator.muzzle.name,'muzzle');
  assert.equal(operator.muzzle.parent,operator.weapon);
  assert.equal(operator.weapon.userData.name||operator.weapon.name,'OP01_Carbine');
  assert.equal(operator.model.getObjectByName('OP01_Rig')?.name,'OP01_Rig');
  assert.equal(operator.currentLOD(),0);
  for(const name of ['idle','run','aim','shoot','hit','dash','death','hero_pose']){
    assert(operator.actions.lower[name],name+' lower animation missing');
    assert(operator.actions.upper[name],name+' upper animation missing');
  }
  assert.equal(operator.update(.05,{moving:true,aiming:true,walkYaw:.3,aimYaw:1}),'run');
  assert(operator.actions.lower.run.isRunning());
  assert(operator.actions.upper.aim.isRunning());
  operator.shoot();
  assert.equal(operator.update(.05,{moving:true,aiming:true,walkYaw:.3,aimYaw:1}),'shoot');
  assert(operator.actions.upper.shoot.isRunning());
  operator.hit();
  assert.equal(operator.update(.05,{moving:true,aiming:true,walkYaw:.3,aimYaw:1}),'hit');
  assert(operator.actions.lower.run.isRunning(),'movement legs must continue during a hit');
  operator.reset();
  assert.equal(operator.update(.05,{dashing:true}),'dash');
  assert(operator.actions.lower.dash.isRunning());
  assert(operator.actions.upper.dash.isRunning());
  assert.equal(operator.update(.1,{dead:true}),'death');
  assert.equal(operator.actions.lower.death.loop,THREE.LoopOnce);
  const muzzle=operator.muzzle.getWorldPosition(new THREE.Vector3());
  assert(muzzle.toArray().every(Number.isFinite),'weapon muzzle position must stay finite');
  operator.reset();
  assert.equal(operator.update(.1,{}),'idle');
});
test('all four OP01 skinned material parts switch together using one skeleton',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const op=createOP01GameplayOperator(gltf);
  const parts=[];op.model.traverse(n=>{if(n.isSkinnedMesh)parts.push(n);});
  assert.equal(parts.length,4,'skinned character has four GLB material primitives');
  const original=parts.map(n=>n.geometry);
  const loader={loadAsync:async url=>parse(new URL(url).pathname.split('/').at(-1))};
  const ready=await op.preloadLODs(loader);
  assert.deepEqual(ready,[0,1,2]);
  assert(op.setLOD(1),'LOD1 should load on the existing skeleton');
  assert.equal(op.currentLOD(),1);
  assert(parts.every((n,i)=>n.geometry!==original[i]),'all four skinned materials switch');
  assert(op.setLOD(2),'LOD2 should load');
  assert.equal(op.root.userData.lod,2);
  op.update(.05,{moving:true});
  assert(op.actions.lower.run.isRunning(),'LOD switching does not restart animation');
  assert(op.setLOD(0),'LOD0 should be restorable');
  assert(parts.every((n,i)=>n.geometry===original[i]),'source LOD0 geometry is preserved');
  const farCamera=new THREE.PerspectiveCamera(42,844/390,.1,50);
  farCamera.position.set(0,8,14);farCamera.lookAt(0,1,0);
  farCamera.updateMatrixWorld(true);
  op.updateLOD(farCamera,390);
  assert(op.currentLOD()===1||op.currentLOD()===2,'projected small character must choose a cheaper loaded LOD');
});
test('OP01 presentation does not modify core movement, collision or weapon rules',()=>{
  const keys=['radius','speed','damage','hitbox','dashCooldownMs','fireRate'];
  for(const key of keys)assert(!Object.hasOwn(OP01_CHARACTER,key),
    'character art should not introduce a game mechanic '+key);
  assert.equal(OP01_CHARACTER.height,1.78);
  assert.equal(OP01_CHARACTER.weapon.muzzle,'muzzle');
});

test('diagnostic: locate the authored hero-posed wrists and weapon forward axis',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const scene=gltf.scene,mixer=new THREE.AnimationMixer(scene);
  const named=name=>{
    let value=null;
    scene.traverse(n=>{if(!value&&(n.name===name||n.userData?.name===name))value=n;});
    return value;
  };
  const getPosition=name=>named(name)?.getWorldPosition(new THREE.Vector3()).toArray().map(n=>+n.toFixed(3));
  const weapon=named('OP01_Carbine');
  for(const state of ['hero_pose','aim','idle']){
    mixer.stopAllAction();
    const clip=gltf.animations.find(c=>c.name===state);
    const action=mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;
    action.play();mixer.update(clip.duration+(state==='hero_pose'?.0001:0));
    scene.updateMatrixWorld(true);
    const forward=new THREE.Vector3(0,0,-1).transformDirection(weapon.matrixWorld);
    console.log('OP01_RIG_DIAG '+JSON.stringify({
      state,clipDuration:+clip.duration.toFixed(3),
      rightHand:getPosition('mixamorig:RightHand'),
      leftHand:getPosition('mixamorig:LeftHand'),
      leftArm:getPosition('mixamorig:LeftArm'),
      leftForeArm:getPosition('mixamorig:LeftForeArm'),
      weapon:weapon.getWorldPosition(new THREE.Vector3()).toArray().map(n=>+n.toFixed(3)),
      forward:forward.toArray().map(n=>+n.toFixed(3))
    }));
  }
  assert(weapon,'weapon exists');
});

test('Deploy uses anchored lower body with a fixed upper-body rifle grip',async()=>{
  const gltf=await parse('OP01_Game_LOD0.glb');
  const pose=createOP01DeployGrip(gltf);
  assert(pose.upperTracks>=10,'both animated shoulders and hands use the aim clip');
  assert(pose.lowerTracks>=2,'standing legs retain the hero pose');
  assert(pose.grip.paused && pose.stand.paused,'Deploy pose must not drift when idle');
  const byName=name=>{
    let found=null;
    gltf.scene.traverse(n=>{if(!found&&(n.name===name||n.userData?.name===name))found=n;});
    return found;
  };
  gltf.scene.updateMatrixWorld(true);
  const gun=byName('OP01_Carbine'),left=byName('mixamorig:LeftHand'),right=byName('mixamorig:RightHand');
  assert(gun && left && right);
  const origin=gun.getWorldPosition(new THREE.Vector3());
  const leftWorld=left.getWorldPosition(new THREE.Vector3());
  const rightWorld=right.getWorldPosition(new THREE.Vector3());
  const aimDir=new THREE.Vector3(0,0,-1).transformDirection(gun.matrixWorld);
  const reach=[0,-.15,-.3,-.45,-.6].map(z=>leftWorld.distanceTo(gun.localToWorld(new THREE.Vector3(0,0,z))));
  console.log('OP01_DEPLOY_GRIP '+JSON.stringify({
    barrelVerticality:+Math.abs(aimDir.y).toFixed(3),
    leftGripGap:+Math.min(...reach).toFixed(3),
    rightSocketGap:+rightWorld.distanceTo(origin).toFixed(3),
    upperTracks:pose.upperTracks,lowerTracks:pose.lowerTracks
  }));
  assert(Math.abs(aimDir.y)<.92,'rifle barrel must not point vertically in Deploy');
});
