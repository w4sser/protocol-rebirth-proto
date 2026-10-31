// Shared real-time dressing. No collision, camera or gameplay changes.
import * as THREE from './vendor/three.module.js';

export const LIGHT_RIGS={
  bunker:{sky:'#9caccd',ground:'#242438',fill:1.15,key:'#bac9df',keyPower:1.5,exposure:1.18},
};
export function applyEnvironmentLight(area,{hemi,sun,renderer}){
  const r=LIGHT_RIGS[area]??LIGHT_RIGS.bunker;
  hemi.color.set(r.sky);hemi.groundColor.set(r.ground);hemi.intensity=r.fill;
  sun.color.set(r.key);sun.intensity=r.keyPower;renderer.toneMappingExposure=r.exposure;
}

// One cached radial texture shared by all soft pools/contact patches. No extra lights,
// shadow maps, canvases or postprocessing passes on the mobile tier.
let falloff;
function falloffTexture(){
  if(falloff)return falloff;
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2));
    const a=Math.max(0,1-r*r);const i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(255*a*a);
  }
  falloff=new THREE.DataTexture(data,size,size);falloff.needsUpdate=true;
  falloff.magFilter=falloff.minFilter=THREE.LinearFilter;
  return falloff;
}
export function groundPatchParts({color='#141a30',opacity=.25,additive=false}={}){
  const geometry=new THREE.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
  const material=new THREE.MeshBasicMaterial({color,map:falloffTexture(),transparent:true,opacity,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
  return [{geometry,material,matrix:new THREE.Matrix4()}];
}
