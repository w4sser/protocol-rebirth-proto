import test from 'node:test';import assert from 'node:assert/strict';
import {createRound} from '../round.js?v=2.9.1';
import * as weapon from '../weapon.js?v=2.9.1';
import {traceTargets} from '../physics.mjs?v=2.9.1';
const pedestal={x:2,z:0,w:1.4,d:1.4};
test('an active node does not absorb player shots when its pedestal is out of the line',()=>{
  const r=createRound('shared-cover',0);r.level.enemies=[{id:'e',kind:'enemy',aggro:true,facing:Math.atan2(-4,-2.6),x:4,z:2.6,r:.48,health:2}];r.level.nodes=[{id:'n',x:2,z:0,r:.8,active:true}];
  const w=weapon.createWeapon();const shot=weapon.fireAimedWeapon(w,r,{x:0,z:0},{x:4,z:2.6},1000,[pedestal]);
  assert.ok(shot);for(let t=1000;t<2000&&w.projectiles.length;t+=16)weapon.stepWeapon(w,r,t,.016,[pedestal]);
  assert.equal(r.level.enemies[0].health,1);
});
test('a pedestal blocks player and enemy shots symmetrically',()=>{
  const player={x:0,z:0},enemy={x:4,z:0};
  assert.equal(traceTargets(enemy,player,[pedestal],[{...player,r:.36,kind:'player'}])?.kind,'wall');
  const r=createRound('shared-cover-2',0);r.level.enemies=[{id:'e',kind:'enemy',aggro:true,facing:0,...enemy,r:.48,health:2}];r.level.nodes=[{id:'n',x:2,z:0,r:.8,active:true}];
  const w=weapon.createWeapon();weapon.fireAimedWeapon(w,r,player,{x:1,z:0},1000,[pedestal]);
  for(let t=1000;t<2000&&w.projectiles.length;t+=16)weapon.stepWeapon(w,r,t,.016,[pedestal]);
  assert.equal(r.level.enemies[0].health,2);
});
