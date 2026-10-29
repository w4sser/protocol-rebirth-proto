// v2.4 (Robert's playtest): a visible enemy must always keep at least its compact health bar — decluttering
// (overlap with another label, or a nearby shock-pad icon) may thin the caption down to the bar, but must
// never hide the whole badge the way the old code did. Exercises the actual rendering path (renderLabels),
// not just planLabels(), since the regression lived in the post-plan declutter/hazard passes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import {planLabels,resolveLabels,overHUD,labelOpacity,labelPriority,placeEnemyLabel,FIXED_LABEL_KINDS,settleLabelY} from '../labels.js';

const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
// Brace-matched extraction (unlike a "stop at the next `function `" slice) so trailing top-level
// statements between functions can never leak into the executed source.
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

class ClassList{
  constructor(){this.set=new Set();}
  contains(c){return this.set.has(c);}
  toggle(c,v){const want=v===undefined?!this.set.has(c):v;if(want)this.set.add(c);else this.set.delete(c);return want;}
}
class El{
  constructor(){this.classList=new ClassList();this.dataset={};this.style={};this.hidden=true;}
  get offsetWidth(){return this.measured?(parseFloat(this.style.width)||(this.dataset.mode==='bar'?44:100)):0;}
  get offsetHeight(){return 0;}
  // Fractional, untransformed content width per mode (set as {full:104.4,bar:44,...}); falls back to the
  // default integer offsetWidth guess for elements that don't care about sub-pixel wrap behaviour.
  get naturalWidth(){const w=this.layoutWidth;return w&&w[this.dataset.mode]!=null?w[this.dataset.mode]:this.offsetWidth;}
  dyFor(mode){const d=this.dy;return d&&typeof d==='object'?(d[mode]??0):(d??0);}
  getBoundingClientRect(){
    if(!this.measured)return {width:0,height:0,left:0,right:0,top:0,bottom:0};
    const scale=this.classList.contains('winding')?1.12:1;
    const natural=this.naturalWidth,pinned=this.style.width?parseFloat(this.style.width):natural;
    const wrapped=pinned<natural-1e-6; // a pinned width narrower than the content needs wraps an extra line
    const width=pinned*scale,height=(this.dataset.mode==='bar'?5:wrapped?67:30)*scale;
    const left=parseFloat(this.style.left)-width/2+(this.origin?.left??0),bottom=parseFloat(this.style.top)+(this.origin?.top??0)+this.dyFor(this.dataset.mode);
    return {width,height,left,right:left+width,top:bottom-height,bottom};
  }
}
const enemyLabel=(id,x,z)=>({id,range:'enemy',point:{x,z},el:new El(),defeated:false,obscured:false,size:null,enemy:{}});
const lootLabel=(id,x,z)=>({id,range:'loot',point:{x,z},el:new El(),defeated:false,obscured:false,size:null});
const hazardEntry=(x,z)=>({hazard:{x,z},label:{id:`hz-${x}-${z}`,el:new El()}}); // label.el stays hidden: its own visibility is irrelevant here

function run(labels,hazardLabels,{hud=[],width=800,height=600,origin={left:0,top:0},camera=null,hudElements=null,now=0}={}){
  for(const l of labels)l.el.origin=origin;
  const context=vm.createContext({
    labels,hazardLabels,position:{x:0,z:0},viewWidth:width,viewHeight:height,
    $:()=>({getBoundingClientRect:()=>origin}),
    document:{querySelectorAll:selector=>hudElements.filter(e=>selector.split(',').includes(e.selector))},
    HUD_SELECTORS:source.match(/const HUD_SELECTORS=('[^']*');/)[1].slice(1,-1),
    bitLabel:null,bit:null,world:{exitLabel:null},exitIsOpen:()=>true,round:{},
    labelPoint:camera?new THREE.Vector3():{x:0,y:0,z:0,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;},project(){this.x=this.x/10;this.y=this.z/10;return this;}},
    camera:camera??{},hudRects:hud,performance:{now:()=>now},labelState:new Map(),
    planLabels,resolveLabels,overHUD,labelOpacity,labelPriority,placeEnemyLabel,FIXED_LABEL_KINDS,settleLabelY,
    // getComputedStyle: a real browser's width is the untransformed, fractional layout size (unlike
    // getBoundingClientRect, which includes any CSS transform scale) — mirrors the mock's naturalWidth.
    getComputedStyle:el=>({width:`${el.naturalWidth}px`,transform:'none'}),
    refreshHudRects(){},LABEL_SHOW_HOLD_MS:1200,
  });
  if(hudElements)vm.runInContext(extractFn('refreshHudRects'),context);
  vm.runInContext(extractFn('barOnly')+'\n'+extractFn('renderLabels'),context);
  vm.runInContext('renderLabels()',context);
}

