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
let menuBytesPromise=null, warmMenuPromise=null;
// Cache validated raw bytes: changing loadout reuses them without new requests.
// Preparse just one menu scene in the bunker so the first Deploy can render at
// once. The ready scene is consumed once, since sharing live skinned meshes
// between two simultaneous canvases would corrupt the bone hierarchy.
function menuBytes(url){
  if(!menuBytesPromise)menuBytesPromise=Promise.all(MENU_PARTS.map(async index=>{
    const response=await fetch(url+'.part'+index);
    if(!response.ok)throw new Error('OP01 Menu part '+index+' failed: HTTP '+response.status);
    return new Uint8Array(await response.arrayBuffer());
  })).then(pieces=>{
    const total=pieces.reduce((n,p)=>n+p.byteLength,0);
    if(total!==5821928)throw new Error('OP01 Menu GLB size mismatch: '+total);
    const bytes=new Uint8Array(total);
    let offset=0;
    for(const part of pieces){bytes.set(part,offset);offset+=part.byteLength;}
    const header=new DataView(bytes.buffer,0,12);
    if(header.getUint32(0,true)!==0x46546c67 || header.getUint32(4,true)!==2 ||
        header.getUint32(8,true)!==total)
      throw new Error('OP01 Menu parts do not reconstruct a valid glTF 2.0 GLB');
    return bytes;
  }).catch(err=>{menuBytesPromise=null;throw err;});
  return menuBytesPromise;
}
export function preloadOP01Menu(){
  if(!warmMenuPromise){
    const url=new URL(OP01_PATHS.menu,import.meta.url).href;
    const loader=new GLTFLoader();
    warmMenuPromise=menuBytes(url)
      .then(bytes=>loader.parseAsync(bytes.buffer,new URL('.',url).href))
      .catch(err=>{warmMenuPromise=null;throw err;});
  }
  return warmMenuPromise;
}
async function loadRiggedMenu(loader,url){
  // Take ownership of the warmed glTF synchronously. In-flight navigations
  // cannot accidentally attach the same SkinnedMesh to different scenes.
  const warmed=warmMenuPromise;
  warmMenuPromise=null;
  if(warmed)return warmed;
  const bytes=await menuBytes(url);
  return loader.parseAsync(bytes.buffer,new URL('.',url).href);
}


/**
 * Keep OP01's authored standing hips/legs, but use the rifle-ready upper-body
 * animation for both shoulders, forearms and fingers. The old hero_pose
 * puts the off-hand palm-up and the barrel vertically in front of the face.
 * DO NOT rotate the rifle independently of its right-hand attachment: that
 * would leave the support hand floating and break subsequent animation reuse.
 */
export function createOP01DeployGrip(gltf){
  const {scene,animations}=gltf;
  const hero=animations.find(a=>a.name==='hero_pose');
  const aim=animations.find(a=>a.name==='aim');
  if(!hero||!aim)throw new Error('OP01 deploy needs hero_pose and aim');
  const spine=(()=>{
    let node=null;
    scene.traverse(n=>{
      if(!node&&(n.name==='mixamorig:Spine'||n.userData?.name==='mixamorig:Spine'))node=n;
    });
    return node;
  })();
  if(!spine)throw new Error('OP01 deploy missing upper-body rig');

  const upperNames=new Set();
  spine.traverse(n=>{upperNames.add(n.name);if(n.userData?.name)upperNames.add(n.userData.name);});
  const upperTrack=t=>upperNames.has(t.name.split('.')[0]);
  const lowerTracks=hero.tracks.filter(t=>!upperTrack(t));
  const upperTracks=aim.tracks.filter(upperTrack);
  if(lowerTracks.length<2||upperTracks.length<10)
    throw new Error('OP01 deploy lacks independent standing/aiming rig tracks');

  // Sample one still stance, then keep it frozen so the page animation tick
  // never returns to the awkward palms-up one-frame hero pose.
  const mixer=new THREE.AnimationMixer(scene);
  const stand=mixer.clipAction(new THREE.AnimationClip('deploy-standing-legs',hero.duration,lowerTracks));
  const grip=mixer.clipAction(new THREE.AnimationClip('deploy-two-hand-rifle-grip',aim.duration,upperTracks));
  for(const action of [stand,grip]){
    action.setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;
    action.play();
  }
  mixer.update(Math.max(.001,Math.min(aim.duration*.5,aim.duration-.0001)));
  stand.paused=true;
  grip.paused=true;
  // The authored aim clip keeps the muzzle at eye level. For the Deploy hero
  // stage, move both arms and the hand-attached rifle as ONE unit into a
  // relaxed low-ready pose; rotating the weapon alone breaks the support grip.
  // This pivot is menu-only and leaves gameplay animations untouched.
  const named=name=>{
    let result=null;
    scene.traverse(n=>{if(!result&&(n.name===name||n.userData?.name===name))result=n;});
    return result;
  };
  const left=named('mixamorig:LeftShoulder');
  const right=named('mixamorig:RightShoulder');
  const chest=named('mixamorig:Spine2')||named('mixamorig:Spine1')||spine;
  if(!left||!right)throw new Error('OP01 deploy missing shoulder rig');
  scene.updateMatrixWorld(true);
  const center=left.getWorldPosition(new THREE.Vector3());
  center.add(right.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
  chest.worldToLocal(center);
  const lowReady=new THREE.Group();
  lowReady.name='deploy-low-ready-shoulder-pivot';
  lowReady.position.copy(center);
  chest.add(lowReady);
  lowReady.attach(left);
  lowReady.attach(right);
  // Drop the barrel across the chest rather than pointing straight at a
  // target, while keeping the hood upright and both gloved hands in place.
  lowReady.rotation.z=-.42;
  lowReady.position.y-=.085;
  scene.updateMatrixWorld(true);
  return {mixer,stand,grip,lowReady,upperTracks:upperTracks.length,lowerTracks:lowerTracks.length};
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
    // Keep the authored menu lower-body pose, with both weapon hands from
    // the matched rifle-ready aim clip rather than the disconnected hero pose.
    const deployGrip=createOP01DeployGrip(gltf);
    mixer=deployGrip.mixer;
    pose=deployGrip.grip;
  }
  root.userData.source='OP01';
  root.userData.quality=chosen;
  root.userData.clip=rigged?'hero_pose+aim_two_hand_grip':'none';
  root.userData.triangles=chosen==='menu'?68417:chosen==='sourceHero'?247895:68072;
  let elapsed=0;
  return {
    root,model:gltf.scene,mixer,quality:chosen,source:'glb',url,animation:root.userData.clip,
    update(dt,reduced=false){
      // Both frozen rig actions retain the two-hand ready stance.
      if(mixer)mixer.update(Math.min(.06,Math.max(0,dt)));
      if(reduced)return;
      elapsed+=Math.min(.05,dt);
      root.rotation.z=Math.sin(elapsed*.55)*.0014;
    }
  };
}
