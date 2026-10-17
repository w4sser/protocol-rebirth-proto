// v1.59: no kit object may contain two visible faces in the same plane facing the same way
// (internal z-fighting: owner saw a striped sandbag "crate" in Bunker L2 Narrow Passage).
// tools/fix-coplanar.py repairs the GLBs; this guards every bunker kit asset.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {BUNKER_KINDS} from '../bunker.js';
const dir=new URL('../../assets/env/bunker/',import.meta.url);
function triangles(buf){
  const jl=buf.readUInt32LE(12),J=JSON.parse(buf.subarray(20,20+jl).toString()),bin=buf.subarray(20+jl+8);
  const read=i=>{const a=J.accessors[i],v=J.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3}[a.type],sz={5126:4,5123:2,5125:4,5121:1}[a.componentType],st=v.byteStride||sz*n,o=(v.byteOffset||0)+(a.byteOffset||0),out=[];
    for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const p=o+k*st+c*sz;out.push(a.componentType===5126?bin.readFloatLE(p):a.componentType===5123?bin.readUInt16LE(p):a.componentType===5125?bin.readUInt32LE(p):bin[p]);}return out;};
  const tris=[];
  for(const mesh of J.meshes)for(const pr of mesh.primitives){const P=read(pr.attributes.POSITION),idx=pr.indices!=null?read(pr.indices):P.map((_,i)=>i).slice(0,P.length/3);
    for(let t=0;t<idx.length;t+=3)tris.push([0,1,2].map(k=>P.slice(idx[t+k]*3,idx[t+k]*3+3)));}
  return tris;}
const sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function separated(A,B){for(const P of [A,B])for(let k=0;k<3;k++){const e=sub(P[(k+1)%3],P[k]),ax=[-e[1],e[0]],pa=A.map(p=>p[0]*ax[0]+p[1]*ax[1]),pb=B.map(p=>p[0]*ax[0]+p[1]*ax[1]);
  if(Math.max(...pa)<=Math.min(...pb)+1e-5||Math.max(...pb)<=Math.min(...pa)+1e-5)return true;}return false;}
export function coplanarOverlaps(tris){
  const info=tris.map(t=>{const n=cross(sub(t[1],t[0]),sub(t[2],t[0])),l=Math.hypot(...n);if(l<1e-12)return null;const u=n.map(x=>x/l);return {t,n:u,d:dot(u,t[0])};});let hits=0;
  for(let i=0;i<info.length;i++)for(let j=i+1;j<info.length;j++){const a=info[i],b=info[j];if(!a||!b||dot(a.n,b.n)<1-1e-4||Math.abs(a.d-b.d)>1e-4)continue;
    const ax=a.n.map(Math.abs).indexOf(Math.max(...a.n.map(Math.abs))),keep=[0,1,2].filter(k=>k!==ax),A=a.t.map(p=>keep.map(k=>p[k])),B=b.t.map(p=>keep.map(k=>p[k]));
    if(!separated(A,B))hits++;}
  return hits;}
test('no bunker kit model has two same-facing coplanar overlapping faces (internal z-fighting)',()=>{
  for(const k of BUNKER_KINDS){const f=new URL(`${k}.glb`,dir);if(!fs.existsSync(f))continue;
    assert.equal(coplanarOverlaps(triangles(fs.readFileSync(f))),0,`${k}.glb has coplanar overlapping faces`);}});
test('the detector catches a flush overlap (sanity)',()=>{
  const q=(x0,x1)=>[[[x0,0,0],[x1,0,0],[x1,1,0]],[[x0,0,0],[x1,1,0],[x0,1,0]]];
  assert.ok(coplanarOverlaps([...q(0,1),...q(.5,1.5)])>0);assert.equal(coplanarOverlaps([...q(0,1),...q(1,2)]),0);});
