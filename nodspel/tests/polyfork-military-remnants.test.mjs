import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {planMilitaryRemnantsDressing,MILITARY_FORMS,militarySites} from '../polyfork-military-remnants.mjs';
import {renderMilitaryArchitecture} from '../military-architecture.mjs';
import {planCoastalLifeDressing} from '../polyfork-coastal-life.mjs';
import {archipelagoDressingConfig} from '../archipelago-dressing-policy.mjs';
import {propReservations} from '../props-placement.mjs';
import {generateLevel} from '../levels.js';
import {buildWorld} from '../world.js';
const fixture={
  archipelago:true,seed:'military-qa-01',
  floors:[
    {x:0,z:0,w:28,d:26},{x:46,z:0,w:28,d:26},{x:92,z:0,w:28,d:26},
    {x:23,z:0,w:18,d:4.1,dir:{x:1,z:0}},{x:69,z:0,w:18,d:4.1,dir:{x:1,z:0}}
  ],walls:[],boxes:[],rooms:[],nodes:[{x:0,z:5}],
  lootBoxes:[{x:45,z:-4}],enemies:[{x:92,z:4}],
  start:{x:-9,z:0},exit:{x:100,z:0}
};
const key=x=>[x.id,x.x,x.y,x.z,x.h].join(':');
test('opt-in only; preserve Coastal Life default and independent forest/granite modes',()=>{
  assert.equal(archipelagoDressingConfig({area:'archipelago'}).mode,'coastal');
  for(const mode of ['scatter','profiles','coastal','military']){
    assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?polyforkMode='+mode}).mode,mode);
  }
  assert.equal(archipelagoDressingConfig({area:'town',search:'?polyforkMode=military'}).enabled,false);
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?polyfork=0&polyforkMode=military'}).enabled,false);
  const normal=planCoastalLifeDressing(fixture);
  assert.equal(normal.items.some(x=>x.profile==='military'),false);
});
test('Bungenas landmark uses built concrete architecture, no GLB tech props or Viggen',()=>{
  assert.deepEqual(MILITARY_FORMS.map(x=>x.id),
    ['coastal-pillbox','overgrown-foundations','sealed-rock-portal']);
  const a=planMilitaryRemnantsDressing(fixture),b=planMilitaryRemnantsDressing(fixture);
  assert.deepEqual(a,b);
  assert.ok(a.militaryLandmarks.length<=2);
  assert.equal(a.architecture.length,a.militaryLandmarks.length);
  assert.ok(!a.items.some(x=>x.profile==='military'),'no fake military tech in asset layer');
  assert.ok(a.militaryLandmarks.every(x=>x.visualOnly));
  assert.ok(a.militaryLandmarks.every(x=>MILITARY_FORMS.some(form=>form.id===x.scene)));
});
test('LOW is a deterministic subset of HIGH, with identical main ruin silhouette',()=>{
  const high=planMilitaryRemnantsDressing(fixture),low=planMilitaryRemnantsDressing(fixture,{quality:'low'});
  assert.ok(high.items.length<=125&&low.items.length<=40);
  const keys=new Set(high.items.map(key));
  assert.ok(low.items.every(item=>keys.has(key(item))));
  assert.deepEqual(high.regions,low.regions);
  assert.deepEqual(high.architecture,low.architecture);
  assert.deepEqual(planMilitaryRemnantsDressing(fixture,{quality:'low'}),low);
});
test('fortification footprints remain beyond playable island and bridge floors',()=>{
  const plans=[planMilitaryRemnantsDressing(fixture)];
  let installed=0;
  for(const n of [2,3])for(let i=0;i<12;i++){
    const level=generateLevel(n,'military-qa-'+i,'archipelago');
    const high=planMilitaryRemnantsDressing(level),low=planMilitaryRemnantsDressing(level,{quality:'low'});
    assert.ok(high.items.length<=125&&low.items.length<=40);
    const keys=new Set(high.items.map(key));
    assert.ok(low.items.every(item=>keys.has(key(item))));
    assert.ok(high.militaryLandmarks.length<=2);
    installed+=high.militaryLandmarks.length;
    plans.push(high);
    for(const site of high.militaryLandmarks){
      const res=propReservations(level);
      const normal={x:Math.sin(site.ry),z:Math.cos(site.ry)};
      const tangent={x:Math.cos(site.ry),z:-Math.sin(site.ry)};
      for(const u of [-.48,0,.48])for(const v of [0,.58,1]){
        const x=site.center.x+normal.x*(v*site.depth)+tangent.x*(u*site.width);
        const z=site.center.z+normal.z*(v*site.depth)+tangent.z*(u*site.width);
        assert.ok(!level.floors.some(f=>Math.abs(x-f.x)<=f.w/2+.05&&Math.abs(z-f.z)<=f.d/2+.05));
        assert.equal(res.blocked(x,z,.14),false);
      }
    }
  }
  assert.ok(installed>=6,'visible ruins must actually spawn in multiple seeded archipelago raids');
  assert.deepEqual(planMilitaryRemnantsDressing({...fixture,archipelago:false}).architecture,[]);
  assert.deepEqual(planMilitaryRemnantsDressing({...fixture,floors:fixture.floors.slice(0,1)}).architecture,[]);
  assert.deepEqual(planMilitaryRemnantsDressing(fixture,{density:0}).items,[]);
});
test('Big Map has several ruins and a readable early landmark',()=>{
  let early=0,present=0;
  for(let i=0;i<12;i++){
    const level=generateLevel(1,'military-big-'+i,'archipelago',false,true);
    const plan=planMilitaryRemnantsDressing(level);
    assert.ok(plan.militaryLandmarks.length<=3);
    assert.deepEqual(plan.architecture,plan.militaryLandmarks);
    if(plan.militaryLandmarks.length){
      present++;
      const first=plan.militaryLandmarks[0];
      if(first.islandIndex<=1)early++;
      assert.notEqual(first.scene,'overgrown-foundations','first landmark should have a readable bunker silhouette');
      assert.equal(new Set(plan.militaryLandmarks.map(x=>x.islandIndex)).size,plan.militaryLandmarks.length);
    }
  }
  assert.ok(present>=8,'most big maps should feature a fortification');
  assert.ok(early>=6,'most big maps need a landmark on one of the first two islands');
});
test('military-style cover uses existing gameplay collision, not fake brown crates',()=>{
  for(const militaryStyle of [false,true]){
    const level=generateLevel(2,'military-cover-qa','archipelago');
    const boxes=JSON.stringify(level.boxes),scene=new THREE.Scene();
    const world=buildWorld(level,scene,{quality:'low',militaryStyle});
    try{
      const name=militaryStyle?'archipelago-derelict-concrete-cover':'archipelago-crate';
      const covers=world.group.children.filter(o=>o.name===name);
      assert.equal(covers.length,level.boxes.length);
      assert.equal(JSON.stringify(level.boxes),boxes);
      assert.ok(covers.every(o=>level.boxes.includes(o.userData.collider)));
    }finally{world.dispose();}
  }
});
test('geometry is mobile-bounded, seeded, disposable and visual-only',()=>{
  const site={scene:'sealed-rock-portal',center:{x:22,z:18},ry:.3,islandIndex:1,
    width:3.45,depth:1.35,height:2.05,visualOnly:true};
  const parent=new THREE.Group();
  for(const quality of ['high','low']){
    const a=renderMilitaryArchitecture([site],parent,{quality,seed:'military-qa-01'});
    assert.equal(a.stats.structures,1);
    assert.ok(a.stats.parts>8&&a.stats.parts<110);
    assert.ok(a.stats.drawCalls<=15,'batch by low-poly material and geometry');
    assert.ok(a.group.children.every(child=>child.userData.visualOnly));
    assert.ok(a.group.children[0].children.every(child=>child.userData.visualOnly));
    assert.ok(a.group.children[0].children.every(child=>child.isInstancedMesh));
    assert.ok(a.group.children[0].children.every(child=>child.instanceMatrix));
    const geometries=new Set(a.group.children[0].children.map(x=>x.geometry));
    assert.ok(geometries.size<=3);
    const before=parent.children.length;
    a.dispose();a.dispose();
    assert.equal(parent.children.length,before-1);
  }
});
