// v2.28.27 (Wild Team playtest, "hard to understand the value of objects"): the pickup toast's value +
// needed-for text, and the first-time-ever BIT explainer line for a material. Pure text/data helpers;
// game.mjs wires these into pickupToast/renderPickupToasts.
import {swapItemStatus} from './swap-guidance.js?v=2.28.87';
import {hintText} from './item-hints.js?v=2.28.87';
// DATA.itemInfo (used by hintText) is defined in data/recipes.js from DATA.modules/DATA.vendors.
import '../data/modules.js?v=2.28.87';
import '../data/recipes.js?v=2.28.87';
import '../data/vendors.js?v=2.28.87';

const SEEN_KEY='nr_seen_materials_v1';
const itemDef=id=>globalThis.DATA.items.find(item=>item.id===id);

// "≈<n> Scrap" = what the vendor actually pays (DATA.itemInfo().sell = sellValue x vendor sellMultiplier), the
// same number the BIT line and the base sell button use, or null for items with nothing to sell.
export function sellValueText(id){
  const value=itemDef(id)?.sellValue>0?(globalThis.DATA.itemInfo?.(id)?.sell??0):0;
  return value>0?`≈${value} Scrap`:null;
}

// Reuses the same swapItemStatus the swap-guidance tiles already use: only the carried unit that is
// currently load-bearing for the goal ('NEEDED NOW') is called out. Surplus/already-secured parts stay quiet.
export function neededForText(goal,bag,id){
  if(!goal)return null;
  return swapItemStatus(goal,bag,id,false)==='NEEDED NOW'?`NEEDED FOR ${goal.name}`:null;
}

function readSeen(storage){
  try{const list=JSON.parse(storage?.getItem(SEEN_KEY)||'[]');return Array.isArray(list)?list:[];}catch{return [];}
}

export function hasSeenMaterial(id,storage=globalThis.localStorage){
  return readSeen(storage).includes(id);
}

// Records id as seen; returns false (no-op) if it was already recorded.
export function markMaterialSeen(id,storage=globalThis.localStorage){
  const seen=readSeen(storage);
  if(seen.includes(id))return false;
  try{storage?.setItem(SEEN_KEY,JSON.stringify([...seen,id]));}catch{}
  return true;
}

// The short BIT line for a material's first-ever pickup (derived from item-hints.js, the real
// recipe/upgrade uses and sellValue), or null when it isn't the genuine first sighting. The FTUE and the
// guided intro raid (launch.ftue / launch.intro) never show this and never mark the material seen, so an
// ordinary raid still introduces it later (D3.1: BIT is not in the intro raid).
export function materialPickupBitLine(id,launch,storage=globalThis.localStorage){
  if(hasSeenMaterial(id,storage))return null;
  if(launch?.intro||launch?.ftue)return null;
  markMaterialSeen(id,storage);
  return hintText(id);
}
