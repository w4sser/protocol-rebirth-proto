import test from 'node:test';import assert from 'node:assert/strict';
import {createRound} from '../round.js?v=1.74.0';
import {RULES,totalNodes} from '../levels.js?v=1.74.0';
import * as combat from '../combat.js?v=1.74.0';
const setup=()=>{const r=createRound('tuning',0);r.level.enemies=[{id:'foe',kind:'enemy',x:0,z:0,r:.48,health:2}];return r;};
test('level one uses gentler enemy tuning',()=>{
  const l=createRound('tuning',0).level;
  assert.equal(l.enemyDamage,10);assert.equal(l.enemyWindupMs,500);assert.equal(l.firstGraceMs,5000);assert.equal(l.enemyCooldownMs,2400);
  assert.equal(RULES.combat.standoff,3.5);
});
test('level one grants five seconds of grace, then winds up 500 ms before firing for 10 damage',()=>{
  const r=setup(),c=combat.createCombat(r.level,0),p={x:0,z:5};
  combat.stepCombat(r,c,{...p},4900,.016,[]);assert.equal(c.projectiles.length,0);assert.equal(r.level.enemies[0].windupAt??null,null);
  combat.stepCombat(r,c,{...p},5000,.016,[]);assert.equal(r.level.enemies[0].windupAt,5500);assert.equal(c.projectiles.length,0);
  combat.stepCombat(r,c,{...p},5400,.016,[]);assert.equal(c.projectiles.length,0);
  combat.stepCombat(r,c,{...p},5500,.016,[]);assert.equal(c.projectiles.length,1);assert.equal(r.level.enemies[0].windupAt,null);
  combat.stepCombat(r,c,{...p},6200,1,[]);assert.equal(r.health,90);
});
test('losing sight cancels the wind-up',()=>{
  const r=setup(),c=combat.createCombat(r.level,0),p={x:0,z:5};
  combat.stepCombat(r,c,{...p},5000,.016,[]);assert.equal(r.level.enemies[0].windupAt,5500);
  combat.stepCombat(r,c,{...p},5200,.016,[{x:0,z:2.5,w:3,d:.5}]);assert.equal(r.level.enemies[0].windupAt,null);
});
test('enemies stop approaching at the stand-off distance',()=>{
  const r=createRound('standoff',0);r.level.enemies=[{id:'foe',kind:'enemy',x:0,z:0,r:.48,health:2,speed:2}];
  const c=combat.createCombat(r.level,0);
  for(let t=5000;t<15000;t+=40)combat.stepCombat(r,c,{x:0,z:8},t,.04,[]);
  const d=8-r.level.enemies[0].z;assert.ok(d>=3.4&&d<=3.6,`distance ${d}`);
});
test('total node count is computed from level rules',()=>{assert.equal(totalNodes(),6);});
