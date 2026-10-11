import test from 'node:test';import assert from 'node:assert/strict';import * as controls from '../controls.js';
test('walking sets facing until active aim overrides it, then walking resumes',()=>{
  const walk={x:1,z:0},aim={x:0,z:-1};
  assert.deepEqual(controls.facingDirection(false,walk,aim),walk);
  assert.deepEqual(controls.facingDirection(true,walk,aim),aim);
  assert.deepEqual(controls.facingDirection(false,walk,aim),walk);
});
