import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import * as THREE from '../vendor/three.module.js';
import {selectSkin,animationState,clipForState,createHumanOperator} from '../operator.js';
import {CHARACTERS} from '../characters.js';
import {createOperatorFX} from '../operator-fx.js';

test('operator is default; legacy skins remain explicit',()=>{
  for(const search of ['', '?skin=unknown','?q=low'])assert.equal(selectSkin(search),'operator');
  assert.equal(selectSkin('?q=low&skin=robot'),'robot');
  assert.equal(selectSkin('?skin=human'),'punk');assert.equal(selectSkin('?skin=punk'),'punk');
});
test('animation priority and exact source clip names',()=>{
  assert.equal(animationState(), 'idle');assert.equal(animationState({moving:true}),'run');
  assert.equal(animationState({moving:true,shooting:true}),'shoot');
  assert.equal(animationState({dashing:true,shooting:true}),'dash');
  assert.equal(animationState({hit:true,dashing:true}),'hit');
  assert.equal(animationState({dead:true,hit:true}),'death');
  assert.deepEqual(['idle','run','shoot','dash','hit','death'].map(clipForState),['Idle_Gun','Run','Gun_Shoot','Roll','HitRecieve','Death']);
});
// M39: node-hold interaction joins the same priority vocabulary, below firing (a hold must never read as
// blocking a shot) but above plain idle/run (a hold is more informative than doing nothing in particular).
test('interact joins the animation priority below shoot/dash/hit and above run/idle',()=>{
  assert.equal(animationState({interacting:true}),'interact');
  assert.equal(animationState({interacting:true,moving:true}),'interact');
  assert.equal(animationState({interacting:true,shooting:true}),'shoot');
  assert.equal(animationState({interacting:true,dashing:true}),'dash');
  assert.equal(animationState({interacting:true,hit:true}),'hit');
  assert.equal(clipForState('interact'),clipForState('idle'),'no dedicated clip exists yet; falls back cleanly, not undefined');
});
async function operator(){
  const bytes=await readFile(new URL('../assets/human-operator.glb',import.meta.url));
  return createHumanOperator(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),{character:CHARACTERS.punk});
}
test('shipped rig animates legs while firing and resets after clamped death',async()=>{
  const human=await operator(),step={moving:true,aiming:true,walkYaw:0,aimYaw:1};
  assert.equal(human.update(.1,step),'run');human.shoot();human.update(.1,step);
  assert(human.actions.lower.run.isRunning());assert(human.actions.upper.shoot.isRunning());
  assert(human.actions.upper.shoot.getClip().tracks.every(t=>!(/Leg|Body\./.test(t.name))));
  assert(human.actions.lower.run.getClip().tracks.some(t=>/Leg/.test(t.name)));
  human.hit();assert.equal(human.update(.1,step),'hit');
  human.update(2,{dead:true});assert.equal(human.actions.lower.death.loop,THREE.LoopOnce);
  assert.equal(human.actions.lower.death.paused,true);
  human.reset();assert.equal(human.update(.1,{}),'idle');assert(human.actions.lower.idle.isRunning());
  const bounds=new THREE.Box3().setFromObject(human.root);
  assert(bounds.max.y>1.5&&bounds.max.y<1.8);assert(Math.abs(bounds.min.y)<.1);
});
// M39 (game feel review): a hit reaction must stay visible but must not steal legs that are actually
// mid-stride for the clip's full duration - that read as an input steal even though the real position kept
// moving underneath it. The upper body still plays the hit react; only a stationary hit freezes the legs.
test('a hit while moving keeps the legs running/back; a hit while stationary still freezes the lower body',async()=>{
  const human=await operator(),moveStep={moving:true,aiming:true,walkYaw:0,aimYaw:0};
  human.update(.1,moveStep);assert(human.actions.lower.run.isRunning());
  human.hit();
  assert.equal(human.update(.1,moveStep),'hit','the reported state still leads with the hit, for HUD/robot parity');
  assert(human.actions.lower.run.isRunning(),'legs keep running under an active hit reaction');
  assert(human.actions.upper.hit.isRunning(),'the hit reaction remains visible on the upper body');
  human.reset();human.update(.1,{});human.hit();human.update(.1,{});
  assert(human.actions.lower.hit.isRunning(),'a stationary hit still freezes the lower body (no conflicting locomotion signal)');
  assert(human.actions.upper.hit.isRunning());
});
test('a dash still owns both layers outright even if a hit lands mid-roll',async()=>{
  const human=await operator();
  human.update(.1,{dashing:true});human.hit();human.update(.1,{dashing:true});
  assert(human.actions.lower.dash.isRunning(),'dash is a canned, fixed-duration roll and is not interrupted by a hit flinch');
  assert(human.actions.upper.dash.isRunning());
});
// M39: a node hold (round.nodeInteraction) reads as a distinct, readable state without blocking fire, and
// releasing/leaving the node returns cleanly to idle/run.
test('a node hold selects interact on the upper body without blocking fire, and releasing returns to idle/run',async()=>{
  const human=await operator();
  assert.equal(human.update(.1,{interacting:true}),'interact');
  assert(human.actions.upper.aim.isRunning(),'no dedicated clip exists; reuses the existing aim pose for readability');
  human.shoot();assert.equal(human.update(.1,{interacting:true}),'shoot');
  assert(human.actions.upper.shoot.isRunning(),'firing still reads as firing while a node hold is active');
  human.reset();
  assert.equal(human.update(.1,{}),'idle','leaving the node (interacting:false) returns to idle');
  assert(human.actions.lower.idle.isRunning());
  assert.equal(human.update(.1,{moving:true}),'run','or to run, if the player walked away while moving');
});
test('aim yaw stays finite and does not accumulate; backwards fire uses running legs',async()=>{
  const human=await operator(),state={moving:true,aiming:true,walkYaw:0,aimYaw:Math.PI};
  human.update(.1,state);assert(human.actions.lower.back.isRunning());
  const spine=human.model.getObjectByName('Abdomen');
  for(let i=0;i<100;i++)human.update(.01,{...state,aimYaw:1});
  const before=spine.quaternion.clone();human.update(0,{...state,aimYaw:1});
  assert(before.angleTo(spine.quaternion)<.0001);
  assert(Number.isFinite(spine.quaternion.w));
});
test('animated forearm aims exactly at the target with running legs and a rotated player parent',async()=>{
  const human=await operator(),player=new THREE.Group();player.rotation.y=.7;player.add(human.root);
  for(const aimYaw of [0,1,Math.PI,-2]){
    for(let i=0;i<30;i++)human.update(.02,{moving:true,aiming:true,walkYaw:.3,aimYaw});
    const arm=human.gripWorld(new THREE.Vector3()).sub(human.model.getObjectByName('LowerArmR').getWorldPosition(new THREE.Vector3()));
    const error=Math.atan2(Math.sin(Math.atan2(arm.x,arm.z)-aimYaw),Math.cos(Math.atan2(arm.x,arm.z)-aimYaw));
    assert(Math.abs(error)<.001,`forearm aim error ${error}`);
  }
});
test('combat FX keep a bounded pool and low quality emits fewer sparks',()=>{
  const scene=new THREE.Scene(),fx=createOperatorFX(scene,{sparkColor:'orange',dustColor:'white',tracerColor:'cyan'});
  fx.sparks(0,0,true);assert.equal(scene.children.filter(n=>n.visible).length,2);
  for(let i=0;i<100;i++)fx.shot(0,0,1,0);
  assert.equal(scene.children.length,48);fx.update(1);assert.equal(scene.children.filter(n=>n.visible).length,0);
  fx.sparks(0,0);assert.equal(scene.children.filter(n=>n.visible).length,7);
  fx.reset();assert(scene.children.every(n=>!n.visible));
});
test('weapon grip follows wrist position and rotation through roll, hit and death',async()=>{
  const human=await operator(),point=new THREE.Vector3(),rotation=new THREE.Quaternion();
  const hand=human.model.getObjectByName('WristR'),handRotation=new THREE.Quaternion();
  for(const state of [{aiming:true},{dashing:true},{dead:true}]){
    human.reset();for(let i=0;i<10;i++)human.update(.03,state);
    human.weaponPose(point,rotation);
    assert(point.distanceTo(hand.getWorldPosition(new THREE.Vector3()))<.00001);
    hand.getWorldQuaternion(handRotation);
    const barrel=new THREE.Vector3(0,0,1).applyQuaternion(rotation),fingers=new THREE.Vector3(0,1,0).applyQuaternion(handRotation);
    assert(barrel.distanceTo(fingers)<.00001,'barrel follows the wrist through full body animations');
  }
});
