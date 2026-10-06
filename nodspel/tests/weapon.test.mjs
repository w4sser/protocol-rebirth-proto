import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound} from '../round.js';
import {RULES,generateLevel} from '../levels.js';
const weapon=await import('../weapon.js').catch(()=>({}));

test('three shots empty the magazine and the fourth cannot fire',()=>{
  assert.equal(typeof weapon.createWeapon,'function');
  const w=weapon.createWeapon();
  for(let i=0;i<3;i++)assert.ok(weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},i*200));
  assert.equal(w.ammo,0);
  assert.equal(weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},600),null);
});

test('reload restores one shot per interval and firing does not restart an existing refill',()=>{
  assert.equal(typeof weapon.createWeapon,'function');
  const w=weapon.createWeapon(),ms=RULES.weapon.reloadMs;
  weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},0);
  weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},200);
  weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},400);
  weapon.tickWeapon(w,ms-1);assert.equal(w.ammo,0);
  weapon.tickWeapon(w,ms);assert.equal(w.ammo,1);
  weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},ms+1);assert.equal(w.ammo,0);
  weapon.tickWeapon(w,ms*2);assert.equal(w.ammo,1);
  weapon.tickWeapon(w,ms*3);assert.equal(w.ammo,2);
  weapon.tickWeapon(w,ms*4);assert.equal(w.ammo,3);assert.equal(w.reloadAt,null);
});

test('a large frame cannot hit a target beyond the range circle',()=>{
  assert.equal(typeof weapon.createWeapon,'function');
  const r=createRound('range',0),w=weapon.createWeapon();
  const foe={id:'far',kind:'enemy',x:RULES.weapon.range+1,z:0,r:.48,health:2};r.level.enemies=[foe];r.level.nodes=[];
  weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},0);
  weapon.stepWeapon(w,r,100,1,[]);
  assert.equal(foe.health,2);assert.equal(w.projectiles.length,0);
});

test('shots damage within range but walls stop them before enemies or nodes',()=>{
  assert.equal(typeof weapon.createWeapon,'function');
  for(const covered of [false,true]){
    const r=createRound('cover',0),w=weapon.createWeapon();
    const foe={id:'near',kind:'enemy',x:3,z:0,r:.48,health:2};r.level.enemies=[foe];r.level.nodes=[];
    weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},0);
    weapon.stepWeapon(w,r,100,1,covered?[{x:1,z:0,w:.4,d:3}]:[]);
    assert.equal(foe.health,covered?2:2-RULES.weapon.damage);
    assert.equal(w.projectiles.length,0);
  }
  const r=createRound('node',0),w=weapon.createWeapon();r.level.enemies=[];r.level.nodes=[{id:'node',x:3,z:0,r:.8,active:false}];
  weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},0);
  weapon.stepWeapon(w,r,100,1,[{x:1,z:0,w:.4,d:3}]);assert.equal(r.nodesLit,0);
  weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},200);weapon.stepWeapon(w,r,300,1,[]);assert.equal(r.nodesLit,1);
});

test('ending a round clears projectiles before further damage',()=>{
  assert.equal(typeof weapon.createWeapon,'function');
  const r=createRound('ended',0),w=weapon.createWeapon();
  weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},0);
  r.over=true;weapon.stepWeapon(w,r,1000,1,[]);assert.equal(w.projectiles.length,0);
});

test('level three runners approach faster without outranging the player',()=>{
  for(let seed=0;seed<20;seed++){
    const level=generateLevel(3,`range-${seed}`);
    assert.ok(RULES.weapon.range>=RULES.combat.range);
    assert.ok(level.enemies[0].speed>generateLevel(1,`range-${seed}`).enemies[0].speed);
  }
});
test('level one enemy takes two shots and refills take 0.7 seconds',()=>{
  const r=createRound('balance',0),w=weapon.createWeapon();
  const foe=r.level.enemies[0];foe.x=3;foe.z=0;r.level.nodes=[];
  assert.equal(RULES.weapon.reloadMs,700);
  assert.equal(RULES.combat.damage,20);
  assert.equal(foe.health,RULES.weapon.damage*2);
  for(let i=0;i<2;i++){
    assert.ok(weapon.fireWeapon(w,{x:0,z:0},{x:1,z:0},i*200));
    weapon.stepWeapon(w,r,i*200+100,.2,[]);
    assert.equal(foe.health,RULES.weapon.damage*(1-i));
  }
  assert.equal(r.enemiesDefeated,1);assert.equal(w.ammo,2);
});
