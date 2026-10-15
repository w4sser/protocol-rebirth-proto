import {RULES} from './levels.js?v=1.54.0';
import {traceTargets} from './physics.mjs?v=1.54.0';
import {activateNode,hitEnemy,tickRound} from './round.js?v=1.54.0';

export function assistAim(position,direction,enemies,obstacles,rule=RULES.weapon){
  const length=Math.hypot(direction.x,direction.z);
  if(length<1e-9)return {target:null,direction:{x:0,z:-1}};
  const raw={x:direction.x/length,z:direction.z/length};let target=null,nearest=Infinity;
  for(const enemy of enemies){
    if(enemy.kind==='enemy'?(enemy.health<=0||enemy.active===false):enemy.active)continue;
    const dx=enemy.x-position.x,dz=enemy.z-position.z,distance=Math.hypot(dx,dz);
    if(distance<.01||distance>rule.range||distance>=nearest)continue;
    const dot=(dx*raw.x+dz*raw.z)/distance,side=Math.abs(dx*raw.z-dz*raw.x);
    if(dot<Math.cos(rule.assistAngleDegrees*Math.PI/180)||side>rule.assistWidth)continue;
    const hit=weaponHit(position,{x:position.x+dx/distance*rule.range,z:position.z+dz/distance*rule.range},obstacles,enemies,rule);
    if((hit?.target??hit?.node)?.id!==enemy.id)continue;
    target=enemy;nearest=distance;
  }
  if(!target)return {target:null,direction:raw};
  return {target,direction:{x:(target.x-position.x)/nearest,z:(target.z-position.z)/nearest}};
}

// The lock preview and projectile share the same target widths and cover test.
function weaponHit(start,end,obstacles,targets,rule=RULES.weapon){
  // Active nodes are not targets; their pedestal is ordinary cover shared with
  // enemy shots. Only enemies get the extra shot width.
  const eligible=targets.filter(t=>t.kind==='enemy'?(t.health>0&&t.active!==false):!t.active).filter(t=>traceTargets(start,t,obstacles,[t])?.kind!=='wall').map(t=>({...t,r:t.kind==='enemy'?t.r+rule.shotRadius:t.r}));
  return traceTargets(start,end,obstacles,eligible);
}
function applyWeaponHit(weapon,round,hit,now){
  const rule=weaponRule(weapon);
  // Shielded nodes (level 3) absorb shots and must be charged by standing close.
  if(hit?.kind==='node')return hit.node.shielded?false:activateNode(round,hit.node.id,now);
  if(hit?.kind!=='enemy')return false;
  const kills=round.enemiesDefeated,changed=hitEnemy(round,hit.target.id,now,rule.damage);
  if(round.enemiesDefeated>kills){const refill=Math.min(rule.capacity-weapon.ammo,weapon.reserve,RULES.killReward.ammo);weapon.ammo+=refill;weapon.reserve-=refill;if(weapon.ammo===rule.capacity||weapon.reserve===0)weapon.reloadAt=null;}
  return changed;
}
export function fireAimedWeapon(weapon,round,position,direction,now,obstacles){
  tickRound(round,now);if(round.over)return null;
  const rule=weaponRule(weapon),targets=[...round.level.enemies,...round.level.nodes],assisted=assistAim(position,direction,targets,obstacles,rule);
  // Spread only scatters free-aimed shots; a lock (aim assist) always lands.
  let dir=assisted.direction;
  if(!assisted.target&&rule.spreadDegrees>0){const a=(weapon.rand??Math.random)()*2-1,t=a*rule.spreadDegrees*Math.PI/180,c=Math.cos(t),s=Math.sin(t);dir={x:dir.x*c-dir.z*s,z:dir.x*s+dir.z*c};}
  const shot=fireWeapon(weapon,position,dir,now);if(!shot)return null;
  if(assisted.target){
    const end={x:position.x+shot.dx*rule.range,z:position.z+shot.dz*rule.range};
    const hit=weaponHit(position,end,obstacles,targets,rule);
    shot.resolved=applyWeaponHit(weapon,round,hit,now);
    // A locked hit is resolved at release, so a runner cannot outrun a promised
    // hit. The travelling tracer is visual only and cannot damage twice.
    if(shot.resolved)shot.remaining=Math.hypot(assisted.target.x-position.x,assisted.target.z-position.z);
  }
  return shot;
}

// stats: per-weapon overrides of RULES.weapon (already clamped by readWeapon).
export function weaponRule(weapon){return weapon?.rule??RULES.weapon;}
export function createWeapon(totalAmmo=Infinity,stats=null){
  const rule={...RULES.weapon,...(stats||{})},ammo=Math.min(rule.capacity,totalAmmo);
  return {rule,id:stats?.id??'basic_carbine',ammo,reserve:totalAmmo-ammo,reloadAt:null,nextShotAt:0,nextId:0,projectiles:[]};
}
export function tickWeapon(weapon,now){
  const rule=weaponRule(weapon);
  while(weapon.reloadAt!==null && now>=weapon.reloadAt){
    if(weapon.reserve<=0){weapon.reloadAt=null;break;}
    weapon.ammo++;weapon.reserve--;
    weapon.reloadAt=weapon.ammo<rule.capacity&&weapon.reserve>0?weapon.reloadAt+rule.reloadMs:null;
  }
}
export function fireWeapon(weapon,position,direction,now){
  tickWeapon(weapon,now);
  const rule=weaponRule(weapon),length=Math.hypot(direction.x,direction.z);
  if(!weapon.ammo || now<weapon.nextShotAt || length<.01)return null;
  weapon.scavenging=null;weapon.ammo--;weapon.nextShotAt=now+rule.shotIntervalMs;
  if(weapon.reloadAt===null&&weapon.reserve>0)weapon.reloadAt=now+rule.reloadMs;
  const shot={id:++weapon.nextId,x:position.x,z:position.z,dx:direction.x/length,dz:direction.z/length,remaining:rule.range};
  weapon.projectiles.push(shot);return shot;
}
export function stepWeapon(weapon,round,now,dt,obstacles){
  tickRound(round,now);
  if(round.over){weapon.projectiles.length=0;return false;}
  tickWeapon(weapon,now);let changed=false;
  for(let i=weapon.projectiles.length-1;i>=0;i--){
    const b=weapon.projectiles[i],distance=Math.min(b.remaining,weaponRule(weapon).bulletSpeed*dt);
    const end={x:b.x+b.dx*distance,z:b.z+b.dz*distance};
    const hit=b.resolved?null:weaponHit(b,end,obstacles,[...round.level.nodes,...round.level.enemies]);
    b.remaining=Math.max(0,b.remaining-distance);
    if(hit || b.remaining===0){
      changed=applyWeaponHit(weapon,round,hit,now)||changed;
      weapon.projectiles.splice(i,1);
    }else{b.x=end.x;b.z=end.z;}
  }
  return changed;
}
