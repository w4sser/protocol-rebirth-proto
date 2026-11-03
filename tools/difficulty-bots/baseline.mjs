#!/usr/bin/env node
// Regenerates a full before/after baseline snapshot (docs/difficulty-bots.md §5): all 3 tiers,
// n=50 seeds, FTUE1-3 and L1-L3, neutral knobs (DDA off). Used to produce
// tools/difficulty-bots/baseline-before.json (pre baseline-retune data changes) and
// baseline-after.json (post). Takes several minutes -- tune.mjs's --tier/--seeds flags are faster
// for a single tier while iterating.
//
//   node tools/difficulty-bots/baseline.mjs [out-file.json]
import {runTier} from './tune.mjs';
import fs from 'node:fs';

const SEEDS=50;
const out={date:'2026-11-03',seeds:SEEDS,knobs:'neutral',tiers:{}};
for(const tier of ['strong','avg','weak']){
  console.error('running tier',tier);
  out.tiers[tier]=runTier(tier,SEEDS,null);
}
fs.writeFileSync(process.argv[2]||'tools/difficulty-bots/baseline-before.json',JSON.stringify(out,null,2));
console.log('done');
