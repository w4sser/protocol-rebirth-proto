// Abandoned Town renderer: cached GLB assets, instanced per mesh part, plus cheap procedural fill.
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {TOWN_DIMS} from './town-layout.js?v=1.73.0';
import {HOUSE_KINDS,HOUSE_DIMS,HOUSE,FURNITURE,toWorld,inHouse} from './house.js?v=1.73.0';
export const TOWN_KINDS=Object.keys(TOWN_DIMS);
let cache=null;
// Per-asset load report (also on window.__townLoad): failed GLBs get a procedural stand-in instead of
// dropping the whole area. Only if most of the kit fails does the caller fall back to Bunker.
export const townLoad={failed:[],retried:0,ms:0};
const withTimeout=(p,ms,what)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`timeout ${ms} ms: ${what}`)),ms))]);
function standIn(dims,color='#5d6670'){const [w,h,d]=dims??[1,1,1],geo=new THREE.BoxGeometry(w,h,d),mat=new THREE.MeshStandardMaterial({color,roughness:.9});
  geo.userData.shared=mat.userData.shared=true;return [{geometry:geo,material:mat,matrix:new THREE.Matrix4().makeTranslation(0,h/2,0),standIn:true}];}
export async function loadKit(base,items,{loader=new GLTFLoader(),concurrency=6,retries=2,timeoutMs=20000,report=townLoad}={}){
  const t0=Date.now(),out={},queue=[...items];
  const one=async ({key,url,dims})=>{let err;
    for(let i=0;i<=retries;i++){try{if(i)report.retried++;const g=await withTimeout(loader.loadAsync(new URL(url,base).href),timeoutMs,url);return prepare(g);}
      catch(e){err=e;await new Promise(r=>setTimeout(r,250*(i+1)));}}
    report.failed.push({key,url,error:String(err?.message??err)});console.warn('[town] asset failed, using stand-in',key,err);return standIn(dims);};
  await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},async()=>{while(queue.length){const it=queue.shift();out[it.key]=await one(it);}}));
  report.ms=Date.now()-t0;return out;}
function prepare(g){g.scene.updateMatrixWorld(true);const parts=[];
  // some kit origins float above the ground: drop every asset so its lowest point sits at y=0
  const lift=-new THREE.Box3().setFromObject(g.scene).min.y,shift=new THREE.Matrix4().makeTranslation(0,lift,0);
  g.scene.traverse(o=>{if(!o.isMesh)return;o.geometry.userData.shared=true;o.material.userData.shared=true;
    if(o.material.name==='window_glow'){o.material.emissive?.set('#ffb85a');o.material.emissiveIntensity=2.6;}
    if(o.material.name==='lamp_glow')o.material.emissiveIntensity=1.6;
    parts.push({geometry:o.geometry,material:o.material,matrix:shift.clone().multiply(o.matrixWorld)});});
  return parts;}
