// Pass 1-2: reproducible, visual-only island identities and environmental composition.
// No Three.js. Do not change floors, walls, coast profiles, bridge routing or colliders.
import {propReservations} from './props-placement.mjs?v=2.28.0';

export const PROFILE_WEIGHTS=Object.freeze([
  {id:'forest',weight:40,label:'Dense coastal forest'},
  {id:'granite',weight:35,label:'Exposed granite'},
  {id:'coastal-life',weight:15,label:'Abandoned coastal life'},
  {id:'military',weight:10,label:'Military remnants'},
]);
// Pass 1-2 only uses forest/granite in gameplay. Other profiles are design metadata
// until landmark authoring is reviewed in Pass 3; do not scatter industrial buildings.
export const ACTIVE_PROFILES=Object.freeze(['forest','granite']);
const FOREST=[
  ['young-pine-0d7695',2.6,.75,4],['tall-pine-tree-ab4108',4.4,1.25,3],
  ['birch-tree-181b33',3.7,1.0,2],['fern-plant-1559b8',.52,.25,4],
  ['grass-tuft-a40a08',.39,.25,4],['round-bush-cd2ac0',.70,.42,3],
  ['fallen-log-1685fb',.58,.7,1],['tree-stump-ec3f48',.54,.4,1],
  ['wildflower-68d3a1',.42,.22,1],['small-rock-db33a7',.39,.37,1]
];
const GRANITE=[
  ['medium-rock-e08405',.73,.7,5],['small-rock-db33a7',.42,.4,5],
  ['round-bush-cd2ac0',.65,.4,2],['grass-tuft-a40a08',.36,.23,2],
  ['young-pine-0d7695',2.5,.75,1],['fallen-log-1685fb',.52,.65,1]
];
const SHORE=[
  ['marram-grass-tuft-8c7a99',.50,.28,5],
  ['driftwood-log-89a68f',.37,.65,2],
  ['seaweed-drift-line-6566c3',.19,.45,2],
  ['sea-holly-clump-ce3bc6',.45,.28,2]
];
export function seededRandom(seed){
  let a=2166136261;for(const c of String(seed))a=Math.imul(a^c.charCodeAt(0),16777619);
  return()=>{a+=0x6d2b79f5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}
function weighted(r,list){const sum=list.reduce((s,v)=>s+v[3],0);let n=r()*sum;for(const v of list){n-=v[3];if(n<0)return v;}return list[list.length-1];}
function identity(r){return r()<.54?'forest':'granite';}
function islandKey(f){return [f.x,f.z,f.w,f.d].map(n=>Number(n).toFixed(3)).join(':');}
const norm=(v,min,max)=>Math.max(min,Math.min(max,v));
const wallBlocked=(walls,x,z,p)=>walls.some(w=>Math.abs(x-w.x)<w.w/2+p&&Math.abs(z-w.z)<w.d/2+p);
function inside(f,x,z,p){return Math.abs(x-f.x)<=f.w/2-p&&Math.abs(z-f.z)<=f.d/2-p;}
function pickRegionCenters(f,r,count){
  const centers=[];
  for(let i=0;i<count;i++){
    const angle=(i+(r()-.5)*.45)*Math.PI*2/count;
    const radius=(.12+r()*.16)*Math.min(f.w,f.d);
    centers.push({x:f.x+Math.cos(angle)*radius,z:f.z+Math.sin(angle)*radius,
      radius:(.22+r()*.08)*Math.min(f.w,f.d)});
  }
  return centers;
}
export function assignEnvironmentRegions(level){
  if(!level?.archipelago)return [];
  const islands=(level.floors??[]).filter(f=>!f.dir);
  let last=null;
  // Compute independently from stable island key; adding another island cannot reshuffle old regions.
  return islands.map((f,index)=>{
    const r=seededRandom(level.seed+':env-profile-v1:'+islandKey(f));
    let profile=identity(r);
    if(index&&profile===last)profile=profile==='forest'?'granite':'forest';
    last=profile;
    const tiny=Math.min(f.w,f.d)<12;
    const centers=pickRegionCenters(f,r,tiny?1:2+Math.floor(r()*2));
    const clear={x:f.x+(r()-.5)*f.w*.12,z:f.z+(r()-.5)*f.d*.12,radius:Math.max(3.0,Math.min(f.w,f.d)*.21)};
    return {key:islandKey(f),index,profile,center:{x:f.x,z:f.z},size:{w:f.w,d:f.d},
      clearing:clear,clusters:centers};
  });
}
function candidateAccepted(level,res,f,clear,placed,x,z,pad){
  if(!inside(f,x,z,pad+.2)||res.blocked(x,z,pad+.55)||
    wallBlocked(level.walls??[],x,z,pad+.55))return false;
  if(Math.hypot(x-clear.x,z-clear.z)<clear.radius+pad)return false;
  // Decorative silhouettes should not visually merge into solid walls of vegetation.
  if(placed.some(v=>Math.hypot(v.x-x,v.z-z)<Math.min(.65,pad*.55+v.radius*.35)))return false;
  return true;
}
export function planProfiledDressing(level,{quality='high',density=1}={}){
  const regions=assignEnvironmentRegions(level),items=[];
  if(!regions.length)return {regions,items};
  const res=propReservations(level);
  const highLimit=Math.round(125*norm(density,0,1.5));
  const islands=(level.floors??[]).filter(f=>!f.dir);
  const areaSum=islands.reduce((a,f)=>a+f.w*f.d,0)||1;
  for(const region of regions){
    const f=islands[region.index],r=seededRandom(level.seed+':env-clusters-v1:'+region.key);
    const profileItems=region.profile==='forest'?FOREST:GRANITE;
    const allowance=Math.max(1,Math.round(highLimit*f.w*f.d/areaSum));
    const local=[];
    // Each island has distinct stands/outcrops, with an intentional central clearing.
    for(const center of region.clusters){
      const attempts=Math.min(130,Math.ceil(allowance*2.8/region.clusters.length));
      for(let i=0;i<attempts&&local.length<allowance;i++){
        const angle=r()*Math.PI*2,rad=Math.sqrt(r())*center.radius;
        const x=center.x+Math.cos(angle)*rad,z=center.z+Math.sin(angle)*rad;
        const edge=Math.min(f.w/2-Math.abs(x-f.x),f.d/2-Math.abs(z-f.z));
        const choice=weighted(r,edge<1.8?SHORE:profileItems);
        const height=choice[1]*(.84+r()*.32),radius=choice[2];
        if(!candidateAccepted(level,res,f,region.clearing,local,x,z,radius))continue;
        local.push({id:choice[0],x,z,y:.025,ry:r()*Math.PI*2,h:height,
          radius,profile:region.profile,region:region.index,major:height>1.8});
      }
    }
    // Sparse shore accents, attached to the perimeter rather than a rectangular scatter.
    for(let i=0;i<Math.min(45,Math.round(allowance*.9))&&local.length<allowance;i++){
      const edgeIndex=Math.floor(r()*4),side=r()*2-1;
      const x=edgeIndex<2?f.x+side*(f.w/2-1.1):f.x+side*(f.w/2-1.1);
      const z=edgeIndex<2?f.z+(edgeIndex===0?1:-1)*(f.d/2-1.1):f.z+(r()*2-1)*(f.d/2-1.1);
      // For east/west segments use fixed x, varying z.
      const px=edgeIndex>=2?f.x+(edgeIndex===2?1:-1)*(f.w/2-1.1):x;
      const pz=z;
      const choice=weighted(r,SHORE),radius=choice[2];
      if(!candidateAccepted(level,res,f,region.clearing,local,px,pz,radius))continue;
      local.push({id:choice[0],x:px,z:pz,y:.025,ry:r()*Math.PI*2,
        h:choice[1]*(.85+r()*.3),radius,profile:region.profile,region:region.index,major:false});
    }
    items.push(...local);
  }
  // Enforce global budget and make LOW a deterministic subset of HIGH:
  // keep large silhouettes (where safe), then take sparse ground detail per region.
  const high=items.slice(0,highLimit);
  if(quality!=='low')return {regions,items:high.map(({radius,...item})=>item)};
  const lowLimit=Math.min(40,Math.round(40*norm(density,0,1.5)));
  const essentials=high.filter(x=>x.major),minor=high.filter(x=>!x.major);
  const kept=[],perRegion=new Map();
  for(const p of essentials){if(kept.length>=Math.min(lowLimit,Math.round(lowLimit*.6)))break;
    const n=perRegion.get(p.region)||0;if(n>=Math.ceil(lowLimit/Math.max(regions.length,1)))continue;
    kept.push(p);perRegion.set(p.region,n+1);
  }
  const stride=Math.max(1,Math.ceil(minor.length/Math.max(1,lowLimit-kept.length)));
  for(let i=0;i<minor.length&&kept.length<lowLimit;i+=stride)kept.push(minor[i]);
  return {regions,items:kept.map(({radius,...item})=>item)};
}
