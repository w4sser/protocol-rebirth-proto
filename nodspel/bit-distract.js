// M42 (docs/design-decisions.md "M42"): a player-tapped BIT ability that flies to the single most
// immediately threatening reachable enemy and holds its attention for a few seconds with a readable,
// never-lethal spark. Presentation/state only -- it never imports combat.js/weapon.js; it reuses the
// same enemy.lureTarget/lureUntil fields combat.js already walks for tool decoys (nodspel/tools.js), so
// a distracted enemy turns, stops firing and its existing visor/label feedback just works.
import {RULES} from './levels.js?v=2.28.17';
// Fire the zap once BIT is this close to its target, or this long after activation -- whichever first.
// Small presentation constants, not raid tuning, so they live here rather than in RULES.bit.distract.
const ZAP_RANGE=2.2,ZAP_DELAY_MS=350;
const TELEGRAPH_PHASES=new Set(['warning','charge','burst']);
function distractTuning(){return RULES.bit.distract;}
export function createBitDistract(){
  return {readyAt:0,cooldownDuration:0,active:false,enemyId:null,startedAt:0,until:0,zapDone:false,hoverX:0,hoverZ:0,lastResult:null};
}
export function bitDistractReady(state,now){return now>=state.readyAt;}
export function bitDistractCooldownMs(state,now){return Math.max(0,state.readyAt-now);}
// Rank: a telegraphing/attacking enemy first, then any already-aggro enemy, then one that has merely
// noticed (alertAt set, still mid-"!"), then anything else alive and reachable; ties go to the nearest.
function threatRank(enemy){
  if(enemy.windupAt!=null||TELEGRAPH_PHASES.has(enemy.attackPhase))return 3;
  if(enemy.aggro)return 2;
  if(enemy.alertAt!=null)return 1;
  return 0;
}
export function pickImmediateThreat(enemies,playerPos,range){
  let best=null,bestRank=-1,bestDist=Infinity;
  for(const enemy of enemies){
    if(!(enemy.health>0)||enemy.type==='generator'||enemy.sleeping||(enemy.swarm&&enemy.active===false))continue;
    const dist=Math.hypot(enemy.x-playerPos.x,enemy.z-playerPos.z);
    if(dist>range)continue;
    const rank=threatRank(enemy);
    if(rank>bestRank||(rank===bestRank&&dist<bestDist)){best=enemy;bestRank=rank;bestDist=dist;}
  }
  return best;
}
// M33/M34 (docs/design-decisions.md): heavy/specialist types still react, just for a shorter window --
// never full immunity.
export function isEnemyResistant(enemy){
  const t=distractTuning();
  return t.resistantTypes.includes(enemy.type)||t.resistantEncounters.includes(enemy.encounter);
}
// Never-lethal chip (M42 Q2): if the target would die from it, show the spark only and leave health
// untouched; otherwise apply the same bookkeeping round.js's hitEnemy uses on an ordinary hit, without
// ever routing through the kill path (no killReward, no diedAt, health never reaches 0 from this call).
export function chipNeverLethal(enemy,zapDamage,now){
  if(enemy.health<=zapDamage)return false;
  enemy.lastDamage=Math.min(enemy.health,zapDamage);enemy.lastHitAt=now;enemy.hitSerial=(enemy.hitSerial??0)+1;
  enemy.health-=zapDamage;
  return true;
}
export function tryActivateBitDistract(state,round,bit,playerPos,enemies,now){
  const t=distractTuning();
  if(!bitDistractReady(state,now)){state.lastResult={ok:false,reason:'cooldown'};return state.lastResult;}
  const target=pickImmediateThreat(enemies,playerPos,t.range);
  if(!target){state.readyAt=now+t.noTargetCooldownMs;state.cooldownDuration=t.noTargetCooldownMs;state.lastResult={ok:false,reason:'no-target'};return state.lastResult;}
  const resistant=isEnemyResistant(target),duration=resistant?t.resistantDurationMs:t.durationMs;
  const hx=playerPos.x-target.x,hz=playerPos.z-target.z,hd=Math.hypot(hx,hz)||1;
  state.hoverX=target.x+hx/hd*t.hoverDistance;state.hoverZ=target.z+hz/hd*t.hoverDistance;
  target.lureTarget={x:bit.x,z:bit.z};target.lureUntil=now+duration;
  state.active=true;state.enemyId=target.id;state.startedAt=now;state.until=now+duration;state.zapDone=false;
  state.readyAt=now+t.cooldownMs;state.cooldownDuration=t.cooldownMs;
  state.lastResult={ok:true,enemyId:target.id,resistant,duration};
  return state.lastResult;
}
// Flies BIT to a hover point beside the target (between it and the player, so it stays visible rather
// than clipping into the mesh), keeps lureTarget pointed at BIT's live position every step so the enemy
// visibly tracks it, and fires one never-lethal zap. Returns the zap's world position for one frame
// (so the caller can draw a spark) or null. Caller stops BIT's ordinary follow trail while active and
// resumes it once this returns inactive.
export function stepBitDistract(state,round,bit,playerPos,enemies,now,dt){
  if(!state.active)return null;
  const t=distractTuning(),enemy=enemies.find(e=>e.id===state.enemyId);
  if(!enemy||!(enemy.health>0)||now>=state.until){
    if(enemy&&enemy.lureUntil===state.until){delete enemy.lureTarget;delete enemy.lureUntil;}
    state.active=false;state.enemyId=null;
    return null;
  }
  const dx=state.hoverX-bit.x,dz=state.hoverZ-bit.z,d=Math.hypot(dx,dz);
  if(d>1e-4){const step=Math.min(d,t.flySpeed*dt);bit.x+=dx/d*step;bit.z+=dz/d*step;}
  if(enemy.lureTarget){enemy.lureTarget.x=bit.x;enemy.lureTarget.z=bit.z;}else enemy.lureTarget={x:bit.x,z:bit.z};
  if(!state.zapDone){
    const toEnemy=Math.hypot(bit.x-enemy.x,bit.z-enemy.z);
    if(toEnemy<=ZAP_RANGE||now-state.startedAt>=ZAP_DELAY_MS){
      state.zapDone=true;chipNeverLethal(enemy,t.zapDamage,now);
      return {x:enemy.x,z:enemy.z};
    }
  }
  return null;
}
