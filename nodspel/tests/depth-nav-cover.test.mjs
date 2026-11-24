import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RULES} from '../levels.js';
import {moveWithActors,movePlayer,traceTargets} from '../physics.mjs';
import {doorSolids} from '../round.js';
import {generateDepthLevel,combatRoomsWithCover,depthConnectorPaths,LINK_WIDTH,DEPTH_CLEAR_WIDTH,DEPTH_COVER_LANE_HALF,DEPTH_EXTRACT_COVER_CLEAR} from '../depth-raid.js';

const SEEDS=['probe-seed','alpha','bravo','charlie','delta','echo','foxtrot','golf','layout','gear-on-pad',
  'clear-prompts','go-deeper-walk','push-without-clear','seed0','seed7','seed19','repro-depth'];
const R=RULES.playerRadius;

function solidsOf(level){
  for(const d of level.doors??[])if(d.depth)d.locked=false;
  return [...(level.walls??[]),...(level.boxes??[]),...doorSolids(level)];
}

function canStand(p,solids,floors,radius=R){
  // A real step on the spot: if the 9 floor samples or an overlap block movement,
  // a 0.12 m probe will fail to go all four ways.
  let ok=0;
  for(const [dx,dz] of [[0.12,0],[-0.12,0],[0,0.12],[0,-0.12]]){
    const n=movePlayer(p,{x:dx,z:dz},solids,floors,radius);
    if(Math.hypot(n.x-(p.x+dx),n.z-(p.z+dz))<=0.04)ok++;
  }
  return ok>=2;
}

function nudge(p,solids,floors,radius=R){
  if(canStand(p,solids,floors,radius))return p;
  for(let r=0.2;r<=1.6;r+=0.2)for(let k=0;k<16;k++){
    const a=k*Math.PI/8,q={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r};
    if(canStand(q,solids,floors,radius))return q;
  }
  return null;
}

function bfsPath(from,to,solids,floors,radius=R){
  const step=0.3;
  const key=(x,z)=>`${Math.round(x/step)},${Math.round(z/step)}`;
  from=nudge(from,solids,floors,radius);
  const goal=nudge(to,solids,floors,radius);
  if(!from||!goal)return null;
  const q=[from],seen=new Set([key(from.x,from.z)]),prev=new Map();
  let found=null,guard=0;
  while(q.length&&guard++<12000){
    const p=q.shift();
    if(Math.hypot(p.x-goal.x,p.z-goal.z)<=0.65){found=p;break;}
    for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step],[step,step],[step,-step],[-step,step],[-step,-step]]){
      const want={x:p.x+dx,z:p.z+dz};
      const k=key(want.x,want.z);
      if(seen.has(k))continue;
      const stepped=movePlayer(p,{x:want.x-p.x,z:want.z-p.z},solids,floors,radius);
      if(Math.hypot(stepped.x-want.x,stepped.z-want.z)>0.16)continue;
      seen.add(k);prev.set(k,p);q.push(stepped);
    }
  }
  if(!found)return null;
  const points=[found];
  let c=found,hops=0;
  while(hops++<4000){
    const k=key(c.x,c.z),pr=prev.get(k);
    if(!pr)break;
    points.push(pr);c=pr;
  }
  points.reverse();
  points.push(goal);
  return points;
}

