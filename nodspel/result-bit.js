// Same context priority and persistent no-repeat protocol as the base summary.
import '../data/bit-lines.js?v=2.14.1';
import {ROUND_DURATION_MS} from './round.js?v=2.14.1';

const reactions=new WeakMap();
export function resultReaction(round,{rows,gear,home}){
  if(reactions.has(round))return reactions.get(round);
  let storage;try{storage=globalThis.localStorage;}catch{}
  const r={...round,outcome:'extract',raidId:`nodspel:${round.seed}`,elapsedMs:Math.max(0,(round.durationMs??ROUND_DURATION_MS)-round.remainingMs),perksTaken:[...new Set([...(round.raidPerksTaken??[]),...(round.perks?.taken??[])])]};
  const res={added:rows.flatMap(row=>Array(row.n).fill(row.id)),returnedGear:gear,questsDone:round.questsDone??[],questChanges:round.questChanges??[],stashBefore:home?.stash??{}};
  const reaction=selectReaction(r,res,storage);reactions.set(round,reaction);return reaction;
}

function selectReaction(r,res,storage){
  const D=globalThis.DATA,ITEMS=Object.fromEntries(D.items.map(i=>[i.id,i]));
  const pick=rows=>rows[Math.floor(Math.random()*rows.length)];
  const B = D.bitSummary;
  // Older isolated test harnesses may load only the original data tables.
  if(!B) return { trigger:"generic", mood:"sarcastic", line:"Inventory updated." };
  const ids = res.added || [], ext = r.outcome === "extract";
  const elapsed = Number.isFinite(r.elapsedMs) ? r.elapsedMs : null;
  const tests = {
    first:ext && r.firstExtract === true,
    timer:Number.isFinite(r.remainingMs) && r.remainingMs <= B.closeTimerMs,
    loaded:ids.length >= B.loadedItems,
    gearLost:(res.gearLost || []).length > 0 || (r.gearConsumed || []).length > 0,
    perks:(r.perksTaken || []).length > 0,
    kills:r.enemiesDefeated >= B.manyKills,
    rare:ids.some(id => ITEMS[id] && (["rare","epic","legendary"].includes(ITEMS[id].rarity) || ITEMS[id].tier >= B.rareTier)),
    quest:(res.questChanges || []).some(q => q.complete) || (res.questsDone || []).length > 0 || (res.chainsDone || []).length > 0,
    weapon:(res.returnedGear || []).concat(ids).some(id => ITEMS[id] && ITEMS[id].slot === "weapon"),
    close:(Number.isFinite(r.health) && r.health > 0 && r.health <= (r.maxHealth || (r.stats && r.stats.maxHealth) || 0) * B.closeHealthFraction) ||
      (r.maxShield > 0 && Number.isFinite(r.shield) && r.shield <= r.maxShield * B.closeShieldFraction),
    empty:ids.length <= B.nearEmptyItems,
    glut:ids.some(id => ITEMS[id] && ITEMS[id].rarity === "common" && ((res.stashBefore || {})[id] || 0) >= B.glutCount),
    short:elapsed !== null && elapsed < B.shortRaidMs && !(r.enemiesDefeated > 0), generic:true
  };
  let firstSeen=false,lastId=null;
  try{firstSeen=storage?.getItem('pr_bit_first_extract')==='1';lastId=storage?.getItem('pr_bit_last_raid_line');}catch(e){}
  // Only completed raid flows record the first-extraction milestone.
  if(ext && (r.raidId || r.cfg) && !firstSeen) tests.first=true;
  const trigger = ext ? B.priority.find(key => tests[key]) : (tests.gearLost ? 'gearLost' : 'death'), pool = B.pools[trigger];
  const choices=pool.lines.map((line,i)=>({id:trigger+':'+i,line})).filter(e=>e.id!==lastId);
  const selected=pick(choices.length?choices:pool.lines.map((line,i)=>({id:trigger+':'+i,line})));
  try{storage?.setItem('pr_bit_last_raid_line',selected.id);if(ext&&(r.raidId||r.cfg))storage?.setItem('pr_bit_first_extract','1');}catch(e){}
  return { trigger, mood:pool.mood, id:selected.id, line:selected.line };
}