test('an enemy that loses the overlap contest keeps its compact bar instead of disappearing',()=>{
  const e1=enemyLabel('e1',1,0),e2=enemyLabel('e2',1,0); // identical world point: guaranteed overlap on screen
  run([e1,e2],[]);
  assert.equal(e1.el.hidden,false,'the placed label stays fully visible');
  assert.equal(e2.el.hidden,false,'the decluttered enemy must not disappear entirely');
  assert.equal(e2.el.dataset.mode,'bar','decluttering thins the caption, not the health bar');
});

test('an enemy near a shock pad keeps its bar; the old behavior hid it outright',()=>{
  const e=enemyLabel('e',0,0);
  run([e],[hazardEntry(0,0)]);
  assert.equal(e.el.hidden,false,'still visible near the hazard icon');
  assert.equal(e.el.dataset.mode,'bar','caption drops so the lightning icon stays readable, bar remains');
});

test('non-enemy labels still fully hide when decluttered (fix is scoped to enemy health bars)',()=>{
  const a=lootLabel('a',1,0),b=lootLabel('b',1,0);
  run([a,b],[]);
  const hidden=[a,b].filter(l=>l.el.hidden);
  assert.equal(hidden.length,1,'exactly one of the two overlapping loot labels is decluttered away');
});

test('an enemy with room to spare (no overlap, no hazard) keeps its normal mode untouched',()=>{
  const e=enemyLabel('e',1,0);
  run([e],[]);
  assert.equal(e.el.hidden,false);
  assert.notEqual(e.el.dataset.mode,undefined);
});

const hits=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
// Centred-on-anchor check shared by the tests below: the bar's screen box must be centred horizontally on
// the enemy's projected head point (e.sx) and sit with its bottom a few px above it (e.sy) — never pushed
// sideways or away by HUD/other labels, which the old sticky-offset placement used to do (PRB drift fix).
function assertBarOnAnchor(e,origin={left:0,top:0}){
  const r=e.el.getBoundingClientRect();
  const local={left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top};
  const centerX=(local.left+local.right)/2;
  assert(Math.abs(centerX-e.sx)<=2,`bar centred on the projected head x (got ${centerX}, anchor ${e.sx})`);
  assert(local.bottom<e.sy,'bar bottom sits above the projected head y');
}
test('winding bars retain unscaled CSS widths and stay inside the viewport at its edges',()=>{
  for(const [width,height] of [[844,390],[932,430],[667,375]]){
    for(const x of [-9.9,9.9]){
      const enemies=Array.from({length:4},(_,i)=>enemyLabel(`winding-${i}`,x,0));
      for(const e of enemies){e.el.measured=true;e.el.classList.toggle('winding',true);}
      // Nearby hazards force compact bars even though winding requests captions.
      const hazards=[hazardEntry(x,0)];
      const origin={left:59,top:7};
      for(let frame=0;frame<3;frame++){
        run(enemies,hazards,{width,height,origin,now:frame*16});
        for(const e of enemies){
          assert.equal(e.el.hidden,false);
          assert.equal(e.el.dataset.mode,'bar');
          assert.equal(parseFloat(e.el.style.width),44,'CSS width excludes the windup transform');
          const r=e.el.getBoundingClientRect();
          assert.equal(r.width,44*1.12,'windup scaling is applied exactly once');
          // All four enemies share one world point right at the screen edge on purpose: their bars now
          // coincide too (a bar never dodges another label) and clamp to stay fully on-screen there.
          const local={left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top};
          assert(local.left>=2&&local.right<=width-2&&local.top>=2&&local.bottom<=height-2,'scaled bounds fit the viewport');
        }
      }
    }
  }
});
test('enemy bars stay centred on their own anchor even where they overlap the HUD',()=>{
  for(const [width,height] of [[844,390],[932,430],[667,375]]){
    const hud=[{left:width/2-150,right:width/2+150,top:0,bottom:85}];
    const enemies=Array.from({length:5},(_,i)=>enemyLabel(`e${i}`,0,8));
    for(const e of enemies){e.el.measured=true;e.el.dy=-12;}
    const origin={left:59,top:7};
    run(enemies,[],{hud,width,height,origin});
    for(const e of enemies){
      if(!e.el.hidden){assert.equal(e.el.dataset.mode,'bar');assertBarOnAnchor(e,origin);}else assert.equal(e.el.hidden,true,'a bar under the HUD hides rather than sliding away');
    }
  }
});

