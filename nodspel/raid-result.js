// RaidResult v1: the contract core (Node Raid) hands back to meta (base).
// Pure and DOM-free so it can be tested headless. See docs/meta-core-integration.md.
import {bagItems} from './raid.js?v=1.23.0';
export const RAID_RESULT_KEY='pr_raid_result_v1';
export const RAID_RESULT_SCHEMA='protocol-rebirth/raid-result';
export const RAID_RESULT_VERSION=1;
const OUTCOMES={complete:'extract',death:'death',timeout:'timeout'};
// Only a finished round (round.over) produces a result. Loot secured at any
// level exit counts as extracted even if the player later dies or times out.
// A meta-issued raidId only belongs to the launched seed; later restarts get their own id.
export function buildRaidResult(round,{endedAt=Date.now(),launch=null}={}){
  if(!round||!round.over)return null;
  const raidId=launch?.raidId&&launch.seed===round.seed?launch.raidId:`nodspel:${round.seed}`;
  return {schema:RAID_RESULT_SCHEMA,version:RAID_RESULT_VERSION,raidId,seed:round.seed,
    outcome:OUTCOMES[round.reason]??'timeout',levelsCleared:round.levelsCleared,enemiesDefeated:round.enemiesDefeated,nodesLit:round.nodesLit,
    remainingMs:round.remainingMs,extracted:bagItems(round.extracted),lost:bagItems(round.lost),endedAt};
}
export function writeRaidResult(storage,result){
  if(!storage||!result)return false;
  try{storage.setItem(RAID_RESULT_KEY,JSON.stringify(result));return true;}catch{return false;}
}
const RAID_ID=/^[A-Za-z0-9_.:-]{1,64}$/;
// Return target must be a same-origin relative path: no scheme, no host, no backslashes.
export function safeReturnUrl(value){
  if(typeof value!=='string'||!value||value.length>200)return null;
  if(/[\\\s]/.test(value)||value.startsWith('//')||value.includes(':'))return null;
  if(!/^(\.{1,2}\/|\/)?[A-Za-z0-9._~\/-]*(\?[A-Za-z0-9._~=&%-]*)?(#[A-Za-z0-9_-]*)?$/.test(value))return null;
  return value;
}
export function readLaunch(search){
  const p=new URLSearchParams(search||'');
  const seed=p.get('seed')||null,rawId=p.get('raidId');
  return {seed:seed?seed.slice(0,64):null,raidId:rawId&&RAID_ID.test(rawId)?rawId:null,returnUrl:safeReturnUrl(p.get('return'))};
}
