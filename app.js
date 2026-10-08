/* Protocol Rebirth — Meta Prototype v0.1
   All economy values live in /data/*.js. This file contains logic + UI only.
   State mutations go through act() so the event log is complete. */
"use strict";

/* ---------- data access ---------- */
const D = window.DATA;
const ITEMS = {}; D.items.forEach(i => ITEMS[i.id] = i);
const MODS  = {}; D.modules.forEach(m => MODS[m.id] = m);
const ZONES = {}; D.raidZones.forEach(z => ZONES[z.id] = z);
const PROG  = D.progression;
const SAVE_KEY = "pr_meta_save";
const SAVE_VERSION = 7;   // v7 adds explicit panoramic room unlock state

/* ---------- state ---------- */
let S = null;          // persistent state
let session = { pendingRaid:null, prep:null, screen:"base", screenParam:null, devForce:null, camera:null, plateStage:null, cameraResize:null, devPlateStage:null, cameraLayout:null };

function freshState(){
  const st = {
    v:SAVE_VERSION, beat:0,
    cur: Object.assign({}, PROG.start.currencies),
    stash: Object.assign({}, PROG.start.stash),
    reserved: {}, secureItem: null,
    modules: {}, bondXp: 0,
    tracked: null, trackedStreak: 0,
    zoneIntel: {}, raids: 0, deaths: 0,
    revealed: { scrap: true }, surveyDone: false, surveyAnswers: {}, styles: {},
    retentionMode: D.retention.defaultMode,
    fuel: D.retention.fuel.max, fuelAt: Date.now(),
    streak: 0, lastDay: "", lastYieldAt: 0,
    expedition: null, decrypt: null, loreUnlocked: 0,
    contracts: {}, contractsDay: "", pendingReport: [],
    baseState: D.baseStates[0].id, roomUnlocks: {}, introSeen: false,
    log: []
  };
  D.modules.forEach(m => st.modules[m.id] = 0);
  return st;
}
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw){
      const st = JSON.parse(raw);
      if(st.v === 6){ migrateState(st); localStorage.setItem(SAVE_KEY, JSON.stringify(st)); }
      if(st.v === SAVE_VERSION){ st.roomUnlocks = st.roomUnlocks || {}; return st; }
    }
  }catch(e){}
  return freshState();
}
function migrateState(st){
  if(st.v !== 6) return st;
  // v6 exposed every powered room. Preserve that access and all economy state
  // while introducing explicit ordered unlocks rather than resetting the save.
  st.roomUnlocks = {};
  if(st.baseState !== "core_found") for(const room of D.baseMap.rooms.slice(0, 3)) st.roomUnlocks[room.id] = true;
  if(st.baseState === "core_refined") st.roomUnlocks.living_quarters = true;
  st.v = SAVE_VERSION;
  return st;
}
function log(action, payload){
  S.log.push({ t: Date.now(), action, payload: payload || {} });
}
function act(action, payload){ log(action, payload); if(S.retentionMode) contractHook(action); save(); }

/* ---------- derived ---------- */
function coreLevel(){ return S.modules.rebirth_core || 0; }
function bitOnline(){ return (S.modules.bit_bay || 0) >= 1; }
function bondLevel(){
  if(!bitOnline()) return 0;
  let lvl = 1;
  for(const b of D.bit.bondLevels){ if(S.bondXp >= b.xp) lvl = b.level; }
  return lvl;
}
function stashCapacity(){
  return D.baseStashCapacity + (S.modules.storage >= 1 ? D.storageBonus : 0);
}
function stashSlotsUsed(){
  let n = 0;
  for(const id in S.stash){ if(S.stash[id] > 0) n += Math.ceil(S.stash[id] / (ITEMS[id].stackSize||1)); }
  return n;
}
function have(id){ return S.stash[id] || 0; }
function addItem(id, qty){ S.stash[id] = (S.stash[id]||0) + qty; }
function removeItem(id, qty){
  S.stash[id] = Math.max(0, (S.stash[id]||0) - qty);
  if(S.reserved[id] && S.stash[id] < 1) delete S.reserved[id];
  if(S.secureItem === id && S.stash[id] < 1) S.secureItem = null;
}
function nextLevelDef(modId){
  const m = MODS[modId], cur = S.modules[modId] || 0;
  return m.levels.find(l => l.level === cur + 1) || null;
}
function moduleCap(modId){
  // The Rebirth Core is not gated by its own level — the cap concept gates OTHER
  // modules by core level, so the core would otherwise lock itself out of L2.
  if(modId === "rebirth_core") return 99;
  const m = MODS[modId];
  return m.maxLevelByCore[String(coreLevel())] ?? 0;
}
function moduleVisible(modId){ return coreLevel() >= MODS[modId].revealedAtCore; }
function baseState(){
  return D.baseStates.find(st => st.id === S.baseState) || D.baseStates[0];
}
function baseAllows(kind, id){ return (baseState()[kind] || []).includes(id); }

function roomDef(id){ return D.baseMap.rooms.find(r => r.id === id); }
function roomUnlocked(id){ return !!(S.roomUnlocks && S.roomUnlocks[id]); }
function roomRequirementMet(room){
  const req = room.requirement || {};
  if(req.baseState && S.baseState !== req.baseState && S.baseState !== "core_refined") return false;
  if(req.module && (S.modules[req.module] || 0) < (req.level || 1)) return false;
  const prior = D.baseMap.rooms[room.stage - 2];
  return !prior || roomUnlocked(prior.id);
}
function nextAccessRoom(){
  return D.baseMap.rooms.find(room => !roomUnlocked(room.id) && roomRequirementMet(room));
}
function guidedRaid(){ return (S.modules[PROG.raidPrepUnlockModule] || 0) < 1; }
function applyStarterRaid(){
  const cfg = PROG.starterRaid;
  Object.assign(session.prep, { zoneId:cfg.zoneId, routeId:cfg.routeId, riskId:cfg.riskId, insuranceId:cfg.insuranceId });
  session.prep.loadout = Object.fromEntries(Object.entries(cfg.loadout).map(([slot,id]) => [slot,id && have(id) ? id : null]));
}
function roomPartsHtml(room){
  const next = room && room.destination && nextLevelDef(room.destination);
  if(!next) return "";
  return costParts(next.cost).map(part => '<span class="chip ' + (part.have >= part.need ? 'ok' : 'need') + '">' +
    esc(part.kind === "item" ? ITEMS[part.id].name : (part.id === "dataCores" ? "Data Cores" : "Salvage")) + ' ' + Math.min(part.have,part.need) + '/' + part.need + '</span>').join(' ');
}
function bunkerStage(){
  let stage = 0;
  for(const room of D.baseMap.rooms) if(roomUnlocked(room.id)) stage = Math.max(stage, room.stage);
  return stage;
}
function transitionBaseState(target, reason){
  if(S.baseState === target) return false;
  const current = baseState();
  const transition = (current.transitions || []).find(t => t.target === target);
  if(!transition) return false;
  if(transition.module && (!reason || transition.module !== reason.module || transition.level !== reason.level)) return false;
  if(transition.module && (S.modules[transition.module] || 0) < transition.level) return false;
  if(Object.entries(transition.modules || {}).some(([id, level]) => (S.modules[id] || 0) < level)) return false;
  S.baseState = target;
  act("BASE_STATE_CHANGED", { from:current.id, to:target, reason:reason || {} });
  return true;
}
function advanceBaseState(reason){
  let changed = false, transition;
  while((transition = (baseState().transitions || []).find(t =>
    (!t.module || (reason && t.module === reason.module && t.level === reason.level)) &&
    (!t.module || (S.modules[t.module] || 0) >= t.level) &&
    !Object.entries(t.modules || {}).some(([id, level]) => (S.modules[id] || 0) < level)))){
    if(!transitionBaseState(transition.target, reason)) break;
    changed = true;
  }
  return changed;
}
function costParts(cost){
  const parts = [];
  if(cost.salvage) parts.push({ kind:"cur", id:"salvage", need:cost.salvage, have:S.cur.salvage });
  if(cost.dataCores) parts.push({ kind:"cur", id:"dataCores", need:cost.dataCores, have:S.cur.dataCores });
  for(const id in (cost.items||{})) parts.push({ kind:"item", id, need:cost.items[id], have:have(id) });
  return parts;
}
function canAfford(cost){ return costParts(cost).every(p => p.have >= p.need); }
function payCost(cost){
  if(cost.salvage) S.cur.salvage -= cost.salvage;
  if(cost.dataCores) S.cur.dataCores -= cost.dataCores;
  for(const id in (cost.items||{})) removeItem(id, cost.items[id]);
}
function trackedMissingItem(){
  if(!S.tracked) return null;
  const def = MODS[S.tracked.module].levels.find(l => l.level === S.tracked.level);
  if(!def) return null;
  for(const id in (def.cost.items||{})){
    if(have(id) < def.cost.items[id]) return { itemId:id, need:def.cost.items[id], have:have(id) };
  }
  return null;
}
function curBeat(){ return PROG.beats[S.beat]; }
function advanceBeat(){
  if(S.beat < PROG.beats.length - 1){
    S.beat++;
    act("BEAT_ADVANCED", { beat: curBeat().id });
    const b = curBeat();
    if(b.autoTrack){ S.tracked = { module:b.autoTrack.module, level:b.autoTrack.level }; act("TRACK_SET", S.tracked); }
  }
}

/* ---------- BIT ---------- */
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function bitLine(trigger, vars){
  const pool = bitOnline() ? (D.bit.dialogue[trigger] || D.bit.dialogue.idle_base) : D.bit.dialogue.bit_offline;
  let line = pick(pool);
  if(vars) for(const k in vars) line = line.replace("{"+k+"}", vars[k]);
  return line;
}
function bitDock(trigger, vars){
  const dock = document.getElementById("bitdock");
  if(baseState().lighting === "emergency"){ dock.style.display = "none"; return; }
  dock.style.display = "flex";
  document.getElementById("bitface").className = (bitOnline() && !bitAway()) ? "" : "off";
  if(bitAway()){
    document.getElementById("bitline").textContent = "[BIT is in the field — back in ~" + Math.max(0, Math.ceil((S.expedition.returnAt - Date.now())/1000)) + "s]";
    return;
  }
  const miss = trackedMissingItem();
  let line;
  if(trigger) line = bitLine(trigger, vars);
  else if(miss) line = bitLine("missing_part", { item: ITEMS[miss.itemId].name, zone: bestZoneFor(miss.itemId).name });
  else line = bitLine("idle_base");
  document.getElementById("bitline").textContent = line;
}
function bestZoneFor(itemId){
  let best = D.raidZones[0], bw = -1;
  for(const z of D.raidZones){
    if(coreLevel() < z.unlockedAtCore) continue;
    const e = z.lootTable.find(l => l.itemId === itemId);
    if(e && e.weight > bw){ bw = e.weight; best = z; }
  }
  return best;
}

/* ---------- retention layer (data/retention.js; gated by retentionMode) ---------- */
function retMode(){ return S.retentionMode || D.retention.defaultMode; }
function bitAway(){ return !!S.expedition; }
function dayStr(){ return new Date().toDateString(); }
function tickRetention(){
  const R = D.retention, now = Date.now();
  if(retMode() === "full"){
    const gain = Math.floor((now - S.fuelAt) / (R.fuel.regenSec*1000));
    if(S.fuel >= R.fuel.max){ S.fuelAt = now; }
    else if(gain > 0){ S.fuel = Math.min(R.fuel.max, S.fuel + gain); S.fuelAt = now; }
  }
  if(S.expedition && now >= S.expedition.returnAt){
    const exp = S.expedition; S.expedition = null;
    let row;
    if(Math.random() < R.expedition.failChance){
      row = { txt:"BIT's expedition failed. He does not want to talk about it.", item:null };
    } else {
      const id = (exp.trackedItemId && Math.random() < R.expedition.trackedBias)
        ? exp.trackedItemId : pick(R.expedition.fallbackLoot);
      addItem(id, 1);
      row = { txt:"BIT's expedition: found 1× " + ITEMS[id].name + ".", item:id };
    }
    S.pendingReport.push(row);
    act("EXPEDITION_RETURNED", { item: row.item });
  }
  if(S.decrypt && now >= S.decrypt.returnAt){
    S.decrypt = null;
    const lore = D.protocolLog[Math.min(S.loreUnlocked, D.protocolLog.length-1)];
    S.loreUnlocked++;
    S.pendingReport.push({ txt:"Decryption complete — " + lore.title + ": " + lore.text, lore: lore.id });
    act("DECRYPT_DONE", { lore: lore.id });
  }
}
function morningRows(){
  const R = D.retention, rows = [];
  if(retMode() === "core"){ S.pendingReport = []; return rows; }
  const today = dayStr();
  if(retMode() === "full" && S.lastDay && S.lastDay !== today){
    S.streak++;
    rows.push("Day streak: " + (S.streak + 1) + ". BIT counted. BIT always counts.");
  }
  if(S.lastDay !== today) S.lastDay = today;
  if(retMode() === "full" && (S.modules.fabricator||0) >= 1 && S.lastYieldAt &&
     Date.now() - S.lastYieldAt > R.morning.minAwayMin*60*1000){
    const y = R.morning.yieldScrapPerFabLevel * S.modules.fabricator;
    S.cur.scrap += y;
    S.lastYieldAt = Date.now();
    rows.push("Fabricator ran while you were away: +" + y + " Scrap.");
  }
  for(const r of S.pendingReport) rows.push(r.txt);
  S.pendingReport = [];
  return rows;
}
function contractsUnlocked(){
  if(retMode() !== "full") return false;
  const idx = PROG.beats.findIndex(b => b.id === D.retention.contracts.unlockAfterBeat);
  return S.beat >= idx;
}
function contractHook(action){
  if(!contractsUnlocked() || action === "CONTRACT_DONE") return;
  const today = dayStr();
  if(S.contractsDay !== today){ S.contractsDay = today; S.contracts = {}; }
  for(const c of D.retention.contracts.daily){
    if(c.action === action && !S.contracts[c.id]){
      S.contracts[c.id] = "done";
      log("CONTRACT_DONE", { id: c.id });
    }
  }
}
function fuelGate(){
  if(retMode() !== "full") return { ok:true, siphon:false };
  if(S.fuel > 0) return { ok:true, siphon:false };
  const c = closestUpgrade();
  if(c && c.pct >= D.retention.fuel.siphonPct) return { ok:true, siphon:true };
  return { ok:false, siphon:false };
}

/* ---------- routes & search intel ---------- */
function routeOf(zone, routeId){
  return (zone.routes || []).find(r => r.id === routeId) || (zone.routes || [])[0] ||
    { id:"direct", name:"Direct", threat:zone.threat, extractMod:1, lootSlotMod:0, weightMult:{}, families:zone.likelyFamilies||[], desc:"" };
}
function effTable(zone, route, rareMult){
  return zone.lootTable.map(l => {
    const fam = ITEMS[l.itemId].family;
    let w = l.weight * (route.weightMult && route.weightMult[fam] !== undefined ? route.weightMult[fam] : 1);
    if(rareMult && rareMult[fam]) w *= rareMult[fam];
    return { itemId: l.itemId, weight: w };
  });
}
function rollFromTable(table){
  const total = table.reduce((s,l)=>s+l.weight,0);
  let r = Math.random()*total;
  for(const l of table){ r -= l.weight; if(r <= 0) return l.itemId; }
  return table[0].itemId;
}
function trackedChanceP(itemId, zone, route, slots){
  const table = effTable(zone, route);
  const total = table.reduce((s,l)=>s+l.weight,0);
  const e = table.find(l=>l.itemId===itemId);
  if(!e || !total || !e.weight) return 0;
  return 1 - Math.pow(1 - e.weight/total, slots);
}
function chanceLabel(p){
  for(const c of D.raidConfig.chanceLabels){ if(p >= c.min) return c.label; }
  return "Low";
}
function bestLead(itemId){
  let best = null;
  const std = D.riskLevels.find(r=>r.id==="standard");
  for(const z of D.raidZones){
    if(coreLevel() < z.unlockedAtCore) continue;
    for(const rt of (z.routes||[])){
      const slots = Math.max(1, std.lootSlots + (rt.lootSlotMod||0) + (bitOnline() && !bitAway() ? 1 : 0));
      const p = trackedChanceP(itemId, z, rt, slots);
      if(!best || p > best.p) best = { zone:z, route:rt, p };
    }
  }
  if(best) best.label = chanceLabel(best.p);
  return best;
}
function lootValue(loot){ return loot.reduce((s,id)=>s+(ITEMS[id].sellValue||0),0); }
function raidCtx(R){
  return { zone:R.zone, route:R.cfg.routeId, tracked:R.cfg.trackedItemId||null, risk:R.cfg.riskId,
    lootValue:lootValue(R.loot), trackedFound:!!R.trackedFound, mode:retMode() };
}

