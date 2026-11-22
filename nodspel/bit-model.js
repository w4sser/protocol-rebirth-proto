// Textured BIT companion (v2.28.67). The GLB carries the worn casing only: its CRT glass is a separate
// dark mesh (`bit_screen`, own material, UVs 0..1 across the glass) and the game draws the face onto it as
// a swappable emissive canvas texture, so expressions animate without touching the 3D model.
// Identity rules: docs/bit-character-spec.md. The idle face is the locked v3 master geometry
// (assets/bit-face-master-v3.svg: 1000x875 U box, 78x170 U eyes at (257,370)/(743,370), filled smile with
// 370 U span, 115 U depth, 32->64->32 U taper, radius-16 caps) in #75CFCC. Other M40/M42 states keep their
// existing recipe as a change relative to idle (bit-expression.js FACES), never a redesigned face.
import * as THREE from './vendor/three.module.js';
import {bitExpressionFace,mouthDepth} from './bit-expression.js?v=2.28.67';

export const BIT_MODEL=Object.freeze({
  url:'../assets/bit/bit-companion.glb?v=2.28.67',
  scale:1, // the GLB is authored at game scale: ~0.72 m wide casing, ~0.92 m to the antenna tip
  lift:.3, // hover base height, matching the procedural BIT's lowest part (y=.34 minus its .04 skirt)
  faceHeight:.92, // fraction of the screen height the 875 U face box fills
  canvasHeight:256,
});

const IDLE=bitExpressionFace('idle'),IDLE_DEPTH=mouthDepth('smile');
// Recipe deltas (bit-expression.js units: the old .62 x .44 screen) -> master units.
export function bitFaceGeometry(state){
  const f=bitExpressionFace(state),depthScale=mouthDepth(f.mouth)/IDLE_DEPTH;
  const dy=(f.eyeY-IDLE.eyeY)/.44*875; // screen-height fraction -> face-box units (down is +y on canvas)
  return {
    eyes:[257,743].map(x=>500+(x-500)*f.eyeX/IDLE.eyeX),eyeY:370-dy,
    eyeRx:39*f.eyeW/IDLE.eyeW,eyeRy:85*f.eyeH/IDLE.eyeH,
    smileDepth:115*depthScale,
  };
}
// Filled smile around a circular-ish centreline: endpoints (315,534)/(685,534), depth `d` below them,
// thickness 32 + 32 sin(pi t). Built as a polygon from the centreline normals plus round end caps.
function smilePath(ctx,d,k,ox,oy){
  const N=48,pts=[],half=185;
  for(let i=0;i<=N;i++){
    const t=i/N,x=315+370*t,y=534+d*Math.sin(Math.PI*t);
    const dx=370,dyv=d*Math.PI*Math.cos(Math.PI*t),len=Math.hypot(dx,dyv)||1;
    pts.push({x,y,nx:-dyv/len,ny:dx/len,w:(32+32*Math.sin(Math.PI*t))/2});
  }
  ctx.beginPath();
  pts.forEach((p,i)=>{const X=ox+(p.x+p.nx*p.w)*k,Y=oy+(p.y+p.ny*p.w)*k;i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);});
  for(let i=pts.length-1;i>=0;i--){const p=pts[i];ctx.lineTo(ox+(p.x-p.nx*p.w)*k,oy+(p.y-p.ny*p.w)*k);}
  ctx.closePath();ctx.fill();
  for(const p of [pts[0],pts[pts.length-1]]){ctx.beginPath();ctx.arc(ox+p.x*k,oy+p.y*k,16*k,0,Math.PI*2);ctx.fill();}
  return half;
}
export function drawBitFace(ctx,width,height,state='idle'){
  const g=bitFaceGeometry(state),k=height*BIT_MODEL.faceHeight/875,ox=(width-1000*k)/2,oy=(height-875*k)/2;
  ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
  // Features are drawn white; the screen material's emissive colour (#75CFCC calm, dims/brightens with the
  // existing M40 presentation) tints them, so brightness changes never redraw the canvas.
  ctx.fillStyle='#fff';
  for(const x of g.eyes){ctx.beginPath();ctx.ellipse(ox+x*k,oy+g.eyeY*k,g.eyeRx*k,g.eyeRy*k,0,0,Math.PI*2);ctx.fill();}
  smilePath(ctx,g.smileDepth,k,ox,oy);
}
export function createBitFace(aspect,doc=globalThis.document){
  const height=BIT_MODEL.canvasHeight,width=Math.round(height*aspect);
  const canvas=doc.createElement('canvas');canvas.width=width;canvas.height=height;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  let shown=null;
  return {canvas,texture,set(state){
    if(state===shown)return false;
    shown=state;drawBitFace(canvas.getContext('2d'),width,height,state);texture.needsUpdate=true;return true;
  }};
}
// Swap the procedural BIT for the GLB once it loads; the boxes stay as the fallback until then (and forever
// if the GLB fails). Returns the handles game.mjs animates: the face, the screen material and the antenna.
export async function attachBitModel(bitModel,{procedural=[],load,doc}={}){
  const fetchModel=load??(async url=>{const {GLTFLoader}=await import('./vendor/GLTFLoader.js');return (await new GLTFLoader().loadAsync(url)).scene;});
  const root=await fetchModel(BIT_MODEL.url);
  const screen=root.getObjectByName('bit_screen'),antenna=root.getObjectByName('bit_antenna_pivot');
  if(!screen?.isMesh)throw new Error('BIT model is missing bit_screen');
  screen.geometry.computeBoundingBox();
  const size=screen.geometry.boundingBox.getSize(new THREE.Vector3());
  const face=createBitFace(size.x/Math.max(1e-6,size.y),doc);
  const material=new THREE.MeshStandardMaterial({color:'#05080a',roughness:.25,metalness:0,emissive:'#75cfcc',
    emissiveMap:face.texture,emissiveIntensity:1});
  material.toneMapped=false; // the locked #75CFCC must reach the screen unchanged by ACES tone mapping
  screen.material=material;
  root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=false;}});
  const mount=new THREE.Group();mount.add(root);mount.scale.setScalar(BIT_MODEL.scale);mount.position.y=BIT_MODEL.lift;
  for(const part of procedural)part.visible=false;
  bitModel.add(mount);face.set('idle');
  return {mount,root,face,screenMaterial:material,antenna};
}
