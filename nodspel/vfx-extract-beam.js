// @hot update
// PRB-156 (Robert playtest 2026-11-15: "the extraction point effect looks damn 2D"). A 3D-reading
// extraction-point VFX: a volumetric light-beam cylinder (custom shader: vertical fade, fresnel rim,
// scrolling noise bands), a ground decal (glow pad + pulse rings + dark contact ring, all sharing the
// one procedural soft-dot texture from vfx-textures.js) and GPU-cheap rising particles. Pure cosmetics:
// never reads or writes round/level state beyond the {open,progress} the caller computes from existing
// gameplay data -- the extraction radius/logic stay in round.js/levels.js, untouched.
import * as THREE from './vendor/three.module.js';
import {EXTRACT_COLOR,PALETTE} from './art.js?v=2.28.50';
import {softDotTexture} from './vfx-textures.js?v=2.28.50';

const beamVert=`
varying vec2 vUv;varying vec3 vNormalV;varying vec3 vViewDir;
void main(){
  vUv=uv;
  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
  vNormalV=normalize(normalMatrix*normal);
  vViewDir=normalize(-mvPosition.xyz);
  gl_Position=projectionMatrix*mvPosition;
}`;
const beamFrag=`
uniform vec3 uColor;uniform float uTime;uniform float uIntensity;uniform float uNoise;
varying vec2 vUv;varying vec3 vNormalV;varying vec3 vViewDir;
void main(){
  float heightFade=1.0-smoothstep(0.0,1.0,vUv.y);
  float fresnel=pow(1.0-clamp(abs(dot(normalize(vNormalV),normalize(vViewDir))),0.0,1.0),2.0);
  float rim=mix(0.035,1.8,fresnel);
  float bands=0.0;
  if(uNoise>0.5){
    // Three slanted energy ribbons wrap continuously around the tapered cylinder.
    float wrap=vUv.x*3.0-vUv.y*.65+uTime*.16;
    bands=pow(0.5+0.5*cos(wrap*6.2831853),18.0);
  }
  float alpha=heightFade*(rim+bands*.65*uNoise)*uIntensity;
  gl_FragColor=vec4(uColor*(0.8+rim*.5),alpha);
}`;

function makeBeamMaterial(noise){
  return new THREE.ShaderMaterial({
    vertexShader:beamVert,fragmentShader:beamFrag,transparent:true,depthWrite:false,depthTest:true,
    side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,toneMapped:false,
    uniforms:{uColor:{value:new THREE.Color(EXTRACT_COLOR)},uTime:{value:0},uIntensity:{value:0},uNoise:{value:noise?1:0}},
  });
}

// Quality tiers: low drops the scrolling noise bands (a shader branch, not a texture) and halves the particle count.
const TIERS={low:{particles:40,noise:false,height:3.2},high:{particles:72,noise:true,height:6}};

