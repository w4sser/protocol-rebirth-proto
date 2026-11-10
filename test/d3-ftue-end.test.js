// D3.10 Decision 2: forced FTUE ends after the first ordinary successful extraction;
// insurance and paid bag recovery are gone from the core loop. Existing saves are
// never migrated down. Run: node test/d3-ftue-end.test.js
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
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + ";window.T={state:()=>S,ftueOver,ingestRaidResult,applyRaidResult,nextUpgradeHtml,have};");
  w.A.startFtueDirect = () => {};
  return w;
}
const text = w => w.document.getElementById("app").textContent;
const html = w => w.document.getElementById("app").innerHTML;
const beatOf = (w, id) => w.DATA.progression.beats.findIndex(b => b.id === id);
function afterCoreOnRaid1(w){
  const S = w.T.state();
  S.introSeen = true;
  S.modules.rebirth_core = 1;
  S.baseState = "core_habitable";
  S.modules.fabricator = 0;
  S.beat = beatOf(w, "raid_1");
  S.tracked = { module:"fabricator", level:1 };
  return S;
}

// 1) Before the first ordinary extract, FTUE is still on — even after Core L1.
{
  const w = boot(null);
  const S = w.T.state();
  S.introSeen = true;
  S.beat = beatOf(w, "core_l1");
  S.modules.fabricator = 0;
  assert.equal(w.T.ftueOver(), false, "core_l1 is still forced FTUE");
  afterCoreOnRaid1(w);
  assert.equal(w.T.ftueOver(), false, "raid_1 before extract is still forced FTUE");
  assert.equal(S.modules.fabricator, 0);
}

// 2) The intro/FTUE extract (beat type intro) does not end forced FTUE.
{
  const w = boot(null);
  w.A.startFtueDirect = () => {};
  w.dispatchEvent(new w.Event("pr:splash-finished"));
  // boot stubbed startFtueDirect; fire a crafted intro extract while still on tutorial
  const S = w.T.state();
  assert.equal(w.DATA.progression.beats[S.beat].id, "tutorial", "fresh save starts on the intro beat");
  const r = { schema:"protocol-rebirth/raid-result", version:1, raidId:"nodspel:intro", seed:"intro",
    outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["scrap_alloy","scrap_alloy"], lost:[], endedAt:Date.now(), kitLeft:{ medkit:1 } };
  w.T.ingestRaidResult(r);
  assert.equal(w.T.ftueOver(), false, "intro extract must not end forced FTUE");
}

// 3) Successful ordinary raid_1 extract ends FTUE even if Fabricator is still unbuilt.
//    Guaranteed raid_1 drops cover Fabricator L1, so the honest post-FTUE card says the
//    upgrade is ready back home — it does not auto-build Fabricator or invent extra parts.
{
  const w = boot(null);
  const S = afterCoreOnRaid1(w);
  w.A.go("prep");
  w.A.deploy();
  w.A.raidStep();
  assert.equal(w.T.ftueOver(), true, "first ordinary extract ends forced FTUE");
  assert.equal(S.modules.fabricator, 0, "Fabricator L1 is not required / not auto-built");
  const body = text(w);
  assert(body.includes("READY BACK HOME") || body.includes("CLOSEST UPGRADE"), "result uses honest post-FTUE Fabricator progress, not the forced ONE MORE RAID card");
  assert(!body.includes("ONE MORE RAID"), "post-FTUE result does not force another raid");
}

// 4) An incomplete ordinary extract (only some Fabricator parts) is also honest: no fake completion.
{
  const w = boot(null);
  const S = afterCoreOnRaid1(w);
  const R = { cfg:{ zoneId:"industrial", riskId:"standard", insuranceId:"none", loadout:["basic_carbine"], trackedItemId:null },
    zone:"industrial", outcome:"extract", loot:["cable"], scrap:0, dataCores:0, trackedFound:false };
  w.T.applyRaidResult(R);
  assert.equal(w.T.ftueOver(), true, "any successful raid_1 extract ends FTUE");
  assert.equal(S.modules.fabricator, 0);
  const card = w.T.nextUpgradeHtml();
  assert(card.includes("CLOSEST UPGRADE"), "missing Fabricator parts show closest-upgrade progress");
  assert(!card.includes("READY TO BUILD"), "does not claim Fabricator L1 is complete when parts are short");
  assert(!card.includes("ONE MORE RAID"), "does not force another scripted raid");
}

