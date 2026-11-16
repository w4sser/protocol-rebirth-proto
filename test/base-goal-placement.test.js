// Screen-space geometry regression: the chip must follow free space as room targets move.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/../app.js','utf8');
const fn=src.slice(src.indexOf('function placeBaseGoal(viewer){'),src.indexOf('// v1.67: room plates never'));
const rect=(x,y,w,h)=>({left:x,top:y,right:x+w,bottom:y+h,width:w,height:h});
const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
for(const [w,h] of [[844,390],[667,375],[932,430],[390,844],[375,667],[430,932]]){
 const style={left:'59px',top:'64px',setProperty(k,v){this[k]=v;}};
 const card={offsetHeight:60,style,getBoundingClientRect(){return rect(parseFloat(style.left),parseFloat(style.top),114,60);}};
 const room={offsetHeight:64,getBoundingClientRect(){return this.rect;},rect:rect(59,64,140,64)};
 const tabs={offsetHeight:80,getBoundingClientRect:()=>rect(w-267,h-101,220,80)};
 const bar={getBoundingClientRect:()=>rect(0,0,w,54)};
 const viewer={querySelector:()=>card,querySelectorAll:()=>[room],getBoundingClientRect:()=>rect(0,0,w,h)};
 const ctx={document:{documentElement:{},getElementById:id=>id==='topbar'?bar:tabs},getComputedStyle:()=>({getPropertyValue:n=>n==='--sb'?'21px':'max(47px, 12px)'}),innerWidth:w,innerHeight:h};
 vm.createContext(ctx);vm.runInContext(fn+';this.place=placeBaseGoal;',ctx);
 assert.ok(hit(card.getBoundingClientRect(),room.rect),'fixture reproduces fixed chip overlap');
 for(const r of [rect(59,64,140,64),rect(160,160,64,64),rect(w/2,85,150,44)]){
   room.rect=r;ctx.place(viewer);const a=card.getBoundingClientRect();
   assert.ok(!hit(a,r),`${w}x${h}: chip avoids room after pan`);
   assert.ok(a.left>=47&&a.right<=w-47&&a.top>=54&&a.bottom<=h-21,'safe and below HUD');
 }
}
// The HUD avoidance pass keeps off-screen room hitboxes reachable before the chip
// chooses a free rectangle (portrait targets used to be outside the viewer).
const clearance=src.slice(src.indexOf('function clearPlatesFromCard(viewer, card, scale){'),src.indexOf('function goalPillHtml('));
{
 const style={translate:''},original=rect(-72,94,64,64);
 const room={style,getBoundingClientRect(){const [x=0,y=0]=style.translate.split(' ').map(parseFloat);return rect(original.left+(x||0),original.top+(y||0),64,64);}};
 const viewer={querySelectorAll:()=>[room],getBoundingClientRect:()=>rect(0,0,390,844)};
 const ctx={document:{documentElement:{},getElementById:()=>null},getComputedStyle:()=>({getPropertyValue:n=>n==='--sb'?'21px':'max(47px,12px)'}),innerWidth:390,innerHeight:844};
 vm.createContext(ctx);vm.runInContext(clearance+';this.clear=clearPlatesFromCard;',ctx);ctx.clear(viewer,null,1);
 const r=room.getBoundingClientRect();assert.ok(r.left>=47&&r.right<=343&&r.top>=0&&r.bottom<=823,'room hitbox stays inside safe bounds');
}
console.log('base-goal-placement: ok');
