// Local-only raid telemetry for Robert's external playtests (PR 0, docs/run-log.md). Pure, DOM-free,
// no outbound network of any kind -- nothing leaves the device (see scripts/bug-lint.mjs run-log-no-network).
// game.mjs wires this at the real gameplay call sites; this module only knows the compact JSON shape
// and how to keep it small in localStorage. Storage is passed in, never read from a bare global, so
// this stays testable with a fake storage object (same convention as item-hints.js hasSeenMaterial).
export const RUN_LOG_KEY='pr_runlog_v1';
const MAX_EVENTS=200;
const MAX_RAIDS=20;
const IDLE_GAP_MS=8000;

// ua is the raw navigator.userAgent string -- classified down to one of three buckets so the stored
// log never carries a full UA string (device/browser fingerprinting surface), only the shape Robert needs.
export function classifyUserAgent(ua=''){
  const s=String(ua||'');
  if(/iPad|iPhone|iPod/.test(s))return 'ios';
  if(/Android/i.test(s))return 'android';
  return 'desktop';
}
export function buildDeviceInfo({width=0,height=0,dpr=1,coarsePointer=false,userAgent=''}={}){
  return {w:Math.round(width)||0,h:Math.round(height)||0,dpr:Math.round((dpr||1)*100)/100,touch:!!coarsePointer,ua:classifyUserAgent(userAgent)};
}

// One raid's record. mode: 'depth'|'node'. area: e.g. 'bunker'. device: buildDeviceInfo() output.
export function createRunLog({v,raidId,seed,mode,ftue=false,area='bunker',device={}}={}){
  return {v,raidId,seed,mode,ftue:!!ftue,area,device,events:[],idleGaps:0,totals:null,_lastActivityMs:0,_firsts:{}};
}

function pushCapped(log,entry){
  if(!log||log.events.length>=MAX_EVENTS)return log;
  log.events.push(entry);
  return log;
}
// t: ms since raid start, game clock (paused time excluded) -- never wall clock. Every recordX below
// is a thin wrapper so call sites in game.mjs never need to spell out an event's field names.
export function recordEvent(log,type,fields,ms){
  if(!log)return log;
  return pushCapped(log,{t:Math.max(0,Math.round(ms)||0),type,...fields});
}
// first_move/first_shot/first_hit/first_kill: recorded once, the first time each is reached.
export function recordFirst(log,type,ms){
  if(!log||log._firsts[type])return log;
  log._firsts[type]=true;
  return recordEvent(log,type,{},ms);
}
export function recordAreaEntered(log,zone,ms){return recordEvent(log,'area_entered',{zone},ms);}
// clearMs: time spent in the zone before it cleared (not wall time since raid start -- that's `ms`/`t`).
export function recordAreaCleared(log,zone,clearMs,ms){return recordEvent(log,'area_cleared',{zone,ms:Math.max(0,Math.round(clearMs)||0)},ms);}
export function recordDoorPassed(log,zone,how,ms){return recordEvent(log,'door_passed',{zone,how},ms);}
export function recordChoice(log,zone,kind,ms){return recordEvent(log,'choice',{zone,kind},ms);}
// Depth timeline: hack_start/hack_done carry {zone}; door_passed.how is clear, hack or key.
export function recordExtract(log,zone,cleared,ms){return recordEvent(log,'extract',{zone,cleared:!!cleared},ms);}
export function recordDeath(log,cause,zone,ms){return recordEvent(log,'death',{cause,zone},ms);}
export function recordTimeout(log,ms){return recordEvent(log,'timeout',{},ms);}
export function recordLootCollected(log,item,rarity,value,ms){return recordEvent(log,'loot_collected',{item,rarity,value:Math.round(value)||0},ms);}
export function recordPauseOpen(log,ms){return recordEvent(log,'pause_open',{},ms);}

// Idle-gap tracking for FTUE metrics: call only on an actual move/shoot input, never every frame.
// Counts a gap whenever more than IDLE_GAP_MS passes between two activity ticks (closed gaps only;
// finishRunLog below also closes a trailing gap running into the raid's end).
export function noteActivity(log,ms){
  if(!log)return;
  const m=Math.max(0,Math.round(ms)||0);
  if(log._lastActivityMs!=null&&m-log._lastActivityMs>IDLE_GAP_MS)log.idleGaps++;
  log._lastActivityMs=m;
}

// outcome: 'extracted'|'died'|'timeout'|'abandoned'. Call exactly once, when the raid is actually over.
export function finishRunLog(log,{outcome,durationMs=0,zonesReached=0,enemiesKilled=0,shotsFired=0,shotsHit=0,damageTaken=0,lootValue=0}={}){
  if(!log)return log;
  const dur=Math.max(0,Math.round(durationMs)||0);
  if(log._lastActivityMs!=null&&dur-log._lastActivityMs>IDLE_GAP_MS)log.idleGaps++;
  log.totals={outcome,durationMs:dur,zonesReached,enemiesKilled,shotsFired,shotsHit,damageTaken:Math.round(damageTaken)||0,lootValue:Math.round(lootValue)||0,idleGaps:log.idleGaps};
  return log;
}

function stripInternal(log){
  const {_lastActivityMs,_firsts,...rest}=log;
  return rest;
}

export function loadRunLogs(storage=globalThis.localStorage){
  try{
    const list=JSON.parse(storage?.getItem(RUN_LOG_KEY)||'[]');
    return Array.isArray(list)?list:[];
  }catch{return [];}
}
// Appends the finished log and keeps only the last MAX_RAIDS entries. Safe under quota errors and
// private-mode storage (returns the best-effort in-memory list either way; never throws).
export function saveRunLog(log,storage=globalThis.localStorage){
  const list=[...loadRunLogs(storage),stripInternal(log)].slice(-MAX_RAIDS);
  try{storage?.setItem(RUN_LOG_KEY,JSON.stringify(list));}catch{}
  return list;
}
export function clearRunLogs(storage=globalThis.localStorage){
  try{storage?.removeItem(RUN_LOG_KEY);}catch{}
}
