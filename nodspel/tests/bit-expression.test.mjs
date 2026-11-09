import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {
  createBitExpression,currentBitExpression,bitExpressionPresentation,
  triggerBitThreat,triggerBitDamage,triggerBitLoot,triggerBitExtract,triggerBitFailure,
  combatIsHot,forceBitExpression,BIT_EXPRESSIONS,
} from '../bit-expression.js';
import {RULES} from '../levels.js';

test('event -> expression mapping: each trigger shows its own state',()=>{
  for(const [id,fire] of [['threat',triggerBitThreat],['damage',triggerBitDamage],['failure',triggerBitFailure]]){
    const e=createBitExpression();
    assert.equal(currentBitExpression(e,0),'idle');
    assert.equal(fire(e,0),true);
    assert.equal(currentBitExpression(e,0),id);
  }
  {const e=createBitExpression();assert.equal(triggerBitLoot(e,0,false),true);assert.equal(currentBitExpression(e,0),'loot');}
  {const e=createBitExpression();assert.equal(triggerBitExtract(e,0,false),true);assert.equal(currentBitExpression(e,0),'extract');}
});

test('each state decays back to idle once its duration passes',()=>{
  const e=createBitExpression();triggerBitLoot(e,0,false);
  const until=e.until;
  assert.equal(currentBitExpression(e,until-1),'loot');
  assert.equal(currentBitExpression(e,until),'idle');
});

test('priority: failure and damage outrank loot; a shooting threat outranks a lower-urgency flourish',()=>{
  const e=createBitExpression();
  triggerBitLoot(e,0,false);assert.equal(currentBitExpression(e,0),'loot');
  assert.equal(triggerBitThreat(e,10),true,'threat interrupts loot');
  assert.equal(currentBitExpression(e,10),'threat');
  assert.equal(triggerBitDamage(e,20),true,'damage interrupts threat');
  assert.equal(currentBitExpression(e,20),'damage');
  // A late loot pickup cannot cut a still-playing damage reaction short.
  assert.equal(triggerBitLoot(e,20,false),false);
  assert.equal(currentBitExpression(e,20),'damage');
  // Failure outranks everything, including an in-progress damage reaction.
  assert.equal(triggerBitFailure(e,21),true);
  assert.equal(currentBitExpression(e,21),'failure');
  // Nothing (not even another damage event) can cut a live failure state short.
  assert.equal(triggerBitDamage(e,21),false);
  assert.equal(currentBitExpression(e,21),'failure');
});

test('anti-spam: duration/cooldown stop the same reaction from retriggering every frame',()=>{
  const e=createBitExpression();
  assert.equal(triggerBitThreat(e,0),true);
  const firstUntil=e.until;
  // Called again one "frame" later while still playing and still on cooldown: a no-op, not a reset.
  assert.equal(triggerBitThreat(e,5),false);
  assert.equal(e.until,firstUntil);
  // Still within cooldown even after the pulse itself has ended.
  assert.equal(triggerBitThreat(e,firstUntil+1),false);
  // Cooldown has fully elapsed: the same continuing condition is allowed to pulse again.
  assert.equal(triggerBitThreat(e,e.cooldownThreat),true);
});

test('combat-quiet suppresses loot/extract flourishes but never threat, damage or failure',()=>{
  const e=createBitExpression();
  assert.equal(triggerBitLoot(e,0,true),false);
  assert.equal(currentBitExpression(e,0),'idle');
  assert.equal(triggerBitExtract(e,0,true),false);
  assert.equal(currentBitExpression(e,0),'idle');
  assert.equal(triggerBitThreat(e,0),true);
  assert.equal(triggerBitDamage(e,1),true);
  const e2=createBitExpression();assert.equal(triggerBitFailure(e2,0),true);
});

test('combatIsHot: two or more aware enemies, or any telegraph, counts as an intense firefight',()=>{
  assert.equal(combatIsHot(0,false),false);
  assert.equal(combatIsHot(1,false),false);
  assert.equal(combatIsHot(2,false),true);
  assert.equal(combatIsHot(0,true),true);
});

test('presentation params are distinct per state, not a shared no-op table',()=>{
  const e=createBitExpression(),now=0;
  const idle=bitExpressionPresentation(e,now);
  triggerBitFailure(e,now);
  const failure=bitExpressionPresentation(e,now);
  assert.notEqual(idle,failure);
  assert.notEqual(idle.brightness,failure.brightness);
  assert.notEqual(idle.altitude,failure.altitude);
  // Every declared state has its own fully-populated recipe (hover/tilt/antenna/brightness/eye).
  for(const id of BIT_EXPRESSIONS){
    const p=RULES.bit.expression.presentation[id];
    assert.ok(p,`missing presentation for ${id}`);
    for(const key of ['hoverAmplitude','hoverSpeed','altitude','tiltX','tiltZ','antennaTilt','brightness','eyeSquint'])
      assert.equal(typeof p[key],'number',`${id}.${key} should be a tunable number`);
  }
});

test('bitExpress debug helper forces any state (or idle) bypassing priority and cooldown',()=>{
  const e=createBitExpression();
  triggerBitFailure(e,0); // highest priority, long cooldown
  assert.equal(forceBitExpression(e,'loot',1,5000),true);
  assert.equal(currentBitExpression(e,1),'loot');
  assert.equal(forceBitExpression(e,'idle',1),true);
  assert.equal(currentBitExpression(e,1),'idle');
  assert.equal(forceBitExpression(e,'not-a-real-state',1),false);
});

test('M40 guard: expression is presentation-only -- the module never imports combat/heal/loot code',()=>{
  const src=fs.readFileSync(new URL('../bit-expression.js',import.meta.url),'utf8');
  for(const forbidden of ['./round.js','./combat.js','./perks.js','./stakes.js','./bit.js'])
    assert.ok(!src.includes(forbidden),`bit-expression.js must not import ${forbidden}`);
});
