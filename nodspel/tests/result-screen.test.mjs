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
    assert.equal(root.querySelectorAll('#result-loot .result-tile').length,6,'every item type is an icon tile');assert(!root.querySelector('#result-more'),'no "more item types" text line');assert.equal(root.querySelectorAll('#result-all-loot .result-item').length,6);
    for(const it of globalThis.DATA.items.slice(0,12))r.bag[it.id]=1;renderResult(root,resultView(r,{launch,pending:true}));
    assert.equal(root.querySelectorAll('#result-loot .result-tile').length,8);assert.match(root.querySelector('#result-loot .result-tile-more').textContent,/^\+\d+$/);
    toggleResultDetails(root);assert(root.querySelector('#result-report').hidden);assert.equal(root.querySelector('#result-details-toggle').getAttribute('aria-expanded'),'true');
    takeDamage(r,1000,10000);renderResult(root,resultView(r,{launch,pending:true}));
    assert.equal(root.dataset.outcome,'death');assert.equal(root.querySelector('#round-over-title').textContent,'YOU DIED');
    assert(root.querySelector('#result-details').hidden);assert(!root.querySelector('#result-report').hidden);assert(root.querySelector('#result-bonus').hidden);
    assert.equal(root.querySelectorAll('#result-loot .result-tile').length,8,'losses keep the capped preview');
    assert(root.querySelector('#result-loot .result-tile-more'));
    assert.equal(root.querySelectorAll('#result-all-loot .result-item').length,Object.values(r.lost).filter(n=>n>0).length);
  }finally{globalThis.document=previous;dom.window.close();}
});

test('empty and standalone outcomes do not invent lost items or persistent XP rewards',()=>{
  const r=createRound('empty-result',0);takeDamage(r,1000,1000);
  const view=resultView(r);assert.equal(view.totals.items,0);assert.equal(view.retained,'');assert.match(view.description,/No carried items/);
  assert.equal(view.gear.length,0);assert.equal(view.recovered.length,0);
});

test('extraction shows every item by value, names returned gear and retains its BIT reaction',()=>{
  const dom=new JSDOM(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));
  const previous=globalThis.document;globalThis.document=dom.window.document;
  try{
    const root=document.querySelector('#round-over'),r=raid();
    for(const it of globalThis.DATA.items)r.bag[it.id]=1;
    r.equip.armor='scout_rig';extractRound(r,10000);
    // Stress the presentation receipt independently of today's nine material loot types.
    r.extracted=Object.fromEntries(globalThis.DATA.items.map(i=>[i.id,1]));
    const before=structuredClone(r),view=resultView(r,{launch});renderResult(root,view);
    const tiles=[...root.querySelectorAll('#result-loot .result-tile')];
    assert.equal(tiles.length,Object.keys(r.extracted).length);
    assert(!root.querySelector('#result-loot .result-tile-more'));
    const values=tiles.map(t=>globalThis.DATA.items.find(i=>i.id===t.dataset.item).sellValue??0);
    assert.deepEqual(values,[...values].sort((a,b)=>b-a));
    assert(tiles.findIndex(t=>t.dataset.item==='dampener_cloak')<tiles.findIndex(t=>t.dataset.item==='hydraulic_component'),'rarer items win value ties');
    assert.match(root.querySelector('#result-gear').textContent,/GEAR RETURNED.*Scout Rig/);
    assert(root.querySelector('#result-gear use[href="ui-icons.svg#item-rig"]'));
    assert.equal(root.querySelector('#result-loot').tabIndex,0);
    assert(!root.querySelector('#result-bit-line').hidden);
    assert.equal(root.querySelector('#result-bit-line').textContent,`BIT: ${view.reaction.line}`);
    assert.strictEqual(resultView(r,{launch}).reaction,view.reaction);
    assert.deepEqual(r,before,'presentation does not mutate rewards or round state');
    r.reason='complete';renderResult(root,resultView(r,{launch}));
    assert.equal(root.querySelectorAll('#result-loot .result-tile').length,tiles.length,'full clears also show every item');
    toggleResultDetails(root);toggleResultDetails(root);
    assert.equal(root.querySelector('#result-bit-line').textContent,`BIT: ${view.reaction.line}`);
    const dead=raid();takeDamage(dead,1000,10000);renderResult(root,resultView(dead,{launch}));
    assert(root.querySelector('#result-bit-line').hidden);assert(!root.querySelector('.result-gear-returned'));
  }finally{globalThis.document=previous;dom.window.close();}
});

test('BIT follows context priorities and avoids repeating the previous line across raids',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),map=new Map([['pr_bit_first_extract','1']]);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}});
  try{
    const rare=globalThis.DATA.items.find(i=>i.rarity==='rare');let last;
    for(let i=0;i<5;i++){
      const r=raid();r.bag={[rare.id]:1};extractRound(r,10000);
      const reaction=resultView(r,{launch}).reaction;
      assert.equal(reaction.trigger,'rare');assert.notEqual(reaction.id,last);last=reaction.id;
      assert.equal(map.get('pr_bit_last_raid_line'),reaction.id);
    }
    map.delete('pr_bit_first_extract');
    const first=raid();extractRound(first,10000);assert.equal(resultView(first,{launch}).reaction.trigger,'first');
    assert.equal(map.get('pr_bit_first_extract'),'1');
    const empty=raid();empty.bag={};extractRound(empty,10000);assert.equal(resultView(empty).reaction.trigger,'empty');
    const close=raid();close.bag={cable:2};close.health=1;extractRound(close,10000);assert.equal(resultView(close).reaction.trigger,'close');
  }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
