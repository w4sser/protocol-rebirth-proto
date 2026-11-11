// Self-hosted Polyfork low-poly decoration for Archipelago. ?polyfork=0 disables it.
// Visual-only, deterministic and bounded. No gameplay collision, no changes to terrain/shore.
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {POLYFORK_CANDIDATES} from './polyfork-catalog.mjs?v=polyfork-catalog1';
import {polyforkLocalUrl} from './polyfork-local-url.mjs?v=2.28.15';
import {planProfiledDressing} from './polyfork-profiles.mjs?v=profile-v1';
import {planCoastalLifeDressing} from './polyfork-coastal-life.mjs?v=coastal-life-v1';
import {planMilitaryRemnantsDressing} from './polyfork-military-remnants.mjs?v=military-remnants-v3';
import {renderMilitaryArchitecture} from './military-architecture.mjs?v=military-architecture-v2';
import {propReservations} from './props-placement.mjs?v=2.28.15';
const SAMPLE_IDS=[
  'young-pine-0d7695','birch-tree-181b33','tall-pine-tree-ab4108',
  'fern-plant-1559b8','grass-tuft-a40a08','round-bush-cd2ac0',
  'fallen-log-1685fb','tree-stump-ec3f48','small-rock-db33a7',
  'medium-rock-e08405','wildflower-68d3a1','cattail-reed-6abbb3',
  'driftwood-log-89a68f','marram-grass-tuft-8c7a99','seaweed-drift-line-6566c3',
  'sea-holly-clump-ce3bc6','net-pile-0bd489','lobster-pot-stack-d870f0'
];
const byId=new Map(POLYFORK_CANDIDATES.map(c=>[c.id,c]));
const loader=new GLTFLoader(),assetPromises=new Map();
function load(id){
  if(!byId.has(id))return Promise.reject(new Error('Unknown local Polyfork asset: '+id));
  if(!assetPromises.has(id))assetPromises.set(id,Promise.race([
    loader.loadAsync(polyforkLocalUrl(id)),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('Local Polyfork asset timeout: '+id)),9000))
  ]).catch(error=>{assetPromises.delete(id);throw error;}));
  return assetPromises.get(id);
}
function seedRng(seed){let a=2166136261;for(const c of String(seed))a=Math.imul(a^c.charCodeAt(0),16777619);
  return()=>{a+=0x6d2b79f5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const FINITE=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
// Keep large trees sparse, retain a predominantly Scandinavian palette. Large static
// architecture and man-made objects stay in the 56-model review gallery only.
const CATEGORIES=[
  {id:'young-pine-0d7695',h:2.5,weight:3,radius:.7},
  {id:'tall-pine-tree-ab4108',h:4.3,weight:2,radius:1.25},
  {id:'birch-tree-181b33',h:3.7,weight:2,radius:1.0},
  {id:'fern-plant-1559b8',h:.52,weight:5,radius:.25},
  {id:'grass-tuft-a40a08',h:.40,weight:5,radius:.25},
  {id:'round-bush-cd2ac0',h:.70,weight:3,radius:.42},
  {id:'fallen-log-1685fb',h:.55,weight:1,radius:.65},
  {id:'tree-stump-ec3f48',h:.53,weight:1,radius:.4},
  {id:'small-rock-db33a7',h:.40,weight:3,radius:.4},
  {id:'medium-rock-e08405',h:.75,weight:1,radius:.7},
  {id:'wildflower-68d3a1',h:.42,weight:2,radius:.22},
  {id:'cattail-reed-6abbb3',h:.85,weight:1,radius:.3}
];
const COAST=[
  {id:'driftwood-log-89a68f',h:.36,weight:2,radius:.65},
  {id:'marram-grass-tuft-8c7a99',h:.52,weight:5,radius:.25},
  {id:'seaweed-drift-line-6566c3',h:.18,weight:3,radius:.45},
  {id:'sea-holly-clump-ce3bc6',h:.45,weight:2,radius:.3}
];
function pick(rng,list){let weight=list.reduce((n,c)=>n+c.weight,0),t=rng()*weight;for(const item of list){t-=item.weight;if(t<0)return item;}return list[0];}
function insideWalls(level,x,z,pad){return (level.walls??[]).some(w=>Math.abs(x-w.x)<w.w/2+pad&&Math.abs(z-w.z)<w.d/2+pad);}
export function planPolyforkDressing(level,{quality='high',density=1}={}){
  if(!level?.archipelago)return [];
  const low=quality==='low',rng=seedRng(level.seed+':polyfork-v1'),res=propReservations(level),items=[];
  const limit=Math.min(180,Math.round((low?40:125)*Math.min(1.5,Math.max(0,density))));
  const islands=(level.floors??[]).filter(f=>!f.dir);
  for(const f of islands){
    if(items.length>=limit)break;
    const area=Math.max(0,(f.w-2)*(f.d-2)),attempts=Math.min(250,Math.ceil(area*(low?.18:.42)));
    for(let i=0;i<attempts&&items.length<limit;i++){
      const x=f.x+(rng()-.5)*Math.max(0,f.w-1.8),z=f.z+(rng()-.5)*Math.max(0,f.d-1.8);
      const edge=Math.min(f.w/2-Math.abs(x-f.x),f.d/2-Math.abs(z-f.z));
      const selected=pick(rng,edge<2.1?COAST:CATEGORIES);
      // Guard against occluding interaction zones, bridge mouths, and walls.
      const pad=selected.radius+.55;
      if(res.blocked(x,z,pad)||insideWalls(level,x,z,pad))continue;
      const s=.83+rng()*.34;
      items.push({id:selected.id,x,z,y:.025,ry:rng()*Math.PI*2,h:selected.h*s});
    }
  }
  return items;
}
function geometryParts(asset){
  const scene=asset.scene;scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(scene);
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<.001||Math.max(size.x,size.y,size.z)>1e5)throw new Error('Invalid Polyfork bounds');
  const align=new THREE.Matrix4().makeTranslation(-center.x,-box.min.y,-center.z);
  const parts=[];scene.traverse(o=>{if(!o.isMesh)return;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    // InstancedMesh supports a single material or a material array.
    parts.push({geometry:o.geometry,material:o.material,transform:align.clone().multiply(o.matrixWorld)});
    for(const m of materials)if(m)m.userData.shared=true;
    o.geometry.userData.shared=true;
  });
  if(!parts.length)throw new Error('No meshes in Polyfork GLB');
  return {size,parts};
}
export function addPolyforkDressing(level,scene,{quality='high',density=1,mode='scatter'}={}){
  const group=new THREE.Group();group.name='polyfork-experimental-dressing';scene.add(group);
  const composition=mode==='profiles'?planProfiledDressing(level,{quality,density}):
    mode==='coastal'?planCoastalLifeDressing(level,{quality,density}):
    mode==='military'?planMilitaryRemnantsDressing(level,{quality,density}):null;
  const items=composition?composition.items:planPolyforkDressing(level,{quality,density}),groups=new Map();
  const fortifications=composition?.architecture?.length?
    renderMilitaryArchitecture(composition.architecture,group,{quality,seed:level.seed}):null;
  for(const item of items){if(!groups.has(item.id))groups.set(item.id,[]);groups.get(item.id).push(item);}
  const stats={enabled:true,quality,mode,regions:composition?.regions.map(({index,profile,key})=>({index,profile,key}))??[],landmarks:composition?.landmarks??[],militaryLandmarks:composition?.militaryLandmarks??[],planned:items.length,loaded:0,meshes:0,triangles:0,
    militaryGeometry:fortifications?.stats??{structures:0,parts:0,meshes:0,drawCalls:0},
    failed:[],ready:false};
  const q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3(),m=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0);
  let alive=true;
  const jobs=[...groups].map(async([id,list])=>{
    try{
      const source=geometryParts(await load(id));if(!alive)return;
      const unitHeight=source.size.y,ratio=list[0].h/unitHeight;
      // A cap avoids huge accidental GLB scales from unusual unit conventions.
      if(!Number.isFinite(ratio)||ratio>1000)throw new Error('Scale outside review limit');
      for(const part of source.parts){
        const mesh=new THREE.InstancedMesh(part.geometry,part.material,list.length);
        list.forEach((v,i)=>{q.setFromAxisAngle(up,v.ry);p.set(v.x,v.y,v.z);
          const scale=Math.min(1000,v.h/unitHeight);s.setScalar(scale);
          m.compose(p,q,s).multiply(part.transform);mesh.setMatrixAt(i,m);
        });
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
        mesh.castShadow=quality==='high'&&list.length<=8;mesh.receiveShadow=false;
        mesh.userData.visualOnly=true;mesh.name='polyfork-'+id;group.add(mesh);
        stats.meshes++;stats.triangles+=Math.floor((part.geometry.index?.count??part.geometry.getAttribute('position')?.count??0)/3)*list.length;
      }
      stats.loaded+=list.length;
    }catch(error){stats.failed.push({id,error:String(error?.message??error)});console.warn('[polyfork]',id,error);}
  });
  const ready=Promise.all(jobs).then(()=>{stats.ready=true;console.info('[polyfork-test]',JSON.stringify(stats));});
  return {group,stats,ready,dispose(){alive=false;fortifications?.dispose();scene.remove(group);group.clear();}};
}
