import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {coastlineProfile,separateArchipelagoCoastProfiles} from '../coastline.mjs';
import {registerWalkableCoast,isPointOnFloor,hasWalkableCoast,walkableBoundary} from '../archipelago-playable.mjs?v=2.28.84-organic-v2';
import {movePlayer} from '../physics.mjs';
import {generateLevel} from '../levels.js';
import {buildArchipelago,isArchipelagoPartitionWallV2,archipelagoRockFreeBridgeLandingsV2} from '../archipelago.js';
import {distanceToIsland,planArchipelagoBoatsV2,createArchipelagoDinghyV2} from '../archipelago-boats-v2.mjs';
import {planArchipelagoBedrock,planArchipelagoPines,archipelagoCoastalPine,setArchipelagoPineOpacity} from '../archipelago-visual-v2.mjs';
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
    assert.equal(granite.length,islands.length-1,'hero coastal cliffs replace detached granite meshes');
    assert.equal(coastal.filter(o=>o.userData.heroIsland).length,1,'only the representative island is re-authored');
    assert.equal(group.children.filter(o=>o.name==='arch-v2-rock-cut-portal').length,1);
    assert.ok(group.children.some(o=>o.name==='arch-v2-rock-cut-portal'&&o.userData.integratedHero),
      'hero bunker entrance is anchored directly into the new coastal cliff');
    assert.ok(group.children.some(o=>o.name==='arch-v2-distant-skerry'),'distant landscape adds a sense of scale');
    assert.ok(out.boats>=1,'v2 has at least one nearshore boat');
    assert.equal(group.children.filter(o=>o.name==='arch-v2-coastal-dinghy').length,out.boats,
      'all v2 boats use the sculpted dinghy, never a rectangular placeholder');
    const water=group.children.find(o=>o.name==='water');
    assert.equal(water.material.uniforms.cSky.value.getHexString(),'58788d');
    assert.equal(water.material.uniforms.cRose.value.getHexString(),'a87b8c');
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