/* ---------- raid resolution (§4 of spec) ---------- */
function resolveRaid(cfg){
  // cfg: {zoneId, routeId, riskId, loadout:[itemIds], insuranceId, trackedItemId}
  // The player chose zone + route + risk. The rolls below decide everything else.
  const zone = ZONES[cfg.zoneId];
  const route = routeOf(zone, cfg.routeId);
  cfg.routeId = route.id;
  const risk = D.riskLevels.find(r => r.id === cfg.riskId);
  const beat = curBeat();
  let chance = Math.min(zone.baseExtractChance * risk.extractMod * (route.extractMod||1), risk.extractCap);
  const forced = beat.type === "raid" && beat.forceOutcome && cfg.riskId !== beat.forceExceptRisk;
  let outcome;
  if(session.devForce){ outcome = session.devForce; session.devForce = null; }
  else if(forced){ outcome = beat.forceOutcome; }
  else outcome = Math.random() < chance ? "extract" : "death";

  // loot — weighted rolls from the route-modified zone table
  const table = effTable(zone, route);
  const totalW = table.reduce((s,l)=>s+l.weight,0);
  const slots = Math.max(1, risk.lootSlots + (route.lootSlotMod||0) + (bitOnline() && !bitAway() ? 1 : 0));
  const loot = [];
  for(let i=0;i<slots;i++){
    let id;
    if(i===0 && cfg.trackedItemId && table.some(l=>l.itemId===cfg.trackedItemId && l.weight>0)){
      const e = table.find(l=>l.itemId===cfg.trackedItemId);
      id = Math.random() < Math.min((e.weight*3)/totalW, 0.9) ? cfg.trackedItemId : rollFromTable(table);
    } else id = rollFromTable(table);
    loot.push(id);
  }
  // pity: guaranteed by Nth consecutive tracked raid (unchanged rules)
  if(cfg.trackedItemId && !loot.includes(cfg.trackedItemId)
     && S.trackedStreak + 1 >= (bondLevel() >= 5 ? 1 : PROG.trackedPityRaids)
     && zone.lootTable.some(l=>l.itemId===cfg.trackedItemId)){
    loot[0] = cfg.trackedItemId;
  }
  // beat guaranteed drops always injected
  (beat.guaranteedDrops||[]).forEach((id,ix) => { if(!loot.includes(id)) loot[Math.min(ix, loot.length-1) + (ix?1:0)] = id; });
  (beat.guaranteedDrops||[]).forEach(id => { if(!loot.includes(id)) loot.push(id); });
  const trackedFound = !!cfg.trackedItemId && loot.includes(cfg.trackedItemId);

  const salvage = randInt(zone.salvageRange[0], zone.salvageRange[1]);
  const dataCores = randInt(zone.dataCoresOnExtract[0], zone.dataCoresOnExtract[1]);
  const valuableFound = loot.some(id => ITEMS[id].rarity === "protocol" || ITEMS[id].rarity === "valuable");
  const R = { cfg, zone: zone.id, outcome, loot, salvage, dataCores, trackedFound, forced };
  // one meaningful mid-raid decision: only on live (unforced) successful raids with tracked/valuable loot
  R.decision = { eligible: outcome === "extract" && !forced && (trackedFound || valuableFound), resolved: false };
  return R;
}
function rollPushDeeper(R){
  const pd = D.raidConfig.pushDeeper;
  const zone = ZONES[R.zone];
  const route = routeOf(zone, R.cfg.routeId);
  if(Math.random() < pd.deathChanceAdd){
    R.outcome = "death";
    R.pushedAndDied = true;
    return { died: true, extra: [] };
  }
  const table = effTable(zone, route, pd.rareFamilyMult);
  const extra = [];
  for(let i=0;i<pd.extraSlots;i++){ const id = rollFromTable(table); extra.push(id); R.loot.push(id); }
  R.trackedFound = R.trackedFound || (!!R.cfg.trackedItemId && R.loot.includes(R.cfg.trackedItemId));
  return { died: false, extra };
}

/* ---------- Agency v0.7 — staged raids ---------- */
// How many escalating checkpoints this route/risk produces (1-3). 1 = no decision
// (short safe route ends fast); 2-3 = one or two extract-vs-push checkpoints.
function stageCount(cfg){
  const cp = D.raidConfig.checkpoints;
  const zone = ZONES[cfg.zoneId];
  const route = routeOf(zone, cfg.routeId);
  const risk = D.riskLevels.find(r => r.id === cfg.riskId);
  let n = cp.baseStages;
  if((route.lootSlotMod||0) >= cp.deepRouteSlotMod) n++;
  if((route.lootSlotMod||0) <  cp.shortRouteSlotMod) n--;
  if(cp.aggressiveAddsStage && risk.id === "aggressive") n++;
  return Math.max(1, Math.min(cp.maxStages, n));
}
// Split a fully-resolved raid R into N stages the player reveals one at a time.
// Loot/salvage/cores accumulate as you go deeper; death only happens on a PUSH.
function planStages(R, n){
  n = n || stageCount(R.cfg);
  const loot = R.loot.slice();
  const stages = [];
  for(let i=0;i<n;i++){
    const take = Math.ceil(loot.length / (n - i));
    stages.push({ loot: loot.splice(0, take),
      salvage: Math.round(R.salvage / n), dataCores: Math.round(R.dataCores / n) });
  }
  if(loot.length) stages[stages.length-1].loot.push(...loot);
  return { stages, n, pushDeath: D.raidConfig.checkpoints.pushDeathChance };
}
// Qualitative chance the tracked item shows up in the not-yet-revealed stages.
// Honest probability, never a promise ("higher chance deeper", not "it's there").
function trackedDeeperLabel(cfg, revealedStages, totalStages){
  if(!cfg.trackedItemId) return null;
  const zone = ZONES[cfg.zoneId], route = routeOf(zone, cfg.routeId);
  const risk = D.riskLevels.find(r => r.id === cfg.riskId);
  const remainingSlots = Math.max(1, (risk.lootSlots + (route.lootSlotMod||0)) * (totalStages - revealedStages) / totalStages);
  return chanceLabel(trackedChanceP(cfg.trackedItemId, zone, route, remainingSlots));
}
function randInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }

function applyRaidResult(R){
  const progress = [];
  S.raids++;
  revealCurrency("salvage");
  S.zoneIntel[R.zone] = (S.zoneIntel[R.zone]||0) + 1;
  progress.push("Zone intel: " + ZONES[R.zone].name + " +1");
  const bondBefore = bondLevel();

  if(R.outcome === "extract"){
    R.loot.forEach(id => addItem(id,1));
    R.cfg.loadout.forEach(id => addItem(id,1)); // gear comes home
    S.cur.salvage += R.salvage;
    S.cur.dataCores += R.dataCores;
    progress.push("+" + R.salvage + " Salvage, +" + R.dataCores + " Data Cores");
    if(bitOnline()){ S.bondXp += D.bit.xpPerExtract; progress.push("BIT Bond +" + D.bit.xpPerExtract + " XP"); }
    act("EXTRACT_COMPLETE", { zone:R.zone, loot:R.loot, salvage:R.salvage, dataCores:R.dataCores, tracked:R.trackedFound });
  } else {
    S.deaths++;
    // survivors
    R.saved = { insured:[], secure:null, bitRescue:null };
    const ins = PROG.insurance.tiers.find(t => t.id === R.cfg.insuranceId) || PROG.insurance.tiers[0];
    const sorted = [...R.cfg.loadout].sort((a,b)=>(ITEMS[b].sellValue)-(ITEMS[a].sellValue));
    for(let i=0;i<ins.recovers && i<sorted.length;i++){ R.saved.insured.push(sorted[i]); addItem(sorted[i],1); }
    if(S.secureItem && R.cfg.loadout.includes(S.secureItem) && !R.saved.insured.includes(S.secureItem)){
      R.saved.secure = S.secureItem; addItem(S.secureItem,1);
    }
    if(bondLevel() >= 3 && R.loot.length){ R.saved.bitRescue = R.loot[0]; addItem(R.loot[0],1); }
    const halfSalvage = Math.floor(R.salvage/2);
    S.cur.salvage += halfSalvage;
    progress.push("+" + halfSalvage + " Salvage (recovered)");
    if(bitOnline()){ S.bondXp += D.bit.xpPerDeath; progress.push("BIT Bond +" + D.bit.xpPerDeath + " XP"); }
    act("PLAYER_DIED", { zone:R.zone, lost:R.cfg.loadout, insured:R.saved.insured, secure:R.saved.secure });
  }
  // tracked bookkeeping
  if(R.cfg.trackedItemId){
    S.trackedStreak = R.trackedFound && R.outcome==="extract" ? 0 : S.trackedStreak + 1;
  }
  const miss = trackedMissingItem();
  if(S.tracked && miss) progress.push("Tracked: " + MODS[S.tracked.module].name + " L" + S.tracked.level + " — need " + (miss.need - miss.have) + "× " + ITEMS[miss.itemId].name);
  else if(S.tracked) progress.push("Tracked upgrade: ALL PARTS FOUND — go build it");
  if(bondLevel() > bondBefore){ R.bondUp = bondLevel(); progress.push("BIT BOND LEVEL UP → " + bondLevel()); }
  R.progress = progress;
  // beat advance on extraction during raid beats
  const b = curBeat();
  if(b.type === "raid" && R.outcome === "extract") advanceBeat();
  save();
}

/* ---------- UI helpers ---------- */
const $app = () => document.getElementById("app");
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function toast(msg){
  const t = document.createElement("div");
  t.className = "toastmsg"; t.textContent = msg;
  document.getElementById("toast").appendChild(t);
  setTimeout(()=>t.remove(), 2600);
}
function overlay(html, onClose){
  const o = document.createElement("div");
  o.id = "overlay";
  o.innerHTML = '<div class="inner payoff">' + html + '</div>';
  o.addEventListener("click", e => {
    if(e.target.dataset.close !== undefined || e.target.id === "ovclose"){ o.remove(); if(onClose) onClose(); }
  });
  document.getElementById("phone").appendChild(o);
  return o;
}
function bootSequence(next, done){
  const lines = ["> emergency power detected",
                 "> rerouting grid . . .",
                 "> core temperature nominal",
                 "> lighting: sector A . . . ok",
                 "> CORE ONLINE"];
  const o = overlay('<div class="boot" id="bootseq"></div>', done);
  lines.forEach((l,i)=> setTimeout(()=>{
    const el = document.getElementById("bootseq");
    if(el) el.innerHTML += '<div>' + esc(l) + '</div>';
  }, 500 + i*750));
  setTimeout(()=>{
    const el = document.getElementById("bootseq");
    if(!el) return;
    document.body.classList.remove("base-dark");
    let dust = '<div class="dustwrap">';
    for(let i=0;i<10;i++) dust += '<i style="left:' + (5+Math.random()*90) + '%;animation-delay:' + (Math.random()*0.9) + 's"></i>';
    dust += '</div>';
    el.innerHTML += '<div class="bootflash">█ POWER RESTORED █</div>' + dust +
      '<p style="margin:12px 0;font-size:13px;color:var(--txt)">' + esc(next.unlockText) + '</p>' +
      '<p class="small" style="margin-bottom:8px">BIT: lights. i missed lights.</p>' +
      '<div class="card" style="text-align:left"><span class="ok">NEW BENEFIT</span><br>' + esc(next.benefitText || "") + '</div>' +
      '<div class="card" style="text-align:left"><span class="trackc">NEW GOAL</span><br>' + esc(next.newGoal) + '</div>' +
      '<button class="primary" data-close>ENTER THE FACILITY</button>';
  }, 500 + lines.length*750 + 300);
  return o;
}

function fakeAd(label, onDone){
  let sec = 3;
  const o = overlay('<h1>ADVERTISEMENT</h1><p class="sub">' + esc(label) + '</p><div style="font-size:44px;margin:26px 0" id="adcount">3</div><p class="small">(fake ad — prototype)</p>');
  act("AD_STARTED", { label });
  const iv = setInterval(()=>{
    sec--;
    const el = document.getElementById("adcount");
    if(el) el.textContent = sec;
    if(sec <= 0){ clearInterval(iv); o.remove(); act("AD_COMPLETED", { label }); onDone(); }
  }, 1000);
}
function goalBarHtml(){
  const b = curBeat();
  return '<div class="goalbar">CURRENT GOAL<br><b>' + esc(b.goalText) + '</b></div>';
}
const CUR_LABELS = { scrap:"Scrap", dataCores:"Cores", salvage:"Salvage", signals:"Signals" };
function revealCurrency(id){
  if(!S.revealed) S.revealed = { scrap:true };   // safety for injected test states
  if(S.revealed[id]) return;
  S.revealed[id] = true;
  act("CURRENCY_REVEALED", { id });
  if(typeof document !== "undefined" && document.getElementById("toast")){
    toast("New resource: " + CUR_LABELS[id]);
    renderCurrencies();
  }
}
function renderCurrencies(){
  const c = S.cur;
  const fuelChip = retMode() === "full"
    ? '<span class="cur">Fuel <b>' + S.fuel + '/' + D.retention.fuel.max + '</b></span>' : '';
  document.getElementById("currencies").innerHTML = fuelChip +
    Object.keys(CUR_LABELS).filter(id => S.revealed[id])
      .map(id => '<span class="cur">' + CUR_LABELS[id] + ' <b>' + c[id] + '</b></span>').join("") +
    '<button id="devbtn" onclick="A.go(\'dev\')">⚙</button>';
}
function renderTabs(){
  const tabs = [["base","Base"],["stash","Stash"],["vendor","Vendor"]]
    .filter(([id]) => baseAllows("navigation", id));
  document.getElementById("tabs").innerHTML = tabs.map(([id,label]) =>
    '<button class="' + (session.screen===id?"active":"") + '" onclick="A.go(\'' + id + '\')">' + label + '</button>'
  ).join("");
}
function checkBeatAutoAdvance(){
  const b = curBeat();
  if(b && b.type === "build_any"){
    const done = (b.modules || []).some(id => (S.modules[id]||0) >= 1);
    if(done) advanceBeat();
  }
}
function refresh(bitTrigger, bitVars){
  tickRetention();
  checkBeatAutoAdvance();
  $app().setAttribute("class", "s-" + session.screen);
  renderCurrencies(); renderTabs();
  const profile = baseState();
  document.body.classList.toggle("base-dark", profile.lighting === "emergency");
  document.body.dataset.lighting = profile.lighting;
  document.body.dataset.audioProfile = profile.audioProfile;
  SCREENS[session.screen](session.screenParam);
  bitDock(bitTrigger, bitVars);
}

/* ---------- screens ---------- */
const SCREENS = {};

