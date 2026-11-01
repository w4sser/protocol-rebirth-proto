import '../data/raid-ftue.js?v=2.22.1';
import {RULES} from './levels.js?v=2.22.1';

export const FTUE=globalThis.DATA.raidFtue;
export function ftueAssist(attempts){
  const n=Number(attempts);
  return FTUE.attempts[Number.isFinite(n)?Math.min(FTUE.attempts.length-1,Math.max(0,Math.floor(n))):0];
}
// Called on every reset, after the failure counter has been persisted.
export function initFtueRound(round,launch,storage){
  if(!launch.ftue)return;
  let attempts=0;
  try{attempts=JSON.parse(storage.getItem('pr_ftue_v1'))?.attempts??0;}catch{}
  round.ftue=ftueAssist(attempts);
  applyFtueLevel(round);
}
export function applyFtueLevel(round){
  if(!round.ftue)return;
  const level=round.level,cfg=round.ftue;
  if(level.number===1){
    // Keep the authored supplies, cover, gate, door and exit. Both firing lanes
    // pass beside the cover, with the same room coordinates for every seed.
    level.enemies=FTUE.enemies.map((p,i)=>({id:`ftue-grunt-${i+1}`,kind:'enemy',type:'grunt',
      x:level.rooms[0].x+p.x,z:level.rooms[0].z+p.z,r:RULES.shooting.telegraphs.enemyRadius,
      health:RULES.levels[0].enemyHealth,speed:RULES.levels[0].enemySpeed,active:true,aggro:true}));
    level.encounters=[];
  }
  for(const e of level.enemies){e.health=Math.max(1,e.health*cfg.healthMul);e.speed*=cfg.speedMul;}
}
