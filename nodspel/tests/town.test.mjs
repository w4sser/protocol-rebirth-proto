import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from '../vendor/three.module.js';
import {generateLevel,setArea} from '../levels.js';import {TOWN_DIMS,reachable,footprint,visualItems,intrudes} from '../town-layout.js';import {buildWorld} from '../world.js';import {splitWall} from '../house.js';
// bunker walls with the one wall the house doorway is cut into split exactly like the town does
const cutLike=(B,L)=>{const w=[...B.walls];if(L.house){const i=L.house.cut.index;const {index,...orig}=L.house.cut;assert.deepEqual(w[i],orig,'cut wall is an original wall');w.splice(i,1,...splitWall(orig,L.house));}return w;};
const manifest=JSON.parse(fs.readFileSync(new URL('../../assets/env/town/manifest.json',import.meta.url),'utf8'));
test('town dims mirror the asset manifest and every GLB is in the repo',()=>{for(const a of manifest.assets){const k=a.file.replace('.glb','');assert.deepEqual(TOWN_DIMS[k],a.approx_dimensions_m,k);assert.ok(fs.statSync(new URL(`../../assets/env/town/${a.file}`,import.meta.url)).size<100_000,a.file);}});
test('bunker stays the default area',()=>{const L=generateLevel(1,'d');assert.equal(L.area,undefined);assert.equal(L.town,undefined);});
test('town levels keep every node, pickup, enemy and the exit reachable; car colliders use manifest bounds',()=>{
  for(let i=0;i<25;i++)for(const n of [1,2,3]){const L=generateLevel(n,'t'+i,'town');assert.equal(L.area,'town');assert.ok(reachable(L),`t${i} L${n}`);
    for(const b of L.boxes.filter(b=>b.town)){const fp=footprint(b.town,0,0,b.rot??0);assert.equal(b.w,fp.w,b.town);assert.equal(b.d,fp.d,b.town);assert.equal(b.h,TOWN_DIMS[b.town][1]);}
    assert.ok(L.boxes.every(b=>b.town),'every solid prop has a town collider');
    for(const h of L.town.houses){const fp=footprint(h.kind,h.x,h.z,h.rot);for(const f of L.floors)assert.ok(!(Math.abs(fp.x-f.x)<(fp.w+f.w)/2&&Math.abs(fp.z-f.z)<(fp.d+f.d)/2),'house never on a floor');}
    assert.equal(L.town.boundary.length,L.walls.length,'every wall line is dressed');}
});
test('town layout is deterministic and gameplay identical to bunker apart from added cover',()=>{
  const a=generateLevel(2,'same','town'),b=generateLevel(2,'same','town'),c=generateLevel(2,'same');
  assert.deepEqual(a.town,b.town);assert.deepEqual(a.nodes,c.nodes);assert.deepEqual(a.lootBoxes,c.lootBoxes);assert.deepEqual(a.walls,cutLike(c,a));
  assert.deepEqual(a.boxes.filter(x=>x.town==='electrical_cabinet').map(b=>[b.x,b.z]),c.boxes.map(b=>[b.x,b.z]),'crates become cabinets in place');
});
test('setArea switches the default and rejects unknown areas',()=>{assert.equal(setArea('town'),'town');assert.equal(generateLevel(1,'s').area,'town');assert.equal(setArea('moon'),'bunker');assert.equal(generateLevel(1,'s').area,undefined);});
test('town world builds with fake assets, instancing parts, and dispose keeps shared asset resources',()=>{
  const geo=new THREE.BoxGeometry(1,1,1),mat=new THREE.MeshStandardMaterial();geo.userData.shared=mat.userData.shared=true;let freed=0;geo.addEventListener('dispose',()=>freed++);mat.addEventListener('dispose',()=>freed++);
  const assets=Object.fromEntries(Object.keys(TOWN_DIMS).map(k=>[k,[{geometry:geo,material:mat,matrix:new THREE.Matrix4()}]]));
  const scene=new THREE.Scene();for(const q of ['high','low']){const L=generateLevel(3,'w','town'),w=buildWorld(L,scene,{quality:q,town:assets});
    let inst=0;w.group.traverse(o=>{if(o.isInstancedMesh)inst++;});assert.ok(inst>=6);w.dispose();assert.equal(scene.children.length,0);}
  assert.equal(freed,0);
});

