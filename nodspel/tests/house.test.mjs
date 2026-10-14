import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from '../vendor/three.module.js';
import {generateLevel,RULES} from '../levels.js';import {reachable,visualItems} from '../town-layout.js';import {buildWorld} from '../world.js';
import {HOUSE,HOUSE_DIMS,HOUSE_KINDS,houseSolids,stepHouse,doorAssist,houseWaypoint,inHouse} from '../house.js';
import {movePlayer} from '../physics.mjs';
const dir=new URL('../../assets/env/town/house_interior/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir),'utf8'));
const SEEDS=['e5c2d277-meta',...Array.from({length:24},(_,i)=>'hs'+i)];
const each=fn=>{for(const s of SEEDS)for(const n of [1,2,3])fn(generateLevel(n,s,'town'),`${s} L${n}`);};
const solidsOf=L=>[...L.walls,...L.boxes,...houseSolids(L)];
const hit=(a,b,m=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+m&&Math.abs(a.z-b.z)<(a.d+b.d)/2+m;
// walk toward a goal like a stick input, optionally with the doorway assist
function walk(L,from,to,{assist=true,steps=400,dt=1/60,r=RULES.playerRadius}={}){let p={...from};
  for(let i=0;i<steps;i++){const dx=to.x-p.x,dz=to.z-p.z,d=Math.hypot(dx,dz);if(d<.05)break;const s=Math.min(d,4.4*dt);let delta={x:dx/d*s,z:dz/d*s};
    if(assist)delta=doorAssist(L.house,p,delta);p=movePlayer(p,delta,solidsOf(L),L.floors,r);}return p;}

test('house kit: dims mirror the manifest, every GLB is in the repo and small',()=>{
  for(const a of manifest.assets){const k=a.file.replace('.glb','');assert.deepEqual(HOUSE_DIMS[k],a.approx_dimensions_m,k);assert.ok(fs.statSync(new URL(a.file,dir)).size<100_000,a.file);}
  assert.equal(HOUSE_KINDS.length,manifest.assets.length);});

test('one enterable house per Town level, doorway on a back wall, shell outside every other floor and clear of dressing',()=>{
  each((L,tag)=>{const h=L.house;assert.ok(h,tag);assert.ok(h.n.x<=0&&h.n.z<=0,'doorway wall faces away from the camera');
    const vol={x:h.floor.x,z:h.floor.z,w:h.floor.w+.4,d:h.floor.d+.4};
    for(const f of L.floors.filter(f=>!f.house))assert.ok(!hit(h.floor,f,-.02),`${tag} interior overlaps a floor`);
    for(const it of visualItems(L.town))assert.ok(!hit(vol,it.r,-.02),`${tag} ${it.list} ${it.ref.kind??''} inside the house shell`);
    assert.equal(L.walls.filter(w=>w.house==='front').length,2,'front wall = two pieces around the doorway');
    assert.equal(L.town.boundary.filter(b=>b.house).every(b=>b.seq.length===0),true,'no dressing on the house front');
    assert.ok(reachable(L),`${tag} town stays reachable with the door closed`);});});

test('doorway clearance: with the door open the lane, the room centre and every container are reachable; closed blocks entry',()=>{
  each((L,tag)=>{const h=L.house;
    const lane={x:(h.outside.x+h.inside.x)/2,z:(h.outside.z+h.inside.z)/2,w:h.n.z?.8:3,d:h.n.z?3:.8};
    for(const o of [...L.walls,...L.boxes,...h.solids])assert.ok(!hit(lane,o,-.01),`${tag} something blocks the doorway lane`);
    for(const it of visualItems(L.town))assert.ok(!hit(lane,it.r,-.01),`${tag} dressing in the doorway`);
    assert.ok(!reachable(L,.3,.2,[{...h.centre,reach:.4}]),`${tag} closed door blocks the interior`);
    h.door.open=true;assert.ok(reachable(L,.3,.2,[{...h.centre,reach:.4},...h.containers.map(c=>({x:c.x,z:c.z,reach:.5}))]),`${tag} interior reachable`);});});

test('collision: closed door stops the player, open door lets them walk in without snagging (even off-axis), walls hold',()=>{
  each((L,tag)=>{const h=L.house;
    let p=walk(L,h.outside,h.centre);assert.ok(!inHouse(h,p),`${tag} walked through a closed door`);
    h.door.open=true;
    for(const off of [-.35,-.2,0,.2,.35]){const start=h.n.z?{x:h.outside.x+off,z:h.outside.z}:{x:h.outside.x,z:h.outside.z+off};
      p=walk(L,start,h.centre,{steps:300});assert.ok(Math.hypot(p.x-h.centre.x,p.z-h.centre.z)<.3,`${tag} snagged at offset ${off}: ${p.x.toFixed(2)},${p.z.toFixed(2)}`);}
    const back={x:h.centre.x+h.n.x*5,z:h.centre.z+h.n.z*5};p=walk(L,h.centre,back,{assist:false});assert.ok(inHouse(h,p),'back wall holds');
    p=walk(L,h.centre,h.outside);assert.ok(Math.hypot(p.x-h.outside.x,p.z-h.outside.z)<.3,`${tag} can walk back out`);});});

test('door state: stand close to open (no key), progress resets when leaving, stays open',()=>{
  const L=generateLevel(2,'e5c2d277-meta','town'),h=L.house;
  stepHouse(L,h.outside,0);stepHouse(L,h.outside,200);assert.ok(h.door.progress>0&&!h.door.open);
  stepHouse(L,{x:h.outside.x-h.n.x*4,z:h.outside.z-h.n.z*4},300);assert.equal(h.door.progress,0);
  stepHouse(L,h.outside,1000);const r=stepHouse(L,h.outside,1000+HOUSE.doorMs);assert.ok(r.changed&&h.door.open);
  assert.equal(houseSolids(L).some(s=>s.house==='door'),false);stepHouse(L,{x:99,z:99},5000);assert.ok(h.door.open,'stays open for the level');});

test('search: progress feedback, searched state, one table-rolled loot box per container, never twice',()=>{
  const L=generateLevel(2,'e5c2d277-meta','town'),h=L.house,n0=L.lootBoxes.length;h.door.open=true;
  for(const c of h.containers)assert.ok(c.item&&(RULES.loot.types.includes(c.item)),c.kind);
  assert.equal(h.containers.find(c=>c.kind==='medicine_cabinet').item,'medkit');
  const c=h.containers[0];stepHouse(L,c,0);stepHouse(L,c,HOUSE.searchMs/2);assert.ok(Math.abs(c.progress-.5)<.01&&h.searching===c.id&&!c.searched);
  stepHouse(L,h.centre,HOUSE.searchMs/2+10);if(Math.hypot(h.centre.x-c.x,h.centre.z-c.z)>HOUSE.searchReach)assert.equal(c.progress,0,'leaving resets');
  stepHouse(L,c,1e4);const r=stepHouse(L,c,1e4+HOUSE.searchMs);assert.ok(c.searched&&r.loot.length===1);
  const box=L.lootBoxes.at(-1);assert.equal(L.lootBoxes.length,n0+1);assert.equal(box.item,c.item);assert.ok(!box.revealed,'uses the normal unidentified → reveal flow');
  stepHouse(L,c,3e4);stepHouse(L,c,3e4+HOUSE.searchMs*2);assert.equal(L.lootBoxes.length,n0+1,'searched state persists');
  const outside=generateLevel(2,'e5c2d277-meta','town');stepHouse(outside,outside.house.outside,0);stepHouse(outside,outside.house.outside,9e3);assert.ok(outside.house.containers.every(c=>c.progress===0),'no searching through walls');});

test('enemies path through the open doorway to reach a player inside',()=>{
  const L=generateLevel(2,'e5c2d277-meta','town'),h=L.house;h.door.open=true;
  const e={x:h.outside.x-h.n.x*2+(h.n.z?1.5:0),z:h.outside.z-h.n.z*2+(h.n.x?1.5:0)};
  for(let i=0;i<900&&!inHouse(h,e);i++){const g=houseWaypoint(h,e,h.centre)??h.centre,d=Math.hypot(g.x-e.x,g.z-e.z);if(d<1e-6)break;const s=Math.min(d,2.5/60);
    Object.assign(e,movePlayer(e,{x:(g.x-e.x)/d*s,z:(g.z-e.z)/d*s},solidsOf(L),L.floors,.48));}
  assert.ok(inHouse(h,e),`enemy stuck at ${e.x.toFixed(2)},${e.z.toFixed(2)}`);assert.equal(houseWaypoint(h,h.centre,{x:h.centre.x+.5,z:h.centre.z}),null);});

test('roof fades out while the player is inside, camera-side walls cut away, all restored outside; dispose keeps shared assets',()=>{
  const geo=new THREE.BoxGeometry(1,1,1),mat=new THREE.MeshStandardMaterial();geo.userData.shared=mat.userData.shared=true;let freed=0;geo.addEventListener('dispose',()=>freed++);mat.addEventListener('dispose',()=>freed++);
  const part=[{geometry:geo,material:mat,matrix:new THREE.Matrix4()}];
  const assets=new Proxy({},{get:(_,k)=>typeof k==='string'?part:undefined});
  const scene=new THREE.Scene();for(const q of ['low','high']){const L=generateLevel(2,'e5c2d277-meta','town'),w=buildWorld(L,scene,{quality:q,town:assets}),H=w.house;
    assert.ok(H&&H.roof.visible&&H.roofOpacity===1);assert.ok(H.fadeWalls.length>=2,'front + one side face the camera');
    for(let i=0;i<30;i++)H.update(L.house.centre,1/30);assert.ok(H.inside&&!H.roof.visible&&H.roofOpacity===0,'roof hidden inside');
    assert.ok(H.fadeWalls.every(m=>m.opacity<.25),'camera-side walls cut away');
    for(let i=0;i<30;i++)H.update(L.house.outside,1/30);assert.ok(!H.inside&&H.roof.visible&&H.roofOpacity===1&&H.fadeWalls.every(m=>m.opacity===1));
    assert.ok(H.doorClosed.visible&&!H.doorOpen.visible);L.house.door.open=true;H.update(L.house.outside,1/30);assert.ok(!H.doorClosed.visible&&H.doorOpen.visible);
    w.dispose();assert.equal(scene.children.length,0);}
  assert.equal(freed,0);});

test('Search skill: searchMult speeds container search, clamped to −40%',()=>{
  const L=generateLevel(2,'e5c2d277-meta','town'),h=L.house;h.door.open=true;
  const c=h.containers[0];stepHouse(L,c,0,.6);const r=stepHouse(L,c,HOUSE.searchMs*.6,.6);assert.ok(c.searched&&r.loot.length===1,'done at 60% of base time');
  const L2=generateLevel(2,'e5c2d277-meta','town'),h2=L2.house;h2.door.open=true;
  const c2=h2.containers[0];stepHouse(L2,c2,0,.1);stepHouse(L2,c2,HOUSE.searchMs*.5,.1);assert.ok(!c2.searched&&Math.abs(c2.progress-.5/.6)<.01,'clamped to 0.6');
});
