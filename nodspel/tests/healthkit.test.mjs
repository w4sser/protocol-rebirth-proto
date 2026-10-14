import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,collectLoot,useHealthKit,extractRound} from '../round.js';
import {RULES} from '../levels.js';
import {buildRaidResult} from '../raid-result.js';
const kitBox=(r,id,x=0)=>{const b={id,x,z:0,item:'medkit',collected:false};r.level.lootBoxes.push(b);return b;};
test('picked-up health kits go to the kit slot, not the bag',()=>{
  const r=createRound('hk',0);r.level.lootBoxes=[];r.kit={medkit:0};const b=kitBox(r,'k1');
  assert.ok(collectLoot(r,{x:0,z:0},1));assert.equal(b.collected,true);assert.equal(r.kit.medkit,1);assert.equal(r.bag.medkit,0);
});
test('kit slot holds max 2; a full slot leaves the kit on the ground with one notice',()=>{
  assert.equal(RULES.kitMax.medkit,2);
  const r=createRound('hk2',0);r.level.lootBoxes=[];r.kit={medkit:2};const b=kitBox(r,'k3');
  assert.ok(collectLoot(r,{x:0,z:0},5));assert.equal(b.collected,false,'stays on the ground');assert.equal(r.kit.medkit,2);assert.equal(r.kitFull.at,5);
  assert.equal(collectLoot(r,{x:0,z:0},6),false,'no repeat notice while standing there');
  r.health=50;assert.ok(useHealthKit(r,7));assert.equal(r.kit.medkit,1);
  collectLoot(r,{x:9,z:9},8);assert.ok(collectLoot(r,{x:0,z:0},9));assert.equal(b.collected,true,'picked up once there is room');assert.equal(r.kit.medkit,2);
});
test('bag stays free: a full bag does not block a kit pickup',()=>{
  const r=createRound('hk3',0);r.level.lootBoxes=[];r.kit={medkit:0};r.bag.cable=r.bagCapacity;const b=kitBox(r,'k4');
  collectLoot(r,{x:0,z:0},1);assert.equal(b.collected,true);assert.equal(r.kit.medkit,1);assert.equal(r.bagFull,undefined);
});
test('unused kits (brought + picked up) are reported in kitLeft',()=>{
  const r=createRound('hk4',0);r.level.lootBoxes=[];r.kit={medkit:1};kitBox(r,'k5');collectLoot(r,{x:0,z:0},1);
  r.over=true;r.reason='extract';const res=buildRaidResult(r);assert.equal(res.kitLeft.medkit,2);assert.ok(!res.extracted.includes('medkit'));
});
import {lootAction,kitSlotFull} from '../round.js';
test('ground health kit reads SLOT FULL while the slot is full, COLLECT otherwise',()=>{
  const r=createRound('hk5',0);r.kit={medkit:1};assert.deepEqual(lootAction(r,'medkit'),{text:'COLLECT',full:false});
  r.kit.medkit=2;assert.ok(kitSlotFull(r));assert.deepEqual(lootAction(r,'medkit'),{text:'SLOT FULL',full:true});
  assert.equal(lootAction(r,'cable').text,'COLLECT','other loot unaffected');
});
