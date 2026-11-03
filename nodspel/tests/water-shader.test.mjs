import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {generateLevel} from '../levels.js';
import {buildArchipelago} from '../archipelago.js';
import {bakeShoreTexture,createWaterMesh} from '../water-shader.js';
const box=(x,y,z,w,h,d,c,parent)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial());m.position.set(x,y,z);return m;};
test('shore bake: 0 on land, grows with distance, capped at low res',()=>{
  const t=bakeShoreTexture([{x:0,z:0,w:4,d:4}],{x0:-20,z0:-20,w:40,d:40});
  const {data,width,height}=t.image;assert.ok(width<=256&&height<=256);
  const at=(x,z)=>data[Math.floor((z+20)/40*height)*width+Math.floor((x+20)/40*width)];
  assert.equal(at(0,0),0);assert.ok(at(4,0)>0&&at(4,0)<at(8,0));assert.equal(at(19,19),255);
});
test('archipelago water: one shader mesh, no separate deep plane, quality flags',()=>{
  const level=generateLevel(1,'water-s','archipelago');
  for(const [props,caustics,lite] of [[1,1,false],[.55,0,true]]){
    const g=new THREE.Group();buildArchipelago(level,g,box,{quality:{props}});
    const waters=g.children.filter(c=>c.material?.isShaderMaterial&&c.userData.waterShader);
    assert.equal(waters.length,1);assert.equal(waters[0].name,'water');
    assert.equal(waters[0].material.uniforms.caustics.value,caustics);
    assert.equal('WATER_LITE' in waters[0].material.defines,lite);
    assert.ok(!g.children.some(c=>c.material?.isMeshBasicMaterial&&c.geometry?.type==='PlaneGeometry'),'no extra deep plane draw');
  }
});
test('water time is driven by onBeforeRender, no allocations needed',()=>{
  const m=createWaterMesh([],{x0:0,z0:0,w:10,d:10});assert.equal(typeof m.onBeforeRender,'function');m.onBeforeRender();assert.ok(m.material.uniforms.time.value>=0);
});