// A small, playable combat slice that lets us test the shooter feel separately
// from the existing meta-loop raid simulation.
SCREENS.combatDemo = function(){
  const c = D.combat;
  $app().innerHTML = '<div class="combat-shell">' +
    '<header class="combat-head"><button class="combat-back" onclick="A.endCombatDemo()">‹ BASE</button>' +
      '<div><b>LIVE FIRE TEST</b><small>INDUSTRIAL ZONE · STAGE 2</small></div><div class="compass">N<br>0°</div></header>' +
    '<div class="combat-hud"><div class="combat-map"><span class="map-player">▲</span><span class="map-hostiles">● ● ●</span></div>' +
      '<div class="combat-vitals"><div class="vital-label">VITALITY <b id="combat-hp">100 / 100</b></div><div class="vital-track"><i id="combat-hpbar"></i></div>' +
      '<div class="ammo-label"><span>CARBINE</span><b id="combat-ammo">18 / 18</b></div></div>' +
      '<div class="combat-objective"><small>OBJECTIVE</small><b id="combat-objective">Clear hostiles</b>' +
      '<button id="combat-extract" onclick="A.finishCombatDemo(true)" style="display:none">EXTRACT</button></div></div>' +
    '<div class="combat-arena" id="combat-arena" role="application" aria-label="Top-down combat training arena">' +
      '<div class="arena-vignette"></div><div class="arena-markers"></div>' +
      '<div class="combat-cover cover-one"></div><div class="combat-cover cover-two"></div>' +
      '<div id="combat-pickups"></div><div id="combat-hostiles"></div>' +
      '<div class="combat-bit" id="combat-bit"><span>☺</span><small>BIT</small></div>' +
      '<div class="combat-player" id="combat-player"><span>✦</span></div><div id="combat-effects"></div>' +
      '<div class="combat-feedback" id="combat-feedback">MOVE · FIRE · RECOVER</div></div>' +
    '<div class="combat-controls"><div class="combat-pad" aria-label="Movement controls">' +
      '<button data-dir="up" aria-label="Move up">▲</button><button data-dir="left" aria-label="Move left">◀</button>' +
      '<button data-dir="down" aria-label="Move down">▼</button><button data-dir="right" aria-label="Move right">▶</button></div>' +
      '<div class="combat-actions"><button class="combat-pulse" onclick="A.combatPulse()"><span>BIT</span><b>SCAN PULSE</b></button>' +
      '<button class="combat-fire" id="combat-fire"><b>FIRE</b><small id="combat-fire-label">HOLD TO SHOOT</small></button>' +
      '<button class="combat-reload" onclick="A.combatReload()">↻ RELOAD</button></div></div>' +
    '<div class="combat-foot"><span>WASD / ARROWS TO MOVE</span><span>SPACE TO FIRE · R TO RELOAD</span></div>' +
    '</div>';
  const gameCfg = c.player, droneCfg = c.drone;
  const field = c.field;
  session.combatDemo = {
    x:field.spawnX, y:field.spawnY, hp:gameCfg.maxHealth, ammo:gameCfg.magazine,
    kills:0, salvage:0, medGel:0, lastHit:0, lastShot:0, pulseReadyAt:0,
    moving:{}, firing:false, drones:Array.from({length:droneCfg.count}, (_,i)=>({
      x:droneCfg.spawns[i%droneCfg.spawns.length][0], y:droneCfg.spawns[i%droneCfg.spawns.length][1], hp:droneCfg.maxHealth, id:i, alive:true
    })), pickups:[], running:true
  };
  const wrap = document.getElementById("combat-arena");
  const hostiles = document.getElementById("combat-hostiles");
  hostiles.innerHTML = session.combatDemo.drones.map(d=>'<div class="combat-drone" id="combat-drone-'+d.id+'"><i></i><span>DRONE</span></div>').join("");
  const dirButtons = [...document.querySelectorAll(".combat-pad [data-dir]")];
  dirButtons.forEach(b=>{
    const dir=b.dataset.dir;
    b.onpointerdown=e=>{e.preventDefault();A.combatMove(dir,true);};
    b.onpointerup=b.onpointercancel=b.onpointerleave=()=>A.combatMove(dir,false);
  });
  const fire=document.getElementById("combat-fire");
  fire.onpointerdown=e=>{e.preventDefault();A.combatTrigger(true);};
  fire.onpointerup=fire.onpointercancel=fire.onpointerleave=()=>A.combatTrigger(false);
  session.combatKeyDown=e=>{
    const key=e.key.toLowerCase();
    const dirs={w:"up",arrowup:"up",s:"down",arrowdown:"down",a:"left",arrowleft:"left",d:"right",arrowright:"right"};
    if(dirs[key]){e.preventDefault();A.combatMove(dirs[key],true);}
    else if(key===" "){e.preventDefault();A.combatTrigger(true);}
    else if(key==="r") A.combatReload();
    else if(key==="q") A.combatPulse();
  };
  session.combatKeyUp=e=>{
    const dirs={w:"up",arrowup:"up",s:"down",arrowdown:"down",a:"left",arrowleft:"left",d:"right",arrowright:"right"};
    if(dirs[e.key.toLowerCase()]) A.combatMove(dirs[e.key.toLowerCase()],false);
    if(e.key===" ") A.combatTrigger(false);
  };
  document.addEventListener("keydown",session.combatKeyDown);
  document.addEventListener("keyup",session.combatKeyUp);
  function tick(){
    const g=session.combatDemo;
    if(!g || !g.running || session.screen!=="combatDemo") return;
    const now=Date.now(), dt=50, step=gameCfg.moveSpeed*(dt/16.7);
    let dx=(g.moving.right?1:0)-(g.moving.left?1:0), dy=(g.moving.down?1:0)-(g.moving.up?1:0);
    const norm=Math.hypot(dx,dy)||1; g.x=Math.max(6,Math.min(94,g.x+dx/norm*step));g.y=Math.max(8,Math.min(92,g.y+dy/norm*step));
    g.drones.filter(d=>d.alive).forEach(d=>{
      const vx=g.x-d.x,vy=g.y-d.y,dist=Math.hypot(vx,vy)||1;
      if(dist>7){d.x+=vx/dist*droneCfg.moveSpeed*(dt/16.7);d.y+=vy/dist*droneCfg.moveSpeed*(dt/16.7);}
      else if(now-g.lastHit>droneCfg.contactCooldown){g.hp=Math.max(0,g.hp-droneCfg.contactDamage);g.lastHit=now;A.combatFeedback("HIT TAKEN",true);}
      const el=document.getElementById("combat-drone-"+d.id);if(el){el.style.left=d.x+"%";el.style.top=d.y+"%";}
    });
    const pl=document.getElementById("combat-player");if(pl){pl.style.left=g.x+"%";pl.style.top=g.y+"%";}
    const bit=document.getElementById("combat-bit");if(bit){bit.style.left=(g.x+Math.sin(now/450)*5)+"%";bit.style.top=(g.y-7+Math.cos(now/450)*3)+"%";}
    g.pickups.forEach((p,i)=>{
      const el=document.getElementById("combat-pickup-"+i);if(!el)return;
      el.style.left=p.x+"%";el.style.top=p.y+"%";
      if(Math.hypot(g.x-p.x,g.y-p.y)<gameCfg.pickupRadius&&!p.taken){p.taken=true;el.remove();
        if(p.kind==="med"){g.medGel++;g.hp=Math.min(gameCfg.maxHealth,g.hp+c.loot.medGelHeal);A.combatFeedback("MED GEL +"+c.loot.medGelHeal,false);}
        else {g.salvage+=c.loot.salvagePerDrone;A.combatFeedback("SALVAGE +"+c.loot.salvagePerDrone,false);}
        act("COMBAT_LOOT_COLLECTED",{kind:p.kind});
      }
    });
    document.getElementById("combat-hp").textContent=g.hp+" / "+gameCfg.maxHealth;
    document.getElementById("combat-hpbar").style.width=(g.hp/gameCfg.maxHealth*100)+"%";
    document.getElementById("combat-ammo").textContent=g.ammo+" / "+gameCfg.magazine;
    document.getElementById("combat-objective").textContent=g.kills+" / "+droneCfg.count+" hostiles";
    if(g.hp<=0){g.running=false;A.combatEnd(false);return;}
    if(g.kills>=droneCfg.count){
      g.firing=false;
      document.getElementById("combat-objective").textContent="AREA CLEAR · COLLECT DROPS";
      document.getElementById("combat-extract").style.display="block";
    }
    if(g.firing && now-g.lastShot>=gameCfg.fireInterval) A.combatFire();
    session.combatTimer=setTimeout(tick,dt);
  }
  tick();
};

SCREENS.intro = function(){
  const b = PROG.beats[0];
  $app().innerHTML =
    '<div style="padding-top:60px;text-align:center">' +
    '<h1 style="font-size:22px">' + esc(b.introTitle) + '</h1>' +
    '<p class="sub">meta prototype v0.1</p>' +
    '<div class="card" style="text-align:left;white-space:pre-line;font-size:13px;line-height:1.6">' + esc(b.introText) + '</div>' +
    '<button class="primary" onclick="A.dismissIntro()">ENTER THE FACILITY</button></div>';
};

function closestUpgrade(){
  let best = null;
  for(const m of D.modules){
    if(!moduleVisible(m.id)) continue;
    const next = nextLevelDef(m.id);
    if(!next || next.level > moduleCap(m.id)) continue;
    const parts = costParts(next.cost);
    const needT = parts.reduce((s,p)=>s+p.need,0);
    const haveT = parts.reduce((s,p)=>s+Math.min(p.have,p.need),0);
    const cand = { m, next, pct: needT ? haveT/needT : 0, missing: parts.filter(p=>p.have<p.need) };
    if(!best || cand.pct > best.pct) best = cand;
  }
  return best;
}
function partName(p){ return p.kind === "item" ? ITEMS[p.id].name : (p.id === "dataCores" ? "Data Cores" : "Salvage"); }
// FTUE ends once the scripted spine hands the player their first free choice.
// Before that we teach with strong guidance; after, we stop deciding for them.
function ftueOver(){
  const i = PROG.beats.findIndex(b => b.id === "choice_upgrade");
  return i < 0 || S.beat >= i;
}
function buildableCount(){
  return D.modules.filter(m => {
    if(!moduleVisible(m.id)) return false;
    const nx = nextLevelDef(m.id);
    return nx && nx.level <= moduleCap(m.id) && canAfford(nx.cost);
  }).length;
}
function nextUpgradeHtml(){
  const c = closestUpgrade();
  if(!c) return "";
  // Post-FTUE: report progress, but don't hand-pick the upgrade or offer the
  // one-tap "one more raid". The player returns to base and chooses.
  if(ftueOver()){
    const ready = buildableCount();
    if(ready > 0) return '<div class="nextup"><div class="nu-head">' + ready + ' UPGRADE' + (ready>1?'S':'') + ' READY BACK HOME</div>' +
      '<span class="small">Head back and decide what to improve.</span></div>';
    const pct = Math.round(c.pct*100);
    return '<div class="nextup"><div class="nu-head">CLOSEST UPGRADE — ' + pct + '%</div>' +
      '<b>' + esc(c.m.name) + ' L' + c.next.level + '</b>' +
      '<div class="nubar"><div style="width:' + pct + '%"></div></div></div>';
  }
  const pct = Math.round(c.pct*100);
  if(!c.missing.length){
    return '<div class="nextup"><div class="nu-head">✔ READY TO BUILD</div>' +
      '<b>' + esc(c.m.name) + ' L' + c.next.level + '</b> <span class="small">— ' + esc(c.next.unlockText) + '</span>' +
      '<div class="nubar"><div style="width:100%"></div></div>' +
      '<button class="primary" onclick="A.goBuild(\'' + c.m.id + '\')">BUILD IT NOW</button></div>';
  }
  const missTxt = c.missing.map(p => (p.need-p.have) + "× " + partName(p)).join(" · ");
  return '<div class="nextup"><div class="nu-head">NEXT UPGRADE — ' + pct + '%</div>' +
    '<b>' + esc(c.m.name) + ' L' + c.next.level + '</b>' +
    '<div class="nubar"><div style="width:' + pct + '%"></div></div>' +
    '<div class="small warn">missing: ' + esc(missTxt) + '</div>' +
    '<button class="primary" onclick="A.oneMoreRaid(\'' + c.m.id + '\',' + c.next.level + ')">ONE MORE RAID ›</button></div>';
}

function setupBaseViewer(){
  const viewer = document.querySelector(".baseviewer"), world = document.querySelector(".baseworld");
  if(!viewer || !world) return;
  const cfg = D.baseMap.world;
  if(!session.camera) session.camera = { x:cfg.initialFocus.x / 100, y:cfg.initialFocus.y / 100 };
  let drag = null, moved = false, suppress = false;
  function layout(){
    const vw = viewer.clientWidth || 800, vh = viewer.clientHeight || 420;
    const scale = Math.max(vw / cfg.width * 1.18, vh / cfg.height * 1.18);
    const sw = cfg.width * scale, sh = cfg.height * scale;
    session.cameraLayout = { sw, sh };
    const minX = Math.min(0, vw - sw), minY = Math.min(0, vh - sh);
    let x = vw/2 - session.camera.x * sw, y = vh/2 - session.camera.y * sh;
    x = Math.max(minX, Math.min(0, x)); y = Math.max(minY, Math.min(0, y));
    session.camera.x = (vw/2 - x) / sw; session.camera.y = (vh/2 - y) / sh;
    world.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
  }
  viewer.addEventListener("pointerdown", e => { drag={ x:e.clientX, y:e.clientY, cx:session.camera.x, cy:session.camera.y }; moved=false; });
  viewer.addEventListener("pointermove", e => {
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    // Capture only an actual drag: capturing a tap redirects its click away from the hotspot.
    if(!moved && Math.hypot(dx,dy) > 7){
      moved=true; suppress=true; viewer.classList.add("dragging");
      if(viewer.setPointerCapture) viewer.setPointerCapture(e.pointerId);
    }
    if(moved){ const dims=session.cameraLayout; session.camera.x=drag.cx-dx/dims.sw; session.camera.y=drag.cy-dy/dims.sh; layout(); e.preventDefault(); }
  });
  const finish = () => { drag=null; viewer.classList.remove("dragging"); setTimeout(()=>{ suppress=false; },0); };
  viewer.addEventListener("pointerup", finish); viewer.addEventListener("pointercancel", finish);
  viewer.addEventListener("click", e => {
    const spot=e.target.closest(".mapspot"); if(!spot || (e.detail !== 0 && (suppress || moved))){ e.preventDefault(); return; }
    if(spot.dataset.destination) A.go("module", spot.dataset.destination);
    else if(spot.dataset.gate && baseAllows("navigation","prep")) A.go("prep");
    else if(spot.dataset.room) A.openRoom(spot.dataset.room);
  });
  if(session.cameraResize) window.removeEventListener("resize", session.cameraResize);
  session.cameraResize = layout; window.addEventListener("resize", layout); layout();
  const shownStage=session.devPlateStage === null ? bunkerStage() : session.devPlateStage;
  const next=D.baseMap.plates[shownStage+1]; if(next){ const img=new Image(); img.src=next.art; }
}

