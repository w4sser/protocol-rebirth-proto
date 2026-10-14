// RaidResult v1: the contract core (Node Raid) hands back to meta (base).
// Pure and DOM-free so it can be tested headless. See docs/meta-core-integration.md.
import {bagItems} from './raid.js?v=1.44.0';
import {RULES} from './levels.js?v=1.44.0';
import {bagCap} from './round.js?v=1.44.0';
export const RAID_RESULT_KEY='pr_raid_result_v1';
export const RAID_RESULT_SCHEMA='protocol-rebirth/raid-result';
export const RAID_RESULT_VERSION=1;
// Meta treats timeout and abandon like death; `reason` keeps the core detail.
const OUTCOMES={complete:'extract',extract:'extract',death:'death',timeout:'timeout',abandon:'death'};
// Only a finished round (round.over) produces a result. Loot secured at any
// level exit counts as extracted even if the player later dies or times out.
// A meta-issued raidId only belongs to the launched seed; later restarts get their own id.
export function buildRaidResult(round,{endedAt=Date.now(),launch=null}={}){
  if(!round||!round.over)return null;
  const raidId=launch?.raidId&&launch.seed===round.seed?launch.raidId:`nodspel:${round.seed}`;
  return {schema:RAID_RESULT_SCHEMA,version:RAID_RESULT_VERSION,raidId,seed:round.seed,
    area:round.level?.area??'bunker',outcome:OUTCOMES[round.reason]??'timeout',reason:round.reason,levelsCleared:round.levelsCleared,enemiesDefeated:round.enemiesDefeated,nodesLit:round.nodesLit,
    remainingMs:round.remainingMs,extracted:bagItems(round.extracted),lost:bagItems(round.lost),endedAt,
    skills:round.telemetry?{distanceM:Math.round(round.telemetry.distanceM),dashes:round.telemetry.dashes,holdNodes:round.telemetry.holdNodes,damageTaken:Math.round(round.telemetry.damageTaken),searches:round.telemetry.searches||0,healed:Math.round(round.telemetry.healed||0)}:undefined,
    stats:round.stats,gear:launch?.gear??[],weapon:launch?.weapon?.id??'basic_carbine',kitLeft:{medkit:Math.max(0,round.kit?.medkit??0)}};
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
  return {seed:seed?seed.slice(0,64):null,raidId:rawId&&RAID_ID.test(rawId)?rawId:null,returnUrl:safeReturnUrl(p.get('return')),
    stats:readStats(p.get('stats')),gear:(p.get('gear')||'').split(',').filter(id=>RULES.playerStats.gear.includes(id)).slice(0,4),
    weapon:readWeapon(p.get('w')),kit:readKit(p.get('kit')),bag:p.get('bag')?bagCap(p.get('bag')):RULES.loot.capacity};
}
// ?w=id:rifle_marksman,dmg:2,mag:4,rld:900,int:450,rng:11,cone:5,ast:8,spr:0 → clamped weapon stats (missing → Basic).
const WEAPON_KEYS={dmg:'damage',mag:'capacity',rld:'reloadMs',int:'shotIntervalMs',rng:'range',cone:'coneHalfAngleDegrees',ast:'assistAngleDegrees',spr:'spreadDegrees'};
export function readWeapon(value){
  if(typeof value!=='string'||!value||value.length>160)return null;
  const out={};
  for(const part of value.split(',')){
    const [k,v]=part.split(':');
    if(k==='id'){if(RULES.weaponIds.includes(v))out.id=v;continue;}
    const key=WEAPON_KEYS[k],n=Number(v);
    if(!key||v===undefined||v===''||!Number.isFinite(n))continue;
    const [lo,hi]=RULES.weaponClamp[key];out[key]=Math.min(hi,Math.max(lo,n));
  }
  if(!out.id)return null;
  for(const k of ['damage','capacity','reloadMs','shotIntervalMs'])if(k in out)out[k]=Math.round(out[k]);
  return out;
}
// ?kit=medkit:2 → consumables brought from base (clamped by RULES.kitMax).
export function readKit(value){
  const out={medkit:0};
  if(typeof value!=='string'||value.length>60)return out;
  for(const part of value.split(',')){const [k,v]=part.split(':'),n=Math.floor(Number(v));if(k in RULES.kitMax&&Number.isFinite(n))out[k]=Math.min(RULES.kitMax[k],Math.max(0,n));}
  return out;
}
// ?stats=spd:3.9,stl:0.12,hp:115,dcd:3700 → clamped stats; unknown keys and bad numbers fall back to base.
const STAT_KEYS={spd:'speed',stl:'stealth',hp:'maxHealth',dcd:'dashCooldownMs',srch:'searchMult',shd:'shield'};
export function readStats(value){
  const P=RULES.playerStats,out={...P.base};
  if(typeof value!=='string'||value.length>120)return out;
  for(const part of value.split(',')){
    const [k,v]=part.split(':'),key=STAT_KEYS[k],n=Number(v);
    if(!key||v===undefined||v===''||!Number.isFinite(n))continue;
    const [lo,hi]=P.clamp[key];out[key]=Math.min(hi,Math.max(lo,n));
  }
  out.maxHealth=Math.round(out.maxHealth);out.shield=Math.round(out.shield);out.dashCooldownMs=Math.round(out.dashCooldownMs);
  return out;
}
