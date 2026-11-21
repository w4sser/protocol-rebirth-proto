import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,activateNode,enterExit,exitIsOpen,tickRound,detonateDrum} from '../round.js?v=2.28.60';
import {initFtueRound} from '../ftue.js?v=2.28.60';
import {stepStakes} from '../stakes.js?v=2.28.60';
import * as THREE from '../vendor/three.module.js';
import {buildWorld} from '../world.js?v=2.28.60';

function setup(){
  const r=createRound('ftue-opening',0);
  initFtueRound(r,{ftue:true},{getItem:()=>JSON.stringify({attempts:0})});
  return r;
}
test('the first node reveals extraction without spawning hunters',()=>{
  const r=setup(),count=r.level.enemies.length;
  assert.equal(count,3);
  for(const n of r.level.nodes)activateNode(r,n.id,100);
  assert.ok(exitIsOpen(r));
  for(const now of [100,10000,60000]){
    tickRound(r,now);
    assert.deepEqual(stepStakes(r,now,r.level.start,0).spawned,[]);
    assert.equal(r.level.enemies.length,count);
    assert.equal(r.ftueClutch,undefined);
  }
});
test('the first extraction always ends FTUE and secures world loot',()=>{
  const r=setup(),level=r.level;r.bag.scrap_alloy=2;
  assert.equal(enterExit(r,level.exit,99),null);
  activateNode(r,level.nodes[0].id,100);
  assert.equal(enterExit(r,level.exit,101),'complete');
  assert.equal(r.level,level);
  assert.equal(r.levelsCleared,1);
  assert.equal(r.reason,'extract');
  assert.equal(r.extracted.scrap_alloy,2);
});
test('regular raids still take the normal exit to the next level',()=>{
  const r=createRound('normal-opening',0),level=r.level;
  activateNode(r,level.nodes[0].id,100);
  assert.equal(enterExit(r,level.exit,101),'next');
  assert.equal(r.level.number,2);
  assert.equal(r.over,false);
});
test('world barrel disappears after detonation; the real exit beam still opens',()=>{
  const r=setup(),w=buildWorld(r.level,new THREE.Scene());
  try{
    assert.equal(w.barrels.length,1);
    assert.equal(w.barrels[0].group.visible,true);
    w.setExit(exitIsOpen(r));assert.equal(w.extractBeamFx.isOpen(),false);
    assert.ok(detonateDrum(r,'ftue-barrel-1',100,[...r.level.walls,...r.level.boxes]));
    w.animate(.1,r.level.start,r);
    assert.equal(w.barrels[0].group.visible,false);
    activateNode(r,r.level.nodes[0].id,200);
    w.setExit(exitIsOpen(r));w.animate(.2,r.level.start,r);
    assert.equal(w.extractBeamFx.isOpen(),true);
  }finally{w.dispose();}
});
