import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createRound,initEquip,extractRound} from '../round.js';
import {readLaunch,handoffRaidResult,RAID_RESULT_KEY} from '../raid-result.js';

// v2.21.1 item 8: a long raid pushes sessionStorage's "pr_splash_seen" mark past app.js's 5 min
// freshness window (app.js setupSplash()), so on return the base used to show the splash screen
// first and only then the end-of-round result -- it must go straight to the result instead.
// Same full-boot technique as summary-handoff.test.mjs, reused here so the real init block (not a
// re-implementation of its logic) is what's under test.
const html=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const shell=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'});
const scripts=await Promise.all([...shell.window.document.querySelectorAll('script[src]')]
  .map(el=>el.getAttribute('src').split('?')[0]).filter(src=>!src.startsWith('http'))
  .map(async src=>({src,source:await readFile(new URL('../../'+src,import.meta.url),'utf8')})));
function boot(window){
  window.URL.createObjectURL=()=> 'blob:fake';
  window.matchMedia=window.matchMedia||(()=>({matches:false}));
  for(const {src,source} of scripts)window.eval(source+(src==='app.js'?';window.__TEST_STATE=()=>S;':''));
}
boot(shell.window);
const seed=JSON.parse(JSON.stringify(shell.window.freshState()));
seed.introSeen=true;seed.retentionMode='core';seed.bondXp=0;seed.secureItem=null;
shell.window.close();

const launch=readLaunch('?seed=long-run-splash&raidId=long-run-splash&return=..%2Findex.html&gear=scout_rig&w=id:smg_vector');

test('a successful return from a long raid (stale splash mark) lands directly on the result, not the splash',()=>{
  const round=createRound(launch.seed,0);initEquip(round,{weapon:'smg_vector',gear:['scout_rig']});
  round.levelsCleared=1;extractRound(round,10);
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;
  try{
    w.localStorage.setItem('pr_meta_save',JSON.stringify({...seed,coreLaunch:{...launch,area:'bunker'}}));
    assert.equal(handoffRaidResult(round,{launch,storage:w.localStorage,navigate:()=>{}}),true);
    // A raid that ran well over 5 minutes: the "seen" mark from the original splash viewing is
    // ancient by the time the player returns.
    w.sessionStorage.setItem('pr_splash_seen',String(1e12+1));
    boot(w);
    assert(!w.document.getElementById('splash'),'the splash never mounts over a waiting raid result');
    assert(!w.document.body.classList.contains('splash-active'),'body never enters the splash-active state');
    assert(w.document.querySelector('#overlay.raid-summary-ov'),'the real result overlay opens instead');
  }finally{w.close();}
});

test('control: the same stale mark with no pending raid result still shows the splash (unrelated cold opens are unaffected)',()=>{
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;
  try{
    w.localStorage.setItem('pr_meta_save',JSON.stringify(seed));
    w.sessionStorage.setItem('pr_splash_seen',String(1e12+1));
    boot(w);
    assert(w.document.getElementById('splash'),'a stale mark with nothing to return to still shows the splash');
  }finally{w.close();}
});
