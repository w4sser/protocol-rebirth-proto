import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from '../vendor/three.module.js';
import {loadKit} from '../town.js';
const scene=()=>{const s=new THREE.Scene();s.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));return {scene:s};};
const items=['a','b','c','d'].map(k=>({key:k,url:k+'.glb',dims:[2,1,3]}));
test('one failing GLB gets a procedural stand-in (after retries) instead of failing the whole area',async()=>{
  let calls=0;const loader={loadAsync:async u=>{calls++;if(u.includes('/c.glb'))throw new Error('Load failed');return scene();}};
  const report={failed:[],retried:0,ms:0},kit=await loadKit('https://x/',items,{loader,retries:2,report});
  assert.deepEqual(Object.keys(kit).sort(),['a','b','c','d']);assert.equal(kit.c[0].standIn,true);assert.equal(kit.c[0].geometry.userData.shared,true);
  assert.equal(report.failed.length,1);assert.equal(report.failed[0].key,'c');assert.match(report.failed[0].error,/Load failed/);assert.equal(report.retried,2);assert.equal(calls,6);});
test('a hanging GLB times out and is stood in; concurrency is bounded',async()=>{
  let live=0,peak=0;const loader={loadAsync:u=>u.includes('/b.glb')?new Promise(()=>{}):new Promise(r=>{live++;peak=Math.max(peak,live);setTimeout(()=>{live--;r(scene());},5);})};
  const report={failed:[],retried:0,ms:0},kit=await loadKit('https://x/',items,{loader,retries:0,timeoutMs:50,concurrency:2,report});
  assert.equal(kit.b[0].standIn,true);assert.match(report.failed[0].error,/timeout/);assert.ok(peak<=2);});
