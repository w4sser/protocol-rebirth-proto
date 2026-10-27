// Bunker kit (assets/env/bunker/, v1.54): GLB dressing over the procedural Node Raid bunker.
// Collision always stays in level data; the kit only replaces visuals. Loader = town's loadKit
// (parallel limit, timeouts, retries, per-asset box stand-in); null if most of the kit fails.
import * as THREE from './vendor/three.module.js';
import {loadKit,instance} from './town.js?v=2.5.1';
import {rngFrom} from './art.js?v=2.5.1';
// Mirrors assets/env/bunker/manifest.json approx_dimensions_m (tests keep them in sync).
export const BUNKER_DIMS={
  floor_concrete_2m_a:[2, 0.05, 2],
  floor_concrete_2m_b:[2, 0.05, 2],
  floor_concrete_2m_c:[2, 0.05, 2],
  floor_grate_2m:[2, 0.05, 2],
  wall_straight_2m_a:[2, 2.6, 0.3],
  wall_straight_2m_b:[2, 2.6, 0.3],
  wall_straight_2m_damaged:[2, 2.6, 0.3],
  wall_corner_in:[2.3, 2.6, 2.3],
  wall_corner_out:[2.3, 2.6, 2.3],
  wall_t:[2, 2.6, 2],
  wall_end:[0.3, 2.6, 0.6],
  wall_doorway_2m:[2, 2.6, 0.3],
  blast_door_open:[2, 2.4, 0.4],
  blast_door_closed:[2, 2.4, 0.4],
  pillar_square_a:[0.6, 2.6, 0.6],
  pillar_square_cracked:[0.6, 2.6, 0.6],
  node_terminal_idle:[1.2, 1.4, 1.2],
  node_terminal_shielded:[1.2, 1.4, 1.2],
  node_terminal_active:[1.2, 1.4, 1.2],
  shock_pad_off:[2, 0.06, 2],
  shock_pad_warn:[2, 0.06, 2],
  shock_pad_on:[2, 0.06, 2],
  extract_hatch_locked:[2.4, 2.2, 2.4],
  extract_hatch_open:[2.4, 2.2, 2.4],
  loot_crate_common:[0.8, 0.6, 0.6],
  loot_crate_uncommon:[0.9, 0.7, 0.6],
  loot_crate_rare:[0.9, 0.7, 0.6],
  loot_crate_epic:[0.9, 0.7, 0.6],
  loot_crate_legendary:[0.9, 0.7, 0.6],
  cover_low_barrier_a:[2, 0.9, 0.6],
  cover_low_barrier_broken:[2, 0.9, 0.6],
  cover_sandbag_straight:[1.6, 0.8, 0.6],
  cover_sandbag_bend:[1.6, 0.8, 0.6],
  lamp_wall_amber_on:[0.3, 0.4, 0.3],
  lamp_wall_amber_broken:[0.3, 0.4, 0.3],
  crt_monitor_wall_on:[0.6, 0.5, 0.3],
  crt_monitor_wall_off:[0.6, 0.5, 0.3],
  pipe_run_2m_straight:[2, 0.3, 0.3],
  pipe_run_2m_bend:[2, 0.3, 0.3],
  pipe_run_2m_valve:[2, 0.3, 0.3],
  cable_run_2m_straight:[2, 0.08, 0.4],
  cable_run_2m_corner:[2, 0.08, 0.4],
  cable_tray_wall:[2, 0.2, 0.4],
  locker_row_closed:[1.5, 2, 0.5],
  locker_row_open:[1.5, 2, 0.5],
  desk_metal_a:[1.4, 0.8, 0.7],
  desk_metal_with_radio:[1.4, 0.8, 0.7],
  shelf_supply_full:[1.8, 2, 0.5],
  shelf_supply_empty:[1.8, 2, 0.5],
  generator_on:[1.6, 1.3, 0.9],
  generator_off:[1.6, 1.3, 0.9],
  radar_console:[2.4, 1.2, 0.8],
  barrel_steel_upright:[0.6, 0.9, 0.6],
  barrel_steel_tipped:[0.6, 0.9, 0.6],
  debris_pile_a:[1.2, 0.5, 1.2],
  debris_pile_b:[1.2, 0.5, 1.2],
  alarm_lamp_coral_on:[0.25, 0.3, 0.25],
  alarm_lamp_coral_off:[0.25, 0.3, 0.25],
  sign_stencil_1:[0.8, 0.4, 0.02],
  sign_stencil_2:[0.8, 0.4, 0.02],
  sign_stencil_3:[0.8, 0.4, 0.02],
  sign_stencil_4:[0.8, 0.4, 0.02],
  sign_stencil_5:[0.8, 0.4, 0.02],
  sign_stencil_6:[0.8, 0.4, 0.02],
  sign_stencil_7:[0.8, 0.4, 0.02],
  sign_stencil_8:[0.8, 0.4, 0.02],
  sign_stencil_9:[0.8, 0.4, 0.02],
  sign_stencil_a:[0.8, 0.4, 0.02],
  sign_stencil_b:[0.8, 0.4, 0.02],
  sign_stencil_c:[0.8, 0.4, 0.02],
  sign_stencil_arrow:[0.8, 0.4, 0.02],
  vent_wall:[0.8, 0.6, 0.1],
  fan_wall:[0.6, 0.6, 0.3],
  bunk_bed:[2, 1.6, 0.9],
  map_table:[1.6, 0.9, 1],
  moss_patch:[1, 0.02, 1],
  water_puddle:[1.5, 0.01, 1],
  decal_floor_marking_lane:[2, 0.01, 0.35],
  decal_hazard_stripes:[1, 0.01, 1],
  decal_crack_a:[1, 0.01, 1],
  decal_crack_b:[1, 0.01, 1],
  decal_oil_stain:[1, 0.01, 1],
  decal_cable_scorch:[1, 0.01, 1],
  decal_arrow_exit:[0.8, 0.01, 0.5],
  decal_bit_smile_graffiti:[0.8, 0.01, 0.6]
};
export const BUNKER_KINDS=Object.keys(BUNKER_DIMS);
export const bunkerLoad={failed:[],retried:0,ms:0};
let cache=null;
export function loadBunkerAssets(base,opts={}){
  if(cache)return cache;
  const items=BUNKER_KINDS.map(k=>({key:k,url:`${k}.glb?v=2.5.1`,dims:BUNKER_DIMS[k]}));
  if(typeof window!=='undefined')window.__bunkerLoad=bunkerLoad;
  cache=loadKit(base,items,{report:bunkerLoad,...opts}).then(a=>{if(bunkerLoad.failed.length>items.length/2)return null;
    // the kit's emissive atlas is authored at full strength: tame it so cable/CRT accents don't wash out at night;
    // objectives (active node, open extract, lamps on) keep a stronger glow so the brightest region = next goal
    const HOT=/^(node_terminal_active|extract_hatch_open|lamp_wall_amber_on|alarm_lamp_coral_on|shock_pad_on|loot_crate_)/;
    for(const k in a)for(const p of a[k]){if(p.standIn||!p.material.emissiveMap)continue;const m=p.material.userData.tuned?p.material:(p.material=p.material.clone());m.userData.shared=m.userData.tuned=true;m.emissiveIntensity=HOT.test(k)?1:.35;}
    return a;});
  return cache;
}
export const COVER_KINDS=['cover_sandbag_straight','cover_low_barrier_a','cover_low_barrier_broken','pillar_square_cracked','barrel_steel_upright'];
export const PROP_KINDS_BUNKER=['locker_row_closed','locker_row_open','desk_metal_a','desk_metal_with_radio','shelf_supply_full','shelf_supply_empty','generator_on','radar_console','barrel_steel_upright','barrel_steel_tipped','debris_pile_a','debris_pile_b','map_table','bunk_bed'];
const FLOOR_DECALS=['decal_crack_a','decal_crack_b','decal_oil_stain','decal_cable_scorch','decal_floor_marking_lane','moss_patch','water_puddle'];
// one Group of plain meshes for stateful objects (nodes, pads, exit, loot): few per level, so no instancing
export function kitGroup(parts,{sx=1,sy=1,sz=1}={}){const g=new THREE.Group();
  for(const p of parts??[]){const m=new THREE.Mesh(p.geometry,p.material);m.matrixAutoUpdate=false;m.matrix.copy(p.matrix);m.castShadow=true;m.receiveShadow=true;g.add(m);}
  g.scale.set(sx,sy,sz);return g;}
