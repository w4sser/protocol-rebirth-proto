// Pure geometry contract for visual-only, ice-polished Swedish granite headlands.
// The asset starts at the island's exterior edge and grows OUTWARD to sea.
// A live floor, bridge clearance or objective must never be covered by fake rock.
import {bridgeClearances} from './bridge-flow.mjs?v=2.28.0-bridge1';
export const GLACIAL_W=12.8;
export const GLACIAL_D=8.4;
export const GLACIAL_DOOR_SETBACK=1.05;

const overlap=(a,b,pad=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+pad&&
  Math.abs(a.z-b.z)<(a.d+b.d)/2+pad;

export function glacialFootprint(site,scale=1){
  const w=GLACIAL_W*scale,d=GLACIAL_D*scale;
  const c=Math.cos(site.ry),s=Math.sin(site.ry);
  const corners=[];
  for(const x of [-w/2,w/2])for(const z of [0,d]){
    corners.push({x:site.center.x+c*x+s*z,z:site.center.z-s*x+c*z});
  }
  const xs=corners.map(p=>p.x),zs=corners.map(p=>p.z);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  return {x:(minX+maxX)/2,z:(minZ+maxZ)/2,
    w:maxX-minX,d:maxZ-minZ,minX,maxX,minZ,maxZ};
}
export function safeGlacialFootprint(level,site,existing=[],scale=1){
  if(!level?.archipelago||!site?.center||!Number.isFinite(site.ry))return false;
  const rock=glacialFootprint(site,scale),islands=(level.floors??[]).filter(f=>!f.dir);
  if(!islands[site.islandIndex])return false;
  // Only exterior seaward cliff ledges are allowed, NEVER walkable rock cover.
  if((level.floors??[]).some(f=>overlap(rock,f,.035)))return false;
  // Bridge flare/diagonal bot approaches must remain absolutely empty.
  if(bridgeClearances(level).some(f=>overlap(rock,f,.6)))return false;
  if(existing.some(c=>overlap(rock,glacialFootprint(c,c.scale??1),.8)))return false;
  // No detached skerries: front of cliff starts just outside its source island
  // and follows that island's edge rather than spawning as a water island.
  const f=islands[site.islandIndex],distance=Math.hypot(site.center.x-f.x,site.center.z-f.z);
  return distance<Math.hypot(f.w,f.d);
}
