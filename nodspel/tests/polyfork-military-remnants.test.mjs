import test from 'node:test';
import assert from 'node:assert/strict';
import {planMilitaryRemnantsDressing,MILITARY_SCENES} from '../polyfork-military-remnants.mjs';
import {planCoastalLifeDressing} from '../polyfork-coastal-life.mjs';
import {archipelagoDressingConfig} from '../archipelago-dressing-policy.mjs';
import {propReservations} from '../props-placement.mjs';
import {generateLevel} from '../levels.js';
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
test('opt-in policy retains approved Coastal Life as default',()=>{
  assert.equal(archipelagoDressingConfig({area:'archipelago'}).mode,'coastal');
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?polyforkMode=military'}).mode,'military');
  assert.equal(archipelagoDressingConfig({area:'town',search:'?polyforkMode=military'}).enabled,false);
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?polyfork=0&polyforkMode=military'}).enabled,false);
});
test('military scenes are deterministic and only use vetted catalogue IDs',()=>{
  assert.deepEqual(planMilitaryRemnantsDressing(fixture),planMilitaryRemnantsDressing(fixture));
  const catalog=new Set(MILITARY_SCENES.flatMap(s=>s.parts.map(p=>p.id)));
  const high=planMilitaryRemnantsDressing(fixture),low=planMilitaryRemnantsDressing(fixture,{quality:'low'});
  for(const plan of [high,low]){
    assert.ok(plan.items.length<=(plan===high?125:40));
    assert.ok(plan.items.filter(p=>p.profile==='military').every(p=>catalog.has(p.id)));
    assert.ok(plan.militaryLandmarks.length<=1);
  }
  const keys=new Set(high.items.map(key));
  assert.ok(low.items.every(item=>keys.has(key(item))),'LOW is a deterministic subset of HIGH');
  assert.deepEqual(high.regions,low.regions);
  assert.deepEqual(planMilitaryRemnantsDressing(fixture,{quality:'low'}),low);
});
test('military footprint keeps all playable floors and reservations clear',()=>{
  const high=planMilitaryRemnantsDressing(fixture);
  const res=propReservations(fixture);
  for(const p of high.items.filter(x=>x.profile==='military')){
    assert.ok(!fixture.floors.some(f=>Math.abs(p.x-f.x)<=f.w/2+.22&&Math.abs(p.z-f.z)<=f.d/2+.22));
    assert.equal(res.blocked(p.x,p.z,.52),false);
  }
  assert.deepEqual(planMilitaryRemnantsDressing({...fixture,archipelago:false}).militaryLandmarks,[]);
  assert.deepEqual(planMilitaryRemnantsDressing({...fixture,floors:fixture.floors.slice(0,1)}).militaryLandmarks,[]);
  assert.deepEqual(planMilitaryRemnantsDressing(fixture,{density:0}).items,[]);
});
test('representative real archipelago raids stay under the HIGH/LOW budgets',()=>{
  for(const n of [2,3])for(let i=0;i<8;i++){
    const level=generateLevel(n,'military-seed-'+i,'archipelago');
    const hi=planMilitaryRemnantsDressing(level,{quality:'high'});
    const lo=planMilitaryRemnantsDressing(level,{quality:'low'});
    assert.ok(hi.items.length<=125 && lo.items.length<=40);
    const highItems=new Set(hi.items.map(key));
    assert.ok(lo.items.every(p=>highItems.has(key(p))));
    assert.ok(hi.militaryLandmarks.length<=1);
  }
});
