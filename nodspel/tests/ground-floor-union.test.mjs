import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {clipFloors,addGroundPreview} from '../ground-preview.js';
import {generateDepthLevel} from '../depth-level.js';
import {planFloorTiles,buildBunker,BUNKER_DIMS} from '../bunker.js';
import {fitStructure} from '../environment-look.js';
import {qualitySettings} from '../art.js';

const seeds=['zfight-scan-1','834f4b0a-meta','art','corridor-entrance','depth-union-1128','seams'];
const bounds=f=>[f.x-f.w/2,f.x+f.w/2,f.z-f.d/2,f.z+f.d/2];
function disjoint(floors){
  for(let i=0;i<floors.length;i++)for(let j=i+1;j<floors.length;j++){
    const a=bounds(floors[i]),b=bounds(floors[j]);
    assert.ok(Math.min(a[1],b[1])-Math.max(a[0],b[0])<1e-6 ||
      Math.min(a[3],b[3])-Math.max(a[2],b[2])<1e-6,`overlap ${i}/${j}`);
  }
}
// Independent sweep-line union area, not the subtraction algorithm under test.
function unionArea(floors){
  const rects=floors.map(bounds),xs=[...new Set(rects.flatMap(r=>r.slice(0,2)))].sort((a,b)=>a-b);
  let area=0;
  for(let i=1;i<xs.length;i++){
    const mid=(xs[i-1]+xs[i])/2;
    const intervals=rects.filter(r=>r[0]<mid&&mid<r[1]).map(r=>r.slice(2)).sort((a,b)=>a[0]-b[0]);
    let end=-Infinity,length=0;
    for(const [lo,hi] of intervals){length+=Math.max(0,hi-Math.max(lo,end));end=Math.max(end,hi);}
    area+=(xs[i]-xs[i-1])*length;
  }
  return area;
}
function coverage(original,clipped){
  disjoint(clipped);
  const expected=unionArea(original);
  assert.ok(Math.abs(clipped.reduce((a,f)=>a+f.w*f.d,0)-expected)<1e-6,'full union area');
  // Equal total area alone could hide a gap balanced by an extra strip outside the footprint.
  for(const f of original){
    const a=bounds(f);
    const covered=clipped.reduce((sum,g)=>{const b=bounds(g);return sum+
      Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]))*
      Math.max(0,Math.min(a[3],b[3])-Math.max(a[2],b[2]));},0);
    assert.ok(Math.abs(covered-f.w*f.d)<1e-6,'each original rectangle is fully covered');
  }
}

test('clipFloors handles duplicate, contained, crossing and touching floors without mutation',()=>{
  const floors=[{x:0,z:0,w:8,d:8,tag:'room'},{x:0,z:0,w:8,d:8},
    {x:0,z:0,w:2,d:2},{x:4,z:0,w:4,d:2},{x:0,z:4,w:2,d:4},
    {x:0,z:9,w:2,d:6}];
  const snapshot=structuredClone(floors),result=clipFloors(floors);
  coverage(floors,result);
  assert.equal(result[0].tag,'room');
  assert.deepEqual(floors,snapshot);
  assert.deepEqual(result,clipFloors(floors));
  assert.deepEqual(clipFloors([]),[]);
});

for(const seed of seeds)test(`depth floor union has no overlap or gaps: ${seed}`,()=>{
  const floors=generateDepthLevel(seed).floors,snapshot=structuredClone(floors);
  assert.ok(floors.reduce((n,f)=>n+f.w*f.d,0)>unionArea(floors)+1,'fixture exercises real overlapping joints');
  coverage(floors,clipFloors(floors));
  coverage(floors,planFloorTiles(floors));
  assert.deepEqual(floors,snapshot);
  assert.deepEqual(clipFloors(floors),clipFloors(floors));
});

