// RaidResult v1: the contract core (Node Raid) hands back to meta (base).
// Pure and DOM-free so it can be tested headless. See docs/meta-core-integration.md.
import {bagItems} from './raid.js?v=1.21.0';
export const RAID_RESULT_KEY='pr_raid_result_v1';
export const RAID_RESULT_SCHEMA='protocol-rebirth/raid-result';
export const RAID_RESULT_VERSION=1;
const OUTCOMES={complete:'extract',death:'death',timeout:'timeout'};
// Only a finished round (round.over) produces a result. Loot secured at any
// level exit counts as extracted even if the player later dies or times out.
export function buildRaidResult(round,{endedAt=Date.now()}={}){
  if(!round||!round.over)return null;
  return {schema:RAID_RESULT_SCHEMA,version:RAID_RESULT_VERSION,raidId:`nodspel:${round.seed}`,seed:round.seed,
    outcome:OUTCOMES[round.reason]??'timeout',levelsCleared:round.levelsCleared,enemiesDefeated:round.enemiesDefeated,nodesLit:round.nodesLit,
    remainingMs:round.remainingMs,extracted:bagItems(round.extracted),lost:bagItems(round.lost),endedAt};
}
export function writeRaidResult(storage,result){
  if(!storage||!result)return false;
  try{storage.setItem(RAID_RESULT_KEY,JSON.stringify(result));return true;}catch{return false;}
}
