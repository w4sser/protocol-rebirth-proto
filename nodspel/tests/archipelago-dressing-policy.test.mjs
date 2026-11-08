import test from 'node:test';
import assert from 'node:assert/strict';
import {archipelagoDressingConfig} from '../archipelago-dressing-policy.mjs';
import {planCoastalLifeDressing} from '../polyfork-coastal-life.mjs';

const fixture={archipelago:true,seed:'archipelago-default-qa',
  floors:[{x:0,z:0,w:28,d:26},{x:46,z:0,w:28,d:26},
    {x:23,z:0,w:18,d:4.1,dir:{x:1,z:0}}],
  walls:[],boxes:[],rooms:[],nodes:[{x:0,z:5}],lootBoxes:[],enemies:[],
  start:{x:-9,z:0},exit:{x:53,z:0}};

test('normal Archipelago enables composed forest/granite and Coastal Life without flags',()=>{
  const config=archipelagoDressingConfig({area:'archipelago',quality:'high'});
  assert.deepEqual(config,{enabled:true,mode:'coastal',quality:'high',density:1});
  const plan=planCoastalLifeDressing(fixture,config);
  assert.equal(plan.regions.length,2);
  assert.ok(plan.items.length>0);
  assert.ok(plan.items.length<=125);
  assert.ok(plan.regions.every(p=>['forest','granite'].includes(p.profile)));
});

test('weak mobile and medium use deterministic, capped LOW dressing',()=>{
  const low=archipelagoDressingConfig({area:'archipelago',quality:'low'});
  const medium=archipelagoDressingConfig({area:'archipelago',quality:'medium'});
  assert.deepEqual(medium,low);
  assert.equal(low.density,.85);
  const plan=planCoastalLifeDressing(fixture,low);
  assert.ok(plan.items.length<=40,'LOW stays inside mobile budget');
  assert.deepEqual(plan,planCoastalLifeDressing(fixture,low));
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

test('QA can still select original scatter and profiles modes explicitly',()=>{
  for(const mode of ['scatter','profiles','coastal']){
    assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?polyforkMode='+mode}).mode,mode);
  }
  assert.equal(archipelagoDressingConfig({area:'archipelago',search:'?polyforkMode=invalid'}).mode,'coastal');
});
