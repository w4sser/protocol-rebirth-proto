import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,useHealthKit,hitEnemy,tickRound} from '../round.js';
import {generateLevel} from '../levels.js';
import {STAKES,healBudget,healRemaining,heal,carriedWeight,speedMultiplier,detectionMultiplier,carryValuePulsed,carriedValue,stepStakes,waveCountdownMs,hunterArrowScreenPoint} from '../stakes.js';
import {bagValue} from '../raid.js';
import {traceTargets} from '../physics.mjs';

test('alarm: unlocked L1 closet never spawns beside the player at (8, 0)',()=>{
  const r=createRound('alarm',0);
  r.level.doors.forEach(d=>d.locked=false);
  const res=firstWave(r,{x:8,z:0},-1);
  assert.equal(res.spawned.length,0);
  assert.equal(r.stakes.waveNumber,0);
});
test('alarm: locked L1 closet defers the wave instead of trapping a hunter',()=>{
  const r=createRound('alarm',0);
  assert.ok(r.level.doors.some(d=>d.locked));
  const res=firstWave(r,r.level.start,0);
  assert.equal(res.spawned.length,0);
  assert.equal(r.stakes.waveNumber,0);
  assert.equal(r.stakes.pendingSpawn,null);
  assert.equal(r.stakes.hunterDirection,null);
  const due=STAKES.alarmDelayMs+STAKES.waveIntervalMs;
  assert.equal(r.stakes.nextWaveAt,due+STAKES.waveRetryMs);
  // Make safe space available; a failed wave must wait for its configured retry.
  r.level=generateLevel(3,r.seed);
  const player={x:r.level.rooms[0].x,z:r.level.rooms[0].z+3};
  tickRound(r,due+STAKES.waveRetryMs-1);
  assert.equal(stepStakes(r,due+STAKES.waveRetryMs-1,player,0).spawned.length,0);
  tickRound(r,due+STAKES.waveRetryMs);
  const retried=stepStakes(r,due+STAKES.waveRetryMs,player,0);
  assert.ok(retried.spawned.length>0);
  assert.equal(r.stakes.waveNumber,1);
  for(const e of retried.spawned){
    assert.ok(Math.hypot(e.x-player.x,e.z-player.z)>=STAKES.hunterMinSpawnDistanceM);
    assert.ok(traceTargets(player,e,[...r.level.walls,...r.level.boxes],[]),'spawn must be hidden');
  }
});
test('hunters defer even distant candidates when every candidate is in view',()=>{
  const r=createRound('alarm',0);
  r.level={...r.level,rooms:[{x:0,z:0,w:10,d:10},{x:30,z:0,w:10,d:10}],
    corridors:[{x:15,z:0,w:20,d:4}],walls:[],boxes:[],doors:[],deadEnds:[],closet:null};
  assert.equal(firstWave(r,{x:0,z:0},0).spawned.length,0);
  assert.equal(r.stakes.waveNumber,0);
});
test('alarm: an otherwise safe route becomes ineligible when its door locks during warning',()=>{
  const r=createRound('alarm',0);
  r.level=generateLevel(3,r.seed);
  const corridor=r.level.corridors[0];
  const door={x:corridor.x,z:corridor.z,w:corridor.dir.x ? .3 : corridor.w,
    d:corridor.dir.z ? .3 : corridor.d,locked:false};
  r.level.doors=[door];
  const player={x:r.level.rooms[0].x,z:r.level.rooms[0].z+3};
  tickRound(r,STAKES.alarmDelayMs);stepStakes(r,STAKES.alarmDelayMs,player,0);
  const due=STAKES.alarmDelayMs+STAKES.waveIntervalMs;
  tickRound(r,due-STAKES.waveWarnMs);stepStakes(r,due-STAKES.waveWarnMs,player,0);
  assert.ok(r.stakes.pendingSpawn,'unlocked route supplies a hidden, distant candidate');
  door.locked=true;
  tickRound(r,due);
  assert.equal(stepStakes(r,due,player,0).spawned.length,0);
  assert.equal(r.stakes.waveNumber,0);
  door.locked=false;
  tickRound(r,due+STAKES.waveRetryMs);
  assert.ok(stepStakes(r,due+STAKES.waveRetryMs,player,0).spawned.length>0,
    'unlocking the same route allows the deferred wave');
});

