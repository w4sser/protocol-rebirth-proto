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
// Push a label's anchor just clear of any rect it overlaps (HUD panel or a higher-priority label box) —
// nearest free position — instead of hiding it. Used for enemy health bars: a visible enemy must always keep
// at least its compact bar. Coordinates are measured box bottom-centres, spanning x±w/2 and [y-h,y].
export function pushClear(x,y,w,h,rects,pad=8,bounds={left:-Infinity,right:Infinity,top:-Infinity,bottom:Infinity}){
  // Exact DOM box convention: x is its centre, y its bottom. Search obstacle edges within the
  // viewport, rather than escaping iteratively and then clamping back into an obstacle.
  const lo=bounds.left+w/2,hi=bounds.right-w/2,top=bounds.top+h,bottom=bounds.bottom;
  if(lo>hi||top>bottom)return null;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),eps=1;
  const xs=[clamp(x,lo,hi)],ys=[clamp(y,top,bottom)];
  for(const r of rects){
    xs.push(clamp(r.left-pad-w/2-eps,lo,hi),clamp(r.right+pad+w/2+eps,lo,hi));
    ys.push(clamp(r.top-pad-eps,top,bottom),clamp(r.bottom+pad+h+eps,top,bottom));
  }
  let best=null,distance=Infinity;
  for(const cy of new Set(ys))for(const cx of new Set(xs)){
    const d=(cx-x)**2+(cy-y)**2;if(d>=distance)continue;
    if(rects.some(r=>cx+w/2>=r.left-pad&&cx-w/2<=r.right+pad&&cy>=r.top-pad&&cy-h<=r.bottom+pad))continue;
    best={x:cx,y:cy};distance=d;
  }
  return best;
}

// Per-enemy screen placement. Offsets follow the projected anchor, rather than a
// fixed screen point. A clear offset is sticky, even when another edge is nearer.
// sizes describe measured DOM boxes: dy is bottom minus the CSS top coordinate.
export function placeEnemyLabel(state,{x,y,mode,sizes,rects=[],hud=rects,bounds,now=0,dwellMs=400,maxStep=8}){
  const st=state??{dx:0,dy:0,mode,modeSince:now};
  const clear=(p,s,obstacles=rects,pad=8)=>p.x-s.w/2>=bounds.left&&p.x+s.w/2<=bounds.right&&p.y-s.h>=bounds.top&&p.y<=bounds.bottom&&
    !obstacles.some(r=>p.x+s.w/2>=r.left-pad&&p.x-s.w/2<=r.right+pad&&p.y>=r.top-pad&&p.y-s.h<=r.bottom+pad);
  const at=m=>({x:x+st.dx,y:y+st.dy+sizes[m].dy});
  if(st.request!==mode){st.request=mode;st.requestSince=now;}
  let next=st.mode;
  if(mode!==next&&now-st.modeSince>=dwellMs&&now-st.requestSince>=dwellMs&&clear(at(mode),sizes[mode]))next=mode;
  // Collision is the only reason to interrupt a caption's dwell. Once compact,
  // require a continuous clear interval before restoring the caption.
  if(next!=='bar'&&!clear(at(next),sizes[next]))next='bar';
  if(next==='bar'&&mode!=='bar'&&!clear(at(mode),sizes[mode]))st.requestSince=now;
  if(next!==st.mode){st.mode=next;st.modeSince=now;}
  const size=sizes[next],previous=at(next);
  let placed=previous;
  if(!clear(previous,size)){
    const target=pushClear(previous.x,previous.y,size.w,size.h,rects,8,bounds)??
      pushClear(previous.x,previous.y,size.w,size.h,rects,0,bounds);
    if(target){
      const dx=target.x-previous.x,dy=target.y-previous.y,d=Math.hypot(dx,dy),t=Math.min(.35,maxStep/(d||1));
      const step={x:previous.x+dx*t,y:previous.y+dy*t};
      const capped={x:previous.x+dx*Math.min(1,maxStep/(d||1)),y:previous.y+dy*Math.min(1,maxStep/(d||1))};
      // Never interpolate through HUD/quest-chip geometry. Normal moving-edge
      // escapes are a few pixels; a newly appearing panel may require a snap.
      if(clear(step,size,rects,0))placed=step;
      else if(clear(capped,size,rects,0))placed=capped;
      else{
        const nearest=pushClear(previous.x,previous.y,size.w,size.h,rects,0,bounds);
        placed=nearest&&Math.hypot(nearest.x-previous.x,nearest.y-previous.y)<=maxStep?nearest:target;
      }
    }
  }
  st.dx=placed.x-x;st.dy=placed.y-y-size.dy;
  return {state:st,mode:next,x:x+st.dx,y:y+st.dy,box:{left:placed.x-size.w/2,right:placed.x+size.w/2,top:placed.y-size.h,bottom:placed.y}};
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
