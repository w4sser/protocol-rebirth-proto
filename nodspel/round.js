import {PERKS,perkState,hasPerk,logCombat,roomKey,updateClears,resetPerks} from './perks.js?v=2.3.2';
import {generateLevel,RULES,isHard} from './levels.js?v=2.3.2';
// import {DEFAULT_ORDER,readOrder} from './raid.js?v=2.3.2';
import {emptyBag,bagItems} from './raid.js?v=2.3.2';
import {traceTargets} from './physics.mjs?v=2.3.2';
import {shieldBlocks} from './encounters.js?v=2.3.2';

export const ROUND_DURATION_MS=8*60*1000;
// Order integration is paused; keep the old input path for later.
// export function createRound(seed,now,requestedOrder=DEFAULT_ORDER) {
//   const order=readOrder(requestedOrder);
// stats: validated player stats (see raid-result.js readStats); defaults to the new-player base.
export function createRound(seed,now,stats=RULES.playerStats.base) {
  // Hard raids run on a shorter clock (RULES.hard.timerMul); round.durationMs is the raid's full length.
  const durationMs=Math.round(ROUND_DURATION_MS*(isHard()?RULES.hard.timerMul:1));
  stats={...RULES.playerStats.base,...stats};
  const bagCapacity=bagCap(stats.bagCapacity);
  return {seed,stats,bagCapacity,shield:Math.max(0,Math.round(stats.shield||0)),maxShield:Math.max(0,Math.round(stats.shield||0)),maxHealth:stats.maxHealth,telemetry:{distanceM:0,dashes:0,holdNodes:0,damageTaken:0},durationMs,hard:isHard(),deadline:now+durationMs,remainingMs:durationMs,over:false,reason:null,health:stats.maxHealth,equip:{weapon:null,armor:null},backpack:[],backpackWeaponStates:[],weaponState:null,bag:emptyBag(),extracted:emptyBag(),lost:emptyBag(),cleared:false,level:generateLevel(1,seed),nodesLit:0,enemiesDefeated:0,levelsCleared:0};
}
// Raid bag size: meta sends it (?bag=) from upgrades + gear; clamped to [capacity, maxCapacity].
export function bagCap(n){const L=RULES.loot,v=Math.floor(Number(n));return Number.isFinite(v)?Math.min(L.maxCapacity,Math.max(L.capacity,v)):L.capacity;}
export const bagCapacityOf=round=>round?.bagCapacity??RULES.loot.capacity;
// Carried-but-not-equipped gear/weapons share the bag's slots with materials (lost on death, kept on
// extract, same as any other bag loot) — the backpack's own smaller cap (see backpackCapacityOf) still applies on top.
export const carriedCount=round=>bagItems(round.bag).length+(round?.backpack?.length??0);
function secureBag(round){for(const item of RULES.loot.types){round.extracted[item]+=round.bag[item];round.bag[item]=0;}}
function loseBag(round){for(const item of RULES.loot.types){round.lost[item]+=round.bag[item];round.bag[item]=0;}}
export function collectLoot(round,position,now,weapon){
  tickRound(round,now);if(round.over||round.pauseAt!=null)return false;
  let changed=false;
  for(const box of round.level.lootBoxes){
    if(Math.hypot(position.x-box.x,position.z-box.z)>RULES.loot.pickupRadius){box.blockedUntilLeft=false;box.fullNotified=false;box.kitFullNotified=false;box.gearNotified=false;}
    if(!box.collected&&Math.hypot(position.x-box.x,position.z-box.z)<=RULES.loot.pickupRadius){
      if(box.blockedUntilLeft)continue;
      if(box.item==='ammo_pack'){
        if(!weapon)continue;
        weapon.reserve+=box.ammoRounds??RULES.resources.ammoCrateRounds;
        {const wr=weapon.rule??RULES.weapon;if(weapon.ammo<wr.capacity&&weapon.reloadAt===null)weapon.reloadAt=now+wr.reloadMs;}
      }else if(box.item==='medkit'){
        // v1.46: health kits go to the kit slot (Q button), never the bag. Max RULES.kitMax.medkit;
        // a full slot leaves the kit on the ground (one quiet notice per approach).
        round.kit=round.kit||{medkit:0};
        if((round.kit.medkit||0)>=RULES.kitMax.medkit){if(!box.kitFullNotified){box.kitFullNotified=true;round.kitFull={boxId:box.id,at:now};changed=true;}continue;}
        round.kit.medkit=(round.kit.medkit||0)+1;round.kitPicked=(round.kitPicked||0)+1;
      }else if(box.item==='keycard'){
        // Encounter key: carried by the raid itself (never in the bag), spent on contact with its door.
        round.keys=round.keys||[];round.keys.push(box.key);
      }else if(gearSlotOf(box.item)){
        // Equipment never goes in the material bag. Armor and weapons always
        // offer a choice, including when the free Basic Carbine is active.
        // v2.0: an occupied weapon slot instead offers a choice (swap now, or stash in the backpack to
        // bring home) — see docs/design-playtest-oct25.md §c.
        const slot=gearSlotOf(box.item);round.equip=round.equip||{weapon:null,armor:null};
        if(slot==='weapon'){
          if(!box.gearNotified){box.gearNotified=true;round.weaponOffer={boxId:box.id,item:box.item,at:now};changed=true;}
          continue;
        }
        if(!box.gearNotified){box.gearNotified=true;round.gearOffer={boxId:box.id,item:box.item,slot,at:now};changed=true;}continue;
      }else{
        // Full bag: signal once per approach (re-arms after the player steps away).
        if(carriedCount(round)>=bagCapacityOf(round)){if(!box.fullNotified){box.fullNotified=true;round.bagFull={boxId:box.id,item:box.item,at:now};changed=true;}continue;}
        round.bag[box.item]++;round.lastBagPickup={item:box.item,at:now};
      }
      box.collected=true;round.lastPickup={item:box.item,at:now};changed=true;
    }
  }
  return changed;
}
// Loot label action: health kits read SLOT FULL (dimmed) while the kit slot is at its max (v1.47).
export function kitSlotFull(round){return (round?.kit?.medkit??0)>=RULES.kitMax.medkit;}
export function lootAction(round,item){const slot=gearSlotOf(item);if(slot)return {text:slot==='weapon'?'CHOOSE':round?.equip?.[slot]?'SWAP':'EQUIP',full:false};return item==='medkit'&&kitSlotFull(round)?{text:'SLOT FULL',full:true}:{text:'COLLECT',full:false};}
export function dropItem(round,item,position,now){
  tickRound(round,now);if(round.over||round.pauseAt!=null||!round.bag[item])return null;
  round.bag[item]--;
  const box={id:`drop-${round.level.lootBoxes.length}-${now}`,x:position.x,z:position.z,item,collected:false,blockedUntilLeft:true};
  round.level.lootBoxes.push(box);return box;
}
// Swap: drop one bag item on the ground (revealed) and take the blocked box's item.
export function swapLoot(round,boxId,dropId,now){
  tickRound(round,now);if(round.over||round.pauseAt!=null)return null;
  const box=round.level.lootBoxes.find(b=>b.id===boxId);
  if(!box||box.collected||!round.bag[dropId]||box.item==='ammo_pack')return null;
  round.bag[dropId]--;round.bag[box.item]=(round.bag[box.item]??0)+1;box.collected=true;
  const dropped={id:`drop-${round.level.lootBoxes.length}-${now}`,x:box.x,z:box.z,item:dropId,collected:false,blockedUntilLeft:true,revealed:true};
  round.level.lootBoxes.push(dropped);round.bagFull=null;return dropped;
}
// ---- v1.59 equipment slots (weapon / armor) ----
// Gear data comes from data/items.js (shared with the base). The Basic Carbine is free and infinite:
// it uses a null equipment id and is never dropped, but pickups still offer a choice. Equipped gear is at risk: it comes home only on extract.
const GEAR=Object.fromEntries((globalThis.DATA?.items??[]).filter(i=>i.slot==='weapon'||i.slot==='armor').map(i=>[i.id,i]));
export const gearItem=id=>GEAR[id]??null;
export const gearSlotOf=id=>GEAR[id]&&!GEAR[id].free?GEAR[id].slot:null;
export function initEquip(round,{weapon=null,gear=[],armorShield=null}={}){
  round.equip={weapon:gearSlotOf(weapon)==='weapon'?weapon:null,armor:(gear||[]).find(id=>gearSlotOf(id)==='armor')??null};
  const nominal=GEAR[round.equip.armor]?.stats?.shield||0;
  // Upgrades can grant shield to a piece with zero base shield (e.g. Dampener Cloak): gate on the
  // supplied armorShield being a real number, not on the gear's own nominal shield being non-zero.
  const capacity=Number.isFinite(armorShield)?Math.min(round.maxShield,Math.max(nominal,armorShield)):nominal;
  round.armorState=capacity?{shield:Math.min(round.shield,capacity),maxShield:Math.min(round.maxShield,capacity)}:null;
  return round.equip;}

