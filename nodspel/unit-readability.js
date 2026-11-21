/**
 * Combat-unit readability, separate from world colour grading and gameplay rules.
 * Neutral fill/rim keeps actors legible against Nordic summer-night terrain.
 * Contact shadows are a cheap single textured quad even with real shadows off.
 */
import * as THREE from './vendor/three.module.js';

export const UNIT_READABILITY=Object.freeze({
  operatorScalePercent:135,
  operatorRimStrength:.32,
  operatorFillColor:'#aebcc2',
  operatorFillStrength:.18,
  operatorLowFillStrength:.30,
  enemyRimColor:'#aab6bb',
  enemyRimStrength:.18,
  enemyFillColor:'#81939b',
  enemyFillStrength:.17,
  shadowColor:'#101a1e'
});

const ENEMY_RIM_PATCHED=new WeakSet();
export function tuneEnemyReadabilityMaterial(material){
  if(!material?.isMeshStandardMaterial)return false;
  material.fog=false;
  // Retain existing explicit emissive warning/weakpoint accents. Otherwise
  // add a small neutral fill so dark vertex colours do not disappear on phones.
  if(material.emissive && material.emissive.r+material.emissive.g+material.emissive.b<.001){
    material.emissive.set(UNIT_READABILITY.enemyFillColor);
    material.emissiveIntensity=UNIT_READABILITY.enemyFillStrength;
  }
  if(ENEMY_RIM_PATCHED.has(material))return true;
  ENEMY_RIM_PATCHED.add(material);
  const priorCompile=material.onBeforeCompile;
  const priorKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=shader=>{
    priorCompile?.(shader);
    shader.uniforms.prEnemyRimColor={value:new THREE.Color(UNIT_READABILITY.enemyRimColor)};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vPREnemyNormal;\nvarying vec3 vPREnemyView;')
      .replace('#include <project_vertex>','vPREnemyNormal=normalize(normalMatrix*objectNormal);vPREnemyView=-(modelViewMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vPREnemyNormal;\nvarying vec3 vPREnemyView;\nuniform vec3 prEnemyRimColor;')
      .replace('#include <dithering_fragment>','float prEnemyEdge=pow(1.0-clamp(dot(normalize(vPREnemyNormal),normalize(vPREnemyView)),0.0,1.0),2.8);\ngl_FragColor.rgb+=prEnemyRimColor*prEnemyEdge*'+UNIT_READABILITY.enemyRimStrength+';\n#include <dithering_fragment>');
  };
  material.customProgramCacheKey=()=>priorKey()+'-pr-enemy-readability-v1';
  material.needsUpdate=true;
  return true;
}

// Shared GPU resources: no canvas, DOM, lights, per-frame allocations or
// per-unit textures. The small radial alpha is visually softer than a hard disc.
const SIZE=48;
let shadowTexture=null,shadowGeometry=null;
const shadowMaterials=new Map();
function getShadowTexture(){
  if(shadowTexture)return shadowTexture;
  const pixels=new Uint8Array(SIZE*SIZE*4);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const u=(x+.5-SIZE/2)/(SIZE/2),v=(y+.5-SIZE/2)/(SIZE/2);
    const r2=u*u+v*v;
    const alpha=Math.round(255*Math.max(0,1-r2)**2);
    const i=(y*SIZE+x)*4;
    pixels[i]=255;pixels[i+1]=255;pixels[i+2]=255;pixels[i+3]=alpha;
  }
  shadowTexture=new THREE.DataTexture(pixels,SIZE,SIZE,THREE.RGBAFormat);
  shadowTexture.magFilter=THREE.LinearFilter;
  shadowTexture.minFilter=THREE.LinearFilter;
  shadowTexture.generateMipmaps=false;
  shadowTexture.needsUpdate=true;
  return shadowTexture;
}
export function createUnitContactShadow({radius=.75,opacity=.32,y=.018}={}){
  if(!Number.isFinite(radius)||radius<=0||!Number.isFinite(opacity)||opacity<0||opacity>1)
    throw new RangeError('Invalid contact shadow dimensions');
  if(!shadowGeometry){
    shadowGeometry=new THREE.PlaneGeometry(2,2);
    shadowGeometry.userData.shared=true;
  }
  let material=shadowMaterials.get(opacity);
  if(!material){
    material=new THREE.MeshBasicMaterial({
      color:UNIT_READABILITY.shadowColor,
      map:getShadowTexture(),transparent:true,opacity,
      depthWrite:false,depthTest:true,toneMapped:false,fog:false,
      polygonOffset:true,polygonOffsetFactor:-1
    });
    material.userData.shared=true;
    shadowMaterials.set(opacity,material);
  }
  const shadow=new THREE.Mesh(shadowGeometry,material);
  shadow.name='unit-contact-shadow';
  shadow.rotation.x=-Math.PI/2;
  shadow.scale.set(radius,radius,1);
  shadow.position.y=y;
  shadow.castShadow=false;shadow.receiveShadow=false;
  return shadow;
}
