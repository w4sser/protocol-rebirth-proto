// Shared real-time dressing. No collision, camera or gameplay changes.
import * as THREE from './vendor/three.module.js';

export const LIGHT_RIGS={
  bunker:{sky:'#9caccd',ground:'#242438',fill:1.15,key:'#bac9df',keyPower:1.5,exposure:1.18},
};
// PBR environment fill (v2.28.67). The textured enemies, OP01 and BIT use metal/roughness materials, which only
// get their ambient fill and reflections from an environment map; with hemi + sun alone they read near-black.
// A tiny procedural studio room is baked once through PMREM (on first use, no per-frame cost, no extra lights)
// and assigned per material to those PBR models only (pbrEnvironment), never as scene.environment, so the
// vertex-coloured world keeps its authored bunker/outdoor look.
// Turn off with enabled:false here, or per session with ?envmap=0 for an A/B comparison.
export const ENVIRONMENT_MAP={enabled:true,intensity:1};
export function environmentMapEnabled(search=''){
  const q=new URLSearchParams(search).get('envmap');
  return q==null?ENVIRONMENT_MAP.enabled:q!=='0';
}
function studioRoom(){
  const room=new THREE.Scene(),box=new THREE.BoxGeometry(1,1,1);
  const walls=new THREE.Mesh(box,new THREE.MeshBasicMaterial({color:'#4a5260',side:THREE.BackSide}));
  walls.scale.set(12,8,12);walls.position.y=3;room.add(walls);
  // HDR panels (colour > 1) act as soft area lights: a cool key above, a warmer fill and a low rim.
  const panel=(color,intensity,pos,scale)=>{
    const m=new THREE.Mesh(box,new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity)}));
    m.position.set(...pos);m.scale.set(...scale);room.add(m);
  };
  panel('#dfe8f2',6,[0,6.8,0],[6,.1,6]);
  panel('#f2dcc4',3,[-5.8,3,1],[.1,3,5]);
  panel('#bcd2e6',2.5,[5.8,2.5,-2],[.1,2.5,4]);
  panel('#9aa6b4',1.5,[0,1,-5.8],[6,1.5,.1]);
  return room;
}
export function createEnvironmentMap(renderer){
  const pmrem=new THREE.PMREMGenerator(renderer),room=studioRoom();
  const target=pmrem.fromScene(room,.04);
  room.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});pmrem.dispose();
  return target.texture;
}
let pbrEnvMap=null,pbrRenderer=null,pbrFailed=false;
// Register the renderer at start-up; the PMREM bake itself is deferred to the first PBR model that asks for
// it (pbrEnvironment), so it never sits on the boot path. On software WebGL (CI) the bake takes seconds.
export function applyEnvironmentMap(renderer,search=''){
  pbrRenderer=environmentMapEnabled(search)?renderer:null;
  return pbrRenderer!=null;
}
function environmentTexture(){
  if(pbrEnvMap||pbrFailed||!pbrRenderer)return pbrEnvMap;
  try{pbrEnvMap=createEnvironmentMap(pbrRenderer);}catch(e){console.warn('Environment map skipped',e);pbrFailed=true;}
  return pbrEnvMap;
}
export function pbrEnvironment(material,intensity=ENVIRONMENT_MAP.intensity){
  if(!material?.isMeshStandardMaterial)return false;
  const env=environmentTexture();if(!env)return false;
  material.envMap=env;material.envMapIntensity=intensity;material.needsUpdate=true;return true;
}
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

// Fit modular structure to measured geometry, not approximate manifest dimensions.
// GLBs include trim outside their nominal 2 m span; repeated trim caused overlaps.
export function fitStructure(parts,dimensions){
  if(!parts?.length||parts.some(p=>p.standIn))return parts;
  const bounds=new THREE.Box3();
  for(const p of parts){p.geometry.computeBoundingBox();bounds.union(p.geometry.boundingBox.clone().applyMatrix4(p.matrix));}
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(Math.min(size.x,size.y,size.z)<=0)return parts;
  const correction=new THREE.Matrix4().makeScale(dimensions[0]/size.x,dimensions[1]/size.y,dimensions[2]/size.z)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
  return parts.map(p=>({...p,matrix:correction.clone().multiply(p.matrix)}));
}
