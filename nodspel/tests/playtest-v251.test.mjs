import {inputPaused} from '../perks.js?v=2.18.1';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRound,useHealthKit,healthKitBlock} from '../round.js';
import {createWeapon,fireAimedWeapon,stepWeapon} from '../weapon.js';
import {RULES,generateLevel,setQuestLoot} from '../levels.js';
import {JSDOM} from 'jsdom';
import {createFireInputGate,bindHUDTap,stickOffset,finishGesture} from '../controls.js';

function arena(){const r=createRound('impact',0);Object.assign(r.level,{enemies:[{id:'target',kind:'enemy',type:'grunt',x:5,z:0,r:.48,health:1,active:true}],nodes:[]});return r;}
test('assisted lethal shot travels before damage, death and removal at impact',()=>{
  const r=arena(),w=createWeapon(),target=r.level.enemies[0];
  const shot=fireAimedWeapon(w,r,{x:0,z:0},{x:1,z:0},0,[]);
  assert.equal(target.health,1);assert.equal(r.enemiesDefeated,0);assert.ok(w.projectiles.includes(shot));
  stepWeapon(w,r,10,.01,[]);assert.equal(target.health,1);assert.ok(shot.x>0&&shot.x<target.x);
  stepWeapon(w,r,500,.5,[]);assert.equal(target.health,0);assert.equal(r.enemiesDefeated,1);assert.equal(w.projectiles.length,0);
});
test('target can leave the assisted launch path before projectile arrives',()=>{
  const r=arena(),w=createWeapon();fireAimedWeapon(w,r,{x:0,z:0},{x:1,z:0},0,[]);
  r.level.enemies[0].z=4;stepWeapon(w,r,1000,1,[]);
  assert.equal(r.level.enemies[0].health,1);assert.equal(r.enemiesDefeated,0);
});
test('modal-owned pointer release is swallowed after close; a fresh press works',()=>{
  const gate=createFireInputGate(),event=type=>({type,pointerId:7});
  assert.equal(gate.handle(event('pointerdown'),true),true);
  assert.equal(gate.handle(event('pointerup'),false),true);
  assert.equal(gate.handle(event('pointerdown'),false),false);
  assert.equal(gate.handle(event('pointerup'),false),false);
  assert.equal(gate.handle(event('pointerup'),true),true);
});
test('HUD tap heals within the remaining budget and exhausted taps give feedback without spending a kit',()=>{
  const source=fs.readFileSync(new URL('../game.mjs',import.meta.url),'utf8'),r=createRound('kit-tap',0);
  r.health=40;r.kit={medkit:2};r.stakes.healed=r.stakes.budget-5;
  let feedback='',updates=0;
  const button={querySelector:()=>({}),setAttribute(){},classList:{toggle(){}}};
  const ctx={inputPaused,round:r,resultPending:false,gameClock:()=>0,useHealthKit,healthKitBlock,notice:s=>feedback=s,updateHUD:()=>updates++,refreshKitLabels(){},$:()=>button};
  vm.createContext(ctx);
  vm.runInContext(source.match(/function useKit\(\)\{[^\n]+/)[0]+'\n'+source.match(/function renderKitHUD\(\)\{[^\n]+/)[0],ctx);
  vm.runInContext('renderKitHUD();useKit()',ctx);assert.equal(button.disabled,false);assert.equal(r.health,45);assert.equal(r.kit.medkit,1);assert.equal(updates,1);
  vm.runInContext('renderKitHUD();useKit()',ctx);assert.equal(button.disabled,false);assert.match(feedback,/budget spent/);assert.equal(r.kit.medkit,1);
  assert.match(source,/bindHUDTap\(\$\('#use-kit'\),\(\)=>useKit\(\)\)/);
});
test('active Transmitter supply has a visible guaranteed Archipelago radio crate across seeds',()=>{
  setQuestLoot({item:'transmitter',level:1});
  try{for(let seed=0;seed<100;seed++){
    const l=generateLevel(1,'radio-'+seed,'archipelago'),b=l.lootBoxes.find(b=>b.item==='transmitter');
    assert.ok(b);assert.equal(b.source,'Radio crate');assert.equal(b.revealed,true);assert.equal(b.marked,true);
    assert.ok(!generateLevel(1,'radio-'+seed,'bunker').lootBoxes.some(b=>b.item==='transmitter'));
  }}finally{setQuestLoot(null);}
  assert.ok(!generateLevel(1,'inactive-radio','archipelago').lootBoxes.some(b=>b.item==='transmitter'));
});

test('held aim gesture is cleared on modal entry and its release cannot fire after close',()=>{
  const source=fs.readFileSync(new URL('../game.mjs',import.meta.url),'utf8'),handlers={},state={shots:0},thumb={style:{},getBoundingClientRect:()=>({width:36})};
  const el={style:{setProperty(){}},querySelector:()=>thumb,classList:{add(){},remove(){},toggle(){}},getBoundingClientRect:()=>({left:0,top:0,right:844,bottom:390,width:100}),addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(id){handlers.lostpointercapture({pointerId:id,type:'lostpointercapture'});}};
  const ctx={viewport:{getBoundingClientRect:()=>({left:0,top:0,right:844,bottom:390})},inputPaused,stickOffset,finishGesture,document:{addEventListener(){}},sticks:[],round:{pauseAt:null,over:false},tutorialOpen:false,$:selector=>selector==='#inventory'?{hidden:true}:el,keys:new Set(['Space']),mouseDown:true,screenToWorld:(x,y)=>({x,z:y}),beginAim:(x,y)=>({origin:{x,y},direction:null,target:{x:1,y:0}}),dragAim:(g,x,y)=>g.direction={x:x-g.origin.x,y:y-g.origin.y},releaseAim:(g,cancelled)=>cancelled?null:g.direction,aim:null,shot:()=>state.shots++,
    RULES:{aimControls:{deadZonePx:20,stickRadiusPx:48}},TAP_MS:200,performance:{now:()=>0},setTimeout:fn=>fn(),tapAimDirection:()=>({x:0,z:-1})};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function setupStick('),source.indexOf("setupStick('#move-stick'"))+'\n'+source.match(/function clearInput\(\)\{[^\n]+/)[0]+"\nsetupStick('#aim-stick',{},shot)",ctx);
  const event=type=>({type,pointerId:9,clientX:70,clientY:50,preventDefault(){}});
  handlers.pointerdown(event('pointerdown'));handlers.pointermove({...event('pointermove'),clientX:90});
  ctx.round.pauseAt=100;vm.runInContext('clearInput()',ctx);
  assert.equal(ctx.sticks[0].state.pointer,null);assert.equal(ctx.sticks[0].state.gesture,null);assert.equal(ctx.mouseDown,false);assert.equal(ctx.keys.size,0);
  handlers.pointerdown(event('pointerdown'));assert.equal(ctx.sticks[0].state.pointer,null,'aim press blocked while modal open');
  ctx.round.pauseAt=null;vm.runInContext('clearInput()',ctx);handlers.pointerup(event('pointerup'));assert.equal(state.shots,0);
  handlers.pointerdown(event('pointerdown'));handlers.pointermove({...event('pointermove'),clientX:90});handlers.pointerup({...event('pointerup'),clientX:90});assert.equal(state.shots,1,'fresh aim gesture still fires');
});

test('full-budget touch HUD pointer tap heals at 40 HP, spends one kit and reports success',()=>{
  const source=fs.readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  const dom=new JSDOM('<button id="use-kit"><b>2</b></button>');
  const button=dom.window.document.querySelector('button'),r=createRound('touch-kit',0);
  r.health=40;r.kit={medkit:2};r.stakes.healed=0;
  let feedback='',updates=0;
  const ctx={inputPaused,round:r,resultPending:false,gameClock:()=>0,useHealthKit,healthKitBlock,
    notice:s=>feedback=s,updateHUD:()=>updates++,bindHUDTap,$:()=>button};
  vm.createContext(ctx);
  vm.runInContext(source.match(/function useKit\(\)\{[^\n]+/)[0]+'\n'+source.match(/bindHUDTap\(\$\('#use-kit'\),\(\)=>useKit\(\)\);/)[0],ctx);
  function pointer(type){const e=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:7,pointerType:'touch',button:0});button.dispatchEvent(e);}
  pointer('pointerdown');pointer('pointerup');
  assert.equal(r.health,Math.min(r.maxHealth??100,40+RULES.rewards.medkitHealth,r.stakes.budget+40));assert.equal(r.kit.medkit,1);assert.equal(updates,1);assert.match(feedback,/Medkit: \+\d+ HP/);
  button.dispatchEvent(new dom.window.MouseEvent('click',{detail:1,bubbles:true}));
  assert.equal(r.kit.medkit,1,'compatibility click cannot spend another kit');
  r.health=r.maxHealth??100;pointer('pointerdown');pointer('pointerup');
  assert.equal(feedback,'Health full');assert.equal(r.kit.medkit,1);
  r.health=40;pointer('pointerdown');pointer('pointercancel');pointer('pointerup');
  assert.equal(r.kit.medkit,1,'cancelled gesture does not heal');
  button.dispatchEvent(new dom.window.MouseEvent('click',{detail:0,bubbles:true}));
  assert.equal(r.kit.medkit,0,'keyboard activation still works');
  r.stakes.healed=0;pointer('pointerdown');pointer('pointerup');assert.equal(feedback,'No medkits carried');
  dom.window.close();
});
