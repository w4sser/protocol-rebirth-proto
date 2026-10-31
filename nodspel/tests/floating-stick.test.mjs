// Floating stick gesture logic (docs/design-combat-feel-oct28.md §2.2a, PR-A acceptance): exercises the real
// setupStick() from game.mjs (brace-matched extraction, same technique as perk-exit.test.mjs) in a jsdom
// sandbox with synthetic pointer events, instead of re-implementing the gesture rules in parallel (which could
// silently drift from the shipped behaviour).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {beginAim,dragAim,releaseAim,stickOffset,finishGesture} from '../controls.js?v=2.16.1';
import {RULES} from '../levels.js?v=2.16.1';

const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
function extractFn(name){
  const start=source.indexOf(`function ${name}(`);
  if(start<0)throw new Error(`function ${name} not found in game.mjs`);
  let i=source.indexOf('{',start),depth=0;
  for(;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){depth--;if(depth===0)return source.slice(start,i+1);}
  }
  throw new Error(`unbalanced braces extracting ${name}`);
}
const setupStickSrc=extractFn('setupStick');

function buildStick(mode='aim'){
  const dom=new JSDOM('<canvas id=world></canvas><button id=dash>DASH</button><div id="aim-stick"><div class="stick-base"><div class="thumb"></div></div></div>');
  const el=dom.window.document.getElementById('aim-stick');el.id=`${mode}-stick`;
  el.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:60,width:100,height:60});
  el.setPointerCapture=()=>{};el.hasPointerCapture=()=>false;el.releasePointerCapture=()=>{};
  let wall=0,shots=0,lastAim=null,lastTap=null;
  const value={x:0,y:0},context=vm.createContext({
    $:sel=>sel==='#inventory'?{hidden:true}:sel==='.hud'?{getBoundingClientRect:()=>({bottom:40})}:el,RULES,
    beginAim,dragAim,releaseAim,stickOffset,finishGesture,inputPaused:()=>false,document:dom.window.document,viewport:{getBoundingClientRect:()=>({left:0,top:0,right:844,bottom:390,width:844})},
    screenToWorld:(x,y)=>({x,z:y}),
    round:{over:false,pauseAt:null},tutorialOpen:false,sticks:[],value,aim:null,
    fire:tap=>{shots++;lastAim={...context.aim};lastTap=tap;},
    performance:{now:()=>wall},
    setTimeout:fn=>fn(),
  });
  vm.runInContext(setupStickSrc+`\nsetupStick('#${mode}-stick',value${mode==='aim'?',fire':''});`,context);
  const fireEvent=(type,props)=>{const e=new dom.window.Event(type,{bubbles:true});Object.assign(e,{pointerId:1,clientX:0,clientY:0},props);el.dispatchEvent(e);return e;};
  return {el,context,value,dom,shots:()=>shots,lastAim:()=>lastAim,lastTap:()=>lastTap,setWall:w=>wall=w,fireEvent,
    base:el.querySelector('.stick-base'),thumb:el.querySelector('.thumb')};
}

test('tap (release inside the deadzone, under 200 ms) requests a tap shot',()=>{
  const s=buildStick();s.setWall(0);
  s.fireEvent('pointerdown',{clientX:100,clientY:100});
  s.setWall(120); // well under the 200 ms tap window
  s.fireEvent('pointerup',{clientX:104,clientY:98}); // inside the 20 px deadzone
  assert.equal(s.lastTap(),true);assert.equal(s.shots(),1);assert.equal(s.context.aim,null,'target direction is chosen at fire time, not gesture release');
});
test('a long press that never leaves the deadzone is not a tap and does not fire',()=>{
  const s=buildStick();s.setWall(0);
  s.fireEvent('pointerdown',{clientX:100,clientY:100});
  s.setWall(260); // past the 200 ms tap window
  s.fireEvent('pointerup',{clientX:100,clientY:100});
  assert.equal(s.shots(),0,'release without ever dragging, after the tap window, cancels');
});
test('drag past the deadzone and release fires the dragged direction (screen -> world)',()=>{
  const s=buildStick();s.setWall(0);
  s.fireEvent('pointerdown',{clientX:100,clientY:100});
  s.fireEvent('pointermove',{clientX:160,clientY:100}); // 60 px right, past the deadzone
  s.setWall(50);
  s.fireEvent('pointerup',{clientX:160,clientY:100});
  assert.equal(s.lastTap(),false);assert.equal(s.shots(),1);assert.deepEqual(s.lastAim(),{x:1,z:0});
});
test('dragging back into the deadzone and releasing cancels (Brawl Stars behaviour)',()=>{
  const s=buildStick();s.setWall(0);
  s.fireEvent('pointerdown',{clientX:100,clientY:100});
  s.fireEvent('pointermove',{clientX:160,clientY:100});
  s.fireEvent('pointermove',{clientX:104,clientY:100}); // back inside the deadzone
  s.setWall(50);
  s.fireEvent('pointerup',{clientX:104,clientY:100});
  assert.equal(s.shots(),0,'a stale latched direction must not fire once the thumb is back in the deadzone');
});
test('pointercancel always cancels, even mid-drag',()=>{
  const s=buildStick();s.setWall(0);
  s.fireEvent('pointerdown',{clientX:100,clientY:100});
  s.fireEvent('pointermove',{clientX:160,clientY:100});
  s.fireEvent('pointercancel',{clientX:160,clientY:100});
  assert.equal(s.shots(),0);
});
test('the same drag from two different landing points gives an identical direction and an identical visual thumb offset',()=>{
  const deltas=[[60,0],[0,-40],[-30,40]],origins=[{x:100,y:100},{x:260,y:40}];
  const results=origins.map(origin=>{
    const s=buildStick();s.setWall(0);
    s.fireEvent('pointerdown',{clientX:origin.x,clientY:origin.y});
    const baseLeft=s.base.style.left,baseTop=s.base.style.top;
    const offsets=[];
    for(const [dx,dy] of deltas){s.fireEvent('pointermove',{clientX:origin.x+dx,clientY:origin.y+dy});offsets.push(s.thumb.style.transform);}
    s.setWall(50);s.fireEvent('pointerup',{clientX:origin.x+deltas.at(-1)[0],clientY:origin.y+deltas.at(-1)[1]});
    return {baseLeft,baseTop,offsets,aim:s.lastAim()};
  });
  // These horizontal origins need no clamp; vertical clamping never changes the input offset.
  assert.equal(results[0].baseLeft,`${origins[0].x}px`);assert.equal(results[1].baseLeft,`${origins[1].x}px`);
  // the same relative drag produces the identical visual thumb offset regardless of where the gesture started
  assert.deepEqual(results[0].offsets,results[1].offsets);
  // ... and the identical fired (world) direction
  assert.deepEqual(results[0].aim,results[1].aim);
});

