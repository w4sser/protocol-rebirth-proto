import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,tickRound,enterExit,exitIsOpen} from '../round.js';
import {movePlayer,traceTargets} from '../physics.mjs';
import {createWeapon,fireWeapon,stepWeapon,tickWeapon} from '../weapon.js';
import {RULES} from '../levels.js';

// Drive the actual movement, shot collision and round state along independently
// searched routes, rather than teleporting the player or lighting every node directly.
test('a player can shoot every node and walk through all three exits within one round',()=>{
  for(const seed of ['whole-round-a','whole-round-b','whole-round-c']){
    let clock=0;const round=createRound(seed,clock);
    for(let number=1;number<=3;number++){
      const level=round.level,w=createWeapon();let p={...level.start},crossedPassage=false;
      const solidBoxes=()=>[...level.walls,...level.boxes,...(exitIsOpen(round)?[]:[{x:level.exit.x,z:level.exit.z,w:2,d:.22}])];
      const playerBoxes=()=>[...solidBoxes(),...level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4})),...level.enemies.filter(e=>e.health>0).map(e=>({x:e.x,z:e.z,w:.75,d:.75}))];
      function routeTo(goal){
        const step=.2,boxes=playerBoxes();
        const start=[Math.round(p.x/step),Math.round(p.z/step)];
        const key=(x,z)=>`${x},${z}`,queue=[start],parents=new Map([[key(...start),null]]);
        let found=null;
        for(let i=0;i<queue.length;i++){
          const [x,z]=queue[i],here={x:x*step,z:z*step};
          if(goal(here)){found=[x,z];break;}
          for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
            const next={x:(x+dx)*step,z:(z+dz)*step},k=key(x+dx,z+dz);
            if(parents.has(k))continue;
            const walked=movePlayer(here,{x:next.x-here.x,z:next.z-here.z},boxes,level.floors,.36);
            if(Math.hypot(walked.x-next.x,walked.z-next.z)<.001){parents.set(k,[x,z]);queue.push([x+dx,z+dz]);}
          }
        }
        assert.ok(found,`a walking route exists on level ${number}`);
        const path=[];
        for(let at=found;at;at=parents.get(key(...at)))path.unshift({x:at[0]*step,z:at[1]*step});
        for(const next of path){
          const delta={x:next.x-p.x,z:next.z-p.z};clock+=Math.hypot(delta.x,delta.z)/4.5*1000;
          p=movePlayer(p,delta,boxes,level.floors,.36);
          if(level.number===2&&level.corridors.some(c=>Math.abs(p.x-c.x)<c.w/2&&Math.abs(p.z-c.z)<c.d/2))crossedPassage=true;
          assert.ok(Math.hypot(p.x-next.x,p.z-next.z)<.002,'real movement follows the route');
          tickRound(round,clock);assert.equal(round.over,false);
        }
      }
      function shoot(target){
        clock+=RULES.weapon.shotIntervalMs;tickWeapon(w,clock);
        if(!w.ammo){clock=w.reloadAt;tickWeapon(w,clock);}
        const shot=fireWeapon(w,p,{x:target.x-p.x,z:target.z-p.z},clock);assert.ok(shot);
        const travel=Math.hypot(target.x-p.x,target.z-p.z)/RULES.weapon.bulletSpeed;
        clock+=travel*1000;stepWeapon(w,round,clock,travel,solidBoxes());
      }
      for(const enemy of level.enemies){
        routeTo(p=>Math.hypot(p.x-enemy.x,p.z-enemy.z)<1.6 && traceTargets(p,enemy,solidBoxes(),[...level.nodes,...level.enemies.filter(e=>e.health>0)])?.target?.id===enemy.id);
        for(let hit=0;hit<RULES.enemyHealth/RULES.weapon.damage;hit++)shoot(enemy);
        assert.equal(enemy.health,0);
      }
      for(const node of level.nodes){
        routeTo(p=>Math.hypot(p.x-node.x,p.z-node.z)<1.6 && traceTargets(p,node,solidBoxes(),level.nodes)?.node?.id===node.id);
        const hit=traceTargets(p,node,solidBoxes(),level.nodes);
        assert.equal(hit.node.id,node.id);
        shoot(node);assert.equal(node.active,true);
        if(number===2)assert.equal(crossedPassage,true,'the player walks through the narrow passage before lighting nodes');
      }
      routeTo(p=>Math.hypot(p.x-level.exit.x,p.z-level.exit.z)<.7);
      assert.equal(enterExit(round,p,clock),number===3?'complete':'next');
    }
    assert.equal(round.nodesLit,6);assert.equal(round.levelsCleared,3);assert.equal(round.cleared,true);
    assert.equal(round.enemiesDefeated,11);assert.equal(round.reason,'complete');assert.equal(round.over,true);
    const frozen=round.remainingMs;assert.ok(clock<480000);tickRound(round,480000);assert.equal(round.remainingMs,frozen);
  }
});
