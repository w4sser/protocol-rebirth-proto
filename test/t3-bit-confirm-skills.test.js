// v1.86 T3 (PRB-94): BIT haul waits for Confirm (persisted, no double deposit); three BIT skills, one active at a time, with real effects.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = u => { w.launchURL = u; };
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, bitShieldBurst, bitSkillOn, scoutLead, rollScavenge, scavPending };");
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

// 5) skills: unlock by bond, one active
{ const b = fresh(s => { s.bondXp = 0; }); b.A.go("bit");
  assert.equal(b.d.querySelectorAll(".bitskill").length, 3, "three skill rows"); assert.equal(b.d.querySelectorAll(".bitskill:not(.locked)").length, 0, "all locked at bond 1");
  b.A.setBitSkill("zone_scout"); assert(!b.S().bitSkill, "locked skill cannot be set"); }
{ const b = fresh(s => { s.bondXp = 150; }); b.A.go("bit");   // bond 4
  assert.equal(b.d.querySelectorAll(".bitskill:not(.locked)").length, 3);
  b.A.setBitSkill("shield_burst"); b.A.setBitSkill("loot_priority");
  assert.equal(b.S().bitSkill, "loot_priority", "one active: switching replaces"); assert.equal(b.d.querySelectorAll(".bitskill.on").length, 1);
  assert(!b.T.bitSkillOn("shield_burst") && b.T.bitSkillOn("loot_priority"));
  b.A.setBitSkill("loot_priority"); assert.equal(b.S().bitSkill, null, "tap active to turn off");
  b.A.setBitSkill("shield_burst"); assert.equal(boot(JSON.parse(b.w.localStorage.getItem("pr_meta_save"))).S().bitSkill, "shield_burst", "active skill persists"); }

// 6) effects
{ // shield burst raises deploy shield by the data amount, only while active
  const stat = b => new URL(b.w.launchURL, "http://localhost/").searchParams.get("stats");
  const deploy = sk => { const b = fresh(s => { s.bitSkill = sk; }); b.A.go("prep"); b.A.deployNodeRaid(); return b.S().coreLaunch.stats.shield; };
  const off = deploy(null), on = deploy("shield_burst"); assert.equal(on - off, g.D.bit.skills.find(k => k.id === "shield_burst").shield, "shield burst adds data-driven shield"); assert.equal(deploy("zone_scout"), off, "other skill: no shield"); }
{ // loot priority biases scav picks to the tracked part (only when the part is in the scavenge pools)
  const b = fresh(s => { s.bitSkill = "loot_priority"; s.tracked = { module:"fabricator", level:2 }; });
  const n = b.D.idle.scavenge.t1Count[0];
  assert.equal(b.T.rollScavenge(() => 0.01, { itemId:"cable", p:0.6 }).items.cable, n, "low rolls: every basic pick goes to the tracked part");
  assert(!b.T.rollScavenge(() => 0.99, { itemId:"cable", p:0.6 }).items.cable || b.D.idle.scavenge.t1.length === 1, "high rolls: normal pool");
  const pool = b.D.idle.scavenge.t1.concat(b.D.idle.scavenge.t2), want = pool.find(id => b.D.modules.find(m => m.id === "fabricator").levels.find(l => l.level === 2).cost.items[id]);
  assert(want, "fabricator L2 needs a scavengable part"); b.S().stash[want] = 0;
  const orig = b.w.Math.random; b.w.Math.random = () => 0.01; b.A.sendScavenge(); b.w.Math.random = orig;
  assert(b.S().idle.scav.loot.items[want] >= 1, "sent run carries the tracked part"); }
{ // zone scout marks the lead zone/route and reveals drops without bond 4
  const b = fresh(s => { s.bondXp = 80; s.bitSkill = "zone_scout"; s.tracked = { module:"bit_bay", level:2 }; s.stash = {}; });
  assert(b.T.bitSkillOn("zone_scout"));
  assert(b.T.scoutLead(), "scout finds a lead for the tracked part"); b.A.go("prep");
  assert(b.d.querySelector(".scoutnote"), "scout note rendered"); assert(b.d.body.textContent.includes("BIT SCOUT"), "lead zone marked");
  const off = fresh(s => { s.bondXp = 80; s.tracked = { module:"bit_bay", level:2 }; s.stash = {}; }); assert.equal(off.T.scoutLead(), null, "no hint when skill is not active"); }
console.log("T3 BIT CONFIRM + SKILLS TEST PASSED");
