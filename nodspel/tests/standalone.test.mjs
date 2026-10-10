import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,collectLoot,stepNodeInteraction,enterExit,exitIsOpen} from '../round.js';
import {generateLevel,RULES} from '../levels.js';
import {createWeapon} from '../weapon.js';
const physics=await import('../physics.mjs');
test('standalone round ignores disabled order input',()=>{
  const r=createRound('standalone',0,null);
  assert.equal(r.health,100);assert.equal(r.order,undefined);
});
test('marked level two crate supplies loot without changing unlimited reserve',()=>{
  for(let i=0;i<30;i++){
    const r=createRound(`supplies-${i}`,0);r.level=generateLevel(2,r.seed);
    const box=r.level.lootBoxes.find(b=>b.marked),w=createWeapon(Infinity);
    assert.ok(['scrap_alloy','power_cell'].includes(box.item));collectLoot(r,box,1,w);
    assert.equal(w.reserve,Infinity);assert.equal(w.ammo,3);assert.equal(r.bag[box.item],1);
  }
});
test('aim endpoint stops at the nearest solid and ignores targets',()=>{
  assert.equal(typeof physics.aimEndpoint,'function');
  const start={x:0,z:0},direction={x:1,z:0};
  assert.deepEqual(physics.aimEndpoint(start,direction,7,[]),{x:7,z:0});
  const obstacles=[{x:5,z:0,w:1,d:2},{x:3,z:0,w:1,d:2}];
  assert.deepEqual(physics.aimEndpoint(start,direction,7,obstacles),{x:2.5,z:0});
  assert.deepEqual(physics.aimEndpoint(start,direction,7,obstacles,[{kind:'enemy',x:1,z:0,r:.5}]),{x:2.5,z:0});
});
test('empty reserve can charge both level two nodes and open the exit without shots',()=>{
  for(let i=0;i<20;i++){
    const r=createRound(`empty-level-two-${i}`,0),w=createWeapon(0);r.level=generateLevel(2,r.seed);
    let time=0;const obstacles=[...r.level.walls,...r.level.boxes];
    for(const n of r.level.nodes){
      const p={x:n.x,z:n.z+1.2};
      assert.equal(physics.traceTargets(p,n,obstacles,[])?.kind==='wall',false);
      stepNodeInteraction(r,w,p,time,obstacles);time+=1000;stepNodeInteraction(r,w,p,time,obstacles);
      assert.equal(n.active,false);assert.equal(r.nodeInteraction.progress,.5);
      stepNodeInteraction(r,w,{x:100,z:100},time+1,obstacles);assert.equal(r.nodeInteraction,null);
      time+=100;stepNodeInteraction(r,w,p,time,obstacles);time+=RULES.resources.nodeHoldMs;
      assert.equal(stepNodeInteraction(r,w,p,time,obstacles),true);
    }
    assert.equal(exitIsOpen(r),true);assert.equal(enterExit(r,r.level.exit,time+1),'next');
    assert.equal(r.level.number,3);assert.equal(w.ammo,0);assert.equal(w.reserve,0);
  }
});
import {createCombat,stepCombat} from '../combat.js';
function pathTo(level,start,goal){
  const step=.3,solids=[...level.walls,...level.boxes,...level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4})),...level.enemies.filter(e=>e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,w:.75,d:.75}))];
  const key=(x,z)=>`${x},${z}`,queue=[{x:0,z:0,parent:-1}],seen=new Set(['0,0']);
  for(let i=0;i<queue.length;i++){
    const cell=queue[i],p={x:start.x+cell.x*step,z:start.z+cell.z*step};
    if(goal(p)){const path=[];let j=i;while(j>=0){const c=queue[j];path.unshift({x:start.x+c.x*step,z:start.z+c.z*step});j=c.parent;}return path;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=cell.x+dx,z=cell.z+dz,k=key(x,z);if(seen.has(k))continue;
      const next=physics.movePlayer(p,{x:dx*step,z:dz*step},solids,level.floors,.36);
      if(Math.hypot(next.x-(start.x+x*step),next.z-(start.z+z*step))<.001){seen.add(k);queue.push({x,z,parent:i});}
    }
  }
  assert.fail('no route to objective');
}
test('level two is survivable on foot with active enemies and zero ammunition',()=>{
  const r=createRound('ammo-16',0);r.level=generateLevel(2,r.seed);
  const w=createWeapon(0),c=createCombat(r.level,0),solids=[...r.level.walls,...r.level.boxes],cover=[...solids,...r.level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];
  let p={...r.level.start},time=0;
  const frame=()=>{time+=40;stepNodeInteraction(r,w,p,time,solids);stepCombat(r,c,p,time,.04,cover);assert.equal(r.over,false,`survival at ${time} ms`);};
  const walk=goal=>{
    for(let attempts=0;attempts<100&&!goal(p);attempts++){
      const path=pathTo(r.level,p,goal);
      for(const point of path.slice(1)){
        const distance=Math.hypot(point.x-p.x,point.z-p.z),steps=Math.max(1,Math.ceil(distance/(4.5*.04)));
        let blocked=false;
        for(let j=0;j<steps;j++){
          const blockers=[...cover,...r.level.enemies.filter(e=>e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,w:.75,d:.75}))];
          const next=physics.movePlayer(p,{x:(point.x-p.x)/(steps-j),z:(point.z-p.z)/(steps-j)},blockers,r.level.floors,.36);
          blocked=Math.hypot(next.x-p.x,next.z-p.z)<.01;p=next;frame();if(blocked)break;
        }
        if(blocked)break;
      }
    }
    assert.ok(goal(p),'walk reaches objective with real collisions');
  };
  for(const n of r.level.nodes){
    walk(q=>Math.hypot(q.x-n.x,q.z-n.z)<1.5&&physics.traceTargets(q,n,solids,[])?.kind!=='wall');
    for(let i=0;i<51&&!n.active;i++)frame();assert.equal(n.active,true);
  }
  walk(q=>Math.hypot(q.x-r.level.exit.x,q.z-r.level.exit.z)<.8);
  assert.equal(enterExit(r,p,time),'next');assert.equal(r.level.number,3);
  assert.equal(r.enemiesDefeated,0);assert.equal(w.ammo+w.reserve,0);assert.ok(r.health>0);
});

