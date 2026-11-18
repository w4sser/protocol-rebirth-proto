import {RULES} from './levels.js?v=2.28.47';
// Load the authored config after levels imports its original config snapshot.
import '../data/raid-ftue.js?v=2.28.47-ftue-opening-v1';

export const FTUE=globalThis.DATA.raidFtue;
export function ftueAssist(attempts){
  const n=Number(attempts);
  return FTUE.attempts[Number.isFinite(n)?Math.min(FTUE.attempts.length-1,Math.max(0,Math.floor(n))):0];
}
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
    const room=level.rooms[0],o=FTUE.opening;
    const at=p=>({x:room.x+p.x,z:room.z+p.z});
    level.start=at(o.start);
    const grunt=(id,p,health,speed)=>({id,kind:'enemy',type:'grunt',...at(p),
      r:RULES.shooting.telegraphs.enemyRadius,health,speed,active:true,aggro:false,
      ftueNoticeRadius:o.detectRadius,cooldownMs:o.enemyCooldownMs,facing:Math.PI});
    // All three actors exist before gameplay; nothing spawns on top of the player.
    level.enemies=[grunt('ftue-solo',o.solo,o.soloHealth,o.soloSpeed),
      ...o.group.map((p,i)=>grunt('ftue-group-'+(i+1),p,o.groupHealth,o.groupSpeed))];
    level.barrels=[{id:'ftue-barrel-1',kind:'barrel',...at(o.barrel),r:o.barrel.r,
      blastRadius:o.barrel.blastRadius,damage:o.barrel.damage,knockback:o.barrel.knockback,active:false}];
    Object.assign(level.nodes[0],at(o.node),{shielded:false});
    Object.assign(level.exit,at(o.exit));
    level.boxes=o.cover.map(b=>({...b,...at(b)}));
    level.encounters=[];level.spawners=[];level.hazards=[];
    level.firstGraceMs=o.graceMs;
    ftueGuaranteeAlloy(level);
  }
  for(const e of level.enemies){e.health=Math.max(1,e.health*cfg.healthMul);e.speed*=cfg.speedMul;}
}
function ftueGuaranteeAlloy(level){
  const room=level.rooms[0];
  level.lootBoxes=FTUE.earlyLoot.supplies.map((supply,i)=>({
    id:'ftue-supply-'+i,x:room.x+FTUE.earlyLoot.spots[i].x,
    z:room.z+FTUE.earlyLoot.spots[i].z,
    ...supply,marked:true,revealed:true,collected:false,source:'ELECTRICAL STORAGE - REPAIR SUPPLIES',
  }));
  for(const door of level.doors??[])door.locked=false;
}
