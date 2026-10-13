// Range-sensitive world labels: far = hidden (or a dot for key objectives), mid = short name,
// near (interaction range) = full label with action. Nearest first, max `maxFull` full labels.
export const LABEL_RANGES={
  loot:{near:2.6,mid:7,far:'hidden'},
  node:{near:3.2,mid:9,far:'dot'},
  exit:{near:3.4,mid:10,far:'dot'},
  bit:{near:0,mid:0,far:'hidden'},           // BIT only shows its label while healing (forced)
  room:{near:0,mid:6,far:'hidden'}
};
export const MAX_FULL=3;
export function labelTier(kind,dist){
  const r=LABEL_RANGES[kind];if(!r)return 'full';
  if(dist<=r.near)return 'full';
  if(dist<=r.mid)return 'short';
  return r.far;
}
// items: [{id,kind,x,z,force?}] → Map(id → 'hidden'|'dot'|'short'|'full')
export function planLabels(items,player,{maxFull=MAX_FULL}={}){
  const out=new Map(),fulls=[];
  for(const it of items){
    if(it.force){out.set(it.id,it.force);if(it.force==='full')fulls.push({it,d:-1});continue;}
    const d=Math.hypot(it.x-player.x,it.z-player.z),tier=labelTier(it.kind,d);
    out.set(it.id,tier);if(tier==='full')fulls.push({it,d});
  }
  fulls.sort((a,b)=>a.d-b.d);
  for(const {it} of fulls.slice(maxFull))out.set(it.id,'short');
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
