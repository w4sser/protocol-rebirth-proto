import {ENEMY_TUNING,isShieldTurret} from './enemies.js?v=2.28.22';
// Encounters (docs/design-encounters-toolkit.md §1, PR C): one named problem per level, placed in the
// existing seeded rooms. This file is the pure part: placement + small geometry helpers. The live behaviour
// (guard turning, patrol sight, swarm spawn) runs in combat.js, hit rules in round.js, visuals in world.js.
// All numbers live in RULES.encounters (levels.js). Placement is a pure function of (level, area, seeded rng).
//
// Every encounter has a tool solution AND a movement/timing solution (tests/encounters.test.mjs proves both):
//   guard   flank behind its front shield                | Decoy pulls it off the node
//   turret  hop between cover while it recovers          | EMP shuts it down for 4 s
//   door    longer side passage (always open)            | keycard from a crate opens the door
//   patrol  sneak up behind it, outside the cone         | Decoy draws it away
//   swarm   fall back into a corridor so they queue      | Grenade on the spawn cluster
//   shield  shoot the generator                          | EMP drops the node shield
//   grenadier  leave the coral ring before the blast     | kill / flank it before the lob (Decoy also pulls it off)
// The guard is a L2+ problem (L1 teaches the patrol). Hard (RULES.hard.plan) stacks two or three problems per level.
import {RULES} from './levels.js?v=2.28.22';
import {traceTargets} from './physics.mjs?v=2.28.22';
import {detectionMultiplier} from './stakes.js?v=2.28.22';

const PI=Math.PI,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const ENCOUNTER_TYPES=['guard','turret','shield_turret','patrol','swarm','shield','door','grenadier'];
// Facing is an angle a with forward = (sin a, cos a): the same convention as three.js rotation.y on +z.
export const facingVec=a=>({x:Math.sin(a),z:Math.cos(a)});
export const angleTo=(from,to)=>Math.atan2(to.x-from.x,to.z-from.z);
export function angleDiff(a,b){let d=(a-b)%(2*PI);if(d>PI)d-=2*PI;if(d<-PI)d+=2*PI;return Math.abs(d);}
export function turnToward(current,wanted,maxStep){const d=Math.atan2(Math.sin(wanted-current),Math.cos(wanted-current));return Math.abs(d)<=maxStep?wanted:current+Math.sign(d)*maxStep;}

// Front shield: a hit from inside the guard's front arc is blocked; behind and the sides always count.
// The intro guard never carries a shield, and a hit with an unknown origin (no `from`) is not blocked.
export function shieldBlocks(enemy,from,now=0){
  if(isShieldTurret(enemy)&&now<(enemy.shieldDownUntil??0))return false;
  if(!enemy.frontShield||enemy.introGuard||!from)return false;
  return angleDiff(enemy.facing??0,angleTo(enemy,from))<enemy.frontShield*PI/180;
}
// One hit never takes more than RULES.encounters.maxHitFraction of max HP (area dmgMul scales the base share).
export function encounterDamage(round,type){
  const E=RULES.encounters,maxHp=round.maxHealth??100,mul=round.level?.dmgMul??1;
  return Math.max(1,Math.min(Math.floor(maxHp*E.maxHitFraction),Math.round(maxHp*E[type].damagePct*mul)));
}
// Sight cone test (geometry only; the caller adds line of sight). range already includes the player's stealth.
export function inSightCone(enemy,point,range,halfAngleDeg){
  const d=dist(enemy,point);
  return d<=range&&(d<1e-6||angleDiff(enemy.facing??0,angleTo(enemy,point))<=halfAngleDeg*PI/180);
}
// Stealth shrinks the cone, a full bag grows it (bag weight, data/raid-stakes.js).
export const sightRange=(round,type='patrol')=>RULES.encounters[type].coneRange*(1-(round?.stats?.stealth??0))*detectionMultiplier(round)*(round?.level?.aggroMul??1);
export const encountersOf=level=>level?.intro?[]:(level?.encounters??[]);
export const hintFor=type=>RULES.encounters.hints[type]??null;
// Weapon-only positional bonus, evaluated before the hit wakes the target.
export function weakSide(enemy,from){
  if(!from||enemy.type==='generator')return null;
  const W=RULES.shooting.weakSides;
  if(!enemy.aggro&&enemy.alertAt==null&&enemy.lastHitAt==null&&enemy.nearMissAt==null)return {kind:'unaware',multiplier:W.unawareMultiplier};
  if(angleDiff((enemy.facing??0)+Math.PI,angleTo(enemy,from))<=W.backHalfAngleDeg*Math.PI/180)return {kind:'flank',multiplier:W.flankMultiplier};
  return null;
}
// Result-screen tip for the problem that dealt the last hit of a lost raid (null for ordinary enemies / hazards).
export function deathTip(round){
  if(!round?.over||round.reason!=='death')return null;
  const type=round.lastHit?.source,tip=type&&Object.hasOwn(RULES.encounters.tips,type)?RULES.encounters.tips[type]:null;
  return tip?{type,tool:tip.tool,text:tip.text}:null;
}