test('open playfield touches use the floating right zone and never intercept buttons',()=>{
  const s=buildStick();
  function down(target,x,y){const e=new s.dom.window.Event('pointerdown',{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',clientX:x,clientY:y});target.dispatchEvent(e);return e;}
  const canvas=s.dom.window.document.getElementById('world');
  assert.equal(down(canvas,300,180).defaultPrevented,false,'left half is not aim zone');
  assert.equal(down(canvas,700,30).defaultPrevented,false,'HUD row is excluded');
  assert.equal(down(s.dom.window.document.getElementById('dash'),700,180).defaultPrevented,false,'action buttons keep their events');
  assert.equal(down(canvas,700,180).defaultPrevented,true,'right playfield starts floating aim');
  s.setWall(80);s.fireEvent('pointerup',{clientX:700,clientY:180});assert.equal(s.shots(),1);
});

test('floating visual origin accounts for the stick border',()=>{
  const s=buildStick();Object.defineProperty(s.el,'clientLeft',{value:1});Object.defineProperty(s.el,'clientTop',{value:1});
  s.fireEvent('pointerdown',{clientX:100,clientY:100});
  assert.equal(parseFloat(s.base.style.left)+s.el.clientLeft,100);
  assert.equal(parseFloat(s.base.style.top)+s.el.clientTop,100);
});

for(const origin of [{x:1,y:2},{x:843,y:389},{x:50,y:55}])test(`floating base stays inside safe area below HUD at ${origin.x},${origin.y}`,()=>{
  const s=buildStick();
  s.context.viewport.getBoundingClientRect=()=>({left:12,top:8,right:832,bottom:382,width:820});
  const hud=s.dom.window.document.createElement('div');hud.className='hud';
  hud.getBoundingClientRect=()=>({bottom:60});
  s.dom.window.document.body.append(hud);
  const lookup=s.context.$;s.context.$=sel=>sel==='.hud'?hud:lookup(sel);
  s.thumb.getBoundingClientRect=()=>({width:36,height:36});
  s.fireEvent('pointerdown',{clientX:origin.x,clientY:origin.y});
  const x=parseFloat(s.base.style.left),y=parseFloat(s.base.style.top),margin=48+18;
  assert.ok(x-margin>=12&&x+margin<=832);
  assert.ok(y-margin>=60&&y+margin<=382);
  assert.equal(s.context.sticks[0].state.origin.x,origin.x);
  assert.equal(s.context.sticks[0].state.origin.y,origin.y);
  s.fireEvent('pointermove',{clientX:origin.x+30,clientY:origin.y+40});
  assert.ok(Math.abs(s.value.x-.6)<1e-12);assert.ok(Math.abs(s.value.y-.8)<1e-12);
  assert.equal(s.thumb.style.transform,`translate(calc(-50% + ${30*(48/50)}px),calc(-50% + ${40*(48/50)}px))`);
  assert.equal(parseFloat(s.base.style.left),x);assert.equal(parseFloat(s.base.style.top),y);
});

// DASH uses safe-viewport coordinates: left 148, bottom (controls 35 + button 110), size 62.
for(const [width,height] of [[844,390],[932,430],[667,375]])for(const mode of ['move','aim'])test(`${mode} zone excludes DASH and its clearance at ${width}x${height}`,()=>{
  const s=buildStick(mode),doc=s.dom.window.document;
  const safe={left:47,top:0,right:width-47,bottom:height-21,width:width-94};
  s.context.viewport.getBoundingClientRect=()=>safe;
  const dash=doc.getElementById('dash'),left=safe.left+148,top=safe.bottom-35-110-62;
  dash.getBoundingClientRect=()=>({left,right:left+62,top,bottom:top+62});
  const canvas=doc.getElementById('world');
  const down=(x,y)=>{const e=new s.dom.window.Event('pointerdown',{bubbles:true,cancelable:true});Object.assign(e,{pointerId:2,pointerType:'touch',clientX:x,clientY:y});canvas.dispatchEvent(e);return e.defaultPrevented;};
  assert.equal(down(left+31,top+31),false,'DASH rectangle is never a floating-stick origin');
  assert.equal(down(left-6,top+31),false,'gap beside DASH is excluded too');
  assert.equal(s.context.sticks[0].state.pointer,null);
  assert.equal(down(mode==='move'?safe.left+50:safe.right-50,safe.bottom-60),true,'open playfield still activates its stick');
});
