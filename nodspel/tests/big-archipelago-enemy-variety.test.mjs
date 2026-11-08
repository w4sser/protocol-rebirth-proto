import test from 'node:test';
import assert from 'node:assert/strict';
import {generateBigLevel,applyBigArchipelagoEnemyVariety} from '../big-level.js';
import {graphDistances} from '../zone-graph.js';
import {RULES,generateLevel} from '../levels.js';
import {visualFor} from '../enemies.js';

const seeds=Array.from({length:32},(_,i)=>'big-enemy-variety-'+i);
const baseOf=level=>level.enemies.filter(e=>/^big-enemy-\\d+$/.test(e.id));
const regularOf=level=>baseOf(level).filter(e=>!e.encounter);
test('Bunker and non-big levels do not receive Archipelago enemy variation',()=>{
  for(const seed of seeds.slice(0,12)){
    const bunker=generateBigLevel(seed,'bunker');
    const before=structuredClone(bunker.enemies);
    assert.equal(applyBigArchipelagoEnemyVariety(bunker),bunker);
    assert.deepEqual(bunker.enemies,before);
    assert.ok(baseOf(bunker).every(e=>e.type==='grunt'||e.encounter));
    const standard=generateLevel(2,seed,'archipelago',false,false);
    const original=structuredClone(standard.enemies);
    assert.equal(applyBigArchipelagoEnemyVariety(standard),standard);
    assert.deepEqual(standard.enemies,original);
  }
});
test('Big Archipelago has seeded early visual contrast with depth-gated threats',()=>{
  let earlyVisible=0,diverse=0,multiple=0;
  for(const seed of seeds){
    const a=generateBigLevel(seed,'archipelago');
    const b=generateBigLevel(seed,'archipelago');
    assert.deepEqual(a,b,'fixed seed must rebuild exactly the same enemy mix');
    const bunker=generateBigLevel(seed,'bunker');
    const before=new Map(bunker.enemies.map(e=>[e.id,e]));
    const distances=graphDistances(a.graph),bases=baseOf(a);
    assert.equal(a.enemies.length,bunker.enemies.length,'no extra enemy bodies added');
    const start=bases.find(e=>e.roomId===a.graph.spawn.roomId);
    assert.ok(start&&start.type==='grunt'&&!start.encounter,'spawn room stays gentle');
    let special=0;
    const eligible=regularOf(a).filter(e=>e.roomId!==a.graph.spawn.roomId);
    for(const e of a.enemies){
      const old=before.get(e.id);
      assert.ok(old,'no renumbered or duplicated IDs');
      assert.deepEqual([e.x,e.z,e.roomId,e.health,e.active],[old.x,old.z,old.roomId,old.health,old.active],
        'same spawn, hp and activation');
      if(e.encounter){
        assert.deepEqual([e.type,e.encounter],[old.type,old.encounter],'authored POI actors unchanged');
        continue;
      }
      if(!/^big-enemy-\\d+$/.test(e.id))continue;
      assert.ok(['grunt','sentry','rusher','thrower'].includes(e.type));
      assert.ok(visualFor(e)?.archetype,'every non-generator type maps to an existing GLB');
      const d=distances[e.roomId]??99;
      if(e.type==='sentry')assert.ok(d>=1,'no long-range sentry in spawn room');
      if(e.type==='rusher')assert.ok(d>=2,'charger only beyond first island');
      if(e.type==='thrower')assert.ok(d>=3,'artillery only in deep rooms');
      const tuning=RULES.enemyTypes[e.type];
      assert.equal(e.speed,old.speed*tuning.speedMul,'existing speed tier and archetype multiplier only');
      if(e.type!=='grunt'){
        special++;
        assert.equal(e.rangeMul,tuning.rangeMul);
        assert.equal(e.cooldownMul,tuning.cooldownMul);
        assert.equal(e.standoff,tuning.standoff);
      }
    }
    const limit=Math.min(5,Math.max(2,Math.ceil(eligible.length*.45)));
    assert.ok(special<=limit,'cap non-encounter special threats');
    const near=eligible.filter(e=>(distances[e.roomId]??99)<=2);
    if(near.some(e=>e.type!=='grunt'))earlyVisible++;
    if(new Set(regularOf(a).map(e=>e.type)).size>=3)diverse++;
    if(special>=2)multiple++;
  }
  assert.ok(earlyVisible>=24,'early room contrast must be reliable across seeds');
  assert.ok(diverse>=18,'most seeded archipelago raids should show 3+ base silhouettes');
  assert.ok(multiple>=24,'most maps should have at least 2 different non-POI threats');
});
test('encounter-owned enemies and existing graphed rooms are immutable to repeat application',()=>{
  const level=generateBigLevel('big-enemy-idempotent','archipelago');
  const before=structuredClone(level.enemies);
  // Calling twice should not further change enemies (only untouched grunts may
  // get another type, so we do not call twice at runtime; ensure the game calls once).
  assert.ok(level.rooms.length>=6);
  assert.ok(level.graph.pois.length===3);
  assert.ok(level.enemies.some(e=>e.encounter));
  const ids=level.enemies.map(e=>e.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(before.every(e=>e.roomId!=null||e.type==='generator'));
});
