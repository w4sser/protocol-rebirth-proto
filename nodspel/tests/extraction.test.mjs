import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel} from '../levels.js';
import {createRound,takeDamage,activateNode,enterExit,roundSummary} from '../round.js';
const state=await import('../round.js');
test('loot boxes are seeded with a short-route crate and a guarded crate on level two',()=>{
  const first=generateLevel(1,'loot'),second=generateLevel(2,'loot');
  assert.equal(first.lootBoxes?.length,1);assert.equal(second.lootBoxes?.length,2);
  assert.deepEqual(second.lootBoxes,generateLevel(2,'loot').lootBoxes);
  for(const box of second.lootBoxes){assert.ok(['scrap_alloy','power_cell','cable','fuse','ammo_pack'].includes(box.item));if(!box.marked)assert.ok(second.enemies.some(e=>e.active!==false&&Math.hypot(e.x-box.x,e.z-box.z)<2));}
});
test('walking to a box puts one item in the bag only once',()=>{
  assert.equal(typeof state.collectLoot,'function');
  const r=createRound('collect',0),box=r.level.lootBoxes[0];
  box.item='scrap_alloy';
  assert.equal(state.collectLoot(r,{x:100,z:100},0),false);
  assert.equal(state.collectLoot(r,box,100),true);assert.equal(r.bag[box.item],1);
  assert.equal(state.collectLoot(r,box,200),false);assert.equal(r.bag[box.item],1);
});
test('death loses the current bag and a new run starts with full health and no carried loot',()=>{
  assert.equal(typeof state.collectLoot,'function');
  const r=createRound('death-loot',0),box=r.level.lootBoxes[0];state.collectLoot(r,box,100);
  takeDamage(r,100,200);assert.equal(r.health,0);assert.equal(r.bag[box.item],0);
  assert.equal(roundSummary(r).lost[box.item],1);assert.equal(roundSummary(r).extracted[box.item],0);
  assert.equal(state.collectLoot(r,box,300),false);
  const next=createRound('new-run',300);assert.equal(next.health,100);assert.deepEqual(next.bag,{scrap_alloy:0,power_cell:0,cable:0,fuse:0});
});
test('an open exit extracts the bag and secured items survive later death',()=>{
  assert.equal(typeof state.collectLoot,'function');
  const r=createRound('extract',0),box=r.level.lootBoxes[0];state.collectLoot(r,box,100);
  assert.equal(enterExit(r,r.level.exit,101),null);assert.equal(r.bag[box.item],1);
  for(const node of r.level.nodes)activateNode(r,node.id,200);
  assert.equal(enterExit(r,r.level.exit,201),'next');assert.equal(r.bag[box.item],0);assert.equal(r.extracted[box.item],1);
  const second=r.level.lootBoxes[0];second.item='fuse';state.collectLoot(r,second,250);takeDamage(r,100,300);
  assert.equal(r.extracted[box.item],1);assert.equal(r.lost[second.item],1);
});

test('the deadline loses carried loot before extraction can happen',()=>{
  const r=createRound('late-extraction',0),box=r.level.lootBoxes[0];state.collectLoot(r,box,100);
  for(const node of r.level.nodes)activateNode(r,node.id,200);
  assert.equal(enterExit(r,r.level.exit,480000),null);
  assert.equal(r.reason,'timeout');assert.equal(r.bag[box.item],0);
  assert.equal(roundSummary(r).lost[box.item],1);assert.equal(r.extracted[box.item],0);
});