function follow(start,points,solids,floors,radius=R){
  let p={x:start.x,z:start.z};
  for(const t of points){
    const dist=Math.hypot(t.x-p.x,t.z-p.z);
    const steps=Math.max(1,Math.ceil(dist/0.12));
    for(let i=0;i<steps;i++){
      const next=moveWithActors(p,{x:(t.x-p.x)/steps,z:(t.z-p.z)/steps},[],solids,floors,radius);
      const remain=Math.hypot(t.x-next.x,t.z-next.z),before=Math.hypot(t.x-p.x,t.z-p.z);
      if(remain>0.55&&before-remain<0.01){
        // Path hugged a wall; step off it (same idea as in-game jamb assist) and retry.
        const m=Math.hypot(t.x-p.x,t.z-p.z)||1,px=-(t.z-p.z)/m,pz=(t.x-p.x)/m;
        let rescued=null;
        for(const s of [1,-1,2,-2]){
          const mid=moveWithActors(p,{x:px*s*0.22,z:pz*s*0.22},[],solids,floors,radius);
          const nxt=moveWithActors(mid,{x:(t.x-mid.x)*0.3,z:(t.z-mid.z)*0.3},[],solids,floors,radius);
          if(Math.hypot(t.x-nxt.x,t.z-nxt.z)<remain-0.02){rescued=nxt;break;}
        }
        if(!rescued)return {stuck:true,at:next,toward:t};
        p=rescued;continue;
      }
      p=next;
    }
  }
  if(Math.hypot(points.at(-1).x-p.x,points.at(-1).z-p.z)>0.9)return {stuck:true,at:p,toward:points.at(-1)};
  return {stuck:false,at:p};
}

function connectorsOf(level){
  const paths=[];
  for(const p of depthConnectorPaths(level)){
    paths.push({id:p.doorId,from:p.points[0],to:p.points.at(-1)});
  }
  for(const c of [...(level.corridors??[]),...(level.deadEnds??[])]){
    const alongX=c.dir?!!c.dir.x:c.w>=c.d;
    const length=alongX?c.w:c.d;
    const inset=Math.min(0.7,Math.max(0.25,length/2-0.55));
    const a=alongX?{x:c.x-c.w/2+inset,z:c.z}:{x:c.x,z:c.z-c.d/2+inset};
    const b=alongX?{x:c.x+c.w/2-inset,z:c.z}:{x:c.x,z:c.z+c.d/2-inset};
    paths.push({id:`corridor@${c.x.toFixed(1)},${c.z.toFixed(1)}`,from:a,to:b});
  }
  return paths;
}

test('a player capsule can walk every depth connector in all 3 areas without getting stuck', () => {
  assert.ok(DEPTH_CLEAR_WIDTH>=2.4);
  assert.ok(LINK_WIDTH-2*RULES.wallThickness>=2.4-1e-9);
  const failures=[];
  for(const seed of SEEDS){
    const L=generateDepthLevel(seed);
    const solids=solidsOf(L);
    const paths=connectorsOf(L);
    assert.ok(paths.length>=2,`${seed} expected connectors`);
    for(const path of paths){
      const waypoints=bfsPath(path.from,path.to,solids,L.floors);
      if(!waypoints){failures.push(`${seed} ${path.id} no walkable path from ${path.from.x.toFixed(1)},${path.from.z.toFixed(1)} to ${path.to.x.toFixed(1)},${path.to.z.toFixed(1)}`);continue;}
      const res=follow(waypoints[0],waypoints.slice(1),solids,L.floors);
      if(res.stuck)failures.push(`${seed} ${path.id} stuck at ${res.at.x.toFixed(2)},${res.at.z.toFixed(2)} toward ${res.toward.x.toFixed(2)},${res.toward.z.toFixed(2)}`);
    }
  }
  assert.equal(failures.length,0,failures.join('\n'));
});

