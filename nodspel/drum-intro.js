// Fuel drum BIT intro (docs/bit-narrator.md): first sight of a drum, in a calm beat, once per profile.
// Pure and DOM-free (persistence/`PRBitCard` wiring is nodspel/game.mjs's job) so the trigger condition
// is testable headless, the same split as nodspel/loot-value.js's materialPickupBitLine.
import {RULES} from './levels.js?v=2.28.47';

export const FUEL_DRUM_BIT_LINE="Red bands mean a plan. I'd kick it myself, but I don't have legs.";

// Returns the BIT line once the player is near an undetonated drum with no enemy currently aggro
// (so the card never fights for attention mid-firefight), or null while any of that isn't true yet --
// including the FTUE drum, which gets this same first-sight intro (M43/PRB-162).
export function fuelDrumBitLine(round,position,alreadySeen){
  if(alreadySeen)return null;
  const drums=(round.level.barrels??[]).filter(b=>!b.active);
  if(!drums.length)return null;
  if(!drums.some(b=>Math.hypot(position.x-b.x,position.z-b.z)<=RULES.drum.introRange))return null;
  if(round.level.enemies.some(e=>e.aggro&&e.health>0))return null;
  return FUEL_DRUM_BIT_LINE;
}
