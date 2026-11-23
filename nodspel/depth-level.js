// Depth Raid v2.28.64: stitch Bunker L1+L2+L3 into one walkable layout, joined by corridors
// with locked doors. Cheapest credible "same level, next area" — existing layouts translated
// into one world, not a hand-authored facility. Player walks through; no loadLevel() swap.
// v2.28.64: corridors are at least 2.4 m clear with chamfered joints so the capsule does not
// snag, and every combat room gets 2-4 cover pieces between the entry and the enemies.
import {generateLevel,placePowerPads,placeSupplyShelves,RULES} from './levels.js?v=2.28.74';
import '../data/raid-depth.js?v=2.28.74';
const DEPTH=globalThis.DATA.raidDepth;

const WALL_T=RULES.wallThickness;
const LINK_GAP=10;
// Clear walkable width is LINK_WIDTH minus the two wall thicknesses that sit on the
// corridor floor. 2.4 m clear => floor slab 2.4 + 2*WALL_T (0.4) = 3.2 m (v2.28.64).
export const DEPTH_CLEAR_WIDTH=2.4;
export const DEPTH_CHAMFER=0.7;
export const LINK_WIDTH=DEPTH_CLEAR_WIDTH+2*WALL_T;
const DOOR_T=RULES.encounters.door.thickness;
const DOOR_H=RULES.encounters.door.height;

const POSE_KEYS=new Set(['end','start','exit','partition']);
function isPose(o,key){
  if(!o||typeof o!=='object'||typeof o.x!=='number'||typeof o.z!=='number')return false;
  if(POSE_KEYS.has(key))return true;
  return 'w' in o||'d' in o||'r' in o||'h' in o||'id' in o||'name' in o||'item' in o||'health' in o||'kind' in o||'type' in o;
}
function skipKey(parent,key){
  if(key==='dir'||key==='incoming')return true;
  if(key==='doors'&&Array.isArray(parent.doors)&&parent.doors.every(d=>d&&typeof d.x==='number'&&!('w' in d)&&!('id' in d)))return true;
  return false;
}
export function offsetLevel(level,dx,dz){
  const seen=new Set();
  const walk=(v,key)=>{
    if(!v||typeof v!=='object'||seen.has(v))return;
    seen.add(v);
    if(Array.isArray(v)){for(const item of v)walk(item,key);return;}
    if(isPose(v,key)){v.x+=dx;v.z+=dz;}
    for(const k of Object.keys(v)){if(!skipKey(v,k))walk(v[k],k);}
  };
  walk(level,null);
  return level;
}

function roomHasDir(room,dir){
  return (room.doors??[]).some(d=>d.x===dir.x&&d.z===dir.z);
}
function roomOf(level,p){
  return (level.rooms??[]).find(r=>Math.abs(p.x-r.x)<=r.w/2&&Math.abs(p.z-r.z)<=r.d/2)??null;
}
function punchOpening(level,room,dir,mouth){
  const isX=dir.x!==0,length=isX?room.d:room.w;
  const edge={x:room.x+dir.x*(room.w/2-WALL_T/2),z:room.z+dir.z*(room.d/2-WALL_T/2)};
  const onEdge=w=>{
    if(isX)return Math.abs(w.x-edge.x)<.2&&Math.abs(w.w-WALL_T)<.25&&Math.abs(w.z-room.z)<room.d/2+.2;
    return Math.abs(w.z-edge.z)<.2&&Math.abs(w.d-WALL_T)<.25&&Math.abs(w.x-room.x)<room.w/2+.2;
  };
  level.walls=level.walls.filter(w=>!onEdge(w));
  for(const sign of [-1,1])level.walls.push({
    x:edge.x+(isX?0:sign*(length+mouth)/4),
    z:edge.z+(isX?sign*(length+mouth)/4:0),
    w:isX?WALL_T:(length-mouth)/2,
    d:isX?(length-mouth)/2:WALL_T,
    h:.85,
  });
  (room.doors??=[]).push({x:dir.x,z:dir.z});
}

function retagPart(level,area){
  const prefix=`a${area}`;
  const bump=(list,extra)=>{
    for(const o of list??[]){
      if(o&&o.id!=null)o.id=`${prefix}-${o.id}`;
      if(o&&o.key!=null)o.key=`${prefix}-${o.key}`;
      if(o&&o.nodeId!=null)o.nodeId=`${prefix}-${o.nodeId}`;
      if(o&&o.padId!=null)o.padId=`${prefix}-${o.padId}`;
      if(o&&o.junctionId!=null)o.junctionId=`${prefix}-${o.junctionId}`;
      if(o&&o.patrolId!=null)o.patrolId=`${prefix}-${o.patrolId}`;
      if(o&&o.guardId!=null)o.guardId=`${prefix}-${o.guardId}`;
      if(o&&o.enemyId!=null)o.enemyId=`${prefix}-${o.enemyId}`;
      if(typeof extra==='function')extra(o);
    }
  };
  bump(level.enemies,e=>{e.depthArea=area;if(area>1)e.sleeping=true;e.active=true;});
  bump(level.lootBoxes,b=>{b.depthArea=area;delete b.requiresNode;});
  bump(level.doors);
  bump(level.barrels,b=>{b.depthArea=area;});
  bump(level.hazards,h=>{h.depthArea=area;});
  bump(level.shelves);
  bump(level.junctions);
  bump(level.encounters,e=>{e.depthArea=area;});
  bump(level.spawners,s=>{s.depthArea=area;if(area>1)s.sleeping=true;});
  bump(level.boxes);
  bump(level.nodes);
  for(const r of level.rooms??[])r.depthArea=area;
  level.nodes=[];
}

function snapshotRules(level){
  return {number:level.number,title:level.title,enemyDamage:level.enemyDamage,dmgMul:level.dmgMul??1,
    enemyCooldownMs:level.enemyCooldownMs,enemyWindupMs:level.enemyWindupMs,firstGraceMs:level.firstGraceMs};
}

const MERGE_KEYS=['rooms','floors','walls','boxes','lootBoxes','enemies','corridors','deadEnds','doors',
  'hazards','barrels','encounters','routeChoices','shelves','junctions','spawners'];

function mergeInto(target,part){
  for(const k of MERGE_KEYS){
    if(!part[k]?.length)continue;
    (target[k]??=[]).push(...part[k]);
  }
  if(part.closet&&!target.closet)target.closet=part.closet;
  if(part.startRoom)target.startRoom=true;
}

