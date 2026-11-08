// Navigation and dressing reservations for walkable archipelago piers.
// These are based on *logical* corridor rectangles, not visual coast shells.
// The same full-width clearance applies to props, rocks and enemy waypoints.
export const BRIDGE_MIN_WIDTH = 4.0;
export const BRIDGE_LANDING = 3.0;
export const BRIDGE_SIDE_BUFFER = 2.35;

// A broad, walkable mouth on the island lets a player cut diagonally onto a pier.
// The bridge remains its original width over open water: widening the entire
// corridor would create unsupported walking space and change combat lanes.
export const BRIDGE_LAND_MOUTH_EXTRA = 3.0; // total extra width, split evenly on each side
export const BRIDGE_LAND_RAIL_RECESS = 2.4; // land-side clearance for .36m players and .48m bots
export function bridgeMouthWidth(walkwayWidth,roomSpan,wallThickness=.4){
  return Math.max(walkwayWidth,Math.min(roomSpan-2*wallThickness-.2,walkwayWidth+BRIDGE_LAND_MOUTH_EXTRA));
}
export function bridgeRailLength(walkwayLength){
  return Math.max(.30,walkwayLength-2*BRIDGE_LAND_RAIL_RECESS);
}

// The first metres on either side form a wide, walkable funnel into the
// unchanged central combat lane. Match the rendered planks to this same taper.
// A very short pier must retain an unflared center over water.
export const BRIDGE_ENTRY_FLARE_DEPTH=2.4;
export const BRIDGE_ENTRY_FLARE_EXTRA=2.4;
export function bridgeEntryFlare(f,along){
  const length=f.dir?.x?f.w:f.d;
  const fromEnd=length/2-Math.abs(along);
  const depth=Math.min(BRIDGE_ENTRY_FLARE_DEPTH,length/3);
  return depth>0&&fromEnd>=0&&fromEnd<depth
    ?BRIDGE_ENTRY_FLARE_EXTRA*(1-fromEnd/depth):0;
}

// Near a landfall, an actor running along the visible plank edge can be
// blocked as the walkable taper narrows. Ease only the lateral component
// towards the center while preserving total speed; never widen water floors
// or change controls away from a bridge entrance.
export function guideBridgeApproach(level,position,delta,radius,out=delta){
  out.x=delta.x;out.z=delta.z;
  if(!level?.archipelago)return out;
  for(const f of level.floors??[]){
    if(!f.bridgeFunnel||!f.dir)continue;
    const xAxis=!!f.dir.x,axis=xAxis?'x':'z',side=xAxis?'z':'x';
    const length=xAxis?f.w:f.d,width=xAxis?f.d:f.w;
    const along=position[axis]-f[axis],across=position[side]-f[side];
    const moveAlong=delta[axis],speed=Math.hypot(delta.x,delta.z);
    const depth=Math.min(BRIDGE_ENTRY_FLARE_DEPTH,length/3);
    if(!depth||Math.abs(along)<length/2-depth-.35||Math.abs(along)>length/2+2.5
      ||Math.abs(moveAlong)<1e-5||Math.sign(moveAlong)!==-Math.sign(along)
      ||Math.abs(across)>width/2+BRIDGE_ENTRY_FLARE_EXTRA/2+.65)continue;
    const look=along+moveAlong-Math.sign(along)*(radius+.1);
    const safeWidth=width/2+bridgeEntryFlare(f,look)/2-radius-.1;
    const over=Math.abs(across+out[side])-Math.max(0,safeWidth);
    if(over<=0||Math.abs(across)<.01)continue;
    out[side]-=Math.sign(across)*Math.min(over,Math.abs(moveAlong)*.6);
    const corrected=Math.hypot(out.x,out.z);
    if(corrected>1e-8){out.x*=speed/corrected;out.z*=speed/corrected;}
    break;
  }
  return out;
}

export function bridgeEntrySupports(f,x,z){
  if(!f.bridgeFunnel||!f.dir)return false;
  const along=f.dir.x?x-f.x:z-f.z,across=f.dir.x?z-f.z:x-f.x;
  const length=f.dir.x?f.w:f.d,width=f.dir.x?f.d:f.w;
  return Math.abs(along)<=length/2 &&
    Math.abs(across)<=width/2+bridgeEntryFlare(f,along)/2;
}


const inside=(p,f,pad=0)=>Math.abs(p.x-f.x)<=f.w/2+pad&&Math.abs(p.z-f.z)<=f.d/2+pad;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2 && Math.abs(a.z-b.z)<(a.d+b.d)/2;

