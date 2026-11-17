/* Deploy portrait: independent true-3D operator and BIT. The menu uses
 * higher-detail character geometry than the small top-down raid GLB.
 * Drag rotates the operator; gameplay animation must never cancel this yaw.
 */
import * as THREE from '../nodspel/vendor/three.module.js';
import {createMenuOperator,createMenuBit} from './raid-prep-models.mjs?v=2.28.46';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export async function mountRaidPrepScene(host){
  if(!host?.isConnected)return null;
  let renderer=null,scene=null,camera=null,observer=null,raf=0,disposed=false;
  let orbit=null,operator=null,bit=null,drag=null;
  let yaw=-.23,clock=0,previous=0;
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
    delete host.dataset.menuModel;delete host.dataset.bit;delete host.dataset.rotation;
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
    camera.position.set(.05,1.3,3.6);camera.lookAt(0,1.075,0);
    scene.add(new THREE.HemisphereLight(0xd5d3dd,0x2d2927,2.1));
    const keyLight=new THREE.DirectionalLight(0xffc99c,2.6);
    keyLight.position.set(-2,4,4);scene.add(keyLight);
    const rimLight=new THREE.DirectionalLight(0xb8a3d2,2.2);
    rimLight.position.set(3,3,-3);scene.add(rimLight);
    const fill=new THREE.DirectionalLight(0xb6c7c5,.8);
    fill.position.set(1,1,4);scene.add(fill);

    orbit=new THREE.Group();orbit.name='touch-rotatable-operator';
    orbit.rotation.y=yaw;scene.add(orbit);
    operator=createMenuOperator({weaponId:host.dataset.weapon||'',armorId:host.dataset.armor||''});
    orbit.add(operator.root);
    // Genuine three-dimensional companion; its original approved smile is
    // rendered on the physical CRT face, never as a full-body billboard.
    bit=createMenuBit();bit.scale.setScalar(.78);bit.position.set(-.93,1.70,.27);
    bit.rotation.y=.14;scene.add(bit);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(.65,32),
      new THREE.MeshBasicMaterial({color:0x070e12,transparent:true,opacity:.14,depthWrite:false}));
    floor.rotation.x=-Math.PI/2;floor.position.y=.008;scene.add(floor);

    for(const [event,fn]of [['pointerdown',down],['pointermove',move],
      ['pointerup',up],['pointercancel',up],['keydown',key]])host.addEventListener(event,fn);
    host.style.touchAction='none';
    host.dataset.menuModel='high';host.dataset.bit='3d';showYaw();
    const fit=()=>{
      if(disposed||!host.isConnected)return;
      const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
      camera.aspect=w/h;
      const distance=clamp(3.17+Math.max(0,.95-camera.aspect)*.65,3.12,4.0);
      camera.position.set(.06,1.28,distance);camera.lookAt(0,1.075,0);
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
      if(!reduced){bit.position.y=bitY+Math.sin(clock*1.6)*.026;bit.rotation.z=Math.sin(clock*.95)*.025;}
      renderer.render(scene,camera);
    };
    host.closest('.lobby-hero')?.classList.add('has-3d');
    raf=requestAnimationFrame(frame);
    return {dispose,getRotation:()=>yaw};
  }catch(error){
    console.warn('Cinematic 3D preview unavailable:',error);
    dispose();return null;
  }
}
