// Headless difficulty-bot raid simulator (docs/difficulty-bots.md §4).
//
// Drives the REAL game modules (round.js, combat.js, weapon.js, physics.mjs, ftue.js, stakes.js,
// dash.js) directly, at a fixed dt, with a fake clock. No browser, no DOM, no three.js: this mirrors
// nodspel/game.mjs's frame loop (see game.mjs ~L1430-1505 for the order replicated in runTick below)
// closely enough to reuse the same RULES and the same damage path as the real game, the same way
// nodspel/tests/playthrough.test.mjs drives round.js/physics.mjs directly for its BFS-routed test.
//
// What is NOT reproduced here (see docs/difficulty-bots.md "Known sim gaps" for the full list and
// why each is safe to skip for a bunker-area, no-tool, no-gear-swap bot): BIT passive healing,
// hitstop time-freezes, mid-raid perk offers (gated behind a debug flag in the shipped game, see
// game.mjs's lone updateClears() call), tools (grenade/EMP/decoy), weapon/armor pickups, the
// enterable house (town-only), and archipelago/town area variants.
import {
  createRound,tickRound,enterExit,exitIsOpen,collectLoot,stepDoors,stepNodeInteraction,
  useHealthKit,healthKitBlock,doorSolids,initEquip,extractRound,
} from '../../nodspel/round.js';
import {createCombat,stepCombat,stepHazards} from '../../nodspel/combat.js';
import {createWeapon,fireAimedWeapon,stepWeapon,playerDisplaced} from '../../nodspel/weapon.js';
import {movePlayer,moveWithActors,traceTargets} from '../../nodspel/physics.mjs';
import {RULES,setArea,setHard,randomFromSeed} from '../../nodspel/levels.js';
import {initFtueRound} from '../../nodspel/ftue.js';
import {stepStakes} from '../../nodspel/stakes.js';
import {createDash,startDash,stepDash,dashCharge} from '../../nodspel/dash.js';
import {roomAt} from '../../nodspel/perks.js';
import {applyDifficulty} from '../../nodspel/difficulty.js';

// The sim only plays the bunker area (what FTUE and new-player raids use) at normal (non-Hard)
// difficulty; see the "Known sim gaps" note in docs/difficulty-bots.md.
setArea('bunker');setHard(false);

export const DT=1/30;
// Generous safety margin above the longest real round timer (8 min, or 6.4 min on Hard): a raid
// that is still running this long has to be a sim bug, not a real outcome, so we stop and flag it.
const MAX_RAID_MS=11*60*1000;

// Skill tiers (docs/difficulty-bots.md §4.2): aim error, reaction delay, whether the bot kites
// (backs off to hold range) or uses the Dash ability to escape when low on health, whether it
// sidesteps a telegraphed shot (§6 "Known sim gaps" -- a simple mitigation, not real cover-seeking:
// strong/avg dodge perpendicular to the enemy's locked aim line while it is winding up; weak does
// not), and extractHpThreshold -- the HP ratio at a level exit below which the bot bails (voluntary
// extract) instead of pushing deeper, same signal a cautious real player reads off their own health bar.
export const TIERS=Object.freeze({
  strong:{aimErrDeg:0,reactMs:100,kite:true,dash:true,medkitThreshold:.40,telegraphSidestep:true,extractHpThreshold:.15},
  avg:{aimErrDeg:8,reactMs:300,kite:true,dash:false,medkitThreshold:.30,telegraphSidestep:true,extractHpThreshold:.25},
  weak:{aimErrDeg:18,reactMs:600,kite:false,dash:false,medkitThreshold:.20,telegraphSidestep:false,extractHpThreshold:.35},
});

const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const norm=(x,z)=>{const l=Math.hypot(x,z)||1e-9;return {x:x/l,z:z/l};};
const alive=e=>e.health>0&&e.active!==false;

