import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,AREAS,AREA_RULES,setArea,RULES} from '../levels.js';
import * as THREE from '../vendor/three.module.js';
import {archipelagoPassages,buildArchipelago} from '../archipelago.js';
import {movePlayer} from '../physics.mjs';
test('area order is bunker → archipelago → town',()=>assert.deepEqual(AREAS,['bunker','archipelago','town']));
test('archipelago is larger, harder and carries the Town Survey on level 3',()=>{
  for(const n of [1,2,3]){const b=generateLevel(n,'arch-s','bunker'),a=generateLevel(n,'arch-s','archipelago');
    assert.equal(a.archipelago,true);assert.equal(a.area,'archipelago');assert.match(a.title,/^Archipelago/);
    const area=L=>L.rooms.reduce((s,r)=>s+r.w*r.d,0);assert.ok(area(a)>area(b)*1.3,'more open');
    const extras=L=>L.enemies.filter(e=>e.extra).length;
    assert.equal(extras(a),AREA_RULES.archipelago.extraEnemies[n-1],'archipelago extra bodies');assert.equal(extras(b),AREA_RULES.bunker.extraEnemies[n-1]);
    // encounter enemies (swarm rushers, generators, ...) carry their own health from RULES.encounters
    assert.ok(a.enemies.filter(e=>!e.encounter).every(e=>e.health>=Math.round((n===3?RULES.enemyHealth:RULES.levels[n-1].enemyHealth)*1.25)));
    assert.ok(a.enemyDamage>b.enemyDamage);
    const solids=[...a.walls,...a.boxes];for(const e of a.enemies.filter(e=>e.extra))assert.ok(!solids.some(o=>Math.abs(e.x-o.x)<o.w/2+.4&&Math.abs(e.z-o.z)<o.d/2+.4),'extra enemy off walls');}
  assert.ok(generateLevel(3,'arch-s','archipelago').lootBoxes.some(b=>b.item==='town_survey'&&b.scout));
  assert.ok(generateLevel(3,'arch-s','bunker').lootBoxes.some(b=>b.item==='archipelago_chart'));
  assert.ok(!generateLevel(2,'arch-s','bunker').lootBoxes.some(b=>b.scout));
});
test('town is gated last and scales hardest',()=>{const t=generateLevel(2,'t','town'),a=generateLevel(2,'t','archipelago');assert.ok(t.enemyDamage>=a.enemyDamage);assert.equal(setArea('archipelago'),'archipelago');setArea('bunker');});
test('archipelago loot leans to tier 2',()=>{let t2=0,base=0;const T2=new Set(Object.keys(RULES.loot.weights[1]).filter(k=>!(k in RULES.loot.weights[0])));
  for(let i=0;i<40;i++){for(const b of generateLevel(1,'lt'+i,'archipelago').lootBoxes)if(T2.has(b.item))t2++;for(const b of generateLevel(1,'lt'+i,'bunker').lootBoxes)if(T2.has(b.item))base++;}
  assert.ok(t2>base,`t2 ${t2} vs ${base}`);});