test('every combat room in a depth area has cover between the entry and the enemies, and that cover blocks bullets', () => {
  let rooms=0,blocked=0;
  for(const seed of SEEDS){
    const L=generateDepthLevel(seed);
    const reports=combatRoomsWithCover(L);
    const byArea={1:0,2:0,3:0};
    for(const r of reports){
      rooms++;
      byArea[r.room.depthArea]=(byArea[r.room.depthArea]||0)+1;
      assert.ok(r.between.length>=2,`${seed} area ${r.room.depthArea} room at ${r.room.x},${r.room.z} has ${r.between.length} cover pieces between entry and enemies (need 2-4)`);
      assert.ok(r.between.length<=6,`${seed} area ${r.room.depthArea} room at ${r.room.x},${r.room.z} has ${r.between.length} cover pieces (too many)`);
      const cover=r.between[0];
      const along=cover.w>=cover.d;
      const shooter=along?{x:cover.x,z:cover.z-(cover.d/2+0.7)}:{x:cover.x-(cover.w/2+0.7),z:cover.z};
      const player=along?{x:cover.x,z:cover.z+(cover.d/2+0.7),r:RULES.playerRadius,kind:'player'}:{x:cover.x+(cover.w/2+0.7),z:cover.z,r:RULES.playerRadius,kind:'player'};
      const hit=traceTargets(shooter,player,[cover],[player]);
      assert.equal(hit?.kind,'wall',`${seed} cover at ${cover.x},${cover.z} did not block a bullet`);
      const clear=traceTargets(shooter,player,[],[player]);
      assert.equal(clear?.kind,'player',`${seed} the same line should hit the player with cover removed`);
      blocked++;
    }
    assert.ok(byArea[2]>=1,`${seed} area 2 has no combat room`);
    assert.ok(byArea[3]>=1,`${seed} area 3 has no combat room`);
  }
  assert.ok(rooms>=SEEDS.length*3,`expected a combat room in each area, got ${rooms}`);
  assert.ok(blocked>=rooms);
});

// v2.28.66 (Robert 22 Nov 2026 playtest): walking through a doorway/corridor mouth felt like
// tar -- an invisible wall slowed the player in the gap. Exercises the real depthJambAssist()
// from game.mjs (same brace-matched extraction technique as floating-stick.test.mjs) so a
// regression in the shipped function, not a re-implementation, fails this test.
function extractDepthJambAssist(){
  const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  const start=source.indexOf('function depthJambAssist(');
  let i=source.indexOf('{',start),depth=0;
  for(;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){depth--;if(depth===0){
      const ctx=vm.createContext({});
      vm.runInContext(source.slice(start,i+1)+'\nthis.depthJambAssist=depthJambAssist;',ctx);
      return ctx.depthJambAssist;
    }}
  }
  throw new Error('depthJambAssist not found in game.mjs');
}
const depthJambAssist=extractDepthJambAssist();

// Every depth-connector door plane and every room doorway gap, as a centerline point plus the
// direction you walk through it (the short/thin axis of the rectangle is the travel direction).
// Node-Raid's own keycard doors (non-depth, legitimately locked until the player finds the key)
// are excluded on purpose -- being blocked there is intended gameplay, not the snagging bug.
function openingsOf(level){
  const openings=[];
  for(const door of level.doors??[]){
    if(!door||typeof door.x!=='number'||!door.depth)continue;
    const alongX=door.w>=door.d;
    openings.push({id:door.id??`door@${door.x.toFixed(1)},${door.z.toFixed(1)}`,point:{x:door.x,z:door.z},dir:alongX?{x:0,z:1}:{x:1,z:0}});
  }
  const gatedDoors=(level.doors??[]).filter(d=>d&&!d.depth&&d.locked);
  for(const room of level.rooms??[]){
    for(const d of room.doors??[]){
      if(!d||typeof d.x!=='number'||'w' in d||'id' in d)continue;
      if(Math.abs(d.x)+Math.abs(d.z??0)>1.01)continue;
      const point={x:room.x+d.x*room.w/2,z:room.z+d.z*room.d/2};
      if(gatedDoors.some(gd=>Math.hypot(gd.x-point.x,gd.z-point.z)<1.5))continue;
      openings.push({id:`room@${room.x.toFixed(1)},${room.z.toFixed(1)}:${d.x},${d.z}`,point,dir:{x:d.x,z:d.z}});
    }
  }
  return openings;
}