test('v2 places high granite only outside the island and preserves open bridge landings',()=>{
  for(const number of [1,2,3])for(const seed of ['archipelago-v2-target','review-1']){
    const original=globalThis.location;
    globalThis.location={search:'?area=archipelago&archVisual=v2&archTarget=1'};
    const level=generateLevel(number,seed,'archipelago');
    const group=new THREE.Group();
    const box=(x,y,z,w,h,d,color,parent=group)=>{
      const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
      o.position.set(x,y,z);parent.add(o);return o;
    };
    try{
      const originals=level.walls.map(w=>({...w}));
      const out=buildArchipelago(level,group,box,{quality:{props:1}});
      assert.equal(out.visualV2,true);
      assert.equal(group.children.filter(o=>o.name==='archipelago-rock').length,0,
        'v2 must not retain legacy linear stone rows');
      assert.equal(group.children.filter(o=>o.name==='arch-v2-bedrock-bank').length,0,
        'no tall climbable-looking rocks in the interior of a planar X/Z game');

      const granite=group.children.filter(o=>o.name==='arch-v2-glacial-shelves');
      assert.equal(granite.length,level.floors.filter(f=>!f.dir).length-1,
        'hero island must have NO separate offshore granite mass');
      assert.ok(granite.every(g=>g.userData.visualOnly),'other islands keep their existing visual-only granite');
      assert.equal(out.heroIsland,true,'target flag authors the hero island');
      const heroShell=group.children.filter(o=>o.name==='archipelago-coast-shell'&&o.userData.heroIsland);
      assert.equal(heroShell.length,1,'hero cliffs live in one existing coast shell, not a detached rock layer');
      assert.equal(heroShell[0].userData.heroRings,14);
      assert.equal(heroShell[0].material.flatShading,false,
        'the sculpted hero granite keeps smooth worn rock normals, not a faceted retaining wall');
      assert.equal(heroShell[0].geometry.getAttribute('position').count,14*72);
      assert.ok(out.heroHeadlands?.length>0,'authored hero has a meaningful geological headland');
      if(number===1)assert.ok(out.heroHeadlands.length>=2,'hero preview composes two or more distinct rocky headlands');
      const heroVertices=heroShell[0].geometry.getAttribute('position');
      const heroFloor=level.floors.find(f=>!f.dir);
      const radii=walkableBoundary(heroFloor);
      assert.equal(radii.length,72,'hero coastline is registered for X/Z player collision');
      for(let j=0;j<72;j++){
        const x=heroVertices.getX(j),z=heroVertices.getZ(j);
        const seam=Math.hypot(x-heroFloor.x,z-heroFloor.z)+.045;
        assert.ok(Math.abs(seam-radii[j])<.012,
          'registered walkable boundary equals the actual flat edge of the raised coast');
        const a=j*Math.PI*2/72,c=Math.cos(a),sn=Math.sin(a);
        const inside=Math.min(heroFloor.w/2/Math.max(1e-8,Math.abs(c)),
          heroFloor.d/2/Math.max(1e-8,Math.abs(sn)));
        assert.ok(radii[j]>inside+.15,
          'the entire original authored gameplay rectangle remains walkable in narrow water gaps');
      }
      const cliffHeights=Array.from({length:72},(_,i)=>heroVertices.getY(6*72+i));
      assert.ok(Math.max(...cliffHeights)>1.05,'hero cliffs must be clearly visible in actual gameplay');
      assert.ok(Math.max(...cliffHeights)-Math.min(...cliffHeights)>.7,'island coast must not be a uniform retaining wall');
      for(const zone of out.rockFreeLandings)for(let i=0;i<heroVertices.count;i++){
        if(heroVertices.getY(i)<.10)continue;
        const x=heroVertices.getX(i),z=heroVertices.getZ(i);
        assert.ok(Math.abs(x-zone.x)>=zone.w/2-.04||Math.abs(z-zone.z)>=zone.d/2-.04,
          'sculpted hero cliff must not rise into the protected bridge approach');
      }
      assert.ok(group.children.every(o=>o.name!=='arch-v2-bedrock-roots'),
        'no second coplanar rock skirt or false elevated gameplay floor');
      assert.equal(out.rockFreeLandings.length,out.bridgeClearances.length);
      const expected=archipelagoRockFreeBridgeLandingsV2(out.bridgeClearances);
      assert.deepEqual(out.rockFreeLandings,expected,'same bridge exclusion zones used by placement and tests');
      for(const zone of out.rockFreeLandings){
        const crosses=r=>Math.abs(r.x-zone.x)<(r.w+zone.w)/2+1e-5
          &&Math.abs(r.z-zone.z)<(r.d+zone.d)/2+1e-5;
        // Rock-free zone is deliberately larger than the hard gameplay clearance.
        // Short, man-made interior cover may remain beyond the actual landing.
        for(const g of granite)for(const part of [...g.userData.bedrockPlan.masses,...g.userData.bedrockPlan.shelves])
          assert.ok(!crosses(part.bounds),'coastal granite must be outside the enlarged bridge approach');
      }
      // No invisible rock wall: every runtime wall collision is backed by
      // an exactly matching visible manufactured-cover mesh.
      const cover=group.children.filter(o=>o.userData.naturalCover
        &&!level.boxes.some(c=>c===o.userData.collider));
      for(const zone of out.bridgeClearances){
        const crosses=r=>Math.abs(r.x-zone.x)<(r.w+zone.w)/2+.28
          &&Math.abs(r.z-zone.z)<(r.d+zone.d)/2+.28;
        assert.ok(!level.walls.some(crosses),'the physical bridge landing stays clear of blocking cover');
      }
      const expectedPartitions=originals.filter(w=>isArchipelagoPartitionWallV2(w,level.rooms));
      assert.ok(cover.length<=expectedPartitions.length*4);
      if(number===2)assert.ok(cover.length>0,'partition encounters retain physically readable cover');
      assert.deepEqual(level.walls,cover.map(m=>m.userData.collider),
        'every blocking partition collider maps to exactly one visible natural obstacle');
      assert.equal(group.children.filter(o=>o.name==='arch-v2-interior-concrete-cover'
        ||o.name==='archipelago-derelict-concrete-cover').length,0,
        'natural island gameplay must not generate concrete cover');
      for(const m of cover){
        assert.ok(m.userData.naturalCover,'an interior obstacle must be an organic rock or fallen pine');
        assert.ok(m.userData.visualHeight<=1.20,'cover must remain low in the strictly planar game');
        assert.ok(Math.max(m.userData.collider.w,m.userData.collider.d)<=2.16,
          'isolated natural cover must not form an artificial long wall');
        assert.ok(m.children.length>=1,'each collider has readable, visible geometry');
        assert.ok(m.userData.collider.w>0&&m.userData.collider.d>0);
      }
      const propCover=group.children.filter(o=>o.userData.naturalCover
        &&level.boxes.some(c=>c===o.userData.collider));
      assert.equal(propCover.length,level.boxes.length,
        'all preexisting cover boxes also render as small natural features in v2');
      assert.ok(propCover.every(m=>m.userData.collider
        &&['boulder','windfall'].includes(m.userData.coverKind)),
        'no man-made blocks are scattered across natural skerries');
      for(const m of [...cover,...propCover]){
        const collider=m.userData.collider;
        const actual=new THREE.Box3().setFromObject(m);
        const realW=actual.max.x-actual.min.x,realD=actual.max.z-actual.min.z;
        assert.ok(realW>collider.w*.55&&realW<collider.w*1.25,
          'natural cover must not visually underfill or overhang its X collision');
        assert.ok(realD>collider.d*.55&&realD<collider.d*1.25,
          'natural cover must not visually underfill or overhang its Z collision');
      }
      for(const c of level.corridors??[]){
        const alongX=!!c.dir.x,axis=alongX?'x':'z',length=alongX?c.w:c.d;
        if(length<1.8)continue;
        const from={x:c.x-(alongX?length*.5-.7:0),z:c.z-(alongX?0:length*.5-.7)};
        const delta={x:alongX?length-1.4:0,z:alongX?0:length-1.4};
        const moved=movePlayer(from,delta,[...level.walls,...level.boxes],level.floors,.36);
        assert.ok(moved[axis]-from[axis]>length-1.9,
          'operator must traverse the entire flat bridge deck without cover pinching the route');
      }
      // Navigation remains two dimensional; no authored vertical floor is added.
      assert.ok(level.floors.every(f=>!('y' in f)||f.y===0));
    }finally{
      if(original===undefined)delete globalThis.location;else globalThis.location=original;
      group.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();
        if(o.material&&!o.material.userData.shared)o.material.dispose();});
    }
  }
});