test('an attacking enemy caption collapses to its bar near an objective, staying put on its own anchor',()=>{
  const enemy=enemyLabel('enemy',0,0),objective=lootLabel('objective',0,0);objective.range='room';
  enemy.el.measured=objective.el.measured=true;enemy.el.classList.toggle('winding',true);
  run([enemy,objective],[]);
  assert.equal(objective.el.hidden,false,'objective keeps its label');
  assert.equal(enemy.el.hidden,false);assert.equal(enemy.el.dataset.mode,'bar');
  assertBarOnAnchor(enemy);
});

test('on-screen enemies near the screen edge keep a bar fully inside the viewport',()=>{
  for(const [x,z] of [[9.9,0],[-9.9,0],[0,9.9],[0,-9.9]]){
    const e=enemyLabel('edge',x,z);e.el.measured=true;
    run([e],[],{width:667,height:375});
    assert.equal(e.el.hidden,false);
    const r=e.el.getBoundingClientRect();
    assert(r.left>=2&&r.right<=665&&r.top>=2&&r.bottom<=373);
  }
});

function actualCamera(width,height){
  const camera=new THREE.OrthographicCamera(-6*width/height,6*width/height,6,-6,.1,100);
  camera.position.set(17,23,17);camera.lookAt(0,0,0);camera.updateMatrixWorld();return camera;
}
test('visible enemy with an offscreen raised anchor keeps its bar using the actual camera',()=>{
  for(const [width,height] of [[844,390],[932,430],[667,375]]){
    const camera=actualCamera(width,height);
    const centre=new THREE.Vector3(-5,.5,-5).project(camera);
    const anchor=new THREE.Vector3(-5,1.7,-5).project(camera);
    assert(centre.y<1&&centre.y>.87);assert(anchor.y>1);
    const e=enemyLabel('top',-5,-5);e.point.y=1.7;e.el.measured=true;
    run([e],[],{width,height,camera});
    assert.equal(e.el.hidden,false);
    const r=e.el.getBoundingClientRect();
    assert(r.left>=2&&r.right<=width-2&&r.top>=2&&r.bottom<=height-2);
  }
});
test('an offscreen model stays hidden even if its raised anchor is visible',()=>{
  const camera=actualCamera(844,390),e=enemyLabel('bottom',6.6,6.6);e.point.y=1.7;
  assert(new THREE.Vector3(6.6,.5,6.6).project(camera).y < -1);
  assert(new THREE.Vector3(6.6,1.7,6.6).project(camera).y > -1);
  run([e],[],{width:844,height:390,camera});
  assert.equal(e.el.hidden,true);
});
test('the separately measured quest chip no longer pushes enemy bars — they stay on their own anchor',()=>{
  const origin={left:59,top:7};
  const rects=[{selector:'.round-hud',left:300,right:500,top:0,bottom:45},
    {selector:'#quest-chip',left:270,right:530,top:50,bottom:100}];
  const hudElements=rects.map(r=>({...r,hidden:false,getClientRects:()=>[r],getBoundingClientRect:()=>({
    left:r.left+origin.left,right:r.right+origin.left,top:r.top+origin.top,bottom:r.bottom+origin.top})}));
  const enemies=[enemyLabel('chip',0,7.5),enemyLabel('hud',0,9)];
  for(const e of enemies)e.el.measured=true;
  run(enemies,[],{origin,hudElements});
  for(const e of enemies){
    if(!e.el.hidden){assert.equal(e.el.dataset.mode,'bar');assertBarOnAnchor(e,origin);}else assert.equal(e.el.hidden,true,'a bar under the HUD hides rather than sliding away');
  }
});

