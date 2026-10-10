import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,collectLoot,tickRound} from '../round.js';
import {createWeapon,fireWeapon,tickWeapon} from '../weapon.js';
import {generateLevel} from '../levels.js';
const api=await import('../round.js');
test('empty ammo leaves the raid active and an ammo crate permits shooting again',()=>{
  const r=createRound('empty',0),w=createWeapon(0),box=r.level.lootBoxes[0];box.item='ammo_pack';
  tickRound(r,1000);assert.equal(r.over,false);
  assert.equal(collectLoot(r,box,1000,w),true);assert.equal(w.reserve,4);
  assert.equal(w.ammo,0);tickWeapon(w,1700);assert.equal(w.ammo,1);assert.equal(w.reserve,3);
  assert.ok(fireWeapon(w,box,{x:0,z:-1},1700));assert.equal(r.over,false);
  assert.equal(collectLoot(r,box,1800,w),false);
  assert.equal(r.bag.ammo_pack,undefined,'reserve ammo is equipment, not extracted loot');
});
test('seeded marked crates contain bag loot with unlimited ammunition',()=>{
  for(const n of [1,2,3]){
    const levels=Array.from({length:40},(_,i)=>generateLevel(n,`ammo-${i}`));
    assert.ok(levels.every(l=>l.lootBoxes.some(b=>b.marked&&b.item!=='ammo_pack')));
    for(const l of levels)assert.deepEqual(l,generateLevel(n,l.seed.slice(0,-2)));
    assert.ok(levels.every(l=>l.lootBoxes.every(b=>b.item!=='ammo_pack'||b.marked)));
  }
});
test('full ammo still allows two-second node activation without harming enemies or spending shots',()=>{
  assert.equal(typeof api.stepNodeInteraction,'function');
  const r=createRound('manual',0),w=createWeapon(12),n=r.level.nodes[0],pos={x:n.x,z:n.z+1.2};
  const health=r.level.enemies.map(e=>e.health);
  api.stepNodeInteraction(r,w,pos,100,[]);api.stepNodeInteraction(r,w,pos,1100,[]);
  assert.equal(n.active,false);assert.ok(r.nodeInteraction.progress>0);
  api.stepNodeInteraction(r,w,pos,2100,[]);assert.equal(n.active,true);
  assert.deepEqual(r.level.enemies.map(e=>e.health),health);
  assert.equal(w.ammo,3);assert.equal(w.reserve,9);
});
test('leaving range or cover resets node charging, but moving within range does not',()=>{
  assert.equal(typeof api.stepNodeInteraction,'function');
  const r=createRound('cancel',0),w=createWeapon(0),n=r.level.nodes[0],pos={x:n.x,z:n.z+1.2};
  api.stepNodeInteraction(r,w,pos,100,[]);api.stepNodeInteraction(r,w,{x:0,z:100},2100,[]);assert.equal(n.active,false);assert.equal(r.nodeInteraction,null);
  api.stepNodeInteraction(r,w,pos,2200,[{x:n.x,z:n.z+.6,w:2,d:.2}]);assert.equal(r.nodeInteraction,null);
  w.reserve=1;api.stepNodeInteraction(r,w,pos,5000,[]);assert.equal(r.nodeInteraction.progress,0);
  api.stepNodeInteraction(r,w,{x:pos.x+.2,z:pos.z},6000,[]);assert.equal(r.nodeInteraction.progress,.5);
});
