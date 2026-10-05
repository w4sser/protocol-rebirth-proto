import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel} from '../levels.js';
import {traceTargets,movePlayer} from '../physics.mjs';

test('the full layout and objects reproduce from a seed',()=>{
  for(const n of [1,2,3])assert.deepEqual(generateLevel(n,'same'),generateLevel(n,'same'));
});
test('restarts change room geometry and connections, not just object placement',()=>{
  for(const n of [1,2,3]){
    const layouts=new Set(Array.from({length:12},(_,i)=>JSON.stringify(generateLevel(n,`restart-${i}`).rooms)));
    assert.ok(layouts.size>5);
    if(n>1){const links=new Set(Array.from({length:12},(_,i)=>JSON.stringify(generateLevel(n,`restart-${i}`).corridors.map(c=>c.dir))));assert.ok(links.size>1,'connection directions change too');}
  }
});
test('each level has its requested identity, hidden nodes and a real dead-end branch',()=>{
  for(let s=0;s<20;s++){
    const [a,b,c]=[1,2,3].map(n=>generateLevel(n,`identity-${s}`));
    assert.equal(a.rooms.length,1);assert.equal(a.nodes.length,1);assert.equal(a.enemies.length,1);
    assert.equal(b.rooms.length,2);assert.equal(b.nodes.length,2);
    assert.equal(b.corridors.length,1);assert.ok(b.corridors[0].width<=1.8);
    for(const node of b.nodes)assert.equal(traceTargets(b.start,node,b.walls,[node])?.kind,'wall','node is out of sight at spawn');
    assert.equal(c.rooms.length,3);assert.equal(c.deadEnds.length,1);
    assert.equal(c.deadEnds[0].connections,1);assert.ok(c.deadEnds[0].length>=4);
    assert.ok(c.enemies[0].speed>b.enemies[0].speed);
  }
});

// Search actual movement on a grid, independently of generator placement rules.
function checkRoutes(level){
  const step=.25,r=.36;
  const solids=[...level.walls,...level.boxes,...level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4})),...level.enemies.map(e=>({x:e.x,z:e.z,w:.75,d:.75}))];
  const start=[Math.round(level.start.x/step),Math.round(level.start.z/step)],key=(x,z)=>`${x},${z}`;
  const seen=new Set([key(...start)]),queue=[start];
  for(let i=0;i<queue.length;i++){
    const [x,z]=queue[i],p={x:x*step,z:z*step};
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const k=key(x+dx,z+dz);if(seen.has(k))continue;
      const next=movePlayer(p,{x:dx*step,z:dz*step},solids,level.floors,r);
      if(Math.hypot(next.x-(x+dx)*step,next.z-(z+dz)*step)<.001){seen.add(k);queue.push([x+dx,z+dz]);}
    }
  }
  const points=queue.map(([x,z])=>({x:x*step,z:z*step}));
  for(const node of level.nodes)assert.ok(points.some(p=>Math.hypot(p.x-node.x,p.z-node.z)<1.7&&traceTargets(p,node,[...level.walls,...level.boxes],[node])?.kind==='node'),`reachable node ${node.id}, seed ${level.seed}`);
  assert.ok(points.some(p=>Math.hypot(p.x-level.exit.x,p.z-level.exit.z)<.6),`reachable exit ${level.seed}`);
  for(const branch of level.deadEnds)assert.ok(points.some(p=>Math.hypot(p.x-branch.end.x,p.z-branch.end.z)<1),`walkable dead end ${level.seed}`);
}
test('crates never obstruct nodes, exit or the dead end across ninety layouts',()=>{
  for(let s=0;s<30;s++)for(const n of [1,2,3])checkRoutes(generateLevel(n,`routes-${s}`));
});
