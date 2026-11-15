// PRB-156: shared procedural texture for the extraction beam / loot-burst VFX. A single soft radial dot,
// built from a typed-array DataTexture (not canvas: these modules build real THREE objects in plain `node --test`
// tests with no DOM, so `document.createElement('canvas')` would throw there) -- the one "canvas-generated soft
// dot" the task allows, generated once and cached, never re-created per level/raid/particle.
import * as THREE from './vendor/three.module.js';
const SIZE=32;
let cached=null;
export function softDotTexture(){
  if(cached)return cached;
  const data=new Uint8Array(SIZE*SIZE*4),c=(SIZE-1)/2;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const d=Math.hypot(x-c,y-c)/c,a=Math.max(0,1-d),i=(y*SIZE+x)*4;
    data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=Math.round(255*Math.pow(a,1.4));
  }
  cached=new THREE.DataTexture(data,SIZE,SIZE,THREE.RGBAFormat);
  cached.needsUpdate=true;cached.userData.shared=true;
  return cached;
}
