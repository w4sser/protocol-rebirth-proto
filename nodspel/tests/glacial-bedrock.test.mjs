import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {generateLevel} from '../levels.js';
import {planMilitaryRemnantsDressing} from '../polyfork-military-remnants.mjs';
import {safeGlacialFootprint,glacialFootprint,GLACIAL_W,GLACIAL_D,GLACIAL_DOOR_SETBACK} from '../glacial-bedrock-layout.mjs';
import {renderGlacialBedrock,glacialAssetUrl} from '../glacial-bedrock.mjs';
import {PORTAL_ROOF,renderMilitaryArchitecture} from '../military-architecture.mjs';

const overlap=(a,b,pad=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+pad&&Math.abs(a.z-b.z)<(a.d+b.d)/2+pad;
const modelNames=['glacial_headland_high.glb','glacial_headland_low.glb','glacial_portal_high.glb','glacial_portal_low.glb'];
test('original glacial GLBs have valid binary glTF, normals, vertex colors, no textures and bounded LODs',async()=>{
  for(const name of modelNames){
    const bytes=await readFile(new URL('../assets/env/glacial/'+name,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),'glTF');
    assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const jsonLength=bytes.readUInt32LE(12);
    assert.equal(bytes.readUInt32LE(16),0x4E4F534A);
    const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
    const offset=20+jsonLength;
    assert.equal(bytes.readUInt32LE(offset+4),0x004E4942);
    assert.equal(gltf.buffers[0].byteLength,bytes.readUInt32LE(offset));
    assert.equal(gltf.meshes.length,1);
    assert.equal(gltf.materials.length,1);
    assert.equal(gltf.images?.length??0,0,'no texture download per cliff');
    assert.equal(gltf.materials[0].pbrMetallicRoughness.metallicFactor,0);
    const p=gltf.meshes[0].primitives[0];
    for(const key of ['POSITION','NORMAL','COLOR_0'])assert.ok(p.attributes[key]!=null);
    assert.equal(gltf.accessors[p.attributes.COLOR_0].count,gltf.accessors[p.attributes.POSITION].count);
    assert.equal(gltf.accessors[p.attributes.NORMAL].count,gltf.accessors[p.attributes.POSITION].count);
    const tris=gltf.accessors[p.indices].count/3;
    assert.equal(tris,name.includes('low')?282:900);
    assert.ok(bytes.length<26000);
    const bbox=gltf.accessors[p.attributes.POSITION];
    assert.ok(bbox.min[1]<=-1.2,'submerged shoreline skirt');
    assert.ok(bbox.max[1]>4.4,'must read as a large cliff rather than a beach rock');
    assert.ok(bbox.max[0]-bbox.min[0]>=12.7);
    assert.ok(bbox.max[2]-bbox.min[2]>=8);
    // Exercise the actual runtime loader against the physical GLB bytes.
    const loader=new GLTFLoader();
    const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    const parsed=await loader.parseAsync(buffer,'file:///');
    const mesh=parsed.scene.children[0];
    assert.ok(mesh?.isMesh,'glTF is actually loadable as a Three.js mesh');
    assert.ok(mesh.geometry.getAttribute('color'));
    assert.ok(mesh.geometry.getAttribute('normal'));
  }
});
test('all portals are recessed into a valid glacial bedrock ridge, never sea-facing isolated props',()=>{
  let backed=0,landmasses=0;
  for(const big of [false,true])for(let i=0;i<16;i++){
    const level=generateLevel(big?1:2,'glacial-world-'+big+'-'+i,'archipelago',false,big);
    const original={floors:JSON.stringify(level.floors),walls:JSON.stringify(level.walls),boxes:JSON.stringify(level.boxes)};
    const p=planMilitaryRemnantsDressing(level),q=planMilitaryRemnantsDressing(level,{quality:'low'});
    assert.deepEqual(p.cliffs,q.cliffs,'same landmasses on HIGH and LOW');
    assert.ok(p.cliffs.length<= (big?3:2),'one portal plus at most two independent ridges');
    assert.deepEqual({floors:JSON.stringify(level.floors),walls:JSON.stringify(level.walls),boxes:JSON.stringify(level.boxes)},original,'no gameplay collision/geometry edits');
    assert.ok(p.militaryLandmarks.every(s=>s.scene!=='sealed-rock-portal'||s.cliffBacked));
    for(const portal of p.militaryLandmarks.filter(s=>s.scene==='sealed-rock-portal')){
      backed++;
      const rock=p.cliffs.find(s=>s.kind==='portal'&&Math.hypot(s.center.x-portal.center.x,s.center.z-portal.center.z)<.02);
      assert.ok(rock,'every portal must have its actual 3D cliff mesh');
      assert.ok(GLACIAL_DOOR_SETBACK>0&&GLACIAL_DOOR_SETBACK<GLACIAL_D*.35);
    }
    for(let ci=0;ci<p.cliffs.length;ci++){
      const c=p.cliffs[ci],footprint=glacialFootprint(c,c.scale);
      landmasses++;
      assert.ok(safeGlacialFootprint(level,c,p.cliffs.filter((_,j)=>ci!==j),c.scale));
      assert.ok(!level.floors.some(f=>overlap(f,footprint,.03)),'visual rock cannot block actual floor or bridge');
      assert.ok(c.visualOnly);
      assert.ok(footprint.w>=GLACIAL_D*.85&&footprint.d>=GLACIAL_D*.85);
    }
  }
  assert.ok(backed>=6,'a substantial percentage of Archipelago raids should show an actual rockcut doorway');
  assert.ok(landmasses>=12,'large rock headlands must occur regularly to diversify the coastline');
});
test('notches and roof/weather material planes are separated by visible real gaps',()=>{
  const {lintelY,lintelH,capY,capH,mossTop}=PORTAL_ROOF;
  assert.ok(capY-capH/2 - (lintelY+lintelH/2)>.015,'upper concrete roof cannot z-fight with lower lintel');
  assert.ok(mossTop+.022-.033/2 - (capY+capH/2)>.004,'lichen cannot z-fight with the concrete roof');
  const site={scene:'sealed-rock-portal',center:{x:20,z:10},ry:0,
    islandIndex:0,width:3.45,depth:1.35,height:2.05,cliffBacked:true,visualOnly:true};
  const parent=new THREE.Group();
  const piece=renderMilitaryArchitecture([site],parent,{quality:'high',seed:'glacial-test'});
  assert.ok(piece.stats.parts>10);
  assert.ok(piece.stats.drawCalls<=22);
  piece.dispose();
});
test('shared instanced cliff GLBs honor per-site orientation, material and quality without changing collision',async()=>{
  const sites=[
    {kind:'portal',center:{x:18,z:30},ry:Math.PI/2,scale:1,islandIndex:0,visualOnly:true},
    {kind:'headland',center:{x:-21,z:24},ry:0,scale:.9,islandIndex:1,visualOnly:true},
    {kind:'headland',center:{x:34,z:-12},ry:Math.PI,scale:1.08,islandIndex:2,visualOnly:true},
  ];
  const geom=new THREE.BoxGeometry(1,1,1);
  const cols=new Float32Array(geom.attributes.position.count*3).fill(.5);
  geom.setAttribute('color',new THREE.BufferAttribute(cols,3));
  const source=new THREE.Group();
  source.add(new THREE.Mesh(geom,new THREE.MeshStandardMaterial({vertexColors:true})));
  const parent=new THREE.Group();
  for(const quality of ['high','low']){
    const a=renderGlacialBedrock(sites,parent,{quality,load:async()=>({scene:source})});
    await a.ready;
    assert.equal(a.stats.planned,3);
    assert.equal(a.stats.loaded,3);
    assert.equal(a.stats.failed.length,0);
    assert.equal(a.stats.meshes,2,'one draw call per reused GLB type');
    assert.equal(a.stats.drawCalls,2);
    assert.ok(a.group.children.every(o=>o.isInstancedMesh&&o.userData.visualOnly));
    assert.ok(a.group.children.every(o=>o.castShadow===(quality==='high')));
    const headland=a.group.children.find(o=>o.name==='glacial-bedrock-headland');
    assert.equal(headland.count,2);
    const matrix=new THREE.Matrix4();headland.getMatrixAt(0,matrix);
    const p=new THREE.Vector3();matrix.decompose(p,new THREE.Quaternion(),new THREE.Vector3());
    assert.equal(p.x,-21);assert.equal(p.z,24);
    a.dispose();
    assert.equal(parent.children.length,0);
  }
  geom.dispose();
});
