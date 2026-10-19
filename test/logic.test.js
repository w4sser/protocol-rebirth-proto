// Headless logic tests. Run: node test/logic.test.js (from prototype/)
global.window = {};
const P = __dirname + "/..";
for(const f of ["items","modules","bit","raid_zones","recipes","vendors","retention","progression","combat"]) require(P+"/data/"+f+".js");
global.window.DATA = window.DATA;
const app = require(P+"/app.js");
const assert = require("assert");

let S = app.freshState(); app._setState(S);
assert.equal(S.cur.scrap, 20); assert.equal(S.v, 8);
assert.equal(S.retentionMode, "core");
assert.equal(window.DATA.combat.player.maxHealth, 100, "combat test tuning is data-driven");
assert.equal(S.baseState, "core_found", "new saves start at the found Core");
assert.equal(app.baseState().lighting, "emergency");
assert.equal(app.bunkerStage(), 0, "new saves start with every side room covered");
assert(!app.roomUnlocked("fabricator"));
{
  const old = app.freshState(); old.v = 6; old.baseState = "core_habitable"; old.cur.scrap = 77; old.stash.cable = 4;
  app.migrateState(old);
  assert.equal(old.v, 7); assert.equal(old.cur.scrap, 77); assert.equal(old.stash.cable, 4);
  assert(old.roomUnlocks.fabricator && old.roomUnlocks.storage && old.roomUnlocks.bit_bay, "v6 powered saves retain room access");
  assert(!old.roomUnlocks.living_quarters, "living quarters remains an explicit final reveal");
  const persisted = JSON.stringify(old);
  global.localStorage = { getItem:key => key === "pr_meta_save" ? persisted : null, setItem:()=>{} };
  const loaded = app.load();
  assert.equal(loaded.cur.scrap, 77); assert.equal(loaded.stash.cable, 4);
  assert(loaded.roomUnlocks.fabricator && loaded.roomUnlocks.bit_bay, "reloading restores migrated room access");
}

// Base state transitions are persistent data mutations, one-way, and idempotent.
S.modules.rebirth_core = 1;
assert(app.transitionBaseState("core_habitable", { module:"rebirth_core", level:1 }));
assert.equal(S.baseState, "core_habitable");
const transitions = S.log.filter(e => e.action === "BASE_STATE_CHANGED").length;
assert(!app.transitionBaseState("core_habitable", { module:"rebirth_core", level:1 }));
assert.equal(S.log.filter(e => e.action === "BASE_STATE_CHANGED").length, transitions);
assert(!app.transitionBaseState("core_found"), "base state cannot regress");
S.modules.fabricator = 1; S.modules.bit_bay = 1; S.modules.storage = 1;
assert(app.advanceBaseState({ module:"storage", level:1 }), "all repaired rooms transition to refined");
assert.equal(S.baseState, "core_refined");
assert.equal(app.bunkerStage(), 0, "power profile does not implicitly reveal rooms");
assert(!app.advanceBaseState({ module:"storage", level:1 }), "refined transition is idempotent");

// scripted raid_1: forced extract + guaranteed drops
S.beat = 2;
for(let i=0;i<100;i++){
  const R = app.resolveRaid({zoneId:"industrial", riskId:"standard", insuranceId:"none", loadout:["basic_carbine"], trackedItemId:null});
  assert.equal(R.outcome, "extract"); assert(R.loot.filter(id=>id==="cable").length>=2 && R.loot.includes("scrap_alloy"));
}
// aggressive risk can fail even in scripted beats
let died = 0;
for(let i=0;i<300;i++){ if(app.resolveRaid({zoneId:"industrial", riskId:"aggressive", insuranceId:"none", loadout:[], trackedItemId:null}).outcome==="death") died++; }
assert(died > 10, "aggressive can fail: " + died);

// tracked pity
S.beat = 6; S.trackedStreak = 1;
for(let i=0;i<50;i++) assert(app.resolveRaid({zoneId:"industrial", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:"optical_sensor"}).loot.includes("optical_sensor"), "pity");

