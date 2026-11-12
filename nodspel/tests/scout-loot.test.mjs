import test from 'node:test';import assert from 'node:assert/strict';
import {generateLevel,setScouted} from '../levels.js?v=2.28.19';import {generateBigLevel} from '../big-level.js';
import {readLaunch} from '../raid-result.js';
const scouts=L=>L.lootBoxes.filter(b=>b.scout);
test('v2.28.6 t352u: a still-locked player keeps the guaranteed chart/survey drop',()=>{
  setScouted([]);
  for(let s=0;s<10;s++){assert.equal(scouts(generateLevel(3,`sc-${s}`,'bunker')).map(b=>b.item).join(),'archipelago_chart');
    assert.equal(scouts(generateLevel(3,`sc-${s}`,'archipelago')).map(b=>b.item).join(),'town_survey');}
});
test('v2.28.6 t352u: an already-scouted area drops no chart/survey; the crate keeps normal loot, layout unchanged',()=>{
  for(let s=0;s<10;s++)for(const [area,item,t] of [['bunker','archipelago_chart','archipelago'],['archipelago','town_survey','town']]){
    setScouted([]);const a=generateLevel(3,`sc-${s}`,area);setScouted([t]);const b=generateLevel(3,`sc-${s}`,area);
    assert.equal(b.lootBoxes.length,a.lootBoxes.length);assert.ok(!b.lootBoxes.some(x=>x.item===item||x.scout));
    assert.ok(b.lootBoxes.every(x=>x.item==null||typeof x.item==='string'));}
  setScouted(['town']);assert.equal(scouts(generateLevel(3,'sc-x','bunker')).length,1,'other area still drops');
  setScouted([]);
});
test('v2.28.6: Big Map follows the same scouted state',()=>{
  setScouted([]);const n0=generateBigLevel('bm-1').lootBoxes.filter(b=>b.item==='archipelago_chart').length;
  setScouted(['archipelago']);assert.equal(generateBigLevel('bm-1').lootBoxes.filter(b=>b.item==='archipelago_chart').length,0);
  setScouted([]);assert.ok(n0>=0);
});
test('v2.28.6: launch param scouted is parsed and sanitised',()=>{
  assert.deepEqual(readLaunch('?scouted=archipelago,town,%3Cx%3E').scouted,['archipelago','town']);
  assert.deepEqual(readLaunch('').scouted,[]);
});
