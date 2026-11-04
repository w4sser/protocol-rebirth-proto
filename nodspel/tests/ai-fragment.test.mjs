// v2.25.1 (Robert: "never get AI Fragment"). It only rolls from L2/L3 world crates; at weights 1/2 a full-clear bunker
// L2+L3 raid averaged ~0.23. Now 2.5/3.5 -> ~0.49 per full clear, ~1 per 3-5 raids with partial looting.
import test from 'node:test';import assert from 'node:assert/strict';import {generateLevel,RULES} from '../levels.js';
test('AI Fragment is in the L2 and L3 loot tables with a nonzero weight',()=>{
  assert.ok(RULES.loot.types.includes('ai_fragment'));
  assert.ok(RULES.loot.weights[1].ai_fragment>=2.5);assert.ok(RULES.loot.weights[2].ai_fragment>=3.5);
});
test('AI Fragment actually rolls in generated bunker L2+L3 crates: >=1 per 3-5 raids',()=>{
  let n=0;const N=200;for(let i=0;i<N;i++)for(const d of [2,3])n+=generateLevel(d,`aif${i}`,'bunker',false,false).lootBoxes.filter(b=>b.item==='ai_fragment').length;
  const per=n/N;assert.ok(per>=.3&&per<=.8,`ai_fragment per full-clear L2+L3 raid ${per}`);
});
