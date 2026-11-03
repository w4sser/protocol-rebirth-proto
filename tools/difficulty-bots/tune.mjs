#!/usr/bin/env node
// Difficulty-bot tuner (docs/difficulty-bots.md §4.4). Runs tools/difficulty-bots/sim.mjs across
// seeds and reports per-segment metrics: FTUE raid 1/2/3 (the attempt ramp, data/raid-ftue.js) and
// normal-raid depth L1/L2/L3 (one raid per seed, pushed from level 1 through level 3; a depth's
// metrics are conditioned on raids that actually reached that depth).
//
//   node tools/difficulty-bots/tune.mjs --tier avg --seeds 50 [--knobs hp=1,dmg=1,count=0,aggro=1]
//   node tools/difficulty-bots/tune.mjs --sweep [--tier avg] [--seeds 20]
//
// --sweep grids RULES.hp x RULES.dmg over {0.8,0.9,1,1.1,1.2} (count/aggro stay neutral unless
// passed via --knobs, applied on top of every cell) and prints one row per cell. Knobs are the
// nodspel/difficulty.js applyDifficulty() hook; they never apply to FTUE raids (docs/difficulty-
// bots.md §3: "never applies during FTUE").
import {runRaid,TIERS} from './sim.mjs';

function parseKnobs(s){
  const out={};
  for(const pair of s.split(',')){
    const [k,v]=pair.split('=');
    if(k)out[k.trim()]=Number(v);
  }
  return out;
}
function parseArgs(argv){
  const args={tier:'avg',seeds:50,knobs:null,sweep:false,json:false};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--tier')args.tier=argv[++i];
    else if(a==='--seeds')args.seeds=Math.max(1,parseInt(argv[++i],10)||1);
    else if(a==='--knobs')args.knobs=parseKnobs(argv[++i]);
    else if(a==='--sweep')args.sweep=true;
    else if(a==='--json')args.json=true;
  }
  return args;
}

const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
const median=arr=>{
  if(!arr.length)return null;
  const s=[...arr].sort((a,b)=>a-b),m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
};
const pct=(n,d)=>d?Math.round(n/d*1000)/10:null;
const round1=n=>n==null?null:Math.round(n*10)/10;

function seedsFor(label,n){return Array.from({length:n},(_,i)=>`tune-${label}-${i}`);}

// A depth's metrics are conditioned on reaching it: survival = among raids that reached this depth,
// the fraction that did not die while still at it (dying one level deeper still counts as surviving
// this one); extract = among raids that reached this depth, the fraction that extracted at all (a
// raid only extracts from its deepest depth or beyond, by definition of how a raid ends).
function depthSegment(raids,depth){
  const reached=raids.filter(r=>r.levelReached>=depth);
  if(!reached.length)return {n:0,survivalPct:null,extractPct:null,medianTTESec:null,meanDamagePct:null,meanTTKSec:null};
  const survived=reached.filter(r=>!(r.reason==='death'&&r.levelReached===depth));
  const extracted=reached.filter(r=>r.extracted);
  return {
    n:reached.length,
    survivalPct:pct(survived.length,reached.length),
    extractPct:pct(extracted.length,reached.length),
    medianTTESec:round1(median(extracted.map(r=>r.timeToExtractSec))),
    meanDamagePct:round1(mean(reached.map(r=>r.damageTakenPct))),
    meanTTKSec:round1(mean(reached.flatMap(r=>r.ttkSecList))),
  };
}
function raidSegment(raids){
  if(!raids.length)return {n:0,survivalPct:null,extractPct:null,medianTTESec:null,meanDamagePct:null,meanTTKSec:null,deathsPct:null};
  const survived=raids.filter(r=>r.survived),extracted=raids.filter(r=>r.extracted);
  return {
    n:raids.length,
    survivalPct:pct(survived.length,raids.length),
    extractPct:pct(extracted.length,raids.length),
    medianTTESec:round1(median(extracted.map(r=>r.timeToExtractSec))),
    meanDamagePct:round1(mean(raids.map(r=>r.damageTakenPct))),
    meanTTKSec:round1(mean(raids.flatMap(r=>r.ttkSecList))),
    deathsPct:pct(raids.filter(r=>r.died).length,raids.length),
  };
}

// Runs every segment for one tier: FTUE raid 1/2/3 (3 independent samples per seed, one per attempt
// index) and normal-raid depth L1/L2/L3. Each depth is its own "depth N raid" campaign (sim.mjs
// runRaid's targetDepth, docs/difficulty-bots.md §4.2/§5): n independent seeds that push levels
// 1..N and voluntarily extract right after clearing N (or bail earlier on low HP), so extract% is
// the real game's definition of extraction at that depth, not just the two ways a push-to-L3 raid
// can end ('complete' at L3 or a mid-raid death). Knobs never reach the FTUE raids.
export function runTier(tier,n,knobs=null){
  const segments={};
  for(const depth of [1,2,3]){
    const seeds=seedsFor(`${tier}-depth${depth}`,n);
    const raids=seeds.map(seed=>runRaid({tier,seed,knobs,targetDepth:depth}));
    segments[`L${depth}`]=depthSegment(raids,depth);
  }
  for(let attempt=0;attempt<3;attempt++){
    const ftueSeeds=seedsFor(`${tier}-ftue${attempt}`,n);
    const ftueRaids=ftueSeeds.map(seed=>runRaid({tier,seed,ftueAttempt:attempt}));
    segments[`FTUE${attempt+1}`]=raidSegment(ftueRaids);
  }
  return segments;
}

function printTable(rows){
  const cols=['segment','n','survivalPct','extractPct','medianTTESec','meanDamagePct','meanTTKSec','deathsPct'];
  console.table(rows.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]??null]))));
}

function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.sweep){
    const grid=[.8,.9,1,1.1,1.2];
    const rows=[];
    for(const hp of grid)for(const dmg of grid){
      const knobs={...(args.knobs??{}),hp,dmg};
      const segments=runTier(args.tier,args.seeds,knobs);
      for(const [segment,m] of Object.entries(segments))rows.push({hp,dmg,segment,...m});
    }
    console.log(JSON.stringify({tier:args.tier,seeds:args.seeds,sweep:true,rows},null,2));
    printTable(rows);
    return;
  }
  const segments=runTier(args.tier,args.seeds,args.knobs);
  const rows=Object.entries(segments).map(([segment,m])=>({segment,...m}));
  console.log(JSON.stringify({tier:args.tier,seeds:args.seeds,knobs:args.knobs??'neutral',segments},null,2));
  printTable(rows);
}

if(import.meta.url===`file://${process.argv[1]}`)main();
