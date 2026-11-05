// ?props=1 preview renderer: one InstancedMesh per asset, no colliders, no shadows on LOW.
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {placeArchipelagoProps} from './props-placement.mjs?v=2.28.0';
const BASE=new URL('../assets/env/',import.meta.url);
const DIRS={ground:'nature/',shore:'shore/',foam:'shore/',rock:'nature/rocks/'};
const cache=new Map();
function load(dir,name){
  const key=dir+name;
  if(!cache.has(key))cache.set(key,new Promise((resolve,reject)=>new GLTFLoader().load(new URL(dir+name+'.glb',BASE).href,g=>{
    let mesh=null;g.scene.traverse(n=>{if(n.isMesh&&!mesh)mesh=n;});
    if(!mesh)return reject(new Error('no mesh '+name));
    // COLOR_0.a is the wind weight (README contract), never transparency.
    mesh.material=mesh.material.clone();
    mesh.material.transparent=false;mesh.material.alphaTest=0;
    // Preview-only palette correction until the source GLBs are re-exported.
    // Old rock atlas is purple/pink and grass atlas plus baked AO reads nearly black.
    if(dir==='nature/rocks/'||name==='shore_rock_edge_4m'){
      mesh.material.map=null;mesh.material.vertexColors=false;
      mesh.material.color.setRGB(.53,.58,.60);
      mesh.material.roughness=1;
    }else if(name.startsWith('grass_tuft_')||name==='heather_tuft_a'){
      mesh.material.map=null;mesh.material.vertexColors=false;
      mesh.material.color.setRGB(.48,.69,.33);
      mesh.material.roughness=1;
    }else if(name.startsWith('pebble_granite_')){
      mesh.material.map=null;mesh.material.vertexColors=false;
      mesh.material.color.setRGB(.51,.57,.59);
      mesh.material.roughness=1;
    }else if(name==='lichen_patch_a'){
      mesh.material.map=null;mesh.material.vertexColors=false;
      mesh.material.color.setRGB(.55,.61,.55);
      mesh.material.roughness=1;
    }
    resolve({geometry:mesh.geometry,material:mesh.material});
  },undefined,reject)));
  return cache.get(key);
}
export function propsPreviewEnabled(search){return new URLSearchParams(search).get('props')==='1';}
export function addPropsPreview(level,scene,{profile='high'}={}){
  const group=new THREE.Group();group.name='props-preview';scene.add(group);
  const items=placeArchipelagoProps(level,{profile});
  const by=new Map();for(const it of items){const k=DIRS[it.kind]+it.asset;if(!by.has(k))by.set(k,[]);by.get(k).push(it);}
  const stats={profile,instances:items.length,meshes:0,ready:false,error:null};
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),sc=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const ready=Promise.all([...by].map(async([k,list])=>{
    const dir=DIRS[list[0].kind];
    const {geometry,material}=await load(dir,list[0].asset);
    if(!group.parent)return;
    const im=new THREE.InstancedMesh(geometry,material,list.length);
    list.forEach((it,i)=>{q.setFromAxisAngle(up,it.ry);pos.set(it.x,it.y,it.z);
      if(it.kind==='foam')sc.set(it.s,1,1);else sc.setScalar(it.s);
      im.setMatrixAt(i,m.compose(pos,q,sc));});
    im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();
    im.castShadow=profile==='high'&&list[0].kind==='rock';im.receiveShadow=false;
    im.name='props-'+list[0].asset;im.userData.visualOnly=true;
    group.add(im);stats.meshes++;
  })).then(()=>{stats.ready=true;console.log('[props-preview]',JSON.stringify(stats));})
    .catch(e=>{stats.error=String(e);console.error('[props-preview] failed',e);});
  return {group,stats,ready,dispose(){scene.remove(group);group.clear();}};
}
