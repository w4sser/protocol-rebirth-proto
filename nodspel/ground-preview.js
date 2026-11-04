// PREVIEW ONLY (?ground=1): ChatGPT ground pass 1 (assets/env/terrain) laid over raid floors.
// Flag absent => this module is never imported. Does not change collision, camera or gameplay.
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
const DIR='../assets/env/terrain/',LAYERS=['granite','moss','gravel','pine_needles'];
let assets=null;
function loadAssets(){
  if(assets)return assets;
  const tl=new THREE.TextureLoader(),gl=new GLTFLoader();
  const tex=(f,srgb)=>new Promise((ok,no)=>tl.load(DIR+f,t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;ok(t);},undefined,no));
  const glb=f=>new Promise((ok,no)=>gl.load(DIR+f,g=>{let m=null;g.scene.traverse(n=>{if(n.isMesh&&!m)m=n;});ok(m);},undefined,no));
  const trails=['trail_straight_4m','trail_straight_2m','trail_end'],decals=['decal_wear','decal_wheel_tracks','decal_footprints','decal_pine_needles','decal_puddle','decal_mud'];
  return assets=Promise.all([Promise.all(LAYERS.map(l=>tex(`ground_${l}_albedo.png`,true))),tex('chunk_0_0_splat.png',false),glb('terrain_chunk_16m_splat.glb'),Promise.all(trails.map(k=>glb(k+'.glb'))),Promise.all(decals.map(k=>glb(k+'.glb')))])
    .then(([layers,splat,chunk,tr,dc])=>({layers,splat,chunk,trails:Object.fromEntries(trails.map((k,i)=>[k,tr[i]])),decals:dc}));
}
// 4-layer splat blend in world space: layers tile every 4 m, the RGBA mask repeats every 16 m (= one chunk).
function splatMaterial(a){
  const m=new THREE.MeshStandardMaterial({roughness:.95,metalness:0});
  m.onBeforeCompile=s=>{
    LAYERS.forEach((_,i)=>s.uniforms['gL'+i]={value:a.layers[i]});s.uniforms.gSplat={value:a.splat};
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vGXZ;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvGXZ=(modelMatrix*vec4(transformed,1.)).xz;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vGXZ;uniform sampler2D gL0,gL1,gL2,gL3,gSplat;')
      .replace('#include <map_fragment>','vec4 gw=texture2D(gSplat,vGXZ/16.);gw/=max(dot(gw,vec4(1.)),1e-3);vec2 gu=vGXZ/4.;diffuseColor.rgb*=texture2D(gL0,gu).rgb*gw.r+texture2D(gL1,gu).rgb*gw.g+texture2D(gL2,gu).rgb*gw.b+texture2D(gL3,gu).rgb*gw.a;');
  };
  return m;
}
export function addGroundPreview(level,scene){
  const group=new THREE.Group();group.name='ground-preview';scene.add(group);
  const stats={chunks:0,planes:0,trails:0,decals:0};
  const ready=loadAssets().then(a=>{
    if(!group.parent)return;
    const mat=splatMaterial(a),Y=.015;
    const plane=(x0,z0,x1,z1)=>{if(x1-x0<.01||z1-z0<.01)return;const p=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0),mat);p.rotation.x=-Math.PI/2;p.position.set((x0+x1)/2,Y,(z0+z1)/2);p.receiveShadow=true;group.add(p);stats.planes++;};
    for(const f of level.floors){
      const x0=f.x-f.w/2,x1=f.x+f.w/2,z0=f.z-f.d/2,z1=f.z+f.d/2;
      // Whole 16 m grid cells inside the floor get the real terrain GLB; the rest is flat splat planes.
      const cx0=Math.ceil(x0/16)*16,cx1=Math.floor(x1/16)*16,cz0=Math.ceil(z0/16)*16,cz1=Math.floor(z1/16)*16;
      if(cx1>cx0&&cz1>cz0){
        for(let x=cx0;x<cx1;x+=16)for(let z=cz0;z<cz1;z+=16){const c=new THREE.Mesh(a.chunk.geometry,mat);c.position.set(x+8,Y,z+8);c.receiveShadow=true;group.add(c);stats.chunks++;}
        plane(x0,z0,x1,cz0);plane(x0,cz1,x1,z1);plane(x0,cz0,cx0,cz1);plane(cx1,cz0,x1,cz1);
      }else plane(x0,z0,x1,z1);
    }
    // Trails along corridors/piers (floors tagged with dir) and through the long axis of other floors.
    let seed=0;for(const ch of String(level.seed))seed=(seed*31+ch.charCodeAt(0))>>>0;
    const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    const prep=m=>{const c=m.clone();c.material=m.material.clone();c.material.alphaTest=.5;c.material.transparent=false;c.receiveShadow=true;return c;};
    for(const f of level.floors){
      const along=f.w>=f.d,len=along?f.w:f.d;if(len<5||(!f.dir&&rnd()<.5))continue;
      const n=Math.floor((len-1)/4);
      for(let i=0;i<n;i++){const t=prep(a.trails.trail_straight_4m),o=-len/2+.5+2+i*4;t.position.set(along?f.x+o:f.x,Y+.012,along?f.z:f.z+o);t.rotation.y=along?Math.PI/2:0;group.add(t);stats.trails++;}
    }
    for(const f of level.floors){const k=Math.round(f.w*f.d/40);for(let i=0;i<k;i++){const d=prep(a.decals[Math.floor(rnd()*a.decals.length)]);d.position.set(f.x+(rnd()-.5)*(f.w-1.5),Y+.02+i*.0005,f.z+(rnd()-.5)*(f.d-1.5));d.rotation.y=rnd()*Math.PI*2;group.add(d);stats.decals++;}}
    console.log('[ground-preview]',JSON.stringify(stats));
  }).catch(e=>console.warn('[ground-preview] failed',e));
  return {group,stats,ready,dispose(){scene.remove(group);}};
}
