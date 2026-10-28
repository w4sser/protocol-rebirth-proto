import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,hitEnemy} from '../round.js';
import {generateLevel,RULES} from '../levels.js';
import * as weaponMod from '../weapon.js';
import {createDash,startDash} from '../dash.js';
const combat=await import('../combat.js').catch(()=>({}));
// Baseline combat rules, without the gentler level-one tuning.
const baseline=r=>Object.assign(r.level,{enemyDamage:undefined,enemyWindupMs:0,firstGraceMs:undefined,enemyCooldownMs:undefined});
test('an enemy fires after spawn grace and its projectile can damage the player',()=>{
  assert.equal(typeof combat.createCombat,'function');
  const r=createRound('fight',0);baseline(r);r.level.enemies=[{id:'foe',kind:'enemy',x:0,z:0,r:.48,health:2}];
  const c=combat.createCombat(r.level,0);
  combat.stepCombat(r,c,{x:0,z:4},2000,.04,[]);assert.equal(c.projectiles.length,0);
  combat.stepCombat(r,c,{x:0,z:4},3000,.04,[]);assert.equal(c.projectiles.length,1);
  combat.stepCombat(r,c,{x:0,z:4},3500,.5,[]);assert.equal(r.health,100-RULES.combat.damage);
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
  const r=createRound('lethal',0);baseline(r);r.level.enemies=[{id:'foe',kind:'enemy',x:0,z:0,r:.48,health:2}];
  const c=combat.createCombat(r.level,0);
  for(let i=0;i<5;i++)combat.stepCombat(r,c,{x:0,z:4},3000+i*2000,.5,[]);
  assert.equal(r.over,true);assert.equal(r.reason,'death');assert.equal(r.remainingMs,469000);
});
test('a dormant/idle enemy aggroes the instant it is hit, even far outside detection range, and then fights back',()=>{
  const r=createRound('idle-hit',0);baseline(r);
  r.level.enemies=[{id:'foe',kind:'enemy',x:0,z:0,r:.48,health:5,speed:1}];
  const c=combat.createCombat(r.level,0);
  const far={x:0,z:50}; // well outside detectRange(10) and weapon range(7): not seen, never fired on
  combat.stepCombat(r,c,far,5000,.5,[]);
  assert.equal(r.level.enemies[0].aggro,undefined,'not noticed: too far and never hit');
  hitEnemy(r,'foe',5100,1); // a shot connects despite the distance (isolating the aggro rule from firing range)
  assert.equal(r.level.enemies[0].health,4);
  combat.stepCombat(r,c,far,5200,.5,[]);
  assert.equal(r.level.enemies[0].aggro,true,'a hit aggroes it at once, regardless of range');
  // Bring the player into range: the now-aggro enemy fights back without needing a fresh detection window
  // (a small dt so the resulting shot is still in flight when we check, instead of resolving within the tick).
  combat.stepCombat(r,c,{x:0,z:4},5300,.016,[]);
  assert.equal(c.projectiles.length,1,'it fights back immediately once in range');
});
test('a turret hit before it notices the player aggroes at once, but still only starts its normal warning',()=>{
  const T=RULES.encounters.turret;
  const enemy={id:'t1',kind:'enemy',type:'sentry',x:0,z:0,r:.48,health:T.health,encounter:'turret',facing:0,speed:0,active:true,rangeMul:1,cooldownMul:1};
  const r=createRound('turret-hit',0);
  Object.assign(r.level,{enemies:[enemy],nodes:[],rooms:[{x:0,z:0,w:40,d:40}],floors:[{x:0,z:0,w:40,d:40}],walls:[],boxes:[],start:{x:0,z:0}});
  const c=combat.createCombat(r.level,0);c.graceUntil=0;c.moveAt=0;c.nextFire.set(enemy.id,0);
  const far={x:0,z:15}; // outside detectRange(10): not yet noticed
  combat.stepCombat(r,c,far,100,.016,[]);
  assert.equal(enemy.aggro,undefined);
  hitEnemy(r,enemy.id,150,1); // flanked and shot from outside detection range
  combat.stepCombat(r,c,far,200,.016,[]);
  assert.equal(enemy.aggro,true,'a hit aggroes the turret at once, regardless of detection range');
  assert.ok(!enemy.attackPhase,'still just aggro; too far to act on yet');
  const near={x:0,z:5};
  combat.stepCombat(r,c,near,300,.016,[]);
  assert.equal(enemy.attackPhase,'warning','once in range it starts its normal telegraph, not an instant shot');
  assert.equal(c.projectiles.length,0,'locked design: a hit never skips straight to damage');
  combat.stepCombat(r,c,near,300+T.warningMs,.016,[]);
  assert.equal(c.projectiles.length,T.burstShots,'after the warning elapses it fires normally');
});
test('a shot that misses nearby still gives away the shooter: a close near miss aggroes an idle enemy',()=>{
  const r=createRound('near-miss',0);baseline(r);
  const foe={id:'foe',kind:'enemy',x:3,z:.9,r:.48,health:5,speed:0}; // past the hit margin (~.86), inside the near-miss radius (1.2)
  r.level.enemies=[foe];r.level.nodes=[];
  const w=weaponMod.createWeapon(Infinity,{...RULES.weapon,homingDegreesPerSecond:0}); // no homing: a clean straight miss
  const c=combat.createCombat(r.level,0);
  const far={x:0,z:-50}; // keep the player far outside detection range throughout
  combat.stepCombat(r,c,far,5000,.5,[]);
  assert.equal(foe.aggro,undefined,'not yet noticed');
  weaponMod.fireWeapon(w,{x:0,z:0},{x:1,z:0},5050);
  weaponMod.stepWeapon(w,r,5100,.3,[]);
  assert.equal(foe.health,5,'a clean miss: no damage');
  combat.stepCombat(r,c,far,5200,.5,[]);
  assert.equal(foe.aggro,true,'the near miss aggroes it even though it was never hit');
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

test('dash i-frames give 0 damage from a projectile impact, blast and hazard tick',()=>{
  const r=createRound('iframes',0);baseline(r);r.level.enemies=[{id:'foe',kind:'enemy',x:0,z:0,r:.48,health:2}];
  const c=combat.createCombat(r.level,0);
  combat.stepCombat(r,c,{x:0,z:4},2000,.04,[]);
  combat.stepCombat(r,c,{x:0,z:4},3000,.04,[]);assert.equal(c.projectiles.length,1);
  const dash=createDash();startDash(dash,{x:1,z:0},3400); // i-frames cover [3400, 3550)
  combat.stepCombat(r,c,{x:0,z:4},3500,.5,[],dash);
  assert.equal(r.health,100,'projectile impact inside the i-frame window deals 0 damage');
  combat.stepCombat(r,c,{x:0,z:4},3600,.04,[]); // re-arm a shot now that i-frames have ended
  combat.stepCombat(r,c,{x:0,z:4},4600,.04,[]);
  combat.stepCombat(r,c,{x:0,z:4},4700,.5,[],dash);
  assert.equal(r.health,100-RULES.combat.damage,'the same dash state no longer blocks damage once i-frames expire');
});
test('dash i-frames also absorb a hazard tick, but not once the dash has ended',()=>{
  const hr=createRound('iframes-hazard',0);
  hr.level.hazards=[{id:'pad',x:0,z:0,w:2,d:2,phaseMs:2500,dps:60}]; // 'on' from t=0, dps 60 -> >=1 damage per tick
  const hazardDash=createDash();startDash(hazardDash,{x:1,z:0},0);
  combat.stepHazards(hr,{x:0,z:0},0,1,hazardDash);
  assert.equal(hr.health,100,'hazard tick inside the i-frame window deals 0 damage');
  combat.stepHazards(hr,{x:0,z:0},300,1); // well past the 220 ms dash, no dash state passed
  assert.ok(hr.health<100,'the same hazard damages normally once i-frames are over');
});
test('an attack cancels arrival grace for its defender without waking unrelated enemies',()=>{
  const r=createRound('hit-during-grace',0);baseline(r);
  const attacked={id:'hit',kind:'enemy',x:0,z:0,r:.48,health:5},quiet={id:'quiet',kind:'enemy',x:20,z:0,r:.48,health:5};
  r.level.enemies=[attacked,quiet];const c=combat.createCombat(r.level,0);
  hitEnemy(r,'hit',100);combat.stepCombat(r,c,{x:0,z:4},200,.016,[]);
  assert.equal(attacked.aggro,true);assert.equal(c.projectiles.length,1,'attacked enemy fights during grace');
  assert.equal(quiet.aggro,undefined,'other enemies retain arrival grace');
});
