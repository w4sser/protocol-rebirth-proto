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

import {fireAimedWeapon,stepWeapon,steerShot,knockEnemy} from '../weapon.js';
const mkRound=(enemy)=>({over:false,level:{enemies:[enemy],nodes:[],floors:200},enemiesDefeated:0,health:100,maxHealth:100,durationMs:1e9,startedAt:0,startAt:0});
test('shotgun stats: spread, short range, knock, pellets are clamped and carried',()=>{
  const w=readWeapon('id:shotgun_breach,dmg:3,mag:2,rld:1000,int:600,rng:4.5,cone:18,ast:22,spr:9,kb:99,pel:50,hom:9999');
  assert.equal(w.knockback,2);assert.equal(w.pellets,9);assert.equal(w.homingDegreesPerSecond,240);assert.equal(w.spreadDegrees,9);
  const items=globalThis.DATA?.items;if(items){const s=items.find(i=>i.id==='shotgun_breach').weapon;assert.ok(s.spr>0&&s.kb>0&&s.pel>1&&s.rng<=5);}
});
test('knockEnemy shoves a survivor along the shot and stops at walls',()=>{
  const e={id:'e',kind:'enemy',x:0,z:-3,r:.5,health:2};const round=mkRound(e);
  assert.ok(knockEnemy(round,e,{x:0,z:-1},{knockback:1.1},[],10));assert.ok(Math.abs(e.z+4.1)<.01);assert.equal(e.knockSerial,1);
  const f={id:'f',x:0,z:-3,health:2};knockEnemy(round,f,{x:0,z:-1},{knockback:1.1},[{x:0,z:-4.2,w:4,d:.4}],10);assert.ok(f.z>-3.6,'wall stops the shove');
  assert.equal(knockEnemy(round,{x:0,z:0,health:0},{x:0,z:-1},{knockback:1},[],0),false,'dead enemies are not shoved');
  assert.equal(knockEnemy(round,{x:0,z:0,health:1},{x:0,z:-1},{knockback:0},[],0),false);
});
test('shotgun fires a pellet fan (one ammo) and a hit shoves the target',()=>{
  const round=createRound('pel',0),e=round.level.enemies[0];Object.assign(e,{x:0,z:-3,r:.5,health:9,active:true});round.level.enemies=[e];round.level.boxes=[];round.level.walls=[];round.level.floors=[{x:0,z:0,w:60,d:60}];
  const w=createWeapon(Infinity,{id:'shotgun_breach',damage:1,capacity:2,range:4.5,assistAngleDegrees:22,coneHalfAngleDegrees:18,spreadDegrees:9,knockback:1.1,pellets:5,homingDegreesPerSecond:0});
  const shot=fireAimedWeapon(w,round,{x:0,z:0},{x:0,z:-1},1000,[]);
  assert.ok(shot);assert.equal(w.ammo,1,'one shell');assert.equal(w.projectiles.length,5,'real shot + 4 extra pellets');
  assert.ok(e.z<-3.9,'locked shot shoves immediately');assert.equal(e.health,8);
});
test('carbine tracer bends toward a target in a narrow cone, never aimbot',()=>{
  const rule=RULES.weapon,e={id:'e',kind:'enemy',x:1,z:-6,health:2};
  const b={x:0,z:0,dx:0,dz:-1,remaining:7};steerShot(b,[e],[],rule,.1);
  assert.ok(b.dx>0&&b.dx<.2,'turns toward target, capped by turn rate');
  const far={x:0,z:0,dx:0,dz:-1,remaining:7};steerShot(far,[{...e,x:4,z:-3}],[],rule,.1);assert.equal(far.dx,0,'target outside the cone is ignored');
  const blocked={x:0,z:0,dx:0,dz:-1,remaining:7};steerShot(blocked,[e],[{x:.5,z:-3,w:3,d:.3}],rule,.1);assert.equal(blocked.dx,0,'cover blocks homing');
  const rifle={...rule,homingDegreesPerSecond:0},r={x:0,z:0,dx:0,dz:-1,remaining:7};steerShot(r,[e],[],rifle,.1);assert.equal(r.dx,0);
});
