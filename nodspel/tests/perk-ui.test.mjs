import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {createPerkUI} from '../perk-ui.js';
import {createRound,takeDamage} from '../round.js';
import {perkState,choosePerk,offer,reconLootVisible,hasPerk,lastCombatFeedback,logCombat} from '../perks.js';
import {resultView,renderResult} from '../result-screen.js';

test('picker renders only three SVG option cards and a countdown and routes select actions',async()=>{
  const dom=new JSDOM('<main id="viewport"><header><button>Bag</button></header><div id="preserved"></div></main><aside></aside>');globalThis.document=dom.window.document;
  try{
    const r=createRound('picker-ui',0),s=perkState(r),key='1:0';s.rooms[key]={state:'clearPending',level:1,index:0};s.queue=[key];
    logCombat(r,{kind:'damage',source:'Turret',sourceId:'turret-1',attack:'fan',amount:18,moving:false});
    document.querySelector('header').inert=false;document.querySelector('#preserved').inert=true;
    const actions=[],ui=createPerkUI(document.querySelector('main'),(...args)=>actions.push(args));ui.open(r,key);
    const panel=document.querySelector('[role=dialog]'),buttons=[...panel.querySelectorAll('.perk-choice')];
    assert.ok(panel.classList.contains('pop-card'));assert.equal(panel.querySelector('.pop-x,h2,.perk-sub,.perk-recap,.perk-confirm'),null);assert.ok(panel.querySelector('.perk-countdown-bar'));assert.equal(buttons.length,3);assert.equal(new Set(buttons.map(b=>b.querySelector('strong').textContent)).size,3);
    for(const b of buttons){assert.ok(b.querySelector('svg path').getAttribute('d').length>20);assert.ok(b.querySelector('.perk-effect').textContent.length>20);assert.equal(b.type,'button');}
    assert.equal(document.querySelector('header').inert,true);assert.ok(document.querySelector('main').classList.contains('perk-modal-open'));
    // Input lock: cards open disabled (a thumb already down on the joystick must not select one) and the
    // panel holds focus until the ~0.6s lock lifts.
    assert.ok(panel.classList.contains('locked'));assert.ok(buttons.every(b=>b.disabled));assert.equal(document.activeElement,panel);
    buttons[1].click();assert.equal(actions.length,0,'a click during the lock is ignored');
    await new Promise(res=>setTimeout(res,650));
    assert.ok(!panel.classList.contains('locked'));assert.ok(buttons.every(b=>!b.disabled));assert.equal(document.activeElement,buttons[0]);
    buttons[1].click();assert.equal(actions[0][0],'choose');const id=s.rooms[key].offer[1],text=choosePerk(r,key,id,100);ui.confirm(text,buttons[1]);assert.ok(buttons.every(b=>b.disabled));assert.ok(buttons[1].classList.contains('picked'));
    ui.hud(r,document.querySelector('aside'));assert.equal(document.querySelectorAll('.perk-hud svg').length,1);assert.ok(document.querySelector('.perk-hud [aria-label]'));
    ui.close();assert.equal(ui.layer.hidden,true);assert.equal(document.querySelector('header').inert,false);assert.equal(document.querySelector('#preserved').inert,true);assert.equal(document.querySelector('main').classList.contains('perk-modal-open'),false);
    ui.open(r,key);assert.equal(document.querySelector('header').inert,true);ui.close();assert.equal(document.querySelector('header').inert,false);
    const css=fs.readFileSync(new URL('../perks.css',import.meta.url),'utf8');assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);assert.match(css,/min-height:44px/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/--ad-primary/);
  }finally{delete globalThis.document;dom.window.close();}
});
test('held pointer and keyboard gestures cannot outlast the lock; a fresh press selects',async()=>{
  const dom=new JSDOM('<main></main>');globalThis.document=dom.window.document;
  try{
    const r=createRound('lock-gestures',0),s=perkState(r),key='1:0';s.rooms[key]={state:'clearPending',level:1,index:0};s.queue=[key];
    const actions=[],ui=createPerkUI(document.querySelector('main'),(...args)=>actions.push(args));ui.open(r,key);
    const button=document.querySelector('.perk-choice');
    const pointer=()=>button.dispatchEvent(new dom.window.MouseEvent('pointerdown',{bubbles:true}));
    const click=()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,detail:1}));
    pointer();click();
    const press=new dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});button.dispatchEvent(press);assert.equal(press.defaultPrevented,true);
    await new Promise(res=>setTimeout(res,650));
    click();assert.equal(actions.length,0,'a press started while locked remains rejected');
    const release=new dom.window.KeyboardEvent('keyup',{key:' ',bubbles:true,cancelable:true});button.dispatchEvent(release);assert.equal(release.defaultPrevented,true);
    pointer();click();assert.equal(actions.length,1,'fresh pointer selects after unlock');
    // Reopening resets the gesture token even if the pointer is still down.
    pointer();ui.open(r,key);await new Promise(res=>setTimeout(res,650));
    document.querySelector('.perk-choice').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,detail:1}));assert.equal(actions.length,1);
    ui.close();
  }finally{delete globalThis.document;dom.window.close();}
});
test('recon reveals existing uncollected boxes in cleared main rooms, terminal variant reveals the level',()=>{
  const r=createRound('recon',0),s=perkState(r);s.taken=['recon'];const room=r.level.rooms[0],box={x:room.x,z:room.z,item:'cable',collected:false};
  assert.equal(reconLootVisible(r,box),false);s.rooms['1:0']={state:'clearPending'};assert.equal(reconLootVisible(r,box),true);box.collected=true;assert.equal(reconLootVisible(r,box),false);
  box.collected=false;s.terminalCards=['recon'];assert.equal(hasPerk(r,'recon'),false);assert.equal(reconLootVisible(r,box),false);s.revealAll=true;assert.equal(reconLootVisible(r,box),true);assert.equal(box.item,'cable');
});
test('rendered death result contains the true last source and movement; shot feedback stays observational',()=>{
  const dom=new JSDOM(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));globalThis.document=dom.window.document;
  try{const r=createRound('death-ui',0);logCombat(r,{kind:'shot',shotId:9,moving:true,rejections:[{reason:'angle'}]});logCombat(r,{kind:'outcome',shotId:9,moving:true,outcome:'miss'});r.lastHit={source:'Rusher',enemyId:'rusher-3',attack:'projectile'};r.playerMoving=true;takeDamage(r,1000,100);
    const feedback=lastCombatFeedback(r);assert.match(feedback,/Moving.*miss.*angle/);assert.doesNotMatch(feedback,/because/);
    renderResult(document.querySelector('#round-over'),resultView(r));const cause=document.querySelector('#result-death-cause');assert.match(cause.textContent,/Last hit: Rusher.*projectile.*moving/);assert.equal(cause.hidden,false);
    r.reason='timeout';renderResult(document.querySelector('#round-over'),resultView(r));assert.equal(cause.hidden,true);assert.equal(cause.textContent,'');
  }finally{delete globalThis.document;dom.window.close();}
});
test('minimized offers remain identical and terminal rolling never grants a regular cooldown stack',()=>{
  const r=createRound('terminal-ui',0);r.level.number=3;const s=perkState(r),key=`3:${r.level.rooms.length-1}`;s.rooms[key]={state:'clearPending',level:3,index:r.level.rooms.length-1};s.queue=[key];
  const ids=offer(r,key);s.minimized=key;assert.deepEqual(offer(r,key),ids);
  s.rooms[key].offer=['roll'];assert.ok(choosePerk(r,key,'roll',100,{readyAt:9000}));assert.equal(hasPerk(r,'roll'),false);assert.deepEqual(s.taken,['roll']);assert.match(s.selectedEffects.roll,/Reset dash now/);
});

