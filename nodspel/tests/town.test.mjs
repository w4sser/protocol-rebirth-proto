import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from '../vendor/three.module.js';
import {generateLevel,setArea} from '../levels.js';import {TOWN_DIMS,reachable,footprint} from '../town-layout.js';import {buildWorld} from '../world.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../../assets/env/town/manifest.json',import.meta.url),'utf8'));
test('town dims mirror the asset manifest and every GLB is in the repo',()=>{for(const a of manifest.assets){const k=a.file.replace('.glb','');assert.deepEqual(TOWN_DIMS[k],a.approx_dimensions_m,k);assert.ok(fs.statSync(new URL(`../../assets/env/town/${a.file}`,import.meta.url)).size<100_000,a.file);}});
test('bunker stays the default area',()=>{const L=generateLevel(1,'d');assert.equal(L.area,undefined);assert.equal(L.town,undefined);});
test('town levels keep every node, pickup, enemy and the exit reachable; car colliders use manifest bounds',()=>{
  for(let i=0;i<25;i++)for(const n of [1,2,3]){const L=generateLevel(n,'t'+i,'town');assert.equal(L.area,'town');assert.ok(reachable(L),`t${i} L${n}`);
    for(const b of L.boxes.filter(b=>b.town)){const fp=footprint('car_boxy',0,0,b.rot);assert.equal(b.w,fp.w);assert.equal(b.d,fp.d);assert.equal(b.h,TOWN_DIMS.car_boxy[1]);}
    for(const h of L.town.houses){const fp=footprint(h.kind,h.x,h.z,h.rot);for(const f of L.floors)assert.ok(!(Math.abs(fp.x-f.x)<(fp.w+f.w)/2&&Math.abs(fp.z-f.z)<(fp.d+f.d)/2),'house never on a floor');}
    assert.ok(L.town.fences.length>=L.walls.length);}
});
test('town layout is deterministic and gameplay identical to bunker apart from added cover',()=>{
  const a=generateLevel(2,'same','town'),b=generateLevel(2,'same','town'),c=generateLevel(2,'same');
  assert.deepEqual(a.town,b.town);assert.deepEqual(a.nodes,c.nodes);assert.deepEqual(a.lootBoxes,c.lootBoxes);assert.deepEqual(a.walls,c.walls);
  assert.deepEqual(a.boxes.filter(x=>!x.town),c.boxes);
});
test('setArea switches the default and rejects unknown areas',()=>{assert.equal(setArea('town'),'town');assert.equal(generateLevel(1,'s').area,'town');assert.equal(setArea('moon'),'bunker');assert.equal(generateLevel(1,'s').area,undefined);});
test('town world builds with fake assets, instancing parts, and dispose keeps shared asset resources',()=>{
  const geo=new THREE.BoxGeometry(1,1,1),mat=new THREE.MeshStandardMaterial();geo.userData.shared=mat.userData.shared=true;let freed=0;geo.addEventListener('dispose',()=>freed++);mat.addEventListener('dispose',()=>freed++);
  const assets=Object.fromEntries(Object.keys(TOWN_DIMS).map(k=>[k,[{geometry:geo,material:mat,matrix:new THREE.Matrix4()}]]));
  const scene=new THREE.Scene();for(const q of ['high','low']){const L=generateLevel(3,'w','town'),w=buildWorld(L,scene,{quality:q,town:assets});
    let inst=0;w.group.traverse(o=>{if(o.isInstancedMesh)inst++;});assert.ok(inst>=6);w.dispose();assert.equal(scene.children.length,0);}
  assert.equal(freed,0);
});
