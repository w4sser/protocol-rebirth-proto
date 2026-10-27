import {ownRooms} from './perks.js?v=2.4.1';
import {RULES,hazardState} from './levels.js?v=2.4.1';
import {traceTargets,movePlayer,moveWithActors} from './physics.mjs?v=2.4.1';
import {takeDamage,tickRound} from './round.js?v=2.4.1';
import {houseWaypoint} from './house.js?v=2.4.1';
import {angleDiff,angleTo,turnToward,encounterDamage,inSightCone,sightRange} from './encounters.js?v=2.4.1';

export function createCombat(level,now){
  ownRooms(level);
  const initial=level.rooms.findIndex(r=>Math.abs(level.start.x-r.x)<=r.w/2&&Math.abs(level.start.z-r.z)<=r.d/2);
  const grace=level.firstGraceMs??RULES.combat.graceMs;
  return {visited:new Set([initial]),graceUntil:now+grace,projectiles:[],blasts:[],nextId:0,moveAt:now+grace,nextFire:new Map(level.enemies.map((e,i)=>[e.id,now+grace+i*250]))};
}
export function stepCombat(round,combat,player,now,dt,obstacles){
  tickRound(round,now);if(round.pauseAt!=null||round.over)return;
  const room=round.level.rooms.findIndex(r=>Math.abs(player.x-r.x)<=r.w/2&&Math.abs(player.z-r.z)<=r.d/2);
  if(room>=0&&!combat.visited.has(room)){
    combat.visited.add(room);combat.graceUntil=now+RULES.combat.graceMs;combat.projectiles.length=0;combat.moveAt=combat.graceUntil;
    for(const enemy of round.level.enemies)combat.nextFire.set(enemy.id,Math.max(combat.nextFire.get(enemy.id)??0,combat.graceUntil));
  }
  const playerBefore={x:player.x,z:player.z};
  Object.assign(player,moveWithActors(player,{x:0,z:0},round.level.enemies,obstacles,round.level.floors,RULES.playerRadius));
  round.playerMoving=!!round.playerMoving||Math.hypot(player.x-playerBefore.x,player.z-playerBefore.z)>RULES.shooting.movementEpsilon;
  // Encounters that run on their own clock: patrols keep walking and spawn points keep counting through the arrival grace.
  stepPatrolWalk(round,player,now,dt,obstacles);
  stepSpawners(round,combat,player,now);
  stepBlasts(round,combat,player,now);
  if(now<combat.graceUntil&&!round.level.enemies.some(e=>e.aggro&&e.nearMissAt!=null))return;
  const rule=RULES.combat,target={...player,r:.36,kind:'player'};
  for(const enemy of round.level.enemies){
    if(now<combat.graceUntil&&enemy.nearMissAt==null)continue;
    if(enemy.active===false||enemy.type==='generator'||(enemy.nearMissAt==null&&now<(enemy.spawnedAt??-Infinity)+(enemy.graceMs??rule.graceMs)))continue;
    if(enemy.attackWakeAt!=null){combat.nextFire.set(enemy.id,Math.min(combat.nextFire.get(enemy.id)??now,now));enemy.attackWakeAt=null;}
    // EMP: a stunned enemy neither moves nor fires; its wind-up and salvo are cancelled (a fresh telegraph follows).
    if(now<(enemy.stunnedUntil??0)){enemy.windupAt=null;enemy.attackPhase=null;enemy.alertAt=null;continue;}
    // Decoy: a lured mover heads for the lure instead of the player and holds fire until it ends.
    if(enemy.lureTarget&&enemy.speed>0&&now<(enemy.lureUntil??Infinity)){
      enemy.windupAt=null;enemy.attackPhase=null;enemy.alertAt=null;
      const lx=enemy.lureTarget.x-enemy.x,lz=enemy.lureTarget.z-enemy.z,ld=Math.hypot(lx,lz);
      if(enemy.health>0&&ld>RULES.tools.lureStopDistance&&now>=combat.moveAt){
        stepEnemy(round,enemy,{x:enemy.lureTarget.x,z:enemy.lureTarget.z},ld,obstacles,player,dt);
        if(enemy.facing!==undefined)enemy.facing=turnToward(enemy.facing,angleTo(enemy,enemy.lureTarget),6*dt);
      }
      continue;
    }
    // Patrol: unaware until the sight cone catches the player (a 1 s "!" first) or it is shot.
    if(enemy.patrol&&!enemy.introGuard&&!enemy.aggro&&enemy.health>0)patrolSight(round,enemy,player,now,obstacles,target);
    // Detection: stealth shrinks the range at which an enemy notices you. Once noticed (or shot) it stays aggro.
    const seen=!enemy.patrol&&Math.hypot(player.x-enemy.x,player.z-enemy.z)<=rule.detectRange*(1-(round.stats?.stealth??0));
    if(seen||enemy.lastHitAt!=null||enemy.nearMissAt!=null)enemy.aggro=true;
    if(!enemy.aggro){enemy.windupAt=null;continue;}
    if(enemy.introGuard||enemy.encounter==='guard'||enemy.encounter==='turret'){stepGuard(round,enemy,combat,player,now,dt,obstacles,target);continue;}
    if(enemy.patrol&&enemy.health>0)enemy.facing=angleTo(enemy,player);
    if(enemy.health>0 && enemy.speed && (now>=combat.moveAt||enemy.nearMissAt!=null)){
      const distance=Math.hypot(player.x-enemy.x,player.z-enemy.z);
      // through the house doorway when the player is on the other side of the shell
      const way=houseWaypoint(round.level.house,enemy,player)??(enemy.swarm?doorwayWaypoint(round.level,enemy,player):null),goal=way??player,gd=Math.hypot(goal.x-enemy.x,goal.z-enemy.z);
      if(gd>1e-6&&(way||distance>(enemy.standoff??rule.standoff)) && (distance<14||enemy.swarm)){
        stepEnemy(round,enemy,goal,gd,obstacles,player,dt);
      }
    }
    if(enemy.health<=0 || now<combat.nextFire.get(enemy.id))continue;
    const distance=Math.hypot(player.x-enemy.x,player.z-enemy.z);
    if(distance<.1 || distance>rule.range*(enemy.rangeMul??1)){enemy.windupAt=null;continue;}
    const cover=[...obstacles,...round.level.enemies.filter(e=>e!==enemy&&e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,w:.75,d:.75}))];
    if(traceTargets(enemy,player,cover,[target])?.kind!=='player'){enemy.windupAt=null;continue;}
    // Telegraph: a visible wind-up precedes each shot when the level (or the encounter) asks for one.
    const windup=enemy.windupMs??round.level.enemyWindupMs??0;
    if(windup>0){
      // Thrower: the landing spot is fixed when the warning starts (a coral ring is drawn there), so walking out of it is the dodge.
      if(enemy.windupAt==null&&enemy.type==='thrower')enemy.attackTarget={x:player.x,z:player.z};
      enemy.windupAt??=now+windup;if(now<enemy.windupAt)continue;enemy.windupAt=null;}
    if(enemy.type==='thrower'){lobGrenade(round,combat,enemy,now);continue;}
    const dx=(player.x-enemy.x)/distance,dz=(player.z-enemy.z)/distance;
    combat.projectiles.push({id:++combat.nextId,x:enemy.x+dx*.65,z:enemy.z+dz*.65,dx,dz,life:2,...shotInfo(round,enemy)});
    combat.nextFire.set(enemy.id,now+(enemy.cooldownMs??round.level.enemyCooldownMs??rule.cooldownMs)*(enemy.cooldownMul??1));
  }
  for(let i=combat.projectiles.length-1;i>=0;i--){
    const b=combat.projectiles[i];if(now<(b.releaseAt??0))continue;
    const end={x:b.x+b.dx*rule.bulletSpeed*dt,z:b.z+b.dz*rule.bulletSpeed*dt};
    const hit=traceTargets(b,end,obstacles,[target]);b.life-=dt;
    if(hit||b.life<=0){if(hit?.kind==='player'){round.lastHit={source:b.source??'Enemy',enemyId:b.enemyId,attack:b.attack??'projectile',at:now};takeDamage(round,b.damage??round.level.enemyDamage??rule.damage,now);}combat.projectiles.splice(i,1);}
    else{b.x=end.x;b.z=end.z;}
  }
}