// Same collision split the real frame loop keeps (game.mjs setCollisions()): `solids` is the world
// geometry (walls/boxes/doors, plus a blocking slab over the exit while it is closed); `playerSolids`
// adds the node pedestals, which block player movement AND are shared cover for both the player's and
// enemies' shots (game.mjs passes playerSolids, not solids, into stepWeapon/stepCombat) -- so the bot's
// own visibility/engagement checks use playerSolids too, or it can stand forever shooting at a target
// hidden behind a node pedestal it doesn't know is in the way.
function solidsFor(round){
  const level=round.level;
  const solids=[...level.walls,...level.boxes,...doorSolids(level)];
  if(!exitIsOpen(round))solids.push({x:level.exit.x,z:level.exit.z,w:2,d:.22});
  const playerSolids=[...solids,...level.nodes.map(n=>({x:n.x,z:n.z,w:1.4,d:1.4}))];
  return {solids,playerSolids};
}
const wallBlocked=(a,b,solids)=>traceTargets(a,b,solids,[])?.kind==='wall';

function makeBot(tier,seedKey){
  return {
    cfg:TIERS[tier],rng:randomFromSeed(`${seedKey}:bot`),
    firstSeen:new Map(),kills:[],
    sideSign:1,sideUntil:-Infinity,stuckTicks:0,
    route:null,
  };
}
// Walk straight at (or, repel=true, away from) a goal point, for short local moves that don't need
// a planned route (kiting back from a target already in the same room). movePlayer's own per-axis
// sliding handles grazing a wall; a short perpendicular side-step (the same trick the browser
// tools/difficulty-bots/ftue-bot.mjs uses against the real renderer) breaks a stall on a corner.
function steerDirection(bot,position,goal,repel,now){
  let dx=goal.x-position.x,dz=goal.z-position.z;
  if(repel){dx=-dx;dz=-dz;}
  const len=Math.hypot(dx,dz);
  if(len<1e-6)return {x:0,z:0,len:0};
  const want=norm(dx,dz);
  if(now<bot.sideUntil){const s=bot.sideSign;return {...norm(want.x*.3-want.z*s,want.z*.3+want.x*s),len};}
  return {...want,len};
}
// Grid BFS over real movePlayer steps -- the same technique nodspel/tests/playthrough.test.mjs uses
// to prove a walking route exists, reused here so the bot can cross a partition gap, a corridor or a
// locked-door bypass instead of just walking straight at a point and stalling on a wall. Cheap to run
// once per objective (a new target/node/exit) and cached by the caller (routeWaypoint below), not
// run every tick.
const GRID_STEP=.2,GRID_DIRS=[[1,0],[-1,0],[0,1],[0,-1]],GRID_CAP=8000;
function bfsRoute(round,start,goalTest,playerSolids){
  const key=(x,z)=>x+','+z;
  const sx=Math.round(start.x/GRID_STEP),sz=Math.round(start.z/GRID_STEP);
  const queue=[[sx,sz]],parents=new Map([[key(sx,sz),null]]);
  let found=null;
  for(let i=0;i<queue.length&&i<GRID_CAP;i++){
    const [x,z]=queue[i],here={x:x*GRID_STEP,z:z*GRID_STEP};
    if(goalTest(here)){found=[x,z];break;}
    for(const [dx,dz] of GRID_DIRS){
      const nx=x+dx,nz=z+dz,k=key(nx,nz);
      if(parents.has(k))continue;
      const next={x:nx*GRID_STEP,z:nz*GRID_STEP};
      const walked=movePlayer(here,{x:next.x-here.x,z:next.z-here.z},playerSolids,round.level.floors,RULES.playerRadius);
      if(Math.hypot(walked.x-next.x,walked.z-next.z)<.001){parents.set(k,[x,z]);queue.push([nx,nz]);}
    }
  }
  if(!found)return null;
  const path=[];
  for(let at=found;at;at=parents.get(key(...at)))path.unshift({x:at[0]*GRID_STEP,z:at[1]*GRID_STEP});
  return path;
}
// Cached route to the next unvisited waypoint for `key` (an objective identity, e.g. `node:node-2`).
// Recomputes when the objective changes, or when a SUCCESSFUL route goes stale after refreshMs
// (used for a moving target, never for a static node/medkit/exit point). A search that failed to
// find a route at all is retried only every 2 s no matter what refreshMs says -- an unreachable
// moving target (seen across a gap the floor graph doesn't actually connect) would otherwise pay a
// full failed grid search every refresh for as long as it stays the nearest visible enemy.
function routeWaypoint(bot,key,position,goalTest,playerSolids,round,now,refreshMs=0){
  const r=bot.route;
  const stale=!r||r.key!==key||(r.path&&refreshMs&&now-r.computedAt>=refreshMs)||(!r.path&&now>=r.retryAt);
  if(stale)bot.route={key,path:bfsRoute(round,position,goalTest,playerSolids),idx:0,computedAt:now,retryAt:now+2000};
  const path=bot.route.path;
  if(!path||!path.length)return null;
  while(bot.route.idx<path.length-1&&dist(position,path[bot.route.idx])<.3)bot.route.idx++;
  return path[bot.route.idx];
}
function noteStuck(bot,intended,actualMoved,now){
  if(now<bot.sideUntil){bot.stuckTicks=0;return;}
  if(intended>1e-6&&actualMoved<.02){
    bot.stuckTicks++;
    if(bot.stuckTicks>8){
      bot.sideSign=bot.rng()<.5?1:-1;bot.sideUntil=now+400;bot.stuckTicks=0;
      // The side-step itself is cheap and repeats every ~660 ms while genuinely stuck; actually
      // discarding the cached route (forcing a fresh grid search) is throttled separately so a body
      // parked right on the planned path can't make the bot pay a full BFS every stuck cycle.
      if(now>=(bot.replanAt??0)){bot.route=null;bot.replanAt=now+1000;}
    }
  }else bot.stuckTicks=0;
}
// Aim at the target's current position, perturbed by the tier's aim error. The engine's own aim
// assist (weapon.js assistAim) still corrects small errors back onto a target inside its cone -- a
// stronger bot benefits more from assist because its raw aim already lands closer, same as a real
// player with better aim gets more out of the same assist window.
function aimWithError(position,target,aimErrDeg,rng){
  const base=Math.atan2(target.x-position.x,target.z-position.z);
  const err=aimErrDeg?(rng()*2-1)*aimErrDeg*Math.PI/180:0;
  const a=base+err;
  return {x:Math.sin(a),z:Math.cos(a)};
}

