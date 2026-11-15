import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {coastlineProfile} from '../coastline.mjs';
import {registerWalkableCoast,isPointOnFloor,hasWalkableCoast} from '../archipelago-playable.mjs?v=2.28.25-organic-v2';
import {movePlayer} from '../physics.mjs';
import {generateLevel} from '../levels.js';
import {buildArchipelago} from '../archipelago.js';
import {distanceToIsland,planArchipelagoBoatsV2,createArchipelagoDinghyV2} from '../archipelago-boats-v2.mjs';
import {planArchipelagoBedrock} from '../archipelago-visual-v2.mjs';
import {createWaterMesh} from '../water-shader.js';

const F={x:0,z:0,w:12,d:12};

test('v2 coast is deterministic, genuinely walkable outside the old rectangle',()=>{
  const a=coastlineProfile(F,'glacial-01',{style:'v2'});
  const b=coastlineProfile(F,'glacial-01',{style:'v2'});
  assert.deepEqual(a,b);
  assert.equal(a.style,'v2');
  assert.ok(a.points.every(p=>p.playableRadial>p.innerRadial+.15));
  assert.ok(a.points.some(p=>p.playableRadial>p.innerRadial+1.0));
  assert.ok(new Set(a.points.map(p=>Math.round((p.radial-p.innerRadial)*2))).size>=3,'not uniform circular or rectangular outline');
  registerWalkableCoast(F,a);
  assert.equal(hasWalkableCoast(F),true);
  assert.ok(isPointOnFloor(F,0,0));
  assert.ok(isPointOnFloor(F,6.5,0),'former rectangle boundary is no longer the walk limit');
  assert.ok(!isPointOnFloor(F,14,0),'the island still has a real boundary');
  const moved=movePlayer({x:5.1,z:0},{x:2,z:0},[],[F],.25);
  assert.ok(moved.x>6.45,'player moves beyond former rectangular floor into the organic island');
  assert.ok(moved.x<12,'player cannot move indefinitely onto water');
});

test('v2 coast has asymmetric glacial headlands and carved coves instead of a rounded rectangle',()=>{
  const island={x:0,z:0,w:18,d:16},a=coastlineProfile(island,'archipelago-v2-target',{style:'v2'});
  const b=coastlineProfile(island,'archipelago-v2-target',{style:'v2'});
  assert.deepEqual(a,b,'the same seed must create the same coastline');
  const ext=a.points.map(p=>p.radial-p.innerRadial);
  assert.ok(Math.max(...ext)-Math.min(...ext)>2.5,'shoreline needs broad, recognizable asymmetry');
  for(const p of a.points)assert.ok(p.playableRadial>p.innerRadial+.15,'keep authored encounters and the walkable lip safe');
  const deltas=a.points.map((p,i)=>Math.abs(p.radial-a.points[(i+1)%a.points.length].radial));
  assert.ok(Math.max(...deltas)<3,'coast should be sculpted rather than spiky');
});

test('connected islands preserve a water gap and an authored bridge',()=>{
  const left={x:0,z:0,w:12,d:12},right={x:16,z:0,w:12,d:12};
  const profiles=[left,right].map(f=>coastlineProfile(f,'bridge-water',{style:'v2',neighbors:[left,right]}));
  const l=profiles[0].points[0],r=profiles[1].points[profiles[1].points.length/2];
  assert.ok(r.x>l.x+.75,'opposing shorelines leave visible water and bridge structure');
  assert.ok(l.playableRadial>l.innerRadial,'left playable extension remains organic');
  assert.ok(r.playableRadial>r.innerRadial,'right playable extension remains organic');
});

test('the real Archipelago build connects terrain, water and walkable coast without changing authored rooms',()=>{
  const original=globalThis.location;
  globalThis.location={search:'?area=archipelago&archVisual=v2&archTarget=1&ground=2'};
  const level=generateLevel(1,'archipelago-v2-target','archipelago');
  const authorFloors=JSON.stringify(level.floors);
  const group=new THREE.Group();
  const box=(x,y,z,w,h,d,color,parent=group)=>{
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
    o.position.set(x,y,z);parent.add(o);return o;
  };
  try{
    const out=buildArchipelago(level,group,box,{quality:{props:1}});
    assert.equal(out.visualV2,true);
    const islands=level.floors.filter(f=>!f.dir);
    assert.ok(islands.length>0);
    assert.ok(islands.every(hasWalkableCoast),'all islands use organic physical boundaries');
    assert.equal(JSON.stringify(level.floors),authorFloors,'authoring and spawn geometry unchanged');
    const coastal=group.children.filter(o=>o.name==='archipelago-coast-shell');
    const granite=group.children.filter(o=>o.name==='arch-v2-glacial-shelves');
    assert.equal(coastal.length,islands.length);
    assert.equal(granite.length,islands.length);
    assert.equal(group.children.filter(o=>o.name==='arch-v2-rock-cut-portal').length,1);
    assert.ok(group.children.some(o=>o.name==='arch-v2-distant-skerry'),'distant landscape adds a sense of scale');
    assert.ok(out.boats>=1,'v2 has at least one nearshore boat');
    assert.equal(group.children.filter(o=>o.name==='arch-v2-coastal-dinghy').length,out.boats,
      'all v2 boats use the sculpted dinghy, never a rectangular placeholder');
    const water=group.children.find(o=>o.name==='water');
    assert.equal(water.material.uniforms.cSky.value.getHexString(),'8399b1');
    assert.equal(water.material.uniforms.cRose.value.getHexString(),'c99dae');
    assert.ok(Object.hasOwn(water.material.defines,'WATER_BALTIC'),'v2 uses still-Baltic reflection shader');
    assert.ok(!level.walls.some(w=>w.shore),'obsolete rectangular shoreline collider removed');
    assert.ok(islands.every(f=>isPointOnFloor(f,f.x,f.z)));
  }finally{
    if(original===undefined)delete globalThis.location;else globalThis.location=original;
    group.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();
      if(o.material&&!o.material.userData.shared)o.material.dispose();});
  }
});

