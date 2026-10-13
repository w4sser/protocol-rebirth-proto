// Abandoned Town: pure, seeded layout on top of a generated level (no three.js here).
// Gameplay geometry (floors/walls/nodes/loot/enemies/exit) is unchanged; the town re-skins it
// and adds a few cover colliders (cars) only when every objective stays reachable.
// Dimensions mirror assets/env/town/manifest.json (approx_dimensions_m: w × h × d, metres).
export const TOWN_DIMS={house_red:[6,4.1,5.7],house_yellow:[6,4.1,5.7],fence_segment:[2,1.2,.6],car_boxy:[4.5,1.65,1.95],pine_tree:[2.3,3.7,2.3],tile_asphalt:[2,.08,2],tile_sidewalk:[2,.08,2],tile_grass:[2,.08,2]};
export const TILE=2;
function rngFrom(seed){let h=1779033703^seed.length;for(let i=0;i<seed.length;i++){h=Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
  return()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296;};}
const inRect=(p,r,m=0)=>Math.abs(p.x-r.x)<=r.w/2+m&&Math.abs(p.z-r.z)<=r.d/2+m;
const rectsHit=(a,b,m=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+m&&Math.abs(a.z-b.z)<(a.d+b.d)/2+m;
// footprint of an asset rotated by rot quarter turns
export function footprint(kind,x,z,rot=0){const [w,,d]=TOWN_DIMS[kind];return rot%2?{x,z,w:d,d:w}:{x,z,w,d};}
function bounds(floors,pad){let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const f of floors){x0=Math.min(x0,f.x-f.w/2);x1=Math.max(x1,f.x+f.w/2);z0=Math.min(z0,f.z-f.d/2);z1=Math.max(z1,f.z+f.d/2);}
  return {x0:x0-pad,x1:x1+pad,z0:z0-pad,z1:z1+pad};}