// Run one raid to completion (death/timeout/abandon) or extraction and return its metrics.
// ftueAttempt (0,1,2) plays the FTUE raid at that attempt's assist ramp (data/raid-ftue.js); null
// plays a normal (non-FTUE) raid. targetDepth (1,2,3), docs/difficulty-bots.md §4.2/§5: a "depth N
// raid" -- the bot pushes levels 1..N and voluntarily extracts (round.js extractRound(), the same
// Continue/Extract choice the real Extract-raid button offers at every non-final level exit, see
// game.mjs's '#extract-raid' handler) right after clearing level N, instead of always pushing to
// level 3. Leave targetDepth null to push all the way through (extract only via levelsCleared===3
// 'complete'), the legacy behaviour kept for the unconditioned sim-bot smoke test. Independent of
// targetDepth, the bot also bails at ANY level exit once its HP ratio is below the tier's
// extractHpThreshold -- a cautious player reading their own health bar, not a depth goal.
export function runRaid({tier,seed,ftueAttempt=null,dt=DT,knobs=null,targetDepth=null}){
  const cfg=TIERS[tier];if(!cfg)throw new Error(`unknown difficulty tier: ${tier}`);
  const round=createRound(seed,0);
  // FTUE raids never take the difficulty knobs (docs/difficulty-bots.md §3: "never applies during
  // FTUE"); applied once per level, right where the real DDA PR will call it (raid generation only).
  if(knobs&&ftueAttempt==null)applyDifficulty(round.level,knobs);
  if(ftueAttempt!=null)initFtueRound(round,{ftue:true},{getItem:()=>JSON.stringify({attempts:ftueAttempt})});
  initEquip(round,{weapon:null,gear:[]});
  const weapon=createWeapon();round.weaponState=weapon;round.kit={medkit:0};
  let combat=createCombat(round.level,0);
  const dash=createDash();
  let position={...round.level.start};
  const bot=makeBot(tier,`${seed}:${ftueAttempt??'normal'}`);
  // Overrides levelReached when a voluntary extract fires right after clearing a level's exit:
  // round.level has already advanced to the NEXT level at that point (round.js enterExit), so the
  // depth actually played is round.levelsCleared, not round.level.number (see runRaid's return below).
  let depthPlayed=null;
  const dtMs=dt*1000,maxTicks=Math.ceil(MAX_RAID_MS/dtMs);
  let prevKills=0,endMs=0,tick=0;
  for(;tick<maxTicks;tick++){
    const now=tick*dtMs;
    tickRound(round,now);if(round.over){endMs=now;break;}
    const {solids,playerSolids}=solidsFor(round);
    const currentRoom=roomAt(round.level,position);
    const liveEnemies=round.level.enemies.filter(alive);
    for(const e of liveEnemies)if(!bot.firstSeen.has(e.id))bot.firstSeen.set(e.id,now);
    // Target selection is sticky (re-evaluated at most ~3x/s, kept while merely alive in between)
    // with a 3-miss hysteresis: a target right at the edge of a node's cover can flicker
    // visible/blocked from one re-evaluation to the next as the player's own position jitters by a
    // hair, and dropping it on the first miss would thrash between this target and the next-best
    // goal (see docs/difficulty-bots.md "Known sim gaps") without ever actually walking anywhere.
    let target=bot.targetId?liveEnemies.find(e=>e.id===bot.targetId)??null:null;
    if(!target||now>=(bot.targetReevalAt??0)){
      const visible=liveEnemies.filter(e=>!wallBlocked(position,e,playerSolids));
      const sameRoom=visible.filter(e=>roomAt(round.level,e)===currentRoom);
      const pool=sameRoom.length?sameRoom:visible;
      const best=pool.length?pool.reduce((a,b)=>dist(position,b)<dist(position,a)?b:a):null;
      if(target&&best?.id!==target.id){
        bot.targetMisses=(bot.targetMisses??0)+1;
        if(bot.targetMisses>=3){target=best;bot.targetMisses=0;}
      }else{target=best;bot.targetMisses=0;}
      bot.targetReevalAt=now+300;
    }
    bot.targetId=target?.id??null;

    const hpRatio=round.health/round.maxHealth;
    const haveKit=(round.kit?.medkit??0)>0||(round.bag?.medkit??0)>0;
    if(hpRatio<cfg.medkitThreshold&&haveKit&&!healthKitBlock(round))useHealthKit(round,now);

    // Choose this tick's movement goal: fight > get a medkit when hurt and empty-handed > light the
    // next node (a shielded node's generator is itself a live `enemy`, so it is always targeted
    // before the node is reachable) > walk to the open exit.
    let goal=null,repel=false,holdRange=false,waypoint=null;
    const range=weapon.rule.range;
    if(target){
      goal=target;
      const d=dist(position,target);
      repel=cfg.kite&&d<range*.45;
      holdRange=!repel&&d<=range;
      if(!holdRange&&!repel){
        waypoint=routeWaypoint(bot,`enemy:${target.id}`,position,p=>dist(p,target)<1.6&&!wallBlocked(p,target,playerSolids),playerSolids,round,now,500);
      }
    }else{
      const medkitBox=hpRatio<cfg.medkitThreshold&&!haveKit&&round.level.lootBoxes.find(b=>!b.collected&&b.item==='medkit');
      const node=round.level.nodes.filter(n=>!n.active).sort((a,b)=>dist(position,a)-dist(position,b))[0];
      if(medkitBox){goal=medkitBox;waypoint=routeWaypoint(bot,`loot:${medkitBox.id}`,position,p=>dist(p,medkitBox)<1.3,playerSolids,round,now);}
      else if(node){
        goal=node;holdRange=dist(position,node)<=RULES.resources.nodeReach;
        if(!holdRange)waypoint=routeWaypoint(bot,`node:${node.id}`,position,p=>dist(p,node)<1.6,playerSolids,round,now);
      }else{
        goal=round.level.exit;holdRange=dist(position,goal)<=goal.r;
        if(!holdRange)waypoint=routeWaypoint(bot,'exit',position,p=>dist(p,goal)<goal.r*.6,playerSolids,round,now);
      }
    }

    let movedIntent=0;const positionBefore={...position};
    if(!holdRange&&goal){
      // Aim at the planned waypoint when routing, the raw goal otherwise (kiting never routes).
      // steerDirection applies the stuck side-step to either source: a BFS route only avoids static
      // geometry, so a live enemy or another body sitting on the next cell can still pin the player
      // against it, and the side-step is what breaks that.
      const dir=steerDirection(bot,position,waypoint&&!repel?waypoint:goal,repel,now);
      movedIntent=dir.len;
      const speed=round.stats.speed;
      if(dash.remaining===0)position=moveWithActors(position,{x:dir.x*speed*dt,z:dir.z*speed*dt},round.level.enemies,playerSolids,round.level.floors,RULES.playerRadius);
    }else if(dash.remaining===0){
      // Holding range on a kiting tier still moves (sidestep or orbit below) instead of standing
      // dead still -- a stationary gun is an easy telegraph read for the enemy's own aim.
      let delta={x:0,z:0};
      if(holdRange&&target&&cfg.telegraphSidestep&&target.windupAt!=null){
        // Telegraph-sidestep (docs/difficulty-bots.md §6/§7): while the target is winding up, dodge
        // perpendicular to its locked aim line (enemy.attackTarget, set once at windup start) at full
        // speed instead of the slower strafe below -- a simple stand-in for a player ducking a
        // telegraphed shot, not real cover-seeking. One side is picked per telegraph instance (keyed
        // on the enemy id + its windupAt timestamp) so the bot commits instead of jittering.
        const dodgeKey=`${target.id}:${target.windupAt}`;
        if(bot.dodgeKey!==dodgeKey){bot.dodgeKey=dodgeKey;bot.dodgeSign=bot.rng()<.5?1:-1;}
        const aimAt=target.attackTarget??position;
        const line=norm(aimAt.x-target.x,aimAt.z-target.z);
        delta={x:-line.z*bot.dodgeSign*round.stats.speed*dt,z:line.x*bot.dodgeSign*round.stats.speed*dt};
      }else if(holdRange&&cfg.kite&&target){
        // One strafe direction per target engagement (re-rolled only when the target changes, not on
        // a timer): a direction held long enough actually orbits a stationary/slow-turning enemy
        // (e.g. a front-shield guard, turnRadPerSec .7) around to its exposed side/back, where an
        // alternating left-right wiggle never travels far enough to get there.
        if(bot.strafeTargetId!==target.id&&now>=(bot.strafeMinUntil??0)){bot.strafeTargetId=target.id;bot.strafeSign=bot.rng()<.5?1:-1;bot.strafeMinUntil=now+3000;}
        const toTarget=norm(target.x-position.x,target.z-position.z);
        delta={x:-toTarget.z*bot.strafeSign*round.stats.speed*dt,z:toTarget.x*bot.strafeSign*round.stats.speed*dt};
      }
      position=moveWithActors(position,delta,round.level.enemies,playerSolids,round.level.floors,RULES.playerRadius);
    }
    // Emergency escape: a kiting tier with Dash burns it the instant health is critical, regardless
    // of the current target's range -- ranged fire (most of this game's damage) never closes to
    // melee, so gating the dash on proximity would make it fire only against chargers.
    if(cfg.dash&&target&&hpRatio<.3&&dashCharge(dash,now)>=1){
      const away=norm(position.x-target.x,position.z-target.z);
      startDash(dash,away,now,round.stats.dashCooldownMs);
    }
    position=stepDash(dash,position,dt,round.level.enemies,playerSolids,round.level.floors);
    const moving=playerDisplaced(positionBefore,position);
    noteStuck(bot,movedIntent,dist(positionBefore,position),now);

    if(process.env.SIM_DEBUG&&tick%30===0)console.log((now/1000).toFixed(1),'pos',position.x.toFixed(2),position.z.toFixed(2),'target',target&&target.id,'liveEnemies',liveEnemies.length,'level',round.level.number,'hp',round.health,'kit',round.kit?.medkit);
    const roomNow=roomAt(round.level,position);if(roomNow>=0)round.currentRoom=roomNow;
    if(target){
      const engageAt=(bot.firstSeen.get(target.id)??now)+cfg.reactMs;
      const canShoot=now>=engageAt&&dist(position,target)<=range&&!wallBlocked(position,target,playerSolids);
      if(canShoot){
        round.shooter=position;
        fireAimedWeapon(weapon,round,position,aimWithError(position,target,cfg.aimErrDeg,bot.rng),now,playerSolids,moving,false);
        round.shooter=null;
      }
    }
    stepWeapon(weapon,round,now,dt,playerSolids);
    collectLoot(round,position,now,weapon);
    stepDoors(round,position,now);
    stepNodeInteraction(round,weapon,position,now,solids);
    round.playerMoving=moving;
    stepCombat(round,combat,position,now,dt,playerSolids,dash);
    stepHazards(round,position,now,dt,dash);
    stepStakes(round,now,position,round.currentRoom,null);
    if(round.hitFeels?.length)round.hitFeels=[];
    if(round.enemiesDefeated>prevKills){
      for(const e of round.level.enemies)if(e.diedAt===now&&e.type!=='generator'){
        bot.kills.push(now-(bot.firstSeen.get(e.id)??now));
      }
      prevKills=round.enemiesDefeated;
    }
    const result=enterExit(round,position,now);
    if(result==='next'){
      // Voluntary extract decision (docs/difficulty-bots.md §4.2/§5): reached the target depth, or
      // hurt enough to bail regardless of depth -- the same Continue/Extract choice a real player
      // gets at this exit (game.mjs '#extract-raid'). ftueAttempt!=null never reaches here (the FTUE
      // raid's own clutch extraction is handled inside enterExit/round.js, not this policy).
      const hpRatio=round.health/round.maxHealth;
      const shouldExtract=ftueAttempt==null&&((targetDepth!=null&&round.levelsCleared>=targetDepth)||hpRatio<cfg.extractHpThreshold);
      if(shouldExtract&&extractRound(round,now)){depthPlayed=round.levelsCleared;endMs=now;break;}
      if(knobs&&ftueAttempt==null)applyDifficulty(round.level,knobs);
      combat=createCombat(round.level,now);bot.firstSeen.clear();bot.stuckTicks=0;bot.sideUntil=-Infinity;bot.route=null;
      bot.targetId=null;bot.targetMisses=0;bot.targetReevalAt=0;
    }
    if(round.over){endMs=now;break;}
  }
  const extracted=round.reason==='extract'||round.reason==='complete';
  return {
    tier,seed,ftueAttempt,reason:round.reason,
    survived:round.reason!=='death',extracted,died:round.reason==='death'?1:0,
    timeToExtractSec:extracted?endMs/1000:null,
    damageTakenPct:Math.min(100,round.telemetry.damageTaken/round.maxHealth*100),
    levelReached:depthPlayed??round.level.number,levelsCleared:round.levelsCleared,
    kills:bot.kills.length,ttkSecList:bot.kills.map(ms=>ms/1000),
    medkitsUsed:round.telemetry.medkitsUsed,
    timedOut:tick>=maxTicks,
  };
}

// Quick manual smoke run: `node tools/difficulty-bots/sim.mjs [tier] [seed]`.
if(import.meta.url===`file://${process.argv[1]}`){
  const tier=process.argv[2]||'avg',seed=process.argv[3]||'demo';
  console.log('normal raid:',runRaid({tier,seed}));
  for(let a=0;a<3;a++)console.log(`ftue raid ${a+1}:`,runRaid({tier,seed,ftueAttempt:a}));
}
