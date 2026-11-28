/* Deploy portrait: independent true-3D operator and BIT. The menu uses
 * higher-detail character geometry than the small top-down raid GLB.
 * Drag rotates the operator; gameplay animation must never cancel this yaw.
 */
import * as THREE from '../nodspel/vendor/three.module.js';
import {createMenuBit} from './raid-prep-models.mjs?v=2.28.84';
import {createOperatorHeroV4} from './raid-prep-operator-v4.mjs?v=2.28.84';
import {loadOP01Operator} from './raid-prep-op01.mjs?v=2.28.84-hero-stage';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// BIT belongs behind OP-01, not in the foreground. Camera is on +Z;
// negative Z places the companion farther from the camera. Keep the face
// slightly outside the operator's left shoulder silhouette at mobile size.
const BIT_DEPLOY_LAYOUT=Object.freeze({
  scale:.56,
  x:-.74,y:1.58,z:-.70,
  facingYaw:.14,
  bobAmplitude:.014,bobSpeed:1.10,
  rollAmplitude:.010,rollSpeed:.76
});

export async function mountRaidPrepScene(host){
  if(!host?.isConnected)return null;
  let renderer=null,scene=null,camera=null,observer=null,raf=0,disposed=false;
  let orbit=null,operator=null,bit=null,drag=null,requestedModel='mobile';
  // Approved hero-stage target: face mostly toward the viewer while keeping
  // both hands and the rifle readable. Rotation still starts from this angle.
  let yaw=.10,clock=0,previous=0;
  const showYaw=()=>{host.dataset.rotation=String(Math.round(yaw*1000)/1000);};
  function down(e){
    if(e.pointerType==='mouse'&&e.button!==0)return;
    if(drag)return;
    drag={id:e.pointerId,x:e.clientX};
    e.preventDefault();e.stopPropagation();
    try{host.setPointerCapture(e.pointerId);}catch(_){}
    host.classList.add('is-rotating');
  }
  function move(e){
    if(!drag||e.pointerId!==drag.id)return;
    yaw+=(e.clientX-drag.x)*.012;drag.x=e.clientX;
    // Rotate the real meshes, not the gameplay rig: previous implementation
    // called operator.update() and cancelled parent rotation every frame.
    if(orbit)orbit.rotation.y=yaw;
    showYaw();e.preventDefault();e.stopPropagation();
  }
  function up(e){
    if(!drag||e.pointerId!==drag.id)return;
    drag=null;
    host.classList.remove('is-rotating');
    try{host.releasePointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();e.stopPropagation();
  }
  function key(e){
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    yaw+=e.key==='ArrowLeft'?-.25:.25;
    if(orbit)orbit.rotation.y=yaw;
    showYaw();e.preventDefault();e.stopPropagation();
  }
  function dispose(){
    if(disposed)return;disposed=true;
    if(raf)cancelAnimationFrame(raf);
    observer?.disconnect();
    for(const [event,fn]of [['pointerdown',down],['pointermove',move],
      ['pointerup',up],['pointercancel',up],['keydown',key]])host.removeEventListener(event,fn);
    host.classList.remove('is-rotating');
    host.closest('.lobby-hero')?.classList.remove('has-3d');
    delete host.dataset.menuModel;delete host.dataset.bit;delete host.dataset.rotation;delete host.dataset.presentation;
    if(scene){
      const geometries=new Set(),materials=new Set(),textures=new Set();
      scene.traverse(n=>{
        if(!n.isMesh)return;
        if(n.geometry)geometries.add(n.geometry);
        for(const m of Array.isArray(n.material)?n.material:[n.material]){
          if(!m)continue;materials.add(m);
          if(m.map)textures.add(m.map);
          if(m.normalMap)textures.add(m.normalMap);
        }
      });
      textures.forEach(t=>t.dispose());
      geometries.forEach(g=>g.dispose());
      materials.forEach(m=>m.dispose());
    }
    if(renderer){renderer.dispose();renderer.forceContextLoss?.();renderer.domElement.remove();}
  }
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
    renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.35;
    host.appendChild(renderer.domElement);
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(33,1,.05,30);
    camera.position.set(.05,1.4,4.25);camera.lookAt(0,1.215,0);
    scene.add(new THREE.HemisphereLight(0xd5d3dd,0x2d2927,2.1));
    const keyLight=new THREE.DirectionalLight(0xffc99c,2.6);
    keyLight.position.set(-2,4,4);scene.add(keyLight);
    const rimLight=new THREE.DirectionalLight(0xb8a3d2,2.2);
    rimLight.position.set(3,3,-3);scene.add(rimLight);
    const fill=new THREE.DirectionalLight(0xb6c7c5,.8);
    fill.position.set(1,1,4);scene.add(fill);

    orbit=new THREE.Group();orbit.name='touch-rotatable-operator';
    orbit.rotation.y=yaw;scene.add(orbit);
    // Use the new rigged OP01_Menu.glb with low-ready rifle pose when present.
    // Release remains safe while asset bytes are being staged: the existing
    // V4 is a real 3D fallback for missing/corrupt GLBs, not a static image.
    requestedModel=new URLSearchParams(location.search).get('opQuality')==='source-hero'?'source-hero':'menu';
    try{
      operator=await loadOP01Operator({
        quality:requestedModel,
        maxAnisotropy:renderer.capabilities.getMaxAnisotropy()
      });
    }catch(err){
      console.warn('Authored OP-01 GLB unavailable; using procedural 3D fallback:',err?.message||err);
      if(!host.isConnected||disposed){dispose();return null;}
      operator=createOperatorHeroV4({weaponId:host.dataset.weapon||'',armorId:host.dataset.armor||''});
    }
    if(!host.isConnected||disposed){dispose();return null;}
    orbit.add(operator.root);
    // Genuine three-dimensional companion; its original approved smile is
    // rendered on the physical CRT face, never as a full-body billboard.
    bit=createMenuBit();
    bit.scale.setScalar(BIT_DEPLOY_LAYOUT.scale);
    bit.position.set(BIT_DEPLOY_LAYOUT.x,BIT_DEPLOY_LAYOUT.y,BIT_DEPLOY_LAYOUT.z);
    bit.rotation.y=BIT_DEPLOY_LAYOUT.facingYaw;
    scene.add(bit);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(.65,32),
      new THREE.MeshBasicMaterial({color:0x070e12,transparent:true,opacity:.14,depthWrite:false}));
    floor.rotation.x=-Math.PI/2;floor.position.y=.008;scene.add(floor);

    for(const [event,fn]of [['pointerdown',down],['pointermove',move],
      ['pointerup',up],['pointercancel',up],['keydown',key]])host.addEventListener(event,fn);
    host.style.touchAction='none';
    host.dataset.menuModel=operator.source==='glb'?'op01-'+operator.quality:'hero-v4';host.dataset.bit='3d';showYaw();
    const fit=()=>{
      if(disposed||!host.isConnected)return;
      const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
      camera.aspect=w/h;
      // Authored OP-01 is 1.78m tall; V4 fallback is taller. Both fit
      // completely into an 844x390 landscape panel without cropping.
      const isAuthored=operator?.source==='glb';
      const distance=isAuthored
        ?clamp(3.13+Math.max(0,.95-camera.aspect)*.65,3.13,4.0)
        :clamp(3.95+Math.max(0,.95-camera.aspect)*.75,3.95,4.85);
      camera.position.set(.06,isAuthored?1.16:1.40,distance);
      camera.lookAt(0,isAuthored?.93:1.215,0);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(clamp(window.devicePixelRatio||1,1,w>850?2:2.4));
      renderer.setSize(w,h,false);
    };
    if(typeof ResizeObserver==='function'){observer=new ResizeObserver(fit);observer.observe(host);}
    fit();
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
    const bitY=bit.position.y;
    const frame=t=>{
      if(disposed)return;
      if(!host.isConnected||document.body?.dataset?.screen!=='prep'){dispose();return;}
      raf=requestAnimationFrame(frame);
      if(document.hidden||!host.clientWidth||!host.clientHeight)return;
      const dt=previous?Math.min(.06,(t-previous)/1000):.016;previous=t;clock+=dt;
      operator.update(dt,reduced);
      if(!reduced){
        bit.position.y=bitY+Math.sin(clock*BIT_DEPLOY_LAYOUT.bobSpeed)*BIT_DEPLOY_LAYOUT.bobAmplitude;
        bit.rotation.z=Math.sin(clock*BIT_DEPLOY_LAYOUT.rollSpeed)*BIT_DEPLOY_LAYOUT.rollAmplitude;
      }
      renderer.render(scene,camera);
    };
    // Never reveal an empty canvas or an unrendered operator. Paint the
    // complete first 3D frame before exposing the stage; PNG remains hidden.
    operator.update(0,reduced);
    renderer.render(scene,camera);
    host.dataset.presentation='ready';
    host.closest('.lobby-hero')?.classList.add('has-3d');
    raf=requestAnimationFrame(frame);
    return {dispose,getRotation:()=>yaw};
  }catch(error){
    console.warn('Cinematic 3D preview unavailable:',error);
    dispose();return null;
  }
}
