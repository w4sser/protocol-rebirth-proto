import {audioEvent} from './audio.js?v=2.22.2';
import {PERKS,perkState,hasPerk,logCombat,reloadInterval} from './perks.js?v=2.22.2';
import {RULES} from './levels.js?v=2.22.2';
import {traceTargets,movePlayer,aimConePoints,shotContact} from './physics.mjs?v=2.22.2';
import {activateNode,hitEnemy,tickRound,alertEnemy} from './round.js?v=2.22.2';

// Lean over only the low cover beside the original shooter, never cover near a flying bullet.
export function playerShotObstacles(origin,obstacles){
  return obstacles.filter(o=>!o.encounterCover||Math.hypot(Math.max(0,Math.abs(origin.x-o.x)-o.w/2),Math.max(0,Math.abs(origin.z-o.z)-o.d/2))>RULES.shooting.coverLeanReach);
}
export function playerDisplaced(before,after){
  return Math.hypot(after.x-before.x,after.z-before.z)>RULES.shooting.movementEpsilon;
}
export function assistWindow(rule=RULES.weapon,moving=false){
  return {angleDegrees:moving?Math.min(rule.assistAngleDegrees,RULES.shooting.movingAssistAngleDegrees):rule.assistAngleDegrees,
    width:moving?Math.min(rule.assistWidth,RULES.shooting.movingAssistWidth):rule.assistWidth};
}
// The preview depicts both eligibility limits: angle near the muzzle, width farther away.
export function assistPreview(position,direction,obstacles,rule=RULES.weapon,moving=false){
  obstacles=playerShotObstacles(position,obstacles);
  const window=assistWindow(rule,moving),length=Math.hypot(direction.x,direction.z)||1;
  const raw={x:direction.x/length,z:direction.z/length};
  return aimConePoints(position,raw,rule.range,window.angleDegrees*Math.PI/180,obstacles).map(p=>{
    const dx=p.x-position.x,dz=p.z-position.z,side=Math.abs(dx*raw.z-dz*raw.x);
    const scale=side>window.width?window.width/side:1;
    return {x:position.x+dx*scale,z:position.z+dz*scale};
  });
}
export function assistAim(position,direction,enemies,obstacles,rule=RULES.weapon,moving=false){
  obstacles=playerShotObstacles(position,obstacles);
  const window=assistWindow(rule,moving);
  const length=Math.hypot(direction.x,direction.z);
  if(length<1e-9)return {target:null,direction:{x:0,z:-1},rejections:['no direction']};
  const raw={x:direction.x/length,z:direction.z/length};let target=null,nearest=Infinity;const rejections=[];
  for(const enemy of enemies){
    if(enemy.kind==='enemy'?(enemy.health<=0||enemy.active===false):enemy.active)continue;
    const dx=enemy.x-position.x,dz=enemy.z-position.z,distance=Math.hypot(dx,dz);
    if(distance<.01||distance>rule.range){rejections.push({id:enemy.id,reason:'range'});continue;}if(distance>=nearest)continue;
    const dot=(dx*raw.x+dz*raw.z)/distance,side=Math.abs(dx*raw.z-dz*raw.x);
    if(dot<Math.cos(window.angleDegrees*Math.PI/180)){rejections.push({id:enemy.id,reason:'angle'});continue;}if(side>window.width){rejections.push({id:enemy.id,reason:'width'});continue;}
    const hit=weaponHit(position,{x:position.x+dx/distance*rule.range,z:position.z+dz/distance*rule.range},obstacles,enemies,rule);
    if((hit?.target??hit?.node)?.id!==enemy.id){rejections.push({id:enemy.id,reason:'occluded'});continue;}
    target=enemy;nearest=distance;
  }
  if(!target)return {target:null,direction:raw,rejections:rejections.length?rejections:[{reason:'no target'}]};
  return {target,direction:{x:(target.x-position.x)/nearest,z:(target.z-position.z)/nearest},rejections};
}

