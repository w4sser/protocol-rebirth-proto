// Archipelago v2: organic walkable coastline registered per authored floor.
// The old rooms still seed objectives and AI, but the movement boundary is a
// seeded glacial island, not the logical rectangle. Pure maths, no Three.js.
const regions=new WeakMap();
const TAU=Math.PI*2;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function registerWalkableCoast(floor,profile){
  if(!floor||!profile?.points?.length||profile.style!=='v2')return false;
  const radii=profile.points.map(p=>p.playableRadial);
  if(radii.some(r=>!Number.isFinite(r)||r<=0))throw new Error('Invalid playable coastline radii');
  regions.set(floor,{radii,centerX:floor.x,centerZ:floor.z});
  return true;
}
export function hasWalkableCoast(floor){return regions.has(floor);}
export function isPointOnFloor(floor,x,z){
  if(!floor)return false;
  const ox=x-floor.x,oz=z-floor.z;
  // Keep bridges and all old non-Archipelago floors exactly rectangular.
  const region=regions.get(floor);
  if(!region)return Math.abs(ox)<=floor.w/2 && Math.abs(oz)<=floor.d/2;
  // The authored gameplay rectangle is fully inside the island, so keep the
  // inner path very cheap and avoid angle maths at high frequency.
  if(Math.abs(ox)<=floor.w/2&&Math.abs(oz)<=floor.d/2)return true;
  const n=region.radii.length;
  const angle=(Math.atan2(oz,ox)+TAU)%TAU;
  const index=angle/TAU*n,i=Math.floor(index)%n;
  const a=region.radii[i],b=region.radii[(i+1)%n];
  const radial=a+(b-a)*(index-Math.floor(index));
  return ox*ox+oz*oz <= (radial-.045)*(radial-.045);
}
export function walkableBoundary(floor){
  const region=regions.get(floor);
  return region?region.radii.slice():null;
}
