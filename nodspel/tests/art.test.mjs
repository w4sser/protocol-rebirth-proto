import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel} from '../levels.js';
import {pickQuality,qualitySettings,propSpots,rngFrom,fogTuning,fpsMonitorStep,initialFpsMonitorState} from '../art.js';
test('quality: explicit, saved, auto-low on mobile',()=>{
  assert.equal(pickQuality({search:'?q=high',nav:{maxTouchPoints:5}}),'high');
  assert.equal(pickQuality({search:'',storage:{getItem:()=>'low'},nav:{}}),'low');
  assert.equal(pickQuality({nav:{maxTouchPoints:5,hardwareConcurrency:8},screen:{width:844,height:390}}),'low');
  assert.equal(pickQuality({nav:{maxTouchPoints:0,hardwareConcurrency:8},screen:{width:1920,height:1080}}),'high');
  assert(qualitySettings('low').props<qualitySettings('high').props&&!qualitySettings('low').shadows);
});
// v2.9.0 mood pass: cold Nordic fog tuned per area, tightening a little on deeper levels.
test('fogTuning: per-area baseline, tightens (never below a floor) on deeper levels',()=>{
  const bunker1=fogTuning('bunker',1),town1=fogTuning('town',1),arch1=fogTuning('archipelago',1);
  assert.deepEqual(bunker1,{color:'#44596a',near:19,far:40});
  assert.deepEqual(town1,{color:'#4b6176',near:21,far:44});
  assert.deepEqual(arch1,{color:'#3d5a6c',near:19,far:46});
  const bunker3=fogTuning('bunker',3);
  assert(bunker3.near<bunker1.near&&bunker3.far<bunker1.far,'deeper levels pull fog in');
  assert.equal(bunker3.color,bunker1.color,'area colour stays the same across levels');
  // near never crosses far, and both stay sane even at an absurd level number
  const extreme=fogTuning('bunker',999);
  assert(extreme.near<extreme.far&&extreme.near>=12);
  assert.deepEqual(fogTuning('unknown-area',1),bunker1,'unknown area falls back to the bunker baseline');
});
// Auto-downgrade watchdog: a pure step function fed {fps,now} each frame. Latches `triggered` once fps has
// stayed under thresholdFps for a continuous sustainMs, recovers (resets the clock) on a single good frame,
// and never un-latches once triggered - callers downgrade exactly once per session.
test('fpsMonitorStep: latches after a sustained dip, recovers from a brief one, then stays latched',()=>{
  let state=initialFpsMonitorState();
  const opts={thresholdFps:40,sustainMs:3000};
  state=fpsMonitorStep(state,{fps:20,now:0,...opts});assert.equal(state.triggered,false);
  state=fpsMonitorStep(state,{fps:20,now:1500,...opts});assert.equal(state.triggered,false);
  state=fpsMonitorStep(state,{fps:20,now:2999,...opts});assert.equal(state.triggered,false);
  state=fpsMonitorStep(state,{fps:20,now:3000,...opts});assert.equal(state.triggered,true);
  // once triggered it stays triggered even if fps recovers
  state=fpsMonitorStep(state,{fps:60,now:3100,...opts});assert.equal(state.triggered,true);

  let brief=initialFpsMonitorState();
  brief=fpsMonitorStep(brief,{fps:20,now:0,...opts});
  brief=fpsMonitorStep(brief,{fps:20,now:2000,...opts});
  brief=fpsMonitorStep(brief,{fps:60,now:2100,...opts}); // one good frame resets the clock
  assert.equal(brief.badSince,null);
  brief=fpsMonitorStep(brief,{fps:20,now:2200,...opts});
  brief=fpsMonitorStep(brief,{fps:20,now:5100,...opts}); // only ~2.9s of continuous bad frames since the reset
  assert.equal(brief.triggered,false);
  brief=fpsMonitorStep(brief,{fps:20,now:5201,...opts}); // now >=3000ms since the reset at 2200
  assert.equal(brief.triggered,true);

  // fps at/above threshold never starts the clock
  let steady=initialFpsMonitorState();
  for(let now=0;now<=10000;now+=500)steady=fpsMonitorStep(steady,{fps:45,now,...opts});
  assert.equal(steady.triggered,false);assert.equal(steady.badSince,null);
});
test('props are seed-deterministic and never block gameplay',()=>{
  for(const n of [1,2,3]){
    const L=generateLevel(n,'art-seed'),a=propSpots(L,rngFrom(`${L.seed}:props`),12),b=propSpots(L,rngFrom(`${L.seed}:props`),12);
    assert.deepEqual(a,b);assert(a.length>0);
    for(const s of a){
      assert(L.floors.some(f=>Math.abs(s.x-f.x)<f.w/2&&Math.abs(s.z-f.z)<f.d/2),'on a floor');
      assert(![...L.walls,...L.boxes].some(w=>Math.abs(s.x-w.x)<w.w/2&&Math.abs(s.z-w.z)<w.d/2),'not inside walls');
      for(const o of [...L.nodes,...L.lootBoxes,...L.enemies,L.start,L.exit])assert(Math.hypot(s.x-o.x,s.z-o.z)>=1.5,'clear of gameplay objects');
    }
  }
});
