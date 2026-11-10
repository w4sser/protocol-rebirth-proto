// v2.25.1 (Robert: "player spawns outside the level"): the raid spawn must stand on a floor rect (rooms/floors/corridors),
// fully inside it by the player radius and clear of walls/crates. If not, snap to the nearest valid point.
import {RULES} from './levels.js?v=2.28.14';
const rectsOf=L=>[...(L.floors?.length?L.floors:L.rooms??[]),...(L.corridors??[])].filter(r=>r&&r.w>0&&r.d>0);
export function spawnProblem(level,p=level?.start,R=RULES.playerRadius){
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))return 'no spawn';
  if(!rectsOf(level).some(r=>Math.abs(p.x-r.x)<=r.w/2-R&&Math.abs(p.z-r.z)<=r.d/2-R))return 'outside floor';
  if([...(level.walls??[]),...(level.boxes??[])].some(o=>Math.abs(p.x-o.x)<o.w/2+R&&Math.abs(p.z-o.z)<o.d/2+R))return 'inside solid';
  return null;
}
export function safeSpawn(level,p=level?.start){
  if(!spawnProblem(level,p))return {x:p.x,z:p.z};
  const o=p&&Number.isFinite(p.x)&&Number.isFinite(p.z)?p:{x:level.rooms?.[0]?.x??0,z:level.rooms?.[0]?.z??0};
  let best=null,bd=Infinity;const step=.25;
  for(const r of rectsOf(level))for(let x=r.x-r.w/2;x<=r.x+r.w/2;x+=step)for(let z=r.z-r.d/2;z<=r.z+r.d/2;z+=step){
    const d=(x-o.x)**2+(z-o.z)**2;if(d<bd&&!spawnProblem(level,{x,z})){bd=d;best={x,z};}}
  return best??{x:o.x,z:o.z};
}
