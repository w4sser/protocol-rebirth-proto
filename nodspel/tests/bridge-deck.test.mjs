import test from 'node:test';
import assert from 'node:assert/strict';
import {planBridgeDeck} from '../bridge-deck.mjs';
const east={x:23,z:0,w:20,d:4.2,dir:{x:1,z:0}};
const north={x:0,z:36,w:4.2,d:19,dir:{x:0,z:1}};
test('stable composition for a fixed level seed',()=>{
  const a=planBridgeDeck(east,'bridge-seed',{quality:'high'});
  assert.deepEqual(a,planBridgeDeck(east,'bridge-seed',{quality:'high'}));
  assert.notDeepEqual(a.planks,planBridgeDeck(east,'another-seed',{quality:'high'}).planks);
  assert.equal(a.along,'x');
  assert.equal(planBridgeDeck(north,'bridge-seed').along,'z');
  assert.equal(planBridgeDeck({...east,dir:null},'bridge-seed'),null);
});
test('deck spans the playable bridge without obstructing the central strip',()=>{
  for(const f of [east,north]){
    const p=planBridgeDeck(f,'bridge-seed'),boards=p.planks.filter(b=>!b.landing);
    assert.ok(boards.length>20);
    assert.ok(boards.every(b=>b.width>p.width-.25&&b.width<=p.width&&b.length>0));
    assert.ok(boards.every(b=>Math.abs(b.t)+b.length/2<=p.length/2+.001));
    assert.equal(p.planks.filter(b=>b.landing).length,6);
    assert.ok(p.supports.every(s=>s.side===-1||s.side===1));
  }
});
test('LOW has fewer boards and retains the same safe footprint',()=>{
  const high=planBridgeDeck(east,'bridge-seed',{quality:'high'}),low=planBridgeDeck(east,'bridge-seed',{quality:'low'});
  assert.ok(low.planks.length<high.planks.length);
  assert.ok(low.planks.filter(b=>b.landing).length===4);
  assert.deepEqual(low.supports,high.supports);
  assert.ok(low.planks.filter(b=>!b.landing).every(b=>b.width<=low.width));
});
