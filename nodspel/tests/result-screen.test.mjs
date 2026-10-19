import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRound,extractRound,takeDamage,tickRound,abandonRound,ROUND_DURATION_MS} from '../round.js';
import {resultView,renderResult,toggleResultDetails} from '../result-screen.js';

const launch={returnUrl:'../index.html',gear:['scavenger_vest'],goal:{name:'Fabricator',level:1,parts:[{id:'cable',need:2,secured:0}]}};
function raid(){const r=createRound('result-screen',0);r.bag.cable=2;r.bag.servo=1;r.levelsCleared=1;r.equip={weapon:'basic_carbine',armor:'scavenger_vest'};return r;}

test('checkpoint is not an extraction, keeps loot at risk, and never promises an upgrade before securing it',()=>{
  const r=raid(),before=structuredClone(r),v=resultView(r,{launch,pending:true});
  assert.equal(v.kind,'checkpoint');assert.match(v.description,/not extracted/);assert.match(v.lootTitle,/NOT SECURED/);
  assert.match(v.goalText,/EXTRACT TO SECURE/);assert.equal(v.bonus,5);assert.equal(v.totals.items,3);
  assert.deepEqual(r,before,'presentation grants no rewards and changes no round state');
});
test('extraction and full clear secure actual loot and name only affordable tracked supplies as ready',()=>{
  const r=raid();extractRound(r,10000);let v=resultView(r,{launch});
  assert.equal(v.title,'EXTRACTED');assert.equal(v.totals.items,3);assert(v.goalReady);assert.equal(v.bonus,5);
  assert.match(v.goalText,/BUILD AT BASE/);assert.equal(v.gear[0].id,'scavenger_vest');
  r.reason='complete';r.levelsCleared=3;v=resultView(r,{launch});assert.equal(v.kind,'extract');assert.equal(v.bonus,30);
  v=resultView(r,{launch:{...launch,goal:{...launch.goal,parts:[{id:'cable',need:4,secured:0}]}}});
  assert(!v.goalReady);assert.match(v.goalText,/Cable 2\/4/);
});
test('death, timeout and abandon have distinct factual outcomes; carried loot is lost and no bonus awarded',()=>{
  for(const [kind,end] of [['death',r=>takeDamage(r,1000,10000)],['timeout',r=>tickRound(r,ROUND_DURATION_MS)],['abandon',r=>abandonRound(r,10000)]]){
    const r=raid();end(r);const v=resultView(r,{launch});assert.equal(v.kind,kind);assert.equal(v.bonus,0);
    assert.equal(v.totals.items,3);assert.match(v.lootTitle,/LOST/);assert.match(v.goalTitle,/BASE IS SAFE/);
    assert.equal(v.gear[0].id,'scavenger_vest');assert(!v.rows.some(row=>row.id==='basic_carbine'));
  }
});
test('existing home supplies, duplicate items and currency loot contribute to goal readiness',()=>{
  const r=raid();extractRound(r,10000);
  const crate=globalThis.DATA.items.find(i=>i.grantsCurrency?.scrap);r.extracted[crate.id]=1;
  const goal={name:'Test',level:1,parts:[{id:'cable',need:3,secured:1},{id:'scrap',kind:'currency',need:crate.grantsCurrency.scrap,secured:0}]};
  assert(resultView(r,{launch:{...launch,goal}}).goalReady);
});
test('known BIT recovery and protected gear are separated from permanent losses without mutating the receipt',()=>{
  const r=raid();takeDamage(r,1000,10000);const before=structuredClone(r);
  const xp=globalThis.DATA.bit.bondLevels.find(l=>l.level===3).xp;
  const v=resultView(r,{launch,home:{bondXp:xp,secureItem:'scavenger_vest'}});
  assert.equal(v.recovered.find(x=>x.by==='BIT recovery').n,1);assert.equal(v.rows.find(x=>x.id==='cable').n,1);
  assert.equal(v.recovered.find(x=>x.by==='Protected gear').id,'scavenger_vest');assert.equal(v.gear.length,0);
  assert.deepEqual(r,before);
  assert.equal(resultView(r,{launch,home:{bondXp:xp-1}}).recovered.length,0);
});
test('renderer replaces checkpoint content on final loss, caps preview but preserves the full list, and toggles details locally',()=>{
  const dom=new JSDOM(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));const previous=globalThis.document;globalThis.document=dom.window.document;
  try{
    const root=document.querySelector('#round-over'),r=raid();
    for(const id of ['fuse','optical_sensor','power_cell','data_core'])r.bag[id]=1;
    renderResult(root,resultView(r,{launch,pending:true}));assert.equal(root.dataset.outcome,'checkpoint');
    assert.equal(root.querySelectorAll('#result-loot .result-item').length,4);assert(root.querySelectorAll('#result-all-loot .result-item').length>4);
    toggleResultDetails(root);assert(root.querySelector('#result-report').hidden);assert.equal(root.querySelector('#result-details-toggle').getAttribute('aria-expanded'),'true');
    takeDamage(r,1000,10000);renderResult(root,resultView(r,{launch,pending:true}));
    assert.equal(root.dataset.outcome,'death');assert.equal(root.querySelector('#round-over-title').textContent,'YOU DIED');
    assert(root.querySelector('#result-details').hidden);assert(!root.querySelector('#result-report').hidden);assert(root.querySelector('#result-bonus').hidden);
  }finally{globalThis.document=previous;dom.window.close();}
});

test('empty and standalone outcomes do not invent lost items or persistent XP rewards',()=>{
  const r=createRound('empty-result',0);takeDamage(r,1000,1000);
  const view=resultView(r);assert.equal(view.totals.items,0);assert.equal(view.retained,'');assert.match(view.description,/No carried items/);
  assert.equal(view.gear.length,0);assert.equal(view.recovered.length,0);
});
