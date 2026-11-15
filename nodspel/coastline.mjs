// Pass 9: one deterministic, visual-only Nordic coastline per authored island.
// Logical floors, authored walls, actor navigation and collision are unchanged.
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
const unit=n=>((Math.imul(n^(n>>>16),0x7feb352d)^(n>>>15))>>>0)/4294967296;
const circleDistance=(a,b)=>Math.min(Math.abs(a-b),1-Math.abs(a-b));
export function coastSeed(levelSeed,floor){
  const label=[levelSeed,floor.x.toFixed(2),floor.z.toFixed(2),floor.w.toFixed(2),floor.d.toFixed(2)].join(':');
  let s=2166136261;
  for(const ch of label)s=Math.imul(s^ch.charCodeAt(0),16777619);
  return s>>>0;
}
export function coastCoves(seed){
  return [
    {center:.09+.26*unit(seed+113),halfWidth:.048+.007*unit(seed+37)},
    {center:.58+.25*unit(seed+229),halfWidth:.048+.008*unit(seed+43)},
  ];
}
export function coastBeach(t,seed){
  // Two small coves occupying ~20% of angular perimeter. Everything between
  // them is granite or rocky skerry; there is no continuous sand rim.
  return Math.max(...coastCoves(seed).map(p =>
    1-smooth(-.008,.012,circleDistance(t,p.center)-p.halfWidth)));
}
export function coastBeachAt(floor,x,z,levelSeed){
  if(floor.dir)return 0;
  const angle=(Math.atan2(z-floor.z,x-floor.x)+TAU)%TAU;
  return coastBeach(angle/TAU,coastSeed(levelSeed,floor));
}
function rectangleRadius(floor,c,s){
  return Math.min((floor.w/2)/Math.max(1e-8,Math.abs(c)),(floor.d/2)/Math.max(1e-8,Math.abs(s)));
}
function roundedRadius(floor,c,s){
  const a=floor.w/2+1.72,b=floor.d/2+1.72;
  const radius=Math.min(2.2,a*.42,b*.42);
  const ac=Math.abs(c),as=Math.abs(s);
  const right=a/Math.max(1e-8,ac),top=b/Math.max(1e-8,as);
  if(right*as<=b-radius)return right;
  if(top*ac<=a-radius)return top;
  const cx=a-radius,cz=b-radius;
  const dot=ac*cx+as*cz;
  return dot+Math.sqrt(Math.max(0,dot*dot-(cx*cx+cz*cz-radius*radius)));
}
export function coastlineProfile(floor,levelSeed,{samples=72,style='legacy',neighbors=[]}={}){
  if(floor.dir) return null;
  const seed=coastSeed(levelSeed,floor);
  const count=clamp(Math.floor(samples),32,160);
  const phase=TAU*unit(seed+7),phase2=TAU*unit(seed+17),phase3=TAU*unit(seed+29);
  const points=[];
  for(let i=0;i<count;i++){
    const t=i/count,angle=t*TAU,c=Math.cos(angle),s=Math.sin(angle);
    // Three broad, repeatable shoreline bends. No high-frequency noise or
    // jitter on a per-vertex basis; smooth even on 48-sample mobile shores.
    const wave=.38*Math.sin(3*angle+phase)+.23*Math.sin(5*angle+phase2)+.10*Math.sin(7*angle+phase3);
    const inside=rectangleRadius(floor,c,s);
    // At least 0.45 m outside authored gameplay floors everywhere.
    // v2 is an actual extended walkable landform, not just a wavy rim on
    // the rectangular gameplay floor. Reserve a narrow erosion lip for
    // gravity/readability beyond the traversable boundary.
    // Nordic glacial islands are irregular, not rounded authored rectangles.
    // A broad oval body, asymmetric headlands and two sheltered coves are
    // evaluated at the same deterministic angles for shore, water and physics.
    const rx=floor.w*.5+4.6,rz=floor.d*.5+4.6;
    const oval=1/Math.hypot(c/rx,s/rz);
    const headland=1.48*Math.sin(2*angle+phase*.72)+1.12*Math.sin(3*angle+phase2)
      +.56*Math.sin(5*angle+phase3)+.24*Math.sin(7*angle+phase*.32);
    const recessed=coastCoves(seed).reduce((sum,cove)=>sum
      +1.3*Math.exp(-Math.pow(circleDistance(t,cove.center)/.083,2)),0);
    let outer=style==='v2'
      ?Math.max(inside+1.4,oval+1.15+headland-recessed)
      :Math.max(inside+.55,roundedRadius(floor,c,s)+wave);
    if(style==='v2')for(const other of neighbors){
      if(other===floor||other.dir)continue;
      const dx=other.x-floor.x,dz=other.z-floor.z;
      const projected=dx*c+dz*s;
      const across=Math.abs(-dx*s+dz*c);
      const perpendicularSize=other.w*.5*Math.abs(s)+other.d*.5*Math.abs(c);
      if(projected<=inside||across>perpendicularSize+1.2)continue;
      const nearSide=projected-(other.w*.5*Math.abs(c)+other.d*.5*Math.abs(s));
      if(nearSide<=inside||nearSide-inside>14)continue;
      // Opposing islands grow toward each other, but preserve an actual water
      // channel and the authored timber bridge. No artificial land bridges.
      outer=Math.max(inside+.85,Math.min(outer,inside+(nearSide-inside)*.35));
    }
    const playableRadial=style==='v2'?outer-.65:inside;
    const beach=coastBeach(t,seed);
    const cliff=.5+.5*Math.sin(4*angle+phase2);
    points.push({
      x:floor.x+c*outer,z:floor.z+s*outer,
      t,angle,radial:outer,innerRadial:inside,playableRadial,beach,
      kind:beach>.55?'small_beach':cliff>.40?'cliff':'rocky_shore'
    });
  }
  let rockyLength=0,totalLength=0;
  for(let i=0;i<count;i++){
    const p=points[i],q=points[(i+1)%count],len=Math.hypot(q.x-p.x,q.z-p.z);
    totalLength+=len;
    rockyLength+=len*(1-(p.beach+q.beach)*.5);
  }
  return {floor,seed,style,points,rockyRatio:rockyLength/totalLength,totalLength,beachRatio:1-rockyLength/totalLength};
}
// Six opaque rings instead of a 4-ring untextured slab.
// The first ~1.05 m is INSET into the existing walkable rectangle: the same
// ground texture can cover the rectangle-to-coast join, then fade progressively
// to rock (or, occasionally, sand). No alpha sorting or collisions are added.
export const COAST_BLEND_STOPS=Object.freeze([0,0.12,0.53,0.87,1,1]);
// Shared linear-color material model for the gameplay ground and its shore seam.
// Broad, deterministic granite outcrops connect the island interior to the
// coastal masses without introducing raised false cover or extra draw calls.
const rgb=h=>[1,3,5].map(i=>{const c=parseInt(h.slice(i,i+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
// Slightly darker, healthier Nordic vegetation and worn lavender-grey stone.
// All colors are linear RGB because they feed Three.js vertexColor buffers.
const SOIL_MOSS=rgb('#54734d'),SOIL_OLIVE=rgb('#829464'),SOIL_SHADE=rgb('#405b49');
const SOIL_GRANITE=rgb('#a3a0a7'),SOIL_SHADOW=rgb('#6b7380'),SOIL_SAND=rgb('#968a76');
const SOIL_HEATHER=rgb('#766e80'),SOIL_TRAIL=rgb('#807560'),SOIL_LICHEN=rgb('#82947b');
const mix=(a,b,t)=>a+(b-a)*t;
function tint(a,b,t){return a.map((c,i)=>mix(c,b[i],t));}
function fieldHash(i,j,seed){return unit(seed+Math.imul(i,374761393)+Math.imul(j,668265263));}
function fieldNoise(x,z,seed){
  const i=Math.floor(x),j=Math.floor(z),tx=smooth(0,1,x-i),tz=smooth(0,1,z-j);
  return mix(mix(fieldHash(i,j,seed),fieldHash(i+1,j,seed),tx),mix(fieldHash(i,j+1,seed),fieldHash(i+1,j+1,seed),tx),tz);
}
export function archipelagoGroundColor(profile,x,z,bedrockPlan=null){
  if(profile?.style!=='v2')return SOIL_MOSS;
  const {floor,seed,points}=profile,dx=x-floor.x,dz=z-floor.z;
  const angle=(Math.atan2(dz,dx)+TAU)%TAU,scaled=angle/TAU*points.length,i=Math.floor(scaled),frac=scaled-i;
  const radius=mix(points[i].playableRadial,points[(i+1)%points.length].playableRadial,frac)-.045;
  const f=clamp(Math.hypot(dx,dz)/Math.max(.05,radius),0,1);
  // Two correlated terrain frequencies avoid either broad uniform slabs
  // or per-vertex confetti; they have no relation to active gameplay state.
  const broad=fieldNoise(x*.14+7,z*.14-5,seed);
  const mid=fieldNoise(x*.37-9,z*.37+3,seed+817);
  const grain=fieldNoise(x*.96+13,z*.96-7,seed+1901);
  const channel=.5+.5*Math.sin(x*.31-z*.26+mid*2.5+seed*.0001);
  const beach=coastBeach(angle/TAU,seed);
  let glacial=0,trail=0;
  for(let j=0;j<(bedrockPlan?.masses?.length??0);j++){
    const mass=bedrockPlan.masses[j];
    const delta=Math.atan2(Math.sin(angle-mass.angle),Math.cos(angle-mass.angle));
    const meander=.045*Math.sin(f*11+seed*.00003+j);
    // Long fingers of granite visually continue from the outcrops into the
    // island clearing. They remain flush with the real walk/collision plane.
    const arc=Math.exp(-Math.pow((delta+meander)/(.42+.09*channel),2));
    glacial=Math.max(glacial,arc*smooth(.26,.87,f));
    if(j===0){
      // A subdued, winding worn-earth route toward the buried coastal portal.
      const transverse=Math.sin(delta)*Math.hypot(dx,dz)+Math.sin(f*8+seed*.001)*.43;
      trail=Math.exp(-Math.pow(transverse/1.22,2))*smooth(.09,.29,f)*(1-smooth(.73,.94,f));
    }
  }
  const mineralPockets=smooth(.60,.83,broad)*smooth(.42,.92,f)*(.28+.36*mid);
  const edgeRock=smooth(.72,.98,f)*(1-beach)*(.28+.16*channel);
  const exposed=clamp(glacial*(.61+.22*mid)+mineralPockets+edgeRock,0,.93);
  const lichen=smooth(.62,.89,mid)*exposed*(.11+.07*grain);
  let col=tint(SOIL_MOSS,SOIL_OLIVE,clamp(.23+broad*.51+grain*.20,0,1));
  col=tint(col,SOIL_SHADE,.12+.22*(1-mid));
  col=tint(col,SOIL_GRANITE,exposed);
  col=tint(col,SOIL_SHADOW,exposed*(.06+.18*(1-channel)));
  col=tint(col,SOIL_LICHEN,lichen);
  col=tint(col,SOIL_HEATHER,smooth(.64,.88,f)*smooth(.71,.95,mid)*.16*(1-exposed));
  col=tint(col,SOIL_TRAIL,trail*.58*(1-exposed*.65));
  col=tint(col,SOIL_SAND,beach*smooth(.72,1,f)*.36);
  return col;
}

export function coastRingData(profile,{bedrockPlan=null}={}){
  const {floor,points}=profile,n=points.length,positions=[],indices=[],colors=[],uvs=[],blends=[];
  const rock=profile.style==='v2'
    ? ['#6b805b','#7d897d','#8f9295','#a09ca3','#878b93','#596a76']
    : ['#647075','#68747A','#737A7C','#657077','#596576','#3C4756'];
  const beach=['#7F795C','#827B5D','#908064','#8A795D','#74664F','#5D5143'];
  const toLinear=h=>[1,3,5].map(i=>{
    const c=parseInt(h.slice(i,i+2),16)/255;
    return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
  });
  const lerp=(a,b,t)=>a+(b-a)*t;
  const inset=Math.min(1.05,Math.max(.23,Math.min(floor.w,floor.d)*.12));
  for(let ring=0;ring<COAST_BLEND_STOPS.length;ring++)for(let i=0;i<n;i++){
    const p=points[i],c=Math.cos(p.angle),s=Math.sin(p.angle);
    const d=p.radial-p.innerRadial;
    // Legacy feathers from a rectangular room. V2 must NEVER do that:
    // its only visible soil-to-rock seam is the organic actor coastline.
    const radii=profile.style==='v2'?[p.playableRadial-.045,p.playableRadial+.07,
      p.playableRadial+.19,p.playableRadial+.38,p.radial-.055,p.radial+.22]:[
      p.innerRadial-inset,
      p.innerRadial-inset*.54,
      p.innerRadial-.015,
      p.innerRadial+d*.41,
      p.radial-.06,
      p.radial+.22,
    ];
    const radius=Math.max(.05,radii[ring]);
    const x=floor.x+c*radius,z=floor.z+s*radius;
    // The inset feather sits ABOVE the preview terrain (+0.004 m), but BELOW
    // node-progress rings (+0.018 m). Farther out it drops into the cliff side.
    // v2's traversable granite shelf stays nearly level until the true
    // physical coastline. Only its outer erosion lip drops below sea level;
    // actors and their shadows cannot appear suspended over the beach.
    const rockY=profile.style==='v2'?[.010,.009,.007,.003,-.025,-.65]:
      [.010,.010,.0095,-.046,-.085,-.73];
    const sandY=profile.style==='v2'?[.010,.009,.007,.001,-.045,-.54]:
      [.010,.010,.0095,-.115,-.25,-.54];
    // The existing coast shell itself rises into short glacial shoulders at
    // the big outcrops. No separate coplanar granite apron (which flickers on iOS),
    // no height change at the traversable ground seam or the sea-level lip.
    const aDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
    const massProximity=profile.style==='v2'&&bedrockPlan?.masses?.length
      ?Math.max(0,...bedrockPlan.masses.map(m=>Math.exp(-Math.pow(aDelta(p.angle,m.angle)/.48,2)))):0;
    const shelfProximity=profile.style==='v2'&&bedrockPlan?.shelves?.length
      ?Math.max(0,...bedrockPlan.shelves.map(m=>Math.exp(-Math.pow(aDelta(p.angle,m.angle)/.25,2)))):0;
    const ridgeLifts=[0,.08,.28,.49,.32,0];
    const ridge=clamp(massProximity*.88+shelfProximity*.18,0,1)*(1-p.beach*.86);
    positions.push(x,lerp(rockY[ring],sandY[ring],p.beach)+ridgeLifts[ring]*ridge,z);
    blends.push(COAST_BLEND_STOPS[ring]);
    const cliffShade=.94+.055*Math.sin(5*p.angle+profile.seed*.003);
    const colR=toLinear(rock[ring]),colS=toLinear(beach[ring]);
    if(profile.style==='v2'){
      // Exact shared material at ring zero: the green-painted border vanishes.
      // The other five bands transition to exposed weathered granite/sand.
      const entry=archipelagoGroundColor(profile,floor.x+c*(p.playableRadial-.045),floor.z+s*(p.playableRadial-.045),bedrockPlan);
      const transition=[0,.20,.48,.78,.97,1][ring];
      for(let k=0;k<3;k++)colors.push(clamp(lerp(entry[k],lerp(colR[k],colS[k],p.beach)*cliffShade,transition),0,1));
    }else{
      for(let k=0;k<3;k++)colors.push(clamp(lerp(colR[k],colS[k],p.beach)*cliffShade,0,1));
    }
    // LOW mode uses the green quadrant of its existing 2x2 atlas for the
    // INNER band; from here both profiles feather toward coastline colors.
    const fract=v=>v-Math.floor(v);
    uvs.push(.525+.45*fract(x/4),.025+.45*fract(z/4));
  }
  for(let ring=0;ring<COAST_BLEND_STOPS.length-1;ring++)for(let i=0;i<n;i++){
    const j=(i+1)%n,a=ring*n+i,b=ring*n+j,c=(ring+1)*n+i,d=(ring+1)*n+j;
    indices.push(a,b,c,b,d,c);
  }
  return {
    positions:new Float32Array(positions),
    colors:new Float32Array(colors),
    uvs:new Float32Array(uvs),
    blends:new Float32Array(blends),
    indices:new Uint16Array(indices),
  };
}
