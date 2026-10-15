// Bunker kit (assets/env/bunker/, v1.54): GLB dressing over the procedural Node Raid bunker.
// Collision always stays in level data; the kit only replaces visuals. Loader = town's loadKit
// (parallel limit, timeouts, retries, per-asset box stand-in); null if most of the kit fails.
import * as THREE from './vendor/three.module.js';
import {loadKit,instance} from './town.js?v=1.54.0';
import {rngFrom} from './art.js?v=1.54.0';
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
  const items=BUNKER_KINDS.map(k=>({key:k,url:`${k}.glb?v=1.54.0`,dims:BUNKER_DIMS[k]}));
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
const fit=(kind,w,h,d)=>{const [dw,dh,dd]=BUNKER_DIMS[kind];return {sx:w/dw,sy:h/dh,sz:d/dd};};
export function buildBunker(level,group,assets,Q){
  const low=!Q.shadows,rng=rngFrom(`${level.seed}:bunker`),by=new Map();
  const add=(k,t)=>{if(!assets[k])return;if(!by.has(k))by.set(k,[]);by.get(k).push(t);};
  // floors: 2 m tiles (edge tiles scaled to fit); narrow strips = corridors -> grating
  level.floors.forEach((f,fi)=>{const corridor=Math.min(f.w,f.d)<4.5,nx=Math.max(1,Math.round(f.w/2)),nz=Math.max(1,Math.round(f.d/2)),tw=f.w/nx,td=f.d/nz;
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const r=rng(),k=corridor?'floor_grate_2m':r<.6?'floor_concrete_2m_a':r<.85?'floor_concrete_2m_b':'floor_concrete_2m_c';
      add(k,{x:f.x-f.w/2+tw*(i+.5),z:f.z-f.d/2+td*(j+.5),y:-.05-(corridor?.004:0)-fi*.0004,sx:tw/2,sz:td/2,ry:Math.floor(rng()*4)*Math.PI/2*(corridor?0:1)});}});
  // walls: 2 m segments along the long axis, scaled to level height/thickness
  for(const b of level.walls){const along=b.w>=b.d,L=along?b.w:b.d,n=Math.max(1,Math.round(L/2)),seg=L/n;
    for(let i=0;i<n;i++){const r=rng(),k=r<.7?'wall_straight_2m_a':r<.9?'wall_straight_2m_b':'wall_straight_2m_damaged',o=-L/2+seg*(i+.5);
      add(k,{x:b.x+(along?o:0),z:b.z+(along?0:o),ry:along?0:Math.PI/2,sx:seg/2,sy:b.h/2.6,sz:(along?b.d:b.w)/.3});}}
  // cover: kit piece fitted to the collision footprint so what you see is what blocks
  level.boxes.forEach(b=>{const k=COVER_KINDS[Math.floor(rng()*COVER_KINDS.length)];add(k,{x:b.x,z:b.z,ry:0,...fit(k,b.w,b.h,b.d)});});
  // wall dressing: amber lamps / CRTs / pipes on the room-facing side of long walls (thinned on low)
  const cx=level.floors.reduce((a,f)=>a+f.x,0)/level.floors.length,cz=level.floors.reduce((a,f)=>a+f.z,0)/level.floors.length;
  const dressing=['lamp_wall_amber_on','crt_monitor_wall_on','pipe_run_2m_straight','vent_wall','lamp_wall_amber_on','cable_tray_wall','fan_wall','sign_stencil_'+(level.number%9+1),'lamp_wall_amber_broken','crt_monitor_wall_off'],anchors=[];
  level.walls.forEach((b,i)=>{const along=b.w>=b.d,L=along?b.w:b.d;if(L<4||(low&&i%2))return;
    const k=dressing[Math.floor(rng()*dressing.length)],off=(along?b.d:b.w)/2+.02,s=along?Math.sign(cz-b.z)||1:Math.sign(cx-b.x)||1;
    const t={x:b.x+(along?(rng()-.5)*(L-2):s*off),z:b.z+(along?s*off:(rng()-.5)*(L-2)),y:k.startsWith('pipe')||k.startsWith('cable')?1.9:1.45,ry:along?(s>0?Math.PI:0):(s>0?-Math.PI/2:Math.PI/2)};
    add(k,t);if(k.endsWith('_on'))anchors.push({...t,color:k.startsWith('lamp')?'#FF9D4D':'#3FE0D0'});});
  // floor decals (no collision); hazard stripes framing shock pads, a subtle cyan arrow at the exit
  const nDec=Math.round(level.floors.reduce((a,f)=>a+f.w*f.d,0)/(low?60:30));
  for(let i=0;i<nDec;i++){const f=level.floors[Math.floor(rng()*level.floors.length)];add(FLOOR_DECALS[Math.floor(rng()*FLOOR_DECALS.length)],{x:f.x+(rng()-.5)*(f.w-1.5),z:f.z+(rng()-.5)*(f.d-1.5),y:.004+i*.0002,ry:rng()*Math.PI*2});}
  for(const h of level.hazards??[])add('decal_hazard_stripes',{x:h.x,z:h.z,y:.006,...fit('decal_hazard_stripes',h.w+.5,.01,h.d+.5)});
  const CAST=k=>!k.startsWith('decal')&&!k.startsWith('floor')&&k!=='moss_patch'&&k!=='water_puddle';
  for(const [k,list] of by)instance(group,assets[k],list,{cast:!low&&CAST(k),receive:true});
  // warm/cyan practical lights at the lamp anchors (q=low: none, like the prop lights)
  for(const a of anchors.slice(0,Q.lights)){const l=new THREE.PointLight(a.color,a.color==='#FF9D4D'?5:3.5,6,1.8);l.position.set(a.x,a.y+.1,a.z);group.add(l);}
  return {instancedKinds:[...by.keys()],anchors};
}
