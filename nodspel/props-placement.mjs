// Props preview (?props=1): deterministic, visual-only placement for the
// archipelago asset kits from PRs #184 (ground cover), #185 (shore), #186 (rocks).
// Pure data: no THREE, no collisions. Gameplay floors/walls/colliders untouched.
import {coastlineProfile} from './coastline.mjs?v=2.28.1-bridge1';
import {bridgeClearances} from './bridge-flow.mjs?v=2.28.1-bridge1';
import {archipelagoPassages} from './archipelago-passages.js?v=2.28.1';

export const GROUND_KIT=Object.freeze([
  ['grass_tuft_a',5],['grass_tuft_b',5],['grass_tuft_c',4],['moss_clump_a',4],['lichen_patch_a',3],
  ['heather_tuft_a',3],['fern_small_a',3],['pine_needles_pile_a',3],['pebble_granite_a',1],['pebble_granite_b',1],
  ['pebble_granite_c',1],['pebble_granite_d',1],['pebble_granite_e',1],['pine_cone_a',1],['fallen_twig_a',1],
]);
export const SHORE_ROCKS_HIGH=Object.freeze(['rock_granite_m_a','rock_granite_m_b','rock_granite_m_c','rock_granite_s_a','rock_granite_s_b','rock_granite_s_c','rock_granite_l_a_lod1','rock_slab_a']);
export const SHORE_ROCKS_LOW=Object.freeze(['rock_granite_m_a','rock_granite_m_b','rock_granite_s_a','rock_slab_a']);
export const PROFILES=Object.freeze({
  high:{groundDensity:.45,edgeBand:2.2,interiorKeep:.35,reedChance:.45,driftChance:.10,rockChance:.07,maxRocks:3,foam:true,maxGround:900},
  low:{groundDensity:.18,edgeBand:2.0,interiorKeep:.2,reedChance:.25,driftChance:.05,rockChance:.05,maxRocks:2,foam:false,maxGround:260},
});
function rng(seed){let s=2166136261;for(const c of String(seed))s=Math.imul(s^c.charCodeAt(0),16777619);
  return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pick=(r,list)=>{const tot=list.reduce((a,[,w])=>a+w,0);let x=r()*tot;for(const [k,w] of list){if((x-=w)<0)return k;}return list[0][0];};
const inRect=(x,z,q,pad=0)=>Math.abs(x-q.x)<=q.w/2+pad&&Math.abs(z-q.z)<=q.d/2+pad;

// Everything a prop must keep clear of: bridges + landings, doorway passages,
// objectives/loot/start/exit/enemy spawns.
export function propReservations(level){
  const rects=[...bridgeClearances(level),...archipelagoPassages(level)];
  const pts=[...(level.nodes??[]).map(p=>[p,2.0]),...(level.lootBoxes??[]).map(p=>[p,1.6]),
    ...[level.start,level.exit].filter(Boolean).map(p=>[p,2.0]),...(level.enemies??[]).map(p=>[p,.9])];
  return {rects,pts,blocked(x,z,pad=0){
    return rects.some(q=>inRect(x,z,q,pad))||pts.some(([p,r])=>Math.hypot(x-p.x,z-p.z)<r+pad);
  }};
}
// Returns [{asset,x,y,z,ry,s,kind}] - same input -> same output.
export function placeArchipelagoProps(level,{profile='high'}={}){
  const P=PROFILES[profile==='low'?'low':'high'],res=propReservations(level),out=[];
  const r=rng(`${level.seed}:props1:${profile}`);
  const islands=(level.floors??[]).filter(f=>!f.dir);
  let ground=0;
  for(const f of islands){
    const n=Math.round(f.w*f.d*P.groundDensity);
    for(let i=0;i<n&&ground<P.maxGround;i++){
      const x=f.x+(r()-.5)*(f.w-.4),z=f.z+(r()-.5)*(f.d-.4);
      const edge=Math.min(f.w/2-Math.abs(x-f.x),f.d/2-Math.abs(z-f.z));
      const keep=edge<P.edgeBand?1:P.interiorKeep;
      const asset=pick(r,GROUND_KIT),ry=r()*Math.PI*2,s=.85+r()*.3,roll=r();
      if(roll>keep||res.blocked(x,z,.3))continue;
      if((level.walls??[]).some(w=>inRect(x,z,w,.15)))continue;
      out.push({asset,x,y:.006,z,ry,s,kind:'ground'});ground++;
    }
    // Shore: follow the existing organic coastline profile (same seed as the coast shell).
    const prof=coastlineProfile(f,level.seed,{samples:72});
    if(!prof)continue;
    const pts=prof.points,m=pts.length;
    let lastRock=-99,rocks=0;
    for(let i=0;i<m;i++){
      const p=pts[i],q=pts[(i+1)%m],c=Math.cos(p.angle),s=Math.sin(p.angle);
      const at=d=>({x:f.x+c*(p.radial+d),z:f.z+s*(p.radial+d)});
      const near=at(0);
      if(res.blocked(near.x,near.z,.6))continue;
      const tangent=Math.atan2(q.z-p.z,q.x-p.x);
      const a=r(),b=r(),k=r(),sc=r();
      if(p.beach>.55){
        if(a<P.reedChance){const o=at(-.35-b*.4);out.push({asset:['shore_reeds_a','shore_reeds_b','shore_reeds_c'][Math.floor(k*3)],x:o.x,y:-.12,z:o.z,ry:b*6.283,s:.9+sc*.3,kind:'shore'});}
        else if(a<P.reedChance+P.driftChance){const o=at(-.25);out.push({asset:'shore_driftwood_a',x:o.x,y:-.2,z:o.z,ry:-tangent+(b-.5)*.6,s:.8+sc*.3,kind:'shore'});}
        if(P.foam&&q.beach>.55){const o={x:(p.x+q.x)/2+c*.05,z:(p.z+q.z)/2+s*.05};
          out.push({asset:'shore_waterline_foam_2m',x:o.x,y:-.338,z:o.z,ry:-tangent,s:Math.hypot(q.x-p.x,q.z-p.z)/2,kind:'foam'});}
      }else if(a<P.rockChance&&i-lastRock>8&&rocks<P.maxRocks){
        // Occasional granite at the waterline only - never a ring.
        const list=profile==='low'?SHORE_ROCKS_LOW:SHORE_ROCKS_HIGH,o=at(.05+b*.25);
        out.push({asset:list[Math.floor(k*list.length)],x:o.x,y:-.32,z:o.z,ry:sc*6.283,s:.9+b*.6,kind:'rock'});lastRock=i;rocks++;
      }
    }
  }
  return out;
}
