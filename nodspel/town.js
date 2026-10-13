// Abandoned Town renderer: cached GLB assets, instanced per mesh part, plus cheap procedural fill.
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {TOWN_DIMS} from './town-layout.js?v=1.39.1';
export const TOWN_KINDS=Object.keys(TOWN_DIMS);
let cache=null;
// Loads once per page; geometries/materials are flagged shared so world.dispose() never frees them.
export function loadTownAssets(base){
  if(cache)return cache;
  const loader=new GLTFLoader();
  cache=Promise.all(TOWN_KINDS.map(async kind=>{
    const g=await loader.loadAsync(new URL(`${kind}.glb?v=1.39.1`,base).href);g.scene.updateMatrixWorld(true);const parts=[];
    // some kit origins float above the ground: drop every asset so its lowest point sits at y=0
    const lift=-new THREE.Box3().setFromObject(g.scene).min.y,shift=new THREE.Matrix4().makeTranslation(0,lift,0);
    g.scene.traverse(o=>{if(!o.isMesh)return;o.geometry.userData.shared=true;o.material.userData.shared=true;
      if(o.material.name==='window_glow'){o.material.emissive?.set('#ffb85a');o.material.emissiveIntensity=2.6;}
      if(o.material.name==='lamp_glow')o.material.emissiveIntensity=1.6;
      parts.push({geometry:o.geometry,material:o.material,matrix:shift.clone().multiply(o.matrixWorld)});});
    return [kind,parts];})).then(Object.fromEntries).catch(e=>{cache=null;throw e;});
  return cache;
}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
function instance(group,parts,list,{cast=false,receive=true}={}){
  if(!list.length)return [];
  return parts.map(part=>{const im=new THREE.InstancedMesh(part.geometry,part.material,list.length);
    list.forEach((t,i)=>{_q.setFromAxisAngle(UP,t.ry??0);_p.set(t.x,t.y??0,t.z);_s.set(t.sx??1,t.sy??1,t.sz??1);_m.compose(_p,_q,_s).multiply(part.matrix);im.setMatrixAt(i,_m);});
    im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.castShadow=cast;im.receiveShadow=receive;group.add(im);return im;});
}
const CAST=new Set(['house_red','house_yellow','house_red_dark','house_yellow_dark','pine_tree','car_boxy','container','bus_shelter','streetlamp','hedge_segment','fence_segment','fence_short','fence_gate','electrical_cabinet']);
// low quality keeps 1 in N of the purely decorative bits
const THIN={grass_tuft_small:3,grass_tuft_large:3,weed_tuft:3,bush_small:2,bush_cluster:2,pine_tree:2};
const TILE_Y={tile_grass:-.3,tile_asphalt:-.1,tile_sidewalk:-.1,tile_asphalt_grass:-.09,tile_sidewalk_grass:-.09,tile_asphalt_sidewalk:-.09};
export function buildTown(level,group,assets,Q){
  const T=level.town,low=!Q.shadows,lights=[],byKind=new Map();
  const add=(kind,t)=>{if(!assets[kind])return;if(!byKind.has(kind))byKind.set(kind,[]);byKind.get(kind).push(t);};
  for(const t of T.tiles)add(t.kind,{x:t.x,z:t.z,y:TILE_Y[t.kind]??-.1,ry:t.ry??0});
  for(const f of T.fences)add(f.kind??'fence_segment',{x:f.x,z:f.z,ry:f.rot*Math.PI/2,sx:f.stretch});
  for(const h of T.houses)add(h.kind,{x:h.x,z:h.z,ry:h.rot*Math.PI/2});
  for(const c of T.cars)add('car_boxy',{x:c.x,z:c.z,ry:c.rot*Math.PI/2+(c.outside?.12:0)});
  for(const t of T.trees)add('pine_tree',{x:t.x,z:t.z,ry:t.r,sx:t.s,sy:t.s,sz:t.s});
  for(const p of T.props??[])add(p.kind,{x:p.x,z:p.z,y:p.kind==='manhole'?-.12:0,ry:p.ry,sx:p.s,sy:p.s,sz:p.s});
  if(T.busStop)add('bus_shelter',{x:T.busStop.x,z:T.busStop.z,ry:T.busStop.ry??0});
  for(const l of T.lamps)add('streetlamp',{x:l.x,z:l.z,ry:l.ry??0});
  for(const [kind,list] of byKind){const k=low?THIN[kind]:0,use=k?list.filter((_,i)=>i%k===0):list;
    instance(group,assets[kind],use,{cast:!low&&CAST.has(kind),receive:kind.startsWith('tile_')||!CAST.has(kind)});}
  // lamp glow: warm pool under each head; only a couple get a real light (none on low)
  const pool=new THREE.MeshBasicMaterial({color:'#ffb35c',transparent:true,opacity:.08,blending:THREE.AdditiveBlending,depthWrite:false}),poolGeo=new THREE.CircleGeometry(2.3,28);
  T.lamps.forEach((l,i)=>{const ry=l.ry??0,hx=l.x+Math.cos(ry)*.6,hz=l.z-Math.sin(ry)*.6;
    const p=new THREE.Mesh(poolGeo,pool);p.rotation.x=-Math.PI/2;p.position.set(hx,.03,hz);group.add(p);
    if(i<Q.lights){const pl=new THREE.PointLight('#ffb760',10,11,1.5);pl.position.set(hx,3.7,hz);group.add(pl);lights.push(pl);}});
  return {lights};
}
