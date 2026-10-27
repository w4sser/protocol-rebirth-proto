// Archipelago renderer: procedural islands on dark water. Rooms render as islands,
// corridors as wooden piers, walls as clusters of chunky faceted boulders, crates stay
// crates, props become pines (town kit pine_tree.glb when loaded, else a cone stand-in), boats float offshore.
import * as THREE from './vendor/three.module.js';
import {rngFrom} from './art.js?v=2.3.3';
export const ARCH_PALETTE={water:'#17526b',waterDeep:'#06161f',sand:'#7a6d52',grass:'#3f5a3a',pier:'#6b4c32',post:'#3d2a1c',rock:'#7d838a',rockDark:'#646a71',crate:'#7a5a3a',hull:'#8a3b2e',hullTop:'#d8d2c0',foam:'#9fd6e0'};
import {archipelagoPassages,inPassageClearance,clearPassageProps} from './archipelago-passages.js?v=2.3.3';
export {archipelagoPassages} from './archipelago-passages.js?v=2.3.3';
// Check the transformed geometry, including rotated boats and supplied pine models.
export function propInPassage(object,passages){
  const b=new THREE.Box3().setFromObject(object);
  return inPassageClearance({x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,w:b.max.x-b.min.x,d:b.max.z-b.min.z},passages);
}
// Keep authoring walls and the initial placement clearances separate from runtime
// footprint colliders. Rebuilding a live level must not use moved actors or rocks as input.
const rockSources=new WeakMap();
function rockSource(level){
  let source=rockSources.get(level);
  if(!source||source.runtimeWalls!==level.walls){
    const reserve=(p,r)=>({x:p.x,z:p.z,w:r*2,d:r*2});
    source={runtimeWalls:level.walls,walls:level.walls.map(w=>Object.freeze({...w})),
      // A rotated chunky boulder's own half-extent can reach ~1.7m past its wall's nominal line
      // (DodecahedronGeometry(1,0), scale up to .8, worst-case rotation), regardless of how this
      // reservation is sized: clearRock always pushes a boulder fully outside it by the boulder's
      // own size. Loot boxes (unlike enemies/start/exit) can land only ~.6-1m off an authored
      // wall's thin line (levels.js's seeded fallback search only keeps them .6 clear of the thin,
      // pre-boulder wall footprint), so a reservation that size still lets a boulder get pushed to
      // hug the loot from the open side and re-pinch it. 1.8 keeps the loot clear of that reach.
      // Nodes carry their own live 1.4x1.4 collider (half-extent .7) plus a 1.8 interaction reach
      // (RULES.resources.nodeReach): a reservation of only .95 left ~.25m of clear boulder-free space
      // beyond the node's own box, far short of the .72m (player diameter) a boulder needs to leave
      // beside it for the .36-radius player to squeeze through and reach whatever lies past it. 1.8
      // matches loot's margin and leaves a clean lane on every side of the node and its approach.
      placements:[...(level.enemies??[]).map(e=>reserve(e,(e.r??.48)+.1)),
        ...(level.lootBoxes??[]).map(p=>reserve(p,1.8)),
        ...(level.nodes??[]).map(p=>reserve(p,1.8)),
        ...[level.start,level.exit].filter(Boolean).map(p=>reserve(p,.6))]};
    rockSources.set(level,source);
  }
  return source;
}
// Find the closest translation whose entire footprint clears all reserved rectangles.
// The nearest free point lies on an expanded rectangle edge (or at the original
// coordinate), so this finite search also handles intersecting reservations without
// the oscillation of repeated minimum-translation pushes.
function clearRock(mesh,reservations){
  const b=new THREE.Box3().setFromObject(mesh),x=(b.min.x+b.max.x)/2,z=(b.min.z+b.max.z)/2;
  const hw=(b.max.x-b.min.x)/2,hd=(b.max.z-b.min.z)/2;
  const blocked=(cx,cz)=>reservations.some(p=>Math.abs(cx-p.x)<p.w/2+hw&&Math.abs(cz-p.z)<p.d/2+hd);
  if(!blocked(x,z))return;
  const xs=[x],zs=[z];
  for(const p of reservations){xs.push(p.x-p.w/2-hw-.001,p.x+p.w/2+hw+.001);zs.push(p.z-p.d/2-hd-.001,p.z+p.d/2+hd+.001);}
  xs.sort((a,b)=>Math.abs(a-x)-Math.abs(b-x));zs.sort((a,b)=>Math.abs(a-z)-Math.abs(b-z));
  let best=Infinity,bx=x,bz=z;
  for(const cx of xs){
    if((cx-x)**2>=best)break;
    for(const cz of zs){
      const distance=(cx-x)**2+(cz-z)**2;if(distance>=best)break;
      if(!blocked(cx,cz)){best=distance;bx=cx;bz=cz;}
    }
  }
  mesh.position.x+=bx-x;mesh.position.z+=bz-z;
}
// Each visible rock owns its own exact AABB; empty space between displaced rocks
// is never filled by an enclosing cluster rectangle.
function buildRockWall(w,rng,reservations,rockGeo,rockMat,group,colliders){
  const alongX=w.w>w.d,len=Math.max(w.w,w.d),n=Math.max(1,Math.round(len/1.1)),boulders=[];
  for(let i=0;i<n;i++){
    const t=(i+.5)/n-.5,cx=w.x+(alongX?t*w.w:0),cz=w.z+(alongX?0:t*w.d);
    const s=.55+rng()*.25,h=Math.min(1.15,Math.max(.5,w.h))*(.8+rng()*.35);
    const m=new THREE.Mesh(rockGeo,rockMat[rng()<.5?0:1]);
    m.position.set(cx+(rng()-.5)*.15,h*.45,cz+(rng()-.5)*.15);
    m.scale.set(s,h,s*(.8+rng()*.4));m.rotation.set(rng()*.5,rng()*6.3,rng()*.5);
    m.castShadow=m.receiveShadow=true;m.name='archipelago-rock';
    clearRock(m,reservations);
    group.add(m);boulders.push(m);
  }
  for(const m of boulders){
    const b=new THREE.Box3().setFromObject(m);
    const collider={x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,w:b.max.x-b.min.x,d:b.max.z-b.min.z,h:b.max.y};
    colliders.push(collider);m.userData.collider=collider;
  }
  return boulders.length;
}
export function buildArchipelago(level,group,box,{pine=null,quality={props:1}}={}){
  const source=rockSource(level);
  const P=ARCH_PALETTE,rng=rngFrom(`${level.seed}:arch`),out={rocks:0,piers:0,boats:0,trees:0,passages:archipelagoPassages(level),rockColliders:level.walls};
  clearPassageProps(level,out.passages);
  const b=level.floors.reduce((a,f)=>({x0:Math.min(a.x0,f.x-f.w/2),x1:Math.max(a.x1,f.x+f.w/2),z0:Math.min(a.z0,f.z-f.d/2),z1:Math.max(a.z1,f.z+f.d/2)}),{x0:1e9,x1:-1e9,z0:1e9,z1:-1e9});
  const cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2,W=b.x1-b.x0+60,D=b.z1-b.z0+60;
  const water=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshStandardMaterial({color:P.water,roughness:.25,metalness:.35,transparent:true,opacity:.92}));
  water.rotation.x=-Math.PI/2;water.position.set(cx,-.35,cz);water.receiveShadow=true;water.name='water';group.add(water);
  const deep=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshBasicMaterial({color:P.waterDeep}));deep.rotation.x=-Math.PI/2;deep.position.set(cx,-1.2,cz);group.add(deep);
  const rockGeo=new THREE.DodecahedronGeometry(1,0),rockMat=[new THREE.MeshStandardMaterial({color:P.rock,roughness:1,flatShading:true}),new THREE.MeshStandardMaterial({color:P.rockDark,roughness:1,flatShading:true})];
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
  // Clearance includes the AI radius, so rock edges cannot catch an actor at either approach.
  // Piers/docks/bridges (corridor, dead-end and closet floors tagged with `dir`) need the same
  // margin along their whole walkway, not only at the room doorway they lead to: a boulder
  // cluster built on the thin rail wall flanking a pier can otherwise bulge into the plank path
  // anywhere along its length, not just at the ends.
  const piers=level.floors.filter(f=>f.dir).map(f=>({x:f.x,z:f.z,w:f.w+.96,d:f.d+.96}));
  // A partition's own gap is already a passage, but the long solid run either side of it is a
  // thin wall too: left alone it can bulge a boulder cluster across the full room width, a room
  // row over from the gap, sealing the node behind the partition off from the rest of the floor.
  // Widen the gap's passage into a strip across the whole row so nothing on that wall can do that.
  const partitions=(level.rooms??[]).filter(r=>r.partition).map(r=>{
    const gap=out.passages.find(p=>Math.abs(p.z-r.partition.z)<.05&&Math.abs(p.x-r.partition.x)<r.w);
    return gap&&{x:r.x,z:gap.z,w:r.w+.96,d:gap.d+.96};
  }).filter(Boolean);
  const colliders=[],reservations=[...out.passages.map(p=>({...p,w:p.w+.96,d:p.d+.96})),...piers,...partitions,...source.placements];
  for(const w of source.walls)out.rocks+=buildRockWall(w,rng,reservations,rockGeo,rockMat,group,colliders);
  // Preserve the array used by passage caching and callers, without mutating authoring walls.
  level.walls.splice(0,level.walls.length,...colliders);
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
