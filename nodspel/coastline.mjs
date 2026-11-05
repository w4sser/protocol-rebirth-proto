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
export function coastlineProfile(floor,levelSeed,{samples=72}={}){
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
    const outer=Math.max(inside+.55,roundedRadius(floor,c,s)+wave);
    const beach=coastBeach(t,seed);
    const cliff=.5+.5*Math.sin(4*angle+phase2);
    points.push({
      x:floor.x+c*outer,z:floor.z+s*outer,
      t,angle,radial:outer,innerRadial:inside,beach,
      kind:beach>.55?'small_beach':cliff>.40?'cliff':'rocky_shore'
    });
  }
  let rockyLength=0,totalLength=0;
  for(let i=0;i<count;i++){
    const p=points[i],q=points[(i+1)%count],len=Math.hypot(q.x-p.x,q.z-p.z);
    totalLength+=len;
    rockyLength+=len*(1-(p.beach+q.beach)*.5);
  }
  return {floor,seed,points,rockyRatio:rockyLength/totalLength,totalLength,beachRatio:1-rockyLength/totalLength};
}
export function coastRingData(profile){
  const {floor,points}=profile,n=points.length,positions=[],indices=[],colors=[];
  const rock=['#697471','#7c8082','#6f7480','#3b4657'];
  const beach=['#877859','#938162','#908063','#665948'];
  const hex=(h)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
  const lerp=(a,b,t)=>a+(b-a)*t;
  for(let ring=0;ring<4;ring++)for(let i=0;i<n;i++){
    const p=points[i],c=Math.cos(p.angle),s=Math.sin(p.angle);
    const d=p.radial-p.innerRadial;
    const radius=[p.innerRadial-.16,p.innerRadial+d*.53,p.radial-.07,p.radial+.22][ring];
    const yRock=[-.024,-.07,-.085,-.73][ring],ySand=[-.024,-.17,-.29,-.54][ring];
    const y=lerp(yRock,ySand,p.beach);
    positions.push(floor.x+c*radius,y,floor.z+s*radius);
    const cliffShade=.92+.085*Math.sin(i*.56+profile.seed*.003);
    const colR=hex(rock[ring]),colS=hex(beach[ring]);
    for(let k=0;k<3;k++)colors.push(clamp(lerp(colR[k],colS[k],p.beach)*cliffShade,0,1));
  }
  for(let ring=0;ring<3;ring++)for(let i=0;i<n;i++){
    const j=(i+1)%n,a=ring*n+i,b=ring*n+j,c=(ring+1)*n+i,d=(ring+1)*n+j;
    indices.push(a,b,c,b,d,c);
  }
  return {positions:new Float32Array(positions),colors:new Float32Array(colors),indices:new Uint16Array(indices)};
}