function boundsOf(level){
  const xs=[],zs=[];
  for(const a of [...level.rooms??[],...level.floors??[],...level.walls??[],...level.corridors??[]]){
    xs.push(a.x-(a.w||0)/2,a.x+(a.w||0)/2);
    zs.push(a.z-(a.d||0)/2,a.z+(a.d||0)/2);
  }
  return {minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
}

function rectsOverlap(a,b,pad=0.05){
  return Math.abs(a.x-b.x)<(a.w+b.w)/2-pad&&Math.abs(a.z-b.z)<(a.d+b.d)/2-pad;
}
function allRooms(from,to){return [...from.rooms??[],...to.rooms??[]];}
function rectBlocked(rect,rooms,ignore){
  return rooms.some(r=>r!==ignore[0]&&r!==ignore[1]&&rectsOverlap(rect,r,0.02));
}
function addLinkSegment(from,x1,z1,x2,z2,fromArea,toArea,doorId){
  const alongX=Math.abs(x2-x1)>=Math.abs(z2-z1);
  const x=(x1+x2)/2,z=(z1+z2)/2;
  // Overlap joints by a full corridor width so the player's corner samples stay on a floor.
  const overlap=LINK_WIDTH;
  const w=alongX?Math.abs(x2-x1)+overlap:LINK_WIDTH;
  const d=alongX?LINK_WIDTH:Math.abs(z2-z1)+overlap;
  const floor={x,z,w,d,width:LINK_WIDTH,dir:alongX?{x:Math.sign(x2-x1),z:0}:{x:0,z:Math.sign(z2-z1)},
    depthLink:true,depthAreaFrom:fromArea,depthAreaTo:toArea,doorId};
  from.floors.push(floor);
  (from.corridors??=[]).push({...floor});
  // Side walls stop short of each end so they never cap an L-junction or a punched doorway.
  const trim=LINK_WIDTH/2+WALL_T;
  if(alongX){
    const wallW=Math.max(.3,w-2*trim);
    for(const sign of [-1,1])from.walls.push({x,z:z+sign*(LINK_WIDTH/2-WALL_T/2),w:wallW,d:WALL_T,h:.85});
  }else{
    const wallD=Math.max(.3,d-2*trim);
    for(const sign of [-1,1])from.walls.push({x:x+sign*(LINK_WIDTH/2-WALL_T/2),z,w:WALL_T,d:wallD,h:.85});
  }
  return floor;
}
function punchInto(level,room,toward){
  const dx=toward.x-room.x,dz=toward.z-room.z;
  const dir=Math.abs(dx)>Math.abs(dz)?{x:Math.sign(dx),z:0}:{x:0,z:Math.sign(dz)};
  punchOpening(level,room,dir,LINK_WIDTH);
  chamferOpening(level,room,dir,LINK_WIDTH);
  return dir;
}
// Cut the 90-degree jamb that used to snag the player capsule: flare the
// opening toward the room by DEPTH_CHAMFER and drop a square floor pad so
// corner samples stay on a floor while the walls no longer meet at a point.
function chamferOpening(level,room,dir,mouth){
  const isX=dir.x!==0,c=DEPTH_CHAMFER;
  const edgeX=room.x+dir.x*(room.w/2),edgeZ=room.z+dir.z*(room.d/2);
  const pad={x:edgeX-dir.x*(c/2),z:edgeZ-dir.z*(c/2),
    w:isX?c+WALL_T:mouth+2*c,d:isX?mouth+2*c:c+WALL_T};
  level.floors.push({...pad,depthChamfer:true,depthArea:room.depthArea});
}
function addBendPad(from,x,z){
  const s=LINK_WIDTH+DEPTH_CHAMFER*2;
  from.floors.push({x,z,w:s,d:s,depthChamfer:true,depthLink:true});
}
function linkParts(from,to,fromArea,toArea,gap=LINK_GAP){
  const roomA=roomOf(from,from.exit)??from.rooms.at(-1);
  const roomB=roomOf(to,to.start)??to.rooms[0];
  const ba=boundsOf(from),bb0=boundsOf(to);
  offsetLevel(to,0,(ba.minZ-gap)-bb0.maxZ);
  offsetLevel(to,roomA.x-roomB.x,0);
  const ba2=boundsOf(from),bb=boundsOf(to);
  const clearZ=ba2.minZ-gap/2;
  const aSouth=roomA.z-roomA.d/2;
  const bNorth=roomB.z+roomB.d/2;
  const rooms=allRooms(from,to);
  const straightRect={x:roomA.x,z:(aSouth+bNorth)/2,w:LINK_WIDTH,d:Math.abs(aSouth-bNorth)};
  const straight=!rectBlocked(straightRect,rooms,[roomA,roomB])&&!roomHasDir(roomA,{x:0,z:-1})&&!roomHasDir(roomB,{x:0,z:1});
  const doorId=`depth-door-${fromArea}`;
  let doorX=roomA.x,doorZ=aSouth-1.2,doorW=LINK_WIDTH,doorD=DOOR_T;
  if(straight){
    punchOpening(from,roomA,{x:0,z:-1},LINK_WIDTH);chamferOpening(from,roomA,{x:0,z:-1},LINK_WIDTH);
    punchOpening(to,roomB,{x:0,z:1},LINK_WIDTH);chamferOpening(to,roomB,{x:0,z:1},LINK_WIDTH);
    addLinkSegment(from,roomA.x,aSouth,roomA.x,bNorth,fromArea,toArea,doorId);
  }else{
    // Walk around `to`'s bounding box so winding L3 rooms/corridors cannot block the aisle.
    const bb=boundsOf(to);
    const eastFree=!roomHasDir(roomB,{x:1,z:0}),westFree=!roomHasDir(roomB,{x:-1,z:0});
    const side=(eastFree&&!westFree)?1:(westFree&&!eastFree)?-1:(Math.abs((bb.maxX+2)-roomA.x)<=Math.abs((bb.minX-2)-roomA.x)?1:-1);
    const aisleX=side>0?bb.maxX+2:bb.minX-2;
    const arriveX=roomB.x+side*(roomB.w/2);
    const arriveZ=roomB.z;
    punchOpening(from,roomA,{x:0,z:-1},LINK_WIDTH);chamferOpening(from,roomA,{x:0,z:-1},LINK_WIDTH);
    punchOpening(to,roomB,{x:side,z:0},LINK_WIDTH);chamferOpening(to,roomB,{x:side,z:0},LINK_WIDTH);
    addLinkSegment(from,roomA.x,aSouth,roomA.x,clearZ,fromArea,toArea,doorId);
    addBendPad(from,roomA.x,clearZ);
    if(Math.abs(aisleX-roomA.x)>0.05)addLinkSegment(from,roomA.x,clearZ,aisleX,clearZ,fromArea,toArea,doorId);
    addBendPad(from,aisleX,clearZ);
    addLinkSegment(from,aisleX,clearZ,aisleX,arriveZ,fromArea,toArea,doorId);
    addBendPad(from,aisleX,arriveZ);
    if(Math.abs(arriveX-aisleX)>0.05)addLinkSegment(from,aisleX,arriveZ,arriveX,arriveZ,fromArea,toArea,doorId);
    doorX=roomA.x;doorZ=Math.min(aSouth-1.2,clearZ+1);
  }
  const door={id:doorId,x:doorX,z:doorZ,w:doorW,d:doorD,h:DOOR_H,locked:true,depth:true,depthAreaFrom:fromArea,depthAreaTo:toArea};
  (from.doors??=[]).push(door);
  return {from:fromArea,to:toArea,doorId,x:doorX,z:doorZ,w:doorW,d:8,axis:'z',sign:-1,door};
}


// v2.28.64: L2/L3 bunker passages are authored at 1.8–2.2 m (≈1.0–1.4 m clear once
// side walls sit on the floor). Depth Raid widens every corridor, doorway and
// partition gap to the same 2.4 m clear / 3.2 m slab as the inter-area links.
export function widenDepthPassages(level){
  const target=LINK_WIDTH,t=WALL_T;
  const isRoomFloor=f=>(level.rooms??[]).some(r=>Math.abs(r.x-f.x)<.25&&Math.abs(r.z-f.z)<.25&&Math.abs(r.w-f.w)<.35&&Math.abs(r.d-f.d)<.35);
  const passages=[...(level.corridors??[]),...(level.deadEnds??[])];
  const floors=level.floors??[];
  const widenOne=(body,oldShort)=>{
    const alongX=Math.abs(body.dir?.x||0)>=Math.abs(body.dir?.z||0)?!!(body.dir&&body.dir.x):body.w>=body.d;
    const short=alongX?body.d:body.w;
    if(short>=target-0.01)return short;
    const old=oldShort??short;
    if(alongX)body.d=target;else body.w=target;
    body.width=target;
    const delta=(target-old)/2;
    const oldSide=old/2-t/2;
    for(const w of level.walls??[]){
      const thin=alongX?(Math.abs(w.d-t)<.2):(Math.abs(w.w-t)<.2);
      if(!thin)continue;
      const lat=alongX?Math.abs(w.z-body.z):Math.abs(w.x-body.x);
      const along=alongX?Math.abs(w.x-body.x)<=(Math.max(w.w,body.w)/2+t+0.2):Math.abs(w.z-body.z)<=(Math.max(w.d,body.d)/2+t+0.2);
      if(!along||Math.abs(lat-oldSide)>0.45)continue;
      if(alongX)w.z+=Math.sign(w.z-body.z||1)*delta;
      else w.x+=Math.sign(w.x-body.x||1)*delta;
    }
    // Cap walls at a dead-end / closet far end are as wide as the old passage
    // (thin along the run, wide across it).
    if(body.end){
      for(const w of level.walls??[]){
        const isCap=alongX
          ?(Math.abs(w.d-old)<.45&&Math.abs(w.w-t)<.2)
          :(Math.abs(w.w-old)<.45&&Math.abs(w.d-t)<.2);
        if(!isCap)continue;
        if(Math.hypot(w.x-body.end.x,w.z-body.end.z)>1.6)continue;
        if(alongX)w.d=target;else w.w=target;
      }
    }
    return old;
  };
  for(const c of passages){
    const old=Math.min(c.w,c.d);
    widenOne(c,old);
    // Matching floor tiles (a slightly padded copy of the corridor).
    for(const f of floors){
      if(isRoomFloor(f)||f.depthLink||f.depthChamfer)continue;
      if(Math.abs(f.x-c.x)>.2||Math.abs(f.z-c.z)>.2)continue;
      const alongX=c.dir?!!c.dir.x:f.w>=f.d;
      if(alongX){if(f.d<target)f.d=target;}
      else if(f.w<target)f.w=target;
    }
  }
  // Room doorway mouths: recut every unit-dir opening to LINK_WIDTH and chamfer it.
  for(const room of level.rooms??[]){
    const dirs=(room.doors??[]).filter(d=>d&&typeof d.x==='number'&&Math.abs(d.x)+Math.abs(d.z??0)<=1.01&&!('w' in d)&&!('id' in d));
    // Unique dirs (punchOpening also pushes the same dir again for depth links).
    const seen=new Set();
    for(const dir of dirs){
      const key=`${dir.x},${dir.z}`;
      if(seen.has(key))continue;seen.add(key);
      recutOpening(level,room,dir,target);
      chamferOpening(level,room,dir,target);
    }
  }
  widenPartitionGaps(level,2.4);
  return level;
}
function recutOpening(level,room,dir,mouth){
  const isX=dir.x!==0,length=isX?room.d:room.w;
  const edge={x:room.x+dir.x*(room.w/2-WALL_T/2),z:room.z+dir.z*(room.d/2-WALL_T/2)};
  const onEdge=w=>{
    if(w.depthChamfer)return false;
    if(isX)return Math.abs(w.x-edge.x)<.35&&Math.abs(w.w-WALL_T)<.25&&Math.abs(w.z-room.z)<room.d/2+.3;
    return Math.abs(w.z-edge.z)<.35&&Math.abs(w.d-WALL_T)<.25&&Math.abs(w.x-room.x)<room.w/2+.3;
  };
  level.walls=(level.walls??[]).filter(w=>!onEdge(w));
  for(const sign of [-1,1])level.walls.push({
    x:edge.x+(isX?0:sign*(length+mouth)/4),
    z:edge.z+(isX?sign*(length+mouth)/4:0),
    w:isX?WALL_T:(length-mouth)/2,
    d:isX?(length-mouth)/2:WALL_T,
    h:.85,
  });
}
function widenPartitionGaps(level,minClear){
  for(const room of level.rooms??[]){
    const inner=(level.walls??[]).filter(w=>{
      if(w.depthChamfer)return false;
      const inX=Math.abs(w.x-room.x)+w.w/2<room.w/2-0.05;
      const inZ=Math.abs(w.z-room.z)+w.d/2<room.d/2-0.05;
      return inX&&inZ&&(w.h??1)>=1.2;
    });
    // Pair colinear internal walls that leave a narrow gap.
    for(let i=0;i<inner.length;i++)for(let j=i+1;j<inner.length;j++){
      const a=inner[i],b=inner[j];
      if(Math.abs(a.z-b.z)<0.3&&a.d<=.7&&b.d<=.7){
        const segs=[a,b].sort((u,v)=>u.x-v.x);
        const gapL=segs[0].x+segs[0].w/2,gapR=segs[1].x-segs[1].w/2,gap=gapR-gapL;
        if(gap>0.4&&gap<minClear){
          const need=(minClear-gap)/2;
          segs[0].w=Math.max(.3,segs[0].w-need);segs[0].x-=need/2;
          segs[1].w=Math.max(.3,segs[1].w-need);segs[1].x+=need/2;
        }
      }
      if(Math.abs(a.x-b.x)<0.3&&a.w<=.7&&b.w<=.7){
        const segs=[a,b].sort((u,v)=>u.z-v.z);
        const gapL=segs[0].z+segs[0].d/2,gapR=segs[1].z-segs[1].d/2,gap=gapR-gapL;
        if(gap>0.4&&gap<minClear){
          const need=(minClear-gap)/2;
          segs[0].d=Math.max(.3,segs[0].d-need);segs[0].z-=need/2;
          segs[1].d=Math.max(.3,segs[1].d-need);segs[1].z+=need/2;
        }
      }
    }
  }
}


function mulberry(seed){
  let h=2166136261;
  for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);
  return ()=>{h=Math.imul(h^h>>>15,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h>>>0)/4294967296;};
}
function depthSpotFree(level,p,r=0.7){
  const solids=[...(level.walls??[]),...(level.boxes??[])];
  if(solids.some(o=>Math.abs(p.x-o.x)<(o.w||0)/2+r&&Math.abs(p.z-o.z)<(o.d||0)/2+r))return false;
  const keep=[level.start,level.exit,...(level.lootBoxes??[]),...(level.enemies??[]),...(level.hazards??[]),...(level.nodes??[]),...(level.doors??[])];
  if(keep.some(o=>o&&typeof o.x==='number'&&Math.hypot(p.x-o.x,p.z-o.z)<1.6))return false;
  return (level.rooms??[]).some(rm=>Math.abs(p.x-rm.x)<=rm.w/2-1.2&&Math.abs(p.z-rm.z)<=rm.d/2-1.2);
}
// v2.28.61: area 1 stays at stock L1 numbers; areas 2 and 3 get extra fillers plus HP/damage
// scaling on top of the stitched L2/L3 layouts. Runs on each part before retag/offset.
export function applyDepthAreaScale(part,area,scale){
  const knobs=scale??DEPTH.areaScale?.[area-1]??{enemyCountAdd:0,healthMul:1,damageMul:1};
  const add=knobs.enemyCountAdd??0,hp=knobs.healthMul??1,dmg=knobs.damageMul??1;
  if(dmg!==1){
    part.enemyDamage=Math.round((part.enemyDamage??RULES.combat.damage)*dmg);
    part.dmgMul=(part.dmgMul??1)*dmg;
  }
  const templates=(part.enemies??[]).filter(e=>e.type!=='generator'&&!e.swarm&&e.encounter!=='guard'&&e.encounter!=='turret'&&e.encounter!=='shield_turret'&&e.encounter!=='patrol');
  const base=templates[0]??{kind:'enemy',r:.48,health:RULES.levels[(area-1)]?.enemyHealth??RULES.enemyHealth,speed:RULES.levels[(area-1)]?.enemySpeed??1};
  const rng=mulberry(`${part.seed||''}:depth-extra:${area}`);
  let placed=0;
  for(let n=0;n<add;n++){
    let spot=null;
    for(let tries=0;tries<400&&!spot;tries++){
      const room=(part.rooms??[])[Math.floor(rng()*Math.max(1,(part.rooms??[]).length))];
      if(!room)break;
      const p={x:room.x+(rng()-.5)*(room.w-2.8),z:room.z+(rng()-.5)*(room.d-2.8)};
      if(depthSpotFree(part,p))spot=p;
    }
    if(!spot)continue;
    const e={...base,id:`extra-${n+1}`,x:Math.round(spot.x*100)/100,z:Math.round(spot.z*100)/100,
      health:base.health,r:base.r??.48,speed:base.speed,kind:base.kind??'enemy'};
    delete e.patrol;delete e.patrolId;delete e.guardId;delete e.generatorId;delete e.node;delete e.swarm;delete e.encounter;delete e.sleeping;
    e.active=true;
    (part.enemies??=[]).push(e);
    placed++;
  }
  if(hp!==1){
    for(const e of part.enemies??[]){
      if(!(e.health>0))continue;
      e.health=Math.max(1,Math.round(e.health*hp));
      if(e.maxHealth!=null)e.maxHealth=Math.max(1,Math.round(e.maxHealth*hp));
    }
  }
  return {placed,healthMul:hp,damageMul:dmg,enemyCountAdd:add};
}

