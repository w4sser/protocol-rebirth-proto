import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {coastlineProfile,coastCoves,coastSeed,coastBeachAt,coastRingData,COAST_BLEND_STOPS} from '../coastline.mjs';
import {generateLevel} from '../levels.js';
import {buildArchipelago} from '../archipelago.js';

const floor={x:2,z:-3,w:16,d:12};
test('coastline always grows outside logical playfield and rounds the visible corners',()=>{
  for(let seed=0;seed<36;seed++){
    const p=coastlineProfile(floor,'skerry-'+seed);
    assert.equal(p.points.length,72);
    assert.ok(p.rockyRatio>.62&&p.rockyRatio<.90,'rocky shoreline dominates without continuous sand');
    let bends=0;
    for(const v of p.points){
      assert.ok(v.radial>=v.innerRadial+.54,'coast only extends outside collidable rectangle');
      assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.z));
      if(v.kind!=='small_beach')bends++;
    }
    assert.ok(bends>=46);
    assert.ok(p.totalLength>0);
  }
});
test('seeded coves stay narrow and deterministic for HIGH and LOW',()=>{
  const seed=coastSeed('deterministic',floor);
  assert.deepEqual(coastCoves(seed),coastCoves(seed));
  const p=coastlineProfile(floor,'deterministic');
  assert.deepEqual(p,coastlineProfile(floor,'deterministic'));
  assert.notDeepEqual(p.points,coastlineProfile(floor,'different').points);
  assert.equal(coastlineProfile({...floor,dir:{x:1,z:0}},'deterministic'),null);
  for(const c of coastCoves(seed)){
    const theta=c.center*Math.PI*2;
    assert.ok(coastBeachAt(floor,floor.x+Math.cos(theta)*10,floor.z+Math.sin(theta)*10,'deterministic')>.9);
  }
});
test('coast shell has six feathered, continuous inset rings and unchanged gameplay floors',()=>{
  const p=coastlineProfile(floor,'shore-mesh'),b=coastRingData(p),n=p.points.length;
  const count=COAST_BLEND_STOPS.length;
  assert.equal(count,6);
  assert.deepEqual([...COAST_BLEND_STOPS],[0,.12,.53,.87,1,1]);
  assert.equal(b.positions.length,n*count*3);
  assert.equal(b.colors.length,n*count*3);
  assert.equal(b.uvs.length,n*count*2);
  assert.equal(b.blends.length,n*count);
  assert.equal(b.indices.length,n*(count-1)*6);
  assert.ok(b.positions.every(Number.isFinite));
  assert.ok(b.colors.every(v=>v>=0&&v<=1));
  assert.ok(b.indices.every(v=>v<n*count));
  for(let i=0;i<n;i++){
    assert.equal(b.blends[i],0,'inset ring uses pure ground terrain');
    assert.equal(b.blends[4*n+i],1,'coast reaches full granite/sand color');
    assert.ok(b.positions[i*3+1]>.004,'feather lies above preview terrain');
    assert.ok(b.positions[i*3+1]<.018,'feather stays under node progress ring');
    const dx=b.positions[i*3]-p.floor.x,dz=b.positions[i*3+2]-p.floor.z;
    assert.ok(Math.hypot(dx,dz)<p.points[i].innerRadial-.22,'blend starts before rectangular terrain edge');
  }
  assert.deepEqual(floor,{x:2,z:-3,w:16,d:12});
});
test('ground preview shells replace rectangular sand rim only in opt-in terrain mode',()=>{
  const original=globalThis.location;
  globalThis.location={search:'?ground=2'};
  const level=generateLevel(1,'coast-test','archipelago');
  const originalFloors=JSON.stringify(level.floors);
  const group=new THREE.Group();
  const boxes=[];
  const box=(x,y,z,w,h,d,color,parent=group)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
    mesh.position.set(x,y,z);parent.add(mesh);boxes.push({x,y,z,w,h,d,color});return mesh;
  };
  try{
    const info=buildArchipelago(level,group,box);
    const shells=group.children.filter(o=>o.name==='archipelago-coast-shell');
    assert.ok(shells.length>0);
    assert.equal(shells.length,level.floors.filter(f=>!f.dir).length);
    assert.equal(info.coastProfiles,shells.length);
    assert.ok(info.coastRockFraction>.60);
    assert.equal(group.children.filter(o=>o.name==='archipelago-shore-rock').length,0);
    assert.ok(group.children.filter(o=>o.name==='water').length===1);
    assert.ok(boxes.every(b=>!(b.color==='#7a6d52'&&b.w>4)),'no rectangular sand rim in preview');
    assert.equal(JSON.stringify(level.floors),originalFloors,'authoring floor rectangles unchanged');
    for(const mesh of shells){
      assert.equal(mesh.userData.visualOnly,true);
      assert.equal(mesh.geometry.getAttribute('shoreBlend').count,mesh.geometry.getAttribute('position').count);
      assert.equal(mesh.geometry.getAttribute('color').count,mesh.geometry.getAttribute('shoreBlend').count);
    }
  }finally{
    if(original===undefined)delete globalThis.location; else globalThis.location=original;
    group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  }
});
