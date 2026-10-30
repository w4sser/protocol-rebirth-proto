import test from 'node:test';import assert from 'node:assert/strict';import {summarizeFrames} from '../raid-profiler.js';
test('full-frame telemetry has correct cadence, percentiles and empty-capture semantics',()=>{
  const s=summarizeFrames([{ms:10,calls:80},{ms:20,calls:100},{ms:30,calls:120}]);
  assert.equal(s.fps,50);assert.equal(s.drawCalls.p95,120);assert.equal(summarizeFrames([]).fps,null);
});
