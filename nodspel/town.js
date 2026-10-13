// Abandoned Town renderer: cached GLB assets, instanced per mesh part, plus cheap procedural fill.
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export const TOWN_KINDS=['house_red','house_yellow','car_boxy','fence_segment','pine_tree','tile_grass','tile_asphalt','tile_sidewalk'];
let cache=null;
// Loads once per page; geometries/materials are flagged shared so world.dispose() never frees them.
export function loadTownAssets(base){
  if(cache)return cache;
  const loader=new GLTFLoader();
  cache=Promise.all(TOWN_KINDS.map(async kind=>{
    const g=await loader.loadAsync(new URL(`${kind}.glb?v=1.38.0`,base).href);g.scene.updateMatrixWorld(true);const parts=[];
    g.scene.traverse(o=>{if(!o.isMesh)return;o.geometry.userData.shared=true;o.material.userData.shared=true;
      if(o.material.name==='window_glow'){o.material.emissive?.set('#ffb85a');o.material.emissiveIntensity=2.6;}
      if(o.material.name==='lamp_glow')o.material.emissiveIntensity=1.6;
      parts.push({geometry:o.geometry,material:o.material,matrix:o.matrixWorld.clone()});});
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
export function buildTown(level,group,assets,Q){
  const T=level.town,low=!Q.shadows,lights=[];
  const groundY={tile_grass:-.3,tile_asphalt:-.1,tile_sidewalk:-.1};
  for(const kind of ['tile_grass','tile_asphalt','tile_sidewalk'])instance(group,assets[kind],T.tiles.filter(t=>t.kind===kind).map(t=>({x:t.x,z:t.z,y:groundY[kind]})),{receive:true});
  instance(group,assets.fence_segment,T.fences.map(f=>({x:f.x,z:f.z,ry:f.rot*Math.PI/2,sx:f.stretch})),{cast:!low});
  for(const kind of ['house_red','house_yellow'])instance(group,assets[kind],T.houses.filter(h=>h.kind===kind).map(h=>({x:h.x,z:h.z,ry:h.rot*Math.PI/2})),{cast:!low});
  instance(group,assets.car_boxy,T.cars.map(c=>({x:c.x,z:c.z,ry:c.rot*Math.PI/2+(c.outside?.12:0)})),{cast:!low});
  const trees=low?T.trees.filter((_,i)=>i%2===0):T.trees;
  instance(group,assets.pine_tree,trees.map(t=>({x:t.x,z:t.z,ry:t.r,sx:t.s,sy:t.s,sz:t.s})),{cast:!low,receive:false});
  // bushes: one instanced low-poly blob
  const bushes=low?T.bushes.filter((_,i)=>i%3===0):T.bushes;
  if(bushes.length){const bm=new THREE.MeshStandardMaterial({color:'#1d3a26',roughness:1,flatShading:true});
    instance(group,[{geometry:new THREE.IcosahedronGeometry(1,0),material:bm,matrix:new THREE.Matrix4()}],bushes.map(b=>({x:b.x,z:b.z,y:b.s*.45,sx:b.s,sy:b.s*.8,sz:b.s})),{receive:false});}
  // street lamps: emissive head + warm ground pool; only a couple get a real light (none on low)
  const pole=new THREE.MeshStandardMaterial({color:'#1a2126',roughness:.7}),head=new THREE.MeshBasicMaterial({color:'#ffd08a',toneMapped:false});
  const pool=new THREE.MeshBasicMaterial({color:'#ffb35c',transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false});
  const poolGeo=new THREE.CircleGeometry(2.2,28),cube=new THREE.BoxGeometry(1,1,1);
  const bx=(parent,mat,x,y,z,w,h,d)=>{const m=new THREE.Mesh(cube,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=!low;parent.add(m);return m;};
  T.lamps.forEach((l,i)=>{const g=new THREE.Group();g.position.set(l.x,0,l.z);group.add(g);
    bx(g,pole,0,1.6,0,.12,3.2,.12);bx(g,pole,0,3.15,.3,.1,.08,.7);bx(g,head,0,3.05,.6,.34,.14,.34);
    const p=new THREE.Mesh(poolGeo,pool);p.rotation.x=-Math.PI/2;p.position.set(0,.025,.6);g.add(p);
    if(i<Q.lights){const pl=new THREE.PointLight('#ffb760',9,10,1.5);pl.position.set(0,2.9,.6);g.add(pl);lights.push(pl);}});
  // bus stop with a glowing ad panel
  if(T.busStop){const s=T.busStop,g=new THREE.Group();g.position.set(s.x,0,s.z);g.rotation.y=s.rot*Math.PI/2;group.add(g);
    const metal=new THREE.MeshStandardMaterial({color:'#2a3238',roughness:.6}),glass=new THREE.MeshStandardMaterial({color:'#20333a',transparent:true,opacity:.55,roughness:.2}),wood=new THREE.MeshStandardMaterial({color:'#4a3324',roughness:.9});
    const ad=new THREE.MeshBasicMaterial({color:'#5fe0e8',toneMapped:false});
    bx(g,metal,0,2.35,0,3.1,.12,1.5);for(const sx of [-1.45,1.45])bx(g,metal,sx,1.15,-.6,.08,2.3,.08);
    bx(g,glass,0,1.25,-.62,2.8,1.7,.04);bx(g,ad,1.5,1.2,0,.06,1.5,1);bx(g,wood,0,.45,-.35,2.2,.08,.45);}
  // dumpsters stand in for the bunker crates (same colliders)
  const dump=new THREE.MeshStandardMaterial({color:'#1e4842',roughness:.8}),lid=new THREE.MeshStandardMaterial({color:'#2c6058',roughness:.7});
  for(const b of level.boxes){if(b.town)continue;bx(group,dump,b.x,b.h/2,b.z,b.w,b.h,b.d);bx(group,lid,b.x,b.h+.04,b.z,b.w+.06,.08,b.d+.06);}
  return {lights};
}