test('reconciled coastlines separate actual island surfaces and their outer erosion shells',()=>{
  for(const seed of ['archipelago-v2-target','review-1','review-21'])
    for(const number of [1,2,3]){
      const level=generateLevel(number,seed,'archipelago');
      const all=level.floors.filter(f=>!f.dir).map(f=>coastlineProfile(f,level.seed,{style:'v2',neighbors:level.floors}));
      separateArchipelagoCoastProfiles(all);
      const snapshot=JSON.stringify(all.map(p=>p.points));
      separateArchipelagoCoastProfiles(all);
      assert.equal(JSON.stringify(all.map(p=>p.points)),snapshot,'separation must be deterministic and idempotent');
      for(const p of all){
        assert.equal(p.separationConflicts??0,0,seed+'/'+number+' authored islands need room for a water gap');
        for(const other of all.filter(q=>q!==p)){
          const dx=other.floor.x-p.floor.x,dz=other.floor.z-p.floor.z,d=Math.hypot(dx,dz);
          for(const v of p.points){
            const signed=(v.x-(p.floor.x+other.floor.x)*.5)*dx+(v.z-(p.floor.z+other.floor.z)*.5)*dz;
            assert.ok(signed<=-.54*d+1e-4,'entire shoreline remains on its side of shared water channel');
          }
        }
      }
    }
});


test('v2 coastal pines alternate silhouette, height and orientation without gameplay colliders',()=>{
  const level={floors:[{x:0,z:0,w:20,d:20}]};
  const spots=[{x:-8,z:-8},{x:0,z:-8},{x:8,z:-8},{x:-8,z:0},{x:8,z:0},
    {x:-8,z:8},{x:0,z:8},{x:8,z:8},{x:5,z:5}];
  const a=planArchipelagoPines(level,spots),b=planArchipelagoPines(level,spots);
  assert.deepEqual(a,b,'pine variants and placements should be deterministic for a fixed seed/layout');
  assert.equal(a.length,5,'five widely spaced pines should fit this island edge');
  assert.ok(new Set(a.map(p=>p.pineVariant)).size>=4,'four distinctive pine silhouettes alternate across the island');
  const trees=a.map(p=>archipelagoCoastalPine(p)),low=archipelagoCoastalPine(a[0],{low:true});
  assert.ok(new Set(trees.map(p=>p.rotation.y.toFixed(3))).size>=4,'rotate trees independently');
  assert.ok(trees.some(p=>p.userData.pineHeight<2.5),'shoreline scrub pines stay low');
  assert.ok(trees.some(p=>p.userData.pineHeight>4.5),'tall sentinels must exist');
  assert.ok(trees.every(p=>p.userData.visualOnly&&!p.userData.collider));
  assert.ok(low.pineMeshes.length<trees[0].pineMeshes.length,
    'LOW keeps the core silhouette but reduces branch geometry');
});

test('v2 pines fade independently and restore opaque materials and shadows',()=>{
  const a=archipelagoCoastalPine({x:1,z:2,pineVariant:2,pineSeed:120});
  const b=archipelagoCoastalPine({x:4,z:5,pineVariant:2,pineSeed:121});
  const original=a.pineMeshes.map(m=>m.material);
  assert.equal(original[0],b.pineMeshes[0].material,'opaque materials should be shared');
  setArchipelagoPineOpacity(a,.22);
  assert.equal(a.userData.pineOpacity,.22);
  assert.ok(a.pineMeshes.every(m=>m.material.transparent&&!m.material.depthWrite
    &&Math.abs(m.material.opacity-.22)<1e-6&&!m.castShadow));
  assert.ok(b.pineMeshes.every(m=>!m.material.transparent&&m.castShadow),
    'fading one tree must not affect the entire forest');
  assert.ok(a.pineFadeMaterials.size<=4,'share faded mats within a tree for mobile efficiency');
  setArchipelagoPineOpacity(a,1);
  assert.ok(a.pineMeshes.every((m,i)=>m.material===original[i]&&m.castShadow),
    'trees must return to their original materials and shadows');
});