export const equippedGear=round=>Object.values(round?.equip??{}).filter(Boolean);
// Armor stats are deltas on top of the launch stats (which already include the armor worn from base).
function applyArmor(round,oldId,newId,incomingState=null){
  const o=GEAR[oldId]?.stats??{},n=GEAR[newId]?.stats??{},C=RULES.playerStats.clamp;
  for(const s of new Set([...Object.keys(o),...Object.keys(n)])){if(s==='shield')continue;const v=(round.stats[s]??0)-(o[s]||0)+(n[s]||0);round.stats[s]=C[s]?Math.min(C[s][1],Math.max(C[s][0],v)):v;}
  round.maxHealth=round.stats.maxHealth;round.health=Math.min(round.health,round.maxHealth);
  const oldState=round.armorState??{shield:Math.min(round.shield||0,o.shield||0),maxShield:o.shield||0};
  oldState.shield=Math.min(oldState.shield,round.shield||0);
  const next=incomingState??{shield:n.shield||0,maxShield:n.shield||0},[lo,hi]=C.shield;
  round.maxShield=Math.min(hi,Math.max(lo,(round.maxShield||0)-oldState.maxShield+next.maxShield));
  round.shield=Math.max(0,Math.min(round.maxShield,(round.shield||0)-oldState.shield+next.shield));
  // Gate on the carried instance's own maxShield, not the gear's nominal shield: a zero-base-shield
  // piece (e.g. Dampener Cloak) can still carry a durable, upgrade-granted shield instance.
  round.armorState=next.maxShield?{...next}:null;round.stats.shield=round.maxShield;
  round.bagCapacity=bagCap(bagCapacityOf(round)-(GEAR[oldId]?.bagSlots||0)+(GEAR[newId]?.bagSlots||0));
}
export function equipGear(round,id,now,weaponState=null,armorState=null){
  const slot=gearSlotOf(id);if(!slot)return null;round.equip=round.equip||{weapon:null,armor:null};
  const old=round.equip[slot];round.equip[slot]=id;if(slot==='weapon')round.weaponState=weaponState;if(slot==='armor')applyArmor(round,old,id,armorState);
  round.lastEquip={slot,item:id,old,at:now};return old;
}
// Occupied slot: take the offered piece; the swapped-out one is dropped on the ground (revealed).
export function swapGear(round,boxId,now){
  tickRound(round,now);if(round.over||round.pauseAt!=null)return null;
  const box=round.level.lootBoxes.find(b=>b.id===boxId),slot=box&&gearSlotOf(box.item);
  if(!box||box.collected||!slot)return null;
  const oldState=round.weaponState,oldArmor=round.armorState;
  const old=equipGear(round,box.item,now,box.weaponState??null,box.armorState??null);box.collected=true;round.lastPickup={item:box.item,at:now};
  if(slot==='weapon')round.weaponOffer=null;else round.gearOffer=null;
  if(!old)return null; // The free starter is never dropped. lastEquip still records success.
  const dropped={id:`drop-${round.level.lootBoxes.length}-${now}`,x:box.x,z:box.z,item:old,collected:false,blockedUntilLeft:true,revealed:true};
  if(slot==='weapon')dropped.weaponState=oldState;else dropped.armorState=oldArmor;
  round.level.lootBoxes.push(dropped);return dropped;
}
// ---- v2.0 weapon backpack: bring a found weapon home instead of swapping it in now ----
export const backpackCapacityOf=round=>round?.backpackCapacity??RULES.backpack.capacity;
// Stats compare for the pickup prompt (damage/rate/mag/range), so a player doesn't blind-swap into a worse gun.
// `better` marks the direction that counts as an improvement (rate = lower interval is faster).
const WEAPON_COMPARE_STATS=[{key:'dmg',runtimeKey:'damage',label:'DMG',better:'high'},{key:'int',runtimeKey:'shotIntervalMs',label:'RATE',better:'low'},{key:'mag',runtimeKey:'capacity',label:'MAG',better:'high'},{key:'rng',runtimeKey:'range',label:'RNG',better:'high'}];
// Runtime rules already include launch upgrades, attachments and mastery. Keep each instance's
// rules when comparing carried weapons; fresh ground/backpack items use their stock stats.
export function compareWeapons(oldId,newId,oldWeapon=null,newWeapon=null){
  const o=GEAR[oldId||'basic_carbine']?.weapon,n=GEAR[newId]?.weapon;
  if(!o||!n)return [];
  return WEAPON_COMPARE_STATS.map(({key,runtimeKey,label,better})=>{
    const from=oldWeapon?.rule?.[runtimeKey]??o[key]??0,to=newWeapon?.rule?.[runtimeKey]??n[key]??0,delta=to-from;
    return {key,label,from,to,improved:delta===0?null:(better==='high'?delta>0:delta<0)};
  });
}
// Stash a found weapon OR armor piece in the backpack instead of equipping it now (v2.4: PICK UP alongside
// SWAP for gear too, not just weapons). `dropIndex` picks which backpack item to leave on the ground
// (revealed) when the backpack is already full; omitted/invalid -> fails closed.
export function stashWeapon(round,boxId,now,dropIndex=null){
  tickRound(round,now);if(round.over||round.pauseAt!=null)return null;
  const box=round.level.lootBoxes.find(b=>b.id===boxId);
  if(!box||box.collected||!gearSlotOf(box.item)||carriedCount(round)>=bagCapacityOf(round))return null;
  round.backpack=round.backpack||[];
  // Parallel slots retain weapon instances and armor durability alongside the item IDs.
  const states=round.backpackWeaponStates??=[],armorStates=round.backpackArmorStates??=[];
  let dropped=null;
  if(round.backpack.length>=backpackCapacityOf(round)){
    if(!Number.isInteger(dropIndex)||dropIndex<0||dropIndex>=round.backpack.length)return null;
    const old=round.backpack.splice(dropIndex,1)[0],state=states.splice(dropIndex,1)[0],armorState=armorStates.splice(dropIndex,1)[0];
    dropped={id:`drop-${round.level.lootBoxes.length}-${now}`,x:box.x,z:box.z,item:old,collected:false,blockedUntilLeft:true,revealed:true};
    dropped.weaponState=state??null;dropped.armorState=armorState??null;round.level.lootBoxes.push(dropped);
  }
  states[round.backpack.length]=box.weaponState??null;armorStates[round.backpack.length]=box.armorState??null;
  round.backpack.push(box.item);box.collected=true;round.lastPickup={item:box.item,at:now};
  if(round.weaponOffer?.boxId===boxId)round.weaponOffer=null;
  if(round.gearOffer?.boxId===boxId)round.gearOffer=null;
  return {dropped};
}
// Player-initiated, any time mid-raid: bring a backpack weapon or armor piece into its active slot. The
// gear it replaces goes into the backpack slot it vacated (still home-bound) rather than being dropped.
export function equipFromBackpack(round,index,now){
  tickRound(round,now);if(round.over||round.pauseAt!=null)return null;
  round.backpack=round.backpack||[];
  if(!Number.isInteger(index)||index<0||index>=round.backpack.length)return null;
  const incoming=round.backpack[index],slot=gearSlotOf(incoming);if(!slot)return null;
  round.equip=round.equip||{weapon:null,armor:null};const old=round.equip[slot]??null;
  const states=round.backpackWeaponStates??=[],armorStates=round.backpackArmorStates??=[];
  if(slot==='weapon'){const oldState=round.weaponState;round.weaponState=states[index]??null;round.equip.weapon=incoming;
    if(old){round.backpack[index]=old;states[index]=oldState??null;}else{round.backpack.splice(index,1);states.splice(index,1);armorStates.splice(index,1);}
  }else{
    const oldArmor=round.armorState;applyArmor(round,old,incoming,armorStates[index]);round.equip[slot]=incoming;
    if(old){round.backpack[index]=old;states[index]=null;armorStates[index]=oldArmor;}else{round.backpack.splice(index,1);states.splice(index,1);armorStates.splice(index,1);}
  }
  round.lastEquip={slot,item:incoming,old,toBackpack:true,at:now};
  return old;
}
// Medkits live in the kit slot (brought from base or picked up, max RULES.kitMax.medkit); unused ones come home on extract, lost on death.
export function useHealthKit(round,now){
  const max=round.maxHealth??100;tickRound(round,now);const kit=round.kit?.medkit>0;if(round.over||round.pauseAt!=null||(!kit&&!round.bag.medkit)||round.health>=max)return false;
  if(kit)round.kit.medkit--;else round.bag.medkit--;const before=round.health;round.health=Math.min(max,round.health+RULES.rewards.medkitHealth);if(round.telemetry)round.telemetry.healed=(round.telemetry.healed||0)+round.health-before;return true;
}
// Encounter 6: a node with a live generator cannot be charged until the generator is shot (the node's `shielded` flag
// then drops for good) or an EMP holds the shield down for a few seconds. Shielded nodes without a generator charge as before.
export const nodeShielded=(round,node,now)=>!!node.shielded&&!!node.generatorId&&!(now<(node.shieldDownUntil??0));
// Encounter 3: a locked door is a solid until the player carrying its keycard walks up to it.
export const doorSolids=level=>(level.doors??[]).filter(d=>d.locked).map(d=>({x:d.x,z:d.z,w:d.w,d:d.d,h:d.h,door:true}));
export function stepDoors(round,position,now){
  tickRound(round,now);if(round.over||round.pauseAt!=null)return false;
  let opened=false;
  for(const door of round.level.doors??[]){
    if(!door.locked)continue;const k=round.keys?.indexOf(door.key)??-1;if(k<0)continue;
    const dx=Math.max(0,Math.abs(position.x-door.x)-door.w/2),dz=Math.max(0,Math.abs(position.z-door.z)-door.d/2);
    if(Math.hypot(dx,dz)>RULES.encounters.door.reach)continue;
    door.locked=false;door.openedAt=now;round.keys.splice(k,1);round.lastDoor={id:door.id,at:now};opened=true;
  }
  return opened;
}
export function stepNodeInteraction(round,weapon,position,now,obstacles){
  tickRound(round,now);
  if(round.pauseAt!=null)return false;
  if(round.over){round.nodeInteraction=null;return false;}
  const node=round.level.nodes.filter(n=>!n.active&&Math.hypot(position.x-n.x,position.z-n.z)<=RULES.resources.nodeReach&&traceTargets(position,n,obstacles,[])?.kind!=='wall').sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0];
  if(!node){round.nodeInteraction=null;return false;}
  if(nodeShielded(round,node,now)){round.nodeInteraction=null;return false;}
  let hold=round.nodeInteraction;
  if(!hold||hold.id!==node.id)hold=round.nodeInteraction={id:node.id,startedAt:now,progress:0};
  hold.progress=Math.min(1,(now-hold.startedAt)/RULES.resources.nodeHoldMs);
  if(hold.progress<1)return false;
  round.nodeInteraction=null;const lit=activateNode(round,node.id,now);if(lit&&round.telemetry)round.telemetry.holdNodes++;return lit;
}
export function tickRound(round,now) {
  if(round.over||round.pauseAt!=null)return;
  round.gameNow=now;round.remainingMs=Math.max(0,Math.min(round.durationMs??ROUND_DURATION_MS,round.deadline-now));
  if(round.remainingMs===0){loseBag(round);round.over=true;round.reason='timeout';resetPerks(round);}
}
export function takeDamage(round,amount,now){
  tickRound(round,now);
  if(round.over || round.pauseAt!=null || !Number.isFinite(amount) || amount<=0)return false;
  const ps=perkState(round),key=roomKey(round);
  if(hasPerk(round,'shield')&&now<ps.shieldUntil){const saved=amount*PERKS.shieldReduction;amount-=saved;logCombat(round,{kind:'perk',at:now,perk:'shield',text:`Emergency Shield: prevented ${Number(saved.toFixed(1))} damage.`});}
  const before=round.health,beforeShield=round.shield||0;
  // Vest shield (v1.43) absorbs damage first; it does not regenerate.
  const absorbed=Math.min(round.shield||0,amount);if(absorbed){round.shield-=absorbed;amount-=absorbed;}
  if(absorbed&&round.armorState){
    round.armorState.shield=Math.max(0,round.armorState.shield-absorbed);
    if(round.armorState.shield===0&&round.equip?.armor){
      const spent=round.equip.armor;applyArmor(round,spent,null);round.equip.armor=null;
      (round.gearConsumed??=[]).push(spent);
    }
  }
  if(round.telemetry)round.telemetry.damageTaken+=absorbed+Math.min(amount,round.health);
  round.lastDamageAt=now;round.health=Math.max(0,round.health-amount);
  const meta=round.lastHit??{};logCombat(round,{kind:'damage',at:now,source:meta.source??'Unknown',sourceId:meta.enemyId??meta.sourceId??null,attack:meta.attack??'projectile',amount:before-round.health+beforeShield-(round.shield||0),moving:!!round.playerMoving});
  if(hasPerk(round,'shield')&&round.health>0&&round.health<=round.maxHealth*PERKS.shieldThreshold&&!ps.shieldRooms.includes(key)){ps.shieldRooms.push(key);ps.shieldUntil=now+PERKS.shieldMs;logCombat(round,{kind:'perk',at:now,perk:'shield',text:'Emergency Shield: activated for 2 s; room charge spent.'});}
  if(round.health===0){loseBag(round);round.over=true;round.reason='death';resetPerks(round);}
  return true;
}
// Dormant defenders wake when attacked; swarm spawn queues remain locked.
export function alertEnemy(enemy,now){
  if(enemy.health<=0||enemy.type==='generator'||(enemy.active===false&&enemy.swarm))return;
  if(!enemy.aggro)enemy.attackWakeAt=now;
  enemy.active=true;enemy.aggro=true;enemy.nearMissAt=now;enemy.alertAt=null;
  enemy.spawnedAt=-Infinity; // attacks bypass arrival grace, never encounter warnings
}
// `from` = where the hit comes from. Player weapon hits default to round.shooter (set by the game around weapon
// calls); blasts and anything without an origin skip the guard's front shield.
export function hitEnemy(round,id,now,damage=1,from=round.shooter){
  tickRound(round,now);
  const enemy=round.level.enemies.find(e=>e.id===id);
  if(round.over || round.pauseAt!=null || !enemy || enemy.health<=0 || (enemy.active===false&&enemy.swarm) || !Number.isFinite(damage) || damage<=0)return false;
  // swarm rushers still pouring out of their spawn point are immune to bullets (blasts, which have no origin, still work)
  if(enemy.swarm&&from&&now<(enemy.spawnedAt??-Infinity)+(enemy.graceMs??0))return false;
  alertEnemy(enemy,now);
  if(shieldBlocks(enemy,from)){enemy.blockedAt=now;enemy.blockedSerial=(enemy.blockedSerial??0)+1;return false;}
  if(enemy.type==='generator'){
    // Not a kill: breaking the generator drops its node's shield for good.
    enemy.lastDamage=Math.min(enemy.health,damage);enemy.lastHitAt=now;enemy.hitSerial=(enemy.hitSerial??0)+1;enemy.health=Math.max(0,enemy.health-damage);
    if(enemy.health===0){const node=round.level.nodes.find(n=>n.id===enemy.node);if(node){node.shielded=false;node.shieldBroken=true;}round.generatorsDown=(round.generatorsDown??0)+1;}
    return true;
  }
  enemy.lastDamage=Math.min(enemy.health,damage);enemy.lastHitAt=now;enemy.hitSerial=(enemy.hitSerial??0)+1;enemy.health=Math.max(0,enemy.health-damage);if(enemy.health===0){round.enemiesDefeated++;const kt=enemy.type??'grunt';round.killsByType={...(round.killsByType??{}),[kt]:(round.killsByType?.[kt]??0)+1};round.health=Math.min(round.maxHealth??100,round.health+RULES.killReward.health);}return true;
}
export function roundSummary(round){
  return {reason:round.reason,levelsCleared:round.levelsCleared,enemiesDefeated:round.enemiesDefeated,nodesLit:round.nodesLit,remainingMs:round.remainingMs,extracted:{...round.extracted},lost:{...round.lost}};
}
// Player choice after a level exit: end the raid now; only this secures the carried bag.
export function extractRound(round,now){
  tickRound(round,now);if(round.pauseAt!=null||round.perks?.queue.length||round.over||round.levelsCleared<1)return false;
  secureBag(round);round.nodeInteraction=null;round.over=true;round.reason='extract';resetPerks(round);return true;
}
// Leaving a launched raid early counts as a loss: the bag is lost like on death.
export function abandonRound(round,now){
  tickRound(round,now);if(round.over||round.pauseAt!=null)return false;
  loseBag(round);round.nodeInteraction=null;round.over=true;round.reason='abandon';resetPerks(round);return true;
}
export function exitIsOpen(round) {
  return !round.over && round.level.nodes.every(n=>n.active);
}
export function activateNode(round,id,now) {
  tickRound(round,now);
  const node=round.level.nodes.find(n=>n.id===id);
  if(round.over || round.pauseAt!=null || !node || node.active)return false;
  node.active=true;round.nodesLit++;
  if(round.nodeInteraction?.id===id)round.nodeInteraction=null;
  // Swarm rushers wait for their own spawn point, not for a node.
  for(const enemy of round.level.enemies)if(enemy.active===false&&!enemy.swarm){enemy.active=true;enemy.spawnedAt=now;}
  return true;
}
export function enterExit(round,position,now) {
  tickRound(round,now);
  if(round.pauseAt!=null||round.cleared || !exitIsOpen(round))return null;
  const inZone=Math.hypot(position.x-round.level.exit.x,position.z-round.level.exit.z)<=round.level.exit.r;
  // Final level: once the nodes are done the extract stays open and the raid goes on (timer + risk) until the
  // player deliberately walks INTO the zone; being inside when it opens does not count.
  if(round.level.number===3){if(!inZone){round.level.exitArmed=true;return null;}if(!round.level.exitArmed)return null;}
  else if(!inZone)return null;
  updateClears(round,position);
  const perks=perkState(round);
  if(perks.queue.length){
    // A minimized offer keeps the exit blocked without reopening every frame.
    if(perks.minimized===perks.queue[0])return null;
    round.perkExitPending=true;return 'perk';
  }
  round.perkExitPending=false;
  // Owner rule: a level exit does NOT secure loot. The bag (same 4 slots) carries on, at risk,
  // until the player chooses Extract or clears the final level.
  round.exitLoot=bagItems(round.bag);
  round.nodeInteraction=null;
  round.levelsCleared++;
  if(round.level.number===3){secureBag(round);round.cleared=true;round.over=true;round.reason='complete';resetPerks(round);return 'complete';}
  round.exitLevel=round.level;round.keys=[];
  round.level=generateLevel(round.level.number+1,round.seed);
  return 'next';
}
