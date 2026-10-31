import {holdExit} from './exit-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {createRound,enterExit,activateNode,extractRound} from '../round.js';
import {createPerkUI} from '../perk-ui.js';
import {perkState,offer,choosePerk,autoPickPerks,pausePick,resumePick,gameTime,cards} from '../perks.js';

for(const minimized of [false,true])test(`pending ${minimized?'minimized':'unopened'} perks auto-pick through every exit`,()=>{
  const r=createRound('auto-exit',0);
  for(let level=1;level<=3;level++){
    for(const n of r.level.nodes)activateNode(r,n.id,level*100);
    const s=perkState(r),keys=[`${level}:0`,`${level}:1`];
    for(const [index,key] of keys.entries())s.rooms[key]={state:'clearPending',level,index};
    s.queue=[...keys];const expected=offer(r,keys[0])[0];
    if(minimized)s.minimized=keys[0];
    if(level===3)holdExit(r,{x:-999,z:-999},level*100);
    assert.equal(holdExit(r,r.level.exit,level*100),level===3?'complete':'next');
    assert.ok(s.events.some(e=>e.room===keys[0]&&e.text===`Auto-picked: ${cards.find(c=>c.id===expected).name}`));
    assert.ok(keys.every(key=>s.rooms[key].state==='rewarded'));
    assert.equal(s.queue.length,0);
    assert.equal(s.events.filter(e=>keys.includes(e.room)&&e.text?.startsWith('Auto-picked:')).length,2);
  }
  assert.equal(r.over,true);assert.equal(r.reason,'complete');
});

test('exhausted perk pool cannot block an exit',()=>{
  const r=createRound('exhausted',0),s=perkState(r);s.taken=cards.map(c=>c.id);
  s.queue=['1:0'];s.rooms['1:0']={state:'clearPending',level:1,index:0};
  for(const n of r.level.nodes)activateNode(r,n.id,100);
  assert.equal(holdExit(r,r.level.exit,100),'next');assert.equal(s.queue.length,0);
});

test('explicit extraction also resolves pending choices and secures loot',()=>{
  const r=createRound('explicit-extract',0),s=perkState(r);r.levelsCleared=1;r.bag.cable=1;
  s.queue=['1:0'];s.rooms['1:0']={state:'clearPending',level:1,index:0};s.minimized='1:0';
  const expected=offer(r,'1:0')[0];assert.equal(extractRound(r,100),true);
  assert.equal(r.extracted.cable,1);assert.ok(r.raidPerksTaken.includes(expected));assert.equal(s.queue.length,0);
});

const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
const handlers=source.slice(source.indexOf('function openPerk('),source.indexOf("for(const type of ['pointerdown'"));
for(const mode of ['timeout','escape','manual','minimize'])test(`production ${mode} handler resolves once, restores gameplay and clears timer`,async()=>{
  const dom=new JSDOM('<main><div id="encounter-hint"></div><div id="inventory"></div><div id="level-corner"></div></main>');globalThis.document=dom.window.document;
  let ui;
  try{
    const r=createRound(`handler-${mode}`,0),s=perkState(r),key='1:0';s.queue=[key];s.rooms[key]={state:'clearPending',level:1,index:0};
    let wall=1000;const notices=[],noop=()=>{};
    const context=vm.createContext({round:r,perkKey:null,perkChoosing:false,perkResume:{hidden:true},
      lootReadoutVisible:()=>false,clearInput:noop,cancelToolDrag:noop,hideSwap:noop,updateHUD:noop,notice:t=>notices.push(t),
      perkState,pausePick,resumePick,choosePerk,autoPickPerks,dash:{readyAt:9000},Date:{now:()=>wall},
      gameClock:()=>gameTime(r,wall),$:sel=>document.querySelector(sel)});
    ui=createPerkUI(document.querySelector('main'),(...args)=>context.act(...args));context.perkUI=ui;
    vm.runInContext(handlers,context);context.openPerk(key);const expected=offer(r,key)[0];
    assert.notEqual(r.pauseAt,null);
    if(mode==='timeout'){wall=5000;await new Promise(resolve=>setTimeout(resolve,4100));}
    else if(mode==='escape')ui.layer.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    else if(mode==='minimize')context.act('minimize');
    else {await new Promise(resolve=>setTimeout(resolve,650));document.querySelector('.perk-choice').click();}
    assert.equal(ui.layer.hidden,true);assert.equal(r.pauseAt,null);assert.equal(s.queue.length,0);assert.deepEqual(s.taken,[expected]);
    context.act('timeout');assert.deepEqual(s.taken,[expected],'stale timeout cannot pick twice');
    assert.equal(notices.length,mode==='manual'?0:1);
    // Closing/reopening must cancel the previous offer deadline.
    const next='1:1';s.queue=[next];s.rooms[next]={state:'clearPending',level:1,index:1};context.openPerk(next);ui.close();
    await new Promise(resolve=>setTimeout(resolve,4100));assert.deepEqual(s.queue,[next]);
  }finally{ui?.close();delete globalThis.document;dom.window.close();}
});
