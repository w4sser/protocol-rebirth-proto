// v2.7.2 (measured at 844x390): placeEnemyLabel used to keep a sticky dx/dy offset pushed by HUD/label
// obstacles, so a bar could drift 45px+ sideways and never return once the obstacle that pushed it was
// gone. The bar is now recomputed from the projected head anchor every frame: always centred horizontally
// on it, never pushed sideways or shoved around by obstacles. Only the richer caption/full box may stack a
// few px higher to clear a neighbour, and it collapses to the bar when that is not enough.
import test from 'node:test';
import assert from 'node:assert/strict';
import {placeEnemyLabel} from '../labels.js';

const sizes={full:{w:100,h:30,dy:-12},bar:{w:44,h:5,dy:-12}};
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
const bounds={left:2,right:842,top:2,bottom:388};
const place=(state,opts={})=>placeEnemyLabel(state,{x:422,y:70,mode:'full',sizes,bounds,now:0,...opts});

test('the bar sits exactly above the anchor and never follows an obstacle sideways',()=>{
  const hud=[{left:280,right:564,top:0,bottom:100}];
  let p=place(undefined,{mode:'bar',rects:hud});
  assert.equal(p.mode,'bar');
  assert.equal(p.x,422,'bar stays centred on the anchor even though the HUD overlaps it');
  assert(overlaps(p.box,hud[0]),'the bar is allowed to overlap the HUD now — it is never pushed clear');
  for(let i=1;i<=180;i++){
    const x=422+Math.sin(i/8)*3;
    p=place(p.state,{x,mode:'bar',rects:hud,now:i*16});
    assert.equal(p.x,x,'bar tracks the anchor exactly every frame, no sticky memory');
  }
});

test('removing the obstacle does not matter to the bar: its position never depended on it',()=>{
  const hud=[{left:280,right:564,top:0,bottom:100}];
  let p=place(undefined,{mode:'bar',rects:hud});
  const withHud={x:p.x,y:p.y};
  p=place(p.state,{mode:'bar',rects:[],now:16});
  assert.deepEqual({x:p.x,y:p.y},withHud,'bar position is identical with or without the obstacle');
});

test('caption changes require a continuous 400ms request and clearance',()=>{
  let p=place(undefined,{mode:'bar',y:250});
  for(let now=0;now<1200;now+=100){
    p=place(p.state,{mode:now%200?'bar':'full',y:250,now});
    assert.equal(p.mode,'bar','alternating requests cannot flicker the caption');
  }
  for(const now of [1200,1300,1500,1599]){
    p=place(p.state,{mode:'full',y:250,now});
    assert.equal(p.mode,'bar');
  }
  p=place(p.state,{mode:'full',y:250,now:1600});
  assert.equal(p.mode,'full');
  const obstacle={left:p.box.left,right:p.box.right,top:p.box.top,bottom:p.box.bottom};
  p=place(p.state,{mode:'full',y:250,rects:[obstacle],now:1616});
  assert.equal(p.mode,'bar','a new collision downgrades immediately for safety');
  p=place(p.state,{mode:'full',y:250,now:1700});
  assert.equal(p.mode,'bar','safety downgrade still gets a minimum dwell');
});

test('a caption stacks a few px higher to clear a neighbour, without ever moving sideways',()=>{
  // The caption's natural box would overlap this obstacle by only 6px — a small upward stack clears it.
  let p=place(undefined,{mode:'full',y:70});
  const natural={left:p.box.left,right:p.box.right,top:p.box.top,bottom:p.box.bottom};
  const obstacle={left:natural.left,right:natural.right,top:natural.bottom-6,bottom:natural.bottom+20};
  p=place(p.state,{mode:'full',y:70,rects:[obstacle],now:16});
  assert.equal(p.mode,'full','small overlap is resolved by stacking, not by collapsing');
  assert.equal(p.x,422,'stacking never moves the box sideways');
  assert(!overlaps(p.box,obstacle));
  assert(p.box.bottom<natural.bottom,'box stacked upward');
  assert(natural.bottom-p.box.bottom<=24,'stack stays within the small max shift');
});

test('a caption collapses to the bar (never sideways) when no vertical stack within reach clears it',()=>{
  // A tall obstacle spanning well past the max stack shift leaves no clear spot for the caption.
  let p=place(undefined,{mode:'bar',y:70});
  const obstacle={left:300,right:544,top:0,bottom:200};
  p=place(p.state,{mode:'full',y:70,rects:[obstacle],now:1616});
  assert.equal(p.mode,'bar','collapses to the compact bar instead of dodging sideways');
  assert.equal(p.x,422,'the bar still sits exactly on the anchor, not pushed around the obstacle');
});

test('the bar always stays inside the viewport, clamped at the screen edge (not pushed by obstacles)',()=>{
  const b={left:2,right:842,top:2,bottom:388};
  let p=placeEnemyLabel(undefined,{x:5,y:3,mode:'bar',sizes,bounds:b,now:0,rects:[{left:0,right:400,top:0,bottom:300}]});
  assert.equal(p.mode,'bar');
  assert(p.box.left>=b.left&&p.box.top>=b.top,'clamped to the viewport edge');
  assert(overlaps(p.box,{left:0,right:400,top:0,bottom:300}),'still overlaps the obstacle — edge clamping is not obstacle avoidance');
});
