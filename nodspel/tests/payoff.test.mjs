import test from 'node:test';import assert from 'node:assert/strict';
import {readLaunch} from '../raid-result.js';
import {applyFirstPayoff} from '../progression-goal.js';
import {generateLevel,RULES} from '../levels.js';
const inRoom=(l,b,m=0)=>{const r=l.rooms[0];return Math.abs(b.x-r.x)<=r.w/2-m&&Math.abs(b.z-r.z)<=r.d/2-m;};
test('readLaunch whitelists payoff kinds from RULES.payoff',()=>{
 assert.equal(readLaunch('?payoff=loot_cluster').payoff,'loot_cluster');assert.equal(readLaunch('?payoff=free_tool').payoff,'free_tool');
 for(const bad of ['?payoff=nope','?payoff=','?payoff=__proto__','?payoff=constructor','']) assert.equal(readLaunch(bad).payoff,null,bad);
});
test('loot_cluster seeds a dense cluster near spawn on free floor, level 1 only',()=>{
 const cfg=RULES.payoff.loot_cluster;
 for(const seed of ['p1','p2','p3','layout','77d97187-meta']){
  for(const bag of [4,5,6,8]){
   const l=generateLevel(1,seed),before=l.lootBoxes.length,n=applyFirstPayoff(l,'loot_cluster',bag);
   assert(n>=bag&&n>=cfg.count,`${seed} bag ${bag}: placed ${n}`);assert.equal(l.lootBoxes.length,before+n);
   const added=l.lootBoxes.slice(before);
   for(const b of added){
    assert(Math.hypot(b.x-l.start.x,b.z-l.start.z)<=6,'near spawn');assert(inRoom(l,b,1),'inside room');
    assert(![...l.walls,...l.boxes].some(o=>Math.abs(b.x-o.x)<o.w/2&&Math.abs(b.z-o.z)<o.d/2),'not inside a solid');
    assert(![...l.nodes,l.exit,...l.enemies].some(o=>Math.hypot(b.x-o.x,b.z-o.z)<1),'clear of objectives');
    assert.equal(b.collected,false);assert(RULES.loot.types.includes(b.item));
   }
   assert.equal(new Set(added.map(b=>b.id)).size,n);
  }
 }
});
test('payoff does nothing on levels 2/3, for unknown kinds, free_tool or none',()=>{
 for(const num of [2,3]){const l=generateLevel(num,'p1'),c=l.lootBoxes.length;assert.equal(applyFirstPayoff(l,'loot_cluster',5),0);assert.equal(l.lootBoxes.length,c);}
 const l=generateLevel(1,'p1'),c=l.lootBoxes.length;for(const k of ['free_tool','x',null,undefined])assert.equal(applyFirstPayoff(l,k,5),0);assert.equal(l.lootBoxes.length,c);
 assert(RULES.payoff.loot_cluster.notice&&RULES.payoff.free_tool.notice);
});
