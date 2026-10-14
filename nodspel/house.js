// Enterable house v0.3: one 4 x 4 m room assembled from assets/env/town/house_interior.
// Pure + seeded (no three.js). Local frame: doorway on local -z, room centre at (0,0).
// World = c + R(ry)·local with x' = x cos + z sin, z' = -x sin + z cos.
export const HOUSE={inner:4,wall:.2,height:2.6,door:1.0,gap:1.24,doorReach:1.35,doorMs:450,searchReach:1.05,searchMs:1600};
// dims [w,h,d] mirror house_interior/manifest.json (approx_dimensions_m)
export const HOUSE_DIMS={floor_4m:[4.3,.12,4.3],wall_plain_4m:[4,2.6,.16],wall_doorway_4m:[4,2.6,.16],wall_window_4m:[4,2.6,.16],door_closed:[.94,2.08,.07],door_open:[.07,2.08,.94],roof_removable_4m:[4.5,.16,4.5],table_small:[1.35,.84,.85],chair_wood:[.55,1.58,.55],sofa_two_seat:[2,1.5,.9],bed_single:[1.2,.87,2],kitchen_counter:[1.55,1.06,.72],fridge:[.82,1.85,.8],wardrobe:[1.05,1.68,.52],bookshelf:[1,1.45,.48],loot_crate:[.75,.72,.58],medicine_cabinet:[.52,.76,.4]};
export const HOUSE_KINDS=Object.keys(HOUSE_DIMS);
// Furniture (local). rot = quarter turns; front of a prop faces local (-sin,-cos)(rot·90°).
// The lane |x|<.6 from the doorway to the room centre stays empty.
export const FURNITURE=[
  {kind:'bed_single',x:-1.38,z:.95,rot:0},
  {kind:'wardrobe',x:1.35,z:1.7,rot:0,search:true},
  {kind:'table_small',x:1.3,z:.1,rot:0},
  {kind:'loot_crate',x:1.55,z:-1.35,rot:1,search:true},
  {kind:'bookshelf',x:-1.75,z:-.75,rot:3},
  {kind:'chair_wood',x:-1.1,z:-1.55,rot:0},
  {kind:'medicine_cabinet',x:0,z:1.95,rot:0,y:1.1,search:true,mounted:true}];
const rotP=(ry,x,z)=>({x:x*Math.cos(ry)+z*Math.sin(ry),z:-x*Math.sin(ry)+z*Math.cos(ry)});
export const toWorld=(h,x,z)=>{const p=rotP(h.ry,x,z);return {x:+(h.x+p.x).toFixed(3),z:+(h.z+p.z).toFixed(3)};};
// axis-aligned world rect of a local rect (quarter-turn house rotations only)
function rectW(h,x,z,w,d){const c=toWorld(h,x,z),q=Math.round(h.ry/(Math.PI/2));return Math.abs(q)%2?{x:c.x,z:c.z,w:d,d:w}:{x:c.x,z:c.z,w,d};}
// Build a house whose doorway sits in the wall line `wl` (centre line of a level wall, thickness t);
// n = outward normal (room -> house), along = door position along the wall.
export function makeHouse(wall,n,doorAt){const t=Math.min(wall.w,wall.d),I=HOUSE.inner,W=HOUSE.wall;
  const along=n.z!==0,line=along?wall.z:wall.x,outer=line+(along?n.z:n.x)*t/2;
  const cx=along?doorAt:outer+n.x*I/2,cz=along?outer+n.z*I/2:doorAt,ry=Math.atan2(n.x,n.z);
  const h={x:+cx.toFixed(3),z:+cz.toFixed(3),ry:+ry.toFixed(5),n,line,t};
  h.floor={...rectW(h,0,0,I,I)};
  h.solids=[rectW(h,0,I/2+W/2,I+2*W,W),rectW(h,-(I/2+W/2),0,W,I+2*W),rectW(h,I/2+W/2,0,W,I+2*W)].map(r=>({...r,h:HOUSE.height,house:'wall'}));
  h.door={...toWorld(h,0,-I/2-t/2),w:along?HOUSE.gap:t,d:along?t:HOUSE.gap,open:false,progress:0};
  h.outside=toWorld(h,0,-I/2-t-.9);h.inside=toWorld(h,0,-I/2+.9);h.centre={x:h.x,z:h.z};
  h.containers=[];
  for(const f of FURNITURE){const [w,,d]=HOUSE_DIMS[f.kind],r=rectW(h,f.x,f.z,f.rot%2?d:w,f.rot%2?w:d);
    if(!f.mounted)h.solids.push({...r,h:HOUSE_DIMS[f.kind][1],house:f.kind});
    if(f.search){const a=f.rot*Math.PI/2,fx=-Math.sin(a),fz=-Math.cos(a),off=(f.mounted?.45:d/2+.45);
      h.containers.push({id:`house-${f.kind}`,kind:f.kind,...toWorld(h,f.x+fx*off,f.z+fz*off),searched:false,progress:0,item:null});}}
  return h;}
