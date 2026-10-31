import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {groundPatchParts} from '../environment-look.js';
import {buildBunker,BUNKER_DIMS} from '../bunker.js';
import {qualitySettings} from '../art.js';

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
