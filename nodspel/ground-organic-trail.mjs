// Pass 5: a restrained, seeded footpath inside a single island, never a full-width road.
// Geometry planning is pure so width, margins, frayed edges and short gaps can be tested.
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const smooth=(x)=>{const t=clamp(x,0,1);return t*t*(3-2*t)};
const rand=(seed)=>{let n=(seed^0x9e3779b9)>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return ((n^(n>>>16))>>>0)/4294967296};
const cols=[-1,-.86,-.64,-.30,0,.30,.64,.86,1];
const alpha=[0,.16,.54,.84,.95,.84,.54,.16,0];
const TAU=Math.PI*2;

// Returns world-space positions/uv/rgba/indices, or null when this is a pier,
// corridor or too small to support a natural, inset path.
export function planOrganicTrail(floor,seed=0){
  if(!floor||floor.dir||!Number.isFinite(floor.w)||!Number.isFinite(floor.d)||
      !Number.isFinite(floor.x)||!Number.isFinite(floor.z)||Math.min(floor.w,floor.d)<6)return null;
  const alongX=floor.w>=floor.d,long=alongX?floor.w:floor.d,across=alongX?floor.d:floor.w;
  const length=Math.min(long*.69,long-3.4);
  if(length<3.2)return null;
  const phase=TAU*rand(seed+17);
  const side=(rand(seed+97)-.5)*Math.min(.65,across*.07);
  const steps=Math.max(24,Math.ceil(length*5));
  const pos=[],uv=[],rgba=[],indices=[],samples=[];
  const gapCenter=.43+(rand(seed+29)-.5)*.10;
  const gapTwo=.72+(rand(seed+31)-.5)*.08;
  const fade=(v,center,halfWidth,depth)=>1-depth*(1-smooth(Math.abs(v-center)/halfWidth));
  for(let i=0;i<=steps;i++){
    const t=i/steps,forward=(t-.5)*length;
    const wave=(.27*Math.sin(TAU*1.02*t+phase)+.15*Math.sin(TAU*2.07*t+phase*.54));
    const lateral=side+wave;
    const deriv=(.27*TAU*1.02*Math.cos(TAU*1.02*t+phase)+.15*TAU*2.07*Math.cos(TAU*2.07*t+phase*.54))/length;
    // Smooth 0.6–1.4 m variation (not constant-width strips).
    const width=clamp(.98+.30*Math.sin(TAU*1.27*t+phase*.75)+.11*Math.sin(TAU*2.34*t+phase*.3),.6,1.4);
    const alphaGap=fade(t,gapCenter,.064,.94)*fade(t,gapTwo,.046,.83);
    const endFade=smooth(t/.11)*smooth((1-t)/.11);
    const visibility=clamp(alphaGap*endFade,0,1);
    const norm=1/Math.hypot(1,deriv);
    let x,z;
    if(alongX){x=floor.x+forward;z=floor.z+lateral;}
    else{x=floor.x+lateral;z=floor.z+forward;}
    const normal=alongX?[-deriv*norm,norm]:[norm,-deriv*norm];
    samples.push({t,x,z,width,visibility});
    for(let k=0;k<cols.length;k++){
      // Low-frequency fraying, in addition to gradual alpha at the shoulders.
      const edge=.045*Math.sin(9*t+phase+Math.abs(cols[k])*1.7)+.03*Math.sin(19*t+phase*.8);
      const lateralMeters=cols[k]*(width/2+edge);
      const vx=x+normal[0]*lateralMeters,vz=z+normal[1]*lateralMeters;
      // Inset is always >=~0.55m even on small islands.
      const cx=clamp(vx,floor.x-floor.w/2+.5,floor.x+floor.w/2-.5);
      const cz=clamp(vz,floor.z-floor.d/2+.5,floor.z+floor.d/2-.5);
      pos.push(cx,.010,cz);
      uv.push((cols[k]+1)/2,t*length/2.5);
      // RGBA vertex alpha is supported by Three.js color attributes with itemSize=4.
      const shade=1-.035*(.5+.5*Math.sin(TAU*t+phase));
      rgba.push(shade,shade,shade,alpha[k]*visibility);
    }
  }
  for(let i=0;i<steps;i++)for(let k=0;k<cols.length-1;k++){
    const a=i*cols.length+k,b=(i+1)*cols.length+k;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  return{positions:new Float32Array(pos),uvs:new Float32Array(uv),
    colors:new Float32Array(rgba),indices:new Uint16Array(indices),
    samples,area:floor.w*floor.d,alongX,length,steps};
}
