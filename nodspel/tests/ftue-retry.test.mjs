// FTUE raid (?ftue=1): death/timeout/abandon retries straight into the same FTUE raid in place --
// no base detour, no round-over screen -- while a real extraction still hands off to base as usual.
// ?intro=1 alone (a returning save mid-onboarding, pre-Fabricator) must keep the old behaviour:
// any outcome routes through handoffRaidResult, exactly like every other base-launched raid.
// Same extraction technique as eor-handoff.test.mjs: run the shipped finishRound with only
// rendering/platform boundaries stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createRound,initEquip,takeDamage} from '../round.js';
import {readLaunch,handoffRaidResult} from '../raid-result.js';

const ftueLaunch=readLaunch('?seed=ftue&raidId=meta-ftue&return=..%2Findex.html&intro=1&ftue=1');
const returningLaunch=readLaunch('?seed=returning&raidId=meta-returning&return=..%2Findex.html&intro=1');
const source=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
const finish=source.slice(source.indexOf('let resultReturning=false;'),source.indexOf("$('#result-details-toggle').addEventListener"));

function context(round,launch,events){
  const elements=new Map();
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{hidden:true,setAttribute(){},focus(){}});return elements.get(selector);};
  return {round,launch,resultPending:false,$:element,weapon:{},viewport:{classList:{add(){}}},
    localStorage:{setItem:()=>{},getItem:()=>null},
    audioEvent:()=>{},
    handoffRaidResult:(r)=>{events.push('handoff');assert.equal(r,round,'handoffRaidResult receives the real round');return true;},
    clearInput:()=>events.push('clear'),hideSwap(){},clearBullets(){},updateHUD(){},lastCombatFeedback:()=>'',deathTip:()=>null,setIconText(){},
    resultView:()=>({}),renderResult(){},
    ftueMark:key=>events.push('mark:'+key),ftueBumpAttempt:()=>events.push('bumpAttempt'),reset:seed=>events.push('reset:'+seed)};
}

for(const reason of ['death','timeout','abandon'])test(`FTUE raid (ftue=1) ${reason} retries in place with the same seed, bumps the attempt counter, never hands off to base`,()=>{
  const round=createRound('ftue-'+reason,0);initEquip(round,{weapon:'basic_carbine',gear:[]});
  if(reason==='death')takeDamage(round,1000,10); else { round.over=true; round.reason=reason; }
  const events=[];
  runInNewContext(finish+';finishRound();',context(round,ftueLaunch,events));
  assert.deepEqual(events,['bumpAttempt','reset:ftue'],'retries in place on launch.seed (not a fresh random seed); no handoffRaidResult, no round-over panel');
});

test('FTUE raid (ftue=1) extraction marks firstExtract once and still hands off to base normally',()=>{
  const round=createRound('ftue-extract',0);initEquip(round,{weapon:'basic_carbine',gear:[]});
  round.over=true;round.reason='extract';
  const events=[];
  runInNewContext(finish+';finishRound();',context(round,ftueLaunch,events));
  assert.deepEqual(events,['mark:firstExtract','handoff'],'extraction is timestamped once, then handed off to base as usual');
});

test('FTUE raid (ftue=1) death, retry (same seed), then extraction all hand off through the same identity',()=>{
  // Regression for the seed-mismatch bug: a retry must keep launch.seed so a later successful
  // extraction's round.seed still matches launch.seed and handoffRaidResult recognises it.
  const round=createRound('ftue-first-attempt',0);initEquip(round,{weapon:'basic_carbine',gear:[]});
  takeDamage(round,1000,10);
  const events=[];
  const retryRound=createRound(ftueLaunch.seed,0);initEquip(retryRound,{weapon:'basic_carbine',gear:[]});
  const ctx=context(round,ftueLaunch,events);
  ctx.reset=seed=>{events.push('reset:'+seed);assert.equal(seed,ftueLaunch.seed,'retry reuses launch.seed, not a fresh random seed');
    Object.assign(round,retryRound);};
  runInNewContext(finish+';finishRound();',ctx);
  assert.deepEqual(events,['bumpAttempt','reset:'+ftueLaunch.seed]);
  assert.equal(round.seed,ftueLaunch.seed,'the retried round carries the same seed as the original launch');
  round.over=true;round.reason='extract'; // the player played the retry through to a real extraction
  events.length=0;
  runInNewContext(finish+';finishRound();',context(round,ftueLaunch,events));
  assert.deepEqual(events,['mark:firstExtract','handoff'],'extraction after a retry still hands off (seed identity preserved)');
});

test('death -> retry (same seed) -> extract: the real handoffRaidResult (not a stub) accepts the retried round',()=>{
  // The exact surface of the seed-mismatch bug: handoffRaidResult rejects whenever
  // launch.seed !== round.seed. A retry that regenerated a fresh random seed would fail this
  // silently (returns false, no navigation) -- this proves the retried round's seed still matches.
  const round=createRound('die-first',0);initEquip(round,{weapon:'basic_carbine',gear:[]});
  takeDamage(round,1000,10);
  assert.notEqual(round.seed,ftueLaunch.seed,'the first attempt used its own random seed, not launch.seed');
  const retried=createRound(ftueLaunch.seed,0);initEquip(retried,{weapon:'basic_carbine',gear:[]}); // what reset(launch.seed) produces
  retried.over=true;retried.reason='extract';
  const events=[];
  const ok=handoffRaidResult(retried,{launch:ftueLaunch,storage:{setItem:()=>events.push('saved')},navigate:url=>events.push('navigate:'+url)});
  assert.equal(ok,true,'handoffRaidResult accepts the retried round because its seed matches launch.seed');
  assert.deepEqual(events,['saved','navigate:../index.html']);
});

for(const reason of ['death','timeout','abandon'])test(`a returning save's guided raid (intro=1, no ftue) ${reason} still hands off to base -- no retry-in-place`,()=>{
  const round=createRound('returning-'+reason,0);initEquip(round,{weapon:'basic_carbine',gear:[]});
  if(reason==='death')takeDamage(round,1000,10); else { round.over=true; round.reason=reason; }
  const events=[];
  runInNewContext(finish+';finishRound();',context(round,returningLaunch,events));
  assert.deepEqual(events,['handoff'],'a returning save never retries in place -- intro=1 alone keeps the pre-v2.22.0 behaviour exactly');
});