// 5) Death on raid_1 does not end FTUE and does not recover items via insurance.
{
  const w = boot(null);
  const S = afterCoreOnRaid1(w);
  S.retentionMode = "full";
  // Deploy already takes gear out of the stash; simulate that so a failed recovery
  // cannot be masked by an item that never left home.
  S.stash.scavenger_vest = 0;
  const R = { cfg:{ zoneId:"industrial", riskId:"standard", insuranceId:"premium",
    loadout:["basic_carbine","scavenger_vest"], trackedItemId:null },
    zone:"industrial", outcome:"death", loot:["cable","fuse"], scrap:20, dataCores:0, trackedFound:false };
  w.T.applyRaidResult(R);
  assert.equal(w.T.ftueOver(), false, "raid_1 death keeps the player in FTUE");
  assert.equal(S.beat, beatOf(w, "raid_1"), "death does not advance the beat");
  assert.equal(R.saved.insured.length, 0, "premium insurance recovers nothing");
  assert.equal(w.T.have("scavenger_vest"), 0, "equipped vest is not returned by insurance");
}

// 6) Existing saves: beat already past raid_1 is ftueOver; stash is never reduced.
{
  const seed = boot(null);
  const S0 = seed.T.state();
  S0.introSeen = true;
  S0.stash.scrap_alloy = 5;
  S0.stash.cable = 3;
  S0.modules.rebirth_core = 1;
  S0.modules.fabricator = 0;
  S0.beat = beatOf(seed, "fabricator_l1");
  const save = JSON.parse(JSON.stringify(S0));
  const w = boot(save);
  assert.equal(w.T.ftueOver(), true, "existing save at fabricator_l1 is immediately ftueOver");
  assert.equal(w.T.state().stash.scrap_alloy, 5, "existing save keeps 5 Scrap Alloy");
  assert.equal(w.T.state().stash.cable, 3, "existing save keeps other stash items");
}
{
  const seed = boot(null);
  const S0 = seed.T.state();
  S0.introSeen = true;
  S0.stash.scrap_alloy = 5;
  S0.modules.rebirth_core = 1;
  S0.modules.fabricator = 1;
  S0.beat = beatOf(seed, "choice_upgrade");
  const w = boot(JSON.parse(JSON.stringify(S0)));
  assert.equal(w.T.ftueOver(), true, "existing save at choice_upgrade remains ftueOver");
  assert.equal(w.T.state().stash.scrap_alloy, 5);
}

// 7) Raid prep never shows Insurance, before or after Fabricator L1. Full prep keeps WATCH AD → Signals.
{
  const w = boot(null);
  afterCoreOnRaid1(w);
  w.A.go("prep");
  assert(!text(w).includes("Insurance"), "guided pre-Fab prep has no Insurance picker");
  const S = w.T.state();
  S.modules.fabricator = 1;
  S.beat = beatOf(w, "raid_2");
  w.A.go("prep");
  assert(!text(w).includes("Insurance"), "full post-Fab / raid_2 prep has no Insurance picker");
  assert(html(w).includes("WATCH AD") && html(w).includes("SIGNALS"), "WATCH AD → Signals still lives on full raid prep");
}

// 8) Death result in full retention mode does not offer RESTORE BAG.
{
  const w = boot(null);
  const S = afterCoreOnRaid1(w);
  S.retentionMode = "full";
  w.A.devForce("death");
  w.A.go("prep");
  w.A.deploy();
  w.A.raidStep();
  assert(!text(w).includes("RESTORE BAG"), "paid bag recovery is gone from the death result");
  assert.equal(w.T.ftueOver(), false, "forced death on raid_1 still leaves FTUE on");
}

console.log("D3.10 FTUE-END TEST PASSED");
