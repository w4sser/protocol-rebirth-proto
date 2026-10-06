import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,activateNode,enterExit} from '../round.js';
import {generateLevel} from '../levels.js';
import {createWeapon,fireWeapon,stepWeapon,assistAim} from '../weapon.js';
import {createCombat,stepCombat} from '../combat.js';
test('a kill immediately restores one shot and 15 health, once and capped',()=>{
  const r=createRound('reward',0),w=createWeapon();r.health=60;r.level.nodes=[];
  const foe=r.level.enemies[0];foe.x=3;foe.z=0;foe.health=1;
  fireWeapon(w,{x:0,z:0},{x:1,z:0},0);w.ammo=0;
  stepWeapon(w,r,100,.3,[]);assert.equal(r.health,75);assert.equal(w.ammo,1);
  stepWeapon(w,r,200,.3,[]);assert.equal(r.health,75);assert.equal(w.ammo,1);
});
test('level two has two active enemies in room two and two node-triggered reserves',()=>{
  const r=createRound('reserves',0);r.level=generateLevel(2,r.seed);
  assert.ok(r.level.enemies.every(e=>e.health===2));
  assert.equal(r.level.enemies.filter(e=>e.active!==false).length,2);
  const room=r.level.rooms[1];assert.ok(r.level.enemies.every(e=>Math.abs(e.x-room.x)<room.w/2&&Math.abs(e.z-room.z)<room.d/2));
  activateNode(r,r.level.nodes[0].id,2000);
  assert.equal(r.level.enemies.filter(e=>e.active!==false).length,4);
  const c=createCombat(r.level,0);stepCombat(r,c,{x:room.x,z:room.z+2},2100,.1,[]);assert.equal(c.projectiles.length,0);
});
test('a newly entered room grants three seconds without enemy fire',()=>{
  const r=createRound('entry',0);r.level=generateLevel(2,r.seed);
  const c=createCombat(r.level,0),room=r.level.rooms[1],p={x:room.x,z:room.z+2};
  stepCombat(r,c,p,10000,.04,[]);assert.equal(c.projectiles.length,0);
  stepCombat(r,c,p,12999,.04,[]);assert.equal(c.projectiles.length,0);
  stepCombat(r,c,p,13000,.04,[]);assert.ok(c.projectiles.length>0);
});
test('aim can lock an unlit node, while inactive enemies cannot be targeted',()=>{
  const n={id:'node',x:3,z:.3,r:.8,active:false};
  assert.equal(assistAim({x:0,z:0},{x:1,z:0},[n],[]).target?.id,'node');
  assert.equal(assistAim({x:0,z:0},{x:1,z:0},[{kind:'enemy',x:2,z:0,r:.48,health:2,active:false}],[]).target,null);
});
test('matching low-resource runs reach level two with more health and ammo after a kill',()=>{
  const results=[];
  for(const fight of [false,true]){
    const r=createRound('comparison',0),w=createWeapon();r.health=60;
    for(const node of r.level.nodes)activateNode(r,node.id,0);
    const foe=r.level.enemies[0];foe.x=3;foe.z=0;foe.health=1;
    fireWeapon(w,{x:0,z:0},{x:fight?1:-1,z:0},0);w.ammo=0;
    stepWeapon(w,r,100,.3,[]);
    assert.equal(enterExit(r,r.level.exit,101),'next');
    assert.equal(r.level.number,2);results.push({health:r.health,ammo:w.ammo});
  }
  assert.equal(results[1].health-results[0].health,15);
  assert.equal(results[1].ammo-results[0].ammo,1);
});
test('kill health and ammo never exceed their caps',()=>{
  const r=createRound('caps',0),w=createWeapon();r.health=95;r.level.nodes=[];
  const foe=r.level.enemies[0];foe.x=3;foe.z=0;foe.health=1;
  fireWeapon(w,{x:0,z:0},{x:1,z:0},0);w.ammo=3;
  stepWeapon(w,r,100,.3,[]);assert.equal(r.health,100);assert.equal(w.ammo,3);assert.equal(w.reloadAt,null);
});
