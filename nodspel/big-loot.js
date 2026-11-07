// Spatial material coverage for Bunker Big Map. No extra containers, rewards or costs.
// Dependencies are injected so the rule can be tested without browser/save state.
export const BIG_LOOT_BANDS=Object.freeze({earlyRooms:3,middleRooms:2,version:1});
const LABELS=['MAINTENANCE SUPPLIES - COMMON PARTS','ELECTRICAL SUPPLIES - MIXED PARTS','DEEP SALVAGE - ADVANCED PARTS'];

export function isOrdinaryLoot(box,item){
  return !!item&&!box.collected&&!box.key&&box.requiresNode==null&&!box.marked&&
    !item.scouts&&!item.slot&&!(item.uses??[]).includes('story')&&
    box.item!=='keycard'&&box.item!=='medkit'&&box.item!=='ammo_pack';
}

export function applyBunkerLootBands(level,{tables,items,distances,randomFromSeed,pickWeighted}={}){
  if(!level.big||level.area!=='bunker'||level.intro||level.ftue)return 0;
  if(!Array.isArray(tables)||tables.length!==3||!items||!distances||
     typeof randomFromSeed!=='function'||typeof pickWeighted!=='function')throw new TypeError('Big loot requires three pools, items, distances and seeded helpers');
  for(const pool of tables){
    if(!Object.keys(pool).length||Object.entries(pool).some(([id,w])=>!items[id]||!Number.isFinite(w)||w<=0))throw new TypeError('Invalid Big Map loot pool');
  }
  const eligible=level.lootBoxes.filter(b=>Number.isFinite(distances[b.roomId])&&isOrdinaryLoot(b,items[b.item]));
  const rooms=[...new Set(eligible.map(b=>b.roomId))].sort((a,b)=>distances[a]-distances[b]||a-b);
  // Short maps still retain at least a middle source rather than becoming all common loot.
  const early=Math.min(BIG_LOOT_BANDS.earlyRooms,Math.max(1,rooms.length-BIG_LOOT_BANDS.middleRooms));
  const tierByRoom=new Map(rooms.map((id,index)=>[id,index<early?1:index<early+BIG_LOOT_BANDS.middleRooms?2:3]));
  let changed=0;
  for(const box of eligible){
    if(box.lootBandVersion===BIG_LOOT_BANDS.version)continue;
    const tier=tierByRoom.get(box.roomId);
    // Independent stream: do not perturb topology, enemies, keys or other rooms' rolls.
    box.item=pickWeighted(tables[tier-1],randomFromSeed(`${level.seed}:big-loot-v${BIG_LOOT_BANDS.version}:${box.id}`)());
    box.lootTier=tier;box.lootBandVersion=BIG_LOOT_BANDS.version;box.source=LABELS[tier-1];changed++;
  }
  return changed;
}
