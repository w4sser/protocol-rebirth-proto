import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,AREAS,AREA_RULES,setArea,RULES} from '../levels.js';
import * as THREE from '../vendor/three.module.js';
import {archipelagoPassages,buildArchipelago} from '../archipelago.js';
import {buildWorld} from '../world.js';
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
// v2.1.0 boulder formula: s=.55+rng()*.25 (radius-ish scale), h=clamp(wall.h,.5,1.15)*(.8+rng()*.35).
const BOULDER_S=[.55,.8],BOULDER_H=[.5*.8,1.15*1.15];
test('each archipelago wall is a cluster of chunky faceted boulders at v2.1.0 size and height, with no gaps in the collider',()=>{
  let maxHeightSeen=0;
  for(const n of [1,2,3])for(let seed=0;seed<8;seed++){
    const level=generateLevel(n,`passage-${seed}`,'archipelago');
    const rendered=renderArchipelago(level),{group,info}=rendered;
    try{
      const rocks=group.children.filter(m=>m.name==='archipelago-rock'),paths=group.children.filter(m=>m.name==='archipelago-passage');
      assert.equal(info.rocks,rocks.length);assert.equal(info.rockColliders,level.walls,'uses gameplay wall colliders');
      assert.equal(paths.length,info.passages.length);
      assert.ok(rocks.length>level.walls.length,'more than one boulder per wall');
      const byWall=new Map();
      for(const rock of rocks){
        assert.ok(rock.scale.x>=BOULDER_S[0]-1e-6&&rock.scale.x<=BOULDER_S[1]+1e-6,'boulder radius in the v2.1.0 range');
        assert.ok(rock.scale.y>=BOULDER_H[0]-1e-6&&rock.scale.y<=BOULDER_H[1]+1e-6,'boulder height in the v2.1.0 range');
        maxHeightSeen=Math.max(maxHeightSeen,rock.scale.y);
        const collider=rock.userData.collider;assert.ok(level.walls.includes(collider));
        if(!byWall.has(collider))byWall.set(collider,[]);
        byWall.get(collider).push(new THREE.Box3().setFromObject(rock));
        const bounds=new THREE.Box3().setFromObject(rock);
        for(const p of info.passages)assert.ok(!intersects({x:(bounds.min.x+bounds.max.x)/2,z:(bounds.min.z+bounds.max.z)/2,w:bounds.max.x-bounds.min.x,d:bounds.max.z-bounds.min.z},p),'rendered boulder stays outside clearance');
      }
      for(const collider of level.walls){
        const boxes=byWall.get(collider)??[];assert.ok(boxes.length>0,'every wall grew at least one boulder');
        // the collider is re-fit to the exact union of its own boulders: each box sits inside it (trivial by
        // construction) and, going the other way, no point along the collider strays more than ~.15 from the
        // nearest boulder (no invisible sliver the player would bounce off without seeing rock).
        for(const b of boxes)for(const [lo,hi,cLo,cHi] of [[b.min.x,b.max.x,collider.x-collider.w/2,collider.x+collider.w/2],[b.min.z,b.max.z,collider.z-collider.d/2,collider.z+collider.d/2]])assert.ok(lo>=cLo-1e-5&&hi<=cHi+1e-5,'boulder footprint covered by the collider');
        const alongX=collider.w>=collider.d,steps=60;
        for(let i=0;i<=steps;i++){
          const t=i/steps,x=alongX?collider.x-collider.w/2+t*collider.w:collider.x,z=alongX?collider.z:collider.z-collider.d/2+t*collider.d;
          const nearest=Math.min(...boxes.map(b=>Math.hypot(Math.max(b.min.x-x,0,x-b.max.x),Math.max(b.min.z-z,0,z-b.max.z))));
          assert.ok(nearest<=.15+1e-6,'collider covered by boulder footprint (no gap wider than ~.15)');
        }
      }
      for(const path of paths){
        const bounds=new THREE.Box3().setFromObject(path),p=path.userData.clearance;
        assert.ok(Math.abs(bounds.max.x-bounds.min.x-p.w)<1e-5);
        assert.ok(Math.abs(bounds.max.z-bounds.min.z-p.d)<1e-5);
        assert.ok(bounds.max.y>0,'ground strip visible above grass and pier');
      }
    }finally{rendered.dispose();}
  }
  assert.ok(maxHeightSeen>1.2,'full v2.1.0 boulder height is reachable, not capped low like the v2.1.1 flat strip');
});
test('archipelago passage openings read .6 wider than the same layout without the boulder widening',()=>{
  const partitionGaps=level=>{
    const byRow=new Map();
    for(const w of level.walls){if(Math.abs(w.h-1.7)>1e-9)continue;const key=w.z.toFixed(3);(byRow.get(key)??byRow.set(key,[]).get(key)).push(w);}
    return [...byRow.values()].filter(pieces=>pieces.length===2).map(([p0,p1])=>{const [lo,hi]=p0.x<p1.x?[p0,p1]:[p1,p0];return (hi.x-hi.w/2)-(lo.x+lo.w/2);});
  };
  for(const n of [2,3])for(let seed=0;seed<8;seed++){
    const a=generateLevel(n,`width-${seed}`,'archipelago'),b=generateLevel(n,`width-${seed}`,'bunker');
    assert.equal(a.corridors.length,b.corridors.length,`L${n} seed ${seed}: same corridor count`);
    for(let i=0;i<a.corridors.length;i++)assert.ok(Math.abs(a.corridors[i].width-(b.corridors[i].width+.6))<1e-9,`L${n} seed ${seed} corridor ${i} widened by .6`);
    const ga=partitionGaps(a).sort((x,y)=>x-y),gb=partitionGaps(b).sort((x,y)=>x-y);
    assert.equal(ga.length,gb.length,`L${n} seed ${seed}: same partition count`);
    for(let i=0;i<ga.length;i++)assert.ok(Math.abs(ga[i]-(gb[i]+.6))<1e-9,`L${n} seed ${seed} partition ${i} widened by .6`);
  }
});

