import test from 'node:test';
import assert from 'node:assert/strict';
import {placeEnemyLabel} from '../labels.js';

const sizes={full:{w:100,h:30,dy:-12},bar:{w:44,h:5,dy:-12}};
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
const bounds={left:2,right:842,top:2,bottom:388};
const place=(state,opts={})=>placeEnemyLabel(state,{x:422,y:70,mode:'full',sizes,bounds,now:0,...opts});

test('a clear retained offset follows the anchor even when a different obstacle edge becomes nearer',()=>{
  const hud=[{left:280,right:564,top:0,bottom:100}];
  let p=place(undefined,{rects:hud});
  assert.equal(p.mode,'bar');
  const offset={dx:p.state.dx,dy:p.state.dy};
  for(let i=1;i<=180;i++){
    const x=422+Math.sin(i/8)*3;
    p=place(p.state,{x,rects:hud,now:i*16});
    assert.equal(p.state.dx,offset.dx);
    assert.equal(p.state.dy,offset.dy);
    assert(!hud.some(r=>overlaps(p.box,r)));
  }
  p=place(p.state,{rects:[],now:3200});
  assert.equal(p.state.dy,offset.dy,'removing the obstacle does not snap the label back to its anchor');
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

test('walking along HUD and quest edges keeps offset changes below 8px and every bar clear',()=>{
  for(const [width,height] of [[844,390],[932,430],[667,375]]){
    const hud=[{left:width/2-140,right:width/2+140,top:0,bottom:45},
      {left:width/2-130,right:width/2+130,top:50,bottom:100}];
    const b={left:2,right:width-2,top:2,bottom:height-2};
    let p=place(undefined,{x:width/2,y:70,rects:hud,bounds:b});
    for(let i=1;i<=240;i++){
      const prior={dx:p.state.dx,dy:p.state.dy};
      p=place(p.state,{x:width/2+Math.sin(i/20)*4,y:70-i*.35,rects:hud,bounds:b,now:i*16});
      assert(Math.hypot(p.state.dx-prior.dx,p.state.dy-prior.dy)<=8.001);
      assert(!hud.some(r=>overlaps(p.box,r)),'no interpolation through either HUD rectangle');
      assert(p.box.left>=b.left&&p.box.right<=b.right&&p.box.top>=b.top&&p.box.bottom<=b.bottom);
    }
  }
});

test('a newly appearing HUD panel requires a safe escape, then keeps that placement stable',()=>{
  let p=place(undefined,{mode:'bar',y:230});
  const hud=[{left:250,right:600,top:140,bottom:260}];
  p=place(p.state,{mode:'bar',y:230,rects:hud,now:16});
  assert(!overlaps(p.box,hud[0]));
  const offset={dx:p.state.dx,dy:p.state.dy};
  for(let i=2;i<60;i++){
    p=place(p.state,{mode:'bar',y:230,rects:hud,now:i*16});
    assert.deepEqual({dx:p.state.dx,dy:p.state.dy},offset);
  }
});

test('relocation lerps where safe and uses a capped step when the lerp would cross the HUD',()=>{
  const hud=[{left:280,right:564,top:0,bottom:100}];
  let p=place(undefined,{mode:'bar',y:126,rects:hud});
  assert.equal(p.state.dy,0);
  // Moving the projected anchor upward puts the old placement 6px inside
  // the panel. A fractional lerp is unsafe, but an 8px escape is sufficient.
  p=place(p.state,{mode:'bar',y:111,rects:hud,now:16});
  assert.equal(p.state.dy,8);
  assert(!overlaps(p.box,hud[0]));
  const before=p.state.dy;
  p=place(p.state,{mode:'bar',y:111,rects:hud,now:32});
  assert(p.state.dy>before&&p.state.dy-before<8,'clearance settles with a fractional lerp');
  assert(!overlaps(p.box,hud[0]));
});
