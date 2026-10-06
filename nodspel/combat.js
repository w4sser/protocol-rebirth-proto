import {RULES} from './levels.js?v=1.8.0';
import {traceTargets,movePlayer} from './physics.mjs';
import {takeDamage,tickRound} from './round.js';

export function createCombat(level,now){
  const initial=level.rooms.findIndex(r=>Math.abs(level.start.x-r.x)<=r.w/2&&Math.abs(level.start.z-r.z)<=r.d/2);
  return {visited:new Set([initial]),graceUntil:now+RULES.combat.graceMs,projectiles:[],nextId:0,moveAt:now+RULES.combat.graceMs,nextFire:new Map(level.enemies.map((e,i)=>[e.id,now+RULES.combat.graceMs+i*250]))};
}
export function stepCombat(round,combat,player,now,dt,obstacles){
  tickRound(round,now);if(round.over)return;
  const room=round.level.rooms.findIndex(r=>Math.abs(player.x-r.x)<=r.w/2&&Math.abs(player.z-r.z)<=r.d/2);
  if(room>=0&&!combat.visited.has(room)){
    combat.visited.add(room);combat.graceUntil=now+RULES.combat.graceMs;combat.projectiles.length=0;combat.moveAt=combat.graceUntil;
    for(const enemy of round.level.enemies)combat.nextFire.set(enemy.id,Math.max(combat.nextFire.get(enemy.id)??0,combat.graceUntil));
  }
  if(now<combat.graceUntil)return;
  const rule=RULES.combat,target={...player,r:.36,kind:'player'};
  for(const enemy of round.level.enemies){
    if(enemy.active===false||now<(enemy.spawnedAt??-Infinity)+rule.graceMs)continue;
    if(enemy.health>0 && enemy.speed && now>=combat.moveAt){
      const distance=Math.hypot(player.x-enemy.x,player.z-enemy.z);
      if(distance>2 && distance<14){
        const blockers=[...obstacles,{...player,w:.8,d:.8},...round.level.enemies.filter(e=>e!==enemy&&e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,w:.9,d:.9}))];
        const next=movePlayer(enemy,{x:(player.x-enemy.x)/distance*enemy.speed*dt,z:(player.z-enemy.z)/distance*enemy.speed*dt},blockers,round.level.floors,.48);
        enemy.x=next.x;enemy.z=next.z;
      }
    }
    if(enemy.health<=0 || now<combat.nextFire.get(enemy.id))continue;
    const distance=Math.hypot(player.x-enemy.x,player.z-enemy.z);
    if(distance<.1 || distance>rule.range)continue;
    const cover=[...obstacles,...round.level.enemies.filter(e=>e!==enemy&&e.health>0&&e.active!==false).map(e=>({x:e.x,z:e.z,w:.75,d:.75}))];
    if(traceTargets(enemy,player,cover,[target])?.kind!=='player')continue;
    const dx=(player.x-enemy.x)/distance,dz=(player.z-enemy.z)/distance;
    combat.projectiles.push({id:++combat.nextId,x:enemy.x+dx*.65,z:enemy.z+dz*.65,dx,dz,life:2});
    combat.nextFire.set(enemy.id,now+(round.level.enemyCooldownMs??rule.cooldownMs));
  }
  for(let i=combat.projectiles.length-1;i>=0;i--){
    const b=combat.projectiles[i],end={x:b.x+b.dx*rule.bulletSpeed*dt,z:b.z+b.dz*rule.bulletSpeed*dt};
    const hit=traceTargets(b,end,obstacles,[target]);b.life-=dt;
    if(hit||b.life<=0){if(hit?.kind==='player')takeDamage(round,rule.damage,now);combat.projectiles.splice(i,1);}
    else{b.x=end.x;b.z=end.z;}
  }
}
