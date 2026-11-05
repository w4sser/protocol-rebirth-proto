// Navigation and dressing reservations for walkable archipelago piers.
// These are based on *logical* corridor rectangles, not visual coast shells.
// The same full-width clearance applies to props, rocks and enemy waypoints.
export const BRIDGE_MIN_WIDTH = 4.0;
export const BRIDGE_LANDING = 2.2;
export const BRIDGE_SIDE_BUFFER = 1.1;

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

// Waypoint along a known connecting bridge. Both ends have a generous
// centered landing. While crossing, navigate toward the opposite landing
// instead of steering straight at a moving target on another island.
export function bridgeWaypoint(level,actor,target){
  if(!level?.archipelago||!(level.rooms?.length>1)||!(level.corridors?.length))return null;
  const rooms=level.rooms,corridors=level.corridors;
  const a=roomIndex(rooms,actor),b=roomIndex(rooms,target);
  const on=corridorIndex(corridors,actor),targetOn=corridorIndex(corridors,target);
  if(a>=0 && a===b)return null;
  if(on>=0 && targetOn===on)return null;
  let index=-1,towardSecond=true;
  if(on>=0){
    index=on;
    // When on a bridge, head for the end closer to the target room.
    towardSecond=b>=0?b>on : targetOn>=0?targetOn>=on :
      distance(rooms[Math.min(on+1,rooms.length-1)],target)<distance(rooms[on],target);
  }else if(a>=0){
    const destination=b>=0?b:targetOn>=0?(targetOn>=a?a+1:a-1):-1;
    if(destination<0||destination===a)return null;
    towardSecond=destination>a;
    index=towardSecond?a:a-1;
  }else return null;
  const c=corridors[index];
  if(!c?.dir||!rooms[index]||!rooms[index+1])return null;
  const v=axisOf(c),along=c.dir.x?c.w:c.d;
  const sign=towardSecond?1:-1;
  const near={x:c.x-v.x*sign*(along/2+.85),z:c.z-v.z*sign*(along/2+.85)};
  const far={x:c.x+v.x*sign*(along/2+.85),z:c.z+v.z*sign*(along/2+.85)};
  // Only leave the entry waypoint once aligned with the bridge center line.
  // A moving bot should not cut the corner and scrape the side rocks.
  if(on<0 && distance(actor,near)>.72)return near;
  return far;
}