test('renderLabels keeps every enemy bar pinned to its own moving anchor past the HUD and quest chip',()=>{
  for(const [width,height] of [[844,390],[932,430],[667,375]]){
    const hud=[{left:width/2-140,right:width/2+140,top:0,bottom:45},
      {left:width/2-130,right:width/2+130,top:50,bottom:100}];
    const enemies=[enemyLabel('one',-.5,7.5),enemyLabel('two',.5,7.5)];
    for(const e of enemies){e.el.measured=true;e.el.dy=-12;}
    for(let frame=0;frame<65;frame++){
      for(const [i,e] of enemies.entries()){e.point.x=(i-.5)+Math.sin(frame/10)*.05;e.point.z=7.5+frame*.005;}
      run(enemies,[],{hud,width,height,now:frame*16});
      for(const e of enemies){
        if(!e.el.hidden){assert.equal(e.el.dataset.mode,'bar');assertBarOnAnchor(e);}else assert.equal(e.el.hidden,true,'a bar under the HUD hides rather than sliding away');
      }
    }
  }
});

test('renderLabels pins the bar to its anchor every frame regardless of a HUD panel appearing or vanishing',()=>{
  const e=enemyLabel('sticky',0,8);e.el.measured=true;e.el.dy=-12;
  const hud=[{left:250,right:550,top:0,bottom:100}];
  run([e],[],{hud,now:0});
  if(!e.el.hidden)assertBarOnAnchor(e);
  const anchor={sx:e.sx,sy:e.sy};
  for(let frame=1;frame<40;frame++){
    run([e],[],{hud:frame<5?hud:[],now:frame*16});
    if(frame>=5)assert.equal(e.el.hidden,false,'bar returns on its anchor once the HUD panel is gone');
    assert.equal(e.sx,anchor.sx,'static enemy projects to the same screen x every frame');
    assert.equal(e.sy,anchor.sy,'static enemy projects to the same screen y every frame');
    if(!e.el.hidden)assertBarOnAnchor(e);
  }
});

// Exercise the actual rendering pass with the gate caption, overlapping models, and changing font metrics.
// All 8 enemies share one world point on purpose: since a bar never dodges obstacles or other bars
// anymore, they are expected to coincide too — what matters is each one stays pinned to its own anchor.
test('clustered enemies around STAND CLOSE all stay visible and pinned to their shared anchor across frames',()=>{
  for(const [width,height] of [[844,390],[932,430],[667,375]]){
    const objective=lootLabel('gate',0,0);objective.range='node';
    objective.el.measured=true;objective.el.dy=-12;
    const measure=objective.el.getBoundingClientRect.bind(objective.el);
    let captionWidth=180;
    objective.el.getBoundingClientRect=()=>{
      const r=measure(),centre=(r.left+r.right)/2;
      return {...r,left:centre-captionWidth/2,right:centre+captionWidth/2,width:captionWidth};
    };
    const enemies=Array.from({length:8},(_,i)=>enemyLabel(`cluster-${i}`,0,0));
    for(const e of enemies){e.el.measured=true;e.el.dy=-12;e.obscured=true;}
    const hud=[{left:width/2-140,right:width/2+140,top:0,bottom:90},
      {left:0,right:110,top:height-100,bottom:height}];
    for(let frame=0;frame<60;frame++){
      // A font loading after the initial frame must invalidate existing clearance.
      captionWidth=frame<10?180:240;
      run([objective,...enemies],[],{width,height,hud,now:frame*16});
      assert.equal(objective.el.hidden,false,'gate interaction label remains visible');
      for(const e of enemies){
        assert.equal(e.el.hidden,false,'even a centre-ray-obscured on-screen model gets a bar');
        assert.equal(e.el.dataset.mode,'bar');
        const r=e.el.getBoundingClientRect();
        assert(r.left>=2&&r.right<=width-2&&r.top>=2&&r.bottom<=height-2);
        assertBarOnAnchor(e);
      }
    }
  }
});

