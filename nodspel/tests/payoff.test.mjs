import test from 'node:test';import assert from 'node:assert/strict';
import {readLaunch} from '../raid-result.js';
import {applyFirstPayoff} from '../progression-goal.js';
import {generateLevel,RULES} from '../levels.js';
test('readLaunch whitelists payoff kinds from RULES.payoff',()=>{
 assert.equal(readLaunch('?payoff=loot_cluster').payoff,'loot_cluster');assert.equal(readLaunch('?payoff=free_tool').payoff,'free_tool');
 for(const bad of ['?payoff=nope','?payoff=','?payoff=__proto__','?payoff=constructor','']) assert.equal(readLaunch(bad).payoff,null,bad);
});
test('loot_cluster puts its full reward in existing crates without crowding early rooms',()=>{
 const cfg=RULES.payoff.loot_cluster;
 for(const seed of ['p1','p2','p3','layout','77d97187-meta'])for(const bag of [4,5,6,8]){
   const l=generateLevel(1,seed),before=structuredClone(l.lootBoxes);
   const units=boxes=>boxes.reduce((n,b)=>n+(b.quantity??1)+(b.contents?.length??0),0);
   const n=applyFirstPayoff(l,'loot_cluster',bag);
   assert(n>=bag&&n>=cfg.count);assert.equal(l.lootBoxes.length,before.length);
   assert.equal(units(l.lootBoxes)-units(before),n);
   const added=l.lootBoxes.flatMap(b=>b.contents??[]).sort();
   assert.deepEqual(added,Array.from({length:n},(_,i)=>cfg.items[i%cfg.items.length]).sort(),'authored payoff loot is preserved');
   for(const [i,b] of l.lootBoxes.entries()){
     assert.equal(b.x,before[i].x);assert.equal(b.z,before[i].z);
     assert.equal(b.item,before[i].item);assert.equal(b.collected,false);
     if(b.key)assert.equal(b.quantity,before[i].quantity,'key is unchanged');
   }
 }
});
test('payoff does nothing on levels 2/3, for unknown kinds, free_tool or none',()=>{
 for(const num of [2,3]){const l=generateLevel(num,'p1'),c=l.lootBoxes.length;assert.equal(applyFirstPayoff(l,'loot_cluster',5),0);assert.equal(l.lootBoxes.length,c);}
 const l=generateLevel(1,'p1'),c=l.lootBoxes.length;for(const k of ['free_tool','x',null,undefined])assert.equal(applyFirstPayoff(l,k,5),0);assert.equal(l.lootBoxes.length,c);
 assert(RULES.payoff.loot_cluster.notice&&RULES.payoff.free_tool.notice);
});