// ---- placement ----
const solidsOf=level=>[...level.walls,...level.boxes,...level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];
const nearRect=(o,p,m)=>Math.abs(p.x-o.x)<o.w/2+m&&Math.abs(p.z-o.z)<o.d/2+m;
const onFloor=(level,p,m=.3)=>level.floors.some(f=>Math.abs(p.x-f.x)<=f.w/2-m&&Math.abs(p.z-f.z)<=f.d/2-m);
// The town's enterable house is cut into a room's back (north / west) wall later; keep that band free of encounter
// objects so a house always finds its doorway lane (town-layout.placeHouse).
let townBand=false,bandWidth=2.7;
const inBand=(level,p)=>townBand&&level.rooms.some(r=>Math.abs(p.x-r.x)<=r.w/2&&Math.abs(p.z-r.z)<=r.d/2&&(p.z<r.z-r.d/2+bandWidth||p.x<r.x-r.w/2+bandWidth));
const spotFree=(level,p,clear,solids=solidsOf(level))=>onFloor(level,p)&&!inBand(level,p)&&!solids.some(o=>nearRect(o,p,clear));
// A 1.1 m cover must not pinch a gap the player (0.72 m wide) cannot pass: every neighbour edge is >= 1.05 m away.
function coverFits(level,p,solids,gap=1.05){
  if(!onFloor(level,p,.8)||inBand(level,p))return false;
  return solids.every(o=>{const gx=Math.abs(p.x-o.x)-(1.1+o.w)/2,gz=Math.abs(p.z-o.z)-(1.1+o.d)/2;
    if(gx<0&&gz<0)return false;return (gx>0&&gz>0?Math.hypot(gx,gz):Math.max(gx,gz))>=gap;});
}
const keepList=level=>[level.start,level.exit,...level.nodes,...level.lootBoxes,...level.enemies,...(level.hazards??[])];
const roomIndexOf=(level,p)=>level.rooms.findIndex(r=>Math.abs(p.x-r.x)<=r.w/2&&Math.abs(p.z-r.z)<=r.d/2);
const round2=v=>Math.round(v*100)/100;
function shuffled(list,rng){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function segmentFree(level,a,b,clear,solids){
  const n=Math.max(2,Math.ceil(dist(a,b)/.35));
  for(let i=0;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n};if(!spotFree(level,p,clear,solids))return false;}
  return true;
}
function makeEnemy(level,type,over){
  const T=RULES.enemyTypes[type];
  const e={id:`enemy-${level.enemies.length+1}`,kind:'enemy',x:0,z:0,r:.48,health:RULES.enemyHealth,speed:0,type,rangeMul:T.rangeMul,cooldownMul:T.cooldownMul,standoff:T.standoff,...over};
  level.enemies.push(e);return e;
}
function note(level,entry){level.encounters.push(entry);return entry;}

export function applyEncounters(level,area,rng,hard=false){
  const plan=(hard?RULES.hard.plan:RULES.encounters.plan)[area]?.[level.number-1]??[];
  level.encounters=[];townBand=area==='town';bandWidth=2.7;
  for(const type of plan)PLACERS[type]?.(level,rng);
  // Choose after placement so the variant does not perturb the existing cover/layout RNG.
  if(level.number===2)for(const enc of level.encounters){
    if(enc.type!=='turret'||rng()>=ENEMY_TUNING.shieldTurret.variantChance)continue;
    const e=level.enemies.find(e=>e.id===enc.enemyId),C=RULES.encounters.shield_turret;
    if(e){enc.type='shield_turret';Object.assign(e,{encounter:'shield_turret',archetype:'shield_turret',frontShield:C.frontHalfAngleDeg,health:C.health});}
  }
  // Last: every solid on the board now exists (a shield generator, a swarm's extra bodies...), so this is the
  // only point a front-shielded guard/shield_turret can be checked and, if needed, moved to a spot whose rear
  // is actually reachable. See docs/bug-lint.md #1.
  ensureRearClearance(level,rng,{omit:false});
  return level.encounters;
}

