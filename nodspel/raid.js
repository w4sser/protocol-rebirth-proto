export const DEFAULT_ORDER=Object.freeze({zone:'industrial',route:'maintenance_tunnels',risk:'standard',objective:['cable','fuse'],loadout:{weapon:'basic_carbine',ammo:12},health:100});
export const ITEM_NAMES={cable:'Cable',fuse:'Fuse',scrap_alloy:'Scrap',power_cell:'Power cell'};
export const emptyBag=()=>({scrap_alloy:0,power_cell:0,cable:0,fuse:0});
export function readOrder(value){
  if(!value||value.loadout?.weapon!=='basic_carbine'||!Number.isInteger(value.loadout.ammo)||value.loadout.ammo<0||!Number.isFinite(value.health)||value.health<=0||value.health>100||!Array.isArray(value.objective)||value.objective.some(id=>!ITEM_NAMES[id])||!['zone','route','risk'].every(key=>typeof value[key]==='string'&&value[key]))throw new Error('Invalid raid order.');
  return JSON.parse(JSON.stringify(value));
}
export const bagItems=bag=>Object.entries(bag).flatMap(([id,count])=>Array(count).fill(id));
export const bagText=bag=>Object.entries(bag).filter(([,count])=>count>0).map(([id,count])=>`${count} ${ITEM_NAMES[id]}`).join(' · ')||'Empty';
export function raidResult(round,weapon,outcome){
  const success=outcome==='extraction';
  return {extracted:success?[...(round.exitLoot??[])]:[],lost:success?[]:bagItems(round.lost),died:outcome==='death',weaponReturned:success?round.order.loadout.weapon:null,ammoReturned:success?weapon.ammo+weapon.reserve:0,seen:round.order.zone};
}
export const resultJSON=result=>JSON.stringify(result,null,2)+'\n';