test('choice countdown waits for unlocked cards and their first paint; stale paint callbacks cannot restart it',async()=>{
  const dom=new JSDOM('<main></main>');globalThis.document=dom.window.document;
  const frames=[];dom.window.requestAnimationFrame=fn=>frames.push(fn);
  try{
    const r=createRound('paint-budget',0),s=perkState(r),key='1:0';s.rooms[key]={state:'clearPending',level:1,index:0};s.queue=[key];
    const ui=createPerkUI(document.querySelector('main'),()=>{});ui.open(r,key);
    const bar=document.querySelector('.perk-countdown-bar');
    assert.equal(bar.style.animation,'none');
    await new Promise(resolve=>setTimeout(resolve,650));
    assert.equal(document.querySelector('.perk-choice').disabled,false);
    assert.equal(bar.style.animation,'none','layout time must not consume the choice budget');
    frames.shift()();assert.equal(bar.style.animation,'none');
    frames.shift()();assert.match(bar.style.animation,/4000ms/);
    ui.close();ui.open(r,key);await new Promise(resolve=>setTimeout(resolve,650));
    frames.shift()();ui.close();frames.shift()();
    assert.equal(bar.style.animation,'none','closed picker must not start a stale countdown');
  }finally{delete globalThis.document;dom.window.close();}
});