export function generateDepthLevel(seed,opts={}){
  const area=opts.area??'bunker',hard=!!opts.hard,completedRaids=opts.completedRaids??0,ftue=!!opts.ftue;
  const parts=[1,2,3].map(n=>generateLevel(n,seed,area,hard,false));
  placePowerPads(parts[0],completedRaids,ftue);
  placeSupplyShelves(parts[1],completedRaids,ftue);
  for(let i=0;i<parts.length;i++)applyDepthAreaScale(parts[i],i+1);
  const rules=parts.map(snapshotRules);
  const exits=parts.map(p=>({x:p.exit.x,z:p.exit.z,r:DEPTH.extractRadius,depthArea:p.number}));
  const starts=parts.map(p=>({x:p.start.x,z:p.start.z,depthArea:p.number}));
  for(let i=0;i<parts.length;i++)retagPart(parts[i],i+1);
  // retag does not move exits/starts; they stay on the part objects and will be offset with the part.
  const links=[];
  links.push(linkParts(parts[0],parts[1],1,2));
  links.push(linkParts(parts[1],parts[2],2,3));
  // After the second link, parts[1] (and its already-placed door into parts[0]?) wait:
  // linkParts(parts[0], parts[1]) offsets parts[1] and adds door/corridor onto parts[0].
  // linkParts(parts[1], parts[2]) offsets parts[2] and adds door/corridor onto parts[1].
  // When we merge, both links come along. Good.
  // But exits/starts snapshots were taken BEFORE offset — must recapture after offset.
  const depthExits=parts.map((p,i)=>({x:p.exit.x,z:p.exit.z,r:DEPTH.extractRadius,depthArea:i+1}));
  const depthStarts=parts.map((p,i)=>({x:p.start.x,z:p.start.z,depthArea:i+1}));
  const level={
    number:1,seed,title:'Depth Raid',theme:parts[0].theme,depth:true,
    enemyDamage:rules[0].enemyDamage,dmgMul:rules[0].dmgMul,
    enemyCooldownMs:rules[0].enemyCooldownMs,enemyWindupMs:rules[0].enemyWindupMs,
    firstGraceMs:rules[0].firstGraceMs,
    rooms:[],floors:[],walls:[],boxes:[],lootBoxes:[],enemies:[],corridors:[],
    deadEnds:[],doors:[],hazards:[],barrels:[],encounters:[],routeChoices:[],nodes:[],
    start:null,exit:null,
  };
  for(const p of parts)mergeInto(level,p);
  level.start={x:parts[0].start.x,z:parts[0].start.z};
  level.depthExits=depthExits;
  level.depthStarts=depthStarts;
  level.depthLinks=links.map(({from,to,doorId,x,z,w,d,axis,sign})=>({from,to,doorId,x,z,w,d,axis,sign}));
  widenDepthPassages(level);
  placeDepthCover(level);
  // One hatch per area so EXTRACT in area 3 is visible in area 3, not back at the area-1 pad
  // that buildWorld used to treat as the only exit (Robert, 21 Nov 2026: "jag hittade inte ut").
  level.extracts=depthExits.map(e=>({x:e.x,z:e.z,r:e.r??1,depthArea:e.depthArea}));
  level.exit={x:depthExits[0].x,z:depthExits[0].z,r:depthExits[0].r,depthArea:1};
  level.depthAreaRules=rules;
  level.hard=hard||undefined;
  return level;
}

