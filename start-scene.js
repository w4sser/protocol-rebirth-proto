// The Long Nordic Night: a fixed shore camera, procedural dusk and a quiet sea.
// Medium/high retain their pixel ratio caps; low/no-WebGL uses the CSS fallback.
import * as THREE from './nodspel/vendor/three.module.js';

function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function mountStartFlight(host, profile = {}, {onFail} = {}){
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});
  if(renderer.debug)renderer.debug.onShaderError=()=>{throw new Error('Start scene shader unavailable');};
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,profile.pixelRatioCap||1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x897b9e,0.0019);
  const camera=new THREE.PerspectiveCamera(48,1,0.1,2200);
  camera.position.set(0,3.2,12);
  camera.lookAt(0,5.2,-110);
  const clock={value:0},rng=random(219);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(1800,24,12),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,uniforms:{time:clock},
    vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 direction;uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec3 d=normalize(direction);float h=max(0.,d.y);
        vec3 horizon=vec3(.25,.18,.34),pink=vec3(.50,.25,.40),top=vec3(.30,.18,.38);
        vec3 col=mix(horizon,pink,smoothstep(0.,.28,h));col=mix(col,top,smoothstep(.3,.9,h));
        vec2 p=vec2(atan(d.x,-d.z)*2.+time*.001,h*32.);
        float cloud=noise(p)+.35*noise(p*2.1);float veil=smoothstep(.49,.9,cloud)*smoothstep(.01,.12,h);
        col=mix(col,vec3(.16,.13,.26),veil*.32);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`
  }));scene.add(sky);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800,1,1),new THREE.ShaderMaterial({
    uniforms:{time:clock},
    vertexShader:`varying vec3 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform float time;varying vec3 world;
      void main(){float depth=length(world.xz-vec2(0.,12.));
        float ripple=sin(world.z*7.+sin(world.x*.65+time*.18)*1.4-time*.65);
        ripple+=.45*sin(world.z*16.+world.x*1.7-time*.47);
        float fine=sin(world.z*34.+sin(world.x*4.)-time*.7);
        float waveFade=1.-smoothstep(.5,3.,fwidth(world.z*7.));
        float fineFade=1.-smoothstep(.5,3.,fwidth(world.z*34.));
        vec3 near=vec3(.014,.014,.030),far=vec3(.20,.12,.25);
        vec3 col=mix(near,far,1.-exp(-depth*.028));
        col+=vec3(.032,.023,.032)*(ripple*.35*waveFade+fine*.10*fineFade)*exp(-depth*.002);
        col+=vec3(.023,.013,.015)*sin(world.x*.035+.9)*(1.-exp(-depth*.02));
        float edge=1.+world.x*.24;
        float lap=exp(-pow((world.z-edge+sin(time*.65)*.22)*3.,2.));
        col+=vec3(.07,.06,.09)*lap*(.65+.35*sin(world.x*4.+time));
        col=mix(col,vec3(.25,.18,.34),smoothstep(170.,850.,depth));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`
  }));water.rotation.x=-Math.PI/2;scene.add(water);
  scene.add(new THREE.HemisphereLight(0xb9a0c4,0x101320,1.3));
  const light=new THREE.DirectionalLight(0xe4b4c8,.6);light.position.set(-30,35,10);scene.add(light);
  const silhouette=new THREE.MeshBasicMaterial({color:0x4a4662});
  const rockGeo=new THREE.IcosahedronGeometry(1,1);
  function mesh(geometry,material,x,y,z,sx=1,sy=1,sz=1,parent=scene){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  function island(x,z){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
    for(let i=0;i<24;i++){const u=i/23;mesh(rockGeo,silhouette,(u-.5)*105,0, (rng()-.5)*6,4+rng()*4,.8+Math.sin(u*Math.PI)*2.4+rng(),4+rng()*3,g);}
    return g;
  }
  const left=island(-130,-260),right=island(130,-267);
  mesh(new THREE.CylinderGeometry(1.25,1.7,12,8),silhouette,0,7.8,0,1,1,1,left);
  mesh(new THREE.CylinderGeometry(1.8,1.8,1.7,8),silhouette,0,14.3,0,1,1,1,left);
  mesh(new THREE.ConeGeometry(2.1,1.6,8),silhouette,0,15.9,0,1,1,1,left);
  mesh(new THREE.BoxGeometry(2.5,8,2.5),silhouette,0,5,0,1,1,1,right);
  // A shallow open paraboloid with its face tilted skyward, plus feed arm.
  const dishGeo=new THREE.LatheGeometry(Array.from({length:9},(_,i)=>{const r=i*.8;return new THREE.Vector2(r,r*r*.07);}),24);
  const dishMat=new THREE.MeshBasicMaterial({color:0x514a68,side:THREE.DoubleSide});
  const dish=mesh(dishGeo,dishMat,0,10,0,1,1,1,right);dish.rotation.set(1.1,0,-.55);
  mesh(new THREE.CylinderGeometry(.14,.14,9,5),silhouette,2,11.5,3,1,1,1,right).rotation.set(1.1,0,-.55);
  const shoreMat=new THREE.MeshStandardMaterial({color:0x181c29,roughness:.43,metalness:.18});
  // An underlying bank closes the gaps; instancing keeps the pebble shore one draw call.
  const bank=mesh(new THREE.PlaneGeometry(110,65),shoreMat,0,.02,33);bank.rotation.x=-Math.PI/2;bank.rotation.z=-.235;
  const count=profile.name==='high'?1800:1100,pebbles=new THREE.InstancedMesh(rockGeo,shoreMat,count),dummy=new THREE.Object3D();
  for(let i=0;i<count;i++){
    const x=(rng()-.5)*44,z=1+x*.24+rng()*12,r=.18+rng()*.34;
    dummy.position.set(x,.035+r*.25,z);dummy.scale.set(r,r*(.35+rng()*.3),r*(.7+rng()*.6));dummy.rotation.set(rng()*.2,rng()*6.28,rng()*.2);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
  }scene.add(pebbles);
  let dead=false,raf=0,start=performance.now();
  const still=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const resize=()=>{if(dead)return;const w=host.clientWidth||innerWidth,h=host.clientHeight||innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const render=now=>{if(dead)return;try{clock.value=still?0:(now-start)/1000;renderer.render(scene,camera);if(!still)raf=requestAnimationFrame(render);}catch(error){dispose();onFail?.(error);}};
  function dispose(){if(dead)return;dead=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();}
  window.addEventListener('resize',resize);resize();render(start);
  return {dispose,land(callback){callback?.();}};
}
