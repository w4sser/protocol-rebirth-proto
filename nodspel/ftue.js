import '../data/raid-ftue.js?v=2.28.25';
import {RULES} from './levels.js?v=2.28.25';
import {STAKES} from './stakes.js?v=2.28.25';
import {audioEvent} from './audio.js?v=2.28.25';

export const FTUE=globalThis.DATA.raidFtue;
// The countdown is pressure only. It never closes the beam or ends a raid.
export function startFtueClutch(round,now){
  if(!round.ftue||round.over||round.ftueClutch||round.level.number!==1||!round.level.nodes.every(n=>n.active))return;
  const level=round.level,type=RULES.enemyTypes.rusher;
  const spawned=Array.from({length:FTUE.clutch.hunters},(_,i)=>{
    const p=FTUE.enemies[i%FTUE.enemies.length];
    return {id:`ftue-hunter-${i+1}`,kind:'enemy',type:'rusher',
      x:level.rooms[0].x+p.x,z:level.rooms[0].z+p.z,r:RULES.shooting.telegraphs.enemyRadius,
      health:STAKES.waveRusherHealth*round.ftue.healthMul,
      speed:RULES.levels[0].enemySpeed*type.speedMul*round.ftue.speedMul,
      rangeMul:type.rangeMul,cooldownMul:type.cooldownMul,standoff:type.standoff,
      active:true,aggro:true,swarm:true,graceMs:0,spawnedAt:now,hunter:true};
  });
  level.enemies.push(...spawned);
  round.ftueClutch={startedAt:now,endsAt:now+FTUE.clutch.countdownMs,spawned};
  audioEvent('hunter-wave');
}
export function ftueClutchSeconds(round,now){
  if(!round.ftue||!round.ftueClutch||round.over)return null;
  return Math.max(0,Math.ceil((round.ftueClutch.endsAt-now)/1000));
}
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
    ftueGuaranteeAlloy(level);
  }
  for(const e of level.enemies){e.health=Math.max(1,e.health*cfg.healthMul);e.speed*=cfg.speedMul;}
}
// D3.10: the first FTUE raid always carries home 2 Scrap Alloy as world pickups (never a silent stash
// grant or a beat.guaranteedDrops entry -- this raid runs before the beat spine starts), so a fresh
// profile's smaller start stash still covers the Core L1 cost on return. Reuses the intro's supply-spot
// formula (same spot applyIntroEncounter already uses for goal parts) when clear; otherwise the pickup
// keeps whatever position it already had.
function ftueGuaranteeAlloy(level){
  const want=2,cfg=RULES.intro,r=level.rooms[0],s=level.choiceSide||1;
  const solids=[...level.walls,...level.boxes];
  const blocked=p=>solids.some(o=>Math.abs(p.x-o.x)<o.w/2+.6&&Math.abs(p.z-o.z)<o.d/2+.6);
  for(let i=0;i<want;i++){
    const spot={x:r.x+s*(cfg.supplyX+(i%2)*cfg.supplySpacing),z:r.z+cfg.supplyZ+Math.floor(i/2)*cfg.supplySpacing};
    const box=level.lootBoxes[i];
    if(box){
      box.item='scrap_alloy';box.marked=true;box.revealed=true;
      if(!blocked(spot)){box.x=spot.x;box.z=spot.z;}
    } else {
      level.lootBoxes.push({id:`ftue-alloy-${i+1}`,...spot,item:'scrap_alloy',marked:true,revealed:true,collected:false,source:'ELECTRICAL STORAGE · REPAIR SUPPLIES'});
    }
  }
}
