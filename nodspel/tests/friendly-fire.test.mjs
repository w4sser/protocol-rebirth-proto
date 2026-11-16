import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,hitEnemy} from '../round.js';
import {createCombat,stepCombat} from '../combat.js';
import {RULES} from '../levels.js';
import {createDash,startDash} from '../dash.js';

const enemy=(id,x,z,extra={})=>({id,kind:'enemy',type:'grunt',x,z,r:.48,health:2,active:true,speed:0,...extra});
function arena(enemies=[],player={x:6,z:6},solids=[],floors=[{x:0,z:0,w:30,d:30}]){
  const round=createRound('enemy-friendly-fire',0);
  Object.assign(round.level,{
    enemies,spawners:[],rooms:[{x:0,z:0,w:30,d:30,doors:[]}],floors,
    start:{x:0,z:6},nodes:[],walls:solids,boxes:[],hazards:[],firstGraceMs:0,
  });
  const combat=createCombat(round.level,0);
  // Silence enemy AI to isolate genuine detonation, as with an artillery shell in flight.
  combat.graceUntil=50000;
  return {round,combat,player:{...player},solids};
}
function lob(combat,props={}){
  combat.blasts.push({
    id:++combat.nextId,x:0,z:0,fromX:-3,fromZ:0,
    radius:RULES.encounters.grenadier.radius,at:1000,detonateAt:1200,
    source:'grenadier',enemyId:'thrower',...props,
  });
}
function tick(a,now=1200,dash=null){
  stepCombat(a.round,a.combat,a.player,now,0,a.solids,dash);
}

test('artillery damages all living enemy troops in the ring, including its own launcher, only once',()=>{
  const thrower=enemy('thrower',-1.6,0,{type:'thrower',health:3});
  const first=enemy('first',.3,1.1),second=enemy('second',1.1,.3);
  const outside=enemy('outside',4.5,0);
  const a=arena([thrower,first,second,outside]);
  a.round.health=65;lob(a.combat);
  tick(a,1100);
  assert.equal(first.health,2,'telegraph/fuse is real: no early damage');
  tick(a,1200);
  assert.equal(first.health,0);
  assert.equal(second.health,0);
  assert.equal(thrower.health,1,'a thrower is not immune to its own explosion');
  assert.equal(outside.health,2);
  assert.equal(a.round.enemiesDefeated,2);
  assert.equal(a.round.health,65,'collateral kills do not grant the Operator heal');
  assert.equal(a.round.stakes.healed,0);
  assert.equal(a.round.hitFeels.length,3,'existing impact and death cues receive real hits');
  assert.equal(a.combat.blasts.length,0);
  const damagedAt=thrower.lastHitAt;
  tick(a,1300);
  assert.equal(thrower.lastHitAt,damagedAt);
  assert.equal(a.round.enemiesDefeated,2,'a shell cannot double-kill or double-credit');
  assert.equal(a.round.health,65);
  // Ordinary player-caused kills still keep their original heal reward.
  hitEnemy(a.round,'outside',1400,2);
  assert.equal(a.round.health,65+RULES.killReward.health);
});

test('dead, dormant, inactive and objective entities are not friendly-fire targets',()=>{
  const live=enemy('live',.4,0);
  const dead=enemy('dead',-.4,0,{health:0});
  const sleeping=enemy('sleeping',0,1,{sleeping:true});
  const inactive=enemy('inactive',0,-1,{active:false});
  const generator=enemy('generator',1,1,{type:'generator',node:'node-1'});
  const a=arena([live,dead,sleeping,inactive,generator]);
  const snapshot=[dead,sleeping,inactive,generator].map(e=>({x:e.x,z:e.z,health:e.health}));
  lob(a.combat);
  tick(a);
  assert.equal(live.health,0);
  assert.deepEqual([dead,sleeping,inactive,generator].map(e=>({x:e.x,z:e.z,health:e.health})),snapshot);
  assert.equal(a.round.enemiesDefeated,1);
  assert.equal(a.round.generatorsDown??0,0);
});

test('actual artillery hit knocks the Operator away, while keeping original damage and last-hit source',()=>{
  const a=arena([],{x:1,z:0});lob(a.combat);
  tick(a);
  assert.ok(a.player.x>1,'blast moves Operator away from centre');
  assert.equal(a.player.z,0);
  assert.equal(a.round.health,100-22,'grenadier keeps its existing player-damage tuning');
  assert.equal(a.round.lastHit.source,'grenadier');
  assert.equal(a.round.lastHit.enemyId,'thrower');
  const x=a.player.x;tick(a,1300);
  assert.equal(a.player.x,x,'no repeat impulse');
  assert.equal(a.round.health,78);
});

test('dash invulnerability prevents artillery damage and forced displacement',()=>{
  const a=arena([],{x:1,z:0}),dash=createDash();
  startDash(dash,{x:1,z:0},3400);
  lob(a.combat,{at:3300,detonateAt:3500});
  tick(a,3500,dash);
  assert.equal(a.player.x,1);
  assert.equal(a.round.health,100);
  assert.equal(a.combat.blasts.length,0);
});

test('radial knockback respects walls and other occupied enemy space',()=>{
  const wall={x:2,z:0,w:1,d:3},victim=enemy('victim',1,0);
  const blocker=enemy('blocker',2.9,0);
  const a=arena([victim,blocker],{x:6,z:6},[wall]);
  lob(a.combat);tick(a);
  assert.equal(victim.health,0);
  assert.ok(victim.x<=1.02+1e-6,'wall prevents the pushed enemy passing through collision');
  assert.equal(blocker.health,2);
  assert.ok(victim.x<blocker.x-victim.r-blocker.r,'actors never overlap during push');
});

test('radial knockback cannot throw the player off an island floor',()=>{
  const a=arena([],{x:2.3,z:0},[],[{x:0,z:0,w:6,d:6}]);
  lob(a.combat,{x:1.5,fromX:-1});
  tick(a);
  assert.ok(a.player.x>=2.3,'push is outward');
  assert.ok(a.player.x<=3-RULES.playerRadius+1e-6,'floor edge stops the impulse');
  assert.equal(a.round.health,100-22);
});

test('a target exactly at the centre gets a deterministic radial impulse',()=>{
  const target=enemy('target',0,0,{health:3});
  const a=arena([target]);lob(a.combat);
  tick(a);
  assert.equal(target.health,1);
  assert.ok(target.x>0,'fallback follows the arriving shell direction');
  assert.equal(target.z,0);
});
