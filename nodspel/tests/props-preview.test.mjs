import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {generateLevel} from '../levels.js';
import {placeArchipelagoProps,propReservations} from '../props-placement.mjs';
import {bridgeClearances} from '../bridge-flow.mjs';
const DIR={ground:'nature/',shore:'shore/',foam:'shore/',rock:'nature/rocks/'};
test('props preview is deterministic per seed and LOW places fewer props',()=>{
  for(const n of [1,2,3]){const L=generateLevel(n,'props-s','archipelago');
    const a=placeArchipelagoProps(L),b=placeArchipelagoProps(generateLevel(n,'props-s','archipelago'));
    assert.deepEqual(a,b);const low=placeArchipelagoProps(L,{profile:'low'});
    assert.ok(a.length>0&&low.length<a.length*.6,`low ${low.length} vs high ${a.length}`);}
});
test('props keep bridges, passages and objectives clear; rocks are sparse shore-only',()=>{
  for(const seed of ['p1','p2','p3'])for(const n of [1,2,3]){const L=generateLevel(n,seed,'archipelago'),res=propReservations(L);
    const items=placeArchipelagoProps(L);
    for(const it of items)assert.ok(!res.blocked(it.x,it.z),`${it.asset} in reserved zone`);
    for(const it of items.filter(i=>i.kind==='rock')){
      assert.ok(!L.floors.some(f=>Math.abs(it.x-f.x)<f.w/2&&Math.abs(it.z-f.z)<f.d/2),'rock off walkable floors');
      assert.ok(!bridgeClearances(L).some(z=>Math.abs(it.x-z.x)<z.w/2+.6&&Math.abs(it.z-z.z)<z.d/2+.6));}
    const islands=L.floors.filter(f=>!f.dir).length;
    assert.ok(items.filter(i=>i.kind==='rock').length<=islands*3,'occasional rocks, not a ring');
    for(const it of items)assert.ok(existsSync(new URL(`../../assets/env/${DIR[it.kind]}${it.asset}.glb`,import.meta.url)),it.asset);}
});
