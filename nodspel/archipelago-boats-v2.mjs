// Opt-in Archipelago v2 coastal dinghies.
// Plan on the actual organic coastline, not the rectangular level bounds.
// Boats are visual-only; there are no new colliders or gameplay affordances.
import * as THREE from './vendor/three.module.js';
const TAU=Math.PI*2;
const BOAT_RADIUS=1.85; // conservative bound for a 3.2m x 1.3m open dinghy
const SHORE_MARGIN=.48;
function unit(n){let x=(n|0)^0x9e3779b9;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
function seedInt(s){let x=2166136261;for(const char of String(s))x=Math.imul(x^char.charCodeAt(0),16777619);return x>>>0;}
function segmentDistance(x,z,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/Math.max(1e-8,dx*dx+dz*dz)));
  return Math.hypot(x-(a.x+t*dx),z-(a.z+t*dz));
}
// Signed distance in world units: negative inside land, positive in water.
// Identical coastline vertices to the water shader's polygon shore input.
export function distanceToIsland(x,z,points){
  let inside=false,min=Infinity;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i];
    min=Math.min(min,segmentDistance(x,z,a,b));
    if((a.z>z)!==(b.z>z) && x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside?-min:min;
}
function distanceToPier(x,z,floor){
  const dx=Math.max(Math.abs(x-floor.x)-floor.w/2,0);
  const dz=Math.max(Math.abs(z-floor.z)-floor.d/2,0);
  return Math.hypot(dx,dz);
}
export function planArchipelagoBoatsV2(profiles,floors,levelSeed,{maxBoats=3,bounds=null}={}){
  if(!profiles?.length)return [];
  const boats=[],piers=floors.filter(f=>f.dir),seed=seedInt(levelSeed);
  const minShore=BOAT_RADIUS+SHORE_MARGIN;
  function free(x,z){
    if(bounds&&(x<bounds.x0+minShore||x>bounds.x0+bounds.w-minShore
      ||z<bounds.z0+minShore||z>bounds.z0+bounds.d-minShore))return false;
    if(profiles.some(p=>distanceToIsland(x,z,p.points)<minShore))return false;
    if(piers.some(f=>distanceToPier(x,z,f)<minShore))return false;
    if(boats.some(b=>Math.hypot(x-b.x,z-b.z)<BOAT_RADIUS*2+1.4))return false;
    return true;
  }
  // A nearshore choice on each attempt, but never a presumed "offshore"
  // circle around the entire map (which can land on another island).
  for(let slot=0;slot<Math.min(3,Math.max(0,maxBoats));slot++){
    for(let trial=0;trial<100;trial++){
      const k=seed+slot*1907+trial*349;
      const profile=profiles[Math.floor(unit(k+51)*profiles.length)];
      const index=Math.floor(unit(k+71)*profile.points.length),p=profile.points[index];
      // Allow all shore types, favoring sheltered coves on some slots.
      if(slot===0&&trial<45&&p.beach<.22)continue;
      const a=p.angle,off=2.8+unit(k+97)*2.0;
      const x=p.x+Math.cos(a)*off,z=p.z+Math.sin(a)*off;
      if(!free(x,z))continue;
      const rotation=a+Math.PI/2+(unit(k+117)-.5)*.24; // bow runs along shore
      boats.push({x,z,rotation,shoreDistance:Math.min(...profiles.map(q=>distanceToIsland(x,z,q.points)))});
      break;
    }
  }
  return boats;
}
// A tapered open hull with a distinct pointed bow, flared sides, interior and
// wooden thwarts. Shared geometry/materials: ~4 draw calls per little boat.
const outline=[
  [0,1.63],[.36,1.35],[.57,.88],[.66,.12],[.64,-.82],[.49,-1.50],
  [-.49,-1.50],[-.64,-.82],[-.66,.12],[-.57,.88],[-.36,1.35]
];
function buildDinghyHull(){
  const positions=[],colors=[],indices=[],n=outline.length;
  const deep=new THREE.Color('#384f5b'),side=new THREE.Color('#62777b');
  const lip=new THREE.Color('#a09a87'),inside=new THREE.Color('#3f5051');
  const layers=[
    {scale:1,y:.23,tint:lip},
    {scale:.94,y:-.08,tint:side},
    {scale:.54,y:-.34,tint:deep},
    {scale:.84,y:.18,tint:inside},
    {scale:.61,y:.04,tint:inside}
  ];
  for(let layer=0;layer<layers.length;layer++)for(let j=0;j<n;j++){
    const [x,z]=outline[j],l=layers[layer],v=1+(j%3-1)*.035;
    positions.push(x*l.scale,l.y,z*l.scale);
    colors.push(l.tint.r*v,l.tint.g*v,l.tint.b*v);
  }
  function connect(a,b){for(let j=0;j<n;j++){
    const k=(j+1)%n,u=a*n+j,v=a*n+k,w=b*n+j,t=b*n+k;
    indices.push(u,w,v,v,w,t);
  }}
  connect(0,1);connect(1,2);connect(0,3);connect(3,4);
  // Close the interior and keel so the water shader does not show through it.
  const cap=positions.length/3;positions.push(0,.035,0);colors.push(inside.r,inside.g,inside.b);
  for(let j=0;j<n;j++)indices.push(cap,4*n+j,4*n+(j+1)%n);
  const keel=positions.length/3;positions.push(0,-.36,0);colors.push(deep.r,deep.g,deep.b);
  for(let j=0;j<n;j++)indices.push(keel,2*n+(j+1)%n,2*n+j);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();geo.userData.shared=true;
  return geo;
}
const hullGeo=buildDinghyHull();
const hullMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:0,flatShading:true,side:THREE.DoubleSide});
const benchGeo=new THREE.BoxGeometry(1,1,1);
const benchMat=new THREE.MeshStandardMaterial({color:'#888273',roughness:1});
const motorMat=new THREE.MeshStandardMaterial({color:'#353d40',roughness:.9});
for(const part of [hullGeo,hullMat,benchGeo,benchMat,motorMat])part.userData.shared=true;
export function createArchipelagoDinghyV2(placement){
  const g=new THREE.Group();g.name='arch-v2-coastal-dinghy';g.userData.visualOnly=true;
  g.position.set(placement.x,-.35,placement.z);g.rotation.y=placement.rotation;
  const hull=new THREE.Mesh(hullGeo,hullMat);hull.name='arch-v2-tapered-hull';hull.castShadow=true;hull.receiveShadow=true;g.add(hull);
  for(const z of [-.74,.38]){
    const seat=new THREE.Mesh(benchGeo,benchMat);seat.position.set(0,.125,z);
    seat.scale.set(z<0?1.03:.87,.075,.22);seat.receiveShadow=true;g.add(seat);
  }
  const engine=new THREE.Mesh(benchGeo,motorMat);
  engine.position.set(0,.25,-1.50);engine.scale.set(.30,.35,.24);
  engine.castShadow=true;g.add(engine);
  return g;
}