// Grenade thrower: after its warning it lobs a blast onto the ringed spot; it detonates fuseMs later (stepBlasts).
// A thrower killed during the warning never lobs; a blast already in the air still lands (leave the ring).
function lobGrenade(round,combat,enemy,now){
  const G=RULES.encounters.grenadier,at=enemy.attackTarget;enemy.attackTarget=null;
  if(at)combat.blasts.push({id:++combat.nextId,x:at.x,z:at.z,radius:G.radius,at:now,detonateAt:now+G.fuseMs,source:enemy.encounter??enemy.type??'thrower',enemyId:enemy.id});
  combat.nextFire.set(enemy.id,now+G.cooldownMs);
}
function stepBlasts(round,combat,player,now){
  for(let i=combat.blasts.length-1;i>=0;i--){
    const b=combat.blasts[i];if(now<b.detonateAt)continue;
    combat.blasts.splice(i,1);
    if(Math.hypot(player.x-b.x,player.z-b.z)<=b.radius){round.lastHit={source:b.source,enemyId:b.enemyId,attack:'grenade',at:now};takeDamage(round,encounterDamage(round,'grenadier'),now);}
    (combat.booms??=[]).push({x:b.x,z:b.z,radius:b.radius,at:now});
  }
  if(combat.booms)combat.booms=combat.booms.filter(b=>now-b.at<600);
}

