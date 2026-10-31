// Boundary mesh of a union of axis-aligned solids. Shared/interior faces are removed,
// including partial T/L junctions and coincident faces. No depth bias hides bad joins.
import * as THREE from './vendor/three.module.js';
const EPS=1e-7;
function subtract(r,c){
  const a=Math.max(r[0],c[0]),b=Math.min(r[1],c[1]),d=Math.max(r[2],c[2]),e=Math.min(r[3],c[3]);
  if(b-a<EPS||e-d<EPS)return [r];
  return [[r[0],a,r[2],r[3]],[b,r[1],r[2],r[3]],[a,b,r[2],d],[a,b,e,r[3]]].filter(q=>q[1]-q[0]>EPS&&q[3]-q[2]>EPS);
}
export function shellFaces(boxes){
  const solids=boxes.map(b=>({...b,min:[b.x-b.w/2,b.y-b.h/2,b.z-b.d/2],max:[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2]})),faces=[];
  solids.forEach((b,i)=>{
    for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
      const u=(axis+1)%3,v=(axis+2)%3,at=sign>0?b.max[axis]:b.min[axis];
      let pieces=[[b.min[u],b.max[u],b.min[v],b.max[v]]];
      for(let j=0;j<solids.length&&pieces.length;j++){
        if(j===i)continue;const c=solids[j];
        // The neighbour fills the space just outside this face, or owns an
        // identical exterior plane. The index tie-break retains exactly one copy.
        const outside=sign>0?c.min[axis]<=at+EPS&&c.max[axis]>at+EPS:c.max[axis]>=at-EPS&&c.min[axis]<at-EPS;
        const same=Math.abs((sign>0?c.max[axis]:c.min[axis])-at)<EPS&&j<i;
        if(outside||same)pieces=pieces.flatMap(r=>subtract(r,[c.min[u],c.max[u],c.min[v],c.max[v]]));
      }
      for(const rect of pieces)faces.push({axis,sign,at,u,v,rect,material:b.material??0});
    }
  });return faces;
}
export function shellMesh(boxes,colors){
  const faces=shellFaces(boxes),position=[],normal=[],uv=[];
  const geometry=new THREE.BufferGeometry();
  for(const f of faces){
    const [a,b,c,d]=f.rect,corners=[[a,c],[b,c],[b,d],[a,d]],order=f.sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],start=position.length/3;
    for(const i of order){const p=[0,0,0],n=[0,0,0];p[f.axis]=f.at;p[f.u]=corners[i][0];p[f.v]=corners[i][1];n[f.axis]=f.sign;position.push(...p);normal.push(...n);uv.push(...corners[i]);}
    geometry.addGroup(start,6,f.material);
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  // Merge adjacent material groups to keep renderer submissions proportional to
  // material families rather than emitting one draw call for every boundary quad.
  const indices=[];geometry.clearGroups();
  for(let material=0;material<colors.length;material++){
    const start=indices.length;faces.forEach((f,i)=>{if(f.material===material)for(let k=0;k<6;k++)indices.push(i*6+k);});
    if(indices.length>start)geometry.addGroup(start,indices.length-start,material);
  }
  geometry.setIndex(indices);geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,colors.map(color=>new THREE.MeshStandardMaterial({color,roughness:.94,metalness:0})));
  mesh.receiveShadow=true;return mesh;
}
export function wallSolids(walls){
  return walls.flatMap(b=>{
    const base=b.y??0,top=base+b.h;
    const cuts=[base,Math.min(top,base+.18),Math.max(base,base+b.h*.52-.0375),Math.min(top,base+b.h*.52+.0375),Math.max(base,top-.09),top].sort((a,b)=>a-b);
    return cuts.slice(1).flatMap((hi,i)=>{const lo=cuts[i];if(hi-lo<EPS)return [];
      const mid=(hi+lo)/2,material=mid>=top-.09?2:mid<=base+.18?0:Math.abs(mid-(base+b.h*.52))<.0375?3:1;
      return [{x:b.x,z:b.z,y:mid,w:b.w,d:b.d,h:hi-lo,material}];});
  });
}
