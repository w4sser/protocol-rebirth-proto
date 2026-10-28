import test from 'node:test';import assert from 'node:assert/strict';
import {isGameKey,isTypingTarget,releaseButtonFocus} from '../input.js?v=2.6.1';
test('movement, aim and dash keys are game keys',()=>{for(const k of ['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ArrowUp'])assert.ok(isGameKey(k));assert.equal(isGameKey('KeyQ'),false);});
test('text inputs keep normal typing',()=>{assert.ok(isTypingTarget({tagName:'INPUT'}));assert.equal(isTypingTarget({tagName:'BUTTON'}),false);assert.equal(isTypingTarget(null),false);});
test('a pointer click releases focus from HUD buttons so WASD keeps working',()=>{
  let blurred=0;const button={blur(){blurred++;doc.activeElement=null;},closest:s=>s==='button'?button:null};
  const doc={activeElement:button};
  assert.equal(releaseButtonFocus({target:button,detail:1},doc),true);assert.equal(blurred,1);assert.equal(doc.activeElement,null);
});
test('keyboard activation keeps focus for accessibility',()=>{
  let blurred=0;const button={blur(){blurred++;},closest:()=>button};const doc={activeElement:button};
  releaseButtonFocus({target:button,detail:0},doc);assert.equal(blurred,0);
});
test('clicks outside buttons are ignored',()=>{assert.equal(releaseButtonFocus({target:{closest:()=>null},detail:1},{activeElement:null}),false);});
