import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate,parseArgs} from '../scripts/economy-sim.mjs';

test('deterministic raid generator and collection',()=>{
  const a=simulate({runs:12,seed:'fixed',success:.7,depth3:.4});
  const b=simulate({runs:12,seed:'fixed',success:.7,depth3:.4});
  assert.deepEqual(a,b);
});
test('failed extractions never bank loot',()=>{
  const r=simulate({runs:20,seed:'failed',success:0,depth3:1});
  assert.ok(r.rows.every(x=>!x.success&&x.scrap===0&&x.dataCores===0&&x.banked==='{}'));
  assert.ok(r.rows.some(x=>x.lost!=='{}'));
});
test('successful extractions bank bag within capacity and pay Scrap',()=>{
  const r=simulate({runs:20,seed:'success',success:1,depth3:0});
  for(const x of r.rows){
    assert.equal(x.success,true);
    assert.ok(Object.values(JSON.parse(x.banked)).reduce((a,b)=>a+b,0)<=r.metadata.bagCapacity);
    assert.ok(x.scrap>=15); // level 1 + level 2 cleared => 5+10 from existing rules
  }
});
test('args validate boundary and catch invalid settings',()=>{
  assert.equal(parseArgs(['--runs','15','--success','0.6']).runs,15);
  assert.throws(()=>parseArgs(['--runs','0']),/runs/);
  assert.throws(()=>parseArgs(['--depth3','3']),/depth3/);
});
