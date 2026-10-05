import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,hitEnemy} from '../round.js';
import {generateLevel} from '../levels.js';
const combat=await import('../combat.js').catch(()=>({}));
test('an enemy fires after spawn grace and its projectile can damage the player',()=>{
  assert.equal(typeof combat.createCombat,'function');
  const r=createRound('fight',0);r.level.enemies=[{id:'foe',kind:'enemy',x:0,z:0,r:.48,health:2}];
  const c=combat.createCombat(r.level,0);
  combat.stepCombat(r,c,{x:0,z:4},2000,.04,[]);assert.equal(c.projectiles.length,0);
  combat.stepCombat(r,c,{x:0,z:4},3000,.04,[]);assert.equal(c.projectiles.length,1);
  combat.stepCombat(r,c,{x:0,z:4},3500,.5,[]);assert.equal(r.health,80);
});
test('walls block enemy sight and a defeated enemy stops firing',()=>{
  assert.equal(typeof combat.createCombat,'function');
  const r=createRound('cover',0);r.level.enemies=[{id:'foe',kind:'enemy',x:0,z:0,r:.48,health:2}];
  const c=combat.createCombat(r.level,0);
  combat.stepCombat(r,c,{x:0,z:4},4000,.04,[{x:0,z:2,w:2,d:1}]);assert.equal(c.projectiles.length,0);
  assert.equal(hitEnemy(r,'foe',4000),true);assert.equal(hitEnemy(r,'foe',4001),true);
  assert.equal(r.level.enemies[0].health,0);
  combat.stepCombat(r,c,{x:0,z:4},5000,.5,[]);assert.equal(c.projectiles.length,0);assert.equal(r.health,100);
});
test('five enemy hits cause death and record time remaining',()=>{
  assert.equal(typeof combat.createCombat,'function');
  const r=createRound('lethal',0);r.level.enemies=[{id:'foe',kind:'enemy',x:0,z:0,r:.48,health:2}];
  const c=combat.createCombat(r.level,0);
  for(let i=0;i<5;i++)combat.stepCombat(r,c,{x:0,z:4},3000+i*2000,.5,[]);
  assert.equal(r.over,true);assert.equal(r.reason,'death');assert.equal(r.remainingMs,469000);
});
test('moving enemies respect cover and level three covers more distance per second',()=>{
  const travelled=[];
  for(const number of [2,3]){
    const r=createRound('movement',0);r.level=generateLevel(number,'movement');
    r.level.enemies=[{id:'runner',kind:'enemy',x:0,z:0,r:.48,health:2,speed:r.level.enemies[0].speed}];
    const c=combat.createCombat(r.level,0);
    combat.stepCombat(r,c,{x:0,z:5},3000,.5,[]);travelled.push(r.level.enemies[0].z);
    combat.stepCombat(r,c,{x:0,z:5},3500,2,[{x:0,z:2.2,w:5,d:.5}]);
    assert.ok(r.level.enemies[0].z<=1.48,'enemy cannot pass through cover');
  }
  assert.ok(travelled[1]>travelled[0]);
});
