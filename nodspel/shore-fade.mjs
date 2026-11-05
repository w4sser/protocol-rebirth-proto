// Pass 8: keep shore fading below one meter, without alpha blending.
export const SHORE_FADE_START = 0.025;
export const SHORE_FADE_END = 0.75;
export const SHORE_SAND_COLOR = '#7a6d52';
export const shoreBounds = f => f.dir ? [-100000,-100000,100000,100000] : [f.x-f.w/2,f.z-f.d/2,f.x+f.w/2,f.z+f.d/2];
export function shoreFadeAt(f,x,z,low=false){
 if(f.dir)return 1;
 const [x0,z0,x1,z1]=shoreBounds(f);
 const dist=Math.min(x-x0,z-z0,x1-x,z1-z);
 const wiggle=.065*Math.sin(x*1.47+z*1.19)+(low?0:.045*Math.sin(x*2.65-z*2.10+.6));
 let t=Math.max(0,Math.min(1,(dist+wiggle-SHORE_FADE_START)/(SHORE_FADE_END-SHORE_FADE_START)));
 return t*t*(3-2*t);
}