// Encounter shots carry their source (for the result-screen tip) and a damage capped at maxHitFraction of max HP.
function shotInfo(round,enemy){return {source:enemy.introGuard?'Cache guard':enemy.encounter??enemy.type??'grunt',enemyId:enemy.id,attack:enemy.encounter==='turret'?'fan':'projectile',...(enemy.encounter&&RULES.encounters[enemy.encounter]?.damagePct?{damage:encounterDamage(round,enemy.encounter)}:{})};}

// Swarm rushers chase in a straight line, which wedges them on a doorway's corner. When the player is in another
// room or in a corridor they first head for the doorway that is closest to the player, then through it; in a
// corridor (straight) or in the same room they simply go for the player, so a corridor makes them queue up.
function doorwayWaypoint(level,enemy,player){
  const inRoom=p=>level.rooms.findIndex(r=>Math.abs(p.x-r.x)<=r.w/2&&Math.abs(p.z-r.z)<=r.d/2);
  const here=inRoom(enemy);if(here<0||here===inRoom(player))return null;
  const room=level.rooms[here];let best=null,bd=Infinity;
  for(const d of room.doors){const mouth={x:room.x+d.x*room.w/2,z:room.z+d.z*room.d/2},k=Math.hypot(player.x-mouth.x,player.z-mouth.z);if(k<bd){bd=k;best=mouth;best.out={x:mouth.x+d.x*.9,z:mouth.z+d.z*.9};}}
  if(!best)return null;
  return Math.hypot(enemy.x-best.x,enemy.z-best.z)<1.1?best.out:best;
}

