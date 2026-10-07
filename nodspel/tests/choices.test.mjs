import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel} from '../levels.js';
import {traceTargets} from '../physics.mjs';
test('one marked non-solid loot box per level and level-three dead end holds it',()=>{
  for(let i=0;i<20;i++)for(const n of [1,2,3]){
    const l=generateLevel(n,`choices-${i}`),marked=l.lootBoxes.filter(b=>b.marked);
    assert.equal(marked.length,1);assert.ok(!l.boxes.includes(marked[0]));
    if(n===3)assert.ok(Math.hypot(marked[0].x-l.deadEnds[0].end.x,marked[0].z-l.deadEnds[0].end.z)<.1);
  }
});
test('level two presents node and short loot routes with deterministic swapped sides',()=>{
  const a=generateLevel(2,'restart-1'),b=generateLevel(2,'restart-2');
  assert.deepEqual(a,generateLevel(2,'restart-1'));
  assert.equal(a.routeChoices.length,2);assert.notDeepEqual(a.routeChoices.find(c=>c.kind==='loot').dir,b.routeChoices.find(c=>c.kind==='loot').dir);
  for(let i=0;i<20;i++){
    const l=generateLevel(2,`choices-${i}`),loot=l.routeChoices.find(c=>c.kind==='loot'),node=l.routeChoices.find(c=>c.kind==='node');
    assert.ok(loot.length<node.length);assert.equal(l.deadEnds.length,1);
    for(const choice of l.routeChoices)assert.notEqual(traceTargets(l.start,choice.sign,l.walls,[])?.kind,'wall','both choice signs visible from spawn');
    assert.ok(Math.hypot(l.lootBoxes[0].x-l.deadEnds[0].end.x,l.lootBoxes[0].z-l.deadEnds[0].end.z)<.1);
  }
});
