// Per-player adaptive difficulty (docs/difficulty-bots.md §3 "Per-player adaptive difficulty (DDA)"
// and §7 decisions). A small state machine: given the stored DDA state and one raid's end-of-raid
// signals, computes the next state (skill estimate, knobs, history). The result is only ever
// consumed at raid generation via nodspel/difficulty.js's applyDifficulty -- never mid-fight, and
// never during FTUE (callers must not invoke this for raids 1-3; see game.mjs's wiring).
//
// Storage key 'pr_dda_v1' is a flat localStorage key, not slot-namespaced, matching the existing
// FTUE_KEY precedent in app.js/game.mjs (nr_ftue/pr_ftue_v1 are flat too despite being conceptually
// per-profile) -- a real per-slot key would need the base save-slot plumbing (save-slots.js) threaded
// into nodspel/, out of scope for this PR.
import {NEUTRAL_KNOBS,KNOB_BOUNDS} from './difficulty.js?v=2.28.15';

export const DDA_KEY='pr_dda_v1';
const EMA_ALPHA=.3;
const HISTORY_MAX=5;
const LAPSE_MS=3*24*60*60*1000;
const IN_BAND_EPSILON=.12; // |s| below this counts as "in band" for the drift-to-neutral rule
const IN_BAND_RAIDS=3; // §3: "moves back toward neutral after 3 raids in band"
const CONSECUTIVE_NEEDED=2; // §3: "needs 2 consecutive signals in the same direction before it moves"
const COUNT_HARDER_MIN_S=.35;
const COUNT_HARDER_MIN_EXTRACT=.85; // ...and only while the player still extracts >=85% (EMA)
const COUNT_RAID_INTERVAL=2; // §3: count steps "every 2 raids", slower than the other knobs

// Step size per raid (docs/difficulty-bots.md §3 table) and spend priority: "spends the cheapest
// invisible knobs first (cadence and aggro, then HP and damage, then count)". `harder` says which
// raw direction of the knob value makes the raid harder -- cadence is inverted (a smaller cooldown
// multiplier means faster enemy fire, i.e. harder), everything else is "bigger number = harder".
const KNOB_ORDER=Object.freeze([
  {key:'cadence',step:.05,harder:-1},
  {key:'aggro',step:.05,harder:1},
  {key:'hp',step:.1,harder:1},
  {key:'count',step:1,harder:1},
  {key:'dmg',step:.05,harder:1},
]);

// Harder side (v2.25.1, docs/difficulty-bots.md §9): the fixed sim bots showed cadence/aggro/dmg barely move
// strong/avg players (they win on aim and positioning), while one extra enemy and tougher enemies do. So
// when stepping HARDER the DDA spends count and hp first, then aggro/cadence, and dmg last (dmg mainly
// punishes weaker players). Easing keeps the original cheapest-invisible-first order.
const HARDER_ORDER=Object.freeze(['count','hp','aggro','cadence','dmg'].map(k=>KNOB_ORDER.find(o=>o.key===k)));

function boundsFor(knob){return KNOB_BOUNDS[knob];}

// Reference bands per depth (docs/difficulty-bots.md §2 survival/extract/time/damage targets; the
// adaptive goal itself targets 65-75% extract on whatever depth is being played, so the outcome
// z-score centres on that band's midpoint -- 0.70 -- at every depth rather than the depth's own
// baseline-tuning target). ttkSec has no measured target in the docs; these are authored reference
// points (not sim output), used only to shape the DDA's TTK z-score, which carries the smallest
// weight (0.15) of the four signals.
export const DEPTH_BANDS=Object.freeze({
  1:{extractTarget:.70,damagePct:[30,60],timeSec:[120,240],ttkSec:5},
  2:{extractTarget:.75,damagePct:[40,70],timeSec:[180,300],ttkSec:6},
  3:{extractTarget:.75,damagePct:[50,80],timeSec:[240,420],ttkSec:7},
});

const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const clamp11=v=>clamp(v,-1,1);

export function freshState(){
  return {s:0,knobs:{...NEUTRAL_KNOBS},history:[],lastRaidAt:null,direction:0,consecutive:0,inBandRaids:0,lapseBoostRaids:0,raidsSinceCountStep:0};
}

