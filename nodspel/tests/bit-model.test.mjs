import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {BIT_MODEL,attachBitModel,bitFaceGeometry,createBitFace} from '../bit-model.js?v=2.28.82';
import {BIT_EXPRESSIONS} from '../bit-expression.js?v=2.28.82';

// GLTFLoader reads embedded textures via self.URL; browsers have `self`, Node does not.
globalThis.self??=globalThis;
// Minimal canvas stand-in: records draw calls so the test can see when the face is redrawn.
function fakeDoc(){
  const calls={fills:0};
  const ctx=new Proxy({},{get:(t,k)=>k==='fill'?()=>{calls.fills++;}:(k in t?t[k]:()=>{}),set:(t,k,v)=>{t[k]=v;return true;}});
  return {calls,createElement:()=>({width:0,height:0,getContext:()=>ctx})};
}
async function bitScene(){
  const bytes=readFileSync(new URL('../../assets/bit/bit-companion.glb',import.meta.url));
  return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}

test('idle face is the locked v3 master geometry (docs/bit-character-spec.md)',()=>{
  const g=bitFaceGeometry('idle');
  assert.deepEqual(g.eyes,[257,743]);assert.equal(g.eyeY,370);
  assert.equal(g.eyeRx,39);assert.equal(g.eyeRy,85);assert.equal(g.smileDepth,115);
  for(const state of BIT_EXPRESSIONS){const s=bitFaceGeometry(state);assert.equal(s.eyes[0]+s.eyes[1],1000,`${state} stays symmetric`);}
});

test('BIT GLB has a separate screen with 0..1 UVs, casing and antenna pivot',async()=>{
  const root=await bitScene();
  for(const name of ['bit_body','bit_screen','bit_antenna_pivot','bit_lamp'])assert.ok(root.getObjectByName(name),name);
  const uv=root.getObjectByName('bit_screen').geometry.attributes.uv;
  let lo=Infinity,hi=-Infinity;for(let i=0;i<uv.count;i++){lo=Math.min(lo,uv.getX(i),uv.getY(i));hi=Math.max(hi,uv.getX(i),uv.getY(i));}
  assert.ok(lo>-1e-3&&lo<.01&&hi>.99&&hi<1.001,`uv range ${lo}..${hi}`);
});

// Regression for Robert's 24 Nov 2026 Depth Raid note: BIT's face rendered upside down after the #306
// textured BIT swap. bit_screen's UVs follow the glTF convention (V=0 at the top of the mesh); a
// CanvasTexture defaults to flipY=true, which mirrors the canvas vertically on the mesh -- eyes would land
// at the chin. This locks both halves of the fix: the mesh's top-of-screen really is low V, and the face
// texture must use flipY=false (matching GLTFLoader's own textures) so the canvas's top row (eyes, drawn
// above the smile) lands on that low-V edge instead of being flipped to the bottom.
test('BIT face renders right-side up: mesh top is low V, and the face texture does not flip that',async()=>{
  const root=await bitScene();
  const geo=root.getObjectByName('bit_screen').geometry,pos=geo.attributes.position,uv=geo.attributes.uv;
  let maxY=-Infinity,maxYV=null,minY=Infinity,minYV=null;
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i);
    if(y>maxY){maxY=y;maxYV=uv.getY(i);}
    if(y<minY){minY=y;minYV=uv.getY(i);}
  }
  assert.ok(maxYV<minYV-.3,`top-of-mesh vertex (uv.y=${maxYV}) should sit at a much lower V than the bottom-of-mesh vertex (uv.y=${minYV})`);

  const g=bitFaceGeometry('idle');
  assert.ok(g.eyeY<534,'eyes are drawn above the smile baseline on the canvas (lower row index = higher up)');

  const face=createBitFace(1,fakeDoc());
  assert.equal(face.texture.flipY,false,'face texture must not flip, or the glTF V=0-top screen UVs invert it');
});

test('attach swaps the procedural boxes for the GLB and drives the face as an emissive texture',async()=>{
  const root=await bitScene(),doc=fakeDoc(),bitModel=new THREE.Group();
  const boxes=[new THREE.Mesh(),new THREE.Mesh()];boxes.forEach(b=>bitModel.add(b));
  const handle=await attachBitModel(bitModel,{procedural:boxes,load:async()=>root,doc});
  assert.ok(boxes.every(b=>!b.visible),'procedural BIT hidden');
  assert.equal(handle.mount.position.y,BIT_MODEL.lift);
  const m=handle.screenMaterial;
  assert.equal(root.getObjectByName('bit_screen').material,m);
  assert.equal(m.emissiveMap,handle.face.texture);assert.equal(m.toneMapped,false);
  assert.equal('#'+m.emissive.getHexString(),'#75cfcc');
  const drawn=doc.calls.fills;
  assert.equal(handle.face.set('idle'),false,'same state does not redraw');assert.equal(doc.calls.fills,drawn);
  assert.equal(handle.face.set('loot'),true);assert.ok(doc.calls.fills>drawn,'state change redraws the face');
});

test('a missing screen keeps the procedural BIT (presentation never breaks the raid)',async()=>{
  const bitModel=new THREE.Group(),box=new THREE.Mesh();bitModel.add(box);
  await assert.rejects(attachBitModel(bitModel,{procedural:[box],load:async()=>new THREE.Group(),doc:fakeDoc()}));
  assert.equal(box.visible,true);
});
