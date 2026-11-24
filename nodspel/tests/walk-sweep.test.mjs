// v2.28.75 (Robert 24 Nov 2026 Depth Raid playtest, t451u item 1): "Player still gets stuck in
// places but eventually squeezes through." The existing nav tests (depth-nav-cover.test.mjs)
// only ever walk corridors and doorways along their centerline. A player hugging one side of a
// corridor -- a near-wall offset, still inside the walkable width -- is a different path through
// the same collider seams, cover boxes and wall corners, and is exactly where a stray prop or a
// seam seam between two separate wall boxes can pinch the capsule even though the centerline is
// clear. This sweeps every corridor/door lane in both Node Raid (bunker) and Depth bunker levels,
// at the centerline and at near-wall offsets, and asserts the player always keeps making forward
// progress (or a documented slide along the wall) and reaches the far end.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {generateLevel,setArea,RULES} from '../levels.js';
import {doorSolids} from '../round.js';
import {movePlayer,moveWithActors} from '../physics.mjs';
import {generateDepthLevel} from '../depth-raid.js';

const R=RULES.playerRadius;
const SPEED=RULES.playerStats.base.speed,DT=1/60;
const STALL_STEPS=6; // consecutive near-zero-progress steps (0.1s at 60fps) counts as a snag

// Brace-matched extraction so a regression in the shipped depthJambAssist (not a reimplementation)
// fails this test (same technique as depth-nav-cover.test.mjs).
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

function canStand(p,solids,floors){
  let ok=0;
  for(const [dx,dz] of [[0.12,0],[-0.12,0],[0,0.12],[0,-0.12]]){
    const n=movePlayer(p,{x:dx,z:dz},solids,floors,R);
    if(Math.hypot(n.x-(p.x+dx),n.z-(p.z+dz))<=0.04)ok++;
  }
  return ok>=2;
}
function nudge(p,solids,floors){
  if(canStand(p,solids,floors))return p;
  for(let r=0.1;r<=1.2;r+=0.1)for(let k=0;k<16;k++){
    const a=k*Math.PI/8,q={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r};
    if(canStand(q,solids,floors))return q;
  }
  return null;
}
// How far the player can step sideways from `point` before something blocks -- the real walkable
// half-width at that spot, including any cover/prop that narrows it, not the lane's nominal width.
function clearance(point,lateral,solids,floors,maxDist=3){
  let p={...point},traveled=0;const step=0.05;
  while(traveled<maxDist){
    const next=movePlayer(p,{x:lateral.x*step,z:lateral.z*step},solids,floors,R);
    const moved=Math.hypot(next.x-p.x,next.z-p.z);
    if(moved<step*0.5)break;
    p=next;traveled+=moved;
  }
  return traveled;
}

// A lane is a straight run with a travel direction; offsets are centerline (0) plus near-wall
// (just inside the walkable width on each side, measured at the lane's own narrowest point).
function laneOffsets(pinch,dir,solids,floors){
  const lateral={x:-dir.z,z:dir.x};
  const rightClear=clearance(pinch,lateral,solids,floors)-R-0.08;
  const leftClear=clearance(pinch,{x:-lateral.x,z:-lateral.z},solids,floors)-R-0.08;
  const offsets=[0];
  if(rightClear>0.05)offsets.push(Math.min(rightClear,1.2));
  if(leftClear>0.05)offsets.push(-Math.min(leftClear,1.2));
  return {offsets,lateral};
}

// Walks from `from` toward `to` with constant directional input (no path adaptation, so any
// stall is the collider's fault, not a smarter-steering mask). `assist` is depthJambAssist bound
// to the level, or null outside Depth. `endMode:'exact'` requires landing on `to`; `'forward'`
// only requires passing `to`'s position along the travel axis (used where jamb assist is
// expected to pull the player off the requested offset, by design, near a door).
function sweepLane(from,to,solids,floors,assist,endMode='exact'){
  const dist=Math.hypot(to.x-from.x,to.z-from.z);
  if(dist<0.2)return {ok:true};
  const ux=(to.x-from.x)/dist,uz=(to.z-from.z)/dist;
  const maxSteps=Math.ceil(dist/(SPEED*DT))*4+90;
  let p={...from},stalls=0;
  for(let s=0;s<maxSteps;s++){
    const before=p;
    const raw={x:ux*SPEED*DT,z:uz*SPEED*DT};
    const delta=assist?assist(p,raw):raw;
    const next=assist?moveWithActors(p,delta,[],solids,floors,R):movePlayer(p,delta,solids,floors,R);
    const moved=Math.hypot(next.x-before.x,next.z-before.z);
    p=next;
    if(moved<1e-4){
      stalls++;
      if(stalls>=STALL_STEPS)return {ok:false,reason:'stall',at:p,steps:s};
    } else stalls=0;
    const progressed=(p.x-from.x)*ux+(p.z-from.z)*uz;
    if(endMode==='exact'?Math.hypot(p.x-to.x,p.z-to.z)<0.3:progressed>=dist-0.3)return {ok:true};
  }
  return {ok:false,reason:'not-reached',at:p,steps:maxSteps};
}
// assist() needs the level bound in; wrap it so sweepLane's signature stays level-agnostic.
function bindAssist(level){return (pos,delta)=>depthJambAssist(level,pos,delta);}

