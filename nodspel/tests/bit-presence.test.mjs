import vm from 'node:vm';
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
 assert.match(src,/if\(bitAlong\)void audio\.voice\('hunters-inbound'\)/);
 assert.match(src,/const bitLine=bitAlong \? materialPickupBitLine\(item,launch\) : null/);
});

test('sleeping BIT suppresses event voice lines while combat and pickup SFX remain audible',async()=>{
 const src=await readFile(new URL('../audio.js',import.meta.url),'utf8');
 const dispatcher=src.slice(src.indexOf('const config='),src.indexOf("if(typeof document")).replace('export function audioEvent','function audioEvent');
 for(const ftue of [true,false]){
  const voices=[],sfx=[];const context={DATA:{audio:{weaponClasses:{},enemyTypes:{},killStreak:1,rareTiers:['rare']}},location:{search:ftue?'?ftue=1':''},URLSearchParams,bitAccompaniesRaid,audio:{play:n=>sfx.push(n),voice:n=>voices.push(n),stop(){}}};
  vm.runInNewContext(dispatcher+';this.event=audioEvent;',context);
  for(const [event,detail]of [['kill',{}],['pickup',{rarity:'rare'}],['bag-full',{}],['heal-low',{}],['hunter-wave',{}],['extract-revealed',{}],['result',{success:false}]])context.event(event,detail);
  assert.equal(voices.length,ftue?0:7);assert.ok(sfx.length>0,'SFX are unaffected');
 }
});