SCREENS.base = function(){
  if(!S.introSeen){ session.screen = "intro"; return SCREENS.intro(); }
  const restorePct = Math.min(100, Math.round(
    Object.values(S.modules).reduce((a,b)=>a+b,0) /
    D.modules.reduce((a,m)=>a+m.levels.length,0) * 100));
  let html = '<h1>Rebirth Facility</h1><div class="sub">restoration ' + restorePct + '%</div>' +
    '<div class="restbar always-lit"><div style="width:' + restorePct + '%"></div></div><br>';

  const nextRoom = nextAccessRoom();
  if(nextRoom){
    html += '<div class="nextup access-next"><div class="nu-head">NEXT GOAL · OPEN ' + esc(nextRoom.label).toUpperCase() + '</div>' +
      '<span class="ok">✓ ' + esc(nextRoom.requirement.text) + '</span><p class="small">Access is available. Inspect the room to see its repairs and reward.</p>' +
      '<button class="primary" onclick="A.openRoom(\'' + nextRoom.id + '\')">🔓 EXPLORE ' + esc(nextRoom.label).toUpperCase() + '</button></div>';
  }
  if(!nextRoom) html += goalBarHtml();
  const BM = D.baseMap;
  const hub = baseState();
  const savedStage = bunkerStage();
  const stage = session.devPlateStage === null ? savedStage : session.devPlateStage;
  const plate = BM.plates[stage];
  const previous = session.plateStage !== null && session.plateStage !== stage ? BM.plates[session.plateStage] : null;
  html += '<div class="baseviewer hub-' + hub.id + (session.wake ? ' wake' : '') + '" data-lighting="' + esc(hub.lighting) + '" data-audio="' + esc(hub.audioProfile) + '" aria-label="Panoramic bunker map">' +
    '<div class="baseworld" style="width:' + BM.world.width + 'px;height:' + BM.world.height + 'px">' +
    (previous ? '<img class="baseplate outgoing" src="' + previous.art + '" alt="">' : '') +
    '<img class="baseplate current' + (previous ? ' revealing' : '') + '" src="' + plate.art + '" alt="Bunker restoration stage ' + stage + '">' +
    '<button class="mapspot core-spot" style="left:' + BM.core.x + '%;top:' + BM.core.y + '%" data-destination="rebirth_core"><b>' + esc(BM.core.label) + '</b></button>';
  for(const room of BM.rooms){
    const unlocked = roomUnlocked(room.id), previewUnlocked = session.devPlateStage !== null && room.stage <= stage;
    const shownOpen = unlocked || previewUnlocked;
    const ready = !shownOpen && roomRequirementMet(room);
    const prior = BM.rooms[room.stage - 2];
    const requirement = prior && !roomUnlocked(prior.id) && (!room.requirement.module || (S.modules[room.requirement.module] || 0) >= room.requirement.level)
      ? "Open " + prior.label + " first" : room.requirement.text;
    const selectedStyle = S.styles[room.id] && (D.styleOptions[room.id] || []).find(o => o.id === S.styles[room.id]);
    html += '<button class="mapspot room-spot ' + (shownOpen ? 'unlocked' : ready ? 'ready' : 'locked') + (previewUnlocked && !unlocked ? ' preview' : '') + '" style="left:' + room.x + '%;top:' + room.y + '%" data-room="' + room.id + '">' +
      (shownOpen ? '<b>' + esc(room.label) + '</b>' + (selectedStyle ? '<small class="style-status">✦ ' + esc(selectedStyle.name) + '</small>' : '') : (ready ? '🔓 ' : '🔒 ') + esc(room.label) + '<small>' + (ready ? '✓ ' : '') + esc(requirement) + '</small>') + '</button>';
  }
  html += '<button class="mapspot gate" style="left:' + BM.raidGate.x + '%;top:' + BM.raidGate.y + '%" data-gate="1">◎ ' + esc(BM.raidGate.label) + '</button>' +
    '</div><div class="hubstate">BUNKER · ' + esc(hub.label) + ' · PLATE 0' + stage + (session.devPlateStage !== null ? ' · PREVIEW' : '') + '</div><div class="panhelp">DRAG TO EXPLORE</div></div>';
  session.plateStage = stage;
  session.wake = false;
  if(bitOnline()){
    const bl = bondLevel();
    const cap = D.bit.bondLevels.find(b=>b.level===bl);
    const nxt = D.bit.bondLevels.find(b=>b.level===bl+1);
    html += '<div class="card"><div class="row"><b>BIT — Bond LV ' + bl + '</b><span class="small">' + S.bondXp + ' xp' + (nxt? ' / ' + nxt.xp : '') + '</span></div>' +
      '<div class="small">' + esc(cap.capability) + '</div></div>';
  }
  if(bitOnline() && retMode() !== "core"){
    if(bitAway()){
      html += '<div class="card"><b>BIT is in the field</b><div class="small">Back in ~' +
        Math.max(0, Math.ceil((S.expedition.returnAt - Date.now())/1000)) + 's. No loot scan, no odds — you are on your own out there.</div></div>';
    } else {
      const ec = D.retention.expedition.costScrap;
      html += '<div class="card"><div class="row"><b>Send BIT on expedition</b>' +
        '<button class="ghost" style="width:auto;margin:0;padding:6px 12px;' + (S.cur.scrap >= ec ? '' : 'opacity:.4') + '" ' +
        (S.cur.scrap >= ec ? 'onclick="A.sendExpedition()"' : 'disabled') + '>' + ec + ' Scrap</button></div>' +
        '<div class="small">He hunts alone for a while — biased toward your tracked item, can fail, and you lose his raid support meanwhile.</div></div>';
    }
  }
  if(contractsUnlocked()){
    const today = dayStr();
    if(S.contractsDay !== today){ S.contractsDay = today; S.contracts = {}; }
    html += '<h2>Daily contracts</h2>';
    for(const c of D.retention.contracts.daily){
      const st = S.contracts[c.id];
      const rewardTxt = Object.keys(c.reward).map(k => "+" + c.reward[k] + " " + k).join(", ");
      html += '<div class="card row"><span' + (st ? ' class="ok"' : '') + '>' + (st ? "✔ " : "") + esc(c.txt) + '</span>' +
        (st === "done"
          ? '<button class="ghost" style="width:auto;margin:0;padding:6px 12px" onclick="A.claimContract(\'' + c.id + '\')">' + rewardTxt + '</button>'
          : '<span class="small">' + (st === "claimed" ? "claimed" : rewardTxt) + '</span>') + '</div>';
    }
  }
  if(coreLevel() >= 1 && curBeat().type !== "end" && !nextRoom){
    const missB = trackedMissingItem();
    if(!ftueOver() && missB){
      // FTUE: strongly guided — name the target, show the best lead, one clear CTA.
      const leadB = guidedRaid() ? { zone:ZONES[PROG.starterRaid.zoneId], route:routeOf(ZONES[PROG.starterRaid.zoneId], PROG.starterRaid.routeId), label:"Starter mission" } : bestLead(missB.itemId);
      const tm = MODS[S.tracked.module];
      const tnext = tm.levels.find(l => l.level === S.tracked.level);
      if(tnext){
        html += '<div class="nextup"><div class="nu-head">NEXT UPGRADE</div><b>' + esc(tm.name) + ' L' + S.tracked.level + '</b><div style="margin:4px 0">' +
          costParts(tnext.cost).map(pp => {
            const nm = pp.kind === "item" ? ITEMS[pp.id].name : (pp.id === "dataCores" ? "Data Cores" : "Salvage");
            return '<span class="chip ' + (pp.have >= pp.need ? "ok" : "need") + '">' + esc(nm) + ' ' + Math.min(pp.have,pp.need) + '/' + pp.need + '</span>';
          }).join(" ") + '</div>' +
          (leadB ? '<div class="kv"><span>Best lead</span><span class="trackc">' + esc(leadB.zone.name) + ' — ' + esc(leadB.route.name) + ' (' + leadB.label + ')</span></div>' : '') +
          '</div>';
      }
      html += '<button class="primary" onclick="A.go(\'prep\')">RAID FOR ' + esc(ITEMS[missB.itemId].name).toUpperCase() + '</button>';
    } else if(!ftueOver() && S.tracked){
      html += '<button class="primary" onclick="A.goBuild(\'' + S.tracked.module + '\')">ALL PARTS FOUND — BUILD ' + esc(MODS[S.tracked.module].name).toUpperCase() + '</button>' +
        '<button class="ghost" onclick="A.go(\'prep\')">Raid anyway</button>';
    } else {
      // Post-FTUE: no hand-picked upgrade. Just tell the player how many are within
      // reach and let them inspect the glowing rooms and decide for themselves.
      const ready = buildableCount();
      if(ready > 0) html += '<div class="nextup"><div class="nu-head">' + ready + ' UPGRADE' + (ready>1?'S':'') + ' READY</div>' +
        '<span class="small">Tap a glowing room to see what it does. Your call.</span></div>';
      html += '<button class="primary" onclick="A.go(\'prep\')">PREPARE RAID</button>';
    }
  }
  if(curBeat().type === "end"){ html += '<button class="primary" onclick="A.go(\'end\')">PROTOTYPE COMPLETE — VIEW STATS</button>'; }
  $app().innerHTML = html;
  setupBaseViewer();
};

SCREENS.module = function(modId){
  const m = MODS[modId];
  const lvl = S.modules[modId] || 0;
  const next = nextLevelDef(modId);
  const visible = moduleVisible(modId);
  let html = '<button class="ghost" style="width:auto;padding:6px 14px;margin:0 0 10px" onclick="A.go(\'base\')">‹ Base</button>' +
    '<h1>' + esc(m.name) + '</h1><div class="sub">Level ' + lvl + ' · ' + esc(m.blurb) + '</div>';
  if(!visible){
    html += '<div class="card"><span class="small">This section has no power. Restore the Rebirth Core first.</span></div>';
  } else if(!next){
    html += '<div class="card ok">Maximum level reached in this slice.</div>';
  } else {
    const capped = next.level > moduleCap(modId);
    const isTracked = S.tracked && S.tracked.module === modId && S.tracked.level === next.level;
    html += '<h2>Upgrade to Level ' + next.level + '</h2>';
    let beforeArt = next.artBefore;
    if(S.styles[modId] && (D.styleOptions[modId]||[]).find(x => x.id === S.styles[modId])){
      beforeArt = (D.styleOptions[modId].find(x => x.id === S.styles[modId])).art || beforeArt;
    }
    if(beforeArt) html += '<div class="modart" style="background-image:url(\'' + beforeArt + '\')"></div>';
    if(next.preview){
      html += '<div class="card"><div class="nu-head" style="color:var(--danger)">CURRENT STATE</div><span class="small">' + esc(next.preview.before) + '</span></div>';
      html += '<div class="card"><div class="nu-head">AFTER ' + (lvl ? "UPGRADE" : "REPAIR") + '</div>' +
        next.preview.after.map(a => '<div class="small ok">▸ ' + esc(a) + '</div>').join("") + '</div>';
    } else {
      html += '<div class="card"><b>Unlocks:</b> <span class="small">' + esc(next.unlockText) + '</span></div>';
    }
    html += '<h2>Requirements</h2>';
    for(const p of costParts(next.cost)){
      const name = p.kind === "item" ? ITEMS[p.id].name : (p.id === "dataCores" ? "Data Cores" : "Salvage");
      const okc = p.have >= p.need ? "ok" : "bad";
      html += '<div class="card row"><span>' + esc(name) + '</span><span class="' + okc + '">' + Math.min(p.have,p.need) + ' / ' + p.need + '</span></div>';
    }
    if(capped){
      html += '<div class="card warn small">Locked — raise the Rebirth Core level first.</div>';
    } else {
      html += '<button class="ghost" onclick="A.track(\'' + modId + '\',' + next.level + ')">' + (isTracked ? "◉ Tracking (tap to untrack)" : "○ Track this upgrade") + '</button>';
      html += '<button class="primary" ' + (canAfford(next.cost) ? "" : "disabled") + ' onclick="A.build(\'' + modId + '\')">BUILD</button>';
    }
  }
  // Curated self-expression: cosmetic look for this room (unlocks once the room is built)
  if(lvl >= 1 && D.styleOptions[modId]){
    const cur = S.styles[modId] && D.styleOptions[modId].find(x => x.id === S.styles[modId]);
    if(cur && cur.art && !next) html += '<div class="modart" style="background-image:url(\'' + cur.art + '\')"></div>';
    html += '<h2>Style — make it yours</h2><div class="radio">';
    for(const so of D.styleOptions[modId]){
      const sel = S.styles[modId] === so.id;
      html += '<div class="card tap ' + (sel ? "selected" : "") + '" onclick="A.setStyle(\'' + modId + '\',\'' + so.id + '\')">' +
        '<b>' + esc(so.name) + '</b><br><span class="small">' + esc(so.desc) + '</span></div>';
    }
    html += '</div><div class="small" style="margin-top:4px">Cosmetic only — this is about whose bunker it is.</div>';
  }
  $app().innerHTML = html;
};

SCREENS.stash = function(){
  let html = '<h1>Stash</h1><div class="sub">' + stashSlotsUsed() + ' / ' + stashCapacity() + ' slots' +
    (stashSlotsUsed() > stashCapacity() ? ' <span class="bad">OVERFLOW</span>' : '') + '</div><div class="grid">';
  const ids = Object.keys(S.stash).filter(id => S.stash[id] > 0);
  if(!ids.length) html += '</div><div class="card small">Empty. The surface has what you need.</div>';
  else {
    for(const id of ids){
      const it = ITEMS[id];
      const cls = ["slot","r-"+it.rarity];
      if(S.reserved[id]) cls.push("reserved");
      if(S.secureItem === id) cls.push("secure");
      html += '<div class="' + cls.join(" ") + '" onclick="A.itemDetail(\'' + id + '\')">' + esc(it.name) +
        '<span class="qty">×' + S.stash[id] + '</span></div>';
    }
    html += '</div>';
  }
  $app().innerHTML = html;
};

SCREENS.itemDetail = function(id){
  const it = ITEMS[id];
  const miss = trackedMissingItem();
  const neededFor = [];
  for(const m of D.modules){
    const next = nextLevelDef(m.id);
    if(next && next.cost.items && next.cost.items[id]) neededFor.push(m.name + " L" + next.level);
  }
  let html = '<button class="ghost" style="width:auto;padding:6px 14px;margin:0 0 10px" onclick="A.go(\'stash\')">‹ Stash</button>' +
    '<h1>' + esc(it.name) + '</h1><div class="sub">' + esc(it.family) + ' · ' + esc(it.rarity) + ' · own ×' + have(id) + '</div>' +
    '<div class="card small">' + esc(it.desc) + '</div>';
  if(neededFor.length) html += '<div class="card small trackc">Needed for: ' + esc(neededFor.join(", ")) + '</div>';
  if(miss && miss.itemId === id) html += '<div class="flagbanner">TRACKED UPGRADE ITEM — NEEDED ' + miss.have + '/' + miss.need + '</div>';
  html += '<div class="kv"><span>Sell value</span><span>' + Math.floor(it.sellValue * D.vendors[0].sellMultiplier) + ' Scrap</span></div>';
  html += '<button class="ghost" onclick="A.sell(\'' + id + '\')">Sell 1 (+' + Math.floor(it.sellValue*D.vendors[0].sellMultiplier) + ' Scrap)</button>';
  html += '<button class="ghost" onclick="A.reserve(\'' + id + '\')">' + (S.reserved[id] ? "Unreserve" : "Reserve for upgrade") + '</button>';
  if((S.modules.fabricator||0) >= 1 && it.rarity === "common")
    html += '<button class="ghost" onclick="A.scrapIt(\'' + id + '\')">Scrap it (+' + Math.floor(it.sellValue*D.scrapJunkRate) + ' Scrap)</button>';
  if((S.modules.storage||0) >= 1)
    html += '<button class="ghost" onclick="A.setSecure(\'' + id + '\')">' + (S.secureItem===id ? "★ Secure item (tap to clear)" : "Set as secure item") + '</button>';
  if(retMode() === "full" && ITEMS[id].family === "protocol" && id === "encrypted_drive"){
    html += S.decrypt
      ? '<div class="card small">Decryption in progress — ~' + Math.max(0, Math.ceil((S.decrypt.returnAt - Date.now())/1000)) + 's left.</div>'
      : '<button class="ghost" onclick="A.startDecrypt(\'' + id + '\')">DECRYPT (' + D.retention.decryption.durationSec + 's) — unlock a Protocol fragment</button>';
  }
  $app().innerHTML = html;
};