// Independent bounds assertion: reserve the approaches returned by passage discovery,
// plus the same 0.9 margin used to lower nearby rocks, on every side.
function assertDecorClear(object,passages){
  const b=new THREE.Box3().setFromObject(object);
  for(const p of passages)assert.ok(b.max.x<=p.x-p.w/2-.9||b.min.x>=p.x+p.w/2+.9||b.max.z<=p.z-p.d/2-.9||b.min.z>=p.z+p.d/2+.9,`${object.name} overlaps passage approach`);
}
test('all rendered pines, crates and boats clear expanded passage approaches at both quality settings',()=>{
  const geometry=new THREE.BoxGeometry(4,5,3),material=new THREE.MeshBasicMaterial();
  const pine=[{geometry,material,matrix:new THREE.Matrix4().makeTranslation(.8,2.5,.4)}];
  try{
    for(const quality of ['low','high'])for(const model of [null,pine])for(const n of [1,2,3])for(let seed=0;seed<8;seed++){
      const level=generateLevel(n,`passage-${seed}`,'archipelago');
      const before=JSON.stringify(level.boxes),world=buildWorld(level,new THREE.Scene(),{quality,pine:model});
      try{
        assert.equal(JSON.stringify(level.boxes),before,'generated collision is already clear before rendering');
        const passages=archipelagoPassages(level),decor=world.group.children.filter(o=>['pine','boat','archipelago-crate'].includes(o.name));
        for(const object of decor)assertDecorClear(object,passages);
        assert.equal(world.props.length,world.propSpots.length,'only rendered pine spots remain');
        const crates=decor.filter(o=>o.name==='archipelago-crate');
        assert.equal(crates.length,level.boxes.length,'every remaining collider has its visible crate');
        for(const c of crates)assert.ok(level.boxes.includes(c.userData.collider));
        for(const c of level.boxes)for(const p of passages)assert.ok(!intersects(c,{...p,w:p.w+1.8,d:p.d+1.8}),'collidable dressing clears approaches');
      }finally{world.dispose();}
    }
  }finally{geometry.dispose();material.dispose();}
});
test('collidable crates at either approach or overlapping by their edge are skipped together with visuals',()=>{
  for(const rotate of [false,true]){
    const turn=r=>rotate?{...r,x:r.z,z:r.x,w:r.d,d:r.w}:r;
    const bad=[{x:0,z:0,w:1,d:1,h:1},{x:0,z:1.9,w:1,d:1,h:1},{x:0,z:-1.9,w:1,d:1,h:1},{x:2,z:0,w:1,d:1,h:1}].map(turn);
    const safe=turn({x:5,z:5,w:1,d:1,h:1}),boxes=[...bad,safe];
    const level={seed:'crafted',walls:[{x:-3,z:0,w:4,d:.4,h:1},{x:3,z:0,w:4,d:.4,h:1}].map(turn),floors:[{x:0,z:0,w:20,d:20}],boxes};
    const rendered=renderArchipelago(level);
    try{
      assert.equal(level.boxes,boxes,'preserves references to collision array');
      assert.deepEqual(level.boxes,[safe],'removes approach colliders as well as center and edge overlaps');
      const crates=rendered.group.children.filter(o=>o.name==='archipelago-crate');
      assert.equal(crates.length,1);assert.equal(crates[0].userData.collider,safe);
      for(const c of crates)assertDecorClear(c,rendered.info.passages);
    }finally{rendered.dispose();}
  }
});
test('rotated offshore boats are skipped when their hull overlaps a passage margin',()=>{
  let checked=false;
  for(let seed=0;seed<250&&!checked;seed++){
    const level={seed:`boat-${seed}`,walls:[],floors:[{x:0,z:0,w:100,d:100}],boxes:[]};
    const first=renderArchipelago(level);
    const boat=first.group.children.find(o=>o.name==='boat'&&Math.abs(o.position.x)<46&&Math.abs(o.position.z)<46);
    const position=boat?.position.clone();first.dispose();if(!position)continue;
    // The boulder clusters along the two walls below consume their own share of the seeded
    // rng sequence, so this boat is not guaranteed to land in the same spot as the one found
    // above with no walls at all; keep searching seeds until one actually lands an overlap.
    level.walls=[{x:position.x-3,z:position.z,w:4,d:.4,h:1},{x:position.x+3,z:position.z,w:4,d:.4,h:1}];
    const rendered=renderArchipelago(level);
    try{
      if(rendered.info.boats>=3)continue;
      assert.ok(rendered.info.passages.length>0);
      for(const b of rendered.group.children.filter(o=>o.name==='boat'))assertDecorClear(b,rendered.info.passages);
      checked=true;
    }finally{rendered.dispose();}
  }
  assert.ok(checked,'exercised a boat inside grounded passage clearance');
});
