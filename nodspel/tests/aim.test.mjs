import test from 'node:test';
import assert from 'node:assert/strict';
const controls=await import('../controls.js').catch(()=>({}));
test('an aim press released without a drag never shoots',()=>{
  assert.equal(typeof controls.beginAim,'function');
  const gesture=controls.beginAim(20,30);
  assert.equal(controls.releaseAim(gesture),null);
});
test('a dragged aim keeps its direction when the thumb returns to center',()=>{
  assert.equal(typeof controls.beginAim,'function');
  const gesture=controls.beginAim(20,30);
  controls.dragAim(gesture,40,30);controls.dragAim(gesture,20,30);
  assert.deepEqual(controls.releaseAim(gesture),{x:1,y:0});
});
test('small finger jitter does not count as a drag and cancellation cannot fire',()=>{
  assert.equal(typeof controls.beginAim,'function');
  const gesture=controls.beginAim(20,30);controls.dragAim(gesture,22,31);
  assert.equal(controls.releaseAim(gesture),null);
  controls.dragAim(gesture,0,30);assert.equal(controls.releaseAim(gesture,true),null);
});