// ---- heal budget clamp ----
test('heal budget is a fixed 60 HP, independent of starting or later max HP',()=>{
  const r=createRound('heal-budget',0);
  assert.equal(STAKES.healBudgetHP,60);
  assert.equal(healBudget(r),60);
  r.maxHealth=140; // armor swap or similar should not retroactively change the raid-long budget
  assert.equal(healBudget(r),60);
});
test('a higher starting max HP (e.g. Vitality progression) does not raise the heal budget',()=>{
  const high=createRound('heal-budget-vitality',0,{maxHealth:130});
  assert.equal(healBudget(high),60);
});
test('heal() never exceeds the remaining budget or the headroom to max HP',()=>{
  const r=createRound('heal-clamp',0);r.health=0;
  const applied=heal(r,0,1000);
  assert.equal(applied,healBudget(r));
  assert.equal(r.health,healBudget(r));
  assert.equal(healRemaining(r),0);
  assert.equal(heal(r,1,10),0,'budget spent: no further healing this raid');
});
test('heal() is capped by headroom to max HP even with budget left',()=>{
  const r=createRound('heal-headroom',0);r.health=98;
  assert.equal(heal(r,0,20),2);
  assert.equal(r.health,100);
  assert.ok(healRemaining(r)>0,'budget still has room; only health was the limit');
});
test('BIT warns once when the budget runs low, and once more when it is spent',()=>{
  const r=createRound('heal-warn',0);r.health=0;
  heal(r,0,healBudget(r)-STAKES.healLowThreshold);
  assert.ok(r.healBudgetLow);assert.ok(!r.healBudgetEmpty);
  r.healBudgetLow=null; // simulate the HUD having shown + cleared the one-shot toast
  heal(r,1,1);
  assert.equal(r.healBudgetLow,null,'the low notice is one-shot, it does not re-fire');
  heal(r,2,healBudget(r));
  assert.ok(r.healBudgetEmpty);
});
test('medkits, kill rewards and BIT regen all draw from the same shared budget',()=>{
  const r=createRound('heal-shared',0);r.health=0;r.kit={medkit:5};
  r.stakes.healed=healBudget(r)-5; // 5 HP of budget left, from some other heal source
  assert.equal(useHealthKit(r,0),true);
  assert.ok(r.health<=5,'the medkit was clamped by the shared budget, not its full 30 HP');
  assert.equal(healRemaining(r),0);
  assert.equal(useHealthKit(r,1),false,'budget empty: the kit is refused rather than wasted');
  assert.equal(r.kit.medkit,4,'only the first, successful use consumed a kit');
});
test('a kill reward heal is clamped by the budget too',()=>{
  const r=createRound('heal-kill',0);r.level.nodes=[];r.health=0;r.stakes.healed=healBudget(r);
  const foe=r.level.enemies[0];foe.health=1;
  hitEnemy(r,foe.id,0,1);
  assert.equal(r.health,0,'budget already spent: the kill heal applies 0');
});

