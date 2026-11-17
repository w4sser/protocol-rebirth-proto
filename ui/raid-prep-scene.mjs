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

/* Close-up outfit pass, kept separate from the small top-down gameplay rig.
 * The existing skeletal animation and GLB remain authoritative; this only
 * attaches cloth and armor to the existing rig for Raid Prep rendering. */
function dressCinematicOperator(operator){
  const model=operator.model;
  const fabric=mat(0x343739,.02,.98),clothDark=mat(0x22292d,.02,.98),
    armor=mat(0x404746,.24,.87),armorEdge=mat(0x222d32,.45,.76),
    beltMat=mat(0x242a2d,.16,.87),faceBlack=mat(0x0a1014,.03,1),
    glove=mat(0x212526,.06,.94);
  // Dark, weathered color pass. The source model is optimized for a distant
  // top-down player; its near-white jacket and bright skin must not dominate.
  model.traverse(n=>{
    if(!n.isMesh || !n.material)return;
    const key=(n.name||'').toLowerCase();
    const recolor=m=>{
      const copy=m.clone();
      if(copy.color)copy.color.multiplyScalar(key.includes('jacket')||key.includes('hood')?.42:.3);
      if(copy.roughness!==undefined)copy.roughness=Math.max(copy.roughness,.82);
      if(copy.metalness!==undefined)copy.metalness=Math.min(copy.metalness,.28);
      return copy;
    };
    n.material=Array.isArray(n.material)?n.material.map(recolor):recolor(n.material);
    if(key.includes('sleeve')||key.includes('jacket')||key.includes('hood'))n.material=fabric;
    else if(key.includes('trouser')||key.includes('boot'))n.material=clothDark;
    else if(key.includes('backpack')||key.includes('pack-'))n.material=armor;
    else if(key.includes('strap'))n.material=beltMat;
  });
  const mount=(boneName,label)=>{
    model.updateMatrixWorld(true);
    const bone=model.getObjectByName(boneName);
    if(!bone)return null;
    const group=new THREE.Group();group.name=label;
    const scale=bone.getWorldScale(new THREE.Vector3());
    if(scale.x*scale.y*scale.z===0)return null;
    group.scale.set(1,1,1).divide(scale);
    bone.add(group);
    return group;
  };
  const hood=mount('Head','cinematic-hood');
  if(hood){
    const shell=part(hood,'heavy hood',new THREE.SphereGeometry(.29,16,11),fabric,0,.075,-.048);
    shell.scale.set(1.06,1.13,1.05);
    const shadow=part(hood,'face void',new THREE.SphereGeometry(.225,16,10),faceBlack,0,.03,.204);
    shadow.scale.set(1,.99,.42);
    const mouthCover=part(hood,'scavenger mask',new THREE.BoxGeometry(.35,.16,.09),clothDark,0,-.11,.288);
    mouthCover.rotation.x=-.11;
    const rim=part(hood,'hood framing',new THREE.TorusGeometry(.237,.041,8,22),fabric,0,.057,.237);
    rim.scale.set(1,1.14,1);
    const brow=part(hood,'hood peak',new THREE.BoxGeometry(.42,.067,.22),fabric,0,.285,.13);
    brow.rotation.x=-.22;
    for(const side of [-1,1]){
      const cheek=part(hood,'hood side fold',new THREE.BoxGeometry(.07,.28,.15),fabric,side*.205,-.016,.176);
      cheek.rotation.z=side*.16;
    }
  }
  const body=mount('Chest','cinematic-survival-coat');
  if(body){
    const front=part(body,'chest plate',new THREE.BoxGeometry(.43,.35,.095),armor,0,-.14,.215);
    front.rotation.x=-.05;
    for(const side of [-1,1]){
      const shoulder=part(body,'shoulder guard',new THREE.BoxGeometry(.22,.17,.32),armorEdge,side*.32,.05,.02);
      shoulder.rotation.z=side*.15;
      const pouch=part(body,'utility pouch',new THREE.BoxGeometry(.16,.14,.11),armor,side*.17,-.39,.175);
      pouch.rotation.z=side*.08;
      const strap=part(body,'front harness strap',new THREE.BoxGeometry(.065,.54,.035),beltMat,side*.17,-.08,.274);
      strap.rotation.z=-side*.16;
      // Split weathered coat tail; long, angular cloth, never a full skirt.
      const tail=part(body,'split front coat',new THREE.PlaneGeometry(.25,.78),fabric,side*.155,-.68,.14);
      tail.material=tail.material.clone();tail.material.side=THREE.DoubleSide;
      tail.rotation.z=side*.10;tail.rotation.x=.055;
    }
    part(body,'waist webbing',new THREE.BoxGeometry(.57,.11,.39),beltMat,0,-.39,0);
    // Back cloak broadens the silhouette and folds over the existing pack.
    const geometry=new THREE.PlaneGeometry(.82,1.03,6,8);
    const verts=geometry.attributes.position;
    for(let i=0;i<verts.count;i++){
      const x=verts.getX(i),y=verts.getY(i);
      const lower=(.515-y)/1.03;
      verts.setXYZ(i,x*(1+.25*lower),y,-.12-.16*lower+Math.cos(x*8)*.025);
    }
    geometry.computeVertexNormals();
    const mantle=new THREE.Mesh(geometry,materialWithSides(fabric,THREE.DoubleSide));
    mantle.name='weathered rear cloak';
    mantle.position.set(0,-.64,-.43);
    mantle.castShadow=true;body.add(mantle);
  }
  for(const side of ['L','R']){
    const wrist=mount('Wrist'+side,'cinematic-glove-'+side);
    if(wrist)part(wrist,'gloved hand',new THREE.SphereGeometry(.105,9,7),glove,0,0,.02).scale.set(.9,1.03,1.15);
  }
}
function materialWithSides(m,side){const copy=m.clone();copy.side=side;return copy;}

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
  let drag=null,yaw=-.27;
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
    renderer.toneMappingExposure=.98;
    renderer.domElement.setAttribute('aria-hidden','true');
    host.appendChild(renderer.domElement);
    scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(42,width/height,.05,50);
    camera.position.set(.12,1.45,4.8);
    camera.lookAt(0,1.23,0);
    const hemi=new THREE.HemisphereLight(0xc1c5d2,0x171e22,1.05);scene.add(hemi);
    const key=new THREE.DirectionalLight(0xf5be95,1.8);
    key.position.set(-2,4,4);scene.add(key);
    const rim=new THREE.DirectionalLight(0x98adcf,1.5);
    rim.position.set(3,3,-2);scene.add(rim);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(1.0,32),new THREE.MeshBasicMaterial({color:0x050a0e,transparent:true,opacity:.22,depthWrite:false}));
    floor.rotation.x=-Math.PI/2;floor.position.set(0,.004,0);scene.add(floor);
    const orbit=new THREE.Group();scene.add(orbit);
    operator=await loadHumanOperator();
    if(!host.isConnected||disposed){destroy();return null;}
    orbit.add(operator.root);
    dressCinematicOperator(operator);
    stylizeWeapon(operator.weapon,host.dataset.weapon);
    const bit=createBit();bit.scale.setScalar(.66);bit.position.set(-.93,1.79,.22);
    orbit.add(bit);
    // The full hood, shadowed face void and cloth mask are attached by
    // dressCinematicOperator above, with no oversized spherical face patch.
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
      camera.position.z=Math.max(3.14,Math.min(4.05, 2.65 + (h/w)*1.15));
      camera.position.y=1.37;
      camera.lookAt(0,1.22,0);
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
      if(!reduced)bit.position.y=1.79+Math.sin((t-shownAt)*.0017)*.026;
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