// One movement step towards `goal` (gd = distance), blocked by walls, the player and other enemies.
function stepEnemy(round,enemy,goal,gd,obstacles,player,dt){
  const blockers=[...obstacles,{...player,r:RULES.playerRadius},...round.level.enemies.filter(e=>e!==enemy&&e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,r:e.r??.48}))];
  const step=Math.min(gd,enemy.speed*dt),dx=(goal.x-enemy.x)/gd*step,dz=(goal.z-enemy.z)/gd*step;
  let next=movePlayer(enemy,{x:dx,z:dz},blockers,round.level.floors,.48);
  // Swarm rushers that get wedged on a pedestal / corner step round it (keeping the side they chose) instead of grinding in place.
  // The sidestep is committed for a moment, otherwise the next normal step just slides them back onto the corner.
  if(enemy.swarm){
    const sidestep=side=>movePlayer(enemy,{x:-dz*side+dx*.3,z:dx*side+dz*.3},blockers,round.level.floors,.48);
    if((enemy.slideLeft??0)>0){enemy.slideLeft-=dt;next=sidestep(enemy.slide);}
    else if(Math.hypot(next.x-enemy.x,next.z-enemy.z)<step*.3){
      enemy.slide??=1;
      for(const side of [enemy.slide,-enemy.slide]){const alt=sidestep(side);
        if(Math.hypot(alt.x-enemy.x,alt.z-enemy.z)>=step*.3){next=alt;enemy.slide=side;enemy.slideLeft=.4;break;}}
    }
  }
  enemy.x=next.x;enemy.z=next.z;
}
// Stationary shooter: intro guard (RULES.intro), Core guard and turret (RULES.encounters.*). A visible warning line,
// then a committed salvo, then a recovery window. Encounter guards also turn slowly towards the player and only
// start a warning when the player is inside their fire arc, so walking round behind them is safe.
export function guardShotDirections(enemy){
  if(enemy.encounter==='turret'&&!enemy.introGuard)return enemy.attackDirections??[];
  if(!enemy.attackTarget)return [];
  const dx=enemy.attackTarget.x-enemy.x,dz=enemy.attackTarget.z-enemy.z,d=Math.hypot(dx,dz)||1;
  return [{x:dx/d,z:dz/d}];
}
function stepGuard(round,enemy,combat,player,now,dt,obstacles,target){
  if(enemy.health<=0){enemy.attackPhase=null;enemy.windupAt=null;return;}
  const intro=!!enemy.introGuard,cfg=intro?RULES.intro:RULES.encounters[enemy.encounter];
  if(!intro)enemy.facing=turnToward(enemy.facing??angleTo(enemy,player),angleTo(enemy,player),cfg.turnRadPerSec*dt);
  if(enemy.attackPhase==='recovery'&&now<enemy.recoverUntil)return;
  if(enemy.attackPhase==='recovery'){enemy.attackPhase=null;enemy.attackTarget=null;}
  if(!enemy.attackPhase){
    if(now<(combat.nextFire.get(enemy.id)??0)||Math.hypot(player.x-enemy.x,player.z-enemy.z)>RULES.combat.range*(enemy.rangeMul??1))return;
    if(!intro&&angleDiff(enemy.facing,angleTo(enemy,player))>cfg.fireHalfAngleDeg*Math.PI/180)return;
    if(traceTargets(enemy,player,obstacles,[target])?.kind!=='player')return;
    enemy.attackTarget={x:player.x,z:player.z};enemy.attackPhase='warning';enemy.windupAt=now+cfg.warningMs;
    if(enemy.encounter==='turret'&&!intro){
      const heading=Math.atan2(player.z-enemy.z,player.x-enemy.x);
      enemy.attackDirections=RULES.shooting.turretFanDegrees.map(degrees=>{
        const angle=heading+degrees*Math.PI/180;return {x:Math.cos(angle),z:Math.sin(angle)};
      });
    }
  }
  const hit=enemy.lastHitAt!=null&&enemy.hitSerial!==(enemy.reactedHitSerial??0);
  enemy.reactedHitSerial=enemy.hitSerial??0;
  if(enemy.attackPhase==='warning'&&(now>=enemy.windupAt||cfg.counterOnHit&&hit)){
    enemy.attackPhase='burst';enemy.burstEndsAt=now+(cfg.burstShots-1)*cfg.burstIntervalMs;enemy.windupAt=null;
    const directions=guardShotDirections(enemy);
    // The committed salvo is independent of the shooter. Cover traces its whole
    // path; rapid stationary fire cannot erase already committed bullets.
    const info=shotInfo(round,enemy);
    for(let i=0;i<cfg.burstShots;i++){
      const dir=directions[i%directions.length];
      combat.projectiles.push({id:++combat.nextId,x:enemy.x,z:enemy.z,dx:dir.x,dz:dir.z,releaseAt:now+i*cfg.burstIntervalMs,life:RULES.combat.range*(enemy.rangeMul??1)/RULES.combat.bulletSpeed,...info});
    }
  }
  if(enemy.attackPhase==='burst'&&now>=enemy.burstEndsAt){enemy.attackPhase='recovery';enemy.recoverUntil=now+cfg.recoveryMs;combat.nextFire.set(enemy.id,enemy.recoverUntil);}
}

