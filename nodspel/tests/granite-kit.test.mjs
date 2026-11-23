import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {GRANITE_KIT,graniteFit,planGraniteSlabs,dressGraniteKit,SLAB_RULES} from '../granite-kit.js?v=2.28.72';

// GLTFLoader reads embedded textures via self.URL; browsers have `self`, Node does not.
globalThis.self??=globalThis;
const load=async url=>{
  const file=url.replace('../assets/','../../assets/').split('?')[0];
  const bytes=readFileSync(new URL(file,import.meta.url));
  return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
};
const seq=vals=>{let i=0;return()=>vals[i++%vals.length];};

test('every kit GLB exists, sits on y=0, is a single mesh within budget and uses the shared atlas',async()=>{
  for(const piece of Object.values(GRANITE_KIT))for(const file of [piece.high,piece.low]){
    const scene=await load(`../assets/env/nature/rocks/${file}.glb`);const meshes=[];scene.traverse(n=>{if(n.isMesh)meshes.push(n);});
    assert.equal(meshes.length,1,file);
    const box=new THREE.Box3().setFromObject(scene);
    assert.ok(Math.abs(box.min.y)<.01,`${file} base at y=${box.min.y}`);
    // Node cannot decode images, so check the baked texture in the GLB's own JSON chunk.
    const bytes=readFileSync(new URL(`../../assets/env/nature/rocks/${file}.glb`,import.meta.url));
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
    assert.ok(json.materials[0].pbrMetallicRoughness.baseColorTexture,`${file} has its baked texture`);
    assert.deepEqual(json.images,[{uri:'granite_xl_atlas.jpg'}],`${file} references the shared external atlas`);
    assert.ok(!('NORMAL' in json.meshes[0].primitives[0].attributes),`${file} carries no normals (flat-shaded in game)`);
    const tris=json.accessors[json.meshes[0].primitives[0].indices].count/3;
    assert.ok(tris<=(file.endsWith('_lod1')?300:file.startsWith('rock_shore')?900:700),`${file}: ${tris} tris over budget`);
    assert.ok(bytes.length<=30000,`${file}: ${bytes.length} bytes`);
  }
});

test('graniteFit: long footprints become cliff blocks aligned with their long side',()=>{
  const cliff=graniteFit({min:{x:0,z:0},max:{x:3,z:1,y:1.2}});
  assert.equal(cliff.kind,'cliff');assert.equal(cliff.yaw,0);assert.equal(cliff.along,3);
  const turned=graniteFit({min:{x:0,z:0},max:{x:1,z:3,y:1}});assert.equal(turned.yaw,Math.PI/2);
  assert.equal(graniteFit({min:{x:0,z:0},max:{x:1.2,z:1.1,y:1}}).kind,'boulder');
});

test('slabs keep clear of reservations, walls and cover, and stay on their island',()=>{
  const level={floors:[{x:0,z:0,w:14,d:10}],walls:[{x:4,z:0,w:1,d:10}],boxes:[{x:-4,z:3,w:1,d:1}]};
  const slabs=planGraniteSlabs(level,(x,z,r)=>Math.hypot(x,z)<1.5+r,Math.random);
  assert.ok(slabs.length<=SLAB_RULES.maxPerIsland);
  for(const s of slabs){
    assert.ok(Math.hypot(s.x,s.z)>=1.5+s.r,'outside reservation');
    assert.ok(Math.abs(s.x-4)>=.5+s.r,'clear of wall');
    assert.ok(Math.abs(s.x)+s.r<=7&&Math.abs(s.z)+s.r<=5,'on the island');
  }
  assert.deepEqual(planGraniteSlabs({floors:[{x:0,z:0,w:4,d:4}]},()=>false,Math.random),[],'small islands get none');
});

