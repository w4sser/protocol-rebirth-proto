// Depth Raid prototype (Bunker only, v2.28.58). Carlos's paper: an area completes when it is
// cleared, then a paused EXTRACT vs GO DEEPER choice; GO DEEPER unlocks a door and the player
// walks into the next area of the same stitched level. Robert's lock (21 Nov 2026): no mid-area
// extract. Area-clock timeout is a loss. NODE RAID is untouched (opt-in via depthModeEnabled).
import '../data/raid-depth.js?v=2.28.60';
import {generateDepthLevel,areaAt,depthDoor,applyAreaCombat,wakeArea,scaleDepthRules} from './depth-level.js?v=2.28.60';
import {timeoutRound,extractDepthZone} from './round.js?v=2.28.60';
import {pausePick,resumePick} from './perks.js?v=2.28.60';
import {rarityOf} from './rarity.js?v=2.28.60';

export const DEPTH=globalThis.DATA.raidDepth;
export {generateDepthLevel,areaAt,depthDoor,applyAreaCombat,wakeArea,scaleDepthRules};

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
    phase:'combat',choice:null,extractOpen:false,extracting:null,goDeeperUsed:null,z3ClearBonus:0};
}

// Called once per raid right after createRound (same spot initFtueRound/initEquip run from).
// Replaces the L1-only map with the stitched 3-area bunker so GO DEEPER never calls loadLevel().
export function initDepthRound(round,enabled,now,opts={}){
  if(!enabled){round.depth=null;return null;}
  const level=generateDepthLevel(round.seed,{area:opts.area,hard:opts.hard??round.hard,completedRaids:round.completedRaids,ftue:!!round.ftue});
  round.level=level;
  round.depth=createDepthState(now);
  wakeArea(level,1);
  applyAreaCombat(level,1);
  return round.depth;
}

export function areaEnemies(round,zone){
  return (round.level?.enemies??[]).filter(e=>e.depthArea===zone);
}
export function areaIsCleared(round,zone=round.depth?.zone){
  if(!round?.depth||zone==null)return false;
  return areaEnemies(round,zone).every(e=>e.health<=0);
}

export function nextAreaPreview(round,nextZone){
  const enemies=(round.level?.enemies??[]).filter(e=>e.depthArea===nextZone);
  const loot=(round.level?.lootBoxes??[]).filter(b=>b.depthArea===nextZone&&b.item);
  const types=[...new Set(enemies.map(e=>e.type||e.kind||'enemy'))];
  const tiers=[...new Set(loot.map(b=>rarityOf(b.item)).filter(Boolean))];
  return {zone:nextZone,enemyCount:enemies.length,enemyTypes:types,lootCount:loot.length,lootTiers:tiers,harder:true,betterLoot:true};
}

export function openChoice(round,now){
  const d=round.depth;
  if(!d||round.over||d.phase==='choice')return null;
  d.phase='choice';
  d.choice={zone:d.zone,at:now,canGoDeeper:d.zone<3};
  d.zoneRemainingMs=Math.max(0,d.zoneDeadline-now);
  pausePick(round,now);
  return 'choice-opened';
}

export function chooseExtract(round,now){
  const d=round.depth;
  if(!d||round.over||d.phase!=='choice')return null;
  const zone=d.zone;
  d.extractOpen=true;d.extracting=null;d.choice=null;d.phase='combat';
  const exit=round.level.depthExits?.[zone-1];
  if(exit){round.level.exit={x:exit.x,z:exit.z,r:exit.r??1};}
  resumePick(round,now);
  return {kind:'extract',zone};
}

export function goDeeper(round,now){
  const d=round.depth;
  if(!d||round.over||d.phase!=='choice'||d.zone>=3||!d.choice?.canGoDeeper)return null;
  const zoneLeft=d.zone;
  const door=depthDoor(round.level,zoneLeft);
  if(door){door.locked=false;door.openedAt=now;}
  round.levelsCleared=Math.max(round.levelsCleared,zoneLeft);
  d.phase='travel';d.choice=null;d.extractOpen=false;d.extracting=null;
  d.goDeeperUsed={zone:zoneLeft,nextZone:zoneLeft+1,at:now};
  resumePick(round,now);
  return {zoneLeft,nextZone:zoneLeft+1,doorId:door?.id};
}

export function enterArea(round,now,area){
  const d=round.depth;
  if(!d||round.over||area<=d.zone)return null;
  d.zone=area;d.phase='combat';d.extractOpen=false;d.extracting=null;d.choice=null;
  d.zoneDurationMs=DEPTH.zoneTimerMs[area-1];
  d.zoneDeadline=now+d.zoneDurationMs;d.zoneRemainingMs=d.zoneDurationMs;
  wakeArea(round.level,area);
  applyAreaCombat(round.level,area);
  return 'area-entered';
}

// Advances the area timer / clear-check / walk-in extract countdown by one frame. Mirrors
// round.js's own tick-then-act functions: combat ticking is guarded on pauseAt, but the
// clear check must still run (and travel must still detect the next area) using the same
// paused-aware game clock nodspel/game.mjs already passes in.
export function stepDepthRaid(round,now,position){
  const d=round.depth;
  if(!d||round.over)return null;
  if(d.phase==='choice')return null;
  if(d.phase==='travel'){
    const area=areaAt(round.level,position);
    if(area&&area>d.zone)return enterArea(round,now,area);
    return null;
  }
  if(round.pauseAt!=null)return null;
  if(d.extractOpen){
    const beam=round.level.exit,inBeam=beam&&Math.hypot(position.x-beam.x,position.z-beam.z)<=(beam.r??1);
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
  d.zoneRemainingMs=Math.max(0,d.zoneDeadline-now);
  if(d.zoneRemainingMs<=0){
    timeoutRound(round,now);
    return 'timeout';
  }
  if(areaIsCleared(round,d.zone))return openChoice(round,now);
  return null;
}
