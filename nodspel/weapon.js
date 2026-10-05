import {RULES} from './levels.js?v=1.4.0';
import {traceTargets} from './physics.mjs?v=1.4.0';
import {activateNode,hitEnemy,tickRound} from './round.js?v=1.4.0';

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
    const hit=traceTargets(b,end,obstacles,[...round.level.nodes,...round.level.enemies.filter(e=>e.health>0)]);
    b.remaining=Math.max(0,b.remaining-distance);
    if(hit || b.remaining===0){
      if(hit?.kind==='node')changed=activateNode(round,hit.node.id,now)||changed;
      if(hit?.kind==='enemy')changed=hitEnemy(round,hit.target.id,now,RULES.weapon.damage)||changed;
      weapon.projectiles.splice(i,1);
    }else{b.x=end.x;b.z=end.z;}
  }
  return changed;
}