const contains=(r,p)=>Math.abs(r.x-p.x)<r.w/2&&Math.abs(r.z-p.z)<r.d/2;
const intersects=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2-1e-6&&Math.abs(a.z-b.z)<(a.d+b.d)/2-1e-6;
function renderArchipelago(level){
  const group=new THREE.Group();
  const box=(x,y,z,w,h,d,color,parent=group)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  const info=buildArchipelago(level,group,box);
  return {group,info,dispose(){group.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});}};
}
test('every archipelago doorway and L2 partition has a rock-free ground strip across many seeds',()=>{
  let openings=0,partitions=0;
  for(const n of [1,2,3])for(let seed=0;seed<40;seed++){
    const level=generateLevel(n,`passage-${seed}`,'archipelago'),passages=archipelagoPassages(level);
    for(const room of level.rooms){
      for(const dir of room.doors){
        const mouth={x:room.x+dir.x*(room.w/2-RULES.wallThickness/2),z:room.z+dir.z*(room.d/2-RULES.wallThickness/2)};
        assert.ok(passages.some(p=>contains(p,mouth)),`L${n} seed ${seed}: room opening`);openings++;
      }
      if(room.partition){assert.ok(passages.some(p=>contains(p,room.partition)),`L2 seed ${seed}: partition`);partitions++;}
    }
    for(const p of passages){
      assert.ok(Math.min(p.w,p.d)>=.8,'player-width clearance');
      assert.ok(!level.walls.some(w=>intersects(w,p)),'no rock collider inside passage clearance');
      const delta=p.axis==='x'?{x:0,z:p.d*.8}:{x:p.w*.8,z:0};
      const start={x:p.x-delta.x/2,z:p.z-delta.z/2};
      for(const sign of [-1,1]){
        const from=sign===1?start:{x:start.x+delta.x,z:start.z+delta.z};
        const end=movePlayer(from,{x:sign*delta.x,z:sign*delta.z},level.walls,level.floors,.36);
        assert.ok(Math.hypot(end.x-from.x-sign*delta.x,end.z-from.z-sign*delta.z)<1e-5,'actual player collision allows crossing both ways');
      }
    }
  }
  assert.ok(openings>300);assert.equal(partitions,80);
});
test('passages include either orientation, short wall ends and encounter-style offset cuts',()=>{
  // Two openings in one boulder wall: the offset one represents an encounter side route.
  const walls=[{x:-3,z:0,w:4,d:.4,h:1},{x:1.5,z:0,w:1,d:.4,h:1},{x:4.2,z:0,w:.3,d:.4,h:1}];
  for(const rotate of [false,true]){
    const level={walls:walls.map(w=>rotate?{...w,x:w.z,z:w.x,w:w.d,d:w.w}:w),floors:[{x:0,z:0,w:14,d:14}]};
    const passages=archipelagoPassages(level);
    for(const x of [0,3])assert.ok(passages.some(p=>contains(p,rotate?{x:0,z:x}:{x,z:0})),`opening ${x}, rotated ${rotate}`);
  }
});
test('rendered archipelago rock footprints equal actual wall colliders, with clear visible passage strips',()=>{
  for(const n of [1,2,3])for(let seed=0;seed<8;seed++){
    const level=generateLevel(n,`passage-${seed}`,'archipelago'),before=JSON.stringify(level.walls);
    const rendered=renderArchipelago(level),{group,info}=rendered;
    try{
      const rocks=group.children.filter(m=>m.name==='archipelago-rock'),paths=group.children.filter(m=>m.name==='archipelago-passage');
      assert.equal(rocks.length,level.walls.length);assert.equal(info.rocks,rocks.length);
      assert.equal(info.rockColliders,level.walls,'uses gameplay wall colliders');
      assert.equal(paths.length,info.passages.length);
      for(const [i,rock] of rocks.entries()){
        const collider=level.walls[i],bounds=new THREE.Box3().setFromObject(rock);
        assert.equal(rock.userData.collider,collider);
        for(const [actual,expected] of [[bounds.min.x,collider.x-collider.w/2],[bounds.max.x,collider.x+collider.w/2],[bounds.min.z,collider.z-collider.d/2],[bounds.max.z,collider.z+collider.d/2]])assert.ok(Math.abs(actual-expected)<1e-5,'rock footprint equals collider');
        for(const p of info.passages)assert.ok(!intersects({x:(bounds.min.x+bounds.max.x)/2,z:(bounds.min.z+bounds.max.z)/2,w:bounds.max.x-bounds.min.x,d:bounds.max.z-bounds.min.z},p),'rendered rock stays outside clearance');
      }
      for(const path of paths){
        const bounds=new THREE.Box3().setFromObject(path),p=path.userData.clearance;
        assert.ok(Math.abs(bounds.max.x-bounds.min.x-p.w)<1e-5);
        assert.ok(Math.abs(bounds.max.z-bounds.min.z-p.d)<1e-5);
        assert.ok(bounds.max.y>0,'ground strip visible above grass and pier');
      }
      assert.equal(JSON.stringify(level.walls),before,'rendering never changes collision');
    }finally{rendered.dispose();}
  }
});
