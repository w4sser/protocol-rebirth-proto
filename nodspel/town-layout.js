// Abandoned Town: pure, seeded layout on top of a generated level (no three.js here).
// Gameplay geometry (floors/walls/nodes/loot/enemies/exit) is unchanged; the town re-skins it
// and adds a few cover colliders (cars) only when every objective stays reachable.
// Dimensions mirror assets/env/town/manifest.json (approx_dimensions_m: w × h × d, metres).
export const TOWN_DIMS={house_red:[6, 4.1, 5.7],house_yellow:[6, 4.1, 5.7],fence_segment:[2, 1.2, 0.6],car_boxy:[4.5, 1.65, 1.95],pine_tree:[2.3, 3.7, 2.3],tile_asphalt:[2, 0.08, 2],tile_sidewalk:[2, 0.08, 2],tile_grass:[2, 0.08, 2],streetlamp:[0.8, 4.2, 0.3],bus_shelter:[3.5, 2.3, 1.8],bush_small:[0.9, 0.9, 0.8],bush_cluster:[1.7, 1.3, 1.4],hedge_segment:[2, 1.25, 1],grass_tuft_small:[0.5, 0.6, 0.55],grass_tuft_large:[0.9, 1, 0.85],weed_tuft:[0.75, 0.9, 0.7],container:[6, 2.6, 2.5],electrical_cabinet:[0.8, 1.3, 0.65],mailbox:[0.5, 1.1, 0.4],manhole:[1, 0.18, 1],fence_gate:[1.4, 1.2, 0.6],fence_corner:[2, 1.2, 2],fence_short:[1, 1.2, 0.6],house_red_dark:[6, 4.1, 5.7],house_yellow_dark:[6, 4.1, 5.7],tile_asphalt_sidewalk:[2, 0.09, 2],tile_asphalt_grass:[2, 0.09, 2],tile_sidewalk_grass:[2, 0.09, 2]};
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
  // 1) ground tiles on a 2 m grid: rooms = sidewalk plaza, corridors = asphalt, outside = grass;
  //    border cells use the v0.2 transition tiles (paved half turned toward the paved neighbour)
  const tiles=[],grid=new Map(),key=(x,z)=>`${x},${z}`;
  for(let x=Math.floor(B.x0/TILE)*TILE+1;x<B.x1;x+=TILE)for(let z=Math.floor(B.z0/TILE)*TILE+1;z<B.z1;z+=TILE){const p={x,z};
    const room=rooms.some(r=>inRect(p,r)),corr=!room&&floors.slice(rooms.length).some(f=>inRect(p,f,.8)),t={kind:room?'tile_sidewalk':corr?'tile_asphalt':'tile_grass',x,z,ry:0};tiles.push(t);grid.set(key(x,z),t.kind);}
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
  for(const t of tiles){
    if(t.kind==='tile_grass'){for(const [dx,dz] of DIRS){const n=grid.get(key(t.x+dx*TILE,t.z+dz*TILE));if(n==='tile_sidewalk'||n==='tile_asphalt'){t.kind=n==='tile_sidewalk'?'tile_sidewalk_grass':'tile_asphalt_grass';t.ry=+Math.atan2(dz,-dx).toFixed(4);break;}}}
    else if(t.kind==='tile_asphalt'){for(const [dx,dz] of DIRS){if(grid.get(key(t.x+dx*TILE,t.z+dz*TILE))==='tile_sidewalk'){t.kind='tile_asphalt_sidewalk';t.ry=+Math.atan2(-dz,dx).toFixed(4);break;}}}
  }
  const solidsOut=[],houses=[],want=low?3:5,cars=[],trees=[],props=[],boundary=[];
  const nearest=p=>floors.reduce((a,b)=>distToRect(p,a)<distToRect(p,b)?a:b);
  const inFront=(r,reach)=>floors.some(f=>distToRect(r,f)<reach&&(r.x-r.w/2>f.x+f.w/2-1||r.z-r.d/2>f.z+f.d/2-1));
  const blocked=(r,m)=>floors.some(f=>rectsHit(r,f,m))||solidsOut.some(o=>rectsHit(r,o,.6));
  const P=(kind,x,z,ry=0,s=1)=>props.push({kind,x:+x.toFixed(2),z:+z.toFixed(2),ry:+ry.toFixed(3),s:+s.toFixed(2)});
  // 2) Natural boundaries. Colliders stay exactly the original wall rects (no gaps to escape through);
  //    only the dressing varies per wall: hedges, bush clusters, trees, wrecked cars, containers,
  //    cabinets, locked houses facing the playfield, and a few short fence runs (<= ~1/4, max 2 in a row).
  //    Walls on the camera side (+x/+z) only get low dressing so nothing occludes play.
  const fences=[],FL={fence_segment:2,fence_short:1,fence_gate:1.4};
  const totalL=level.walls.reduce((a,w)=>a+Math.max(w.w,w.d),0);let fenceL=0;
  for(const [wi,w] of level.walls.entries()){
    const along=w.w>=w.d,L=along?w.w:w.d,host=floors.filter(f=>inRect(w,f,.05)).sort((a,b)=>a.w*a.d-b.w*b.d)[0]??nearest(w);
    const sg=v=>v>=0?1:-1,n=along?{x:0,z:sg(w.z-host.z)}:{x:sg(w.x-host.x),z:0},front=n.x>0||n.z>0||w.h>1.5;
    const ryWall=along?0:Math.PI/2,ryFace=Math.atan2(n.x,n.z),rotFace=((Math.round(ryFace/(Math.PI/2))%4)+4)%4;
    const at=(o,out)=>({x:along?w.x+o:w.x+n.x*out,z:along?w.z+n.z*out:w.z+o});
    let c=-L/2,run=0;const seq=[];
    while(L/2-c>.3){const rem=L/2-c,opts=[];
      const fenceOk=run<2&&fenceL+1<=totalL*.25;
      if(!front){if(rem>=6.4)opts.push(['house',6.7,.6]);if(rem>=5.6)opts.push(['container',6,.5]);if(rem>=4.3)opts.push(['car',4.6,.9]);if(rem>=2)opts.push(['pine',2.2,1.1]);}
      if(rem>=1.8)opts.push(['hedge_segment',2,1.8]);if(rem>=1.5)opts.push(['bush_cluster',1.7,1.6]);if(rem>=1.3)opts.push(['cabinet',1.4,.5]);
      if(fenceOk&&rem>=1.8)opts.push(['fence_segment',2,.9]);if(fenceOk&&rem>=.9)opts.push(['fence_short',1,.8]);if(fenceOk&&rem>=1.3)opts.push(['fence_gate',1.4,.25]);
      if(!opts.length)opts.push(['bush_small',Math.min(.9,rem),1]);
      let pick=null;for(let tries=0;tries<6&&!pick;tries++){let r=rng()*opts.reduce((a,o)=>a+o[2],0);for(const o of opts){r-=o[2];if(r<=0){pick=o;break;}}pick??=opts[0];
        if(pick[0]==='house'){const p=at(c+3.35,2.95),fp=footprint('house_red',p.x,p.z,rotFace);if(floors.some(f=>rectsHit(fp,f,-.05))||solidsOut.some(o=>rectsHit(fp,o,.2)))pick=null;}
        else if(pick[0]==='container'){const p=at(c+3,1.35),fp=footprint('container',p.x,p.z,along?0:1);if(floors.some(f=>rectsHit(fp,f,-.05)))pick=null;}}
      pick??=['bush_cluster',1.7];const [kind,len]=pick,mid=c+len/2;
      if(kind==='house'){const p=at(mid,2.95),hk=(rng()<.55?'house_red':'house_yellow')+(rng()<.4?'_dark':'');houses.push({kind:hk,x:+p.x.toFixed(2),z:+p.z.toFixed(2),rot:rotFace,boundary:true});solidsOut.push(footprint(hk,p.x,p.z,rotFace));}
      else if(kind==='container'){const p=at(mid,1.35);P('container',p.x,p.z,ryWall);solidsOut.push(footprint('container',p.x,p.z,along?0:1));}
      else if(kind==='car'){const p=at(mid,1.05);cars.push({x:+p.x.toFixed(2),z:+p.z.toFixed(2),rot:along?0:1,outside:true,boundary:true});solidsOut.push(footprint('car_boxy',p.x,p.z,along?0:1));}
      else if(kind==='pine'){const p=at(mid,.9);trees.push({x:+p.x.toFixed(2),z:+p.z.toFixed(2),s:+(.85+rng()*.3).toFixed(2),r:+(rng()*6.28).toFixed(2)});solidsOut.push({...p,w:1.6,d:1.6});}
      else if(kind==='cabinet'){const p=at(mid-.3,.1),q=at(mid+.4,.2);P('electrical_cabinet',p.x,p.z,ryFace+Math.PI);P('bush_small',q.x,q.z,rng()*6.28,1.15);}
      else if(kind.startsWith('fence')){const p=at(mid,0);fences.push({kind,x:+p.x.toFixed(3),z:+p.z.toFixed(3),rot:along?0:1,stretch:1});fenceL+=FL[kind];}
      else {const p=at(mid,kind==='hedge_segment'?.15:.2);P(kind,p.x,p.z,kind==='hedge_segment'?ryWall:rng()*6.28,kind==='bush_small'?1.2:1.12);}
      run=kind.startsWith('fence')?run+1:0;seq.push(kind);c+=len;}
    boundary.push({wall:wi,front,L:+L.toFixed(2),seq});}
  // 3) houses frame the play area from outside (never on a floor)
  for(let a=0;a<600&&houses.length<want;a++){const rot=rng()<.5?2:3,kind=(rng()<.55?'house_red':'house_yellow')+(rng()<.4?'_dark':'');
    const x=B.x0+4+rng()*(B.x1-B.x0-8),z=B.z0+4+rng()*(B.z1-B.z0-8),fp=footprint(kind,x,z,rot);
    if(blocked(fp,.9)||inFront(fp,9))continue;const d=Math.min(...floors.map(f=>distToRect(fp,f)-Math.max(fp.w,fp.d)/2));if(d>3.5)continue;
    houses.push({kind,x:+x.toFixed(2),z:+z.toFixed(2),rot});solidsOut.push(fp);}
  // 4) street lamps + bus stop + outside car just outside fences
  const edgeSpot=(minD,maxD,size,tries=400)=>{for(let a=0;a<tries;a++){const x=B.x0+2+rng()*(B.x1-B.x0-4),z=B.z0+2+rng()*(B.z1-B.z0-4),r={x,z,w:size,d:size};
    if(blocked(r,.35))continue;const d=Math.min(...floors.map(f=>distToRect({x,z},f)));if(d<minD||d>maxD)continue;return {x:+x.toFixed(2),z:+z.toFixed(2)};}return null;};
  const toward=s=>{const f=nearest(s),cx=Math.max(f.x-f.w/2,Math.min(f.x+f.w/2,s.x)),cz=Math.max(f.z-f.d/2,Math.min(f.z+f.d/2,s.z));return {dx:cx-s.x,dz:cz-s.z};};
  const lamps=[];for(let i=0;i<(low?2:4);i++){const s=edgeSpot(.5,1.4,.5);if(s){const {dx,dz}=toward(s);lamps.push({...s,ry:+Math.atan2(-dz,dx).toFixed(4)});solidsOut.push({...s,w:.8,d:.8});}}
  let busStop=null;for(let a=0;a<30&&!busStop;a++){const s=edgeSpot(.6,3,3.6,40);if(!s)continue;const fp={...s,w:3.6,d:3.6};if(inFront(fp,2))continue;const {dx,dz}=toward(s),q=Math.round(Math.atan2(dx,dz)/(Math.PI/2));busStop={...s,ry:+(q*Math.PI/2).toFixed(4)};solidsOut.push(fp);}
  for(let a=0;a<20;a++){const s=edgeSpot(1.2,4,4.8,40);if(!s)continue;const rot=rng()<.5?0:1,fp=footprint('car_boxy',s.x,s.z,rot);if(inFront(fp,5))continue;cars.push({...s,rot,outside:true});solidsOut.push(fp);break;}
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
  const treeN=trees.length+(low?22:48);
  for(let a=0;a<treeN*8&&trees.length<treeN;a++){const x=B.x0+rng()*(B.x1-B.x0),z=B.z0+rng()*(B.z1-B.z0),r={x,z,w:1.6,d:1.6};
    if(blocked(r,.5)||inFront(r,10))continue;const d=Math.min(...floors.map(f=>distToRect({x,z},f)));if(d<1.2)continue;
    if(d<5&&rng()<.6)continue;trees.push({x:+x.toFixed(2),z:+z.toFixed(2),s:+(.8+rng()*.45).toFixed(2),r:+(rng()*6.28).toFixed(2)});solidsOut.push(r);}
  const bushes=[];for(let a=0;a<(low?40:110)*4&&bushes.length<(low?40:110);a++){const s=edgeSpot(.35,2.6,.7,1);if(s)bushes.push({...s,s:+(.45+rng()*.5).toFixed(2)});}
  // 7) v0.2 dressing. Bunker crates become electrical cabinets (collider = manifest footprint, smaller
  //    than the crate so reachability can only improve). Everything else stands outside the fences.
  for(const b of level.boxes)if(!b.town){const [w,h,d]=TOWN_DIMS.electrical_cabinet;Object.assign(b,{w,d,h,town:'electrical_cabinet'});P('electrical_cabinet',b.x,b.z,0);}
  for(let i=0,n=0;i<300&&n<2;i++){const x=B.x0+4+rng()*(B.x1-B.x0-8),z=B.z0+4+rng()*(B.z1-B.z0-8),rot=rng()<.5?0:1,fp=footprint('container',x,z,rot);
    if(blocked(fp,.8)||inFront(fp,7))continue;const d=Math.min(...floors.map(f=>distToRect(fp,f)));if(d>7)continue;P('container',x,z,rot*Math.PI/2);solidsOut.push(fp);n++;}
  for(let i=0;i<8;i++){const s=edgeSpot(1,3,2.2,60);if(!s)continue;const fp={...s,w:2.2,d:2.2};if(inFront(fp,2.5))continue;P('hedge_segment',s.x,s.z,rng()<.5?0:Math.PI/2);solidsOut.push(fp);}
  for(let i=0;i<3;i++){const s=edgeSpot(.3,.9,.6,80);if(s){P('mailbox',s.x,s.z,Math.atan2(-toward(s).dz,toward(s).dx)+Math.PI/2);solidsOut.push({...s,w:.6,d:.6});}}
  for(let i=0;i<3;i++){const s=edgeSpot(.3,1.2,.9,80);if(s){P('electrical_cabinet',s.x,s.z,Math.round(rng()*3)*Math.PI/2);solidsOut.push({...s,w:.9,d:.9});}}
  for(const b of bushes)P(rng()<.35?'bush_cluster':'bush_small',b.x,b.z,rng()*6.28,b.s*1.4);
  // passable ground detail: manholes on the plazas, weeds along fences inside, grass tufts outside
  for(const room of rooms){for(let a=0;a<30;a++){const x=room.x+(rng()-.5)*(room.w-3),z=room.z+(rng()-.5)*(room.d-3);if(keep.some(o=>Math.hypot(o.x-x,o.z-z)<1.6))continue;P('manhole',x,z,0);break;}
    for(let k=0;k<6;k++){const side=Math.floor(rng()*4),u=rng()-.5,x=side<2?room.x+u*(room.w-1):room.x+(side===2?-1:1)*(room.w/2-.55),z=side<2?room.z+(side?-1:1)*(room.d/2-.55):room.z+u*(room.d-1);
      if(keep.some(o=>Math.hypot(o.x-x,o.z-z)<1.2))continue;P('weed_tuft',x,z,rng()*6.28,.7+rng()*.5);}}
  for(let a=0,n=0;a<900&&n<140;a++){const x=B.x0+rng()*(B.x1-B.x0),z=B.z0+rng()*(B.z1-B.z0);if(insideAny({x,z})||floors.some(f=>distToRect({x,z},f)<.3))continue;
    if(houses.some(h=>rectsHit({x,z,w:.1,d:.1},footprint(h.kind,h.x,h.z,h.rot),.1)))continue;P(rng()<.6?'grass_tuft_small':'grass_tuft_large',x,z,rng()*6.28,.8+rng()*.6);n++;}
  level.area='town';level.town={tiles,fences,houses,lamps,busStop,cars,trees,props,boundary,bounds:B};
  return level;
}
const TILE_FENCE=TOWN_DIMS.fence_segment[0];
