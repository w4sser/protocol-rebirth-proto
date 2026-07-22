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
const SAVE_VERSION = 4;   // bump on state-model changes; old saves are discarded in prototype phase

/* ---------- state ---------- */
let S = null;          // persistent state
let session = { pendingRaid:null, prep:null, screen:"base", screenParam:null, devForce:null };

function freshState(){
  const st = {
    v:SAVE_VERSION, beat:0,
    cur: Object.assign({}, PROG.start.currencies),
    stash: Object.assign({}, PROG.start.stash),
    reserved: {}, secureItem: null,
    modules: {}, bondXp: 0,
    tracked: null, trackedStreak: 0,
    zoneIntel: {}, raids: 0, deaths: 0,
    revealed: { scrap: true }, surveyDone: false, surveyAnswers: {},
    retentionMode: D.retention.defaultMode,
    fuel: D.retention.fuel.max, fuelAt: Date.now(),
    streak: 0, lastDay: "", lastYieldAt: 0,
    expedition: null, decrypt: null, loreUnlocked: 0,
    contracts: {}, contractsDay: "", pendingReport: [],
    lightsOn: false, introSeen: false,
    log: []
  };
  D.modules.forEach(m => st.modules[m.id] = 0);
  return st;
}
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw){ const st = JSON.parse(raw); if(st.v === SAVE_VERSION) return st; }
  }catch(e){}
  return freshState();
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
  const m = MODS[modId];
  return m.maxLevelByCore[String(coreLevel())] ?? 0;
}
function moduleVisible(modId){ return coreLevel() >= MODS[modId].revealedAtCore; }
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
  if(!S.lightsOn){ dock.style.display = "none"; return; }
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
  const R = { cfg, zone: zone.id, outcome, loot, salvage, dataCores, trackedFound };
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
  const tabs = [["base","Base"],["stash","Stash"],["vendor","Vendor"]];
  document.getElementById("tabs").innerHTML = tabs.map(([id,label]) =>
    '<button class="' + (session.screen===id?"active":"") + '" onclick="A.go(\'' + id + '\')">' + label + '</button>'
  ).join("");
}
function refresh(bitTrigger, bitVars){
  tickRetention();
  $app().setAttribute("class", "s-" + session.screen);
  renderCurrencies(); renderTabs();
  document.body.classList.toggle("base-dark", !S.lightsOn);
  SCREENS[session.screen](session.screenParam);
  bitDock(bitTrigger, bitVars);
}

/* ---------- screens ---------- */
const SCREENS = {};

SCREENS.intro = function(){
  const b = PROG.beats[0];
  $app().innerHTML =
    '<div style="padding-top:60px;text-align:center">' +
    '<h1 style="font-size:22px">' + esc(b.introTitle) + '</h1>' +
    '<p class="sub">meta prototype v0.1</p>' +
    '<div class="card" style="text-align:left;white-space:pre-line;font-size:13px;line-height:1.6">' + esc(b.introText) + '</div>' +
    '<button class="primary" onclick="A.dismissIntro()">ENTER THE FACILITY</button></div>';
};

