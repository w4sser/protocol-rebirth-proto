// v2.4 (Robert's playtest): a visible enemy must always keep at least its compact health bar — decluttering
// (overlap with another label, or a nearby shock-pad icon) may thin the caption down to the bar, but must
// never hide the whole badge the way the old code did. Exercises the actual rendering path (renderLabels),
// not just planLabels(), since the regression lived in the post-plan declutter/hazard passes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import {planLabels,resolveLabels,overHUD,labelOpacity,labelPriority,pushClear,placeEnemyLabel} from '../labels.js';

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
  getBoundingClientRect(){
    if(!this.measured)return {width:0,height:0,left:0,right:0,top:0,bottom:0};
    const scale=this.classList.contains('winding')?1.12:1;
    const width=this.offsetWidth*scale,height=(this.dataset.mode==='bar'?5:30)*scale;
    const left=parseFloat(this.style.left)-width/2+(this.origin?.left??0),bottom=parseFloat(this.style.top)+(this.origin?.top??0)+(this.dy??0);
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
    planLabels,resolveLabels,overHUD,labelOpacity,labelPriority,pushClear,placeEnemyLabel,
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
test('winding bars retain unscaled CSS widths while reserving scaled bounds at viewport edges',()=>{
  for(const [width,height] of [[844,390],[932,430],[667,375]]){
    for(const x of [-9.9,9.9]){
      const enemies=Array.from({length:4},(_,i)=>enemyLabel(`winding-${i}`,x,0));
      for(const e of enemies){e.el.measured=true;e.el.classList.toggle('winding',true);}
      // Nearby hazards force compact bars even though winding requests captions.
      const hazards=[hazardEntry(x,0)];
      const origin={left:59,top:7};
      for(let frame=0;frame<3;frame++){
        run(enemies,hazards,{width,height,origin,now:frame*16});
        const reserved=[];
        for(const e of enemies){
          assert.equal(e.el.hidden,false);
          assert.equal(e.el.dataset.mode,'bar');
          assert.equal(parseFloat(e.el.style.width),44,'CSS width excludes the windup transform');
          const r=e.el.getBoundingClientRect();
          assert.equal(r.width,44*1.12,'windup scaling is applied exactly once');
          const local={left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top};
          assert(local.left>=2&&local.right<=width-2&&local.top>=2&&local.bottom<=height-2,'scaled bounds fit the viewport');
          assert(!reserved.some(other=>hits(local,other)),'placement reserves the scaled bar width');
          reserved.push(local);
        }
      }
    }
  }
});
test('HUD collisions keep every measured enemy bar clear, including at viewport edges and nonzero origins',()=>{
  for(const [width,height] of [[844,390],[932,430],[667,375]]){
    const hud=[{left:width/2-150,right:width/2+150,top:0,bottom:85}];
    const enemies=Array.from({length:5},(_,i)=>enemyLabel(`e${i}`,0,8));
    for(const e of enemies){e.el.measured=true;e.el.dy=-12;}
    const origin={left:59,top:7};
    run(enemies,[],{hud,width,height,origin});
    const placed=[];
    for(const e of enemies){
      assert.equal(e.el.hidden,false);assert.equal(e.el.dataset.mode,'bar');
      const r=e.el.getBoundingClientRect();
      const local={left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top};
      assert(local.left>=2&&local.right<=width-2&&local.top>=2&&local.bottom<=height-2);
      assert(!hud.some(h=>hits(local,h)),'bar clears HUD');
      assert(!placed.some(p=>hits(local,p)),'moved bars reserve their final positions');
      placed.push(local);
    }
  }
});

test('an attacking enemy caption yields to an objective and its measured bar clears the objective',()=>{
  const enemy=enemyLabel('enemy',0,0),objective=lootLabel('objective',0,0);objective.range='room';
  enemy.el.measured=objective.el.measured=true;enemy.el.classList.toggle('winding',true);
  run([enemy,objective],[]);
  assert.equal(objective.el.hidden,false,'objective keeps its label');
  assert.equal(enemy.el.hidden,false);assert.equal(enemy.el.dataset.mode,'bar');
  assert(!hits(enemy.el.getBoundingClientRect(),objective.el.getBoundingClientRect()));
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
test('the separately measured quest chip blocks both original and relocated enemy bars',()=>{
  const origin={left:59,top:7};
  const rects=[{selector:'.round-hud',left:300,right:500,top:0,bottom:45},
    {selector:'#quest-chip',left:270,right:530,top:50,bottom:100}];
  const hudElements=rects.map(r=>({...r,hidden:false,getClientRects:()=>[r],getBoundingClientRect:()=>({
    left:r.left+origin.left,right:r.right+origin.left,top:r.top+origin.top,bottom:r.bottom+origin.top})}));
  // First starts on the chip; second starts on the HUD and must avoid the chip when moved.
  const enemies=[enemyLabel('chip',0,7.5),enemyLabel('hud',0,9)];
  for(const e of enemies)e.el.measured=true;
  run(enemies,[],{origin,hudElements});
  for(const e of enemies){
    assert.equal(e.el.hidden,false);assert.equal(e.el.dataset.mode,'bar');
    const r=e.el.getBoundingClientRect(),local={left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top};
    assert(!rects.some(h=>hits(local,h)),'bar clears both parent HUD and separate quest chip');
  }
});

test('renderLabels retains enemy offsets and modes over a multi-frame walk past the HUD and quest chip',()=>{
  for(const [width,height] of [[844,390],[932,430],[667,375]]){
    const hud=[{left:width/2-140,right:width/2+140,top:0,bottom:45},
      {left:width/2-130,right:width/2+130,top:50,bottom:100}];
    const enemies=[enemyLabel('one',-.5,7.5),enemyLabel('two',.5,7.5)];
    for(const e of enemies){e.el.measured=true;e.el.dy=-12;}
    let previous=[];
    for(let frame=0;frame<65;frame++){
      for(const [i,e] of enemies.entries()){e.point.x=(i-.5)+Math.sin(frame/10)*.05;e.point.z=7.5+frame*.005;}
      run(enemies,[],{hud,width,height,now:frame*16});
      const rects=[];
      for(const [i,e] of enemies.entries()){
        assert.equal(e.el.hidden,false,'on-screen enemy keeps a visible bar every frame');
        assert.equal(e.el.dataset.mode,'bar','caption remains compact while HUD blocks it');
        const r=e.el.getBoundingClientRect();
        assert(!hud.some(h=>hits(r,h)),'no bar overlaps HUD or quest chip');
        assert(!rects.some(o=>hits(r,o)),'enemies reserve their actual final positions');
        rects.push(r);
        if(previous[i])assert(Math.hypot(e.placement.dx-previous[i].dx,e.placement.dy-previous[i].dy)<=8.001,'relative offset changes stay bounded');
      }
      previous=enemies.map(e=>({...e.placement}));
    }
  }
});

test('renderLabels does not restore a relocated label to its anchor between frames',()=>{
  const e=enemyLabel('sticky',0,8);e.el.measured=true;e.el.dy=-12;
  const hud=[{left:250,right:550,top:0,bottom:100}];
  run([e],[],{hud,now:0});
  const offset={dx:e.placement.dx,dy:e.placement.dy};
  assert.notEqual(offset.dy,0);
  for(let frame=1;frame<40;frame++){
    run([e],[],{hud:frame<5?hud:[],now:frame*16});
    assert.deepEqual({dx:e.placement.dx,dy:e.placement.dy},offset);
    assert.equal(e.el.hidden,false);
  }
});

// Exercise the actual rendering pass with the gate caption, overlapping models,
// changing font metrics, and retained offsets over successive frames.
test('clustered enemies around STAND CLOSE all retain clear visible bars across frames',()=>{
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
    let previous;
    for(let frame=0;frame<60;frame++){
      // A font loading after the initial frame must invalidate existing clearance.
      captionWidth=frame<10?180:240;
      run([objective,...enemies],[],{width,height,hud,now:frame*16});
      assert.equal(objective.el.hidden,false,'gate interaction label remains visible');
      const reserved=[objective.el.getBoundingClientRect(),...hud];
      for(const e of enemies){
        assert.equal(e.el.hidden,false,'even a centre-ray-obscured on-screen model gets a bar');
        assert.equal(e.el.dataset.mode,'bar');
        const r=e.el.getBoundingClientRect();
        assert(r.left>=2&&r.right<=width-2&&r.top>=2&&r.bottom<=height-2);
        assert(!reserved.some(other=>hits(r,other)),'bar clears gate caption, HUD and every other bar');
        reserved.push(r);
      }
      const offsets=enemies.map(e=>[e.placement.dx,e.placement.dy]);
      if(frame>11)assert.deepEqual(offsets,previous,'clear placements remain stable');
      previous=offsets;
    }
  }
});