// A rectangle per narrow pier, including a broad landing on each side.
// Do not place trees, shoreline boulders or collidable cover here.
export function bridgeClearances(level){
  if(!level?.archipelago)return [];
  return (level.floors??[]).filter(f=>f.dir).map(f=>{
    const alongX=!!f.dir.x;
    return {
      x:f.x,z:f.z,
      w:f.w+(alongX?BRIDGE_LANDING*2:BRIDGE_SIDE_BUFFER*2),
      d:f.d+(alongX?BRIDGE_SIDE_BUFFER*2:BRIDGE_LANDING*2),
      dir:f.dir,
    };
  });
}
export function inBridgeClearance(footprint,zones){
  return zones.some(z=>overlap(footprint,z));
}
const roomIndex=(rooms,p)=>rooms.findIndex(r=>inside(p,r,-.02));
const corridorIndex=(corridors,p)=>corridors.findIndex(c=>inside(p,c,.12));
const axisOf=c=>c.dir?.x?{x:Math.sign(c.dir.x),z:0}:{x:0,z:Math.sign(c.dir.z||1)};

// Big Map corridors use roomIds and are not laid out in sequential room order.
// Cache their adjacency once; re-evaluating it for every moving bot is expensive.
const networks=new WeakMap();
function bridgeNetwork(level){
  const cached=networks.get(level);
  if(cached?.rooms===level.rooms&&cached?.corridors===level.corridors)return cached;
  const rooms=level.rooms,corridors=level.corridors,links=rooms.map(()=>[]);
  const edges=corridors.map((c,index)=>{
    const a=c.roomIds?rooms.findIndex(r=>r.id===c.roomIds[0]):index;
    const b=c.roomIds?rooms.findIndex(r=>r.id===c.roomIds[1]):index+1;
    if(a<0||b<0||a>=rooms.length||b>=rooms.length||a===b)return null;
    links[a].push({to:b,edge:index});links[b].push({to:a,edge:index});
    return {a,b};
  });
  const network={rooms,corridors,links,edges};networks.set(level,network);return network;
}
function firstBridge(links,origin,goals){
  const queue=[origin],visited=new Set([origin]),first=new Map();
  for(let head=0;head<queue.length;head++){
    const current=queue[head];
    for(const link of links[current]??[]){
      if(visited.has(link.to))continue;
      visited.add(link.to);
      const initial=first.get(current)??link.edge;
      if(goals.includes(link.to))return initial;
      first.set(link.to,initial);queue.push(link.to);
    }
  }
  return -1;
}
function hopsTo(links,start,goals){
  if(goals.includes(start))return 0;
  const queue=[start],visited=new Set([start]),depth=new Map([[start,0]]);
  for(let head=0;head<queue.length;head++){
    const current=queue[head];
    for(const link of links[current]??[]){
      if(visited.has(link.to))continue;
      const d=depth.get(current)+1;
      if(goals.includes(link.to))return d;
      visited.add(link.to);depth.set(link.to,d);queue.push(link.to);
    }
  }
  return Infinity;
}

// Always take a centered approach, even on a non-sequential Big Map graph.
// Route to the next island first, not directly across rocks towards the target.
export function bridgeWaypoint(level,actor,target){
  if(!level?.archipelago||!(level.rooms?.length>1)||!(level.corridors?.length))return null;
  const rooms=level.rooms,corridors=level.corridors;
  const a=roomIndex(rooms,actor),b=roomIndex(rooms,target);
  const on=corridorIndex(corridors,actor),targetOn=corridorIndex(corridors,target);
  if(on<0&&a>=0&&a===b)return null;
  if(on>=0&&on===targetOn)return null;
  const {edges,links}=bridgeNetwork(level);
  const targetEdge=targetOn>=0?edges[targetOn]:null;
  const goals=b>=0?[b]:targetEdge?[targetEdge.a,targetEdge.b]:[];
  if(!goals.length)return null;
  let index=-1,towardSecond=false;
  if(on>=0){
    index=on;
    const edge=edges[index];if(!edge)return null;
    const da=hopsTo(links,edge.a,goals),db=hopsTo(links,edge.b,goals);
    towardSecond=db<da||(db===da&&distance(rooms[edge.b],target)<distance(rooms[edge.a],target));
  }else{
    if(a<0)return null;
    index=targetEdge&&(targetEdge.a===a||targetEdge.b===a)
      ?targetOn:firstBridge(links,a,goals);
    if(index<0)return null;
    const edge=edges[index];if(!edge)return null;
    towardSecond=edge.a===a;
  }
  const c=corridors[index],v=axisOf(c),along=c.dir.x?c.w:c.d,sign=towardSecond?1:-1;
  const near={x:c.x-v.x*sign*(along/2+.85),z:c.z-v.z*sign*(along/2+.85)};
  const far={x:c.x+v.x*sign*(along/2+.85),z:c.z+v.z*sign*(along/2+.85)};
  if(on<0&&distance(actor,near)>.72)return near;
  return far;
}