function corridorLanes(level){
  const lanes=[];
  for(const c of [...(level.corridors??[]),...(level.deadEnds??[])]){
    const alongX=c.dir?!!c.dir.x:c.w>=c.d;
    const length=alongX?c.w:c.d;
    const inset=Math.min(0.9,Math.max(0.3,length/2-0.6));
    const a=alongX?{x:c.x-c.w/2+inset,z:c.z}:{x:c.x,z:c.z-c.d/2+inset};
    const b=alongX?{x:c.x+c.w/2-inset,z:c.z}:{x:c.x,z:c.z+c.d/2-inset};
    if(Math.hypot(b.x-a.x,b.z-a.z)<0.3)continue;
    lanes.push({id:`corridor@${c.x.toFixed(1)},${c.z.toFixed(1)}`,a,b});
  }
  return lanes;
}
// Room doorway gaps, excluding genuinely locked (keycard) gates -- being blocked there is
// intended gameplay, not the snagging bug.
function doorwayLanes(level){
  const lanes=[];
  const gated=(level.doors??[]).filter(d=>d.locked&&!d.depth);
  for(const room of level.rooms??[]){
    for(const d of room.doors??[]){
      if(!d||typeof d.x!=='number'||'w' in d||'id' in d)continue;
      const point={x:room.x+d.x*room.w/2,z:room.z+d.z*room.d/2};
      if(gated.some(g=>Math.hypot(g.x-point.x,g.z-point.z)<1.5))continue;
      const dir={x:d.x,z:d.z};
      lanes.push({id:`room@${room.x.toFixed(1)},${room.z.toFixed(1)}:${d.x},${d.z}`,
        a:{x:point.x-dir.x*1.4,z:point.z-dir.z*1.4},b:{x:point.x+dir.x*1.4,z:point.z+dir.z*1.4},pinch:point});
    }
  }
  for(const door of level.doors??[]){
    if(!door||typeof door.x!=='number'||!door.depth)continue;
    const alongX=door.w>=door.d,dir=alongX?{x:0,z:1}:{x:1,z:0},point={x:door.x,z:door.z};
    lanes.push({id:door.id,a:{x:point.x-dir.x*1.4,z:point.z-dir.z*1.4},b:{x:point.x+dir.x*1.4,z:point.z+dir.z*1.4},pinch:point});
  }
  return lanes;
}

function solidsOf(level){return [...(level.walls??[]),...(level.boxes??[]),...doorSolids(level)];}

function sweepLevel(level,{assist}){
  const solids=solidsOf(level);
  const failures=[];
  for(const lane of [...corridorLanes(level),...doorwayLanes(level)]){
    const dist0=Math.hypot(lane.b.x-lane.a.x,lane.b.z-lane.a.z);
    const dir={x:(lane.b.x-lane.a.x)/dist0,z:(lane.b.z-lane.a.z)/dist0};
    const pinch=lane.pinch??{x:(lane.a.x+lane.b.x)/2,z:(lane.a.z+lane.b.z)/2};
    const {offsets,lateral}=laneOffsets(pinch,dir,solids,level.floors);
    for(const off of offsets){
      const fa={x:lane.a.x+lateral.x*off,z:lane.a.z+lateral.z*off};
      const fb={x:lane.b.x+lateral.x*off,z:lane.b.z+lateral.z*off};
      const na=nudge(fa,solids,level.floors),nb=nudge(fb,solids,level.floors);
      if(!na||!nb)continue; // the offset itself has nowhere valid to start/end -- not a stall
      // Any lane in Depth can run close enough to a door for depthJambAssist to pull an
      // off-center walk toward the centerline, by design -- only require clearing the lane,
      // not landing on the exact offset target, whenever that assist is in play.
      const endMode=assist?'forward':'exact';
      const res=sweepLane(na,nb,solids,level.floors,assist,endMode);
      if(!res.ok)failures.push(`${lane.id} off=${off.toFixed(2)}: ${res.reason} at ${res.at.x.toFixed(2)},${res.at.z.toFixed(2)} (step ${res.steps})`);
    }
  }
  return failures;
}

const BUNKER_SEEDS=['probe-seed','alpha','bravo','charlie','delta','echo','foxtrot','golf','layout','gear-on-pad','seed0','seed7','seed19','repro-depth','hotel','india','juliet','kilo'];
const DEPTH_SEEDS=['probe-seed','alpha','bravo','charlie','delta','echo','foxtrot','golf','layout',
  'gear-on-pad','clear-prompts','go-deeper-walk','push-without-clear','seed0','seed7','seed19','repro-depth',
  'hotel','india','juliet','kilo','lima','mike','november','oscar'];

test('Node Raid (bunker) levels: every corridor and doorway lane is walkable at the centerline and near each wall, no stall', () => {
  setArea('bunker');
  const failures=[];
  for(const seed of BUNKER_SEEDS){
    for(const number of [1,2,3]){
      const level=generateLevel(number,seed,'bunker',false,false);
      for(const f of sweepLevel(level,{assist:null}))failures.push(`${seed} L${number} ${f}`);
    }
  }
  assert.equal(failures.length,0,failures.slice(0,30).join('\n'));
});

test('Depth bunker levels: every corridor and door lane is walkable at the centerline and near each wall, no stall', () => {
  const failures=[];
  for(const seed of DEPTH_SEEDS){
    const level=generateDepthLevel(seed);
    for(const d of level.doors??[])if(d.depth)d.locked=false;
    const assist=bindAssist(level);
    for(const f of sweepLevel(level,{assist}))failures.push(`${seed} ${f}`);
  }
  assert.equal(failures.length,0,failures.slice(0,30).join('\n'));
});