// PRB: measuring the caption's auto width, then pinning the rounded/transformed offsetWidth AFTER
// measuring, let the final box wrap onto an extra line with a different height than what was cached —
// and placeEnemyLabel's returned y (a rendered BOTTOM) was written straight to CSS top without
// subtracting the mode's dy. layoutWidth models a caption whose real content needs 104.4px (bar fits its
// 44px minimum exactly); dy differs per mode like a real caption/bar transform offset would. The 'winding'
// class scales the rendered box (1.12x) to prove the width pinned to CSS is read untransformed.
test('renderLabels: width is measured at its final pinned (ceiled) size and placement lands at the correct CSS top across a full<->bar switch',()=>{
  const SCALE=1.12;
  const e=enemyLabel('wrap',5,0);
  e.el.measured=true;
  e.el.layoutWidth={full:104.4,bar:44};
  e.el.dy={full:-12,bar:0};
  run([e],[],{now:0});
  assert.equal(e.el.dataset.mode,'bar');
  assert.equal(parseFloat(e.el.style.width),44);
  assert.equal(e.el.getBoundingClientRect().height,5);
  const anchor={sx:e.sx,sy:e.sy};
  // winding forces the caption every frame; placeEnemyLabel still needs its usual sustained dwell.
  e.el.classList.toggle('winding',true);
  run([e],[],{now:16});
  run([e],[],{now:500}); // past the 400ms dwell+clearance window
  assert.equal(e.el.dataset.mode,'full','caption mode engaged after its dwell');
  let prev=e.el.getBoundingClientRect(),prevCentre=prev.bottom-prev.height/2;
  for(let now=516;now<=1200;now+=16){
    run([e],[],{now});
    assert.equal(e.sx,anchor.sx,'static anchor: x never moves');
    assert.equal(e.sy,anchor.sy,'static anchor: y never moves');
    const r=e.el.getBoundingClientRect(),centre=r.bottom-r.height/2;
    assert(Math.abs(centre-prevCentre)<=8*SCALE+1e-6,'visual centre never jumps more than the capped (scaled) shift in one frame');
    prev=r;prevCentre=centre;
  }
  // Settled geometry: the caption pins to ceil(104.4)=105, not a floored/rounded guess of 100 — so the
  // height measured ahead of time (unwrapped, 30) still matches what actually rendered once pinned. The
  // old order (measure first at auto width, pin the rounded offsetWidth afterwards) would instead wrap
  // the caption onto an extra line and render at 67.
  assert.equal(parseFloat(e.el.style.width),105,'full width pinned to ceil(104.4), not a floored guess');
  assert(Math.abs(prev.height-30*SCALE)<1e-6,'no wrap: pinned width matches what was measured (scaled by the winding transform)');
  assert(Math.abs((prev.left+prev.right)/2-e.sx)<=0.5,'caption stays centred exactly on the anchor');
  run([e],[],{now:1216}); // one more settled frame must land on the exact same bottom, not merely close
  const settled=e.el.getBoundingClientRect();
  assert.equal(settled.bottom,prev.bottom,'rendered bottom has converged to its placement target');
  // Switch back to the bar: the same contract (pinned width, dy-correct CSS top, anchor-exact x) holds.
  e.el.classList.toggle('winding',false);
  for(let now=1232;now<=2000;now+=16)run([e],[],{now});
  assert.equal(e.el.dataset.mode,'bar');
  assert.equal(parseFloat(e.el.style.width),44);
  const bar=e.el.getBoundingClientRect();
  assert.equal(bar.height,5);
  assert(Math.abs((bar.left+bar.right)/2-e.sx)<=0.5,'bar re-centres exactly on the anchor');
});
