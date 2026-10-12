import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES} from '../levels.js';
import {readStats,readLaunch,buildRaidResult} from '../raid-result.js';
import {createRound,takeDamage,useHealthKit,stepNodeInteraction} from '../round.js';
import {createDash,startDash,dashCharge} from '../dash.js';
import * as combat from '../combat.js';
test('stats param is parsed and clamped; junk falls back to the base',()=>{
  assert.deepEqual(readStats('spd:3.9,stl:0.12,hp:115,dcd:3700'),{speed:3.9,stealth:.12,maxHealth:115,dashCooldownMs:3700});
  assert.deepEqual(readStats('spd:99,stl:-1,hp:5,dcd:1'),{speed:6,stealth:0,maxHealth:50,dashCooldownMs:2000});
  assert.deepEqual(readStats('spd:abc,zzz:4,hp:'),RULES.playerStats.base);
  assert.deepEqual(readStats(null),RULES.playerStats.base);
  assert.equal(RULES.playerStats.base.speed<4.5,true,'new players start slower than the old fixed 4.5 m/s');
});
test('gear param keeps only known gear ids',()=>{
  assert.deepEqual(readLaunch('?gear=scout_rig,evil,dampener_cloak').gear,['scout_rig','dampener_cloak']);
});
test('max health stat sets starting health and caps healing',()=>{
  const r=createRound('hp',0,readStats('hp:140'));assert.equal(r.health,140);assert.equal(r.maxHealth,140);
  takeDamage(r,30,1);r.bag.medkit=1;useHealthKit(r,2);assert.equal(r.health,140);
});
test('dash cooldown stat changes recharge time',()=>{
  const d=createDash();assert.ok(startDash(d,{x:1,z:0},0,2000));assert.equal(dashCharge(d,1000),.5);assert.equal(dashCharge(d,2000),1);
});
test('stealth shrinks enemy detection range',()=>{
  const run=stealth=>{
    const r=createRound('stealth',0,{...RULES.playerStats.base,stealth});r.level.enemies=[{id:'e',kind:'enemy',x:0,z:0,r:.48,health:2,speed:1}];
    const c=combat.createCombat(r.level,0);combat.stepCombat(r,c,{x:0,z:8},10000,.1,[]);return r.level.enemies[0];
  };
  assert.equal(run(0).aggro,true,'8 m is inside the 10 m base detection');
  const sneaky=run(.3);assert.ok(!sneaky.aggro,'30% stealth → 7 m detection');assert.equal(sneaky.z,0,'unaware enemies stay put');
});
test('raid result reports skill usage telemetry',()=>{
  const r=createRound('tele',0);r.telemetry.distanceM=42.4;r.telemetry.dashes=3;takeDamage(r,25,1);takeDamage(r,500,2);
  const res=buildRaidResult(r);
  assert.deepEqual(res.skills,{distanceM:42,dashes:3,holdNodes:0,damageTaken:100});
});
