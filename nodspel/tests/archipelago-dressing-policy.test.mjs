import test from 'node:test';
import assert from 'node:assert/strict';
import {archipelagoDressingConfig} from '../archipelago-dressing-policy.mjs';
import {planCoastalLifeDressing} from '../polyfork-coastal-life.mjs';
import {planMilitaryRemnantsDressing} from '../polyfork-military-remnants.mjs';

const fixture={archipelago:true,seed:'archipelago-default-qa',
  floors:[{x:0,z:0,w:28,d:26},{x:46,z:0,w:28,d:26},
    {x:23,z:0,w:18,d:4.1,dir:{x:1,z:0}}],
  walls:[],boxes:[],rooms:[],nodes:[{x:0,z:5}],lootBoxes:[],enemies:[],
  start:{x:-9,z:0},exit:{x:53,z:0}};

test('normal Archipelago includes Bungenas Military Remnants and Coastal Life without URL flags',()=>{
  const config=archipelagoDressingConfig({area:'archipelago',quality:'high'});
  assert.deepEqual(config,{enabled:true,mode:'military',quality:'high',density:1});
  const plan=planMilitaryRemnantsDressing(fixture,config);
  assert.deepEqual(plan.architecture,plan.militaryLandmarks);
  assert.ok(plan.militaryLandmarks.length>=1,'default Archipelago should have real concrete landmarks');
  assert.equal(plan.regions.length,2);
  assert.ok(plan.items.length>0);
  assert.ok(plan.items.length<=125);
  assert.ok(plan.regions.every(p=>['forest','granite'].includes(p.profile)));
});

test('weak mobile and medium retain a deterministic subset of HIGH dressing',()=>{
  const low=archipelagoDressingConfig({area:'archipelago',quality:'low'});
  const medium=archipelagoDressingConfig({area:'archipelago',quality:'medium'});
  assert.deepEqual(medium,low);
  assert.equal(low.density,1);
  const high=planMilitaryRemnantsDressing(fixture,archipelagoDressingConfig({area:'archipelago',quality:'high'}));
  const plan=planMilitaryRemnantsDressing(fixture,low);
  assert.ok(plan.items.length<=40,'LOW stays inside mobile budget');
  assert.ok(plan.items.length<=high.items.length,'LOW must never produce more instances than HIGH');
  const key=p=>[p.id,p.x,p.z,p.h].join('/');
  const highItems=new Set(high.items.map(key));
  assert.ok(plan.items.every(item=>highItems.has(key(item))),'LOW is a real subset of HIGH');
  assert.deepEqual(plan.architecture,high.architecture,'LOW preserves the same military silhouettes');
  assert.deepEqual(plan,planMilitaryRemnantsDressing(fixture,low));
});

test('other areas and explicit opt-out never load Polyfork',()=>{
  for(const area of ['bunker','town',undefined]){
    assert.equal(archipelagoDressingConfig({area,search:'?polyfork=1'}).enabled,false);
  }
  const off=archipelagoDressingConfig({area:'archipelago',search:'?polyfork=0&polyforkMode=coastal'});
  assert.equal(off.enabled,false);
  assert.equal(off.density,0);
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?polyfork=1'}).enabled,true);
});

test('QA can select original Coastal Life, scatter and profiles modes explicitly',()=>{
  for(const mode of ['scatter','profiles','coastal','military']){
    assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?polyforkMode='+mode}).mode,mode);
  }
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?polyforkMode=invalid'}).mode,'military');
  const coastal=archipelagoDressingConfig({area:'archipelago',search:'?polyforkMode=coastal'});
  assert.equal(coastal.mode,'coastal');
  assert.equal(planCoastalLifeDressing(fixture,coastal).regions.length,2);
});
