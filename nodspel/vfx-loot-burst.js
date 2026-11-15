// @hot update
// PRB-156 (Robert playtest 2026-11-15: "...same when you've picked up loot" -- the pickup burst read flat/2D).
// A pooled 3D pickup burst: sparkles pop up with gravity then home toward the player over ~0.5s, plus a ground
// flash ring, coloured by the item's rarity (caller passes the colour; rarity.js already owns that lookup).
// Fixed-capacity typed-array pool sized at construction -- spawn()/update() never grow an array or allocate a
// per-particle object, so a string of rapid pickups costs nothing beyond overwriting the oldest slot.
import * as THREE from './vendor/three.module.js';
import {softDotTexture} from './vfx-textures.js?v=2.28.32';

const GRAVITY=-9,GRAVITY_T=.18,TOTAL_T=.52,FADE_FROM=.8;
const RING_LIFE=.45;
const TIERS={low:{perBurst:12,bursts:3,rings:3},high:{perBurst:22,bursts:4,rings:4}};

export function createLootBurstPool({quality='high'}={}){
  const tier=TIERS[quality]||TIERS.high;
  const capacity=tier.perBurst*tier.bursts;
  const dot=softDotTexture();
  const group=new THREE.Group();

  const alive=new Uint8Array(capacity),age=new Float32Array(capacity);
  const ox=new Float32Array(capacity),oy=new Float32Array(capacity),oz=new Float32Array(capacity);
  const vx=new Float32Array(capacity),vy=new Float32Array(capacity),vz=new Float32Array(capacity);
  const baseColor=new Float32Array(capacity*3);
  const positions=new Float32Array(capacity*3),colors=new Float32Array(capacity*3);
  for(let i=0;i<capacity;i++)positions[i*3+1]=-50;
  const pointsGeo=new THREE.BufferGeometry();
  pointsGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  pointsGeo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const pointsMaterial=new THREE.PointsMaterial({map:dot,size:.16,sizeAttenuation:true,vertexColors:true,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const points=new THREE.Points(pointsGeo,pointsMaterial);points.frustumCulled=false;group.add(points);

  const ringGeo=new THREE.RingGeometry(.1,.42,28);
  const rings=Array.from({length:tier.rings},()=>{
    const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({map:dot,color:'#ffffff',transparent:true,opacity:0,
      side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    m.rotation.x=-Math.PI/2;m.visible=false;group.add(m);return {mesh:m,age:0,active:false};
  });
  let cursor=0,ringCursor=0;

  function spawn(x,y,z,color='#ffd04a'){
    const c=new THREE.Color(color),n=tier.perBurst;
    for(let k=0;k<n;k++){
      const slot=(cursor+k)%capacity;
      alive[slot]=1;age[slot]=0;
      ox[slot]=x;oy[slot]=y;oz[slot]=z;
      const angle=(k/n)*Math.PI*2+Math.random()*.6,speed=1.1+Math.random()*1.3;
      vx[slot]=Math.cos(angle)*speed;vz[slot]=Math.sin(angle)*speed;vy[slot]=2.1+Math.random()*1.1;
      baseColor[slot*3]=c.r;baseColor[slot*3+1]=c.g;baseColor[slot*3+2]=c.b;
    }
    cursor=(cursor+n)%capacity;
    const ring=rings[ringCursor];ringCursor=(ringCursor+1)%rings.length;
    ring.mesh.position.set(x,y+.02,z);ring.mesh.material.color.set(color);ring.mesh.material.opacity=.85;
    ring.mesh.visible=true;ring.mesh.scale.setScalar(.4);ring.age=0;ring.active=true;
  }

  function update(dt,targetX=0,targetY=0,targetZ=0){
    for(let i=0;i<capacity;i++){
      if(!alive[i])continue;
      age[i]+=dt;const t=age[i];
      let px,py,pz;
      if(t<GRAVITY_T){
        px=ox[i]+vx[i]*t;pz=oz[i]+vz[i]*t;py=oy[i]+vy[i]*t+.5*GRAVITY*t*t;
      }else if(t<TOTAL_T){
        const apx=ox[i]+vx[i]*GRAVITY_T,apz=oz[i]+vz[i]*GRAVITY_T,apy=oy[i]+vy[i]*GRAVITY_T+.5*GRAVITY*GRAVITY_T*GRAVITY_T;
        let s=(t-GRAVITY_T)/(TOTAL_T-GRAVITY_T);s=s<0?0:s>1?1:s;const ease=s*s*(3-2*s);
        px=apx+(targetX-apx)*ease;py=apy+(targetY-apy)*ease;pz=apz+(targetZ-apz)*ease;
      }else{
        alive[i]=0;px=targetX;py=-50;pz=targetZ;
      }
      const fade=t<TOTAL_T*FADE_FROM?1:Math.max(0,1-(t-TOTAL_T*FADE_FROM)/(TOTAL_T*(1-FADE_FROM)));
      const o=i*3;positions[o]=px;positions[o+1]=py;positions[o+2]=pz;
      colors[o]=baseColor[o]*fade;colors[o+1]=baseColor[o+1]*fade;colors[o+2]=baseColor[o+2]*fade;
    }
    pointsGeo.attributes.position.needsUpdate=true;pointsGeo.attributes.color.needsUpdate=true;
    for(const r of rings){
      if(!r.active)continue;
      r.age+=dt;const k=r.age/RING_LIFE;
      if(k>=1){r.active=false;r.mesh.visible=false;continue;}
      r.mesh.material.opacity=.85*(1-k);r.mesh.scale.setScalar(.4+k*1.6);
    }
  }
  function dispose(){
    pointsGeo.dispose();pointsMaterial.dispose();ringGeo.dispose();
    for(const r of rings)r.mesh.material.dispose();
  }
  return {group,spawn,update,dispose,capacity,points,rings,perBurst:tier.perBurst,
    positions,alive};
}
