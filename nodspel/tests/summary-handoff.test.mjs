import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createRound,initEquip,extractRound,takeDamage,tickRound,abandonRound} from '../round.js';
import {readLaunch,handoffRaidResult,RAID_RESULT_KEY} from '../raid-result.js';

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
