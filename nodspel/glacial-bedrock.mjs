// Reusable locally-authored glTF 2.0 glacial granite assets, instanced for phone.
// HIGH 900 triangles per landmass, LOW 282. The rock skirt starts below sea level.
// No glacial render mesh is permitted over logical floors (layout checks that).
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

export const GLACIAL_ASSETS=Object.freeze({
  headland:Object.freeze({
    high:'./assets/env/glacial/glacial_headland_high.glb',
    low:'./assets/env/glacial/glacial_headland_low.glb',
  }),
  portal:Object.freeze({
    high:'./assets/env/glacial/glacial_portal_high.glb',
    low:'./assets/env/glacial/glacial_portal_low.glb',
  }),
});
const loader=new GLTFLoader(),assetCache=new Map(),materialCache=new WeakMap();
export function glacialAssetUrl(kind,quality){
  const path=GLACIAL_ASSETS[kind]?.[quality==='high'?'high':'low'];
  if(!path)throw new Error('Unknown glacial bedrock asset: '+kind);
  return new URL(path,import.meta.url).href;
}
function localGLB(kind,quality){
  const url=glacialAssetUrl(kind,quality);
  if(!assetCache.has(url)){
    const promise=Promise.race([
      loader.loadAsync(url),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Glacial bedrock load timeout: '+url)),9000))
    ]).catch(error=>{assetCache.delete(url);throw error;});
    assetCache.set(url,promise);
  }
  return assetCache.get(url);
}
function parts(gltf){
  if(!gltf?.scene)throw new Error('Missing glacial GLB scene');
  gltf.scene.updateMatrixWorld(true);
  const found=[];
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    if(!o.geometry?.getAttribute('position'))throw new Error('Missing glacial positions');
    const original=o.material;
    if(Array.isArray(original)||!original)throw new Error('Glacial mesh must have one material');
    if(!o.geometry.getAttribute('color'))throw new Error('Glacial vertex colors missing');
    // Sundown lighting previously washed the glacial rock into a featureless
    // pale blob. Multiply the baked large-scale slate/lichen bands by this
    // granite-gray tint, preserving smooth ice-polished normals.
    if(!materialCache.has(original)){
      const granite=original.clone();
      granite.color.multiply(new THREE.Color('#9CA0A5'));
      granite.roughness=1;granite.metalness=0;
      granite.vertexColors=true;granite.flatShading=false;
      granite.userData.shared=true;
      materialCache.set(original,granite);
    }
    const material=materialCache.get(original);
    found.push({geometry:o.geometry,material,transform:o.matrixWorld.clone()});
    o.geometry.userData.shared=true;
  });
  if(found.length!==1)throw new Error('Expected one mesh in original glacial GLB');
  return found;
}
export function renderGlacialBedrock(cliffs,parent,{quality='high',load=localGLB}={}){
  const group=new THREE.Group();
  group.name='glacial-granite-landmarks';
  group.userData.visualOnly=true;
  parent.add(group);
  const q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3(),m=new THREE.Matrix4(),axis=new THREE.Vector3(0,1,0);
  const stats={planned:cliffs?.length??0,loaded:0,meshes:0,drawCalls:0,triangles:0,
    failed:[],ready:false,quality};
  let disposed=false;
  const groups=new Map();
  for(const site of cliffs??[]){
    if(!groups.has(site.kind))groups.set(site.kind,[]);
    groups.get(site.kind).push(site);
  }
  const jobs=[...groups].map(async ([kind,sites])=>{
    try{
      const assetParts=parts(await load(kind,quality));
      if(disposed)return;
      for(const part of assetParts){
        const mesh=new THREE.InstancedMesh(part.geometry,part.material,sites.length);
        for(const [i,site] of sites.entries()){
          q.setFromAxisAngle(axis,site.ry);
          p.set(site.center.x,0,site.center.z);
          const scale=site.scale??1;s.setScalar(scale);
          m.compose(p,q,s).multiply(part.transform);
          mesh.setMatrixAt(i,m);
        }
        mesh.instanceMatrix.needsUpdate=true;
        mesh.computeBoundingSphere();
        mesh.castShadow=quality==='high'&&sites.length<=2;
        mesh.receiveShadow=true;
        mesh.name='glacial-bedrock-'+kind;
        mesh.userData.visualOnly=true;
        group.add(mesh);
        stats.meshes++;stats.drawCalls++;
        stats.triangles+=((part.geometry.index?.count??part.geometry.attributes.position.count)/3)*sites.length;
      }
      stats.loaded+=sites.length;
    }catch(error){
      stats.failed.push({kind,error:String(error?.message??error)});
      console.warn('[glacial-bedrock]',kind,error);
    }
  });
  const ready=Promise.all(jobs).then(()=>{stats.ready=true;return stats;});
  return {group,stats,ready,dispose(){
    if(disposed)return;disposed=true;
    for(const obj of group.children)obj.dispose?.(); // instance GPU data; cached GLB mesh remains shared
    group.clear();parent.remove(group);
  }};
}