// Loads once per page; geometries/materials are flagged shared so world.dispose() never frees them.
export function loadTownAssets(base,opts={}){
  if(cache)return cache;
  const items=[...TOWN_KINDS.map(k=>({key:k,url:`${k}.glb?v=1.73.0`,dims:TOWN_DIMS[k]})),...HOUSE_KINDS.map(k=>({key:'hi_'+k,url:`house_interior/${k}.glb?v=1.73.0`,dims:HOUSE_DIMS[k]}))];
  if(typeof window!=='undefined')window.__townLoad=townLoad;
  cache=loadKit(base,items,opts).then(a=>{
    if(townLoad.failed.length>items.length/2)throw new Error(`town kit failed: ${townLoad.failed.length}/${items.length} assets (${townLoad.failed[0]?.error})`);
    // wrecks: same car mesh, darker and desaturated materials (never rescaled)
    a.car_wreck=a.car_boxy.map(p=>{const m=p.material.clone();m.userData.shared=true;if(m.color){const h={};m.color.getHSL(h);m.color.setHSL(h.h,h.s*.25,Math.max(.05,h.l*.6));}m.roughness=1;if(m.emissiveIntensity)m.emissiveIntensity=0;return {...p,material:m};});
    // night ground reads too dark on phones: lift the ground palettes a little
    for(const k of ['tile_grass','tile_asphalt','tile_sidewalk','tile_asphalt_grass','tile_sidewalk_grass','tile_asphalt_sidewalk'])for(const p of a[k]??[])if(p.material.color&&!p.material.userData.lifted){p.material.color.multiplyScalar(1.45);p.material.userData.lifted=true;}
    return a;}).catch(e=>{cache=null;throw e;});
  return cache;
}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
export function instance(group,parts,list,{cast=false,receive=true}={}){
  if(!list.length)return [];
  return parts.map(part=>{const im=new THREE.InstancedMesh(part.geometry,part.material,list.length);
    list.forEach((t,i)=>{_q.setFromAxisAngle(UP,t.ry??0);_p.set(t.x,t.y??0,t.z);_s.set(t.sx??1,t.sy??1,t.sz??1);_m.compose(_p,_q,_s).multiply(part.matrix);im.setMatrixAt(i,_m);});
    im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.castShadow=cast;im.receiveShadow=receive;group.add(im);return im;});
}
const CAST=new Set(['car_wreck','house_red','house_yellow','house_red_dark','house_yellow_dark','pine_tree','car_boxy','container','bus_shelter','streetlamp','hedge_segment','fence_segment','fence_short','fence_gate','electrical_cabinet']);
// low quality keeps 1 in N of the purely decorative bits
const THIN={grass_tuft_small:3,grass_tuft_large:3,weed_tuft:3,bush_small:2,bush_cluster:2,pine_tree:2};
const TILE_Y={tile_grass:-.3,tile_asphalt:-.1,tile_sidewalk:-.1,tile_asphalt_grass:-.09,tile_sidewalk_grass:-.09,tile_asphalt_sidewalk:-.09};
export function buildTown(level,group,assets,Q){
  const T=level.town,low=!Q.shadows,lights=[],byKind=new Map();
  const add=(kind,t)=>{if(!assets[kind])return;if(!byKind.has(kind))byKind.set(kind,[]);byKind.get(kind).push(t);};
  for(const t of T.tiles)add(t.kind,{x:t.x,z:t.z,y:TILE_Y[t.kind]??-.1,ry:t.ry??0});
  for(const f of T.fences)add(f.kind??'fence_segment',{x:f.x,z:f.z,ry:f.rot*Math.PI/2,sx:f.stretch});
  for(const h of T.houses)add(h.kind,{x:h.x,z:h.z,ry:h.rot*Math.PI/2});
  for(const c of T.cars)add(c.wreck?'car_wreck':'car_boxy',{x:c.x,z:c.z,ry:c.rot*Math.PI/2+(c.outside?.12:0)});
  for(const t of T.trees)add('pine_tree',{x:t.x,z:t.z,ry:t.r,sx:t.s,sy:t.s,sz:t.s});
  for(const p of T.props??[])add(p.kind,{x:p.x,z:p.z,y:p.kind==='manhole'?-.12:0,ry:p.ry,sx:p.s,sy:p.s,sz:p.sz??p.s});
  if(T.busStop)add('bus_shelter',{x:T.busStop.x,z:T.busStop.z,ry:T.busStop.ry??0});
  for(const l of T.lamps)add('streetlamp',{x:l.x,z:l.z,ry:l.ry??0});
  for(const [kind,list] of byKind){const k=low?THIN[kind]:0,use=k?list.filter((_,i)=>i%k===0):list;
    instance(group,assets[kind],use,{cast:!low&&CAST.has(kind),receive:kind.startsWith('tile_')||!CAST.has(kind)});}
  // low curb on every wall line: the playable edge is always readable
  const curbMat=new THREE.MeshStandardMaterial({color:'#59646a',roughness:.9});
  instance(group,[{geometry:new THREE.BoxGeometry(1,1,1),material:curbMat,matrix:new THREE.Matrix4()}],level.walls.map(w=>({x:w.x,z:w.z,y:.09,sx:w.w,sy:.18,sz:w.d})),{receive:true});
  // lamp glow: warm pool under each head; only a couple get a real light (none on low)
  const pool=new THREE.MeshBasicMaterial({color:'#ffb35c',transparent:true,opacity:low?.2:.11,blending:THREE.AdditiveBlending,depthWrite:false}),poolGeo=new THREE.CircleGeometry(low?3:2.5,28);
  T.lamps.forEach((l,i)=>{const ry=l.ry??0,hx=l.x+Math.cos(ry)*.6,hz=l.z-Math.sin(ry)*.6;
    const p=new THREE.Mesh(poolGeo,pool);p.rotation.x=-Math.PI/2;p.position.set(hx,.03,hz);group.add(p);
    if(i<Q.lights){const pl=new THREE.PointLight('#ffb760',10,11,1.5);pl.position.set(hx,3.7,hz);group.add(pl);lights.push(pl);}});
  const house=level.house&&assets.hi_floor_4m?buildHouse(level.house,group,assets,Q):null;
  return {lights,house};
}
// Enterable house: plain meshes (few parts). Roof + camera-side walls get their own fade materials.
function buildHouse(h,group,assets,Q){const g=new THREE.Group();group.add(g);const fadeRoof=[],fadeWalls=[];
  const put=(kind,x,z,ry=0,y=0,fade=null,parent=g)=>{const parts=assets['hi_'+kind];if(!parts)return null;const o=new THREE.Group();
    const p=toWorld(h,x,z);o.position.set(p.x,y,p.z);o.rotation.y=h.ry+ry;parent.add(o);
    for(const part of parts){let mat=part.material;if(fade){mat=mat.clone();mat.transparent=true;mat.userData={};fade.push(mat);}
      const m=new THREE.Mesh(part.geometry,mat);m.matrixAutoUpdate=false;m.matrix.copy(part.matrix);m.castShadow=!!Q.shadows;m.receiveShadow=true;o.add(m);}
    return o;};
  const I=HOUSE.inner/2+.08;
  put('floor_4m',0,0,0,-.1);
  // outward world normal of a wall decides the cut-away: camera sits at +x/+z
  const camSide=(lx,lz)=>{const a=toWorld(h,lx,lz),c=toWorld(h,0,0);return a.x-c.x>.5||a.z-c.z>.5;};
  const walls=[['wall_doorway_4m',0,-I,0],['wall_window_4m',0,I,Math.PI],['wall_plain_4m',-I,0,Math.PI/2],['wall_plain_4m',I,0,-Math.PI/2]];
  for(const [k,x,z,ry] of walls)put(k,x,z,ry,0,camSide(x,z)?fadeWalls:null);
  // corner posts close the module joints
  const post=new THREE.MeshStandardMaterial({color:'#7a6e57',roughness:.95}),pg=new THREE.BoxGeometry(.22,2.6,.22);
  for(const [x,z] of [[-I,-I],[I,-I],[-I,I],[I,I]]){const p=toWorld(h,x,z),m=new THREE.Mesh(pg,camSide(x,z)?(()=>{const c=post.clone();c.transparent=true;fadeWalls.push(c);return c;})():post);m.position.set(p.x,1.3,p.z);m.castShadow=!!Q.shadows;g.add(m);}
  const doorClosed=put('door_closed',0,-I,0),doorOpen=put('door_open',0,-I+.5,0);
  for(const f of FURNITURE)put(f.kind,f.x,f.z,f.rot*Math.PI/2,f.y??0);
  const roof=put('roof_removable_4m',0,0,0,HOUSE.height,fadeRoof);
  // warm interior glow so the room reads at night (real light only above low quality)
  const glowMat=new THREE.MeshBasicMaterial({color:'#ffb35c',transparent:true,opacity:Q.shadows?.08:.14,blending:THREE.AdditiveBlending,depthWrite:false});
  const pool=new THREE.Mesh(new THREE.CircleGeometry(1.9,24),glowMat);pool.rotation.x=-Math.PI/2;pool.position.set(h.x,.04,h.z);g.add(pool);
  let lamp=null;if(Q.lights>0){lamp=new THREE.PointLight('#ffc27a',5,6,1.6);lamp.position.set(h.x,2.2,h.z);g.add(lamp);}
  let k=1,inside=false;
  function update(pos,dt){inside=inHouse(h,pos,.15);const target=inside?0:1;k+=(target-k)*Math.min(1,dt*8);if(Math.abs(k-target)<.01)k=target;
    for(const m of fadeRoof){m.opacity=k;m.depthWrite=k>.98;}roof.visible=k>.02;
    const wk=.18+.82*k;for(const m of fadeWalls){m.opacity=wk;m.depthWrite=wk>.98;}
    doorClosed.visible=!h.door.open;doorOpen.visible=h.door.open;}
  update({x:1e9,z:1e9},1);
  return {group:g,update,get inside(){return inside;},get roofOpacity(){return k;},roof,doorClosed,doorOpen,fadeWalls,fadeRoof};
}