// death economics: insurance, secure slot, never-regress
S = app.freshState(); app._setState(S);
S.beat = 6; S.modules.rebirth_core = 1; S.modules.storage = 1; S.secureItem = "medkit";
S.cur.scrap = 50; S.bondXp = 10; S.modules.bit_bay = 1;
const R = { cfg:{zoneId:"industrial", riskId:"standard", insuranceId:"basic",
  loadout:["basic_carbine","scavenger_vest","medkit"], trackedItemId:null},
  zone:"industrial", outcome:"death", loot:["cable","fuse"], scrap:20, dataCores:3, trackedFound:false };
app.applyRaidResult(R);
assert.equal(R.saved.insured.length, 1); assert.equal(R.saved.insured[0], "scavenger_vest", "insurance never wastes a slot on the free carbine");
assert.equal(S.opXp, 4, "death still gives operator XP");
assert.equal(R.saved.secure, "medkit"); assert.equal(S.cur.scrap, 60, "death keeps half the scrap haul"); assert.equal(S.bondXp, 15);
assert(S.modules.rebirth_core === 1 && R.progress.length >= 2);

// --- Basic Carbine is infinite; vest is not a starter item; operator level curve ---
{ const F = app.freshState(); app._setState(F);
  assert(!F.stash.basic_carbine && !F.stash.scavenger_vest, "start stash has no carbine/vest entries");
  assert.equal(app.have("basic_carbine"), Infinity, "carbine always available");
  app.removeItem("basic_carbine", 1); assert.equal(app.have("basic_carbine"), Infinity, "carbine can't be lost");
  const used = app.stashSlotsUsed(); app.addItem("basic_carbine", 3); assert.equal(app.stashSlotsUsed(), used, "carbine never takes slots");
  const L = app.operatorLevel;
  assert.deepEqual([L(0).level, L(49).level, L(50).level, L(124).level, L(125).level, L(225).level, L(350).level], [1,1,2,2,3,4,5], "operator curve");
  assert.deepEqual(L(60), { level:2, into:10, need:75 }); }

// --- routes shift the loot distribution without guaranteeing items ---
S = app.freshState(); app._setState(S); S.beat = 6;
function famCount(routeId, fam, n){
  let c = 0;
  for(let i=0;i<n;i++){
    const R = app.resolveRaid({zoneId:"industrial", routeId, riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:null});
    for(const id of R.loot) if(window.DATA.items.find(x=>x.id===id).family === fam) c++;
  }
  return c;
}
const elControl = famCount("control", "electronics", 300);
const elTunnels = famCount("tunnels", "electronics", 300);
assert(elControl > elTunnels * 1.5, "control room must yield clearly more electronics ("+elControl+" vs "+elTunnels+")");

// best lead for optical sensor should be the control room
const lead = app.bestLead("optical_sensor");
assert.equal(lead.zone.id, "industrial"); assert.equal(lead.route.id, "control");
assert(["Low","Medium","High"].includes(lead.label), "qualitative label");

// decision never offered on forced FTUE beats
S.beat = 2;
for(let i=0;i<50;i++){
  const R = app.resolveRaid({zoneId:"industrial", routeId:"tunnels", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:null});
  assert(!R.decision.eligible, "no decision during forced beats");
}
// decision offered on live raids when tracked item found
S.beat = 6;
let sawDecision = false;
for(let i=0;i<200 && !sawDecision;i++){
  const R = app.resolveRaid({zoneId:"industrial", routeId:"tunnels", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:"cable"});
  if(R.outcome === "extract" && R.trackedFound){ assert(R.decision.eligible, "tracked find must trigger decision"); sawDecision = true; }
}
assert(sawDecision, "never saw a tracked find in 200 raids?");

// push deeper: deterministic via stubbed rng
const origRnd = Math.random;
Math.random = () => 0.01;   // 0.01 < deathChanceAdd -> dies
let R2 = { cfg:{zoneId:"industrial", routeId:"reactor", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:null},
  zone:"industrial", outcome:"extract", loot:["cable"], scrap:10, dataCores:2, trackedFound:false, decision:{eligible:true,resolved:false} };
let res = app.rollPushDeeper(R2);
assert(res.died && R2.outcome === "death" && R2.pushedAndDied, "push can kill");
Math.random = () => 0.5;    // survives -> extra rolls
let R3 = { cfg:{zoneId:"industrial", routeId:"reactor", riskId:"standard", insuranceId:"none", loadout:[], trackedItemId:null},
  zone:"industrial", outcome:"extract", loot:["cable"], scrap:10, dataCores:2, trackedFound:false, decision:{eligible:true,resolved:false} };
