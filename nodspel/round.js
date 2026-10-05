import {generateLevel} from './levels.js?v=1.4.0';

export const ROUND_DURATION_MS=8*60*1000;
export function createRound(seed,now) {
  return {seed,deadline:now+ROUND_DURATION_MS,remainingMs:ROUND_DURATION_MS,over:false,reason:null,health:100,cleared:false,level:generateLevel(1,seed),nodesLit:0,enemiesDefeated:0,levelsCleared:0};
}
export function tickRound(round,now) {
  if(round.over)return;
  round.remainingMs=Math.max(0,Math.min(ROUND_DURATION_MS,round.deadline-now));
  if(round.remainingMs===0){round.over=true;round.reason='timeout';}
}
export function takeDamage(round,amount,now){
  tickRound(round,now);
  if(round.over || !Number.isFinite(amount) || amount<=0)return false;
  round.health=Math.max(0,round.health-amount);
  if(round.health===0){round.over=true;round.reason='death';}
  return true;
}
export function hitEnemy(round,id,now,damage=1){
  tickRound(round,now);
  const enemy=round.level.enemies.find(e=>e.id===id);
  if(round.over || !enemy || enemy.health<=0 || !Number.isFinite(damage) || damage<=0)return false;
  enemy.health=Math.max(0,enemy.health-damage);if(enemy.health===0)round.enemiesDefeated++;return true;
}
export function roundSummary(round){
  return {reason:round.reason,levelsCleared:round.levelsCleared,enemiesDefeated:round.enemiesDefeated,nodesLit:round.nodesLit,remainingMs:round.remainingMs};
}
export function exitIsOpen(round) {
  return !round.over && round.level.nodes.every(n=>n.active);
}
export function activateNode(round,id,now) {
  tickRound(round,now);
  const node=round.level.nodes.find(n=>n.id===id);
  if(round.over || !node || node.active)return false;
  node.active=true;round.nodesLit++;return true;
}
export function enterExit(round,position,now) {
  tickRound(round,now);
  if(round.cleared || !exitIsOpen(round) || Math.hypot(position.x-round.level.exit.x,position.z-round.level.exit.z)>round.level.exit.r)return null;
  round.levelsCleared++;
  if(round.level.number===3){round.cleared=true;round.over=true;round.reason='complete';return 'complete';}
  round.level=generateLevel(round.level.number+1,round.seed);
  return 'next';
}
