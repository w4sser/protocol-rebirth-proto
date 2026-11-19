// A calm, first-sight moment. The profile owns persistence through RaidResult.bitSeen.
import {RULES} from './levels.js?v=2.28.49';
import {traceTargets} from './physics.mjs?v=2.28.49';
export const POWER_PAD_BIT_LINE="Water plus power. Nature's little I-told-you-so.";
const NO_TARGETS=[];
export function powerPadBitLine(round,position,alreadySeen,solids=round.level.walls){
  if(!round.level.junctions?.length||alreadySeen||round.ftue||round.over||round.pauseAt!=null)return null;
  for(const e of round.level.enemies)if(e.aggro&&e.health>0)return null;
  for(const j of round.level.junctions){
    let p=null;for(const h of round.level.hazards)if(h.id===j.padId){p=h;break;}
    if(p&&Math.hypot(position.x-j.x,position.z-j.z)<=RULES.junction.introRange&&traceTargets(position,j,solids,NO_TARGETS)?.kind!=='wall')return POWER_PAD_BIT_LINE;
  }
  return null;
}
