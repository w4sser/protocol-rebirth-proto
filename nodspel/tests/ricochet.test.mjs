import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound} from '../round.js';
import {createWeapon,fireAimedWeapon,stepWeapon} from '../weapon.js';
import {perkState,cards} from '../perks.js';
function arena(perk=true){
  const r=createRound('ricochet',0);
  const enemy=(id,x,z)=>({id,kind:'enemy',type:'grunt',x,z,r:.48,health:10,active:true});
  Object.assign(r.level,{enemies:[enemy('first',0,-3),enemy('near',2,-3),enemy('third',3,-3)],nodes:[],walls:[],boxes:[]});
  if(perk)perkState(r).taken=['ricochet'];
  return r;
}
function fire(r,walls=[]){const w=createWeapon(Infinity,{damage:2});fireAimedWeapon(w,r,{x:0,z:0},{x:0,z:-1},100,walls);return w;}
test('Ricochet bounces once to the nearest enemy for half damage, without a second ammo cost or repeat tracer damage',()=>{
  const r=arena(),w=fire(r);assert.deepEqual(r.level.enemies.map(e=>e.health),[8,9,10]);assert.equal(w.ammo,w.rule.capacity-1);
  stepWeapon(w,r,200,.1,[]);assert.deepEqual(r.level.enemies.map(e=>e.health),[8,9,10]);assert.ok(perkState(r).events.some(e=>e.perk==='ricochet'&&/1 damage/.test(e.text)));
});
test('Ricochet excludes cover, queued swarm/dead enemies and targets beyond range; unselected perk has no effect',()=>{
  const ordinary=arena(false);fire(ordinary);assert.deepEqual(ordinary.level.enemies.map(e=>e.health),[8,10,10]);
  const blocked=arena();fire(blocked,[{x:1,z:-3,w:.3,d:2}]);assert.deepEqual(blocked.level.enemies.map(e=>e.health),[8,10,10]);
  const absent=arena();Object.assign(absent.level.enemies[1],{active:false,swarm:'queued'});absent.level.enemies[2].health=0;fire(absent);assert.deepEqual(absent.level.enemies.map(e=>e.health),[8,10,0]);
  const distant=arena();distant.level.enemies[1].x=20;distant.level.enemies[2].x=21;fire(distant);assert.deepEqual(distant.level.enemies.map(e=>e.health),[8,10,10]);
  assert.ok(cards.some(c=>c.id==='ricochet'));assert.ok(!cards.some(c=>c.id==='time'));
});
test('a lethal primary hit still bounces and a lethal bounce counts as a weapon kill',()=>{
  const r=arena();r.level.enemies[0].health=2;r.level.enemies[1].health=1;fire(r);assert.equal(r.enemiesDefeated,2);assert.deepEqual(r.level.enemies.map(e=>e.health),[0,0,10]);
});
test('Ricochet uses the bounce origin for a guard shield, rather than the player position',()=>{
  const r=arena(),guard=r.level.enemies[1];
  Object.assign(guard,{frontShield:30,facing:Math.atan2(-2,3)});r.shooter={x:0,z:0};
  fire(r);assert.equal(guard.health,9,'the bounce hits the exposed side even while the guard faces the player');
  const blocked=arena();Object.assign(blocked.level.enemies[1],{frontShield:30,facing:-Math.PI/2});
  fire(blocked);assert.equal(blocked.level.enemies[1].health,10,'a shield facing the bounce blocks it');
});

test('Ricochet wakes dormant defenders and records hit feedback through hitEnemy',()=>{
  const r=arena(),target=r.level.enemies[1];
  Object.assign(target,{active:false,aggro:false,spawnedAt:100});
  fire(r);
  assert.equal(target.health,9);assert.equal(target.active,true);assert.equal(target.aggro,true);
  assert.equal(target.attackWakeAt,100);assert.equal(target.lastHitAt,100);
  assert.equal(target.hitSerial,1);assert.equal(target.lastDamage,1);
});
test('a shield-blocked Ricochet still alerts the defender without damage feedback',()=>{
  const r=arena(),target=r.level.enemies[1];
  Object.assign(target,{active:false,aggro:false,frontShield:30,facing:-Math.PI/2});
  fire(r);
  assert.equal(target.health,10);assert.equal(target.aggro,true);assert.equal(target.active,true);
  assert.equal(target.blockedAt,100);assert.equal(target.blockedSerial,1);
  assert.equal(target.hitSerial,undefined);
});
test('a swept projectile hit bounces once and records aggro and damage on both enemies',()=>{
  const r=arena(),w=createWeapon(Infinity,{damage:2});
  const shot={id:1,x:0,z:0,dx:0,dz:-1,remaining:10};
  w.projectiles.push(shot);
  assert.equal(stepWeapon(w,r,200,1,[]),true);
  assert.deepEqual(r.level.enemies.map(e=>e.health),[8,9,10]);
  for(const target of r.level.enemies.slice(0,2)){
    assert.equal(target.aggro,true);assert.equal(target.lastHitAt,200);assert.equal(target.hitSerial,1);
  }
  stepWeapon(w,r,300,1,[]);
  assert.deepEqual(r.level.enemies.map(e=>e.health),[8,9,10]);
});
