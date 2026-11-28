// @hot update spawn
// PRB-156 (Robert playtest 2026-11-15: "...same when you've picked up loot" -- the pickup burst read flat/2D).
// A pooled 3D pickup burst: sparkles pop up with gravity then home toward the player over ~0.7s, plus a ground
// flash ring, coloured by the item's rarity (caller passes the colour; rarity.js already owns that lookup).
// Fixed-capacity typed-array pool sized at construction -- spawn()/update() never grow an array or allocate a
// per-particle object, so a string of rapid pickups costs nothing beyond overwriting the oldest slot.
import * as THREE from './vendor/three.module.js';
import {softDotTexture} from './vfx-textures.js?v=2.28.82';

const GRAVITY=-9,GRAVITY_T=.28,TOTAL_T=.7,FADE_FROM=.86;
const RING_LIFE=.55;
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
  const pointsGeo=new THREE.OctahedronGeometry(.16,0);
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
  // Shared geometries and fixed per-burst slots: pillar and arrival flash never allocate on pickup.
  const pillarGeo=new THREE.CylinderGeometry(.12,.32,1.65,16,1,true);
  const flashGeo=new THREE.SphereGeometry(.22,8,6);
  for(const r of rings){
    const pillarMaterial=new THREE.ShaderMaterial({
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform vec3 uColor;uniform float uAlpha;varying vec2 vUv;
        void main(){gl_FragColor=vec4(uColor,uAlpha*(1.0-vUv.y));}`,
      uniforms:{uColor:{value:new THREE.Color()},uAlpha:{value:0}},
      transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,forceSinglePass:true,
      blending:THREE.AdditiveBlending,toneMapped:false});
    r.pillar=new THREE.Mesh(pillarGeo,pillarMaterial);r.pillar.visible=false;group.add(r.pillar);
    r.flash=new THREE.Mesh(flashGeo,new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,
      blending:THREE.AdditiveBlending,toneMapped:false}));r.flash.visible=false;group.add(r.flash);
  }
  let cursor=0,ringCursor=0,disposed=false;

  function spawn(x,y,z,color='#ffd04a'){
    if(disposed)return;
    const c=scratchColor.set(color),n=tier.perBurst,limit=tier.perBurst*tier.bursts;
    for(let k=0;k<n;k++){
      const slot=(cursor+k)%limit;
      alive[slot]=1;age[slot]=0;
      ox[slot]=x;oy[slot]=y;oz[slot]=z;
      const angle=(k/n)*Math.PI*2+Math.random()*.6,speed=3.5+Math.random()*2.5;
      vx[slot]=Math.cos(angle)*speed;vz[slot]=Math.sin(angle)*speed;vy[slot]=4.8+Math.random()*1.1;
      baseColor[slot*3]=c.r*1.8;baseColor[slot*3+1]=c.g*1.8;baseColor[slot*3+2]=c.b*1.8;
    }
    cursor=(cursor+n)%limit;
    const ring=rings[ringCursor];ringCursor=(ringCursor+1)%tier.rings;
    ring.mesh.position.set(x,.045,z);ring.mesh.material.color.set(color);ring.mesh.material.opacity=.85;
    ring.mesh.visible=true;ring.mesh.scale.setScalar(.4);ring.age=0;ring.active=true;
    ring.pillar.position.set(x,.85,z);ring.pillar.material.uniforms.uColor.value.copy(c);
    ring.pillar.material.uniforms.uAlpha.value=.9;ring.pillar.visible=true;
    ring.flash.material.color.copy(c);ring.flash.visible=false;
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
        px=apx+(targetX-apx)*ease;py=apy+(targetY-apy)*ease+Math.sin(s*Math.PI)*.45;pz=apz+(targetZ-apz)*ease;
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
      r.mesh.visible=k<1;
      r.mesh.material.opacity=.9*Math.max(0,1-k);r.mesh.scale.setScalar(.4+k*3.2);
      r.pillar.visible=r.age<.3;
      r.pillar.material.uniforms.uAlpha.value=.9*Math.max(0,1-r.age/.3);
      const arrival=(r.age-(TOTAL_T-.08))/.16;
      r.flash.visible=arrival>=0&&arrival<1;
      if(r.flash.visible){
        r.flash.position.set(targetX,targetY,targetZ);r.flash.scale.setScalar(.7+arrival*1.8);
        r.flash.material.opacity=1-arrival;
      }
      if(r.age>=TOTAL_T+.08){r.active=false;r.mesh.visible=false;r.pillar.visible=false;r.flash.visible=false;}
    }
  }
  function setQuality(next){
    tier=TIERS[next]||TIERS.high;cursor=0;ringCursor=0;
    alive.fill(0);matrix.makeScale(0,0,0);
    for(let i=0;i<capacity;i++)points.setMatrixAt(i,matrix);
    points.instanceMatrix.needsUpdate=true;
    for(const r of rings){r.active=false;r.mesh.visible=false;r.pillar.visible=false;r.flash.visible=false;}
  }
  function dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();group.visible=false;
    points.dispose();pointsGeo.dispose();pointsMaterial.dispose();ringGeo.dispose();
    pillarGeo.dispose();flashGeo.dispose();
    for(const r of rings){r.mesh.material.dispose();r.pillar.material.dispose();r.flash.material.dispose();}
  }
  return {group,spawn,update,dispose,setQuality,capacity,points,rings,get perBurst(){return tier.perBurst;},
    positions,alive};
}