res = app.rollPushDeeper(R3);
assert(!res.died && res.extra.length === window.DATA.raidConfig.pushDeeper.extraSlots && R3.loot.length === 3, "push adds loot");
Math.random = origRnd;

// --- Agency v0.7 staged raids ---
// stage count scales with route depth / risk (1 short, up to 3 deep/aggressive)
assert.equal(app.stageCount({zoneId:"industrial", routeId:"tunnels", riskId:"standard"}), 1, "short route = 1 stage (no checkpoint)");
assert.equal(app.stageCount({zoneId:"industrial", routeId:"control", riskId:"standard"}), 2, "control = 2 stages");
assert.equal(app.stageCount({zoneId:"industrial", routeId:"reactor", riskId:"standard"}), 3, "reactor = 3 stages");
assert.equal(app.stageCount({zoneId:"industrial", routeId:"control", riskId:"aggressive"}), 3, "aggressive adds a stage (capped at 3)");
// planStages splits loot across stages and never loses items
{
  const R = { cfg:{zoneId:"industrial", routeId:"reactor", riskId:"standard", trackedItemId:null},
    loot:["cable","fuse","servo","circuit_board","scrap_alloy"], scrap:30, dataCores:6 };
  const plan = app.planStages(R, 3);
  assert.equal(plan.stages.length, 3, "3 stages");
  const all = plan.stages.reduce((a,s)=>a.concat(s.loot), []);
  assert.equal(all.length, R.loot.length, "no loot lost across stages ("+all.length+")");
  assert(plan.pushDeath.length >= 2 && plan.pushDeath[1] > plan.pushDeath[0], "push death escalates with depth");
}

// no economy values hardcoded in app.js
const src = require("fs").readFileSync(P+"/app.js","utf8");
// every item id, in any quote style ("id", 'id', `id`) — PRB-43: single quotes slipped through before
for(const id of window.DATA.items.map(i => i.id))
  assert.equal((src.match(new RegExp("[\"'`]"+id+"[\"'`]","g"))||[]).length, 0, id + " hardcoded in app.js");
assert.equal((`x = 'medkit'`.match(new RegExp("[\"'`]medkit[\"'`]","g"))||[]).length, 1, "guard regex sees single quotes");

console.log("ALL LOGIC TESTS PASSED");

// Core (Node Raid) RaidResult v1 ingestion: valid, idempotent, consumes the handoff key.
{
  const st = app.freshState(); app._setState(st);
  const before = st.stash.cable || 0, raids = st.raids, deaths = st.deaths;
  const res = { schema:"protocol-rebirth/raid-result", version:1, raidId:"nodspel:t1", seed:"t1", outcome:"extract",
    levelsCleared:1, enemiesDefeated:2, nodesLit:1, remainingMs:1000, extracted:["cable","scrap_alloy"], lost:["fuse"], endedAt:1 };
  let stored = JSON.stringify(res), removed = false;
  const storage = { getItem:k => k === app.RAID_RESULT_KEY ? stored : null, removeItem:k => { if(k === app.RAID_RESULT_KEY){ stored = null; removed = true; } }, setItem:()=>{} };
  global.localStorage = { getItem:()=>null, setItem:()=>{} };
  const out = app.ingestPendingCoreResult(storage);
  assert(out.ok, "valid core result is ingested");
  assert.equal(st.stash.cable, before + 1); assert.equal(st.stash.scrap_alloy >= 1, true);
  assert.equal(st.raids, raids + 1); assert.equal(st.deaths, deaths);
  assert(removed, "handoff key is consumed");
  assert.equal(app.ingestPendingCoreResult(storage), null, "nothing pending after consume");
  assert.equal(app.ingestRaidResult(res).reason, "duplicate", "same raidId is never ingested twice");
  assert.equal(st.stash.cable, before + 1);
  assert.equal(app.ingestRaidResult({ ...res, raidId:"x", extracted:["not_an_item"] }).reason, "invalid");
  assert.equal(app.ingestRaidResult({ ...res, raidId:"y", version:2 }).reason, "invalid");
  console.log("core RaidResult ingestion OK");
}

