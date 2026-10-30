import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {fitStructure,groundPatchParts} from '../environment-look.js';
import {planFloorTiles,buildBunker,BUNKER_DIMS,planWalls} from '../bunker.js';
import {qualitySettings} from '../art.js';
import {generateLevel} from '../levels.js';

test('structural modules fit exact assembly bounds without mutating shared originals',()=>{
  const geometry=new THREE.BoxGeometry(2.04,2.63,.34);
  const original=new THREE.Matrix4().makeTranslation(.13,1.4,-.2);
  const parts=[{geometry,material:new THREE.MeshStandardMaterial(),matrix:original}];
  const fitted=fitStructure(parts,[2,2.6,.3]);
  geometry.computeBoundingBox();
  const box=geometry.boundingBox.clone().applyMatrix4(fitted[0].matrix);
  const size=box.getSize(new THREE.Vector3());
  for(const [actual,expected] of [[size.x,2],[size.y,2.6],[size.z,.3],[box.min.y,0],[box.min.x,-1],[box.min.z,-.15]])assert.ok(Math.abs(actual-expected)<1e-6);
  assert.equal(parts[0].matrix,original);
  assert.notDeepEqual(fitted[0].matrix.elements,original.elements);
});

test('crossing room/corridor floors have exact union coverage, one height, no overlaps',()=>{
  const floors=[{x:0,z:0,w:8,d:6},{x:4,z:0,w:6,d:2}];
  const tiles=planFloorTiles(floors);
  assert.equal(tiles.reduce((area,t)=>area+t.w*t.d,0),54);
  for(const a of tiles)for(const b of tiles)if(a!==b)assert.ok(!(Math.abs(a.x-b.x)<(a.w+b.w)/2-1e-8&&Math.abs(a.z-b.z)<(a.d+b.d)/2-1e-8));
  assert.deepEqual(planFloorTiles([]),[]);
});
test('two storeys retain distinct elevations in floor instances and wall origins',()=>{
  const floors=[{x:0,z:0,w:8,d:6,y:0},{x:0,z:0,w:8,d:6,y:3.2}];
  const tiles=planFloorTiles(floors);
  for(const y of [0,3.2])assert.equal(tiles.filter(t=>t.y===y).reduce((a,t)=>a+t.w*t.d,0),48);
  const assets=Object.fromEntries(Object.entries(BUNKER_DIMS).map(([kind,[w,h,d]])=>[kind,[{geometry:new THREE.BoxGeometry(w,h,d),material:new THREE.MeshStandardMaterial({name:kind}),matrix:new THREE.Matrix4().makeTranslation(0,h/2,0)}]]));
  const group=new THREE.Group();buildBunker({seed:'storeys',number:1,floors,walls:[],boxes:[],hazards:[]},group,assets,qualitySettings('low'));
  const heights=new Set(),matrix=new THREE.Matrix4();
  group.traverse(o=>{if(o.isInstancedMesh&&o.material.name.startsWith('floor_'))for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);heights.add(+matrix.elements[13].toFixed(3));}});
  assert.deepEqual([...heights].sort((a,b)=>a-b),[-.025,3.175]);
  assert.ok(planWalls({walls:[{x:0,z:0,w:6,d:.4,h:1.2,y:3.2}]}).every(w=>w.y===3.2&&w.sy===1.2/2.6));
});

test('bunker floor union remains continuous across seeded layouts and narrow passage edges',()=>{
  for(const seed of ['dressing','a','b'])for(const n of [1,2,3]){
    const level=generateLevel(n,seed,'bunker'),tiles=planFloorTiles(level.floors);
    for(const f of level.floors)for(let x=f.x-f.w/2+.07;x<f.x+f.w/2;x+=.57)for(let z=f.z-f.d/2+.07;z<f.z+f.d/2;z+=.57){
      assert.ok(tiles.some(t=>Math.abs(x-t.x)<=t.w/2+1e-7&&Math.abs(z-t.z)<=t.d/2+1e-7),`${seed} L${n} floor gap at ${x},${z}`);
    }
    for(const a of tiles)for(const b of tiles)if(a!==b)assert.ok(!(Math.abs(a.x-b.x)<(a.w+b.w)/2-1e-8&&Math.abs(a.z-b.z)<(a.d+b.d)/2-1e-8));
  }
});

test('mobile light pools use one shared soft texture and no shadow/depth writes',()=>{
  const a=groundPatchParts(),b=groundPatchParts({additive:true});
  assert.equal(a[0].material.map,b[0].material.map);
  assert.equal(a[0].material.depthWrite,false);
  const data=a[0].material.map.image.data;
  assert.equal(data[3],0);assert.ok(data[(16*32+16)*4+3]>240);
});

test('wall lamps require 1.5 m walls; lower walls have no lamp or light pool',()=>{
  const assets=Object.fromEntries(Object.entries(BUNKER_DIMS).map(([kind,[w,h,d]])=>[kind,[{geometry:new THREE.BoxGeometry(w,h,d),material:new THREE.MeshStandardMaterial({name:kind}),matrix:new THREE.Matrix4().makeTranslation(0,h/2,0)}]]));
  for(const h of [.8,1.1,1.49,1.5,2]){
    const group=new THREE.Group(),level={seed:'wall-height',number:1,floors:[{x:0,z:0,w:8,d:8}],walls:[{x:0,z:-3.8,w:8,d:.4,h}],boxes:[],hazards:[]};
    const info=buildBunker(level,group,assets,qualitySettings('high'));
    assert.equal(info.anchors.length,h>=1.5?1:0);
    assert.equal(info.instancedKinds.includes('lamp_wall_amber_on'),h>=1.5);
    if(h<1.5)assert.equal(group.children.filter(o=>o.isPointLight).length,0);
  }
});
