import {audioEvent} from './audio.js?v=2.12.1';
import {RULES} from './levels.js?v=2.12.1';
import {moveWithActors} from './physics.mjs?v=2.12.1';
export function createDash(){return {readyAt:0,remaining:0,direction:null,startedAt:-Infinity};}
export function dashCharge(state,now){return Math.max(0,Math.min(1,1-(state.readyAt-now)/(state.cooldownMs??RULES.dash.cooldownMs)));}
export function startDash(state,direction,now,cooldownMs=RULES.dash.cooldownMs){
  const length=Math.hypot(direction.x,direction.z);
  if(dashCharge(state,now)<1||state.remaining>0||length<.01)return false;
  audioEvent('dash');
  state.direction={x:direction.x/length,z:direction.z/length};state.remaining=RULES.dash.distance;state.cooldownMs=cooldownMs;state.readyAt=now+cooldownMs;state.startedAt=now;return true;
}
// First RULES.dash.iframeMs of the dash: the player takes 0 damage from projectiles, blasts and hazards (combat.js).
export function dashInvulnerable(state,now){return !!state&&state.remaining>0&&now>=state.startedAt&&now-state.startedAt<RULES.dash.iframeMs;}
export function stepDash(state,position,dt,enemies,solids,floors){
  if(state.remaining<=0)return position;
  const distance=Math.min(state.remaining,RULES.dash.distance/RULES.dash.durationSeconds*Math.max(0,dt));
  state.remaining=Math.max(0,state.remaining-distance);
  return moveWithActors(position,{x:state.direction.x*distance,z:state.direction.z*distance},enemies,solids,floors,RULES.playerRadius);
}