test('walking straight through every doorway and corridor opening stays at full speed (>=95% retained)', () => {
  const SPEED=RULES.playerStats.base.speed,dt=1/60,half=1.5;
  const failures=[];
  for(const seed of SEEDS){
    const L=generateDepthLevel(seed);
    const solids=solidsOf(L);
    for(const op of openingsOf(L)){
      // Nudge off any incidental overlap with tactical cover placed near the doorway (a real
      // player walking up to the opening is never teleported inside a crate) -- this test is
      // about the doorway's own collision geometry, not about dodging furniture elsewhere.
      const start=nudge({x:op.point.x-op.dir.x*half,z:op.point.z-op.dir.z*half},solids,L.floors,R);
      const end=nudge({x:op.point.x+op.dir.x*half,z:op.point.z+op.dir.z*half},solids,L.floors,R);
      if(!start||!end)continue;
      const intended=Math.hypot(end.x-start.x,end.z-start.z);
      if(intended<0.3)continue;
      const ux=(end.x-start.x)/intended,uz=(end.z-start.z)/intended;
      const steps=Math.ceil(intended/(SPEED*dt));
      let p={...start},traveled=0;
      for(let s=0;s<steps;s++){
        const delta={x:ux*SPEED*dt,z:uz*SPEED*dt};
        const assisted=depthJambAssist(L,p,delta);
        const before=p;
        p=moveWithActors(p,assisted,[],solids,L.floors,R);
        traveled+=Math.hypot(p.x-before.x,p.z-before.z);
      }
      const retention=traveled/intended,reached=Math.hypot(p.x-end.x,p.z-end.z)<=0.3;
      if(retention<0.95||!reached)failures.push(`${seed} ${op.id} retention ${retention.toFixed(2)} reached=${reached} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    }
  }
  assert.equal(failures.length,0,failures.join('\n'));
});

// v2.28.75 (Robert 24 Nov 2026 Depth Raid playtest, t451u item 5): a tactical cover crate landed
// on top of an area's extract pad. placeDepthCover() ran before level.exit existed (it is only set
// after the function returns), so the one check meant to keep cover off the pad never fired. The
// fix checks every area's pad (level.depthExits, set before placeDepthCover runs) directly.
test('no depthCover box (from placeDepthCover or topUpRoomCover) overlaps any area extract pad', () => {
  const failures=[];
  for(const seed of SEEDS){
    const L=generateDepthLevel(seed);
    assert.ok((L.depthExits??[]).length===3,`${seed} expected 3 depth exits`);
    for(const box of (L.boxes??[]).filter(b=>b.depthCover)){
      for(const e of L.depthExits){
        const d=Math.hypot(box.x-e.x,box.z-e.z);
        if(d<DEPTH_EXTRACT_COVER_CLEAR)failures.push(`${seed} cover at ${box.x},${box.z} is ${d.toFixed(2)}m from area ${e.depthArea}'s extract pad (need >= ${DEPTH_EXTRACT_COVER_CLEAR.toFixed(2)})`);
      }
    }
  }
  assert.equal(failures.length,0,failures.join('\n'));
});

test('placeDepthCover never narrows the main-route lane between a combat room entry and its far door below 2.4 m', () => {
  const failures=[];
  for(const seed of SEEDS){
    const L=generateDepthLevel(seed);
    const reports=combatRoomsWithCover(L);
    for(const r of reports){
      if(!r.exit)continue;
      for(const box of r.boxes.filter(b=>b.depthCover)){
        const dx=r.exit.x-r.entry.x,dz=r.exit.z-r.entry.z,len2=dx*dx+dz*dz||1;
        const t=Math.max(0,Math.min(1,((box.x-r.entry.x)*dx+(box.z-r.entry.z)*dz)/len2));
        const lateral=Math.hypot(box.x-(r.entry.x+t*dx),box.z-(r.entry.z+t*dz));
        if(lateral<DEPTH_COVER_LANE_HALF)failures.push(`${seed} room ${r.room.x},${r.room.z} cover at ${box.x},${box.z} sits only ${lateral.toFixed(2)}m off the entry-exit lane (need >= ${DEPTH_COVER_LANE_HALF.toFixed(2)}m)`);
      }
    }
  }
  assert.equal(failures.length,0,failures.join('\n'));
});