// The lock preview and projectile share the same target widths and cover test.
// Enemy hit radius matches the rendered body (the .72-wide body reaches .51 at its corners) plus a small
// margin (enemyHitboxMargin) so a shot that visually overlaps the model never reads as a miss, then the
// projectile's own width (shotRadius) on top for aim forgiveness.
function weaponHit(start,end,obstacles,targets,rule=RULES.weapon){
  // Active nodes are not targets; their pedestal is ordinary cover shared with
  // enemy shots. Only enemies get the extra shot width.
  const eligible=targets.filter(t=>t.kind==='enemy'?(t.health>0&&(t.active!==false||!t.swarm)):!t.active).filter(t=>traceTargets(start,t,obstacles,[t])?.kind!=='wall').map(t=>({...t,r:t.kind==='enemy'?t.r*(rule.enemyHitboxMargin??1)+rule.shotRadius:t.r}));
  return traceTargets(start,end,obstacles,eligible);
}
function applyWeaponHit(weapon,round,hit,now,dir=null,obstacles=[],shot=null){
  const rule=weaponRule(weapon);
  if(hit&&!shot?.pellet)audioEvent('impact',{enemy:hit.kind==='enemy'});
  // Shielded nodes (level 3) absorb shots and must be charged by standing close.
  if(hit?.kind==='node'){const changed=hit.node.shielded&&!(now<(hit.node.shieldDownUntil??0))?false:activateNode(round,hit.node.id,now);if(shot)recordShot(round,shot,now,changed?'hit':'block',hit.node.id);return changed;} // EMP drops the shield for a few seconds
  if(hit?.kind!=='enemy'){if(shot)recordShot(round,shot,now,hit?'block':'miss');return false;}
  const enemy=round.level.enemies.find(e=>e.id===hit.target.id),before=enemy?.health??0;
  const kills=round.enemiesDefeated,changed=hitEnemy(round,hit.target.id,now,rule.damage*(shot?.damageScale??(shot?.bonus?1+PERKS.chainBonus:1)),shot?.origin);
  if(shot&&!shot.ricochet){recordShot(round,shot,now,changed?'hit':'block',hit.target.id);if(shot.bonus)logCombat(round,{kind:'perk',perk:'chain',at:now,shotId:shot.logId??shot.id,text:`Chain Reaction: ${changed?Number(Math.max(0,before-(enemy?.health??before)-Math.min(before,rule.damage)).toFixed(2)):0} extra damage, ${changed?'hit':'blocked'} (${hit.target.id}).`});}
  if(changed&&shot?.ricochet)logCombat(round,{kind:'perk',perk:'ricochet',at:now,shotId:shot.logId,text:`Ricochet: ${Math.max(0,before-enemy.health)} damage (${enemy.id}).`});
  if(changed&&!shot?.ricochet&&hasPerk(round,'ricochet'))bounceRicochet(weapon,round,enemy,rule,now,shot,obstacles);
  if(round.enemiesDefeated>kills){if(hasPerk(round,'chain'))perkState(round).chain=true;const refill=Math.min(rule.capacity-weapon.ammo,weapon.reserve,RULES.killReward.ammo);weapon.ammo+=refill;weapon.reserve-=refill;if(weapon.ammo===rule.capacity||weapon.reserve===0)weapon.reloadAt=null;}
  if(changed&&dir)knockEnemy(round,round.level.enemies.find(e=>e.id===hit.target.id),dir,rule,obstacles,now);
  return changed;
}
// Launch once from the struck enemy. Collision uses current positions on later frames.
function bounceRicochet(weapon,round,source,rule,now,shot,obstacles){
  if(!source)return;
  const target=round.level.enemies.filter(e=>e!==source&&e.health>0&&(e.active!==false||!e.swarm))
    .map(e=>({enemy:e,distance:Math.hypot(e.x-source.x,e.z-source.z)}))
    .filter(({enemy,distance})=>distance>.01&&distance<=PERKS.ricochetRange&&traceTargets(source,enemy,obstacles,[])?.kind!=='wall')
    .sort((a,b)=>a.distance-b.distance)[0];
  if(!target)return;
  weapon.projectiles.push({id:++weapon.nextId,logId:shot?.logId??shot?.id,
    x:source.x,z:source.z,origin:{x:source.x,z:source.z},
    dx:(target.enemy.x-source.x)/target.distance,dz:(target.enemy.z-source.z)/target.distance,
    remaining:PERKS.ricochetRange,ricochet:true,sourceId:source.id,aimAssisted:true,
    damageScale:(shot?.bonus?1+PERKS.chainBonus:1)*PERKS.ricochetDamage});
}
// Shotgun shove: a surviving enemy slides back along the shot, stopping at walls. Generators are fixed.
export function knockEnemy(round,enemy,dir,rule,obstacles,now){
  if(!enemy)return false;
  if(!(rule.knockback>0)||enemy.health<=0||enemy.type==='generator')return false;
  const len=Math.hypot(dir.x,dir.z);if(len<1e-9)return false;
  const next=movePlayer(enemy,{x:dir.x/len*rule.knockback,z:dir.z/len*rule.knockback},obstacles,round.level.floors,.48);
  enemy.x=next.x;enemy.z=next.z;enemy.knockedAt=now;enemy.knockSerial=(enemy.knockSerial??0)+1;return true;
}
// Light homing: a free-flying tracer bends toward the nearest living enemy inside a narrow forward cone (never past cover).
export function steerShot(b,enemies,obstacles,rule,dt){
  if(b.tap)return;
  const homing=b.movingAtFire?Math.min(rule.homingDegreesPerSecond,RULES.shooting.movingHomingDegreesPerSecond):rule.homingDegreesPerSecond;
  if(!(homing>0))return;
  let best=null,bestD=Infinity;const limit=Math.cos(rule.homingAngleDegrees*Math.PI/180);
  for(const e of enemies){
    if(e.health<=0||e.active===false)continue;
    const dx=e.x-b.x,dz=e.z-b.z,d=Math.hypot(dx,dz);
    if(d<.01||d>b.remaining||d>=bestD||(dx*b.dx+dz*b.dz)/d<limit)continue;
    if(traceTargets(b,e,obstacles,[])?.kind==='wall')continue;
    best=e;bestD=d;
  }
  if(!best)return;
  const cur=Math.atan2(b.dz,b.dx),want=Math.atan2(best.z-b.z,best.x-b.x);
  let diff=Math.atan2(Math.sin(want-cur),Math.cos(want-cur));const max=homing*Math.PI/180*dt;
  diff=Math.max(-max,Math.min(max,diff));b.dx=Math.cos(cur+diff);b.dz=Math.sin(cur+diff);
}
export function fireAimedWeapon(weapon,round,position,direction,now,obstacles,moving=false,tap=false){
  tickRound(round,now);if(round.over||round.pauseAt!=null)return null;
  const rule=weaponRule(weapon),targets=[...round.level.enemies,...round.level.nodes],assisted=tap
    ?{direction:tapDirection(position,direction,round.level.enemies,obstacles,rule),target:null,rejections:[]}
    :assistAim(position,direction,targets,obstacles,rule,moving);
  // Tap chooses only a launch direction; spread always applies, even with a target.
  let dir=assisted.direction;
  const spread=tap?Math.max(rule.spreadDegrees??0,RULES.shooting.tapMinSpreadDegrees)*RULES.shooting.tapSpreadMul:rule.spreadDegrees;
  if(!assisted.target&&spread>0){const a=(weapon.rand??Math.random)()*2-1,t=a*spread*Math.PI/180,c=Math.cos(t),s=Math.sin(t);dir={x:dir.x*c-dir.z*s,z:dir.x*s+dir.z*c};}
  const shot=fireWeapon(weapon,position,dir,now,round);if(!shot)return null;
  shot.logId=round.nextCombatShotId=(round.nextCombatShotId??0)+1;shot.movingAtFire=!!moving;shot.bonus=hasPerk(round,'chain')&&perkState(round).chain;if(shot.bonus)perkState(round).chain=false;
  logCombat(round,{kind:'shot',at:now,shotId:shot.logId??shot.id,moving:!!moving,rejections:assisted.rejections,target:assisted.target?.id??null});
  // Aim assist chooses the launch direction, never a promised hit. Collision is
  // swept only over each frame's travelled segment against current positions.
  shot.tap=!!tap;
  if(tap)shot.remaining*=RULES.shooting.tapRangeMul;
  shot.aimAssisted=!!assisted.target;
  if(rule.pellets>1)fanPellets(weapon,shot,rule,assisted.target?Math.hypot(assisted.target.x-position.x,assisted.target.z-position.z):shot.remaining);
  return shot;
}
// Visual-only pellets around the real shot; they never damage (resolved) so a shell still counts as one hit.
function fanPellets(weapon,shot,rule,remaining){
  const n=rule.pellets-1,half=Math.max(rule.spreadDegrees,6)*Math.PI/180,base=Math.atan2(shot.dz,shot.dx);
  for(let i=0;i<n;i++){
    const a=base+(n===1?half:(i/(n-1)*2-1)*half);
    weapon.projectiles.push({id:++weapon.nextId,x:shot.x,z:shot.z,dx:Math.cos(a),dz:Math.sin(a),remaining:Math.min(remaining,rule.range),resolved:true,pellet:true});
  }
}

