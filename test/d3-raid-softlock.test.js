// v2.28.21: Carlos softlock -- fresh start, Core L0, 1/2 Scrap Alloy secured, and RAID was locked
// (navAllowed("prep") / A.go("prep") only consulted baseAllows("navigation","prep"), which is false
// in core_found) even though the goal could only be finished by raiding for the missing Alloy. Fixed
// with goalNeedsRaidLoot(): RAID stays open whenever progressionGoal() is short a raid-findable part.
// Run: node test/d3-raid-softlock.test.js
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(seedSave){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/" });
  const w = dom.window;
  w.localStorage = (() => { let s = {}; return { getItem:k=>s[k]??null, setItem:(k,v)=>s[k]=v, removeItem:k=>delete s[k] }; })();
  w.URL.createObjectURL = () => "blob:fake";
  if(seedSave) w.localStorage.setItem("pr_meta_save", JSON.stringify(seedSave));
  w.PR_NAVIGATE = u => { w.launchURL = u; };
  for(const s of FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + ";window.T={state:()=>S,ingestRaidResult,progressionGoal,navAllowed,goalNeedsRaidLoot,raidFindable};");
  w.A.startFtueDirect = () => {}; // never auto-launch the FTUE raid mid-test
  return w;
}
const beatOf = (w, id) => w.DATA.progression.beats.findIndex(b => b.id === id);
const raidResult = (raidId, extracted) => ({ schema:"protocol-rebirth/raid-result", version:1, raidId, outcome:"extract", extracted, lost:[], levelsCleared:1 });

// 1) Regression: Carlos's exact reported state (a returned-from-intro fresh profile, Core L0, 1/2 Alloy).
{
  const w = boot(null);
  const S = w.T.state();
  S.introSeen = true;
  S.beat = beatOf(w, "core_l1");
  assert.equal(S.baseState, "core_found", "Carlos is still in core_found");
  assert.equal(S.modules.rebirth_core, 0, "Core is still L0");
  assert.equal(S.stash.scrap_alloy, 1, "fresh stash has only 1 of the 2 Scrap Alloy Core L1 needs");

  const g = w.T.progressionGoal();
  assert.equal(g.module, "rebirth_core", "goal is Core L1");
  assert.equal(g.ready, false, "goal is not yet affordable");
  const alloyPart = g.parts.find(p => p.id === "scrap_alloy");
  assert(alloyPart, "Scrap Alloy is a listed part");
  assert.equal(alloyPart.need - alloyPart.secured, 1, "goal needs exactly 1 more Scrap Alloy");

  assert.equal(w.T.goalNeedsRaidLoot(), true, "the missing Scrap Alloy is raid-findable, so the goal needs raid loot");
  assert.equal(w.T.navAllowed("prep"), true, "RAID must be allowed while the goal still needs raid loot");

  w.A.go("base");
  const tab = w.document.querySelector("#tabs .nav-prep");
  assert(tab, "RAID tab is rendered");
  assert(!tab.classList.contains("locked"), "RAID tab is not shown locked");
  assert(!tab.hasAttribute("disabled"), "RAID tab is not disabled");

  w.A.raidForModule("rebirth_core");
  assert.equal(w.document.getElementById("app").className, "s-prep", "RAID FOR SCRAP ALLOY actually opens Raid Prep, not a no-op");
  assert(w.document.querySelector("#app .node-raid-launch"), "prep offers a DEPLOY button");
}

// 2) Guard: a fresh save never reaches a state where the goal needs raid loot while RAID is disabled.
const invariantHolds = w => !(w.T.goalNeedsRaidLoot() && !w.T.navAllowed("prep"));

// (a) raw freshState(): 1 starting Alloy, Core L0 -- the state that used to fail this invariant.
{
  const w = boot(null);
  assert.equal(w.T.state().stash.scrap_alloy, 1, "raw freshState starts with 1 Scrap Alloy");
  assert(invariantHolds(w), "(a) raw freshState: RAID must not be disabled while the goal needs raid loot");
}

// (b) a simulated FTUE extract that brings home 0 extra Alloy and gets no top-up (no S.coreLaunch.ftue
// match, e.g. a stale/mismatched raidId) -- the goal is still short, so RAID must stay open.
{
  const w = boot(null);
  const S = w.T.state();
  const res = w.T.ingestRaidResult(raidResult("no-topup-1", []));
  assert.equal(res.ok, true, "raid result ingests");
  assert.equal(S.stash.scrap_alloy, 1, "no top-up applied: still short");
  assert(invariantHolds(w), "(b) extract with no top-up: RAID must not be disabled while the goal needs raid loot");
}

// (c) a successful FTUE extract that DOES get the D3.10 top-up (S.coreLaunch.ftue + matching raidId):
// the goal becomes affordable. RAID may be locked again here -- that's fine, the goal no longer needs it.
{
  const w = boot(null);
  const S = w.T.state();
  S.coreLaunch = { raidId:"topup-1", ftue:true, gear:[] };
  const res = w.T.ingestRaidResult(raidResult("topup-1", []));
  assert.equal(res.ok, true, "raid result ingests");
  assert.equal(S.stash.scrap_alloy, 3, "D3.10 top-up fires on a matching FTUE extract and covers Core L1 (1 start + 2 top-up)");
  assert.equal(w.T.progressionGoal().ready, true, "goal is affordable once the top-up lands");
  assert.equal(w.T.goalNeedsRaidLoot(), false, "goal no longer needs raid loot");
  assert(invariantHolds(w), "(c) extract with top-up: invariant holds (goal is ready)");
}

// (d) after Core L1 (core_habitable): RAID is allowed through the ordinary baseAllows path.
{
  const w = boot(null);
  const S = w.T.state();
  S.modules.rebirth_core = 1;
  S.baseState = "core_habitable";
  assert.equal(w.T.navAllowed("prep"), true, "(d) core_habitable allows RAID via baseAllows");
  assert(invariantHolds(w), "(d) core_habitable: invariant holds");
}

console.log("D3.10 RAID SOFTLOCK TEST PASSED");
