import {RULES} from './levels.js?v=1.13.0';
import {traceTargets} from './physics.mjs?v=1.13.0';
import {tickRound} from './round.js?v=1.13.0';
export function stepScavenging(weapon,round,position,now,obstacles,{moving=false,hit=false}={}){
  tickRound(round,now);
  const rule=RULES.resources,hold=weapon.scavenging;
  const moved=moving||(hold&&Math.hypot(position.x-hold.position.x,position.z-hold.position.z)>rule.scavengeMovementTolerance);
  const damaged=hit||round.lastDamageAt===now||(hold&&round.lastDamageAt!==hold.lastDamageAt);
  const inCover=obstacles.some(b=>Math.hypot(Math.max(0,Math.abs(position.x-b.x)-b.w/2),Math.max(0,Math.abs(position.z-b.z)-b.d/2))<=rule.scavengeCoverReach);
  const target={...position,r:RULES.playerRadius,kind:'player'};
  const exposed=round.level.enemies.some(e=>e.health>0&&e.active!==false&&Math.hypot(e.x-position.x,e.z-position.z)<=RULES.combat.range&&traceTargets(e,position,obstacles,[target])?.kind==='player');
  if(round.over||weapon.reserve!==0||weapon.ammo>=RULES.weapon.capacity||moved||damaged||!inCover||exposed){weapon.scavenging=null;return false;}
  if(!hold){weapon.scavenging={startedAt:now,position:{...position},lastDamageAt:round.lastDamageAt,progress:0};return false;}
  hold.progress=Math.min(1,(now-hold.startedAt)/rule.scavengeMs);
  if(hold.progress<1)return false;
  weapon.ammo=RULES.weapon.capacity;weapon.reloadAt=null;weapon.scavenging=null;return true;
}
