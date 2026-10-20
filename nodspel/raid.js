// Order integration is paused.
/*
export const DEFAULT_ORDER=Object.freeze({zone:'industrial',route:'maintenance_tunnels',risk:'standard',objective:['cable','fuse'],loadout:{weapon:'basic_carbine',ammo:12},health:100});
*/
import '../data/items.js?v=1.71.2';
import {RULES} from './levels.js?v=1.71.2';
export const ITEM_NAMES=Object.fromEntries(globalThis.DATA.items.map(i=>[i.id,i.name]));
export const emptyBag=()=>Object.fromEntries(RULES.loot.types.map(id=>[id,0]));
/*
export function readOrder(value){
  if(!value||value.loadout?.weapon!=='basic_carbine'||!Number.isInteger(value.loadout.ammo)||value.loadout.ammo<0||!Number.isFinite(value.health)||value.health<=0||value.health>100||!Array.isArray(value.objective)||value.objective.some(id=>!ITEM_NAMES[id])||!['zone','route','risk'].every(key=>typeof value[key]==='string'&&value[key]))throw new Error('Invalid raid order.');
  return JSON.parse(JSON.stringify(value));
}
*/
export const bagItems=bag=>Object.entries(bag).flatMap(([id,count])=>Array(count).fill(id));
export const bagText=bag=>Object.entries(bag).filter(([,count])=>count>0).map(([id,count])=>`${count} ${ITEM_NAMES[id]}`).join(' · ')||'Empty';
// Result serialization is paused.
/*
export function raidResult(round,weapon,outcome){
  const success=outcome==='extraction';
  return {extracted:success?[...(round.exitLoot??[])]:[],lost:success?[]:bagItems(round.lost),died:outcome==='death',weaponReturned:success?round.order.loadout.weapon:null,ammoReturned:success?weapon.ammo+weapon.reserve:0,seen:round.order.zone};
}
export const resultJSON=result=>JSON.stringify(result,null,2)+'\n';

*/