test('dress swaps rock visuals for three instanced draw calls, never colliders, and pairs wall neighbours',async()=>{
  const group=new THREE.Group(),geo=new THREE.DodecahedronGeometry(1,0),mat=new THREE.MeshStandardMaterial();
  const colliders=[];
  for(let i=0;i<3;i++){
    const m=new THREE.Mesh(geo,mat);m.name='archipelago-rock';m.position.set(i*1.1,.4,0);
    const c={x:i*1.1,z:0,w:1.2,d:1,h:.9};m.userData={collider:c,graniteWall:0,graniteOrder:i};colliders.push({...c});group.add(m);
  }
  const coast=new THREE.Mesh(geo,mat);coast.name='archipelago-coast-rock';coast.position.set(-5,-.1,0);coast.scale.setScalar(.4);group.add(coast);
  const counts=await dressGraniteKit(group,{high:false,slabs:[{x:9,z:0,ry:0,s:.6,r:1},{x:12,z:0,ry:1,s:.7,r:1}],load});
  assert.deepEqual(counts,{boulder:2,cliff:1,slab:2,shore:0});
  const rocks=group.children.filter(n=>n.name.startsWith('archipelago-'));
  assert.ok(rocks.every(r=>!r.visible),'procedural rocks hidden');
  assert.deepEqual(rocks.filter(r=>r.userData.collider).map(r=>r.userData.collider),colliders,'colliders untouched');
  const inst=group.children.filter(n=>n.isInstancedMesh);
  assert.deepEqual(inst.map(n=>[n.name,n.count]).sort(),[['granite-xl-boulder',2],['granite-xl-cliff',1],['granite-xl-slab',2]]);
  assert.equal(new Set(inst.map(n=>n.material)).size,1,'one shared atlas material');
  const cliff=inst.find(n=>n.name==='granite-xl-cliff'),m=new THREE.Matrix4();cliff.getMatrixAt(0,m);
  const box=cliff.geometry.boundingBox.clone().applyMatrix4(m);
  assert.ok(Math.abs(box.min.x-(-.6))<.05&&Math.abs(box.max.x-1.7)<.05,'cliff spans both rocks');
  assert.ok(Math.abs(box.max.y-.9)<.02,'cliff height matches the colliders');
  const slab=inst.find(n=>n.name==='granite-xl-slab');slab.getMatrixAt(0,m);
  assert.ok(slab.geometry.boundingBox.clone().applyMatrix4(m).max.y<=SLAB_RULES.height,'slab stays low and walkable');
});

test('headless builds keep the procedural fallback (no fetch without a loader)',async()=>{
  assert.equal(await dressGraniteKit(new THREE.Group()),null);
});

test('marked coast rocks become shoreline clusters facing the sea, at their marked spot and size',async()=>{
  const group=new THREE.Group(),geo=new THREE.DodecahedronGeometry(1,0),mat=new THREE.MeshStandardMaterial();
  const rock=new THREE.Mesh(geo,mat);rock.name='archipelago-coast-rock';rock.scale.setScalar(.5);
  rock.userData.graniteShore={x:10,z:0,s:.6,yaw:0};group.add(rock);
  const counts=await dressGraniteKit(group,{high:false,load});
  assert.equal(counts.shore,1);assert.equal(rock.visible,false);
  const shore=group.children.find(n=>n.name==='granite-xl-shore'),m=new THREE.Matrix4();shore.getMatrixAt(0,m);
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();m.decompose(p,q,sc);
  assert.ok(Math.abs(p.x-10)<1e-6&&Math.abs(sc.x-.6)<1e-6&&p.y<0,'placed at the mark, scaled, base under the waterline');
  assert.equal(shore.castShadow,true);
});

test('pines: textured GLBs are grounded and replace pineTree groups with one instanced draw call',async()=>{
  const {dressPines,PINE_KIT}=await import('../granite-kit.js?v=2.28.72');
  const pload=async url=>{const file=url.replace('../assets/','../../assets/').split('?')[0];const bytes=readFileSync(new URL(file,import.meta.url));
    return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;};
  for(const f of [PINE_KIT.high,PINE_KIT.low]){
    const box=new THREE.Box3().setFromObject(await pload(`../assets/env/nature/trees/${f}.glb`));
    assert.ok(Math.abs(box.min.y)<.01&&box.max.y>4,`${f} grounded and tall`);
  }
  const parent=new THREE.Group(),pines=[0,1,2].map(i=>{const g=new THREE.Group();g.name='pine';g.position.set(i*3,0,1);g.rotation.y=i;g.scale.setScalar(.7);parent.add(g);return g;});
  assert.equal(await dressPines(pines,parent,{high:false,load:pload}),3);
  assert.ok(pines.every(g=>!g.visible),'old pines hidden');
  const inst=parent.children.find(n=>n.name==='pine-xl');assert.equal(inst.count,3);
  const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();inst.getMatrixAt(2,m);m.decompose(p,q,s);
  assert.ok(Math.abs(p.x-6)<1e-6&&Math.abs(s.x-.7*PINE_KIT.fit)<1e-6,'keeps spot and size');
});
