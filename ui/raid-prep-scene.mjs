/* Protocol Rebirth Raid Prep 3D viewer.
 * Uses the same GLB, rig, idle clip and equipment socket as Node Raid.
 * Lazy-loaded on the prep screen; no scene, WebGL context or animation remains after leaving.
 */
import * as THREE from '../nodspel/vendor/three.module.js';
import {loadHumanOperator} from '../nodspel/operator.js?v=2.28.46';

const COLOR={cyan:0x75cfcc,amber:0xffb35c,rust:0x654d40,steel:0x334044,screen:0x101b22};
const mat=(color,metalness=.18,roughness=.8)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
function part(parent,name,geo,material,x=0,y=0,z=0){
  const o=new THREE.Mesh(geo,material);o.name=name;o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;
}
function createBit(){
  const root=new THREE.Group();root.name='BIT';
  const worn=mat(COLOR.rust,.48,.72),sides=mat(0x8c6547,.32,.85),
    trim=mat(COLOR.steel,.58,.58),black=mat(COLOR.screen,.05,.94);
  const faceMat=new THREE.MeshBasicMaterial({color:COLOR.cyan,toneMapped:false});
  const amberMat=new THREE.MeshBasicMaterial({color:COLOR.amber,toneMapped:false});
  const blackScreen=new THREE.MeshStandardMaterial({color:0x0d1a1d,roughness:.37,metalness:.18});
  const box=(p,name,x,y,z,w,h,d,m)=>part(p,name,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  box(root,'CRT housing',0,0,0,.54,.45,.43,worn);
  box(root,'worn top',0,.216,0,.51,.038,.40,sides);
  for(const x of [-.255,.255]){
    box(root,'side armor',x,.01,0,.044,.35,.44,trim);
    for(const y of [-.145,.14])box(root,'corner bolt',x,y,.23,.062,.055,.03,sides);
  }
  // A recessed screen: all cyan emission stays inside the glass.
  box(root,'CRT bezel',0,.02,.233,.423,.305,.03,black);
  box(root,'CRT glass',0,.02,.256,.348,.239,.012,blackScreen);
  // Two restrained oval eyes and a very short, neutral mouth (no kawaii expression).
  for(const x of [-.089,.089]){
    const eye=part(root,'eye',new THREE.SphereGeometry(.032,12,8),faceMat,x,.055,.268);
    eye.scale.set(.79,1.27,.19);
  }
  box(root,'mouth',0,-.064,.269,.075,.013,.008,faceMat);
  box(root,'amber lamp mount',.31,.065,.035,.10,.17,.14,trim);
  const lamp=part(root,'amber side lamp',new THREE.SphereGeometry(.052,12,9),amberMat,.37,.068,.035);
  lamp.scale.set(.9,1.15,.95);
  box(root,'antenna socket',-.12,.245,-.07,.075,.08,.075,trim);
  const rod=part(root,'antenna',new THREE.CylinderGeometry(.010,.017,.27,6),trim,-.12,.407,-.07);
  rod.rotation.z=-.11;
  part(root,'antenna tip',new THREE.SphereGeometry(.022,8,6),sides,-.151,.538,-.07);
  box(root,'thruster assembly',0,-.255,-.05,.33,.09,.24,trim);
  for(const x of [-.12,.12]){
    const nozzle=part(root,'thruster nozzle',new THREE.CylinderGeometry(.068,.045,.095,8),black,x,-.318,-.07);
    nozzle.rotation.z=.08;
  }
  // No blue/cyan thruster trail: cyan is only for BIT's CRT face.
  const lampLight=new THREE.PointLight(COLOR.amber,.32,1.3,2);lampLight.position.set(.43,.06,.12);root.add(lampLight);
  return root;
}
function stylizeWeapon(root,weaponId){
  if(!root)return;
  // Use the actual gameplay weapon socket/meshes; resize its silhouette for the
  // selected weapon family until distinct weapon GLBs are authored.
  const s=String(weaponId||'').toLowerCase();
  if(s.includes('shotgun'))root.scale.set(1.18,1.14,1.07);
  else if(s.includes('marksman')||s.includes('sniper'))root.scale.set(.94,.95,1.36);
  else if(s.includes('smg'))root.scale.set(.89,.94,.74);
  else root.scale.set(1,1,1);
}
export async function mountRaidPrepScene(host){
  if(!host || !host.isConnected)return null;
  let renderer=null,operator=null,scene=null,resize=null,raf=0,disposed=false;
  const destroy=()=>{
    if(disposed)return;
    disposed=true;
    if(raf)cancelAnimationFrame(raf);
    if(resize)resize.disconnect();
    host.removeEventListener('pointerdown',startDrag);
    host.removeEventListener('pointermove',moveDrag);
    host.removeEventListener('pointerup',endDrag);
    host.removeEventListener('pointercancel',endDrag);
    host.removeEventListener('keydown',onKey);
    host.closest('.lobby-hero')?.classList.remove('has-3d');
    // Each viewer loads its own GLB; release its geometry plus the procedural
    // BIT/floor assets when the screen closes. Shared resources dispose once.
    if(scene){
      const geometries=new Set(),materials=new Set();
      scene.traverse(n=>{
        if(!n.isMesh)return;
        if(n.geometry)geometries.add(n.geometry);
        for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)materials.add(m);
      });
      geometries.forEach(g=>g.dispose());
      materials.forEach(m=>m.dispose());
    }
    if(renderer){renderer.dispose();renderer.forceContextLoss?.();renderer.domElement.remove();}
  };
  let drag=null,yaw=-.18;
  const startDrag=e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    drag={id:e.pointerId,x:e.clientX};
    host.setPointerCapture?.(e.pointerId);
  };
  const moveDrag=e=>{if(!drag||e.pointerId!==drag.id)return;yaw+=(e.clientX-drag.x)*.009;drag.x=e.clientX;};
  const endDrag=e=>{if(drag?.id===e.pointerId){drag=null;try{host.releasePointerCapture?.(e.pointerId);}catch(_){}}};
  const onKey=e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      yaw+=e.key==='ArrowLeft' ? -.18:.18;e.preventDefault();
    }
  };
  try{
    // No WebGL work until the UI has a visible, bounded stage.
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false});
    renderer.setClearColor(0x000000,0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    renderer.setSize(width,height,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.18;
    renderer.domElement.setAttribute('aria-hidden','true');
    host.appendChild(renderer.domElement);
    scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(42,width/height,.05,50);
    camera.position.set(.12,1.45,4.8);
    camera.lookAt(0,1.23,0);
    const hemi=new THREE.HemisphereLight(0xbccbd8,0x252327,2.2);scene.add(hemi);
    const key=new THREE.DirectionalLight(0xffd6a8,2.1);
    key.position.set(-2,4,4);scene.add(key);
    const rim=new THREE.DirectionalLight(0x88b3d5,2.2);
    rim.position.set(3,3,-2);scene.add(rim);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(1.0,32),new THREE.MeshBasicMaterial({color:0x050a0e,transparent:true,opacity:.22,depthWrite:false}));
    floor.rotation.x=-Math.PI/2;floor.position.set(0,.004,0);scene.add(floor);
    const orbit=new THREE.Group();scene.add(orbit);
    operator=await loadHumanOperator();
    if(!host.isConnected||disposed){destroy();return null;}
    orbit.add(operator.root);
    stylizeWeapon(operator.weapon,host.dataset.weapon);
    const bit=createBit();bit.position.set(.9,1.73,.07);
    orbit.add(bit);
    // Keep the operator's visible hood in-frame and face visually obscured.
    // A light wrap on the face, attached to the Head rig, prevents source skin showing.
    const head=operator.model.getObjectByName('Head');
    if(head){
      operator.model.updateMatrixWorld(true);
      // Bone-space in the source GLB is centimetres with a scaled armature.
      // Mirror operator-gear's inverse-bone-scale mounting to keep the scarf
      // proportional to the character instead of 100x too large.
      const wrap=new THREE.Group();
      wrap.name='face-covering';
      wrap.scale.set(1,1,1).divide(head.getWorldScale(new THREE.Vector3()));
      head.add(wrap);
      const mask=part(wrap,'face wrap',new THREE.SphereGeometry(.17,10,8),mat(0x161e22,.04,.96),0,-.07,.12);
      mask.scale.set(1.05,.65,.52);
    }
    host.addEventListener('pointerdown',startDrag);
    host.addEventListener('pointermove',moveDrag);
    host.addEventListener('pointerup',endDrag);
    host.addEventListener('pointercancel',endDrag);
    host.addEventListener('keydown',onKey);
    const fit=()=>{
      if(!host.isConnected||disposed)return;
      const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
      camera.aspect=w/h;
      // The operator stays centered even on short landscape phone viewports.
      camera.position.z=Math.max(3.3,Math.min(5.0, 2.7 + (h/w)*3.15));
      camera.position.y=1.43;
      camera.lookAt(0,1.20,0);
      camera.updateProjectionMatrix();
      renderer.setSize(w,h,false);
    };
    if(typeof ResizeObserver==='function'){resize=new ResizeObserver(fit);resize.observe(host);}
    fit();
    const reduced=matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
    let previous=0,shownAt=performance.now();
    const frame=t=>{
      if(disposed)return;
      if(!host.isConnected || document.body?.dataset?.screen!=='prep'){destroy();return;}
      raf=requestAnimationFrame(frame);
      if(document.hidden || !host.offsetWidth || !host.offsetHeight)return;
      const dt=previous?Math.min(.06,(t-previous)/1000):.016;previous=t;
      if(!reduced)operator.update(dt,{aiming:false,moving:false});
      orbit.rotation.y=yaw;
      if(!reduced)bit.position.y=1.73+Math.sin((t-shownAt)*.0017)*.035;
      renderer.render(scene,camera);
    };
    host.closest('.lobby-hero')?.classList.add('has-3d');
    raf=requestAnimationFrame(frame);
    return {dispose:destroy};
  }catch(error){
    console.warn('Raid Prep 3D fallback:',error?.message||error);
    destroy();
    return null;
  }
}
