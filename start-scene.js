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
  scene.fog=new THREE.FogExp2(0x8a80a8,0.0019);
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
      void main(){
        // Project onto the fixed camera's view plane: latitude bands bend on a dome.
        vec2 p=direction.xy/max(.01,-direction.z);float h=max(0.,p.y);
        vec3 horizon=vec3(.27,.22,.39),pink=vec3(.50,.25,.40),top=vec3(.13,.08,.25);
        vec3 col=mix(horizon,pink,smoothstep(0.,.20,h));col=mix(col,top,smoothstep(.23,.53,h));
        float cloud=0.;
        for(int i=0;i<6;i++){
          float fi=float(i),seed=fi*17.3;
          float drift=p.x+time*.002;
          float warp=noise(vec2(drift*2.3+seed,fi+8.));
          float center=.055+fi*.079+(hash(vec2(fi,3.))-.5)*.070;
          center+=(warp-.5)*.040;
          float line=p.y+p.x*(.018+hash(vec2(fi,6.))*.025)-center;
          float width=mix(.009,.038,hash(vec2(fi,4.)))*mix(.6,1.5,warp);
          float across=line/width;
          float streak=exp(-across*across);
          float along=(drift-(hash(vec2(fi,9.))-.5)*1.4)/(.28+hash(vec2(fi,7.))*.8);
          float lengthMask=exp(-along*along*along*along);
          float breakup=smoothstep(.30,.66,noise(vec2(drift*5.1+seed,fi*3.7)));
          float feather=mix(.65,1.,noise(vec2(drift*15.+seed,p.y*35.)));
          cloud+=streak*lengthMask*breakup*feather*(.24+.18*hash(vec2(fi,2.)));
        }
        col=mix(col,vec3(.16,.12,.28),min(.55,cloud));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`
  }));scene.add(sky);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800,1,1),new THREE.ShaderMaterial({
    uniforms:{time:clock},
    vertexShader:`varying vec3 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform float time;varying vec3 world;
      void main(){float depth=length(world.xz-vec2(0.,12.));
        float ripple=sin(world.z*4.3+sin(world.x*.65+time*.18)*1.4-time*.65);
        ripple+=.45*sin(world.z*16.+world.x*1.7-time*.47);
        float fine=sin(world.z*34.+sin(world.x*4.)-time*.7);
        float waveFade=1.-smoothstep(.5,3.,fwidth(world.z*4.3));
        float fineFade=1.-smoothstep(.5,3.,fwidth(world.z*34.));
        vec3 near=vec3(.014,.014,.030),far=vec3(.20,.12,.25);
        vec3 col=mix(near,far,1.-exp(-depth*.028));
        col+=vec3(.032,.023,.032)*(ripple*.35*waveFade+fine*.10*fineFade)*exp(-depth*.002);
        col+=vec3(.023,.013,.015)*sin(world.x*.035+.9)*(1.-exp(-depth*.02));
        // The bank and pebble instances share this exact shoreline equation.
        float edge=-3.+world.x*.5;
        float shoreDistance=edge-world.z;
        float wash=sin(time*.65)*.22;
        float lap=exp(-pow((shoreDistance-.16-wash)*4.,2.));
        float foamBreak=.55+.25*sin(world.x*2.3+time*.4)+.15*sin(world.x*7.1);
        col+=vec3(.13,.12,.16)*lap*foamBreak;
        for(int i=0;i<3;i++){
          float fi=float(i);
          float crestDistance=shoreDistance-(1.5+fi*2.7)+sin(world.x*.38+fi)*.13+sin(time*.45+fi)*.18;
          float crest=exp(-pow(crestDistance/(.09+fi*.025),2.));
          float broken=.55+.45*sin(world.x*.7+fi*3.);
          col+=vec3(.045,.04,.06)*crest*broken;
        }
        col=mix(col,vec3(.25,.18,.34),smoothstep(170.,850.,depth));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`
  }));water.rotation.x=-Math.PI/2;scene.add(water);
  scene.add(new THREE.HemisphereLight(0xb9a0c4,0x101320,1.3));
  const light=new THREE.DirectionalLight(0xe4b4c8,.6);light.position.set(-30,35,10);scene.add(light);
  const silhouette=new THREE.MeshBasicMaterial({color:0x484968});
  const rockGeo=new THREE.IcosahedronGeometry(1,1);
  function mesh(geometry,material,x,y,z,sx=1,sy=1,sz=1,parent=scene){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  function island(x,z){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
    for(let i=0;i<24;i++){const u=i/23;mesh(rockGeo,silhouette,(u-.5)*105,0, (rng()-.5)*6,4+rng()*4,.8+Math.sin(u*Math.PI)*2.4+rng(),4+rng()*3,g);}
    return g;
  }
  const left=island(-130,-260),right=island(130,-267);
  left.scale.set(1.14,1.28,1.1);right.scale.set(1.14,1.28,1.1);
  mesh(new THREE.CylinderGeometry(1.25,1.7,12,8),silhouette,0,7.8,0,1,1,1,left);
  mesh(new THREE.CylinderGeometry(1.8,1.8,1.7,8),silhouette,0,14.3,0,1,1,1,left);
  mesh(new THREE.ConeGeometry(2.1,1.6,8),silhouette,0,15.9,0,1,1,1,left);
  mesh(new THREE.BoxGeometry(2.5,8,2.5),silhouette,0,5,0,1,1,1,right);
  // A shallow open paraboloid with its face tilted skyward, plus feed arm.
  const dishGeo=new THREE.LatheGeometry(Array.from({length:9},(_,i)=>{const r=i*.8;return new THREE.Vector2(r,r*r*.07);}),24);
  const dishMat=new THREE.MeshBasicMaterial({color:0x505475,side:THREE.DoubleSide});
  const dish=mesh(dishGeo,dishMat,0,10,0,1,1,1,right);dish.rotation.set(1.1,0,-.55);
  mesh(new THREE.CylinderGeometry(.14,.14,9,5),silhouette,2,11.5,3,1,1,1,right).rotation.set(1.1,0,-.55);
  const shoreMat=new THREE.MeshStandardMaterial({color:0x343442,roughness:.94,metalness:0});
  // Separate wet ground from the lit stones so exposed gaps stay dark at every density.
  const bankMat=new THREE.MeshBasicMaterial({color:0x15121d});
  // A polygon ends precisely at z = -3 + x * .5; no dry bank under the open sea.
  const bankGeo=new THREE.BufferGeometry();
  bankGeo.setAttribute('position',new THREE.Float32BufferAttribute([
    -45,.012,-25.5, -45,.012,55, 45,.012,19.5,
    45,.012,19.5, -45,.012,55, 45,.012,55
  ],3));bankGeo.computeVertexNormals();mesh(bankGeo,bankMat,0,0,0);
  // Low-poly granite and one instanced draw keep the denser shore inexpensive.
  const pebbleGeo=new THREE.IcosahedronGeometry(1,0);
  const count=profile.name==='high'?6000:4200,pebbles=new THREE.InstancedMesh(pebbleGeo,shoreMat,count),dummy=new THREE.Object3D();
  const stoneColor=new THREE.Color();
  for(let i=0;i<count;i++){
    const x=(rng()-.5)*44,inland=Math.pow(rng(),1.6)*16,z=-3+x*.5+inland;
    const r=(.055+rng()*.10)*(.65+Math.min(inland,10)*.075);
    dummy.position.set(x,.025+r*.24,z);dummy.scale.set(r,r*(.35+rng()*.25),r*(.75+rng()*.5));dummy.rotation.set(rng()*.3,rng()*6.28,rng()*.3);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
    const shade=.72+rng()*.4;stoneColor.setRGB(shade,shade*.98,shade*1.04);pebbles.setColorAt(i,stoneColor);
  }scene.add(pebbles);
  let dead=false,raf=0,start=performance.now();
  const still=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const resize=()=>{if(dead)return;const w=host.clientWidth||innerWidth,h=host.clientHeight||innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const render=now=>{if(dead)return;try{clock.value=still?0:(now-start)/1000;renderer.render(scene,camera);if(!still)raf=requestAnimationFrame(render);}catch(error){dispose();onFail?.(error);}};
  function dispose(){if(dead)return;dead=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();}
  window.addEventListener('resize',resize);resize();render(start);
  return {dispose,land(callback){callback?.();}};
}
