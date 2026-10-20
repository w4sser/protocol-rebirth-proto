// PR C encounters (docs/design-encounters-toolkit.md §1). Every encounter is proven solvable BOTH with and without
// a tool by simulating a player with the real movement / physics / combat / weapon / tool functions (no teleporting
// except to set up a scenario's starting position).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RULES,generateLevel,AREAS} from '../levels.js';
import {createRound,tickRound,collectLoot,stepNodeInteraction,stepDoors,doorSolids,hitEnemy,activateNode,enterExit,nodeShielded} from '../round.js';
import {createCombat,stepCombat} from '../combat.js';
import {createWeapon,fireAimedWeapon,stepWeapon,assistAim} from '../weapon.js';
import {initTool,throwTool,stepTools,autoThrowPoint,shieldIsDown} from '../tools.js';
import {moveWithActors,movePlayer,traceTargets} from '../physics.mjs';
import {applyIntroEncounter} from '../progression-goal.js';
import {reachable} from '../town-layout.js';
import {bagItems} from '../raid.js';
import {shieldBlocks,encounterDamage,facingVec,angleTo,angleDiff,inSightCone,sightRange,deathTip,encountersOf,hintFor,ENCOUNTER_TYPES} from '../encounters.js';

const DEBUG=true;
const E=RULES.encounters,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const SEEDS=['enc-a','enc-b','enc-c','enc-d'];
const PLAN={bunker:[['guard'],['turret'],['swarm','shield']],archipelago:[['guard'],['patrol'],['swarm','shield']],town:[['patrol'],['turret'],['door','shield']]};

// ---------- simulation harness ----------
const DT=.04;
function sim(number,area,seed,{tool=null,start=null,only=null,stats={}}={}){
  const round=createRound(seed,0,stats);round.level=generateLevel(number,seed,area);
  if(only)round.level.enemies=round.level.enemies.filter(only);
  initTool(round,tool);
  const level=round.level,S={round,level,now:1000,P:{...(start??level.start)},weapon:createWeapon(Infinity),maxDrop:0,log:[]};
  // arrival grace only ever helps the player, so the harness drops it: enemies act from tick one
  S.combat=createCombat(level,S.now);S.combat.graceUntil=S.now;S.combat.moveAt=S.now;for(const e of level.enemies)S.combat.nextFire.set(e.id,S.now);
  S.solids=()=>[...level.walls,...level.boxes,...doorSolids(level)];
  S.playerSolids=()=>[...S.solids(),...level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];
  return S;
}
function tick(S,move=null){
  const {round}=S;S.now+=DT*1000;const hp=round.health;
  if(move){const d=Math.hypot(move.x,move.z)||1,sp=Math.min(1,d)*round.stats.speed*DT;S.P=moveWithActors(S.P,{x:move.x/d*sp,z:move.z/d*sp},S.level.enemies,S.playerSolids(),S.level.floors,RULES.playerRadius);}
  round.shooter=S.P;stepWeapon(S.weapon,round,S.now,DT,S.playerSolids());round.shooter=null;
  collectLoot(round,S.P,S.now,S.weapon);stepDoors(round,S.P,S.now);
  stepNodeInteraction(round,S.weapon,S.P,S.now,S.solids());
  stepCombat(round,S.combat,S.P,S.now,DT,S.playerSolids());
  stepTools(round,S.now);
  S.maxDrop=Math.max(S.maxDrop,hp-round.health);
  return !round.over;
}
const idle=(S,ms)=>{for(let t=0;t<ms&&!S.round.over;t+=DT*1000)tick(S);};
// walk to a point (real physics). Returns true when it got there.
function walk(S,to,{tol=.2,maxMs=15000}={}){
  for(let t=0;t<maxMs&&!S.round.over;t+=DT*1000){
    const d=dist(S.P,to);if(d<=tol)return true;
    tick(S,{x:to.x-S.P.x,z:to.z-S.P.z});
  }
  return dist(S.P,to)<=tol;
}
// grid route over the real colliders (like tests/playthrough.test.mjs); returns waypoints or null
function route(S,goal,{step=.3,tol=.45,enemies=true}={}){
  const boxes=[...S.playerSolids(),...(enemies?S.level.enemies.filter(e=>e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,w:.75,d:.75})):[])];
  const key=(x,z)=>`${x},${z}`,start=[Math.round(S.P.x/step),Math.round(S.P.z/step)],q=[start],parents=new Map([[key(...start),null]]);
  let found=null;
  for(let i=0;i<q.length&&!found;i++){
    const [x,z]=q[i],here={x:x*step,z:z*step};
    if(dist(here,goal)<=tol){found=[x,z];break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const k=key(x+dx,z+dz);if(parents.has(k))continue;
      // a hair more clearance than the real radius, so a stick that drifts a few mm off the grid never grazes a wall
      const next={x:(x+dx)*step,z:(z+dz)*step},w=movePlayer(here,{x:next.x-here.x,z:next.z-here.z},boxes,S.level.floors,RULES.playerRadius+.05);
      if(dist(w,next)<.001){parents.set(k,[x,z]);q.push([x+dx,z+dz]);}
    }
  }
  if(!found)return null;
  const path=[];for(let at=found;at;at=parents.get(key(...at)))path.unshift({x:at[0]*step,z:at[1]*step});
  return path;
}
const pathLength=p=>p.slice(1).reduce((s,q,i)=>s+dist(q,p[i]),0);
// follow a route smoothly (aim a waypoint ahead, like a stick held towards the goal) until within `tol` of the goal
function walkRoute(S,goal,{tol=.6,maxMs=30000,onTick=null,...opts}={}){
  const path=route(S,goal,{...opts});if(!path)return false;path.push({x:goal.x,z:goal.z});
  let i=1,anchor={...S.P},anchorAt=0;
  for(let t=0;t<maxMs&&!S.round.over;t+=DT*1000){
    onTick?.();if(dist(S.P,goal)<=tol)return true;
    while(i<path.length-1&&dist(S.P,path[i])<.4)i++;
    const aim=path[i];tick(S,{x:aim.x-S.P.x,z:aim.z-S.P.z});
    // stuck = barely moved for 2 s (the way round a wall may lead away from the goal, so distance is no measure)
    if(t-anchorAt>=2000){if(dist(S.P,anchor)<.25){if(DEBUG)console.error('DBG stuck',JSON.stringify({P:S.P,i,aim:path[i],n:path.length}));return false;}anchor={...S.P};anchorAt=t;}
  }
  return dist(S.P,goal)<=tol;
}
// keep firing at a target until it is dead (or time runs out)
function shootUntilDead(S,enemy,{maxMs=8000}={}){
  for(let t=0;t<maxMs&&enemy.health>0&&!S.round.over;t+=DT*1000){
    const aim={x:enemy.x-S.P.x,z:enemy.z-S.P.z};
    S.round.shooter=S.P;fireAimedWeapon(S.weapon,S.round,S.P,aim,S.now,S.playerSolids());S.round.shooter=null;
    tick(S);
  }
  if(enemy.health>0&&DEBUG){const a=assistAim(S.P,{x:enemy.x-S.P.x,z:enemy.z-S.P.z},S.level.enemies,S.playerSolids(),S.weapon.rule);
    console.error('DBG shoot fail',JSON.stringify({P:S.P,enemy:{x:enemy.x,z:enemy.z,hp:enemy.health,active:enemy.active},d:dist(S.P,enemy),target:a.target?.id,ammo:S.weapon.ammo,los:traceTargets(S.P,enemy,S.playerSolids(),[])?.kind}));}
  return enemy.health<=0;
}
function holdNode(S,node,maxMs=5000){
  for(let t=0;t<maxMs&&!node.active&&!S.round.over;t+=DT*1000)tick(S);
  return node.active;
}
const maxHealth=S=>S.round.maxHealth;
const hitCap=S=>Math.floor(maxHealth(S)*E.maxHitFraction);

