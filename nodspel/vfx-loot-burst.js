// @hot update spawn
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
  let tier=TIERS[quality]||TIERS.high;
  const capacity=TIERS.high.perBurst*TIERS.high.bursts;
  const dot=softDotTexture();
  const group=new THREE.Group();

  const alive=new Uint8Array(capacity),age=new Float32Array(capacity);
  const ox=new Float32Array(capacity),oy=new Float32Array(capacity),oz=new Float32Array(capacity);
  const vx=new Float32Array(capacity),vy=new Float32Array(capacity),vz=new Float32Array(capacity);
  const baseColor=new Float32Array(capacity*3);
  const positions=new Float32Array(capacity*3),colors=new Float32Array(capacity*3);
  for(let i=0;i<capacity;i++)positions[i*3+1]=-50;
  const pointsGeo=new THREE.OctahedronGeometry(.09,0);
  const pointsMaterial=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,toneMapped:false});
  const points=new THREE.InstancedMesh(pointsGeo,pointsMaterial,capacity);
  points.instanceMatrix.setUsage(THREE.DynamicDrawUsage);points.frustumCulled=false;group.add(points);
  const matrix=new THREE.Matrix4(),scratchColor=new THREE.Color();
  matrix.makeScale(0,0,0);
  for(let i=0;i<capacity;i++){points.setMatrixAt(i,matrix);points.setColorAt(i,scratchColor);}
  points.instanceColor.setUsage(THREE.DynamicDrawUsage);

  const ringGeo=new THREE.RingGeometry(.1,.42,28);
  const rings=Array.from({length:TIERS.high.rings},()=>{
    const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({map:dot,color:'#ffffff',transparent:true,opacity:0,
      side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    m.rotation.x=-Math.PI/2;m.visible=false;group.add(m);return {mesh:m,age:0,active:false};
  });
  let cursor=0,ringCursor=0,disposed=false;

  function spawn(x,y,z,color='#ffd04a'){
    if(disposed)return;
    const c=scratchColor.set(color),n=tier.perBurst;
    for(let k=0;k<n;k++){
      const slot=(cursor+k)%capacity;
      alive[slot]=1;age[slot]=0;
      ox[slot]=x;oy[slot]=y;oz[slot]=z;
      const angle=(k/n)*Math.PI*2+Math.random()*.6,speed=3.5+Math.random()*2.5;
      vx[slot]=Math.cos(angle)*speed;vz[slot]=Math.sin(angle)*speed;vy[slot]=3.2+Math.random()*1.1;
      baseColor[slot*3]=c.r;baseColor[slot*3+1]=c.g;baseColor[slot*3+2]=c.b;
    }
    cursor=(cursor+n)%capacity;
    const ring=rings[ringCursor];ringCursor=(ringCursor+1)%tier.rings;
    ring.mesh.position.set(x,.045,z);ring.mesh.material.color.set(color);ring.mesh.material.opacity=.85;
    ring.mesh.visible=true;ring.mesh.scale.setScalar(.4);ring.age=0;ring.active=true;
  }

  function update(dt,targetX=0,targetY=0,targetZ=0){
    if(disposed)return;
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
      const scale=alive[i]?Math.max(.15,fade):0;
      matrix.makeScale(scale,scale*(1.4+Math.sin(t*14+i)*.3),scale);
      matrix.setPosition(px,py,pz);points.setMatrixAt(i,matrix);
      scratchColor.setRGB(colors[o],colors[o+1],colors[o+2]);points.setColorAt(i,scratchColor);
    }
    points.instanceMatrix.needsUpdate=true;points.instanceColor.needsUpdate=true;
    for(const r of rings){
      if(!r.active)continue;
      r.age+=dt;const k=r.age/RING_LIFE;
      if(k>=1){r.active=false;r.mesh.visible=false;continue;}
      r.mesh.material.opacity=.85*(1-k);r.mesh.scale.setScalar(.4+k*1.6);
    }
  }
  function setQuality(next){
    tier=TIERS[next]||TIERS.high;
    alive.fill(0);matrix.makeScale(0,0,0);
    for(let i=0;i<capacity;i++)points.setMatrixAt(i,matrix);
    points.instanceMatrix.needsUpdate=true;
    for(const r of rings){r.active=false;r.mesh.visible=false;}
  }
  function dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();group.visible=false;
    points.dispose();pointsGeo.dispose();pointsMaterial.dispose();ringGeo.dispose();
    for(const r of rings)r.mesh.material.dispose();
  }
  return {group,spawn,update,dispose,setQuality,capacity,points,rings,get perBurst(){return tier.perBurst;},
    positions,alive};
}
