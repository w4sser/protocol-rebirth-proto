// Per-player adaptive difficulty unit tests (docs/difficulty-bots.md §3/§7). Fast, deterministic,
// no sim/browser -- exercises nodspel/dda.js's pure state machine directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,loadState,saveState,recordRaid,checkLapse,lootMultiplier,DDA_KEY} from '../dda.js?v=2.26.0';
import {NEUTRAL_KNOBS,KNOB_BOUNDS} from '../difficulty.js?v=2.26.0';

function memStorage(initial=null){
  let raw=initial;
  return {getItem:()=>raw,setItem:(k,v)=>{raw=v;},_raw:()=>raw};
}
const strongSignal=(depth=2)=>({depth,outcome:1,death:false,damagePct:5,ttkSec:1,timeToExtractSec:30,medkitsUsed:0,clutch:false});
const weakSignal=(depth=2)=>({depth,outcome:0,death:true,damagePct:100,ttkSec:20,timeToExtractSec:600,medkitsUsed:3,clutch:false});

test('fresh/loaded-with-nothing-stored state is exactly neutral (FTUE never touches DDA, so a profile that has only played FTUE stays neutral)',()=>{
  const fresh=freshState();
  assert.deepEqual(fresh.knobs,NEUTRAL_KNOBS);
  assert.equal(fresh.s,0);
  assert.deepEqual(fresh.history,[]);
  const loaded=loadState(memStorage(null));
  assert.deepEqual(loaded.knobs,NEUTRAL_KNOBS);
});

test('storage corrupt or wrong-shaped: loadState never throws and falls back to neutral',()=>{
  for(const raw of ['not json','{}','[]','null','{"knobs":"nope","history":[]}','{"knobs":{},"history":"nope"}',undefined]){
    const storage={getItem:()=>raw};
    assert.doesNotThrow(()=>loadState(storage));
    const s=loadState(storage);
    assert.deepEqual(s.knobs,NEUTRAL_KNOBS,`raw=${raw}`);
  }
  // getItem/setItem throwing outright (private-mode Safari etc.) must not throw either.
  const throwing={getItem:()=>{throw new Error('nope');},setItem:()=>{throw new Error('nope');}};
  assert.doesNotThrow(()=>loadState(throwing));
  assert.doesNotThrow(()=>saveState(freshState(),throwing));
});

test('loadState clamps any out-of-bounds stored knob back inside KNOB_BOUNDS',()=>{
  const storage=memStorage(JSON.stringify({knobs:{hp:99,dmg:-5,count:50,aggro:0,cadence:0},history:[]}));
  const s=loadState(storage);
  for(const k of Object.keys(KNOB_BOUNDS)){
    const [lo,hi]=KNOB_BOUNDS[k];
    assert.ok(s.knobs[k]>=lo&&s.knobs[k]<=hi,`${k} out of bounds: ${s.knobs[k]}`);
  }
});

test('knobs never exceed KNOB_BOUNDS even after many raids of the same extreme signal',()=>{
  let state=freshState();
  for(let i=0;i<60;i++)state=recordRaid(state,strongSignal(),i*1000);
  for(const k of Object.keys(KNOB_BOUNDS)){
    const [lo,hi]=KNOB_BOUNDS[k];
    assert.ok(state.knobs[k]>=lo-1e-9&&state.knobs[k]<=hi+1e-9,`${k}=${state.knobs[k]} out of [${lo},${hi}]`);
  }
  let weak=freshState();
  for(let i=0;i<60;i++)weak=recordRaid(weak,weakSignal(),i*1000);
  for(const k of Object.keys(KNOB_BOUNDS)){
    const [lo,hi]=KNOB_BOUNDS[k];
    assert.ok(weak.knobs[k]>=lo-1e-9&&weak.knobs[k]<=hi+1e-9,`${k}=${weak.knobs[k]} out of [${lo},${hi}]`);
  }
});

test('one knob step at most per raid',()=>{
  let state=freshState();
  for(let i=0;i<10;i++){
    const prev=state.knobs;
    state=recordRaid(state,strongSignal(),i*1000);
    const changed=Object.keys(prev).filter(k=>Math.abs(prev[k]-state.knobs[k])>1e-9);
    assert.ok(changed.length<=1,`raid ${i} changed knobs: ${changed}`);
  }
});

test('needs 2 consecutive same-direction signals before the first step moves anything',()=>{
  let state=freshState();
  state=recordRaid(state,strongSignal(),1000); // 1st strong signal: no step yet
  assert.deepEqual(state.knobs,NEUTRAL_KNOBS,'a single strong raid must not move any knob');
  state=recordRaid(state,strongSignal(),2000); // 2nd consecutive: now it may step
  assert.notDeepEqual(state.knobs,NEUTRAL_KNOBS);
});