// ---- rear-clearance (bug-lint #1): a front-shielded guard/shield_turret must always have a flank the
// player can walk to, see it from, and stand in - otherwise its vulnerable side is unreachable and it
// cannot be killed. "Flank" here is any spot outside the shield's own front arc (shieldBlocks above),
// with a little buffer past the exact edge, swept across a few engagement distances - lenient on purpose,
// since the goal is only to catch a back truly boxed in, not to re-litigate every placement that already
// has room to work with (tests/encounters.test.mjs proves those solvable with the real sim).
const FLANK_BUFFER_DEG=8,FLANK_STEP_DEG=20,FLANK_RADII=[1.3,1.8,2.4],FLANK_MARGIN=.5;
const enemyFootprint=e=>e.type==='generator'?{x:e.x,z:e.z,w:1.6,d:1.1}:{x:e.x,z:e.z,w:(e.r||.48)*2,d:(e.r||.48)*2};
// Every OTHER live enemy counts as a solid here (a generator, a second guard, a regular filler body...),
// matching combat.js stepCombat which feeds round.level.enemies into the player's own movement collision.
// Only bodies that never leave their spot count (generator, turrets, other guards); patrols, grunts and rushers move,
// so they can never permanently seal a flank.
const STATIC_ENC=new Set(['guard','turret','shield_turret']);
const staticBody=e=>e.type==='generator'||STATIC_ENC.has(e.encounter);
const lockedDoors=level=>(level.doors??[]).filter(d=>d.locked).map(d=>({x:d.x,z:d.z,w:d.w,d:d.d}));
const solidsWithEnemies=(level,exceptId)=>[...solidsOf(level),...lockedDoors(level),...level.enemies.filter(e=>e.id!==exceptId&&e.health!==0&&staticBody(e)).map(enemyFootprint)];
// Grid flood fill from the start over the floor, around walls/boxes/nodes and every enemy body except `exceptId`
// (player radius .3). A flank only counts if the player can actually WALK there, not just see it.
const WALK_STEP=.2,WALK_RADIUS=.36; // the player's own collision radius
export function walkMap(level,exceptId){
  const solids=solidsWithEnemies(level,exceptId),F=level.floors;
  const x0=Math.min(...F.map(f=>f.x-f.w/2)),z0=Math.min(...F.map(f=>f.z-f.d/2)),x1=Math.max(...F.map(f=>f.x+f.w/2)),z1=Math.max(...F.map(f=>f.z+f.d/2));
  const nx=Math.ceil((x1-x0)/WALK_STEP)+1,nz=Math.ceil((z1-z0)/WALK_STEP)+1,seen=new Uint8Array(nx*nz),free=new Uint8Array(nx*nz);
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const q={x:x0+i*WALK_STEP,z:z0+j*WALK_STEP};
    const on=(x,z)=>F.some(f=>Math.abs(x-f.x)<=f.w/2+.06&&Math.abs(z-f.z)<=f.d/2+.06),R=WALK_RADIUS;
    if(on(q.x,q.z)&&on(q.x-R,q.z-R)&&on(q.x+R,q.z-R)&&on(q.x-R,q.z+R)&&on(q.x+R,q.z+R)&&!solids.some(o=>Math.abs(q.x-o.x)<o.w/2+WALK_RADIUS&&Math.abs(q.z-o.z)<o.d/2+WALK_RADIUS))free[i*nz+j]=1;}
  const cell=q=>[Math.round((q.x-x0)/WALK_STEP),Math.round((q.z-z0)/WALK_STEP)];
  const [si,sj]=cell(level.start),st=[];
  let best=-1,bd=Infinity; // seed from the single free cell nearest the start, never across a barrier
  for(let i=si-3;i<=si+3;i++)for(let j=sj-3;j<=sj+3;j++)if(i>=0&&j>=0&&i<nx&&j<nz&&free[i*nz+j]){const d=(i-si)**2+(j-sj)**2;if(d<bd){bd=d;best=i*nz+j;}}
  if(best>=0){seen[best]=1;st.push(best);}
  while(st.length){const c=st.pop(),i=Math.floor(c/nz),j=c%nz;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz)continue;const k=a*nz+b;if(free[k]&&!seen[k]){seen[k]=1;st.push(k);}}}
  return q=>{const [i,j]=cell(q);return i>=0&&j>=0&&i<nx&&j<nz&&seen[i*nz+j]===1;};
}
export function hasClearRear(level,p,facing,solids,frontHalfAngleDeg=RULES.encounters.guard.frontHalfAngleDeg,walk=null){
  const room=roomIndexOf(level,p),start=frontHalfAngleDeg+FLANK_BUFFER_DEG,end=360-start;
  for(let deg=start;deg<=end;deg+=FLANK_STEP_DEG)for(const r of FLANK_RADII){
    const a=facing+deg*PI/180,q={x:round2(p.x+Math.sin(a)*r),z:round2(p.z+Math.cos(a)*r)};
    if(roomIndexOf(level,q)!==room)continue; // stay in the same room: a flank through a wall is not reachable
    if(traceTargets(q,p,solids,[])?.kind==='wall')continue; // must actually see/hit the enemy from there
    if(spotFree(level,q,FLANK_MARGIN,solids)&&(!walk||walk(q)))return true;
  }
  return false;
}
// Test-only helper: recomputes the full solids (incl. other enemies) for one enemy and checks its rear arc.
export const guardRearClear=(level,enemy)=>hasClearRear(level,enemy,enemy.facing??0,solidsWithEnemies(level,enemy.id),enemy.frontShield,walkMap(level,enemy.id));
// Re-anchor a guard to a node-relative spot whose rear is clear, now every encounter is on the board. A
// non-node encounter (shield_turret) gets a small local nudge instead, keeping its cover/lane intact.
function relocateForClearRear(level,enemy,enc,rng){
  const solids=solidsWithEnemies(level,enemy.id),walk=walkMap(level,enemy.id);
  if(enc.type==='guard'){
    const G=RULES.encounters.guard,node=level.nodes.find(n=>n.id===enc.nodeId);if(!node)return false;
    const keep=[level.start,level.exit],cands=[];
    // First the authored ring/arrival window; then a wider ring by the same node with any arrival distance.
    for(const [rad,strict] of [[G.distance,true],[1.6,false],[2.1,false],[2.7,false],[3.3,false]]){
      for(let k=0;k<16;k++){const a=k/16*2*PI,p={x:round2(node.x+Math.sin(a)*rad),z:round2(node.z+Math.cos(a)*rad)};
        if(!spotFree(level,p,1,solids)||!walk(p)||keep.some(o=>dist(p,o)<2.6))continue;
        const arr=arrival(level,p),d=dist(p,arr),facing=angleTo(p,arr);
        if(strict&&(d<4.2||d>6.8))continue;
        if(!hasClearRear(level,p,facing,solids,enemy.frontShield,walk))continue;
        cands.push({p,facing});}
      if(cands.length)break;}
    if(!cands.length)return false;
    const {p,facing}=shuffled(cands,rng)[0];
    Object.assign(enemy,{x:p.x,z:p.z,facing});enc.x=p.x;enc.z=p.z;return true;
  }
  for(const r of [.5,.8,1.1,1.4])for(let k=0;k<12;k++){
    const a=k/12*2*PI,p={x:round2(enemy.x+Math.sin(a)*r),z:round2(enemy.z+Math.cos(a)*r)};
    if(roomIndexOf(level,p)!==roomIndexOf(level,enemy)||!spotFree(level,p,.9,solids))continue;
    if([level.start,level.exit].some(o=>dist(p,o)<2))continue;
    const facing=enc.from?angleTo(p,enc.from):(enemy.facing??0);
    if(!hasClearRear(level,p,facing,solids,enemy.frontShield,walk))continue;
    Object.assign(enemy,{x:p.x,z:p.z,facing});enc.x=p.x;enc.z=p.z;return true;
  }
  return false;
}
export function ensureRearClearance(level,rng,{omit=true}={}){
  for(const enc of [...level.encounters]){
    if(enc.type!=='guard'&&enc.type!=='shield_turret')continue;
    const enemy=level.enemies.find(e=>e.id===enc.enemyId);if(!enemy)continue;
    if(guardRearClear(level,enemy))continue;
    if(relocateForClearRear(level,enemy,enc,rng))continue;
    if(!omit)continue; // applyEncounters pass: ids are still being allocated; generateLevel's final pass omits
    // No walkable flank anywhere sensible: never ship an unkillable enemy and never silently strip its shield.
    // The impossible encounter is omitted at generation (enemy and its encounter entry removed, noted for debug).
    level.enemies.splice(level.enemies.indexOf(enemy),1);
    level.encounters.splice(level.encounters.indexOf(enc),1);
    (level.omittedEncounters??=[]).push({type:enc.type,enemyId:enemy.id,reason:'no-walkable-flank'});
  }
}

