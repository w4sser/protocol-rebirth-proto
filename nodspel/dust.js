// v2.9.0 mood pass: floating dust motes. Cheap THREE.Points cloud that follows the player (only the
// container moves; individual points drift/wrap in local space), fogged like everything else in the scene.
import * as THREE from './vendor/three.module.js';

export function createDustField(count=220,{radius=10,height=3.2}={}){
  const positions=new Float32Array(count*3),seeds=new Float32Array(count);
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*radius;
    positions[i*3]=Math.cos(a)*r;positions[i*3+1]=Math.random()*height;positions[i*3+2]=Math.sin(a)*r;
    seeds[i]=Math.random()*Math.PI*2;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color:'#d8ecf5',size:.12,sizeAttenuation:true,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,fog:true});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;
  const pos=geometry.attributes.position;
  function update(dt,time){
    for(let i=0;i<count;i++){
      let y=pos.getY(i)+dt*.16;
      if(y>height)y=0;
      pos.setY(i,y);
      pos.setX(i,pos.getX(i)+Math.sin(time*.3+seeds[i])*dt*.04);
      pos.setZ(i,pos.getZ(i)+Math.cos(time*.24+seeds[i])*dt*.04);
    }
    pos.needsUpdate=true;
  }
  function dispose(){geometry.dispose();material.dispose();}
  return {points,update,dispose};
}
