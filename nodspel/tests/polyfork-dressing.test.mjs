import test from 'node:test';
import assert from 'node:assert/strict';
import {POLYFORK_CANDIDATES} from '../polyfork-catalog.mjs';
import {planPolyforkDressing,filterDressingTrees} from '../polyfork-dressing.mjs';
import {propReservations} from '../props-placement.mjs';

const level={
  archipelago:true,seed:'polyfork-qa-42',
  floors:[{x:0,z:0,w:30,d:25},{x:46,z:0,w:25,d:25},
    {x:31.5,z:0,w:16,d:4.3,dir:{x:1,z:0}}],
  walls:[{x:0,z:11,w:30,d:.35},{x:0,z:-11,w:30,d:.35}],
  rooms:[],nodes:[{x:4,z:2}],lootBoxes:[{x:-4,z:-3}],
  start:{x:-9,z:0},exit:{x:52,z:0},enemies:[{x:9,z:6}],
};
test('curated model gallery has 56 unique real-id-shaped URLs',()=>{
  assert.equal(POLYFORK_CANDIDATES.length,56);
  assert.equal(new Set(POLYFORK_CANDIDATES.map(p=>p.id)).size,56);
  for(const c of POLYFORK_CANDIDATES){
    assert.match(c.id,/^[a-z0-9-]+-[a-f0-9]{6}$/);
    assert.equal(c.url,'https://polyfork.dev/cdn/'+c.id+'.glb');
    assert.ok(['Forest','Coast','Bunker'].includes(c.category));
  }
});
test('opt-in planner yields deterministic, bounded, playable-only decoration',()=>{
  const a=planPolyforkDressing(level,{quality:'high'});
  assert.deepEqual(a,planPolyforkDressing(level,{quality:'high'}));
  assert.ok(a.length>0,'large test island should yield decorations');
  assert.ok(a.length<=125,'high density is limited');
  const res=propReservations(level);
  for(const p of a){
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.h>0);
    assert.ok(level.floors.filter(f=>!f.dir).some(f=>
      Math.abs(p.x-f.x)<=f.w/2&&Math.abs(p.z-f.z)<=f.d/2));
    assert.equal(res.blocked(p.x,p.z,.55),false,'must clear bridge and objective reservations');
  }
});
test('LOW has a smaller instance budget, and other environments receive none',()=>{
  assert.ok(planPolyforkDressing(level,{quality:'low'}).length<=40);
  assert.deepEqual(planPolyforkDressing({...level,archipelago:false}),[]);
  assert.deepEqual(planPolyforkDressing({...level,floors:[]}),[]);
});


test('native v2 pines remove only unfadable GLB tree species from dressing',()=>{
  const original=[
    {id:'young-pine-0d7695',x:1},{id:'tall-pine-tree-ab4108',x:2},
    {id:'birch-tree-181b33',x:3},{id:'grass-tuft-a40a08',x:4},
    {id:'fern-plant-1559b8',x:5},{id:'fallen-log-1685fb',x:6},
    {id:'round-bush-cd2ac0',x:7}
  ];
  assert.deepEqual(filterDressingTrees(original),original,
    'live and non-v2 previews continue using their existing forest assets');
  const filtered=filterDressingTrees(original,{nativePines:true});
  assert.deepEqual(filtered,original.slice(3),
    'v2 only removes older pine/birch meshes that lack foreground fading');
  assert.deepEqual(filterDressingTrees(original,{nativePines:true}),filtered,
    'filtering must stay deterministic');
});