export function areaAt(level,pos){
  if(!level||!pos)return null;
  for(const room of level.rooms??[]){
    if(Math.abs(pos.x-room.x)<=room.w/2&&Math.abs(pos.z-room.z)<=room.d/2)return room.depthArea??null;
  }
  const doorOf=id=>(level.doors??[]).find(d=>d.id===id);
  for(const f of level.floors??[]){
    if(!f.depthLink)continue;
    if(Math.abs(pos.x-f.x)>f.w/2+0.2||Math.abs(pos.z-f.z)>f.d/2+0.2)continue;
    const door=doorOf(f.doorId);
    if(!door)return f.depthAreaFrom;
    const dest=level.depthStarts?.find(s=>s.depthArea===f.depthAreaTo);
    if(!dest)return pos.z<door.z?f.depthAreaTo:f.depthAreaFrom;
    const toDest=Math.hypot(pos.x-dest.x,pos.z-dest.z),toDoor=Math.hypot(pos.x-door.x,pos.z-door.z);
    return toDest<toDoor?f.depthAreaTo:f.depthAreaFrom;
  }
  return null;
}

export function depthDoor(level,fromArea){
  return (level.doors??[]).find(d=>d.depth&&d.depthAreaFrom===fromArea)??null;
}

export function applyAreaCombat(level,area){
  const r=level.depthAreaRules?.[area-1];
  if(!r)return r;
  level.enemyDamage=r.enemyDamage;
  level.dmgMul=r.dmgMul;
  level.enemyCooldownMs=r.enemyCooldownMs;
  level.enemyWindupMs=r.enemyWindupMs;
  return r;
}

