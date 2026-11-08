// Blocking title card ("BUNKER LEVEL N") shown before a new bunker scene becomes interactive.
// Archipelago/town use one continuous big level (level.big), so there is no "level N" to announce.
export const LEVEL_INTRO_MS=1200;
export function levelIntroTitle(level){
  if(!level||level.big||(level.area??'bunker')!=='bunker')return null;
  return `BUNKER LEVEL ${level.number}`;
}
