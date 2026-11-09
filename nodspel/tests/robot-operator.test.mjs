import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createRobotPresence} from '../robot-operator.js';

// Mirrors the box rig game.mjs builds (box(x,y,z,w,h,d,color,robot) for each part); only position/rotation
// matter to the presentation layer, so plain Object3Ds stand in for the Meshes without pulling in a renderer.
function rig(){
  const root=new THREE.Group();
  const part=(x,y,z)=>{const o=new THREE.Object3D();o.position.set(x,y,z);root.add(o);return o;};
  return {
    root,body:part(0,.5,0),head:part(0,.98,0),visor:part(0,.97,.24),
    gun:part(0,.65,.58),antenna:part(0,.67,.88),legL:part(-.23,.14,0),legR:part(.23,.14,0),
  };
}

test('idle is not a no-op and run produces a visibly bigger leg swing than idle',()=>{
  const idleParts=rig(),runParts=rig();
  const idle=createRobotPresence(idleParts),run=createRobotPresence(runParts);
  let idleSwing=0,runSwing=0;
  for(let i=0;i<40;i++){
    idle.update(1/60,{});run.update(1/60,{moving:true});
    idleSwing=Math.max(idleSwing,Math.abs(idleParts.legL.rotation.x));
    runSwing=Math.max(runSwing,Math.abs(runParts.legL.rotation.x));
  }
  assert(runSwing>idleSwing*3,`run swing (${runSwing}) should read clearly bigger than idle sway (${idleSwing})`);
  assert(runSwing>.1,'run must actually move the legs, not just sit idle');
});

test('aiming/shooting raise the gun distinctly from idle, and a fresh shot adds a visible kick',()=>{
  const idleParts=rig(),aimParts=rig(),shotParts=rig();
  createRobotPresence(idleParts).update(.1,{});
  createRobotPresence(aimParts).update(.1,{aiming:true});
  const shotPresence=createRobotPresence(shotParts);shotPresence.shoot();shotPresence.update(.1,{aiming:true});
  assert.equal(idleParts.gun.rotation.x,0);
  assert(aimParts.gun.rotation.x<0,'aiming raises the gun');
  assert.equal(shotParts.gun.rotation.x,aimParts.gun.rotation.x,'a shot keeps the aim raise');
  assert(shotParts.gun.position.y>aimParts.gun.position.y,'a fresh shot adds its own kick on top of the aim pose');
});

test('dash crouches/leans the whole rig, distinct from idle, and keeps full fixed-duration ownership even mid-hit',()=>{
  const parts=rig(),presence=createRobotPresence(parts);
  presence.update(.1,{dashing:true});
  assert(parts.root.rotation.x>0,'dash leans the whole rig forward');
  assert(parts.root.position.y<0,'dash crouches the rig');
  presence.hit();presence.update(.1,{dashing:true});
  assert(parts.root.rotation.x>0,'dash still owns the pose outright over a simultaneous hit');
  assert.equal(parts.body.rotation.z,0,'the hit flinch did not leak into a dash pose');
});

test('death collapses and freezes the rig distinctly from every other state',()=>{
  const parts=rig(),presence=createRobotPresence(parts);
  presence.update(.1,{dead:true});
  assert(parts.root.rotation.x>1,'death tips the rig over');
  assert(parts.root.position.y<0,'death settles the rig down');
});

test('a hit stays visible (torso/head flinch) without freezing legs that are actually moving',()=>{
  const stillParts=rig(),movingParts=rig();
  const still=createRobotPresence(stillParts),moving=createRobotPresence(movingParts);
  still.update(.1,{});still.hit();still.update(.1,{});
  moving.update(.1,{moving:true});moving.hit();moving.update(.1,{moving:true});
  assert(stillParts.body.rotation.z<0,'hit flinches the torso while stationary');
  assert(movingParts.body.rotation.z<0,'hit still flinches the torso while moving');
  assert(movingParts.legL.rotation.x!==0,'legs keep swinging under an active hit reaction, unlike the stationary case');
});

test('interacting reads as its own state, distinct from idle and from aim, and does not block a shot',()=>{
  const idleParts=rig(),interactParts=rig(),shotParts=rig();
  createRobotPresence(idleParts).update(.1,{});
  createRobotPresence(interactParts).update(.1,{interacting:true});
  const shotPresence=createRobotPresence(shotParts);shotPresence.shoot();
  const state=shotPresence.update(.1,{interacting:true});
  assert.equal(idleParts.head.rotation.x,0);
  assert(interactParts.head.rotation.x>0,'a node hold tilts the head toward the node');
  assert.equal(state,'shoot','firing still reads as firing while a node hold is active');
  assert.equal(shotParts.head.rotation.x,0,'firing takes the readability priority over the interact head-tilt');
});

test('reset returns every posed part to its authored base transform',()=>{
  const parts=rig(),presence=createRobotPresence(parts);
  presence.update(.1,{dead:true});presence.reset();
  assert.equal(parts.root.rotation.x,0);assert.equal(parts.root.position.y,0);
  assert.equal(parts.body.position.y,.5);assert.equal(parts.legL.rotation.x,0);
});
