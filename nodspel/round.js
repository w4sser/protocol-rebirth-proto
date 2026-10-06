import {generateLevel,RULES} from './levels.js?v=1.8.0';
import {DEFAULT_ORDER,readOrder,emptyBag,bagItems} from './raid.js?v=1.8.0';

export const ROUND_DURATION_MS=8*60*1000;
export function createRound(seed,now,requestedOrder=DEFAULT_ORDER) {
  const order=readOrder(requestedOrder);
  return {seed,order,deadline:now+ROUND_DURATION_MS,remainingMs:ROUND_DURATION_MS,over:false,reason:null,health:order.health,bag:emptyBag(),extracted:emptyBag(),lost:emptyBag(),cleared:false,level:generateLevel(1,seed),nodesLit:0,enemiesDefeated:0,levelsCleared:0};
}
function loseBag(round){for(const item of RULES.loot.types){round.lost[item]+=round.bag[item];round.bag[item]=0;}}
export function collectLoot(round,position,now){
  tickRound(round,now);if(round.over)return false;
  let changed=false;
  for(const box of round.level.lootBoxes){
    if(!box.collected&&Math.hypot(position.x-box.x,position.z-box.z)<=RULES.loot.pickupRadius){box.collected=true;round.bag[box.item]++;changed=true;}
  }
  return changed;
}
export function tickRound(round,now) {
  if(round.over)return;
  round.remainingMs=Math.max(0,Math.min(ROUND_DURATION_MS,round.deadline-now));
  if(round.remainingMs===0){loseBag(round);round.over=true;round.reason='timeout';}
}
export function takeDamage(round,amount,now){
  tickRound(round,now);
  if(round.over || !Number.isFinite(amount) || amount<=0)return false;
  round.health=Math.max(0,round.health-amount);
  if(round.health===0){loseBag(round);round.over=true;round.reason='death';}
  return true;
}
export function hitEnemy(round,id,now,damage=1){
  tickRound(round,now);
  const enemy=round.level.enemies.find(e=>e.id===id);
  if(round.over || !enemy || enemy.health<=0 || enemy.active===false || !Number.isFinite(damage) || damage<=0)return false;
  enemy.health=Math.max(0,enemy.health-damage);if(enemy.health===0){round.enemiesDefeated++;round.health=Math.min(100,round.health+RULES.killReward.health);}return true;
}
export function roundSummary(round){
  return {reason:round.reason,levelsCleared:round.levelsCleared,enemiesDefeated:round.enemiesDefeated,nodesLit:round.nodesLit,remainingMs:round.remainingMs,extracted:{...round.extracted},lost:{...round.lost}};
}
export function exitIsOpen(round) {
  return !round.over && round.level.nodes.every(n=>n.active);
}
export function activateNode(round,id,now) {
  tickRound(round,now);
  const node=round.level.nodes.find(n=>n.id===id);
  if(round.over || !node || node.active)return false;
  node.active=true;round.nodesLit++;
  for(const enemy of round.level.enemies)if(enemy.active===false){enemy.active=true;enemy.spawnedAt=now;}
  return true;
}
export function enterExit(round,position,now) {
  tickRound(round,now);
  if(round.cleared || !exitIsOpen(round) || Math.hypot(position.x-round.level.exit.x,position.z-round.level.exit.z)>round.level.exit.r)return null;
  round.exitLoot=bagItems(round.bag);
  for(const item of RULES.loot.types){round.extracted[item]+=round.bag[item];round.bag[item]=0;}
  round.levelsCleared++;
  if(round.level.number===3){round.cleared=true;round.over=true;round.reason='complete';return 'complete';}
  round.level=generateLevel(round.level.number+1,round.seed);
  return 'next';
}
