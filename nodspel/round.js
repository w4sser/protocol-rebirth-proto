import {generateLevel,RULES} from './levels.js?v=1.50.0';
// import {DEFAULT_ORDER,readOrder} from './raid.js?v=1.50.0';
import {emptyBag,bagItems} from './raid.js?v=1.50.0';
import {traceTargets} from './physics.mjs?v=1.50.0';

export const ROUND_DURATION_MS=8*60*1000;
// Order integration is paused; keep the old input path for later.
// export function createRound(seed,now,requestedOrder=DEFAULT_ORDER) {
//   const order=readOrder(requestedOrder);
// stats: validated player stats (see raid-result.js readStats); defaults to the new-player base.
export function createRound(seed,now,stats=RULES.playerStats.base) {
  stats={...RULES.playerStats.base,...stats};
  const bagCapacity=bagCap(stats.bagCapacity);
  return {seed,stats,bagCapacity,shield:Math.max(0,Math.round(stats.shield||0)),maxShield:Math.max(0,Math.round(stats.shield||0)),maxHealth:stats.maxHealth,telemetry:{distanceM:0,dashes:0,holdNodes:0,damageTaken:0},deadline:now+ROUND_DURATION_MS,remainingMs:ROUND_DURATION_MS,over:false,reason:null,health:stats.maxHealth,bag:emptyBag(),extracted:emptyBag(),lost:emptyBag(),cleared:false,level:generateLevel(1,seed),nodesLit:0,enemiesDefeated:0,levelsCleared:0};
}
// Raid bag size: meta sends it (?bag=) from upgrades + gear; clamped to [capacity, maxCapacity].
export function bagCap(n){const L=RULES.loot,v=Math.floor(Number(n));return Number.isFinite(v)?Math.min(L.maxCapacity,Math.max(L.capacity,v)):L.capacity;}
export const bagCapacityOf=round=>round?.bagCapacity??RULES.loot.capacity;
function secureBag(round){for(const item of RULES.loot.types){round.extracted[item]+=round.bag[item];round.bag[item]=0;}}
function loseBag(round){for(const item of RULES.loot.types){round.lost[item]+=round.bag[item];round.bag[item]=0;}}
export function collectLoot(round,position,now,weapon){
  tickRound(round,now);if(round.over)return false;
  let changed=false;
  for(const box of round.level.lootBoxes){
    if(Math.hypot(position.x-box.x,position.z-box.z)>RULES.loot.pickupRadius){box.blockedUntilLeft=false;box.fullNotified=false;box.kitFullNotified=false;}
    if(!box.collected&&Math.hypot(position.x-box.x,position.z-box.z)<=RULES.loot.pickupRadius){
      if(box.blockedUntilLeft)continue;
      if(box.item==='ammo_pack'){
        if(!weapon)continue;
        weapon.reserve+=box.ammoRounds??RULES.resources.ammoCrateRounds;
        {const wr=weapon.rule??RULES.weapon;if(weapon.ammo<wr.capacity&&weapon.reloadAt===null)weapon.reloadAt=now+wr.reloadMs;}
      }else if(box.item==='medkit'){
        // v1.46: health kits go to the kit slot (Q button), never the bag. Max RULES.kitMax.medkit;
        // a full slot leaves the kit on the ground (one quiet notice per approach).
        round.kit=round.kit||{medkit:0};
        if((round.kit.medkit||0)>=RULES.kitMax.medkit){if(!box.kitFullNotified){box.kitFullNotified=true;round.kitFull={boxId:box.id,at:now};changed=true;}continue;}
        round.kit.medkit=(round.kit.medkit||0)+1;round.kitPicked=(round.kitPicked||0)+1;
      }else{
        // Full bag: signal once per approach (re-arms after the player steps away).
        if(bagItems(round.bag).length>=bagCapacityOf(round)){if(!box.fullNotified){box.fullNotified=true;round.bagFull={boxId:box.id,item:box.item,at:now};changed=true;}continue;}
        round.bag[box.item]++;
      }
      box.collected=true;changed=true;
    }
  }
  return changed;
}
// Loot label action: health kits read SLOT FULL (dimmed) while the kit slot is at its max (v1.47).
export function kitSlotFull(round){return (round?.kit?.medkit??0)>=RULES.kitMax.medkit;}
export function lootAction(round,item){return item==='medkit'&&kitSlotFull(round)?{text:'SLOT FULL',full:true}:{text:'COLLECT',full:false};}
export function dropItem(round,item,position,now){
  tickRound(round,now);if(round.over||!round.bag[item])return null;
  round.bag[item]--;
  const box={id:`drop-${round.level.lootBoxes.length}-${now}`,x:position.x,z:position.z,item,collected:false,blockedUntilLeft:true};
  round.level.lootBoxes.push(box);return box;
}
// Swap: drop one bag item on the ground (revealed) and take the blocked box's item.
export function swapLoot(round,boxId,dropId,now){
  tickRound(round,now);if(round.over)return null;
  const box=round.level.lootBoxes.find(b=>b.id===boxId);
  if(!box||box.collected||!round.bag[dropId]||box.item==='ammo_pack')return null;
  round.bag[dropId]--;round.bag[box.item]=(round.bag[box.item]??0)+1;box.collected=true;
  const dropped={id:`drop-${round.level.lootBoxes.length}-${now}`,x:box.x,z:box.z,item:dropId,collected:false,blockedUntilLeft:true,revealed:true};
  round.level.lootBoxes.push(dropped);round.bagFull=null;return dropped;
}
// Medkits live in the kit slot (brought from base or picked up, max RULES.kitMax.medkit); unused ones come home on extract, lost on death.
export function useHealthKit(round,now){
  const max=round.maxHealth??100;tickRound(round,now);const kit=round.kit?.medkit>0;if(round.over||(!kit&&!round.bag.medkit)||round.health>=max)return false;
  if(kit)round.kit.medkit--;else round.bag.medkit--;const before=round.health;round.health=Math.min(max,round.health+RULES.rewards.medkitHealth);if(round.telemetry)round.telemetry.healed=(round.telemetry.healed||0)+round.health-before;return true;
}
export function stepNodeInteraction(round,weapon,position,now,obstacles){
  tickRound(round,now);
  if(round.over){round.nodeInteraction=null;return false;}
  const node=round.level.nodes.filter(n=>!n.active&&Math.hypot(position.x-n.x,position.z-n.z)<=RULES.resources.nodeReach&&traceTargets(position,n,obstacles,[])?.kind!=='wall').sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0];
  if(!node){round.nodeInteraction=null;return false;}
  let hold=round.nodeInteraction;
  if(!hold||hold.id!==node.id)hold=round.nodeInteraction={id:node.id,startedAt:now,progress:0};
  hold.progress=Math.min(1,(now-hold.startedAt)/RULES.resources.nodeHoldMs);
  if(hold.progress<1)return false;
  round.nodeInteraction=null;const lit=activateNode(round,node.id,now);if(lit&&round.telemetry)round.telemetry.holdNodes++;return lit;
}
export function tickRound(round,now) {
  if(round.over)return;
  round.remainingMs=Math.max(0,Math.min(ROUND_DURATION_MS,round.deadline-now));
  if(round.remainingMs===0){loseBag(round);round.over=true;round.reason='timeout';}
}
export function takeDamage(round,amount,now){
  tickRound(round,now);
  if(round.over || !Number.isFinite(amount) || amount<=0)return false;
  // Vest shield (v1.43) absorbs damage first; it does not regenerate.
  const absorbed=Math.min(round.shield||0,amount);if(absorbed){round.shield-=absorbed;amount-=absorbed;}
  if(round.telemetry)round.telemetry.damageTaken+=absorbed+Math.min(amount,round.health);
  round.lastDamageAt=now;round.health=Math.max(0,round.health-amount);
  if(round.health===0){loseBag(round);round.over=true;round.reason='death';}
  return true;
}
export function hitEnemy(round,id,now,damage=1){
  tickRound(round,now);
  const enemy=round.level.enemies.find(e=>e.id===id);
  if(round.over || !enemy || enemy.health<=0 || enemy.active===false || !Number.isFinite(damage) || damage<=0)return false;
  enemy.lastDamage=Math.min(enemy.health,damage);enemy.lastHitAt=now;enemy.hitSerial=(enemy.hitSerial??0)+1;enemy.health=Math.max(0,enemy.health-damage);if(enemy.health===0){round.enemiesDefeated++;round.health=Math.min(round.maxHealth??100,round.health+RULES.killReward.health);}return true;
}
export function roundSummary(round){
  return {reason:round.reason,levelsCleared:round.levelsCleared,enemiesDefeated:round.enemiesDefeated,nodesLit:round.nodesLit,remainingMs:round.remainingMs,extracted:{...round.extracted},lost:{...round.lost}};
}
// Player choice after a level exit: end the raid now; only this secures the carried bag.
export function extractRound(round,now){
  tickRound(round,now);if(round.over||round.levelsCleared<1)return false;
  secureBag(round);round.nodeInteraction=null;round.over=true;round.reason='extract';return true;
}
// Leaving a launched raid early counts as a loss: the bag is lost like on death.
export function abandonRound(round,now){
  tickRound(round,now);if(round.over)return false;
  loseBag(round);round.nodeInteraction=null;round.over=true;round.reason='abandon';return true;
}
export function exitIsOpen(round) {
  return !round.over && round.level.nodes.every(n=>n.active);
}
export function activateNode(round,id,now) {
  tickRound(round,now);
  const node=round.level.nodes.find(n=>n.id===id);
  if(round.over || !node || node.active)return false;
  node.active=true;round.nodesLit++;
  if(round.nodeInteraction?.id===id)round.nodeInteraction=null;
  for(const enemy of round.level.enemies)if(enemy.active===false){enemy.active=true;enemy.spawnedAt=now;}
  return true;
}
export function enterExit(round,position,now) {
  tickRound(round,now);
  if(round.cleared || !exitIsOpen(round))return null;
  const inZone=Math.hypot(position.x-round.level.exit.x,position.z-round.level.exit.z)<=round.level.exit.r;
  // Final level: once the nodes are done the extract stays open and the raid goes on (timer + risk) until the
  // player deliberately walks INTO the zone; being inside when it opens does not count.
  if(round.level.number===3){if(!inZone){round.level.exitArmed=true;return null;}if(!round.level.exitArmed)return null;}
  else if(!inZone)return null;
  // Owner rule: a level exit does NOT secure loot. The bag (same 4 slots) carries on, at risk,
  // until the player chooses Extract or clears the final level.
  round.exitLoot=bagItems(round.bag);
  round.nodeInteraction=null;
  round.levelsCleared++;
  if(round.level.number===3){secureBag(round);round.cleared=true;round.over=true;round.reason='complete';return 'complete';}
  round.level=generateLevel(round.level.number+1,round.seed);
  return 'next';
}
