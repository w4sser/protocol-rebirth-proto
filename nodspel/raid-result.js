// RaidResult v1: the contract core (Node Raid) hands back to meta (base).
// Pure and DOM-free so it can be tested headless. See docs/meta-core-integration.md.
import {bagItems} from './raid.js?v=2.11.1';
import {RULES} from './levels.js?v=2.11.1';
import {bagCap,equippedGear} from './round.js?v=2.11.1';
import {readGoal} from './progression-goal.js?v=2.11.1';
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
    area:round.level?.area??'bunker',...round.hard?{hard:true}:{},outcome:OUTCOMES[round.reason]??'timeout',reason:round.reason,levelsCleared:round.levelsCleared,enemiesDefeated:round.enemiesDefeated,killsByType:{...(round.killsByType??{})},nodesLit:round.nodesLit,
    remainingMs:round.remainingMs,kitPicked:round.kitPicked??0,elapsedMs:Math.max(0,(round.durationMs??round.remainingMs)-round.remainingMs),health:round.health,maxHealth:round.maxHealth,shield:round.shield,maxShield:round.maxShield,extracted:bagItems(round.extracted),lost:bagItems(round.lost),endedAt,
    skills:round.telemetry?{distanceM:Math.round(round.telemetry.distanceM),dashes:round.telemetry.dashes,holdNodes:round.telemetry.holdNodes,damageTaken:Math.round(round.telemetry.damageTaken),searches:round.telemetry.searches||0,healed:Math.round(round.telemetry.healed||0)}:undefined,
    // Equipped gear and backpack items (carried but not equipped) are both at risk: only a win (extract/complete)
    // brings them home, same rule as bag loot (the base app already gates on `extracted`; this is belt and braces).
    ...((round.raidPerksTaken?.length||round.perks?.taken?.length)?{perksTaken:[...new Set([...(round.raidPerksTaken??[]),...(round.perks?.taken??[])])]}:{}),
    ...(round.gearConsumed?.length?{gearConsumed:[...round.gearConsumed]}:{}),
    ...(OUTCOMES[round.reason]!=='extract'&&(equippedGear(round).length||round.backpack?.length)?{equipmentLost:[...equippedGear(round),...(round.backpack??[])]}:{}),
    stats:round.stats,gear:launch?.gear??[],gearOut:OUTCOMES[round.reason]==='extract'?[...equippedGear(round),...(round.backpack??[])]:[],weapon:launch?.weapon?.id??'basic_carbine',kitLeft:{medkit:Math.max(0,round.kit?.medkit??0)},...toolLeft(round,launch)};
}
// The tool slot mirrors kitLeft: what is still unused at the end. Meta returns it on extract and drops it on death.
// Only present when a tool was brought, so tool-less results keep their v1 shape.
function toolLeft(round,launch){const id=round.tool?.id??launch?.tool?.id??null;return id?{toolLeft:{id,n:Math.max(0,Math.floor(round.tool?.charges??0))}}:{};}
export function writeRaidResult(storage,result){
  if(!storage||!result)return false;
  try{storage.setItem(RAID_RESULT_KEY,JSON.stringify(result));return true;}catch{return false;}
}
// Persist before leaving, for every terminal outcome. A standalone/restarted raid
// keeps its own result panel, as does a failed storage or navigation attempt.
export function handoffRaidResult(round,{launch={},storage,navigate=url=>globalThis.location.assign(url),beforeReturn=()=>{}}={}){
  if(!round?.over)return false;
  try{
    if(!writeRaidResult(storage??globalThis.localStorage,buildRaidResult(round,{launch})))return false;
    const target=safeReturnUrl(launch.returnUrl);
    if(!target||!launch.raidId||launch.seed!==round.seed)return false;
    beforeReturn();navigate(target);return true;
  }catch{return false;}
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
    armorShield:p.has('armorShield')&&p.get('armorShield')!==''&&Number.isFinite(Number(p.get('armorShield')))?Math.min(RULES.playerStats.clamp.shield[1],Math.max(0,Number(p.get('armorShield')))):null,
    weapon:readWeapon(p.get('w')),kit:readKit(p.get('kit')),tool:readTool(p.get('tool')),bag:p.get('bag')?bagCap(p.get('bag')):RULES.loot.capacity,goal:readGoal(p.get('goal')),intro:p.get('intro')==='1',hard:p.get('hard')==='1',payoff:readPayoff(p.get('payoff')),quest:readQuest(p.get('quest'))};
}
// ?quest=extract:cable:1:3 | kill:sentry:0:3 | clear:2:0:1 (type:target:progress:n[:level]) -> the tracked chain quest for the HUD chip (anything else -> null).
const QUEST_ENEMIES=['grunt','sentry','rusher'];
export function readQuest(value){
  if(typeof value!=='string'||value.length>60)return null;
  const [type,target,p,n,lvl]=value.split(':'),prog=Math.floor(Number(p)),need=Math.floor(Number(n));
  if(!['extract','kill','clear'].includes(type)||!Number.isFinite(prog)||!Number.isFinite(need)||need<1||need>99||prog<0)return null;
  if(type==='extract'&&!globalThis.DATA?.items?.some(i=>i.id===target))return null;
  if(type==='kill'&&!QUEST_ENEMIES.includes(target))return null;
  if(type==='clear'&&!(Number(target)>=1&&Number(target)<=3))return null;
  const q={type,target:type==='clear'?Number(target):target,prog:Math.min(prog,need),n:need};
  const level=Math.floor(Number(lvl));if(type==='extract'&&lvl!==undefined&&level>=1&&level<=3)q.level=level; // optional 5th field: extract needs levelsCleared >= level-1
  return q;
}
// ?payoff=loot_cluster -> one-time first-upgrade payoff (RULES.payoff keys only; anything else -> null).
export function readPayoff(value){return typeof value==='string'&&Object.hasOwn(RULES.payoff,value)?value:null;}
// ?w=id:rifle_marksman,dmg:2,mag:4,rld:900,int:450,rng:11,cone:5,ast:8,spr:0 -> clamped weapon stats (missing -> Basic).
const WEAPON_KEYS={dmg:'damage',mag:'capacity',rld:'reloadMs',int:'shotIntervalMs',rng:'range',cone:'coneHalfAngleDegrees',ast:'assistAngleDegrees',spr:'spreadDegrees',kb:'knockback',pel:'pellets',hom:'homingDegreesPerSecond'};
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
  for(const k of ['damage','capacity','reloadMs','shotIntervalMs','pellets'])if(k in out)out[k]=Math.round(out[k]);
  return out;
}
// ?kit=medkit:2 -> consumables brought from base (clamped by RULES.kitMax).
export function readKit(value){
  const out={medkit:0};
  if(typeof value!=='string'||value.length>60)return out;
  for(const part of value.split(',')){const [k,v]=part.split(':'),n=Math.floor(Number(v));if(k in RULES.kitMax&&Number.isFinite(n))out[k]=Math.min(RULES.kitMax[k],Math.max(0,n));}
  return out;
}
// ?tool=tool_grenade:2 -> the one toolkit item brought from base; charges clamped to RULES.tools.defs (unknown id -> null).
export function readTool(value){
  if(typeof value!=='string'||value.length>40)return null;
  const [id,v]=value.split(':'),def=Object.hasOwn(RULES.tools.defs,id)?RULES.tools.defs[id]:null,n=Math.floor(Number(v));
  if(!def||!Number.isFinite(n)||n<1)return null;
  return {id,n:Math.min(def.charges,n)};
}
// ?stats=spd:3.9,stl:0.12,hp:115,dcd:3700 -> clamped stats; unknown keys and bad numbers fall back to base.
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
