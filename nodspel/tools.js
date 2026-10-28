// Toolkit (grenade / EMP / decoy): pure logic on round + level state, no DOM. Config lives in RULES.tools (levels.js).
// One tool per raid (?tool=id:n). Throws land instantly (no bounce); the grenade then waits out its fuse.
import {RULES} from './levels.js?v=2.7.1';
import {aimEndpoint} from './physics.mjs?v=2.7.1';
import {hitEnemy} from './round.js?v=2.7.1';

const PULSE_SHOW_MS=600;
const alive=e=>e.health>0&&e.active!==false;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const toolDef=id=>(id&&Object.hasOwn(RULES.tools.defs,id)?RULES.tools.defs[id]:null);

// launchTool: {id,n} from readTool (or null). Sets up the per-round tool state.
export function initTool(round,launchTool){
  const def=launchTool&&toolDef(launchTool.id);
  round.tool=def?{id:launchTool.id,kind:def.kind,charges:Math.min(def.charges,Math.max(0,launchTool.n)),thrown:0}:null;
  round.toolFx={level:round.level,fuses:[],decoys:[],pulses:[]};
  return round.tool;
}
export const toolCharges=round=>round?.tool?.charges??0;
export const canUseTool=round=>!!round&&!round.over&&round.pauseAt==null&&toolCharges(round)>0;

// Nearest living enemy within throwRange (auto-aim). Null when nothing is close.
export function nearestTarget(origin,enemies,range=RULES.tools.throwRange){
  let best=null,bd=Infinity;
  for(const e of enemies){if(!alive(e))continue;const d=dist(origin,e);if(d<=range&&d<bd){best=e;bd=d;}}
  return best;
}
// Where a thrown tool lands: at most throwRange from the thrower and stopped by solid walls.
export function landingPoint(origin,point,obstacles=[]){
  const dx=point.x-origin.x,dz=point.z-origin.z,d=Math.hypot(dx,dz);
  if(d<1e-6)return {x:origin.x,z:origin.z};
  const range=Math.min(d,RULES.tools.throwRange),end=aimEndpoint(origin,{x:dx,z:dz},range,obstacles);
  // stopped by a wall: stay clear of its face so the blast centre is on the floor, not inside the wall
  const reached=Math.hypot(end.x-origin.x,end.z-origin.z),back=reached<range-1e-6?Math.min(.15,reached):0;
  return {x:end.x-dx/d*back,z:end.z-dz/d*back};
}
// Tap throw: nearest enemy within throwRange, else `forward` metres along the facing direction.
export function autoThrowPoint(round,origin,facing,obstacles=[]){
  const target=nearestTarget(origin,round.level.enemies);
  if(target)return {...landingPoint(origin,target,obstacles),target};
  const l=Math.hypot(facing.x,facing.z)||1;
  return {...landingPoint(origin,{x:origin.x+facing.x/l*RULES.tools.forward,z:origin.z+facing.z/l*RULES.tools.forward},obstacles),target:null};
}
// Drag preview: where the tool would land and the ring to draw there.
export function previewThrow(round,origin,point,obstacles=[]){
  const def=toolDef(round?.tool?.id);if(!def)return null;
  return {...landingPoint(origin,point,obstacles),radius:def.radius,kind:def.kind};
}

// Throw the carried tool at `point` (already a landing point, or one to be clamped). Returns the effect or null.
export function throwTool(round,origin,point,now,obstacles=[]){
  if(!canUseTool(round))return null;
  const def=toolDef(round.tool.id);if(!def)return null;
  const at=landingPoint(origin,point,obstacles);
  if(round.toolFx?.level!==round.level)clearFx(round);
  const fx=round.toolFx;
  round.tool.charges--;round.tool.thrown++;
  const e={kind:def.kind,x:at.x,z:at.z,radius:def.radius,at:now};
  if(def.kind==='grenade'){e.detonateAt=now+def.fuseMs;e.damage=def.damage;fx.fuses.push(e);}
  else if(def.kind==='emp'){Object.assign(e,applyEmp(round,at,def,now));e.until=now+PULSE_SHOW_MS;fx.pulses.push(e);}
  else if(def.kind==='decoy'){e.until=now+def.lureMs;fx.decoys.push(e);applyLures(round,now);}
  return e;
}
function clearFx(round){
  for(const en of round.level.enemies){delete en.lureTarget;delete en.lureUntil;}
  round.toolFx={level:round.level,fuses:[],decoys:[],pulses:[]};
}
// EMP: sentries/turrets and node shields in range go dark for stunMs.
function applyEmp(round,at,def,now){
  let stunned=0,shields=0;
  for(const en of round.level.enemies){
    if(!alive(en)||!def.stunTypes.includes(en.type)||dist(at,en)>def.radius)continue;
    en.stunnedUntil=now+def.stunMs;en.windupAt=null;stunned++;
  }
  for(const n of round.level.nodes){
    if(!n.shielded||n.active||dist(at,n)>def.radius)continue;
    n.shieldDownUntil=now+def.stunMs;shields++;
  }
  return {stunned,shields};
}
// Decoys: every enemy inside a live decoy's radius heads for the nearest one.
function applyLures(round,now){
  const fx=round.toolFx;
  for(const en of round.level.enemies){
    if(!alive(en)||!(en.speed>0))continue;
    let best=null,bd=Infinity;
    for(const d of fx.decoys){if(now>=d.until)continue;const k=dist(d,en);if(k<=d.radius&&k<bd){best=d;bd=k;}}
    if(best){en.lureTarget={x:best.x,z:best.z};en.lureUntil=best.until;}
    else if(en.lureTarget&&now>=(en.lureUntil??0)){delete en.lureTarget;delete en.lureUntil;}
  }
}
// Per-frame upkeep: detonate due grenades, keep lures current, drop expired effects. Returns blasts this frame.
export function stepTools(round,now){
  const fx=round.toolFx;if(!fx||round.over||round.pauseAt!=null)return [];
  if(fx.level!==round.level){clearFx(round);return [];}
  const blasts=[];
  for(let i=fx.fuses.length-1;i>=0;i--){
    const g=fx.fuses[i];if(now<g.detonateAt)continue;
    fx.fuses.splice(i,1);
    let hits=0;
    for(const en of round.level.enemies){if(alive(en)&&dist(g,en)<=g.radius&&hitEnemy(round,en.id,now,g.damage))hits++;}
    g.hits=hits;g.until=now+PULSE_SHOW_MS;fx.pulses.push(g);blasts.push(g);
  }
  fx.decoys=fx.decoys.filter(d=>now<d.until);
  fx.pulses=fx.pulses.filter(p=>now<p.until);
  applyLures(round,now);
  return blasts;
}
export const isStunned=(enemy,now)=>now<(enemy.stunnedUntil??0);
export const shieldIsDown=(node,now)=>now<(node.shieldDownUntil??0);
