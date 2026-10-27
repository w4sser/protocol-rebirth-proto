import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,useHealthKit,hitEnemy,tickRound} from '../round.js';
import {STAKES,healBudget,healRemaining,heal,carriedWeight,speedMultiplier,detectionMultiplier,carryValuePulsed,stepStakes,waveCountdownMs} from '../stakes.js';
import {bagValue} from '../raid.js';

// ---- heal budget clamp ----
test('heal budget is a fixed fraction of max HP, independent of later maxHealth drift',()=>{
  const r=createRound('heal-budget',0);
  assert.equal(healBudget(r),Math.round(100*STAKES.healBudgetFraction));
  r.maxHealth=140; // armor swap or similar should not retroactively change the raid-long budget
  assert.equal(healBudget(r),Math.round(100*STAKES.healBudgetFraction));
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

// ---- alarm + hunter waves, including pause ----
test('the alarm trips at alarmDelayMs of raid time and the first wave follows waveIntervalMs later',()=>{
  const r=createRound('alarm',0);
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
  const low=createRound('wave-size-1',0);low.level.number=1;
  tickRound(low,STAKES.alarmDelayMs);stepStakes(low,STAKES.alarmDelayMs,low.level.start,0);
  const atWave=STAKES.alarmDelayMs+STAKES.waveIntervalMs;
  tickRound(low,atWave);const resLow=stepStakes(low,atWave,low.level.start,0);
  const high=createRound('wave-size-3',0);high.level.number=3;
  tickRound(high,STAKES.alarmDelayMs);stepStakes(high,STAKES.alarmDelayMs,high.level.start,0);
  tickRound(high,atWave);const resHigh=stepStakes(high,atWave,high.level.start,0);
  assert.ok(resHigh.spawned.length>=resLow.spawned.length,'a deeper level sends at least as many hunters');
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
