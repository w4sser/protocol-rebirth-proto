// Depth Raid prototype (PR1, Bunker only, v2.28.57). Robert's design lock (21 Nov 2026): once a
// player goes deeper they cannot extract again until the next zone's window opens -- there is no
// always-on entry beam. Reuses the existing Bunker L1/L2/L3 as three depth zones in one raid
// (generateLevel 1 then 2 then 3); see docs/design-decisions.md. All tuning lives in data/raid-depth.js.
import '../data/raid-depth.js?v=2.28.57';
import {generateLevel,placeSupplyShelves,randomFromSeed} from './levels.js?v=2.28.57';
import {applyFtueLevel} from './ftue.js?v=2.28.57';
import {extractDepthZone} from './round.js?v=2.28.57';
import {spawnRefuseHorde} from './stakes.js?v=2.28.57';

export const DEPTH=globalThis.DATA.raidDepth;

// Opt-in game mode. Default OFF: ordinary raids stay Node Raid (the existing loop). The Raid Prep
// selector (NODE RAID / DEPTH RAID) passes ?depth=1 only when the player picks DEPTH RAID on Bunker
// after FTUE. ?depth=1 also forces it on for testing (but never during FTUE/intro); ?depth=0 forces
// it off. Pure predicate: nodspel/game.mjs reads AREA_SEL, launch.ftue/launch.intro, isBigLevelMode()
// and the depth query and passes them in; no DOM, no URL parsing here.
export function depthModeEnabled({area,ftue,intro,big,depthParam}={}){
  if(ftue||intro)return false;
  if(depthParam==='0')return false;
  if(depthParam==='1')return true;
  return false;
}

export function createDepthState(now){
  const zone=1,zoneDurationMs=DEPTH.zoneTimerMs[zone-1];
  return {zone,zoneDurationMs,zoneDeadline:now+zoneDurationMs,zoneRemainingMs:zoneDurationMs,
    window:false,windowOpenedAt:null,extracting:null,windowOpened:null,goDeeperUsed:null,z3ClearBonus:0};
}
// Called once per raid right after createRound (same spot initFtueRound/initEquip run from).
export function initDepthRound(round,enabled,now){
  round.depth=enabled?createDepthState(now):null;
  return round.depth;
}

// Advances the zone timer / window / walk-in extract countdown by one frame. Mirrors round.js's own
// tick-then-act functions: guarded on round.over/round.pauseAt, driven by the same paused-aware game
// clock the rest of the engine uses (nodspel/game.mjs gameClock()), so a level-intro pause or the
// bag/settings overlay freezes the zone timer exactly like it already freezes round.remainingMs.
// Returns a one-shot event string for the caller to react to (BIT line, HUD refresh), or null.
export function stepDepthRaid(round,now,position){
  const d=round.depth;
  if(!d||round.over||round.pauseAt!=null)return null;
  if(!d.window){
    d.zoneRemainingMs=Math.max(0,d.zoneDeadline-now);
    if(d.zoneRemainingMs>0)return null;
    d.window=true;d.windowOpenedAt=now;d.windowOpened={zone:d.zone,at:now};
    return 'window-opened';
  }
  d.zoneRemainingMs=0;
  // Same point+radius the beam/hatch render at (round.level.exit, reused unchanged from
  // nodspel/vfx-extract-beam.js's existing exit position) -- walking in starts the cancellable
  // countdown; leaving it before the countdown completes cancels the attempt, not the raid.
  const beam=round.level.exit,inBeam=Math.hypot(position.x-beam.x,position.z-beam.z)<=beam.r;
  if(!inBeam){
    if(d.extracting){d.extracting=null;return 'extract-canceled';}
    return null;
  }
  if(!d.extracting){d.extracting={startedAt:now};return 'extract-started';}
  if(now-d.extracting.startedAt<DEPTH.extractCountdownMs)return null;
  const zone=d.zone,complete=zone>=3;
  d.extracting=null;
  if(complete)d.z3ClearBonus=DEPTH.z3ClearBonusScrap;
  extractDepthZone(round,now,zone,complete);
  return complete?'zone3-complete':'zone-extracted';
}

// GO DEEPER (Z1/Z2 only, during an open window): closes the beam, advances to the next zone's level
// (the same generateLevel/placeSupplyShelves/applyFtueLevel path enterExit uses for a normal level
// advance -- but never offers Extract/checkpoint), starts the next zone's timer and spawns a
// refuse-horde (reuses stakes.js's seeded rusher/swarm spawn, never a new enemy type). The caller
// still owns rebuilding the 3D world (nodspel/game.mjs loadLevel()) and enemy visuals.
export function goDeeper(round,now,playerPosition,cameraTarget=null){
  const d=round.depth;
  if(!d||round.over||round.pauseAt!=null||!d.window||d.zone>=3||d.extracting)return null;
  const zoneLeft=d.zone;
  round.levelsCleared=Math.max(round.levelsCleared,zoneLeft);
  round.nodeInteraction=null;round.keys=[];
  round.level=generateLevel(round.level.number+1,round.seed);
  placeSupplyShelves(round.level,round.completedRaids,!!round.ftue||round.guidedIntro);
  applyFtueLevel(round);
  if(round.stakes)round.stakes.pendingSpawn=null;
  d.zone=zoneLeft+1;d.window=false;d.windowOpenedAt=null;d.extracting=null;
  d.zoneDurationMs=DEPTH.zoneTimerMs[d.zone-1];d.zoneDeadline=now+d.zoneDurationMs;d.zoneRemainingMs=d.zoneDurationMs;
  d.goDeeperUsed={zone:zoneLeft,nextZone:d.zone,at:now};
  const size=DEPTH.refuseHordeSize[zoneLeft-1],rng=randomFromSeed(`${round.seed}:refuse:${zoneLeft}`),
    count=size.min+Math.floor(rng()*(size.max-size.min+1));
  const spawned=spawnRefuseHorde(round,now,count,playerPosition,round.currentRoom??0,rng,cameraTarget);
  return {zoneLeft,nextZone:d.zone,spawned};
}
