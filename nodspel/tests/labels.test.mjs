import test from 'node:test';
import assert from 'node:assert/strict';
import {labelTier,planLabels,labelOpacity,overHUD,LABEL_RANGES,MAX_FULL} from '../labels.js';
test('tiers by distance: far hidden/dot, mid short, near full',()=>{
  assert.equal(labelTier('loot',1),'full');assert.equal(labelTier('loot',5),'short');assert.equal(labelTier('loot',20),'hidden');
  assert.equal(labelTier('node',20),'dot','objectives keep a minimal far marker');assert.equal(labelTier('exit',20),'dot');
  assert.equal(labelTier('loot',LABEL_RANGES.loot.near),'full');
});
test('nearest first, at most MAX_FULL full labels',()=>{
  const items=[0,.5,1,1.5,2].map((d,i)=>({id:i,kind:'loot',x:d,z:0}));
  const plan=planLabels(items,{x:0,z:0});
  assert.equal([...plan.values()].filter(v=>v==='full').length,MAX_FULL);
  assert.deepEqual([0,1,2].map(i=>plan.get(i)),['full','full','full']);assert.equal(plan.get(4),'short');
});
test('forced modes (BIT healing, locked exit dot) win',()=>{
  const plan=planLabels([{id:'b',kind:'bit',x:0,z:0,force:'hidden'},{id:'e',kind:'exit',x:1,z:0,force:'dot'}],{x:0,z:0});
  assert.equal(plan.get('b'),'hidden');assert.equal(plan.get('e'),'dot');
});
test('smooth fade and HUD exclusion',()=>{
  assert.equal(labelOpacity('loot',1),1);assert(labelOpacity('loot',5)<1&&labelOpacity('loot',5)>.4);
  assert(labelOpacity('loot',3)>labelOpacity('loot',6),'fades with distance');
  const hud=[{left:300,right:500,top:0,bottom:60}];
  assert(overHUD(400,30,hud));assert(!overHUD(400,120,hud));
  assert(overHUD(250,70,hud,8,140,20),'label box edge touching HUD is hidden');assert(!overHUD(250,70,hud,8,20,20));
});