SCREENS.prep = function(){
  const beat = curBeat();
  if(!session.prep){
    session.prep = {
      zoneId: D.raidZones.find(z=>coreLevel()>=z.unlockedAtCore).id,
      routeId: null,
      riskId: "standard",
      insuranceId: "none",
      loadout: { weapon:null, armor:null, c1:null, c2:null }
    };
    // sensible defaults from stash
    if(have("basic_carbine")) session.prep.loadout.weapon = "basic_carbine";
    if(have("scavenger_vest")) session.prep.loadout.armor = "scavenger_vest";
    if(have("medkit")) session.prep.loadout.c1 = "medkit";
  }
  if(guidedRaid()) applyStarterRaid();
  const p = session.prep;
  const zoneSel = ZONES[p.zoneId];
  if(!p.routeId || !(zoneSel.routes||[]).some(r=>r.id===p.routeId))
    p.routeId = ((zoneSel.routes||[])[0]||{id:null}).id;
  const miss = trackedMissingItem();
  const lead = miss ? bestLead(miss.itemId) : null;
  if(!session.routeLogged){
    log("RAID_ROUTE_SHOWN", { zone:p.zoneId, routes:(zoneSel.routes||[]).map(r=>r.id), mode:retMode() });
    if(lead) log("TRACKED_ROUTE_RECOMMENDED", { item:miss.itemId, zone:lead.zone.id, route:lead.route.id, chance:lead.label });
    session.routeLogged = true; save();
  }
  const insOffered = beat.type !== "raid" || beat.insuranceOffered !== false;
  let html = '<button class="ghost" style="width:auto;padding:6px 14px;margin:0 0 10px" onclick="A.go(\'base\')">‹ Base</button>' +
    '<h1>Raid Prep</h1>' + (S.tracked ? '<div class="goalbar">RAID GOAL<br><b>Gather repair materials for ' + esc(MODS[S.tracked.module].name) + '</b></div>' : goalBarHtml());

  if(guidedRaid()){
    const cfg = PROG.starterRaid, target = MODS[PROG.raidPrepUnlockModule];
    html += '<div class="prepgrid starter-prep"><div class="pcol"><div class="card starter-mission"><div class="nu-head">YOUR FIRST RAID</div><h2>' + esc(cfg.name) + '</h2>' +
      '<p>Search for repair materials, then return to restore the Fabricator.</p>' +
      '<div class="small">' + esc(zoneSel.name) + ' · ' + esc(routeOf(zoneSel,p.routeId).name) + ' · Standard risk</div>' +
      (target ? '<h2>Bring home</h2>' + roomPartsHtml(roomDef(target.id)) : '') + '</div></div><div class="pcol">' +
      '<div class="card"><h2>Basic loadout · equipped</h2>' + Object.values(p.loadout).filter(Boolean).map(id => '<div class="kv"><span>✓ ' + esc(ITEMS[id].name) + '</span></div>').join('') + '</div>' +
      '<div class="card locked prep-locked" aria-disabled="true"><b>🔒 Custom loadout</b><br><span class="small">Build the Fabricator to choose your gear.</span></div></div><div class="pcol">' +
      '<div class="card locked prep-locked" aria-disabled="true"><b>🔒 Route &amp; risk choices</b><br><span class="small">Build the Fabricator to plan your own missions.</span></div>' +
      '<div class="card locked prep-locked" aria-disabled="true"><b>🔒 Field crafting</b><br><span class="small">The Fabricator turns salvage into raid supplies.</span></div></div></div>';
    const fg = fuelGate();
    if(retMode() === "full") html += '<div class="card small">Fuel ' + S.fuel + ' / ' + D.retention.fuel.max + (!fg.ok ? '<button class="ad" onclick="A.adFuel()">REFILL FUEL</button>' : '') + '</div>';
    if(!p.loadout.weapon) html += '<button class="ghost" onclick="A.emergencyLoadout()">GET RECOVERY LOADOUT</button>';
    html += '<button class="ghost combat-launch" onclick="A.playCombatDemo()">TRY THE COMBAT TEST <span>LIVE FIRE · DRONE ENCOUNTER</span></button>';
    html += '<button class="primary" ' + (p.loadout.weapon && fg.ok ? '' : 'disabled') + ' onclick="A.deploy()">DEPLOY — LOOT MISSION</button>';
    $app().innerHTML = html; return;
  }
  html += '<div class="card prep-benefit"><span class="ok">✓ FABRICATOR ONLINE — RAID PLANNING UNLOCKED</span><p class="small">Choose your loadout, search route and risk. Craft extra supplies before deploying.</p></div>';
  html += '<details class="card prep-crafting"><summary>FIELD CRAFTING · Fabricator L' + S.modules.fabricator + '</summary>';
  for(const recipe of D.recipes.filter(r => r.fabricatorLevel <= S.modules.fabricator)){
    const can = S.cur.scrap >= recipe.scrapCost && Object.entries(recipe.inputs).every(([id,qty]) => have(id) >= qty);
    html += '<div class="kv"><span>' + esc(recipe.name) + '<br><small>' + Object.entries(recipe.inputs).map(([id,qty]) => qty + '× ' + esc(ITEMS[id].name)).join(' · ') + ' · ' + recipe.scrapCost + ' Scrap</small></span>' +
      '<button class="ghost" style="width:auto" ' + (can ? 'onclick="A.craft(\'' + recipe.id + '\')"' : 'disabled') + '>CRAFT</button></div>';
  }
  html += '</details>';
  html += '<div class="prepgrid"><div class="pcol">';
  if(miss){
    html += '<div class="nextup"><div class="nu-head">NEXT TARGET</div>' +
      '<b>' + esc(ITEMS[miss.itemId].name) + '</b> <span class="small">' + miss.have + '/' + miss.need + '</span>' +
      (lead ? '<div class="kv"><span>Best known search</span><span class="trackc">' + esc(lead.zone.name) + ' — ' + esc(lead.route.name) + '</span></div>' +
        '<div class="kv"><span>Chance</span><span class="ok">' + lead.label + '</span></div>' +
        '<div class="kv"><span>Threat</span><span class="warn">' + "▲".repeat(lead.route.threat) + '</span></div>' : '') +
      (bitOnline() && !bitAway() && lead ? '<div class="small" style="margin-top:4px">BIT: ' + esc(bitLine("route_reco", { route: lead.route.name, item: ITEMS[miss.itemId].name })) + '</div>' : '') +
      '</div>';
  }
  html += '<div class="mappanel" style="background-image:url(\'' + (zoneSel.mapArt || "assets/production/env_route_map.webp") + '\')"></div>';
  html += '<h2>Zone</h2>';
  for(const z of D.raidZones){
    const locked = coreLevel() < z.unlockedAtCore;
    html += '<div class="card tap ' + (locked?"locked":"") + (p.zoneId===z.id?" selected":"") + '" ' +
      (locked?"":'onclick="A.prepSet(\'zoneId\',\'' + z.id + '\')"') + '>' +
      '<div class="row"><b>' + esc(z.name) + '</b><span class="small">threat ' + "▲".repeat(z.threat) + '</span></div>' +
      '<div class="small">' + esc(z.tagline) + '</div>' +
      '<div>' + (bondLevel() >= 4
        ? [...z.lootTable].sort((a,b)=>b.weight-a.weight).slice(0,3).map(l=>'<span class="pill ok">' + esc(ITEMS[l.itemId].name) + '</span>').join("")
        : z.likelyFamilies.map(f=>'<span class="pill">' + f + '</span>').join("")) +
      '<span class="pill">intel ' + (S.zoneIntel[z.id]||0) + '</span>' +
      (locked ? '<span class="pill bad">Core L' + z.unlockedAtCore + '</span>' : '') + '</div></div>';
  }

  html += '<h2>Search route</h2>';
  for(const rt of (zoneSel.routes||[])){
    const selr = p.routeId === rt.id;
    const slotsQ = Math.max(1, 4 + (rt.lootSlotMod||0));
    const chip = miss ? '<span class="pill trackc">' + esc(ITEMS[miss.itemId].name) + ': ' + chanceLabel(trackedChanceP(miss.itemId, zoneSel, rt, slotsQ)) + '</span>' : '';
    html += '<div class="card tap ' + (selr?"selected":"") + '" onclick="A.prepSet(\'routeId\',\'' + rt.id + '\')">' +
      '<div class="row"><b>' + esc(rt.name) + '</b><span class="small warn">' + "▲".repeat(rt.threat) + '</span></div>' +
      '<div class="small">' + esc(rt.desc) + '</div>' +
      '<div>' + rt.families.map(f=>'<span class="pill">' + f + '</span>').join("") + chip +
      ((rt.lootSlotMod||0) !== 0 ? '<span class="pill">' + (rt.lootSlotMod>0?"+":"") + rt.lootSlotMod + ' loot</span>' : '') +
      '</div></div>';
  }

  html += '</div><div class="pcol">';
  html += '<h2>Loadout</h2>';
  const gearOpts = slot => Object.keys(S.stash)
    .filter(id => S.stash[id] > 0 && ITEMS[id].slot === slot)
    .map(id => '<option value="' + id + '"' + (p.loadout[slotKeyMap[slot]]===id||p.loadout.c1===id&&slot==="consumable"?"":"") + '>' + esc(ITEMS[id].name) + '</option>').join("");
  const slotKeyMap = { weapon:"weapon", armor:"armor" };
  const sel = (key, slot, label) => {
    const opts = Object.keys(S.stash).filter(id => S.stash[id]>0 && ITEMS[id].slot===slot)
      .map(id => '<option value="' + id + '" ' + (p.loadout[key]===id?"selected":"") + '>' + esc(ITEMS[id].name) + '</option>').join("");
    return '<div class="small">' + label + '</div><select onchange="A.prepLoadout(\'' + key + '\',this.value)">' +
      '<option value="">— none —</option>' + opts + '</select>';
  };
  html += '<div class="card">' + sel("weapon","weapon","Weapon") + sel("armor","armor","Armor") +
    sel("c1","consumable","Consumable 1") + sel("c2","consumable","Consumable 2") +
    '<div class="kv" style="margin-top:8px"><span>Value at risk</span><span class="warn">' + prepRiskValue() + ' Scrap</span></div></div>';
  const ownsWeapon = Object.keys(S.stash).some(id => S.stash[id] > 0 && ITEMS[id].slot === "weapon");
  if(!ownsWeapon){
    const eCost = Math.min(PROG.recovery.cheapLoadoutScrap, S.cur.scrap);
    html += '<div class="card warn"><b>No weapon left.</b><br><span class="small">' +
      (eCost > 0 ? 'BIT can scrape together a recovery loadout.' : 'BIT found you something. Don\'t ask where.') + '</span>' +
      '<button class="ghost" onclick="A.emergencyLoadout()">EMERGENCY LOADOUT — ' + (eCost > 0 ? eCost + ' SCRAP' : 'FREE') + '</button></div>';
  }

  html += '</div><div class="pcol">';
  html += '<h2>Risk level</h2><div class="radio">';
  const zsel = ZONES[p.zoneId];
  const rsel = routeOf(zsel, p.routeId);
  for(const r of D.riskLevels){
    const odds = bondLevel() >= 2 && !bitAway()
      ? '<br><span class="small ok">' + Math.round(Math.min(zsel.baseExtractChance*r.extractMod*(rsel.extractMod||1), r.extractCap)*100) + '% out</span>' : '';
    html += '<div class="card tap ' + (p.riskId===r.id?"selected":"") + '" onclick="A.prepSet(\'riskId\',\'' + r.id + '\')"><b>' + r.name + '</b><br><span class="small">' + r.lootSlots + ' loot</span>' + odds + '</div>';
  }
  html += '</div>';

  if(insOffered){
    revealCurrency("signals");
    html += '<h2>Insurance</h2><div class="radio">';
    for(const t of PROG.insurance.tiers){
      html += '<div class="card tap ' + (p.insuranceId===t.id?"selected":"") + '" onclick="A.prepSet(\'insuranceId\',\'' + t.id + '\')"><b>' + t.name + '</b><br>' +
        '<span class="small">' + (t.cost ? t.desc + "<br>" + t.cost + " Signals" : "free") + '</span></div>';
    }
    html += '</div>';
    const tier = PROG.insurance.tiers.find(t=>t.id===p.insuranceId);
    if(tier.cost > S.cur.signals){
      html += '<button class="ad" onclick="A.adSignals()">▶ WATCH AD — +' + PROG.insurance.adSignalsGrant + ' SIGNALS</button>';
    }
  }
  const fg = fuelGate();
  if(retMode() === "full"){
    html += '<h2>Fuel</h2><div class="card"><div class="row"><b>' + S.fuel + ' / ' + D.retention.fuel.max + '</b>' +
      '<span class="small">1 per raid · regens over time</span></div>' +
      (fg.siphon ? '<div class="small ok">Tracked upgrade almost done — BIT siphons reserve. Raid allowed.</div>' : '') +
      (!fg.ok ? '<div class="small bad">Out of fuel.</div><button class="ad" onclick="A.adFuel()">▶ WATCH AD — +' + D.retention.fuel.adGrant + ' FUEL</button>' : '') +
      '</div>';
  }
  html += '</div></div>';
  const tier = PROG.insurance.tiers.find(t=>t.id===p.insuranceId);
  const canDeploy = p.loadout.weapon && (!insOffered || tier.cost <= S.cur.signals) && fg.ok;
  html += '<button class="ghost combat-launch" onclick="A.playCombatDemo()">TRY THE COMBAT TEST <span>LIVE FIRE · DRONE ENCOUNTER</span></button>';
  html += '<button class="primary" ' + (canDeploy?"":"disabled") + ' onclick="A.deploy()">DEPLOY</button>';
  if(!p.loadout.weapon) html += '<div class="small" style="text-align:center;margin-top:6px">equip a weapon first</div>';
  $app().innerHTML = html;
};
function prepRiskValue(){
  const p = session.prep;
  return ["weapon","armor","c1","c2"].reduce((s,k)=> s + (p.loadout[k] ? ITEMS[p.loadout[k]].sellValue : 0), 0);
}

// Raid feed for ONE stage. `stageLoot` = items revealed this stage; `onDone` = next step.
SCREENS.raidsim = function(){
  const R = session.pendingRaid, rd = session.raid;
  const zone = ZONES[R.zone];
  const staged = !!rd;
  const stageLoot = staged ? rd.plan.stages[rd.stage].loot : R.loot.slice(0, R.outcome==="extract" ? R.loot.length : 2);
  const depthTxt = staged ? (rd.stage === 0 ? "moving in" : "pushing deeper — stage " + (rd.stage+1) + "/" + rd.plan.n) : "deployment in progress";
  $app().innerHTML = '<h1>' + esc(zone.name) + '</h1><div class="sub">' + depthTxt + '</div>' +
    '<div class="restbar"><div id="raidbar" style="width:0%"></div></div>' +
    '<div class="feed" id="raidfeed" style="margin-top:14px"></div>' +
    '<button class="ghost" onclick="A.raidStep()">SKIP ›</button>';
  const feed = [];
  if(rd && rd.stage > 0) feed.push({ t:0.6, h:'<span class="hostile">» deeper in. it is louder down here.</span>' });
  else { feed.push({ t:1, h:'<span>» insertion complete. comms up.</span>' });
    if(bitOnline() && !bitAway()) feed.push({ t:2.5, h:'<span class="bitl">BIT: scanning. try not to get shot during.</span>' }); }
  stageLoot.forEach((id, i) => {
    const flagged = id === R.cfg.trackedItemId;
    feed.push({ t: 3.5 + i*1.5, h: flagged
      ? '<div class="flagbanner">TRACKED — ' + esc(ITEMS[id].name).toUpperCase() + '</div>'
      : '<span>» found: ' + esc(ITEMS[id].name) + '</span>' });
  });
  if(!staged){ if(R.outcome === "extract") feed.push({ t: 5 + stageLoot.length*1.5, h:'<span class="bitl">» extraction point reached</span>' });
    else feed.push({ t: 7, h:'<span class="hostile">» taking heavy fire —</span>' }); }
  const totalT = feed[feed.length-1].t + 1.2;
  const t0 = Date.now();
  session.raidTimers = [];
  feed.forEach(f => session.raidTimers.push(setTimeout(()=>{
    const el = document.getElementById("raidfeed"); if(el) el.innerHTML += f.h + "<br>";
  }, f.t*1000)));
  session.raidTimers.push(setTimeout(()=>A.raidStep(), totalT*1000));
  const barIv = setInterval(()=>{
    const el = document.getElementById("raidbar"); if(!el){ clearInterval(barIv); return; }
    el.style.width = Math.min(100, (Date.now()-t0)/(totalT*1000)*100) + "%";
  }, 200);
  session.raidTimers.push(barIv);
};