// Deploy/return loop helpers.
{
  const url = app.coreLaunchUrl("meta-a-1", "s 1", "../index.html");
  assert.equal(url, "./nodspel/?seed=s%201&raidId=meta-a-1&return=..%2Findex.html");
  assert.equal(app.metaReturnPath("/proto/index.html"), "../index.html");
  assert.equal(app.metaReturnPath("/proto/"), "../");
  const l = app.newCoreLaunch(() => 0.5);
  assert(/^meta-[a-z0-9]+-80000000$/.test(l.raidId)); assert.equal(l.seed, "80000000-meta");
  assert.equal(app.coreResultSummary({ outcome:"extract", extracted:["cable","cable","fuse"], lost:[] }, { ok:true, added:["cable","cable","fuse"] }), "Node Raid: extracted — +2 Cable, +1 Fuse");
  assert.equal(app.coreResultSummary({ outcome:"death", extracted:[], lost:["fuse"] }, { ok:true }), "Node Raid: you died — no loot secured · lost 1");
  assert.equal(app.coreResultSummary({}, { ok:false }), null);
  console.log("deploy/return loop helpers OK");
}

// Owner decisions: timeout = death, XP from data, extract advances raid beats, items only.
{
  const base = { schema:"protocol-rebirth/raid-result", version:1, seed:"s", levelsCleared:1, enemiesDefeated:3, nodesLit:1, remainingMs:0, extracted:["cable"], lost:["fuse"], endedAt:1 };
  const X = window.DATA.bit.coreRaidXp;
  const st = app.freshState(); app._setState(st); st.modules.bit_bay = 1;
  const cur = JSON.stringify(st.cur);
  const t = app.ingestRaidResult({ ...base, raidId:"x-timeout", outcome:"timeout", reason:"timeout" });
  assert(t.ok); assert.equal(st.deaths, 1, "timeout counts as death");
  assert.equal(t.xp, X.perNode + 3*X.perEnemy + X.perLevelCleared, "death xp has no extract bonus");
  assert.equal(st.stash.fuse || 0, 0, "lost bag stays lost below bond 3");
  assert.equal(JSON.stringify(st.cur), cur, "no formula currency grants");
  const beat = st.beat;
  const e = app.ingestRaidResult({ ...base, raidId:"x-extract", outcome:"extract", reason:"extract", lost:[] });
  assert.equal(e.xp, X.perNode + 3*X.perEnemy + X.perLevelCleared + X.extractBonus);
  assert.equal(st.deaths, 1); assert.equal(st.bondXp, t.xp + e.xp);
  assert.equal(st.beat, window.DATA.progression.beats[beat].type === "raid" ? beat + 1 : beat, "extract advances a raid beat");
  st.bondXp = 1000;
  const d = app.ingestRaidResult({ ...base, raidId:"x-death", outcome:"death", reason:"abandon" });
  assert.equal(d.saved.bitRescue, "fuse", "bond 3+ rescues one lost item like simulated death");
  const off = app.freshState(); app._setState(off);
  assert.equal(app.ingestRaidResult({ ...base, raidId:"x-off", outcome:"extract" }).xp, 0, "no bond xp before BIT Bay");
  const lossSt = app.freshState(); app._setState(lossSt);
  const l = app.ingestRaidResult({ ...base, raidId:"x-loss", outcome:"death", reason:"death", extracted:["cable"] });
  assert.deepEqual(l.added, [], "a lost raid brings nothing home even if items are listed");
  assert.equal(lossSt.stash.cable || 0, 0);
  console.log("core raid decisions OK");
}

// Item-sourced currency: salvage_crate / data_core convert on ingest (no formula grants).
{
  const st = app.freshState(); app._setState(st);
  const s0 = st.cur.scrap, d0 = st.cur.dataCores;
  const r = app.ingestRaidResult({ schema:"protocol-rebirth/raid-result", version:1, raidId:"cur-1", seed:"c", outcome:"extract",
    levelsCleared:2, enemiesDefeated:0, nodesLit:0, remainingMs:0, extracted:["salvage_crate","salvage_crate","data_core","polymer_plate","servo"], lost:[], endedAt:1 });
  const I = Object.fromEntries(window.DATA.items.map(i => [i.id, i]));
  assert.equal(st.cur.scrap, s0 + 2*I.salvage_crate.grantsCurrency.scrap + 15, "crates become Scrap (+ L1+L2 extract bonus 5+10)");
  assert.equal(r.scrapBonus, 15, "extract bonus for 2 cleared levels");
  assert.equal(st.cur.dataCores, d0 + I.data_core.grantsCurrency.dataCores);
  assert.equal(st.stash.salvage_crate || 0, 0, "currency loot never sits in the stash");
  assert.equal(st.stash.polymer_plate, (app.freshState().stash.polymer_plate||0) + 1);
  assert(st.revealed.dataCores);
  assert(/\+48 Scrap.*extract bonus \+15 Scrap/.test(app.coreResultSummary({ outcome:"extract", lost:[] }, r)));
  console.log("item-sourced currency OK");
}

