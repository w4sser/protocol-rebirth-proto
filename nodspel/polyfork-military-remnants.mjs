// Pass 3B: one rare, visual-only military trace on a rocky shoreline shelf.
// No new colliders, routes, terrain, lights, or interactable fake cover.
import {coastlineProfile} from './coastline.mjs?v=2.28.0-bridge1';
import {propReservations} from './props-placement.mjs?v=2.28.0';
import {planCoastalLifeDressing} from './polyfork-coastal-life.mjs?v=coastal-life-v1';
import {seededRandom} from './polyfork-profiles.mjs?v=profile-v1';

export const MILITARY_SCENES=Object.freeze([
  {id:'abandoned-listening-post',parts:[
    {id:'floodlight-mast-45d1a3',h:1.65,offset:-.72,radius:.24,essential:true},
    {id:'field-console-a92adc',h:.88,offset:0,radius:.30,essential:true},
    {id:'hazard-sign-plate-d54657',h:.48,offset:.72,radius:.22},
  ]},
  {id:'forgotten-power-node',parts:[
    {id:'gas-cylinder-cabinet-cea23b',h:1.00,offset:-.72,radius:.28,essential:true},
    {id:'battery-bank-b4d362',h:.82,offset:0,radius:.32,essential:true},
    {id:'hazard-sign-plate-d54657',h:.48,offset:.72,radius:.22},
  ]},
]);
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rectNear=(floor,p,pad)=>Math.abs(p.x-floor.x)<=floor.w/2+pad&&Math.abs(p.z-floor.z)<=floor.d/2+pad;
function floorRadiusAt(f,x,z){
  const dx=x-f.x,dz=z-f.z,d=Math.hypot(dx,dz)||1;
  return Math.min((f.w/2)/Math.max(1e-8,Math.abs(dx/d)),(f.d/2)/Math.max(1e-8,Math.abs(dz/d)));
}
function outerRadiusAt(profile,x,z){
  const f=profile.floor,a=(Math.atan2(z-f.z,x-f.x)+TAU)%TAU,points=profile.points;
  const index=Math.floor(a/TAU*points.length)%points.length;
  // Conservative interpolation: never place a model past a shoreline bend.
  return Math.min(points[index].radial,points[(index+1)%points.length].radial);
}
function acceptable(level,coast,res,p){
  const f=coast.floor,d=Math.hypot(p.x-f.x,p.z-f.z);
  const inner=floorRadiusAt(f,p.x,p.z),outer=outerRadiusAt(coast,p.x,p.z);
  const margin=p.radius+.12;
  // Complete model footprint must stay on the existing non-walkable rock shelf.
  if(d<=inner+margin||d>=outer-margin)return false;
  // No decorative fake cover on any actual playable island or bridge.
  if((level.floors??[]).some(floor=>rectNear(floor,p,margin)))return false;
  if(res.blocked(p.x,p.z,p.radius+.45))return false;
  if((level.walls??[]).some(w=>rectNear(w,p,p.radius+.12)))return false;
  return true;
}
function rockySites(level,excludeIsland){
  const islands=(level.floors??[]).filter(f=>!f.dir);
  const res=propReservations(level),r=seededRandom(level.seed+':military-sites-v1');
  const sites=[];
  for(const [islandIndex,f] of islands.entries()){
    if(Math.min(f.w,f.d)<10)continue;
    const coast=coastlineProfile(f,level.seed,{samples:72});
    for(let i=0;i<coast.points.length;i+=2){
      const p=coast.points[i];
      if(p.beach>.22||p.radial-p.innerRadial<1.35)continue;
      const prev=coast.points[(i+coast.points.length-1)%coast.points.length],next=coast.points[(i+1)%coast.points.length];
      const tx=next.x-prev.x,tz=next.z-prev.z,length=Math.hypot(tx,tz)||1;
      const tangent={x:tx/length,z:tz/length};
      const centerRadius=p.innerRadial+clamp((p.radial-p.innerRadial)*.5,.55,1.1);
      const center={x:f.x+Math.cos(p.angle)*centerRadius,z:f.z+Math.sin(p.angle)*centerRadius};
      // Validate the entire HIGH scene; LOW will use its first two objects.
      const safe=MILITARY_SCENES.every(scene=>scene.parts.every(part=>acceptable(level,coast,res,{
        x:center.x+tangent.x*part.offset,z:center.z+tangent.z*part.offset,radius:part.radius
      })));
      if(!safe)continue;
      const preferredOther=islandIndex!==excludeIsland?1:0;
      const score=r()+preferredOther*2+(p.kind==='cliff'?.12:0);
      sites.push({islandIndex,center,tangent,score});
    }
  }
  return sites.sort((a,b)=>b.score-a.score||a.islandIndex-b.islandIndex);
}
export function planMilitaryRemnantsDressing(level,{quality='high',density=1}={}){
  const bounded=clamp(Number.isFinite(density)?density:1,0,1);
  // Keep the existing approved Forest / Granite / Coastal Life identity and
  // reserve part of the 125 HIGH / 40 LOW asset budget for a rare military scene.
  const base=planCoastalLifeDressing(level,{quality,density:bounded*.82});
  const unchanged={regions:base.regions,items:base.items,landmarks:base.landmarks,militaryLandmarks:[]};
  if(!level?.archipelago||bounded<.5||(level.floors??[]).filter(f=>!f.dir).length<2)return unchanged;
  const avoid=base.landmarks[0]?.islandIndex??-1;
  const site=rockySites(level,avoid)[0];
  if(!site)return unchanged;
  const random=seededRandom(level.seed+':military-scene-v1:'+site.islandIndex);
  const scene=MILITARY_SCENES[Math.floor(random()*MILITARY_SCENES.length)];
  const max=quality==='low'?40:125;
  const parts=scene.parts.filter(part=>quality!=='low'||part.essential)
    .slice(0,Math.max(0,max-base.items.length));
  if(!parts.length)return unchanged;
  const ry=Math.atan2(site.tangent.x,site.tangent.z);
  const additions=parts.map(part=>({
    id:part.id,x:site.center.x+site.tangent.x*part.offset,
    z:site.center.z+site.tangent.z*part.offset,
    y:-.04,ry,h:part.h,profile:'military',region:site.islandIndex,major:!!part.essential
  }));
  const landmark={type:'military',scene:scene.id,islandIndex:site.islandIndex,
    center:{x:site.center.x,z:site.center.z}};
  return {regions:base.regions,items:[...base.items,...additions],
    landmarks:[...base.landmarks,landmark],militaryLandmarks:[landmark]};
}
