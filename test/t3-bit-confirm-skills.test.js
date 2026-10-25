// v1.86 T3 (PRB-94): BIT haul waits for Confirm (persisted, no double deposit); three BIT skills, with real effects.
// v1.95: the three skills are now row-2 "core" talent nodes (data/bit-talents.js) — passive once learned, not a
// single S.bitSkill toggle; see test/v195-talents.test.js for the rest of the talent tree.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = u => { w.launchURL = u; };
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, bitShieldBurst, bitSkillOn, scoutLead, rollScavenge, scavPending, learnTalent };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:2, fabricator:1, bit_bay:1, storage:1 }); base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; base.beat = g.D.progression.beats.length - 1; base.bondXp = 250;
const fresh = (mut) => { const s = JSON.parse(JSON.stringify(base)); if(mut) mut(s); return boot(s); };
const finishRun = b => { b.A.sendScavenge(); const I = b.S().idle; I.scav.returnAt = 0; b.A.go("base"); b.A.go("bit"); return I; };

// 1) return -> pending, nothing deposited
{ const b = fresh(), sc = b.S().cur.scrap; const I = finishRun(b);
  assert(!I.scav && I.scavPending, "pending after return"); assert.equal(b.S().cur.scrap, sc, "no auto deposit");
  const card = b.d.querySelector(".idlecard.scav.pending"); assert(card && card.querySelector("button.primary"), "BIT screen shows primary Confirm card");
  // announced, not deposited
  const loot = JSON.parse(JSON.stringify(I.scavPending)), stash0 = JSON.parse(JSON.stringify(b.S().stash));
  // 2) pending survives raid-first + refresh; blocks new run / expedition
  b.A.sendScavenge(); assert(!b.S().idle.scav, "no second run while a haul waits");
  b.S().modules.bit_bay = 1; b.A.sendExpedition(); assert(!b.S().expedition, "no expedition while a haul waits");
  const saved = JSON.parse(b.w.localStorage.getItem("pr_meta_save")); assert.deepEqual(saved.idle.scavPending, loot, "pending saved");
  const r = boot(saved); r.A.go("base"); assert.deepEqual(r.S().idle.scavPending, loot, "reload keeps pending"); assert.equal(r.S().cur.scrap, sc);
  // 3) popup + confirm deposits once
  r.A.openHaul(); const pop = r.d.querySelector("#overlay .bpop.haulpop"); assert(pop && pop.classList.contains("pop-card") && pop.querySelector(".pop-x"), "shared overlay popup with X");
  r.w.eval(pop.querySelector("button.primary").getAttribute("onclick"));
  assert.equal(r.S().cur.scrap, sc + loot.scrap, "confirm deposits scrap"); assert(!r.S().idle.scavPending);
  for(const id in loot.items) assert.equal((r.S().stash[id] || 0) + ((r.S().armory || {})[id] || 0), (stash0[id] || 0) + loot.items[id], "confirm deposits " + id);
  const after = JSON.stringify([r.S().cur, r.S().stash]); r.A.confirmHaul(); r.A.confirmHaul(); assert.equal(JSON.stringify([r.S().cur, r.S().stash]), after, "no double deposit");
  const r2 = boot(JSON.parse(r.w.localStorage.getItem("pr_meta_save"))); assert(!r2.S().idle.scavPending, "cleared pending persists");
  r2.A.sendScavenge(); assert(r2.S().idle.scav, "can send again after confirm"); }

// 4) welcome-back announces, does not deposit
{ const b = fresh(); b.A.sendScavenge(); const run = b.S().idle.scav; const sc = b.S().cur.scrap;
  const s = JSON.parse(JSON.stringify(b.S())); s.idle.lastSeen -= 3600000; s.idle.scav.returnAt = 0; const c = boot(s); c.A.go("base");
  assert.equal(c.S().cur.scrap, sc, "welcome-back does not deposit"); assert(/BIT is back/.test(c.d.querySelector(".welcome").textContent)); assert(c.S().idle.scavPending); }

// 5) v1.95 PART 2 UI: the three skills are now `.talnode.core` in the TALENTS tab of the BIT screen, gated by
// branch spend (not a direct bond threshold) — see test/v195-talents.test.js for the full UI assertions.
{ const b = fresh(s => { s.bondXp = 0; }); b.A.go("bit");
  assert.equal(b.d.querySelectorAll(".talnode.core").length, 3, "three core nodes, one per branch");
  assert.equal(b.d.querySelectorAll(".talnode.core.locked").length, 3, "no points spent in any branch: all core nodes locked"); }
{ const b = fresh(s => { s.bondXp = 250; }); // bond 5 -> 4 points: enough to open exactly one branch's row 2 (gate: 2 spent)
  for(let i = 0; i < 3; i++) b.T.learnTalent("guardian_plating"); b.A.go("bit");
  assert(!b.d.querySelector('.talnode.core[onclick*="shield_burst"]').classList.contains("locked"), "row 2 opens once enough points are spent in that branch");
  assert(b.d.querySelector('.talnode.core[onclick*="zone_scout"]').classList.contains("locked"), "a different branch's core stays locked");
  assert(!b.T.bitSkillOn("shield_burst"), "row open is not the same as learned: it must still be learned to turn on"); }
