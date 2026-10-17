// v1.59: equipment pickups go straight to the character slots, never the bag.
import test from 'node:test';import assert from 'node:assert/strict';
import {createRound,collectLoot,initEquip,swapGear,lootAction,extractRound,bagCapacityOf} from '../round.js';
import {buildRaidResult} from '../raid-result.js';
import {bagItems} from '../raid.js';
const place=(r,item,id='g1')=>{const b={id,x:50,z:50,item,collected:false,revealed:true};r.level.lootBoxes=[b];return b;};
const at={x:50,z:50};
test('empty armor slot auto-equips; stats + bag slot apply; never in the bag',()=>{
  const r=createRound('gear-a',0,{bagCapacity:4});initEquip(r,{});const spd=r.stats.speed;
  place(r,'scout_rig');assert.equal(lootAction(r,'scout_rig').text,'EQUIP');
  assert.ok(collectLoot(r,at,10));assert.equal(r.equip.armor,'scout_rig');assert.equal(bagItems(r.bag).length,0,'not in the bag');
  assert.ok(Math.abs(r.stats.speed-(spd+.45))<1e-9);assert.equal(r.maxShield,10);assert.equal(r.shield,10);assert.equal(bagCapacityOf(r),5);
  assert.deepEqual(r.lastEquip,{slot:'armor',item:'scout_rig',old:null,at:10});});
test('Basic Carbine counts as an empty weapon slot (stays infinite, never dropped)',()=>{
  const r=createRound('gear-b',0);initEquip(r,{weapon:'basic_carbine'});place(r,'smg_vector');
  collectLoot(r,at,5);assert.equal(r.equip.weapon,'smg_vector');assert.equal(r.level.lootBoxes.length,1,'nothing dropped');});
test('occupied slot: one swap offer, tap swaps, swapped-out piece dropped on the ground',()=>{
  const r=createRound('gear-c',0,{bagCapacity:5,shield:25});initEquip(r,{gear:['scavenger_vest']});r.shield=5;
  const box=place(r,'scout_rig');assert.equal(lootAction(r,'scout_rig').text,'SWAP');
  assert.ok(collectLoot(r,at,10));assert.equal(r.equip.armor,'scavenger_vest');assert.equal(box.collected,false);assert.deepEqual(r.gearOffer,{boxId:'g1',item:'scout_rig',slot:'armor',at:10});
  r.gearOffer=null;assert.equal(collectLoot(r,at,20),false,'no repeat offer while standing on it');
  r.gearOffer={boxId:'g1',item:'scout_rig',slot:'armor',at:20};
  const d=swapGear(r,'g1',30);assert.equal(r.equip.armor,'scout_rig');assert.equal(box.collected,true);
  assert.equal(d.item,'scavenger_vest');assert.equal(d.revealed,true);assert.equal(d.blockedUntilLeft,true);
  assert.equal(r.maxShield,10);assert.equal(r.shield,5,'shield never refills above the new max on a downgrade');assert.equal(bagCapacityOf(r),5);
  assert.equal(bagItems(r.bag).length,0);});
test('raid result reports equipped gear (raid-found gear comes home on extract)',()=>{
  const r=createRound('gear-d',0);initEquip(r,{gear:['scavenger_vest']});place(r,'rifle_marksman');collectLoot(r,at,10);
  r.levelsCleared=1;extractRound(r,20);const res=buildRaidResult(r,{launch:{raidId:'x',seed:'gear-d',gear:['scavenger_vest']}});
  assert.deepEqual(res.gearOut.sort(),['rifle_marksman','scavenger_vest']);assert.equal(res.extracted.length,0,'gear is not loot');});
