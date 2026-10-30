import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {CHARACTERS,DEFAULT_CHARACTER,characterFor} from '../characters.js';
import {createRobotSocket} from '../operator-gear.js';
import {createHumanOperator} from '../operator.js';

async function load(character){
  const bytes=await readFile(new URL(character.model.split('?')[0],new URL('../',import.meta.url)));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  return createHumanOperator(gltf,{character});
}
test('registry entries describe rig, animation, weapon socket and rim; default and aliases resolve',()=>{
  assert.equal(DEFAULT_CHARACTER,'operator');assert.equal(characterFor().id,'operator');
  assert.equal(characterFor('?skin=missing').id,'operator');assert.equal(characterFor('?skin=toString').id,'operator');assert.equal(characterFor('?skin=human').id,'punk');
  assert.equal(characterFor('?skin=robot').id,'robot');
  for(const [id,c] of Object.entries(CHARACTERS)){
    assert.equal(c.id,id);assert(c.scale>0);assert(c.height>0);
    assert(c.model||c.procedural);assert(c.rig);assert(c.weapon.bone);assert.equal(c.weapon.muzzle,'muzzle');
    for(const transform of [c.weapon.offset,c.weapon.rotation])assert(transform.length===3&&transform.every(Number.isFinite));
    for(const state of ['idle','run','shoot','dash','hit','death'])assert(Object.hasOwn(c.clips,state));
    assert(c.rim.strength>=0);assert(c.rim.color);
  }
  assert.equal(CHARACTERS.operator.height*CHARACTERS.operator.scale/CHARACTERS.punk.height,1.4);
});
test('both shipped human rigs have wrist socket, forward carbine and barrel-tip muzzle',async()=>{
  for(const c of [CHARACTERS.operator,CHARACTERS.punk]){
    const op=await load(c);
    assert.equal(op.socket.parent.name,c.weapon.bone);assert.equal(op.weapon.parent,op.socket);
    assert.equal(op.muzzle.name,'muzzle');assert.equal(op.muzzle.parent,op.weapon);
    assert(op.muzzle.position.z>.7);assert(op.weapon.getObjectByName('magazine'));
    if(c.accessories){assert.equal(op.model.getObjectByName('hood').parent.name,c.rig.head);assert.equal(op.model.getObjectByName('backpack').parent.name,c.rig.chest);}
    const step={moving:true,aiming:true,walkYaw:.3,aimYaw:1};
    for(let i=0;i<30;i++){op.update(.02,step);op.shoot();}
    op.root.updateMatrixWorld(true);
    const support=op.weapon.getObjectByName('handguard-grip').getWorldPosition(new THREE.Vector3());
    const hand=op.model.getObjectByName(c.rig.leftHand).getWorldPosition(new THREE.Vector3());
    if(c.accessories)assert(hand.distanceTo(support)<.025,`${c.id} support hand distance ${hand.distanceTo(support)}`);
    const barrel=op.muzzle.getWorldPosition(new THREE.Vector3()).sub(op.weapon.getWorldPosition(new THREE.Vector3()));
    const yaw=Math.atan2(barrel.x,barrel.z);if(c.accessories)assert(Math.abs(yaw-step.aimYaw)<.15,`barrel forward ${yaw}`);
  }
});
test('game consumes the named muzzle for every skin',async()=>{
  const game=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert(game.includes('muzzle.getWorldPosition(muzzleFlash.position)'));
  assert(game.includes('createRobotSocket(robotGun,CHARACTERS.robot)'));
});

test('legacy robot keeps a named gun socket and barrel-tip muzzle',()=>{
  const gun=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));gun.scale.set(.16,.16,.67);
  const muzzle=createRobotSocket(gun,CHARACTERS.robot);
  assert.equal(gun.name,CHARACTERS.robot.weapon.bone);assert.equal(muzzle.parent.name,'weapon-socket');
  assert.equal(muzzle.name,'muzzle');assert.equal(muzzle.parent.parent,gun);
  assert(Math.abs(muzzle.getWorldPosition(new THREE.Vector3()).z-.335)<1e-6);
});

test('operator rifle hold follows world aim through rotated parents and resets after death',async()=>{
  const op=await load(CHARACTERS.operator),parent=new THREE.Group();parent.rotation.y=.7;parent.add(op.root);
  for(const aimYaw of [0,1,Math.PI,-2]){
    for(let i=0;i<20;i++)op.update(.02,{moving:true,aiming:true,walkYaw:.3,aimYaw});
    const direction=new THREE.Vector3(0,0,1).transformDirection(op.weapon.matrixWorld);
    assert(Math.abs(Math.atan2(Math.sin(Math.atan2(direction.x,direction.z)-aimYaw),Math.cos(Math.atan2(direction.x,direction.z)-aimYaw)))<.001);
    const wrist=op.model.getObjectByName(op.character.rig.leftHand).getWorldPosition(new THREE.Vector3());
    assert(wrist.distanceTo(op.weapon.getObjectByName('handguard-grip').getWorldPosition(new THREE.Vector3()))<.025);
  }
  op.update(2,{dead:true});op.reset();op.update(.02,{moving:true});
  assert(op.actions.lower.run.isRunning());assert(Number.isFinite(op.muzzle.getWorldPosition(new THREE.Vector3()).x));
});