// Where the player comes from into the room that holds `p`: the gap in its partition, else its door, else the start (first room).
function arrival(level,p){const room=level.rooms[roomIndexOf(level,p)];
  if(room?.partition)return {x:room.partition.x,z:room.partition.z}; // the gap in the partition wall: the player walks out of it
  return room?.incoming?{x:room.x+room.incoming.x*room.w/2,z:room.z+room.incoming.z*room.d/2}:level.start;}

// 1 Core guard: the level's first enemy stands by the node, facing where the player arrives, behind a front shield.
// Level 1 never gets one (it is too early for a shield; L1 teaches the patrol).
function placeGuard(level,rng){
  const G=RULES.encounters.guard,enemy=level.enemies[0],node=level.nodes[0];if(!enemy||!node||level.number===1)return;
  const solids=solidsOf(level),keep=[level.start,level.exit],cands=[];
  for(let k=0;k<16;k++){const a=k/16*2*PI,p={x:round2(node.x+Math.sin(a)*G.distance),z:round2(node.z+Math.cos(a)*G.distance)};
    if(!spotFree(level,p,1,solids)||keep.some(o=>dist(p,o)<2.6))continue;
    const d=dist(p,arrival(level,p));cands.push({p,ok:d>=4.2&&d<=6.8});}
  const pool=shuffled(cands.filter(c=>c.ok).length?cands.filter(c=>c.ok):cands,rng);if(!pool.length)return;
  const {p}=pool[0];
  Object.assign(enemy,{x:p.x,z:p.z,speed:G.speed,health:G.health,encounter:'guard',frontShield:G.frontHalfAngleDeg,facing:angleTo(p,arrival(level,p)),active:true});
  note(level,{type:'guard',enemyId:enemy.id,nodeId:node.id,x:p.x,z:p.z});
}

