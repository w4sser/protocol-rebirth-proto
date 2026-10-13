import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel} from '../levels.js';
import {pickQuality,qualitySettings,propSpots,rngFrom} from '../art.js';
test('quality: explicit, saved, auto-low on mobile',()=>{
  assert.equal(pickQuality({search:'?q=high',nav:{maxTouchPoints:5}}),'high');
  assert.equal(pickQuality({search:'',storage:{getItem:()=>'low'},nav:{}}),'low');
  assert.equal(pickQuality({nav:{maxTouchPoints:5,hardwareConcurrency:8},screen:{width:844,height:390}}),'low');
  assert.equal(pickQuality({nav:{maxTouchPoints:0,hardwareConcurrency:8},screen:{width:1920,height:1080}}),'high');
  assert(qualitySettings('low').props<qualitySettings('high').props&&!qualitySettings('low').shadows);
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
