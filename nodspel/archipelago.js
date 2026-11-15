// Archipelago renderer: procedural islands on dark water. Rooms render as islands,
// corridors as wooden piers, walls as clusters of chunky faceted boulders, crates stay
// crates, props become pines (town kit pine_tree.glb when loaded, else a cone stand-in), boats float offshore.
import * as THREE from './vendor/three.module.js';
import {rngFrom} from './art.js?v=2.28.39';
// v2.10.0 mood pass: grass was desaturated enough to read grey-green under fog; lifted back toward a real green.
export const ARCH_PALETTE={water:'#17526b',waterDeep:'#06161f',sand:'#7a6d52',grass:'#7b8b42',pier:'#6b4c32',post:'#3d2a1c',rock:'#7c7e97',rockDark:'#62627f',crate:'#7a5a3a',hull:'#8a3b2e',hullTop:'#d8d2c0',foam:'#9fd6e0'};
import {archipelagoPassages,inPassageClearance,clearPassageProps} from './archipelago-passages.js?v=2.28.39';
export {archipelagoPassages} from './archipelago-passages.js?v=2.28.39';
import {createWaterMesh} from './water-shader.js?v=2.28.39-baltic-calm3';
import {coastlineProfile,coastRingData,separateArchipelagoCoastProfiles,authorHeroIslandCoast} from './coastline.mjs?v=2.28.39-glacial-s42';
import {registerWalkableCoast} from './archipelago-playable.mjs?v=2.28.39-organic-v2';
import {planArchipelagoBedrock,addArchipelagoGraniteV2,addArchipelagoGroundV2,addArchipelagoTargetPortal,addArchipelagoTargetShed,addArchipelagoHorizonIslets} from './archipelago-visual-v2.mjs?v=2.28.39-glacial-merge1';
import {bridgeClearances} from './bridge-flow.mjs?v=2.28.39-bridge1';
import {planBridgeDeck} from './bridge-deck.mjs?v=timber-v1';
import {planArchipelagoBoatsV2,createArchipelagoDinghyV2} from './archipelago-boats-v2.mjs?v=2.28.39-dinghy2';
// Check the transformed geometry, including rotated boats and supplied pine models.
export function propInPassage(object,passages){
  const b=new THREE.Box3().setFromObject(object);
  return inPassageClearance({x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,w:b.max.x-b.min.x,d:b.max.z-b.min.z},passages);
}
// Deck planks are instanced by wood shade, so detail scales without one draw call per board.
const BRIDGE_CUBE=new THREE.BoxGeometry(1,1,1);
BRIDGE_CUBE.userData.shared=true; // world.dispose traverses per-level meshes
const BRIDGE_PLANK_MATS=['#8B8173','#A09481','#756E64','#9C917E']
  .map(color=>{
    const material=new THREE.MeshStandardMaterial({color,roughness:.96,metalness:0,flatShading:true});
    material.userData.shared=true;
    return material;
  });
