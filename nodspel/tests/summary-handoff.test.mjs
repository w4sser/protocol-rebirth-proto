import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createRound,initEquip,extractRound,takeDamage,tickRound,abandonRound} from '../round.js';
import {readLaunch,handoffRaidResult,buildRaidResult,RAID_RESULT_KEY} from '../raid-result.js';

const html=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const shell=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'});
const scripts=await Promise.all([...shell.window.document.querySelectorAll('script[src]')]
  .map(el=>el.getAttribute('src').split('?')[0]).filter(src=>!src.startsWith('http'))
  .map(async src=>({src,source:await readFile(new URL('../../'+src,import.meta.url),'utf8')})));
function boot(window){
  window.URL.createObjectURL=()=> 'blob:fake';
  for(const {src,source} of scripts)window.eval(source+(src==='app.js'?';window.__TEST_STATE=()=>S;':''));
}
boot(shell.window);
const seed=JSON.parse(JSON.stringify(shell.window.freshState()));
seed.introSeen=true;seed.retentionMode='core';seed.bondXp=0;seed.secureItem=null;
shell.window.close();

const launch=readLaunch('?seed=summary-ledger&raidId=summary-ledger&return=..%2Findex.html&gear=scout_rig&w=id:smg_vector');
// Match the layout stress fixture, including known materials outside the current
// random-drop pools. Different quantities catch ledger/aggregation errors too.
const ids=DATA.items.filter(it=>!it.slot&&!it.free&&!it.scouts&&!it.grantsCurrency).map(it=>it.id);
const bag=Object.fromEntries(ids.map((id,i)=>[id,1+i%3]));
for(const outcome of ['extract','death','timeout','abandon'])test(`${outcome}: every carried material survives handoff into the summary DOM`,()=>{
  const round=createRound(launch.seed,0);initEquip(round,{weapon:'smg_vector',gear:['scout_rig']});
  round.bag={...bag};round.levelsCleared=1;
  if(outcome==='extract')extractRound(round,10);
  if(outcome==='death')takeDamage(round,10000,10);
  if(outcome==='timeout')tickRound(round,round.durationMs+1);
  if(outcome==='abandon')abandonRound(round,10);
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;
  try{
    w.localStorage.setItem('pr_meta_save',JSON.stringify({...seed,coreLaunch:{...launch,area:'bunker'}}));
    assert.equal(handoffRaidResult(round,{launch,storage:w.localStorage,navigate:()=>{}}),true);
    const result=JSON.parse(w.localStorage.getItem(RAID_RESULT_KEY));
    const ledger=outcome==='extract'?result.extracted:result.lost;
    assert.deepEqual(ledger.slice().sort(),Object.entries(bag).flatMap(([id,n])=>Array(n).fill(id)).sort(),'writer preserves the full bag and quantities');
    assert(Object.values(round.bag).every(n=>n===0),'terminal transfer empties the carried bag');
    boot(w);
    assert.equal(w.localStorage.getItem(RAID_RESULT_KEY),null,'base consumes the real handoff');
    const grid=w.document.querySelector('#overlay.raid-summary-ov .loot-grid');
    assert(grid,'base boot opens the real shared summary');
    for(const [id,n] of Object.entries(bag)){
      const cards=grid.querySelectorAll(`.loot-card[data-item="${id}"]`);
      assert.equal(cards.length,1,`${id}: one card exists in DOM, including the scrollable tail`);
      assert.equal(cards[0].querySelector('.loot-card-row>b').textContent,`x${n}`,`${id}: quantity survives aggregation`);
      assert(cards[0].classList.contains(outcome==='extract'?'gain':'loss'),`${id}: correct outcome styling`);
      if(outcome==='extract')assert.equal(w.__TEST_STATE().stash[id],(seed.stash[id]||0)+n,`${id}: actually returned to stash`);
    }
  }finally{w.close();}
});

// v2.28.24: death/timeout/abandon now show their own in-raid loss screen before Return to base writes
// the ledger with acknowledged:true. The base must still ingest that ledger completely (deaths counted,
// storage consumed) but must not show a second full summary for a loss the player already saw -- extract
// never sets acknowledged on its normal (automatic) path, so its summary is unaffected.
for(const outcome of ['death','extract'])test(`${outcome}: an acknowledged result ingests completely, and only a non-extract outcome skips the second base overlay`,()=>{
  const round=createRound(launch.seed,0);initEquip(round,{weapon:'smg_vector',gear:['scout_rig']});
  round.bag={...bag};round.levelsCleared=1;
  if(outcome==='extract')extractRound(round,10);else takeDamage(round,10000,10);
  const result=buildRaidResult(round,{launch,acknowledged:true});
  assert.equal(result.acknowledged,true,'the written result carries the acknowledged flag');
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;
  try{
    w.localStorage.setItem('pr_meta_save',JSON.stringify({...seed,coreLaunch:{...launch,area:'bunker'}}));
    w.localStorage.setItem(RAID_RESULT_KEY,JSON.stringify(result));
    boot(w);
    assert.equal(w.localStorage.getItem(RAID_RESULT_KEY),null,'base consumes an acknowledged result exactly like any other');
    const overlay=w.document.querySelector('#overlay.raid-summary-ov');
    if(outcome==='extract')assert(overlay,'extract still opens the shared summary even when acknowledged');
    else{
      assert.equal(overlay,null,'an acknowledged death does not show a second full loss summary');
      assert.equal(w.__TEST_STATE().deaths,1,'the death is still recorded even though the overlay stays silent');
      for(const [id,n] of Object.entries(bag))assert.equal(w.__TEST_STATE().stash[id]||0,seed.stash[id]||0,`${id}: a death still loses the carried bag`);
    }
  }finally{w.close();}
});
