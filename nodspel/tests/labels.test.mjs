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
import {deoverlap,declutterLabels} from '../labels.js';
test('declutter: guard hint stacked on a STAND CLOSE node label moves up, the node label stays',()=>{
  const out=declutterLabels([{id:'node',kind:'node',x:400,y:200,w:110,h:24},{id:'guard',kind:'enemy',x:410,y:204,w:70,h:24}]);
  assert.equal(out.get('node'),0);
  assert(204-out.get('guard')<=200-24+0.01,'guard box sits wholly above the node label box');
});
test('declutter: separate labels untouched; unresolvable enemy label hides',()=>{
  const apart=declutterLabels([{id:'a',kind:'node',x:0,y:100,w:100,h:20},{id:'b',kind:'enemy',x:300,y:100,w:60,h:20}]);
  assert.equal(apart.get('a'),0);assert.equal(apart.get('b'),0);
  const stack=[{id:'n',kind:'node',x:0,y:100,w:100,h:20},...[1,2,3,4].map(i=>({id:'e'+i,kind:'enemy',x:0,y:100,w:60,h:20}))];
  const out=declutterLabels(stack,{maxShift:30});assert(out.get('e1')>0&&out.get('e1')<=30);assert.equal(out.get('e4'),null);
});
test('enemies: compact bar by default, name near/targeted, no arbitrary cap',()=>{
  assert.equal(labelTier('enemy',8),'bar');assert.equal(labelTier('enemy',2),'full');
  const items=Array.from({length:9},(_,i)=>({id:i,kind:'enemy',x:5+i,z:0}));items.push({id:'t',kind:'enemy',x:30,z:0,force:'full'});
  const plan=planLabels(items,{x:0,z:0});
  assert.equal([...plan.values()].filter(v=>v==='bar').length,9);assert.equal(plan.get('t'),'full','targeted enemy shows its name');
});
// Playtest note: the health bar must read on sight, not only once the enemy has been shot. Unlike loot
// ('far:hidden') the enemy tier has no 'hidden' outcome at all (mid is Infinity): any enemy in view is at
// least a bar, undamaged or not, aggro or not.
test('an undamaged, un-aggro enemy still gets a visible health bar at any distance it can be seen',()=>{
  for(const d of [1,3.5,8,50,10000])assert.notEqual(labelTier('enemy',d),'hidden',`distance ${d} must not hide the bar`);
  const untouched={id:'u',kind:'enemy',x:6,z:0,health:3,lastHitAt:null,aggro:false};
  assert.equal(planLabels([untouched],{x:0,z:0}).get('u'),'bar');
});
test('de-overlap: stacked enemies shift up, shock-pad icon never moves',()=>{
  const s=deoverlap([{id:'pad',x:100,y:100,w:40,h:40,fixed:true},{id:'a',x:100,y:100,w:60,h:14},{id:'b',x:102,y:101,w:60,h:14}]);
  assert.equal(s.get('pad'),0);assert(s.get('a')>0&&s.get('b')>0&&s.get('a')!==s.get('b'));
  const far=deoverlap([{id:'x',x:0,y:100,w:60,h:14},{id:'y',x:300,y:100,w:60,h:14}]);assert.equal(far.get('x'),0);assert.equal(far.get('y'),0);
});

import {resolveLabels,labelPriority} from '../labels.js';
test('resolveLabels never shifts: the lower-priority overlapping label hides, and stays hidden for the hold',()=>{
  const state=new Map(),node={id:'n',x:100,y:100,w:100,h:20,priority:labelPriority({kind:'node'})},loot={id:'l',x:110,y:104,w:80,h:20,priority:labelPriority({kind:'loot',needed:true})};
  let out=resolveLabels([node,loot],{now:0,state});assert.equal(out.get('n'),true);assert.equal(out.get('l'),false);
  out=resolveLabels([node,{...loot,x:400}],{now:100,state});assert.equal(out.get('l'),false,'hold keeps it hidden right after');
  out=resolveLabels([node,{...loot,x:400}],{now:1500,state});assert.equal(out.get('l'),true,'back after the hold');
});
test('resolveLabels: a shown label keeps its spot against a slightly higher newcomer (no ping-pong)',()=>{
  const state=new Map(),a={id:'a',x:100,y:100,w:80,h:20,priority:50},b={id:'b',x:300,y:100,w:80,h:20,priority:53};
  resolveLabels([a],{now:0,state});
  const out=resolveLabels([a,{...b,x:110}],{now:50,state});assert.equal(out.get('a'),true);assert.equal(out.get('b'),false);
});
test('labelPriority: objective > needed loot > attacking enemy > enemy > loot',()=>{
  const p=k=>labelPriority(k);
  assert(p({kind:'node'})>p({kind:'loot',needed:true})&&p({kind:'loot',needed:true})>p({kind:'enemy',attacking:true})&&p({kind:'enemy',attacking:true})>p({kind:'enemy'})&&p({kind:'enemy'})>p({kind:'loot'}));
});
