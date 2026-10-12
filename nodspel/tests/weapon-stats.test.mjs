import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES} from '../levels.js';
import {readLaunch,readWeapon,readKit,buildRaidResult} from '../raid-result.js';
import {createWeapon,fireWeapon,tickWeapon,assistAim,weaponRule} from '../weapon.js';
import {createRound,useHealthKit,takeDamage} from '../round.js';

test('no weapon param means the free Basic weapon (RULES.weapon)',()=>{
  assert.equal(readWeapon(null),null);assert.equal(readWeapon('dmg:4'),null,'stats without a known id are ignored');
  const w=createWeapon(Infinity,null);assert.equal(weaponRule(w).capacity,RULES.weapon.capacity);assert.equal(w.id,'basic_carbine');
});
test('weapon params are validated and clamped',()=>{
  const w=readWeapon('id:rifle_marksman,dmg:99,mag:0,rld:5,int:450,rng:40,cone:5,ast:8,spr:-3,evil:1');
  assert.deepEqual(w,{id:'rifle_marksman',damage:4,capacity:1,reloadMs:250,shotIntervalMs:450,range:12,coneHalfAngleDegrees:5,assistAngleDegrees:8,spreadDegrees:0});
  assert.equal(readWeapon('id:laser_cannon,dmg:2'),null,'unknown weapon id rejected');
  const l=readLaunch('?seed=s&w=id:smg_vector,mag:8,int:110&kit=medkit:9,bomb:3&gear=smg_vector');
  assert.equal(l.weapon.capacity,8);assert.equal(l.weapon.shotIntervalMs,110);assert.deepEqual(l.kit,{medkit:2});assert.deepEqual(l.gear,['smg_vector']);
  assert.deepEqual(readKit('medkit:x'),{medkit:0});
});
test('weapon stats drive magazine, fire rate, reload and range',()=>{
  const smg=createWeapon(Infinity,{id:'smg_vector',capacity:8,shotIntervalMs:110,reloadMs:450});
  assert.equal(smg.ammo,8);
  assert.ok(fireWeapon(smg,{x:0,z:0},{x:0,z:-1},0));assert.equal(fireWeapon(smg,{x:0,z:0},{x:0,z:-1},100),null,'fire interval respected');
  assert.ok(fireWeapon(smg,{x:0,z:0},{x:0,z:-1},110));assert.equal(smg.reloadAt,450,'reload uses the weapon reload time');
  tickWeapon(smg,450);assert.equal(smg.ammo,7);
  const enemy={id:'e',kind:'enemy',x:0,z:-10,r:.5,health:3};
  assert.equal(assistAim({x:0,z:0},{x:0,z:-1},[enemy],[],{...RULES.weapon,range:11}).target?.id,'e','rifle range locks at 10 m');
  assert.equal(assistAim({x:0,z:0},{x:0,z:-1},[enemy],[]).target,null,'basic range does not');
});
test('medkits brought from base are usable and reported back',()=>{
  const r=createRound('kit',0);r.kit={medkit:2};takeDamage(r,50,1);
  assert.ok(useHealthKit(r,2));assert.equal(r.kit.medkit,1);
  takeDamage(r,1000,3);const res=buildRaidResult(r,{launch:{raidId:null,seed:'kit',gear:[],weapon:{id:'shotgun_breach'}}});
  assert.equal(res.weapon,'shotgun_breach');assert.deepEqual(res.kitLeft,{medkit:1});
});