// Read the real terrain GLB vertex/index buffers locally; texture loading needs no browser/GPU.
function geometryFromGLB(url){
  const data=readFileSync(new URL(url)),jsonLength=data.readUInt32LE(12);
  const doc=JSON.parse(data.subarray(20,20+jsonLength).toString()),binStart=28+jsonLength;
  const primitive=doc.meshes[0].primitives[0];
  function attribute(index,size){
    const a=doc.accessors[index],view=doc.bufferViews[a.bufferView];
    const Type={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];
    assert.ok(Type&&!view.byteStride,'terrain uses packed accessors');
    const offset=binStart+(view.byteOffset??0)+(a.byteOffset??0);
    const bytes=data.subarray(offset,offset+a.count*size*Type.BYTES_PER_ELEMENT);
    return new THREE.BufferAttribute(new Type(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),size);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',attribute(primitive.attributes.POSITION,3));
  geometry.setIndex(attribute(primitive.indices,1));
  return geometry;
}

test('actual preview tile meshes cover the depth union once in HIGH/LOW; decor stays seeded',async t=>{
  t.mock.method(THREE.TextureLoader.prototype,'load',(_url,onLoad)=>onLoad(new THREE.Texture()));
  t.mock.method(GLTFLoader.prototype,'load',(url,onLoad)=>{
    const scene=new THREE.Group();scene.add(new THREE.Mesh(geometryFromGLB(url)));onLoad({scene});
  });
  const level=generateDepthLevel('zfight-scan-1');
  const kit=Object.fromEntries(Object.entries(BUNKER_DIMS).filter(([kind])=>kind.startsWith('floor_')).map(([kind,dims])=>[
    kind,fitStructure([{geometry:geometryFromGLB(new URL(`../../assets/env/bunker/${kind}.glb`,import.meta.url)),
      material:new THREE.MeshStandardMaterial(),matrix:new THREE.Matrix4()}],dims),
  ]));
  for(const profile of ['high','low']){
    const render=async floors=>{
      const scene=new THREE.Scene(),bunker=new THREE.Group();scene.add(bunker);
      buildBunker({...level,floors},bunker,kit,qualitySettings(profile));
      const preview=addGroundPreview({...level,floors},scene,{area:'bunker',profile});
      await preview.ready;assert.equal(preview.stats.error,undefined);assert.equal(preview.stats.ready,true);
      scene.updateMatrixWorld(true);
      const tiles=preview.group.children.filter(m=>m.renderOrder===-2);
      const rects=tiles.map(m=>{
        m.geometry.computeBoundingBox();const b=m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
        assert.ok(Math.abs(b.min.y-.004)<1e-8&&Math.abs(b.max.y-.004)<1e-8);
        assert.equal(m.material.transparent,false);assert.equal(m.material.depthWrite,true);
        return {x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,w:b.max.x-b.min.x,d:b.max.z-b.min.z};
      });
      const decor=preview.group.children.filter(m=>m.renderOrder!==-2).map(m=>({
        position:m.position.toArray(),rotation:m.rotation.toArray(),geometry:m.geometry.uuid,
      }));
      // At real overlapping corridor joints, the opaque preview is above the fitted kit floor.
      // Test geometry placement without pretending this substitutes for a browser screenshot.
      let joints=0;
      for(let i=0;i<level.floors.length;i++)for(let j=i+1;j<level.floors.length;j++){
        const a=bounds(level.floors[i]),b=bounds(level.floors[j]);
        const x0=Math.max(a[0],b[0]),x1=Math.min(a[1],b[1]),z0=Math.max(a[2],b[2]),z1=Math.min(a[3],b[3]);
        if(x1-x0<.1||z1-z0<.1)continue;
        const ray=new THREE.Raycaster(new THREE.Vector3(x0+(x1-x0)*.417,1,z0+(z1-z0)*.613),new THREE.Vector3(0,-1,0));
        const groundHits=ray.intersectObjects(tiles),kitHits=ray.intersectObjects(bunker.children.filter(m=>m.isInstancedMesh));
        assert.equal(groundHits.length,1,'one opaque ground surface at each joint');
        assert.ok(kitHits.length>0,'kit floor is present under the joint');
        assert.ok(kitHits.every(h=>h.point.y<groundHits[0].point.y-1e-3),'kit trim does not share the ground plane');
        joints++;
      }
      assert.ok(joints>0);
      preview.dispose();return {rects,decor};
    };
    const first=await render(level.floors),second=await render(level.floors);
    coverage(level.floors,first.rects);
    assert.deepEqual(second,first,'tile/decor placement is deterministic');
    // These preserve identical indices, bounds and seed while adding only redundant floors.
    const duplicate=await render([...level.floors,...level.floors]);
    assert.deepEqual(duplicate.rects,first.rects,'duplicates do not add tile meshes');
    assert.deepEqual(duplicate.decor.slice(0,first.decor.length),first.decor,'existing seeded decor does not move');
  }
});