// Core nodes sit at row 2 (3 points in the branch's row-1 node, then 1 more): learning one no longer locks out the others.
const learnCore = (b, row1Id, coreId) => { for(let i = 0; i < 3; i++) b.T.learnTalent(row1Id); return b.T.learnTalent(coreId); };
{ const b = fresh(s => { s.bondXp = 250; }); // bond 5 -> 4 points, exactly enough for one branch's core node
  assert(learnCore(b, "guardian_plating", "shield_burst"), "shield_burst core node learns");
  assert(b.T.bitSkillOn("shield_burst") && !b.T.bitSkillOn("loot_priority"), "only the learned core is on");
  const again = boot(JSON.parse(b.w.localStorage.getItem("pr_meta_save")));
  assert(again.T.bitSkillOn("shield_burst"), "learned talents persist (never lost)"); }
{ const b = fresh(s => { s.bondXp = 250; });
  assert(learnCore(b, "scav_deep_pockets", "loot_priority"));
  assert(b.T.bitSkillOn("loot_priority") && !b.T.bitSkillOn("shield_burst")); }

// 6) effects (now gated on the learned core node, not S.bitSkill)
{ // shield burst raises deploy shield by the data amount, only while learned
  const deploy = learn => { const b = fresh(s => { s.bondXp = 250; }); if(learn) learnCore(b, "guardian_plating", "shield_burst"); b.A.go("prep"); b.A.deployNodeRaid(); return b.S().coreLaunch.stats.shield; };
  const off = deploy(false), on = deploy(true);
  assert.equal(on - off, g.D.bit.skills.find(k => k.id === "shield_burst").shield + g.D.bitTalents.branches.find(x => x.id === "guardian").nodes.find(n => n.id === "guardian_plating").effect.perRank[2],
    "shield burst + maxed Plating add their data-driven shield together"); }
{ // loot priority biases scav picks to the tracked part (only when the part is in the scavenge pools)
  const b = fresh(s => { s.bondXp = 250; s.tracked = { module:"fabricator", level:2 }; }); learnCore(b, "scav_deep_pockets", "loot_priority");
  const n = b.D.idle.scavenge.t1Count[0] + 3; // Deep Pockets maxed at rank 3: +3 basic parts
  assert.equal(b.T.rollScavenge(() => 0.01, { itemId:"cable", p:0.6 }).items.cable, n, "low rolls: every basic pick goes to the tracked part");
  assert(!b.T.rollScavenge(() => 0.99, { itemId:"cable", p:0.6 }).items.cable || b.D.idle.scavenge.t1.length === 1, "high rolls: normal pool");
  const pool = b.D.idle.scavenge.t1.concat(b.D.idle.scavenge.t2), want = pool.find(id => b.D.modules.find(m => m.id === "fabricator").levels.find(l => l.level === 2).cost.items[id]);
  assert(want, "fabricator L2 needs a scavengable part"); b.S().stash[want] = 0;
  const orig = b.w.Math.random; b.w.Math.random = () => 0.01; b.A.sendScavenge(); b.w.Math.random = orig;
  assert(b.S().idle.scav.loot.items[want] >= 1, "sent run carries the tracked part"); }
{ // zone scout marks the lead zone/route and reveals drops, only once the core node is learned
  const b = fresh(s => { s.bondXp = 250; s.tracked = { module:"bit_bay", level:2 }; s.stash = {}; }); learnCore(b, "scout_keen_sensors", "zone_scout");
  assert(b.T.bitSkillOn("zone_scout"));
  assert(b.T.scoutLead(), "scout finds a lead for the tracked part"); b.A.go("prep");
  assert(b.d.querySelector(".scoutnote"), "scout note rendered"); assert(b.d.body.textContent.includes("BIT SCOUT"), "lead zone marked");
  const off = fresh(s => { s.bondXp = 250; s.tracked = { module:"bit_bay", level:2 }; s.stash = {}; }); assert.equal(off.T.scoutLead(), null, "no hint when the node is not learned"); }
// 7) Queued notices wait for the persistent BIT overlay without scheduling a retry loop,
// survive tab replacement, and appear when the screen closes.
(async () => {
  const b = fresh();
  try {
    await new Promise(resolve => setImmediate(resolve)); // install the DOMContentLoaded observer
    b.A.go("bit");
    const delays = [], nativeTimeout = b.w.setTimeout.bind(b.w);
    b.w.setTimeout = (fn, ms, ...args) => { delays.push(ms); return nativeTimeout(fn, ms, ...args); };
    b.w.eval('toast("Queued talent notice")');
    assert.deepEqual(delays, [], "waiting behind BIT must not schedule recurring timers");
    assert(!b.d.querySelector("#toast .toastmsg"), "notice stays hidden while BIT is open");
    b.A.bitTab("tasks");
    await new Promise(resolve => setImmediate(resolve));
    assert(!b.d.querySelector("#toast .toastmsg"), "replacing the BIT overlay keeps the notice queued");
    b.d.querySelector("#overlay .pop-x").click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(b.d.querySelector("#toast .toastmsg").textContent, "Queued talent notice", "closing BIT wakes the queued notice");
    console.log("T3 BIT CONFIRM + SKILLS TEST PASSED");
  } finally { b.w.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