// Kit props are bigger than the old procedural props: place each by its rotated footprint so it never
// intersects walls, cover, objectives or another prop (overlapping coplanar faces = z-fighting).
export function footprint(kind,x,z,ry=0){const [w,,d]=BUNKER_DIMS[kind],q=Math.round(ry/(Math.PI/2))%2!==0;return {x,z,w:q?d:w,d:q?w:d};}
const overlap=(a,b,m=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+m&&Math.abs(a.z-b.z)<(a.d+b.d)/2+m;
export const TALL_PROP=1.2;
// nearest tall-enough wall face within 1 m of a spot, prop on the camera side of it
function wallBehind(walls,x,z){let best=null,bd=1;for(const w of walls){const along=w.w>=w.d,L=along?w.w:w.d;if(L<2.2||w.h<1.1)continue;
  if(along&&z<w.z)continue; // never in front of a wall seen from the camera (+z): it would hide the player
  const inSpan=along?Math.abs(x-w.x)<w.w/2-.9:Math.abs(z-w.z)<w.d/2-.9,dist=along?Math.abs(z-w.z)-w.d/2:Math.abs(x-w.x)-w.w/2;
  if(inSpan&&dist>=0&&dist<bd){bd=dist;best=w;}}return best;}
function hugWall(kind,w,x,z){const along=w.w>=w.d,[,,d]=BUNKER_DIMS[kind];
  if(along){const s=Math.sign(z-w.z)||1;return {x,z:w.z+s*(w.d/2+d/2+.04),ry:s>0?Math.PI:0};}
  const s=Math.sign(x-w.x)||1;return {x:w.x+s*(w.w/2+d/2+.04),z,ry:s>0?-Math.PI/2:Math.PI/2};}
export function planKitProps(level,spots,rng){
  const solids=[...level.walls,...level.boxes],placed=[];
  const keep=[...level.nodes.map(n=>[n.x,n.z,1.9]),...level.lootBoxes.map(l=>[l.x,l.z,1.1]),[level.exit.x,level.exit.z,2],[level.start.x,level.start.z,1.6],...(level.hazards??[]).map(h=>[h.x,h.z,Math.max(h.w,h.d)/2+.3])];
  const near=(f,[x,z,r])=>Math.hypot(Math.max(0,Math.abs(x-f.x)-f.w/2),Math.max(0,Math.abs(z-f.z)-f.d/2))<r;
  const corridors=level.floors.filter(f=>Math.min(f.w,f.d)<4.5);
  for(const spot of spots){const ry0=Math.floor(rng()*4)*Math.PI/2,start=Math.floor(rng()*PROP_KINDS_BUNKER.length);
    if(corridors.some(c=>Math.abs(spot.x-c.x)<c.w/2+.3&&Math.abs(spot.z-c.z)<c.d/2+.3))continue; // corridors/doorways stay clear
    for(let i=0;i<PROP_KINDS_BUNKER.length;i++){const kind=PROP_KINDS_BUNKER[(start+i)%PROP_KINDS_BUNKER.length];let x=spot.x,z=spot.z,ry=ry0;
      // tall pieces (lockers, shelves, generator) read as walls: only with their back flat against a real wall
      if(BUNKER_DIMS[kind][1]>TALL_PROP){const w=wallBehind(level.walls,x,z);if(!w)continue;({x,z,ry}=hugWall(kind,w,x,z));}
      const f=footprint(kind,x,z,ry);
      if(solids.some(b=>overlap(f,b,.03))||placed.some(p=>overlap(f,p.f,.12))||keep.some(k=>near(f,k)))continue;
      placed.push({kind,x,z,ry,f});break;}}
  return placed;}
// Visual wall segments, 1:1 with collision rects (cross walls stop 1 cm short: no shared end faces at corners).
export function planWalls(level,rng=()=>0){const out=[];
  level.walls.forEach((b,wi)=>{const along=b.w>=b.d,L=(along?b.w:b.d)-(along?0:.02),n=Math.max(1,Math.round(L/2)),seg=L/n;
    for(let i=0;i<n;i++){const r=rng(),o=-L/2+seg*(i+.5),x=b.x+(along?o:0),z=b.z+(along?0:o);
      out.push({kind:r<.7?'wall_straight_2m_a':r<.9?'wall_straight_2m_b':'wall_straight_2m_damaged',wall:wi,x,z,ry:along?0:Math.PI/2,sx:seg/2,sy:(b.h+wi*.003)/2.6,sz:(along?b.d:b.w)/.3,
        rect:{x,z,w:along?seg:b.w,d:along?b.d:seg,h:b.h+wi*.003}});}});
  return out;}
// y layering (metres) so nothing shares a plane: base plane top -0.10 < floor tiles (top 0, +4 mm per overlapping
// floor) < decals (+8 mm, polygonOffset) < shock-pad plates (top +15 mm) < pad telegraph planes (+30 mm)
export const LAYER={floorStep:.004,decal:.008,padTop:.015};
const fit=(kind,w,h,d)=>{const [dw,dh,dd]=BUNKER_DIMS[kind];return {sx:w/dw,sy:h/dh,sz:d/dd};};
export function buildBunker(level,group,assets,Q){
  const low=!Q.shadows,rng=rngFrom(`${level.seed}:bunker`),by=new Map();
  const add=(k,t)=>{if(!assets[k])return;if(!by.has(k))by.set(k,[]);by.get(k).push(t);};
  // floors: 2 m tiles (edge tiles scaled to fit); narrow strips = corridors -> grating
  level.floors.forEach((f,fi)=>{const corridor=Math.min(f.w,f.d)<4.5,nx=Math.max(1,Math.round(f.w/2)),nz=Math.max(1,Math.round(f.d/2)),tw=f.w/nx,td=f.d/nz;
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const r=rng(),k=corridor?'floor_grate_2m':r<.6?'floor_concrete_2m_a':r<.85?'floor_concrete_2m_b':'floor_concrete_2m_c';
      add(k,{x:f.x-f.w/2+tw*(i+.5),z:f.z-f.d/2+td*(j+.5),y:-.05+fi*LAYER.floorStep,sx:tw/2,sz:td/2,ry:Math.floor(rng()*4)*Math.PI/2*(corridor?0:1)});}});
  // walls: 2 m segments along the long axis, scaled to level height/thickness
  for(const w of planWalls(level,rng)){const {kind,rect,wall,...t}=w;add(kind,t);}
  // cover: kit piece fitted to the collision footprint so what you see is what blocks
  level.boxes.forEach(b=>{const k=COVER_KINDS[Math.floor(rng()*COVER_KINDS.length)];add(k,{x:b.x,z:b.z,ry:0,...fit(k,b.w,b.h,b.d)});});
  // wall dressing: amber lamps / CRTs / pipes on the room-facing side of long walls (thinned on low)
  const cx=level.floors.reduce((a,f)=>a+f.x,0)/level.floors.length,cz=level.floors.reduce((a,f)=>a+f.z,0)/level.floors.length;
  const dressing=['lamp_wall_amber_on','crt_monitor_wall_on','pipe_run_2m_straight','vent_wall','lamp_wall_amber_on','cable_tray_wall','fan_wall','sign_stencil_'+(level.number%9+1),'lamp_wall_amber_broken','crt_monitor_wall_off'],anchors=[];
  level.walls.forEach((b,i)=>{const along=b.w>=b.d,L=along?b.w:b.d;if(L<4||b.h<1.5||(low&&i%2))return;
    const k=dressing[Math.floor(rng()*dressing.length)],off=(along?b.d:b.w)/2+.02,s=along?Math.sign(cz-b.z)||1:Math.sign(cx-b.x)||1;
    const t={x:b.x+(along?(rng()-.5)*(L-2):s*off),z:b.z+(along?s*off:(rng()-.5)*(L-2)),y:Math.min(k.startsWith('pipe')||k.startsWith('cable')?1.9:1.45,b.h-.55),ry:along?(s>0?Math.PI:0):(s>0?-Math.PI/2:Math.PI/2)};
    add(k,t);if(k.endsWith('_on'))anchors.push({...t,color:k.startsWith('lamp')?'#FF9D4D':'#3FE0D0'});});
  // floor decals (no collision); hazard stripes framing shock pads, a subtle cyan arrow at the exit
  const nDec=Math.round(level.floors.reduce((a,f)=>a+f.w*f.d,0)/(low?60:30));
  for(let i=0;i<nDec;i++){const f=level.floors[Math.floor(rng()*level.floors.length)];add(FLOOR_DECALS[Math.floor(rng()*FLOOR_DECALS.length)],{x:f.x+(rng()-.5)*(f.w-1.5),z:f.z+(rng()-.5)*(f.d-1.5),y:LAYER.decal+(i%4)*.001,ry:rng()*Math.PI*2});}
  for(const h of level.hazards??[])add('decal_hazard_stripes',{x:h.x,z:h.z,y:LAYER.decal,...fit('decal_hazard_stripes',h.w+.5,.01,h.d+.5)});
  const CAST=k=>!k.startsWith('decal')&&!k.startsWith('floor')&&k!=='moss_patch'&&k!=='water_puddle';
  for(const [k,list] of by){const decal=!CAST(k);
    for(const im of instance(group,assets[k],list,{cast:!low&&!decal,receive:true}))if(decal&&!k.startsWith('floor')){
      // decals: pulled toward the camera in depth instead of relying on a few mm of height
      const m=im.material.clone();m.polygonOffset=true;m.polygonOffsetFactor=-2;m.polygonOffsetUnits=-4;m.depthWrite=false;m.userData.shared=true;im.material=m;im.renderOrder=1;}}
  // warm/cyan practical lights at the lamp anchors (q=low: none, like the prop lights)
  for(const a of anchors.slice(0,Q.lights)){const l=new THREE.PointLight(a.color,a.color==='#FF9D4D'?5:3.5,6,1.8);l.position.set(a.x,a.y+.1,a.z);group.add(l);}
  return {instancedKinds:[...by.keys()],anchors};
}
