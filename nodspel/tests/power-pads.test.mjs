import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,shootJunction} from '../round.js';
import {generateLevel,placePowerPads,hazardState,RULES} from '../levels.js';
import {stepHazards} from '../combat.js';
import {createWeapon,fireAimedWeapon,stepWeapon} from '../weapon.js';
import {traceTargets} from '../physics.mjs';
import {applyFtueLevel} from '../ftue.js';

function setup(){
  const r=createRound('pads-test',0);r.level.enemies=[{id:'e',kind:'enemy',x:0,z:0,health:20,active:true,r:.48}];
  r.level.hazards=[{id:'p',x:0,z:0,w:1.8,d:1.8,phaseMs:0}];
  r.level.junctions=[{id:'j',kind:'junction',x:2,z:0,r:.7,padId:'p'}];
  return r;
}
const player={x:10,z:10};
test('live pads damage and stun enemies; off, warning and dead pads do not',()=>{
  for(const now of [100,2000,2600]){
    const r=setup();stepHazards(r,player,now,.5);
    assert.equal(r.level.enemies[0].health,now===2600?19:20);
    if(now===2600)assert.ok(r.level.enemies[0].stunnedUntil>now);
  }
  const r=setup();r.level.hazards[0].deadUntil=9000;
  stepHazards(r,player,2600,1);assert.equal(r.level.enemies[0].health,20);
});
test('a dash-invulnerable player never suppresses enemy pad damage',()=>{
  const r=setup();stepHazards(r,{x:0,z:0},2600,.5,{remaining:1,startedAt:2550});
  assert.equal(r.level.enemies[0].health,19);assert.equal(r.health,r.maxHealth);
});
test('shoot off to live, then overload radial damage once, cooldown, normal cycle',()=>{
  const r=setup(),p=r.level.hazards[0],e=r.level.enemies[0];
  const near={...e,id:'near',x:2.8},far={...e,id:'far',x:3.1};r.level.enemies.push(near,far);
  assert.ok(shootJunction(r,'j',100));assert.equal(hazardState(p,100),'on');
  assert.ok(shootJunction(r,'j',200));assert.equal(hazardState(p,200),'overload');
  assert.equal(e.health,20-RULES.junction.overloadDamage);assert.equal(near.health,e.health);assert.equal(far.health,20);
  assert.equal(shootJunction(r,'j',201),false);assert.equal(e.health,15);
  const dead=200+RULES.junction.overloadMs;
  assert.equal(hazardState(p,dead),'dead');assert.equal(shootJunction(r,'j',dead+1),false);
  stepHazards(r,player,dead+100,.5);assert.equal(e.health,15);
  assert.equal(hazardState(p,p.deadUntil),'off');
  assert.equal(hazardState(p,p.deadUntil+RULES.hazard.offMs),'on');
});
test('activation returns to cycling and pause/terminal rounds reject shooting',()=>{
  const r=setup(),p=r.level.hazards[0];shootJunction(r,'j',100);
  assert.equal(hazardState(p,100+RULES.hazard.onMs),'off');
  r.pauseAt=200;assert.equal(shootJunction(r,'j',300),false);r.pauseAt=null;r.over=true;
  assert.equal(shootJunction(r,'j',400),false);
});
test('conventional projectile shooting hits the junction',()=>{
  const r=setup();r.level.enemies=[];r.level.nodes=[];r.level.barrels=[];
  const w=createWeapon();
  const shot=fireAimedWeapon(w,r,{x:2,z:-3},{x:0,z:1},100,[],false,false);
  assert.ok(shot);
  for(let now=116;now<=1100;now+=16)stepWeapon(w,r,now,.016,[]);
  assert.ok(r.level.hazards[0].forcedUntil>1100); // projectile turned the pad live
  assert.ok(r.level.junctions[0].shotAt>100);
});
test('day-2 pair deterministic, shared cap, walkable firing lane and patrol crossing across seeds',()=>{
  for(let i=0;i<1000;i++){
    const seed='pad-'+i,a=generateLevel(1,seed),b=generateLevel(1,seed);
    assert.ok(placePowerPads(a,2),seed);assert.ok(placePowerPads(b,2),seed);
    assert.deepEqual(a.junctions,b.junctions);assert.deepEqual(a.hazards,b.hazards);
    const j=a.junctions[0],p=a.hazards[0],patrol=a.enemies.find(e=>e.id===j.patrolId);
    let crosses=false;
    const [u,v]=patrol.patrol.points;
    for(let k=0;k<=100;k++){const x=u.x+(v.x-u.x)*k/100,z=u.z+(v.z-u.z)*k/100;
      if(Math.abs(x-p.x)<=p.w/2&&Math.abs(z-p.z)<=p.d/2)crosses=true;}
    assert.ok(crosses,seed);
    assert.notEqual(traceTargets(j.vantage,j,[...a.walls,...a.boxes],[])?.kind,'wall',seed);
    for(const room of a.rooms){const inside=o=>Math.abs(o.x-room.x)<room.w/2&&Math.abs(o.z-room.z)<room.d/2;
      assert.ok([...a.barrels,...a.hazards,...a.junctions].filter(inside).length<=RULES.interactives.maxPerRoom,seed);}
    for(const o of [p,j]){
      assert.ok(Math.hypot(o.x-a.exit.x,o.z-a.exit.z)>=RULES.junction.exitClearance,seed);
      for(const wall of [...a.walls,...a.boxes])assert.ok(Math.abs(o.x-wall.x)>=wall.w/2+(o.r??o.w/2)||Math.abs(o.z-wall.z)>=wall.d/2+(o.r??o.d/2),seed);
    }
  }
});
test('no pair before day 2, in FTUE, other areas or later floors',()=>{
  for(const raids of [0,1]){const r=createRound('pads-gate',0,undefined,{completedRaids:raids});assert.equal(r.level.junctions.length,0);}
  for(const area of ['archipelago','town'])assert.equal(placePowerPads(generateLevel(1,'gate',area),2),false);
  for(const n of [2,3])assert.equal(placePowerPads(generateLevel(n,'gate'),2),false);
  const r=createRound('pads-gate',0,undefined,{completedRaids:2,ftue:true});assert.equal(r.level.junctions.length,0);
  r.ftue={healthMul:1,speedMul:1};applyFtueLevel(r);assert.equal(r.level.junctions.length,0);assert.equal(r.level.hazards.length,0);
  assert.equal(createRound('pads-gate',0,undefined,{completedRaids:2}).level.junctions.length,1);
});

test('legacy pads also consume shared interactive slots on every Bunker floor',()=>{
 for(let i=0;i<200;i++)for(const n of [1,2,3]){
  const l=generateLevel(n,'shared-pad-'+i);
  for(const room of l.rooms){const inside=o=>Math.abs(o.x-room.x)<=room.w/2&&Math.abs(o.z-room.z)<=room.d/2;
   assert.ok([...l.barrels,...l.hazards,...l.junctions??[]].filter(inside).length<=RULES.interactives.maxPerRoom,`seed ${i}, floor ${n}`);}
 }
});