function roomHtml(modId, idx){
  const m = MODS[modId], lvl = S.modules[modId] || 0;
  const visible = moduleVisible(modId);
  const next = nextLevelDef(modId);
  const art = D.moduleArt[modId];
  let stateCls, chips = "";
  if(!visible) stateCls = "dark";
  else if(lvl === 0){
    const capped = next && next.level > moduleCap(modId);
    stateCls = (next && !capped && canAfford(next.cost)) ? "broken ready" : "broken";
  } else {
    const capped = next && next.level > moduleCap(modId);
    stateCls = (next && !capped && canAfford(next.cost)) ? "built ready" : "built";
  }
  if(visible && next){
    if(next.level > moduleCap(modId)){
      const needCore = Object.keys(m.maxLevelByCore).find(k => m.maxLevelByCore[k] >= next.level);
      chips = '<span class="chip need">CORE L' + (needCore || "?") + ' FIRST</span>';
    } else {
      chips = costParts(next.cost).map(p => {
        const name = p.kind === "item" ? ITEMS[p.id].name : (p.id === "dataCores" ? "Cores" : "Salvage");
        return '<span class="chip ' + (p.have >= p.need ? "ok" : "need") + '">' + esc(name) + ' ' + Math.min(p.have,p.need) + '/' + p.need + '</span>';
      }).join("");
    }
  } else if(visible && !next) chips = '<span class="chip ok">MAX</span>';
  const tracked = (S.tracked && S.tracked.module === modId) ? '<span class="chip track">◉ TRACKED</span>' : '';
  let bar = "";
  if(visible && next && next.level <= moduleCap(modId)){
    const parts = costParts(next.cost);
    const needT = parts.reduce((s,p)=>s+p.need,0);
    const haveT = parts.reduce((s,p)=>s+Math.min(p.have,p.need),0);
    bar = '<div class="roombar"><div style="width:' + (needT ? Math.round(haveT/needT*100) : 0) + '%"></div></div>';
  }
  const artInner =
    art === "core"  ? '<div class="corering"></div>' :
    art === "fab"   ? '<div class="fabbars"><i></i><i></i><i></i></div>' :
    art === "bit"   ? '<div class="bitart">' + (bitOnline() ? "ᵕ‿ᵕ" : "✕‿✕") + '</div>' :
    art === "vault" ? '<div class="crates"><i></i><i></i><i></i><i></i><i></i><i></i></div>' : '';
  return '<div class="room ' + stateCls + '" style="animation-delay:' + (idx*0.28) + 's"' +
    (visible ? ' onclick="A.go(\'module\',\'' + modId + '\')"' : '') + '>' +
    '<div class="roomname"><span>' + (visible ? esc(m.name) : "— no power —") + '</span>' +
    (visible && lvl ? '<span class="lvl">L' + lvl + '</span>' : '') + '</div>' +
    '<div class="roomart art-' + art + (lvl ? '' : ' off') + '">' + artInner +
      m.levels.filter(l => l.level <= lvl && l.artAdd).map(l => '<i class="artadd aa-' + l.artAdd + '"></i>').join("") + '</div>' +
    (visible && m.benefit ? '<div class="rbenefit">' + esc(m.benefit) + '</div>' : '') +
    '<div class="chips">' + tracked + chips + '</div>' + bar + '</div>';
}

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
function nextUpgradeHtml(){
  const c = closestUpgrade();
  if(!c) return "";
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

SCREENS.base = function(){
  if(!S.introSeen){ session.screen = "intro"; return SCREENS.intro(); }
  const restorePct = Math.min(100, Math.round(
    Object.values(S.modules).reduce((a,b)=>a+b,0) /
    D.modules.reduce((a,m)=>a+m.levels.length,0) * 100));
  let html = '<h1>Rebirth Facility</h1><div class="sub">restoration ' + restorePct + '%</div>' +
    '<div class="restbar always-lit"><div style="width:' + restorePct + '%"></div></div><br>' + goalBarHtml();

  html += '<div class="fac' + (session.wake ? ' wake' : '') + '">';
  let idx = 0;
  for(const row of D.baseLayout){
    html += '<div class="facrow">' + row.map(id => roomHtml(id, idx++)).join("") + '</div>';
  }
  html += '</div>';
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
  if(coreLevel() >= 1 && curBeat().type !== "end"){
    const missB = trackedMissingItem();
    if(missB){
      const leadB = bestLead(missB.itemId);
      const tm = MODS[S.tracked.module];
      const tnext = tm.levels.find(l => l.level === S.tracked.level);
      if(tnext){
        html += '<div class="nextup"><div class="nu-head">NEXT UPGRADE</div><b>' + esc(tm.name) + ' L' + S.tracked.level + '</b><div style="margin:4px 0">' +
          costParts(tnext.cost).map(pp => {
            const nm = pp.kind === "item" ? ITEMS[pp.id].name : (pp.id === "dataCores" ? "Data Cores" : "Salvage");
            return '<span class="chip ' + (pp.have >= pp.need ? "ok" : "need") + '">' + esc(nm) + ' ' + Math.min(pp.have,pp.need) + '/' + pp.need + '</span>';
          }).join(" ") + '</div>' +
          '<div class="kv"><span>Benefit</span><span class="small ok">' + esc(tnext.benefitText || tm.benefit || "") + '</span></div>' +
          (leadB ? '<div class="kv"><span>Best lead</span><span class="trackc">' + esc(leadB.zone.name) + ' — ' + esc(leadB.route.name) + ' (' + leadB.label + ')</span></div>' : '') +
          '</div>';
      }
      html += '<button class="primary" onclick="A.go(\'prep\')">RAID FOR ' + esc(ITEMS[missB.itemId].name).toUpperCase() + '</button>';
    } else if(S.tracked){
      html += '<button class="primary" onclick="A.goBuild(\'' + S.tracked.module + '\')">ALL PARTS FOUND — BUILD ' + esc(MODS[S.tracked.module].name).toUpperCase() + '</button>' +
        '<button class="ghost" onclick="A.go(\'prep\')">Raid anyway</button>';
    } else {
      html += '<button class="primary" onclick="A.chooseNextUpgrade()">CHOOSE NEXT UPGRADE</button>' +
        '<button class="ghost" onclick="A.go(\'prep\')">Free raid</button>';
    }
  }
  if(curBeat().type === "end"){ html += '<button class="primary" onclick="A.go(\'end\')">PROTOTYPE COMPLETE — VIEW STATS</button>'; }
  $app().innerHTML = html;
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
    '<h1>Raid Prep</h1>' + goalBarHtml();

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
  html += '<button class="primary" ' + (canDeploy?"":"disabled") + ' onclick="A.deploy()">DEPLOY</button>';
  if(!p.loadout.weapon) html += '<div class="small" style="text-align:center;margin-top:6px">equip a weapon first</div>';
  $app().innerHTML = html;
};
function prepRiskValue(){
  const p = session.prep;
  return ["weapon","armor","c1","c2"].reduce((s,k)=> s + (p.loadout[k] ? ITEMS[p.loadout[k]].sellValue : 0), 0);
}

SCREENS.raidsim = function(){
  const R = session.pendingRaid;
  const zone = ZONES[R.zone];
  $app().innerHTML = '<h1>' + esc(zone.name) + '</h1><div class="sub">deployment in progress</div>' +
    '<div class="restbar"><div id="raidbar" style="width:0%"></div></div>' +
    '<div class="feed" id="raidfeed" style="margin-top:14px"></div>' +
    '<button class="ghost" onclick="A.raidDone()">SKIP ›</button>';
  const feed = [];
  feed.push({ t:1, h:'<span>» insertion complete. comms up.</span>' });
  if(bitOnline()) feed.push({ t:2.5, h:'<span class="bitl">BIT: scanning. try not to get shot during.</span>' });
  feed.push({ t:4, h:'<span class="hostile">» contact — hostiles nearby</span>' });
  R.loot.slice(0, R.outcome==="extract" ? R.loot.length : 2).forEach((id, i) => {
    const flagged = R.trackedFound && id === R.cfg.trackedItemId;
    feed.push({ t: 5.5 + i*1.8, h: flagged
      ? '<div class="flagbanner">' + esc(MODS[S.tracked.module].name).toUpperCase() + ' UPGRADE ITEM — NEEDED — ' + esc(ITEMS[id].name).toUpperCase() + '</div><span class="bitl">BIT: ' + esc(bitLine("tracked_found")) + '</span>'
      : '<span>» found: ' + esc(ITEMS[id].name) + '</span>' });
  });
  if(R.outcome === "extract") feed.push({ t: 6 + R.loot.length*1.8, h:'<span class="bitl">» extraction point reached</span>' });
  else feed.push({ t: 9, h:'<span class="hostile">» taking heavy fire —</span>' });
  const totalT = feed[feed.length-1].t + 1.5;
  const t0 = Date.now();
  session.raidTimers = [];
  feed.forEach(f => session.raidTimers.push(setTimeout(()=>{
    const el = document.getElementById("raidfeed");
    if(el){ el.innerHTML += f.h + "<br>"; }
  }, f.t*1000)));
  session.raidTimers.push(setTimeout(()=>A.raidDone(), totalT*1000));
  const barIv = setInterval(()=>{
    const el = document.getElementById("raidbar");
    if(!el){ clearInterval(barIv); return; }
    el.style.width = Math.min(100, (Date.now()-t0)/(totalT*1000)*100) + "%";
  }, 200);
  session.raidTimers.push(barIv);
};

SCREENS.decision = function(){
  const R = session.pendingRaid;
  const zone = ZONES[R.zone], route = routeOf(zone, R.cfg.routeId);
  const pd = D.raidConfig.pushDeeper;
  let html = '<h1 class="warn">DECISION POINT</h1><div class="sub">' + esc(zone.name) + ' — ' + esc(route.name) + '</div>';
  if(R.trackedFound){
    html += '<div class="flagbanner">TRACKED ITEM SECURED</div>';
    if(bitOnline() && !bitAway()) html += '<div class="card small">BIT: ' + esc(bitLine("decision_found")) + '</div>';
  }
  html += '<h2>In your bag right now</h2>';
  for(const id of R.loot){
    const fl = R.cfg.trackedItemId === id;
    html += '<div class="card row"><span' + (fl?' class="trackc"':'') + '>' + (fl?"◉ ":"") + esc(ITEMS[id].name) + '</span>' +
      (fl?'<span class="trackc small">tracked</span>':'') + '</div>';
  }
  const riskTxt = bondLevel() >= 2 ? "+" + Math.round(pd.deathChanceAdd*100) + "% death risk" : "a notably higher chance of not coming back";
  html += '<div class="card"><b class="warn">Push deeper:</b> <span class="small">+' + pd.extraSlots + ' loot rolls · better rare odds · ' + riskTxt + '. Die in there and the death rules apply to everything you carry.</span></div>';
  html += '<button class="primary" onclick="A.extractNow()">EXTRACT NOW — KEEP IT ALL</button>';
  html += '<button class="ghost" style="border-color:var(--danger);color:var(--danger)" onclick="A.pushDeeper()">PUSH DEEPER</button>';
  $app().innerHTML = html;
};

SCREENS.result = function(){
  const R = session.pendingRaid;
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
    if(!R.doubled) html += '<button class="ad" onclick="A.adDouble()">▶ WATCH AD — 2× HAUL</button>';
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
    if(!R.adRecovered) html += '<button class="ad" onclick="A.adRecover()">▶ WATCH AD — RECOVER 1 ITEM</button>';
    if(!R.bagRestored) html += '<button class="ghost" onclick="A.restoreBag()">RESTORE BAG — ' + PROG.recovery.restoreBagSignals + ' SIGNALS (have ' + S.cur.signals + ')</button>';
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
  go(screen, param){
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
      S.lightsOn = true; save();
      bootSequence(next, finish);
    } else {
      let bdust = '<div class="dustwrap">';
      for(let i=0;i<8;i++) bdust += '<i style="left:' + (5+Math.random()*90) + '%;animation-delay:' + (Math.random()*0.7) + 's"></i>';
      bdust += '</div>';
      const ovEl = overlay('<h1 class="ok">' + esc(MODS[modId].name).toUpperCase() + ' L' + next.level + '</h1>' + bdust +
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
    session.prep[key] = val;
    if(key === "zoneId") session.prep.routeId = null;
    if(key === "routeId") act("RAID_ROUTE_SELECTED", { zone: session.prep.zoneId, route: val, risk: session.prep.riskId, mode: retMode() });
    if(key === "insuranceId") act("INSURANCE_SELECTED", { tier: val });
    refresh("raid_prep");
  },
  prepLoadout(slot, id){ session.prep.loadout[slot] = id || null; refresh("raid_prep"); },
  adSignals(){
    fakeAd("+"+PROG.insurance.adSignalsGrant+" Signals", ()=>{
      S.cur.signals += PROG.insurance.adSignalsGrant; save();
      toast("+" + PROG.insurance.adSignalsGrant + " Signals");
      refresh("raid_prep");
    });
  },
  deploy(){
    const p = session.prep;
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
    session.pendingRaid = resolveRaid(cfg);
    session.screen = "raidsim";
    document.getElementById("bitdock").style.display = "none";
    renderCurrencies(); renderTabs();
    SCREENS.raidsim();
  },
  raidDone(){
    (session.raidTimers||[]).forEach(x => { clearTimeout(x); clearInterval(x); });
    const R = session.pendingRaid;
    if(R.decision && R.decision.eligible && !R.decision.resolved){
      log("PUSH_DEEPER_OFFERED", raidCtx(R));
      if(R.trackedFound) log("TRACKED_ITEM_FOUND_BEFORE_DECISION", raidCtx(R));
      save();
      session.screen = "decision";
      renderCurrencies();
      SCREENS.decision();
      return;
    }
    finishRaid();
  },
  extractNow(){
    const R = session.pendingRaid;
    R.decision.resolved = true;
    act("EXTRACT_NOW_SELECTED", raidCtx(R));
    finishRaid();
  },
  pushDeeper(){
    const R = session.pendingRaid;
    R.decision.resolved = true;
    act("PUSH_DEEPER_SELECTED", raidCtx(R));
    const res = rollPushDeeper(R);
    if(res.died) act("RAID_FAILED_AFTER_PUSHING_DEEPER", raidCtx(R));
    finishRaid();
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
  goBuild(modId){
    session.pendingRaid = null;
    A.go("module", modId);
  },
  survey(id, opt){
    S.surveyAnswers[id] = opt;
    act("SURVEY_ANSWER", { id, opt });
    if(Object.keys(S.surveyAnswers).length >= (D.progression.survey || []).length){ S.surveyDone = true; save(); }
    refresh();
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
    session = { pendingRaid:null, prep:null, screen:"base", screenParam:null, devForce:null };
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
if(typeof module !== "undefined") module.exports = { freshState, resolveRaid, rollPushDeeper, bestLead, effTable, trackedChanceP, chanceLabel, routeOf, _setState: st => { S = st; }, _getState: () => S, applyRaidResult, canAfford, costParts, bondLevel: () => bondLevel() };