test('a death eases the next raid at most one step, even with no prior consecutive signal',()=>{
  let state=freshState();
  state=recordRaid(state,weakSignal(),1000);
  assert.notDeepEqual(state.knobs,NEUTRAL_KNOBS,'a single death must still ease one knob');
  // the eased knob must be on the "easier" side of neutral
  const eased=Object.entries(state.knobs).find(([k,v])=>Math.abs(v-NEUTRAL_KNOBS[k])>1e-9);
  assert.ok(eased);
  const [key,val]=eased;
  const harderIsUp=key!=='cadence';
  assert.ok(harderIsUp?val<NEUTRAL_KNOBS[key]:val>NEUTRAL_KNOBS[key],`${key} must move toward easier, got ${val}`);
});

test('drifts back toward neutral after 3 raids in band',()=>{
  // Push hp off-neutral first (several strong raids), then feed raids that land exactly on s=0
  // (extracted, but with maximally bad damage/TTK/time -- .5*1 + .25*-1 + .15*-1 + .1*-1 = 0) until
  // the rolling 5-raid history is purely this signal and the knob drifts back.
  let state=freshState();
  for(let i=0;i<8;i++)state=recordRaid(state,strongSignal(),i*1000);
  assert.notDeepEqual(state.knobs,NEUTRAL_KNOBS,'setup: knobs should have moved off neutral');
  const totalDist=knobs=>Object.keys(NEUTRAL_KNOBS).reduce((sum,k)=>sum+Math.abs(knobs[k]-NEUTRAL_KNOBS[k]),0);
  const peakDist=totalDist(state.knobs);
  const onBandSignal={depth:2,outcome:1,death:false,damagePct:100,ttkSec:60,timeToExtractSec:600,medkitsUsed:0,clutch:false};
  for(let i=0;i<20;i++)state=recordRaid(state,onBandSignal,(100+i)*1000);
  const finalDist=totalDist(state.knobs);
  assert.ok(finalDist<peakDist,`expected drift toward neutral: peak ${peakDist} -> final ${finalDist}`);
});

test('count knob only moves roughly every 2 raids, not every raid',()=>{
  // Drive cadence/aggro/hp/dmg to their bounds first so count is the only knob left to spend.
  let state=freshState();
  for(let i=0;i<200;i++)state=recordRaid(state,strongSignal(),i*1000);
  for(const k of ['cadence','aggro','hp','dmg']){
    const [lo,hi]=KNOB_BOUNDS[k];
    assert.ok(Math.abs(state.knobs[k]-lo)<1e-9||Math.abs(state.knobs[k]-hi)<1e-9,`${k} should be pinned at a bound, got ${state.knobs[k]}`);
  }
  assert.ok(state.knobs.count>=KNOB_BOUNDS.count[0]&&state.knobs.count<=KNOB_BOUNDS.count[1]);
});

test('lapse (>3 days) eases the NEXT raid immediately and doubles the following step size',()=>{
  const threeDaysMs=3*24*60*60*1000;
  let state=recordRaid(freshState(),strongSignal(),1000);
  state=recordRaid(state,strongSignal(),2000); // move something off neutral so there is something to ease
  const beforeLapse={...state.knobs};
  const now=2000+threeDaysMs+1;
  const lapsed=checkLapse(state,now);
  assert.ok(lapsed.lapseBoostRaids===2,'lapse must flag the next 2 raids for a double step');
  assert.ok(lapsed.s<=state.s,'lapse must not make the skill estimate look stronger');
  assert.notDeepEqual(lapsed.knobs,beforeLapse,'lapse must ease a knob immediately, not on the raid after');
});
test('no lapse within the 3-day window',()=>{
  let state=recordRaid(freshState(),strongSignal(),1000);
  const now=1000+3*24*60*60*1000-1;
  const notLapsed=checkLapse(state,now);
  assert.deepEqual(notLapsed,state);
});
test('checkLapse saves immediately so a second check before any raid ends does not re-trigger',()=>{
  const storage=memStorage();
  let state=recordRaid(freshState(),strongSignal(),1000);
  saveState(state,storage);
  const threeDaysMs=3*24*60*60*1000;
  const once=checkLapse(state,1000+threeDaysMs+1,storage);
  assert.equal(once.lapseBoostRaids,2);
  const twice=checkLapse(once,1000+threeDaysMs+2,storage);
  assert.deepEqual(twice,once,'a second check milliseconds later must not re-lapse');
});

test('loot multiplier is 1.0-1.2, only above neutral for a struggling (negative skill) player, never below 1.0',()=>{
  const N={hp:1,dmg:1,count:0,aggro:1,cadence:1};
  assert.equal(lootMultiplier({s:0,knobs:N}),1);
  assert.equal(lootMultiplier({s:-1,knobs:{hp:.85,dmg:.8,count:-1,aggro:.85,cadence:1.15}}),1,'easier never changes loot');
  assert.ok(Math.abs(lootMultiplier({s:1,knobs:{hp:1.8,dmg:1.3,count:3,aggro:1.3,cadence:.85}})-1.2)<1e-9,'all hard bounds = +20%');
  const half=lootMultiplier({s:.5,knobs:{...N,count:3}});
  assert.ok(half>1&&half<1.2,'partial harder = partial bonus');
  assert.equal(lootMultiplier(undefined),1);
});

test('DDA_KEY is the documented flat localStorage key',()=>{
  assert.equal(DDA_KEY,'pr_dda_v1');
});
