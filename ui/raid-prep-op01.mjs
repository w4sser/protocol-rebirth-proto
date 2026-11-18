/**
 * Protocol Rebirth — authored OP-01 Deploy operator.
 *
 * Unlike the previous procedural V4, this loads the actual Blender/TRELLIS 2
 * authored glTF mesh: 1.78m tall, +Y up, -Z back, embedded PBR textures.
 * Character, coat, gear and backpack stay separate in the scene graph.
 *
 * Mobile (68,072 triangles / 3.62 MB) is default. Hero (247,895 triangles)
 * is opt-in with ?opQuality=hero; it is not automatically used on iPhones.
 *
 * A rig is not present. Rotation is handled by the parent orbit in
 * raid-prep-scene.mjs; do NOT apply gameplay animation clips to the model.
 */
import * as THREE from '../nodspel/vendor/three.module.js';
import {GLTFLoader} from '../nodspel/vendor/GLTFLoader.js';

export const OP01_PATHS=Object.freeze({
  mobile:'../assets/operators/OP01_Mobile.glb',
  hero:'../assets/operators/OP01_Hero.glb'
});
const EXPECTED_HEIGHT=1.78;
const KNOWN_MATERIALS=new Set(['OP01_PackShell','OP01_PackPanel','OP01_CyanLight','OP01_Mat']);
const REQUIRED_PARTS=['Backpack','Body','Coat','Gear'];

function prepMaterials(mesh,maxAnisotropy){
  mesh.frustumCulled=true;
  mesh.castShadow=false; // No heavy shadow map in the menu.
  mesh.receiveShadow=false;
  for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    if(!mat)return;
    // Keep the source Blender PBR colors and baked texture gradients. Do not
    // recolor them or apply the old procedural "darkening" filters.
    if(mat.map){mat.map.colorSpace=THREE.SRGBColorSpace;mat.map.anisotropy=Math.min(8,maxAnisotropy);}
    if(mat.normalMap)mat.normalMap.anisotropy=Math.min(8,maxAnisotropy);
    // Preserve approved cyan trim on the OP01_Gear / backpack only.
    if(mat.name==='OP01_CyanLight')mat.toneMapped=true;
  }
}

export async function loadOP01Operator({quality='mobile',maxAnisotropy=4}={}){
  const chosen=quality==='hero'?'hero':'mobile';
  const url=new URL(OP01_PATHS[chosen],import.meta.url).href;
  const gltf=await new GLTFLoader().loadAsync(url);
  if(!gltf.scene)throw new Error('OP01 GLB has no scene');
  const parts=new Set();
  const root=new THREE.Group();root.name='OP01-authored-3D-operator';
  root.add(gltf.scene);
  gltf.scene.traverse(node=>{
    const name=String(node.name||'');
    const match=REQUIRED_PARTS.find(x=>name.includes(x));
    if(match)parts.add(match);
    if(node.isMesh)prepMaterials(node,maxAnisotropy);
  });
  if(REQUIRED_PARTS.some(x=>!parts.has(x)))throw new Error('OP01 is missing one or more authored submeshes');
  let bbox=new THREE.Box3().setFromObject(root);
  const height=bbox.max.y-bbox.min.y;
  if(!Number.isFinite(height)||height<.5||height>4)throw new Error('OP01 GLB has invalid scale');
  // Authoring target is 1.78 meters with feet at y=0. Normalize small Blender
  // drift to avoid floating feet while preserving anatomy (no nonuniform scale).
  const factor=EXPECTED_HEIGHT/height;
  gltf.scene.scale.multiplyScalar(factor);
  bbox=new THREE.Box3().setFromObject(root);
  const center=bbox.getCenter(new THREE.Vector3());
  gltf.scene.position.set(-center.x,-bbox.min.y,-center.z);
  root.userData.source='OP01';
  root.userData.quality=chosen;
  root.userData.triangles=chosen==='hero'?247895:68072;
  let elapsed=0;
  return {
    root,quality:chosen,source:'glb',url,
    update(dt,reduced=false){
      if(reduced)return;
      // No fake breathing/limb deformation on an unrigged mesh; just a tiny
      // stance adjustment across the full physical mesh.
      elapsed+=Math.min(.05,dt);
      root.rotation.z=Math.sin(elapsed*.56)*.0016;
    }
  };
}