// 2 Turret behind cover: a sentry across the start room with two crates in the lane between you and it.
function placeTurret(level,rng,variant='turret'){
  const C=RULES.encounters[variant],room=level.rooms[0],S=level.start,solids=solidsOf(level),keep=keepList(level);
  const mouths=room.doors.map(d=>({x:room.x+d.x*room.w/2,z:room.z+d.z*room.d/2}));
  // scan the room on a grid (seeded order); tier 0 is the comfortable layout, tier 1 accepts a shorter lane and tighter margins
  const grid=[];for(let x=room.x-room.w/2+1.5;x<=room.x+room.w/2-1.5;x+=.5)for(let z=room.z-room.d/2+1.5;z<=room.z+room.d/2-1.5;z+=.5)grid.push({x:round2(x),z:round2(z)});
  const order=shuffled(grid,rng);
  // The turret must see the start (a partition wall may split the room) and the lane needs 1-2 crates of cover.
  // Tier 0: two covers, comfortable gaps; tier 1: tighter gaps and a shorter lane; tier 2: one cover, thinner house band.
  for(const tier of [0,1,2,3]){
    bandWidth=tier>=2?1.5:2.7;const gap=tier===0?1.05:tier===3?.8:.9,fractions=tier>=2?[.5]:[.4,.72];
    for(const T of order){
      const d=dist(T,S);if(d<C.lane-(tier===0?0:tier===3?1.6:.8)||d>C.lane+3.6)continue;
      // loot crates may sit near the turret (risk / reward); start, exit, nodes and enemies may not
      if(!spotFree(level,T,1.1,solids)||keep.some(o=>dist(T,o)<(o.item?1.2:2)-tier*.4)||mouths.some(m=>dist(T,m)<2.4-tier*.9))continue;
      if(traceTargets(T,S,solids,[])?.kind==='wall')continue;
      const covers=[];let ok=true;
      for(const f of fractions){
        let placed=null;
        for(const lat of [0,.9,-.9]){const q={x:S.x+(T.x-S.x)*f,z:S.z+(T.z-S.z)*f};const nx=-(T.z-S.z)/d,nz=(T.x-S.x)/d;const p={x:round2(q.x+nx*lat),z:round2(q.z+nz*lat)};
          if(coverFits(level,p,[...solids,...covers],gap)&&!keep.some(o=>dist(p,o)<1.6-tier*.2)&&!(level.hazards??[]).some(h=>Math.abs(p.x-h.x)<h.w/2+.55&&Math.abs(p.z-h.z)<h.d/2+.55)){placed={x:p.x,z:p.z,w:1.1,d:1.1,h:1.1,encounterCover:true};break;}}
        if(!placed){ok=false;break;}covers.push(placed);
      }
      if(!ok)continue;
      level.boxes.push(...covers);
      const e=makeEnemy(level,'sentry',{x:T.x,z:T.z,health:C.health,encounter:variant,...(variant==='shield_turret'?{archetype:variant,frontShield:C.frontHalfAngleDeg}:{}),facing:angleTo(T,S),active:true});
      note(level,{type:variant,enemyId:e.id,x:T.x,z:T.z,covers:covers.map(b=>({x:b.x,z:b.z})),from:{x:S.x,z:S.z}});
      return;
    }
  }
}

