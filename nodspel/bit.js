import {hasPerk,PERKS,logCombat} from './perks.js?v=2.4.1';
import {RULES} from './levels.js?v=2.4.1';
import {movePlayer} from './physics.mjs?v=2.4.1';
import {heal} from './stakes.js?v=2.4.1';
export function createBIT(position){return {...position,lastPlayer:{...position},trail:[],healing:false,healCarry:0};}
export function stepBIT(bit,round,position,dt,moving,solids,floors){
  if(round.pauseAt!=null){bit.healing=false;return false;}
  const moved=Math.hypot(position.x-bit.lastPlayer.x,position.z-bit.lastPlayer.z)>.001;
  if(moved){bit.trail.push({...position});bit.lastPlayer={...position};}
  let pathLength=0,previous=bit;
  for(const point of bit.trail){pathLength+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;}
  let travel=Math.min(RULES.bit.followSpeed*Math.max(0,dt),Math.max(0,pathLength-RULES.bit.followDistance));
  while(travel>.001&&bit.trail.length){
    const point=bit.trail[0],dx=point.x-bit.x,dz=point.z-bit.z,length=Math.hypot(dx,dz);
    if(length<.01){bit.trail.shift();continue;}
    const distance=Math.min(length,travel),next=movePlayer(bit,{x:dx/length*distance,z:dz/length*distance},solids,floors,RULES.bit.radius);
    if(Math.hypot(next.x-bit.x,next.z-bit.z)<.001)break;
    bit.x=next.x;bit.z=next.z;travel-=distance;
    if(Math.hypot(point.x-bit.x,point.z-bit.z)<.01)bit.trail.shift();
  }
  bit.healing=!round.over&&round.health>0&&round.health<(round.maxHealth??100)&&!moving&&!moved;
  if(!bit.healing){bit.healCarry=0;return false;}
  bit.healCarry+=(hasPerk(round,'medic')?PERKS.medicRate:RULES.bit.healPerSecond)*Math.max(0,dt);
  const amount=Math.floor(bit.healCarry+1e-8);bit.healCarry-=amount;
  if(amount===0)return false;
  // The heal budget can run out mid-raid: BIT keeps the stationary animation going (no silent cutoff),
  // but stepStakes/heal() clamps the actual HP to 0 once the shared cap (data/raid-stakes.js) is spent.
  const healed=heal(round,round.gameNow??0,amount);
  if(healed>0&&hasPerk(round,'medic'))logCombat(round,{kind:'perk',perk:'medic',text:`Field Medic: healed ${healed} HP while stationary.`,seconds:dt});
  return healed>0;
}
