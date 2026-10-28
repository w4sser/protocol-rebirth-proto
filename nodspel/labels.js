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
// Per-enemy screen placement. The bar is always centred on the projected head anchor (x,y) with a small
// fixed gap above it — never a sideways offset, and never pushed around by HUD/other labels (it may
// overlap them; the caller hides it only when the enemy itself is offscreen). Clamping stays within the
// viewport so a bar near the screen edge stays rendered, which is not obstacle-avoidance. The richer
// caption/full box may stack a few px higher to clear a neighbour, but collapses to the bar once that's
// not enough. sizes describe measured DOM boxes: dy is bottom minus the CSS top coordinate.
const BAR_GAP=6;
export function placeEnemyLabel(state,{x,y,mode,sizes,rects=[],bounds,now=0,dwellMs=400,maxShift=24}){
  const st=state??{mode,modeSince:now};
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const clampY=(yy,s)=>clamp(yy,bounds.top+s.h,bounds.bottom);
  const clearAt=(yy,s)=>!rects.some(r=>x+s.w/2>=r.left-8&&x-s.w/2<=r.right+8&&yy>=r.top-8&&yy-s.h<=r.bottom+8);
  const baseY=m=>clampY(y-BAR_GAP+sizes[m].dy,sizes[m]);
  // Best vertical stack for a mode, starting from its natural (viewport-clamped) anchor;
  // null if nothing within maxShift is clear of rects.
  const fit=m=>{const s=sizes[m],top=baseY(m);for(let shift=0;shift<=maxShift;shift+=4){const yy=clampY(top-shift,s);if(clearAt(yy,s))return yy;}return null;};
  if(st.request!==mode){st.request=mode;st.requestSince=now;}
  let next=st.mode??mode;
  // Collision is the only reason to interrupt a caption's dwell. Once compact,
  // require a continuous clear interval before restoring the caption.
  if(mode!==next&&now-st.modeSince>=dwellMs&&now-st.requestSince>=dwellMs&&fit(mode)!=null)next=mode;
  let yy=next==='bar'?baseY('bar'):fit(next);
  if(next!=='bar'&&yy==null){next='bar';yy=baseY('bar');}
  if(next==='bar'&&mode!=='bar'&&fit(mode)==null)st.requestSince=now;
  if(next!==st.mode){st.mode=next;st.modeSince=now;}
  const size=sizes[next],xx=clamp(x,bounds.left+size.w/2,bounds.right-size.w/2);
  return {state:st,mode:next,x:xx,y:yy,box:{left:xx-size.w/2,right:xx+size.w/2,top:yy-size.h,bottom:yy}};
}

// Screen-space declutter for world labels: objective/info labels (node, exit, room, house) and shock-pad icons keep their
// spot; enemy labels (movable) are pushed up until clear, or hidden past maxShift. labels: [{id,kind,x,y,w,h,fixed?}] -> Map(id -> dy|null)
export const FIXED_LABEL_KINDS=new Set(['node','exit','room','house']);
// Every world-space label takes part (loot, BIT, enemy badges/bars ...); `hud` rects are re-applied AFTER shifting so a pushed-up label never lands under the HUD.
export function declutterLabels(labels,{hud=[],hudPad=8,...opts}={}){
  const out=deoverlap(labels.map(l=>({...l,fixed:l.fixed??FIXED_LABEL_KINDS.has(l.kind)})),opts);
  for(const l of labels){const dy=out.get(l.id);if(dy&&overHUD(l.x,l.y-dy,hud,hudPad,l.w,l.h))out.set(l.id,null);}
  return out;
}
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
// v1.65 stable declutter (owner playtest: overlapping labels shifted every frame and flickered). No shifting at all:
// labels are placed in priority order and a label that would overlap a placed one (or the HUD) is hidden. Hysteresis
// keeps the picture still: a label that was shown gets a bonus, and a hidden one stays hidden for `holdMs`.
// boxes: [{id,x,y,w,h,priority,anchorDy?}] (x centre, y bottom). state: Map kept by the caller across frames.
export function resolveLabels(boxes,{hud=[],hudPad=8,gap=3,now=0,holdMs=1200,state=new Map()}={}){
  const out=new Map(),placed=[];
  const hit=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+gap&&!(a.y-a.h>=b.y+gap||b.y-b.h>=a.y+gap);
  const score=b=>(b.priority||0)+(state.get(b.id)?.shown?8:0);
  for(const b of [...boxes].sort((a,c)=>score(c)-score(a)||String(a.id).localeCompare(String(c.id)))){
    const st=state.get(b.id)||{};
    const blocked=placed.some(p=>hit(b,p))||overHUD(b.x,b.y,hud,hudPad,b.w,b.h);
    if(blocked){st.shown=false;st.hiddenUntil=now+holdMs;}
    else if(!st.shown&&(st.hiddenUntil??0)>now){/* still in hold: stay hidden, but do not reserve space */}
    else{st.shown=true;placed.push(b);}
    state.set(b.id,st);out.set(b.id,!!st.shown);
  }
  for(const id of [...state.keys()])if(!out.has(id))state.delete(id);
  return out;
}
// Priority for resolveLabels: objectives first, then what the player is hunting, then threats, then the rest.
export function labelPriority({kind,needed=false,attacking=false,dist=0}){
  const base=kind==='node'||kind==='exit'?100:kind==='hazard'?95:needed?80:kind==='enemy'&&attacking?75:kind==='room'||kind==='house'?60:kind==='enemy'?50:kind==='loot'?40:30;
  return base+Math.max(0,6-dist)/2; // nearer wins a tie, by at most 3
}
