// v2.3.1: every Archipelago POI must stay reachable from spawn after the chunky boulder walls are
// built. Regression for the dock/bridge boulder-block bug (storage/vault L3 quest raids could land a
// boulder cluster across a pier, a partition gap's far side, or a corner-tucked loot spot, sealing it
// off even though archipelago.test.mjs's narrow per-passage checks all passed).
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel,setHard,setQuestLoot} from '../levels.js';
import * as THREE from '../vendor/three.module.js';
import {buildArchipelago} from '../archipelago.js';

function renderArchipelago(level){
  const group=new THREE.Group();
  const box=(x,y,z,w,h,d,color,parent=group)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  buildArchipelago(level,group,box);
  return {group,dispose(){group.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});}};
}

const RADIUS=.36,RES=.12;
const OFFSETS=[[0,0],[-RADIUS,0],[RADIUS,0],[0,-RADIUS],[0,RADIUS],
  [-RADIUS*.707,-RADIUS*.707],[RADIUS*.707,-RADIUS*.707],[-RADIUS*.707,RADIUS*.707],[RADIUS*.707,RADIUS*.707]];

// Same collision rules as the live game (physics.mjs movePlayer), re-expressed as a point test so a
// whole level can be flood-filled on a grid instead of walked step by step.
function freeAt(x,z,floors,solids){
  for(const [dx,dz] of OFFSETS)if(!floors.some(f=>Math.abs(x+dx-f.x)<=f.w/2&&Math.abs(z+dz-f.z)<=f.d/2))return false;
  return !solids.some(b=>{
    const cx=Math.max(b.x-b.w/2,Math.min(x,b.x+b.w/2)),cz=Math.max(b.z-b.d/2,Math.min(z,b.z+b.d/2));
    return Math.hypot(x-cx,z-cz)<RADIUS;
  });
}

// Flood-fill the walkable floor on a RES-spaced grid and report any point of interest with no
// reachable grid cell within a couple of cells of it (pickup/exit/node footprints are wider than one cell).
function unreachablePOIs(level){
  const floors=level.floors,solids=[...level.walls,...level.boxes];
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
  for(const f of floors){x0=Math.min(x0,f.x-f.w/2);x1=Math.max(x1,f.x+f.w/2);z0=Math.min(z0,f.z-f.d/2);z1=Math.max(z1,f.z+f.d/2);}
  const nx=Math.ceil((x1-x0)/RES)+1,nz=Math.ceil((z1-z0)/RES)+1,idx=(ix,iz)=>iz*nx+ix;
  const toGrid=(x,z)=>[Math.round((x-x0)/RES),Math.round((z-z0)/RES)],toWorld=(ix,iz)=>[x0+ix*RES,z0+iz*RES];
  const visited=new Uint8Array(nx*nz),[sx,sz]=toGrid(level.start.x,level.start.z);
  assert.ok(freeAt(...toWorld(sx,sz),floors,solids),`${level.title} seed ${level.seed}: spawn point itself is blocked`);
  const stack=[[sx,sz]];visited[idx(sx,sz)]=1;
  while(stack.length){
    const [ix,iz]=stack.pop();
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const jx=ix+dx,jz=iz+dz;
      if(jx<0||jz<0||jx>=nx||jz>=nz||visited[idx(jx,jz)])continue;
      if(!freeAt(...toWorld(jx,jz),floors,solids))continue;
      visited[idx(jx,jz)]=1;stack.push([jx,jz]);
    }
  }
  const pois=[...level.nodes.map(n=>({...n,label:`node ${n.id}`})),...level.lootBoxes.map(b=>({...b,label:`loot ${b.id}${b.scout?' (scout)':''}${b.quest?' (quest)':''}`})),{...level.exit,label:'exit'}];
  const fails=[];
  for(const p of pois){
    const [gx,gz]=toGrid(p.x,p.z);
    let found=false;
    for(let dz=-3;dz<=3&&!found;dz++)for(let dx=-3;dx<=3&&!found;dx++){
      const jx=gx+dx,jz=gz+dz;
      if(jx<0||jz<0||jx>=nx||jz>=nz)continue;
      if(visited[idx(jx,jz)])found=true;
    }
    if(!found)fails.push(`${level.title} seed ${level.seed}: ${p.label} unreachable from spawn @ ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  }
  return fails;
}

test('every Archipelago POI (nodes, loot, exit) stays reachable from spawn across many seeds, levels and Hard, after boulders are built',()=>{
  const fails=[];
  for(const hard of [false,true]){
    setHard(hard);
    for(const n of [1,2,3])for(let seed=0;seed<25;seed++){
      // Every third seed also carries a tracked quest/vault item (docs/meta-core-integration.md §... Storage/Vault
      // supply runs), which can retag a loot box without moving it: reachability must hold for that case too.
      setQuestLoot(seed%3===0?{item:'scrap_alloy',level:n}:null);
      const level=generateLevel(n,`reach-${seed}`,'archipelago',hard);
      const rendered=renderArchipelago(level);
      try{fails.push(...unreachablePOIs(level));}
      finally{rendered.dispose();}
    }
  }
  setQuestLoot(null);setHard(false);
  assert.deepEqual(fails,[]);
});
