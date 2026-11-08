import test from 'node:test';
import assert from 'node:assert/strict';
import {generateBigLevel} from '../big-level.js';
import {BRIDGE_MIN_WIDTH} from '../bridge-flow.mjs';
import {reachable} from '../town-layout.js';
import {RULES} from '../levels.js';
test('real Big Archipelago bridges and doors are at least 4.2 metres wide',()=>{
  for(let i=0;i<20;i++){
    const level=generateBigLevel('big-bridge-regression-'+i,'archipelago');
    assert.ok(level.corridors.length>4);
    for(const c of level.corridors){
      const cross=c.dir.x?c.d:c.w;
      assert.ok(cross>=Math.max(4.2,BRIDGE_MIN_WIDTH), 'narrow bridge '+cross);
      const floor=level.floors.find(f=>f.dir&&f.x===c.x&&f.z===c.z);
      assert.ok(floor,'walkable floor uses the widened corridor');
      assert.ok((c.dir.x?floor.d:floor.w)>=cross);
    }
    for(const edge of level.graph.edges){
      assert.ok(edge.corridor.width>=4.2,'AI culling graph must match bridge');
      const c=level.corridors.find(c=>c.roomIds.includes(edge.a)&&c.roomIds.includes(edge.b));
      assert.ok(c);
      assert.equal(edge.corridor.width,c.dir.x?c.d:c.w);
    }
    assert.ok(reachable(level,RULES.playerRadius,.3,level.extracts.map(e=>({...e,reach:e.r}))), 'all islands remain reachable');
  }
});
test('Bunker Big Map corridor widths retain their narrow existing design',()=>{
  for(let i=0;i<8;i++){
    const level=generateBigLevel('big-bunker-width-'+i,'bunker');
    assert.ok(level.corridors.every(c=>(c.dir.x?c.d:c.w)===1.8));
    assert.ok(level.graph.edges.every(e=>e.corridor.width===1.8));
  }
});
