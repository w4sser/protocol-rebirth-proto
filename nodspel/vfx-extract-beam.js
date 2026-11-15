// @hot update
// PRB-156 (Robert playtest 2026-11-15: "the extraction point effect looks damn 2D"). A 3D-reading
// extraction-point VFX: a volumetric light-beam cylinder (custom shader: vertical fade, fresnel rim,
// scrolling noise bands), a ground decal (glow pad + pulse rings + dark contact ring, all sharing the
// one procedural soft-dot texture from vfx-textures.js) and GPU-cheap rising particles. Pure cosmetics:
// never reads or writes round/level state beyond the {open,progress} the caller computes from existing
// gameplay data -- the extraction radius/logic stay in round.js/levels.js, untouched.
import * as THREE from './vendor/three.module.js';
import {softDotTexture} from './vfx-textures.js?v=2.28.32';

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
  float fresnel=pow(1.0-clamp(dot(normalize(vNormalV),normalize(vViewDir)),0.0,1.0),2.0);
  float rim=mix(0.32,1.0,fresnel);
  float bands=1.0;
  if(uNoise>0.5){
    float scroll=vUv.y*9.0-uTime*0.55;
    bands=mix(0.72,1.0,0.5+0.5*sin(scroll*6.2831853));
  }
  float alpha=heightFade*rim*bands*uIntensity;
  gl_FragColor=vec4(uColor*(0.55+rim*0.7),alpha);
}`;

function makeBeamMaterial(noise){
  return new THREE.ShaderMaterial({
    vertexShader:beamVert,fragmentShader:beamFrag,transparent:true,depthWrite:false,depthTest:true,
    side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,
    uniforms:{uColor:{value:new THREE.Color('#3FE0D0')},uTime:{value:0},uIntensity:{value:0},uNoise:{value:noise?1:0}},
  });
}

// Quality tiers: low drops the scrolling noise bands (a shader branch, not a texture) and halves the particle count.
const TIERS={low:{particles:40,noise:false,height:3.2},high:{particles:72,noise:true,height:6}};

export function createExtractBeam({color='#3FE0D0',quality='high'}={}){
  const tier=TIERS[quality]||TIERS.high;
  const dot=softDotTexture();
  const group=new THREE.Group();
  const padGeo=new THREE.CircleGeometry(1.45,40);
  const pad=new THREE.Mesh(padGeo,new THREE.MeshBasicMaterial({map:dot,color,transparent:true,opacity:0,
    blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  pad.rotation.x=-Math.PI/2;pad.position.y=.022;group.add(pad);
  const contactGeo=new THREE.RingGeometry(1.45,2.05,40);
  const contact=new THREE.Mesh(contactGeo,new THREE.MeshBasicMaterial({map:dot,color:'#020b0a',transparent:true,opacity:0,
    depthWrite:false,side:THREE.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));
  contact.rotation.x=-Math.PI/2;contact.position.y=.02;group.add(contact);
  const pulseGeo=new THREE.RingGeometry(.9,1.12,40);
  const pulseRings=[0,1].map(()=>{
    const m=new THREE.Mesh(pulseGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
    m.rotation.x=-Math.PI/2;m.position.y=.03;group.add(m);return m;
  });
  const beamGeo=new THREE.CylinderGeometry(.85,1.15,1,24,1,true);
  const beamMaterial=makeBeamMaterial(tier.noise);
  beamMaterial.uniforms.uColor.value.set(color);
  const beam=new THREE.Mesh(beamGeo,beamMaterial);
  beam.scale.y=tier.height;beam.position.y=tier.height/2;group.add(beam);
  // Rising particles: per-particle seed/radius/rise speed baked once; update() only rewrites positions/colors
  // in place (no per-frame allocation) from a time uniform-like scalar passed into update().
  const count=tier.particles;
  const seed=new Float32Array(count),radius0=new Float32Array(count),rise=new Float32Array(count),ang0=new Float32Array(count);
  for(let i=0;i<count;i++){seed[i]=Math.random();radius0[i]=.25+Math.random()*.75;rise[i]=.55+Math.random()*.5;ang0[i]=Math.random()*Math.PI*2;}
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const pointsGeo=new THREE.BufferGeometry();
  pointsGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  pointsGeo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const pointsMaterial=new THREE.PointsMaterial({map:dot,size:.22,sizeAttenuation:true,vertexColors:true,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const points=new THREE.Points(pointsGeo,pointsMaterial);points.frustumCulled=false;group.add(points);
  const col=new THREE.Color(color);
  let open=false;
  // @hot update
  function update(time,{open:isOpen=false,progress=0}={}){
    open=isOpen;
    pad.visible=contact.visible=beam.visible=points.visible=open;
    for(const r of pulseRings)r.visible=open;
    if(!open)return;
    const warm=.55+progress*.6;
    pad.material.opacity=.3+progress*.22+Math.sin(time*3)*.05;
    contact.material.opacity=.4+progress*.1;
    for(let i=0;i<2;i++){const k=(time*.7+i*.5)%1;pulseRings[i].scale.setScalar(.7+k*.9);pulseRings[i].material.opacity=.8*(1-k);}
    beamMaterial.uniforms.uTime.value=time;beamMaterial.uniforms.uIntensity.value=warm;
    const speed=1+progress*1.5,maxHeight=tier.height*.92;
    for(let i=0;i<count;i++){
      const t=(time*rise[i]*speed+seed[i]*maxHeight)%maxHeight,k2=t/maxHeight;
      const a=ang0[i]+time*(.8+speed*.5)+seed[i]*3;
      const r=radius0[i]*(1-.2*k2)*.85;
      const o=i*3;
      positions[o]=Math.cos(a)*r;positions[o+1]=t;positions[o+2]=Math.sin(a)*r;
      const b=(1-k2)*(.6+progress*.4);
      colors[o]=col.r*b;colors[o+1]=col.g*b;colors[o+2]=col.b*b;
    }
    pointsGeo.attributes.position.needsUpdate=true;pointsGeo.attributes.color.needsUpdate=true;
  }
  function dispose(){
    padGeo.dispose();contactGeo.dispose();pulseGeo.dispose();beamGeo.dispose();pointsGeo.dispose();
    pad.material.dispose();contact.material.dispose();for(const r of pulseRings)r.material.dispose();
    beamMaterial.dispose();pointsMaterial.dispose();
  }
  return {group,update,dispose,isOpen:()=>open,
    pad,contact,pulseRings,beam,beamMaterial,points,particleCount:count,noise:tier.noise};
}