// front wall split around the doorway gap; pieces carry house:'front' and stay on the original wall line
export function splitWall(wall,h){const along=h.n.z!==0,lo=along?wall.x-wall.w/2:wall.z-wall.d/2,hi=along?wall.x+wall.w/2:wall.z+wall.d/2,c=along?h.door.x:h.door.z,g=HOUSE.gap/2;
  const piece=(a,b,house)=>b-a<.05?null:along?{...wall,x:+((a+b)/2).toFixed(4),w:+(b-a).toFixed(4),house}:{...wall,z:+((a+b)/2).toFixed(4),d:+(b-a).toFixed(4),house};
  const s=HOUSE.inner/2+HOUSE.wall;return [piece(lo,c-s),piece(c-s,c-g,'front'),piece(c+g,c+s,'front'),piece(c+s,hi)].filter(Boolean);}
export const inHouse=(h,p,m=0)=>!!h&&Math.abs(p.x-h.floor.x)<=h.floor.w/2+m&&Math.abs(p.z-h.floor.z)<=h.floor.d/2+m;
// colliders: shell + furniture, plus the door leaf while closed
export function houseSolids(level){const h=level.house;if(!h)return [];return h.door.open?h.solids:[...h.solids,{x:h.door.x,z:h.door.z,w:h.door.w,d:h.door.d,house:'door'}];}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Touch-friendly interactions (no key): stand close to the door to open it, stand close to a
// container inside to search it. Returns {changed, loot:[new lootBoxes]}.
// searchMult (Search skill, ?stats=srch:) scales HOUSE.searchMs; clamped 0.6..1.
export function stepHouse(level,pos,now,searchMult=1){const sm=Math.min(1,Math.max(.6,Number(searchMult)||1));const h=level.house,out={changed:false,loot:[]};if(!h)return out;
  const d=h.door;
  if(!d.open){if(dist(pos,d)<=HOUSE.doorReach){d.startedAt??=now;d.progress=Math.min(1,(now-d.startedAt)/HOUSE.doorMs);if(d.progress>=1){d.open=true;d.openedAt=now;out.changed=true;}}else{d.startedAt=null;d.progress=0;}}
  const inside=inHouse(h,pos,.05);let best=null;
  for(const c of h.containers){if(c.searched)continue;const k=dist(pos,c);if(inside&&k<=HOUSE.searchReach&&(!best||k<dist(pos,best)))best=c;}
  for(const c of h.containers)if(c!==best&&!c.searched){c.startedAt=null;c.progress=0;}
  if(best){best.startedAt??=now;best.progress=Math.min(1,(now-best.startedAt)/(HOUSE.searchMs*sm));
    if(best.progress>=1){best.searched=true;best.searchedAt=now;out.changed=true;
      const box={id:`${best.id}-loot`,x:best.x,z:best.z,item:best.item,collected:false,house:true};level.lootBoxes.push(box);out.loot.push(box);}}
  h.searching=best?.id??null;return out;}
// Doorway steering: lines a mover up with the door axis so it never snags on the jambs.
export function doorAssist(h,pos,delta){if(!h||!h.door.open)return delta;const along=h.n.z!==0,lat=along?pos.x-h.door.x:pos.z-h.door.z,depth=along?(pos.z-h.door.z)*h.n.z:(pos.x-h.door.x)*h.n.x;
  const fwd=along?delta.z*h.n.z:delta.x*h.n.x,m=Math.hypot(delta.x,delta.z);
  if(Math.abs(depth)>1.1||Math.abs(lat)>.95||Math.abs(lat)<.02||m<1e-6||Math.abs(fwd)<m*.35)return delta;
  const pull=-Math.sign(lat)*Math.min(Math.abs(lat),m*.8);return along?{x:delta.x+pull,z:delta.z}:{x:delta.x,z:delta.z+pull};}
// Enemies path through the doorway: the next waypoint when player and enemy are on different sides.
export function houseWaypoint(h,from,to){if(!h||!h.door.open)return null;const a=inHouse(h,from,.05),b=inHouse(h,to,.05);if(a===b)return null;
  const [near,far]=a?[h.inside,h.outside]:[h.outside,h.inside];return dist(from,near)>.3&&dist(from,h.door)>1.2?near:far;}