// 4 Patrol: a grunt walks a fixed back-and-forth loop across the route; its sight cone is drawn on the floor.
function placePatrol(level,rng){
  const P=RULES.encounters.patrol,L1=level.number===1;
  const room=L1?level.rooms[0]:level.rooms.at(-1),focus=L1?level.nodes[0]:(room.partition??level.nodes.at(-1));
  const solids=solidsOf(level),dirs=L1?[[1,0],[0,1],[.7071,.7071],[.7071,-.7071]]:[[1,0],[0,1]];
  const tries=[];
  for(const len of [P.length,3.6])for(const off of [2.6,3.2,2.2,3.8])for(const [ux,uz] of dirs)for(const sg of [1,-1])for(const along of [0,-1.2,1.2,-2.4,2.4,-3.6,3.6])tries.push({len,off,ux,uz,sg,along});
  for(const t of shuffled(tries,rng).sort((a,b)=>b.len-a.len)){
    const nx=-t.uz*t.sg,nz=t.ux*t.sg,c={x:focus.x+nx*t.off+t.ux*t.along,z:focus.z+nz*t.off+t.uz*t.along};
    const a={x:round2(c.x-t.ux*t.len/2),z:round2(c.z-t.uz*t.len/2)},b={x:round2(c.x+t.ux*t.len/2),z:round2(c.z+t.uz*t.len/2)};
    if(roomIndexOf(level,a)!==roomIndexOf(level,room)||roomIndexOf(level,b)!==roomIndexOf(level,room))continue;
    if(!segmentFree(level,a,b,1,solids))continue;
    if([a,b,c].some(p=>dist(p,level.start)<3.4||dist(p,level.exit)<1.5||level.nodes.some(n=>dist(p,n)<1.8)))continue;
    const enemy=L1?level.enemies[0]:makeEnemy(level,'grunt',{});
    const base=RULES.levels[level.number-1];
    Object.assign(enemy,{x:a.x,z:a.z,health:P.health,speed:base.enemySpeed??1,encounter:'patrol',patrol:{points:[a,b],i:1,speed:P.walkSpeed,turn:P.turnRadPerSec},
      facing:angleTo(a,b),windupMs:P.windupMs,aggro:false,active:true});
    note(level,{type:'patrol',enemyId:enemy.id,x:round2(c.x),z:round2(c.z),points:[a,b]});
    return;
  }
}

