// v1.73 start room + layout pools: level 1 of the bunker opens in the fixed control room, and every level draws a
// hand-authored layout from a pool, chosen by a pure function of (raid seed, level number).
import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES,generateLevel,layoutIdFor,AREAS} from '../levels.js';
import {movePlayer} from '../physics.mjs';

const SEEDS=Array.from({length:60},(_,i)=>`start-room-${i}`);
const SR=RULES.startRoom;

// Walk the real colliders from the start. Locked doors are solid; returns the reachable sample points.
function reachablePoints(level,{keys=false}={}){
  const step=.25,r=RULES.playerRadius;
  const doors=(level.doors??[]).filter(d=>d.locked&&!keys).map(d=>({x:d.x,z:d.z,w:d.w,d:d.d}));
  const solids=[...level.walls,...level.boxes,...doors,...level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4})),...level.enemies.map(e=>({x:e.x,z:e.z,w:.75,d:.75}))];
  const key=(x,z)=>`${x},${z}`,start=[Math.round(level.start.x/step),Math.round(level.start.z/step)];
  const seen=new Set([key(...start)]),queue=[start];
  for(let i=0;i<queue.length;i++){
    const [x,z]=queue[i],p={x:x*step,z:z*step};
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const k=key(x+dx,z+dz);if(seen.has(k))continue;
      const next=movePlayer(p,{x:dx*step,z:dz*step},solids,level.floors,r);
      if(Math.hypot(next.x-(x+dx)*step,next.z-(z+dz)*step)<.001){seen.add(k);queue.push([x+dx,z+dz]);}
    }
  }
  return queue.map(([x,z])=>({x:x*step,z:z*step}));
}
const near=(points,o,d)=>points.some(p=>Math.hypot(p.x-o.x,p.z-o.z)<d);

test('layout pools hold 4-6 hand-authored layouts per level with unique ids',()=>{
  assert.equal(RULES.layouts.length,RULES.levels.length);
  for(const pool of RULES.layouts){assert.ok(pool.length>=4&&pool.length<=6,`pool size ${pool.length}`);assert.equal(new Set(pool.map(l=>l.id)).size,pool.length);}
});
test('the same seed generates an identical level, and the layout id is a pure function of seed + level',()=>{
  for(const area of AREAS)for(const n of [1,2,3]){
    assert.deepEqual(generateLevel(n,'same-seed',area),generateLevel(n,'same-seed',area));
    assert.equal(generateLevel(n,'same-seed',area).layoutId,layoutIdFor('same-seed',n));
  }
  for(const n of [1,2,3])assert.equal(layoutIdFor('another',n),layoutIdFor('another',n));
});
test('different seeds draw at least three distinct layouts per level, all from the pool',()=>{
  for(const n of [1,2,3]){
    const ids=new Set(SEEDS.map(s=>layoutIdFor(s,n)));
    assert.ok(ids.size>=3,`level ${n}: ${[...ids]}`);
    for(const id of ids)assert.ok(RULES.layouts[n-1].some(l=>l.id===id),id);
    assert.deepEqual([...new Set(SEEDS.map(s=>generateLevel(n,s).layoutId))].sort(),[...ids].sort());
  }
});
test('level 1 of the bunker always opens in the same control room with BIT inside it',()=>{
  const base=generateLevel(1,SEEDS[0]);
  for(const s of SEEDS){
    const l=generateLevel(1,s);
    assert.equal(l.startRoom,true);assert.equal(l.rooms.length,1);
    assert.deepEqual(l.rooms[0],base.rooms[0],'room geometry');assert.deepEqual(l.floors,base.floors,'floors');
    assert.deepEqual(l.walls,base.walls,'walls');assert.deepEqual(l.start,base.start);
    const r=l.rooms[0];assert.equal(r.name,SR.name);
    assert.ok(Math.abs(l.start.x-r.x)<r.w/2-1&&Math.abs(l.start.z-r.z)<r.d/2-1,'start is inside the room');
  }
  assert.ok(!generateLevel(2,SEEDS[0]).startRoom&&!generateLevel(1,SEEDS[0],'archipelago').startRoom);
});
test('the loot crate sits on one of three fixed spots and the closet door is sometimes locked',()=>{
  const spots=new Set(),locked=new Set();
  for(const s of SEEDS){
    const l=generateLevel(1,s),crate=l.lootBoxes.find(b=>b.marked);
    assert.ok(SR.crateSpots.some(p=>p.x===crate.x&&p.z===crate.z),`crate on a fixed spot (${crate.x},${crate.z})`);
    spots.add(`${crate.x},${crate.z}`);locked.add(Boolean(l.doors?.length));
    assert.equal(l.doors?.length??0,l.lootBoxes.some(b=>b.item==='keycard')?1:0,'a keycard exists exactly when the door is locked');
  }
  assert.equal(spots.size,3);assert.equal(locked.size,2,'both locked and open closets occur');
  const share=SEEDS.filter(s=>generateLevel(1,s).doors?.length).length/SEEDS.length;
  assert.ok(share>.1&&share<.7,`locked share ${share}`);
});
test('every level of every area is completable without opening a locked door; the keycard is reachable too',()=>{
  for(const area of AREAS)for(const n of [1,2,3])for(const s of SEEDS.slice(0,area==='bunker'?30:10)){
    const l=generateLevel(n,s,area),pts=reachablePoints(l);
    for(const node of l.nodes)assert.ok(near(pts,node,1.7),`${area} L${n} ${s}: node ${node.id}`);
    assert.ok(near(pts,l.exit,.6),`${area} L${n} ${s}: extract`);
    for(const door of l.doors??[]){
      const card=l.lootBoxes.find(b=>b.key===door.key);
      assert.ok(card&&near(pts,card,1.25),`${area} L${n} ${s}: keycard for ${door.id} is reachable while it is locked`);
      if(l.startRoom)assert.ok(near(reachablePoints(l,{keys:true}),l.lootBoxes.find(b=>b.id==='loot-2'),1.25),`${s}: closet crate opens`);
    }
  }
});
