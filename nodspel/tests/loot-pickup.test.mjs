import test from 'node:test';import assert from 'node:assert/strict';
import {createRound,collectLoot} from '../round.js?v=2.2.0';
import {RULES} from '../levels.js?v=2.2.0';
test('loot is collected within the widened 1.6 pickup radius',()=>{
  assert.equal(RULES.loot.pickupRadius,1.6);
  const r=createRound('loot-radius',0);r.level.lootBoxes=[{id:'l',x:0,z:0,item:'cable',collected:false}];
  assert.equal(collectLoot(r,{x:1.7,z:0},0),false);
  assert.equal(collectLoot(r,{x:1.5,z:0},0),true);assert.equal(r.bag.cable,1);
});