// 5 Swarm: a spawn point in the middle room; 4-5 rushers wait inactive around it until the player gets close.
function placeSwarm(level,rng){
  const S=RULES.encounters.swarm,ri=Math.min(1,level.rooms.length-1),room=level.rooms[ri],solids=solidsOf(level),keep=keepList(level);
  const entry=room.incoming?{x:room.x+room.incoming.x*room.w/2,z:room.z+room.incoming.z*room.d/2}:level.start;
  const exits=room.doors.filter(d=>!room.incoming||d.x!==room.incoming.x||d.z!==room.incoming.z).map(d=>({x:room.x+d.x*room.w/2,z:room.z+d.z*room.d/2}));
  const need=S.ring+.9;
  // drawn up front so the swarm size does not depend on how many placement attempts the room needed
  const count=S.count[0]+Math.floor(rng()*(S.count[1]-S.count[0]+1)),a0=rng()*2*PI;
  // grid scan in seeded order; tier 1 (small rooms) accepts a spawn point closer to the entry and the exit door
  const grid=[];for(let x=room.x-room.w/2+need;x<=room.x+room.w/2-need;x+=.5)for(let z=room.z-room.d/2+need;z<=room.z+room.d/2-need;z+=.5)grid.push({x:round2(x),z:round2(z)});
  const order=shuffled(grid,rng);
  for(const tier of [0,1,2])for(const P of order){
    if(dist(P,entry)<S.minEntry-tier*1.5||exits.some(e=>dist(P,e)<3.2-tier*1.2))continue;
    if(!spotFree(level,P,need,solids)||keep.some(o=>dist(P,o)<(o.r?need:need+.4)-tier*.4))continue;
    const id=`swarm-${level.number}`,ids=[];
    for(let k=0;k<count;k++){const a=a0+k/count*2*PI;
      const e=makeEnemy(level,'rusher',{x:round2(P.x+Math.sin(a)*S.ring),z:round2(P.z+Math.cos(a)*S.ring),health:S.health,speed:S.speed,encounter:'swarm',swarm:id,active:false,
        graceMs:S.emergeMs,windupMs:S.windupMs,cooldownMs:S.cooldownMs,cooldownMul:1});
      ids.push(e.id);}
    (level.spawners??=[]).push({id,x:P.x,z:P.z,trigger:S.triggerRadius,warnMs:S.warnMs,emergeMs:S.emergeMs,state:'armed',enemyIds:ids});
    note(level,{type:'swarm',spawnerId:id,enemyIds:ids,x:P.x,z:P.z,room:ri,entry});
    return;
  }
}

// 6 Shielded node: the (seeded) shielded node gets a generator 2.5 m away; shoot it, or EMP the pair.
function placeShield(level,rng){
  const G=RULES.encounters.shield;let node=level.nodes.find(n=>n.shielded);
  if(!node){node=level.nodes.at(-1);node.shielded=true;}
  const solids=solidsOf(level),room=level.rooms[Math.max(0,roomIndexOf(level,node))],cands=[];
  // 2.5 m from the node by default; up to 2.8 m still lets one EMP (3 m) cover generator and node together
  for(const r of [G.distance,G.distance-.3,G.distance+.3]){
    for(let k=0;k<16;k++){
      const a=k/16*2*PI,p={x:round2(node.x+Math.sin(a)*r),z:round2(node.z+Math.cos(a)*r)};
      if(!spotFree(level,p,.9,solids)||roomIndexOf(level,p)!==roomIndexOf(level,node))continue;
      if([level.start,level.exit].some(o=>dist(p,o)<2)||level.lootBoxes.some(o=>dist(p,o)<1.2)||level.enemies.some(o=>dist(p,o)<1.4))continue;
      cands.push({p,score:dist(p,room)});}
    if(cands.length)break;}
  if(!cands.length)return;
  const {p}=shuffled(cands,rng).sort((a,b)=>a.score-b.score).slice(0,3)[0];
  const e=makeEnemy(level,'grunt',{x:p.x,z:p.z,health:G.health,speed:0,type:'generator',encounter:'shield',node:node.id,rangeMul:0,cooldownMul:1,standoff:0,active:true});
  node.generatorId=e.id;
  note(level,{type:'shield',nodeId:node.id,generatorId:e.id,x:p.x,z:p.z});
}