// stats: per-weapon overrides of RULES.weapon (already clamped by readWeapon).
export function weaponRule(weapon){return weapon?.rule??RULES.weapon;}
export function createWeapon(totalAmmo=Infinity,stats=null){
  const rule={...RULES.weapon,...(stats||{})},ammo=Math.min(rule.capacity,totalAmmo);
  return {rule,id:stats?.id??'basic_carbine',ammo,reserve:totalAmmo-ammo,reloadAt:null,nextShotAt:0,nextId:0,projectiles:[]};
}
export function tickWeapon(weapon,now,round){
  if(round?.pauseAt!=null)return;
  const rule=weaponRule(weapon);
  while(weapon.reloadAt!==null && now>=weapon.reloadAt){
    if(weapon.reserve<=0){weapon.reloadAt=null;break;}
    audioEvent('reload',{weapon:weapon.id});
    weapon.ammo++;weapon.reserve--;if(hasPerk(round,'reload'))logCombat(round,{kind:'perk',at:now,perk:'reload',text:`Calm Reload: saved ${rule.reloadMs-reloadInterval(round,rule.reloadMs)} ms this reload.`});
    weapon.reloadAt=weapon.ammo<rule.capacity&&weapon.reserve>0?weapon.reloadAt+reloadInterval(round,rule.reloadMs):null;
  }
}
export function fireWeapon(weapon,position,direction,now,round){
  if(round?.pauseAt!=null)return null;
  tickWeapon(weapon,now,round);
  const rule=weaponRule(weapon),length=Math.hypot(direction.x,direction.z);
  if(!weapon.ammo&&now>=weapon.nextShotAt&&length>=.01)audioEvent('empty',{weapon:weapon.id});
  if(!weapon.ammo || now<weapon.nextShotAt || length<.01)return null;
  audioEvent('shoot',{weapon:weapon.id});
  weapon.scavenging=null;weapon.ammo--;weapon.nextShotAt=now+rule.shotIntervalMs;
  if(weapon.reloadAt===null&&weapon.reserve>0)weapon.reloadAt=now+reloadInterval(round,rule.reloadMs);
  const shot={origin:{x:position.x,z:position.z},id:++weapon.nextId,x:position.x,z:position.z,dx:direction.x/length,dz:direction.z/length,remaining:rule.range};
  weapon.projectiles.push(shot);return shot;
}
// Closest distance from point p to the segment a-b (clamped to the segment, not the infinite line).
function segmentPointDistance(a,b,p){
  const dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;
  const t=len2>1e-12?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/len2)):0;
  return Math.hypot(p.x-(a.x+dx*t),p.z-(a.z+dz*t));
}
export function stepWeapon(weapon,round,now,dt,obstacles){
  tickRound(round,now);
  if(round.over){weapon.projectiles.length=0;return false;}
  if(round.pauseAt!=null)return false;
  tickWeapon(weapon,now,round);let changed=false;
  for(let i=weapon.projectiles.length-1;i>=0;i--){
    const b=weapon.projectiles[i];
    const shotObstacles=playerShotObstacles(b.origin??b,obstacles);
    if(!b.resolved&&!b.aimAssisted&&!b.tap)steerShot(b,round.level.enemies,shotObstacles,weaponRule(weapon),dt);
    const distance=Math.min(b.remaining,weaponRule(weapon).bulletSpeed*dt);
    const end={x:b.x+b.dx*distance,z:b.z+b.dz*distance};
    const hit=b.resolved?null:weaponHit(b,end,shotObstacles,[...round.level.nodes,...round.level.enemies].filter(t=>t.id!==b.sourceId),weaponRule(weapon));
    // A shot that whizzes close by but does not connect still gives away the shooter: an idle/patrolling
    // enemy that was not yet aggro reacts to the near miss, same as being hit (combat.js reads nearMissAt).
    // Wait until it passes the enemy; an approaching hit must keep its unaware bonus.
    if(!b.resolved&&!hit)for(const e of round.level.enemies)if(!e.aggro&&e.health>0&&(e.x-end.x)*b.dx+(e.z-end.z)*b.dz<=0&&segmentPointDistance(b,end,e)<=weaponRule(weapon).nearMissRadius&&traceTargets(b,e,obstacles,[e])?.kind!=='wall')alertEnemy(e,now);
    b.remaining=Math.max(0,b.remaining-distance);
    if(hit || b.remaining===0){
      const contact=hit&&round.feedback?shotContact(b,end,hit,shotObstacles):null;
      const applied=applyWeaponHit(weapon,round,hit,now,{x:b.dx,z:b.dz},obstacles,b.resolved?null:b);
      if(contact)round.feedback.impact(contact.x,contact.z,hit.kind==='enemy'&&applied);
      changed=applied||changed;
      weapon.projectiles.splice(i,1);
    }else{b.x=end.x;b.z=end.z;}
  }
  return changed;
}

function recordShot(round,shot,now,outcome,target=null){if(shot.ricochet||shot.outcomeRecorded)return;shot.outcomeRecorded=true;logCombat(round,{kind:'outcome',at:now,shotId:shot.logId??shot.id,moving:!!shot.movingAtFire,outcome,target});if(shot.bonus&&outcome==='miss')logCombat(round,{kind:'perk',perk:'chain',at:now,shotId:shot.logId??shot.id,text:'Chain Reaction: charged shot missed; 0 extra damage.'});}

// Tap shots search the entire circle rather than the moving/manual assist window.
export function tapTarget(position,enemies,obstacles,rule=RULES.weapon){
  return assistAim(position,{x:1,z:0},enemies,obstacles,{...rule,assistAngleDegrees:180,assistWidth:Infinity},false).target;
}

export function tapDirection(position,facing,enemies,obstacles,rule=RULES.weapon){
  const target=tapTarget(position,enemies,obstacles,rule);
  const dx=target?target.x-position.x:facing.x,dz=target?target.z-position.z:facing.z,length=Math.hypot(dx,dz)||1;
  return {x:dx/length,z:dz/length};
}
