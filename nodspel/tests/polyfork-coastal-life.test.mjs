import test from 'node:test';
import assert from 'node:assert/strict';
import {planCoastalLifeDressing,COASTAL_SCENES} from '../polyfork-coastal-life.mjs';
import {planProfiledDressing} from '../polyfork-profiles.mjs';
import {propReservations} from '../props-placement.mjs';

const base={
  archipelago:true,seed:'coastal-life-snapshot',
  floors:[
    {x:0,z:0,w:28,d:26},
    {x:46,z:0,w:28,d:26},
    {x:92,z:0,w:28,d:26},
    {x:23,z:0,w:18,d:4.1,dir:{x:1,z:0}},
    {x:69,z:0,w:18,d:4.1,dir:{x:1,z:0}},
  ],
  walls:[],boxes:[],rooms:[],nodes:[{x:0,z:5}],
  lootBoxes:[{x:45,z:-4}],enemies:[{x:92,z:4}],
  start:{x:-9,z:0},exit:{x:100,z:0}
};
const key=p=>[p.id,p.x,p.z,p.h].join('/');
test('shore vignette is deterministic, rare and placed beyond playable floors',()=>{
  const a=planCoastalLifeDressing(base,{quality:'high'});
  assert.deepEqual(a,planCoastalLifeDressing(base,{quality:'high'}));
  assert.equal(a.landmarks.length,1);
  const landmarks=a.items.filter(i=>i.profile==='coastal-life');
  assert.equal(landmarks.length,3);
  const catalog=new Set(COASTAL_SCENES.flatMap(scene=>scene.parts.map(p=>p.id)));
  assert.ok(landmarks.every(p=>catalog.has(p.id)));
  const res=propReservations(base);
  for(const p of landmarks){
    assert.equal(res.blocked(p.x,p.z,.52),false);
    assert.ok(!base.floors.some(f=>Math.abs(p.x-f.x)<=f.w/2&&Math.abs(p.z-f.z)<=f.d/2));
  }
});
test('LOW is a deterministic subset of HIGH and respects budgets',()=>{
  const high=planCoastalLifeDressing(base,{quality:'high'});
  const low=planCoastalLifeDressing(base,{quality:'low'});
  assert.ok(high.items.length<=125);
  assert.ok(low.items.length<=40);
  const permitted=new Set(high.items.map(key));
  assert.ok(low.items.every(p=>permitted.has(key(p))));
  assert.deepEqual(low.landmarks,high.landmarks);
  assert.deepEqual(low.regions,high.regions);
});
test('original mode and onboarding stay unaffected',()=>{
  const direct=planProfiledDressing(base,{quality:'high'});
  assert.equal(direct.items.some(p=>p.profile==='coastal-life'),false);
  const noArch=planCoastalLifeDressing({...base,archipelago:false});
  assert.deepEqual(noArch.items,[]);
  const one=planCoastalLifeDressing({...base,floors:base.floors.slice(0,1)});
  assert.deepEqual(one.landmarks,[]);
  const empty=planCoastalLifeDressing(base,{density:0});
  assert.deepEqual(empty.items,[]);
  assert.deepEqual(empty.landmarks,[]);
});
