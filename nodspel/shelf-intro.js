// @hot shelfBitLine
// Same profile ledger and calm first-sight rule as the power-pad introduction.
import {RULES} from './levels.js?v=2.28.69';
import {traceTargets} from './physics.mjs?v=2.28.69';
export const SHELF_BIT_LINE='Gravity: still free, still rude.';
const EMPTY=Object.freeze([]);
export function shelfBitLine(round,position,alreadySeen,solids=round.level.walls){
  if(alreadySeen||round.ftue||round.over||round.pauseAt!=null)return null;
  for(const e of round.level.enemies)if(e.health>0&&e.aggro)return null;
  for(const shelf of round.level.shelves??EMPTY){
    if(!shelf.active&&shelf.tipAt==null&&Math.hypot(position.x-shelf.x,position.z-shelf.z)<=RULES.shelf.introRange&&traceTargets(position,shelf,solids,EMPTY)?.kind!=='wall')return SHELF_BIT_LINE;
  }
  return null;
}
