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
    const headland=.72*Math.sin(2*angle+phase*.72)+.52*Math.sin(3*angle+phase2)
      +.24*Math.sin(5*angle+phase3);
    let outer=style==='v2'
      ?Math.max(inside+1.4,roundedRadius(floor,c,s)+2.1+headland)
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
      outer=Math.max(inside+.85,Math.min(outer,inside+(nearSide-inside)*.43));
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
export function coastRingData(profile){
  const {floor,points}=profile,n=points.length,positions=[],indices=[],colors=[],uvs=[],blends=[];
  const rock=['#647075','#68747A','#737A7C','#657077','#596576','#3C4756'];
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
    const radii=[
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
    const rockY=[.010,.010,.0095,-.046,-.085,-.73];
    const sandY=[.010,.010,.0095,-.115,-.25,-.54];
    positions.push(x,lerp(rockY[ring],sandY[ring],p.beach),z);
    blends.push(COAST_BLEND_STOPS[ring]);
    const cliffShade=.94+.055*Math.sin(5*p.angle+profile.seed*.003);
    const colR=toLinear(rock[ring]),colS=toLinear(beach[ring]);
    for(let k=0;k<3;k++)colors.push(clamp(lerp(colR[k],colS[k],p.beach)*cliffShade,0,1));
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