// ---- bag weight: speed and detection scaling ----
test('bag weight scales player speed down and enemy detection range up, linearly up to the data caps',()=>{
  const r=createRound('weight',0);r.bagCapacity=4;r.bag.cable=0;r.backpack=[];
  assert.equal(carriedWeight(r),0);
  assert.equal(speedMultiplier(r),1);
  assert.equal(detectionMultiplier(r),1);
  r.bag.cable=2;
  assert.equal(carriedWeight(r),.5);
  assert.equal(speedMultiplier(r),1-.5*STAKES.bagWeight.maxSpeedPenalty);
  assert.equal(detectionMultiplier(r),1+.5*STAKES.bagWeight.maxDetectionBonus);
  r.bag.cable=4; // full bag: caps hit exactly
  assert.equal(carriedWeight(r),1);
  assert.equal(speedMultiplier(r),1-STAKES.bagWeight.maxSpeedPenalty);
  assert.equal(detectionMultiplier(r),1+STAKES.bagWeight.maxDetectionBonus);
});
test('carried weight counts the backpack and never exceeds 1 even when overfull',()=>{
  const r=createRound('weight-backpack',0);r.bagCapacity=4;r.bag.cable=3;r.backpack=['smg_vector','shotgun_breach'];
  assert.equal(carriedWeight(r),1);
});

// ---- carried-value HUD line + pulse ----
test('bagValue sums sellValue across the bag and ignores unknown/zero entries',()=>{
  assert.equal(bagValue({}),0);
  assert.equal(bagValue({cable:2,scrap_alloy:1,not_a_real_item:5}),2*25+1*15);
});
test('the carried-value line pulses only when the value increases',()=>{
  assert.equal(carryValuePulsed(0,25),true);
  assert.equal(carryValuePulsed(25,25),false);
  assert.equal(carryValuePulsed(25,10),false,'dropping/losing loot never pulses');
});
test('carried value includes backpack gear/weapons, not just the material bag',()=>{
  const r=createRound('carried-value',0);
  assert.equal(carriedValue(r),0);
  r.bag.cable=2; // 2*25
  assert.equal(carriedValue(r),50);
  r.backpack=['smg_vector','shotgun_breach']; // 110 + 130
  assert.equal(carriedValue(r),50+240,'backpack loot (Vector SMG + Breach Shotgun) adds 240 Scrap');
});

// ---- hunter arrow: screen-edge placement ----
test('the arrow sits on the viewport edge (minus margin) in every direction, not a small fixed-radius circle',()=>{
  const margin=20,w=844,h=390;
  const east=hunterArrowScreenPoint({x:1,z:-1},w,h,margin); // screen-space +x after the isometric rotation
  assert.ok(Math.abs(east.x-(w-margin))<1e-6,`expected the arrow at the right edge, got x=${east.x}`);
  const north=hunterArrowScreenPoint({x:-1,z:-1},w,h,margin); // screen-space -y (up)
  assert.ok(Math.abs(north.y-margin)<1e-6,`expected the arrow at the top edge, got y=${north.y}`);
});
test('the arrow rotation points along the given world direction',()=>{
  const {angleDeg}=hunterArrowScreenPoint({x:1,z:-1},800,600);
  assert.ok(Math.abs(angleDeg)<1e-6,'screen-space +x direction points at 0 degrees');
});