export function loadState(storage=globalThis.localStorage){
  try{
    const raw=storage.getItem(DDA_KEY);
    if(!raw)return freshState();
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||typeof parsed.knobs!=='object'||parsed.knobs===null||!Array.isArray(parsed.history))return freshState();
    const fresh=freshState();
    const knobs={...fresh.knobs};
    for(const k of Object.keys(fresh.knobs))if(Number.isFinite(parsed.knobs[k]))knobs[k]=clamp(parsed.knobs[k],...boundsFor(k));
    return {...fresh,...parsed,s:Number.isFinite(parsed.s)?clamp11(parsed.s):0,knobs,history:parsed.history.slice(-HISTORY_MAX).filter(h=>h&&typeof h==='object')};
  }catch{return freshState();}
}

export function saveState(state,storage=globalThis.localStorage){
  try{storage.setItem(DDA_KEY,JSON.stringify(state));}catch{}
}

// EMA (docs §3: "decayed with EMA α=0.3") over the stored raid history, oldest first, for one
// numeric field. The "rolling window (last 5 raids)" is the history array itself (capped below).
function emaOf(history,field){
  let acc=null;
  for(const h of history){
    const v=h[field];if(!Number.isFinite(v))continue;
    acc=acc==null?v:EMA_ALPHA*v+(1-EMA_ALPHA)*acc;
  }
  return acc;
}

// Weighted z-score skill estimate (docs §3: "weighted z-score against the depth's target band";
// weights outcome 0.5, damage 0.25, TTK 0.15, time 0.1). Positive = the player is beating the band
// (push difficulty up); negative = struggling (ease off).
function skillEstimate(history,depth){
  const band=DEPTH_BANDS[depth]??DEPTH_BANDS[1];
  const outcomeEma=emaOf(history,'outcome');
  const damageEma=emaOf(history,'damagePct');
  const ttkEma=emaOf(history,'ttkSec');
  const timeEma=emaOf(history,'timeToExtractSec');
  const zOutcome=outcomeEma==null?0:clamp11((outcomeEma-band.extractTarget)/.30);
  const [dLo,dHi]=band.damagePct,dMid=(dLo+dHi)/2,dHalf=(dHi-dLo)/2;
  const zDamage=damageEma==null?0:clamp11((dMid-damageEma)/dHalf); // less damage taken = stronger
  const zTtk=ttkEma==null?0:clamp11((band.ttkSec-ttkEma)/band.ttkSec); // faster kills = stronger
  const [tLo,tHi]=band.timeSec,tMid=(tLo+tHi)/2,tHalf=(tHi-tLo)/2;
  const zTime=timeEma==null?0:clamp11((tMid-timeEma)/tHalf); // faster clear = stronger (small weight)
  return clamp11(.5*zOutcome+.25*zDamage+.15*zTtk+.1*zTime);
}

// Lapse (docs §7 decision 2): >3 days since the last raid nudges the skill estimate easier, steps
// one knob easier right away (so the raid the player is ABOUT to start, not the one after, is
// already softer) and doubles the step size for the next 2 raids, for faster re-convergence on
// return. Call at raid START (before applyDifficulty reads state.knobs), not at raid end -- a lapsed
// player's very next raid must already be easier, not one raid later. Saves immediately so a second
// reset() before any raid completes does not re-trigger the same lapse.
export function checkLapse(state,now,storage){
  if(state.lastRaidAt==null||now-state.lastRaidAt<=LAPSE_MS)return state;
  const eased=pickKnobToStep(state.knobs,-1,state.raidsSinceCountStep??0);
  const knobs=eased?{...state.knobs,[eased.key]:eased.next}:state.knobs;
  const next={...state,s:clamp11(Math.min(state.s,state.s*.5-.2)),knobs,lapseBoostRaids:2,lastRaidAt:now,
    raidsSinceCountStep:eased?.key==='count'?0:state.raidsSinceCountStep};
  if(storage)saveState(next,storage);
  return next;
}

