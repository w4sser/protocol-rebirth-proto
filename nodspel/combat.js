import {RULES,hazardState} from './levels.js?v=1.55.0';
import {traceTargets,movePlayer,moveWithActors} from './physics.mjs?v=1.55.0';
import {takeDamage,tickRound} from './round.js?v=1.55.0';
import {houseWaypoint} from './house.js?v=1.55.0';

export function createCombat(level,now){
  const initial=level.rooms.findIndex(r=>Math.abs(level.start.x-r.x)<=r.w/2&&Math.abs(level.start.z-r.z)<=r.d/2);
  const grace=level.firstGraceMs??RULES.combat.graceMs;
  return {visited:new Set([initial]),graceUntil:now+grace,projectiles:[],nextId:0,moveAt:now+grace,nextFire:new Map(level.enemies.map((e,i)=>[e.id,now+grace+i*250]))};
}
export function stepCombat(round,combat,player,now,dt,obstacles){
  tickRound(round,now);if(round.over)return;
  const room=round.level.rooms.findIndex(r=>Math.abs(player.x-r.x)<=r.w/2&&Math.abs(player.z-r.z)<=r.d/2);
  if(room>=0&&!combat.visited.has(room)){
    combat.visited.add(room);combat.graceUntil=now+RULES.combat.graceMs;combat.projectiles.length=0;combat.moveAt=combat.graceUntil;
    for(const enemy of round.level.enemies)combat.nextFire.set(enemy.id,Math.max(combat.nextFire.get(enemy.id)??0,combat.graceUntil));
  }
  Object.assign(player,moveWithActors(player,{x:0,z:0},round.level.enemies,obstacles,round.level.floors,RULES.playerRadius));
  if(now<combat.graceUntil)return;
  const rule=RULES.combat,target={...player,r:.36,kind:'player'};
  for(const enemy of round.level.enemies){
    if(enemy.active===false||now<(enemy.spawnedAt??-Infinity)+rule.graceMs)continue;
    // Detection: stealth shrinks the range at which an enemy notices you. Once noticed (or shot) it stays aggro.
    const seen=Math.hypot(player.x-enemy.x,player.z-enemy.z)<=rule.detectRange*(1-(round.stats?.stealth??0));
    if(seen||enemy.lastHitAt!=null)enemy.aggro=true;
    if(!enemy.aggro){enemy.windupAt=null;continue;}
    if(enemy.health>0 && enemy.speed && now>=combat.moveAt){
      const distance=Math.hypot(player.x-enemy.x,player.z-enemy.z);
      // through the house doorway when the player is on the other side of the shell
      const way=houseWaypoint(round.level.house,enemy,player),goal=way??player,gd=Math.hypot(goal.x-enemy.x,goal.z-enemy.z);
      if(gd>1e-6&&(way||distance>(enemy.standoff??rule.standoff)) && distance<14){
        const blockers=[...obstacles,{...player,r:RULES.playerRadius},...round.level.enemies.filter(e=>e!==enemy&&e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,r:e.r??.48}))];
        const next=movePlayer(enemy,{x:(goal.x-enemy.x)/gd*Math.min(gd,enemy.speed*dt),z:(goal.z-enemy.z)/gd*Math.min(gd,enemy.speed*dt)},blockers,round.level.floors,.48);
        enemy.x=next.x;enemy.z=next.z;
      }
    }
    if(enemy.health<=0 || now<combat.nextFire.get(enemy.id))continue;
    const distance=Math.hypot(player.x-enemy.x,player.z-enemy.z);
    if(distance<.1 || distance>rule.range*(enemy.rangeMul??1)){enemy.windupAt=null;continue;}
    const cover=[...obstacles,...round.level.enemies.filter(e=>e!==enemy&&e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,w:.75,d:.75}))];
    if(traceTargets(enemy,player,cover,[target])?.kind!=='player'){enemy.windupAt=null;continue;}
    // Telegraph: a visible wind-up precedes each shot when the level asks for one.
    const windup=round.level.enemyWindupMs??0;
    if(windup>0){enemy.windupAt??=now+windup;if(now<enemy.windupAt)continue;enemy.windupAt=null;}
    const dx=(player.x-enemy.x)/distance,dz=(player.z-enemy.z)/distance;
    combat.projectiles.push({id:++combat.nextId,x:enemy.x+dx*.65,z:enemy.z+dz*.65,dx,dz,life:2});
    combat.nextFire.set(enemy.id,now+(round.level.enemyCooldownMs??rule.cooldownMs)*(enemy.cooldownMul??1));
  }
  for(let i=combat.projectiles.length-1;i>=0;i--){
    const b=combat.projectiles[i],end={x:b.x+b.dx*rule.bulletSpeed*dt,z:b.z+b.dz*rule.bulletSpeed*dt};
    const hit=traceTargets(b,end,obstacles,[target]);b.life-=dt;
    if(hit||b.life<=0){if(hit?.kind==='player')takeDamage(round,round.level.enemyDamage??rule.damage,now);combat.projectiles.splice(i,1);}
    else{b.x=end.x;b.z=end.z;}
  }
}

// Shock pads damage the player while 'on'. Returns true when damage was dealt.
export function stepHazards(round,player,now,dt){
  tickRound(round,now);if(round.over||!round.level.hazards?.length)return false;
  for(const h of round.level.hazards){
    if(hazardState(h,now)!=='on')continue;
    if(Math.abs(player.x-h.x)<=h.w/2&&Math.abs(player.z-h.z)<=h.d/2){
      h.carry=(h.carry??0)+(h.dps??RULES.hazard.damagePerSecond)*dt;
      if(h.carry>=1){const dmg=Math.floor(h.carry);h.carry-=dmg;return takeDamage(round,dmg,now);}
    }
  }
  return false;
}