// ---- alarm + hunter waves, including pause ----
test('the alarm trips at alarmDelayMs of raid time and the first wave follows waveIntervalMs later',()=>{
  const r=createRound('alarm',0);
  r.level=generateLevel(3,r.seed);
  tickRound(r,STAKES.alarmDelayMs-1000);
  let res=stepStakes(r,STAKES.alarmDelayMs-1000,r.level.start,0);
  assert.equal(r.stakes.alarmTriggered,false);assert.equal(res.spawned.length,0);
  tickRound(r,STAKES.alarmDelayMs);
  res=stepStakes(r,STAKES.alarmDelayMs,r.level.start,0);
  assert.equal(r.stakes.alarmTriggered,true);assert.equal(res.spawned.length,0,'the alarm itself does not spawn a wave');
  const atWave=STAKES.alarmDelayMs+STAKES.waveIntervalMs;
  tickRound(r,atWave);
  res=stepStakes(r,atWave,r.level.start,0);
  assert.equal(r.stakes.waveNumber,1);
  assert.ok(res.spawned.length>=1);
  assert.ok(res.spawned.every(e=>e.health===STAKES.waveRusherHealth&&e.aggro===true));
  assert.ok(r.level.enemies.includes(res.spawned[0]),'hunters are pushed into the live level roster');
});
test('wave size scales modestly by level and is capped',()=>{
  const low=createRound('wave-size-1',0);low.level=generateLevel(3,low.seed);low.level.number=1;
  tickRound(low,STAKES.alarmDelayMs);stepStakes(low,STAKES.alarmDelayMs,low.level.start,0);
  const atWave=STAKES.alarmDelayMs+STAKES.waveIntervalMs;
  tickRound(low,atWave);const resLow=stepStakes(low,atWave,low.level.start,0);
  const high=createRound('wave-size-3',0);high.level=generateLevel(3,high.seed);
  tickRound(high,STAKES.alarmDelayMs);stepStakes(high,STAKES.alarmDelayMs,high.level.start,0);
  tickRound(high,atWave);const resHigh=stepStakes(high,atWave,high.level.start,0);
  assert.equal(resLow.spawned.length,1);
  assert.equal(resHigh.spawned.length,1+STAKES.waveLevelBonus[2],'deeper level adds its configured bonus');
});
test('a countdown is only exposed inside the warning window before the next wave',()=>{
  const r=createRound('countdown',0);
  tickRound(r,STAKES.alarmDelayMs);stepStakes(r,STAKES.alarmDelayMs,r.level.start,0);
  tickRound(r,STAKES.alarmDelayMs+1000);
  assert.equal(waveCountdownMs(r),null,'well before the warning window');
  const nearWave=STAKES.alarmDelayMs+STAKES.waveIntervalMs-STAKES.waveWarnMs/2;
  tickRound(r,nearWave);stepStakes(r,nearWave,r.level.start,0);
  assert.ok(waveCountdownMs(r)>0&&waveCountdownMs(r)<=STAKES.waveWarnMs);
});
test('pausing the raid (a perk pick) freezes the alarm/wave clock exactly like it freezes the round timer',()=>{
  const r=createRound('alarm-pause',0);
  r.level=generateLevel(3,r.seed);
  tickRound(r,STAKES.alarmDelayMs);stepStakes(r,STAKES.alarmDelayMs,r.level.start,0);
  assert.equal(r.stakes.alarmTriggered,true);
  const remainingBeforePause=r.remainingMs;
  r.pauseAt=STAKES.alarmDelayMs; // the perk modal pauses the raid
  tickRound(r,STAKES.alarmDelayMs+9_000_000); // lots of real time passes while paused
  assert.equal(r.remainingMs,remainingBeforePause,'tickRound is a no-op while paused');
  const res=stepStakes(r,STAKES.alarmDelayMs,r.level.start,0);
  assert.equal(res.spawned.length,0,'no wave can spawn: elapsed raid time did not move');
  r.pauseAt=null;
  const atWave=STAKES.alarmDelayMs+STAKES.waveIntervalMs;
  tickRound(r,atWave);
  const resumed=stepStakes(r,atWave,r.level.start,0);
  assert.ok(resumed.spawned.length>=1,'resuming lets the clock (and the wave) continue normally');
});

