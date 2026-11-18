/**
 * OP-01 authored operator for the cinematic Deploy portrait.
 *
 * New rigged source: OP01_Menu.glb, with a real carbine and Mixamo clips.
 * The underlying skeleton, coat, weapon and materials are identical to the
 * gameplay LODs but have higher resolution than a normal raid presentation.
 * Preserve the old still-pose models as an explicit diagnostic fallback only.
 */
import * as THREE from '../nodspel/vendor/three.module.js';
import {GLTFLoader} from '../nodspel/vendor/GLTFLoader.js';

export const OP01_PATHS=Object.freeze({
  menu:'../assets/operators/OP01_Menu.glb',
  sourceMobile:'../assets/operators/OP01_Mobile.glb',
  sourceHero:'../assets/operators/OP01_Hero.glb'
});
const EXPECTED_HEIGHT=1.78;
const REQUIRED_CLIPS=['hero_pose','idle','run','aim','shoot','hit','dash','death'];

// GitHub's binary upload bridge has a ~4MB request ceiling. The untouched
// 5.8MB menu GLB is committed as three byte-exact chunks (~1.94MB each).
// Recombine in memory before GLTFLoader parses it; the browser still renders
// the ORIGINAL full-quality 68K-triangle model and all its animations.
const MENU_PARTS=Object.freeze([0,1,2]);
async function loadRiggedMenu(loader,url){
  const pieces=await Promise.all(MENU_PARTS.map(async index=>{
    const response=await fetch(url+'.part'+index);
    if(!response.ok)throw new Error('OP01 Menu part '+index+' failed: HTTP '+response.status);
    return new Uint8Array(await response.arrayBuffer());
  }));
  const total=pieces.reduce((n,p)=>n+p.byteLength,0);
  if(total!==5821928)throw new Error('OP01 Menu GLB size mismatch: '+total);
  const bytes=new Uint8Array(total);
  let offset=0;
  for(const part of pieces){bytes.set(part,offset);offset+=part.byteLength;}
  const header=new DataView(bytes.buffer,0,12);
  if(header.getUint32(0,true)!==0x46546c67 || header.getUint32(4,true)!==2 ||
      header.getUint32(8,true)!==total)
    throw new Error('OP01 Menu parts do not reconstruct a valid glTF 2.0 GLB');
  return loader.parseAsync(bytes.buffer,new URL('.',url).href);
}


function prepMaterials(mesh,maxAnisotropy){
  mesh.frustumCulled=false;
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    if(!material)return;
    // Respect artist-authored PBR, emissive and roughness channels.
    if(material.map){material.map.colorSpace=THREE.SRGBColorSpace;material.map.anisotropy=Math.min(8,maxAnisotropy);}
    if(material.normalMap)material.normalMap.anisotropy=Math.min(8,maxAnisotropy);
  }
}

export async function loadOP01Operator({quality='menu',maxAnisotropy=4}={}){
  // "source-hero" is a comparison-only still model; the default is the NEW
  // rigged, be-weaponed OP01_Menu.glb even on iPhones.
  const chosen=quality==='source-hero'?'sourceHero':quality==='source-mobile'?'sourceMobile':'menu';
  const url=new URL(OP01_PATHS[chosen],import.meta.url).href;
  const loader=new GLTFLoader();
  const gltf=chosen==='menu'?await loadRiggedMenu(loader,url):await loader.loadAsync(url);
  if(!gltf.scene)throw new Error('OP01 GLB has no scene');
  const rigged=chosen==='menu';
  if(rigged){
    const clips=new Set(gltf.animations.map(a=>a.name));
    for(const clip of REQUIRED_CLIPS)if(!clips.has(clip))throw new Error('OP01 is missing '+clip);
    // GLTFLoader sanitizes punctuation in bone names (mixamorig:Hips).
    // Preserve Blender's original names in userData.name when matching.
    const named=name=>{
      let found=null;
      gltf.scene.traverse(node=>{
        if(!found&&(node.name===name||node.userData?.name===name))found=node;
      });
      return found;
    };
    if(!named('mixamorig:Hips') ||
       !named('OP01_Carbine') ||
       !named('OP01_Rig'))
      throw new Error('OP01 Menu is missing its skeleton or attached rifle');
  }
  const root=new THREE.Group();
  root.name='OP01-authored-3D-operator';
  root.add(gltf.scene);
  gltf.scene.traverse(node=>{if(node.isMesh)prepMaterials(node,maxAnisotropy);});

  // The mesh was authored at 1.78 m with the feet at Y=0. Measure the full
  // character, then center and align its feet *without* nonuniform scaling.
  gltf.scene.updateMatrixWorld(true);
  let bounds=new THREE.Box3().setFromObject(root);
  const height=bounds.max.y-bounds.min.y;
  if(!Number.isFinite(height)||height<.5||height>4)throw new Error('OP01 GLB has invalid scale');
  gltf.scene.scale.multiplyScalar(EXPECTED_HEIGHT/height);
  gltf.scene.updateMatrixWorld(true);
  bounds=new THREE.Box3().setFromObject(root);
  const center=bounds.getCenter(new THREE.Vector3());
  gltf.scene.position.set(-center.x,-bounds.min.y,-center.z);

  let mixer=null,pose=null;
  if(rigged){
    mixer=new THREE.AnimationMixer(gltf.scene);
    pose=mixer.clipAction(gltf.animations.find(clip=>clip.name==='hero_pose'));
    pose.setLoop(THREE.LoopOnce,1);
    pose.clampWhenFinished=true;
    pose.play();
    // One-frame animation: sample the authored low-ready pose immediately.
    mixer.update(pose.getClip().duration+.00001);
  }
  root.userData.source='OP01';
  root.userData.quality=chosen;
  root.userData.clip=rigged?'hero_pose':'none';
  root.userData.triangles=chosen==='menu'?68417:chosen==='sourceHero'?247895:68072;
  let elapsed=0;
  return {
    root,model:gltf.scene,mixer,quality:chosen,source:'glb',url,animation:root.userData.clip,
    update(dt,reduced=false){
      // hero_pose is clamped, not silently reset to the bind / A-pose.
      if(mixer)mixer.update(Math.min(.06,Math.max(0,dt)));
      if(reduced)return;
      elapsed+=Math.min(.05,dt);
      root.rotation.z=Math.sin(elapsed*.55)*.0014;
    }
  };
}