const distToRect=(p,r)=>Math.hypot(Math.max(0,Math.abs(p.x-r.x)-r.w/2),Math.max(0,Math.abs(p.z-r.z)-r.d/2));
// Grid flood fill from the start: every node, pickup, enemy and the exit must be reachable.
export function reachable(level,radius=.3,step=.2){
  const b=bounds(level.floors,0),nx=Math.ceil((b.x1-b.x0)/step)+1,nz=Math.ceil((b.z1-b.z0)/step)+1;
  const solids=[...level.walls,...level.boxes,...level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];
  const free=new Uint8Array(nx*nz),seen=new Uint8Array(nx*nz);
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const p={x:b.x0+i*step,z:b.z0+j*step};
    if(level.floors.some(f=>Math.abs(p.x-f.x)<=f.w/2+.06&&Math.abs(p.z-f.z)<=f.d/2+.06)&&!solids.some(o=>Math.abs(p.x-o.x)<o.w/2+radius&&Math.abs(p.z-o.z)<o.d/2+radius))free[i*nz+j]=1;}
  const cell=p=>[Math.round((p.x-b.x0)/step),Math.round((p.z-b.z0)/step)];
  let [si,sj]=cell(level.start);if(!free[si*nz+sj]){let best=null;for(let i=Math.max(0,si-4);i<=Math.min(nx-1,si+4);i++)for(let j=Math.max(0,sj-4);j<=Math.min(nz-1,sj+4);j++)if(free[i*nz+j]&&!best)best=[i,j];if(!best)return false;[si,sj]=best;}
  const q=[si*nz+sj];seen[q[0]]=1;
  while(q.length){const c=q.pop(),i=Math.floor(c/nz),j=c%nz;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,bb=j+dj;if(a<0||bb<0||a>=nx||bb>=nz)continue;const k=a*nz+bb;if(free[k]&&!seen[k]){seen[k]=1;q.push(k);}}}
  const near=(p,reach)=>{const [ci,cj]=cell(p),R=Math.ceil(reach/step);for(let i=ci-R;i<=ci+R;i++)for(let j=cj-R;j<=cj+R;j++){if(i<0||j<0||i>=nx||j>=nz)continue;if(seen[i*nz+j]&&Math.hypot(b.x0+i*step-p.x,b.z0+j*step-p.z)<=reach)return true;}return false;};
  return level.nodes.every(n=>near(n,1.6))&&level.lootBoxes.every(l=>near(l,.9))&&level.enemies.every(e=>near(e,1.2))&&near(level.exit,1);
}
export function townizeLevel(level){
  const rng=rngFrom(`${level.seed}:town`),low=false;
  const floors=level.floors,rooms=level.rooms,B=bounds(floors,12);
  const insideAny=p=>floors.some(f=>inRect(p,f));
  // 1) ground tiles on a 2 m grid: rooms = sidewalk plaza, corridors = asphalt, outside = grass
  const tiles=[];
  for(let x=Math.floor(B.x0/TILE)*TILE+1;x<B.x1;x+=TILE)for(let z=Math.floor(B.z0/TILE)*TILE+1;z<B.z1;z+=TILE){const p={x,z};
    const room=rooms.some(r=>inRect(p,r)),corr=!room&&insideAny(p);tiles.push({kind:room?'tile_sidewalk':corr?'tile_asphalt':'tile_grass',x,z});}
  // 2) fences replace bunker walls (same colliders)
  const fences=[];
  for(const w of level.walls){const along=w.w>=w.d,L=along?w.w:w.d,n=Math.max(1,Math.round(L/TILE_FENCE));
    for(let k=0;k<n;k++){const o=-L/2+L*(k+.5)/n;fences.push({x:along?w.x+o:w.x,z:along?w.z:w.z+o,rot:along?0:1,stretch:L/n/TILE_FENCE});}}
  // 3) houses frame the play area from outside (never on a floor)
  const solidsOut=[],houses=[],want=low?3:5;
  const nearest=p=>floors.reduce((a,b)=>distToRect(p,a)<distToRect(p,b)?a:b);
  const inFront=(r,reach)=>floors.some(f=>distToRect(r,f)<reach&&(r.x-r.w/2>f.x+f.w/2-1||r.z-r.d/2>f.z+f.d/2-1));
  const blocked=(r,m)=>floors.some(f=>rectsHit(r,f,m))||solidsOut.some(o=>rectsHit(r,o,.6));
  for(let a=0;a<600&&houses.length<want;a++){const rot=Math.floor(rng()*4),kind=rng()<.55?'house_red':'house_yellow';
    const x=B.x0+4+rng()*(B.x1-B.x0-8),z=B.z0+4+rng()*(B.z1-B.z0-8),fp=footprint(kind,x,z,rot);
    if(blocked(fp,.9)||inFront(fp,9))continue;const d=Math.min(...floors.map(f=>distToRect(fp,f)-Math.max(fp.w,fp.d)/2));if(d>3.5)continue;
    houses.push({kind,x:+x.toFixed(2),z:+z.toFixed(2),rot});solidsOut.push(fp);}
  // 4) street lamps + bus stop + outside car just outside fences
  const edgeSpot=(minD,maxD,size,tries=400)=>{for(let a=0;a<tries;a++){const x=B.x0+2+rng()*(B.x1-B.x0-4),z=B.z0+2+rng()*(B.z1-B.z0-4),r={x,z,w:size,d:size};
    if(blocked(r,.35))continue;const d=Math.min(...floors.map(f=>distToRect({x,z},f)));if(d<minD||d>maxD)continue;return {x:+x.toFixed(2),z:+z.toFixed(2)};}return null;};
  const lamps=[];for(let i=0;i<(low?2:4);i++){const s=edgeSpot(.5,1.4,.5);if(s){lamps.push(s);solidsOut.push({...s,w:.8,d:.8});}}
  let busStop=null;{const s=edgeSpot(.6,2.2,3.2);if(s){const f=floors.reduce((a,b)=>distToRect(s,a)<distToRect(s,b)?a:b);busStop={...s,rot:Math.abs(s.x-f.x)/(f.w/2+.01)>Math.abs(s.z-f.z)/(f.d/2+.01)?1:0};solidsOut.push({...s,w:3.4,d:3.4});}}
  const cars=[];{const s=edgeSpot(1.2,4,4.8);if(s){cars.push({...s,rot:rng()<.5?0:1,outside:true});solidsOut.push(footprint('car_boxy',s.x,s.z,cars[0].rot));}}
  // 5) cover cars inside rooms: collider from manifest bounds, kept only if everything stays reachable
  const keep=[level.start,level.exit,...level.nodes,...level.lootBoxes,...level.enemies,...(level.hazards??[])];
  for(const room of [...rooms.slice(1),rooms[0]]){let placed=false;
    for(let a=0;a<80&&!placed;a++){const rot=rng()<.5?0:1,fp=footprint('car_boxy',room.x+(rng()-.5)*(room.w-3),room.z+(rng()-.5)*(room.d-3),rot);
      if(!rooms.some(r=>Math.abs(fp.x-r.x)<=r.w/2-fp.w/2-.9&&Math.abs(fp.z-r.z)<=r.d/2-fp.d/2-.9))continue;
      if([...level.walls,...level.boxes].some(o=>rectsHit(fp,o,.9)))continue;
      if(keep.some(o=>distToRect(o,fp)<(o===level.start?3:1.8)))continue;
      const collider={x:+fp.x.toFixed(2),z:+fp.z.toFixed(2),w:fp.w,d:fp.d,h:TOWN_DIMS.car_boxy[1],town:'car_boxy',rot};
      level.boxes.push(collider);if(reachable(level)){cars.push({x:collider.x,z:collider.z,rot,collider:true});placed=true;}else level.boxes.pop();}
    if(cars.filter(c=>c.collider).length>=(low?1:2))break;}
  // 6) pines: forest boundary + a few yard trees; bushes hug the fences outside
  const trees=[],treeN=low?22:48;
  for(let a=0;a<treeN*8&&trees.length<treeN;a++){const x=B.x0+rng()*(B.x1-B.x0),z=B.z0+rng()*(B.z1-B.z0),r={x,z,w:1.6,d:1.6};
    if(blocked(r,.5)||inFront(r,6))continue;const d=Math.min(...floors.map(f=>distToRect({x,z},f)));if(d<1.2)continue;
    if(d<5&&rng()<.6)continue;trees.push({x:+x.toFixed(2),z:+z.toFixed(2),s:+(.8+rng()*.45).toFixed(2),r:+(rng()*6.28).toFixed(2)});solidsOut.push(r);}
  const bushes=[];for(let a=0;a<(low?40:110)*4&&bushes.length<(low?40:110);a++){const s=edgeSpot(.35,2.6,.7,1);if(s)bushes.push({...s,s:+(.45+rng()*.5).toFixed(2)});}
  level.area='town';level.town={tiles,fences,houses,lamps,busStop,cars,trees,bushes,bounds:B};
  return level;
}
const TILE_FENCE=TOWN_DIMS.fence_segment[0];
