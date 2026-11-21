// Depth Raid v2.28.58: stitch Bunker L1+L2+L3 into one walkable layout, joined by corridors
// with locked doors. Cheapest credible "same level, next area" — existing layouts translated
// into one world, not a hand-authored facility. Player walks through; no loadLevel() swap.
import {generateLevel,placePowerPads,placeSupplyShelves,RULES} from './levels.js?v=2.28.60';

const WALL_T=RULES.wallThickness;
const LINK_GAP=10;
const LINK_WIDTH=2.2;
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
  return dir;
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
    punchOpening(from,roomA,{x:0,z:-1},LINK_WIDTH);
    punchOpening(to,roomB,{x:0,z:1},LINK_WIDTH);
    addLinkSegment(from,roomA.x,aSouth,roomA.x,bNorth,fromArea,toArea,doorId);
  }else{
    // Walk around `to`'s bounding box so winding L3 rooms/corridors cannot block the aisle.
    const bb=boundsOf(to);
    const eastFree=!roomHasDir(roomB,{x:1,z:0}),westFree=!roomHasDir(roomB,{x:-1,z:0});
    const side=(eastFree&&!westFree)?1:(westFree&&!eastFree)?-1:(Math.abs((bb.maxX+2)-roomA.x)<=Math.abs((bb.minX-2)-roomA.x)?1:-1);
    const aisleX=side>0?bb.maxX+2:bb.minX-2;
    const arriveX=roomB.x+side*(roomB.w/2);
    const arriveZ=roomB.z;
    punchOpening(from,roomA,{x:0,z:-1},LINK_WIDTH);
    punchOpening(to,roomB,{x:side,z:0},LINK_WIDTH);
    addLinkSegment(from,roomA.x,aSouth,roomA.x,clearZ,fromArea,toArea,doorId);
    if(Math.abs(aisleX-roomA.x)>0.05)addLinkSegment(from,roomA.x,clearZ,aisleX,clearZ,fromArea,toArea,doorId);
    addLinkSegment(from,aisleX,clearZ,aisleX,arriveZ,fromArea,toArea,doorId);
    if(Math.abs(arriveX-aisleX)>0.05)addLinkSegment(from,aisleX,arriveZ,arriveX,arriveZ,fromArea,toArea,doorId);
    doorX=roomA.x;doorZ=Math.min(aSouth-1.2,clearZ+1);
  }
  const door={id:doorId,x:doorX,z:doorZ,w:doorW,d:doorD,h:DOOR_H,locked:true,depth:true,depthAreaFrom:fromArea,depthAreaTo:toArea};
  (from.doors??=[]).push(door);
  return {from:fromArea,to:toArea,doorId,x:doorX,z:doorZ,w:doorW,d:8,axis:'z',sign:-1,door};
}

export function generateDepthLevel(seed,opts={}){
  const area=opts.area??'bunker',hard=!!opts.hard,completedRaids=opts.completedRaids??0,ftue=!!opts.ftue;
  const parts=[1,2,3].map(n=>generateLevel(n,seed,area,hard,false));
  placePowerPads(parts[0],completedRaids,ftue);
  placeSupplyShelves(parts[1],completedRaids,ftue);
  const rules=parts.map(snapshotRules);
  const exits=parts.map(p=>({x:p.exit.x,z:p.exit.z,r:p.exit.r??1,depthArea:p.number}));
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
  const depthExits=parts.map((p,i)=>({x:p.exit.x,z:p.exit.z,r:p.exit.r??1,depthArea:i+1}));
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
  level.exit={x:depthExits[0].x,z:depthExits[0].z,r:depthExits[0].r};
  level.depthExits=depthExits;
  level.depthStarts=depthStarts;
  level.depthLinks=links.map(({from,to,doorId,x,z,w,d,axis,sign})=>({from,to,doorId,x,z,w,d,axis,sign}));
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
