import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {
  createBitDistract,bitDistractReady,bitDistractCooldownMs,pickImmediateThreat,
  tryActivateBitDistract,stepBitDistract,isEnemyResistant,chipNeverLethal,
} from '../bit-distract.js';
import {RULES} from '../levels.js';

const T=RULES.bit.distract;
const player={x:0,z:0};
function grunt(id,opts={}){return {id,type:'grunt',health:3,x:5,z:0,speed:2,...opts};}

test('pickImmediateThreat prefers a telegraphing enemy over a nearer idle one',()=>{
  const near=grunt('near',{x:2,z:0}); // closer, but not aware of the player at all
  const telegraphing=grunt('far',{x:8,z:0,windupAt:999}); // farther, mid wind-up
  const picked=pickImmediateThreat([near,telegraphing],player,T.range);
  assert.equal(picked.id,'far');
});

test('pickImmediateThreat ranks aggro above merely-alerted, and ignores generators/sleeping/out-of-range',()=>{
  const alerted=grunt('alerted',{x:3,z:0,alertAt:100});
  const aggro=grunt('aggro',{x:6,z:0,aggro:true});
  const generator=grunt('gen',{x:1,z:0,type:'generator'});
  const sleeping=grunt('sleep',{x:1.5,z:0,sleeping:true,aggro:true});
  const dead=grunt('dead',{x:1,z:0,health:0,aggro:true});
  const farAway=grunt('faraway',{x:T.range+5,z:0,aggro:true});
  const picked=pickImmediateThreat([alerted,aggro,generator,sleeping,dead,farAway],player,T.range);
  assert.equal(picked.id,'aggro');
});

test('pickImmediateThreat ties go to the nearest',()=>{
  const a=grunt('a',{x:6,z:0,aggro:true}),b=grunt('b',{x:4,z:0,aggro:true});
  assert.equal(pickImmediateThreat([a,b],player,T.range).id,'b');
});

test('no-target starts the shorter cooldown and does not lure anything',()=>{
  const state=createBitDistract(),bit={x:0,z:0};
  const result=tryActivateBitDistract(state,{},bit,player,[],0);
  assert.equal(result.ok,false);assert.equal(result.reason,'no-target');
  assert.equal(bitDistractCooldownMs(state,0),T.noTargetCooldownMs);
  assert.equal(state.cooldownDuration,T.noTargetCooldownMs);
  assert.equal(bitDistractReady(state,T.noTargetCooldownMs),true);
  assert.equal(bitDistractReady(state,T.noTargetCooldownMs-1),false);
});

test('success lures exactly one enemy for the ordinary duration, and starts the full cooldown',()=>{
  const state=createBitDistract(),bit={x:0,z:0};
  const near=grunt('e1',{x:5,z:0,aggro:true}),far=grunt('e2',{x:9,z:0,aggro:true});
  const result=tryActivateBitDistract(state,{},bit,player,[near,far],0);
  assert.equal(result.ok,true);assert.equal(result.enemyId,'e1');
  assert.ok(near.lureTarget);assert.equal(near.lureUntil,T.durationMs);
  assert.equal(far.lureTarget,undefined,'only the picked enemy is lured');
  assert.equal(bitDistractCooldownMs(state,0),T.cooldownMs);
  assert.equal(state.cooldownDuration,T.cooldownMs);
  assert.equal(bitDistractReady(state,T.cooldownMs),true);
});

test('resistant guard/turret types get the shorter resistant window instead',()=>{
  const state=createBitDistract(),bit={x:0,z:0};
  const turret=grunt('turret',{x:5,z:0,aggro:true,type:'turret',speed:0});
  const result=tryActivateBitDistract(state,{},bit,player,[turret],0);
  assert.equal(result.ok,true);assert.equal(result.resistant,true);
  assert.equal(turret.lureUntil,T.resistantDurationMs);
  assert.ok(T.resistantDurationMs<T.durationMs);
  const guard=grunt('guard',{x:5,z:0,aggro:true,encounter:'guard',speed:0});
  assert.equal(isEnemyResistant(guard),true);
  assert.equal(isEnemyResistant(grunt('g',{})),false);
});

test('chipNeverLethal never reduces health to 0; otherwise it chips the zap amount',()=>{
  const nearlyDead=grunt('a',{health:1});
  assert.equal(chipNeverLethal(nearlyDead,T.zapDamage,0),false);
  assert.equal(nearlyDead.health,1);
  const healthy=grunt('b',{health:3});
  assert.equal(chipNeverLethal(healthy,T.zapDamage,0),true);
  assert.equal(healthy.health,2);
  assert.equal(healthy.lastDamage,T.zapDamage);assert.equal(healthy.hitSerial,1);
});

test('a second activation during cooldown is a no-op: no new lure, same cooldown',()=>{
  const state=createBitDistract(),bit={x:0,z:0};
  const first=grunt('e1',{x:5,z:0,aggro:true}),second=grunt('e2',{x:5,z:0,aggro:true});
  tryActivateBitDistract(state,{},bit,player,[first,second],0);
  const readyAtAfterFirst=state.readyAt;
  const result=tryActivateBitDistract(state,{},bit,player,[first,second],100);
  assert.equal(result.ok,false);assert.equal(result.reason,'cooldown');
  assert.equal(state.readyAt,readyAtAfterFirst);
  assert.equal(second.lureTarget,undefined);
});

test('stepBitDistract flies BIT to the target, keeps the lure on BIT, zaps once, then expires the lure',()=>{
  const state=createBitDistract(),bit={x:0,z:0};
  const enemy=grunt('e1',{x:10,z:0,aggro:true,health:3});
  tryActivateBitDistract(state,{},bit,{x:0,z:0},[enemy],0);
  let zap=null;
  for(let i=0;i<200&&state.active;i++)zap=stepBitDistract(state,{},bit,{x:0,z:0},[enemy],i*20,0.02)||zap;
  assert.ok(zap,'a zap should have fired while BIT closed in');
  assert.equal(enemy.health,3-T.zapDamage);
  assert.equal(enemy.lureTarget,undefined,'lure is cleared once the distraction ends');
  assert.equal(enemy.lureUntil,undefined);
});

test('BIT holds a fixed hover point and does not back toward the player as the enemy approaches',()=>{
  const state=createBitDistract(),bit={x:0,z:0};
  const enemy=grunt('e1',{x:10,z:0,aggro:true,health:5});
  tryActivateBitDistract(state,{},bit,{x:0,z:0},[enemy],0);
  for(let i=0;i<80;i++)stepBitDistract(state,{},bit,{x:0,z:0},[enemy],i*20,0.02);
  const settledX=bit.x;
  assert.ok(Math.abs(settledX-(10-T.hoverDistance))<0.2,'BIT should hover just in front of the enemy toward the player');
  enemy.x=8; // enemy walked toward BIT / the player
  for(let i=0;i<20;i++)stepBitDistract(state,{},bit,{x:0,z:0},[enemy],1600+i*20,0.02);
  assert.ok(Math.abs(bit.x-settledX)<0.05,'hover point must stay fixed so BIT does not kite the enemy into the player');
});

test('module does not import combat.js or weapon.js',()=>{
  const src=fs.readFileSync(new URL('../bit-distract.js',import.meta.url),'utf8');
  for(const forbidden of ['./combat.js','./weapon.js'])
    assert.ok(!src.includes(forbidden),`bit-distract.js must not import ${forbidden}`);
});