export function createExtractBeam({color=EXTRACT_COLOR,quality='high'}={}){
  let tier=TIERS[quality]||TIERS.high;
  const dot=softDotTexture();
  const group=new THREE.Group();
  const padGeo=new THREE.RingGeometry(.45,1.45,40);
  const pad=new THREE.Mesh(padGeo,new THREE.MeshBasicMaterial({map:dot,color,transparent:true,opacity:0,
    blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  pad.rotation.x=-Math.PI/2;pad.position.y=.022;group.add(pad);
  const contactGeo=new THREE.RingGeometry(1.45,2.05,40);
  const contact=new THREE.Mesh(contactGeo,new THREE.MeshBasicMaterial({map:dot,color:PALETTE.bg,transparent:true,opacity:0,
    depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));
  contact.rotation.x=-Math.PI/2;contact.position.y=.02;group.add(contact);
  const rimGeo=new THREE.RingGeometry(1.10,1.19,48);
  const rim=new THREE.Mesh(rimGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,
    depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,toneMapped:false}));
  rim.rotation.x=-Math.PI/2;rim.position.y=.035;group.add(rim);
  const fenceGeo=new THREE.CylinderGeometry(1.15,1.15,.25,48,1,true);
  const fenceMaterial=new THREE.ShaderMaterial({vertexShader:beamVert,fragmentShader:`
    uniform vec3 uColor;varying vec2 vUv;
    void main(){gl_FragColor=vec4(uColor,(1.0-vUv.y)*(1.0-vUv.y)*.8);}`,
    uniforms:{uColor:{value:new THREE.Color(color)}},transparent:true,depthWrite:false,depthTest:true,
    side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,toneMapped:false});
  const fence=new THREE.Mesh(fenceGeo,fenceMaterial);fence.position.y=.15;group.add(fence);
  const pulseGeo=new THREE.RingGeometry(.9,1.02,40);
  const pulseRings=[0].map(()=>{
    const m=new THREE.Mesh(pulseGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-5}));
    m.rotation.x=-Math.PI/2;m.position.y=.03;group.add(m);return m;
  });
  const beamGeo=new THREE.CylinderGeometry(.78,1.15,1,48,1,true);
  const beamMaterial=makeBeamMaterial(tier.noise);
  beamMaterial.uniforms.uColor.value.set(color);
  const beam=new THREE.Mesh(beamGeo,beamMaterial);
  beam.scale.y=tier.height;beam.position.y=tier.height/2;group.add(beam);
  const coreGeo=new THREE.CylinderGeometry(.12,.22,1,24,1,true);
  const coreMaterial=makeBeamMaterial(false);coreMaterial.uniforms.uColor.value.set(color);
  const core=new THREE.Mesh(coreGeo,coreMaterial);
  core.scale.y=tier.height*.88;core.position.y=core.scale.y/2;group.add(core);
  // Rising particles: per-particle seed/radius/rise speed baked once; update() only rewrites positions/colors
  // in place (no per-frame allocation) from a time uniform-like scalar passed into update().
  const count=TIERS.high.particles;
  const seed=new Float32Array(count),radius0=new Float32Array(count),rise=new Float32Array(count),ang0=new Float32Array(count);
  for(let i=0;i<count;i++){seed[i]=Math.random();radius0[i]=.65+Math.random()*.8;rise[i]=.55+Math.random()*.5;ang0[i]=Math.random()*Math.PI*2;}
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const pointsGeo=new THREE.BufferGeometry();
  pointsGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  pointsGeo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const pointsMaterial=new THREE.PointsMaterial({map:dot,size:5,sizeAttenuation:true,vertexColors:true,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const points=new THREE.Points(pointsGeo,pointsMaterial);points.frustumCulled=false;group.add(points);
  const col=new THREE.Color(color);
  let open=false,disposed=false,lastTime=null,phase=0;
  pointsGeo.setDrawRange(0,tier.particles);
  group.visible=false;
  // @hot update
  function update(time,isOpen=false,progress=0){
    if(disposed)return;
    const dt=lastTime===null?0:Math.max(0,Math.min(.1,time-lastTime));lastTime=time;
    phase+=dt*(1+progress*1.5);
    open=isOpen;group.visible=open;
    pad.visible=contact.visible=beam.visible=core.visible=fence.visible=rim.visible=points.visible=open;
    for(const r of pulseRings)r.visible=open;
    if(!open)return;
    const warm=.55+progress*.6;
    pad.material.opacity=.3+progress*.22+Math.sin(time*3)*.05;
    contact.material.opacity=.4+progress*.1;
    for(let i=0;i<pulseRings.length;i++){const k=(time/1.2)%1;pulseRings[i].scale.setScalar(.7+k*.9);pulseRings[i].material.opacity=.8*(1-k);}
    beamMaterial.uniforms.uTime.value=time;beamMaterial.uniforms.uIntensity.value=warm;
    coreMaterial.uniforms.uIntensity.value=warm*1.8;
    const maxHeight=tier.height*.92;
    for(let i=0;i<tier.particles;i++){
      const t=(phase*rise[i]+seed[i]*maxHeight)%maxHeight,k2=t/maxHeight;
      const a=ang0[i]+phase*1.1+seed[i]*3;
      const r=radius0[i]*(1-.2*k2)*.85;
      const o=i*3;
      positions[o]=Math.cos(a)*r;positions[o+1]=t;positions[o+2]=Math.sin(a)*r;
      const b=(1-k2)*(1.6+progress*.6);
      colors[o]=col.r*b;colors[o+1]=col.g*b;colors[o+2]=col.b*b;
    }
    pointsGeo.attributes.position.needsUpdate=true;pointsGeo.attributes.color.needsUpdate=true;
  }
  function setQuality(next){
    tier=TIERS[next]||TIERS.high;
    pointsGeo.setDrawRange(0,tier.particles);beamMaterial.uniforms.uNoise.value=tier.noise?1:0;
    beam.scale.y=tier.height;beam.position.y=tier.height/2;
    core.scale.y=tier.height*.88;core.position.y=core.scale.y/2;
  }
  function dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();group.visible=false;
    padGeo.dispose();contactGeo.dispose();pulseGeo.dispose();beamGeo.dispose();pointsGeo.dispose();
    pad.material.dispose();contact.material.dispose();for(const r of pulseRings)r.material.dispose();
    beamMaterial.dispose();pointsMaterial.dispose();
    coreGeo.dispose();coreMaterial.dispose();fenceGeo.dispose();fenceMaterial.dispose();rimGeo.dispose();rim.material.dispose();
  }
  update(0);
  return {group,update,dispose,setQuality,isOpen:()=>open,
    pad,contact,pulseRings,beam,beamMaterial,points,core,fence,rim,get particleCount(){return tier.particles;},get noise(){return tier.noise;}};
}
