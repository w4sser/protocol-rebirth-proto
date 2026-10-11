import test from 'node:test';import assert from 'node:assert/strict';import * as hud from '../hud.js';
test('enemy health has one box per HP and a hit extinguishes one box',()=>{
  assert.deepEqual(hud.healthSegments(4,4),[1,1,1,1]);assert.deepEqual(hud.healthSegments(3,4),[1,1,1,0]);assert.deepEqual(hud.healthSegments(2,3),[1,1,0]);assert.deepEqual(hud.healthSegments(0,3),[0,0,0]);
});
test('player health uses ten small boxes with partial health represented inside the last lit box',()=>{
  const fill=hud.healthSegments(75,100,10);assert.equal(fill.length,10);assert.deepEqual(fill,[1,1,1,1,1,1,1,.5,0,0]);
});
