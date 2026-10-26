import * as THREE from './vendor/three.module.js';

const WIDTH=.45,EDGE=.045;

function strips(count,color,order){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*12),3));
  const indices=[];
  for(let i=0;i<count;i++){const n=i*4;indices.push(n,n+1,n+2,n,n+2,n+3);}
  geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
  mesh.renderOrder=order;mesh.frustumCulled=false;
  return mesh;
}

export function createTurretWarning(color){
  const group=new THREE.Group();
  group.add(strips(3,color,4),strips(6,color,5));
  group.visible=false;
  return group;
}

function quad(position,vertex,dx,dz,range,offset,width,height){
  const px=dz,pz=-dx,lo=offset-width/2,hi=offset+width/2;
  position.setXYZ(vertex,px*lo,height,pz*lo);
  position.setXYZ(vertex+1,px*hi,height,pz*hi);
  position.setXYZ(vertex+2,dx*range+px*hi,height,dz*range+pz*hi);
  position.setXYZ(vertex+3,dx*range+px*lo,height,dz*range+pz*lo);
}

// All meshes and buffers survive across warnings. The hot path only writes scalars.
export function updateTurretWarning(group,directions,range,rotation,clock,windupAt,warningMs){
  const fill=group.children[0],edges=group.children[1];
  const count=Math.min(3,directions.length);
  const fp=fill.geometry.attributes.position,ep=edges.geometry.attributes.position;
  for(let i=0;i<count;i++){
    const d=directions[i],length=Math.hypot(d.x,d.z)||1,dx=d.x/length,dz=d.z/length;
    quad(fp,i*4,dx,dz,range,0,WIDTH,.055);
    quad(ep,i*8,dx,dz,range,-(WIDTH-EDGE)/2,EDGE,.057);
    quad(ep,i*8+4,dx,dz,range,(WIDTH-EDGE)/2,EDGE,.057);
  }
  fp.needsUpdate=true;ep.needsUpdate=true;
  fill.geometry.setDrawRange(0,count*6);edges.geometry.setDrawRange(0,count*12);
  group.rotation.y=-rotation;
  const progress=Math.max(0,Math.min(1,1-(windupAt-clock)/warningMs));
  const pulse=(1+Math.sin(clock/65))*.5;
  fill.material.opacity=.28+.22*progress+.08*pulse;
  edges.material.opacity=.65+.22*progress+.1*pulse;
}