// ---- patrol: fixed loop, visible sight cone ----
function stepPatrolWalk(round,player,now,dt,obstacles){
  for(const e of round.level.enemies){
    const P=e.patrol;if(!P||e.introGuard||e.active===false||e.health<=0||e.aggro||e.alertAt!=null)continue;
    e.sight=sightRange(round);
    if(now<(e.stunnedUntil??0)||(e.lureTarget&&e.speed>0&&now<(e.lureUntil??Infinity)))continue;
    const R=RULES.encounters.patrol,goal=P.points[P.i%P.points.length],gd=Math.hypot(goal.x-e.x,goal.z-e.z);
    if(now<(e.pauseUntil??0)){e.facing=turnToward(e.facing??0,angleTo(e,goal),P.turn*dt);continue;}
    if(gd<.12){P.i=(P.i+1)%P.points.length;e.pauseUntil=now+R.pauseMs;continue;}
    const heading=angleTo(e,goal);e.facing=turnToward(e.facing??heading,heading,P.turn*dt);
    if(angleDiff(e.facing,heading)>.35)continue;
    const blockers=[...obstacles,{...player,r:RULES.playerRadius},...round.level.enemies.filter(o=>o!==e&&o.health>0&&o.active!==false).map(o=>({x:o.x,z:o.z,r:o.r??.48}))];
    const step=Math.min(gd,P.speed*dt),next=movePlayer(e,{x:(goal.x-e.x)/gd*step,z:(goal.z-e.z)/gd*step},blockers,round.level.floors,.48);
    e.x=next.x;e.z=next.z;
  }
}
// Seen = player inside the cone (range shrinks with stealth) with a clear line, or right behind the patrol (bump radius).
// Being seen starts a 1 s "!" (alertAt); when it runs out the patrol goes aggro. A shot patrol is aggro at once (see stepCombat).
function patrolSight(round,enemy,player,now,obstacles,target){
  const R=RULES.encounters.patrol,range=enemy.sight=sightRange(round),stealth=round.stats?.stealth??0;
  if(enemy.alertAt!=null){if(now>=enemy.alertAt){enemy.aggro=true;enemy.alertAt=null;}return;}
  const d=Math.hypot(player.x-enemy.x,player.z-enemy.z);
  const inView=inSightCone(enemy,player,range,R.coneHalfAngleDeg)||d<=R.bumpRadius*(1-stealth);
  if(inView&&traceTargets(enemy,player,obstacles,[target])?.kind==='player'){enemy.alertAt=now+R.alertMs;}
}

// ---- swarm: a spawn point arms, warns for 1 s, then releases its rushers together ----
function stepSpawners(round,combat,player,now){
  for(const sp of round.level.spawners??[]){
    if(sp.state==='armed'){if(Math.hypot(player.x-sp.x,player.z-sp.z)<=sp.trigger){sp.state='warning';sp.spawnAt=now+sp.warnMs;}continue;}
    if(sp.state!=='warning'||now<sp.spawnAt)continue;
    sp.state='spawned';
    for(const e of round.level.enemies)if(e.swarm===sp.id&&e.health>0){e.active=true;e.aggro=true;e.spawnedAt=now;combat.nextFire.set(e.id,now+sp.emergeMs);}
  }
}

// Shock pads damage the player while 'on'. Returns true when damage was dealt.
export function stepHazards(round,player,now,dt){
  tickRound(round,now);if(round.pauseAt!=null||round.over||!round.level.hazards?.length)return false;
  for(const h of round.level.hazards){
    if(hazardState(h,now)!=='on')continue;
    if(Math.abs(player.x-h.x)<=h.w/2&&Math.abs(player.z-h.z)<=h.d/2){
      h.carry=(h.carry??0)+(h.dps??RULES.hazard.damagePerSecond)*dt;
      if(h.carry>=1){const dmg=Math.floor(h.carry);h.carry-=dmg;round.lastHit={source:'Shock pad',sourceId:h.id,attack:'electric hazard',at:now};return takeDamage(round,dmg,now);}
    }
  }
  return false;
}