function buildTimberPier(f,seed,quality,group,box){
  const high=(quality?.props??1)>=1;
  const plan=planBridgeDeck(f,seed,{quality:high?'high':'low'});
  if(!plan)return;
  const alongX=plan.along==='x',width=plan.width,len=plan.length;
  // A dark, narrow understructure shows between individual weathered boards.
  // It changes no logical floor or collider and does not create a physical gap.
  box(f.x,-.11,f.z,f.w,.16,f.d,'#3E423F');
  for(const side of [-1,1]){
    const cross=side*(width/2-.08);
    box(alongX?f.x:f.x+cross,-.22,alongX?f.z+cross:f.z,
      alongX?len:.18,.22,alongX?.18:len,'#554F47');
  }
  // Cross timbers and thick, low pilings sit beyond the walkable edges.
  // No railing or new collider pinches player / enemy approach lanes.
  for(let i=0;i<plan.supports.length;i+=2){
    const t=plan.supports[i].t;
    box(alongX?f.x+t:f.x,-.31,alongX?f.z:f.z+t,
      alongX?.24:width+.32,.21,alongX?width+.32:.24,'#514B44');
  }
  for(const s of plan.supports){
    const x=alongX?f.x+s.t:f.x+s.side*(width/2+.27);
    const z=alongX?f.z+s.side*(width/2+.27):f.z+s.t;
    box(x,-.42,z,.30,1.15,.30,'#47443D');
    box(x,.19,z,.35,.09,.35,'#8B8071');
  }
  const rot=new THREE.Quaternion(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3();
  for(let tone=0;tone<BRIDGE_PLANK_MATS.length;tone++){
    const parts=plan.planks.filter(p=>p.tone===tone);
    if(!parts.length)continue;
    const mesh=new THREE.InstancedMesh(BRIDGE_CUBE,BRIDGE_PLANK_MATS[tone],parts.length);
    for(let i=0;i<parts.length;i++){
      const p=parts[i];
      position.set(alongX?f.x+p.t:f.x+p.cross,.028,alongX?f.z+p.cross:f.z+p.t);
      scale.set(alongX?p.length:p.width,.09,alongX?p.width:p.length);
      mesh.setMatrixAt(i,matrix.compose(position,rot,scale));
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=high;mesh.receiveShadow=true;
    mesh.name='archipelago-timber-planks';mesh.userData.visualOnly=true;
    group.add(mesh);
  }
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
// V2 keeps only actual authored interior partitions as rock cover.
// Shore walls and bridge rails are obsolete with organic actor coastlines.
export function isArchipelagoPartitionWallV2(w,rooms=[]){
  return rooms.some(r=>r.partition
    &&Math.abs(w.z-r.partition.z)<.12
    &&Math.abs(w.x-r.x)<r.w/2+.15
    &&w.w>.65&&w.d<=.65
    &&Math.abs(w.z-r.z)<r.d/2-.3);
}
// All islands remain an untouched natural archipelago. Man-made structures
// belong only to the bunker / utility installation, not scattered as cover.
// Small, partially buried granite erratics and fallen coastal pines provide
// honest, low silhouettes for planar X/Z combat and retain exact cover AABBs.
const V2_COVER_STONE=new THREE.DodecahedronGeometry(1,1);
V2_COVER_STONE.userData.shared=true;
const V2_COVER_STONE_MAT=[
  new THREE.MeshStandardMaterial({color:'#858a90',roughness:.98,metalness:0,flatShading:true}),
  new THREE.MeshStandardMaterial({color:'#99939c',roughness:.98,metalness:0,flatShading:true})
];
for(const mat of V2_COVER_STONE_MAT)mat.userData.shared=true;
const V2_FALLEN_LOG=new THREE.CylinderGeometry(.32,.38,1,7,1);
V2_FALLEN_LOG.userData.shared=true;
const V2_BARK_MAT=new THREE.MeshStandardMaterial({color:'#665b4e',roughness:1,flatShading:true});
V2_BARK_MAT.userData.shared=true;
const V2_ROOT_MAT=new THREE.MeshStandardMaterial({color:'#514a40',roughness:1,flatShading:true});
V2_ROOT_MAT.userData.shared=true;

// One clearly visible natural obstacle per authored cover collider. Preserve
// rect coordinates for gameplay; no invisible enclosing wall or new vertical
// terrain. Returns a Group with userData.collider and organicCover metadata.
function naturalCoverV2(rect,{kind='boulder',tone=0}={}){
  const g=new THREE.Group();
  const h=Math.max(.62,rect.h??.95);
  const longX=rect.w>=rect.d;
  g.position.set(rect.x,0,rect.z);
  g.name=kind==='windfall'?'arch-v2-fallen-pine-cover':'arch-v2-granite-boulder-cover';
  g.userData.naturalCover=true;
  g.userData.coverKind=kind;
  g.userData.collider=rect;
  g.userData.visualHeight=h;
  if(kind==='windfall'){
    const diameter=Math.min(rect.w,rect.d)*.86;
    const length=Math.max(rect.w,rect.d)*.89;
    const trunk=new THREE.Mesh(V2_FALLEN_LOG,V2_BARK_MAT);
    trunk.position.y=diameter*.43;
    trunk.rotation[longX?'z':'x']=Math.PI*.5;
    trunk.scale.set(diameter/.76,length,diameter/.76);
    trunk.castShadow=trunk.receiveShadow=true;
    g.add(trunk);
    const roots=new THREE.Mesh(V2_COVER_STONE,V2_ROOT_MAT);
    roots.position.set(longX?-length*.30:0,diameter*.39,longX?0:-length*.30);
    roots.scale.set(diameter*.36,Math.min(h*.46,diameter*.46),diameter*.35);
    roots.castShadow=roots.receiveShadow=true;g.add(roots);
    // A short broken branch reads as windfall rather than a cylinder crate.
    const broken=new THREE.Mesh(V2_FALLEN_LOG,V2_BARK_MAT);
    broken.position.set(longX?length*.15:diameter*.14,diameter*.73,
      longX?diameter*.14:length*.15);
    broken.rotation[longX?'x':'z']=.43;
    broken.scale.set(diameter*.16,diameter*.52,diameter*.16);
    broken.castShadow=true;g.add(broken);
  }else{
    const stone=new THREE.Mesh(V2_COVER_STONE,V2_COVER_STONE_MAT[tone%2]);
    stone.position.y=h*.44;
    // Horizontal scale and height are restrained: this is an isolated erratic,
    // not a mountain or a raised traversable island landform.
    stone.scale.set(rect.w*.52,h*.49,rect.d*.52);
    stone.rotation.y=tone%2===0?.07:-.09;
    stone.castShadow=stone.receiveShadow=true;g.add(stone);
  }
  return g;
}
const overlapsRect=(a,b,pad=0)=>Math.abs(a.x-b.x)<(a.w+b.w)*.5+pad
  &&Math.abs(a.z-b.z)<(a.d+b.d)*.5+pad;

// The existing navigation clearance is too short for visual mountains: an
// isometric camera should see a clear approach for several metres beyond both
// ends of a timber bridge. Reserve that space for all large geological masses.
export function archipelagoRockFreeBridgeLandingsV2(bridgeZones){
  return bridgeZones.map(b=>({
    x:b.x,z:b.z,
    w:b.w+(b.dir?.x?8:2.2),
    d:b.d+(b.dir?.z?8:2.2),
    dir:b.dir
  }));
}

function buildInteriorCoverV2(w,group,colliders,bridgeLandings=[]){
  const alongX=w.w>=w.d,len=Math.max(w.w,w.d);
  const axis=alongX?'x':'z',across=alongX?'z':'x';
  const crossExtent=alongX?w.d:w.w;
  // Clip each authored partition's blocking footprint against the REAL
  // bridge landing. The earlier all-or-nothing overlap check deleted complete
  // level-two cover runs even if only 20 cm touched the landing.
  let safe=[[-len/2,len/2]];
  for(const z of bridgeLandings){
    const zoneCross=alongX?z.d:z.w;
    const margin=.50;
    if(Math.abs(w[across]-z[across])>=(crossExtent+zoneCross)*.5+margin)continue;
    const mid=z[axis]-w[axis],half=(alongX?z.w:z.d)*.5+margin;
    safe=safe.flatMap(([low,high])=>{
      if(mid-half>=high||mid+half<=low)return [[low,high]];
      const rest=[];
      if(mid-half>low)rest.push([low,Math.min(high,mid-half)]);
      if(mid+half<high)rest.push([Math.max(low,mid+half),high]);
      return rest;
    });
  }
  let placed=0;
  for(const [low,high] of safe){
    const span=high-low;
    if(span<1.08)continue;
    const pieces=span>5.7?2:1;
    for(let i=0;i<pieces;i++){
      const offset=low+span*(i+.5)/pieces;
      const pieceLength=Math.min(2.15,span/pieces*.76);
      // Stagger a small pair of natural obstacles instead of painting
      // a straight stone or concrete barrier across the island.
      const stagger=pieces===2?(i===0?-.28:.28):0;
      const crossWidth=Math.max(.72,Math.min(1.04,(alongX?w.d:w.w)+.42));
      const rect={
        x:w.x+(alongX?offset:stagger),
        z:w.z+(alongX?stagger:offset),
        w:alongX?pieceLength:crossWidth,
        d:alongX?crossWidth:pieceLength
      };
      if(bridgeLandings.some(z=>overlapsRect(rect,z,.28)))continue;
      const h=Math.max(.80,Math.min(1.08,w.h??1.05));
      const collider={...rect,h};
      const kind=pieces===2&&i===1?'windfall':'boulder';
      const mesh=naturalCoverV2(collider,{kind,tone:placed});
      // This visual matches the replacement collider by construction; nothing
      // else is left from the old straight authored partition wall.
      colliders.push(collider);group.add(mesh);placed++;
    }
  }
  return placed;
}
// Sparse decorative shoreline rocks (visual only, no collider): seeded, irregular, some clusters,
// nudged outward onto the sand/water side of the edge and skipped if they touch any reservation.
function shoreRocks(shore,islands,rng,reservations,rockGeo,rockMat,group){
  let n=0;
  for(const w of shore){
    const ax=w.w>w.d,len=Math.max(w.w,w.d),f=islands.find(f=>ax?Math.abs(Math.abs(w.z-f.z)-f.d/2)<.6:Math.abs(Math.abs(w.x-f.x)-f.w/2)<.6);
    const out=f?Math.sign(ax?w.z-f.z:w.x-f.x)||1:1;
    for(let t=-len/2+rng()*4;t<len/2;t+=3+rng()*7){
      if(rng()<.45)continue;
      const k=rng()<.35?2+Math.floor(rng()*2):1;
      for(let i=0;i<k;i++){
        const s=.22+rng()*.3,m=new THREE.Mesh(rockGeo,rockMat[rng()<.5?0:1]);
        const tt=t+(i?(rng()-.5)*1.4:0),off=out*(.35+rng()*.6);
        m.position.set(w.x+(ax?tt:off),s*.25-.12,w.z+(ax?off:tt));
        m.scale.set(s,s*(.6+rng()*.5),s*(.8+rng()*.4));m.rotation.set(rng()*.5,rng()*6.3,rng()*.5);
        const b=new THREE.Box3().setFromObject(m);
        if(reservations.some(p=>b.max.x>p.x-p.w/2&&b.min.x<p.x+p.w/2&&b.max.z>p.z-p.d/2&&b.min.z<p.z+p.d/2))continue;
        m.castShadow=m.receiveShadow=true;m.name='archipelago-shore-rock';group.add(m);n++;
      }
    }
  }
  return n;
}
// Visual-only rock scatter follows the actual, seeded coastline rather than the
// rectangular authoring walls. It never contributes gameplay colliders.
function coastRocks(profiles,rng,reservations,rockGeo,rockMat,group){
  let count=0;
  for(const profile of profiles.values()){
    const points=profile.points,n=points.length;
    const goal=Math.min(32,Math.max(9,Math.round(profile.totalLength/3.8)));
    const jitter=Math.floor(rng()*n);
    for(let i=0;i<goal;i++){
      const index=(Math.floor((i+.45)*n/goal)+jitter)%n;
      const p=points[index];
      if(p.beach>.30 || rng()<.21)continue;
      const clusters=(rng()<.23)?2:1;
      for(let j=0;j<clusters;j++){
        const q=points[(index+j*2)%n];
        if(q.beach>.40)continue;
        const scale=.32+rng()*.40,mesh=new THREE.Mesh(rockGeo,rockMat[rng()<.55?0:1]);
        mesh.position.set(q.x+(rng()-.5)*.46,-.05+scale*.17,q.z+(rng()-.5)*.46);
        mesh.scale.set(scale,scale*(.55+rng()*.55),scale*(.8+rng()*.4));
        mesh.rotation.set(rng()*.30,rng()*6.3,rng()*.30);
        const bounds=new THREE.Box3().setFromObject(mesh);
        if(reservations.some(p=>bounds.max.x>p.x-p.w/2&&bounds.min.x<p.x+p.w/2&&bounds.max.z>p.z-p.d/2&&bounds.min.z<p.z+p.d/2))continue;
        mesh.name='archipelago-coast-rock';
        mesh.castShadow=mesh.receiveShadow=true;
        group.add(mesh);count++;
      }
    }
  }
  return count;
}
export function buildArchipelago(level,group,box,{pine=null,quality={props:1},militaryStyle=false}={}){
  const source=rockSource(level);
  const P=ARCH_PALETTE,rng=rngFrom(`${level.seed}:arch`),out={rocks:0,piers:0,boats:0,trees:0,passages:archipelagoPassages(level),rockColliders:level.walls};
  // Ground pass (default-on since v2.28.0, ?ground=0 disables) shifts its legacy grass backup away from the new
  // textured surface. On iOS, the old 4mm gap + positive polygon offset allowed
  // Safari to depth-test the flat green base in front of the textured overlay.
  const options=typeof location!=='undefined'?new URLSearchParams(location.search):new URLSearchParams();
  const visualV2=options.get('archVisual')==='v2';
  const targetIsland=visualV2&&options.get('archTarget')==='1';
  const terrainPreview=visualV2||(typeof location!=='undefined'&&options.get('ground')!=='0');
  const coastProfiles=new Map(),bedrockPlans=new Map();
  if(terrainPreview)for(const floor of level.floors){
    if(!floor.dir){
      const profile=coastlineProfile(floor,level.seed,{samples:visualV2?72:(quality?.props??1)<1?48:72,style:visualV2?'v2':'legacy',neighbors:visualV2?level.floors:[]});
      coastProfiles.set(floor,profile);
      // Actor registration happens only after every coastline has been reconciled.
    }
  }
  if(visualV2){
    separateArchipelagoCoastProfiles(coastProfiles.values());
    for(const [floor,profile] of coastProfiles)registerWalkableCoast(floor,profile);
  }
  clearPassageProps(level,out.passages);
  out.bridgeClearances=bridgeClearances(level);
  const rockFreeLandings=visualV2?archipelagoRockFreeBridgeLandingsV2(out.bridgeClearances):[];
  if(visualV2)out.rockFreeLandings=rockFreeLandings;
  const firstIsland=targetIsland?level.floors.find(f=>!f.dir):null;
  if(targetIsland&&firstIsland){
    const hero=coastProfiles.get(firstIsland);
    const reserved=[...out.passages,...out.bridgeClearances,...rockFreeLandings,...level.floors.filter(f=>f.dir)];
    // Source angles from deterministic authored coastal mass choices, then
    // sculpt their actual landform into the island rather than drawing detached masses.
    const guide=planArchipelagoBedrock(hero,{
      reservations:reserved,neighbors:level.floors,neighborProfiles:[...coastProfiles.values()]
    });
    authorHeroIslandCoast(hero,{
      // Composition first: the east/foreground coastline must visibly
      // communicate granite at the ordinary raid camera, not hide every
      // landform behind it. Keep the deterministic guide masses as fallbacks.
      rockAngles:[.06,2.85,4.65,.63,5.54,1.55,...guide.masses.map(m=>m.angle)],
      bridgeZones:rockFreeLandings,
      neighborProfiles:[...coastProfiles.values()]
    });
    // The broad cliff roots reclaim only surplus organic coastal ground.
    // Re-register the final 2D actor boundary after that authored change,
    // otherwise the player could walk invisibly through a raised granite toe.
    registerWalkableCoast(firstIsland,hero);
    out.heroIsland=true;
    out.heroHeadlands=hero.heroHeadlands;
  }
  const b=level.floors.reduce((a,f)=>({x0:Math.min(a.x0,f.x-f.w/2),x1:Math.max(a.x1,f.x+f.w/2),z0:Math.min(a.z0,f.z-f.d/2),z1:Math.max(a.z1,f.z+f.d/2)}),{x0:1e9,x1:-1e9,z0:1e9,z1:-1e9});
  const cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2,W=b.x1-b.x0+60,D=b.z1-b.z0+60;
  // v2.23 custom water shader: single mesh, shore distance baked once from island/pier footprints.
  const shoreRects=level.floors.map(f=>{
    if(f.dir)return {x:f.x,z:f.z,w:f.w,d:f.d};
    const p=coastProfiles.get(f);
    return p?{points:p.points.map(v=>({x:v.x,z:v.z}))}:
      {x:f.x,z:f.z,w:f.w+1.2,d:f.d+1.2,round:.6};
  });
  const water=createWaterMesh(shoreRects,{x0:cx-W/2,z0:cz-D/2,w:W,d:D},{caustics:!visualV2&&(quality?.props??1)>=1,lite:(quality?.props??1)<1,balticCalm:visualV2});
  if(visualV2){
    const U=water.material.uniforms;
    // Baltic summer night: slate-blue depths and pale pink sky ribbons,
    // with restrained shallows and no bright foamy wave animation.
    // Pass Q: darker Baltic shallows and desaturated summer-night reflections.
    // The previous shallow cyan rendered 50–60 RGB values brighter than the
    // approved art target at 844×390, making every island look tropical.
    U.cShallow.value.set('#2b6268');U.cMid.value.set('#214456');U.cDeep.value.set('#142d40');
    U.cFoam.value.set('#879ba6');U.cSky.value.set('#58788d');U.cRose.value.set('#a87b8c');
  }
  water.name='water';group.add(water);
  if(visualV2){
    out.visualV2=true;
    const reservations=[...out.passages,...out.bridgeClearances,...rockFreeLandings,...level.floors.filter(f=>f.dir)];
    const grassClearances=[...reservations,...[level.start,level.exit,...(level.nodes??[]),...(level.lootBoxes??[])].filter(Boolean).map(p=>({x:p.x,z:p.z,w:3.2,d:3.2}))];
    for(const profile of coastProfiles.values()){
      const options={high:(quality?.props??1)>=1,reservations,neighbors:level.floors,neighborProfiles:[...coastProfiles.values()]};
      const hero=targetIsland&&profile.floor===firstIsland;
      const bedrock=hero?null:addArchipelagoGraniteV2(profile,group,options);
      // The hero's mass angles still provide geological color fingers, but
      // their actual height comes exclusively from the joined coast mesh.
      const plan=hero?{masses:(profile.heroHeadlands??[]).map(h=>({angle:h.angle})),shelves:[]}
        :bedrock?.userData.bedrockPlan;
      bedrockPlans.set(profile.floor,plan);
      addArchipelagoGroundV2(profile,group,{high:options.high,reservations:grassClearances,bedrockPlan:plan});
      if(hero){addArchipelagoTargetPortal(profile,group,options);addArchipelagoTargetShed(profile,group,options);}
    }
    addArchipelagoHorizonIslets(level.floors,group,coastProfiles.values().next().value?.seed??0,{high:(quality?.props??1)>=1});
  }
  // Retain the authored cover mesh/collider exactly; only its material changes in v2.
  // Cold, pale weathered granite replaces the legacy violet sci-fi boulders.
  const rockGeo=new THREE.DodecahedronGeometry(1,0),rockColors=visualV2?['#9a9c9d','#777f87']:[P.rock,P.rockDark],rockMat=rockColors.map(color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));
  for(const f of level.floors){
    if(f.dir){
      buildTimberPier(f,level.seed,quality,group,box);
      out.piers++;continue;
    }
    // island: grass top, sand rim, irregular shore blobs below the walkable edge
    const grass=box(f.x,-.2,f.z,f.w,.4,f.d,P.grass);
    grass.name='archipelago-grass-backup';
    if(visualV2)grass.visible=false;
    // Move *only* the visual fallback. Gameplay floors/colliders stay at Y=0.
    // The preview terrain now has a reliable depth separation on mobile.
    if(terrainPreview){
      grass.position.y-=.06;
      // An opaque base drawn later can still obscure the texture on low-precision
      // iOS depth buffers. Paint this fallback first and do not write its depth:
      // terrain is then always the visible ground layer once its GLBs load.
      grass.renderOrder=-3;
      grass.material.depthWrite=false;
    }
    const profile=coastProfiles.get(f);
    if(profile){
      // One opaque, low-poly perimeter shell: rounded coves, granite shelves and
      // short sand pockets. The original rectangular playable floor remains.
      const data=coastRingData(profile,{bedrockPlan:bedrockPlans.get(f)}),geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
      geo.setAttribute('color',new THREE.BufferAttribute(data.colors,3));
      geo.setAttribute('uv',new THREE.BufferAttribute(data.uvs,2));
      geo.setAttribute('shoreBlend',new THREE.BufferAttribute(data.blends,1));
      geo.setIndex(new THREE.BufferAttribute(data.indices,1));
      geo.computeVertexNormals();
      // Sculpted coastal granite should have rounded, ice-worn gradients.
      // Retain low-poly silhouette and vertex colors but interpolate normals
      // on the hero cliff so it does not read as a wall of flat grey triangles.
      const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,flatShading:!profile.heroCoast});
      const mesh=new THREE.Mesh(geo,mat);
      mesh.name='archipelago-coast-shell';
      mesh.receiveShadow=true;
      mesh.castShadow=Boolean(profile.heroCoast);
      if(profile.heroCoast){mesh.userData.heroIsland=true;mesh.userData.heroRings=data.rings;}
      mesh.userData.visualOnly=true;
      group.add(mesh);
    }else{
      box(f.x,-.32,f.z,f.w+1.2,.3,f.d+1.2,P.sand);
      for(let k=0;k<8;k++){const a=rng()*Math.PI*2,r=new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,.3,10),new THREE.MeshStandardMaterial({color:P.sand,roughness:1}));
        r.scale.set(1.5+rng()*2,1,1.5+rng()*2);r.position.set(f.x+Math.cos(a)*f.w*.5,-.36,f.z+Math.sin(a)*f.d*.5);group.add(r);}
    }
  }
  // Pass 6: passage rectangles are NAVIGATION CLEARANCES, not visual roads.
  // Keep them in out.passages and all clearance/reservation logic below, but never
  // paint beige boxes over the island. On small islands these were a diagonal band
  // that visually cut the entire play space in two.
  // Large islands can use the opt-in organic trail, not these straight strips.
  // Clearance includes the AI radius, so rock edges cannot catch an actor at either approach.
  // Piers/docks/bridges (corridor, dead-end and closet floors tagged with `dir`) need the same
  // margin along their whole walkway, not only at the room doorway they lead to: a boulder
  // cluster built on the thin rail wall flanking a pier can otherwise bulge into the plank path
  // anywhere along its length, not just at the ends.
  const piers=out.bridgeClearances;
  // A partition's own gap is already a passage, but the long solid run either side of it is a
  // thin wall too: left alone it can bulge a boulder cluster across the full room width, a room
  // row over from the gap, sealing the node behind the partition off from the rest of the floor.
  // Widen the gap's passage into a strip across the whole row so nothing on that wall can do that.
  const partitions=(level.rooms??[]).filter(r=>r.partition).map(r=>{
    const gap=out.passages.find(p=>Math.abs(p.z-r.partition.z)<.05&&Math.abs(p.x-r.partition.x)<r.w);
    return gap&&{x:r.x,z:gap.z,w:r.w+.96,d:gap.d+.96};
  }).filter(Boolean);
  const colliders=[],reservations=[...out.passages.map(p=>({...p,w:p.w+.96,d:p.d+.96})),...piers,...partitions,...source.placements];
  // v2.27: water is the island boundary. Shore walls (on the rim of exactly one island floor) get no
  // boulders, only an invisible collider equal to the authored wall, so actors still stop at the edge.
  // Only true interior partitions retain sparse low natural cover, never artificial concrete obstacles.
  const islands=level.floors.filter(f=>!f.dir);
  const onRim=(w,f)=>{const ax=w.w>w.d,e=.6;
    return ax?Math.abs(Math.abs(w.z-f.z)-f.d/2)<e&&Math.abs(w.x-f.x)<f.w/2+e
      :Math.abs(Math.abs(w.x-f.x)-f.w/2)<e&&Math.abs(w.z-f.z)<f.d/2+e;};
  const shore=[];
  for(const w of source.walls){
    if(visualV2){
      // V2's coastline and the actual deck floor already constrain movement.
      // Drop rectangular shoreline/bridge-rail authoring walls entirely,
      // including their colliders. Only genuine interior partitions remain.
      if(isArchipelagoPartitionWallV2(w,level.rooms))
        out.rocks+=buildInteriorCoverV2(w,group,colliders,out.bridgeClearances);
      continue;
    }
    if(islands.filter(f=>onRim(w,f)).length===1){
      colliders.push({x:w.x,z:w.z,w:w.w,d:w.d,h:w.h??1,shore:true});
      shore.push(w);
    }else out.rocks+=buildRockWall(w,rng,reservations,rockGeo,rockMat,group,colliders);
  }
  out.shoreProps=visualV2?0:terrainPreview
    ? coastRocks(coastProfiles,rngFrom(`${level.seed}:shore`),reservations,rockGeo,rockMat,group)
    : shoreRocks(shore,islands,rngFrom(`${level.seed}:shore`),reservations,rockGeo,rockMat,group);
  if(terrainPreview){
    out.coastProfiles=coastProfiles.size;
    out.coastRockFraction=[...coastProfiles.values()].reduce((s,p)=>s+p.rockyRatio,0)/Math.max(1,coastProfiles.size);
  }
  // Preserve the array used by passage caching and callers, without mutating authoring walls.
  level.walls.splice(0,level.walls.length,...colliders);
  for(let i=0;i<level.boxes.length;i++){
    const c=level.boxes[i];
    if(visualV2){
      // Generic authored cover objects also become organic archipelago cover,
      // regardless of whether the military art-mode toggle was passed in.
      const g=naturalCoverV2(c,{kind:i%3===1?'windfall':'boulder',tone:i});
      group.add(g);
      continue;
    }
    const g=new THREE.Group();g.userData.collider=c;
    g.name=militaryStyle?'archipelago-derelict-concrete-cover':'archipelago-crate';
    if(militaryStyle){
      box(c.x,c.h/2,c.z,c.w,c.h,c.d,'#747770',g);
      box(c.x,c.h+.012,c.z,c.w*.86,.025,c.d*.82,'#687459',g);
      box(c.x,c.h*.69,c.z-c.d/2-.009,c.w*.76,.043,.025,'#545A55',g);
      box(c.x+c.w*.17,c.h*.21,c.z-c.d/2-.013,c.w*.12,c.h*.35,.021,'#626960',g);
    }else{
      box(c.x,c.h/2,c.z,c.w,c.h,c.d,P.crate,g);
      box(c.x,c.h+.02,c.z,c.w*.9,.04,c.d*.9,'#a07a50',g);
    }
    group.add(g);
  }
  // V2 boats are tapered open dinghies in checked water, not rectangular
  // hull stand-ins placed on a radius around the global map center.
  if(visualV2){
    const places=planArchipelagoBoatsV2([...coastProfiles.values()],level.floors,level.seed,
      {bounds:{x0:cx-W/2,z0:cz-D/2,w:W,d:D},
        // Hero granite is part of the island polygon: the boats planner must
        // not mistake its material-angle anchors for separate rock AABBs.
        bedrockPlans:[...bedrockPlans.values()].filter(plan=>
          [...(plan?.masses??[]),...(plan?.shelves??[])].every(m=>m.bounds))});
    out.boatPlacements=places;
    for(const place of places){group.add(createArchipelagoDinghyV2(place));out.boats++;}
  }else{
    for(let k=0;k<3;k++){const a=rng()*Math.PI*2,r=Math.max(b.x1-b.x0,b.z1-b.z0)/2+5+rng()*5,g=new THREE.Group();
      g.position.set(cx+Math.cos(a)*r,-.3,cz+Math.sin(a)*r);g.rotation.y=rng()*6.3;
      box(0,.2,0,1.4,.45,3.4,P.hull,g);box(0,.47,0,1.2,.08,3.1,P.hullTop,g);box(0,.75,-.4,.8,.5,.9,'#c8c2b0',g);g.name='boat';if(!propInPassage(g,out.passages)){group.add(g);out.boats++;}}
  }
  return out;
}
// Pine tree: instanced town-kit parts when available, else a stylised cone (same footprint).
export function pineTree(spot,box,rng,pine){
  const g=new THREE.Group();g.position.set(spot.x,0,spot.z);const s=.55+rng()*.3;
  if(pine)for(const p of pine){const m=new THREE.Mesh(p.geometry,p.material);m.applyMatrix4(p.matrix);g.add(m);m.castShadow=true;}
  else{box(0,.4,0,.18,.8,.18,'#4a3424',g);const c=new THREE.Mesh(new THREE.ConeGeometry(.7,1.8,7),new THREE.MeshStandardMaterial({color:'#2f6b40',roughness:.9,flatShading:true}));c.position.y=1.5;c.castShadow=true;g.add(c);}
  g.scale.setScalar(s);g.rotation.y=rng()*6.3;g.name='pine';return g;
}
