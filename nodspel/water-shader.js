// Lightweight archipelago water (free, no paid libs). One mesh, one draw call, no render targets.
// Look: depth-tinted colour (turquoise shallows -> dark Nordic deep), soft shoreline foam band,
// two scrolling procedural ripple layers, fresnel sky tint, optional faint caustics (quality flag).
// Shore distance is baked ONCE at load into a small DataTexture from the level's island rectangles
// (CPU, signed rect distance) - no depth prepass, no simulation.
import * as THREE from './vendor/three.module.js';

export const WATER_COLORS={shallow:'#1d6a72',mid:'#17526b',deep:'#06161f',foam:'#9fd6e0',sky:'#5f7f92'};
const MAX_DIST=9; // world units of shore gradient encoded in the texture
// Preview coastlines supply polygons; default levels still supply rectangles.
// Point-to-segment distances are baked once on CPU, never in the water shader.
function polygonShoreDistance(x,z,points){
  let inside=false,best=MAX_DIST*MAX_DIST;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/Math.max(1e-8,dx*dx+dz*dz)));
    const sx=x-(a.x+t*dx),sz=z-(a.z+t*dz);
    best=Math.min(best,sx*sx+sz*sz);
    if((a.z>z)!==(b.z>z) && x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside?0:Math.sqrt(best);
}

// Bake distance-to-land (0 at land edge .. 1 at MAX_DIST) into a single-channel texture.
export function bakeShoreTexture(rects,bounds,{texelsPerUnit=2,maxSize=256}={}){
  const {x0,z0,w,d}=bounds;
  const sx=Math.max(8,Math.min(maxSize,Math.ceil(w*texelsPerUnit))),sz=Math.max(8,Math.min(maxSize,Math.ceil(d*texelsPerUnit)));
  const data=new Uint8Array(sx*sz);
  for(let j=0;j<sz;j++){const z=z0+(j+.5)/sz*d;
    for(let i=0;i<sx;i++){const x=x0+(i+.5)/sx*w;let best=MAX_DIST;
      for(let k=0;k<rects.length;k++){const r=rects[k];
        let dist;
        if(r.points?.length>=3){
          dist=polygonShoreDistance(x,z,r.points);
        }else{
          const dx=Math.max(Math.abs(x-r.x)-r.w/2,0),dz=Math.max(Math.abs(z-r.z)-r.d/2,0);
          dist=Math.sqrt(dx*dx+dz*dz)-(r.round||0);
        }
        if(dist<best)best=dist;
      }
      data[j*sx+i]=Math.round(Math.max(0,Math.min(1,best/MAX_DIST))*255);}}
  const tex=new THREE.DataTexture(data,sx,sz,THREE.RedFormat,THREE.UnsignedByteType);
  tex.magFilter=tex.minFilter=THREE.LinearFilter;tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;tex.needsUpdate=true;
  return tex;
}

const vert=`
varying vec2 vUv;varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.);vWorld=wp.xyz;
  vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
const frag=`
uniform sampler2D shoreMap;uniform float time;uniform vec3 cShallow,cMid,cDeep,cFoam,cSky;uniform float caustics;
varying vec2 vUv;varying vec3 vWorld;
#include <fog_pars_fragment>
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
vec2 grad(vec2 p){float e=.15;float c=vn(p);return vec2(vn(p+vec2(e,0))-c,vn(p+vec2(0,e))-c)/e;}
void main(){
  float sd=texture2D(shoreMap,vUv).r; // 0 shore .. 1 open water
  vec2 p=vWorld.xz;
#ifdef WATER_LITE
  vec2 g=grad(p*.8+vec2(time*.06,time*.04));
#else
  vec2 g=grad(p*.55+vec2(time*.06,time*.04))*.6+grad(p*1.3-vec2(time*.05,-time*.08))*.4;
#endif
  vec3 N=normalize(vec3(-g.x*.35,1.,-g.y*.35));
  vec3 V=normalize(vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2]));
  float depth=smoothstep(0.,1.,sd);
  vec3 col=mix(cShallow,cMid,smoothstep(0.,.35,depth));col=mix(col,cDeep,smoothstep(.3,1.,depth));
  float fres=pow(1.-max(dot(N,V),0.),3.);col=mix(col,cSky,clamp(fres*1.6,0.,.55));
  vec3 L=normalize(vec3(.4,.8,.3));float spec=pow(max(dot(reflect(-L,N),V),0.),40.);col+=spec*.18*vec3(1.,.9,.75);
  if(caustics>.5){vec2 q=p*1.4+g*.8;float c=abs(sin(q.x+time*.7)*sin(q.y*1.1-time*.6));c=pow(1.-c,6.);col+=c*.10*(1.-smoothstep(.05,.3,sd))*cShallow;}
  float dw=sd*${MAX_DIST.toFixed(1)}; // world units from land
  float n=vn(p*1.7+time*.15);
  float band=1.-smoothstep(.0,.45+n*.35,dw);
  float stripe=smoothstep(.55,.9,sin(dw*5.-time*1.6+n*3.)*.5+.5)*(1.-smoothstep(.4,1.6,dw));
  col=mix(col,cFoam,clamp(band*.6+stripe*.18,0.,.6));
  gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;

// rects: island/pier footprints {x,z,w,d,round?}; bounds: {x0,z0,w,d}; quality: {caustics:bool}
export function createWaterMesh(rects,bounds,{caustics=false,lite=false,y=-.35}={}){
  const shore=bakeShoreTexture(rects,bounds);
  const C=c=>new THREE.Color(c);
  const mat=new THREE.ShaderMaterial({vertexShader:vert,fragmentShader:frag,fog:true,defines:lite?{WATER_LITE:''}:{},
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0},caustics:{value:caustics?1:0}}])});
  Object.assign(mat.uniforms,{shoreMap:{value:shore},cShallow:{value:C(WATER_COLORS.shallow)},cMid:{value:C(WATER_COLORS.mid)},cDeep:{value:C(WATER_COLORS.deep)},cFoam:{value:C(WATER_COLORS.foam)},cSky:{value:C(WATER_COLORS.sky)}});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(bounds.w,bounds.d),mat);
  mesh.rotation.x=-Math.PI/2;mesh.position.set(bounds.x0+bounds.w/2,y,bounds.z0+bounds.d/2);
  // PlaneGeometry uv.y runs +z -> -z after the rotation; flip so uv matches bake rows (z0 at v=0).
  const uv=mesh.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
  const t0=typeof performance!=='undefined'?performance.now():0,u=mat.uniforms.time;
  mesh.onBeforeRender=()=>{u.value=((performance.now()-t0)/1000)%3600;};
  mesh.userData.shoreTexture=shore;mesh.userData.waterShader=true;
  return mesh;
}
