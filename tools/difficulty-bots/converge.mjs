#!/usr/bin/env node
// DDA convergence sim (docs/difficulty-bots.md §4.4(b) and §3's "Adaptive goal": every skill tier
// converges to about 65-75% extract on the depth it is playing). Plays each tier through N
// consecutive post-FTUE raids per simulated "player" (one independent DDA state per seed, exactly
// the state machine nodspel/dda.js is, applied via nodspel/difficulty.js's applyDifficulty at raid
// generation the same way game.mjs wires it) and reports rolling extract% per raid index, plus how
// often each knob sits pinned at one of its KNOB_BOUNDS.
//
// A real play session never lapses mid-session (docs §7 decision 2 is a return-after-days-away
// rule), so checkLapse() is intentionally not exercised here -- see nodspel/tests/dda.test.mjs for
// that rule in isolation.
//
//   node tools/difficulty-bots/converge.mjs [--tier avg] [--seeds 20] [--raids 10] [--depth 2] [--json]
import {runRaid} from './sim.mjs';
import {freshState,recordRaid} from '../../nodspel/dda.js';
import {KNOB_BOUNDS} from '../../nodspel/difficulty.js';
import {pathToFileURL} from 'node:url';

function parseArgs(argv){
  const args={tier:null,seeds:20,raids:10,depth:2,json:false};
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--tier')args.tier=argv[++i];
    else if(a==='--seeds')args.seeds=Math.max(1,parseInt(argv[++i],10)||1);
    else if(a==='--raids')args.raids=Math.max(1,parseInt(argv[++i],10)||1);
    else if(a==='--depth')args.depth=Math.max(1,Math.min(3,parseInt(argv[++i],10)||2));
    else if(a==='--json')args.json=true;
  }
  return args;
}

const atBound=(v,[lo,hi])=>Math.abs(v-lo)<1e-9||Math.abs(v-hi)<1e-9;

// One simulated player: an independent DDA state, played through `raids` consecutive raids at a
// fixed `depth`, applying the current knobs each raid and feeding the real end-of-raid signal back
// in -- the same loop game.mjs's reset()/finishRound() run raid-to-raid for a real profile.
function simulatePlayer(tier,seed,raids,depth){
  let state=freshState();
  const perRaid=[];
  const clips=Object.fromEntries(Object.keys(KNOB_BOUNDS).map(k=>[k,0]));
  for(let i=0;i<raids;i++){
    const r=runRaid({tier,seed:`${seed}:raid${i}`,targetDepth:depth,knobs:state.knobs});
    perRaid.push({raid:i+1,extracted:r.extracted,levelReached:r.levelReached,damagePct:r.damageTakenPct});
    const meanTtk=r.ttkSecList.length?r.ttkSecList.reduce((a,b)=>a+b,0)/r.ttkSecList.length:undefined;
    state=recordRaid(state,{
      depth:r.levelReached,outcome:r.extracted?1:0,death:r.reason==='death',
      damagePct:r.damageTakenPct,ttkSec:meanTtk,
      timeToExtractSec:r.extracted?r.timeToExtractSec:undefined,
      medkitsUsed:r.medkitsUsed,clutch:r.extracted&&r.damageTakenPct>85,
    },(i+1)*1000);
    for(const k of Object.keys(KNOB_BOUNDS))if(atBound(state.knobs[k],KNOB_BOUNDS[k]))clips[k]++;
  }
  return {perRaid,clips,finalKnobs:state.knobs};
}

// Rolling extract% over the trailing `window` raids (docs §4.4(b): "within 65-75% extract ... by
// raid 6 (rolling)"), across all seeds, for each raid index.
function rollingExtractPct(allPerRaid,raids,window=5){
  const out=[];
  for(let i=1;i<=raids;i++){
    const lo=Math.max(1,i-window+1);
    let n=0,extracted=0;
    for(const seedRaids of allPerRaid)for(const r of seedRaids)if(r.raid>=lo&&r.raid<=i){n++;if(r.extracted)extracted++;}
    out.push({raid:i,n,extractPct:n?Math.round(extracted/n*1000)/10:null});
  }
  return out;
}

export function runConvergence(tier,seeds,raids,depth){
  const players=Array.from({length:seeds},(_,i)=>simulatePlayer(tier,`converge-${tier}-${i}`,raids,depth));
  const allPerRaid=players.map(p=>p.perRaid);
  const rolling=rollingExtractPct(allPerRaid,raids);
  const clipTotals=Object.fromEntries(Object.keys(KNOB_BOUNDS).map(k=>[k,0]));
  for(const p of players)for(const k of Object.keys(KNOB_BOUNDS))clipTotals[k]+=p.clips[k];
  const clipPct=Object.fromEntries(Object.keys(KNOB_BOUNDS).map(k=>[k,Math.round(clipTotals[k]/(seeds*raids)*1000)/10]));
  const inBandByRaid6=rolling[5]&&rolling[5].extractPct!=null&&rolling[5].extractPct>=65&&rolling[5].extractPct<=75;
  return {tier,seeds,raids,depth,rolling,clipPct,inBandByRaid6};
}

function printTable(rows){
  console.table(rows.map(r=>({raid:r.raid,n:r.n,'rolling extract%':r.extractPct})));
}

function main(){
  const args=parseArgs(process.argv.slice(2));
  const tiers=args.tier?[args.tier]:['strong','avg','weak'];
  const results=tiers.map(tier=>runConvergence(tier,args.seeds,args.raids,args.depth));
  if(args.json){console.log(JSON.stringify({seeds:args.seeds,raids:args.raids,depth:args.depth,results},null,2));return;}
  for(const res of results){
    console.log(`\n== ${res.tier} (depth L${res.depth}, n=${res.seeds} seeds, ${res.raids} raids) ==`);
    printTable(res.rolling);
    console.log('knob clip%% (fraction of raids each knob sat pinned at a bound):',res.clipPct);
    console.log(`in 65-75%% band by raid 6 (rolling): ${res.inBandByRaid6}`);
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