// Player stats: base + skills (by use) + gear, passed to core; gear at risk on the raid.
{
  const P = window.DATA.progression.playerStats;
  const st = app.freshState(); app._setState(st);
  assert.deepEqual(app.playerStats([]), P.base, "new player = base stats");
  const vest = app.playerStats(["scavenger_vest"]);
  assert.equal(vest.maxHealth, P.base.maxHealth); assert.equal(vest.shield, 25, "vest gives shield, not HP");
  assert.equal(app.statsParam(app.playerStats(["scout_rig"])), "spd:4.05,stl:0,hp:100,dcd:4000,srch:1,shd:10");
  const url = app.coreLaunchUrl("meta-x", "s", "../", { stats:app.playerStats([]), gear:["scout_rig"] });
  assert(url.endsWith("&stats=spd%3A3.6%2Cstl%3A0%2Chp%3A100%2Cdcd%3A4000%2Csrch%3A1%2Cshd%3A0&gear=scout_rig"), url);
  // skills from usage
  const xp = app.skillXpFrom({ skills:{ distanceM:400, dashes:10, holdNodes:2, damageTaken:200 } });
  assert.deepEqual(xp, { mobility:50, stealth:10, search:0, vitality:20, crafting:0 });
  assert.equal(app.skillXpFrom({ outcome:"extract", skills:{ healed:25 } }).vitality, 25 * P.skills.vitality.xp.perHeal + P.skills.vitality.xp.perSurvive, "heal + survive xp");
  assert.equal(app.skillXpFrom({ skills:{ searches:3 } }).search, 3 * P.skills.search.xp.perSearch, "search xp from containers");
  assert.deepEqual(Object.keys(P.skills), ["mobility","stealth","vitality","search","crafting"], "five automatic skills");
  assert.equal(app.skillXpFrom({ outcome:"extract", extracted:["a","b","c"], skills:{} }).crafting, 3, "crafting xp from extracted items");
  assert.equal(app.skillXpFrom({ outcome:"death", extracted:["a"], skills:{} }).crafting, 0);
  assert.equal(app.skillLevel("mobility", 19), 0); assert.equal(app.skillLevel("mobility", 20), 1);
  assert.equal(app.skillLevel("mobility", 60), 2); assert.equal(app.skillLevel("mobility", 1e6), P.skills.mobility.maxLevel);
  const base = { schema:"protocol-rebirth/raid-result", version:1, seed:"s", levelsCleared:1, enemiesDefeated:0, nodesLit:0, remainingMs:0, extracted:[], lost:[], endedAt:1,
    skills:{ distanceM:400, dashes:10, holdNodes:2, damageTaken:200 } };
  st.stash.scout_rig = 0;
  st.coreLaunch = { raidId:"g-death", gear:["scout_rig"] };
  const d = app.ingestRaidResult({ ...base, raidId:"g-death", outcome:"timeout" });
  assert.deepEqual(d.gearLost, ["scout_rig"], "timeout loses the gear"); assert.equal(st.stash.scout_rig, 0);
  assert.equal(st.coreLaunch, null);
  assert.equal(app.skillLevel("mobility"), 1, "mobility rose by use even on a loss");
  assert.deepEqual(d.skillUps.sort(), ["Mobility L1", "Vitality L1"]);
  st.coreLaunch = { raidId:"g-ok", gear:["scout_rig"] };
  const e = app.ingestRaidResult({ ...base, raidId:"g-ok", outcome:"extract", skills:{} });
  assert.deepEqual(e.gearLost, []); assert.equal(st.stash.scout_rig, 1, "extract brings the gear home");
  // v1.59: core reports equipped gear (gearOut): raid-found gear comes home, gear swapped out in the raid stays behind
  st.stash.scout_rig = 0; st.stash.smg_vector = 0; st.stash.scavenger_vest = 0;
  st.coreLaunch = { raidId:"g-swap", gear:["scout_rig"] };
  const g = app.ingestRaidResult({ ...base, raidId:"g-swap", outcome:"extract", skills:{}, gearOut:["scavenger_vest","smg_vector","basic_carbine","evil"] });
  assert.deepEqual(g.gearLost, ["scout_rig"], "swapped-out rig left in the raid"); assert.equal(st.stash.scout_rig, 0);
  assert.equal(st.stash.scavenger_vest, 1); assert.equal(st.stash.smg_vector, 1, "found weapon comes home"); assert(g.added.includes("smg_vector"));
  st.coreLaunch = { raidId:"g-die", gear:["scout_rig"] };
  const h = app.ingestRaidResult({ ...base, raidId:"g-die", outcome:"death", skills:{}, gearOut:["smg_vector"] });
  assert.equal(st.stash.smg_vector, 1, "death: equipped found gear is lost"); assert.deepEqual(h.gearLost, ["scout_rig"]);
  const lvl = app.playerStats([]);
  assert.equal(lvl.speed, Math.round((P.base.speed + P.skills.mobility.perLevel.speed) * 1000) / 1000, "skill level raises speed");
  assert.equal(lvl.maxHealth, P.base.maxHealth + P.skills.vitality.perLevel.maxHealth, "vitality raises max HP");
  // operator level: +2%/level above 1, capped at +20%
  assert.equal(app.operatorSpeedBonus(1), 0); assert.equal(app.operatorSpeedBonus(4), 0.06);
  assert.equal(app.operatorSpeedBonus(11), 0.2); assert.equal(app.operatorSpeedBonus(30), 0.2, "capped");
  // crafting discount
  const rec = { scrapCost:40 }; assert.equal(app.craftCost(rec), 40);
  st.skills.crafting = 1e6; assert.equal(app.craftCost(rec), Math.round(40 * (1 - 0.3)), "L10 crafting = −30% scrap");
  // weapon mastery stars from kills, applied to the launch weapon
  const T = P.weaponMastery.killsForStar;
  assert.equal(app.masteryStars("smg_vector", 0), 0); assert.equal(app.masteryStars("smg_vector", T[0]), 1); assert.equal(app.masteryStars("smg_vector", 1e4), 3);
  st.mastery = { basic_carbine:T[2] };
  const W = window.DATA.items.find(i => i.id === "basic_carbine").weapon, M = app.masteredWeapon("basic_carbine");
  assert(M.rld < W.rld && M.int < W.int && M.dmg === W.dmg, "3 stars: faster reload/fire, same damage");
  st.mastery = {};
  const k = app.ingestRaidResult({ ...base, raidId:"g-kills", outcome:"extract", weapon:"basic_carbine", enemiesDefeated:T[0], skills:{} });
  assert.equal(st.mastery.basic_carbine, T[0]); assert(/1\/3 stars/.test(k.starUp), "first star announced");
  // save migration athletics → mobility
  assert.deepEqual(app.migrateSkills({ skills:{ athletics:30, vitality:9, stealth:2 } }).skills, { mobility:30, vitality:9, stealth:2 }, "vitality xp kept");
  assert(/Operator/.test(app.statsCardHtml(["scout_rig"])) && /Gear at risk: Scout Rig/.test(app.statsCardHtml(["scout_rig"])));
  // Raid bag capacity: base 4, Storage +2, armour pockets; passed to core as &bag=
  st.modules.storage = 0;
  assert.equal(app.raidBagCapacity([]), 4);
  assert.equal(app.raidBagCapacity(["scavenger_vest"]), 5, "vest adds a pocket");
  st.modules.storage = 1;
  assert.equal(app.raidBagCapacity(["scout_rig"]), 6, "Storage L1 raises raid bag");
  st.modules.storage = 3; assert.equal(app.raidBagCapacity(["scout_rig"]), 8, "each Storage level +1");
  st.opXp = 1e6; assert.equal(app.raidBagCapacity(["scout_rig"]), 10, "operator milestones; capped at 10"); st.opXp = 0; st.modules.storage = 1;
  assert(app.coreLaunchUrl("m", "s", "../", { bag:7 }).includes("&bag=7"));
  console.log("player stats OK");
}