// ---- hunter waves spawn out of the player's view, never beside them ----
const inRoom=(p,room)=>Math.abs(p.x-room.x)<=room.w/2&&Math.abs(p.z-room.z)<=room.d/2;
function firstWave(r,player,room){
  tickRound(r,STAKES.alarmDelayMs);stepStakes(r,STAKES.alarmDelayMs,player,room);
  const atWave=STAKES.alarmDelayMs+STAKES.waveIntervalMs;
  tickRound(r,atWave);
  return stepStakes(r,atWave,player,room);
}
test('a single-room level (Bunker L1, the reported repro) never spawns a hunter beside the player',()=>{
  // L1 has no distant reachable zone at the start; it must wait for safe space.
  const r=createRound('alarm',0);
  const res=firstWave(r,r.level.start,0);
  assert.equal(res.spawned.length,0,'no safe location: defer rather than accept a fallback');
  assert.equal(r.stakes.waveNumber,0);
});
test('on a roomy multi-room level, hunters clear the configured minimum spawn distance',()=>{
  const r=createRound('hunter-distance',0);
  r.level=generateLevel(2,r.seed); // two rooms + a corridor, spaced >= 15 m apart
  const player=r.level.start;
  const res=firstWave(r,player,0);
  assert.ok(res.spawned.length>=1);
  for(const e of res.spawned)assert.ok(Math.hypot(e.x-player.x,e.z-player.z)>=STAKES.hunterMinSpawnDistanceM);
});
test('hunters never spawn in the room the player currently occupies',()=>{
  const r=createRound('hunter-room',0);
  r.level=generateLevel(3,r.seed); // three rooms, so there is always somewhere else to go
  const currentRoomIndex=1,player={x:r.level.rooms[1].x,z:r.level.rooms[1].z};
  const res=firstWave(r,player,currentRoomIndex);
  assert.ok(res.spawned.length>=1);
  for(const e of res.spawned)assert.ok(!inRoom({x:e.x,z:e.z},r.level.rooms[currentRoomIndex]));
});
test('the countdown target is re-validated at the moment the wave actually spawns, not reused stale',()=>{
  const r=createRound('hunter-revalidate',0);
  r.level=generateLevel(2,r.seed);
  const start=r.level.start;
  tickRound(r,STAKES.alarmDelayMs);stepStakes(r,STAKES.alarmDelayMs,start,0);
  const nearWave=STAKES.alarmDelayMs+STAKES.waveIntervalMs-STAKES.waveWarnMs/2;
  tickRound(r,nearWave);stepStakes(r,nearWave,start,0);
  const pending=r.stakes.pendingSpawn;
  assert.ok(pending,'the countdown picked a target to aim the arrow at');
  // The player walks right up to the previously-chosen point before the wave actually fires.
  const walkedUp={x:pending.point.x,z:pending.point.z};
  const atWave=STAKES.alarmDelayMs+STAKES.waveIntervalMs;
  tickRound(r,atWave);
  const res=stepStakes(r,atWave,walkedUp,0);
  assert.ok(res.spawned.length>0 || r.stakes.waveNumber===0,'spawn safely or defer');
  for(const e of res.spawned)assert.ok(Math.hypot(e.x-walkedUp.x,e.z-walkedUp.z)>=STAKES.hunterMinSpawnDistanceM,
    'a hunter landed near the stale countdown target instead of being re-picked from the player\'s current spot');
});
test('the hunter direction is recomputed every frame, not frozen at the moment the countdown opened',()=>{
  const r=createRound('hunter-direction',0);
  r.level=generateLevel(2,r.seed);
  tickRound(r,STAKES.alarmDelayMs);stepStakes(r,STAKES.alarmDelayMs,r.level.start,0);
  const nearWave=STAKES.alarmDelayMs+STAKES.waveIntervalMs-STAKES.waveWarnMs/2;
  tickRound(r,nearWave);stepStakes(r,nearWave,r.level.start,0);
  const firstDir={...r.stakes.hunterDirection};
  // Same instant in the clock, but the player has since walked to the far side of the target - the
  // direction must follow, even though the destination itself is unchanged.
  const target=r.stakes.pendingSpawn.point;
  const farSide={x:target.x*2-r.level.start.x,z:target.z*2-r.level.start.z};
  stepStakes(r,nearWave,farSide,0);
  const secondDir=r.stakes.hunterDirection;
  assert.ok(Math.abs(firstDir.x-secondDir.x)>.01||Math.abs(firstDir.z-secondDir.z)>.01,'direction did not update with the player\'s position');
});
