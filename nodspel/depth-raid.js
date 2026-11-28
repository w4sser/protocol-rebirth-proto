// Walking choices, always-live current beam and loud hold-to-hack terminals.
import '../data/raid-depth.js?v=2.28.85';
import {generateDepthLevel,areaAt,depthDoor,applyAreaCombat,wakeArea,scaleDepthRules,placeDepthCover,combatRoomsWithCover,depthConnectorPaths,LINK_WIDTH,DEPTH_CLEAR_WIDTH,DEPTH_COVER_LANE_HALF,DEPTH_EXTRACT_COVER_CLEAR} from './depth-level.js?v=2.28.85';
import {timeoutRound,extractDepthZone} from './round.js?v=2.28.85';
import {rarityOf} from './rarity.js?v=2.28.85';

export const DEPTH=globalThis.DATA.raidDepth;
export {generateDepthLevel,areaAt,depthDoor,applyAreaCombat,wakeArea,scaleDepthRules,placeDepthCover,combatRoomsWithCover,depthConnectorPaths,LINK_WIDTH,DEPTH_CLEAR_WIDTH,DEPTH_COVER_LANE_HALF,DEPTH_EXTRACT_COVER_CLEAR};

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
    phase:'combat',extractOpen:true,extracting:null,clearedZones:[],z3ClearBonus:0,lastStepAt:now};
}

// Called once per raid right after createRound (same spot initFtueRound/initEquip run from).
// Replaces the L1-only map with the stitched 3-area bunker so GO DEEPER never calls loadLevel().
export function initDepthRound(round,enabled,now,opts={}){
  if(!enabled){round.depth=null;return null;}
  const level=generateDepthLevel(round.seed,{area:opts.area,hard:opts.hard??round.hard,completedRaids:round.completedRaids,ftue:!!round.ftue});
  round.level=level;
  round.depth=createDepthState(now);
  round.pauseAt=null;
  activateAreaExit(round,1);
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

export function activateAreaExit(round,zone){
  round.depth.extractOpen=true;
  const exit=round.level.depthExits?.[zone-1];
  if(exit)round.level.exit={...exit,r:DEPTH.extractRadius};
}

// Keep the same nodeInteraction contract used by the node hold ring, without node activation.
export function stepDepthHack(round,now,position,dt){
  const d=round.depth,door=depthDoor(round.level,d.zone);
  const terminal=round.level.nodes.find(n=>n.depthTerminal&&n.depthArea===d.zone);
  if(!terminal||!door?.locked){round.nodeInteraction=null;return null;}
  const inside=Math.hypot(position.x-terminal.x,position.z-terminal.z)<=DEPTH.hack.radius;
  const wasInside=!!terminal.hacking;
  terminal.hacking=inside;
  terminal.progress=Math.max(0,Math.min(1,(terminal.progress??0)+(inside?(wasInside?dt:0)/DEPTH.hack.holdMs:-dt/1000*DEPTH.hack.decayPerSec)));
  round.nodeInteraction=terminal.progress>0||inside?{id:terminal.id,startedAt:now-terminal.progress*DEPTH.hack.holdMs,progress:terminal.progress}:null;
  if(terminal.progress>=1){
    terminal.active=true;door.locked=false;door.openedAt=now;door.openedBy='hack';
    round.nodeInteraction=null;return 'hack-done';
  }
  if(inside&&!wasInside){
    for(const enemy of areaEnemies(round,d.zone))if(enemy.health>0&&Math.hypot(enemy.x-terminal.x,enemy.z-terminal.z)<=DEPTH.hack.noiseRadius){enemy.aggro=true;enemy.alertAt=null;}
    return 'hack-start';
  }
  return null;
}

export function clearDepthArea(round,now){
  const d=round.depth;
  if(d.clearedZones.includes(d.zone)||!areaIsCleared(round))return false;
  d.clearedZones.push(d.zone);
  round.levelsCleared=Math.max(round.levelsCleared,d.zone);
  const door=depthDoor(round.level,d.zone);
  if(door?.locked){door.locked=false;door.openedAt=now;door.openedBy='clear';}
  const terminal=round.level.nodes.find(n=>n.depthArea===d.zone&&n.depthTerminal);
  if(terminal){terminal.active=true;terminal.hacking=false;}
  round.nodeInteraction=null;
  if(DEPTH.clearCache.enabled){
    const exit=round.level.exit;
    const box={id:`depth-clear-cache-${d.zone}`,depthArea:d.zone,x:exit.cacheSpot?.x??exit.x+DEPTH.clearCache.offset,z:exit.cacheSpot?.z??exit.z,
      item:DEPTH.clearCache.items[d.zone-1],revealed:true,collected:false,clearCache:true};
    round.level.lootBoxes.push(box);d.lastClearCache=box;
  }
  return true;
}

export function enterArea(round,now,area){
  const d=round.depth;
  if(!d||round.over||area<=d.zone)return null;
  d.zone=area;d.phase='combat';d.extractOpen=true;d.extracting=null;
  round.nodeInteraction=null;d.lastStepAt=now;
  activateAreaExit(round,area);
  d.zoneDurationMs=DEPTH.zoneTimerMs[area-1];
  d.zoneDeadline=now+d.zoneDurationMs;d.zoneRemainingMs=d.zoneDurationMs;
  wakeArea(round.level,area);
  applyAreaCombat(round.level,area);
  return 'area-entered';
}


// True when the EXTRACT hatch is open and the player is inside its visible footprint
// (DEPTH.extractRadius, not the tighter RULES.exit.r=1 used by Node Raid).
export function extractRadiusOf(round){
  return round?.level?.exit?.r??DEPTH.extractRadius;
}
export function inDepthExtract(round,position){
  const beam=round?.level?.exit;
  if(!round?.depth?.extractOpen||!beam||!position)return false;
  return Math.hypot(position.x-beam.x,position.z-beam.z)<=extractRadiusOf(round);
}

// No depth interaction pauses combat. Area changes require the current door to be open.
export function stepDepthRaid(round,now,position){
  const d=round.depth;
  if(!d||round.over||round.pauseAt!=null)return null;
  const dt=Math.max(0,now-d.lastStepAt);d.lastStepAt=now;
  const door=depthDoor(round.level,d.zone),area=areaAt(round.level,position);
  if(door&&!door.locked&&area>d.zone){
    d.lastDoorPassed={zone:d.zone,how:door.openedBy==='keycard'?'key':door.openedBy??'key'};
    return enterArea(round,now,area);
  }
  d.phase=door&&!door.locked?'travel':'combat';
  d.zoneRemainingMs=Math.max(0,d.zoneDeadline-now);
  const cleared=clearDepthArea(round,now);
  const hack=stepDepthHack(round,now,position,dt);
  if(cleared)return 'area-cleared';
  if(hack)return hack;
  if(inDepthExtract(round,position)){
    if(!d.extracting){d.extracting={startedAt:now};return 'extract-started';}
    if(now-d.extracting.startedAt>=DEPTH.extractCountdownMs){
      const cleared=areaIsCleared(round),complete=d.zone>=3&&cleared;
      d.earlyExtract=!cleared;d.extractCleared=cleared;d.extracting=null;
      if(complete)d.z3ClearBonus=DEPTH.z3ClearBonusScrap;
      extractDepthZone(round,now,cleared?d.zone:0,complete);
      return complete?'zone3-complete':'zone-extracted';
    }
  }else if(d.extracting){d.extracting=null;return 'extract-canceled';}
  if(!d.clearedZones.includes(d.zone)&&d.zoneRemainingMs<=0){timeoutRound(round,now);return 'timeout';}
  return null;
}
