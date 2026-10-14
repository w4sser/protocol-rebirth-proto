// Range-sensitive world labels: far = hidden (or a dot for key objectives), mid = short name,
// near (interaction range) = full label with action. Nearest first, max `maxFull` full labels.
export const LABEL_RANGES={
  loot:{near:2.6,mid:7,far:'hidden'},
  node:{near:3.2,mid:9,far:'dot'},
  exit:{near:3.4,mid:10,far:'dot'},
  bit:{near:0,mid:0,far:'hidden'},           // BIT only shows its label while healing (forced)
  room:{near:0,mid:6,far:'hidden'},
  house:{near:1.6,mid:6,far:'hidden'},
  enemy:{near:3.5,mid:Infinity,far:'bar'}  // compact health bar; name only near/targeted/winding
};
export const MAX_ENEMY_BARS=6;
export const MAX_FULL=3;
export function labelTier(kind,dist){
  const r=LABEL_RANGES[kind];if(!r)return 'full';
  if(dist<=r.near)return 'full';
  if(dist<=r.mid)return kind==='enemy'?'bar':'short';
  return r.far;
}
// items: [{id,kind,x,z,force?}] -> Map(id -> 'hidden'|'dot'|'short'|'full')
export function planLabels(items,player,{maxFull=MAX_FULL}={}){
  const out=new Map(),fulls=[];
  for(const it of items){
    if(it.force){out.set(it.id,it.force);if(it.force==='full')fulls.push({it,d:-1});continue;}
    const d=Math.hypot(it.x-player.x,it.z-player.z),tier=labelTier(it.kind,d);
    out.set(it.id,tier);if(tier==='full')fulls.push({it,d});
  }
  fulls.sort((a,b)=>a.d-b.d);
  for(const {it} of fulls.slice(maxFull))out.set(it.id,it.kind==='enemy'?'bar':'short');
  // cap enemy bars: nearest MAX_ENEMY_BARS stay, the rest hide (forced/full ones always stay)
  const bars=items.filter(it=>out.get(it.id)==='bar').map(it=>({it,d:Math.hypot(it.x-player.x,it.z-player.z)})).sort((a,b)=>a.d-b.d);
  for(const {it} of bars.slice(MAX_ENEMY_BARS))out.set(it.id,'hidden');
  return out;
}
// Smooth fade: opacity from distance relative to the tier edge (1 inside, ramps to .35 at the far edge of mid).
export function labelOpacity(kind,dist){
  const r=LABEL_RANGES[kind];if(!r||dist<=r.near)return 1;
  if(dist<=r.mid)return Math.max(.45,1-(dist-r.near)/(r.mid-r.near)*.55);
  return .6;
}
// HUD exclusion: a label point inside any HUD rect (with padding) is hidden.
// (x,y) = label anchor; w/h = label box size (centered horizontally, box sits above/around the anchor).
export function overHUD(x,y,rects,pad=8,w=0,h=0){const l=x-w/2,rt=x+w/2,t=y-h,b=y+h*.25;
  return rects.some(r=>rt>=r.left-pad&&l<=r.right+pad&&b>=r.top-pad&&t<=r.bottom+pad);}

// De-overlap screen boxes: fixed boxes (e.g. shock-pad icons) never move; movable ones (enemy labels)
// are pushed upward until clear, max `maxShift` px, else hidden. boxes: [{id,x,y,w,h,fixed?}] (x centre, y bottom)
export function deoverlap(boxes,{gap=2,maxShift=60}={}){
  const placed=boxes.filter(b=>b.fixed).map(b=>({...b,dy:0})),out=new Map();
  for(const b of placed)out.set(b.id,0);
  const hit=(a,ay,c,cy)=>Math.abs(a.x-c.x)<(a.w+c.w)/2+gap&&!(ay-a.h>=cy+gap||cy-c.h>=ay+gap);
  for(const b of boxes.filter(b=>!b.fixed).sort((a,b)=>b.y-a.y)){
    let dy=0;
    for(let guard=0;guard<20;guard++){const y=b.y-dy,c=placed.find(p=>hit(b,y,p,p.y-p.dy));if(!c)break;dy=b.y-(c.y-c.dy-c.h-gap);}
    if(dy>maxShift){out.set(b.id,null);continue;}
    placed.push({...b,dy});out.set(b.id,dy);
  }
  return out;
}