// Checkpoint: the extract-vs-push decision, grown out of the raid. Shows the four
// things clearly — haul in bag, what extracting secures, what's deeper, what's at risk.
SCREENS.checkpoint = function(){
  $app().setAttribute("class", "s-decision");
  const rd = session.raid, R = session.pendingRaid;
  const zone = ZONES[R.zone], route = routeOf(zone, R.cfg.routeId);
  const stagesLeft = rd.plan.n - (rd.stage + 1);
  const dangerTier = rd.stage + 1;                 // 1..n, escalates
  const dangerLabel = ["Low","Elevated","High","Critical"][Math.min(dangerTier, 3)];
  const haulVal = lootValue(rd.haul);
  const pushDeath = rd.plan.pushDeath[Math.min(rd.stage, rd.plan.pushDeath.length-1)];
  const miss = trackedMissingItem();
  const stillMissing = miss && !rd.haul.includes(miss.itemId);
  const deeperLabel = stillMissing ? trackedDeeperLabel(R.cfg, rd.stage+1, rd.plan.n) : null;

  let html = '<h1 class="warn">CHECKPOINT ' + (rd.stage+1) + '/' + rd.plan.n + '</h1>' +
    '<div class="sub">' + esc(zone.name) + ' — ' + esc(route.name) + ' · danger <span class="warn">' + dangerLabel + '</span></div>';
  html += '<div class="dangerbar"><div style="width:' + Math.round(dangerTier/rd.plan.n*100) + '%"></div></div>';

  // In the bag (unsecured)
  html += '<h2>In your bag — not yet secured</h2>';
  if(!rd.haul.length) html += '<div class="card small">Empty so far.</div>';
  for(const id of rd.haul){
    const fl = R.cfg.trackedItemId === id;
    html += '<div class="card row" style="padding:6px 10px"><span' + (fl?' class="trackc"':'') + '>' + (fl?"◉ ":"") + esc(ITEMS[id].name) + '</span>' +
      (fl?'<span class="trackc small">tracked</span>':'<span class="small">' + (ITEMS[id].sellValue||0) + '</span>') + '</div>';
  }
  html += '<div class="kv"><span>Haul value at risk</span><span class="warn">' + haulVal + ' + ' + rd.salvage + ' Salvage</span></div>';

  // The two choices
  html += '<div class="decision-actions"><button class="primary" onclick="A.extractNow()">EXTRACT NOW — SECURE ' + haulVal + '</button>' +
    '<div class="small" style="text-align:center;margin:2px 0 8px">Bank everything above. High chance you make it home.</div>';

  const deathTxt = bondLevel() >= 2 ? Math.round(pushDeath*100) + "% chance you don't come back" : "a real chance you don't come back";
  const deeperTxt = deeperLabel ? '<br>Higher chance of finding ' + esc(ITEMS[miss.itemId].name) + ' deeper (' + deeperLabel + ')' : '';
  html += '<button class="ghost" style="border-color:var(--danger);color:var(--danger)" onclick="A.pushDeeper()">PUSH DEEPER ›</button>' +
    '<div class="small" style="text-align:center;margin-top:2px">More loot' + (stagesLeft>0? ' · '+stagesLeft+' area'+(stagesLeft>1?'s':'')+' left':'') + ' · ' + deathTxt + deeperTxt + '<br>Die deeper and you lose the haul above.</div></div>';
  $app().innerHTML = html;
};

SCREENS.result = function(){
  const R = session.pendingRaid;
  $app().setAttribute("class", "s-result " + (R.outcome === "extract" ? "res-ok" : "res-fail"));
  let html;
  if(R.outcome === "extract"){
    html = '<h1 class="ok">EXTRACTED</h1><div class="sub">' + esc(ZONES[R.zone].name) + '</div><h2>Haul</h2>';
    for(const id of R.loot){
      const flagged = R.cfg.trackedItemId === id;
      const isPart = !flagged && D.modules.some(m => {
        const nx = moduleVisible(m.id) && nextLevelDef(m.id);
        return nx && nx.level <= moduleCap(m.id) && nx.cost.items && nx.cost.items[id];
      });
      html += '<div class="card row' + '"' + '><span' + (flagged?' class="trackc"':'') + '>' + (flagged?"◉ ":"") + esc(ITEMS[id].name) + '</span>' +
        (flagged ? '<span class="trackc small">tracked</span>' : isPart ? '<span class="ok small">upgrade part</span>' : '') + '</div>';
    }
    html += '<div class="progressmoved"><b>PROGRESS MOVED</b><br>' + R.progress.map(esc).join("<br>") + '</div>';
    if(!R.doubled && retMode() === "full") html += '<button class="ad" onclick="A.adDouble()">▶ WATCH AD — 2× HAUL</button>';
  } else {
    const saved = R.saved;
    html = '<h1 class="bad">KIA</h1><div class="sub">' + esc(ZONES[R.zone].name) + '</div><h2>Lost</h2>';
    const savedIds = [...saved.insured, saved.secure].filter(Boolean);
    for(const id of R.cfg.loadout){
      if(savedIds.includes(id)){ savedIds.splice(savedIds.indexOf(id),1); continue; }
      html += '<div class="card row"><span class="bad">' + esc(ITEMS[id].name) + '</span><span class="small">lost</span></div>';
    }
    if(saved.insured.length || saved.secure || saved.bitRescue){
      html += '<h2>Recovered</h2>';
      saved.insured.forEach(id => html += '<div class="card row"><span class="ok">' + esc(ITEMS[id].name) + '</span><span class="small ok">insurance · 0:30</span></div>');
      if(saved.secure) html += '<div class="card row"><span class="ok">' + esc(ITEMS[saved.secure].name) + '</span><span class="small warn">secure slot</span></div>';
      if(saved.bitRescue) html += '<div class="card row"><span class="ok">' + esc(ITEMS[saved.bitRescue].name) + '</span><span class="small ok">BIT carried it home</span></div>';
    } else if(R.cfg.insuranceId === "none"){
      html += '<div class="card small warn">No insurance. Everything stayed on the surface.</div>';
    }
    html += '<div class="progressmoved"><b>PROGRESS MOVED — EVEN NOW</b><br>' + R.progress.map(esc).join("<br>") + '</div>';
    if(retMode() === "full"){
      if(!R.adRecovered) html += '<button class="ad" onclick="A.adRecover()">▶ WATCH AD — RECOVER 1 ITEM</button>';
      if(!R.bagRestored) html += '<button class="ghost" onclick="A.restoreBag()">RESTORE BAG — ' + PROG.recovery.restoreBagSignals + ' SIGNALS (have ' + S.cur.signals + ')</button>';
    }
    if(!have("basic_carbine")) html += '<button class="ghost" onclick="A.cheapLoadout()">CHEAP RECOVERY LOADOUT — ' + PROG.recovery.cheapLoadoutScrap + ' SCRAP</button>';
  }
  html += nextUpgradeHtml();
  html += '<button class="ghost" onclick="A.backToBase()">RETURN TO BASE</button>';
  $app().innerHTML = html;
};

SCREENS.vendor = function(){
  const v = D.vendors[0];
  let html = '<h1>' + esc(v.name) + '</h1><div class="sub">' + esc(v.blurb) + '</div>';
  html += '<h2>Buy</h2>';
  for(const s of v.stock){
    const afford = S.cur.scrap >= s.price;
    html += '<div class="card row"><span>' + esc(ITEMS[s.itemId].name) + '</span>' +
      '<button class="ghost" style="width:auto;margin:0;padding:6px 12px;' + (afford?'':'opacity:.4') + '" ' +
      (afford?'onclick="A.buy(\'' + s.itemId + '\')"':'disabled') + '>' + s.price + ' Scrap</button></div>';
  }
  html += '<h2>Barter</h2>';
  v.barter.forEach((b,ix) => {
    const can = Object.keys(b.give).every(id => have(id) >= b.give[id]);
    const giveTxt = Object.keys(b.give).map(id => b.give[id] + "× " + ITEMS[id].name).join(" + ");
    html += '<div class="card row"><span class="small">' + esc(giveTxt) + ' →<br><b>' + b.receive.qty + '× ' + esc(ITEMS[b.receive.itemId].name) + '</b></span>' +
      '<button class="ghost" style="width:auto;margin:0;padding:6px 12px;' + (can?'':'opacity:.4') + '" ' +
      (can?'onclick="A.barter(' + ix + ')"':'disabled') + '>Trade</button></div>';
  });
  if((S.modules.fabricator||0) >= 1){
    html += '<h2>Crafting — Fabricator L' + S.modules.fabricator + '</h2>';
    for(const r of D.recipes){
      const gated = r.fabricatorLevel > (S.modules.fabricator||0);
      const parts = Object.keys(r.inputs).map(id => Math.min(have(id),r.inputs[id]) + "/" + r.inputs[id] + " " + ITEMS[id].name).join(" · ");
      const can = !gated && S.cur.scrap >= r.scrapCost && Object.keys(r.inputs).every(id => have(id) >= r.inputs[id]);
      html += '<div class="card ' + (gated?'locked':'') + '"><div class="row"><b>' + esc(r.name) + '</b>' +
        (gated ? '<span class="small warn">Fab L' + r.fabricatorLevel + '</span>'
               : '<button class="ghost" style="width:auto;margin:0;padding:6px 12px;' + (can?'':'opacity:.4') + '" ' + (can?'onclick="A.craft(\'' + r.id + '\')"':'disabled') + '>Craft (' + r.scrapCost + ' Scrap)</button>') +
        '</div><div class="small">' + esc(parts) + '</div></div>';
    }
  } else {
    html += '<div class="card small">Crafting requires the Fabricator.</div>';
  }
  $app().innerHTML = html;
};

SCREENS.dev = function(){
  let html = '<button class="ghost" style="width:auto;padding:6px 14px;margin:0 0 10px" onclick="A.go(\'base\')">‹ Back</button>' +
    '<h1>Dev Panel</h1><div class="sub">beat: ' + curBeat().id + ' · raids: ' + S.raids + ' · deaths: ' + S.deaths + '</div>';
  html += '<div class="devgrid">' +
    '<button onclick="A.devForce(\'extract\')">Force next: SUCCESS</button>' +
    '<button onclick="A.devForce(\'death\')">Force next: FAILURE</button>' +
    '<button onclick="A.devCur()">+100 all currencies</button>' +
    '<button onclick="A.devBond()">+1 BIT Bond level</button>' +
    '<button onclick="A.devSkipRaid()">Skip raid (auto-resolve)</button>' +
    '<button onclick="A.devExport()">Export event log</button>' +
    '<button onclick="A.devReset()" style="color:var(--danger)">RESET SAVE</button>' +
    '</div>';
  html += '<h2>Panoramic bunker plates (preview only)</h2><div class="devgrid plategrid">' + D.baseMap.plates.map(p => '<button onclick="A.devPlate(' + p.stage + ')">0' + p.stage + ' · ' + esc(p.id) + '</button>').join('') + '<button onclick="A.devPlate(null)">Saved stage</button></div>';
  html += '<h2>Grant item</h2><select id="devitem">' +
    D.items.map(i=>'<option value="' + i.id + '">' + esc(i.name) + '</option>').join("") +
    '</select><button class="ghost" onclick="A.devGrant()">Grant 1</button>';
  html += '<h2>Retention mode (A/B)</h2><select id="devret">' +
    ["core","bit","full"].map(m => '<option value="' + m + '" ' + (retMode()===m?'selected':'') + '>' + m + '</option>').join("") +
    '</select><button class="ghost" onclick="A.devRetMode()">Apply</button>' +
    '<div class="devgrid" style="margin-top:6px">' +
    '<button onclick="A.devFuel()">+5 Fuel</button>' +
    '<button onclick="A.devFinishTimers()">Finish timers now</button></div>';
  html += '<h2>Jump to beat</h2><select id="devbeat">' +
    PROG.beats.map((b,ix)=>'<option value="' + ix + '" ' + (ix===S.beat?'selected':'') + '>' + b.id + '</option>').join("") +
    '</select><button class="ghost" onclick="A.devJump()">Jump</button>';
  html += '<div class="small" style="margin-top:10px">' + (session.devForce ? 'next raid forced: ' + session.devForce : '') + '</div>';
  $app().innerHTML = html;
};

