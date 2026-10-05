import {RULES} from './levels.js?v=1.5.0';
import {traceTargets} from './physics.mjs?v=1.5.0';
import {activateNode,hitEnemy,tickRound} from './round.js?v=1.5.0';

export function assistAim(position,direction,enemies,obstacles){
  const rule=RULES.weapon,length=Math.hypot(direction.x,direction.z);
  const raw={x:direction.x/length,z:direction.z/length};let target=null,nearest=Infinity;
  for(const enemy of enemies){
    if(enemy.health<=0)continue;
    const dx=enemy.x-position.x,dz=enemy.z-position.z,distance=Math.hypot(dx,dz);
    if(distance<.01||distance>rule.range||distance>=nearest)continue;
    const dot=(dx*raw.x+dz*raw.z)/distance,side=Math.abs(dx*raw.z-dz*raw.x);
    if(dot<Math.cos(rule.assistAngleDegrees*Math.PI/180)||side>rule.assistWidth)continue;
    if(traceTargets(position,enemy,obstacles,[enemy])?.kind!=='enemy')continue;
    target=enemy;nearest=distance;
  }
  if(!target)return {target:null,direction:raw};
  const s=rule.assistStrength,x=raw.x*(1-s)+(target.x-position.x)/nearest*s,z=raw.z*(1-s)+(target.z-position.z)/nearest*s,l=Math.hypot(x,z);
  return {target,direction:{x:x/l,z:z/l}};
}

export function createWeapon(){
  return {ammo:RULES.weapon.capacity,reloadAt:null,nextShotAt:0,nextId:0,projectiles:[]};
}
export function tickWeapon(weapon,now){
  const rule=RULES.weapon;
  while(weapon.reloadAt!==null && now>=weapon.reloadAt){
    weapon.ammo++;
    weapon.reloadAt=weapon.ammo<rule.capacity?weapon.reloadAt+rule.reloadMs:null;
  }
}
export function fireWeapon(weapon,position,direction,now){
  tickWeapon(weapon,now);
  const rule=RULES.weapon,length=Math.hypot(direction.x,direction.z);
  if(!weapon.ammo || now<weapon.nextShotAt || length<.01)return null;
  weapon.ammo--;weapon.nextShotAt=now+rule.shotIntervalMs;
  if(weapon.reloadAt===null)weapon.reloadAt=now+rule.reloadMs;
  const shot={id:++weapon.nextId,x:position.x,z:position.z,dx:direction.x/length,dz:direction.z/length,remaining:rule.range};
  weapon.projectiles.push(shot);return shot;
}
export function stepWeapon(weapon,round,now,dt,obstacles){
  tickRound(round,now);
  if(round.over){weapon.projectiles.length=0;return false;}
  tickWeapon(weapon,now);let changed=false;
  for(let i=weapon.projectiles.length-1;i>=0;i--){
    const b=weapon.projectiles[i],distance=Math.min(b.remaining,RULES.weapon.bulletSpeed*dt);
    const end={x:b.x+b.dx*distance,z:b.z+b.dz*distance};
    const radius=RULES.weapon.shotRadius;
    const targets=[...round.level.nodes,...round.level.enemies.filter(e=>e.health>0)].filter(t=>traceTargets(b,t,obstacles,[t])?.kind!=='wall').map(t=>({...t,r:t.r+radius}));
    const hit=traceTargets(b,end,obstacles.map(o=>({...o,w:o.w+radius*2,d:o.d+radius*2})),targets);
    b.remaining=Math.max(0,b.remaining-distance);
    if(hit || b.remaining===0){
      if(hit?.kind==='node')changed=activateNode(round,hit.node.id,now)||changed;
      if(hit?.kind==='enemy')changed=hitEnemy(round,hit.target.id,now,RULES.weapon.damage)||changed;
      weapon.projectiles.splice(i,1);
    }else{b.x=end.x;b.z=end.z;}
  }
  return changed;
}