test('legacy Archipelago mode retains rectangle-based physics',()=>{
  const f={x:0,z:0,w:12,d:12};
  assert.equal(hasWalkableCoast(f),false);
  assert.ok(!isPointOnFloor(f,6.1,0));
  const moved=movePlayer({x:5.1,z:0},{x:2,z:0},[],[f],.25);
  assert.ok(moved.x<=5.9);
});

test('boat hull is an open, pointed dinghy rather than a rectangular box',()=>{
  const boat=createArchipelagoDinghyV2({x:4,z:-3,rotation:.4});
  assert.equal(boat.name,'arch-v2-coastal-dinghy');
  assert.equal(boat.userData.visualOnly,true);
  assert.equal(boat.userData.collider,undefined);
  assert.equal(boat.children[0].name,'arch-v2-tapered-hull');
  const geom=boat.children[0].geometry,points=geom.getAttribute('position');
  assert.ok(points.count>40,'the boat has a shaped hull and visible open interior');
  assert.ok(boat.children.length>=3,'a recognizable interior and wooden seats');
  const atBow=[];
  for(let i=0;i<11;i++)if(points.getZ(i)>1.3)atBow.push(Math.abs(points.getX(i)));
  assert.ok(Math.max(...atBow)<.5,'the bow must taper to a point');
  assert.equal(boat.position.y,-.35,'hull floats at the actual water plane');
  assert.equal(geom.userData.shared,true,'reuse hull geometry without leaking on rebuild');
});

test('nearshore dinghies always float outside organic land, bridges and other boats',()=>{
  for(const seed of ['archipelago-v2-target','review-1','review-21','bridge-water','cove-02'])
    for(const depth of [1,2,3]){
      const level=generateLevel(depth,seed,'archipelago');
      const profiles=level.floors.filter(f=>!f.dir).map(f=>coastlineProfile(f,level.seed,{style:'v2',neighbors:level.floors}));
      const rockPlans=profiles.map(p=>planArchipelagoBedrock(p));
      const high=planArchipelagoBoatsV2(profiles,level.floors,level.seed,{bedrockPlans:rockPlans});
      const low=planArchipelagoBoatsV2(profiles,level.floors,level.seed,{bedrockPlans:rockPlans});
      assert.deepEqual(high,low,'boat placement must not vary with quality, FPS or boot order');
      assert.ok(high.length>=1&&high.length<=3,seed+'/'+depth+' should have one to three boats');
      for(const boat of high){
        assert.ok(Number.isFinite(boat.rotation));
        assert.ok(boat.shoreDistance>2.30,'conservative water gap keeps hull on water');
        for(const profile of profiles){
          assert.ok(distanceToIsland(boat.x,boat.z,profile.points)>2.30,
            seed+'/'+depth+' hull overlaps the true island shoreline');
          for(let n=0;n<16;n++){
            const a=n/16*Math.PI*2,px=boat.x+Math.cos(a)*1.82,pz=boat.z+Math.sin(a)*1.82;
            assert.ok(distanceToIsland(px,pz,profile.points)>.25,
              seed+'/'+depth+' hull perimeter intersects land');
          }
        }
        for(const f of level.floors.filter(f=>f.dir)){
          const dx=Math.max(Math.abs(boat.x-f.x)-f.w/2,0),dz=Math.max(Math.abs(boat.z-f.z)-f.d/2,0);
          assert.ok(Math.hypot(dx,dz)>2.30,'boat must clear bridge and pier footprints');
        }
        for(const rock of rockPlans.flatMap(q=>[...q.masses,...q.shelves])){
          const f=rock.bounds,dx=Math.max(Math.abs(boat.x-f.x)-f.w/2,0),dz=Math.max(Math.abs(boat.z-f.z)-f.d/2,0);
          assert.ok(Math.hypot(dx,dz)>2.15,'boat must not sit over visible offshore granite');
        }
      }
      for(let i=0;i<high.length;i++)for(let j=i+1;j<high.length;j++)
        assert.ok(Math.hypot(high[i].x-high[j].x,high[i].z-high[j].z)>5.0,'dinghies cannot overlap');
    }
});


test('pink calm Baltic water is opt-in, low-cost and keeps default water unchanged',()=>{
  const rects=[{x:0,z:0,w:3,d:3}],bounds={x0:-5,z0:-5,w:10,d:10};
  const calm=createWaterMesh(rects,bounds,{balticCalm:true,caustics:false,lite:true});
  const defaultSea=createWaterMesh(rects,bounds,{lite:true});
  assert.ok(Object.hasOwn(calm.material.defines,'WATER_BALTIC'));
  assert.ok(Object.hasOwn(calm.material.defines,'WATER_LITE'),'LOW shares the same calm look');
  assert.ok(!calm.material.fragmentShader.includes('p.z'),'a 2D water coordinate must not access a nonexistent z component');
  assert.equal(calm.material.uniforms.caustics.value,0,'no expensive fake caustics on still water');
  assert.ok(!Object.hasOwn(defaultSea.material.defines,'WATER_BALTIC'),'normal Archipelago keeps legacy waves');
  assert.equal(defaultSea.material.uniforms.cDeep.value.getHexString(),'06161f');
  for(const sea of [calm,defaultSea]){
    sea.userData.shoreTexture.dispose();sea.material.dispose();sea.geometry.dispose();
  }
});