// `raidsSinceCountStep` gates the count knob's own, slower "every 2 raids" cadence (docs §3),
// independent of whether cadence/aggro/hp/dmg stepped more recently.
function pickKnobToStep(knobs,dirSign,raidsSinceCountStep,s=0,outcomeEma=1){
  for(const {key,step,harder} of dirSign>0?HARDER_ORDER:KNOB_ORDER){
    if(key==='count'&&raidsSinceCountStep<COUNT_RAID_INTERVAL)continue;
    // An extra enemy is the biggest single jump; only add one for a clearly strong signal (bots that
    // were barely above the band got one, then collapsed and oscillated).
    if(key==='count'&&dirSign>0&&(s<COUNT_HARDER_MIN_S||outcomeEma<COUNT_HARDER_MIN_EXTRACT))continue;
    const [lo,hi]=boundsFor(key),delta=dirSign*harder*step,next=clamp(knobs[key]+delta,lo,hi);
    if(Math.abs(next-knobs[key])>1e-9)return {key,next};
  }
  return null;
}

// One knob step toward neutral, for the "3 raids in band" drift rule: picks the first (priority-
// order) knob that is not already neutral and nudges it one step back.
function pickKnobToDrift(knobs){
  for(const {key,step} of KNOB_ORDER){
    const neutral=NEUTRAL_KNOBS[key],cur=knobs[key];
    if(Math.abs(cur-neutral)<1e-9)continue;
    const dir=cur>neutral?-1:1,next=cur+dir*Math.min(step,Math.abs(cur-neutral));
    return {key,next:clamp(next,...boundsFor(key))};
  }
  return null;
}

// Advance the DDA state by one raid. `signal` is this raid's end-of-raid record:
// {depth, outcome (1 extract / 0 not), death, damagePct, ttkSec, timeToExtractSec, medkitsUsed,
// clutch}. Never call this for an FTUE raid (docs §3: "never applies during FTUE") -- game.mjs only
// records signals for non-FTUE/intro raids. Lapse is handled separately by checkLapse() at raid
// START, not here; this only consumes state.lapseBoostRaids if checkLapse already set it.
export function recordRaid(state,signal,now){
  const next=state;
  const history=[...next.history,signal].slice(-HISTORY_MAX);
  const s=skillEstimate(history,signal.depth);
  const stepMul=next.lapseBoostRaids>0?2:1;
  const died=!!signal.death;

  const rawDir=Math.abs(s)<IN_BAND_EPSILON?0:Math.sign(s);
  const consecutive=rawDir!==0&&rawDir===next.direction?next.consecutive+1:rawDir!==0?1:0;
  const inBandRaids=rawDir===0?next.inBandRaids+1:0;
  const raidsSinceCountStep=next.raidsSinceCountStep+1;

  let knobs=next.knobs,stepped=null;
  if(died){
    // §3: "a death eases the next raid at most one step" -- independent of the consecutive-signal
    // gate, but still only one step, still respecting priority order and bounds.
    stepped=pickKnobToStep(knobs,-1,raidsSinceCountStep);
  }else if(rawDir!==0&&consecutive>=CONSECUTIVE_NEEDED){
    stepped=pickKnobToStep(knobs,rawDir,raidsSinceCountStep,s,emaOf(history,'outcome')??1);
  }else if(rawDir===0&&inBandRaids>=IN_BAND_RAIDS){
    stepped=pickKnobToDrift(knobs);
  }
  if(stepped){
    const bounded=stepMul>1?clamp(knobs[stepped.key]+(stepped.next-knobs[stepped.key])*stepMul,...boundsFor(stepped.key)):stepped.next;
    knobs={...knobs,[stepped.key]:bounded};
  }

  return {
    s,knobs,history,lastRaidAt:now,
    direction:rawDir,consecutive,
    inBandRaids:rawDir===0?inBandRaids:0,
    lapseBoostRaids:Math.max(0,next.lapseBoostRaids-(stepped?1:0)),
    raidsSinceCountStep:stepped?.key==='count'?0:raidsSinceCountStep,
  };
}

// Loot scaling (docs §7 decision 1): proportional to how far the DDA knobs sit on the HARDER side of
// neutral, up to +20% when every knob is at its hard bound. Never below 1.0 -- easing never costs loot.
export function lootMultiplier(state){
  const knobs=state?.knobs;if(!knobs)return 1;
  let sum=0,n=0;
  for(const {key,harder} of KNOB_ORDER){
    const v=knobs[key];if(!Number.isFinite(v))continue;
    const [lo,hi]=boundsFor(key),neutral=NEUTRAL_KNOBS[key],bound=harder>0?hi:lo;
    sum+=clamp((v-neutral)/(bound-neutral),0,1);n++;
  }
  return n?1+.2*clamp(sum/n,0,1):1;
}
