import test from 'node:test';import assert from 'node:assert/strict';
import {createRound,enterExit,activateNode,collectLoot,tickRound} from '../round.js';import {generateLevel} from '../levels.js';
import {buildRaidResult} from '../raid-result.js';
test('final level: nodes done opens the extract but the raid continues until the player walks into the zone',()=>{
  const t0=1e6,r=createRound('fx',t0);r.level=generateLevel(3,'fx');r.levelsCleared=2;const L=r.level,ex=L.exit;
  for(const n of L.nodes)activateNode(r,n.id,t0+10);
  assert.equal(enterExit(r,{x:ex.x,z:ex.z},t0+20),null,'standing in the zone when it opens does not extract');assert.ok(!r.over);
  const box=L.lootBoxes.find(b=>b.item!=='ammo_pack');assert.ok(collectLoot(r,box,t0+30,null),'free looting after the nodes');assert.ok(!r.over&&r.remainingMs<8*60e3);
  assert.equal(enterExit(r,{x:ex.x+5,z:ex.z},t0+40),null);assert.ok(!r.over,'still at risk, timer running');
  tickRound(r,t0+50);assert.ok(!r.over);
  assert.equal(enterExit(r,{x:ex.x,z:ex.z},t0+60),'complete');assert.ok(r.over&&r.reason==='complete'&&r.cleared);
  assert.ok(Object.values(r.extracted).reduce((a,b)=>a+b,0)>=1,'bag secured only on extraction');
  const res=buildRaidResult(r,{launch:{raidId:'x'}});assert.ok(res);});
test('final level: dying after the nodes still loses the bag (risk remains)',async()=>{
  const {takeDamage}=await import('../round.js');const t0=1e6,r=createRound('fy',t0);r.level=generateLevel(3,'fy');r.levelsCleared=2;
  for(const n of r.level.nodes)activateNode(r,n.id,t0);const box=r.level.lootBoxes.find(b=>b.item!=='ammo_pack');collectLoot(r,box,t0+1,null);
  takeDamage(r,999,t0+2);assert.equal(r.reason,'death');assert.equal(Object.values(r.extracted).reduce((a,b)=>a+b,0),0);});
test('levels 1-2 exit unchanged: walking onto an open exit advances immediately',()=>{
  const t0=1e6,r=createRound('fz',t0);for(const n of r.level.nodes)activateNode(r,n.id,t0);assert.equal(enterExit(r,r.level.exit,t0+1),'next');});
