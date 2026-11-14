// Visual-only geology for Archipelago v2. No physics, navmesh or resource changes.
// Large forms are opaque, instanced, seeded and intentionally sparse on mobile.
import * as THREE from './vendor/three.module.js';
const TAU=Math.PI*2;
function hash(n){let x=(n|0)^0x9e3779b9;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
const graniteGeo=new THREE.IcosahedronGeometry(1,1);
const graniteMat=new THREE.MeshStandardMaterial({color:'#88849b',roughness:1,metalness:0,flatShading:true});
graniteGeo.userData.shared=true;graniteMat.userData.shared=true;
const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3();
const colors=['#777d8b','#888493','#6b7c82','#8c8798','#777b77'].map(c=>new THREE.Color(c));
export function addArchipelagoGraniteV2(profile,group,{high=true}={}){
  if(profile?.style!=='v2')return null;
  const n=profile.points.length, stride=high?4:7, count=Math.ceil(n/stride),floor=profile.floor;
  const stones=new THREE.InstancedMesh(graniteGeo,graniteMat,count);
  stones.name='arch-v2-glacial-shelves';stones.userData.visualOnly=true;
  for(let k=0;k<count;k++){
    const i=(k*stride)%n,p=profile.points[i],theta=p.angle,random=hash(profile.seed+29*i);
    const r=p.radial+1.00;
    pos.set(floor.x+Math.cos(theta)*r,-.24,floor.z+Math.sin(theta)*r);
    scale.set(.95+random*.9,.24+random*.19,.66+hash(i+profile.seed)*.72);
    rot.setFromAxisAngle(new THREE.Vector3(0,1,0),theta+.32*random);
    stones.setMatrixAt(k,matrix.compose(pos,rot,scale));
    stones.setColorAt(k,colors[(Math.floor(random*97)+k)%colors.length]);
  }
  stones.instanceMatrix.needsUpdate=true;
  if(stones.instanceColor)stones.instanceColor.needsUpdate=true;
  stones.castShadow=high;stones.receiveShadow=true;group.add(stones);
  return stones;
}
const portalMaterials=[
  new THREE.MeshStandardMaterial({color:'#4f555b',roughness:.98,flatShading:true}),
  new THREE.MeshStandardMaterial({color:'#171e27',roughness:1,flatShading:true}),
  new THREE.MeshStandardMaterial({color:'#70716e',roughness:1,flatShading:true}),
];
for(const m of portalMaterials)m.userData.shared=true;
const cubeGeo=new THREE.BoxGeometry(1,1,1);cubeGeo.userData.shared=true;
function block(parent,x,y,z,w,h,d,m){
  const o=new THREE.Mesh(cubeGeo,portalMaterials[m]);o.position.set(x,y,z);o.scale.set(w,h,d);o.receiveShadow=true;parent.add(o);return o;
}
// Target-island human trace. A sealed rock-cut portal, never an accessible door.
export function addArchipelagoTargetPortal(profile,group){
  if(profile?.style!=='v2')return null;
  const p=profile.points[Math.floor(profile.points.length*.66)];
  const g=new THREE.Group();
  g.name='arch-v2-rock-cut-portal';g.userData.visualOnly=true;
  const floor=profile.floor;
  g.position.set(floor.x+Math.cos(p.angle)*(p.radial+1.10),-.05,floor.z+Math.sin(p.angle)*(p.radial-.1));
  g.rotation.y=p.angle+Math.PI/2;
  block(g,0,.45,-.08,1.5,1.22,.28,1);
  block(g,-.82,.53,0,.32,1.38,.52,0);
  block(g,.82,.53,0,.32,1.38,.52,0);
  block(g,0,1.22,0,1.96,.28,.60,2);
  block(g,0,.55,-.245,1.21,1.04,.075,1);
  group.add(g);return g;
}
// Far skerries are mood/background forms, NOT additional playable land.
export function addArchipelagoHorizonIslets(floors,group,seed,{high=true}={}){
  const center=floors.filter(f=>!f.dir);
  if(!center.length)return [];
  const bounds=center.reduce((b,f)=>({x0:Math.min(b.x0,f.x-f.w/2),x1:Math.max(b.x1,f.x+f.w/2),z0:Math.min(b.z0,f.z-f.d/2),z1:Math.max(b.z1,f.z+f.d/2)}),{x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity});
  const midX=(bounds.x0+bounds.x1)/2,midZ=(bounds.z0+bounds.z1)/2,spread=Math.max(bounds.x1-bounds.x0,bounds.z1-bounds.z0)/2;
  const amount=high?5:3,objs=[];
  for(let i=0;i<amount;i++){
    const a=TAU*(i+.17+hash(seed+i)*.14)/amount;
    const dist=spread+23+hash(i+seed)*14;
    const rock=new THREE.Mesh(graniteGeo,graniteMat);
    rock.position.set(midX+Math.cos(a)*dist,-.42,midZ+Math.sin(a)*dist);
    rock.scale.set(3+hash(seed+i+11)*2.2,.46,2.1+hash(seed+i+27)*2);
    rock.name='arch-v2-distant-skerry';rock.userData.visualOnly=true;
    rock.receiveShadow=false;rock.castShadow=false;group.add(rock);objs.push(rock);
  }
  return objs;
}