// ---------- rules, data, placement ----------
test('RULES.encounters: telegraph >= 1 s everywhere, hints/tips for every type, damage shares stay under the hit cap',()=>{
  assert.deepEqual(Object.keys(E.hints).sort(),[...ENCOUNTER_TYPES].sort());
  assert.deepEqual(Object.keys(E.tips).sort(),[...ENCOUNTER_TYPES].sort());
  for(const [k,ms] of [['guard',E.guard.warningMs],['turret',E.turret.warningMs],['patrol',E.patrol.alertMs],['swarm',E.swarm.warnMs]])assert.ok(ms>=E.telegraphMs,`${k} telegraph ${ms}`);
  for(const t of ['guard','turret','patrol','swarm'])for(const maxHp of [50,100,200])for(const dmgMul of [1,1.15,1.25]){
    const r={maxHealth:maxHp,level:{dmgMul}};assert.ok(encounterDamage(r,t)<=Math.floor(maxHp*.3),`${t} ${maxHp} x${dmgMul}`);assert.ok(encounterDamage(r,t)>=1);}
  for(const [k,h] of Object.entries(E.hints))assert.match(h,/^[A-Z ]+ · [A-Z .']+$/,`${k} hint is "NAME · SHORT CLUE"`);
  for(const [k,tip] of Object.entries(E.tips)){assert.ok(tip.text.length>10,k);if(tip.tool)assert.ok(RULES.tools.defs[tip.tool],`${k} tip names a real tool`);}
  // the tip names the tool that solves the problem
  assert.equal(E.tips.turret.tool,'tool_emp');assert.equal(E.tips.swarm.tool,'tool_grenade');assert.equal(E.tips.guard.tool,'tool_decoy');
  assert.match(E.tips.turret.text,/EMP/);assert.match(E.tips.swarm.text,/Grenade/);assert.match(E.tips.guard.text,/Decoy/);
});

test('plan: L1 one problem, L2 one problem + regular enemies, L3 two problems; every planned problem is placed (all areas, 60 seeds)',()=>{
  for(const area of AREAS)for(let n=1;n<=3;n++){
    assert.equal(E.plan[area][n-1].length,n===3?2:1,`${area} L${n} problem count`);
    for(let s=0;s<60;s++){const L=generateLevel(n,`plan-${s}`,area);
      assert.deepEqual(L.encounters.map(e=>e.type).sort(),[...PLAN[area][n-1]].sort(),`${area} L${n} plan-${s}`);}
  }
});

test('enemy count no longer ramps: regular enemies stay at 1 / 2 / 3 in every area, problems come on top',()=>{
  for(const area of AREAS)for(let s=0;s<20;s++)for(const n of [1,2,3]){
    const L=generateLevel(n,`count-${s}`,area),regular=L.enemies.filter(e=>!e.encounter);
    // L1's single enemy IS the problem (guard / patrol); L2 and L3 keep their regular enemies next to it
    if(n===1){assert.equal(L.enemies.length,1);assert.equal(L.enemies[0].encounter,PLAN[area][0][0]);}
    else assert.equal(regular.length,n,`${area} L${n} regular enemies`);
  }
  assert.deepEqual(RULES.levels.map(l=>l.enemies),[1,2,3]);
  assert.deepEqual(RULES.levels.map(l=>l.title),['Control Room','Narrow Passage','Dead End']);
});

test('placement is seeded, deterministic, on free floor, reachable, and never breaks the level',()=>{
  for(const area of AREAS)for(let n=1;n<=3;n++)for(let s=0;s<12;s++){
    const a=generateLevel(n,`place-${s}`,area),b=generateLevel(n,`place-${s}`,area);assert.deepEqual(a,b,'deterministic');
    const solids=[...a.walls,...a.boxes],tag=`${area} L${n} place-${s}`;
    for(const e of a.enemies){assert.ok(!solids.some(o=>Math.abs(e.x-o.x)<o.w/2+.3&&Math.abs(e.z-o.z)<o.d/2+.3),`${tag} ${e.id} inside a wall`);
      assert.ok(a.floors.some(f=>Math.abs(e.x-f.x)<=f.w/2&&Math.abs(e.z-f.z)<=f.d/2),`${tag} ${e.id} off the floor`);}
    assert.ok(reachable(a),`${tag} stays reachable`);
    for(const b2 of a.boxes.filter(b=>b.encounterCover))assert.ok(!a.lootBoxes.some(l=>Math.abs(l.x-b2.x)<b2.w/2+.4&&Math.abs(l.z-b2.z)<b2.d/2+.4),`${tag} cover on a crate`);
  }
});

test('different seeds give different placements (it is not a fixed map)',()=>{
  for(const [area,n,type] of [['bunker',2,'turret'],['archipelago',2,'patrol'],['bunker',3,'swarm'],['bunker',1,'guard']]){
    const spots=new Set(Array.from({length:12},(_,s)=>{const e=generateLevel(n,`var-${s}`,area).encounters.find(x=>x.type===type);return `${e.x},${e.z}`;}));
    assert.ok(spots.size>=4,`${area} L${n} ${type} spots ${spots.size}`);}
});
// ---------- 1 Core guard: front shield ----------
test('guard: the front shield blocks shots from inside its arc, behind and the sides always count, blasts ignore it',()=>{
  const round=createRound('g-shield',0);round.level=generateLevel(1,'g-shield','bunker');
  const g=round.level.enemies[0];assert.equal(g.encounter,'guard');assert.equal(g.frontShield,E.guard.frontHalfAngleDeg);assert.ok(g.speed>0,'can be lured');
  const from=deg=>{const a=g.facing+deg*Math.PI/180;return {x:g.x+Math.sin(a)*3,z:g.z+Math.cos(a)*3};};
  for(const deg of [0,35,-60,69]){const hp=g.health;assert.equal(hitEnemy(round,g.id,10,1,from(deg)),false,`${deg} deg is blocked`);assert.equal(g.health,hp);}
  assert.equal(g.blockedSerial,4);
  for(const deg of [72,-90,135,180]){const hp=g.health;assert.equal(hitEnemy(round,g.id,10,1,from(deg)),true,`${deg} deg lands`);g.health=hp;}
  assert.equal(hitEnemy(round,g.id,10,1,null),true,'no origin (grenade blast) ignores the shield');g.health=2;
  // the real weapon: aim assist locks the guard, the shot resolves at fire time
  const w=createWeapon(Infinity),at=from(0);round.shooter=at;
  fireAimedWeapon(w,round,at,{x:g.x-at.x,z:g.z-at.z},50,[]);round.shooter=null;assert.equal(g.health,2,'frontal weapon shot blocked');
  const back=from(180),w2=createWeapon(Infinity);round.shooter=back;
  fireAimedWeapon(w2,round,back,{x:g.x-back.x,z:g.z-back.z},60,[]);round.shooter=null;assert.equal(g.health,1,'shot from behind lands');
});

test('guard turns slowly towards you and only aims inside its fire arc: behind it is safe, in front it telegraphs 1 s',()=>{
  const S=sim(1,'bunker','g-arc'),g=S.level.enemies[0];
  S.P={x:g.x+Math.sin(g.facing)*4,z:g.z+Math.cos(g.facing)*4};
  // in front: warning first, then a committed salvo no sooner than 1 s later
  let warnAt=null,firstRelease=null;
  for(let t=0;t<4000&&firstRelease===null;t+=DT*1000){tick(S);
    if(g.attackPhase==='warning'&&warnAt===null)warnAt=S.now;
    const p=S.combat.projectiles[0];if(p&&firstRelease===null)firstRelease=p.releaseAt;}
  assert.ok(warnAt!==null,'the guard aimed at the player in its front arc');
  assert.ok(firstRelease-warnAt>=E.telegraphMs-DT*1000,`telegraph ${firstRelease-warnAt} ms`);
  // behind it: no warning while the player stays out of the fire arc (it turns slowly, so we only watch 1.5 s)
  const B=sim(1,'bunker','g-arc'),g2=B.level.enemies[0];
  B.P={x:g2.x-Math.sin(g2.facing)*3.2,z:g2.z-Math.cos(g2.facing)*3.2};
  const f0=g2.facing;let warned=false;
  for(let t=0;t<1500;t+=DT*1000){tick(B);if(g2.attackPhase==='warning')warned=true;}
  assert.equal(warned,false,'no aim while the player is behind');
  assert.ok(angleDiff(g2.facing,f0)>0&&angleDiff(g2.facing,f0)<=E.guard.turnRadPerSec*1.6,'it turns, but slowly');
});

// a throw target 3.2 m from `enemy`, within throw range of the player, as far from `node` as possible
// `avoid` = points the player will walk through: the lure should not park the enemy in the way
function decoySpot(S,enemy,node,{radius=3.2,avoid=[]}={}){
  let best=null,bestScore=-Infinity;
  for(let deg=0;deg<360;deg+=15){const a=deg*Math.PI/180,p={x:enemy.x+Math.sin(a)*radius,z:enemy.z+Math.cos(a)*radius};
    if(dist(S.P,p)>RULES.tools.throwRange-.2||!S.level.floors.some(f=>Math.abs(p.x-f.x)<f.w/2-.5&&Math.abs(p.z-f.z)<f.d/2-.5))continue;
    if(S.solids().some(o=>Math.abs(p.x-o.x)<o.w/2+.6&&Math.abs(p.z-o.z)<o.d/2+.6))continue;
    const score=avoid.length?Math.min(...avoid.map(q=>dist(p,q))):dist(p,node);
    if(score>bestScore){best=p;bestScore=score;}}
  return best;
}
function flankGuard(S,g,side){
  for(let t=0;t<14000&&g.health>0&&!S.round.over;t+=DT*1000){
    const rel=angleDiff(g.facing,angleTo(g,S.P));
    if(rel>85*Math.PI/180&&dist(S.P,g)<6){S.round.shooter=S.P;fireAimedWeapon(S.weapon,S.round,S.P,{x:g.x-S.P.x,z:g.z-S.P.z},S.now,S.playerSolids());S.round.shooter=null;tick(S);continue;}
    const a=g.facing+side*115*Math.PI/180;tick(S,{x:g.x+Math.sin(a)*3-S.P.x,z:g.z+Math.cos(a)*3-S.P.z});
  }
  return g.health<=0;
}
test('guard WITHOUT a tool: flank it (its shield only covers the front), shoot it from the side / behind, hold the node',()=>{
  for(const area of ['bunker','archipelago'])for(const seed of SEEDS){
    const results=[1,-1].map(side=>{const S=sim(1,area,seed),g=S.level.enemies[0],node=S.level.nodes[0];
      const killed=flankGuard(S,g,side);const reached=killed&&walkRoute(S,{x:node.x+1.2,z:node.z});const lit=reached&&holdNode(S,node);
      return {killed,lit,S};});
    const win=results.find(r=>r.lit);
    assert.ok(win,`${area} ${seed}: flanking works on at least one side (${results.map(r=>`${r.killed}/${r.lit}`)})`);
    assert.ok(win.S.round.health>0&&win.S.maxDrop<=hitCap(win.S),`max single hit ${win.S.maxDrop} <= ${hitCap(win.S)}`);
    assert.equal(win.S.round.enemiesDefeated,1);
  }
});

test('guard WITH a Decoy: it walks off the node and holds fire, the node lights without a shot fired',()=>{
  for(const area of ['bunker','archipelago'])for(const seed of SEEDS){
    const S=sim(1,area,seed,{tool:{id:'tool_decoy',n:2}}),g=S.level.enemies[0],node=S.level.nodes[0];
    const d0=dist(g,node);
    // like a player: aim the throw 3.2 m past the guard, as far from the node as the 6 m throw range allows
    const spot=decoySpot(S,g,node);assert.ok(spot,`${area} ${seed}: a decoy spot exists`);
    assert.ok(throwTool(S.round,S.P,spot,S.now,S.playerSolids()),'thrown');
    assert.ok(g.lureTarget,'the guard is lured (it has a walking speed but never chases)');
    assert.ok(walkRoute(S,{x:node.x+1.2,z:node.z}),`${area} ${seed}: route to the node`);
    const t1=S.now-1000;
    assert.ok(holdNode(S,node),`${area} ${seed}: node lit`);
    assert.equal(S.round.health,maxHealth(S),`never shot (${area} ${seed} arrived at ${t1} ms, done at ${S.now-1000})`);assert.ok(g.health>0,'guard still alive');
    assert.ok(dist(g,node)>d0+.5,`the guard left the node (${d0.toFixed(1)} -> ${dist(g,node).toFixed(1)} m)`);
    assert.equal(S.combat.projectiles.length,0);
  }
});
// ---------- 2 Turret behind cover ----------
const turretOf=S=>{const enc=S.level.encounters.find(e=>e.type==='turret');return {enc,t:S.level.enemies.find(e=>e.id===enc.enemyId)};};
test('turret: a sentry with long reach, 1.1 s warning, a committed salvo, then a long recovery window; cover blocks its shots',()=>{
  for(const area of ['bunker','town']){
    const S=sim(2,area,'t-rules'),{enc,t}=turretOf(S);
    assert.equal(t.type,'sentry');assert.equal(t.speed,0);assert.ok(t.rangeMul>1,'longer reach than a grunt');assert.ok(enc.covers.length>=1);
    for(const c of enc.covers)assert.ok(S.level.boxes.some(b=>b.x===c.x&&b.z===c.z&&b.encounterCover),'covers are real colliders');
    // stand still in the open in its lane: warning -> burst -> recovery, and the next warning waits out the recovery
    const out={x:t.x+(S.level.start.x-t.x)*.3,z:t.z+(S.level.start.z-t.z)*.3};
    const R=sim(2,area,'t-rules');R.level.boxes=R.level.boxes.filter(b=>!b.encounterCover);const tt=turretOf(R).t;R.P={x:tt.x+(out.x-t.x)*1,z:tt.z+(out.z-t.z)*1};
    R.P={x:tt.x+Math.sin(tt.facing)*4,z:tt.z+Math.cos(tt.facing)*4};
    const phases=[];let last=null;
    for(let ms=0;ms<9000&&!R.round.over;ms+=DT*1000){tick(R);if(tt.attackPhase!==last){phases.push([tt.attackPhase,R.now]);last=tt.attackPhase;}}
    const at=name=>phases.filter(p=>p[0]===name).map(p=>p[1]);
    const warns=at('warning'),bursts=at('burst'),recs=at('recovery');
    assert.ok(warns.length>=2&&bursts.length>=2,`${area}: repeated salvos ${JSON.stringify(phases)}`);
    assert.ok(bursts[0]-warns[0]>=E.turret.warningMs-DT*1000,'warning lasts >= 1.1 s before the salvo');
    assert.ok(warns[1]-recs[0]>=E.turret.recoveryMs-DT*1000,`recovery window ${warns[1]-recs[0]} ms`);
    assert.ok(R.maxDrop<=hitCap(R),'no single hit above the cap');
  }
});

// the nearest free floor point to `from` (within `reach`) that has a clear line to `target` and is within weapon range of it
function peekSpot(S,from,target,opts){return peekSpots(S,from,target,opts)[0]??null;}
function peekSpots(S,from,target,{reach=2.6,maxRange=5.5}={}){
  const found=[];const solids=S.playerSolids();
  for(let dx=-reach;dx<=reach;dx+=.3)for(let dz=-reach;dz<=reach;dz+=.3){
    const p={x:from.x+dx,z:from.z+dz};if(dist(p,from)>reach||dist(p,target)>maxRange||dist(p,target)<1.4)continue;
    if(!S.level.floors.some(f=>Math.abs(p.x-f.x)<f.w/2-.5&&Math.abs(p.z-f.z)<f.d/2-.5)||solids.some(o=>Math.abs(p.x-o.x)<o.w/2+.55&&Math.abs(p.z-o.z)<o.d/2+.55))continue;
    // a clear line with a 0.3 m margin either side, so a stick that stops a little short still has the shot
    const d=dist(p,target),nx=-(target.z-p.z)/d*.3,nz=(target.x-p.x)/d*.3;
    if([[0,0],[nx,nz],[-nx,-nz]].some(([ox,oz])=>traceTargets({x:p.x+ox,z:p.z+oz},target,solids,[])?.kind==='wall'))continue;
    found.push(p);}
  return found.sort((a,b)=>dist(a,from)-dist(b,from));
}
function hideSpot(cover,t,gap=.95){const d=dist(cover,t)||1;return {x:cover.x+(cover.x-t.x)/d*gap,z:cover.z+(cover.z-t.z)/d*gap};}
test('turret WITHOUT a tool: hop from cover to cover (it needs 1.1 s to aim), step out and shoot it',()=>{
  for(const area of ['bunker','town'])for(const seed of SEEDS){
    const S=sim(2,area,seed),{enc,t}=turretOf(S);
    const covers=[...enc.covers].sort((a,b)=>dist(a,S.P)-dist(b,S.P));
    for(const c of covers){assert.ok(walk(S,hideSpot(c,t),{tol:.25,maxMs:6000}),`${area} ${seed}: reached cover at ${c.x},${c.z}`);}
    // step out of cover to the nearest spot with a clear line to the turret and shoot
    const out=peekSpot(S,S.P,t);assert.ok(out,`${area} ${seed}: a firing spot exists`);
    assert.ok(walk(S,out,{tol:.25,maxMs:3000}),`${area} ${seed}: stepped out`);
    if(DEBUG)console.error('DBG peek',JSON.stringify({out,P:S.P,covers:enc.covers,T:{x:t.x,z:t.z},los:traceTargets(S.P,t,S.playerSolids(),[])?.kind,losOut:traceTargets(out,t,S.playerSolids(),[])?.kind}));
    assert.ok(shootUntilDead(S,t,{maxMs:4000}),`${area} ${seed}: turret down (hp ${t.health})`);
    assert.ok(S.round.health>=maxHealth(S)-hitCap(S),`${area} ${seed}: at most one hit taken (${S.round.health})`);
    assert.ok(S.maxDrop<=hitCap(S));
  }
});

test('turret WITH an EMP: it shuts down for 4 s, walk up and shoot it without being hit',()=>{
  for(const area of ['bunker','town'])for(const seed of SEEDS){
    const S=sim(2,area,seed,{tool:{id:'tool_emp',n:1}}),{t}=turretOf(S);
    // close to within throw range (a tap auto-aims at the nearest enemy inside 6 m), then tap
    while(dist(S.P,t)>RULES.tools.throwRange-.3)tick(S,{x:t.x-S.P.x,z:t.z-S.P.z});
    const throwAt=autoThrowPoint(S.round,S.P,{x:t.x-S.P.x,z:t.z-S.P.z},S.playerSolids());assert.equal(throwAt.target?.id,t.id,'auto-aim picks the turret');
    const fx=throwTool(S.round,S.P,throwAt,S.now,S.playerSolids());assert.equal(fx.stunned,1);
    const stunStart=S.now;
    // walk to the nearest spot (to us) from which the turret is in the open and in weapon range
    const spot=peekSpots(S,S.P,t,{reach:8,maxRange:4.5}).find(p=>route(S,p,{enemies:false}));assert.ok(spot,`${area} ${seed}: a reachable firing spot exists`);
    assert.ok(walkRoute(S,spot,{tol:.12,enemies:false}),`${area} ${seed}: walked up`);
    assert.ok(shootUntilDead(S,t,{maxMs:3000}),`${area} ${seed}: turret down`);
    assert.ok(S.now-stunStart<RULES.tools.defs.tool_emp.stunMs,`done inside the 4 s stun (${S.now-stunStart} ms)`);
    assert.equal(S.round.health,maxHealth(S),'never hit');
  }
});
// ---------- 3 Locked door + keycard (town L2-3 -> L3) ----------
const doorOf=S=>({enc:S.level.encounters.find(e=>e.type==='door'),door:S.level.doors?.[0]});
test('door: a locked door shuts the corridor into the last room, the keycard lies in a crate in the middle room, a side passage is cut round it',()=>{
  for(let s=0;s<20;s++){
    const L=generateLevel(3,`door-${s}`,'town'),door=L.doors[0],enc=L.encounters.find(e=>e.type==='door'),c=L.corridors[1];
    assert.equal(L.doors.length,1);assert.equal(door.locked,true);assert.equal(doorSolids(L).length,1,'a locked door is a solid');
    assert.ok(Math.abs(door.x-c.x)<1e-9&&Math.abs(door.z-c.z)<1e-9,'in the middle of the corridor');
    assert.ok(door.w>=1.8||door.d>=1.8,'seals the whole corridor width');
    const box=L.lootBoxes.find(b=>b.id===enc.keyBoxId);assert.equal(box.item,'keycard');assert.equal(box.revealed,true);
    const r1=L.rooms[1];assert.ok(Math.abs(box.x-r1.x)<r1.w/2&&Math.abs(box.z-r1.z)<r1.d/2,'keycard crate is in the middle room');
    assert.ok(L.floors.some(f=>f.width===E.door.passageWidth&&Math.abs(f.x-enc.passage.x)<.01&&Math.abs(f.z-enc.passage.z)<.01),'side passage floor');
    assert.ok(reachable(L),'town stays reachable');
  }
  for(const area of ['bunker','archipelago'])assert.equal(generateLevel(3,'door-x',area).doors,undefined,'doors are a town problem');
});

test('door: the keycard goes to the raid (never the bag), opens the door on contact and is spent',()=>{
  const S=sim(3,'town','door-key',{only:()=>false}),{enc,door}=doorOf(S),box=S.level.lootBoxes.find(b=>b.id===enc.keyBoxId);
  S.P={x:box.x,z:box.z};tick(S);
  assert.equal(box.collected,true);assert.deepEqual(S.round.keys,[door.key]);assert.equal(bagItems(S.round.bag).length,0,'not a bag item');
  assert.equal(door.locked,true,'still locked away from the door');
  // stand at the door: it unlocks and stops being a solid
  S.P={x:door.x+(door.w>door.d?0:-1.4),z:door.z+(door.w>door.d?-1.4:0)};tick(S);
  assert.equal(door.locked,false);assert.deepEqual(S.round.keys,[]);assert.equal(doorSolids(S.level).length,0);
  // a card never opens a door without being carried: a fresh level has none
  const T=sim(3,'town','door-key',{only:()=>false});T.P={x:door.x,z:door.z-1.2};tick(T);assert.equal(T.level.doors[0].locked,true,'no card, no unlock');
  T.round.keys=['key-1'];T.round.level.nodes.forEach(n=>{n.active=true;});T.round.levelsCleared=2;
  assert.equal(enterExit(T.round,{x:T.level.exit.x+9,z:T.level.exit.z},T.now),null);// walking in from outside arms the final exit
  assert.equal(enterExit(T.round,T.level.exit,T.now),'complete');
});
test('keycards do not carry over to the next level',()=>{
  const r=createRound('keys',0);r.level=generateLevel(1,'keys');r.keys=['key-1'];r.level.nodes.forEach(n=>{n.active=true;});
  assert.equal(enterExit(r,r.level.exit,0),'next');assert.deepEqual(r.keys,[]);
});

test('door WITH the keycard: fetch it from its crate, walk up to the door, it opens, walk through to the last room',()=>{
  for(const seed of SEEDS){
    const S=sim(3,'town',seed,{only:()=>false}),{enc,door}=doorOf(S),box=S.level.lootBoxes.find(b=>b.id===enc.keyBoxId),c=S.level.corridors[1],r2=S.level.rooms[2];
    assert.ok(walkRoute(S,{x:box.x,z:box.z},{tol:.9}),`${seed}: walked to the crate`);tick(S);
    assert.equal(box.collected,true,`${seed}: card collected`);
    const before={x:door.x-c.dir.x*1.3,z:door.z-c.dir.z*1.3};
    assert.ok(walkRoute(S,before,{tol:.4}),`${seed}: walked up to the door`);
    tick(S);
    assert.equal(door.locked,false,`${seed}: door opened on contact`);
    assert.deepEqual(S.round.keys,[],'the card is spent');
    assert.ok(walkRoute(S,{x:r2.x,z:r2.z},{tol:.8}),`${seed}: through the corridor into the last room`);
    assert.ok(Math.abs(S.P.x-r2.x)<r2.w/2&&Math.abs(S.P.z-r2.z)<r2.d/2,'inside the last room');
  }
});

test('door WITHOUT the keycard: the longer side passage is open, the door stays locked',()=>{
  for(const seed of SEEDS){
    const S=sim(3,'town',seed,{only:()=>false}),{door}=doorOf(S),r2=S.level.rooms[2],goal={x:r2.x,z:r2.z};
    S.level.lootBoxes=S.level.lootBoxes.filter(b=>b.item!=='keycard'); // this run never finds (or walks past) the card
    const locked=route(S,goal,{enemies:false,tol:.8});assert.ok(locked,`${seed}: a route exists with the door locked`);
    door.locked=false;const open=route(S,goal,{enemies:false,tol:.8});door.locked=true;
    // the passage runs 3 m beside the main corridor, so it is never the shorter way
    assert.ok(pathLength(locked)>=pathLength(open)-.01,`${seed}: side passage (${pathLength(locked).toFixed(1)} m) is not shorter than the door (${pathLength(open).toFixed(1)} m)`);
    const walked=walkRoute(S,goal,{tol:.8,enemies:false});
    assert.ok(walked,`${seed}: walked the side passage (stopped at ${S.P.x.toFixed(2)},${S.P.z.toFixed(2)}, passage ${JSON.stringify(doorOf(S).enc.passage)}, door ${door.x.toFixed(2)},${door.z.toFixed(2)})`);
    assert.equal(door.locked,true,'door still locked');assert.deepEqual(S.round.keys??[],[]);
    assert.ok(Math.abs(S.P.x-r2.x)<r2.w/2&&Math.abs(S.P.z-r2.z)<r2.d/2,'inside the last room');
  }
});
// ---------- 4 Patrol with a sight cone (town L1, archipelago L2) ----------
// The patrol level is isolated for these runs: L2's regular enemies are removed so the cone is the only problem in play.
const PATROL_SCENARIOS=[['town',1],['archipelago',2]];
function patrolSim(area,number,seed,opts={}){
  const S=sim(number,area,seed,{...opts,only:e=>e.encounter==='patrol'});
  if(number===2){const room=S.level.rooms.at(-1),inc=room.incoming;S.P={x:room.x+inc.x*(room.w/2-1.5),z:room.z+inc.z*(room.d/2-1.5)};}
  const e=S.level.enemies[0];return {S,e,enc:S.level.encounters.find(x=>x.type==='patrol'),node:S.level.nodes[0]};
}
test('patrol: a grunt walks a fixed back-and-forth loop between two points, with a sight cone sized by the rules',()=>{
  for(const [area,n] of PATROL_SCENARIOS){
    const {S,e,enc}=patrolSim(area,n,'p-loop');S.P={x:-500,z:-500};S.round.shooter=null;
    const [a,b]=enc.points;assert.ok(dist(a,b)>=3.5,'a real loop');assert.equal(e.type,'grunt');assert.ok(e.patrol&&e.speed>0);
    let seenA=false,seenB=false,maxOff=0;
    const line=p=>Math.abs((b.x-a.x)*(a.z-p.z)-(a.x-p.x)*(b.z-a.z))/dist(a,b);
    for(let ms=0;ms<16000;ms+=DT*1000){S.now+=DT*1000;stepCombat(S.round,S.combat,{x:-500,z:-500},S.now,DT,S.playerSolids());
      if(dist(e,a)<.25)seenA=true;if(dist(e,b)<.25)seenB=true;maxOff=Math.max(maxOff,line(e));}
    assert.ok(seenA&&seenB,`${area}: visits both ends`);assert.ok(maxOff<.3,`${area}: stays on its loop (off by ${maxOff.toFixed(2)})`);
    assert.equal(e.aggro,false);assert.equal(e.sight,E.patrol.coneRange);assert.equal(RULES.encounters.patrol.coneHalfAngleDeg,35);
  }
});

test('patrol: it sees you only inside the cone (range shrinks with stealth), gives a 1 s "!" before it reacts, never shoots first',()=>{
  const at=(deg,d)=>({x:Math.sin(deg*Math.PI/180)*d,z:Math.cos(deg*Math.PI/180)*d});
  // a frozen patrol facing +z at the origin (both loop points straight ahead, speed 0), the player placed on a polar offset
  const test1=(p,stealth=0)=>{const T=patrolSim('town',1,'p-cone',{stats:{stealth}}),en=T.e;
    en.patrol.speed=0;en.patrol.points=[{x:0,z:3},{x:0,z:3}];en.patrol.i=0;en.facing=0;en.x=0;en.z=0;en.pauseUntil=0;T.S.level.walls=[];T.S.level.boxes=[];T.S.P=p;
    for(let ms=0;ms<400;ms+=DT*1000)tick(T.S);return {T,en};};
  const noticed=(p,stealth)=>test1(p,stealth).en.alertAt!=null;
  assert.ok(noticed(at(0,3.5)),'in front inside the cone range');
  assert.ok(!noticed(at(0,6.2)),'beyond the cone range');
  assert.ok(!noticed(at(50,3)),'outside the 35 degree half angle');
  assert.ok(!noticed(at(90,3)),'beside it');
  assert.ok(!noticed(at(180,3)),'behind it');
  assert.ok(noticed(at(180,.6)),'but right on its heels (bump radius) it notices');
  // stealth shrinks the cone: 3.5 m is inside at stealth 0, outside at stealth 0.5 (range 2.6 m)
  assert.ok(noticed(at(0,3.5),0));assert.ok(!noticed(at(0,3.5),.5));assert.ok(noticed(at(0,2.2),.5));
  assert.equal(sightRange({stats:{stealth:.5}}),E.patrol.coneRange*.5);
  assert.equal(inSightCone({x:0,z:0,facing:0},at(20,4),5.2,35),true);assert.equal(inSightCone({x:0,z:0,facing:0},at(40,4),5.2,35),false);
  // "!" first: aggro and the first shot come >= 1 s after it noticed you
  const {T,en}=test1(at(0,3.5));const t0=en.alertAt-E.patrol.alertMs;
  let aggroAt=null,shotAt=null;
  for(let ms=0;ms<4000&&shotAt===null;ms+=DT*1000){tick(T.S);if(en.aggro&&aggroAt===null)aggroAt=T.S.now;if(T.S.combat.projectiles.length&&shotAt===null)shotAt=T.S.now;}
  assert.ok(aggroAt-t0>=E.telegraphMs-DT*1000*2,`aggro ${aggroAt-t0} ms after the first sighting`);
  assert.ok(shotAt-t0>=E.telegraphMs+E.patrol.windupMs-DT*1000*3,`first shot ${shotAt-t0} ms after the first sighting`);
  assert.ok(T.S.maxDrop<=hitCap(T.S));
});

test('patrol: a shot patrol reacts at once but still winds up >= 1 s before its first shot',()=>{
  const {S,e}=patrolSim('town',1,'p-shot');e.patrol.speed=0;e.patrol.points=[{x:0,z:3},{x:0,z:3}];e.patrol.i=0;e.facing=0;e.x=0;e.z=0;S.level.walls=[];S.level.boxes=[];S.P={x:0,z:-3};
  S.round.shooter=S.P;fireAimedWeapon(S.weapon,S.round,S.P,{x:0,z:1},S.now,[]);S.round.shooter=null;
  const hitAt=S.now;assert.equal(e.health,e.health);assert.ok(e.lastHitAt!=null,'hit from behind');
  let shotAt=null;for(let ms=0;ms<3000&&shotAt===null;ms+=DT*1000){tick(S);if(S.combat.projectiles.length)shotAt=S.now;}
  assert.equal(e.aggro,true);assert.ok(shotAt-hitAt>=E.patrol.windupMs-DT*1000,`first shot ${shotAt-hitAt} ms after being shot`);
});

// the direction (of 16) that leaves the most distance to `from` after a short real-physics lookahead - slides along walls instead of grinding into them
function fleeDir(S,from){
  let best={x:S.P.x-from.x,z:S.P.z-from.z},bestScore=-Infinity;
  for(let k=0;k<16;k++){const a=k/16*2*Math.PI,v={x:Math.sin(a),z:Math.cos(a)};let q={...S.P};
    for(let i=0;i<4;i++)q=movePlayer(q,{x:v.x*.14,z:v.z*.14},S.playerSolids(),S.level.floors,RULES.playerRadius);
    const score=dist(q,from)+.3*dist(q,S.P);if(score>bestScore){bestScore=score;best=v;}}
  return best;
}
function sneakKill(S,e){
  const R=E.patrol;let seen=false;
  for(let ms=0;ms<45000&&e.health>0&&!S.round.over;ms+=DT*1000){
    if((e.alertAt!=null||e.aggro)&&e.lastHitAt==null)seen=true; // being shot is not being noticed
    const f=e.facing,range=sightRange(S.round)+.8,P=S.P,rel=angleDiff(f,angleTo(e,P)),d=dist(P,e);
    if(d<=3.8&&(rel>100*Math.PI/180||e.lastHitAt!=null)){S.round.shooter=P;fireAimedWeapon(S.weapon,S.round,P,{x:e.x-P.x,z:e.z-P.z},S.now,S.playerSolids());S.round.shooter=null;tick(S);continue;}
    const goal={x:e.x-Math.sin(f)*2.6,z:e.z-Math.cos(f)*2.6},L=dist(P,goal)||1,dir={x:goal.x-P.x,z:goal.z-P.z},ahead={x:P.x+dir.x/L*.6,z:P.z+dir.z/L*.6};
    // while it pauses or swings round to its next leg, its cone sweeps everywhere: keep the whole circle out of reach
    const goalPt=e.patrol.points[e.patrol.i%e.patrol.points.length],swinging=S.now<(e.pauseUntil??0)||angleDiff(f,angleTo(e,goalPt))>.25;
    const danger=p=>inSightCone(e,p,range,R.coneHalfAngleDeg+12)||dist(p,e)<R.bumpRadius+.7||(swinging&&dist(p,e)<range+.4);
    if(danger(P))tick(S,fleeDir(S,e));else if(danger(ahead))tick(S);else tick(S,dir);
  }
  return {killed:e.health<=0,seen};
}
test('patrol WITHOUT a tool: stay out of the cone, come up behind it and shoot it before it ever notices you',()=>{
  for(const [area,n] of PATROL_SCENARIOS)for(const seed of SEEDS){
    const {S,e}=patrolSim(area,n,seed),r=sneakKill(S,e);
    assert.ok(r.killed,`${area} ${seed}: patrol down (hp ${e.health}, at ${e.x.toFixed(1)},${e.z.toFixed(1)}, me ${S.P.x.toFixed(1)},${S.P.z.toFixed(1)})`);
    assert.equal(r.seen,false,`${area} ${seed}: never noticed`);assert.equal(S.round.health,maxHealth(S),'never hit');
  }
});

test('patrol WITH a Decoy: it walks off to the lure and ignores you while you light the node',()=>{
  for(const [area,n] of PATROL_SCENARIOS)for(const seed of SEEDS){
    const {S,e,node}=patrolSim(area,n,seed,{tool:{id:'tool_decoy',n:2}});let seen=false;
    const goal={x:node.x+1.2,z:node.z},way=route(S,goal)??[];
    const rethrow=()=>{if(e.alertAt!=null||e.aggro)seen=true;
      if(S.round.tool.charges>0&&!e.aggro&&!node.active&&(!e.lureTarget||S.now>(e.lureUntil??0)-1500)){const spot=decoySpot(S,e,node,{avoid:way});if(spot)throwTool(S.round,S.P,spot,S.now,S.playerSolids());}};
    // walk up until a spot 3.2 m beside the patrol is in throw range (stay clear of its cone), then throw
    for(let ms=0;ms<12000&&!decoySpot(S,e,node,{avoid:way});ms+=DT*1000)if(dist(S.P,e)>E.patrol.coneRange+1.5)tick(S,{x:e.x-S.P.x,z:e.z-S.P.z});else tick(S);
    rethrow();assert.ok(e.lureTarget,`${area} ${seed}: lured`);
    const walked=walkRoute(S,goal,{onTick:rethrow});
    assert.ok(walked,`${area} ${seed}: walked to the node`);
    for(let ms=0;ms<5000&&!node.active;ms+=DT*1000){rethrow();tick(S);}
    assert.ok(node.active,`${area} ${seed}: node lit`);assert.equal(seen,false,'the patrol never noticed');
    assert.equal(S.round.health,maxHealth(S));assert.ok(e.health>0);
  }
});
// ---------- 5 Swarm (bunker L3, archipelago L3) ----------
const SWARM_AREAS=['bunker','archipelago'];
function swarmSim(area,seed,opts={}){
  const S=sim(3,area,seed,{...opts,only:e=>e.swarm}),enc=S.level.encounters.find(e=>e.type==='swarm'),room=S.level.rooms[enc.room],inc=room.incoming;
  const corridor=S.level.corridors[0],len=Math.max(corridor.w,corridor.d);
  const into=d=>({x:enc.entry.x+inc.x*d,z:enc.entry.z+inc.z*d});   // d metres from the doorway back into the corridor
  S.P=into(1.2);return {S,enc,sp:S.level.spawners[0],room,swarm:S.level.enemies,into,depth:Math.min(2.8,len-.7)};
}
function triggerSwarm(S,sp,room){ // walk in until the spawn point arms its warning
  for(let ms=0;ms<8000&&sp.state==='armed';ms+=DT*1000)tick(S,{x:sp.x-S.P.x,z:sp.z-S.P.z});
  return sp.state==='warning';
}
function fightFrom(S,swarm,{maxMs=25000}={}){
  for(let ms=0;ms<maxMs&&swarm.some(e=>e.health>0)&&!S.round.over;ms+=DT*1000){
    const live=swarm.filter(e=>e.health>0&&e.active!==false).sort((a,b)=>dist(a,S.P)-dist(b,S.P)),t=live[0];
    if(t&&dist(t,S.P)<=6.5&&traceTargets(S.P,t,S.playerSolids(),[])?.kind!=='wall'){S.round.shooter=S.P;fireAimedWeapon(S.weapon,S.round,S.P,{x:t.x-S.P.x,z:t.z-S.P.z},S.now,S.playerSolids());S.round.shooter=null;}
    tick(S);
  }
  return swarm.every(e=>e.health<=0);
}
test('swarm: 4-5 rushers wait inactive around a spawn point; the player getting close arms a 1 s warning, then they burst out together',()=>{
  for(const area of SWARM_AREAS)for(const seed of SEEDS){
    const {S,sp,swarm,room}=swarmSim(area,seed);
    assert.ok(swarm.length>=4&&swarm.length<=5,`${area} ${seed}: ${swarm.length} rushers`);assert.ok(swarm.every(e=>e.type==='rusher'&&e.active===false&&e.swarm===sp.id));
    assert.ok(swarm.every(e=>dist(e,sp)<=E.swarm.ring+.01),'clustered round the spawn point');
    assert.equal(sp.state,'armed');for(let ms=0;ms<2000;ms+=DT*1000)tick(S);assert.equal(sp.state,'armed','nothing happens while the player is away');
    assert.ok(triggerSwarm(S,sp,room),'armed by proximity');const t0=S.now;
    let spawnedAt=null,firstShot=null;
    for(let ms=0;ms<6000&&firstShot===null;ms+=DT*1000){tick(S,{x:0,z:0});if(sp.state==='spawned'&&spawnedAt===null)spawnedAt=S.now;if(S.combat.projectiles.length&&firstShot===null)firstShot=S.now;}
    assert.ok(spawnedAt-t0>=E.telegraphMs-DT*1000,`warning ${spawnedAt-t0} ms before the burst`);
    assert.ok(swarm.every(e=>e.active===true&&e.spawnedAt===spawnedAt),'all at once, at the same moment');
    assert.ok(firstShot===null||firstShot-spawnedAt>=E.swarm.emergeMs-DT*1000,`first rusher shot ${firstShot===null?'(none yet)':firstShot-spawnedAt} ms after emerging`);
    assert.ok(S.maxDrop<=hitCap(S));
  }
});

test('swarm WITHOUT a tool: fall back into the corridor so they queue up, and shoot them one by one',()=>{
  for(const area of SWARM_AREAS)for(const seed of SEEDS){
    const {S,sp,swarm,room,into,depth}=swarmSim(area,seed);
    assert.ok(triggerSwarm(S,sp,room));
    assert.ok(walk(S,into(depth),{tol:.25,maxMs:4000}),`${area} ${seed}: back in the corridor before they move`);
    assert.ok(S.now<sp.spawnAt+E.swarm.emergeMs,'in position before the rushers start moving');
    const okFight=fightFrom(S,swarm);
    assert.ok(okFight,`${area} ${seed}: all ${swarm.length} down (health ${S.round.health}) ${JSON.stringify({P:S.P,t:S.now,r:swarm.map(e=>[+e.x.toFixed(1),+e.z.toFixed(1),e.health,e.aggro])})}`);
    assert.ok(S.round.health>=maxHealth(S)*.5,`${area} ${seed}: survived comfortably (${S.round.health})`);assert.ok(S.maxDrop<=hitCap(S));
    assert.equal(S.round.enemiesDefeated,swarm.length);
  }
});

test('swarm: the corridor really helps - standing your ground in the room costs more health',()=>{
  let corridor=0,open=0;
  for(const area of SWARM_AREAS)for(const seed of SEEDS){
    const A=swarmSim(area,seed);triggerSwarm(A.S,A.sp,A.room);walk(A.S,A.into(A.depth),{tol:.25,maxMs:4000});fightFrom(A.S,A.swarm);corridor+=maxHealth(A.S)-A.S.round.health;
    const B=swarmSim(area,seed);triggerSwarm(B.S,B.sp,B.room);fightFrom(B.S,B.swarm);open+=maxHealth(B.S)-B.S.round.health;
  }
  assert.ok(open>corridor,`damage taken in the open ${open} > in the corridor ${corridor}`);
});

test('swarm WITH a Grenade: one throw at the burst clears the whole cluster before it moves',()=>{
  for(const area of SWARM_AREAS)for(const seed of SEEDS){
    const {S,sp,swarm,room}=swarmSim(area,seed,{tool:{id:'tool_grenade',n:2}});
    assert.ok(triggerSwarm(S,sp,room));
    for(let ms=0;ms<3000&&sp.state!=='spawned';ms+=DT*1000)tick(S);
    const spawnedAt=sp.spawnAt;assert.equal(sp.state,'spawned');
    // within reach: a tap needs the nearest rusher inside 6 m
    // a pedestal may hide the cluster: step to the nearest spot with a clear throw line inside 5.5 m (the burst leaves ~1 s)
    const spot=peekSpots(S,S.P,swarm[0],{reach:4,maxRange:RULES.tools.throwRange-.5})[0];assert.ok(spot,`${area} ${seed}: a throwing spot exists`);
    assert.ok(walk(S,spot,{tol:.12,maxMs:1500}),`${area} ${seed}: reached it`);
    const aim=autoThrowPoint(S.round,S.P,{x:sp.x-S.P.x,z:sp.z-S.P.z},S.playerSolids());assert.ok(aim.target,'auto-aim finds a rusher');
    const thrownAt=S.now;throwTool(S.round,S.P,aim,thrownAt,S.playerSolids());
    assert.ok(thrownAt+RULES.tools.defs.tool_grenade.fuseMs<spawnedAt+E.swarm.emergeMs,'the blast lands before they start to move');
    for(let ms=0;ms<1400;ms+=DT*1000)tick(S);
    assert.ok(swarm.every(e=>e.health<=0),`${area} ${seed}: cluster cleared (${swarm.map(e=>e.health)})`);
    assert.equal(S.round.health,maxHealth(S),'untouched');assert.equal(S.round.tool.charges,1);
  }
});

// ---------- 6 Shielded node with a generator (L3, all areas) ----------
function shieldSim(area,seed,opts={}){
  const S=sim(3,area,seed,{...opts,only:e=>e.encounter==='shield'}),enc=S.level.encounters.find(e=>e.type==='shield'),gen=S.level.enemies[0],node=S.level.nodes.find(n=>n.id===enc.nodeId);
  const d=dist(node,gen),side=1.55; // stand between node and generator, inside the node's 1.8 m hold reach
  S.P={x:node.x+(gen.x-node.x)/d*side,z:node.z+(gen.z-node.z)/d*side};return {S,gen,node,enc};
}
test('shield: the shielded node has a generator within EMP range; the node cannot be charged while it stands',()=>{
  for(const area of AREAS)for(const seed of SEEDS){
    const {S,gen,node}=shieldSim(area,seed);
    assert.equal(node.shielded,true);assert.equal(node.generatorId,gen.id);assert.equal(gen.type,'generator');
    assert.ok(dist(node,gen)<=RULES.tools.defs.tool_emp.radius,'one EMP covers both');assert.ok(gen.health<=RULES.tools.defs.tool_grenade.damage,'a grenade kills it');
    assert.equal(nodeShielded(S.round,node,S.now),true);
    assert.equal(holdNode(S,node,3500),false,`${area} ${seed}: hold does not charge a shielded node`);assert.equal(S.round.nodeInteraction,null);
    assert.equal(S.combat.projectiles.length,0,'a generator never shoots');
  }
});
test('shield WITHOUT a tool: shoot the generator, the shield drops for good, then charge the node',()=>{
  for(const area of AREAS)for(const seed of SEEDS){
    const {S,gen,node}=shieldSim(area,seed);
    assert.ok(shootUntilDead(S,gen,{maxMs:4000}),`${area} ${seed}: generator destroyed`);
    assert.equal(node.shielded,false);assert.equal(node.shieldBroken,true);assert.equal(S.round.enemiesDefeated,0,'a generator is not a kill');
    assert.ok(holdNode(S,node),`${area} ${seed}: node lit after the shield is gone`);assert.equal(S.round.health,maxHealth(S));
  }
});
test('shield WITH an EMP: the shield is down for 4 s, charge the node inside the window, the generator survives',()=>{
  for(const area of AREAS)for(const seed of SEEDS){
    const {S,gen,node}=shieldSim(area,seed,{tool:{id:'tool_emp',n:1}});
    const aim=autoThrowPoint(S.round,S.P,{x:gen.x-S.P.x,z:gen.z-S.P.z},S.playerSolids());assert.equal(aim.target.id,gen.id);
    const fx=throwTool(S.round,S.P,aim,S.now,S.playerSolids());assert.equal(fx.shields,1);const t0=S.now;
    assert.ok(shieldIsDown(node,S.now+3900)&&!shieldIsDown(node,S.now+4001));
    assert.ok(holdNode(S,node,3500),`${area} ${seed}: node lit during the window`);assert.ok(S.now-t0<RULES.tools.defs.tool_emp.stunMs);
    assert.ok(gen.health>0,'generator still stands');
  }
  // and the shield comes back when the 4 s are over
  const {S,node}=shieldSim('bunker','enc-a',{tool:{id:'tool_emp',n:1}});throwTool(S.round,S.P,{x:node.x,z:node.z},S.now,S.playerSolids());
  assert.equal(nodeShielded(S.round,node,S.now+1000),false);assert.equal(nodeShielded(S.round,node,S.now+4200),true,'shield back up');
});
// ---- END ----