test('v0.2 dressing: transition tiles face paved neighbours, fences are packed not stretched, tall props stay behind',()=>{
  const PAVED=new Set(['tile_sidewalk','tile_asphalt','tile_asphalt_sidewalk']);
  for(let i=0;i<10;i++)for(const n of [1,2,3]){const L=generateLevel(n,'v2-'+i,'town'),T=L.town,grid=new Map(T.tiles.map(t=>[`${t.x},${t.z}`,t]));
    for(const t of T.tiles.filter(t=>t.kind==='tile_sidewalk_grass'||t.kind==='tile_asphalt_grass')){const dx=Math.round(-Math.cos(t.ry)),dz=Math.round(Math.sin(t.ry)),nb=grid.get(`${t.x+dx*2},${t.z+dz*2}`);assert.ok(nb&&PAVED.has(nb.kind),'paved half points at pavement');}
    for(const f of T.fences)if(f.stretch<1)continue;else assert.ok(f.stretch<=1.26,`stretch ${f.stretch}`);
    for(const p of T.props.filter(p=>p.kind==='container'))for(const fl of L.floors)assert.ok(!(p.x>fl.x+fl.w/2+1&&Math.abs(p.z-fl.z)<fl.d/2&&p.x-fl.x-fl.w/2<4),'container not just in front');
    for(const k of ['grass_tuft_small','bush_small','manhole'])assert.ok(T.props.some(p=>p.kind===k),k);}
});

test('natural boundaries: fences are a minority, never more than 2 in a row, tall dressing only away from the camera; colliders unchanged',()=>{
  let fence=0,total=0,kinds=new Set();
  for(let i=0;i<20;i++)for(const n of [1,2,3]){const L=generateLevel(n,'nb'+i,'town'),B=generateLevel(n,'nb'+i);
    // PR C: the town's locked-door level also carries a side passage (extra walls); everything else is identical.
    // v1.73: the bunker's level 1 is the hand-built control room (closet included), which the town does not share.
    if(!L.doors?.length&&!B.startRoom)assert.deepEqual(L.walls,cutLike(B,L),'wall colliders identical to bunker apart from the doorway');
    for(const b of L.town.boundary){let run=0;for(const k of b.seq){kinds.add(k);run=k.startsWith('fence')?run+1:0;assert.ok(run<=2,`run ${b.seq}`);if(b.front)assert.ok(!['house','container','car','pine'].includes(k),'camera side stays low');}}
    for(const f of L.town.fences)fence+={fence_segment:2,fence_short:1,fence_gate:1.4}[f.kind];total+=L.walls.reduce((a,w)=>a+Math.max(w.w,w.d),0);}
  assert.ok(fence/total<=.27,`fence share ${(fence/total).toFixed(2)}`);
  for(const k of ['hedge_segment','bush_cluster','cabinet','pine'])assert.ok(kinds.has(k),k);
});

test('doorways and openings stay clear: no visual dressing on walkable floor; cars never rescaled and only outside',()=>{
  for(let i=0;i<25;i++)for(const n of [1,2,3])for(const seed of ['dc'+i,i===0?'e5c2d277-meta':'dd'+i]){const L=generateLevel(n,seed,'town');
    for(const it of visualItems(L.town))assert.ok(!intrudes(L,it.r),`${seed} L${n} ${it.list} ${it.ref.kind??''} at ${it.r.x},${it.r.z}`);
    assert.ok(!L.boxes.some(b=>b.town==='car_boxy'),'no cars inside rooms');
    for(const c of L.town.cars){assert.equal(c.sx,undefined);assert.ok(c.outside);}
    for(const p of L.town.props.filter(p=>['container','bus_shelter','electrical_cabinet','mailbox'].includes(p.kind)))assert.equal(p.sz,undefined,'solid props scale uniformly');}
});
