import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bitAccompaniesRaid} from '../bit-presence.js';

test('D3.1: BIT does not accompany the FTUE intro raid, and does accompany every other launch',()=>{
  assert.equal(bitAccompaniesRaid({ftue:true}),false);
  assert.equal(bitAccompaniesRaid({ftue:1}),false);
  assert.equal(bitAccompaniesRaid({ftue:false}),true);
  assert.equal(bitAccompaniesRaid({intro:true}),true,'guided intro (pre-Fabricator, after meeting BIT) still has BIT');
  assert.equal(bitAccompaniesRaid({}),true);
  assert.equal(bitAccompaniesRaid(null),true);
});

test('game.mjs hides the drone, distract, heal and BIT-attributed lines when BIT is not along',async()=>{
  const src=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(src,/const bitAlong=bitAccompaniesRaid\(launch\)/);
  assert.match(src,/bitModel\.visible=bitAlong/);
  assert.match(src,/const bitDistractAvailable=bitAlong&&/);
  assert.match(src,/if\(bitAlong&&!bitDistract\.active&&stepBIT/);
  assert.match(src,/if\(!bitAlong\|\|round\.over/);
  assert.match(src,/if\(!bitAlong\)\{bitLabel\.el\.hidden=true;\}/);
  assert.match(src,/if\(bitAlong&&round\.healBudgetLow/);
  assert.match(src,/bitAlong\?`BIT: \$\{tip\.text\}`:tip\.text/);
});

// v2.28.52: every first-sight caller gates before consuming its seen flag.
test('sleeping BIT defers all first-sight cards and material commentary',async()=>{
 const src=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
 for(const fn of ['checkDrumIntro\\(\\)','checkPadIntro\\(clock\\)','checkShelfIntro\\(\\)'])assert.match(src,new RegExp('function '+fn+'\\{\\s*if\\(!bitAlong\\)return;'));
 assert.match(src,/const bitLine=bitAlong \? materialPickupBitLine\(item,launch\) : null/);
});