SCREENS.end = function(){
  if(!S.surveyDone){
    const q = (D.progression.survey || []).find(x => !(x.id in S.surveyAnswers));
    if(q){
      $app().innerHTML = '<div style="padding-top:40px;text-align:center"><h1>QUICK QUESTION</h1>' +
        '<p class="sub">three taps, then your stats</p></div>' +
        '<div class="card" style="font-size:14px">' + esc(q.q) + '</div>' +
        q.opts.map(o => '<button class="ghost" onclick="A.survey(\'' + q.id + '\',\'' + o.replace(/'/g,"") + '\')">' + esc(o) + '</button>').join("");
      return;
    }
    S.surveyDone = true; save();
  }
  const c = a => S.log.filter(e => e.action === a).length;
  const insBuys = S.log.filter(e => e.action === "INSURANCE_SELECTED" && e.payload.tier !== "none").length;
  let html = '<div style="text-align:center;padding-top:30px"><h1>END OF PROTOTYPE</h1>' +
    '<p class="sub">' + esc(PROG.beats[PROG.beats.length-1].endText) + '</p></div>' +
    '<div class="card"><div class="kv"><span>Raids</span><span>' + S.raids + '</span></div>' +
    '<div class="kv"><span>Deaths</span><span>' + S.deaths + '</span></div>' +
    '<div class="kv"><span>Extractions</span><span>' + c("EXTRACT_COMPLETE") + '</span></div>' +
    '<div class="kv"><span>Insurance taken</span><span>' + insBuys + '</span></div>' +
    '<div class="kv"><span>Ads watched</span><span>' + c("AD_COMPLETED") + '</span></div>' +
    '<div class="kv"><span>Items sold</span><span>' + c("ITEM_SOLD") + '</span></div>' +
    '<div class="kv"><span>Modules built</span><span>' + c("MODULE_BUILT") + '</span></div>' +
    '<div class="kv"><span>BIT Bond LV</span><span>' + bondLevel() + '</span></div></div>' +
    '<button class="ghost" onclick="A.devExport()">Export event log</button>' +
    '<button class="ghost" onclick="A.go(\'base\')">Keep playing anyway</button>' +
    '<button class="primary" onclick="A.devReset()">RESET &amp; PLAY AGAIN</button>';
  $app().innerHTML = html;
};

// Fold the current stage's loot/salvage into the accumulated (unsecured) haul.
function revealStage(){
  const rd = session.raid, st = rd.plan.stages[rd.stage];
  rd.haul.push(...st.loot);
  rd.salvage += st.salvage;
  rd.dataCores += st.dataCores;
}
// End a staged raid: write the accumulated haul onto R, set outcome, then resolve.
function finalizeStaged(outcome){
  const rd = session.raid, R = session.pendingRaid;
  R.outcome = outcome;
  R.loot = rd.haul.slice();
  R.salvage = rd.salvage;
  R.dataCores = rd.dataCores;
  R.trackedFound = !!R.cfg.trackedItemId && R.loot.includes(R.cfg.trackedItemId);
  if(outcome === "death") R.pushedAndDied = true;
  session.raid = null;
  finishRaid();
}
function finishRaid(){
  const R = session.pendingRaid;
  applyRaidResult(R);
  session.resultAt = Date.now();
  const cu = closestUpgrade();
  log("NEXT_UPGRADE_SHOWN", cu ? { module: cu.m.id, level: cu.next.level, pct: Math.round(cu.pct*100) } : {});
  session.screen = "result";
  renderCurrencies();
  SCREENS.result();
  if(R.bondUp){
    const bl = D.bit.bondLevels.find(b=>b.level===R.bondUp);
    overlay('<h1 class="ok">BIT BOND LV ' + bl.level + '</h1>' +
      '<p style="margin:12px 0;font-size:13px">' + esc(bl.capability) + '</p>' +
      '<p class="small">BIT: ' + esc(bitLine("bond_up")) + '</p>' +
      '<button class="primary" data-close>NICE</button>');
  }
}

/* ---------- actions ---------- */
window.A = {
  playCombatDemo(){
    this.clearCombatDemo();
    session.screen="combatDemo";
    act("COMBAT_TEST_STARTED",{});
    refresh();
  },
  clearCombatDemo(){
    if(session.combatTimer) clearTimeout(session.combatTimer);
    if(session.combatFeedbackTimer) clearTimeout(session.combatFeedbackTimer);
    if(session.combatDemo){session.combatDemo.running=false;session.combatDemo.firing=false;}
    if(session.combatKeyDown) document.removeEventListener("keydown",session.combatKeyDown);
    if(session.combatKeyUp) document.removeEventListener("keyup",session.combatKeyUp);
    session.combatKeyDown=null;session.combatKeyUp=null;
  },
  endCombatDemo(){
    this.clearCombatDemo();
    session.combatDemo=null;
    session.screen="prep"; session.prep=null; refresh("raid_prep");
  },
  combatMove(dir,active){
    const g=session.combatDemo;if(!g)return;
    g.moving[dir]=!!active;
    if(active) act("COMBAT_MOVE",{direction:dir});
  },
  combatTrigger(active){
    const g=session.combatDemo;if(!g)return;
    g.firing=!!active;
    if(active) this.combatFire();
  },
  combatFire(){
    const g=session.combatDemo, cfg=D.combat;if(!g||!g.running)return;
    if(g.ammo<=0){this.combatFeedback("OUT OF AMMO · RELOAD",true);return;}
    const now=Date.now();if(now-g.lastShot<cfg.player.fireInterval)return;
    g.lastShot=now;g.ammo--;
    const target=g.drones.filter(d=>d.alive).sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y)-Math.hypot(b.x-g.x,b.y-g.y))[0];
    if(target){
      const player=document.getElementById("combat-player");
      if(player)player.style.setProperty("--facing",Math.atan2(target.y-g.y,target.x-g.x)*180/Math.PI+"deg");
      const arena=document.getElementById("combat-arena"),fx=document.getElementById("combat-effects");
      if(fx){fx.innerHTML='<i class="combat-beam" style="left:'+g.x+'%;top:'+g.y+'%;--tx:'+target.x+'%;--ty:'+target.y+'%"></i><b class="combat-hit" style="left:'+target.x+'%;top:'+target.y+'%">✳</b>';setTimeout(()=>{if(fx)fx.innerHTML="";},170);}
      target.hp--;
      if(target.hp<=0){
        target.alive=false;g.kills++;
        const el=document.getElementById("combat-drone-"+target.id);if(el)el.classList.add("destroyed");
        const index=g.kills-1, kind=(g.kills%D.combat.loot.medGelEvery===0)?"med":"scrap";
        g.pickups.push({x:target.x,y:target.y,kind,taken:false});
        const pickups=document.getElementById("combat-pickups");
        if(pickups)pickups.insertAdjacentHTML("beforeend",'<div class="combat-pickup '+kind+'" id="combat-pickup-'+index+'">'+(kind==="med"?"+":"◆")+'</div>');
        this.combatFeedback(kind==="med"?"DRONE DOWN · MED GEL DROPPED":"DRONE DOWN · SALVAGE DROPPED",false);
      }else this.combatFeedback("HIT",false);
    }
    act("COMBAT_SHOT",{ammo:g.ammo,hit:!!target});
    document.getElementById("combat-ammo").textContent=g.ammo+" / "+cfg.player.magazine;
  },
  combatReload(){
    const g=session.combatDemo;if(!g||!g.running)return;
    this.combatTrigger(false);this.combatFeedback("RELOADING",false);
    act("COMBAT_RELOAD",{ammo:g.ammo});
    setTimeout(()=>{if(session.combatDemo===g&&g.running){g.ammo=D.combat.player.magazine;this.combatFeedback("MAGAZINE READY",false);}},D.combat.player.reloadTime);
  },
  combatPulse(){
    const g=session.combatDemo,c=D.combat;if(!g||!g.running)return;
    const now=Date.now();if(now<g.pulseReadyAt){this.combatFeedback("BIT PULSE CHARGING",true);return;}
    g.pulseReadyAt=now+c.bit.pulseCooldown;
    let hit=0;
    g.drones.filter(d=>d.alive&&Math.hypot(d.x-g.x,d.y-g.y)<=c.bit.pulseRadius).forEach(d=>{d.hp-=c.bit.pulseDamage;hit++;if(d.hp<=0){
      d.alive=false;g.kills++;const el=document.getElementById("combat-drone-"+d.id);if(el)el.classList.add("destroyed");
      const kind=(g.kills%c.loot.medGelEvery===0)?"med":"scrap",index=g.kills-1;g.pickups.push({x:d.x,y:d.y,kind,taken:false});
      const pickups=document.getElementById("combat-pickups");if(pickups)pickups.insertAdjacentHTML("beforeend",'<div class="combat-pickup '+kind+'" id="combat-pickup-'+index+'">'+(kind==="med"?"+":"◆")+'</div>');
    }});
    const arena=document.getElementById("combat-arena");if(arena){arena.classList.add("bit-pulsing");setTimeout(()=>arena.classList.remove("bit-pulsing"),600);}
    this.combatFeedback(hit?"BIT PULSE · "+hit+" TARGET" : "BIT PULSE · NO CONTACT",false);
    act("COMBAT_BIT_PULSE",{targets:hit});
  },
  combatFeedback(message,danger){
    const el=document.getElementById("combat-feedback");if(!el)return;
    el.textContent=message;el.classList.toggle("danger",!!danger);el.classList.add("show");
    clearTimeout(session.combatFeedbackTimer);session.combatFeedbackTimer=setTimeout(()=>el.classList.remove("show"),1000);
  },
  combatEnd(extracted){
    const g=session.combatDemo;if(!g)return;
    if(session.combatTimer)clearTimeout(session.combatTimer);
    g.running=false;g.firing=false;
    const host=document.getElementById("combat-objective");if(host)host.textContent=extracted?"EXTRACT AVAILABLE":"SIGNAL LOST";
    const arena=document.getElementById("combat-arena");
    if(arena)arena.insertAdjacentHTML("beforeend",'<div class="combat-end"><b>'+(extracted?"AREA SECURE":"YOU ARE DOWN")+'</b><span>'+(extracted?g.salvage+" Salvage · "+g.medGel+" Med Gel":"Try a different route around the drones")+'</span><button onclick="A.finishCombatDemo('+(extracted?"true":"false")+')">'+(extracted?"EXTRACT LOOT":"RETRY")+'</button></div>');
    act(extracted?"COMBAT_AREA_SECURED":"COMBAT_TEST_FAILED",{kills:g.kills,salvage:g.salvage});
  },
  finishCombatDemo(extracted){
    const g=session.combatDemo;if(!g)return;
    if(extracted){
      S.cur.salvage+=g.salvage;
      if(g.medGel)addItem(D.combat.loot.medGelItemId,g.medGel);
      act("COMBAT_LOOT_EXTRACTED",{salvage:g.salvage,medGel:g.medGel});save();
      this.endCombatDemo();
    }else{this.endCombatDemo();this.playCombatDemo();}
  },
  go(screen, param){
    if(screen !== "dev" && screen !== "module" && !baseAllows("navigation", screen)) return;
    if(screen === "module" && (!baseAllows("interactions", param) || (param !== "rebirth_core" && roomDef(param) && !roomUnlocked(param)))) return;
    if(session.screenEnterTs && session.screen)
      log("SCREEN_TIME", { screen: session.screen, ms: Date.now() - session.screenEnterTs });
    session.screenEnterTs = Date.now();
    session.screen = screen; session.screenParam = param;
    if(screen === "prep"){ session.prep = null; session.routeLogged = false; }
    act("SCREEN_VIEW", { screen, param });
    refresh(screen === "prep" ? "raid_prep" : null);
  },
  itemDetail(id){ session.screen = "itemDetail"; session.screenParam = id; refresh(); },
  dismissIntro(){
    S.introSeen = true;
    advanceBeat(); // tutorial -> core_l1
    act("INTRO_DISMISSED", {});
    A.go("base");
  },
  track(modId, level){
    if(S.tracked && S.tracked.module === modId && S.tracked.level === level){ S.tracked = null; act("TRACK_CLEARED",{}); }
    else { S.tracked = { module: modId, level }; S.trackedStreak = 0; act("TRACK_SET", S.tracked); }
    refresh();
  },
  build(modId){
    const next = nextLevelDef(modId);
    if(!next || !canAfford(next.cost) || next.level > moduleCap(modId)) return;
    payCost(next.cost);
    S.modules[modId] = next.level;
    if(S.tracked && S.tracked.module === modId && S.tracked.level === next.level) S.tracked = null;
    act("MODULE_BUILT", { module: modId, level: next.level });
    advanceBaseState({ module:modId, level:next.level });
    if(modId === "bit_bay" && next.level === 1) revealCurrency("dataCores");
    if(modId === "fabricator" && next.level === 1) S.lastYieldAt = Date.now();
    const b = curBeat();
    if((b.type === "build" && b.module === modId && b.level === next.level) ||
       (b.type === "build_any" && b.modules.includes(modId))) advanceBeat();
    // payoffs
    const isLightsOn = modId === "rebirth_core" && next.level === 1;
    const isBitOnline = modId === "bit_bay" && next.level === 1;
    const finish = () => { session.wake = true; A.go("base"); if(isBitOnline) bitDock("bond_up"); else bitDock("module_built"); };
    if(isLightsOn){
      save();
      bootSequence(next, finish);
    } else {
      let bdust = '<div class="dustwrap">';
      for(let i=0;i<8;i++) bdust += '<i style="left:' + (5+Math.random()*90) + '%;animation-delay:' + (Math.random()*0.7) + 's"></i>';
      bdust += '</div>';
      const artAfter = next.artAfter ? '<div class="modart tall" style="background-image:url(\'' + next.artAfter + '\')"></div>' : '';
      const ovEl = overlay('<h1 class="ok">' + esc(MODS[modId].name).toUpperCase() + ' L' + next.level + '</h1>' + bdust + artAfter +
        '<p style="margin:14px 0;font-size:13px">' + esc(next.unlockText) + '</p>' +
        '<p class="small" style="margin-bottom:10px">BIT: ' + esc(bitLine(isBitOnline ? "bond_up" : "module_built")) + '</p>' +
        '<div class="card" style="text-align:left"><span class="ok">NEW BENEFIT</span><br>' + esc(next.benefitText || "") + '</div>' +
        '<div class="card" style="text-align:left"><span class="trackc">NEW GOAL</span><br>' + esc(next.newGoal) + '</div>' +
        '<button class="primary" data-close>CONTINUE</button>', finish);
      ovEl.querySelector(".inner").classList.add("shake");
    }
  },
  sell(id){
    if(have(id) < 1 || S.reserved[id]) { toast(S.reserved[id] ? "Reserved for an upgrade" : "None left"); return; }
    const gain = Math.floor(ITEMS[id].sellValue * D.vendors[0].sellMultiplier);
    removeItem(id,1); S.cur.scrap += gain;
    act("ITEM_SOLD", { id, gain });
    toast("+ " + gain + " Scrap");
    refresh();
  },
  reserve(id){
    if(S.reserved[id]) delete S.reserved[id]; else S.reserved[id] = true;
    act("ITEM_RESERVED", { id, reserved: !!S.reserved[id] });
    refresh();
  },
  scrapIt(id){
    if(have(id) < 1 || S.reserved[id]) return;
    const gain = Math.floor(ITEMS[id].sellValue * D.scrapJunkRate);
    removeItem(id,1); S.cur.scrap += gain;
    act("ITEM_SCRAPPED", { id, gain });
    toast("Recycled: +" + gain + " Scrap");
    refresh();
  },
  setSecure(id){
    S.secureItem = S.secureItem === id ? null : id;
    act("SECURE_SET", { id: S.secureItem });
    refresh();
  },
  prepSet(key, val){
    if(guidedRaid()) return;
    session.prep[key] = val;
    if(key === "zoneId") session.prep.routeId = null;
    if(key === "routeId") act("RAID_ROUTE_SELECTED", { zone: session.prep.zoneId, route: val, risk: session.prep.riskId, mode: retMode() });
    if(key === "insuranceId") act("INSURANCE_SELECTED", { tier: val });
    refresh("raid_prep");
  },
  prepLoadout(slot, id){ if(guidedRaid()) return; session.prep.loadout[slot] = id || null; refresh("raid_prep"); },
  adSignals(){
    fakeAd("+"+PROG.insurance.adSignalsGrant+" Signals", ()=>{
      S.cur.signals += PROG.insurance.adSignalsGrant; save();
      toast("+" + PROG.insurance.adSignalsGrant + " Signals");
      refresh("raid_prep");
    });
  },
  deploy(){
    if(!session.prep) return;
    if(guidedRaid()) applyStarterRaid();
    const p = session.prep;
    if(!p.loadout.weapon) return;
    const tier = PROG.insurance.tiers.find(t=>t.id===p.insuranceId);
    if(tier.cost > S.cur.signals) return;
    const fg = fuelGate();
    if(!fg.ok) return;
    if(retMode() === "full"){
      if(S.fuel > 0){ S.fuel--; if(S.fuel === D.retention.fuel.max - 1) S.fuelAt = Date.now(); }
      else log("FUEL_SIPHON", {});
    }
    if(session.resultAt){ log("RESULT_TO_DEPLOY", { ms: Date.now() - session.resultAt }); session.resultAt = null; }
    S.cur.signals -= tier.cost;
    const loadout = ["weapon","armor","c1","c2"].map(k=>p.loadout[k]).filter(Boolean);
    loadout.forEach(id => removeItem(id,1)); // gear leaves the stash
    const miss = trackedMissingItem();
    const cfg = { zoneId:p.zoneId, routeId:p.routeId, riskId:p.riskId, insuranceId:p.insuranceId,
      loadout, trackedItemId: miss ? miss.itemId : null };
    act("RAID_DEPLOYED", cfg);
    const devForced = !!session.devForce;
    const R = resolveRaid(cfg);
    session.pendingRaid = R;
    // Staged (Agency v0.7): live, unforced raids with 2+ stages get escalating
    // extract-vs-push checkpoints. Forced FTUE raids, dev-forced outcomes and
    // short 1-stage routes resolve straight through.
    const n = stageCount(cfg);
    if(!R.forced && !devForced && n >= 2){
      const plan = planStages(R, n);
      session.raid = { R, plan, stage:0, haul:[], salvage:0, dataCores:0 };
      revealStage();
    } else {
      session.raid = null;
    }
    session.screen = "raidsim";
    document.getElementById("bitdock").style.display = "none";
    renderCurrencies(); renderTabs();
    SCREENS.raidsim();
  },
  // Called after each stage's feed finishes (or SKIP).
  raidStep(){
    (session.raidTimers||[]).forEach(x => { clearTimeout(x); clearInterval(x); });
    const rd = session.raid;
    if(!rd){ finishRaid(); return; }              // non-staged: straight to result
    const stagesLeft = rd.plan.n - (rd.stage + 1);
    if(stagesLeft <= 0){ finalizeStaged("extract"); return; }  // last stage — auto-extract
    log("CHECKPOINT_REACHED", { stage: rd.stage+1, of: rd.plan.n, haulValue: lootValue(rd.haul),
      dangerTier: rd.stage+1, trackedMissing: !!trackedMissingItem() && !rd.haul.includes((trackedMissingItem()||{}).itemId), mode: retMode() });
    save();
    session.screen = "checkpoint"; renderCurrencies();
    SCREENS.checkpoint();
  },
  extractNow(){
    const rd = session.raid;
    act("EXTRACT_NOW_SELECTED", { stage: rd.stage+1, of: rd.plan.n, haulValue: lootValue(rd.haul), mode: retMode() });
    finalizeStaged("extract");
  },
  pushDeeper(){
    const rd = session.raid;
    const pushDeath = rd.plan.pushDeath[Math.min(rd.stage, rd.plan.pushDeath.length-1)];
    act("PUSH_DEEPER_SELECTED", { stage: rd.stage+1, of: rd.plan.n, haulValue: lootValue(rd.haul), mode: retMode() });
    if(Math.random() < pushDeath){
      log("RAID_FAILED_AFTER_PUSHING_DEEPER", { stage: rd.stage+1, of: rd.plan.n, lostValue: lootValue(rd.haul) });
      finalizeStaged("death");
      return;
    }
    rd.stage++;
    revealStage();
    session.screen = "raidsim"; renderCurrencies();
    SCREENS.raidsim();
  },
  adDouble(){
    const R = session.pendingRaid;
    fakeAd("2× haul", ()=>{
      R.loot.forEach(id => addItem(id,1));
      R.doubled = true;
      act("HAUL_DOUBLED", { loot: R.loot }); save();
      toast("Haul doubled");
      SCREENS.result(); renderCurrencies();
    });
  },
  adRecover(){
    const R = session.pendingRaid;
    const candidates = R.cfg.loadout.filter(id => !R.saved.insured.includes(id) && id !== R.saved.secure);
    if(!candidates.length){ toast("Nothing left to recover"); return; }
    fakeAd("recover 1 item", ()=>{
      const id = candidates.sort((a,b)=>ITEMS[b].sellValue-ITEMS[a].sellValue)[0];
      addItem(id,1); R.saved.insured.push(id); R.adRecovered = true;
      act("AD_RECOVERED", { id }); save();
      toast("Recovered: " + ITEMS[id].name);
      SCREENS.result();
    });
  },
  restoreBag(){
    const R = session.pendingRaid;
    if(S.cur.signals < PROG.recovery.restoreBagSignals){ toast("Not enough Signals"); return; }
    S.cur.signals -= PROG.recovery.restoreBagSignals;
    R.cfg.loadout.forEach(id => { if(!R.saved.insured.includes(id) && id !== R.saved.secure) addItem(id,1); });
    R.loot.forEach(id => addItem(id,1));
    R.bagRestored = true; R.adRecovered = true;
    act("BAG_RESTORED", {}); save();
    toast("Bag restored");
    SCREENS.result(); renderCurrencies();
  },
  emergencyLoadout(){
    const cost = Math.min(PROG.recovery.cheapLoadoutScrap, S.cur.scrap);
    S.cur.scrap -= cost;
    PROG.recovery.cheapLoadoutItems.forEach(id => addItem(id,1));
    act("EMERGENCY_LOADOUT", { cost });
    toast(cost > 0 ? "Re-equipped for " + cost + " Scrap" : "BIT: it fell off a truck. trucks don't exist anymore. don't ask.");
    session.prep = null;
    refresh("raid_prep");
  },
  cheapLoadout(){
    if(S.cur.scrap < PROG.recovery.cheapLoadoutScrap){ toast("Not enough Scrap"); return; }
    S.cur.scrap -= PROG.recovery.cheapLoadoutScrap;
    PROG.recovery.cheapLoadoutItems.forEach(id => addItem(id,1));
    act("CHEAP_LOADOUT", {}); save();
    toast("Re-equipped. Back out there.");
    SCREENS.result(); renderCurrencies();
  },
  backToBase(){
    session.pendingRaid = null;
    A.go("base");
    bitDock(S.deaths && S.log[S.log.length-2] && S.log.some(e=>e.action==="PLAYER_DIED" && Date.now()-e.t < 60000) ? "player_died" : "extracted");
  },
  buy(id){
    const s = D.vendors[0].stock.find(x=>x.itemId===id);
    if(S.cur.scrap < s.price) return;
    S.cur.scrap -= s.price; addItem(id,1);
    act("VENDOR_BUY", { id, price: s.price });
    toast("Bought " + ITEMS[id].name);
    refresh();
  },
  barter(ix){
    const b = D.vendors[0].barter[ix];
    if(!Object.keys(b.give).every(id => have(id) >= b.give[id])) return;
    for(const id in b.give) removeItem(id, b.give[id]);
    addItem(b.receive.itemId, b.receive.qty);
    act("VENDOR_BARTER", { ix });
    toast("Traded for " + ITEMS[b.receive.itemId].name);
    refresh();
  },
  craft(rid){
    const r = D.recipes.find(x=>x.id===rid);
    if(r.fabricatorLevel > (S.modules.fabricator||0)) return;
    if(S.cur.scrap < r.scrapCost || !Object.keys(r.inputs).every(id => have(id) >= r.inputs[id])) return;
    S.cur.scrap -= r.scrapCost;
    for(const id in r.inputs) removeItem(id, r.inputs[id]);
    addItem(r.output.itemId, r.output.qty);
    act("ITEM_CRAFTED", { recipe: rid });
    toast("Crafted " + ITEMS[r.output.itemId].name);
    refresh();
  },
  sendExpedition(){
    const R = D.retention.expedition;
    if(bitAway() || S.cur.scrap < R.costScrap || !bitOnline()) return;
    S.cur.scrap -= R.costScrap;
    const miss = trackedMissingItem();
    S.expedition = { returnAt: Date.now() + R.durationSec*1000, trackedItemId: miss ? miss.itemId : null };
    act("EXPEDITION_SENT", { tracked: miss ? miss.itemId : null });
    toast("BIT is out there. The base feels quieter.");
    refresh();
  },
  claimContract(id){
    const c = D.retention.contracts.daily.find(x => x.id === id);
    if(!c || S.contracts[id] !== "done") return;
    for(const k in c.reward) S.cur[k] = (S.cur[k]||0) + c.reward[k];
    S.contracts[id] = "claimed";
    act("CONTRACT_CLAIMED", { id });
    toast("Contract reward collected");
    refresh();
  },
  adFuel(){
    fakeAd("+" + D.retention.fuel.adGrant + " fuel", ()=>{
      S.fuel = Math.min(D.retention.fuel.max, S.fuel + D.retention.fuel.adGrant); save();
      toast("+" + D.retention.fuel.adGrant + " Fuel");
      refresh("raid_prep");
    });
  },
  startDecrypt(id){
    if(S.decrypt || have(id) < 1) return;
    removeItem(id, 1);
    S.decrypt = { returnAt: Date.now() + D.retention.decryption.durationSec*1000 };
    act("DECRYPT_STARTED", {});
    toast("Decryption running. BIT is very excited. Statistically.");
    refresh();
  },
  oneMoreRaid(modId, level){
    S.tracked = { module: modId, level };
    act("ONE_MORE_RAID", { module: modId, level });
    session.pendingRaid = null;
    A.go("prep");
  },
  chooseNextUpgrade(){
    const c = closestUpgrade();
    act("CHOOSE_NEXT_UPGRADE", c ? { module: c.m.id } : {});
    if(c) A.go("module", c.m.id); else A.go("prep");
  },
  setStyle(modId, styleId){
    S.styles[modId] = styleId;
    act("STYLE_SELECTED", { module: modId, style: styleId });
    toast("Noted. BIT is rearranging things.");
    refresh();
  },
  goBuild(modId){
    session.pendingRaid = null;
    if(roomDef(modId) && !roomUnlocked(modId)){ A.openRoom(modId); return; }
    A.go("module", modId);
  },
  survey(id, opt){
    S.surveyAnswers[id] = opt;
    act("SURVEY_ANSWER", { id, opt });
    if(Object.keys(S.surveyAnswers).length >= (D.progression.survey || []).length){ S.surveyDone = true; save(); }
    refresh();
  },
  openRoom(id){
    const room=roomDef(id); if(!room) return;
    if(roomUnlocked(id)){ if(room.destination) A.go("module", room.destination); else overlay('<h1>Living Quarters</h1><p class="sub">A quiet place to recover between raids. Full room systems arrive beyond this prototype.</p><button class="primary" data-close>RETURN TO CORE</button>'); return; }
    const ready=roomRequirementMet(room);
    const next=room.destination && nextLevelDef(room.destination);
    const needsParts=next && !canAfford(next.cost);
    const prior=D.baseMap.rooms[room.stage - 2];
    overlay('<h1>' + (ready ? '🔓 ' : '🔒 ') + esc(room.label) + '</h1><p class="' + (ready ? 'ok' : 'sub') + '">' +
      (ready ? '✓ ' : '') + esc(room.requirement.text) + '</p>' +
      (ready ? '<p class="sub">Access is available because this requirement is complete. Opening the room clears access; building it still costs repair materials.</p>' +
        (next ? '<div class="card"><b>REPAIR MATERIALS</b><p>' + roomPartsHtml(room) + '</p><span class="small">REWARD · ' + esc(next.benefitText) + '</span></div>' : '') +
        (needsParts ? '<p class="sub">Raid for the missing materials, return, and bring this room online.</p><button class="primary" onclick="A.raidForRoom(\'' + room.id + '\')">RAID FOR REPAIR MATERIALS</button>' : '') +
        '<button class="' + (needsParts ? 'ghost' : 'primary') + '" onclick="A.unlockRoom(\'' + room.id + '\')">' + (needsParts ? 'OPEN ACCESS ONLY — REPAIRS STILL NEEDED' : 'REVEAL ROOM') + '</button>' :
        '<div class="card warn">' + (prior && !roomUnlocked(prior.id) ? 'Open ' + esc(prior.label) + ' first. ' : '') + 'Requirement incomplete</div>') + '<button class="ghost" data-close>BACK</button>');
  },
  raidForRoom(id){
    const room=roomDef(id);
    if(!room || !roomRequirementMet(room) || !room.destination) return;
    const next=nextLevelDef(room.destination); if(!next) return;
    if(!S.tracked || S.tracked.module !== room.destination || S.tracked.level !== next.level) S.trackedStreak=0;
    S.tracked={ module:room.destination, level:next.level }; act("TRACK_SET", S.tracked);
    const o=document.getElementById("overlay"); if(o) o.remove();
    A.go("prep");
  },
  unlockRoom(id){
    const room=roomDef(id); if(!room || roomUnlocked(id) || !roomRequirementMet(room)) return;
    S.roomUnlocks[id]=true; act("ROOM_UNLOCKED", { room:id, stage:room.stage });
    const o=document.getElementById("overlay"); if(o) o.remove(); session.screen="base"; refresh(); toast(room.label + " revealed");
  },
  devPlate(stage){
    session.devPlateStage = stage === null ? null : Math.max(0, Math.min(D.baseMap.rooms.length, Number(stage)));
    act("DEV_PLATE_PREVIEW", { stage:session.devPlateStage }); session.screen="base"; refresh();
  },
  /* dev */
  devForce(o){ session.devForce = o; act("DEV_FORCE",{o}); toast("Next raid: " + o); refresh(); },
  devCur(){ S.cur.scrap+=100; S.cur.dataCores+=100; S.cur.salvage+=100; S.cur.signals+=100; act("DEV_CURRENCY",{}); refresh(); },
  devBond(){
    const bl = bondLevel();
    const nxt = D.bit.bondLevels.find(b=>b.level===bl+1);
    if(nxt) S.bondXp = nxt.xp;
    if(!bitOnline()) S.modules.bit_bay = 1;
    act("DEV_BOND",{}); refresh();
  },
  devGrant(){
    const id = document.getElementById("devitem").value;
    addItem(id,1); act("DEV_GRANT",{id}); toast("+1 " + ITEMS[id].name); refresh();
  },
  devSkipRaid(){
    const zone = D.raidZones.find(z=>coreLevel()>=z.unlockedAtCore);
    const miss = trackedMissingItem();
    const cfg = { zoneId: zone.id, riskId:"standard", insuranceId:"none", loadout:[], trackedItemId: miss?miss.itemId:null };
    session.devForce = "extract";
    session.pendingRaid = resolveRaid(cfg);
    applyRaidResult(session.pendingRaid);
    act("DEV_SKIP_RAID",{});
    session.screen = "result"; renderCurrencies(); SCREENS.result();
  },
  devRetMode(){
    S.retentionMode = document.getElementById("devret").value;
    act("RETENTION_MODE_SET", { mode: S.retentionMode });
    toast("Retention: " + S.retentionMode);
    refresh();
  },
  devFuel(){ S.fuel = Math.min(D.retention.fuel.max + 5, S.fuel + 5); save(); refresh(); },
  devFinishTimers(){
    if(S.expedition) S.expedition.returnAt = 0;
    if(S.decrypt) S.decrypt.returnAt = 0;
    tickRetention();
    const rows = morningRows();
    if(rows.length) A.showMorning(rows); else refresh();
  },
  showMorning(rows){
    act("MORNING_REPORT", { rows: rows.length });
    overlay('<h1 class="ok">MORNING REPORT</h1>' +
      '<p class="small" style="margin:6px 0 10px">BIT kept the lights on. Here is what happened.</p>' +
      rows.map(r => '<div class="card" style="text-align:left;font-size:13px">' + esc(r) + '</div>').join("") +
      '<button class="primary" data-close>GOOD MORNING</button>', () => refresh());
  },
  devJump(){
    S.beat = parseInt(document.getElementById("devbeat").value,10);
    act("DEV_JUMP",{beat: curBeat().id}); save(); refresh();
  },
  devExport(){
    const blob = new Blob([JSON.stringify(S.log, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pr_event_log.json";
    a.click();
  },
  devReset(){
    localStorage.removeItem(SAVE_KEY);
    S = freshState();
    session = { pendingRaid:null, prep:null, screen:"base", screenParam:null, devForce:null, camera:null, plateStage:null, cameraResize:null, devPlateStage:null, cameraLayout:null };
    refresh();
  }
};

/* ---------- BIT portrait (assets/bit.png) with graceful fallback ---------- */
function tryBitImage(){
  const img = new Image();
  img.onload = () => document.body.classList.add("bit-img");
  img.src = "assets/bit.png";
}

/* ---------- init ---------- */
if(typeof document !== "undefined" && document.getElementById("app")){
  S = load();
  tryBitImage();
  if(!S.log.length) log("SESSION_START", {});
  window.addEventListener("beforeunload", () => {
    const cu = closestUpgrade();
    log("SESSION_END", cu ? { unfinished: cu.m.id, pct: Math.round(cu.pct*100) } : {});
    save();
  });
  session.screen = S.introSeen ? "base" : "intro";
  refresh();
  if(S.introSeen){
    tickRetention();
    const rows = morningRows();
    if(rows.length) A.showMorning(rows);
  }
}
/* export pure logic for headless tests */
if(typeof module !== "undefined") module.exports = { freshState, resolveRaid, rollPushDeeper, stageCount, planStages, bestLead, effTable, trackedChanceP, chanceLabel, routeOf, baseState, transitionBaseState, advanceBaseState, _setState: st => { S = st; }, _getState: () => S, applyRaidResult, canAfford, costParts, bondLevel: () => bondLevel(), bunkerStage, roomRequirementMet, roomUnlocked, migrateState, load };