export function wakeArea(level,area){
  for(const e of level.enemies??[])if(e.depthArea===area){e.sleeping=false;e.active=true;}
  for(const s of level.spawners??[])if(s.depthArea===area)s.sleeping=false;
}

export function scaleDepthRules(level,knobs={}){
  const dmg=knobs.dmg??1,cadence=knobs.cadence??1;
  for(const r of level.depthAreaRules??[]){
    if(dmg!==1){r.enemyDamage=Math.round((r.enemyDamage??RULES.combat.damage)*dmg);r.dmgMul=(r.dmgMul??1)*dmg;}
    if(cadence!==1)r.enemyCooldownMs=Math.round((r.enemyCooldownMs??RULES.combat.cooldownMs)*cadence);
  }
  applyAreaCombat(level,1);
}

export function levelBounds(level){return boundsOf(level);}

function inRoom(room,p,pad=0){
  return Math.abs(p.x-room.x)<=room.w/2-pad&&Math.abs(p.z-room.z)<=room.d/2-pad;
}
function snapToRoom(room,p,pad=0.6){
  return {
    x:Math.max(room.x-room.w/2+pad,Math.min(room.x+room.w/2-pad,p.x)),
    z:Math.max(room.z-room.d/2+pad,Math.min(room.z+room.d/2-pad,p.z)),
  };
}
function roomEntry(level,room){
  const area=room.depthArea,start=(level.depthStarts??[]).find(s=>s.depthArea===area);
  const incoming=area>1?depthDoor(level,area-1):null;
  let at=null;
  if(start&&inRoom(room,start,0)&&incoming)at={x:incoming.x,z:incoming.z};
  else if(start&&inRoom(room,start,0))at={x:start.x,z:start.z};
  else{
    const target=start??level.start??{x:room.x,z:room.z};
    const dirs=(room.doors??[]).filter(d=>d&&typeof d.x==='number'&&Math.abs(d.x)+Math.abs(d.z??0)<=1.01&&!('w' in d)&&!('id' in d));
    if(dirs.length){
      let best=null,bestD=Infinity;
      for(const dir of dirs){
        const p={x:room.x+dir.x*(room.w/2),z:room.z+dir.z*(room.d/2)};
        const d=Math.hypot(p.x-target.x,p.z-target.z);
        if(d<bestD){best=p;bestD=d;}
      }
      if(best)at=best;
    }
  }
  if(!at)at={x:room.x,z:room.z+(room.d/2)};
  // Depth doors sit in the corridor, not in the room. Plan cover from the
  // doorway on the room's inside edge so pieces actually land in the room.
  return snapToRoom(room,at,0.6);
}
function coverBetween(entry,enemies,box){
  if(!enemies.length)return false;
  return enemies.some(e=>{
    const dx=e.x-entry.x,dz=e.z-entry.z,len=Math.hypot(dx,dz);
    if(len<.8)return false;
    // Closest point on the entry-to-enemy segment to the box center.
    const t=Math.max(0.12,Math.min(0.88,((box.x-entry.x)*dx+(box.z-entry.z)*dz)/(len*len)));
    const px=entry.x+t*dx,pz=entry.z+t*dz;
    // Offset pieces with an open flank still count as tactically "between" if they sit
    // close enough to be a flanking option, but they must stay outside the clear main-route
    // lane (see blocksMainRoute) -- cover is a side option, never a wall across the lane.
    const lat=Math.hypot(box.x-px,box.z-pz);
    return lat<=Math.max(box.w,box.d)/2+1.65;
  });
}
// The room's far door (the one continuing the route away from the entry), used as the
// other end of the main-route lane that cover must never block (v2.28.66: Robert 22 Nov
// 2026, cover crates sat in the middle of the walkway in a combat room).
function roomExitPoint(level,room,entry){
  const dirs=(room.doors??[]).filter(d=>d&&typeof d.x==='number'&&Math.abs(d.x)+Math.abs(d.z??0)<=1.01&&!('w' in d)&&!('id' in d));
  let best=null,bestD=-1;
  for(const dir of dirs){
    const p={x:room.x+dir.x*(room.w/2),z:room.z+dir.z*(room.d/2)};
    const d=Math.hypot(p.x-entry.x,p.z-entry.z);
    if(d>bestD){bestD=d;best=p;}
  }
  return bestD>1?best:null;
}
// Perpendicular distance from p to the entry->exit segment (clamped to the segment span).
function segmentLateral(p,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz||1;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len2));
  return Math.hypot(p.x-(a.x+t*dx),p.z-(a.z+t*dz));
}
// A ~1.25 m cover box's own half-extent, so its near edge (not just its center) clears the lane.
const COVER_HALF_EXTENT=0.65;
export const DEPTH_COVER_LANE_HALF=DEPTH_CLEAR_WIDTH/2+COVER_HALF_EXTENT;
function blocksMainRoute(p,entry,exit){
  if(!exit)return false;
  return segmentLateral(p,entry,exit)<DEPTH_COVER_LANE_HALF;
}
// Every combat room (a room that has enemies) gets 2-4 cover pieces as tactical, flanking
// options near the entry-to-enemy approach, with an open flank on one side. None of them may
// sit inside the clear lane between the room's entry and its far (exit/connector) door.
export function placeDepthCover(level){
  const reserved=reservedNavPath(level);
  const rooms=level.rooms??[];
  for(const room of rooms){
    const enemies=(level.enemies??[]).filter(e=>e.health>0&&inRoom(room,e,0.2));
    if(!enemies.length)continue;
    const entry=roomEntry(level,room);
    const exit=roomExitPoint(level,room,entry);
    const existing=(level.boxes??[]).filter(b=>inRoom(room,b,0.2));
    const useful=existing.filter(b=>coverBetween(entry,enemies,b)&&!blocksMainRoute(b,entry,exit));
    const want=Math.max(2,Math.min(4,useful.length>=2?useful.length:2+(enemies.length>2?1:0)+(room.w*room.d>80?1:0)));
    if(useful.length>=want)continue;
    const cx=enemies.reduce((s,e)=>s+e.x,0)/enemies.length;
    const cz=enemies.reduce((s,e)=>s+e.z,0)/enemies.length;
    const dx=cx-entry.x,dz=cz-entry.z,len=Math.hypot(dx,dz)||1;
    const ux=dx/len,uz=dz/len,px=-uz,pz=ux;
    const rng=mulberry(`${level.seed||''}:depth-cover:${room.x.toFixed(1)},${room.z.toFixed(1)}`);
    const flank=rng()<.5?-1:1;
    const ok=p=>{
      if(!inRoom(room,p,0.65))return false;
      if(!coverSpotFree(level,p,0.7))return false;
      if(inWallOpening(level,p,0.9))return false;
      if(reserved.near(p,0.65))return false;
      if(blocksMainRoute(p,entry,exit))return false;
      if((level.doors??[]).some(d=>d.depth&&Math.hypot(p.x-d.x,p.z-d.z)<2.0))return false;
      if(Math.hypot(p.x-entry.x,p.z-entry.z)<1.45)return false;
      return true;
    };
    // Lateral offsets start just past the clear lane so a candidate is a side option, not a wall.
    const LANE=exit?DEPTH_COVER_LANE_HALF:0.95;
    const candidates=[];
    for(const fl of [flank,-flank]){
      for(let i=0;i<18;i++){
        const t=0.25+0.55*(i/17);
        const side=fl*(LANE+0.55*(i%4)/3);
        candidates.push({x:entry.x+ux*len*t+px*side,z:entry.z+uz*len*t+pz*side});
      }
    }
    for(let t=0.28;t<=0.8;t+=0.08){
      for(let s=-2.8;s<=2.8;s+=0.4){
        if(Math.abs(s)<LANE)continue;
        candidates.push({x:entry.x+ux*len*t+px*s,z:entry.z+uz*len*t+pz*s});
      }
    }
    // Wall-hugging last resort: sit a low wall just inside a long side, still a flanking option.
    for(const fl of [flank,-flank]){
      for(const t of [0.35,0.5,0.65]){
        const side=fl*((Math.abs(ux)>Math.abs(uz)?room.w:room.d)/2-1.05);
        candidates.push({x:entry.x+ux*len*t+px*side,z:entry.z+uz*len*t+pz*side});
      }
    }
    let added=0,need=want-useful.length;
    const place=(p,along)=>{
      const box={x:Math.round(p.x*100)/100,z:Math.round(p.z*100)/100,
        w:along?1.25:.55,d:along?.55:1.25,h:.95,depthCover:true,depthArea:room.depthArea};
      (level.boxes??=[]).push(box);added++;
    };
    const along=Math.abs(ux)>Math.abs(uz);
    for(const raw of candidates){
      if(added>=need)break;
      if(!ok(raw))continue;
      place(raw,along);
    }
    // Deterministic last try: two flank spots on the approach, slightly looser but still off-lane.
    if(added<need){
      const loose=p=>inRoom(room,p,0.5)&&coverSpotFree(level,p,0.55)&&!inWallOpening(level,p,0.8)
        &&!blocksMainRoute(p,entry,exit)
        &&!(level.doors??[]).some(d=>d.depth&&Math.hypot(p.x-d.x,p.z-d.z)<1.8)
        &&Math.hypot(p.x-entry.x,p.z-entry.z)>=1.2;
      for(const t of [0.4,0.55,0.7]){
        if(added>=need)break;
        for(const fl of [1,-1]){
          if(added>=need)break;
          const p={x:entry.x+ux*len*t+px*fl*(LANE+0.7),z:entry.z+uz*len*t+pz*fl*(LANE+0.7)};
          if(loose(p))place(p,along);
        }
      }
    }
  }
  pruneCoverThatBlocksNav(level);
  topUpRoomCover(level,reserved);
  return level;
}
function topUpRoomCover(level,reserved){
  for(const room of level.rooms??[]){
    const enemies=(level.enemies??[]).filter(e=>e.health>0&&inRoom(room,e,0.2));
    if(!enemies.length)continue;
    const entry=roomEntry(level,room);
    const exit=roomExitPoint(level,room,entry);
    const between=(level.boxes??[]).filter(b=>inRoom(room,b,0.2)&&coverBetween(entry,enemies,b)&&!blocksMainRoute(b,entry,exit));
    if(between.length>=2)continue;
    const cx=enemies.reduce((s,e)=>s+e.x,0)/enemies.length;
    const cz=enemies.reduce((s,e)=>s+e.z,0)/enemies.length;
    const dx=cx-entry.x,dz=cz-entry.z,len=Math.hypot(dx,dz)||1;
    const ux=dx/len,uz=dz/len,px=-uz,pz=ux;
    const along=Math.abs(ux)>Math.abs(uz);
    const clear=p=>{
      if(!inRoom(room,p,0.45))return false;
      if(inWallOpening(level,p,0.75))return false;
      if(blocksMainRoute(p,entry,exit))return false;
      const solids=[...(level.walls??[]),...(level.boxes??[])];
      if(solids.some(o=>Math.abs(p.x-o.x)<(o.w||0)/2+0.5&&Math.abs(p.z-o.z)<(o.d||0)/2+0.5))return false;
      if((level.doors??[]).some(d=>d.depth&&Math.hypot(p.x-d.x,p.z-d.z)<1.6))return false;
      return true;
    };
    let need=2-between.length;
    const LANE=exit?DEPTH_COVER_LANE_HALF:1.15;
    const flanks=[LANE,LANE+0.55,LANE+0.95,-LANE,-LANE-0.55,-LANE-0.95];
    for(const t of [0.35,0.5,0.65,0.8,0.25]){
      if(need<=0)break;
      for(const fl of flanks){
        if(need<=0)break;
        const p={x:entry.x+ux*len*t+px*fl,z:entry.z+uz*len*t+pz*fl};
        if(!clear(p))continue;
        if(reserved?.near?.(p,0.5)&&need>0&&between.length+ (2-need)>0){
          // Prefer off the nav spine, but take it if the room is otherwise packed.
        }
        (level.boxes??=[]).push({x:Math.round(p.x*100)/100,z:Math.round(p.z*100)/100,
          w:along?1.2:.55,d:along?.55:1.2,h:.95,depthCover:true,depthArea:room.depthArea});
        need--;
      }
    }
  }
}
function coverSpotFree(level,p,r=0.7){
  const solids=[...(level.walls??[]),...(level.boxes??[])];
  if(solids.some(o=>Math.abs(p.x-o.x)<(o.w||0)/2+r&&Math.abs(p.z-o.z)<(o.d||0)/2+r))return false;
  const keep=[level.start,level.exit,...(level.lootBoxes??[]),...(level.enemies??[]),...(level.hazards??[]),...(level.nodes??[]),...(level.doors??[])];
  if(keep.some(o=>o&&typeof o.x==='number'&&Math.hypot(p.x-o.x,p.z-o.z)<1.25))return false;
  return (level.rooms??[]).some(rm=>Math.abs(p.x-rm.x)<=rm.w/2-0.7&&Math.abs(p.z-rm.z)<=rm.d/2-0.7);
}
function reservedNavPath(level){
  const locks=new Map((level.doors??[]).filter(d=>d.depth).map(d=>[d,d.locked]));
  for(const d of level.doors??[])if(d.depth)d.locked=false;
  // Build a walkable grid and mark the union of shortest paths start to each area start and room center.
  const F=level.floors??[],solids=[...(level.walls??[]),...(level.boxes??[])];
  const step=.25,R=.4,pts=[];
  if(!F.length||!level.start){
    for(const d of level.doors??[])if(d.depth)d.locked=locks.get(d)??true;
    return {near:()=>false};
  }
  const x0=Math.min(...F.map(f=>f.x-f.w/2)),z0=Math.min(...F.map(f=>f.z-f.d/2));
  const x1=Math.max(...F.map(f=>f.x+f.w/2)),z1=Math.max(...F.map(f=>f.z+f.d/2));
  const nx=Math.ceil((x1-x0)/step)+1,nz=Math.ceil((z1-z0)/step)+1,free=new Uint8Array(nx*nz);
  const on=(x,z)=>F.some(f=>Math.abs(x-f.x)<=f.w/2+.06&&Math.abs(z-f.z)<=f.d/2+.06);
  const blocked=(x,z)=>solids.some(o=>Math.abs(x-o.x)<(o.w||0)/2+R&&Math.abs(z-o.z)<(o.d||0)/2+R);
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    const x=x0+i*step,z=z0+j*step;
    if(on(x,z)&&!blocked(x,z))free[i*nz+j]=1;
  }
  const cell=q=>{const i=Math.round((q.x-x0)/step),j=Math.round((q.z-z0)/step);return [i,j];};
  const nearest=q=>{
    const [si,sj]=cell(q);let best=-1,bd=Infinity;
    for(let i=si-4;i<=si+4;i++)for(let j=sj-4;j<=sj+4;j++)if(i>=0&&j>=0&&i<nx&&j<nz&&free[i*nz+j]){const d=(i-si)**2+(j-sj)**2;if(d<bd){bd=d;best=i*nz+j;}}
    return best;
  };
  const startK=nearest(level.start);
  const dests=[...(level.depthStarts??[])];
  for(const r of level.rooms??[])dests.push({x:r.x,z:r.z});
  const marked=new Uint8Array(nx*nz);
  const markPath=(goal)=>{
    if(startK<0||goal<0)return;
    const prev=new Int32Array(nx*nz).fill(-1);
    const seen=new Uint8Array(nx*nz);seen[startK]=1;
    const q=[startK];
    for(let qi=0;qi<q.length;qi++){
      const c=q[qi];if(c===goal)break;
      const i=Math.floor(c/nz),j=c%nz;
      for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz)continue;
        const k=a*nz+b;if(!free[k]||seen[k])continue;seen[k]=1;prev[k]=c;q.push(k);
      }
    }
    for(let c=goal,h=0;c>=0&&h<8000;c=prev[c],h++)marked[c]=1;
  };
  if(startK>=0)for(const d of dests)markPath(nearest(d));
  for(const d of level.doors??[])if(d.depth)d.locked=locks.get(d)??true;
  return {near:(p,r)=>{
    const [i,j]=cell(p);const span=Math.ceil(r/step);
    for(let a=i-span;a<=i+span;a++)for(let b=j-span;b<=j+span;b++)if(a>=0&&b>=0&&a<nx&&b<nz&&marked[a*nz+b])return true;
    return false;
  }};
}