// Cut a bw-wide opening into a room's edge wall piece at perpendicular offset s (dry = only test it).
function cutEdge(level,room,dir,s,bw,doorW,dry){
  const t=RULES.wallThickness,isX=dir.x!==0,len=isX?room.d:room.w,sign=s>0?1:-1;
  const edge={x:room.x+dir.x*(room.w/2-t/2),z:room.z+dir.z*(room.d/2-t/2)};
  const cx=isX?edge.x:edge.x+sign*(len+doorW)/4,cz=isX?edge.z+sign*(len+doorW)/4:edge.z;
  const i=level.walls.findIndex(w=>Math.abs(w.x-cx)<1e-3&&Math.abs(w.z-cz)<1e-3&&Math.abs(w.h-.85)<1e-9);if(i<0)return false;
  const w=level.walls[i],lo=isX?w.z-w.d/2:w.x-w.w/2,hi=isX?w.z+w.d/2:w.x+w.w/2,c0=(isX?room.z:room.x)+s,a=c0-bw/2,b=c0+bw/2;
  if(a<lo+.5||b>hi-.5)return false;if(dry)return true;
  const piece=(p,q)=>isX?{...w,z:round2((p+q)/2),d:round2(q-p)}:{...w,x:round2((p+q)/2),w:round2(q-p)};
  level.walls.splice(i,1,piece(lo,a),piece(b,hi));return true;
}
// 3 Locked door: the corridor into the last room is shut; the keycard lies in a crate in the middle room.
// A second, longer passage (cut into both room walls) is always open, so the door is a shortcut, not a gate.
function placeDoor(level,rng){
  const D=RULES.encounters.door,c=level.corridors[1],r1=level.rooms[1],r2=level.rooms[2];if(!c||!r1||!r2)return;
  const dir=c.dir,back={x:-dir.x,z:-dir.z},isX=dir.x!==0,t=RULES.wallThickness,bw=D.passageWidth;
  const s=(rng()<.5?-1:1)*D.passageOffset;
  if(!cutEdge(level,r1,dir,s,bw,c.width,true)||!cutEdge(level,r2,back,s,bw,c.width,true))return;
  // key crate first (it needs free floor in the middle room); no card spot = no door
  const solids=solidsOf(level),keep=keepList(level);let spot=null;
  for(let a=0;a<600&&!spot;a++){const p={x:round2(r1.x+(rng()-.5)*(r1.w-3)),z:round2(r1.z+(rng()-.5)*(r1.d-3))};
    if(spotFree(level,p,1.2,solids)&&!keep.some(o=>dist(p,o)<2.2)&&dist(p,{x:c.x,z:c.z})>4)spot=p;}
  if(!spot)return;
  cutEdge(level,r1,dir,s,bw,c.width);cutEdge(level,r2,back,s,bw,c.width);
  const a=isX?r1.x+dir.x*r1.w/2:r1.z+dir.z*r1.d/2,b=isX?r2.x-dir.x*r2.w/2:r2.z-dir.z*r2.d/2,mid=(a+b)/2,len=Math.abs(b-a);
  const px=isX?mid:r1.x+s,pz=isX?r1.z+s:mid;
  level.floors.push({x:round2(px),z:round2(pz),w:isX?round2(len+.08):bw,d:isX?bw:round2(len+.08),width:bw,dir});
  for(const sg of [-1,1])level.walls.push({x:round2(isX?mid:px+sg*(bw/2-t/2)),z:round2(isX?pz+sg*(bw/2-t/2):mid),w:isX?round2(len):t,d:isX?t:round2(len),h:.85});
  const th=D.thickness,door={id:'door-1',x:c.x,z:c.z,w:isX?th:c.width,d:isX?c.width:th,h:D.height,locked:true,key:'key-1'};
  (level.doors??=[]).push(door);
  const box={id:'key-1',x:spot.x,z:spot.z,item:'keycard',key:'key-1',marked:false,revealed:true,collected:false,source:'KEYCARD · OPENS THE LOCKED DOOR'};
  level.lootBoxes.push(box);
  note(level,{type:'door',doorId:door.id,keyBoxId:box.id,x:door.x,z:door.z,passage:{x:round2(px),z:round2(pz),w:bw}});
}

// 7 Grenade thrower: a new enemy in the node room (first room on L1), >= 5 m from the start, that lobs a blast at where you stand.
function placeGrenadier(level,rng){
  const G=RULES.encounters.grenadier,room=level.number===1?level.rooms[0]:level.rooms.at(-1),solids=solidsOf(level),keep=keepList(level);
  const grid=[];for(let x=room.x-room.w/2+1.5;x<=room.x+room.w/2-1.5;x+=.5)for(let z=room.z-room.d/2+1.5;z<=room.z+room.d/2-1.5;z+=.5)grid.push({x:round2(x),z:round2(z)});
  const order=shuffled(grid,rng);
  for(const tier of [0,1,2])for(const p of order){
    if(!spotFree(level,p,1,solids)||dist(p,level.start)<G.distance-tier*1.5||keep.some(o=>dist(p,o)<(o.item?1.2:2.4)-tier*.5))continue;
    const T=RULES.enemyTypes.thrower,base=RULES.levels[level.number-1];
    const e=makeEnemy(level,'thrower',{x:p.x,z:p.z,health:G.health,speed:(base.enemySpeed??1)*T.speedMul,encounter:'grenadier',windupMs:G.warningMs,cooldownMs:G.cooldownMs,cooldownMul:1,active:true});
    note(level,{type:'grenadier',enemyId:e.id,x:p.x,z:p.z});
    return;
  }
}

const PLACERS={grenadier:placeGrenadier,guard:placeGuard,turret:placeTurret,shield_turret:(level,rng)=>placeTurret(level,rng,'shield_turret'),patrol:placePatrol,swarm:placeSwarm,shield:placeShield,door:placeDoor};
