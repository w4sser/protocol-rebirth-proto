// Pass 3A: rare, curated coastal traces on the non-walkable shore band.
// This is a visual-only planner; no Three.js, level geometry or colliders.
import {coastlineProfile} from './coastline.mjs?v=2.28.0-bridge1';
import {propReservations} from './props-placement.mjs?v=2.28.0';
import {planProfiledDressing,seededRandom} from './polyfork-profiles.mjs?v=profile-v1';

export const COASTAL_SCENES=Object.freeze([
  {id:'fishing-gear',parts:[
    {id:'net-pile-0bd489',h:.55,offset:-.70},
    {id:'lobster-pot-stack-d870f0',h:.80,offset:.03},
    {id:'driftwood-log-89a68f',h:.35,offset:.75},
  ]},
  {id:'old-mooring',parts:[
    {id:'mooring-bollard-2d4bc9',h:.65,offset:-.70},
    {id:'net-pile-0bd489',h:.50,offset:.03},
    {id:'lobster-pot-stack-d870f0',h:.75,offset:.75},
  ]},
]);
const TAU=Math.PI*2;
const pointIn=(p,f)=>Math.abs(p.x-f.x)<=f.w/2&&Math.abs(p.z-f.z)<=f.d/2;
function shoreRadiusAtAngle(profile,x,z){
  const f=profile.floor,theta=(Math.atan2(z-f.z,x-f.x)+TAU)%TAU;
  const n=profile.points.length,index=Math.round(theta/TAU*n)%n;
  return profile.points[index].radial;
}
function innerRadius(f,x,z){
  const angle=Math.atan2(z-f.z,x-f.x),c=Math.cos(angle),s=Math.sin(angle);
  return Math.min(f.w/2/Math.max(1e-8,Math.abs(c)),f.d/2/Math.max(1e-8,Math.abs(s)));
}
function safeSitePos(level,profile,res,x,z){
  const f=profile.floor,dist=Math.hypot(x-f.x,z-f.z);
  // Put all props beyond the logical gameplay rectangle but inside the organic coast.
  if(dist<innerRadius(f,x,z)+.06||dist>shoreRadiusAtAngle(profile,x,z)-.07)return false;
  // Never spawn decorations on another walkable island/corridor, bridge mouth or objective.
  if((level.floors??[]).some(floor=>pointIn({x,z},floor)))return false;
  return !res.blocked(x,z,.52);
}
function availableSites(level){
  if(!level?.archipelago)return [];
  const islands=(level.floors??[]).filter(f=>!f.dir);
  if(islands.length<2)return []; // First island / onboarding stays uncluttered.
  const res=propReservations(level),random=seededRandom(level.seed+':coastal-life-sites-v1'),sites=[];
  for(const [islandIndex,f] of islands.entries()){
    if(Math.min(f.w,f.d)<10)continue;
    const profile=coastlineProfile(f,level.seed,{samples:72}),points=profile?.points??[];
    for(let i=0;i<points.length;i+=2){
      const p=points[i],previous=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
      if(p.beach<.65)continue; // Fishing equipment belongs in the small sheltered coves.
      const tx=next.x-previous.x,tz=next.z-previous.z,len=Math.hypot(tx,tz)||1;
      const tangent={x:tx/len,z:tz/len},normal={x:Math.cos(p.angle),z:Math.sin(p.angle)};
      const center={x:f.x+normal.x*(p.innerRadial+.39),z:f.z+normal.z*(p.innerRadial+.39)};
      const positions=[-.70,.03,.75].map(offset=>({
        x:center.x+tangent.x*offset,z:center.z+tangent.z*offset
      }));
      if(positions.some(o=>!safeSitePos(level,profile,res,o.x,o.z)))continue;
      const score=random();
      sites.push({islandIndex,center,tangent,normal,score});
    }
  }
  return sites.sort((a,b)=>b.score-a.score);
}
export function planCoastalLifeDressing(level,{quality='high',density=1}={}){
  // Leave room within the existing 125 HIGH / 40 LOW instance budgets.
  // Restrict the experimental mode to the standard density maximum.
  const bounded=Math.max(0,Math.min(1,density));
  const base=planProfiledDressing(level,{quality,density:bounded*.90});
  const landmarks=[];
  if(bounded>=.5){
    const site=availableSites(level)[0];
    if(site){
      const r=seededRandom(level.seed+':coastal-life-choice-v1:'+site.islandIndex);
      const scene=COASTAL_SCENES[Math.floor(r()*COASTAL_SCENES.length)];
      // One small scene per playable multi-island level; never blanket-scatter buildings.
      const parts=scene.parts.map(part=>{
        const x=site.center.x+site.tangent.x*part.offset;
        const z=site.center.z+site.tangent.z*part.offset;
        return {id:part.id,x,z,y:-.045,ry:Math.atan2(site.tangent.x,site.tangent.z),
          h:part.h,profile:'coastal-life',region:site.islandIndex,major:false};
      });
      landmarks.push(...parts);
      const record={scene:scene.id,islandIndex:site.islandIndex,
        center:{x:site.center.x,z:site.center.z}};
      return {regions:base.regions,items:[...base.items,...landmarks],
        landmarks:[record]};
    }
  }
  return {regions:base.regions,items:base.items,landmarks:[]};
}
