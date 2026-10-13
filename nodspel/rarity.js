// Rarity tiers (mirrors data/items.js rarity). Standard loot colors.
export const RARITY={"cable": "common", "fuse": "common", "scrap_alloy": "common", "polymer_plate": "common", "servo": "common", "circuit_board": "common", "med_gel": "common", "bio_sample": "common", "basic_carbine": "common", "scavenger_vest": "common", "medkit": "common", "salvage_crate": "common", "ammo_pack": "common", "power_cell": "uncommon", "hydraulic_component": "uncommon", "optical_sensor": "uncommon", "memory_module": "uncommon", "transmitter": "uncommon", "purification_filter": "uncommon", "shotgun_breach": "uncommon", "smg_vector": "uncommon", "scout_rig": "uncommon", "power_relay": "rare", "data_core": "rare", "rifle_marksman": "rare", "dampener_cloak": "rare", "encrypted_drive": "epic", "ai_fragment": "epic", "rebirth_shard": "legendary", "neural_core": "legendary", "prewar_relic": "legendary"};
export const RARITY_ORDER=['common','uncommon','rare','epic','legendary'];
export const RARITY_COLORS={common:'#d6dde0',uncommon:'#3ddc6a',rare:'#3d8bff',epic:'#b05cff',legendary:'#ffc12e'};
export const UNKNOWN_COLOR='#8f9aa0';
export const REVEAL_RADIUS=3.5;
export function rarityOf(item){return RARITY[item]??'common';}
// Reveal persists once seen. Returns true only on the frame it becomes revealed.
export function updateReveal(loot,pos,radius=REVEAL_RADIUS){if(loot.revealed)return false;
  if(Math.hypot(loot.x-pos.x,loot.z-pos.z)<=radius){loot.revealed=true;return true;}return false;}
export const lootColor=loot=>loot.revealed?RARITY_COLORS[rarityOf(loot.item)]:UNKNOWN_COLOR;
