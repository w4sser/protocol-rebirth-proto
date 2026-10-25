// v1.50.0 bespoke icons: IC(name) renders one icon of the SVG set (assets/icons/sprite.svg, tools/mkicons.py). No emoji in UI (test/icons.test.js).
function IC(n){ return '<svg class="pr-ic" aria-hidden="true" focusable="false"><use href="assets/icons/sprite.svg#' + n + '"/></svg>'; }
/* Protocol Rebirth — base (meta) layer. Version: APP_VERSION below.
   All economy values live in /data/*.js. This file contains logic + UI only.
   State mutations go through act() so the event log is complete. */
"use strict";

/* ---------- data access ---------- */
const D = window.DATA;
const ITEMS = {}; D.items.forEach(i => ITEMS[i.id] = i);
const MODS  = {}; D.modules.forEach(m => MODS[m.id] = m);
const ZONES = {}; D.raidZones.forEach(z => ZONES[z.id] = z);
const PROG  = D.progression;
const TAL   = D.bitTalents;
const APP_VERSION = "1.98.0"; // keep in sync with ?v= in index.html and nodspel/
const SAVE_KEY = "pr_meta_save";
const SAVE_VERSION = 15;   // v15 (v1.95): S.talents (BIT talent tree, docs/design-bit-skill-tree.md); old S.bitSkill becomes 1 point in the matching core node.
//   // v14 (v1.93): tier/attachments/level belong to the one built copy; orphans (copy lost before v14) are cleared.
//   // v13 (v1.91) adds S.gearTier (Mk tiers from merging 3 copies) + S.attach (fitted attachments).
//   // v12 (v1.89) splits gear into S.armory (weapons, armor/rigs, consumables, tools); S.stash keeps materials.
//   // v8 adds quest chains (S.chains, S.trackedQuest) and Contract Chips (S.cur.chips); v9 adds the chip shop (S.chipShop) and stored unlocks (S.unlocks); v10 adds found-in-raid counts (S.fir); v11 adds gear upgrade levels (S.gearUp)

/* ---------- state ---------- */
let S = null;          // persistent state
let session = { pendingRaid:null, prep:null, screen:"base", screenParam:null, devForce:null, camera:null, plateStage:null, cameraResize:null, devPlateStage:null, cameraLayout:null };

function freshState(){
  const st = {
    v:SAVE_VERSION, beat:0,
    cur: Object.assign({}, PROG.start.currencies),
    stash: Object.assign({}, PROG.start.stash), armory: {}, gearTier: {}, attach: {},
    reserved: {}, secureItem: null, guardianMaterial: null,
    talents: { spent:{}, respecs:0 },
    modules: {}, bondXp: 0, opXp: 0,
    tracked: null, trackedStreak: 0,
    zoneIntel: {}, raids: 0, deaths: 0,
    revealed: { scrap: true }, surveyDone: false, surveyAnswers: {}, styles: {},
    retentionMode: D.retention.defaultMode,
    fuel: D.retention.fuel.max, fuelAt: Date.now(),
    streak: 0, lastDay: "", lastYieldAt: 0,
    expedition: null, decrypt: null, loreUnlocked: 0,
    contracts: {}, contractsDay: "", pendingReport: [],
    baseState: D.baseStates[0].id, roomUnlocks: {}, introSeen: false,
    payoff: null, payoffDone: false, areaSeen: {},
    chains: {}, trackedQuest: null, fir: {}, gearUp: {}, loadout: null, chipShop: { week:"", bought:{} }, unlocks: { recipe:{}, cosmetic:{}, hard:{} },
    log: []
  };
  D.modules.forEach(m => st.modules[m.id] = 0);
  return st;
}
function save(){ if(typeof resetting !== "undefined" && resetting) return; try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw){
      const st = JSON.parse(raw), was = st.v;
      if(st.v === 6) migrateState(st);
      if(st.v === 7) migrateChains(st);
      if(st.v === 8) migrateChips(st);
      if(st.v === 9) migrateFir(st);
      if(st.v === 10) migrateGearUp(st);
      if(st.v === 11) migrateArmory(st);
      if(st.v === 12) migrateTiers(st);
      if(st.v === 13) migrateBuilt(st);
      if(st.v === 14) migrateTalents(st);
      if(was >= 6 && was < SAVE_VERSION) localStorage.setItem(SAVE_KEY, JSON.stringify(st));
      if(st.v === SAVE_VERSION){ st.roomUnlocks = st.roomUnlocks || {}; migrateSalvage(st); migrateSkills(st); migratePayoff(st); migrateAreaSeen(st); migratePower(st); splitArmory(st); if(!st.gearTier) st.gearTier = {}; if(!st.attach) st.attach = {}; if(!st.talents || typeof st.talents !== "object") st.talents = { spent:{}, respecs:0 }; if(st.guardianMaterial === undefined) st.guardianMaterial = null; return st; }
    }
  }catch(e){}
  return freshState();
}
// v1.67: first-upgrade payoff (PROG.firstUpgradePayoff). Saves that already own a payoff upgrade never get a late one.
function migratePayoff(st){
  if(st.payoff === undefined) st.payoff = null;
  if(st.payoffDone === undefined){
    st.payoffDone = Object.keys(PROG.firstUpgradePayoff).some(k => { const [m, l] = k.split(":"); return ((st.modules && st.modules[m]) || 0) >= +l; });
  }
  return st;
}
// v1.69.2: NEW badge on freshly unlocked map areas. Saves without areaSeen mark every area they already have open
// as seen, so veterans get no surprise badge (no SAVE_VERSION bump: the field is additive).
function migrateAreaSeen(st){
  if(st.areaSeen && typeof st.areaSeen === "object") return st;
  st.areaSeen = {};
  for(const a of (D.worldMap && D.worldMap.areas) || []){
    if(a.requires && ((st.modules && st.modules.rebirth_core) || 0) >= a.requires.core && st.areaScouted && st.areaScouted[a.id]) st.areaSeen[a.id] = true;
  }
  return st;
}

// v1.81 T1-D: bunker power (additive; no SAVE_VERSION bump). Start at 100 once Core is online.
function migratePower(st){
  if(st.power && typeof st.power.value === "number") return st;
  const core = (st.modules && st.modules.rebirth_core) || 0;
  st.power = { value: core >= 1 ? 100 : 0, at: 0, offlineDrained: 0, reinforceAt: 0, lastRoom: null, maintain: null };
  return st;
}
// v1.41: Athletics became Mobility (same xp); Vitality retired (health now comes from gear).
function migrateSkills(st){
  if(st && st.skills && st.skills.athletics !== undefined){ st.skills.mobility = (st.skills.mobility || 0) + st.skills.athletics; delete st.skills.athletics; }
  // v1.43: Vitality is back (owner 14 Oct) — keep any saved vitality xp.
  return st;
}
// v1.35: Salvage merged into Scrap. Legacy saves convert at SALVAGE_TO_SCRAP. Salvage Crates now grant Scrap.
const SALVAGE_TO_SCRAP = 2;
function migrateSalvage(st){
  if(!st || !st.cur) return st;
  if(st.cur.salvage){ st.cur.scrap = (st.cur.scrap || 0) + Math.floor(st.cur.salvage * SALVAGE_TO_SCRAP); }
  delete st.cur.salvage;
  if(st.revealed) delete st.revealed.salvage;
  return st;
}
function migrateState(st){
  if(st.v !== 6) return st;
  // v6 exposed every powered room. Preserve that access and all economy state
  // while introducing explicit ordered unlocks rather than resetting the save.
  st.roomUnlocks = {};
  if(st.baseState !== "core_found") for(const room of D.baseMap.rooms.slice(0, 3)) st.roomUnlocks[room.id] = true;
  if(st.baseState === "core_refined") st.roomUnlocks.living_quarters = true;
  st.v = 7;
  return st;
}
// v8: quest chains and Contract Chips. Old saves start every chain at step 1.
function migrateChains(st){
  st.chains = st.chains || {}; if(st.trackedQuest === undefined) st.trackedQuest = null;
  st.cur = st.cur || {}; if(st.cur.chips === undefined) st.cur.chips = 0;
  st.v = 8;
  return migrateChips(st);
}
// v9: chip shop weekly purchases and stored quest/shop unlocks (recipe, cosmetic, hard-variant pass).
function migrateChips(st){
  st.chipShop = st.chipShop || { week:"", bought:{} };
  st.unlocks = st.unlocks || {}; for(const k of ["recipe", "cosmetic", "hard"]) st.unlocks[k] = st.unlocks[k] || {};
  // Backfill unlock flags from chain steps already completed (S.chains[id].step = steps done); flags only, no currency/items.
  const chains = (window.DATA && window.DATA.questChains) || {};
  for(const id in chains){ const done = (st.chains && st.chains[id] && st.chains[id].step) || 0;
    chains[id].steps.slice(0, done).forEach(def => { const u = def.reward && def.reward.unlock; if(u) for(const k of ["recipe", "cosmetic", "hard"]) if(u[k]) st.unlocks[k][u[k]] = true; }); }
  st.v = 9;
  return migrateFir(st);
}
// v10: found-in-raid counts (S.fir[id] = how many of the stashed stack were extracted from a raid). Everything already in
// the stash counts as found in raid, so nobody loses hand-in progress.
function migrateFir(st){
  st.fir = {}; for(const id in st.stash || {}) if(st.stash[id] > 0) st.fir[id] = st.stash[id];
  st.v = 10;
  return st;
}
// v1.83 T4: per-item gear upgrade levels (additive field).
function migrateGearUp(st){
  if(!st.gearUp || typeof st.gearUp !== "object") st.gearUp = {};
  st.v = 11;
  return st;
}
// v1.89 (v12): Armory vs Stash (docs/design-armory.md a). Gear moves from S.stash into S.armory; counts, FIR and upgrade
// levels are untouched, nothing is dropped. splitArmory is idempotent and also runs on every load (cleans injected states).
function isArmoryItem(id){ return !!ITEMS[id] && !isFree(id) && stashGroup(id) <= 2; }
function splitArmory(st){
  if(!st.armory || typeof st.armory !== "object") st.armory = {};
  for(const id of Object.keys(st.stash || {})){
    if(!isArmoryItem(id)) continue;
    const n = st.stash[id] || 0; delete st.stash[id];
    if(n > 0) st.armory[id] = (st.armory[id] || 0) + n;
  }
  return st;
}
function migrateArmory(st){ splitArmory(st); st.v = 12; return st; }
// v13: additive. Every owned gun / armor starts at Mk I with no attachments; levels, counts and FIR are untouched.
function migrateBuilt(st){
  const out = (st.coreLaunch && Array.isArray(st.coreLaunch.gear)) ? st.coreLaunch.gear : [];
  const n = id => ((st.stash && st.stash[id]) || 0) + ((st.armory && st.armory[id]) || 0);
  for(const k of ["gearTier","attach","gearUp"]) if(st[k] && typeof st[k] === "object")
    for(const id of Object.keys(st[k])) if(!(ITEMS[id] && ITEMS[id].free) && !n(id) && !out.includes(id)) delete st[k][id];
  st.v = 14; return st;
}
// v1.93: the built copy (tier, attachments, upgrade level) is the one you carry; losing it on death resets the gun to a plain Mk I.
function loseBuilt(id){ if(!ITEMS[id] || ITEMS[id].free) return; for(const k of ["gearTier","attach","gearUp"]) if(S[k]) delete S[k][id]; }
// v15 (v1.95): BIT talent tree (docs/design-bit-skill-tree.md). The one active skill becomes 1 point in the matching
// core node (data/bit-talents.js), so nobody loses what they had; talents are never lost after this.
function migrateTalents(st){
  st.talents = { spent:{}, respecs:0 };
  if(st.bitSkill && ["zone_scout","shield_burst","loot_priority"].includes(st.bitSkill)) st.talents.spent[st.bitSkill] = 1;
  if(st.guardianMaterial === undefined) st.guardianMaterial = null;
  st.v = 15; return st;
}
function migrateTiers(st){ if(!st.gearTier || typeof st.gearTier !== "object") st.gearTier = {}; if(!st.attach || typeof st.attach !== "object") st.attach = {}; st.v = 13; return st; }
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
  return D.stashCapacityFor(S.modules.storage || 0);
}
// Free items (Basic Carbine) are infinite: never stored, never counted, never lost/sold.
function isFree(id){ return !!(ITEMS[id] && ITEMS[id].free); }
function invIds(){ return [...new Set([...Object.keys(S.stash || {}), ...Object.keys(S.armory || {})])].filter(id => ITEMS[id] && qty(id) > 0 && !isFree(id)); }
function qty(id){ return ((S.stash && S.stash[id]) || 0) + ((S.armory && S.armory[id]) || 0); }
// v1.97: Armory slots are per item id, not per copy — a weapon or any gear/consumable/tool stacks all its owned
// copies (dupes you're holding for a merge, spare medkits, ...) into the 1 slot its id already occupies.
function slotsFor(armory){ let n = 0; for(const id of invIds()) if(isArmoryItem(id) === armory) n += armory ? 1 : Math.ceil(qty(id) / (ITEMS[id].stackSize || 1)); return n; }
function stashSlotsUsed(){ return slotsFor(false); }
function armorySlotsUsed(){ return slotsFor(true); }
function armoryCapacity(){ return D.armoryCapacityFor(S.modules.storage || 0); }
function have(id){ return isFree(id) ? Infinity : qty(id); }
// fir = found in raid (extracted). Bought, crafted, reward and returned-gear items are not; they only count for plain uses.
function addItem(id, qty, fir){
  if(isFree(id)) return;
  const bag = isArmoryItem(id) ? (S.armory = S.armory || {}) : S.stash;
  bag[id] = (bag[id]||0) + qty;
  if(fir){ S.fir = S.fir || {}; S.fir[id] = (S.fir[id]||0) + qty; }
}
function firHave(id){ return isFree(id) ? 0 : Math.min((S.fir && S.fir[id]) || 0, qty(id)); }
// Spending keeps found-in-raid items for last: the stack's non-FIR part goes first.
function firClamp(id){ if(S.fir && S.fir[id] !== undefined){ S.fir[id] = Math.min(S.fir[id], qty(id)); if(S.fir[id] < 1) delete S.fir[id]; } }
// Consume found-in-raid copies (hand-ins): the stack shrinks and so does its FIR part; any non-FIR copies stay.
function removeFirItem(id, qty){
  const q = Math.min(qty, firHave(id)); if(q < 1) return;
  S.fir[id] -= q; removeItem(id, q);
}
function removeItem(id, qty){
  if(isFree(id)) return;
  let left = qty; S.armory = S.armory || {};
  for(const bag of isArmoryItem(id) ? [S.armory, S.stash] : [S.stash, S.armory]){ const take = Math.min(left, bag[id] || 0); if(take){ bag[id] -= take; left -= take; } }
  firClamp(id);
  if(S.reserved[id] && have(id) < 1) delete S.reserved[id];
  if(S.secureItem === id && have(id) < 1) S.secureItem = null;
}
function stockUnlocked(s){ return !s.requires || (S.modules[s.requires.module] || 0) >= s.requires.level; }
// Operator level (overall player level) from total raid XP; curve in DATA.progression.operator.
function opNeed(l){ const O = PROG.operator; return O.xpBase + O.xpStep * (l - 1); }
function operatorLevel(xp){
  const O = PROG.operator; xp = xp === undefined ? (S.opXp || 0) : xp;
  let l = 1, need; while(l < O.maxLevel && xp >= (need = opNeed(l))){ xp -= need; l++; }
  return { level:l, into:xp, need: l >= O.maxLevel ? 0 : opNeed(l) };
}
function gainOpXp(n){
  if(!(n > 0)) return 0;
  const before = operatorLevel().level; S.opXp = (S.opXp || 0) + Math.floor(n);
  const after = operatorLevel().level;
  if(after > before){ act("OPERATOR_LEVEL_UP", { level:after }); if(typeof document !== "undefined") toast("Operator level " + after); }
  return Math.floor(n);
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
// One recipe-backed target. Existing post-onboarding manual tracking is retained.
function progressionGoal(){
  let id = coreLevel() < 1 ? "rebirth_core" : (D.baseMap.rooms.find(r => r.destination && !(S.modules[r.destination] > 0)) || {}).destination;
  if(ftueOver() && S.tracked && MODS[S.tracked.module] && (S.modules[S.tracked.module]||0)<S.tracked.level) id=S.tracked.module;
  const m=MODS[id], next=m && nextLevelDef(id); if(!next) return null;
  const parts=costParts(next.cost).filter(p=>p.kind==='item'||p.have<p.need).map(p=>({id:p.id,kind:p.kind==='cur'?'currency':'item',name:(p.kind==='cur'?D.currencies[p.id]:ITEMS[p.id]).name,icon:(p.kind==='cur'?D.currencies[p.id]:ITEMS[p.id]).icon,need:p.need,secured:p.have}));
  const i=D.baseMap.rooms.findIndex(r=>r.destination===id), following=D.baseMap.rooms.slice(i+1).find(r=>r.destination?!(S.modules[r.destination]>0):!roomUnlocked(r.id));
  return {module:id,level:next.level,name:m.name,benefit:next.benefitText,parts,ready:canAfford(next.cost),following:following?following.label:null};
}
// Effect tiles for the goal card: only what DATA.upgradeRewardTiles says the level grants (max 3, priority in DATA.goalEffectTiles).
// Deterministic fit rule (no measuring): estimated width per tile = chrome 29px + longest of value (11px bold, ~7px/char) and
// label (8px, ~5.5px/char); the lowest-priority tiles are dropped until the row fits the narrowest card (250px). Never truncated.
function goalEffectTiles(g){
  const tiles = g ? D.goalEffectTiles(g.module, g.level, 3) : [];
  const w = t => 29 + Math.max(7 * String(t.value).length, 5.5 * String(t.label).length);
  while(tiles.length > 1 && tiles.reduce((a, t) => a + w(t), 3 * (tiles.length - 1)) > 250) tiles.pop();
  return tiles;
}
function goalTilesHtml(g){
  const tiles = goalEffectTiles(g);
  return tiles.length ? '<div class="gtiles" data-count="' + tiles.length + '">' + tiles.map(t => '<div class="gtile ' + t.kind + '" data-source="' + esc(t.source) + '">' + IC(t.icon) + '<span><b>' + esc(t.value) + '</b><small>' + esc(t.label) + '</small></span></div>').join('') + '</div>' : '';
}
function progressionGoalHtml(compact){
  const g=progressionGoal();if(!g)return "";
  const missing=g.parts.filter(p=>p.secured<p.need);
  if(compact) return '<button type="button" class="progress-goal compact" onclick="A.openBuilding(\''+g.module+'\')" aria-label="Next upgrade: '+esc(g.name)+' L'+g.level+'"><b>GOAL · '+esc(g.name).toUpperCase()+' L'+g.level+'</b><div>'+(missing.length?missing.map(p=>'<span title="'+esc(p.name)+'">'+IC(p.icon)+' '+(p.need-p.secured)+'</span>').join(''):'<span>'+IC("check")+' READY</span>')+'</div></button>';
  return '<section class="progress-goal" aria-label="Next upgrade"><b>'+IC(g.ready?"check":"target")+' '+esc(g.name)+' L'+g.level+'</b>'+goalTilesHtml(g)+'<div>'+missing.map(p=>'<span>'+IC(p.icon)+' '+esc(p.name)+' · need '+(p.need-p.secured)+'</span>').join('')+'</div><small>'+(g.ready?'SECURED · Ready to activate':'Only extracted loot is secured')+(g.following?' · Next: '+esc(g.following):'')+'</small><button class="'+(g.ready?'primary':'ghost')+'" onclick="A.openBuilding(\''+g.module+'\')">'+(g.ready?'ACTIVATE':'VIEW UPGRADE')+'</button></section>';
}
function guidedRaid(){ return (S.modules[PROG.raidPrepUnlockModule] || 0) < 1; }
function applyStarterRaid(){
  const cfg = PROG.starterRaid;
  Object.assign(session.prep, { zoneId:cfg.zoneId, routeId:cfg.routeId, riskId:cfg.riskId, insuranceId:cfg.insuranceId });
  // Guided raid fixes zone/route/risk only. Owned gear (e.g. a looted shotgun) stays selectable.
  if(session.prep.loadoutTouched) return;
  session.prep.loadout = Object.fromEntries(Object.entries(cfg.loadout).map(([slot,id]) => [slot,id && have(id) ? id : null]));
}
function roomPartsHtml(room){
  const next = room && room.destination && nextLevelDef(room.destination);
  if(!next) return "";
  return costParts(next.cost).filter(part=>part.have<part.need).map(part => '<span class="chip ' + (part.have >= part.need ? 'ok' : 'need') + '">' + partIcon(part) +
    esc(part.kind === "item" ? ITEMS[part.id].name : (part.id === "dataCores" ? "Data Cores" : "Scrap")) + ' ' + Math.min(part.have,part.need) + '/' + part.need + '</span>').join(' ');
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
  if(cost.scrap) parts.push({ kind:"cur", id:"scrap", need:cost.scrap, have:S.cur.scrap });
  if(cost.dataCores) parts.push({ kind:"cur", id:"dataCores", need:cost.dataCores, have:S.cur.dataCores });
  for(const id in (cost.items||{})) parts.push({ kind:"item", id, need:cost.items[id], have:have(id) });
  return parts;
}
function canAfford(cost){ return costParts(cost).every(p => p.have >= p.need); }
function payCost(cost){
  if(cost.scrap) S.cur.scrap -= cost.scrap;
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
  bitSpeak(dock);
}
function bitSpeak(dock){
  dock.classList.remove("quiet");
  clearTimeout(session.bitQuietT);
  session.bitQuietT = setTimeout(() => dock.classList.add("quiet"), D.bit.bubbleMs || 6000);
  if(session.screen === "prep") dock.classList.add("quiet"); // prep is dense: BIT waits until you tap his face
  if(!dock.dataset.wired){
    dock.dataset.wired = "1";
    document.getElementById("bitline").addEventListener("click", () => dock.classList.add("quiet"));
    document.getElementById("bitface").addEventListener("click", () => dock.classList.toggle("quiet"));
  }
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
function dayStr(){ return new Date(Date.now()).toDateString(); }
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
/* ---------- v1.56 base idle/offline layer (data/retention.js: DATA.idle) ---------- */
const IDLE = D.idle || { generator:{ ratePerHour:{}, capHours:8, minCollect:1 }, buildMinutes:{ default:{} }, fabricator:{ slots:{}, minutes:{}, defaultMinutes:10 }, scavenge:{ minutes:{}, scrap:[0,0], t1:[], t1Count:[0,0], t2:[], t2Chance:0 }, welcomeMinAwayMin:2 };
function idleState(){
  if(!S.idle) S.idle = { clock:0, genAt:0, builds:{}, fab:[], scav:null, freeBuildUsed:false, crafted:0, lastSeen:0, away:null };
  const I = S.idle; I.builds = I.builds || {}; I.fab = I.fab || []; return I;
}
// Rollback guard: the idle clock only moves forward. If the device clock is set back, timers pause (nothing completes
// early, nothing is lost) until real time passes the highest timestamp ever seen again.
function idleNow(){ const I = idleState(), t = Date.now(); if(t > I.clock) I.clock = t; return I.clock; }
const MIN = 60000, HOUR = 3600000;
function genRate(){ return IDLE.generator.ratePerHour[coreLevel()] || 0; }
function genCap(){ return Math.round(genRate() * (IDLE.generator.capHours + talentVal("scavNightShift"))); } // Scavenger: Night Shift (v1.95, generator half; scavenge has no offline cap today)
function genStored(now){ const I = idleState(); if(!genRate() || !I.genAt) return 0; return Math.min(genCap(), Math.floor((now - I.genAt) / HOUR * genRate())); }
function buildMinutes(modId, level){ const t = IDLE.buildMinutes[modId] || IDLE.buildMinutes.default; return (t && t[level]) || IDLE.buildMinutes.default[level] || 0; }
function fabMinutes(rid){ return IDLE.fabricator.minutes[rid] || IDLE.fabricator.defaultMinutes; }
function fabSlots(){ return IDLE.fabricator.slots[S.modules.fabricator || 0] || 0; }
function scavMinutes(){ return Math.round((IDLE.scavenge.minutes[Math.min(2, S.modules.bit_bay || 0)] || 0) * (1 - talentVal("scavQuickLegs"))); } // Scavenger: Quick Legs (v1.95)
function buildInProgress(modId){ return idleState().builds[modId] || null; }
function fmtLeft(ms){ const m = Math.max(0, Math.ceil(ms / MIN)); return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + 'm'; }
// Finishing a module level: same bookkeeping as an instant build (tracking, beats, base state). Payoff screens stay instant-only.
function finishModuleLevel(modId, level){
  const first=(S.modules[modId]||0)<level;
  S.modules[modId] = Math.max(S.modules[modId] || 0, level);
  if(first && modId === "rebirth_core" && level >= 2) gainPower(BP.coreUpgradeGain || 30, "core_upgrade");
  if(S.tracked && S.tracked.module === modId && S.tracked.level === level) S.tracked = null;
  act("MODULE_BUILT", { module: modId, level });
  advanceBaseState({ module:modId, level });
  if(modId === "bit_bay" && level === 1) revealCurrency("dataCores");
  if(modId === "fabricator" && level === 1) S.lastYieldAt = Date.now();
  const gift=first && MODS[modId].levels.find(l=>l.level===level).commissioning;
  if(gift)for(const id in gift)addItem(id,gift[id]);
  grantToolUnlocks(modId, level);
  if(first && !S.payoffDone && !S.payoff && PROG.firstUpgradePayoff[modId + ":" + level]) S.payoff = { pending:modId + ":" + level };
  const b = curBeat();
  if((b.type === "build" && b.module === modId && b.level === level) || (b.type === "build_any" && b.modules.includes(modId))) advanceBeat();
}
// Toolkit: the first charge of each tool is free when the module level that unlocks it (items.js tool.unlock) is built.
function grantToolUnlocks(modId, level){
  S.toolsGiven = S.toolsGiven || {};
  for(const it of D.items){
    const u = it.tool && it.tool.unlock;
    if(!u || u.module !== modId || level < u.level || S.toolsGiven[it.id]) continue;
    S.toolsGiven[it.id] = true; addItem(it.id, 1);
    act("TOOL_UNLOCKED", { tool: it.id });
  }
}
function craftOutput(r){
  if(r.output.currency){ S.cur[r.output.currency] = (S.cur[r.output.currency] || 0) + r.output.qty; revealCurrency(r.output.currency); }
  else addItem(r.output.itemId, r.output.qty);
  act("ITEM_CRAFTED", { recipe: r.id });
  return r.output.currency ? r.output.qty + " " + CUR_LABELS[r.output.currency] : (r.output.qty > 1 ? r.output.qty + "× " : "") + ITEMS[r.output.itemId].name;
}
function scavPools(){ return IDLE.scavenge.t1.concat(IDLE.scavenge.t2); }
// focus: { itemId, p } (Loot priority skill) - each basic pick becomes the tracked part with chance p.
function rollScavenge(rng, focus){
  const C = IDLE.scavenge, r = rng || Math.random, ri = ([a, b]) => a + Math.floor(r() * (b - a + 1)), items = {};
  const n = ri(C.t1Count) + talentVal("scavDeepPockets"); // Scavenger: Deep Pockets (v1.95)
  for(let i = 0; i < n; i++){ const id = focus && r() < focus.p ? focus.itemId : C.t1[Math.floor(r() * C.t1.length)]; items[id] = (items[id] || 0) + 1; }
  const miss = trackedMissingItem();
  // Scavenger capstone: Lucky Find — 1 in 4 hauls includes a rare part from the tracked chain (v1.95).
  if(talentVal("scavLuckyFind") && miss && C.t2.includes(miss.itemId) && r() < 0.25) items[miss.itemId] = (items[miss.itemId] || 0) + 1;
  else if(r() < C.t2Chance){ const id = C.t2[Math.floor(r() * C.t2.length)]; items[id] = (items[id] || 0) + 1; }
  return { scrap: ri(C.scrap), items };
}
// Resolve everything that finished up to "now" (also covers time spent offline). Returns report rows.
function tickIdle(){
  const I = idleState(), now = idleNow(), rows = [];
  if(genRate() && !I.genAt) I.genAt = now;           // generator starts once the Core is online
  for(const modId of Object.keys(I.builds)){ const b = I.builds[modId];
    if(now >= b.doneAt){ delete I.builds[modId]; finishModuleLevel(modId, b.level); rows.push({ kind:"build", icon:"build", txt:MODS[modId].name + " L" + b.level + " finished" }); } }
  while(I.fab.length && now >= I.fab[0].doneAt){ const job = I.fab.shift(), r = D.recipes.find(x => x.id === job.rid); if(r) rows.push({ kind:"craft", icon:"room-fabricator", txt:"Crafted " + craftOutput(r) }); }
  if(I.scav && now >= I.scav.returnAt){ const loot = I.scav.loot; I.scav = null; I.scavPending = loot;   // v1.86: waits for the player's Confirm (persisted in S.idle)
    act("SCAVENGE_RETURNED", loot);
    rows.push({ kind:"scav", icon:"scavenge", txt:"BIT is back with a haul. Confirm it in BIT." }); }
  if(rows.length){ I.away = I.away || { rows:[] }; I.away.rows.push(...rows); }
  return rows;
}
// Welcome-back summary (non-blocking strip on the base): only after welcomeMinAwayMin away and only if something happened.
function welcomeBack(){
  const I = idleState(), now = idleNow(), away = I.lastSeen ? now - I.lastSeen : 0;
  tickIdle();
  if(away > 0) tickPower({ offline:true });
  const stored = genStored(now), rows = (I.away && I.away.rows) || [];
  I.lastSeen = now;
  if(away < IDLE.welcomeMinAwayMin * MIN || (!rows.length && stored < IDLE.generator.minCollect)) { I.away = null; return null; }
  const w = { awayMs: away, rows: rows.slice(-6), stored }; session.welcome = w; I.away = null; save();
  if(typeof setTimeout === "function" && !/jsdom/i.test((typeof navigator !== "undefined" && navigator.userAgent) || "")) setTimeout(() => { if(session.welcome === w) A.dismissWelcome(); }, 14000); // unobtrusive: fades on its own
  return w;
}
function welcomeHtml(){
  const w = session.welcome; if(!w || session.screen !== "base") return "";
  const h = Math.floor(w.awayMs / HOUR), m = Math.round((w.awayMs % HOUR) / MIN);
  return '<aside class="welcome pop-card" role="status" aria-live="polite"><b>' + IC("bit-face") + ' Welcome back</b><small>Away ' + (h ? h + 'h ' : '') + m + 'm. BIT kept things running.</small>' +
    '<ul>' + w.rows.map(r => '<li>' + IC(r.icon) + ' ' + esc(r.txt) + '</li>').join("") + (w.stored >= IDLE.generator.minCollect ? '<li>' + IC("generator") + ' Recycler: ' + w.stored + ' Scrap ready</li>' : '') + '</ul>' +
    '<button type="button" class="pop-x" onclick="A.dismissWelcome()" aria-label="Close welcome back">' + IC("close") + '</button></aside>';
}

/* ---------- v1.81 T1-D bunker power (DATA.bunkerPower; milder drain) ---------- */
const BP = D.bunkerPower || { start:100, warnAt:30, shutoffAt:10, restoreAt:25, idleMsPerPoint:17.5*60*1000, offlineCap:3, raidDrainMin:1, raidDrainMax:2, l2RaidExtra:1, reinforce:{ scrap:18, gain:25, cooldownMs:45000 }, maintain:{ title:"Wall Charge", brief:"Hand in 2 Cable to restore bunker power", items:{ cable:2 }, energy:40, scrap:10 }, coreUpgradeGain:30 };
function powerState(){
  if(!S.power) S.power = { value:0, at:0, offlineDrained:0, reinforceAt:0, lastRoom:null, maintain:null };
  const P = S.power;
  if(P.value == null) P.value = 0;
  if(P.at == null) P.at = 0;
  if(P.offlineDrained == null) P.offlineDrained = 0;
  if(P.reinforceAt == null) P.reinforceAt = 0;
  if(P.lastRoom === undefined) P.lastRoom = null;
  if(P.maintain === undefined) P.maintain = null;
  return P;
}
function powerOnline(){ return ftueOver() && coreLevel() >= 1; }
function powerValue(){ tickPower(); return Math.max(0, Math.min(100, Math.round(powerState().value))); }
function powerTier(){ const v = powerValue(); return v < BP.shutoffAt ? "crit" : v < BP.warnAt ? "warn" : "ok"; }
function l2ModuleLevels(){
  let n = 0;
  for(const id of Object.keys(MODS)){ const lv = S.modules[id] || 0; if(lv >= 2) n += lv - 1; }
  return n;
}
function tickPower(opts){
  opts = opts || {};
  if(!powerOnline()) return powerState();
  const P = powerState(), now = idleNow();
  if(!P.at){ P.at = now; if(P.value <= 0 && coreLevel() >= 1) P.value = BP.start; return P; }
  const dt = Math.max(0, now - P.at);
  if(dt <= 0) return P;
  if(opts.offline){
    const room = Math.floor(dt / BP.idleMsPerPoint);
    const add = Math.min(BP.offlineCap - (P.offlineDrained || 0), room);
    if(add > 0){ P.value = Math.max(0, P.value - add); P.offlineDrained = (P.offlineDrained || 0) + add; }
  } else {
    const pts = dt / BP.idleMsPerPoint;
    if(pts > 0) P.value = Math.max(0, P.value - pts);
    P.offlineDrained = 0;
  }
  P.at = now;
  syncMaintainQuest();
  return P;
}
function drainPowerRaid(){
  if(!powerOnline()) return 0;
  tickPower();
  const P = powerState();
  const base = BP.raidDrainMin + Math.floor(Math.random() * (BP.raidDrainMax - BP.raidDrainMin + 1));
  const extra = (BP.l2RaidExtra || 0) * l2ModuleLevels();
  const n = base + extra;
  P.value = Math.max(0, P.value - n);
  act("POWER_RAID_DRAIN", { n, base, extra });
  syncMaintainQuest();
  save();
  return n;
}
function gainPower(n, why){
  if(!n) return;
  const P = powerState();
  P.value = Math.min(100, Math.max(0, P.value) + n);
  act("POWER_GAIN", { n, why: why || "" });
  syncMaintainQuest();
  save();
}
function syncMaintainQuest(){
  if(!powerOnline()){ powerState().maintain = null; return; }
  const P = powerState(), v = P.value;
  if(v >= BP.warnAt){ P.maintain = null; return; }
  if(!P.maintain) P.maintain = { prog: 0 };
  if(v < BP.shutoffAt && S.trackedQuest !== "maintain") S.trackedQuest = "maintain";
}
function maintainDef(){
  const m = BP.maintain; if(!m) return null;
  const items = m.items || { cable: 2 };
  const n = Object.values(items).reduce((a, x) => a + x, 0);
  const prog = Object.keys(items).reduce((a, id) => a + Math.min(items[id], have(id)), 0);
  return { id:"maintain", title:m.title, brief:m.brief, items, n, prog: Math.min(n, prog), energy:m.energy, scrap:m.scrap || 0 };
}
function maintainReady(){ const d = maintainDef(); return d && d.prog >= d.n; }
function roomPowered(modId){
  if(!powerOnline()) return true;
  if(modId === "rebirth_core") return true;
  if(powerValue() >= BP.shutoffAt) return true;
  return powerState().lastRoom === modId;
}
function markRoomUsed(modId){ if(modId && modId !== "rebirth_core") powerState().lastRoom = modId; }
function reinforceCost(){ return (BP.reinforce && BP.reinforce.scrap) || 18; }
function canReinforce(){
  if(!powerOnline()) return { ok:false, reason:"offline" };
  tickPower();
  const R = BP.reinforce || {}, now = idleNow(), P = powerState();
  if(P.value >= 100) return { ok:false, reason:"full" };
  if(P.reinforceAt && now < P.reinforceAt) return { ok:false, reason:"cooldown" };
  if((S.cur.scrap || 0) < (R.scrap || 18)) return { ok:false, reason:"scrap" };
  return { ok:true };
}
function doReinforce(){
  const c = canReinforce(); if(!c.ok) return c;
  const R = BP.reinforce || {}, P = powerState();
  S.cur.scrap -= R.scrap || 18;
  P.reinforceAt = idleNow() + (R.cooldownMs || 45000);
  gainPower(R.gain || 25, "reinforce");
  act("POWER_REINFORCE", { scrap:R.scrap, gain:R.gain });
  return { ok:true };
}
function completeMaintain(){
  const d = maintainDef(); if(!d || d.prog < d.n) return null;
  for(const id in d.items){ if(have(id) < d.items[id]) return null; }
  for(const id in d.items) removeItem(id, d.items[id]);
  if(d.scrap) S.cur.scrap = (S.cur.scrap || 0) + d.scrap;
  gainPower(d.energy, "maintain");
  powerState().maintain = null;
  if(S.trackedQuest === "maintain") S.trackedQuest = null;
  act("POWER_MAINTAIN", { energy:d.energy });
  return d;
}
/* ---------- v1.82 T2 Living Quarters rest (DATA.rest): +bunker power now, buff for the NEXT raid only ---------- */
const RST = D.rest || { powerGain:10, buff:{ shield:20 }, label:"Rested" };
function restState(){ if(!S.rest) S.rest = { buff:null, at:0 }; if(S.rest.buff === undefined) S.rest.buff = null; return S.rest; }
function restBuff(){ return restState().buff; }
function canRest(){
  if(!roomUnlocked("living_quarters")) return { ok:false, reason:"locked" };
  if(!roomPowered("living_quarters")) return { ok:false, reason:"power" };
  if(restBuff()) return { ok:false, reason:"rested" };
  return { ok:true };
}
function doRest(){
  const c = canRest(); if(!c.ok) return c;
  restState().buff = Object.assign({}, RST.buff); restState().at = idleNow();
  markRoomUsed("living_quarters");
  if(powerOnline() && powerState().value < 100) gainPower(RST.powerGain, "rest");
  act("ROOM_REST", { buff:RST.buff, gain:RST.powerGain });
  return { ok:true };
}
// The buff is consumed the moment the next raid launches (deployNodeRaid), win or lose; it never carries over twice.
function takeRestBuff(){ const b = restBuff(); if(!b) return null; restState().buff = null; act("REST_BUFF_USED", { buff:b }); return b; }
function restBuffText(b){ b = b || restBuff(); return b ? Object.keys(b).map(k => "+" + b[k] + " " + k.toUpperCase()).join(" ") : ""; }
function loopPhase(){
  if(!ftueOver()) return null;
  tickPower();
  const v = powerState().value;
  if(v < BP.warnAt) return { id:"protect", label:"Skydda bunkern", line:"Keep bunker power up" };
  if(coreLevel() < 3 && chainActive("bunker")) return { id:"wake", label:"Vack Core", line:"Raise the Rebirth Core" };
  const next = typeof wmNextTarget === "function" ? wmNextTarget() : null;
  if(next){ const a = AREA_DEFS[next]; return { id:"zone", label:"Oppna nasta zon", line: a ? ("Unlock " + a.name) : "Open the next zone" }; }
  if(chainActive("bunker") || chainActive("archipelago")) return { id:"wake", label:"Vack Core", line:"Follow the quest chain" };
  return { id:"wake", label:"Vack Core", line:"Raise the Rebirth Core" };
}
function powerMeterHtml(){
  if(!powerOnline()) return "";
  const v = powerValue(), tier = powerTier(), lbl = "Bunkerstrom";
  return '<button type="button" class="cur power-meter ' + tier + '" onclick="A.powerTap()" title="' + lbl + ' ' + v + '/100" aria-label="' + lbl + ' ' + v + ' of 100' + (tier === "warn" ? ". Warning" : tier === "crit" ? ". Critical" : "") + '">' +
    '<i aria-hidden="true">' + IC("power") + '</i><span class="pm-track" aria-hidden="true"><span class="pm-fill" style="width:' + v + '%"></span></span><b>' + v + '</b></button>';
}
function powerPopupHtml(){
  tickPower();
  const v = powerValue(), tier = powerTier(), R = BP.reinforce || {}, c = canReinforce(), d = maintainDef();
  const warn = tier === "warn" ? '<p class="pwr-warn">' + bitImg("bit-power-warning", "bit-power-warning") + IC("warning") + ' Strommen dippar. Forstark vaggarna.</p>' :
    tier === "crit" ? '<p class="pwr-warn crit">' + bitImg("bit-power-warning", "bit-power-warning") + IC("warning") + ' Rooms are dark. Core stays lit. Reinforce or hand in Cable.</p>' : "";
  const rein = '<button type="button" class="primary' + (c.ok ? '' : ' off') + '" ' + (c.ok ? 'onclick="A.reinforce()"' : 'disabled') + '>' + IC("stat-shield") + ' REINFORCE · ' + IC("cur-scrap") + ' ' + (R.scrap || 18) + ' · +' + (R.gain || 25) + '</button>' +
    (!c.ok && c.reason === "scrap" ? '<small class="sub">Need more Scrap</small>' : !c.ok && c.reason === "cooldown" ? '<small class="sub">Reinforce cooling down</small>' : !c.ok && c.reason === "full" ? '<small class="sub">Power is full</small>' : '');
  const mReady = d && d.prog >= d.n;
  const maint = d ? '<div class="card small pwr-maint"><b>' + IC("quest") + ' ' + esc(d.title) + '</b><small>' + esc(d.brief) + '</small><div class="qgrow">' +
    Object.keys(d.items).map(id => qTile(ITEMS[id].icon, Math.min(d.items[id], have(id)) + "/" + d.items[id], have(id) >= d.items[id] ? "ok" : "", ITEMS[id].name)).join("") +
    '</div><button type="button" class="' + (mReady ? "primary" : "ghost") + '"' + (mReady ? ' onclick="A.maintainHandIn()"' : ' disabled') + '>' + (mReady ? "HAND IN · +" + d.energy + " power" : "Need parts") + '</button></div>' : "";
  return '<div class="bpop pwrpop"><div class="bpop-head"><span class="bicon" aria-hidden="true">' + IC("power") + '</span><h1>Bunkerstrom</h1><em>' + v + '/100</em></div>' +
    '<div class="pwr-bar ' + tier + '"><span style="width:' + v + '%"></span></div>' + warn +
    '<p class="sub">Idle drain is mild. Offline almost none. RAID still works when rooms go dark.</p>' + rein + maint + '</div>';
}

function genCardHtml(){
  if(!genRate()) return "";
  const now = idleNow(), st = genStored(now), cap = genCap(), pct = Math.round(st / cap * 100);
  return '<div class="idlecard gen"><i aria-hidden="true">' + IC("generator") + '</i><span><b>Scrap recycler · ' + genRate() + '/h</b><small>' + st + '/' + cap + ' stored' + (st >= cap ? ' · FULL' : ' · full in ' + fmtLeft((cap - st) / genRate() * HOUR) ) + '</small>' +
    '<span class="ibar"><span style="width:' + pct + '%"></span></span></span><button type="button" class="ghost inline collect" ' + (st >= IDLE.generator.minCollect ? 'onclick="A.collectScrap()"' : 'disabled') + ' aria-label="Collect ' + st + ' scrap">' + IC("cur-scrap") + ' ' + st + '</button></div>';
}
function buildCardHtml(modId){
  const b = buildInProgress(modId); if(!b) return "";
  const now = idleNow(), pct = Math.min(100, Math.round((now - b.startAt) / (b.doneAt - b.startAt) * 100));
  return '<div class="idlecard building"><i aria-hidden="true">' + IC("scaffold") + '</i><span><b>Building L' + b.level + '</b><small>' + fmtLeft(b.doneAt - now) + ' left · finishes even while you are away</small><span class="ibar"><span style="width:' + pct + '%"></span></span></span></div>';
}
function fabQueueHtml(){
  if(!(S.modules.fabricator >= 1)) return "";
  const I = idleState(), now = idleNow();
  return '<div class="idlecard fabq"><i aria-hidden="true">' + IC("timer") + '</i><span><b>Fabricator queue · ' + I.fab.length + '/' + fabSlots() + '</b>' +
    (I.fab.length ? I.fab.map((j, i) => { const r = D.recipes.find(x => x.id === j.rid); return '<small>' + (i ? 'Next: ' : 'Now: ') + esc(r ? r.name : j.rid) + ' · ' + fmtLeft(j.doneAt - now) + '</small>'; }).join("") : '<small>Idle. Queued crafts finish while you are away.</small>') + '</span></div>';
}
// Short room explanation (DATA.roomExplain): one blurb + icon tiles. Shown on every room tap, locked or open.
function roomExplainHtml(id){
  const x = (D.roomExplain || {})[id]; if(!x) return "";
  return '<div class="rx"><p>' + esc(x.blurb) + '</p><div class="rxt">' + x.tiles.map(t => '<span><i aria-hidden="true">' + IC(t.icon) + '</i>' + esc(t.label) + '</span>').join("") + '</div></div>';
}
// Fabricator room craft list: every unlocked recipe is craftable here (A.craft); higher-level tool recipes show their Fab gate.
function fabCraftHtml(){
  const lvl = S.modules.fabricator || 0, I = idleState(), first = !I.crafted;
  // Queue is full: craft() silently blocks and queues a toast that this very overlay defers, so the
  // button must say so itself instead of looking tappable while doing nothing.
  const full = I.crafted > 0 && I.fab.length >= fabSlots();
  const rows = D.recipes.filter(r => r.fabricatorLevel <= lvl || (ITEMS[r.output.itemId] && ITEMS[r.output.itemId].tool))
    .sort((a, b) => (a.fabricatorLevel > lvl) - (b.fabricatorLevel > lvl) || (!!(ITEMS[b.output.itemId] && ITEMS[b.output.itemId].tool)) - (!!(ITEMS[a.output.itemId] && ITEMS[a.output.itemId].tool)));
  return '<div class="fabcraft" aria-label="Craft">' + rows.map(r => {
    const gated = r.fabricatorLevel > lvl, cost = craftCost(r), inOk = Object.keys(r.inputs).every(id => have(id) >= r.inputs[id]);
    const can = !gated && !full && S.cur.scrap >= cost && inOk;
    const ico = r.output.itemId ? ITEMS[r.output.itemId].icon : "cur-datacore";
    const needs = Object.entries(r.inputs).map(([id, q]) => '<em class="' + (have(id) >= q ? 'ok' : 'miss') + '">' + q + '× ' + esc(ITEMS[id].name) + '</em>').join(" ");
    return '<div class="fabrow' + (gated ? ' gated' : '') + '" data-recipe="' + r.id + '"><i aria-hidden="true">' + (r.output.itemId ? itemImg(r.output.itemId) : IC(ico)) + '</i><span><b>' + esc(r.name) + (r.output.qty > 1 ? ' ×' + r.output.qty : '') + '</b><small>' + needs + ' <em class="' + (S.cur.scrap >= cost ? 'ok' : 'miss') + '">' + cost + ' Scrap</em></small></span>' +
      (gated ? '<button type="button" class="ghost inline" disabled>' + IC("lock") + ' FAB L' + r.fabricatorLevel + '</button>'
        : !gated && full ? '<button type="button" class="ghost inline" disabled>' + IC("timer") + ' QUEUE FULL</button>'
        : '<button type="button" class="ghost inline" ' + (can ? 'onclick="A.craft(\'' + r.id + '\')"' : 'disabled') + '>' + (first ? 'CRAFT' : IC("timer") + ' ' + fabMinutes(r.id) + 'm') + '</button>') + '</div>';
  }).join("") + '</div>';
}
function scavLootText(loot){ return "+" + loot.scrap + " Scrap" + Object.entries(loot.items).map(([id, q]) => ", " + q + "× " + ITEMS[id].name).join(""); }
function scavPending(){ return (S.idle && S.idle.scavPending) || null; }
// Confirm: the only place a BIT haul is deposited. Clears pending first so a double tap can never pay twice.
function confirmScav(){
  const I = idleState(), loot = I.scavPending; if(!loot) return false;
  I.scavPending = null; S.cur.scrap += loot.scrap; for(const id in loot.items) addItem(id, loot.items[id]);
  act("SCAVENGE_CONFIRMED", loot); save(); return true;
}
/* ---------- v1.95 BIT Talents (data/bit-talents.js): data-driven branches and row-gate step ---------- */
// Node ids and effect keys all come from TAL; app.js never hardcodes a branch/node beyond the shared "core" ids
// (zone_scout/shield_burst/loot_priority) that also name the pre-existing BIT skills they replace.
function talentNodeDef(id){ if(!TAL) return null; for(const b of TAL.branches){ const n = b.nodes.find(n => n.id === id); if(n) return { node:n, branch:b }; } return null; }
function talentRank(id){ return (S.talents && S.talents.spent && S.talents.spent[id]) || 0; }
function talentLearned(id){ return talentRank(id) > 0; }
function branchSpent(branchId){ if(!TAL) return 0; const b = TAL.branches.find(b => b.id === branchId); return b ? b.nodes.reduce((s, n) => s + talentRank(n.id), 0) : 0; }
function talentSpentTotal(){ return TAL ? TAL.branches.reduce((s, b) => s + branchSpent(b.id), 0) : 0; }
function talentPoints(){ return Math.max(0, bondLevel() - 1); } // 1 point per Bond level from Bond 2 (Bond 1 = 0)
function talentPointsAvailable(){ return talentPoints() - talentSpentTotal(); }
function talentRowReq(row){ return ((TAL && TAL.rowGateStep) || 0) * (row - 1); }
function talentRowUnlocked(branch, row){ return branchSpent(branch.id) >= talentRowReq(row); }
function talentChoiceTaken(branch, group){ return branch.nodes.find(n => n.choiceGroup === group && talentLearned(n.id)) || null; }
function talentCanLearn(id){
  const t = talentNodeDef(id); if(!t || talentPointsAvailable() < 1) return false;
  const { node, branch } = t;
  if(talentRank(id) >= node.ranks || !talentRowUnlocked(branch, node.row)) return false;
  if(node.choiceGroup){ const taken = talentChoiceTaken(branch, node.choiceGroup); if(taken && taken.id !== id) return false; }
  return true;
}
function learnTalent(id){
  if(!talentCanLearn(id)) return false;
  S.talents.spent[id] = talentRank(id) + 1;
  act("TALENT_LEARNED", { id, rank:S.talents.spent[id] });
  return true;
}
// v1.97 BIT tab "Next unlock" cards: the next not-yet-maxed node in a talent branch (tasks tab -> Scavenger,
// since that branch powers scavenge/expedition), the next quest-chain payoff, and the next trader one-off item.
// No new rules: reuses talentRowUnlocked/talentPointsAvailable, questUnlocksText and the chip shop catalog.
function bitNextTalentUnlock(branchId){
  if(!TAL) return null;
  const branch = TAL.branches.find(b => b.id === branchId); if(!branch) return null;
  const node = branch.nodes.find(n => {
    if(talentRank(n.id) >= n.ranks) return false;
    if(n.choiceGroup){ const taken = talentChoiceTaken(branch, n.choiceGroup); if(taken && taken.id !== n.id) return false; }
    return true;
  });
  if(!node) return null;
  const req = !talentRowUnlocked(branch, node.row) ? "Spend " + talentRowReq(node.row) + " in " + branch.name
    : talentPointsAvailable() > 0 ? "1 point ready to spend"
    : "1 point at Bond LV " + (bondLevel() + 1);
  return { name:node.name, req };
}
function tasksNextUnlockInfo(){ return bitNextTalentUnlock("scavenger"); }
function questNextUnlockInfo(){
  const t = trackedQuest();
  if(t && !t.maintain) return { name:questUnlocksText(t.chain, t.step), req:'Finish "' + t.step.title + '"' };
  const locked = Object.keys(QC).find(id => !chainAvailable(id));
  if(locked) return { name:QC[locked].name, req:"Unlocks in " + areaName((QC[locked].steps[0] || {}).area) };
  return null;
}
function traderNextUnlockInfo(){
  const it = CS.items.find(it => it.kind !== "item" && !chipOwned(it)); if(!it) return null;
  const short = Math.max(0, it.price - (S.cur.chips || 0));
  return { name:chipName(it), req:it.price + " Contract Chips" + (short ? " (" + short + " more)" : "") };
}
function nextUnlockCardHtml(info){
  if(!info) return "";
  return '<div class="card nextunlock"><b>' + IC("unlock") + "NEXT UNLOCK</b><span>" + esc(info.name) + '</span><small>' + esc(info.req) + '</small></div>';
}
function talentRespecCost(){ return S.talents.respecs ? Math.min(1000, 200 * S.talents.respecs) : 0; }
function respecTalents(){
  const cost = talentRespecCost();
  if(cost > S.cur.scrap) return false;
  S.cur.scrap -= cost;
  S.talents.spent = {};
  S.talents.respecs = (S.talents.respecs || 0) + 1;
  act("TALENTS_RESPEC", { cost });
  return true;
}
// Cumulative value of every learned node sharing this effect key, at its current rank (0 if none learned).
function talentVal(key){
  let v = 0;
  if(!TAL) return v;
  for(const b of TAL.branches) for(const n of b.nodes) if(n.effect && n.effect.key === key){ const r = talentRank(n.id); if(r > 0) v += n.effect.perRank[r - 1]; }
  return v;
}
// A "material" is a stashable, non-free item that is not usable gear (weapon/armor/tool/consumable); the Guardian
// capstone fallback only ever rescues this kind of item, picked by id (never a hardcoded item string).
function isMaterialItem(id){ return !!ITEMS[id] && !isFree(id) && !usableGear(id); }
// Legacy BIT skills (bond-gated) are now the row-2 core node of their branch: passive once learned, no single toggle.
function bitSkillDef(id){ return (D.bit.skills || []).find(k => k.id === id) || null; }
function bitSkillOn(id){ return bitOnline() && talentLearned(id); }
function scoutLead(){ const miss = bitSkillOn("zone_scout") && !bitAway() ? trackedMissingItem() : null; const lead = miss && bestLead(miss.itemId); return lead ? { miss, lead } : null; }
function bitShieldBurst(){ const k = bitSkillDef("shield_burst"); return k && bitSkillOn("shield_burst") && !bitAway() ? k.shield : 0; }
function scavCardHtml(){
  if(!bitOnline()) return "";
  const I = idleState(), now = idleNow(), pend = scavPending();
  if(pend) return '<div class="idlecard scav pending">' + bitImg("bit-haul-return", "bit-haul-return") + '<i aria-hidden="true">' + IC("scavenge") + '</i><span><b>BIT is back with a haul</b><small>' + esc(scavLootText(pend)) + '. Waiting for your Confirm.</small></span>' +
    '<button type="button" class="primary inline" onclick="A.openHaul()">CONFIRM</button></div>';
  if(I.scav) return '<div class="idlecard scav">' + bitImg("bit-scavenging-away", "bit-scavenging-away") + '<i aria-hidden="true">' + IC("scavenge") + '</i><span><b>BIT is scavenging</b><small>Back in ' + fmtLeft(I.scav.returnAt - now) + ' with a small haul. Never fails.</small><span class="ibar"><span style="width:' + Math.min(100, Math.round((now - I.scav.startAt) / (I.scav.returnAt - I.scav.startAt) * 100)) + '%"></span></span></span></div>';
  const busy = !!S.expedition, miss = bitSkillOn("loot_priority") ? trackedMissingItem() : null, aim = miss && scavPools().includes(miss.itemId) ? miss : null;
  return '<div class="idlecard scav"><i aria-hidden="true">' + IC("scavenge") + '</i><span><b>Scavenging run · ' + scavMinutes() + ' min</b><small>Free. ' + IDLE.scavenge.scrap[0] + "-" + IDLE.scavenge.scrap[1] + ' Scrap + 1-2 basic parts, sometimes a rare one.' + (aim ? ' Priority: ' + esc(ITEMS[aim.itemId].name) + '.' : '') + '</small></span>' +
    '<button type="button" class="ghost inline" ' + (busy ? 'disabled' : 'onclick="A.sendScavenge()"') + '>SEND</button></div>';
}
function haulPopupHtml(pend){
  return '<div class="bpop haulpop" data-module="bit_bay"><div class="bpop-head">' + bitImg("bit-haul-return", "bit-haul-return") + '<span class="bicon" aria-hidden="true">' + IC("scavenge") + '</span><h1>BIT is back</h1></div>' +
    '<p class="eff">BIT brought this back from the scavenging run. It stays here until you confirm.</p><div class="costs">' +
    '<div class="cost ok"><i aria-hidden="true">' + IC("cur-scrap") + '</i><b>+' + pend.scrap + '</b><span class="cname">Scrap</span></div>' +
    Object.entries(pend.items).map(([id, q]) => '<div class="cost ok"><i aria-hidden="true">' + itemImg(id) + '</i><b>+' + q + '</b><span class="cname">' + esc(ITEMS[id].name) + '</span></div>').join("") + '</div>' +
    '<button class="primary big" onclick="A.confirmHaul()">CONFIRM</button></div>';
}
/* ---------- v1.95 PART 2: BIT fullscreen screen (reuses the #overlay.wpnov / .fabov fullscreen pattern) ----------
   Tabs: TALENTS (the tree below) · TASKS (scavenge/expedition/contracts) · QUESTS/TRADER (existing entry cards).
   The TALENTS tab is rendered generically from TAL.branches: app.js never hardcodes a branch or node id here. */
const TAL_BRANCH_ICON = { scout:"aim", guardian:"stat-shield", scavenger:"scavenge" };
const TAL_BRANCH_COLOR = { cyan:"var(--ad-cyan)", coral:"var(--ad-danger)", amber:"var(--ad-loot)" };
function talentFmtVal(v){ return (v > 0 && v < 1) ? Math.round(v * 100) + "%" : Math.round(v * 100) / 100; }
function talentNodeHtml(node, branch, selId){
  const rank = talentRank(node.id), learned = rank > 0;
  const rowOpen = talentRowUnlocked(branch, node.row);
  const taken = node.choiceGroup ? talentChoiceTaken(branch, node.choiceGroup) : null;
  const blocked = !!taken && taken.id !== node.id;
  const locked = !rowOpen || blocked;
  const cls = ["talnode"];
  if(learned) cls.push("on");
  if(locked) cls.push("locked");
  if(node.capstone) cls.push("capstone");
  if(bitSkillDef(node.id)) cls.push("core");
  if(selId === node.id) cls.push("sel");
  const pips = node.ranks > 1 ? '<span class="pips">' + Array.from({ length:node.ranks }, (_, i) => '<span class="pip' + (i < rank ? ' on' : '') + '"></span>').join("") + '</span>' : "";
  return '<button type="button" class="' + cls.join(" ") + '" onclick="A.selectTalent(\'' + node.id + '\')" aria-label="' + esc(node.name) + (locked ? " (locked)" : "") + '">' +
    (node.capstone ? IC("star") : "") + '<b>' + esc(node.name) + '</b>' + pips + '</button>';
}
function talentRowHtml(branch, row, selId){
  const nodes = branch.nodes.filter(n => n.row === row);
  const body = nodes.length > 1
    ? nodes.map((n, i) => (i > 0 && n.choiceGroup && n.choiceGroup === nodes[i - 1].choiceGroup ? '<span class="talor">or</span>' : "") + talentNodeHtml(n, branch, selId)).join("")
    : talentNodeHtml(nodes[0], branch, selId);
  return '<div class="talrow"><div class="talrow-nodes">' + body + '</div>' +
    (!talentRowUnlocked(branch, row) ? '<div class="talrowlock">Spend ' + talentRowReq(row) + ' in ' + esc(branch.name) + '</div>' : "") + '</div>';
}
function talentBranchHtml(branch, selId){
  const rows = [1, 2, 3, 4, 5].map(r => talentRowHtml(branch, r, selId)).join("");
  return '<div class="talbranch" style="--branch-color:' + TAL_BRANCH_COLOR[branch.color] + '">' +
    '<div class="talbranch-head">' + IC(TAL_BRANCH_ICON[branch.id] || "nav-bit") + '<b>' + esc(branch.name).toUpperCase() + '</b><span class="small">' + branchSpent(branch.id) + '</span></div>' +
    rows + '</div>';
}
function talentDetailHtml(selId){
  const t = selId && talentNodeDef(selId);
  if(!t) return '<div class="taldetail"><p class="talempty">Tap a node to see its effect.</p></div>';
  const { node, branch } = t, rank = talentRank(node.id), maxed = rank >= node.ranks;
  const taken = node.choiceGroup ? talentChoiceTaken(branch, node.choiceGroup) : null;
  const blocked = !!taken && taken.id !== node.id;
  const rowOpen = talentRowUnlocked(branch, node.row), canLearn = talentCanLearn(node.id);
  return '<div class="taldetail" style="--branch-color:' + TAL_BRANCH_COLOR[branch.color] + '">' +
    '<h3>' + (node.capstone ? IC("star") : "") + esc(node.name) + '</h3>' +
    '<div class="ranktxt">Rank ' + rank + '/' + node.ranks + '</div>' +
    '<p>' + esc(node.desc) + '</p>' +
    (maxed ? '<div class="nextrank">Next rank: —</div>' : '<div class="nextrank">Next rank: ' + talentFmtVal(node.effect.perRank[rank]) + '</div>') +
    (!rowOpen ? '<div class="rowlockmsg">Spend ' + talentRowReq(node.row) + ' in ' + esc(branch.name) + '</div>' : "") +
    (blocked ? '<div class="rowlockmsg">Already chose ' + esc(taken.name) + '. Respec to change.</div>' : "") +
    '<button type="button" class="primary big learnbtn" ' + (canLearn ? 'onclick="A.learnTalent(\'' + node.id + '\')"' : "disabled") + '>' + (maxed ? "MAXED" : "LEARN · 1 POINT") + '</button>' +
    '</div>';
}
function talentsTabHtml(){
  if(!TAL) return '<div class="card small">Talents unavailable.</div>';
  const selId = session.bitNode;
  return '<div class="talroot"><div class="talbranches">' + TAL.branches.map(b => talentBranchHtml(b, selId)).join("") + '</div>' + talentDetailHtml(selId) + '</div>';
}
// TASKS tab: the existing scavenge/expedition/contracts cards, relocated off the old single-column screen and
// laid out 2-up (v1.97) so phone-landscape doesn't leave half the panel empty; a "Next unlock" card fills the gap.
function bitTasksTabHtml(){
  let top = scavCardHtml();
  if(retMode() !== "core"){
    if(bitAway()){
      top += '<div class="card"><b>BIT is in the field</b><div class="small">Back in ~' +
        Math.max(0, Math.ceil((S.expedition.returnAt - Date.now()) / 1000)) + 's. No loot scan, no odds — you are on your own out there.</div></div>';
    } else {
      const ec = D.retention.expedition.costScrap;
      top += '<div class="card"><div class="row"><b>Send BIT on expedition</b>' +
        '<button class="ghost inline" ' + (S.cur.scrap >= ec ? 'onclick="A.sendExpedition()"' : 'disabled') + '>' + IC("cur-scrap") + ' ' + ec + '</button></div>' +
        '<div class="small">He hunts alone for a while — biased toward your tracked item, can fail, and you lose his raid support meanwhile.</div></div>';
    }
  }
  let html = '<div class="bitgrid">' + top + nextUnlockCardHtml(tasksNextUnlockInfo()) + '</div>';
  if(contractsUnlocked()){
    const today = dayStr();
    if(S.contractsDay !== today){ S.contractsDay = today; S.contracts = {}; }
    html += '<h2>Daily contracts</h2><div class="bitgrid">';
    for(const c of D.retention.contracts.daily){
      const st = S.contracts[c.id];
      const rewardTxt = Object.keys(c.reward).map(k => "+" + c.reward[k] + " " + k).join(", ");
      html += '<div class="card row"><span' + (st ? ' class="ok"' : '') + '>' + (st ? IC("check") + " " : "") + esc(c.txt) + '</span>' +
        (st === "done"
          ? '<button class="ghost inline" onclick="A.claimContract(\'' + c.id + '\')">' + rewardTxt + '</button>'
          : '<span class="small">' + (st === "claimed" ? "claimed" : rewardTxt) + '</span>') + '</div>';
    }
    html += '</div>';
  }
  return html;
}
function bitHeaderHtml(){
  const bl = bondLevel(), cap = D.bit.bondLevels.find(b => b.level === bl), nxt = D.bit.bondLevels.find(b => b.level === bl + 1);
  const pct = nxt ? Math.min(100, Math.round(S.bondXp / nxt.xp * 100)) : 100;
  const avail = talentPointsAvailable(), spent = talentSpentTotal(), cost = talentRespecCost();
  const canReset = spent > 0 && S.cur.scrap >= cost;
  return '<div class="bithead">' + bitImg("bit-screen-portrait", "bit-screen-portrait") +
    '<div class="bitbond"><b>' + IC("nav-bit") + ' Bond LV ' + bl + '</b>' +
    '<span class="bitxpbar"><span style="width:' + pct + '%"></span></span>' +
    '<span class="bitxp">' + S.bondXp + (nxt ? '/' + nxt.xp : "") + ' xp</span></div>' +
    (avail > 0 ? '<div class="bitpoints">POINTS ' + avail + ' available</div>' : "") +
    '<button type="button" class="ghost inline bitreset" ' + (canReset ? "" : "disabled") + ' onclick="A.respecTalents()">' + IC("reset") + ' RESET' +
    (spent > 0 ? (cost > 0 ? " · " + cost + " SCRAP" : " · FREE") : "") + '</button>' +
    '</div>';
}
const BIT_TABS = [["talents", "TALENTS"], ["tasks", "TASKS"], ["quests", "QUESTS"], ["trader", "TRADER"]];
function bitScreenHtml(tab){
  tab = BIT_TABS.some(t => t[0] === tab) ? tab : "talents";
  const panel = (key, cls, body) => '<div class="tabpanel ' + cls + (tab === key ? " active" : "") + '">' + body + '</div>';
  return '<div class="bpop bitpop" data-module="bit_bay">' + bitHeaderHtml() +
    '<div class="bittabs" role="tablist">' + BIT_TABS.map(([key, label]) => '<button type="button" role="tab" class="' + (tab === key ? "active" : "") + '" aria-selected="' + (tab === key) + '" onclick="A.bitTab(\'' + key + '\')">' + label + '</button>').join("") + '</div>' +
    '<div class="bitbody">' +
      panel("talents", "talentstab", talentsTabHtml()) +
      panel("tasks", "tasktab", bitTasksTabHtml()) +
      panel("quests", "questtab", '<div class="bitgrid">' + (questEntryHtml() || '<div class="card small">No active quests yet.</div>') + nextUnlockCardHtml(questNextUnlockInfo()) + '</div>') +
      panel("trader", "tradertab", '<div class="bitgrid">' + (traderEntryHtml() || '<div class="card small">Trader unavailable.</div>') + nextUnlockCardHtml(traderNextUnlockInfo()) + '</div>') +
    '</div></div>';
}
// Always remove + recreate (same pattern as stashPopRender/quickCleanRender): safe to call from any BIT action's refresh().
// A quest/hand-in popup opened from the QUESTS tab (questLog/handInShow) replaces the BIT #overlay with its own
// (qlogov/handinov) rather than stacking a second one — so while one of those is up, leave it alone: recreating
// the BIT overlay here would destroy it (and its reward animation) out from under a background refresh().
function bitRender(tab){
  const old = document.getElementById("overlay");
  if(old && (old.classList.contains("qlogov") || old.classList.contains("handinov"))) return;
  if(old) old.remove();
  session.screenParam = tab || session.screenParam || "talents";
  overlay(bitScreenHtml(session.screenParam), () => A.go("base"), "sheet bitov");
}
/* ---------- v1.57 BIT Quests (data/quests.js): 3 per day, 1 free swap, always solvable with current unlocks ---------- */
const QD = D.quests, QF = D.questFacts || {};
const RARITY_HEX = { common:"#d6dde0", uncommon:"#3ddc6a", rare:"#3d8bff", epic:"#b05cff", legendary:"#ffc12e" };
function questTier(){ return (areaUnlocked("town") || coreLevel() >= 3) ? 2 : (areaUnlocked("archipelago") || coreLevel() >= 2) ? 1 : 0; }
// What the player can reach right now: unlocked areas, and per area the zones up to (highest cleared + 1).
function questReach(){
  const out = [];
  for(const a of WMAP.areas){ if(!areaUnlocked(a.id) || !QF[a.id]) continue;
    const top = Math.min(3, Math.max(0, ...areaZonesCleared(a.id)) + 1);
    for(let n = 1; n <= top; n++) out.push({ area:a.id, level:n, f:QF[a.id][n] }); }
  return out;
}
function questSolvable(q, reach){
  reach = reach || questReach();
  if(q.type === "kill") return reach.some(r => r.f.enemies.includes(q.enemy));
  if(q.type === "search") return reach.some(r => r.f.houses >= 1);
  if(q.type === "extract") return reach.some(r => r.f.items.includes(q.item) && (!q.area || r.area === q.area));
  if(q.type === "clear") return reach.some(r => r.area === q.area && r.level === q.level);
  return false;
}
function qn([a, b], rng){ return a + Math.floor(rng() * (b - a + 1)); }
function areaName(id){ return (AREA_DEFS[id] && AREA_DEFS[id].name) || id; }
function questLine(q){ return QD.lines[q.type].replace("{n}", q.n).replace("{type}", q.enemy || "").replace("{item}", q.item ? ITEMS[q.item].name : "").replace("{area}", areaName(q.area)).replace("{level}", q.level || ""); }
function questTitle(q){
  return q.type === "kill" ? "Defeat " + q.n + " " + q.enemy + (q.n > 1 ? "s" : "") : q.type === "search" ? "Search " + q.n + " house containers" :
    q.type === "extract" ? "Extract " + q.n + "× " + ITEMS[q.item].name : "Clear " + areaName(q.area) + " zone " + q.level + " and extract";
}
function questIcon(q){ return q.type === "kill" ? "target" : q.type === "search" ? "pickup" : q.type === "extract" ? qItemIc(q.item) : (AREA_DEFS[q.area] || {}).iconId || "flag"; }
function qItemIc(id){ return ITEMS[id].icon; }
// Candidate pool from reachable facts; nudges first toward the next unlock (tracked part, then the next area's scout run).
function questCandidates(rng){
  const reach = questReach(), tier = questTier(), c = [], seen = new Set(), push = q => { const k = q.type + (q.enemy || q.item || q.area || "") + (q.level || ""); if(seen.has(k) || !questSolvable(q, reach)) return; seen.add(k); c.push(q); };
  const miss = trackedMissingItem();
  if(miss){ const r = reach.find(r => r.f.items.includes(miss.itemId)); if(r) push({ type:"extract", item:miss.itemId, area:r.area, n:1, nudge:true }); }
  const next = WMAP.areas.find(a => !areaUnlocked(a.id) && a.requires && areaUnlocked(a.requires.from));
  if(next){ const from = next.requires.from, top = reach.filter(r => r.area === from).reduce((m, r) => Math.max(m, r.level), 0); if(top) push({ type:"clear", area:from, level:top, n:1, nudge:true }); }
  const types = [...new Set(reach.flatMap(r => r.f.enemies))];
  for(const t of types) if(QD.kill[t]) push({ type:"kill", enemy:t, n:qn(QD.kill[t][tier], rng) });
  if(reach.some(r => r.f.houses)) push({ type:"search", n:qn(QD.search[tier], rng) });
  const items = [...new Set(reach.flatMap(r => r.f.items))].filter(id => ITEMS[id] && !ITEMS[id].weapon && ITEMS[id].slot !== "armor");
  for(let i = 0; i < 3 && items.length; i++){ const id = items.splice(Math.floor(rng() * items.length), 1)[0], r = reach.find(r => r.f.items.includes(id)); push({ type:"extract", item:id, area:r.area, n:qn(QD.extract[tier], rng) }); }
  for(const r of reach) if(r.level >= 2 || reach.length === 1) push({ type:"clear", area:r.area, level:r.level, n:1 });
  return c;
}
function questState(){
  const today = dayStr();
  if(!S.quests || S.quests.day !== today){
    const rng = Math.random, pool = questCandidates(rng), list = [];
    // nudges first, then a varied mix (one per type where possible)
    for(const q of pool.filter(q => q.nudge)) if(list.length < QD.perDay) list.push(q);
    for(const t of ["kill","extract","search","clear"]) for(const q of pool) if(list.length < QD.perDay && q.type === t && !list.includes(q)) { list.push(q); break; }
    for(const q of pool) if(list.length < QD.perDay && !list.includes(q)) list.push(q);
    S.quests = { day:today, swaps:QD.freeSwapsPerDay, list:list.map((q, i) => Object.assign({ id:"q" + i + "-" + Date.now().toString(36), prog:0, done:false, claimed:false }, q)) };
  }
  return S.quests;
}
function questsOpen(){ return !!QD && bitOnline() && ftueOver(); }
// Daily quests ready to claim: shown as a count on the BIT tab, the QUESTS entry and the Daily tab (claim inside the quest log).
function dailyReadyCount(){ return questsOpen() ? questState().list.filter(q => q.done && !q.claimed).length : 0; }
// ---- quest chains (v1.70): data in DATA.questChains, state S.chains[id] = { step, prog } ----
const QC = D.questChains || {};
function chainAvailable(id){ return !!QC[id] && (id === "bunker" ? ftueOver() : areaUnlocked(id)); }
function chainState(id){ S.chains = S.chains || {}; return S.chains[id] || (S.chains[id] = { step:0, prog:0 }); }
function chainActive(id){ if(!chainAvailable(id)) return null; return QC[id].steps[chainState(id).step] || null; }
function chainStepN(def){ return def.objective.n; }
// Hand-ins of items that can drop in a raid (any questFacts loot list) only take found-in-raid copies (S.fir), never bought,
// crafted or reward ones. Items no raid drops (e.g. the Transmitter) take plain stash copies, otherwise the chain would block.
const RAID_FINDABLE = new Set(Object.values(QF).flatMap(a => Object.values(a).flatMap(l => l.items || [])));
function raidFindable(id){ return RAID_FINDABLE.has(id); }
function handinHave(id){ return raidFindable(id) ? firHave(id) : have(id); }
function handinFir(def){ return def.objective.type === "handin" && Object.keys(def.objective.items).some(raidFindable); }
function chainHandinProg(def){ const o = def.objective; return Math.min(o.n, Object.keys(o.items).reduce((a, k) => a + Math.min(o.items[k], handinHave(k)), 0)); }
// An objective that is met but not yet handed in. The step only advances (and pays) through chainComplete().
function chainReady(id){
  const def = chainActive(id); if(!def) return false;
  const o = def.objective;
  return o.type === "handin" ? Object.keys(o.items).every(k => handinHave(k) >= o.items[k]) : chainState(id).prog >= o.n;
}
function trackedQuest(){
  if(S.trackedQuest === "none") return null; // the player switched tracking off
  // T1-D: low bunker power puts the maintenance quest in the single tracked slot.
  if(powerOnline() && powerState().value < BP.warnAt){
    syncMaintainQuest();
    const m = maintainDef();
    if(m){
      S.trackedQuest = "maintain";
      return { chain:"maintain", step:{ id:"M1", title:m.title, brief:m.brief, area:null, objective:{ type:"handin", items:m.items, n:m.n } }, prog:m.prog, n:m.n, maintain:true };
    }
  } else if(S.trackedQuest === "maintain") S.trackedQuest = null;
  if(!S.trackedQuest || !chainActive(S.trackedQuest)) S.trackedQuest = Object.keys(QC).find(chainActive) || null;
  const id = S.trackedQuest; if(!id) return null;
  const def = chainActive(id);
  return { chain:id, step:def, prog: def.objective.type === "handin" ? chainHandinProg(def) : chainState(id).prog, n:chainStepN(def) };
}
function chainReward(def){
  const R = def.reward;
  if(R.scrap){ S.cur.scrap += R.scrap; revealCurrency("scrap"); }
  if(R.dataCores){ S.cur.dataCores = (S.cur.dataCores || 0) + R.dataCores; revealCurrency("dataCores"); }
  if(R.chips) S.cur.chips = (S.cur.chips || 0) + R.chips;
  if(R.unlock) grantUnlock(R.unlock);
  if(R.xp) gainOpXp(R.xp);
  for(const id in R.items || {}) addItem(id, R.items[id]);
  for(const id in R.tools || {}) addItem(id, R.tools[id]);
}
// The one turn-in: only when the objective is met (so a second call can never pay twice). Hand-ins consume found-in-raid items.
function chainComplete(id){
  if(!chainReady(id)) return null;
  const def = chainActive(id), st = chainState(id), o = def.objective;
  if(o.type === "handin") for(const k in o.items) raidFindable(k) ? removeFirItem(k, o.items[k]) : removeItem(k, o.items[k]);
  chainReward(def); st.step++; st.prog = 0;
  act("QUEST_CHAIN_STEP", { chain:id, step:def.id });
  return { chain:id, id:def.id, title:def.title, reward:def.reward };
}
// Raid result -> chain progress. A met objective waits for the HAND IN popup; returns the steps that just became ready.
function chainProgress(r){
  const done = [], ext = r.outcome === "extract", lv = Number(r.levelsCleared) || 0;
  for(const id of Object.keys(QC)){
    const def = chainActive(id); if(!def || def.objective.type === "handin") continue;
    const o = def.objective, st = chainState(id); let add = 0;
    if(r.area === def.area){
      if(o.type === "kill") add = Math.max(0, Math.floor(Number(r.killsByType && r.killsByType[o.enemy]) || 0));
      if(o.type === "extract" && ext && lv >= (o.level || 1) - 1) add = r.extracted.filter(x => x === o.item).length;
      if(o.type === "clear" && ext && lv >= o.level) add = 1;
    }
    const was = st.prog >= o.n; st.prog = Math.min(o.n, st.prog + add);
    if(!was && st.prog >= o.n) done.push({ chain:id, id:def.id, title:def.title }); // one step per chain per raid; the next starts after the hand in
  }
  return done;
}
// Raid result -> quest progress (kills by type, house searches, extracted items, clean area clears).
function questProgress(r){
  if(!questsOpen()) return []; questState();
  const doneNow = [], ext = r.outcome === "extract";
  for(const q of S.quests.list){ if(q.done) continue;
    let add = 0;
    if(q.type === "kill") add = Math.max(0, Math.floor(Number(r.killsByType && r.killsByType[q.enemy]) || 0));
    if(q.type === "search" && r.area === "town") add = Math.max(0, Math.floor(Number(r.skills && r.skills.searches) || 0));
    if(q.type === "extract" && ext) add = r.extracted.filter(id => id === q.item).length;
    if(q.type === "clear" && ext && r.area === q.area && (Number(r.levelsCleared) || 0) >= q.level) add = 1;
    q.prog = Math.min(q.n, q.prog + add);
    if(q.prog >= q.n){ q.done = true; q.rewards = questRewards(); doneNow.push(q); act("QUEST_DONE", { type:q.type }); }
  }
  return doneNow;
}
function questRewards(){
  const t = questTier(), R = QD.reward, miss = trackedMissingItem();
  const comp = miss && (QD.components.t1.includes(miss.itemId) || QD.components.t2.includes(miss.itemId)) ? miss.itemId : pick(t ? QD.components.t1.concat(QD.components.t2) : QD.components.t1);
  const all = [{ kind:"scrap", n:R.scrap[t] }, { kind:"item", item:comp, n:1 }, { kind:"xp", n:R.xp[t] }];
  all.splice(Math.floor(Math.random() * 3), 1);
  return all.concat([{ kind:"mystery" }]);
}
function rollMystery(rng){
  const M = QD.reward.mystery, r = (rng || Math.random)() * M.reduce((a, m) => a + m.w, 0);
  let acc = 0; const m = M.find(x => (acc += x.w) > r) || M[0];
  const pool = m.t2 ? QD.components.t2 : QD.components.t1, items = {};
  for(let i = 0; i < (m.items || 0); i++){ const id = pool[Math.floor((rng || Math.random)() * pool.length)]; items[id] = (items[id] || 0) + 1; }
  return { tier:m.tier, scrap:m.scrap || 0, items, dataCores:m.dataCores || 0 };
}
function rewardCardHtml(c, i, qid){
  const body = c.kind === "scrap" ? IC("cur-scrap") + '<b>+' + c.n + '</b><small>Scrap</small>' : c.kind === "xp" ? IC("star") + '<b>+' + c.n + '</b><small>Operator XP</small>' :
    c.kind === "item" ? itemImg(c.item) + '<b>' + c.n + '×</b><small>' + esc(ITEMS[c.item].name) + '</small>' : IC("mystery") + '<b>?</b><small>Mystery box · could be better, could be worse</small>';
  return '<button type="button" class="qcard ' + c.kind + '" onclick="A.questPick(\'' + qid + '\',' + i + ')">' + body + '</button>';
}
function questsHtml(){
  if(!questsOpen()) return "";
  const Q = questState(), open = Q.list.filter(q => !q.claimed), head = open.find(q => q.done) || open[0];
  const bubble = head ? (head.done ? QD.lines.done : questLine(head)) : QD.lines.none;
  return '<div class="card quests"><div class="row"><b>' + IC("quest") + ' BIT Quests</b><small class="muted">' + Q.list.filter(q => q.claimed).length + '/' + Q.list.length + ' today · new tomorrow</small></div>' +
    '<p class="bitbubble">' + IC("bit-face") + '<span>' + esc(bubble) + '</span></p>' +
    Q.list.map(q => '<div class="quest' + (q.done ? ' done' : '') + (q.claimed ? ' claimed' : '') + '" data-quest="' + q.type + '"><i aria-hidden="true">' + IC(questIcon(q)) + '</i><span><b>' + esc(questTitle(q)) + '</b>' +
      '<span class="ibar"><span style="width:' + Math.round(q.prog / q.n * 100) + '%"></span></span><small>' + q.prog + '/' + q.n + (q.nudge ? ' · helps your next unlock' : '') + '</small></span>' +
      (q.claimed ? '<em>' + IC("check") + '</em>' : q.done ? '<button type="button" class="ghost inline claim" onclick="A.questClaim(\'' + q.id + '\')">CLAIM</button>'
        : (Q.swaps > 0 ? '<button type="button" class="ghost inline swap" onclick="A.questSwap(\'' + q.id + '\')" aria-label="Swap this quest (1 free per day)">' + IC("swap") + '</button>' : '')) + '</div>').join("") + '</div>';
}
// ---- quest log (v1.71): area tabs + Daily, chain steps, detail with objective / reward tiles, one TRACK toggle ----
function qObjIcon(o){ return o.type === "extract" ? ITEMS[o.item].icon : o.type === "kill" ? "skull" : o.type === "handin" ? ITEMS[Object.keys(o.items)[0]].icon : "route"; }
// FIR = found in raid: small marker on tiles whose items must come out of a raid (stash, hand-in requirements).
function firMark(){ return '<i class="firmk" title="Found in raid" aria-hidden="true">' + IC("fir") + '</i>'; }
function qTile(ic, txt, cls, label){ return '<span class="qt ' + (cls || "") + '"' + (label ? ' title="' + esc(label) + '"' : '') + '>' + IC(ic) + (txt !== "" && txt != null ? '<b>' + esc(txt) + '</b>' : '') + (/\bfir\b/.test(cls || "") ? firMark() : '') + '</span>'; }
// v1.99: reward/loot tile for an item id (real art via itemImg) rather than a bare sprite icon id.
function qTileImg(id, txt, cls, label){ return '<span class="qt ' + (cls || "") + '"' + (label ? ' title="' + esc(label) + '"' : '') + '>' + itemImg(id) + (txt !== "" && txt != null ? '<b>' + esc(txt) + '</b>' : '') + (/\bfir\b/.test(cls || "") ? firMark() : '') + '</span>'; }
function chainPips(prog, n){
  if(n > 8) return '<span class="ibar"><span style="width:' + Math.round(prog / n * 100) + '%"></span></span>';
  let h = ""; for(let i = 0; i < n; i++) h += '<i' + (i < prog ? ' class="f"' : '') + '></i>';
  return '<span class="pips">' + h + '</span>';
}
function chainRewardTiles(R, hero){
  const t = [];
  if(R.scrap) t.push(qTile("cur-scrap", R.scrap, "", "Scrap"));
  if(R.xp) t.push(qTile("star", R.xp, "", "Operator XP"));
  if(R.chips) t.push(qTile("cur-chip", R.chips, "", "Contract Chips"));
  if(R.dataCores) t.push(qTile("cur-datacore", R.dataCores, "", "Data Cores"));
  for(const k of ["items", "tools"]) for(const id in R[k] || {}) t.push(hero && ITEMS[id].hero ? handInItemTile(id, R[k][id], "") : qTileImg(id, R[k][id], "", ITEMS[id].name));
  if(R.unlock) t.push(qTile("unlock", "", "", "Unlock"));
  return t.join("");
}
// done = n/n, future = 0/n; the current step shows live progress.
function chainObjTiles(def, prog, n){
  const o = def.objective, t = [];
  if(o.type !== "handin") t.push(qTile((AREA_DEFS[def.area] || {}).iconId || "flag", o.level ? "L" + o.level : "", "area", (AREA_DEFS[def.area] || {}).name));
  if(o.type === "handin") for(const id in o.items){ const got = Math.min(o.items[id], prog === n ? o.items[id] : handinHave(id)); t.push(qTile(ITEMS[id].icon, got + "/" + o.items[id], (raidFindable(id) ? "fir" : "") + (got >= o.items[id] ? " ok" : ""), ITEMS[id].name + (raidFindable(id) ? " (found in raid)" : ""))); }
  else t.push(qTile(qObjIcon(o), prog + "/" + n, "", o.type === "kill" ? o.enemy : o.type === "extract" ? ITEMS[o.item].name : "Clear"));
  return t.join("");
}
function questLogHtml(tab, sel){
  const ids = Object.keys(QC), daily = questsOpen();
  if(tab !== "daily" && !chainAvailable(tab)) tab = (trackedQuest() || {}).chain || ids.find(chainAvailable) || (daily ? "daily" : null);
  const tabs = ids.map(id => {
    const ok = chainAvailable(id), a = ((QC[id].steps[0] || {}).area);
    return '<button type="button" class="qtab' + (id === tab ? ' on' : '') + (ok && (trackedQuest() || {}).chain === id ? ' trk' : '') + (ok && chainReady(id) ? ' rdy' : '') + '"' + (ok ? ' onclick="A.questLog(\'' + id + '\')"' : ' disabled') + ' aria-label="' + esc(QC[id].name) + '">' + IC(ok ? (AREA_DEFS[a] || {}).iconId || "flag" : "lock") + '</button>';
  }).join("") + (daily ? '<button type="button" class="qtab' + (tab === "daily" ? ' on' : '') + '" onclick="A.questLog(\'daily\')" aria-label="Daily quests">' + IC("timer") +
    (dailyReadyCount() ? '<i class="qn">' + dailyReadyCount() + '</i>' : '') + '</button>' : '');
  let body = '';
  if(tab === "daily") body = '<div class="qdaily">' + questsHtml() + '</div>';
  else if(tab){
    const ch = QC[tab], st = chainState(tab), cur = Math.min(st.step, ch.steps.length - 1), i = sel == null || sel < 0 || sel >= ch.steps.length ? cur : sel, def = ch.steps[i];
    const state = i < st.step ? "done" : i === st.step ? "cur" : "lock", tq = trackedQuest(), tracked = !!tq && tq.chain === tab;
    const prog = state === "done" ? chainStepN(def) : state === "lock" ? 0 : (tq && tq.chain === tab ? tq.prog : def.objective.type === "handin" ? chainHandinProg(def) : st.prog), n = chainStepN(def);
    const list = ch.steps.map((s, k) => {
      const ks = k < st.step ? "done" : k === st.step ? "cur" : "lock", p = ks === "cur" ? (s.objective.type === "handin" ? chainHandinProg(s) : st.prog) : 0;
      return '<button type="button" class="qrow ' + ks + (k === i ? ' sel' : '') + (ks === "cur" && tracked ? ' trk' : '') + (ks === "cur" && chainReady(tab) ? ' rdy' : '') + '" onclick="A.questLog(\'' + tab + '\',' + k + ')">' + IC(ks === "done" ? "check" : ks === "lock" ? "lock" : qObjIcon(s.objective)) + '<b>' + esc(s.title) + '</b>' + (ks === "cur" ? chainPips(p, chainStepN(s)) : '') + '</button>';
    }).join("");
    body = '<div class="qlist">' + list + '</div><div class="qdet"><div><small>' + esc(ch.name).toUpperCase() + ' · ' + (i + 1) + '/' + ch.steps.length + '</small><h2>' + esc(def.title) + (handinFir(def) ? '<span class="qfir" title="Only items found in a raid count">' + IC("fir") + 'FIR</span>' : '') + '</h2>' + (def.brief ? '<p class="qbrief">' + esc(def.brief) + '</p>' : '') + '</div>' +
      '<div class="qtiles"><div class="qobj' + (state === "lock" ? ' dim' : '') + '">' + chainObjTiles(def, prog, n) + '</div><div class="qrw">' + chainRewardTiles(def.reward) + '</div></div>' +
      (state === "cur" ? '<div class="qact">' + questRaidBtn(tab, def, chainReady(tab)) + (chainReady(tab) ? '<button type="button" class="primary" onclick="A.handInOpen(\'' + tab + '\',\'log\')">' + IC("check") + 'HAND IN</button>' : '') +
        '<button type="button" class="qtrack' + (tracked ? ' on' : '') + '" onclick="A.QUEST_TRACK({chain:\'' + tab + '\'})" aria-pressed="' + tracked + '">' + IC(tracked ? "track-on" : "track-off") + (tracked ? 'Tracked' : 'Track') + '</button></div>' : '') + '</div>';
  }
  return '<div class="bpop qlog" data-tab="' + (tab || "") + '"><div class="qwrap"><div class="qtabs">' + tabs + '<button type="button" class="qtabx qchips" onclick="A.chipShop()" aria-label="BIT trader: ' + (S.cur.chips || 0) + ' Contract Chips">' + IC("cur-chip") + '<i class="qn">' + (S.cur.chips || 0) + '</i></button></div>' + body + '</div></div>';
}
// RAID in the quest detail: the normal deploy flow, aimed at the quest's area (raids always start at level 1). Disabled while the area is locked.
function questRaidBtn(chain, def, ready){
  const ok = areaUnlocked(def.area) && !guidedRaid();
  return '<button type="button" class="qraid' + (ready ? ' ghost' : ' primary') + '"' + (ok ? ' onclick="A.QUEST_RAID({chain:\'' + chain + '\'})"' : ' disabled') + ' aria-label="Raid ' + esc((AREA_DEFS[def.area] || {}).name || def.area) + '">' + IC(ok ? "nav-raid" : "lock") + (ready ? "" : "RAID") + '</button>';
}
// T1-A: hand-in / quest-complete payoff — WHAT it unlocks (reward.unlocksText, else unlock + next step title).
function unlockBits(u){
  if(!u) return [];
  const out = [];
  if(u.recipe){ const it = ITEMS[u.recipe]; out.push((it && it.name ? it.name : u.recipe) + " recipe"); }
  if(u.hard){ const a = AREA_DEFS[u.hard]; out.push((a && a.name ? a.name : u.hard) + " Hard"); }
  if(u.cosmetic){
    const shop = ((D.chipShop || {}).items || []).find(x => x.kind === "cosmetic" && x.ref === u.cosmetic);
    out.push(shop ? shop.name : u.cosmetic);
  }
  return out;
}
function questUnlocksText(chain, def){
  if(!def) return "";
  if(def.reward && def.reward.unlocksText) return def.reward.unlocksText;
  const bits = unlockBits(def.reward && def.reward.unlock);
  const steps = (QC[chain] && QC[chain].steps) || [];
  const i = steps.findIndex(s => s.id === def.id);
  const next = i >= 0 && i + 1 < steps.length ? steps[i + 1] : null;
  if(next) bits.push("next step " + next.title);
  return bits.length ? bits.join(" · ") : "next step in the chain";
}
// ---- HAND IN popup (v1.76): shown whenever a chain step's objective is met. Item tiles are consumed, reward tiles pop, BIT cheers. ----
const HANDIN_MS = 700;
// Hand-in tile for an item: its hero art (large) when it has one, else the usual icon tile.
function handInItemTile(id, txt, cls){
  const it = ITEMS[id]; if(!it.hero) return qTileImg(id, txt, cls, it.name);
  return '<span class="qt hero ' + (cls || "") + '" title="' + esc(it.name) + '">' + heroImg(it.hero, "hi-hero") + '<b>' + esc(txt) + '</b>' + (/\bfir\b/.test(cls || "") ? firMark() : '') + '</span>';
}
function handInHtml(id){
  const def = chainActive(id), o = def.objective, big = (ic, txt, cls, label) => qTile(ic, txt, "big " + (cls || ""), label);
  const req = o.type === "handin" ? Object.keys(o.items).map(k => ITEMS[k].hero ? handInItemTile(k, Math.min(handinHave(k), o.items[k]) + "/" + o.items[k], "big " + (raidFindable(k) ? "fir " : "") + "ok") : big(ITEMS[k].icon, Math.min(handinHave(k), o.items[k]) + "/" + o.items[k], (raidFindable(k) ? "fir " : "") + "ok", ITEMS[k].name + (raidFindable(k) ? " (found in raid)" : ""))).join("") :
    big((AREA_DEFS[def.area] || {}).iconId || "flag", o.level ? "L" + o.level : "", "area ok", (AREA_DEFS[def.area] || {}).name) + big(qObjIcon(o), o.n + "/" + o.n, "ok", def.title);
  return '<div class="bpop handin" data-chain="' + id + '" data-step="' + def.id + '"><div class="bpop-head"><span class="bicon" aria-hidden="true">' + IC("quest") + '</span><h1>' + esc(def.title) + '</h1>' +
    '<span class="hi-bit" aria-hidden="true">' + IC("bit-face") + '</span></div>' +
    '<div class="hi-body"><p class="hi-unlock"><b>UNLOCKAR:</b> ' + esc(questUnlocksText(id, def)) + '</p>' +
    '<div class="hi-stage"><span class="hi-cheer" aria-hidden="true">' + IC("bit-face") + '</span><div class="hi-req">' + req + '</div><i class="hi-arrow" aria-hidden="true">' + IC("arrow-right") + '</i><div class="hi-rw">' + chainRewardTiles(def.reward, true) + '</div></div></div>' +
    '<button type="button" class="primary big hi-go" onclick="A.QUEST_HANDIN({chain:\'' + id + '\'})">HAND IN</button></div>';
}
// Opens the popup for a ready step (back = "log" returns to the quest log on close). Returns the overlay or null.
function handInShow(id, back){
  if(typeof document === "undefined" || !chainReady(id)) return null;
  const ov = document.getElementById("overlay"); if(ov) ov.remove();
  session.handInShown = session.handInShown || {};
  session.handInShown[id + ":" + chainActive(id).id] = 1;
  return overlay(handInHtml(id), () => { if(back === "log") A.questLog(id, Math.min(chainState(id).step, QC[id].steps.length - 1)); else refresh(); }, "handinov");
}
// Base load / back from a raid: one popup per ready step per session (the quest log can always reopen it).
function maybeShowHandIn(){
  if(typeof document === "undefined" || !ftueOver() || document.getElementById("overlay") || session.screen !== "base") return null;
  const tq = trackedQuest(), ids = (tq ? [tq.chain] : []).concat(Object.keys(QC));
  session.handInShown = session.handInShown || {};
  const id = ids.find(c => chainReady(c) && !session.handInShown[c + ":" + chainActive(c).id]);
  return id ? handInShow(id, "base") : null;
}
function handInPlay(pop){
  pop.classList.add("consuming");
  const go = pop.querySelector(".hi-go"); if(go) go.disabled = true;
  setTimeout(() => {
    if(!pop.isConnected) return;
    pop.classList.add("paid");
    if(go){ go.disabled = false; go.textContent = "DONE"; go.setAttribute("data-close", ""); go.removeAttribute("onclick"); }
    bitDock("quest_handin");
  }, HANDIN_MS);
}
// Tracked quest replaces the upgrade goal card on the base screen (same slot / component); never during the FTUE.
function trackedGoalHtml(){
  if(!ftueOver()) return "";
  const t = trackedQuest(); if(!t) return "";
  const o = t.step.objective, phase = loopPhase(), ready = t.maintain ? maintainReady() : chainReady(t.chain);
  const click = t.maintain ? 'A.powerTap()' : 'A.questLog(\'' + t.chain + '\')';
  const ctx = phase ? '<small class="qphase" data-phase="' + phase.id + '">' + esc(phase.label) + (phase.line ? ' · ' + esc(phase.line) : '') + '</small>' : '';
  return '<button type="button" class="progress-goal qgoal' + (ready ? ' rdy' : '') + (t.maintain ? ' maintain' : '') + '" onclick="' + click + '" aria-label="Tracked quest: ' + esc(t.step.title) + '"><b>' + IC(t.maintain ? "power" : "quest") + ' ' + esc(t.step.title) + '</b>' + ctx + '<div class="qgrow">' +
    qTile(qObjIcon(o), t.prog + "/" + t.n, "") + '</div></button>';
}
// Launch param for the raid HUD chip: only when the tracked quest is in the area being raided (hand-ins have no raid objective).
function questLaunchParam(){
  const t = ftueOver() && trackedQuest(); if(!t || t.step.area !== raidArea()) return null;
  const o = t.step.objective; if(o.type === "handin") return null;
  return o.type + ":" + (o.type === "extract" ? o.item : o.type === "kill" ? o.enemy : (o.level || 1)) + ":" + t.prog + ":" + t.n + (o.type === "extract" ? ":" + (o.level || 1) : "");
}
/* ---------- v1.73 Contract Chips: BIT trader (data/quests.js DATA.chipShop) ---------- */
const CS = D.chipShop || { items:[], recycle:{}, weeklyOp:[] };
function isoWeekId(d){
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y = t.getUTCFullYear(), wk = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return y + "-W" + (wk < 10 ? "0" : "") + wk;
}
function chipShopState(){ const w = isoWeekId(new Date()); if(!S.chipShop || S.chipShop.week !== w) S.chipShop = { week:w, bought:{} }; return S.chipShop; }
function unlockBucket(kind){ S.unlocks = S.unlocks || {}; return S.unlocks[kind] || (S.unlocks[kind] = {}); }
// Stored unlocks from quest rewards and the shop: { recipe:id, cosmetic:id, hard:areaId }. Flags only; the hard flag is read by hardAvailable() (Raid Prep HARD toggle), BIT looks have no consumer yet.
function grantUnlock(u){ for(const k of ["recipe", "cosmetic", "hard"]) if(u && u[k]) unlockBucket(k)[u[k]] = true; }
function chipItem(id){ return CS.items.find(x => x.id === id); }
function chipOwned(it){ return it.kind !== "item" && !!unlockBucket(it.kind)[it.ref]; }
function chipWeekLeft(it){ return it.weeklyCap ? Math.max(0, it.weeklyCap - (chipShopState().bought[it.id] || 0)) : Infinity; }
// Returns { ok, reason } with reason one of unknown | owned | cap | chips.
function chipCanBuy(id){
  const it = chipItem(id); if(!it) return { ok:false, reason:"unknown" };
  if(chipOwned(it)) return { ok:false, reason:"owned" };
  if(chipWeekLeft(it) < 1) return { ok:false, reason:"cap" };
  if((S.cur.chips || 0) < it.price) return { ok:false, reason:"chips" };
  return { ok:true };
}
function chipBuy(id){
  const c = chipCanBuy(id); if(!c.ok) return c;
  const it = chipItem(id);
  S.cur.chips -= it.price;
  if(it.kind === "item"){ addItem(it.ref, it.qty || 1); chipShopState().bought[it.id] = (chipShopState().bought[it.id] || 0) + 1; }
  else unlockBucket(it.kind)[it.ref] = true;
  act("CHIPS_BUY", { id, price:it.price });
  return c;
}
// kind: "drive" (Encrypted Drive) or "relic" (Prewar Relic, alternative to its Scrap sale). Reserved stacks are not sold.
function chipExchange(kind){
  const r = CS.recycle[kind]; if(!r) return { ok:false, reason:"unknown" };
  if(have(r.item) < 1 || S.reserved[r.item]) return { ok:false, reason:"none" };
  removeItem(r.item, 1); S.cur.chips = (S.cur.chips || 0) + r.chips;
  act(kind === "drive" ? "CHIPS_RECYCLE_DRIVE" : "CHIPS_SELL_RELIC", { chips:r.chips });
  return { ok:true, chips:r.chips };
}
// Weekly operation reward hook (the weekly op does not exist yet; nothing calls this). pct = 0-100 where 1 = top 1 %.
function grantWeeklyChips(pct){
  const row = CS.weeklyOp.find(r => pct <= r.topPct), n = row ? row.chips : 0;
  if(n){ S.cur.chips = (S.cur.chips || 0) + n; act("CHIPS_WEEKLY_OP", { pct, chips:n }); }
  return n;
}
const CHIP_WHY = { owned:"Already owned", cap:"Weekly limit reached", chips:"Not enough Contract Chips", none:"None to trade", unknown:"Unavailable" };
function chipName(it){ return it.kind === "item" ? ITEMS[it.ref].name : it.name; }
// Hero art (data hook `hero`): large picture for the preview / hand-in reveal only. Items inherit it from data/items.js.
function chipHero(it){ return it.hero || (it.kind === "item" ? ITEMS[it.ref].hero : "") || ""; }
function heroImg(src, cls){ return '<img class="' + cls + '" src="' + esc(src) + '" alt="" decoding="async" draggable="false">'; }
function chipTileHtml(it){
  const c = chipCanBuy(it.id), owned = c.reason === "owned", ic = it.kind === "item" ? ITEMS[it.ref].icon : it.icon, sel = chipSelId() === it.id;
  return '<button type="button" class="cs-tile' + (owned ? ' owned' : c.ok ? '' : ' off') + (sel ? ' sel' : '') + '" data-chip="' + it.id + '" aria-pressed="' + sel + '" onclick="A.chipSelect(\'' + it.id + '\')" aria-label="' + esc(chipName(it) + ", " + it.price + " Contract Chips" + (c.ok ? "" : ". " + CHIP_WHY[c.reason])) + '">' +
    '<span class="cs-ic">' + IC(ic) + (it.kind === "item" && it.qty > 1 ? '<em>' + it.qty + '</em>' : '') + '</span><span class="cs-nm">' + esc(it.short) + '</span>' +
    (owned ? '<span class="qt">' + IC("check") + '</span>' : c.reason === "cap" ? '<span class="qt">' + IC("timer") + '</span>' : qTile("cur-chip", it.price, "")) + '</button>';
}
function chipSelId(){ return session.chipSel && chipItem(session.chipSel) ? session.chipSel : (CS.items[0] || {}).id; }
// Selected-item preview (side pane): hero art when the item has it, else its icon, plus name, price and BUY.
function chipPreviewHtml(it){
  const c = chipCanBuy(it.id), hero = chipHero(it), ic = it.kind === "item" ? ITEMS[it.ref].icon : it.icon;
  const btn = c.ok ? '<button type="button" class="primary cs-buy" data-buy="' + it.id + '" onclick="A.chipBuy(\'' + it.id + '\')">BUY' + qTile("cur-chip", it.price, "") + '</button>'
    : '<button type="button" class="primary cs-buy" disabled data-buy="' + it.id + '">' + esc(CHIP_WHY[c.reason]) + '</button>';
  return '<div class="cs-prev" data-prev="' + it.id + '"><div class="cs-art">' + (hero ? heroImg(hero, "cs-hero") : IC(ic)) + '</div><h2>' + esc(chipName(it)) + '</h2>' + btn + '</div>';
}
function chipExchangeHtml(kind){
  const r = CS.recycle[kind], n = have(r.item), ok = n > 0 && !S.reserved[r.item];
  return '<button type="button" class="cs-tile ex' + (ok ? '' : ' off') + '" data-ex="' + kind + '" onclick="A.chipExchange(\'' + kind + '\')" aria-label="' + esc("Trade 1 " + ITEMS[r.item].name + " for " + r.chips + " Contract Chips" + (ok ? "" : ". " + CHIP_WHY.none)) + '">' +
    '<span class="cs-ic">' + IC(ITEMS[r.item].icon) + '<em>' + n + '</em></span><span class="qt">' + IC("arrow-right") + '</span>' + qTile("cur-chip", "+" + r.chips, "") + '</button>';
}
function chipShopHtml(){
  return '<div class="bpop cshop"><div class="bpop-head">' + bitImg("bit-quartermaster", "bit-quartermaster") + '<span class="bicon" aria-hidden="true">' + IC("nav-bit") + '</span><h1>BIT Trader</h1><em class="qchips">' + IC("cur-chip") + (S.cur.chips || 0) + '</em></div>' +
    '<div class="cs-body"><div class="cs-list"><div class="cs-grid">' + CS.items.map(chipTileHtml).join("") + '</div>' +
    '<div class="cs-grid cs-ex">' + Object.keys(CS.recycle).map(chipExchangeHtml).join("") + '</div></div>' + chipPreviewHtml(chipItem(chipSelId())) + '</div></div>';
}
function chipShopOpen(){
  const ov = document.getElementById("overlay"); if(ov) ov.remove();
  overlay(chipShopHtml(), () => refresh(), "chipshopov");
}
function questEntryHtml(){
  const t = trackedQuest(); if(!t && !questsOpen()) return "";
  return '<button type="button" class="card questentry" onclick="A.questLog()">' + IC("quest") + '<b>QUESTS</b>' + (dailyReadyCount() ? '<i class="qn">' + dailyReadyCount() + '</i>' : '') + (t ? '<span>' + qTile(qObjIcon(t.step.objective), t.prog + "/" + t.n, chainReady(t.chain) ? "ok" : "") + '</span>' : '') + IC("chevron-right") + '</button>';
}
function traderEntryHtml(){
  if(!bitOnline() || !ftueOver()) return "";
  return '<button type="button" class="card questentry traderentry" onclick="A.chipShop()">' + IC("nav-bit") + '<b>TRADER</b>' + qTile("cur-chip", S.cur.chips || 0, "") + IC("chevron-right") + '</button>';
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
      const lead = scoutLead(), keenSensors = lead && lead.lead.zone.id === zone.id ? talentVal("scoutKeenSensors") : 0; // Scout: Keen Sensors (v1.95)
      id = Math.random() < Math.min((e.weight*3)/totalW + keenSensors, 0.97) ? cfg.trackedItemId : rollFromTable(table);
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
  const guaranteed={};for(const id of beat.guaranteedDrops||[])guaranteed[id]=(guaranteed[id]||0)+1;
  for(const id in guaranteed)while(loot.filter(item=>item===id).length<guaranteed[id])loot.push(id);
  const trackedFound = !!cfg.trackedItemId && loot.includes(cfg.trackedItemId);

  const scrap = randInt(zone.scrapRange[0], zone.scrapRange[1]);
  const dataCores = randInt(zone.dataCoresOnExtract[0], zone.dataCoresOnExtract[1]);
  const valuableFound = loot.some(id => ITEMS[id].rarity === "epic" || ITEMS[id].rarity === "legendary");
  const R = { cfg, zone: zone.id, outcome, loot, scrap, dataCores, trackedFound, forced };
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
      scrap: Math.round(R.scrap / n), dataCores: Math.round(R.dataCores / n) });
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
  S.zoneIntel[R.zone] = (S.zoneIntel[R.zone]||0) + 1;
  progress.push("Zone intel: " + ZONES[R.zone].name + " +1");
  const bondBefore = bondLevel();

  if(R.outcome === "extract"){
    R.loot.forEach(id => addItem(id,1,true));
    R.cfg.loadout.forEach(id => addItem(id,1)); // gear comes home
    S.cur.scrap += R.scrap;
    S.cur.dataCores += R.dataCores;
    progress.push("+" + R.scrap + " Scrap, +" + R.dataCores + " Data Cores");
    gainOpXp(PROG.operator.simExtractXp);
    if(bitOnline()){ S.bondXp += D.bit.xpPerExtract; progress.push("BIT Bond +" + D.bit.xpPerExtract + " XP"); }
    act("EXTRACT_COMPLETE", { zone:R.zone, loot:R.loot, scrap:R.scrap, dataCores:R.dataCores, tracked:R.trackedFound });
  } else {
    S.deaths++;
    // survivors
    R.saved = { insured:[], secure:null, bitRescue:null };
    const ins = PROG.insurance.tiers.find(t => t.id === R.cfg.insuranceId) || PROG.insurance.tiers[0];
    const sorted = R.cfg.loadout.filter(id => !isFree(id)).sort((a,b)=>(ITEMS[b].sellValue)-(ITEMS[a].sellValue));
    for(let i=0;i<ins.recovers && i<sorted.length;i++){ R.saved.insured.push(sorted[i]); addItem(sorted[i],1); }
    if(S.secureItem && R.cfg.loadout.includes(S.secureItem) && !R.saved.insured.includes(S.secureItem)){
      R.saved.secure = S.secureItem; addItem(S.secureItem,1);
    }
    if(bondLevel() >= 3 && R.loot.length){ R.saved.bitRescue = R.loot[0]; addItem(R.loot[0],1); }
    // Guardian capstone (fallback per docs/design-bit-skill-tree.md): saves ONE pre-chosen material, if found this raid.
    if(talentLearned("guardian_safe_return") && S.guardianMaterial && R.loot.includes(S.guardianMaterial) && R.saved.bitRescue !== S.guardianMaterial){
      R.saved.talentMaterial = S.guardianMaterial; addItem(S.guardianMaterial,1);
    }
    const halfSalvage = Math.floor(R.scrap/2);
    S.cur.scrap += halfSalvage;
    progress.push("+" + halfSalvage + " Salvage (recovered)");
    gainOpXp(PROG.operator.simDeathXp);
    if(bitOnline()){ S.bondXp += D.bit.xpPerDeath; progress.push("BIT Bond +" + D.bit.xpPerDeath + " XP"); }
    R.cfg.loadout.filter(id => !R.saved.insured.includes(id) && id !== R.saved.secure).forEach(loseBuilt);
    act("PLAYER_DIED", { zone:R.zone, lost:R.cfg.loadout, insured:R.saved.insured, secure:R.saved.secure });
  }
  // tracked bookkeeping
  if(R.cfg.trackedItemId){
    S.trackedStreak = R.trackedFound && R.outcome==="extract" ? 0 : S.trackedStreak + 1;
  }
  const miss = trackedMissingItem();
  if(S.tracked && miss) progress.push("Tracked: " + MODS[S.tracked.module].name + " L" + S.tracked.level + " — need " + (miss.need - miss.have) + "× " + ITEMS[miss.itemId].name);
  else if(S.tracked) progress.push("Tracked upgrade: ALL PARTS FOUND — go build it");
  if(bondLevel() > bondBefore){ R.bondUp = bondLevel(); progress.push("BIT BOND LEVEL UP: L" + bondLevel()); }
  const pd = drainPowerRaid(); if(pd) progress.push("Bunker power -" + pd);
  R.progress = progress;
  // beat advance on extraction during raid beats
  const b = curBeat();
  if(b.type === "raid" && R.outcome === "extract") advanceBeat();
  save();
}

/* ---------- UI helpers ---------- */
const $app = () => document.getElementById("app");
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
// Toasts are a queue: one at a time, never while a popup is open (deferred until it closes).
const toastQ = []; let toastShowing = false;
function toast(msg, html){ toastQ.push({ msg, html }); toastPump(); }
function toastPump(){
  if(typeof document === "undefined" || toastShowing || !toastQ.length) return;
  // Fullscreen screens such as BIT can keep an overlay open indefinitely. Wait for
  // its removal (observed below) rather than polling while a notice is queued.
  if(document.getElementById("overlay")) return;
  const q = toastQ.shift(), t = document.createElement("div");
  t.className = "toastmsg"; if(q.html) t.innerHTML = q.html; else t.textContent = q.msg;
  document.getElementById("toast").appendChild(t);
  toastShowing = true;
  setTimeout(() => { t.remove(); toastShowing = false; toastPump(); }, q.html ? 3200 : 2400);
}
// Any screen/tab change or raid launch closes every popup, modal and menu.
function closeAllPopups(){
  if(typeof document === "undefined") return;
  document.querySelectorAll("#overlay, .bpop").forEach(el => (el.closest("#overlay") || el).remove());
  const m = document.getElementById("settings-menu"); if(m) m.hidden = true;
  session.focusSpot = null;
  updateNav();
}
// Shared popup component (ui/popup.css): every boxed popup gets the top-left close X, the shared header,
// backdrop tap-to-close and the pop-in animation. opts.noClose only for scripted FTUE/timed sequences.
const POP_X = '<button type="button" class="pop-x" data-close aria-label="Close">' + IC("close") + '</button>';
function overlay(html, onClose, cls, opts){
  opts = opts || {};
  const o = document.createElement("div");
  o.id = "overlay"; if(cls) o.className = cls; o._onClose = onClose;
  o.innerHTML = '<div class="inner payoff">' + html + '</div>';
  if(!opts.noClose){
    // v1.47: the close badge straddles the card's top-left corner, so it must live outside any scroller.
    const bp = o.querySelector(".bpop");
    if(bp){ o.firstChild.classList.add("pop-host"); bp.classList.add("pop-card"); bp.insertAdjacentHTML("afterbegin", POP_X); }
    else { const fr = document.createElement("div"); fr.className = "pop-frame pop-card"; o.insertBefore(fr, o.firstChild); fr.appendChild(fr.nextSibling); fr.insertAdjacentHTML("afterbegin", POP_X); }
  }
  else o.dataset.noclose = "1";
  o.addEventListener("click", e => {
    const t = e.target.closest ? e.target.closest("[data-close]") : null;
    if(t || e.target.id === "ovclose" || (!opts.noClose && (e.target === o || (e.target.classList && e.target.classList.contains("pop-host"))))){ o.remove(); if(onClose) onClose(); }
  });
  document.getElementById("phone").appendChild(o);
  updateNav();
  return o;
}
// Shared BACK (top-left in the top bar): closes the open popup, else goes up one screen.
const BACK_TARGET = { itemDetail:"stash", module:"base", worldmap:"prep" };
function updateNav(){
  if(typeof document === "undefined") return;
  const b = document.getElementById("navback"), tb = document.getElementById("topbar"), ov = !!document.getElementById("overlay");
  document.body.classList.toggle("has-overlay", ov);
  if(tb) document.documentElement.style.setProperty("--tb-h", (tb.offsetHeight || 0) + "px");
  const nv = document.getElementById("tabs"); if(nv) document.documentElement.style.setProperty("--nav-h", (nv.offsetHeight || 0) + "px");
  if(b) b.hidden = !(ov || (session.screen && session.screen !== "base" && session.screen !== "intro"));
}
if(typeof MutationObserver !== "undefined" && typeof document !== "undefined")
  document.addEventListener("DOMContentLoaded", () => { const ph = document.getElementById("phone"); if(ph) new MutationObserver(() => { updateNav(); toastPump(); }).observe(ph, { childList:true }); if(typeof ResizeObserver !== "undefined") for(const id of ["topbar", "tabs"]){ const el = document.getElementById(id); if(el) new ResizeObserver(updateNav).observe(el); } });
function closeBuildingPopup(){ if(typeof document === "undefined") return; const o = document.getElementById("overlay"); if(o && o.querySelector(".bpop")) o.remove(); session.focusSpot = null; }
function bootSequence(next, done){
  const lines = ["> emergency power detected",
                 "> rerouting grid . . .",
                 "> core temperature nominal",
                 "> lighting: sector A . . . ok",
                 "> CORE ONLINE"];
  const o = overlay('<div class="boot" id="bootseq"></div>', done, null, { noClose:true });
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
    el.innerHTML += '<div class="bootflash">' + IC("power") + ' POWER RESTORED</div>' + dust +
      '<p style="margin:12px 0;font-size:13px;color:var(--txt)">' + esc(next.unlockText) + '</p>' +
      '<p class="small" style="margin-bottom:8px">BIT: lights. i missed lights.</p>' +
      '<div class="card" style="text-align:left"><span class="ok">NEW BENEFIT</span><br>' + esc(next.benefitText || "") + '</div>' +
      '<div class="card" style="text-align:left"><span class="trackc">NEW GOAL</span><br>' + esc(next.newGoal) + '</div>' +
      '<button class="primary" data-close>ENTER THE FACILITY</button>';
  }, 500 + lines.length*750 + 300);
  return o;
}

// v1.66 reward screen: one shared popup for every room/upgrade completion. Tiles come from DATA.upgradeRewardTiles
// (data/modules.js), i.e. from what the level really grants. The BIT-offline line sits outside the card.
// v1.66.1 "no redundant text": the tiles carry what the level grants, so the description paragraph is gone (it stays
// in the aria-label). NEXT is kept only when it names somewhere/something to go for, cut to its first clause.
function rewardNextLine(def){
  const g = String((def && def.newGoal) || "").split(/ — |\. /)[0].replace(/\.$/, "").trim(); if(!g) return "";
  const names = D.modules.map(m => m.name).concat(WMAP_NAMES(), D.items.map(i => i.name)).flatMap(n => String(n).toLowerCase().split(/ \/ /)); // "Storage / Vault" matches both aliases
  return names.some(n => n.length > 2 && g.toLowerCase().includes(n)) ? g : "";
}
function WMAP_NAMES(){ return ((D.worldMap && D.worldMap.areas) || []).map(a => a.name).concat((D.raidZones || []).map(z => z.name)); }
function upgradeRewardHtml(modId, level, bitJustOnline){
  const m = MODS[modId], def = m.levels.find(l => l.level === level), first = level === m.levels[0].level;
  const list = D.upgradeRewardTiles(modId, level), tiles = list.map(t => '<div class="rtile ' + t.kind + '" data-source="' + esc(t.source) + '">' + IC(t.icon) + '<b>' + esc(t.value) + '</b><small>' + esc(t.label) + '</small></div>').join('');
  const bitOff = !bitJustOnline && !bitOnline(), nextLine = rewardNextLine(def);
  return '<div class="bpop reward-card"><span class="sr-only">' + esc(def.unlockText || def.benefitText || "") + '</span><h1 class="reward-title"><span>' + (first ? 'ROOM ONLINE' : 'UPGRADE') + ' · </span>' + esc(m.name).toUpperCase() + ' L' + level + '</h1>' +
    '<div class="rtiles" data-count="' + list.length + '">' + tiles + '</div>' +
    (nextLine ? '<p class="reward-goal"><b>NEXT</b> ' + esc(nextLine) + '</p>' : '') +
    '<button type="button" class="primary big" data-close>CONTINUE</button></div>' +
    (bitOff ? '<p class="reward-bit">' + bitImg("bit-offline", "bit-offline") + ' BIT is still offline. Build BIT Bay to wake it.</p>' : '');
}
function fakeAd(label, onDone){
  let sec = 3;
  const o = overlay('<h1>ADVERTISEMENT</h1><p class="sub">' + esc(label) + '</p><div style="font-size:44px;margin:26px 0" id="adcount">3</div><p class="small">(fake ad — prototype)</p>', null, null, { noClose:true });
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
const CUR_ICON_IDS = { scrap:"cur-scrap", dataCores:"cur-datacore", signals:"cur-signals", fuel:"cur-fuel", chips:"cur-chip" };
const CUR_LABELS = { scrap:"Scrap", dataCores:"Cores", signals:"Signals" };   // revealable pills; Contract Chips get a pill once owned (renderCurrencies)
function revealCurrency(id){
  if(!CUR_LABELS[id]) return;   // chips have no currency-bar pill
  if(!S.revealed) S.revealed = { scrap:true };   // safety for injected test states
  if(S.revealed[id]) return;
  S.revealed[id] = true;
  act("CURRENCY_REVEALED", { id });
  if(typeof document !== "undefined" && document.getElementById("toast")){
    toast("New resource: " + CUR_LABELS[id] + " · tap it in the top bar to learn more");
    renderCurrencies();
  }
}
const CUR_ICONS = { scrap:IC("cur-scrap"), dataCores:IC("cur-datacore"), salvage:IC("cur-scrap"), signals:IC("cur-signals"), fuel:IC("cur-fuel"), chips:IC("cur-chip") };
const ROOM_ICONS = { rebirth_core:IC("room-core"), fabricator:IC("room-fabricator"), storage:IC("room-storage"), bit_bay:IC("room-bitbay"), living_quarters:IC("room-quarters") };
// v1.51: every item names its own bespoke icon in data/items.js (icon:"item-..."); no generic fallback.
function itemIcon(id){ const it = ITEMS[id]; if(it && it.artImg) return '<img class="pr-icon ic-art" src="assets/weapons/' + it.artImg + '-512.webp" alt="" draggable="false" onerror="this.onerror=null;this.src=this.src.replace(/webp$/,\'png\')">'; if(it && it.art && typeof weaponArtSrc === "function"){ const a = weaponArtImg(id, 512, "pr-icon ic-art"); if(a) return a; } return it && it.icon ? IC(it.icon) : ""; }
// v1.99: item art (docs/art-oct25-item-manifest.json) — real renders for base materials, salvage, tools and valuables,
// delivered as assets/items/<id>-512.{webp,png}. Weapons/attachments keep their own art via itemIcon above; this hook
// defers to it so artImg stays weapon-only. No id allowlist here (economy ids stay out of app.js, see test/logic.test.js):
// every non-weapon item is tried against its own art path, and onerror falls back to the sprite icon when none was
// delivered for that id, or the PNG/WebP fails to load.
function itemImg(id, cls){
  const it = ITEMS[id];
  if(!it) return "";
  if(it.artImg || it.art) return itemIcon(id);
  const sprite = it.icon ? IC(it.icon) : "";
  const base = "assets/items/" + id + "-512";
  return '<picture class="pr-itemimg' + (cls ? ' ' + cls : '') + '"><source srcset="' + base + '.webp" type="image/webp">' +
    '<img class="pr-item-art" src="' + base + '.png" alt="" draggable="false" onerror="this.closest(\'.pr-itemimg\').classList.add(\'art-err\')"></picture>' +
    '<i class="pr-itemimg-fb" aria-hidden="true">' + sprite + '</i>';
}
// v1.99: BIT mood portraits (docs/art-oct25-handoff.md) — square transparent cutouts at assets/bit/<name>.{webp,png}
// for a handful of existing BIT touchpoints. onerror falls back to the sprite BIT face, same pattern as itemImg above.
function bitImg(name, cls){
  const base = "assets/bit/" + name;
  return '<picture class="pr-bitimg' + (cls ? ' ' + cls : '') + '"><source srcset="' + base + '.webp" type="image/webp">' +
    '<img class="pr-bit-art" src="' + base + '.png" alt="" draggable="false" onerror="this.closest(\'.pr-bitimg\').classList.add(\'art-err\')"></picture>' +
    '<i class="pr-bitimg-fb" aria-hidden="true">' + IC("bit-face") + '</i>';
}
function partName(p){ return p.kind === "item" ? ITEMS[p.id].name : (p.id === "dataCores" ? "Data Cores" : "Scrap"); }
function partIcon(p){ return p.kind === "item" ? itemIcon(p.id) : CUR_ICONS[p.id]; }
// v1.88 contextual top bar (docs/design-armory.md d): Level, Scrap and Power everywhere; other currencies only on the screen that
// spends them, or for a few seconds after they change. Every pill is tappable and explains itself (A.curInfo).
const CUR_CONTEXT = { dataCores:["base","module","vendor","craft"], signals:["prep"], chips:["bit"] };
const CUR_INFO = {
  scrap:{ name:"Scrap", what:"Main currency: builds, upgrades, crafting and trader buys.", where:"Extract from raids and sell spare loot.", go:"vendor" },
  dataCores:{ name:"Data Cores", what:"Rare build currency for higher module levels.", where:"Data Core loot on deeper levels (L2/L3) and BIT hauls.", go:"base" },
  signals:{ name:"Signals", what:"Pays for raid insurance in Raid Prep.", where:"Rewards and optional ads.", go:"prep" },
  chips:{ name:"Contract Chips", what:"Trade at BIT's chip shop for materials and unlocks.", where:"Finish quest steps.", go:"bit" },
  fuel:{ name:"Fuel", what:"One fuel per deploy.", where:"Refills over time.", go:"prep" }
};
// v1.90: a changed currency only pops in on screens where it is earned or matters (not e.g. Data Cores on the Stash).
const CUR_FLASH = { dataCores:["bit","quests"], signals:["bit","base","quests"], chips:["base","quests","prep"] };
const curSeen = {}, curFlash = {};
function curVisible(id, val){
  if(curSeen[id] !== undefined && curSeen[id] !== val){ curFlash[id] = Date.now() + 3000; setTimeout(() => { if(typeof renderCurrencies === "function") renderCurrencies(); }, 3100); }
  curSeen[id] = val;
  return !CUR_CONTEXT[id] || CUR_CONTEXT[id].includes(session.screen) || ((curFlash[id] || 0) > Date.now() && (CUR_FLASH[id] || []).includes(session.screen));
}
function curInfoHtml(id){
  const I = CUR_INFO[id]; if(!I) return "";
  const val = id === "fuel" ? S.fuel : (S.cur[id] || 0);
  return '<div class="bpop curinfo" data-cur="' + id + '"><div class="bpop-head"><span class="bicon" aria-hidden="true">' + CUR_ICONS[id] + '</span><h1>' + esc(I.name) + '</h1><em>' + val + '</em></div>' +
    '<p class="ci-what">' + esc(I.what) + '</p><p class="small ci-where">' + IC("pickup") + ' ' + esc(I.where) + '</p>' +
    (I.go && session.screen !== I.go && navAllowed(I.go) ? '<button class="ghost" onclick="closeBuildingPopup();A.go(\'' + I.go + '\')">GO</button>' : '') + '</div>';
}
function renderCurrencies(){
  const c = S.cur;
  for(const k of ["scrap","dataCores","signals","chips"]) curVisible(k, c[k] || 0); // track changes even while hidden / at 0
  const pill = (id, label, val) => curVisible(id, val) ? '<button type="button" class="cur cur-' + id + '" title="' + label + '" aria-label="' + label + ' ' + val + ', tap to explain" onclick="A.curInfo(\'' + id + '\')"><i aria-hidden="true">' + CUR_ICONS[id] + '</i><span class="lbl">' + label + ' </span><b>' + val + '</b></button>' : '';
  const op = operatorLevel();
  let h = '<button class="cur oplvl" onclick="A.go(\'operator\')" title="Operator level — tap for skills" aria-label="Operator level ' + op.level + (op.need ? ', ' + op.into + ' of ' + op.need + ' XP' : '') + '"><i>' + op.level + '</i><span class="opbar"><span class="oplbl">LV ' + op.level + '</span><span class="optrack"><span style="width:' + (op.need ? Math.round(op.into / op.need * 100) : 100) + '%"></span></span><span class="opxp">' + (op.need ? op.into + '/' + op.need + ' XP' : 'MAX') + '</span></span></button>';
  h += retMode() === "full" ? pill("fuel", "Fuel", S.fuel + '/' + D.retention.fuel.max) : '';
  h += Object.keys(CUR_LABELS).filter(id => S.revealed[id]).map(id => pill(id, CUR_LABELS[id], c[id])).join("");
  h += (c.chips || 0) > 0 ? pill("chips", "Chips", c.chips) : '';
  h += powerMeterHtml();
  // v1.88: BIT Bond moved off the top bar into a level badge on the BIT nav button (renderTabs).
  document.getElementById("currencies").innerHTML = h;
}
function navAllowed(id){ return id === "bit" ? bitOnline() : id === "arms" ? baseAllows("navigation", "stash") : baseAllows("navigation", id); }
// v1.94: WEAPONS nav opens the upgrade bench for the weapon you last equipped (free carbine otherwise).
function armsWeapon(){ const w = S.loadout && S.loadout.weapon; return w && ITEMS[w] && (isFree(w) || have(w) > 0) ? w : PROG.freeWeapon; }
function ownedWeapons(){ return Object.keys(ITEMS).filter(id => gearKind(id) === "weapon" && (isFree(id) || have(id) > 0)); }
function navBadge(id){
  // Owner 14 Oct: the base tab counts what can be built right now.
  // v1.94: badges are words, only for something you can act on now, and carry a tap-explain title.
  if(id === "base"){ const n = buildableCount(); if(n) return ["up build", n + " BUILD", n + " room" + (n === 1 ? "" : "s") + " can be built or upgraded now"]; }
  if(id === "prep" && wmNewUnlockTarget()) return ["alert","NEW", "A new raid area is open"];
  if(id === "stash" && (stashOverflowing() || armoryOverflowing())) return ["alert","FULL", "Stash is over capacity: sell, recycle or upgrade extras"];
  if(id === "bit" && bitOnline() && scavPending()) return ["up","HAUL", "BIT is back with a haul: confirm it"];
  if(id === "bit" && bitOnline() && talentPointsAvailable() > 0){
    const n = talentPointsAvailable();
    return ["up", n + " POINTS", n + " BIT talent point" + (n === 1 ? "" : "s") + " available to spend"];
  }
  if(id === "bit" && (contractsUnlocked() || dailyReadyCount())){
    const n = Object.values(S.contracts || {}).filter(v => v === "done").length + dailyReadyCount();
    if(n) return ["up", n + " READY", n + " quest reward" + (n === 1 ? "" : "s") + " ready to claim"];
  }
  return null;
}
function renderTabs(){
  const items = [["base",IC("nav-base"),"BASE"],["stash",IC("nav-stash"),"STASH"],["vendor",IC("nav-shop"),"SHOP"],["bit",IC("nav-bit"),"BIT"],["arms",IC("item-carbine"),"WEAPONS"],["prep",IC("nav-raid"),"RAID"]];
  document.getElementById("tabs").innerHTML = items.map(([id, icon, label]) => {
    const active = session.screen === id, gap = id === "prep" ? '<span class="nav-gap" aria-hidden="true"></span>' : "";
    const pulse = id === "prep" && !active && navAllowed(id) && trackedQuest() ? " quest-pulse" : "";
    const bond = ''; // v1.94: Bond level lives on the BIT screen, not as an unexplained number on the nav
    if(active) return gap + '<button type="button" class="nav-' + id + ' active" aria-current="page" aria-label="' + label + '"><span class="ni" aria-hidden="true">' + icon + '</span>' + label + bond + '</button>';
    const ok = navAllowed(id), b = ok && navBadge(id);
    return gap + '<button type="button" class="nav-' + id + (active ? ' active' : '') + (ok ? '' : ' locked') + pulse + '" ' +
      (ok ? 'onclick="A.go(\'' + id + '\')"' : 'disabled aria-disabled="true"') + ' aria-label="' + label + (ok ? '' : ' (locked)') + '">' +
      '<span class="ni" aria-hidden="true">' + (ok ? icon : IC('lock')) + '</span>' + label +
      (b ? '<span class="badge word ' + b[0] + '" title="' + b[2] + '" onclick="event.stopPropagation();toast(\'' + b[2] + '\')">' + b[1] + '</span>' : '') + bond + '</button>';
  }).join("");
  if(typeof updateNav === "function") updateNav();
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
  { const I = idleState(), now = idleNow();
    if(I.lastSeen && now - I.lastSeen >= IDLE.welcomeMinAwayMin * MIN) welcomeBack();     // came back: summary strip
    else { const rows = tickIdle(); tickPower(); I.away = null; for(const r of rows) toast(r.txt); }   // in-session: plain toasts + mild power drain
    I.lastSeen = now; }
  checkBeatAutoAdvance();
  {const goal=progressionGoal();if(goal&&!ftueOver()&&(!S.tracked||S.tracked.module!==goal.module||S.tracked.level!==goal.level)){S.tracked={module:goal.module,level:goal.level};save();}}
  $app().setAttribute("class", "s-" + session.screen);
  document.body.dataset.screen = session.screen;
  updateNav();
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
    '<header class="combat-head"><button class="combat-back" onclick="A.endCombatDemo()">' + IC("nav-back") + ' BASE</button>' +
      '<div><b>LIVE FIRE TEST</b><small>INDUSTRIAL ZONE · STAGE 2</small></div><div class="compass">N<br>0°</div></header>' +
    '<div class="combat-hud"><div class="combat-map"><span class="map-player">' + IC("player") + '</span><span class="map-hostiles">' + IC("dot") + IC("dot") + IC("dot") + '</span></div>' +
      '<div class="combat-vitals"><div class="vital-label">VITALITY <b id="combat-hp">100 / 100</b></div><div class="vital-track"><i id="combat-hpbar"></i></div>' +
      '<div class="ammo-label"><span>CARBINE</span><b id="combat-ammo">18 / 18</b></div></div>' +
      '<div class="combat-objective"><small>OBJECTIVE</small><b id="combat-objective">Clear hostiles</b>' +
      '<button id="combat-extract" onclick="A.finishCombatDemo(true)" style="display:none">EXTRACT</button></div></div>' +
    '<div class="combat-arena" id="combat-arena" role="application" aria-label="Top-down combat training arena">' +
      '<div class="arena-vignette"></div><div class="arena-markers"></div>' +
      '<div class="combat-cover cover-one"></div><div class="combat-cover cover-two"></div>' +
      '<div id="combat-pickups"></div><div id="combat-hostiles"></div>' +
      '<div class="combat-bit" id="combat-bit"><span>' + IC("bit-face") + '</span><small>BIT</small></div>' +
      '<div class="combat-player" id="combat-player"><span>' + IC("sparkle") + '</span></div><div id="combat-effects"></div>' +
      '<div class="combat-feedback" id="combat-feedback">MOVE · FIRE · RECOVER</div></div>' +
    '<div class="combat-controls"><div class="combat-pad" aria-label="Movement controls">' +
      '<button data-dir="up" aria-label="Move up">' + IC("chevron-up") + '</button><button data-dir="left" aria-label="Move left">' + IC("chevron-left") + '</button>' +
      '<button data-dir="down" aria-label="Move down">' + IC("chevron-down") + '</button><button data-dir="right" aria-label="Move right">' + IC("chevron-right") + '</button></div>' +
      '<div class="combat-actions"><button class="combat-pulse" onclick="A.combatPulse()"><span>BIT</span><b>SCAN PULSE</b></button>' +
      '<button class="combat-fire" id="combat-fire"><b>FIRE</b><small id="combat-fire-label">HOLD TO SHOOT</small></button>' +
      '<button class="combat-reload" onclick="A.combatReload()">' + IC("restart") + ' RELOAD</button></div></div>' +
    '<div class="combat-foot"><span>WASD / ARROWS TO MOVE</span><span>SPACE TO FIRE · R TO RELOAD</span></div>' +
    '</div>';
  const gameCfg = c.player, droneCfg = c.drone;
  const field = c.field;
  session.combatDemo = {
    x:field.spawnX, y:field.spawnY, hp:gameCfg.maxHealth, ammo:gameCfg.magazine,
    kills:0, scrap:0, medGel:0, lastHit:0, lastShot:0, pulseReadyAt:0,
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
    b.onclick=()=>A.combatStep(dir);
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
    const now=Date.now(), dt=50, step=gameCfg.moveSpeed*(dt/16.7), edge=field.edgeMargin;
    let dx=(g.moving.right?1:0)-(g.moving.left?1:0), dy=(g.moving.down?1:0)-(g.moving.up?1:0);
    const norm=Math.hypot(dx,dy)||1; g.x=Math.max(edge,Math.min(field.width-edge,g.x+dx/norm*step));g.y=Math.max(edge,Math.min(field.height-edge,g.y+dy/norm*step));
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
        else {g.scrap+=c.loot.scrapPerDrone;A.combatFeedback("SCRAP +"+c.loot.scrapPerDrone,false);}
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
  // Cinematic cold open: black screen, BIT's face powers on while its lines fade in one by one.
  const lines = String(b.introText).split(/\n+|(?<=\.)\s+(?=[A-Z])/).map(l => l.trim()).filter(Boolean);
  const step = 1.6, t0 = 1.4, btnAt = t0 + lines.length * step + 0.4;
  $app().innerHTML =
    '<div class="intro" onclick="A.introSkip(event)">' +
    '<h1 class="sr-only">' + esc(b.introTitle) + '</h1>' +
    '<img class="intro-face" src="nodspel/icons/happy-node.svg?v=' + APP_VERSION + '" alt="BIT">' +
    '<div class="intro-lines">' + lines.map((l, i) =>
      '<p style="animation-delay:' + (t0 + i * step).toFixed(1) + 's">' + esc(l) + '</p>').join("") + '</div>' +
    '<button class="intro-go" style="animation-delay:' + btnAt.toFixed(1) + 's" onclick="A.dismissIntro()">ENTER THE FACILITY</button></div>';
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
function partName(p){ return p.kind === "item" ? ITEMS[p.id].name : (p.id === "dataCores" ? "Data Cores" : "Scrap"); }
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
    return '<div class="nextup"><div class="nu-head">' + IC("check") + ' READY TO BUILD</div>' +
      '<b>' + esc(c.m.name) + ' L' + c.next.level + '</b> <span class="small">— ' + esc(c.next.unlockText) + '</span>' +
      '<div class="nubar"><div style="width:100%"></div></div>' +
      '<button class="ghost" onclick="A.goBuild(\'' + c.m.id + '\')">BUILD IT NOW</button></div>';
  }
  const missTxt = c.missing.map(p => (p.need-p.have) + "× " + partName(p)).join(" · ");
  return '<div class="nextup"><div class="nu-head">NEXT UPGRADE — ' + pct + '%</div>' +
    '<b>' + esc(c.m.name) + ' L' + c.next.level + '</b>' +
    '<div class="nubar"><div style="width:' + pct + '%"></div></div>' +
    '<div class="small warn">missing: ' + esc(missTxt) + '</div>' +
    '<button class="primary" onclick="A.oneMoreRaid(\'' + c.m.id + '\',' + c.next.level + ')">ONE MORE RAID ' + IC("chevron-right") + '</button></div>';
}

function mapPadding(vw, vh){
  const landscape = vw > vh, short = landscape && vh <= 480;
  const pad = { left:16, right:16, top:16, bottom: short ? 110 : 70 };
  if(session.focusSpot){ if(landscape) pad.right = Math.round(vw * 0.5); else pad.bottom = Math.round(vh * 0.55); }
  return pad;
}
// Pan so a tapped building sits clear of the popup: left third in landscape (popup on the right), top third in portrait (sheet below).
function focusMapOn(modId){
  const viewer = typeof document !== "undefined" && document.querySelector(".baseviewer");
  const BM = D.baseMap, spot = modId === "rebirth_core" ? BM.core : roomDef(modId);
  if(!viewer || !spot || !session.cameraLayout || !session.cameraLayoutFn) return null;
  const vw = viewer.clientWidth || 800, vh = viewer.clientHeight || 420, dims = session.cameraLayout;
  const landscape = vw > vh;
  session.focusSpot = modId;
  const want = landscape ? { fx:0.28, fy:0.45 } : { fx:0.5, fy:0.25 };
  session.camera.x = spot.x / 100 + (0.5 - want.fx) * vw / dims.sw;
  session.camera.y = spot.y / 100 + (0.5 - want.fy) * vh / dims.sh;
  session.cameraLayoutFn();
  return want;
}
function clearMapFocus(){ if(session.focusSpot){ session.focusSpot = null; if(session.cameraLayoutFn) session.cameraLayoutFn(); } }
function setupBaseViewer(){
  const viewer = document.querySelector(".baseviewer"), world = document.querySelector(".baseworld");
  if(!viewer || !world) return;
  const cfg = D.baseMap.world;
  if(!session.camera) session.camera = { x:cfg.initialFocus.x / 100, y:cfg.initialFocus.y / 100, zoom:1 };
  session.camera.zoom ||= 1;
  const pointers=new Map();
  let drag = null, moved = false, suppress = false;
  function layout(){
    const vw = viewer.clientWidth || 800, vh = viewer.clientHeight || 420;
    const scale = Math.max(vw / cfg.width, vh / cfg.height) * session.camera.zoom;
    const sw = cfg.width * scale, sh = cfg.height * scale;
    session.cameraLayout = { sw, sh };
    // The camera never leaves the art: no gutter below or beside the bunker at any zoom (zoom.min = 1 always covers the viewer).
    const card = document.querySelector(".s-base .progress-goal");
    const pad = {left:0,right:0,top:0,bottom:0};
    const minX = Math.min(0, vw - sw) - pad.right, minY = Math.min(0, vh - sh) - pad.bottom;
    let x = vw/2 - session.camera.x * sw, y = vh/2 - session.camera.y * sh;
    x = Math.max(minX, Math.min(pad.left, x)); y = Math.max(minY, Math.min(pad.top, y));
    session.camera.x = (vw/2 - x) / sw; session.camera.y = (vh/2 - y) / sh;
    world.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
    viewer.scrollLeft = 0; viewer.scrollTop = 0; // focus/scrollIntoView must never shift the HUD layer
    world.style.setProperty('--inv', String(1 / scale)); // plates keep real-size text and 44px targets
    clearPlatesFromCard(viewer, card, scale);
  }
  function zoomAt(zoom,x,y){
    const vw=viewer.clientWidth||800,vh=viewer.clientHeight||420,old=session.cameraLayout;
    const fx=session.camera.x+(x-vw/2)/old.sw,fy=session.camera.y+(y-vh/2)/old.sh;
    const before=session.camera.zoom;session.camera.zoom=Math.max(cfg.zoom.min,Math.min(cfg.zoom.max,zoom));
    const ratio=session.camera.zoom/before;session.camera.x=fx-(x-vw/2)/(old.sw*ratio);session.camera.y=fy-(y-vh/2)/(old.sh*ratio);layout();
  }
  viewer.addEventListener("wheel",e=>{if(e.target.closest('button'))return;e.preventDefault();const b=viewer.getBoundingClientRect();zoomAt(session.camera.zoom*Math.exp(-e.deltaY*cfg.zoom.wheel),e.clientX-b.left,e.clientY-b.top);},{passive:false});
  viewer.addEventListener("pointerdown", e => {
    if(e.target.closest('button, input, .progress-goal')&&!e.target.closest('.mapspot'))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    drag={ x:e.clientX, y:e.clientY, cx:session.camera.x, cy:session.camera.y };moved=false;
    if(pointers.size>1){moved=true;suppress=true;}
  });
  viewer.addEventListener("pointermove", e => {
    if(!pointers.has(e.pointerId))return;
    if(pointers.size===2){
      const old=[...pointers.values()],dist=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y);
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...pointers.values()],mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
      const b=viewer.getBoundingClientRect();zoomAt(session.camera.zoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/(dist||1),mid.x-b.left,mid.y-b.top);
      session.camera.x-=(mid.x-(old[0].x+old[1].x)/2)/session.cameraLayout.sw;session.camera.y-=(mid.y-(old[0].y+old[1].y)/2)/session.cameraLayout.sh;layout();moved=true;suppress=true;e.preventDefault();return;
    }
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    // Capture only an actual drag: capturing a tap redirects its click away from the hotspot.
    if(!moved && Math.hypot(dx,dy) > 7){
      moved=true; suppress=true; viewer.classList.add("dragging");
      if(viewer.setPointerCapture) viewer.setPointerCapture(e.pointerId);
    }
    if(moved){ const dims=session.cameraLayout; session.camera.x=drag.cx-dx/dims.sw; session.camera.y=drag.cy-dy/dims.sh; layout(); e.preventDefault(); }
  });
  const finish = e => { pointers.delete(e.pointerId);drag=null;viewer.classList.remove("dragging");if(!pointers.size)setTimeout(()=>{ suppress=false;moved=false; },0); };
  viewer.addEventListener("pointerup", finish); viewer.addEventListener("pointercancel", finish);
  viewer.addEventListener("click", e => {
    const spot=e.target.closest(".mapspot"); if(!spot || (e.detail !== 0 && (suppress || moved))){ e.preventDefault(); return; }
    if(spot.dataset.destination) A.openBuilding(spot.dataset.destination);
    else if(spot.dataset.gate && baseAllows("navigation","prep")) A.go("prep");
    else if(spot.dataset.room) A.openRoom(spot.dataset.room);
  });
  session.cameraLayoutFn = layout;
  if(session.cameraResize) window.removeEventListener("resize", session.cameraResize);
  session.cameraResize = layout; window.addEventListener("resize", layout); layout();
  const shownStage=session.devPlateStage === null ? bunkerStage() : session.devPlateStage;
  const next=D.baseMap.plates[shownStage+1]; if(next){ const img=new Image(); img.src=next.art; }
}

// v1.67: room plates never sit under the goal card. A plate that overlaps it is lifted just above the card, or moved
// right of it when that is out of view or would cover another plate. Uses the independent `translate` property,
// so the plate's own transform is untouched.
function clearPlatesFromCard(viewer, card, scale){
  const plates = [...viewer.querySelectorAll(".mapspot.plate")];
  plates.forEach(p => { p.style.translate = ""; });
  if(!card || !card.offsetHeight) return;
  const box = id => { const e = document.getElementById(id); return e && e.offsetHeight ? e.getBoundingClientRect() : null; };
  const n = box("tabs"), tb = box("topbar");
  const c = card.getBoundingClientRect(), v = viewer.getBoundingClientRect(), gap = 4;
  const hit = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
  const rects = plates.map(p => p.getBoundingClientRect());
  const bad = m => hit(m, c) || (n && hit(m, n)) || (tb && hit(m, tb));
  plates.forEach((p, i) => {
    const r = rects[i];
    // Blocked: under the card, or in the strip below the card top where the card column hides it, or under the floating nav / top chips.
    const blocked = hit(r, c) || (r.right > c.left && r.left < c.right && r.bottom > c.top) || (n && hit(r, n)) || (tb && hit(r, tb));
    if(!blocked) return;
    const up = c.top - gap - r.bottom, right = c.right + gap - r.left, lift = n ? Math.min(c.top, n.top) - gap - r.bottom : up, drop = tb ? tb.bottom + gap - r.top : 0;
    const moves = [[0, up], [right, 0], [right, up], [0, lift], [right, lift], [0, drop], [right, drop]];
    for(const [dx, dy] of moves){
      const m = { left:r.left + dx, right:r.right + dx, top:r.top + dy, bottom:r.bottom + dy };
      if(m.top < v.top + gap || m.right > v.right - gap || bad(m) || rects.some((o, j) => j !== i && hit(m, o))) continue;
      p.style.translate = (dx / scale) + "px " + (dy / scale) + "px"; rects[i] = m; return;
    }
  });
}
function goalPillHtml(nextRoom){
  const pill = (cls, icon, head, body, onclick) => (onclick ? '<button type="button" class="goalpill ' + cls + '" onclick="' + onclick + '">' : '<div class="goalpill ' + cls + '">') +
    '<i aria-hidden="true">' + icon + '</i><span><small>' + head + '</small><b>' + esc(body) + '</b></span>' + (onclick ? '</button>' : '</div>');
  if(curBeat().type === "end") return pill("ready", IC("flag"), "PROTOTYPE COMPLETE", "View stats", "A.go('end')");
  if(nextRoom) return pill("ready", IC("unlock"), "NEXT GOAL", "OPEN " + nextRoom.label.toUpperCase(), "A.openRoom('" + nextRoom.id + "')");
  if(coreLevel() >= 1){
    const miss = trackedMissingItem();
    if(!ftueOver() && miss && S.tracked){
      return pill("need", IC("target"), "NEXT UPGRADE · " + esc(MODS[S.tracked.module].name), (miss.need - miss.have) + "× " + ITEMS[miss.itemId].name, "A.go('prep')");
    }
    if(!ftueOver() && S.tracked && MODS[S.tracked.module]) return pill("ready", IC("build"), "ALL PARTS FOUND", "BUILD " + MODS[S.tracked.module].name.toUpperCase(), "A.openBuilding('" + S.tracked.module + "')");
    const ready = ftueOver() ? buildableCount() : 0;
    if(ready > 0) return pill("ready", IC("build"), ready + " UPGRADE" + (ready > 1 ? "S" : "") + " READY", "Tap a glowing room", null);
  }
  return pill("", IC("target"), "CURRENT GOAL", curBeat().goalText || "", null);
}
function plateHtml(cls, style, attrs, icon, label, level, badge, sub){
  if(badge && badge[1] === IC("build")) cls += " buildable";   // glow + bounce on rooms that can be built now
  return '<button type="button" class="mapspot plate ' + cls + '" style="' + style + '" ' + attrs + '>' +
    '<span class="tag"><i aria-hidden="true">' + icon + '</i><b>' + esc(label) + '</b>' + (level !== null ? '<em aria-label="level ' + level + '">LVL ' + level + '</em>' : '') + '</span>' +
    (sub ? '<small>' + sub + '</small>' : '') + (badge ? '<span class="badge ' + badge[0] + '">' + badge[1] + '</span>' : '') + '</button>';
}
function moduleBadge(modId){
  const bip = buildInProgress(modId); if(bip) return ["timer", IC("timer") + ' ' + fmtLeft(bip.doneAt - idleNow())];
  const next = nextLevelDef(modId);
  if(!next || next.level > moduleCap(modId)) return null;
  if(canAfford(next.cost)) return ["up",IC("build")];
  if(S.tracked && S.tracked.module === modId){
    const parts = costParts(next.cost);
    return ["need", parts.filter(p => p.have >= p.need).length + "/" + parts.length];
  }
  return null;
}
SCREENS.base = function(){
  if(!S.introSeen){ session.screen = "intro"; return SCREENS.intro(); }
  const restorePct = Math.min(100, Math.round(
    Object.values(S.modules).reduce((a,b)=>a+b,0) /
    D.modules.reduce((a,m)=>a+m.levels.length,0) * 100));
  const nextRoom = nextAccessRoom();
  const BM = D.baseMap;
  const goal=progressionGoal();
  const hub = baseState();
  const savedStage = bunkerStage();
  const stage = session.devPlateStage === null ? savedStage : session.devPlateStage;
  const plate = BM.plates[stage];
  const previous = session.plateStage !== null && session.plateStage !== stage ? BM.plates[session.plateStage] : null;
  let html = '<div class="baseviewer hub-' + hub.id + (session.wake ? ' wake' : '') + '" data-lighting="' + esc(hub.lighting) + '" data-audio="' + esc(hub.audioProfile) + '" aria-label="Panoramic bunker map">' +
    '<div class="baseworld" style="width:' + BM.world.width + 'px;height:' + BM.world.height + 'px">' +
    (previous ? '<img class="baseplate outgoing" src="' + previous.art + '" alt="">' : '') +
    '<img class="baseplate current' + (previous ? ' revealing' : '') + '" src="' + plate.art + '" alt="Bunker restoration stage ' + stage + '">' +
    plateHtml("core-spot" + (goal&&goal.module==="rebirth_core"?" goal-target":"") + (buildInProgress("rebirth_core") ? " constructing" : ""), 'left:' + BM.core.x + '%;top:' + BM.core.y + '%', 'data-destination="rebirth_core" aria-label="' + esc(BM.core.label) + '"', ROOM_ICONS.rebirth_core, "Core", coreLevel(), baseAllows("interactions","rebirth_core") ? moduleBadge("rebirth_core") : null, "");
  { const st = genStored(idleNow());
    if(st >= IDLE.generator.minCollect) html += '<button type="button" class="gen-chip' + (st >= genCap() ? ' full' : '') + '" style="left:' + BM.core.x + '%;top:calc(' + BM.core.y + '% + 46px)" onclick="event.stopPropagation();A.collectScrap()" aria-label="Collect ' + st + ' scrap from the recycler">' + IC("generator") + '<b>+' + st + '</b></button>'; }
  for(const room of BM.rooms){
    const unlocked = roomUnlocked(room.id), previewUnlocked = session.devPlateStage !== null && room.stage <= stage;
    const shownOpen = unlocked || previewUnlocked;
    const next=room.destination&&nextLevelDef(room.destination);
    const ready = !shownOpen && roomRequirementMet(room) && (!next||canAfford(next.cost));
    const selectedStyle = S.styles[room.id] && (D.styleOptions[room.id] || []).find(o => o.id === S.styles[room.id]);
    const lvl = room.destination ? (S.modules[room.destination] || 0) : null;
    const badge = shownOpen ? (room.destination && unlocked ? moduleBadge(room.destination) : null) : ready ? ["up",IC("check")] : null;
    const sub = shownOpen ? (selectedStyle ? '<span class="style-status">' + IC("sparkle") + ' ' + esc(selectedStyle.name) + '</span>' : '') : ready ? IC("check") + ' ' + esc(room.requirement.text) : '';
    html += plateHtml('room-spot ' + (shownOpen ? 'unlocked' : ready ? 'ready' : 'locked') + (goal&&goal.module===room.destination?' goal-target':'') + (previewUnlocked && !unlocked ? ' preview' : '') + (room.destination && buildInProgress(room.destination) ? ' constructing' : '') + (room.destination && shownOpen && !roomPowered(room.destination) ? ' powered-off' : ''),
      'left:' + room.x + '%;top:' + room.y + '%', 'data-room="' + room.id + '" aria-label="' + esc(room.label) + (shownOpen ? '' : ready ? ' (access ready)' : ' (locked)') + '"',
      shownOpen ? (ROOM_ICONS[room.id] || IC("item-crate")) : (ready ? IC("unlock") : IC("lock")), room.label, shownOpen ? lvl : null, badge, sub);
  }
  html += '<button type="button" class="mapspot plate gate" style="left:' + BM.raidGate.x + '%;top:' + BM.raidGate.y + '%" data-gate="1" aria-label="' + esc(BM.raidGate.label) + '"><span class="tag"><i aria-hidden="true">' + IC("target") + '</i><b>' + esc(BM.raidGate.label) + '</b></span></button>' +
    '</div><div class="hubstate">' + esc(hub.label) + ' · PLATE 0' + stage + ' · ' + restorePct + '%' + (session.devPlateStage !== null ? ' · PREVIEW' : '') + '</div>' + (trackedGoalHtml() || progressionGoalHtml() || goalPillHtml(nextRoom)) + welcomeHtml() + '</div>';
  session.plateStage = stage;
  session.wake = false;
  $app().innerHTML = html;
  setupBaseViewer();
};

// BIT hub: fullscreen (reuses the #overlay.wpnov/.fabov pattern, see bitScreenHtml). $app() stays empty behind it.
SCREENS.bit = function(tab){
  if(!bitOnline()){ $app().innerHTML = '<h1>' + IC("nav-bit") + ' BIT</h1><div class="card">BIT Bay is offline. Repair it first.</div>'; return; }
  $app().innerHTML = "";
  bitRender(tab);
};

SCREENS.module = function(modId){
  const m = MODS[modId];
  const lvl = S.modules[modId] || 0;
  const next = nextLevelDef(modId);
  const visible = moduleVisible(modId);
  let html = ''+
    '<h1>' + IC("info") + ' ' + esc(m.name) + '</h1><div class="sub">Level ' + lvl + ' · ' + esc(m.blurb) + '</div>';
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
        next.preview.after.map(a => '<div class="small ok">' + IC("chevron-right") + ' ' + esc(a) + '</div>').join("") + '</div>';
    } else {
      html += '<div class="card"><b>Unlocks:</b> <span class="small">' + esc(next.unlockText) + '</span></div>';
    }
    html += '<h2>Requirements</h2>';
    for(const p of costParts(next.cost)){
      const name = p.kind === "item" ? ITEMS[p.id].name : (p.id === "dataCores" ? "Data Cores" : "Scrap");
      const okc = p.have >= p.need ? "ok" : "bad";
      html += '<div class="card row"><span>' + esc(name) + '</span><span class="' + okc + '">' + Math.min(p.have,p.need) + ' / ' + p.need + '</span></div>';
    }
    if(capped){
      html += '<div class="card warn small">Locked — raise the Rebirth Core level first.</div>';
    } else {
      // PRB-45: pinned action bar so BUILD is reachable at 844×390 without scrolling
      html += '<div class="actionbar"><button class="ghost" onclick="A.track(\'' + modId + '\',' + next.level + ')">' + (isTracked ? IC("track-on") + " Tracking (tap to untrack)" : IC("track-off") + " Track this upgrade") + '</button>';
      html += '<button class="primary' + (canAfford(next.cost) ? ' build-ready' : '') + '" ' + (canAfford(next.cost) ? "" : "disabled") + ' onclick="A.build(\'' + modId + '\')">' + (canAfford(next.cost) ? IC("build") + ' BUILD' : 'BUILD') + '</button></div>';
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

// Stash usage icons (v1.77): sprite icons from D.itemInfo(id).usage, which derives from module costs, recipes, quest chains,
// vendor stock / barter and the chip shop. Nothing is stored per item.
const STASH_USES = [["quest","quest","Quest item"],["build","build","Base build / upgrade"],["shop","nav-shop","Trader"],["chip","cur-chip","Chip shop"]];
function usageIconsHtml(id){
  const info = D.itemInfo(id), u = info && info.usage; if(!u) return "";
  const on = STASH_USES.filter(x => u[x[0]]); if(!on.length) return "";
  return '<span class="uses" aria-label="Used for: ' + on.map(x => x[2]).join(", ") + '">' + on.map(x => '<i class="u-' + x[0] + '" title="' + x[2] + '">' + IC(x[1]) + '</i>').join("") + '</span>';
}
// v1.87 stash order: weapons, then gear (armor / rigs), consumables + tools, then materials; rarity high to low, then name.
const RARITY_RANK = { legendary:0, epic:1, rare:2, uncommon:3, common:4 };
function stashGroup(id){ const it = ITEMS[id]; return it.weapon ? 0 : it.slot === "armor" || /rig|vest|cloak/.test(id) ? 1 : (it.slot === "consumable" || it.slot === "attachment" || it.tool || /^tool_/.test(id) || (it.uses || []).includes("loadout")) ? 2 : 3; }
function stashOrder(a, b){ return stashGroup(a) - stashGroup(b) || (RARITY_RANK[ITEMS[a].rarity] ?? 5) - (RARITY_RANK[ITEMS[b].rarity] ?? 5) || ITEMS[a].name.localeCompare(ITEMS[b].name); }
function upMark(id){ return gearKind(id) && (!gearBlock(id) || !mergeBlock(id)) ? '<span class="upmark" title="Upgrade available" aria-label="Upgrade available">' + IC("chevron-up") + '</span>' : ''; }
function stashOverflowing(){ return stashSlotsUsed() > stashCapacity(); }
function armoryOverflowing(){ return armorySlotsUsed() > armoryCapacity(); }
function capBarHtml(used, cap){
  const pct = cap > 0 ? Math.min(100, Math.round(used / cap * 100)) : 0;
  return '<div class="cap-bar' + (used >= cap ? ' full' : '') + '" role="progressbar" aria-valuenow="' + used + '" aria-valuemin="0" aria-valuemax="' + cap + '" aria-label="Armory capacity ' + used + ' of ' + cap + '"><span style="width:' + pct + '%"></span></div>';
}
function invSlotHtml(id){
  const it = ITEMS[id], cls = ["slot","r-"+(gearKind(id) ? tierRarity(id) : it.rarity)];
  if(S.reserved[id]) cls.push("reserved");
  if(S.secureItem === id) cls.push("secure");
  return '<div class="' + cls.join(" ") + '" role="button" tabindex="0" onclick="A.openStashItem(\'' + id + '\')"><span class="sicon" aria-hidden="true">' + itemImg(id) + '</span>' + esc(it.name) +
    (firHave(id) ? firMark() : '') + upMark(id) + (gearKind(id) && gearTier(id) > 1 ? '<span class="mkbadge">MK ' + TIER_NAMES[gearTier(id) - 1] + '</span>' : '') + usageIconsHtml(id) + '<span class="qty">×' + qty(id) + '</span></div>';
}
// v1.89: one screen, two stores. ARMORY (gear: weapons, armor/rigs, consumables, tools; own capacity) on top, STASH (materials) below.
// They never compete for space, and OVERFLOW / Quick Clean only ever touch the Stash.
SCREENS.stash = function(){
  const ids = invIds().sort(stashOrder), gear = ids.filter(isArmoryItem), mats = ids.filter(id => !isArmoryItem(id));
  let html = '<h1>Stash</h1><nav class="inv-jump" aria-label="Sections"><button type="button" onclick="A.invJump(\'inv-armory\')">' + IC("item-carbine") + ' Armory <b>' + armorySlotsUsed() + '/' + armoryCapacity() + '</b></button><button type="button" onclick="A.invJump(\'inv-stash\')">' + IC("item-crate") + ' Materials <b>' + stashSlotsUsed() + '/' + stashCapacity() + '</b></button></nav>';
  html += '<section class="inv-sec armory" id="inv-armory"><div class="sub"><b>ARMORY</b> · ' + armorySlotsUsed() + ' / ' + armoryCapacity() + ' slots · gear you can equip' +
    (armoryOverflowing() ? ' <span class="ovf-note">FULL · sell, recycle or upgrade extras</span>' : '') + '</div>' + capBarHtml(armorySlotsUsed(), armoryCapacity()) + '<div class="grid">';
  for(const id of D.items.filter(i => i.free).map(i => i.id))
    html += '<div class="slot r-common free" role="button" tabindex="0" onclick="A.openStashItem(\'' + id + '\')" title="Always available — never lost"><span class="sicon" aria-hidden="true">' + itemImg(id) + '</span>' + esc(ITEMS[id].name) + upMark(id) +
      '<span class="qty" aria-label="infinite">' + IC("infinity") + '</span></div>';
  html += gear.map(invSlotHtml).join("") + '</div></section>';
  html += '<section class="inv-sec mats" id="inv-stash"><div class="sub"><b>STASH</b> · ' + stashSlotsUsed() + ' / ' + stashCapacity() + ' slots · materials' +
    (stashOverflowing() ? ' <button type="button" class="ovf-btn" onclick="A.openQuickClean()">OVERFLOW · CLEAN UP</button>' : '') + '</div>';
  html += mats.length ? '<div class="grid">' + mats.map(invSlotHtml).join("") + '</div>' : '<div class="card small">Empty. The surface has what you need.</div>';
  $app().innerHTML = html + '</section>';
};

// ---- stash sell / recycle popup (v1.77) ----
function sellGain(id, qty){ return Math.floor(ITEMS[id].sellValue * D.vendors[0].sellMultiplier) * qty; }
function recycleOf(id){ return D.recycleTo[id] && ITEMS[D.recycleTo[id].to] ? D.recycleTo[id] : null; }
// Why this item must not be sold / recycled at all ("" = allowed).
function stashBlock(id, mode){
  if(isFree(id)) return "Always available";
  if(have(id) < 1) return "None left";
  if(S.reserved[id]) return "Reserved for an upgrade";
  if(mode === "recycle" && !recycleOf(id)) return D.recycleBlockReason(id);
  if(mode === "sell" && !(ITEMS[id].sellValue > 0)) return "No sale value";
  return "";
}
// Things that make removing `qty` of `id` risky: active hand-in objective (incl. found-in-raid copies), tracked upgrade, secure item.
function stashWarnings(id, qty){
  const w = [], left = have(id) - qty;
  for(const c of Object.keys(QC)){
    const def = chainActive(c), o = def && def.objective;
    if(!o || o.type !== "handin" || !o.items[id]) continue;
    const need = o.items[id], fir = raidFindable(id), after = fir ? Math.min(firHave(id), left) : left;
    if(after < need) w.push(fir ? 'Quest "' + def.title + '" hand-in needs ' + need + ' found-in-raid. You would keep ' + Math.max(0, after) + '.' : 'Quest "' + def.title + '" hand-in needs ' + need + '. You would keep ' + Math.max(0, after) + '.');
  }
  const miss = S.tracked && MODS[S.tracked.module] && MODS[S.tracked.module].levels.find(l => l.level === S.tracked.level);
  if(miss && miss.cost.items && miss.cost.items[id] && left < miss.cost.items[id]) w.push("Tracked upgrade " + MODS[S.tracked.module].name + " L" + S.tracked.level + " needs " + miss.cost.items[id] + ".");
  if(S.secureItem === id) w.push("This is your secure item.");
  return w;
}
function stashPopHtml(){
  const p = session.stashPop, id = p.id, it = ITEMS[id], info = D.itemInfo(id);
  if(gearKind(id) && !p.sellView && !p.confirm && (isFree(id) || have(id) > 0)) return gearPopHtml(id);
  const head = '<div class="bpop-head"><span class="bicon" aria-hidden="true">' + itemImg(id) + '</span><h1>' + esc(it.name) + '</h1><em>' + (isFree(id) ? IC("infinity") : '×' + have(id)) + '</em></div>';
  const meta = '<div class="sp-meta">' + esc(it.family) + ' · <span class="rar-' + it.rarity + '">' + esc(it.rarity) + '</span></div><div class="eff">' + esc(it.desc) + '</div>';
  if(isFree(id)) return '<div class="bpop stashpop">' + head + meta + '<div class="card small ok">Always available. Never takes a stash slot, can’t be lost on death, sold or recycled.</div></div>';
  p.qty = Math.max(1, Math.min(p.qty, have(id)));
  const q = p.qty, rec = recycleOf(id), uses = info && info.uses.length ? [...new Set(info.uses.map(u => u.short))].map(esc).join(", ") : "";
  const usedFor = uses ? '<div class="sp-used"><b>Used for:</b> ' + uses + '</div>' : '';
  if(p.confirm){
    const mode = p.confirm, w = stashWarnings(id, q);
    const what = mode === "sell" ? "Sell " + q + " for +" + sellGain(id, q) + " Scrap" : "Recycle " + q + " into " + rec.qty * q + " " + ITEMS[rec.to].name;
    return '<div class="bpop stashpop">' + head + '<div class="sp-warn" role="alert"><b>' + (w.length ? "Are you sure?" : "Confirm") + '</b>' + w.map(x => '<div>' + esc(x) + '</div>').join("") + '</div>' +
      '<div class="sp-act"><button class="primary big" onclick="A.stashConfirm()">' + esc(what).toUpperCase() + '</button><button class="ghost" onclick="A.stashBack()">CANCEL</button></div></div>';
  }
  const bs = stashBlock(id, "sell"), br = stashBlock(id, "recycle");
  const fir = firHave(id) ? '<div class="sp-fir">' + IC("fir") + ' Found in raid ×' + firHave(id) + '</div>' : '';
  return '<div class="bpop stashpop">' + head + '<div class="sp-body"><div class="sp-l">' + meta + usedFor + fir + '</div><div class="sp-r">' +
    '<div class="sp-qty"><button class="ghost" aria-label="Less" onclick="A.stashQty(-1)"' + (q <= 1 ? ' disabled' : '') + '>−</button><b>' + q + '</b>' +
    '<button class="ghost" aria-label="More" onclick="A.stashQty(1)"' + (q >= have(id) ? ' disabled' : '') + '>+</button>' +
    '<button class="ghost" onclick="A.stashQty(0)"' + (q >= have(id) ? ' disabled' : '') + '>ALL</button></div>' +
    '<button class="primary big" onclick="A.stashAct(\'sell\')"' + (bs ? ' disabled' : '') + '>SELL +' + sellGain(id, q) + ' SCRAP</button>' +
    (bs ? '<div class="sp-why">' + esc(bs) + '</div>' : '') +
    '<button class="ghost" onclick="A.stashAct(\'recycle\')"' + (br ? ' disabled' : '') + '>RECYCLE' + (rec ? ' +' + rec.qty * q + ' ' + IC(ITEMS[rec.to].icon) : '') + '</button>' +
    (br ? '<div class="sp-why">' + esc(br) + '</div>' : (rec ? '<div class="sp-why">into ' + esc(ITEMS[rec.to].name) + '</div>' : '')) +
    '<button type="button" class="linkbtn" onclick="A.openItemDetail(\'' + id + '\')">MORE OPTIONS</button></div></div></div>';
}
function stashPopRender(){
  const old = document.getElementById("overlay"); if(old) old.remove();
  const html = stashPopHtml();
  overlay(html, () => { session.stashPop = null; refresh(); }, html.includes("wpnscreen") ? "sheet wpnov" : "sheet");
}
// Quick clean (overflow): suggested sellables, low value, not needed anywhere, not reserved / secure / free.
// v1.87: never gear or anything the player can equip / use in a raid (weapons, armor, Medkit, tools such as EMP).
function usableGear(id){
  const it = ITEMS[id]; if(!it) return false;
  return !!(it.family === "gear" || it.weapon || it.slot || it.tool || /^tool_/.test(id) || (it.uses || []).includes("loadout") || gearKind(id));
}
function quickCleanList(fallback){
  const out = [], nextNeeds = {};
  const questWant = {}; // active quest-step items (extract / hand-in) are never suggested
  for(const c of Object.keys(QC)){ const d = chainActive(c), o = d && d.objective; if(!o) continue; if(o.item) questWant[o.item] = 1; if(o.items) for(const k in o.items) questWant[k] = 1; }
  for(const m of D.modules){ const n = nextLevelDef(m.id); if(n && n.cost.items) for(const k in n.cost.items) nextNeeds[k] = 1; }
  for(const id of invIds()){
    const it = ITEMS[id], n = qty(id);
    if(!it || n < 1 || isFree(id) || usableGear(id) || S.reserved[id] || S.secureItem === id || !(it.sellValue > 0)) continue;
    if(!fallback && it.sellValue > D.quickCleanMaxValue) continue;
    if(nextNeeds[id] || questWant[id] || stashWarnings(id, n).length) continue;
    out.push({ id, qty:n, slots:Math.ceil(n / (it.stackSize || 1)), gain:sellGain(id, n) });
  }
  out.sort((a, b) => ITEMS[a.id].sellValue - ITEMS[b.id].sellValue || a.id.localeCompare(b.id));
  // Nothing low-value and unneeded: offer only the three cheapest spare materials.
  return out.length || fallback ? out : quickCleanList(true).slice(0, 3);
}
function quickCleanDefault(list){
  const sel = {}; let over = stashSlotsUsed() - stashCapacity();
  for(const r of list){ if(over <= 0) break; sel[r.id] = true; over -= r.slots; }
  return sel;
}
function quickCleanHtml(){
  const qc = session.quickClean, list = quickCleanList(), over = stashSlotsUsed() - stashCapacity();
  const pick = list.filter(r => qc.sel[r.id]), gain = pick.reduce((a, r) => a + r.gain, 0), freed = pick.reduce((a, r) => a + r.slots, 0);
  const head = '<div class="bpop-head"><span class="bicon" aria-hidden="true">' + IC("item-crate") + '</span><h1>Quick clean</h1><em>' + stashSlotsUsed() + ' / ' + stashCapacity() + '</em></div>';
  if(qc.confirm) return '<div class="bpop stashpop">' + head + '<div class="sp-warn" role="alert"><b>Confirm</b><div>Sell ' + pick.length + ' stack' + (pick.length === 1 ? '' : 's') + ' and free ' + freed + ' slot' + (freed === 1 ? '' : 's') + '. This cannot be undone.</div></div>' +
    '<div class="sp-act"><button class="primary big" onclick="A.quickCleanConfirm()">SELL FOR +' + gain + ' SCRAP</button><button class="ghost" onclick="A.quickCleanBack()">CANCEL</button></div></div>';
  if(!list.length) return '<div class="bpop stashpop">' + head + '<div class="card small">Nothing safe to suggest. Everything left is reserved, secure or needed. Sell items from the stash one by one.</div></div>';
  return '<div class="bpop stashpop">' + head + '<div class="sp-sub">' + (over > 0 ? 'Over by ' + over + ' slot' + (over === 1 ? '' : 's') + '. ' : '') + 'Low-value items nothing needs.</div><div class="qclist">' +
    list.map(r => '<button type="button" class="qcrow' + (qc.sel[r.id] ? ' on' : '') + '" aria-pressed="' + !!qc.sel[r.id] + '" onclick="A.quickCleanToggle(\'' + r.id + '\')"><span class="sicon" aria-hidden="true">' + itemImg(r.id) + '</span><span class="qn">' + esc(ITEMS[r.id].name) + ' ×' + r.qty + '</span><span class="qg">+' + r.gain + '</span>' + (qc.sel[r.id] ? IC("check") : '') + '</button>').join("") +
    '</div><button class="primary big" onclick="A.quickCleanAsk()"' + (pick.length ? '' : ' disabled') + '>SELL SELECTED +' + gain + ' · FREES ' + freed + '</button></div>';
}
function quickCleanRender(){
  const old = document.getElementById("overlay"); if(old) old.remove();
  overlay(quickCleanHtml(), () => { session.quickClean = null; refresh(); }, "sheet");
}

SCREENS.itemDetail = function(id){
  const it = ITEMS[id];
  const miss = trackedMissingItem();
  const neededFor = [];
  for(const m of D.modules){
    const next = nextLevelDef(m.id);
    if(next && next.cost.items && next.cost.items[id]) neededFor.push(m.name + " L" + next.level);
  }
  let html =     '<h1>' + esc(it.name) + '</h1><div class="sub">' + esc(it.family) + ' · <span class="rar-' + it.rarity + '">' + esc(it.rarity) + '</span> · own ' + (isFree(id) ? IC("infinity") : '×' + have(id)) + '</div>' +
    '<div class="card small">' + esc(it.desc) + '</div>';
  if(isFree(id)){
    $app().innerHTML = html + '<div class="card small ok">Always available. Never takes a stash slot, can’t be lost on death, sold or dropped.</div>';
    return;
  }
  html += usedForHtml(id);
  if(firHave(id)) html += '<div class="card small firline">' + IC("fir") + ' Found in raid ×' + firHave(id) + (firHave(id) < have(id) ? ' of ' + have(id) : '') + '</div>';
  if(neededFor.length) html += '<div class="card small trackc">Needed for: ' + esc(neededFor.join(", ")) + '</div>';
  if(miss && miss.itemId === id) html += '<div class="flagbanner">TRACKED UPGRADE ITEM — NEEDED ' + miss.have + '/' + miss.need + '</div>';
  html += '<div class="kv"><span>Sell value</span><span>' + Math.floor(it.sellValue * D.vendors[0].sellMultiplier) + ' Scrap</span></div>';
  html += '<button class="ghost" onclick="A.sell(\'' + id + '\')">Sell 1 (+' + Math.floor(it.sellValue*D.vendors[0].sellMultiplier) + ' Scrap)</button>';
  html += '<button class="ghost" onclick="A.reserve(\'' + id + '\')">' + (S.reserved[id] ? "Unreserve" : "Reserve for upgrade") + '</button>';
  if((S.modules.fabricator||0) >= 1 && it.rarity === "common")
    html += '<button class="ghost" onclick="A.scrapIt(\'' + id + '\')">Scrap it (+' + Math.floor(it.sellValue*D.scrapJunkRate) + ' Scrap)</button>';
  if((S.modules.storage||0) >= 1)
    html += '<button class="ghost" onclick="A.setSecure(\'' + id + '\')">' + (S.secureItem===id ? IC("star") + " Secure item (tap to clear)" : "Set as secure item") + '</button>';
  if(retMode() === "full" && ITEMS[id].family === "protocol" && ITEMS[id].protocolTarget){
    html += S.decrypt
      ? '<div class="card small">Decryption in progress — ~' + Math.max(0, Math.ceil((S.decrypt.returnAt - Date.now())/1000)) + 's left.</div>'
      : '<button class="ghost" onclick="A.startDecrypt(\'' + id + '\')">DECRYPT (' + D.retention.decryption.durationSec + 's) — unlock a Protocol fragment</button>';
  }
  $app().innerHTML = html;
};

function ensurePrep(){
  if(session.prep) return session.prep;
  session.prep = {
    zoneId: D.raidZones.find(z=>coreLevel()>=z.unlockedAtCore).id,
    routeId: null,
    riskId: "standard",
    insuranceId: "none",
    loadout: { weapon:null, armor:null, c1:null, c2:null, tool:null }
  };
  // sensible defaults from stash
  session.prep.loadout.weapon = PROG.freeWeapon; // free Basic is always available for Node Raid
  if(have(PROG.defaultLoadout.armor)) session.prep.loadout.armor = PROG.defaultLoadout.armor;
  if(have(PROG.defaultLoadout.c1)) session.prep.loadout.c1 = PROG.defaultLoadout.c1;
  restoreSavedLoadout(session.prep);
  return session.prep;
}
// v1.87: the last chosen loadout lives in the save (S.loadout), so leaving Raid Prep (or reloading) keeps the spec.
// Only slots whose item is still owned (or the free weapon) are restored; the rest keep the defaults above.
function savedLoadoutOk(key, id){
  if(id === null) return key !== "weapon";
  const def = SLOT_DEFS.find(d => d[0] === key), it = ITEMS[id];
  return !!(def && it && (id === FREE_WEAPON || (it.slot === def[1] && have(id) > 0)));
}
function restoreSavedLoadout(p){
  const L = S.loadout; if(!L || typeof L !== "object") return;
  for(const key of Object.keys(p.loadout)) if(key in L && savedLoadoutOk(key, L[key])) p.loadout[key] = L[key];
  p.loadoutTouched = true;
}
SCREENS.prep = function(){
  const beat = curBeat();
  ensurePrep();
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
  const gear = nodeRaidGear();
  let html = lobbyHtml(gear, miss, guidedRaid());
  const missionOpen = (session.planOpen ? '<div class="pop-backdrop" onclick="A.planToggle(false)" aria-hidden="true"></div><button type="button" class="pop-x mission-x" onclick="A.planToggle(false)" aria-label="Close mission settings">' + IC("close") + '</button>' : '') + '<section id="mission-panel" class="mission-panel pop-card" role="dialog"' + (session.planOpen ? '' : ' hidden') + ' aria-label="Mission settings"><div class="mp-head pop-head"><h1>' + IC("mission") + ' Mission</h1></div>' +
    (S.tracked ? '<div class="goalbar">RAID GOAL<br><b>Gather repair materials for ' + esc(MODS[S.tracked.module].name) + '</b></div>' : goalBarHtml());

  if(guidedRaid()){
    const cfg = PROG.starterRaid, target = MODS[PROG.raidPrepUnlockModule];
    html += missionOpen + '<div class="prepgrid starter-prep"><h2>Basic loadout · equipped</h2></div><div class="card starter-mission"><div class="nu-head">YOUR FIRST RAID</div><h2>' + esc(cfg.name) + '</h2>' +
      '<p>Search for repair materials, then return to restore the Fabricator.</p>' +
      '<div class="small">' + esc(zoneSel.name) + ' · ' + esc(routeOf(zoneSel,p.routeId).name) + ' · Standard risk</div>' +
      (target ? '<h2>Bring home</h2>' + roomPartsHtml(roomDef(target.id)) : '') + '</div>' +
      '<div class="card locked prep-locked" aria-disabled="true"><b>' + IC("lock") + ' Custom loadout</b><br><span class="small">Build the Fabricator to choose your gear.</span></div>' +
      '<div class="card locked prep-locked" aria-disabled="true"><b>' + IC("lock") + ' Route &amp; risk choices</b><br><span class="small">Build the Fabricator to plan your own missions.</span></div>' +
      '<div class="card locked prep-locked" aria-disabled="true"><b>' + IC("lock") + ' Field crafting</b><br><span class="small">The Fabricator turns scrap into raid supplies.</span></div>';
    const fg = fuelGate();
    if(retMode() === "full") html += '<div class="card small">Fuel ' + S.fuel + ' / ' + D.retention.fuel.max + (!fg.ok ? '<button class="ad" onclick="A.adFuel()">REFILL FUEL</button>' : '') + '</div>';
    if(!p.loadout.weapon) html += '<button class="ghost" onclick="A.emergencyLoadout()">GET RECOVERY LOADOUT</button>';
    html += '<button class="ghost combat-launch" onclick="A.playCombatDemo()">TRY THE COMBAT TEST <span>LIVE FIRE · DRONE ENCOUNTER</span></button></section>';
    $app().innerHTML = html; return;
  }
  html += missionOpen + '<div class="prepgrid"><div class="pcol"><div class="kv"><span>Value at risk</span><span class="warn">' + prepRiskValue() + ' Scrap</span></div></div></div>';
  const ownsWeapon = invIds().some(id => ITEMS[id].slot === "weapon");
  if(!ownsWeapon){
    const eCost = Math.min(PROG.recovery.cheapLoadoutScrap, S.cur.scrap);
    html += '<div class="card warn"><b>No weapon left.</b><br><span class="small">' +
      (eCost > 0 ? 'BIT can scrape together a recovery loadout.' : 'BIT found you something. Don\'t ask where.') + '</span>' +
      '<button class="ghost" onclick="A.emergencyLoadout()">EMERGENCY LOADOUT — ' + (eCost > 0 ? eCost + ' SCRAP' : 'FREE') + '</button></div>';
  }

  html += '<div class="card prep-benefit"><span class="ok">' + IC("check") + ' FABRICATOR ONLINE — RAID PLANNING UNLOCKED</span><p class="small">Choose your loadout, search route and risk. Craft extra supplies before deploying.</p></div>';
  html += '<details class="card prep-crafting"><summary>FIELD CRAFTING · Fabricator L' + S.modules.fabricator + '</summary>' + fabQueueHtml();
  for(const recipe of D.recipes.filter(r => r.fabricatorLevel <= S.modules.fabricator)){
    const can = S.cur.scrap >= craftCost(recipe) && Object.entries(recipe.inputs).every(([id,qty]) => have(id) >= qty);
    html += '<div class="kv"><span>' + esc(recipe.name) + '<br><small>' + Object.entries(recipe.inputs).map(([id,qty]) => qty + '× ' + esc(ITEMS[id].name)).join(' · ') + ' · ' + craftCost(recipe) + ' Scrap</small></span>' +
      '<button class="ghost" style="width:auto" ' + (can ? 'onclick="A.craft(\'' + recipe.id + '\')"' : 'disabled') + '>' + (idleState().crafted ? IC("timer") + ' ' + fabMinutes(recipe.id) + 'm' : 'CRAFT') + '</button></div>';
  }
  html += '</details>';
  if(miss){
    html += '<div class="nextup"><div class="nu-head">NEXT TARGET</div>' +
      '<b>' + esc(ITEMS[miss.itemId].name) + '</b> <span class="small">' + miss.have + '/' + miss.need + '</span>' +
      (lead ? '<div class="kv"><span>Best known search</span><span class="trackc">' + esc(lead.zone.name) + ' — ' + esc(lead.route.name) + '</span></div>' +
        '<div class="kv"><span>Chance</span><span class="ok">' + lead.label + '</span></div>' +
        '<div class="kv"><span>Threat</span><span class="warn">' + IC("threat").repeat(lead.route.threat) + '</span></div>' : '') +
      (scoutLead() ? '<div class="small scoutnote" style="margin-top:4px">' + IC("bit-face") + ' Zone scout: ' + esc(lead.zone.name) + ' via ' + esc(lead.route.name) + '</div>' : '') +
      (bitOnline() && !bitAway() && lead ? '<div class="small" style="margin-top:4px">BIT: ' + esc(bitLine("route_reco", { route: lead.route.name, item: ITEMS[miss.itemId].name })) + '</div>' : '') +
      '</div>';
  }
  html += '<div class="mappanel" style="background-image:url(\'' + (zoneSel.mapArt || "assets/production/env_route_map.webp") + '\')"></div>';
  html += '<h2>Zone</h2>';
  for(const z of D.raidZones){
    const locked = coreLevel() < z.unlockedAtCore;
    html += '<div class="card tap ' + (locked?"locked":"") + (p.zoneId===z.id?" selected":"") + '" ' +
      (locked?"":'onclick="A.prepSet(\'zoneId\',\'' + z.id + '\')"') + '>' +
      '<div class="row"><b>' + esc(z.name) + '</b><span class="small">threat ' + IC("threat").repeat(z.threat) + '</span></div>' +
      '<div class="small">' + esc(z.tagline) + '</div>' +
      '<div>' + (scoutLead() && scoutLead().lead.zone.id === z.id ? '<span class="pill ok">BIT SCOUT</span>' : '') + (bondLevel() >= 4 || (scoutLead() && scoutLead().lead.zone.id === z.id)
        ? [...z.lootTable].sort((a,b)=>b.weight-a.weight).slice(0,3).map(l=>'<span class="pill ok">' + esc(ITEMS[l.itemId].name) + '</span>').join("")
        : z.likelyFamilies.map(f=>'<span class="pill">' + f + '</span>').join("")) +
      '<span class="pill">intel ' + (S.zoneIntel[z.id]||0) + '</span>' +
      (locked ? '<span class="pill bad">Core L' + z.unlockedAtCore + '</span>' : '') + '</div></div>';
  }

  html += '<h2>Search route</h2>';
  for(const rt of (zoneSel.routes||[])){
    const selr = p.routeId === rt.id;
    const slotsQ = Math.max(1, 4 + (rt.lootSlotMod||0));
    const chip = (scoutLead() && scoutLead().lead.route.id === rt.id && scoutLead().lead.zone.id === zoneSel.id ? '<span class="pill ok">BIT SCOUT</span>' : '') + (miss ? '<span class="pill trackc">' + esc(ITEMS[miss.itemId].name) + ': ' + chanceLabel(trackedChanceP(miss.itemId, zoneSel, rt, slotsQ)) + '</span>' : '');
    html += '<div class="card tap ' + (selr?"selected":"") + '" onclick="A.prepSet(\'routeId\',\'' + rt.id + '\')">' +
      '<div class="row"><b>' + esc(rt.name) + '</b><span class="small warn">' + IC("threat").repeat(rt.threat) + '</span></div>' +
      '<div class="small">' + esc(rt.desc) + '</div>' +
      '<div>' + rt.families.map(f=>'<span class="pill">' + f + '</span>').join("") + chip +
      ((rt.lootSlotMod||0) !== 0 ? '<span class="pill">' + (rt.lootSlotMod>0?"+":"") + rt.lootSlotMod + ' loot</span>' : '') +
      '</div></div>';
  }

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
      html += '<button class="ad" onclick="A.adSignals()">' + IC("play") + ' WATCH AD — +' + PROG.insurance.adSignalsGrant + ' SIGNALS</button>';
    }
  }
  const fg = fuelGate();
  if(retMode() === "full"){
    html += '<h2>Fuel</h2><div class="card"><div class="row"><b>' + S.fuel + ' / ' + D.retention.fuel.max + '</b>' +
      '<span class="small">1 per raid · regens over time</span></div>' +
      (fg.siphon ? '<div class="small ok">Tracked upgrade almost done — BIT siphons reserve. Raid allowed.</div>' : '') +
      (!fg.ok ? '<div class="small bad">Out of fuel.</div><button class="ad" onclick="A.adFuel()">' + IC("play") + ' WATCH AD — +' + D.retention.fuel.adGrant + ' FUEL</button>' : '') +
      '</div>';
  }
  html += '<button class="ghost combat-launch" onclick="A.playCombatDemo()">TRY THE COMBAT TEST <span>LIVE FIRE · DRONE ENCOUNTER</span></button></section>';
  $app().innerHTML = html;
};
const SLOT_DEFS = [["weapon","weapon","Weapon",IC("item-carbine")],["armor","armor","Armor",IC("item-vest")],["c1","consumable","Item 1",IC("item-medkit")],["c2","consumable","Item 2",IC("item-medkit")],["tool","tool","Tool",IC("tool-grenade")]];
function ownedForSlot(slot){ return invIds().filter(x => ITEMS[x].slot === slot).length; }
// Quantity carried on a tile: medkits across both item slots (capped by stock) / tool charges.
function slotQty(key){ const l = session.prep.loadout; return (key === "c1" || key === "c2") && l[key] === PROG.kitItem ? Math.min(have(PROG.kitItem), ["c1","c2"].filter(k => l[k] === PROG.kitItem).length) : key === "tool" ? (nodeRaidTool() || { n:0 }).n : 0; }
function slotTileHtml(def, locked, mini){
  const [key, slot, label, icon] = def, p = session.prep;
  if(locked && ownedForSlot(slot) > 0) locked = false; // never lock the player out of gear they own
  const id = p.loadout[key], it = id && ITEMS[id], qty = mini ? 0 : slotQty(key);
  const risk = it && !it.free; // everything equipped except the free Basic weapon is lost on death
  const empty = ownedForSlot(slot) ? 'Empty' : 'None owned';
  return '<button type="button" class="lslot' + (mini ? ' mini' : '') + (it ? ' filled' : '') + (locked ? ' locked' : '') + '" data-slot="' + key + '" ' +
    (locked ? 'disabled aria-disabled="true"' : 'onclick="A.pickSlot(\'' + key + '\')"') + ' aria-label="' + label + ': ' + (it ? esc(it.name) : 'empty') + '">' +
    (risk ? '<span class="rdot" aria-hidden="true"></span>' : '') +
    '<i aria-hidden="true">' + (it ? itemImg(id) : (mini ? IC("plus") : icon)) + '</i>' +
    (mini ? '' : '<b>' + (it ? esc(it.name) : (!locked && ownedForSlot(slot) ? empty : (slot === "tool" ? 'Add tool' : empty))) + '</b><small>' + label + '</small>') +
    (qty > 0 ? '<span class="qty">x' + qty + '</span>' : '') +
    (key === "weapon" && it && !mini && gearKind(id) === "weapon" ? '<span class="lslot-up" role="button" tabindex="0" aria-label="Open ' + esc(it.name) + ' bench" onclick="event.stopPropagation();A.openWeapon(\'' + id + '\')">' + IC("chevron-up") + '</span>' : '') + '</button>';
}
// Brawl-Stars-style lobby: operator centre stage, loadout tiles either side, compact PLAY bottom-right.
// v1.44 world map: areas, unlocks and zones all come from DATA.worldMap (data/progression.js).
const WMAP = D.worldMap, AREA_DEFS = {}; WMAP.areas.forEach(a => AREA_DEFS[a.id] = a);
const DEBUG_AREAS = typeof location !== "undefined" && /[?&]debug(=|&|$)/.test(location.search || "");
function areaScouted(id){ return !!(S.areaScouted && S.areaScouted[id]); }
function areaCoreOk(id){ const q = AREA_DEFS[id] && AREA_DEFS[id].requires; return !q || coreLevel() >= q.core; }
function areaEarned(id){ return areaCoreOk(id) && areaScouted(id); }
function areaUnlocked(id){ const a = AREA_DEFS[id]; if(!a) return false; if(!a.requires || DEBUG_AREAS || S.debugAreas) return true; return areaEarned(id); }
// Unlocked for real (not via debug) and not yet selected/tapped by the player.
function areaUnseen(id){ const a = AREA_DEFS[id]; return !!(a && a.requires && !DEBUG_AREAS && !S.debugAreas && areaUnlocked(id) && !(S.areaSeen && S.areaSeen[id])); }
// First unseen unlocked area in data order, or null. Drives the NEW badges and the map-open zoom.
function wmNewUnlockTarget(){ const a = WMAP.areas.find(x => areaUnseen(x.id)); return a ? a.id : null; }
// Hard variant (docs/design-retention-quests.md section 5): the area's Hard flag is unlocked AND the Rebirth Core is at L3. Raid Prep toggles it (session only).
function hardAvailable(id){ return !!(AREA_DEFS[id] && S.unlocks && S.unlocks.hard && S.unlocks.hard[id] && coreLevel() >= 3); }
function hardOn(){ return session.hard === true && hardAvailable(raidArea()); }
function raidArea(){ return AREA_DEFS[S.area] && areaUnlocked(S.area) ? S.area : WMAP.areas[0].id; }
function areaZonesCleared(id){ return (S.areaZones && S.areaZones[id]) || []; }
// Requirement lines for a locked area: [text, done] pairs, both steps visible (short labels: "Core L3", "Town Survey").
function areaReqs(id){
  const q = AREA_DEFS[id].requires; if(!q) return [];
  const it = ITEMS[q.scoutItem];
  return [["Core L" + q.core, areaCoreOk(id)], [it ? it.name : q.scoutItem, areaScouted(id)]];
}
// The locked area the loop points at: source area open, itself still locked (null when everything is open).
function wmNextTarget(){ const a = WMAP.areas.find(x => !areaUnlocked(x.id) && x.requires && areaUnlocked(x.requires.from)); return a ? a.id : null; }
// One-line blurb + CTA for a locked area: Core first, then the scout run. kind = "core" (go raise Core) or "scout" (Raid Prep, `from` preselected).
function areaUnlockHelp(id){
  const q = AREA_DEFS[id].requires; if(!q) return null;
  const it = ITEMS[q.scoutItem], from = AREA_DEFS[q.from];
  const blurb = "Core " + q.core + " + " + (it ? it.name : q.scoutItem) + " from " + (from ? from.name : q.from) + ".";
  return !areaCoreOk(id) ? { kind:"core", label:"RAISE CORE", blurb, from:q.from } : !areaScouted(id) ? { kind:"scout", label:"SCOUT", blurb, from:q.from } : { kind:null, label:"", blurb, from:q.from };
}
// Called from core ingest: scouting items + zone progress for the area that was raided.
function applyAreaProgress(area, levelsCleared, extractedIds){
  const notes = [];
  S.areaZones = S.areaZones || {}; S.areaScouted = S.areaScouted || {};
  if(AREA_DEFS[area]){ const z = new Set(areaZonesCleared(area)); const n = Math.min(AREA_DEFS[area].zones.length, Math.max(0, Math.floor(Number(levelsCleared) || 0)));
    for(let i = 1; i <= n; i++) if(!z.has(i)){ z.add(i); notes.push(AREA_DEFS[area].name + ": " + AREA_DEFS[area].zones[i-1] + " cleared"); }
    S.areaZones[area] = [...z].sort((a, b) => a - b); }
  for(const id of extractedIds){ const t = ITEMS[id] && ITEMS[id].scouts; if(t && AREA_DEFS[t] && !S.areaScouted[t]){ S.areaScouted[t] = true; notes.push(AREA_DEFS[t].name + " scouted" + (areaUnlocked(t) ? " — UNLOCKED on the world map" : " — needs Rebirth Core L" + AREA_DEFS[t].requires.core)); } }
  return notes;
}
function areaPickerHtml(){
  const a = AREA_DEFS[raidArea()];
  const tq = trackedQuest(), pip = tq && tq.step && tq.step.area === a.id;
  const lv = tq && tq.step && tq.step.objective && tq.step.objective.level;
  return '<button type="button" class="area-pick map-open' + (pip ? ' quest-target' : '') + '" onclick="A.go(\'worldmap\')" aria-label="World map — selected area ' + esc(a.name) + (wmNewUnlockTarget() ? ' — new area unlocked' : '') + (pip ? ', tracked quest here' : '') + '"><i aria-hidden="true">' + IC('map') + '</i><span><small>AREA' + (wmNewUnlockTarget() ? ' <em class="new-tag" aria-hidden="true">NEW</em>' : '') + (pip ? ' <em class="qpip" title="Tracked quest" aria-label="Tracked quest"></em>' : '') + '</small><b>' + IC(a.iconId) + ' ' + esc(a.name.toUpperCase()) + (pip && lv ? ' L' + lv : '') + '</b></span></button>';
}
SCREENS.worldmap = function(){
  $app().setAttribute("class", "s-worldmap");
  const sel = raidArea(), pc = v => v + '%';
  // Routes (dashed in the art): lit = destination unlocked; next = source open, destination still locked.
  const routes = (WMAP.routes || []).map(r => {
    const st = areaUnlocked(r.to) ? "lit" : areaUnlocked(r.from) ? "next" : "dim";
    return '<polyline class="wm-route ' + st + '" data-route="' + r.from + '-' + r.to + '" points="' + r.points.map(p => p[0] + ',' + (p[1] / WMAP.aspect)).join(' ') + '"/>';
  }).join('');
  // Landmark beacons: lit (cyan) once their area is open, the next locked area's beacons amber, rest dark.
  const nextArea = wmNextTarget();
  const beacons = (WMAP.beacons || []).map(b => {
    const st = areaUnlocked(b.area) ? "lit" : b.area === nextArea ? "next" : "dark";
    return '<i class="wm-beacon ' + st + (b.dest ? ' dest' : '') + '" data-beacon="' + esc(b.name) + '" style="left:' + b.x + '%;top:' + b.y + '%" title="' + esc(b.name) + '"></i>';
  }).join('');
  const areas = WMAP.areas.map(a => {
    const open = areaUnlocked(a.id), z = areaZonesCleared(a.id), R = a.region, L = (!open && a.lockedLabel) || a.label || { x:R.x + R.w / 2, y:R.y + R.h / 2 };
    const isNext = !open && a.id === nextArea, help = isNext ? areaUnlockHelp(a.id) : null, go = help && help.kind ? ' role="button" tabindex="0" onclick="A.wmLocked(\'' + a.id + '\')"' : '';
    const tap = open ? ' onclick="A.setArea(\'' + a.id + '\')"' : go || ' aria-disabled="true"';
    const questHere = !!(trackedQuest() && trackedQuest().step && trackedQuest().step.area === a.id);
    return '<button type="button" class="wm-region' + (open ? '' : ' locked') + (isNext ? ' next' : '') + (sel === a.id ? ' on' : '') + (areaUnseen(a.id) ? ' fresh' : '') + (questHere ? ' quest-target' : '') + '" data-area="' + a.id + '" style="left:' + pc(R.x) + ';top:' + pc(R.y) + ';width:' + pc(R.w) + ';height:' + pc(R.h) + '"' + tap + ' aria-label="' + esc(a.name) + (open ? '' : ' (locked)') + '">' + (open ? '' : '<span class="wm-lock" aria-hidden="true">' + IC('lock') + '</span>') + '</button>' +
      '<div class="wm-label' + (open ? '' : ' locked') + (isNext ? ' next' : '') + (L.anchor ? ' at-' + L.anchor : '') + (sel === a.id ? ' on' : '') + (areaUnseen(a.id) ? ' fresh' : '') + '" data-label="' + a.id + '" style="left:' + pc(L.x) + ';top:' + pc(L.y) + '"' + (open ? ' onclick="A.setArea(\'' + a.id + '\')"' : go) + '>' + (areaUnseen(a.id) ? '<em class="wm-new" aria-label="New area">NEW</em>' : '') +
      '<span class="wm-name">' + IC(a.iconId) + ' ' + esc(a.name) + ' <small class="threat">' + IC("threat").repeat(a.threat) + '</small></span>' +
      (open ? '<span class="wm-zones">' + a.zones.map((n, i) => { const tq = trackedQuest(), ql = tq && tq.step && tq.step.area === a.id && (tq.step.objective.level || 1) === (i + 1); return '<i class="wm-zone' + (z.includes(i + 1) ? ' lit' : '') + (ql ? ' qpip' : '') + '" title="' + esc(n) + (ql ? ' · tracked' : '') + '">' + (i + 1) + '</i>'; }).join('') + '</span>' + (sel === a.id ? '<span class="wm-sel">SELECTED</span>' : '<span class="wm-tap">TAP TO SELECT</span>')
            : '<span class="wm-req">' + areaReqs(a.id).map(([t, ok]) => '<span class="' + (ok ? 'ok' : '') + '">' + (ok ? IC("check") : IC("dot")) + ' ' + esc(t) + '</span>').join('') + '</span>' + (help ? '<small class="wm-blurb">' + esc(help.blurb) + '</small>' + (help.kind ? '<span class="wm-cta" data-cta="' + help.kind + '">' + IC(help.kind === "core" ? "room-core" : "nav-raid") + help.label + '</span>' : '') : '')) + '</div>';
  }).join('');
  const a = AREA_DEFS[sel];
  $app().innerHTML = '<div class="worldmap" style="background-color:' + ((WMAP.fog && WMAP.fog.color) || WMAP.bg) + '">' +
    '<div class="wm-stage" style="--ar:' + WMAP.aspect + ';background-image:url(\'' + WMAP.background + '\')">' +
      '<svg class="wm-routes" viewBox="0 0 100 ' + (100 / WMAP.aspect) + '" preserveAspectRatio="none" aria-hidden="true">' + routes + '</svg>' + wmFogSvg() + beacons + areas + '</div>' +
    '<div class="wm-fog"></div>' +
    '<h1 class="sr-only">World map</h1>' +
    '</div>';
  setupWorldMapPan(sel);
};
// v1.58 world map camera: free drag + pinch + wheel zoom. Labels stay crisp because the stage is re-laid out at the
// zoomed pixel size (no CSS scale); all positions are % of the stage. The camera lives in session.wmCam as the map
// fraction at the viewport centre (fx, fy) plus zoom z (1 = "cover"). It is never reset by a re-render; it is only
// centred on the selected area when the map is opened fresh. Bounds are soft: past the playable box the map follows
// the finger with rubber-band resistance and springs back on release (no hard clamp while a finger is down).
const WM_DEF_Z = 1.4, WM_MAX_Z = 2.5, WM_TAP = 7;
const wmRaf = f => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(f) : 0), wmCancel = id => { if(id && typeof cancelAnimationFrame === "function") cancelAnimationFrame(id); };
// Playable box (map fractions) = every defined area region plus every route point, padded. Data-driven.
function wmPlayBox(){
  const pad = ((WMAP.fog && WMAP.fog.pad) || 3) / 100; let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for(const a of WMAP.areas){ const R = a.region; add(R.x / 100, R.y / 100); add((R.x + R.w) / 100, (R.y + R.h) / 100); }
  for(const r of WMAP.routes || []) for(const p of r.points) add(p[0] / 100, p[1] / 100);
  return { x0:Math.max(0, x0 - pad), y0:Math.max(0, y0 - pad), x1:Math.min(1, x1 + pad), y1:Math.min(1, y1 + pad) };
}
// iOS-style rubber band: continuous and monotone, resistance grows with the overshoot.
function wmRubber(v, lo, hi, dim){
  const c = 0.55, band = o => (o * c * dim) / (dim + c * o);
  return v < lo ? lo - band(lo - v) : v > hi ? hi + band(v - hi) : v;
}
// Geometry for a viewport: cover width, zoom limits, and centre bounds for zoom z.
function wmGeom(vw, vh, z){
  const ar = WMAP.aspect || 1.5, cover = Math.max(vw, vh * ar), B = wmPlayBox(), bw = B.x1 - B.x0, bh = B.y1 - B.y0;
  const zMin = Math.min(vw / bw, vh * ar / bh) / cover, zz = Math.max(zMin, Math.min(WM_MAX_Z, z)), s = cover * zz, sh = s / ar;
  const hx = vw / 2 / s, hy = vh / 2 / sh, axis = (a0, a1, h) => a1 - a0 >= 2 * h ? [a0 + h, a1 - h] : [(a0 + a1) / 2, (a0 + a1) / 2];
  return { ar, cover, zMin, z:zz, s, sh, bx:axis(B.x0, B.x1, hx), by:axis(B.y0, B.y1, hy), vw, vh };
}
// New-unlock framing (pure, px): the largest zoom <= min(zMax, WM_MAX_Z), >= zMin, at which the whole region plus its
// label card fits inside the visible box (viewport minus chrome insets `ins` {t,r,b,l}) with `pad` px around it.
// Returns the camera (map fractions at the viewport centre) that centres that union box in the visible box.
function wmFitUnlock(vw, vh, ins, R, L, lbl, o){
  const ar = WMAP.aspect || 1.5, cover = Math.max(vw, vh * ar), pad = o.pad || 0;
  const availW = Math.max(1, vw - ins.l - ins.r - 2 * pad);
  // label extent in px relative to its anchor point (default: card sits above the point, centred)
  const an = (L && L.anchor) || "", lx0 = an === "left" ? -lbl.w : -lbl.w / 2, lx1 = an === "left" ? 0 : lbl.w / 2, ly0 = an === "below" || an === "left" ? 0 : -lbl.h, ly1 = ly0 + lbl.h;
  const box = z => { const s = cover * z, sh = s / ar, X = s / 100, Y = sh / 100, lp = L || { x:R.x + R.w / 2, y:R.y + R.h / 2 };
    return { x0:Math.min(R.x * X, lp.x * X + lx0), x1:Math.max((R.x + R.w) * X, lp.x * X + lx1), y0:Math.min(R.y * Y, lp.y * Y + ly0), y1:Math.max((R.y + R.h) * Y, lp.y * Y + ly1), s, sh }; };
  const g = wmGeom(vw, vh, 1), top = Math.max(g.zMin, Math.min(WM_MAX_Z, o.z || WM_MAX_Z));
  const solve = t => { const aH = Math.max(1, vh - t - ins.b - 2 * pad), ok = z => { const b = box(z); return b.x1 - b.x0 <= availW && b.y1 - b.y0 <= aH; };
    let z = top; if(!ok(top)){ let lo = g.zMin, hi = top; for(let i = 0; i < 30; i++){ const m = (lo + hi) / 2; if(ok(m)) lo = m; else hi = m; } z = lo; }
    const b = box(z), ay = t + (vh - t - ins.b) / 2, ax = ins.l + (vw - ins.l - ins.r) / 2;
    return { z, fx:((b.x0 + b.x1) / 2 + (vw / 2 - ax)) / b.s, fy:((b.y0 + b.y1) / 2 + (vh / 2 - ay)) / b.sh, box:b, ins:{ t, r:ins.r, b:ins.b, l:ins.l }, pad }; };
  const F = solve(ins.t);
  return F;
}
function setupWorldMapPan(sel){
  if(typeof document === "undefined") return;
  const view = document.querySelector(".worldmap"), stage = view && view.querySelector(".wm-stage");
  if(!view || !stage) return;
  const R = AREA_DEFS[sel].region;
  wmCancel(session.wmAnim); session.wmAnim = 0;
  if(!session.wmCam){
    session.wmCam = { area:sel, fx:(R.x + R.w / 2) / 100, fy:(R.y + R.h / 2) / 100, z:WM_DEF_Z };
    // Fresh open with an unseen unlock: fly to it once (cam.intro holds the target until the glide ends or the user takes over).
    const nt = wmNewUnlockTarget(), NZ = WMAP.newUnlockZoom;
    if(nt && NZ && nt !== sel) session.wmCam.intro = { area:nt, ms:NZ.ms, left:NZ.ms };
  }
  const cam = session.wmCam; cam.area = sel;
  const pts = new Map(); let g = null, moved = false, suppress = false, vel = { x:0, y:0 }, G = null;
  const size = () => [view.clientWidth || 844, view.clientHeight || 390];
  const origin = () => { const r = view.getBoundingClientRect ? view.getBoundingClientRect() : { left:0, top:0 }; return [r.left || 0, r.top || 0]; };
  // Visible map area: the view minus the nav bar (side or bottom) and safe-area insets, measured from the DOM.
  function chrome(){
    const ins = { t:0, r:0, b:0, l:0 }; if(!view.getBoundingClientRect) return ins;
    const v = view.getBoundingClientRect(), hit = r => r && r.width > 0 && r.height > 0 && r.right > v.left && r.left < v.right && r.bottom > v.top && r.top < v.bottom;
      const nav = document.getElementById("tabs"), nr = nav && nav.getBoundingClientRect();
    if(hit(nr)){ if(nr.width >= nr.height) ins.b = Math.max(0, v.bottom - nr.top); else if(nr.left + nr.width / 2 < (v.left + v.right) / 2) ins.l = Math.max(0, nr.right - v.left); else ins.r = Math.max(0, v.right - nr.left); }
    if(typeof getComputedStyle === "function"){ const pr = document.createElement("div"); pr.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;padding:var(--st,0px) var(--sr,0px) var(--sb,0px) var(--sl,0px)"; view.appendChild(pr);
      const cs = getComputedStyle(pr), n = k => parseFloat(cs[k]) || 0, w = document.defaultView; pr.remove();
      const sb = n("paddingBottom"), sr = n("paddingRight"), sl = n("paddingLeft"), st = n("paddingTop");
      if(w && v.bottom >= w.innerHeight - 1) ins.b = Math.max(ins.b, sb); if(v.right >= w.innerWidth - 1) ins.r = Math.max(ins.r, sr); if(v.left <= 1) ins.l = Math.max(ins.l, sl); if(v.top <= 1) ins.t = Math.max(ins.t, st); }
    return ins;
  }
  function introTarget(id, vw, vh){
    const A = AREA_DEFS[id], lab = view.querySelector('.wm-label[data-label="' + id + '"]'), lr = lab && lab.getBoundingClientRect ? lab.getBoundingClientRect() : null;
    const lbl = lr && lr.width > 0 ? { w:lr.width, h:lr.height } : { w:150, h:64 };
    return wmFitUnlock(vw, vh, chrome(), A.region, A.label, lbl, { z:WMAP.newUnlockZoom.z, pad:WMAP.newUnlockZoom.pad });
  }
  function layout(){
    const [vw, vh] = size(); G = wmGeom(vw, vh, cam.z); cam.z = G.z;
    stage.style.width = G.s + 'px'; stage.style.height = G.sh + 'px';
    const dx = wmRubber(cam.fx, G.bx[0], G.bx[1], vw / G.s), dy = wmRubber(cam.fy, G.by[0], G.by[1], vh / G.sh);
    stage.style.transform = 'translate3d(' + (vw / 2 - dx * G.s).toFixed(2) + 'px,' + (vh / 2 - dy * G.sh).toFixed(2) + 'px,0)';
    view.style.setProperty("--wmz", G.z.toFixed(3)); view.dataset.zoom = G.z.toFixed(2);
  }
  // Zoom to z keeping the map point under viewport point (px, py) fixed.
  function zoomAt(z, px, py){
    const [vw, vh] = size(), a = wmGeom(vw, vh, cam.z), wx = cam.fx + (px - vw / 2) / a.s, wy = cam.fy + (py - vh / 2) / a.sh, b = wmGeom(vw, vh, z);
    cam.z = b.z; cam.fx = wx - (px - vw / 2) / b.s; cam.fy = wy - (py - vh / 2) / b.sh;
  }
  function centroid(){
    const [ox, oy] = origin(), p = [...pts.values()], cx = p.reduce((s, q) => s + q.x, 0) / p.length - ox, cy = p.reduce((s, q) => s + q.y, 0) / p.length - oy;
    const d = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; return { x:cx, y:cy, d };
  }
  // (Re)anchor the gesture on the current finger centroid; called whenever the finger count changes, so adding or
  // lifting a finger never jumps the map.
  function anchor(){
    const c = centroid(), [vw, vh] = size(), a = wmGeom(vw, vh, cam.z);
    g = { wx:cam.fx + (c.x - vw / 2) / a.s, wy:cam.fy + (c.y - vh / 2) / a.sh, z0:cam.z, d0:c.d || 1, lx:c.x, ly:c.y, t:Date.now() };
  }
  function apply(){
    const c = centroid(), [vw, vh] = size();
    if(pts.size > 1) cam.z = wmGeom(vw, vh, g.z0 * c.d / g.d0).z;
    const b = wmGeom(vw, vh, cam.z); cam.fx = g.wx - (c.x - vw / 2) / b.s; cam.fy = g.wy - (c.y - vh / 2) / b.sh;
    const now = Date.now(), dt = Math.max(8, now - g.t), cap = v => Math.max(-2.5, Math.min(2.5, v));
    vel = pts.size > 1 ? { x:0, y:0 } : { x:cap((c.x - g.lx) / dt), y:cap((c.y - g.ly) / dt) }; g.lx = c.x; g.ly = c.y; g.t = now;
    layout();
  }
  // After release: inertial glide, then a spring back inside the soft bounds. Runs on rAF, stops by itself.
  function settle(){
    wmCancel(session.wmAnim); let last = 0;
    const step = now => {
      const dt = last ? Math.min(40, now - last) : 16; last = now; const k = Math.pow(0.9, dt / 16), sp = 1 - Math.pow(0.78, dt / 16);
      cam.fx -= vel.x * dt / G.s; cam.fy -= vel.y * dt / G.sh; vel.x *= k; vel.y *= k;
      const tx = Math.max(G.bx[0], Math.min(G.bx[1], cam.fx)), ty = Math.max(G.by[0], Math.min(G.by[1], cam.fy));
      if(tx !== cam.fx){ vel.x *= 0.5; cam.fx += (tx - cam.fx) * sp; } if(ty !== cam.fy){ vel.y *= 0.5; cam.fy += (ty - cam.fy) * sp; }
      const rest = Math.hypot(vel.x, vel.y) < 0.02 && Math.abs(tx - cam.fx) * G.s < 0.3 && Math.abs(ty - cam.fy) * G.sh < 0.3;
      if(rest){ cam.fx = tx; cam.fy = ty; vel = { x:0, y:0 }; layout(); session.wmAnim = 0; return; }
      layout(); session.wmAnim = wmRaf(step); };
    session.wmAnim = wmRaf(step);
  }
  view.addEventListener("pointerdown", e => {
    wmCancel(session.wmAnim); session.wmAnim = 0; cam.intro = null;
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY });
    if(pts.size === 1){ moved = false; vel = { x:0, y:0 }; }
    if(pts.size > 1){ if(!moved){ moved = true; suppress = true; view.classList.add("dragging"); } for(const id of pts.keys()) if(view.setPointerCapture) try { view.setPointerCapture(id); } catch(_){} }
    anchor();
  });
  view.addEventListener("pointermove", e => {
    const p = pts.get(e.pointerId); if(!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if(!moved){ if(Math.hypot(p.x - p.x0, p.y - p.y0) <= WM_TAP) return;
      // past the tap threshold: re-anchor at the current point so the map starts following without a jump
      moved = true; suppress = true; view.classList.add("dragging"); if(view.setPointerCapture) try { view.setPointerCapture(e.pointerId); } catch(_){}
      anchor(); return; }
    apply(); if(e.preventDefault) e.preventDefault();
  });
  const up = e => {
    if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if(pts.size){ anchor(); vel = { x:0, y:0 }; return; }
    const was = moved; g = null; view.classList.remove("dragging"); setTimeout(() => { suppress = false; moved = false; }, 0);
    if(was) settle();
  };
  view.addEventListener("pointerup", up); view.addEventListener("pointercancel", up);
  view.addEventListener("wheel", e => {
    e.preventDefault(); wmCancel(session.wmAnim); cam.intro = null; const [ox, oy] = origin(), px = e.clientX - ox, py = e.clientY - oy, unit = e.deltaMode === 1 ? 16 : 1;
    const mouse = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40);
    if(e.ctrlKey || mouse) zoomAt(cam.z * Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015)), px, py);
    else { cam.fx += e.deltaX / G.s; cam.fy += e.deltaY / G.sh; }
    vel = { x:0, y:0 }; layout(); settle();
  }, { passive:false });
  // a drag that ends on a region/label must not select it
  view.addEventListener("click", e => { if(e.detail !== 0 && suppress){ e.preventDefault(); e.stopPropagation(); } }, true);
  if(session.wmResize) window.removeEventListener("resize", session.wmResize);
  session.wmResize = () => { layout(); if(cam.intro){ wmCancel(session.wmAnim); session.wmAnim = 0; flyToNew(); } else settle(); }; window.addEventListener("resize", session.wmResize); layout();
  if(Math.max(G.bx[0], Math.min(G.bx[1], cam.fx)) !== cam.fx || Math.max(G.by[0], Math.min(G.by[1], cam.fy)) !== cam.fy){
    cam.fx = Math.max(G.bx[0], Math.min(G.bx[1], cam.fx)); cam.fy = Math.max(G.by[0], Math.min(G.by[1], cam.fy)); layout(); }
  if(cam.intro) flyToNew();
  // Ease-out glide to the new area at the closer zoom, then stay put (the user can pan from there). A re-render
  // mid-flight resumes with the time left. Reduced motion jumps straight there.
  function flyToNew(){
    const I = cam.intro, [vw, vh] = size(), F = introTarget(I.area, vw, vh), E = wmGeom(vw, vh, F.z);
    const to = { fx:Math.max(E.bx[0], Math.min(E.bx[1], F.fx)), fy:Math.max(E.by[0], Math.min(E.by[1], F.fy)), z:E.z };
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduce || I.left <= 0){ Object.assign(cam, to); cam.intro = null; layout(); return; }
    const from = { fx:cam.fx, fy:cam.fy, z:cam.z }, total = I.left; let t0 = 0;
    const step = now => {
      if(!cam.intro) return; if(!t0) t0 = now;
      const el = Math.min(total, now - t0), k = 1 - Math.pow(1 - el / total, 3);
      cam.fx = from.fx + (to.fx - from.fx) * k; cam.fy = from.fy + (to.fy - from.fy) * k; cam.z = from.z + (to.z - from.z) * k; I.left = total - el;
      layout();
      if(el >= total){ cam.fx = to.fx; cam.fy = to.fy; cam.z = to.z; cam.intro = null; layout(); session.wmAnim = 0; return; }
      session.wmAnim = wmRaf(step);
    };
    session.wmAnim = wmRaf(step);
  }
}
// Fog of war: navy fog over everything except area regions and routes (soft feathered holes via a blurred mask).
function wmFogSvg(){
  const F = WMAP.fog || {}, ar = WMAP.aspect || 1.5, H = 100 / ar, pad = F.pad || 3, fe = F.feather || 2.2, rw = F.routeWidth || 9;
  const holes = WMAP.areas.map(a => { const R = a.region, y = R.y / ar, h = R.h / ar;
      return '<rect data-fog-hole="' + a.id + '" x="' + (R.x - pad) + '" y="' + (y - pad) + '" width="' + (R.w + 2 * pad) + '" height="' + (h + 2 * pad) + '" rx="' + (pad * 2) + '"/>'; }).join('') +
    (WMAP.routes || []).map(r => '<polyline data-fog-route="' + r.from + '-' + r.to + '" fill="none" stroke="#000" stroke-width="' + rw + '" stroke-linecap="round" stroke-linejoin="round" points="' + r.points.map(p => p[0] + ',' + (p[1] / ar)).join(' ') + '"/>').join('');
  const hq = typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches && (typeof navigator === "undefined" || (navigator.hardwareConcurrency || 4) >= 4);
  return '<svg class="wm-fogmap' + (hq ? ' hq' : '') + '" viewBox="0 0 100 ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<defs><filter id="wmFeather" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="' + fe + '"/></filter>' +
    '<filter id="wmNoise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035 .06" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .62  0 0 0 0 .78  0 0 0 .55 0"/></filter>' +
    '<mask id="wmFogMask" maskUnits="userSpaceOnUse" x="-60" y="-60" width="220" height="' + (H + 120) + '"><rect x="-60" y="-60" width="220" height="' + (H + 120) + '" fill="#fff"/><g fill="#000" filter="url(#wmFeather)">' + holes + '</g></mask></defs>' +
    '<g mask="url(#wmFogMask)"><rect class="fog" x="-60" y="-60" width="220" height="' + (H + 120) + '" fill="' + (F.color || "#0b1526") + '" fill-opacity="' + (F.opacity || 0.93) + '"/>' +
    (hq ? '<rect class="fog-noise" x="-60" y="-60" width="220" height="' + (H + 120) + '" filter="url(#wmNoise)" opacity=".22"/>' : '') + '</g></svg>';
}
function lobbyHtml(gear, miss, locked){
  const medSlot = slotTileHtml(SLOT_DEFS[2], locked), toolOk = !(locked && !ownedForSlot("tool"));
  return '<div class="lobby">' +
    '<div class="lobby-top"><h1>Raid Prep</h1>' + gearRiskHtml(gear) +
      (hardAvailable(raidArea()) ? '<button type="button" class="hard-btn' + (hardOn() ? ' on' : '') + '" onclick="A.toggleHard()" aria-pressed="' + hardOn() + '" aria-label="Hard variant ' + (hardOn() ? 'on' : 'off') + '"><span>HARD</span><small>' + (hardOn() ? 'ON' : 'OFF') + '</small></button>' : '') +
      '<button type="button" class="mission-btn" onclick="A.planToggle(true)" aria-controls="mission-panel">' + IC("mission") + ' <span>MISSION</span></button></div>' +
    '<div class="lobby-side left"><div class="slotgrid">' + slotTileHtml(SLOT_DEFS[0], locked) + slotTileHtml(SLOT_DEFS[1], locked) +
      '<div class="slotwrap">' + medSlot + slotTileHtml(SLOT_DEFS[3], locked, true) + '</div>' + (toolOk ? slotTileHtml(SLOT_DEFS[4], locked) : '') + '</div></div>' +
    '<div class="lobby-hero"><div class="hero-art" role="img" aria-label="Your operator"></div>' +
      '<div class="hero-weapon" title="' + esc(weaponStatsLine(nodeRaidWeaponId())) + '"><i aria-hidden="true">' + itemIcon(nodeRaidWeaponId()) + '</i>' + esc(ITEMS[nodeRaidWeaponId()].name) + (ITEMS[nodeRaidWeaponId()].free ? ' <small>FREE</small>' : '') + '</div>' + operatorRowHtml(gear) + '</div>' +
    '<div class="lobby-side right"><div class="lobby-bottom">' + areaPickerHtml() + progressionGoalHtml(true) +
      '<button type="button" class="playbtn node-raid-launch" onclick="A.deployNodeRaid()" aria-label="Deploy — Node Raid"><b>DEPLOY</b><small>NODE RAID</small></button></div></div>' +
    '</div>';
}
function loadoutSlotsHtml(locked){
  const p = session.prep;
  return '<div class="lslots">' + SLOT_DEFS.map(([key, slot, label, icon]) => {
    const id = p.loadout[key], it = id && ITEMS[id];
    const options = invIds().filter(x => ITEMS[x].slot === slot).length;
    void it; return slotTileHtml([key, slot, label, icon], locked);
    return '<button type="button" class="lslot' + (it ? ' filled' : '') + (locked ? ' locked' : '') + '" data-slot="' + key + '" ' +
      (locked ? 'disabled aria-disabled="true"' : 'onclick="A.pickSlot(\'' + key + '\')"') + ' aria-label="' + label + ': ' + (it ? esc(it.name) : 'empty') + '">' +
      '<i aria-hidden="true">' + (it ? itemIcon(id) : icon) + '</i><small>' + label + '</small><b>' + (it ? esc(it.name) : (options ? 'Empty' : 'None owned')) + '</b>' +
      (!locked && options ? '<span class="badge need">' + options + '</span>' : '') + '</button>';
  }).join('') + '</div>';
}
function operatorRowHtml(gear){
  const st = playerStats(gear), P = PROG.playerStats;
  const chip = (icon, label, val) => '<span class="ostat" data-stat="' + label.split(" ")[0].toLowerCase() + '" title="' + label + '"><i aria-hidden="true">' + icon + '</i><b>' + val + '</b><small>' + label + '</small></span>';
  return '<div class="card operator-stats compact tap" onclick="A.go(\'operator\')" role="button" aria-label="Open operator panel"><div class="ostats">' +
    chip(IC("stat-speed"), "Speed", st.speed.toFixed(1)) + chip(IC("stat-stealth"), "Stealth", Math.round(st.stealth*100) + "%") +
    chip(IC("stat-health"), "Health", Math.round(st.maxHealth)) + (st.shield ? chip(IC("stat-shield"), "Shield", Math.round(st.shield)) : "") + chip(IC("stat-dash"), "Dash", (st.dashCooldownMs/1000).toFixed(1) + "s") +
    chip(IC("stat-bag"), "Bag slots", raidBagCapacity(gear)) + '</div>' +
    '<div class="oskills">' + Object.keys(P.skills).map(id => '<span>' + esc(P.skills[id].name) + ' <b>L' + skillLevel(id) + '</b></span>').join('') +
    '<span>' + esc(ITEMS[nodeRaidWeaponId()].name) + ' ' + starsHtml(nodeRaidWeaponId()) + '</span></div></div>';
}
function gearRiskHtml(gear){
  const kit = nodeRaidKit();
  if(kit.medkit) gear = (gear || []).concat(Array(kit.medkit).fill(PROG.kitItem));
  const tool = nodeRaidTool();
  if(tool) gear = (gear || []).concat([tool.id]);
  // Tiles carry the amber dot; this line is the legend (full list stays available to screen readers).
  return gear && gear.length
    ? '<div class="riskbar" role="status"><span class="rdot" aria-hidden="true"></span> lost if you die<span class="sr-only"> · At risk: ' + gear.map(g => esc(ITEMS[g].name)).join(", ") + '</span></div>'
    : '<div class="riskbar safe" role="status">' + IC("check") + ' No gear at risk</div>';
}
function prepTargetHtml(miss){
  if(!miss) return '';
  return '<div class="ptarget"><i aria-hidden="true">' + itemIcon(miss.itemId) + '</i><span><small>NEXT TARGET</small><b>' + esc(ITEMS[miss.itemId].name) + ' ' + miss.have + '/' + miss.need + '</b></span></div>';
}
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
    '<button class="ghost" onclick="A.raidStep()">SKIP ' + IC("chevron-right") + '</button>';
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

  // PRB-9: haul is the visual hero (icon chips + one big number); the two choices sit side by side with a risk meter.
  const riskPct = Math.round(pushDeath * 100), riskBars = Math.max(1, Math.min(5, Math.ceil(pushDeath * 10)));
  html += '<div class="cp-wrap"><div class="cp-haul card"><div class="cp-haulhead"><span class="small">IN YOUR BAG · NOT SECURED</span><b class="cp-value">' + haulVal + '<small> + ' + rd.scrap + ' ' + IC("cur-scrap") + '</small></b></div><div class="cp-chips">' +
    (rd.haul.length ? rd.haul.map(id => { const fl = R.cfg.trackedItemId === id;
      return '<span class="cp-chip r-' + ITEMS[id].rarity + (fl ? ' tracked' : '') + '" title="' + esc(ITEMS[id].name) + '"><i aria-hidden="true">' + itemImg(id) + '</i>' + esc(ITEMS[id].name) + (fl ? ' ' + IC("track-on") : '') + '</span>'; }).join('') : '<span class="small">Empty so far</span>') +
    '</div></div>';
  html += '<div class="decision-actions cp-choices">' +
    '<button class="primary cp-extract" onclick="A.extractNow()"><b>EXTRACT</b><span>' + IC("lock") + ' Keep ' + haulVal + '</span></button>' +
    '<button class="ghost cp-push" onclick="A.pushDeeper()"><b>PUSH DEEPER ' + IC("chevron-right") + '</b><span class="cp-risk" aria-label="Risk ' + (bondLevel() >= 2 ? riskPct + '%' : dangerLabel) + '">' +
      IC("skull") + ' ' + IC("bar").repeat(riskBars) + '<i>' + IC("bar").repeat(5 - riskBars) + '</i>' + (bondLevel() >= 2 ? ' ' + riskPct + '%' : '') + '</span>' +
      '<span>+ more loot' + (stagesLeft > 0 ? ' · ' + stagesLeft + ' left' : '') + '</span>' +
      (deeperLabel ? '<span class="trackc">' + IC("track-on") + ' ' + esc(ITEMS[miss.itemId].name) + ' likelier</span>' : '') + '</button>' +
    '<div class="small cp-note">Die deeper, lose the bag.</div></div></div>';
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
      html += '<div class="card row' + '"' + '><span' + (flagged?' class="trackc"':'') + '>' + itemImg(id) + ' ' + (flagged?IC("track-on") + " ":"") + esc(ITEMS[id].name) + '</span>' +
        (flagged ? '<span class="trackc small">tracked</span>' : isPart ? '<span class="ok small">upgrade part</span>' : '') + '</div>';
    }
    html += '<div class="progressmoved"><b>PROGRESS MOVED</b><br>' + R.progress.map(esc).join("<br>") + '</div>';
    if(!R.doubled && retMode() === "full") html += '<button class="ad" onclick="A.adDouble()">' + IC("play") + ' WATCH AD — 2× HAUL</button>';
  } else {
    const saved = R.saved;
    html = '<div class="result-head">' + bitImg("bit-death", "bit-death") + '<h1 class="bad">KIA</h1></div><div class="sub">' + esc(ZONES[R.zone].name) + '</div><h2>Lost</h2>';
    const savedIds = [...saved.insured, saved.secure].filter(Boolean);
    for(const id of R.cfg.loadout){
      if(savedIds.includes(id)){ savedIds.splice(savedIds.indexOf(id),1); continue; }
      html += '<div class="card row"><span class="bad">' + itemImg(id) + ' ' + esc(ITEMS[id].name) + '</span><span class="small">lost</span></div>';
    }
    if(saved.insured.length || saved.secure || saved.bitRescue){
      html += '<h2>Recovered</h2>';
      saved.insured.forEach(id => html += '<div class="card row"><span class="ok">' + itemImg(id) + ' ' + esc(ITEMS[id].name) + '</span><span class="small ok">insurance · 0:30</span></div>');
      if(saved.secure) html += '<div class="card row"><span class="ok">' + itemImg(saved.secure) + ' ' + esc(ITEMS[saved.secure].name) + '</span><span class="small warn">secure slot</span></div>';
      if(saved.bitRescue) html += '<div class="card row"><span class="ok">' + itemImg(saved.bitRescue) + ' ' + esc(ITEMS[saved.bitRescue].name) + '</span><span class="small ok">BIT carried it home</span></div>';
    } else if(R.cfg.insuranceId === "none"){
      html += '<div class="card small warn">No insurance. Everything stayed on the surface.</div>';
    }
    html += '<div class="progressmoved"><b>PROGRESS MOVED — EVEN NOW</b><br>' + R.progress.map(esc).join("<br>") + '</div>';
    if(retMode() === "full"){
      if(!R.adRecovered) html += '<button class="ad" onclick="A.adRecover()">' + IC("play") + ' WATCH AD — RECOVER 1 ITEM</button>';
      if(!R.bagRestored) html += '<button class="ghost" onclick="A.restoreBag()">RESTORE BAG — ' + PROG.recovery.restoreBagSignals + ' SIGNALS (have ' + S.cur.signals + ')</button>';
    }
    if(!have(PROG.freeWeapon)) html += '<button class="ghost" onclick="A.cheapLoadout()">CHEAP RECOVERY LOADOUT — ' + PROG.recovery.cheapLoadoutScrap + ' SCRAP</button>';
  }
  // PRB-10/46 (owner 14 Oct): RETURN TO BASE is the pinned primary; the base itself shows what can be built.
  html += nextUpgradeHtml();
  html += '<div class="actionbar"><button class="primary" onclick="A.backToBase()">RETURN TO BASE</button></div>';
  $app().innerHTML = html;
};

// Operator panel (v1.41): level, speed bonus, three automatic skills and weapon mastery stars. Read-only, no menus to manage.
SCREENS.operator = function(){
  $app().setAttribute("class", "s-operator");
  const op = operatorLevel(), P = PROG.playerStats, bar = (v, max) => '<span class="pbar"><span style="width:' + Math.round(100 * Math.min(1, max ? v / max : 1)) + '%"></span></span>';
  const effect = id => id === "mobility" ? "+" + (P.skills.mobility.perLevel.speed * skillLevel(id)).toFixed(2) + " m/s" :
    id === "stealth" ? Math.round(P.skills.stealth.perLevel.stealth * skillLevel(id) * 100) + "% harder to spot" :
    id === "vitality" ? "+" + (P.skills.vitality.perLevel.maxHealth * skillLevel(id)) + " max HP" :
    id === "search" ? "−" + Math.round(-P.skills.search.perLevel.searchMult * skillLevel(id) * 100) + "% search time" : "−" + Math.round(craftDiscount() * 100) + "% Scrap";
  let html = '<h1>OPERATOR</h1><div class="opgrid">';
  html += '<div class="card opcard"><div class="ophead"><b class="opbig">' + op.level + '</b><span>LEVEL<br><small>' + (op.need ? op.into + ' / ' + op.need + ' XP' : 'MAX') + '</small></span></div>' +
    bar(op.into || 0, op.need) + '<div class="small ok">' + IC("stat-speed") + ' +' + Math.round(operatorSpeedBonus() * 100) + '% speed <span class="muted">(+' + Math.round(P.operatorSpeed.perLevel * 100) + '%/level, max ' + Math.round(P.operatorSpeed.cap * 100) + '%)</span></div></div>';
  html += '<div class="card"><h2>Skills <small class="muted">grow by playing</small></h2>' + Object.keys(P.skills).map(id => {
    const k = P.skills[id], l = skillLevel(id), nx = skillNextXp(id), prev = l ? k.xpPerLevel * l * (l + 1) / 2 : 0;
    return '<div class="skillrow"><i aria-hidden="true">' + IC(k.icon) + '</i><div><b>' + esc(k.name) + ' L' + l + '</b> <span class="ok small">' + effect(id) + '</span>' +
      (nx === null ? bar(1, 1) : bar(skillXp(id) - prev, nx - prev)) + '<small>' + esc(k.desc) + '</small></div></div>';
  }).join('') + '</div>';
  const weapons = D.items.filter(i => i.weapon && (i.free || have(i.id) > 0 || masteryKills(i.id) > 0));
  html += '<div class="card"><h2>Weapon mastery</h2>' + weapons.map(w => {
    const nx = masteryNext(w.id);
    return '<div class="kv"><span>' + itemIcon(w.id) + ' ' + esc(w.name) + '</span><span>' + starsHtml(w.id) + ' <small class="muted">' + (nx === null ? 'mastered' : masteryKills(w.id) + '/' + nx + ' kills') + '</small></span></div>';
  }).join('') + '<div class="small muted">Each star: faster reload and fire rate.</div></div>';
  html += '</div>';
  $app().innerHTML = html;
};

// Scavenger: Haggler (v1.95) discounts Trader prices — shared by the vendor screen and the actual purchase so the
// price shown and the price charged (and the afford check gating the button) can never drift apart.
function vendorPrice(s){ return Math.round(s.price * (1 - talentVal("scavHaggler"))); }
SCREENS.vendor = function(){
  const v = D.vendors[0];
  let html = '<h1>' + esc(v.name) + '</h1><div class="sub">' + esc(v.blurb) + '</div>';
  html += '<h2>Buy</h2>';
  for(const s of v.stock){
    if(!stockUnlocked(s)) continue;
    const price = vendorPrice(s), afford = S.cur.scrap >= price;
    html += '<div class="card row"><span>' + itemImg(s.itemId, "vrow-ic") + ' ' + esc(ITEMS[s.itemId].name) + '</span>' +
      '<button class="ghost" style="width:auto;margin:0;padding:6px 12px;' + (afford?'':'opacity:.4') + '" ' +
      (afford?'onclick="A.buy(\'' + s.itemId + '\')"':'disabled') + '>' + price + ' Scrap</button></div>';
  }
  html += '<h2>Data Cores</h2>';
  for(const x of (v.exchange || [])){
    const [gc, gq] = Object.entries(x.give)[0], [rc, rq] = Object.entries(x.receive)[0], can = (S.cur[gc] || 0) >= gq;
    html += '<div class="card row"><span>' + rq + ' ' + CUR_LABELS[rc] + '</span><button class="ghost" style="width:auto;margin:0;padding:6px 12px;' + (can ? '' : 'opacity:.4') + '" ' + (can ? 'onclick="A.exchange(\'' + x.id + '\')"' : 'disabled') + '>' + gq + ' ' + CUR_LABELS[gc] + '</button></div>';
  }
  html += '<h2>Barter</h2>';
  v.barter.forEach((b,ix) => {
    const can = Object.keys(b.give).every(id => have(id) >= b.give[id]);
    const giveTxt = Object.keys(b.give).map(id => itemImg(id, "vrow-ic") + ' ' + b.give[id] + "× " + esc(ITEMS[id].name)).join(" + ");
    html += '<div class="card row"><span class="small">' + giveTxt + ' ' + IC("arrow-right") + '<br><b>' + itemImg(b.receive.itemId, "vrow-ic") + ' ' + b.receive.qty + '× ' + esc(ITEMS[b.receive.itemId].name) + '</b></span>' +
      '<button class="ghost" style="width:auto;margin:0;padding:6px 12px;' + (can?'':'opacity:.4') + '" ' +
      (can?'onclick="A.barter(' + ix + ')"':'disabled') + '>Trade</button></div>';
  });
  if((S.modules.fabricator||0) >= 1){
    html += '<h2>Crafting — Fabricator L' + S.modules.fabricator + '</h2>';
    for(const r of D.recipes){
      const gated = r.fabricatorLevel > (S.modules.fabricator||0);
      const parts = Object.keys(r.inputs).map(id => itemImg(id, "vrow-ic") + ' ' + Math.min(have(id),r.inputs[id]) + "/" + r.inputs[id] + " " + esc(ITEMS[id].name)).join(" · ");
      const can = !gated && S.cur.scrap >= craftCost(r) && Object.keys(r.inputs).every(id => have(id) >= r.inputs[id]);
      html += '<div class="card ' + (gated?'locked':'') + '"><div class="row"><b>' + (r.output.itemId ? itemImg(r.output.itemId, "vrow-ic") + ' ' : '') + esc(r.name) + '</b>' +
        (gated ? '<span class="small warn">Fab L' + r.fabricatorLevel + '</span>'
               : '<button class="ghost" style="width:auto;margin:0;padding:6px 12px;' + (can?'':'opacity:.4') + '" ' + (can?'onclick="A.craft(\'' + r.id + '\')"':'disabled') + '>Craft (' + craftCost(r) + ' Scrap)</button>') +
        '</div><div class="small">' + parts + '</div></div>';
    }
  } else {
    html += '<div class="card small">Crafting requires the Fabricator.</div>';
  }
  $app().innerHTML = html;
};

SCREENS.dev = function(){
  let html = ''+
    '<h1>Dev Panel</h1><div class="sub">beat: ' + curBeat().id + ' · raids: ' + S.raids + ' · deaths: ' + S.deaths + '</div>';
  html += '<div class="devgrid">' +
    '<button onclick="A.devForce(\'extract\')">Force next: SUCCESS</button>' +
    '<button onclick="A.devForce(\'death\')">Force next: FAILURE</button>' +
    '<button onclick="A.devCur()">+100 all currencies</button>' +
    '<button onclick="A.devBond()">+1 BIT Bond level</button>' +
    '<button onclick="A.devChips()">+20 Chips, 2 Drives, 2 Relics</button>' +
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
        '<div class="surveyopts">' + q.opts.map(o => '<button class="ghost" onclick="A.survey(\'' + q.id + '\',\'' + o.replace(/'/g,"") + '\')">' + esc(o) + '</button>').join("") + '</div>';
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
    '<div class="actionbar"><button class="ghost" onclick="A.devExport()">Export event log</button>' +
    '<button class="ghost" onclick="A.go(\'base\')">Keep playing anyway</button>' +
    '<button class="primary" onclick="A.devReset()">RESET &amp; PLAY AGAIN</button></div>';
  $app().innerHTML = html;
};

// Fold the current stage's loot/salvage into the accumulated (unsecured) haul.
function revealStage(){
  const rd = session.raid, st = rd.plan.stages[rd.stage];
  rd.haul.push(...st.loot);
  rd.scrap += st.scrap;
  rd.dataCores += st.dataCores;
}
// End a staged raid: write the accumulated haul onto R, set outcome, then resolve.
function finalizeStaged(outcome){
  const rd = session.raid, R = session.pendingRaid;
  R.outcome = outcome;
  R.loot = rd.haul.slice();
  R.scrap = rd.scrap;
  R.dataCores = rd.dataCores;
  R.trackedFound = !!R.cfg.trackedItemId && R.loot.includes(R.cfg.trackedItemId);
  if(outcome === "death") R.pushedAndDied = true;
  session.raid = null;
  finishRaid();
}
/* ---------- core (Node Raid) integration: RaidResult v1 ----------
   nodspel/raid-result.js writes the result; meta ingests it once (by raidId).
   See docs/meta-core-integration.md. */
const RAID_RESULT_KEY = "pr_raid_result_v1";
function validRaidResult(r){
  return !!r && r.schema === "protocol-rebirth/raid-result" && r.version === 1 &&
    typeof r.raidId === "string" && r.raidId.length > 0 && ["extract","death","timeout"].includes(r.outcome) &&
    Array.isArray(r.extracted) && r.extracted.every(id => typeof id === "string" && !!ITEMS[id]) &&
    Array.isArray(r.lost) && r.lost.every(id => typeof id === "string");
}
function coreRaidXp(r){
  const X = D.bit.coreRaidXp, n = v => Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  return n(r.nodesLit)*X.perNode + n(r.enemiesDefeated)*X.perEnemy + n(r.levelsCleared)*X.perLevelCleared +
    (r.outcome === "extract" ? X.extractBonus : 0);
}
function extractScrapBonus(levelsCleared){
  const B = PROG.extractScrapBonus || [], n = Math.max(0, Math.min(B.length, Math.floor(Number(levelsCleared) || 0)));
  return B.slice(0, n).reduce((a, b) => a + b, 0);
}
// v1.64 "Used for": every upgrade and recipe that really consumes the item (DATA.itemInfo is the single source of truth).
function usedForHtml(id){
  const info = D.itemInfo(id);
  if(!info || info.item.grantsCurrency || info.item.scouts) return "";
  const it = info.item, gear = it.slot || it.weapon || it.tool || (it.uses || []).includes("loadout") || /^tool_/.test(id);
  const parts = info.uses.map(u => esc(u.label));
  if(gear) parts.unshift("Raid loadout (equip in Raid Prep)");
  const list = parts.length ? parts.join(", ") : "nothing at the base yet. Sell it or keep it for a quest.";
  return '<div class="card small usedfor"><b>Used for:</b> ' + list + '</div>';
}
function isInfoItem(id){ const it = ITEMS[id]; return !!it && !it.grantsCurrency && !it.scouts && !isFree(id); }
// First time an item type comes home: one info card (shared popup) at the base, never mid-raid. Old saves seed
// "seen" from the stash so returning players are not flooded; the FTUE keeps its own scripted cards.
function markSeenItems(ids){
  if(!S.seenItems){ S.seenItems = {}; [...Object.keys(S.stash || {}), ...Object.keys(S.armory || {})].forEach(k => S.seenItems[k] = 1); }
  const fresh = [];
  ids.forEach(id => { if(isInfoItem(id) && !S.seenItems[id]){ S.seenItems[id] = 1; fresh.push(id); } });
  if(fresh.length && ftueOver()){ S.itemInfoQueue = (S.itemInfoQueue || []).concat(fresh).slice(-6); }
  return fresh;
}
function maybeShowItemInfo(){
  if(typeof document === "undefined" || !S.itemInfoQueue || !S.itemInfoQueue.length || document.getElementById("overlay") || session.screen !== "base") return;
  const ids = S.itemInfoQueue.splice(0, 3).filter(id => ITEMS[id]);
  if(!ids.length) return;
  save();
  overlay('<h1>New find' + (ids.length > 1 ? 's' : '') + '</h1>' + ids.map(id => { const info = D.itemInfo(id), it = info.item;
    return '<div class="card small infocard"><div class="ic-head"><span class="sicon" aria-hidden="true">' + itemImg(id) + '</span><b>' + esc(it.name) + '</b> <span class="rar-' + it.rarity + '">' + esc(it.rarity) + '</span></div>' +
      usedForHtml(id).replace('card small usedfor', 'usedfor') +
      '<div class="small">Sell ' + info.sell + ' Scrap' + (info.recycle ? ' · Recycle ' + info.recycle + ' Scrap' : '') + '</div></div>'; }).join('') +
    '<button class="primary" data-close>GOT IT</button>', () => setTimeout(() => { maybeShowItemInfo(); maybeShowHandIn(); }, 0));
}
function ingestRaidResult(r){
  if(!validRaidResult(r)) return { ok:false, reason:"invalid" };
  S.coreRaidsIngested = S.coreRaidsIngested || [];
  if(S.coreRaidsIngested.includes(r.raidId)) return { ok:false, reason:"duplicate" };
  S.coreRaidsIngested.push(r.raidId);
  if(S.coreRaidsIngested.length > 50) S.coreRaidsIngested.shift();
  // Owner rule: only Extract secures loot; death/timeout/abandon lose everything collected.
  // Only items come home (no formula salvage/dataCores).
  const extracted = r.outcome === "extract";
  const added = extracted ? r.extracted.slice() : [];
  if(extracted) markSeenItems(added);
  const currency = {};
  // Currency-sourcing loot (salvage_crate, data_core) converts on the way in; everything else goes to the stash.
  added.forEach(id => {
    if(ITEMS[id].scouts) return; // scouting items are consumed by the world map
    const g = ITEMS[id].grantsCurrency;
    if(!g){ addItem(id, 1, true); return; }
    for(const c in g){ S.cur[c] = (S.cur[c]||0) + g[c]; currency[c] = (currency[c]||0) + g[c]; revealCurrency(c); }
  });
  // v1.64: fixed Scrap bonus per cleared level, paid on extract only (death/timeout = 0, like all raid loot).
  const scrapBonus = extracted ? extractScrapBonus(r.levelsCleared) : 0;
  if(scrapBonus){ S.cur.scrap = (S.cur.scrap||0) + scrapBonus; revealCurrency("scrap"); }
  S.raids++;
  const questsDone = questProgress(r), chainsDone = chainProgress(r);
  const saved = { insured:[], secure:null, bitRescue:null };
  if(!extracted){
    // Timeout and abandon arrive as "death": same consequences as a simulated death.
    // Node Raid deploys with no meta loadout yet, so insurance/secure item have nothing to recover.
    S.deaths++;
    if(bondLevel() >= 3 && r.lost.length && ITEMS[r.lost[0]]){ saved.bitRescue = r.lost[0]; addItem(r.lost[0], 1); }
    // Guardian capstone (fallback per docs/design-bit-skill-tree.md): saves ONE pre-chosen material, if found this raid.
    if(talentLearned("guardian_safe_return") && S.guardianMaterial && r.lost.includes(S.guardianMaterial) && saved.bitRescue !== S.guardianMaterial){
      saved.talentMaterial = S.guardianMaterial; addItem(S.guardianMaterial, 1);
    }
  }
  // Gear taken on this raid: returns on extract; otherwise lost (secure item still survives, as for simulated deaths).
  const launch = S.coreLaunch && S.coreLaunch.raidId === r.raidId ? S.coreLaunch : null;
  const gear = launch ? launch.gear.filter(id => ITEMS[id]) : [];
  // v1.59: the core reports what is equipped at the end (gearOut). Gear found in the raid goes straight to the
  // character slots there; on extract everything equipped comes home, gear swapped out in the raid stays behind.
  const gearOut = Array.isArray(r.gearOut) ? r.gearOut.filter(id => typeof id === "string" && ITEMS[id] && ["weapon","armor"].includes(ITEMS[id].slot) && !ITEMS[id].free).slice(0, 2) : null;
  const gearFound = [], swappedOut = [];
  if(extracted && gearOut){
    swappedOut.push(...gear);
    gearOut.forEach(id => { addItem(id, 1); const i = swappedOut.indexOf(id); if(i >= 0) swappedOut.splice(i, 1); else gearFound.push(id); });
  } else if(extracted) gear.forEach(id => addItem(id, 1));
  // Newly found equipment is found-in-raid; gear that went in and came back out is not.
  gearFound.forEach(id => { S.fir = S.fir || {}; S.fir[id] = Math.min((S.fir[id] || 0) + 1, qty(id)); });
  // Unused medkits come home on extract; used or lost ones are gone.
  const kitOut = launch && launch.kit ? Math.max(0, launch.kit.medkit || 0) : 0;
  // v1.46: kits picked up in the raid go to the kit slot too, so up to PROG.kitMax can come home (death loses them).
  const kitBack = extracted ? Math.min(PROG.kitMax, Math.max(0, Math.floor(Number(r.kitLeft && r.kitLeft.medkit) || 0))) : 0;
  // The tool slot works like the kit: unused charges come home on extract (never more than were taken in), death loses them.
  const toolOut = launch && launch.tool && ITEMS[launch.tool.id] ? launch.tool : null;
  const toolBack = extracted && toolOut && r.toolLeft && r.toolLeft.id === toolOut.id ? Math.min(toolOut.n, Math.max(0, Math.floor(Number(r.toolLeft.n) || 0))) : 0;
  if(toolBack) addItem(toolOut.id, toolBack);
  if(kitBack){ addItem(PROG.kitItem, kitBack, false);
    // Only kits beyond the ones taken in were found in the raid.
    if(kitBack > kitOut){ S.fir = S.fir || {}; S.fir[PROG.kitItem] = Math.min((S.fir[PROG.kitItem] || 0) + kitBack - kitOut, qty(PROG.kitItem)); } }
  else if(S.secureItem && gear.includes(S.secureItem)){ saved.secure = S.secureItem; addItem(S.secureItem, 1); }
  if(launch) S.coreLaunch = null;
  const gearLost = extracted ? swappedOut : gear.filter(id => id !== saved.secure);
  gearLost.forEach(loseBuilt);
  gearFound.forEach(id => added.push(id));
  // Skills grow by use on every outcome.
  S.skills = S.skills || {};
  const before = {}, sx = skillXpFrom(r), skillUps = [];
  for(const id in sx){ before[id] = skillLevel(id); S.skills[id] = (S.skills[id] || 0) + sx[id]; if(skillLevel(id) > before[id]) skillUps.push(PROG.playerStats.skills[id].name + " L" + skillLevel(id)); }
  // Weapon mastery: kills count for the weapon that went in (any outcome).
  const wid = typeof r.weapon === "string" && ITEMS[r.weapon] && ITEMS[r.weapon].weapon ? r.weapon : null, kills = Math.max(0, Math.min(200, Math.floor(Number(r.enemiesDefeated) || 0)));
  let starUp = null;
  if(wid && kills){ S.mastery = S.mastery || {}; const b = masteryStars(wid); S.mastery[wid] = masteryKills(wid) + kills; if(masteryStars(wid) > b) starUp = ITEMS[wid].name + " " + masteryStars(wid) + "/3 stars"; }
  const xp = bitOnline() ? coreRaidXp(r) : 0;
  S.bondXp += xp;
  gainOpXp(Math.max(PROG.operator.coreMinXp, coreRaidXp(r)));
  if(extracted && curBeat().type === "raid") advanceBeat();
  act("CORE_RAID_INGESTED", { raidId:r.raidId, outcome:r.outcome, reason:r.reason || null, extracted:r.extracted, lost:r.lost, xp, saved });
  const powerDrain = drainPowerRaid();
  const areaNotes = applyAreaProgress(AREA_DEFS[r.area] ? r.area : (launch && launch.area) || WMAP.areas[0].id, r.levelsCleared, added);
  if(powerDrain) areaNotes.push("Bunker power -" + powerDrain);
  if(questsDone.length) areaNotes.push("BIT quest done: " + questsDone.map(q => questTitle(q)).join(", ") + " (claim in the BIT tab)");
  if(chainsDone.length) areaNotes.push("Quest ready to hand in: " + chainsDone.map(c => c.title).join(", "));
  return { ok:true, added, currency, scrapBonus, xp, saved, gearLost, skillUps, starUp, kitBack, kitLost:Math.max(0, kitOut - kitBack), toolBack, toolLost:Math.max(0, (toolOut ? toolOut.n : 0) - toolBack), areaNotes, chainsDone };
}
function coreLaunchUrl(raidId, seed, returnPath, opts){
  opts = opts || {};
  return "./nodspel/?seed=" + encodeURIComponent(seed) + "&raidId=" + encodeURIComponent(raidId) +
    "&return=" + encodeURIComponent(returnPath) +
    (opts.stats ? "&stats=" + encodeURIComponent(statsParam(opts.stats)) : "") +
    (opts.gear && opts.gear.length ? "&gear=" + encodeURIComponent(opts.gear.join(",")) : "") +
    (opts.weapon ? "&w=" + encodeURIComponent(weaponParam(opts.weapon)) : "") +
    (opts.bag ? "&bag=" + encodeURIComponent(opts.bag) : "") +
    (opts.kit && opts.kit.medkit ? "&kit=" + encodeURIComponent("medkit:" + opts.kit.medkit) : "") +
    (opts.tool ? "&tool=" + encodeURIComponent(opts.tool.id + ":" + opts.tool.n) : "") +
    (opts.area ? "&area=" + encodeURIComponent(opts.area) : "") + (opts.hard ? "&hard=1" : "") +
    (opts.quest ? "&quest=" + encodeURIComponent(opts.quest) : "") +
    (opts.payoff ? "&payoff=" + encodeURIComponent(opts.payoff) : "") +
    (opts.goal ? "&goal=" + encodeURIComponent(JSON.stringify(opts.goal)) : "") + (opts.intro ? "&intro=1" : "");
}
/* ---------- player stats & skills (data/progression.js -> playerStats) ---------- */
function skillXp(id){ return (S.skills && S.skills[id]) || 0; }
// Cumulative xp for level n = xpPerLevel × n(n+1)/2 (each level costs a bit more).
function skillLevel(id, xp){
  const k = PROG.playerStats.skills[id]; xp = xp === undefined ? skillXp(id) : xp;
  let lvl = 0; while(lvl < k.maxLevel && xp >= k.xpPerLevel * (lvl + 1) * (lvl + 2) / 2) lvl++;
  return lvl;
}
function skillNextXp(id){ const k = PROG.playerStats.skills[id], l = skillLevel(id); return l >= k.maxLevel ? null : k.xpPerLevel * (l + 1) * (l + 2) / 2; }
function clampStat(id, v){ const c = PROG.playerStats.clamp[id]; return Math.min(c[1], Math.max(c[0], v)); }
function playerStats(gear){
  const P = PROG.playerStats, st = Object.assign({}, P.base);
  for(const id in P.skills){ const l = skillLevel(id); for(const s in P.skills[id].perLevel) st[s] += P.skills[id].perLevel[s] * l; }
  st.speed *= 1 + operatorSpeedBonus();
  for(const g of (gear || [])){
    for(const s in ((ITEMS[g] && ITEMS[g].stats) || {})) st[s] += ITEMS[g].stats[s];
    if(gearKind(g) === "armor") st.shield += gearEffect(g).shield - ((ITEMS[g].stats || {}).shield || 0);
  }
  for(const s in st) st[s] = Math.round(clampStat(s, st[s]) * 1000) / 1000;
  return st;
}
// +2% speed per operator level above 1, capped (data/progression.js -> operatorSpeed).
function operatorSpeedBonus(level){
  const O = PROG.playerStats.operatorSpeed; level = level === undefined ? operatorLevel().level : level;
  return Math.min(O.cap, O.perLevel * Math.max(0, level - 1));
}
// Crafting skill: fewer Scrap per recipe (rounded, never below 0).
function craftDiscount(){ const k = PROG.playerStats.skills.crafting; return k.craftDiscountPerLevel * skillLevel("crafting"); }
function craftCost(r){ return Math.max(0, Math.round(r.scrapCost * (1 - craftDiscount()))); }
function gainSkillXp(id, n){ S.skills = S.skills || {}; const b = skillLevel(id); S.skills[id] = (S.skills[id] || 0) + n; return skillLevel(id) > b; }
// Weapon mastery: kills per weapon -> 0..3 stars.
function masteryKills(id){ return (S.mastery && S.mastery[id]) || 0; }
function masteryStars(id, kills){
  kills = kills === undefined ? masteryKills(id) : kills;
  return PROG.playerStats.weaponMastery.killsForStar.filter(k => kills >= k).length;
}
function masteryNext(id){ const t = PROG.playerStats.weaponMastery.killsForStar; return t[masteryStars(id)] ?? null; }
function starsHtml(id){ const n = masteryStars(id); return '<span class="stars" aria-label="' + n + ' of 3 mastery stars">' + IC("star").repeat(n) + '<i>' + IC("star").repeat(3 - n) + '</i></span>'; }
// Node Raid bag capacity: base + built modules + armour pockets (data/progression.js -> raidBag, items.bagSlots).
function raidBagCapacity(gear){
  const B = PROG.raidBag; let n = B.base;
  for(const m in B.moduleLevels) B.moduleLevels[m].forEach((v, i) => { if((S.modules[m] || 0) >= i + 1) n += v; });
  const ol = operatorLevel().level; for(const l in B.operatorLevels) if(ol >= +l) n += B.operatorLevels[l];
  for(const g of (gear || [])) n += (ITEMS[g] && ITEMS[g].bagSlots) || 0;
  return Math.min(B.max, n);
}
function statsParam(st){ return "spd:" + st.speed + ",stl:" + st.stealth + ",hp:" + Math.round(st.maxHealth) + ",dcd:" + Math.round(st.dashCooldownMs) + ",srch:" + st.searchMult + ",shd:" + Math.round(st.shield); }
const FREE_WEAPON = PROG.freeWeapon;
// Gear at risk in a Node Raid: armour + any non-free weapon (Basic is free and never lost).
function nodeRaidGear(){
  const l = session.prep && session.prep.loadout; if(!l) return [];
  const out = [];
  if(l.weapon && ITEMS[l.weapon] && ITEMS[l.weapon].slot === "weapon" && !ITEMS[l.weapon].free && have(l.weapon) > 0) out.push(l.weapon);
  if(l.armor && have(l.armor) > 0 && ITEMS[l.armor].slot === "armor") out.push(l.armor);
  return out;
}
function nodeRaidWeaponId(){
  const l = session.prep && session.prep.loadout, w = l && l.weapon;
  return w && ITEMS[w] && ITEMS[w].weapon && (ITEMS[w].free || have(w) > 0) ? w : FREE_WEAPON;
}
// Medkits in the consumable slots go into the raid (usable with Q / kit button) and are lost on death.
function nodeRaidKit(){
  const l = session.prep && session.prep.loadout; if(!l) return { medkit:0 };
  const want = ["c1","c2"].filter(k => l[k] === PROG.kitItem).length;
  return { medkit:Math.min(want, have(PROG.kitItem)) };
}
// The one tool in the tool slot (stash count = charges): taken at deploy, returned on extract, lost on death.
function nodeRaidTool(){
  const l = session.prep && session.prep.loadout, id = l && l.tool, it = id && ITEMS[id];
  if(!it || it.slot !== "tool" || !it.tool || have(id) < 1) return null;
  return { id, n:Math.min(have(id), it.tool.charges) };
}
// One-time first-upgrade payoff (PROG.firstUpgradePayoff): consumed by the first unguided raid deploy after the upgrade.
// free_tool waits (stays pending) while the player carries their own tool. Returns {kind, freeTool} or null.
function takeFirstPayoff(hasTool){
  const key = S.payoff && S.payoff.pending, cfg = key && PROG.firstUpgradePayoff[key];
  if(S.payoffDone || !cfg || (cfg.kind === "free_tool" && (hasTool || !ITEMS[cfg.tool]))) return null;
  S.payoff = null; S.payoffDone = true;
  act("PAYOFF_USED", { upgrade:key, kind:cfg.kind });
  return { kind:cfg.kind, freeTool:cfg.kind === "free_tool" ? { id:cfg.tool, n:cfg.charges || 1 } : null };
}
function weaponParam(id){
  const w = masteredWeapon(id); if(!w) return "";
  return "id:" + id + ["dmg","mag","rld","int","rng","cone","ast","spr","kb","pel","hom"].filter(k => w[k] !== undefined).map(k => "," + k + ":" + w[k]).join("");
}
// Weapon stats after mastery stars (each star trims reload / shot interval a little).
function masteredWeapon(id, lvl){
  const w = ITEMS[id] && ITEMS[id].weapon; if(!w) return null;
  const out = Object.assign({}, w), st = masteryStars(id), per = PROG.playerStats.weaponMastery.perStar, up = gearEffect(id, lvl);
  for(const k in per) if(k in out) out[k] = Math.round(out[k] * (1 + per[k] * st));
  out.int = Math.round(out.int * (1 + up.intMul)); out.dmg += up.dmg;
  // v1.91: Mk tier (+1 DMG per tier above I) and fitted attachments (Barrel +RANGE, Mag +MAG, Optic +DMG).
  out.dmg += (gearTier(id) - 1) * PROG.gearMerge.dmgPerTier;
  const at = attachOf(id), AE = PROG.gearMerge.attach;
  if(at.barrel) out.rng += AE.barrel.rng;
  if(at.mag) out.mag += Math.ceil(out.mag * AE.mag.magPct);
  if(at.optic) out.dmg += AE.optic.dmg;
  return out;
}
// ---- gear upgrades (v1.83 T4, data: PROG.gearUpgrade) ----
// Basic Carbine: free forever, so it only gets 2 light rate-only levels (no materials beyond the cheap tier-1 ones) and its mastery stars
// are shown in the same popup. Levels are keyed by item id, so a lost and re-crafted copy keeps its upgrades.
function gearKind(id){ const it = ITEMS[id]; return !it ? null : it.weapon ? "weapon" : it.slot === "armor" ? "armor" : null; }
function gearLevel(id){ return Math.min(gearMax(id), (S.gearUp && S.gearUp[id]) || 0); }
function gearMax(id){ const G = PROG.gearUpgrade; return gearKind(id) ? ((G.byId[id] && G.byId[id].maxLevel) || G.maxLevel) + gearTier(id) - 1 : 0; }
// ---- v1.91 merge tiers (docs/design-armory.md b): 3 copies of the same gun / armor -> the next Mk. No fodder currency, no shards. ----
// Tier is keyed by item id like upgrade levels (a lost and re-found copy keeps it). Merge resets the level to 0, raises the max by 1.
function gearTier(id){ return Math.max(1, Math.min(3, (S.gearTier && S.gearTier[id]) || 1)); }
function attachOf(id){ return (S.attach && S.attach[id]) || {}; }
const WART = PROG.weaponArt;
function weaponGrade(id){ const t = gearTier(id), at = attachOf(id); return t >= 3 && Object.keys(ATT_ITEM).every(k => at[k]) ? 4 : t; }
function gradeName(id){ return WART.grades[weaponGrade(id) - 1]; }
function tierLabel(id){ return "MK " + TIER_NAMES[gearTier(id) - 1] + (ITEMS[id] && ITEMS[id].art ? " · " + gradeName(id).toUpperCase() : ""); }
function weaponArtSrc(id, w){ const it = ITEMS[id], set = it && it.art && WART.sets[it.art]; if(!set) return ""; return "assets/weapons/" + it.art + "-" + set.files[weaponGrade(id) - 1] + "-" + w; }
function weaponArtImg(id, w, cls){ const b = weaponArtSrc(id, w); if(!b) return ""; return '<img class="' + cls + '" src="' + b + '.webp" alt="" draggable="false" onerror="this.onerror=null;this.src=this.src.replace(/webp$/,\'png\')">'; }
let LAST_ART = null;
const ART_PRELOADED = {};
function preloadWeaponArt(id){ const b = weaponArtSrc(id, 1600); if(!b || ART_PRELOADED[b] || typeof Image === "undefined") return; ART_PRELOADED[b] = 1; const im = new Image(); im.src = b + ".webp"; }
function drawLeaders(){
  const scr = document.querySelector(".wpnscreen"), img = scr && scr.querySelector(".wpn-hero img.cur"), host = scr && scr.querySelector(".wpn-l");
  if(!img || !host || !img.getBoundingClientRect) return;
  const set = WART.sets[ITEMS[scr.dataset.gear].art], H = host.getBoundingClientRect(), I = img.getBoundingClientRect();
  if(!set || !I.width) return;
  let svg = host.querySelector("svg.wlead"); if(!svg){ svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "wlead"); svg.setAttribute("aria-hidden", "true"); host.appendChild(svg); }
  svg.setAttribute("viewBox", "0 0 " + Math.round(H.width) + " " + Math.round(H.height));
  svg.innerHTML = Object.keys(set.anchors).map(k => {
    const box = host.querySelector('.wslot[data-slot="' + k + '"]'); if(!box) return "";
    const B = box.getBoundingClientRect(), a = set.anchors[k], x1 = I.left - H.left + a[0] * I.width, y1 = I.top - H.top + a[1] * I.height, x2 = B.left - H.left + B.width / 2, y2 = B.top - H.top;
    return '<path class="' + (box.classList.contains("fitted") ? "on" : "") + '" d="M' + x1.toFixed(1) + " " + y1.toFixed(1) + " L" + x2.toFixed(1) + " " + (y2 - 10).toFixed(1) + " L" + x2.toFixed(1) + " " + y2.toFixed(1) + '"/><circle cx="' + x1.toFixed(1) + '" cy="' + y1.toFixed(1) + '" r="3"/>';
  }).join("");
}
if(typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", () => drawLeaders());
const TIER_NAMES = ["I","II","III"], RARITY_UP = ["common","uncommon","rare","epic","legendary"];
function tierRarity(id){ const r = ITEMS[id].rarity, i = RARITY_UP.indexOf(r); return i < 0 ? r : RARITY_UP[Math.min(RARITY_UP.length - 1, i + gearTier(id) - 1)]; }
function mergeNeed(id){ const c = PROG.gearMerge.copies; return Array.isArray(c) ? c[Math.min(c.length, gearTier(id)) - 1] : c; }
function rebuildCost(id){ return PROG.gearMerge.freeRebuildScrap[Math.min(1, gearTier(id) - 1)]; }
function mergeBlock(id){
  if(!gearKind(id)) return "Can't merge";
  if(gearTier(id) >= 3) return "Max tier";
  if(isFree(id)){
    if(gearLevel(id) < gearMax(id)) return "Max level L" + gearMax(id) + " first";
    return S.cur.scrap >= rebuildCost(id) ? "" : "Need " + rebuildCost(id) + " Scrap";
  }
  const n = have(id), need = mergeNeed(id);
  return n >= need ? "" : (need - n) + " more " + ITEMS[id].name + " to merge";
}
function gearMerge(id){
  if(mergeBlock(id)) return false;
  const from = gearTier(id), to = from + 1;
  if(isFree(id)) S.cur.scrap -= rebuildCost(id); // Basic Carbine: rebuilt with Scrap, never merged
  else removeItem(id, mergeNeed(id) - 1); // the built copy + plain copies become 1 (Mk II: 3 in total, Mk III: 9 in total)
  S.gearTier = S.gearTier || {}; S.gearTier[id] = to; S.gearUp = S.gearUp || {}; S.gearUp[id] = 0;
  act("GEAR_MERGED", { id, from, to });
  return true;
}
// Attachments: crafted at the Fabricator (armory items att_*), fitted from the weapon screen. Bound to the gun for good, kept on merge.
const ATT_ITEM = PROG.gearMerge.attachItem;
function attachBlock(id, slot){
  if(gearKind(id) !== "weapon") return "Guns only";
  const need = WPN_SLOTS.find(x => x[0] === slot)[3];
  if(gearTier(id) < need) return "Unlocks at Mk " + TIER_NAMES[need - 1];
  if(attachOf(id)[slot]) return "Fitted";
  return have(ATT_ITEM[slot]) > 0 ? "" : "Craft a " + ITEMS[ATT_ITEM[slot]].name + " at the Fabricator";
}
function fitAttachment(id, slot){
  if(attachBlock(id, slot)) return false;
  removeItem(ATT_ITEM[slot], 1); S.attach = S.attach || {}; S.attach[id] = Object.assign({}, attachOf(id), { [slot]:1 });
  act("ATTACHMENT_FITTED", { id, slot });
  return true;
}
// Effect of an upgrade level (default: the item's current level): damage bonus, shot-interval multiplier delta, total shield.
function gearEffect(id, lvl){
  const G = PROG.gearUpgrade, kind = gearKind(id); lvl = lvl === undefined ? gearLevel(id) : lvl;
  if(kind === "weapon"){ const d = (G.byId[id] && G.byId[id].dmgAt) || G.weapon.dmgAt; return { dmg:lvl < d.length ? (d[lvl] || 0) : d[d.length - 1] + (lvl - d.length + 1), intMul:G.weapon.intPerLevel * lvl, shield:0 }; }
  if(kind === "armor") return { dmg:0, intMul:0, shield:((ITEMS[id].stats || {}).shield || 0) + G.armor.shieldPerLevel * lvl + PROG.gearMerge.shieldPerTier * (gearTier(id) - 1) };
  return { dmg:0, intMul:0, shield:0 };
}
function gearCost(id, lvl){
  const G = PROG.gearUpgrade, kind = gearKind(id);
  const L = G.items[kind]; // levels beyond 3 (Mk II/III) reuse the top level's materials
  return { scrap:G.scrapByRarity[ITEMS[id].rarity] * lvl, items:Object.assign({}, L[Math.min(lvl, L.length) - 1]) };
}
// "" = can upgrade now, else a short reason.
function gearBlock(id){
  if(!gearKind(id)) return "Not upgradable";
  if(have(id) < 1) return "None left";
  const lvl = gearLevel(id); if(lvl >= gearMax(id)) return "Max level";
  const parts = costParts(gearCost(id, lvl + 1)), miss = parts.find(p => p.have < p.need);
  return miss ? "Need " + (miss.need - miss.have) + " more " + partName(miss) : "";
}
function gearUpgrade(id){
  if(gearBlock(id)) return false;
  const lvl = gearLevel(id) + 1, cost = gearCost(id, lvl);
  payCost(cost); S.gearUp = S.gearUp || {}; S.gearUp[id] = lvl;
  act("GEAR_UPGRADED", { id, level:lvl, scrap:cost.scrap, items:cost.items });
  return true;
}
// Effect tiles for the upgrade popup: current value plus the next level's change (when there is one).
function gearTilesHtml(id){
  const kind = gearKind(id), lvl = gearLevel(id), nxt = lvl < gearMax(id) ? lvl + 1 : null;
  const tile = (icon, label, val, nv) => '<div class="rtile gear" data-stat="' + label.toLowerCase().replace(/ /g, "") + '">' + IC(icon) + '<b>' + esc(String(val)) + '</b><small>' + esc(label) + '</small>' +
    (nv !== null && nv !== val ? '<em class="gu-next">' + esc(String(nv)) + ' next</em>' : '') + '</div>';
  if(kind === "armor"){ const a = gearEffect(id, lvl).shield, b = nxt ? gearEffect(id, nxt).shield : null; return '<div class="rtiles gu-tiles">' + tile("stat-shield", "SHIELD", a, b) + '</div>'; }
  const w = masteredWeapon(id), n = nxt ? masteredWeapon(id, nxt) : null, rate = x => Math.round(60000 / x.int);
  return '<div class="rtiles gu-tiles">' + tile("stat-dmg", "DAMAGE", w.dmg, n ? n.dmg : null) + tile("stat-rate", "FIRE RATE", rate(w) + "/min", n ? rate(n) + "/min" : null) + '</div>';
}
function gearPopHtml(id){
  if(gearKind(id) === "weapon") return weaponScreenHtml(id);
  const it = ITEMS[id], lvl = gearLevel(id), max = gearMax(id), why = gearBlock(id), nxt = lvl < max ? lvl + 1 : null;
  const head = '<div class="bpop-head"><span class="bicon" aria-hidden="true">' + itemImg(id) + '</span><h1>' + esc(it.name) + '</h1><em>' + (isFree(id) ? IC("infinity") : '×' + have(id)) + '</em></div>';
  const cost = nxt ? costParts(gearCost(id, nxt)).map(p => '<span class="gu-c' + (p.have < p.need ? ' bad' : '') + '">' + partIcon(p) + p.need + (p.kind === "item" ? ' ' + esc(ITEMS[p.id].name) : '') + '</span>').join("") : "";
  let mastery = "";
  if(isFree(id)){
    const nk = masteryNext(id), k = masteryKills(id);
    mastery = '<div class="gu-mastery">Mastery ' + starsHtml(id) + ' <span>' + (nk === null ? 'max' : (nk - k) + ' kills to next star') + '</span></div>';
  }
  return '<div class="bpop stashpop gearpop" data-gear="' + id + '">' + head + '<div class="sp-body"><div class="sp-l"><div class="sp-meta">' + esc(it.family) + ' · <span class="rar-' + it.rarity + '">' + esc(it.rarity) + '</span></div>' +
    '<div class="gu-lvl" aria-label="Upgrade level ' + lvl + ' of ' + max + '"><b>LEVEL ' + lvl + '/' + max + '</b><span class="gu-pips">' + Array.from({ length:max }, (_, i) => '<span class="gu-pip' + (i < lvl ? ' on' : '') + '"></span>').join("") + '</span></div>' +
    gearTilesHtml(id) + mastery + '</div><div class="sp-r">' +
    (nxt ? '<div class="gu-cost" aria-label="Cost">' + cost + '</div>' : '') +
    '<button class="primary big" onclick="A.gearUpgrade(\'' + id + '\')"' + (why ? ' disabled' : '') + '>' + (nxt ? 'UPGRADE TO L' + nxt : 'MAX LEVEL') + '</button>' +
    (why && nxt ? '<div class="sp-why">' + esc(why) + '</div>' : '') +
    (isFree(id) ? '' : '<button type="button" class="ghost merge"' + (mergeBlock(id) ? ' disabled' : ' onclick="A.gearMerge(\'' + id + '\')"') + '>MERGE ' + Math.min(have(id), 3) + '/3' + (gearTier(id) < 3 ? ' · MK ' + TIER_NAMES[gearTier(id)] : ' · MAX') + '</button>') +
    (isFree(id) ? '' : '<button type="button" class="linkbtn" onclick="A.stashSellView()">SELL OR RECYCLE</button>') + '</div></div></div>';
}
// ---- v1.90 fullscreen weapon screen (docs/design-armory.md c) ----
// Weapons get a full-screen bench: big art left, tier badge + level pips + 4 stat bars (current + ghost for the next level) right,
// 3 attachment slots under the art (shown now; crafting arrives with Mk tiers in v1.91), one big UPGRADE button. Armor keeps the popup.
const WPN_BARS = [["damage","DMG","stat-dmg",w => w.dmg],["firerate","RATE","stat-rate",w => Math.round(60000 / w.int)],["mag","MAG","item-ammo",w => w.mag],["range","RANGE","item-sensor",w => w.rng]];
const WPN_SLOTS = [["barrel","Barrel","+RANGE",1],["mag","Mag","+MAG",2],["optic","Optic","+DMG at range",3]];
function weaponTier(id){ return gearTier(id); }
function wpnBarMax(i){
  // scale against a fully built Mk III (all attachments) so bars still have room to grow
  let m = 1; const P = PROG.gearMerge, G = PROG.gearUpgrade;
  for(const it of D.items) if(it.weapon){ const w = Object.assign({}, it.weapon); w.dmg += (G.weapon.dmgAt[G.weapon.dmgAt.length - 1] + 2) + 2 * P.dmgPerTier + P.attach.optic.dmg; w.rng += P.attach.barrel.rng; w.mag += Math.ceil(w.mag * P.attach.mag.magPct); w.int = Math.round(w.int * (1 + G.weapon.intPerLevel * (G.maxLevel + 2))); m = Math.max(m, WPN_BARS[i][3](w)); }
  return m;
}
function wpnBarsHtml(id){
  const lvl = gearLevel(id), nxt = lvl < gearMax(id) ? lvl + 1 : null, w = masteredWeapon(id), n = nxt ? masteredWeapon(id, nxt) : null;
  return '<div class="wbars">' + WPN_BARS.map(([key, label, icon, f], i) => {
    const max = wpnBarMax(i), v = f(w), nv = n ? f(n) : v, pc = x => Math.max(4, Math.min(100, Math.round(x / max * 100)));
    return '<div class="wbar" data-stat="' + key + '">' + IC(icon) + '<small>' + label + '</small><span class="wtrack"><i class="wcur" style="width:' + pc(v) + '%"></i>' +
      (nv > v ? '<i class="wghost" style="left:' + pc(v) + '%;width:' + (pc(nv) - pc(v)) + '%"></i>' : '') + '</span><b>' + v + (key === "firerate" ? '/min' : key === "range" ? 'm' : '') + '</b>' +
      (nv !== v ? '<em class="gu-next">+' + (nv - v) + '</em>' : '') + '</div>';
  }).join("") + '</div>';
}
function wpnSlotsHtml(id){
  const tier = weaponTier(id);
  return '<div class="wslots" aria-label="Attachment slots">' + WPN_SLOTS.map(([key, name, eff, need]) => {
    const open = tier >= need, fitted = !!attachOf(id)[key], can = open && !fitted && !attachBlock(id, key);
    const sub = fitted ? eff + ' · fitted' : !open ? 'Mk ' + TIER_NAMES[need - 1] : can ? 'TAP TO FIT ' + eff : (eff + ' · craft at Fabricator');
    return '<button type="button" class="wslot' + (fitted ? ' fitted open' : open ? ' open' : ' locked') + (can ? ' can' : '') + '" data-slot="' + key + '"' + (can ? ' onclick="A.fitAttachment(\'' + id + '\',\'' + key + '\')"' : ' disabled') + '>' +
      '<b>' + (fitted ? IC(ITEMS[ATT_ITEM[key]].icon) + ' ' : '') + name + '</b><small>' + sub + '</small></button>';
  }).join("") + (ITEMS[id].art ? '<div class="wslot stock open" data-slot="stock"><b>Stock</b><small>' + gradeName(id) + (weaponGrade(id) < 4 && gearTier(id) >= 3 ? ' · fit all 3 for Svartverk' : '') + '</small></div>' : '') + '</div>';
}
function weaponScreenHtml(id){
  const it = ITEMS[id], lvl = gearLevel(id), max = gearMax(id), why = gearBlock(id), nxt = lvl < max ? lvl + 1 : null;
  const cost = nxt ? costParts(gearCost(id, nxt)).map(p => '<span class="gu-c' + (p.have < p.need ? ' bad' : '') + '">' + partIcon(p) + p.need + (p.kind === "item" ? ' ' + esc(ITEMS[p.id].name) : '') + '</span>').join("") : "";
  let mastery = "";
  if(isFree(id)){ const nk = masteryNext(id), k = masteryKills(id); mastery = '<div class="gu-mastery">Mastery ' + starsHtml(id) + ' <span>' + (nk === null ? 'max' : (nk - k) + ' kills to next star') + '</span></div>'; }
  const tier = gearTier(id), at = attachOf(id), mb = mergeBlock(id), canMerge = !mb, free = isFree(id), nextName = tier < 3 ? 'MK ' + TIER_NAMES[tier] + (ITEMS[id].art ? ' · ' + WART.grades[tier].toUpperCase() : '') : '';
  preloadWeaponArt(id);
  const mergeRow = free ? '<div class="wmerge' + (canMerge ? ' ready' : '') + '"><b>REBUILD</b><small>' + (tier >= 3 ? 'Max tier' : canMerge ? rebuildCost(id) + ' Scrap rebuilds it as ' + nextName : esc(mb) + ' · then ' + rebuildCost(id) + ' Scrap') + '</small></div>' :
    '<div class="wmerge' + (canMerge ? ' ready' : '') + '"><b>MERGE' + (tier >= 3 ? '' : ' ' + Math.min(have(id), mergeNeed(id)) + '/' + mergeNeed(id)) + '</b><small>' + (tier >= 3 ? 'Max tier' : canMerge ? mergeNeed(id) + ' copies become 1 ' + nextName : esc(mb)) + '</small></div>';
  const src = weaponArtSrc(id, 1600), prev = LAST_ART && LAST_ART.id === id && LAST_ART.src !== src ? LAST_ART.src : null;
  LAST_ART = { id, src };
  const art = src ? '<span class="wpn-hero g' + weaponGrade(id) + '" aria-hidden="true">' + (prev ? '<img class="old" src="' + prev + '.webp" alt="">' : '') + weaponArtImg(id, 1600, "cur" + (prev ? " fadein" : "")).replace('<img ', '<img onload="drawLeaders()" ') + '</span>'
    : '<span class="wpn-art t' + tier + '" aria-hidden="true">' + IC(ITEMS[id].icon) + Object.keys(ATT_ITEM).filter(k => at[k]).map(k => '<i class="watt watt-' + k + '">' + IC(ITEMS[ATT_ITEM[k]].icon) + '</i>').join("") + '</span>';
  setTimeout(drawLeaders, 30);
  return '<div class="bpop stashpop gearpop wpnscreen tier' + tier + ' r-' + tierRarity(id) + '" data-gear="' + id + '" data-tier="' + tier + '"><div class="wpn-l"><div class="wpn-bench">' + art + '<span class="wpn-mk" aria-hidden="true">' + tierLabel(id) + '</span></div>' + wpnSlotsHtml(id) + '</div>' +
    '<div class="wpn-r">' + (ownedWeapons().length > 1 ? '<div class="wpn-switch" role="tablist" aria-label="Your weapons">' + ownedWeapons().map(w => '<button type="button" role="tab" class="' + (w === id ? 'on' : '') + '" aria-selected="' + (w === id) + '" onclick="closeAllPopups();A.openWeapon(\'' + w + '\')" title="' + esc(ITEMS[w].name) + '">' + itemIcon(w) + '</button>').join("") + '</div>' : '') + (WART.sets[it.art] && WART.sets[it.art].placeholder ? '<div class="wpn-ph">Placeholder art</div>' : '') + '<button type="button" class="wpn-close" aria-label="Close" onclick="closeAllPopups()">' + IC("close") + '</button><div class="wpn-name"><h1>' + esc(it.name) + '</h1><span class="wtier rar-' + tierRarity(id) + '">' + tierLabel(id) + '</span><em>' + (isFree(id) ? IC("infinity") : '×' + have(id)) + '</em></div>' +
    '<div class="gu-lvl" aria-label="Upgrade level ' + lvl + ' of ' + max + '"><b>LEVEL ' + lvl + '/' + max + '</b><span class="gu-pips">' + Array.from({ length:max }, (_, i) => '<span class="gu-pip' + (i < lvl ? ' on' : '') + '"></span>').join("") + '</span></div>' +
    wpnBarsHtml(id) + mastery + mergeRow +
    (canMerge ? '<button class="primary big merge" onclick="A.gearMerge(\'' + id + '\')">' + (free ? 'REBUILD TO ' : 'MERGE TO ') + nextName + '</button>' : '') +
    (nxt ? '<div class="gu-cost" aria-label="Cost">' + cost + '</div>' : '') +
    '<button class="' + (canMerge ? 'ghost' : 'primary big') + ' upg" onclick="A.gearUpgrade(\'' + id + '\')"' + (why ? ' disabled' : '') + '>' + (nxt ? 'UPGRADE TO L' + nxt : 'MAX LEVEL') + '</button>' +
    (why && nxt ? '<div class="sp-why">' + esc(why) + '</div>' : '') +
    (isFree(id) ? '' : '<button type="button" class="linkbtn" onclick="A.stashSellView()">SELL OR RECYCLE</button>') + '</div></div>';
}
function weaponStatsLine(id){
  const w = ITEMS[id] && ITEMS[id].weapon; if(!w) return "";
  return "DMG " + w.dmg + " · MAG " + w.mag + " · RNG " + w.rng + "m · " + Math.round(60000 / w.int) + "/min";
}
function statsCardHtml(gear){
  const st = playerStats(gear), P = PROG.playerStats;
  const row = (k, v) => '<div class="kv"><span>' + k + '</span><span>' + v + '</span></div>';
  let html = '<div class="card operator-stats"><h2>Operator</h2>' +
    row("Speed", st.speed.toFixed(2) + " m/s") + row("Stealth", Math.round(st.stealth*100) + "% harder to spot") +
    row("Max health", Math.round(st.maxHealth)) + (st.shield ? row("Shield", Math.round(st.shield) + " (absorbs hits first)") : "") + row("Dash cooldown", (st.dashCooldownMs/1000).toFixed(1) + " s");
  html += '<div class="small">' + Object.keys(P.skills).map(id => esc(P.skills[id].name) + " L" + skillLevel(id) +
    (skillNextXp(id) !== null ? " (" + Math.floor(skillXp(id)) + "/" + skillNextXp(id) + " xp)" : " (max)")).join(" · ") + '</div>';
  if(gear && gear.length) html += '<div class="small">Gear at risk: ' + gear.map(g => esc(ITEMS[g].name)).join(", ") + '</div>';
  return html + '</div>';
}
function skillXpFrom(r){
  const K = PROG.playerStats.skills, t = r.skills || {}, n = v => Number.isFinite(v) && v > 0 ? Math.min(v, 1e5) : 0;
  const items = Array.isArray(r.extracted) ? r.extracted.reduce((a, x) => a + (typeof x === "string" ? 1 : n(x && x.qty) || 1), 0) : 0;
  return { mobility: n(t.distanceM)*K.mobility.xp.perMetre + n(t.dashes)*K.mobility.xp.perDash,
           stealth: n(t.holdNodes)*K.stealth.xp.perHoldNode,
           search: Math.min(n(t.searches), 20) * K.search.xp.perSearch,
           vitality: n(t.damageTaken)*K.vitality.xp.perDamage + n(t.healed)*K.vitality.xp.perHeal + (r.outcome === "extract" ? K.vitality.xp.perSurvive : 0),
           crafting: r.outcome === "extract" ? Math.min(items, 50) * K.crafting.xp.perItemExtracted : 0 };
}
function newCoreLaunch(rand){
  rand = rand || Math.random;
  const hex = () => Math.floor(rand()*0x100000000).toString(16).padStart(8,"0");
  return { raidId:"meta-" + Date.now().toString(36) + "-" + hex(), seed:hex() + "-meta" };
}
// Relative path back to this page as seen from ./nodspel/ (core accepts relative URLs only).
function metaReturnPath(pathname){
  const last = String(pathname || "").split("/").pop();
  return "../" + (/^[\w.-]+\.html$/.test(last) ? last : "");
}
function coreResultSummary(r, res){
  if(!res || !res.ok) return null;
  const head = r.outcome === "extract" ? "Node Raid: extracted" : r.outcome === "death" ? "Node Raid: you died" : "Node Raid: time ran out";
  const counts = {}; (res.added || []).forEach(id => counts[id] = (counts[id]||0) + 1);
  const loot = Object.keys(counts).map(id => "+" + counts[id] + " " + ITEMS[id].name).join(", ");
  const cur = Object.keys((res && res.currency) || {}).map(c => "+" + res.currency[c] + " " + (CUR_LABELS[c] || (D.currencies[c] || {}).name || c)).join(", ");
  const tail = (res.gearLost && res.gearLost.length ? " · gear lost: " + res.gearLost.map(id => ITEMS[id].name).join(", ") : "") +
    (res.kitLost ? " · medkits used/lost: " + res.kitLost : "") +
    (res.toolLost ? " · tool charges used/lost: " + res.toolLost : "") +
    (res.skillUps && res.skillUps.length ? " · " + res.skillUps.join(", ") + "!" : "") +
    (res.starUp ? " · mastery " + res.starUp + "!" : "") +
    (res.areaNotes && res.areaNotes.some(n => /scouted/.test(n)) ? " · " + res.areaNotes.filter(n => /scouted/.test(n)).join(", ") : "");
  return head + " — " + (loot || "no loot secured") + tail + (cur ? " (" + cur + ")" : "") + (res.scrapBonus ? " · extract bonus +" + res.scrapBonus + " Scrap" : "") + (r.lost.length ? " · lost " + r.lost.length : "") + (res.xp ? " · BIT +" + res.xp + " XP" : "");
}
// Compact "secured loot" strip for the base toast: outcome, item tiles, currencies, extract bonus and BIT XP (same .qt tiles as the quest rewards).
function coreResultStripHtml(r, res){
  if(!res || !res.ok) return null;
  const counts = {}; (res.added || []).forEach(id => counts[id] = (counts[id] || 0) + 1);
  const t = Object.keys(counts).map(id => qTileImg(id, counts[id], "", ITEMS[id].name));
  for(const c in res.currency || {}) t.push(qTile(CUR_ICON_IDS[c] || "cur-scrap", res.currency[c], "", CUR_LABELS[c] || (D.currencies[c] || {}).name || c));
  if(res.scrapBonus) t.push(qTile("cur-scrap", "+" + res.scrapBonus, "bonus", "Extract bonus"));
  if(res.xp) t.push(qTile("star", res.xp, "", "BIT XP"));
  const lost = (res.gearLost || []).length + (r.lost || []).length;
  if(lost) t.push(qTile("skull", lost, "lost", "Lost"));
  const ic = r.outcome === "extract" ? "check" : r.outcome === "death" ? "skull" : "timer";
  return '<span class="qdone secured" role="status" aria-label="' + esc(coreResultSummary(r, res) || "Raid result") + '">' + IC(ic) + (t.length ? t.join("") : "<b>No loot</b>") + '</span>';
}
function ingestPendingCoreResult(storage){
  let raw = null;
  try{ raw = storage && storage.getItem(RAID_RESULT_KEY); }catch(e){ return null; }
  if(!raw) return null;
  let parsed = null;
  try{ parsed = JSON.parse(raw); }catch(e){}
  const res = ingestRaidResult(parsed);
  if(res.ok){ res.summary = coreResultSummary(parsed, res); res.strip = coreResultStripHtml(parsed, res); }
  try{ storage.removeItem(RAID_RESULT_KEY); }catch(e){}
  return res;
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
  gearMerge(id){
    if(!gearMerge(id)) return;
    const t = gearTier(id); toast(ITEMS[id].name + " merged to Mk " + TIER_NAMES[t - 1] + "!");
    if(session.stashPop) stashPopRender(); refresh();
    const ws = document.querySelector("#overlay .wpnscreen, #overlay .gearpop");
    if(ws){ ws.classList.add("merged"); ws.insertAdjacentHTML("beforeend", '<div class="mergeburst" aria-hidden="true"><b>MK ' + TIER_NAMES[t - 1] + '</b><small>MERGED' + (ITEMS[id].art ? ' · ' + gradeName(id).toUpperCase() : '') + '</small></div>'); }
  },
  fitAttachment(id, slot){
    if(!fitAttachment(id, slot)) return;
    toast(ITEMS[ATT_ITEM[slot]].name + " fitted to " + ITEMS[id].name);
    if(session.stashPop) stashPopRender(); refresh();
    const ws = document.querySelector("#overlay .wpnscreen"); if(ws) ws.classList.add("chunk");
  },
  openWeapon(id){ if(gearKind(id) === "weapon") A.openStashItem(id); },
  invJump(id){ const el = document.getElementById(id); if(el) el.scrollIntoView({ block:"start", behavior:"smooth" }); },
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
  combatStep(dir){
    const g=session.combatDemo;if(!g||!g.running)return;
    const step=D.combat.player.tapMoveDistance,edge=D.combat.field.edgeMargin;
    if(dir==="up")g.y=Math.max(edge,g.y-step);
    if(dir==="down")g.y=Math.min(D.combat.field.height-edge,g.y+step);
    if(dir==="left")g.x=Math.max(edge,g.x-step);
    if(dir==="right")g.x=Math.min(D.combat.field.width-edge,g.x+step);
    const player=document.getElementById("combat-player");
    if(player){player.style.left=g.x+"%";player.style.top=g.y+"%";}
    act("COMBAT_MOVE",{direction:dir,tap:true});
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
      if(fx){fx.innerHTML='<i class="combat-beam" style="left:'+g.x+'%;top:'+g.y+'%;--tx:'+target.x+'%;--ty:'+target.y+'%"></i><b class="combat-hit" style="left:'+target.x+'%;top:'+target.y+'%">'+IC("hit")+'</b>';setTimeout(()=>{if(fx)fx.innerHTML="";},170);}
      target.hp--;
      if(target.hp<=0){
        target.alive=false;g.kills++;
        const el=document.getElementById("combat-drone-"+target.id);if(el)el.classList.add("destroyed");
        const index=g.kills-1, kind=(g.kills%D.combat.loot.medGelEvery===0)?"med":"scrap";
        g.pickups.push({x:target.x,y:target.y,kind,taken:false});
        const pickups=document.getElementById("combat-pickups");
        if(pickups)pickups.insertAdjacentHTML("beforeend",'<div class="combat-pickup '+kind+'" id="combat-pickup-'+index+'">'+(kind==="med"?IC("plus"):IC("pickup"))+'</div>');
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
      const pickups=document.getElementById("combat-pickups");if(pickups)pickups.insertAdjacentHTML("beforeend",'<div class="combat-pickup '+kind+'" id="combat-pickup-'+index+'">'+(kind==="med"?IC("plus"):IC("pickup"))+'</div>');
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
    if(arena)arena.insertAdjacentHTML("beforeend",'<div class="combat-end"><b>'+(extracted?"AREA SECURE":"YOU ARE DOWN")+'</b><span>'+(extracted?g.scrap+" Scrap · "+g.medGel+" Med Gel":"Try a different route around the drones")+'</span><button onclick="A.finishCombatDemo('+(extracted?"true":"false")+')">'+(extracted?"EXTRACT LOOT":"RETRY")+'</button></div>');
    act(extracted?"COMBAT_AREA_SECURED":"COMBAT_TEST_FAILED",{kills:g.kills,scrap:g.scrap});
  },
  finishCombatDemo(extracted){
    const g=session.combatDemo;if(!g)return;
    if(extracted){
      S.cur.scrap+=g.scrap;
      if(g.medGel)addItem(D.combat.loot.medGelItemId,g.medGel);
      act("COMBAT_LOOT_EXTRACTED",{scrap:g.scrap,medGel:g.medGel});save();
      this.endCombatDemo();
    }else{this.endCombatDemo();this.playCombatDemo();}
  },
  go(screen, param){
    if(screen === "arms"){ if(!navAllowed("arms")) return; closeAllPopups(); A.openWeapon(param || armsWeapon()); return; }
    if(screen === "bit" ? !bitOnline() : (screen !== "dev" && screen !== "module" && screen !== "operator" && screen !== "worldmap" && !baseAllows("navigation", screen))) return;
    if(screen === "module" && (!baseAllows("interactions", param) || (param !== "rebirth_core" && roomDef(param) && !roomUnlocked(param)))) return;
    if(session.screenEnterTs && session.screen)
      log("SCREEN_TIME", { screen: session.screen, ms: Date.now() - session.screenEnterTs });
    closeAllPopups();
    session.screenEnterTs = Date.now();
    if(screen === "worldmap" && session.screen !== "worldmap") session.wmCam = null; // opened fresh: centre on the selected area
    session.screen = screen; session.screenParam = param;
    if(screen === "prep"){ session.prep = null; session.routeLogged = false; }
    act("SCREEN_VIEW", { screen, param });
    refresh(screen === "prep" ? "raid_prep" : null);
  },
  itemDetail(id){ session.screen = "itemDetail"; session.screenParam = id; refresh(); },
  introSkip(ev){
    if(ev && ev.target && ev.target.closest && ev.target.closest(".intro-go")) return;
    const el = document.querySelector(".intro"); if(el) el.classList.add("done");
  },
  dismissIntro(){
    document.body.classList.remove("startup-bunker-intro");
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
    closeBuildingPopup();
    const next = nextLevelDef(modId);
    if(!next || !canAfford(next.cost) || next.level > moduleCap(modId)) return;
    if(buildInProgress(modId)) return;
    const access=roomDef(modId);if(access&&!roomUnlocked(modId)){if(!roomRequirementMet(access))return;S.roomUnlocks[modId]=true;act("ROOM_UNLOCKED",{room:modId,stage:access.stage});}
    payCost(next.cost);
    // v1.56: L2+ upgrades run on a build timer (completes offline); the very first L2+ upgrade stays instant (FTUE).
    const I = idleState(), mins = buildMinutes(modId, next.level);
    if(next.level >= 2 && mins > 0 && I.freeBuildUsed){
      const now = idleNow(); I.builds[modId] = { level:next.level, startAt:now, doneAt:now + mins * MIN };
      if(S.tracked && S.tracked.module === modId && S.tracked.level === next.level) S.tracked = null;
      act("BUILD_STARTED", { module:modId, level:next.level, minutes:mins });
      toast(MODS[modId].name + " L" + next.level + " under construction · " + fmtLeft(mins * MIN));
      refresh(); return;
    }
    if(next.level >= 2) I.freeBuildUsed = true;
    finishModuleLevel(modId, next.level);
    // payoffs
    const isLightsOn = modId === "rebirth_core" && next.level === 1;
    const isBitOnline = modId === "bit_bay" && next.level === 1;
    const finish = () => { session.wake = true; A.go("base"); if(isBitOnline) bitDock("bond_up"); else bitDock("module_built"); };
    if(isLightsOn){
      save();
      bootSequence(next, finish);
    } else {
      overlay(upgradeRewardHtml(modId, next.level, isBitOnline), finish, "reward");
    }
  },
  sell(id, qty){
    if(isFree(id)) return;
    if(have(id) < 1 || S.reserved[id]) { toast(S.reserved[id] ? "Reserved for an upgrade" : "None left"); return; }
    const q = Math.max(1, Math.min(qty || 1, have(id))), gain = sellGain(id, q);
    removeItem(id, q); S.cur.scrap += gain;
    act("ITEM_SOLD", { id, gain, qty:q });
    toast("+ " + gain + " Scrap");
    refresh();
  },
  recycle(id, qty){
    const rec = recycleOf(id); if(stashBlock(id, "recycle")) return;
    const q = Math.max(1, Math.min(qty || 1, have(id))), out = rec.qty * q;
    removeItem(id, q); addItem(rec.to, out);
    act("ITEM_RECYCLED", { id, qty:q, to:rec.to, out });
    toast("Recycled: +" + out + " " + ITEMS[rec.to].name);
    refresh();
  },
  openStashItem(id){
    if(!ITEMS[id]) return;
    session.stashPop = { id, qty:1, confirm:null }; stashPopRender();
  },
  openItemDetail(id){ const o = document.getElementById("overlay"); if(o) o.remove(); session.stashPop = null; A.itemDetail(id); },
  stashQty(d){
    const p = session.stashPop; if(!p) return;
    p.qty = d === 0 ? have(p.id) : p.qty + d; stashPopRender();
  },
  // SELL / RECYCLE: warn first when a quest, hand-in or tracked upgrade still needs the copies.
  stashAct(mode){
    const p = session.stashPop; if(!p || stashBlock(p.id, mode)) return;
    p.qty = Math.max(1, Math.min(p.qty, have(p.id)));
    p.mode = mode;
    if(stashWarnings(p.id, p.qty).length){ p.confirm = mode; stashPopRender(); return; }
    A.stashConfirm();
  },
  stashConfirm(){
    const p = session.stashPop; if(!p || !p.mode) return;
    const { id, qty, mode } = p; session.stashPop = null;
    const o = document.getElementById("overlay"); if(o) o.remove();
    if(mode === "sell") A.sell(id, qty); else A.recycle(id, qty);
    updateNav();
  },
  gearUpgrade(id){
    if(!gearUpgrade(id)) return;
    const o = ITEMS[id]; toast(o.name + " upgraded to L" + gearLevel(id));
    if(session.stashPop) stashPopRender(); refresh();
    const ws = document.querySelector("#overlay .wpnscreen"); if(ws) ws.classList.add("chunk"); // payoff: art punch + shake
  },
  stashSellView(){ const p = session.stashPop; if(!p) return; p.sellView = true; stashPopRender(); },
  stashBack(){ const p = session.stashPop; if(!p) return; p.confirm = null; stashPopRender(); },
  openQuickClean(){
    session.quickClean = { sel:quickCleanDefault(quickCleanList()), confirm:false }; quickCleanRender();
  },
  curInfo(id){ if(!CUR_INFO[id]) return; act("CURRENCY_INFO", { id }); overlay(curInfoHtml(id), null, "sheet curinfoov"); },
  quickCleanToggle(id){ const qc = session.quickClean; if(!qc) return; if(qc.sel[id]) delete qc.sel[id]; else qc.sel[id] = true; quickCleanRender(); },
  quickCleanAsk(){ const qc = session.quickClean; if(qc && Object.keys(qc.sel).length){ qc.confirm = true; quickCleanRender(); } },
  quickCleanBack(){ const qc = session.quickClean; if(qc){ qc.confirm = false; quickCleanRender(); } },
  quickCleanConfirm(){
    const qc = session.quickClean; if(!qc) return;
    const ok = quickCleanList().filter(r => qc.sel[r.id]); session.quickClean = null;
    const o = document.getElementById("overlay"); if(o) o.remove();
    let gain = 0;
    for(const r of ok){ removeItem(r.id, r.qty); gain += r.gain; }
    S.cur.scrap += gain;
    act("STASH_QUICK_CLEAN", { items:ok.map(r => r.id), gain });
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
    const gain = Math.floor(ITEMS[id].sellValue * D.scrapJunkRate * (1 + talentVal("scavSalvager"))); // Scavenger: Salvager (v1.95)
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
  // Guardian capstone (Safe Return, fallback): pre-choose which material BIT tries to save on death (not gear).
  setGuardianMaterial(id){
    if(id && !isMaterialItem(id)) return;
    S.guardianMaterial = S.guardianMaterial === id ? null : id;
    act("GUARDIAN_MATERIAL_SET", { id: S.guardianMaterial });
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
  planToggle(open){ session.planOpen = !!open; if(session.screen === "prep") SCREENS.prep(); },
  pickSlot(key){
    if(!session.prep) return;
    const def = SLOT_DEFS.find(d => d[0] === key); if(!def) return;
    if(guidedRaid() && !ownedForSlot(def[1])) return;
    const ids = invIds().filter(id => ITEMS[id].slot === def[1]);
    if(def[1] === "weapon") ids.unshift(FREE_WEAPON);
    const cur = session.prep.loadout[key];
    overlay('<div class="bpop picker"><div class="bpop-head"><span class="bicon" aria-hidden="true">' + def[3] + '</span><h1>' + def[2] + '</h1></div><div class="pick-grid">' +
      ids.map(id => '<button type="button" class="pick' + (cur === id ? ' selected' : '') + '" onclick="A.chooseSlot(\'' + key + '\',\'' + id + '\')"><i aria-hidden="true">' + itemImg(id) + '</i><b>' + esc(ITEMS[id].name) + '</b><small>' + (ITEMS[id].free ? IC("infinity") + ' FREE' : '×' + qty(id) + (ITEMS[id].tool ? ' charge' + (qty(id) === 1 ? '' : 's') : '')) + '</small>' + (ITEMS[id].weapon ? '<small class="wstats">' + weaponStatsLine(id) + '</small>' : '') + (gearKind(id) === "weapon" ? '<span class="pick-up" role="button" tabindex="0" onclick="event.stopPropagation();A.openWeapon(\'' + id + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();event.stopPropagation();A.openWeapon(\'' + id + '\')}">UPGRADE</span>' : '') + '</button>').join('') +
      '<button type="button" class="pick" onclick="A.chooseSlot(\'' + key + '\',\'\')"><i aria-hidden="true">∅</i><b>Empty</b></button></div></div>', null, "sheet");
  },
  chooseSlot(key, id){ closeBuildingPopup(); A.prepLoadout(key, id); },
  prepLoadout(slot, id){
    if(!session.prep || (id && (!ITEMS[id] || have(id) < 1))) return;
    if(slot === "weapon" && !id) id = FREE_WEAPON; // weapon slot is never empty: the free Basic is always there
    session.prep.loadout[slot] = id || null; session.prep.loadoutTouched = true;
    S.loadout = Object.assign({}, session.prep.loadout); save(); refresh("raid_prep"); },
  adSignals(){
    fakeAd("+"+PROG.insurance.adSignalsGrant+" Signals", ()=>{
      S.cur.signals += PROG.insurance.adSignalsGrant; save();
      toast("+" + PROG.insurance.adSignalsGrant + " Signals");
      refresh("raid_prep");
    });
  },
  // Locked next-target tap / CTA: Core short -> base Core popup; Core ok but scout missing -> Raid Prep with the scout `from` area preselected.
  wmLocked(id){
    const h = AREA_DEFS[id] && areaUnlockHelp(id); if(!h || !h.kind || areaUnlocked(id)) return;
    act("WM_UNLOCK_CTA", { area:id, kind:h.kind });
    if(h.kind === "core"){ A.go("base"); A.openBuilding("rebirth_core"); return; }
    if(areaUnlocked(h.from)) S.area = h.from;
    A.go("prep");
  },
  toggleHard(){ if(!hardAvailable(raidArea())) return; session.hard = !hardOn(); act("HARD_TOGGLED", { area:raidArea(), on:session.hard }); refresh(); },
  setArea(id){ if(!AREA_DEFS[id] || !areaUnlocked(id)) return; S.area = id; if(!AREA_DEFS[id].requires || areaEarned(id)){ S.areaSeen = S.areaSeen || {}; S.areaSeen[id] = true; } act("AREA_SELECTED", { area:id }); refresh(); },
  debugUnlockAreas(on){ S.debugAreas = on !== false; save(); refresh(); },
  deployNodeRaid(){
    const l = newCoreLaunch(), gear = nodeRaidGear(), stats = playerStats(gear), weapon = nodeRaidWeaponId(), kit = nodeRaidKit(), tool = nodeRaidTool();
    const rb = takeRestBuff(); // Living Quarters rest: applies to this launch only (v1.82)
    if(rb) for(const k in rb) stats[k] = clampStat(k, stats[k] + rb[k]);
    const sb = bitShieldBurst() + talentVal("guardianPlatingShield"); if(sb) stats.shield = clampStat("shield", stats.shield + sb);   // BIT Shield burst skill (v1.86) + Guardian Plating (v1.95)
    const intro = guidedRaid(), pay = intro ? null : takeFirstPayoff(!!tool), launchTool = tool || (pay && pay.freeTool) || null;
    // Deploy is free, but equipped gear (non-Basic weapon, armour), medkits and the tool slot go with you and are at risk.
    gear.forEach(id => removeItem(id, 1));
    if(kit.medkit) removeItem(PROG.kitItem, kit.medkit);
    if(tool) removeItem(tool.id, tool.n);
    const hard = !intro && hardOn();
    S.coreLaunch = { raidId:l.raidId, gear, stats, weapon, kit, tool, area: raidArea(), hard }; // a free payoff tool is launch-only: never in coreLaunch.tool, so nothing returns to the stash
    act("CORE_RAID_LAUNCHED", { raidId:l.raidId, seed:l.seed, gear, stats, weapon, kit, tool });
    save();
    closeAllPopups();
    (window.PR_NAVIGATE || (u => location.assign(u)))(coreLaunchUrl(l.raidId, l.seed, metaReturnPath(location.pathname), { stats, gear, weapon, kit, tool:launchTool, bag: raidBagCapacity(gear), area: raidArea(), hard, quest:questLaunchParam(), goal:progressionGoal(), intro, payoff:pay && pay.kind }));
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
      session.raid = { R, plan, stage:0, haul:[], scrap:0, dataCores:0 };
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
      dangerTier: rd.stage+1, riskShown: rd.plan.pushDeath[Math.min(rd.stage, rd.plan.pushDeath.length-1)], haulItems: rd.haul.length, trackedMissing: !!trackedMissingItem() && !rd.haul.includes((trackedMissingItem()||{}).itemId), mode: retMode() });
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
      R.loot.forEach(id => addItem(id,1,true));
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
  exchange(xid){
    const x = (D.vendors[0].exchange || []).find(e => e.id === xid); if(!x) return;
    const [gc, gq] = Object.entries(x.give)[0], [rc, rq] = Object.entries(x.receive)[0];
    if((S.cur[gc] || 0) < gq) return;
    S.cur[gc] -= gq; S.cur[rc] = (S.cur[rc] || 0) + rq; revealCurrency(rc);
    act("VENDOR_EXCHANGE", { id:xid });
    toast("+" + rq + " " + CUR_LABELS[rc]); refresh();
  },
  buy(id){
    const s = D.vendors[0].stock.find(x=>x.itemId===id);
    if(!s) return;
    const price = vendorPrice(s);
    if(!stockUnlocked(s) || S.cur.scrap < price) return;
    S.cur.scrap -= price; addItem(id,1);
    act("VENDOR_BUY", { id, price });
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
    const cost = craftCost(r);
    if(S.cur.scrap < cost || !Object.keys(r.inputs).every(id => have(id) >= r.inputs[id])) return;
    const I = idleState();
    if(I.crafted > 0 && I.fab.length >= fabSlots()){ toast("Fabricator queue is full"); return; }
    S.cur.scrap -= cost;
    if(gainSkillXp("crafting", PROG.playerStats.skills.crafting.xp.perCraft)) toast("Crafting L" + skillLevel("crafting") + " — cheaper crafting");
    for(const id in r.inputs) removeItem(id, r.inputs[id]);
    // v1.56: the first craft ever is instant (FTUE); afterwards crafts join the queue and finish over time, offline too.
    const inRoom = !!document.querySelector('#overlay .bpop[data-module="fabricator"]'), again = () => { refresh(); if(inRoom) A.openBuilding("fabricator"); };
    if(!I.crafted){ I.crafted = 1; toast("Crafted " + craftOutput(r)); again(); return; }
    const now = idleNow(), start = Math.max(now, I.fab.length ? I.fab[I.fab.length - 1].doneAt : now);
    I.fab.push({ rid, startAt:start, doneAt:start + fabMinutes(rid) * MIN }); I.crafted++;
    act("CRAFT_QUEUED", { recipe: rid, minutes: fabMinutes(rid) });
    toast(r.name + " queued · ready in " + fmtLeft(start + fabMinutes(rid) * MIN - now));
    again();
  },
  questSwap(qid){
    const Q = questState(), i = Q.list.findIndex(q => q.id === qid); if(i < 0 || Q.swaps < 1 || Q.list[i].done) return;
    const have = new Set(Q.list.map(q => q.type + (q.enemy || q.item || q.area || "") + (q.level || "")));
    const alt = questCandidates(Math.random).filter(q => !have.has(q.type + (q.enemy || q.item || q.area || "") + (q.level || "")));
    if(!alt.length){ toast("No other quest available right now"); return; }
    Q.list[i] = Object.assign({ id:"q" + i + "-" + Date.now().toString(36), prog:0, done:false, claimed:false }, alt[Math.floor(Math.random() * alt.length)]);
    Q.swaps--; act("QUEST_SWAPPED", {}); toast("BIT: " + QD.lines.swap); refresh(); if(document.querySelector("#overlay .qlog")) this.questLog("daily");
  },
  chipShop(){ chipShopOpen(); },
  chipSelect(id){ if(!chipItem(id)) return; session.chipSel = id; chipShopOpen(); },
  chipBuy(id){
    const r = chipBuy(id), it = chipItem(id); session.chipSel = id;
    toast(r.ok ? "Bought: " + chipName(it) : CHIP_WHY[r.reason]);
    if(document.querySelector("#overlay .cshop")) chipShopOpen(); else refresh();
  },
  chipExchange(kind){
    const r = chipExchange(kind);
    toast(r.ok ? "+" + r.chips + " Contract Chips" : CHIP_WHY[r.reason]);
    if(document.querySelector("#overlay .cshop")) chipShopOpen(); else refresh();
  },
  devChips(){ S.cur.chips = (S.cur.chips || 0) + 20; for(const k in CS.recycle) addItem(CS.recycle[k].item, 2); act("DEV_CHIPS", {}); refresh(); },
  questLog(tab, sel){
    const open = document.querySelector("#overlay .qlog");
    if(!tab) tab = open ? open.dataset.tab : (trackedQuest() || {}).chain;
    if(tab && tab !== "daily" && sel == null && chainReady(tab) && handInShow(tab, "log")) return;
    const ov = document.getElementById("overlay"); if(ov) ov.remove();
    overlay(questLogHtml(tab, sel), () => refresh(), "qlogov");
  },
  // Toggle: a second press on the tracked quest switches tracking off (the goal card goes back to the upgrade goal).
  powerTap(){
    if(!powerOnline()) return;
    tickPower();
    overlay(powerPopupHtml(), null, "sheet");
    if(powerTier() !== "ok") bitDock(powerTier() === "crit" ? "energy_critical" : "energy_low");
  },
  reinforce(){
    const r = doReinforce();
    if(!r.ok){ toast(r.reason === "scrap" ? "Need more Scrap" : r.reason === "cooldown" ? "Reinforce cooling down" : "Cannot reinforce"); return; }
    toast("Walls reinforced · +" + ((BP.reinforce && BP.reinforce.gain) || 25) + " power");
    const o = document.getElementById("overlay"); if(o) o.remove();
    refresh();
  },
  maintainHandIn(){
    const d = completeMaintain();
    if(!d){ toast("Need the parts first"); return; }
    toast(d.title + " · +" + d.energy + " power");
    const o = document.getElementById("overlay"); if(o) o.remove();
    refresh();
    maybeShowHandIn();
  },
  QUEST_TRACK(p){
    if(p && p.chain === "maintain"){ S.trackedQuest = "maintain"; act("QUEST_TRACK", { chain:"maintain", on:true }); refresh(); return; }
    if(!p || !chainActive(p.chain)) return;
    const on = (trackedQuest() || {}).chain === p.chain;
    S.trackedQuest = on ? "none" : p.chain; act("QUEST_TRACK", { chain:p.chain, on:!on });
    refresh(); if(document.querySelector("#overlay .qlog")){ this.questLog(p.chain); const b = document.querySelector("#overlay .qtrack"); if(b) b.classList.add("pulse"); }
  },
  handInOpen(chain, back){ handInShow(chain, back); },
  // The one turn-in. Pays once (chainComplete refuses a step that is not ready); the popup animation is cosmetic.
  QUEST_HANDIN(p){
    const id = p && p.chain; if(!id || !chainReady(id)) return;
    const res = chainComplete(id); if(!res) return;
    const pop = document.querySelector('#overlay .handin[data-chain="' + id + '"]');
    refresh();
    if(pop) handInPlay(pop);
    else if(document.querySelector("#overlay .qlog")) this.questLog(id);
  },
  // RAID from the quest detail: aim the normal deploy flow at the quest's area and track the quest so the raid HUD chip shows it.
  QUEST_RAID(p){
    const def = p && chainActive(p.chain); if(!def || guidedRaid() || !areaUnlocked(def.area)) return;
    S.area = def.area; S.trackedQuest = p.chain; ensurePrep();
    act("QUEST_RAID", { chain:p.chain, step:def.id, area:def.area, level:def.objective.level || 1 });
    A.deployNodeRaid();
  },
  // Debug hooks for screenshots: A.handInDemo("handin"|"extract"|"hero") opens the popup with a ready step; A.questLogDemo() opens the log with FIR stock.
  handInDemo(kind){
    S.beat = Math.max(S.beat, PROG.beats.findIndex(b => b.id === "choice_upgrade"));
    const chain = kind === "hero" ? "archipelago" : "bunker", st = chainState(chain);
    if(kind === "hero"){ S.debugAreas = true; st.step = QC[chain].steps.findIndex(x => x.id === "A5"); st.prog = QC[chain].steps[st.step].objective.n; }
    else if(kind === "extract"){ st.step = 0; st.prog = QC[chain].steps[0].objective.n; }
    else { st.step = 2; st.prog = 0; S.stash.scrap_alloy = Math.max(2, S.stash.scrap_alloy || 0); S.stash.polymer_plate = Math.max(1, S.stash.polymer_plate || 0); S.fir = Object.assign(S.fir || {}, { scrap_alloy: S.stash.scrap_alloy, polymer_plate: S.stash.polymer_plate }); }
    S.trackedQuest = chain; if(session.screen !== "base") A.go("base");
    session.handInShown = {}; handInShow(chain, "base");
  },
  questLogDemo(){
    S.beat = Math.max(S.beat, PROG.beats.findIndex(b => b.id === "choice_upgrade")); S.debugAreas = true;
    chainState("bunker").step = 2; S.stash.scrap_alloy = 1; S.stash.polymer_plate = 1; S.fir = Object.assign(S.fir || {}, { scrap_alloy: 1 });
    A.go("base"); A.questLog("bunker", 2);
  },
  questClaim(qid){
    const q = questState().list.find(x => x.id === qid); if(!q || !q.done || q.claimed) return;
    const ready=document.querySelector('#overlay .qlog');if(ready)ready.closest('#overlay').remove();
    overlay('<div class="bpop qpick"><div class="bpop-head"><span class="bicon" aria-hidden="true">' + IC("quest") + '</span><h1>Pick a reward</h1></div>' +
      '<p class="bitbubble">' + IC("bit-face") + '<span>' + esc(QD.lines.done) + '</span></p><div class="qcards">' + q.rewards.map((c, i) => rewardCardHtml(c, i, qid)).join("") + '</div>' +
      '<p class="reward">+' + QD.bondXp + ' BIT Bond XP</p></div>', () => refresh(), "sheet");
  },
  questPick(qid, idx){
    const q = questState().list.find(x => x.id === qid); if(!q || !q.done || q.claimed) return;
    const c = q.rewards[idx]; if(!c) return;
    q.claimed = true; S.bondXp += QD.bondXp;
    let reveal = null;
    if(c.kind === "scrap") S.cur.scrap += c.n;
    else if(c.kind === "xp") S.opXp = (S.opXp || 0) + c.n;
    else if(c.kind === "item") addItem(c.item, c.n);
    else { reveal = rollMystery(); S.cur.scrap += reveal.scrap; for(const id in reveal.items) addItem(id, reveal.items[id]); if(reveal.dataCores){ S.cur.dataCores = (S.cur.dataCores || 0) + reveal.dataCores; revealCurrency("dataCores"); } }
    act("QUEST_CLAIMED", { kind:c.kind, tier: reveal ? reveal.tier : null });
    const o = document.getElementById("overlay"); if(o) o.remove();
    if(reveal){
      overlay('<div class="bpop mreveal" style="--rc:' + RARITY_HEX[reveal.tier] + '"><div class="bpop-head"><span class="bicon" aria-hidden="true">' + IC("mystery") + '</span><h1>' + reveal.tier.toUpperCase() + '</h1></div>' +
        '<div class="mrow"><span>' + IC("cur-scrap") + ' +' + reveal.scrap + ' Scrap</span>' + Object.entries(reveal.items).map(([id, n]) => '<span>' + itemImg(id) + ' ' + n + '× ' + esc(ITEMS[id].name) + '</span>').join("") + (reveal.dataCores ? '<span>' + IC("cur-datacore") + ' +' + reveal.dataCores + ' Data Cores</span>' : '') + '</div>' +
        '<button class="primary big" data-close>NICE</button></div>', () => refresh(), "sheet");
    } else { toast("Reward claimed · +" + QD.bondXp + " Bond XP"); refresh(); }
  },
  collectScrap(){
    const now = idleNow(), st = genStored(now); if(st < IDLE.generator.minCollect) return;
    const I = idleState(); I.genAt = st >= genCap() ? now : I.genAt + st / genRate() * HOUR; // keep the partial hour
    S.cur.scrap += st; act("SCRAP_COLLECTED", { amount: st }); toast("+" + st + " Scrap from the recycler");
    if(session.welcome) session.welcome.stored = 0; refresh();
  },
  sendScavenge(){
    const I = idleState(); if(!bitOnline() || I.scav || I.scavPending || S.expedition) return;   // one BIT assignment at a time; confirm the last haul first
    const miss = bitSkillOn("loot_priority") ? trackedMissingItem() : null, k = bitSkillDef("loot_priority");
    const now = idleNow(); I.scav = { startAt:now, returnAt:now + scavMinutes() * MIN, loot: rollScavenge(null, miss && scavPools().includes(miss.itemId) ? { itemId:miss.itemId, p:k.bias } : null) };
    act("SCAVENGE_SENT", { minutes: scavMinutes() }); toast("BIT heads out · back in " + fmtLeft(scavMinutes() * MIN));
    // The BIT Bay building popup (A.openBuilding) isn't tied to the SCREENS render loop like the
    // fullscreen BIT screen is, so a bare refresh() leaves its SEND button stuck showing the pre-send
    // state: tap once (works, invisibly), tap again and the busy-guard above silently no-ops it.
    // (Exclude .bitov: the fullscreen BIT screen's own tasks tab reuses the same .bpop[data-module] markup
    // and already redraws via bitRender, so reopening the room popup there would blow it away instead.)
    const inRoom = !!document.querySelector('#overlay:not(.bitov) .bpop[data-module="bit_bay"]');
    refresh(); if(inRoom) A.openBuilding("bit_bay");
  },
  openHaul(){
    const pend = scavPending(); if(!pend) return;
    const old = document.getElementById("overlay"); if(old) old.remove();   // BIT screen is itself an overlay now: swap, don't stack
    overlay(haulPopupHtml(pend), () => refresh(), "sheet");
  },
  confirmHaul(){
    const pend = scavPending(); if(!pend) return;
    closeAllPopups(); confirmScav(); toast(scavLootText(pend)); refresh();
  },
  learnTalent(id){ const ok = learnTalent(id); if(ok) refresh(); return ok; },
  respecTalents(){ const ok = respecTalents(); if(ok) refresh(); return ok; },
  bitTab(tab){ if(!bitOnline()) return; session.bitNode = null; bitRender(tab); },
  selectTalent(id){ if(!talentNodeDef(id)) return; session.bitNode = id; bitRender(session.screenParam); },
  dismissWelcome(){ session.welcome = null; const el = document.querySelector(".welcome"); if(el) el.remove(); },
  sendExpedition(){
    const R = D.retention.expedition;
    if(bitAway() || (S.idle && (S.idle.scav || S.idle.scavPending)) || S.cur.scrap < R.costScrap || !bitOnline()) return;
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
    if(roomUnlocked(id)){
      if(room.destination) A.openBuilding(room.destination);
      else if(id === "living_quarters") A.openQuarters();
      return;
    }
    const ready=roomRequirementMet(room);
    const next=room.destination && nextLevelDef(room.destination);
    const needsParts=next && !canAfford(next.cost);
    const prior=D.baseMap.rooms[room.stage - 2];
    const lore = (ready ? 'Activate with secured repair materials. Materials are spent once; access and the module come online together. ' : '') + room.requirement.text;
    overlay('<div class="bpop room"><div class="bpop-head"><span class="bicon" aria-hidden="true">' + (ready ? IC("unlock") : IC("lock")) + '</span><h1>' + esc(room.label) + '</h1>' +
      '<button type="button" class="iconbtn" onclick="var l=this.closest(\'.bpop\').querySelector(\'.lore\');l.hidden=!l.hidden" aria-label="Details and story">' + IC("info") + '</button></div>' +
      roomExplainHtml(id) + '<p class="lore" hidden>' + esc(lore) + '</p>' +
      (ready ? (next ? '<div class="costs">' + roomPartsHtml(room) + '</div><p class="reward">REWARD · ' + esc(next.benefitText) + '</p>' : '') +
        (needsParts ? '<button class="primary big raidcta" onclick="A.raidForRoom(\'' + room.id + '\')">RAID FOR REPAIR MATERIALS</button>'
          : '<button class="primary big" onclick="A.unlockRoom(\'' + room.id + '\')">ACTIVATE ROOM</button>') :
        '<p class="reward">' + esc(room.requirement.text) + '</p><div class="card warn">' + (prior && !roomUnlocked(prior.id) ? 'Open ' + esc(prior.label) + ' first. ' : '') + 'Requirement incomplete</div>') +
      '</div>', clearMapFocus, "sheet");
  },
  // v1.82 T2: Living Quarters (room-only, no module): Rest = +bunker power and a next-raid buff (once per raid).
  openQuarters(){
    const room = roomDef("living_quarters"); if(!room || !roomUnlocked("living_quarters")) return;
    if(!roomPowered("living_quarters")){ overlay(powerPopupHtml(), null, "sheet"); bitDock("energy_critical"); return; }
    markRoomUsed("living_quarters");
    closeBuildingPopup();
    const b = restBuff(), c = canRest(), pv = powerOnline() ? powerValue() : null;
    const status = b
      ? '<div class="idlecard rested"><i aria-hidden="true">' + IC("stat-shield") + '</i><span><b>' + esc(RST.label) + ' · ' + esc(restBuffText(b)) + '</b><small>Applies to your next raid only.</small></span></div>'
      : '<div class="idlecard"><i aria-hidden="true">' + IC("timer") + '</i><span><b>Not rested</b><small>Rest once before a raid: +' + RST.powerGain + ' power and ' + esc(restBuffText(RST.buff)) + ' next raid.</small></span></div>';
    const meter = pv == null ? '' : '<div class="idlecard"><i aria-hidden="true">' + IC("power") + '</i><span><b>Bunker power ' + pv + '/100</b><span class="ibar"><span style="width:' + pv + '%"></span></span></span></div>';
    overlay('<div class="bpop" data-module="living_quarters"><div class="bpop-head"><span class="bicon" aria-hidden="true">' + ROOM_ICONS.living_quarters + '</span><h1>' + esc(room.label) + '</h1></div>' +
      roomExplainHtml("living_quarters") + status + meter +
      '<button class="primary big" ' + (c.ok ? 'onclick="A.rest()"' : 'disabled') + '>' + (c.ok ? 'REST' : 'RESTED · DEPLOY TO USE IT') + '</button></div>', clearMapFocus, "sheet");
    if(session.screen === "base") focusMapOn("living_quarters");
  },
  rest(){
    const r = doRest();
    if(!r.ok){ toast(r.reason === "rested" ? "Already rested for the next raid" : "Cannot rest right now"); return; }
    toast(RST.label + " · " + restBuffText() + " next raid");
    refresh(); A.openQuarters();
  },
  openBuilding(modId){
    const m = MODS[modId]; if(!m || !baseAllows("interactions", modId)) return;
    const room = roomDef(modId); if(modId !== "rebirth_core" && room && !roomUnlocked(modId)) return A.openRoom(modId);
    if(modId !== "rebirth_core" && !roomPowered(modId)){
      overlay(powerPopupHtml(), null, "sheet"); bitDock("energy_critical"); return;
    }
    markRoomUsed(modId);
    closeBuildingPopup();
    const lvl = S.modules[modId] || 0, next = nextLevelDef(modId);
    let body, cta;
    if(buildInProgress(modId)){
      body = buildCardHtml(modId);
      cta = '<button class="primary big" disabled>' + IC("scaffold") + ' UNDER CONSTRUCTION</button>';
    } else if(!next){
      body = '<p class="eff">Maximum level reached.</p>';
      cta = '<button class="primary big" disabled>MAX LEVEL</button>';
    } else {
      const parts = costParts(next.cost);
      body = '<p class="eff">' + esc(next.benefitText || next.unlockText || m.blurb) + '</p><div class="costs">' + parts.map(p => {
        const ok = p.have >= p.need;
        return '<div class="cost ' + (ok ? 'ok' : 'miss') + '" title="' + esc(partName(p)) + '"><i aria-hidden="true">' + partIcon(p) + '</i><b>' + Math.min(p.have, p.need) + '/' + p.need + '</b><span class="cname">' + esc(partName(p)) + '</span><span class="chk">' + (ok ? IC("check") : IC("warning")) + '</span></div>';
      }).join("") + '</div>';
      const miss = parts.find(p => p.have < p.need);
      if(next.level > moduleCap(modId)) cta = '<button class="primary big" onclick="A.openBuilding(\'rebirth_core\')">UPGRADE CORE FIRST</button>';
      else if(!miss) cta = '<button class="primary big" onclick="A.build(\'' + modId + '\')">' + (lvl ? 'UPGRADE' : 'BUILD') + '</button>';
      else cta = '<button class="primary big raidcta" onclick="A.raidForModule(\'' + modId + '\')">RAID FOR ' + partIcon(miss) + ' ' + esc(partName(miss)).toUpperCase() + '</button>';
    }
    overlay('<div class="bpop' + (modId === "fabricator" ? ' fabpop' : '') + '" data-module="' + modId + '"><div class="bpop-head"><span class="bicon" aria-hidden="true">' + (ROOM_ICONS[modId] || IC("item-crate")) + '</span><h1>' + esc(m.name) + '</h1>' +
      '<em>L' + lvl + (next ? ' ' + IC("arrow-right") + ' L' + next.level : '') + '</em>' +
      '<button type="button" class="iconbtn" onclick="A.buildingInfo(\'' + modId + '\')" aria-label="Details and story">' + IC("info") + '</button>' +
      '</div>' + roomExplainHtml(modId) + (modId === "fabricator" ? '<div class="fabcols"><div class="fabl">' + fabQueueHtml() + fabCraftHtml() + '</div><div class="fabr">' + body + cta + '</div></div>'
      : (modId === "rebirth_core" ? genCardHtml() : modId === "bit_bay" ? scavCardHtml() : "") + body + cta) + '</div>', clearMapFocus, modId === "fabricator" ? "sheet fabroom fabov" : "sheet");
    if(session.screen === "base") focusMapOn(modId);
  },
  back(){
    const o = document.getElementById("overlay");
    if(o){ o.remove(); if(o._onClose) o._onClose(); updateNav(); return; }
    const t = BACK_TARGET[session.screen] || "base";
    if(session.screen !== "base") A.go(t);
  },
  buildingInfo(modId){ closeBuildingPopup(); A.go("module", modId); },
  raidForModule(modId){
    const next = nextLevelDef(modId); if(!next) return;
    if(!S.tracked || S.tracked.module !== modId || S.tracked.level !== next.level) S.trackedStreak = 0;
    S.tracked = { module:modId, level:next.level }; act("TRACK_SET", S.tracked);
    closeBuildingPopup();
    A.go("prep");
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
    const next=room.destination&&nextLevelDef(room.destination);if(next&&!canAfford(next.cost)){toast("Extract the remaining repair materials first");return;}
    S.roomUnlocks[id]=true; act("ROOM_UNLOCKED", { room:id, stage:room.stage });
    if(next){A.build(room.destination);return;}
    const o=document.getElementById("overlay"); if(o) o.remove(); session.screen="base"; refresh(); toast(room.label + " revealed");
  },
  devPlate(stage){
    session.devPlateStage = stage === null ? null : Math.max(0, Math.min(D.baseMap.rooms.length, Number(stage)));
    act("DEV_PLATE_PREVIEW", { stage:session.devPlateStage }); session.screen="base"; refresh();
  },
  /* dev */
  devForce(o){ session.devForce = o; act("DEV_FORCE",{o}); toast("Next raid: " + o); refresh(); },
  devCur(){ S.cur.scrap+=100; S.cur.dataCores+=100; S.cur.signals+=100; act("DEV_CURRENCY",{}); refresh(); },
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
    { const I = idleState(); for(const k in I.builds) I.builds[k].doneAt = 0; for(const j of I.fab) j.doneAt = 0; if(I.scav) I.scav.returnAt = 0; tickIdle(); I.away = null; }
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
  // PRB-42: iOS Safari ignores a detached <a download>. Order: share sheet (File) -> attached
  // download link -> new tab; a textarea + copy button is always shown as a last resort.
  async devExport(){
    const json = JSON.stringify(S.log, null, 2), name = "pr_event_log.json";
    const blob = new Blob([json], {type:"application/json"});
    const showText = () => {
      const old = document.getElementById("devexport"); if(old) (old.closest("#overlay") || old).remove();
      const box = overlay('<div id="devexport"><h1>Event log</h1><textarea readonly style="width:100%;height:40vh;font:11px monospace"></textarea><button type="button" class="primary" id="devcopy">Copy to clipboard</button></div>');
      const ta = box.querySelector("textarea"), copy = box.querySelector("#devcopy");
      ta.value = json;
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(json); copy.textContent = "Copied"; }
        catch(e){ ta.focus(); ta.select(); try { document.execCommand("copy"); copy.textContent = "Copied"; } catch(_){ copy.textContent = "Select & copy manually"; } }
      };
      return box;
    };
    try {
      if(typeof File !== "undefined" && navigator.canShare && navigator.share){
        const file = new File([blob], name, {type:"application/json"});
        if(navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:name}); return "share"; }
      }
    } catch(e){ if(e && e.name === "AbortError") return "share-cancelled"; }
    let url = null;
    try { url = URL.createObjectURL(blob); } catch(e){}
    if(url){
      const a = document.createElement("a");
      a.href = url; a.download = name; a.rel = "noopener"; a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      // iOS without download support: also open the blob in a new tab (no-op if a popup is blocked)
      if(/iP(hone|ad|od)/.test(navigator.userAgent || "") && !("download" in HTMLAnchorElement.prototype)) try { window.open(url, "_blank"); } catch(e){}
    }
    showText();
    return url ? "download" : "text";
  },
  devReset(){
    localStorage.removeItem(SAVE_KEY);
    S = freshState();
    session = { pendingRaid:null, prep:null, screen:"base", screenParam:null, devForce:null, camera:null, plateStage:null, cameraResize:null, devPlateStage:null, cameraLayout:null };
    refresh();
  }
};

/* ---------- reset progress (base + Node Raid) ---------- */
// Every Protocol Rebirth key: meta save, core RaidResult handoff, legacy core result, core tutorial/FTUE flags.
const PR_STORAGE_KEYS = ["pr_meta_save", "pr_raid_result_v1", "nodspel.result.json", "nodspel.tutorial.seen"];
const isPrKey = k => PR_STORAGE_KEYS.includes(k) || /^(pr_|nodspel\.)/.test(k);
function clearProgressStorage(storages){
  const removed = [];
  for(const st of storages){
    if(!st) continue;
    try{
      const keys = [];
      for(let i = 0; i < st.length; i++) keys.push(st.key(i));
      for(const k of keys.concat(PR_STORAGE_KEYS)) if(k !== null && isPrKey(k) && st.getItem(k) !== null){ st.removeItem(k); removed.push(k); }
    }catch(e){}
  }
  return removed;
}
function browserStorages(){
  const out = [];
  try{ out.push(window.localStorage); }catch(e){}
  try{ out.push(window.sessionStorage); }catch(e){}
  return out;
}
const RESET_CONFIRM = "Reset ALL progress? This deletes your base, stash, BIT bond and Node Raid data on this device. This cannot be undone.";
// Clear everything and reload to a fresh start. Returns false if the player cancels.
function resetProgress(opts){
  opts = opts || {};
  const ask = opts.confirm || (m => window.confirm(m));
  if(!ask(RESET_CONFIRM)) return false;
  resetting = true;
  clearProgressStorage(opts.storages || browserStorages());
  const url = new URL(window.location.href); url.searchParams.delete("reset");
  // window.PR_NAVIGATE lets headless tests observe the reload (jsdom cannot navigate).
  (opts.navigate || window.PR_NAVIGATE || (u => window.location.replace(u)))(url.pathname + url.search + url.hash);
  return true;
}
let resetting = false;
// ?reset=1 quick reset for testing (still confirmed). Returns true if a reload is under way.
function handleResetParam(opts){
  const url = new URL(window.location.href);
  if(url.searchParams.get("reset") !== "1") return false;
  if(resetProgress(opts)) return true;
  url.searchParams.delete("reset");
  try{ window.history.replaceState(null, "", url.pathname + url.search + url.hash); }catch(e){}
  return false;
}

/* ---------- BIT portrait (assets/bit.png) with graceful fallback ---------- */
function tryBitImage(){
  const img = new Image();
  img.onload = () => document.body.classList.add("bit-img");
  img.src = "assets/bit.png";
}

/* ---------- landscape lock + splash ---------- */
// Owner rule: landscape only. Android/Chrome: fullscreen + orientation lock on the first tap (needs a user gesture).
// iOS Safari cannot lock; the #rotate screen covers portrait.
function lockLandscape(doc){
  doc = doc || document;
  try{
    const el = doc.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
    const lock = () => { try{ const o = screen.orientation; if(o && o.lock) return o.lock("landscape").catch(() => {}); }catch(e){} };
    if(fs && !doc.fullscreenElement){ const p = fs.call(el, { navigationUI:"hide" }); if(p && p.then) p.then(lock, lock); else lock(); }
    else lock();
  }catch(e){}
}
// Base loading overlay when the splash is skipped: covers the HUD until the bunker art is loaded and painted, then fades out.
function showBaseLoader(){
  if(/jsdom/i.test(navigator.userAgent || "")) return;
  const el = document.createElement("div");
  el.id = "boot-loader"; el.className = "pr-loader"; el.setAttribute("role", "status"); el.setAttribute("aria-label", "Loading");
  el.innerHTML = IC("bit-face") + '<div class="pr-loader-bar"><i></i></div>';
  document.body.appendChild(el);
  let done = false;
  const hide = () => { if(done) return; done = true; requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); })); };
  const img = new Image(); img.onload = img.onerror = hide; img.src = D.baseMap.plates[bunkerStage()].art;
  if(img.complete) hide();
  setTimeout(hide, 4000);
}
function setupSplash(){
  const sp = document.getElementById("splash");
  const once = () => { document.removeEventListener("pointerdown", once, true); lockLandscape(); };
  document.addEventListener("pointerdown", once, true);
  if(!sp) return;
  let shown = false; try{ shown = sessionStorage.getItem("pr_splash_seen") === "1"; sessionStorage.setItem("pr_splash_seen", "1"); }catch(e){}
  if(shown){ sp.remove(); if(typeof showBaseLoader === "function") showBaseLoader(); return; }
  const body = document.body;
  body.classList.add("splash-active");
  if(!S.introSeen) body.classList.add("startup-bunker-intro");
  let phase = "loading", requested = false, autoTimer, endTimer, loadTimer;
  const pendingImages = [];
  const reduced = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const finish = () => {
    if(phase === "done") return;
    phase = "done";
    clearTimeout(autoTimer); clearTimeout(endTimer); clearTimeout(loadTimer);
    pendingImages.forEach(img => { img.onload = img.onerror = null; });
    body.classList.remove("splash-active", "startup-descending");
    document.removeEventListener("visibilitychange", onVisibility);
    sp.remove();
  };
  const begin = () => {
    if(phase !== "ready") return;
    phase = "descending"; clearTimeout(autoTimer);
    sp.setAttribute("aria-label", "Skip bunker entrance");
    if(reduced()){
      sp.classList.add("out"); endTimer = setTimeout(finish, 200);
    } else {
      body.classList.add("startup-descending"); sp.classList.add("descending");
      // Keep a timer as well as animationend: interrupted animations must never block play.
      endTimer = setTimeout(finish, 1450);
    }
  };
  const ready = () => {
    if(phase !== "loading") return;
    phase = "ready"; clearTimeout(loadTimer);
    if(requested) begin(); else autoTimer = setTimeout(begin, 1400);
  };
  const activate = () => {
    lockLandscape();
    if(phase === "descending"){ finish(); return; }
    requested = true; begin();
  };
  const onVisibility = () => { if(document.hidden) finish(); };
  document.addEventListener("visibilitychange", onVisibility);
  sp.addEventListener("click", activate);
  sp.addEventListener("keydown", e => {
    if(e.key === "Enter" || e.key === " "){ e.preventDefault(); activate(); }
  });
  sp.querySelector(".splash-track")?.addEventListener("animationend", e => {
    if(e.animationName === "surfaceDeparture") finish();
  });
  const art = ["assets/production/splash_archipelago_radar_lighthouse.webp?v=" + APP_VERSION,
    D.baseMap.plates[bunkerStage()].art];
  let remaining = art.length;
  for(const src of art){
    const img = new Image(); pendingImages.push(img);
    let settled = false;
    img.onload = img.onerror = () => {
      if(settled) return; settled = true;
      if(--remaining === 0) ready();
    };
    img.src = src;
    if(img.complete) img.onload();
  }
  if(phase === "loading") loadTimer = setTimeout(ready, 2500);
}
/* ---------- init ---------- */
// ?reset=1 confirmed -> storage cleared and page reloading, so skip booting the old state.
if(typeof document !== "undefined" && document.getElementById("app") && !handleResetParam()){
  S = load();
  const coreIngest = ingestPendingCoreResult(window.localStorage);
  { const ver = document.getElementById("app-version"); if(ver) ver.textContent = "v" + APP_VERSION; }
  tryBitImage();
  setupSplash();
  if(!S.log.length) log("SESSION_START", {});
  window.addEventListener("beforeunload", () => {
    const cu = closestUpgrade();
    if(resetting) return; // never re-save over a reset
    log("SESSION_END", cu ? { unfinished: cu.m.id, pct: Math.round(cu.pct*100) } : {});
    save();
  });
  const resetBtn = document.getElementById("reset-progress");
  if(resetBtn) resetBtn.addEventListener("click", () => resetProgress());
  const menuBtn = document.getElementById("menubtn"), menu = document.getElementById("settings-menu");
  const setMenu = open => { if(!menu) return; menu.hidden = !open; menuBtn.setAttribute("aria-expanded", String(open)); };
  if(menuBtn) menuBtn.addEventListener("click", e => { e.stopPropagation(); setMenu(menu.hidden); });
  { const sc = document.getElementById("settings-close"); if(sc) sc.addEventListener("click", e => { e.stopPropagation(); setMenu(false); }); }
  document.addEventListener("click", e => { if(menu && !menu.hidden && !menu.contains(e.target) && e.target !== menuBtn) setMenu(false); });
  const devBtn = document.getElementById("devbtn");
  if(devBtn) devBtn.addEventListener("click", () => { setMenu(false); A.go("dev"); });
  { const mv = document.getElementById("menu-version"); if(mv) mv.textContent = "v" + APP_VERSION; }
  session.screen = S.introSeen ? "base" : "intro";
  refresh();
  // v1.56: timers that finish while the app is open surface within ~15 s (toast + re-render, never mid-drag/popup).
  // The BIT screen overlay is exempt: it's the TASKS tab's own home, so a scavenge/expedition completing while
  // it's open should still update it (any other popup still blocks, same as before).
  if(!/jsdom/i.test(navigator.userAgent || "")) setInterval(() => {
    const ov = document.getElementById("overlay");
    if(document.hidden || (ov && !ov.classList.contains("bitov")) || document.querySelector(".dragging")) return;
    const rows = tickIdle(); idleState().away = null; idleState().lastSeen = idleNow();
    if(rows.length){ for(const r of rows) toast(r.txt); save(); refresh(); } }, 15000);
  if(coreIngest && coreIngest.strip) toast("", coreIngest.strip);
  maybeShowItemInfo();
  if(S.introSeen){
    tickRetention();
    const rows = morningRows();
    if(rows.length) A.showMorning(rows);
  }
  maybeShowHandIn();
}
/* export pure logic for headless tests */
if(typeof module !== "undefined") module.exports = { goalEffectTiles, goalTilesHtml, progressionGoalHtml, areaUnlocked, wmNewUnlockTarget, applyAreaProgress, areaReqs, raidArea, hardAvailable, hardOn, _getSession: () => session, raidBagCapacity, operatorSpeedBonus, craftCost, craftDiscount, masteryStars, masteredWeapon, weaponParam, migrateSkills, migrateChips, freshState, resolveRaid, rollPushDeeper, stageCount, planStages, bestLead, effTable, trackedChanceP, chanceLabel, routeOf, baseState, transitionBaseState, advanceBaseState, _setState: st => { S = st; }, _getState: () => S, applyRaidResult, canAfford, costParts, bondLevel: () => bondLevel(), bunkerStage, roomRequirementMet, roomUnlocked, migrateState, migrateChains, load, ingestRaidResult, ingestPendingCoreResult, RAID_RESULT_KEY, coreLaunchUrl, newCoreLaunch, metaReturnPath, APP_VERSION, coreResultSummary, coreResultStripHtml, coreRaidXp, playerStats, bitShieldBurst, bitSkillOn, scoutLead, confirmScav, scavPending, rollScavenge, skillLevel, statsParam, skillXpFrom, statsCardHtml, clearProgressStorage, PR_STORAGE_KEYS, have, addItem, removeItem, chipCanBuy, chipBuy, chipExchange, grantWeeklyChips, grantUnlock, isoWeekId, stashSlotsUsed, operatorLevel, questUnlocksText, unlockBits, powerValue, powerTier, roomPowered, tickPower, drainPowerRaid, gainPower, doReinforce, canReinforce, maintainDef, maintainReady, completeMaintain, loopPhase, trackedGoalHtml, restState, restBuff, canRest, doRest, roomExplainHtml, BP, powerState, migratePower, gearLevel, gearMax, gearEffect, gearCost, gearBlock, gearUpgrade, migrateGearUp };