function inWallOpening(level,p,r=1){
  const walls=level.walls??[];
  for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
    const a=walls[i],b=walls[j];
    if(Math.abs(a.z-b.z)<0.35&&a.d<=.7&&b.d<=.7){
      if(Math.abs(p.z-a.z)>r+Math.max(a.d,b.d)/2)continue;
      const segs=[a,b].sort((u,v)=>u.x-v.x);
      const gapL=segs[0].x+segs[0].w/2,gapR=segs[1].x-segs[1].w/2;
      if(gapR>gapL+0.35&&gapR-gapL<5&&p.x>gapL-r&&p.x<gapR+r)return true;
    }
    if(Math.abs(a.x-b.x)<0.35&&a.w<=.7&&b.w<=.7){
      if(Math.abs(p.x-a.x)>r+Math.max(a.w,b.w)/2)continue;
      const segs=[a,b].sort((u,v)=>u.z-v.z);
      const gapL=segs[0].z+segs[0].d/2,gapR=segs[1].z-segs[1].d/2;
      if(gapR>gapL+0.35&&gapR-gapL<5&&p.z>gapL-r&&p.z<gapR+r)return true;
    }
  }
  return false;
}
function navReachable(level){
  // Local flood, same idea as walkMap, so we can prune without a circular import.
  const F=level.floors??[],solids=[...(level.walls??[]),...(level.boxes??[]),...((level.doors??[]).filter(d=>d.locked).map(d=>({x:d.x,z:d.z,w:d.w,d:d.d})))];
  if(!F.length||!level.start)return ()=>false;
  const step=.2,R=.36;
  const x0=Math.min(...F.map(f=>f.x-f.w/2)),z0=Math.min(...F.map(f=>f.z-f.d/2));
  const x1=Math.max(...F.map(f=>f.x+f.w/2)),z1=Math.max(...F.map(f=>f.z+f.d/2));
  const nx=Math.ceil((x1-x0)/step)+1,nz=Math.ceil((z1-z0)/step)+1,seen=new Uint8Array(nx*nz),free=new Uint8Array(nx*nz);
  const on=(x,z)=>F.some(f=>Math.abs(x-f.x)<=f.w/2+.06&&Math.abs(z-f.z)<=f.d/2+.06);
  const blocked=(x,z)=>solids.some(o=>Math.abs(x-o.x)<(o.w||0)/2+R&&Math.abs(z-o.z)<(o.d||0)/2+R);
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    const x=x0+i*step,z=z0+j*step;
    if(on(x,z)&&on(x-R,z-R)&&on(x+R,z-R)&&on(x-R,z+R)&&on(x+R,z+R)&&!blocked(x,z))free[i*nz+j]=1;
  }
  const cell=q=>[Math.round((q.x-x0)/step),Math.round((q.z-z0)/step)];
  const [si,sj]=cell(level.start);let best=-1,bd=Infinity;
  for(let i=si-3;i<=si+3;i++)for(let j=sj-3;j<=sj+3;j++)if(i>=0&&j>=0&&i<nx&&j<nz&&free[i*nz+j]){const d=(i-si)**2+(j-sj)**2;if(d<bd){bd=d;best=i*nz+j;}}
  if(best>=0){seen[best]=1;const st=[best];while(st.length){const c=st.pop(),i=Math.floor(c/nz),j=c%nz;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz)continue;const k=a*nz+b;if(free[k]&&!seen[k]){seen[k]=1;st.push(k);}}}}
  return q=>{const [i,j]=cell(q);return i>=0&&j>=0&&i<nx&&j<nz&&seen[i*nz+j]===1;};
}
function pruneCoverThatBlocksNav(level){
  const unlock=()=>{for(const d of level.doors??[])if(d.depth)d.locked=false;};
  const relock=locks=>{for(const d of level.doors??[])if(d.depth)d.locked=locks.get(d)??true;};
  const locks=new Map((level.doors??[]).filter(d=>d.depth).map(d=>[d,d.locked]));
  unlock();
  const dests=(level.depthStarts??[]).slice();
  const blocked=()=>{const walk=navReachable(level);return dests.some(s=>s&&!walk(s));};
  if(!blocked()){relock(locks);return;}
  const covers=(level.boxes??[]).filter(b=>b.depthCover);
  // Drop covers nearest doors/openings first until every area start is reachable.
  covers.sort((a,b)=>{
    const doorDist=o=>Math.min(...(level.doors??[]).filter(d=>d.depth).map(d=>Math.hypot(o.x-d.x,o.z-d.z)),...dests.map(s=>Math.hypot(o.x-s.x,o.z-s.z)));
    return doorDist(a)-doorDist(b);
  });
  for(const box of covers){
    if(!blocked())break;
    const i=(level.boxes??[]).indexOf(box);
    if(i>=0)level.boxes.splice(i,1);
  }
  relock(locks);
}
export function combatRoomsWithCover(level){
  return (level.rooms??[]).map(room=>{
    const enemies=(level.enemies??[]).filter(e=>e.health>0&&inRoom(room,e,0.2));
    if(!enemies.length)return null;
    const entry=roomEntry(level,room);
    const exit=roomExitPoint(level,room,entry);
    const boxes=(level.boxes??[]).filter(b=>inRoom(room,b,0.2));
    const between=boxes.filter(b=>coverBetween(entry,enemies,b)&&!blocksMainRoute(b,entry,exit));
    const blockingLane=exit?boxes.filter(b=>blocksMainRoute(b,entry,exit)):[];
    return {room,entry,exit,enemies,boxes,between,blockingLane};
  }).filter(Boolean);
}
// Centerline waypoints for every depth connector (door + corridor floors), plus
// the start of each area, so a nav walk can prove the capsule is never snagged.
export function depthConnectorPaths(level){
  const paths=[];
  for(const link of level.depthLinks??[]){
    const door=(level.doors??[]).find(d=>d.id===link.doorId);
    const from=(level.depthStarts??[]).find(s=>s.depthArea===link.from);
    const to=(level.depthStarts??[]).find(s=>s.depthArea===link.to);
    const floors=(level.floors??[]).filter(f=>f.doorId===link.doorId||(f.depthLink&&f.depthAreaFrom===link.from&&f.depthAreaTo===link.to));
    const points=[];
    if(from)points.push({x:from.x,z:from.z,kind:'start'});
    if(door)points.push({x:door.x,z:door.z,kind:'door'});
    // Greedy walk along corridor floors so L-bends stay in order.
    let cursor=door?{x:door.x,z:door.z}:(from??{x:link.x,z:link.z});
    const left=floors.slice();
    while(left.length){
      let best=-1,bestD=Infinity,bestPt=null;
      for(let i=0;i<left.length;i++){
        const f=left[i],alongX=f.w>=f.d;
        const ends=alongX?[{x:f.x-f.w/2,z:f.z},{x:f.x+f.w/2,z:f.z}]:[{x:f.x,z:f.z-f.d/2},{x:f.x,z:f.z+f.d/2}];
        for(const e of ends){
          const d=Math.hypot(e.x-cursor.x,e.z-cursor.z);
          if(d<bestD){bestD=d;best=i;bestPt=e;}
        }
      }
      if(best<0)break;
      const f=left.splice(best,1)[0];
      const alongX=f.w>=f.d;
      const a=alongX?{x:f.x-f.w/2,z:f.z}:{x:f.x,z:f.z-f.d/2};
      const b=alongX?{x:f.x+f.w/2,z:f.z}:{x:f.x,z:f.z+f.d/2};
      const da=Math.hypot(a.x-cursor.x,a.z-cursor.z),db=Math.hypot(b.x-cursor.x,b.z-cursor.z);
      const first=da<=db?a:b,second=da<=db?b:a;
      points.push({x:first.x,z:first.z,kind:'corridor'});
      points.push({x:f.x,z:f.z,kind:'corridor'});
      points.push({x:second.x,z:second.z,kind:'corridor'});
      cursor=second;
    }
    if(to)points.push({x:to.x,z:to.z,kind:'start'});
    paths.push({from:link.from,to:link.to,doorId:link.doorId,points});
  }
  return paths;
}

export function depthCorridorClearWidth(){return DEPTH_CLEAR_WIDTH;}
