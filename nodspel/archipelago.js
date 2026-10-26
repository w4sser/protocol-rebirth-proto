// Archipelago renderer: procedural islands on dark water. Rooms render as islands,
// corridors as wooden piers, walls as faceted rock clusters with matching ground footprints, crates stay
// crates, props become pines (town kit pine_tree.glb when loaded, else a cone stand-in), boats float offshore.
import * as THREE from './vendor/three.module.js';
import {rngFrom} from './art.js?v=2.1.0';
export const ARCH_PALETTE={water:'#17526b',waterDeep:'#06161f',sand:'#7a6d52',grass:'#3f5a3a',pier:'#6b4c32',post:'#3d2a1c',rock:'#7d838a',rockDark:'#646a71',crate:'#7a5a3a',hull:'#8a3b2e',hullTop:'#d8d2c0',foam:'#9fd6e0'};
import {archipelagoPassages,inPassageClearance,clearPassageProps} from './archipelago-passages.js?v=2.1.0';
export {archipelagoPassages} from './archipelago-passages.js?v=2.1.0';
// Check the transformed geometry, including rotated boats and supplied pine models.
export function propInPassage(object,passages){
  const b=new THREE.Box3().setFromObject(object);
  return inPassageClearance({x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,w:b.max.x-b.min.x,d:b.max.z-b.min.z},passages);
}
// Rectangular ground footprint EXACTLY equals the existing wall collider. Faceted crowns
// stay inside it, so randomized silhouettes cannot overhang a walkable opening.
function rockWallGeometry(w,rng,passages){
  const alongX=w.w>w.d,len=alongX?w.w:w.d,n=Math.max(1,Math.ceil(len/.9)),vertices=[];
  const tri=(a,b,c)=>vertices.push(...a,...b,...c);
  for(let i=0;i<n;i++){
    const lo=-len/2+i*len/n,hi=-len/2+(i+1)*len/n;
    const cx=w.x+(alongX?(lo+hi)/2:0),cz=w.z+(alongX?0:(lo+hi)/2);
    const near=passages.some(p=>Math.abs(cx-p.x)<p.w/2+.9&&Math.abs(cz-p.z)<p.d/2+.9);
    const h=Math.min(w.h,near?.48:1.15)*(.85+rng()*.15),shoulder=h*.55;
    const x0=alongX?lo:-w.w/2,x1=alongX?hi:w.w/2,z0=alongX?-w.d/2:lo,z1=alongX?w.d/2:hi;
    const base=[[x0,0,z0],[x0,0,z1],[x1,0,z1],[x1,0,z0]],rim=base.map(([x,,z])=>[x,shoulder,z]);
    const peak=[(x0+x1)/2+(rng()-.5)*(x1-x0)*.3,h,(z0+z1)/2+(rng()-.5)*(z1-z0)*.3];
    for(let j=0;j<4;j++){const k=(j+1)%4;tri(base[j],base[k],rim[k]);tri(base[j],rim[k],rim[j]);tri(rim[j],rim[k],peak);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
}
export function buildArchipelago(level,group,box,{pine=null,quality={props:1}}={}){
  const P=ARCH_PALETTE,rng=rngFrom(`${level.seed}:arch`),out={rocks:0,piers:0,boats:0,trees:0,passages:archipelagoPassages(level),rockColliders:level.walls};
  clearPassageProps(level,out.passages);
  const b=level.floors.reduce((a,f)=>({x0:Math.min(a.x0,f.x-f.w/2),x1:Math.max(a.x1,f.x+f.w/2),z0:Math.min(a.z0,f.z-f.d/2),z1:Math.max(a.z1,f.z+f.d/2)}),{x0:1e9,x1:-1e9,z0:1e9,z1:-1e9});
  const cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2,W=b.x1-b.x0+60,D=b.z1-b.z0+60;
  const water=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshStandardMaterial({color:P.water,roughness:.25,metalness:.35,transparent:true,opacity:.92}));
  water.rotation.x=-Math.PI/2;water.position.set(cx,-.35,cz);water.receiveShadow=true;water.name='water';group.add(water);
  const deep=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshBasicMaterial({color:P.waterDeep}));deep.rotation.x=-Math.PI/2;deep.position.set(cx,-1.2,cz);group.add(deep);
  const rockMat=[new THREE.MeshStandardMaterial({color:P.rock,roughness:1,flatShading:true}),new THREE.MeshStandardMaterial({color:P.rockDark,roughness:1,flatShading:true})];
  for(const f of level.floors){
    if(f.dir){ // pier: planks + posts
      box(f.x,-.08,f.z,f.w,.16,f.d,P.pier);
      const along=f.dir.x?'x':'z',len=along==='x'?f.w:f.d;
      for(let t=-len/2+.6;t<len/2;t+=1.4)for(const s of [-1,1]){const px=along==='x'?f.x+t:f.x+s*(f.w/2-.1),pz=along==='x'?f.z+s*(f.d/2-.1):f.z+t;box(px,-.4,pz,.16,.7,.16,P.post);}
      out.piers++;continue;}
    // island: grass top, sand rim, irregular shore blobs below the walkable edge
    box(f.x,-.2,f.z,f.w,.4,f.d,P.grass);
    box(f.x,-.32,f.z,f.w+1.2,.3,f.d+1.2,P.sand);
    for(let k=0;k<8;k++){const a=rng()*Math.PI*2,r=new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,.3,10),new THREE.MeshStandardMaterial({color:P.sand,roughness:1}));
      r.scale.set(1.5+rng()*2,1,1.5+rng()*2);r.position.set(f.x+Math.cos(a)*f.w*.5,-.36,f.z+Math.sin(a)*f.d*.5);group.add(r);}
  }
  for(const p of out.passages){
    const path=box(p.x,.012,p.z,p.w,.024,p.d,P.sand);path.name='archipelago-passage';path.userData.clearance=p;
  }
  for(const w of level.walls){
    const m=new THREE.Mesh(rockWallGeometry(w,rng,out.passages),rockMat[rng()<.5?0:1]);
    m.position.set(w.x,0,w.z);m.name='archipelago-rock';m.userData.collider=w;
    m.castShadow=m.receiveShadow=true;group.add(m);out.rocks++;
  }
  for(const c of level.boxes){const g=new THREE.Group();g.name='archipelago-crate';g.userData.collider=c;box(c.x,c.h/2,c.z,c.w,c.h,c.d,P.crate,g);box(c.x,c.h+.02,c.z,c.w*.9,.04,c.d*.9,'#a07a50',g);group.add(g);}
  // boats offshore (visual only, never collidable)
  for(let k=0;k<3;k++){const a=rng()*Math.PI*2,r=Math.max(b.x1-b.x0,b.z1-b.z0)/2+5+rng()*5,g=new THREE.Group();
    g.position.set(cx+Math.cos(a)*r,-.3,cz+Math.sin(a)*r);g.rotation.y=rng()*6.3;
    box(0,.2,0,1.4,.45,3.4,P.hull,g);box(0,.47,0,1.2,.08,3.1,P.hullTop,g);box(0,.75,-.4,.8,.5,.9,'#c8c2b0',g);g.name='boat';if(!propInPassage(g,out.passages)){group.add(g);out.boats++;}}
  return out;
}
// Pine tree: instanced town-kit parts when available, else a stylised cone (same footprint).
export function pineTree(spot,box,rng,pine){
  const g=new THREE.Group();g.position.set(spot.x,0,spot.z);const s=.55+rng()*.3;
  if(pine)for(const p of pine){const m=new THREE.Mesh(p.geometry,p.material);m.applyMatrix4(p.matrix);g.add(m);m.castShadow=true;}
  else{box(0,.4,0,.18,.8,.18,'#4a3424',g);const c=new THREE.Mesh(new THREE.ConeGeometry(.7,1.8,7),new THREE.MeshStandardMaterial({color:'#2f4d36',roughness:.9,flatShading:true}));c.position.y=1.5;c.castShadow=true;g.add(c);}
  g.scale.setScalar(s);g.rotation.y=rng()*6.3;g.name='pine';return g;
}
