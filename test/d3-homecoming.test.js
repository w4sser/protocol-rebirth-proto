// D3.10 homecoming: BIT greeting (no tutorial lines before it), a smaller start stash covered by the
// first FTUE raid's guaranteed Scrap Alloy finds, the single RESTORE EMERGENCY POWER action for Core
// L1, and Fabricator as the only next goal/destination until it is built. Existing saves are never
// migrated down. Run: node test/d3-homecoming.test.js (needs jsdom, same as ftue-direct.test.js)
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
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + ";window.T={state:()=>S,ingestRaidResult,progressionGoal,navAllowed};");
  return w;
}
const text = w => w.document.getElementById("app").textContent;
const html = w => w.document.getElementById("app").innerHTML;

// 1) New profile start stash: 1 Scrap Alloy (not 3). Only affects freshState(), not existing saves.
{
  const w = boot(null);
  assert.equal(w.T.state().stash.scrap_alloy, 1, "fresh profile starts with 1 spare Scrap Alloy");
  assert.equal(w.T.state().stash.medkit, 1, "starter medkit unchanged");
}

// 2) Existing-save safety: a save already holding 3+ Scrap Alloy (the pre-D3.10 default, or extras
// from any source) keeps that count after boot. No migration ever subtracts from the stash.
{
  const seed = boot(null);
  seed.A.startFtueDirect = () => {};
  seed.T.state().introSeen = true;
  seed.T.state().stash.scrap_alloy = 3;
  const save3 = JSON.parse(JSON.stringify(seed.T.state()));
  const w = boot(save3);
  assert.equal(w.T.state().stash.scrap_alloy, 3, "existing save keeps all 3 Scrap Alloy -- never subtracted");
}
{
  const seed = boot(null);
  seed.A.startFtueDirect = () => {};
  seed.T.state().introSeen = true;
  seed.T.state().stash.scrap_alloy = 5;
  const save5 = JSON.parse(JSON.stringify(seed.T.state()));
  const w = boot(save5);
  assert.equal(w.T.state().stash.scrap_alloy, 5, "existing save with extra Alloy (5) also keeps its count");
}

// 3) BIT greeting, Core as the single next step, and the RESTORE EMERGENCY POWER CTA.
{
  const w = boot(null);
  w.dispatchEvent(new w.Event("pr:splash-finished"));
  const url = new w.URL(w.launchURL, "http://localhost/");
  assert.equal(url.searchParams.get("ftue"), "1", "fresh profile auto-launches the first FTUE raid");
  const result = { schema:"protocol-rebirth/raid-result", version:1, raidId:url.searchParams.get("raidId"), seed:url.searchParams.get("seed"),
    outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["scrap_alloy","scrap_alloy"], lost:[], endedAt:Date.now(), kitLeft:{ medkit:1 } };
  w.T.ingestRaidResult(result);
  w.A.go("base");
  assert(text(w).includes("You're late, but you're back."), "owner's exact greeting line is shown");
  assert(!text(w).includes("followed you home"), "old 'followed you home' copy is gone");

  w.A.dismissIntro();
  assert.equal(w.T.progressionGoal().module, "rebirth_core", "Core is the single next step after the greeting");
  assert.equal(w.T.state().stash.scrap_alloy, 3, "1 start + 2 guaranteed FTUE finds = enough for Core L1");
  w.A.go("base");
  assert(html(w).includes("RESTORE EMERGENCY POWER"), "CTA reads RESTORE EMERGENCY POWER, not generic BUILD/ACTIVATE");

  // 4) After building Core L1: Fabricator is the only next goal, Bay/Vault plates are not in the DOM,
  // and Vendor/Weapons are not offered as nav yet.
  w.A.build("rebirth_core");
  w.A.go("base");
  assert.equal(w.T.progressionGoal().module, "fabricator", "Fabricator is the only next goal after Core");
  assert(!/data-room="storage"/.test(html(w)), "Vault plate hidden until Fabricator L1");
  assert(!/data-room="bit_bay"/.test(html(w)), "BIT Bay plate hidden until Fabricator L1");
  assert(/data-room="fabricator"/.test(html(w)), "Fabricator is the one visible destination");
  assert.equal(w.T.navAllowed("vendor"), false, "Shop is not offered as nav until Fabricator L1");
  assert.equal(w.T.navAllowed("arms"), false, "Weapons is not offered as nav until Fabricator L1");
  assert(w.document.querySelector("#tabs .nav-vendor[disabled]"), "Shop tab is disabled in the DOM");
  assert(w.document.querySelector("#tabs .nav-arms[disabled]"), "Weapons tab is disabled in the DOM");
}

// 5) First-FTUE extract softlock guard: tops up missing Scrap Alloy exactly once, never duplicates,
// never pulls from the existing stash, and never fires on a later or non-FTUE raid.
{
  const w = boot(null);
  w.dispatchEvent(new w.Event("pr:splash-finished"));
  const url = new w.URL(w.launchURL, "http://localhost/");
  const before = w.T.state().stash.scrap_alloy || 0;
  const r0 = { schema:"protocol-rebirth/raid-result", version:1, raidId:url.searchParams.get("raidId"), seed:url.searchParams.get("seed"),
    outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["cable"], lost:[], endedAt:Date.now(), kitLeft:{ medkit:1 } };
  const res0 = w.T.ingestRaidResult(r0);
  assert.equal(w.T.state().stash.scrap_alloy, before + 2, "top-up grants the 2 missing Scrap Alloy once");
  assert.equal(res0.added.filter(id => id === "scrap_alloy").length, 2, "top-up is reflected in the ingested added list");

  // A later raid (same session, S.coreLaunch already cleared) never gets topped up again.
  const afterFirst = w.T.state().stash.scrap_alloy;
  const r1 = { schema:"protocol-rebirth/raid-result", version:1, raidId:"nodspel:later-raid", seed:"later",
    outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["cable"], lost:[], endedAt:Date.now(), kitLeft:{ medkit:1 } };
  w.T.ingestRaidResult(r1);
  assert.equal(w.T.state().stash.scrap_alloy, afterFirst, "a later raid never gets the FTUE top-up");
}
{
  // Already extracted 2+ in the FTUE raid itself -> no duplicate top-up.
  const w = boot(null);
  w.dispatchEvent(new w.Event("pr:splash-finished"));
  const url = new w.URL(w.launchURL, "http://localhost/");
  const before = w.T.state().stash.scrap_alloy || 0;
  const r = { schema:"protocol-rebirth/raid-result", version:1, raidId:url.searchParams.get("raidId"), seed:url.searchParams.get("seed"),
    outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["scrap_alloy","scrap_alloy","cable"], lost:[], endedAt:Date.now(), kitLeft:{ medkit:1 } };
  const res = w.T.ingestRaidResult(r);
  assert.equal(w.T.state().stash.scrap_alloy, before + 2, "no duplicate top-up when 2+ Alloy were already extracted");
  assert.equal(res.added.filter(id => id === "scrap_alloy").length, 2, "added list reflects only what was actually extracted");
}
{
  // A non-FTUE raid (no matching S.coreLaunch.ftue) never gets the top-up, even with 0 Alloy extracted.
  const w = boot(null);
  const before = w.T.state().stash.scrap_alloy || 0;
  const r = { schema:"protocol-rebirth/raid-result", version:1, raidId:"nodspel:nonftue", seed:"nonftue",
    outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["cable"], lost:[], endedAt:Date.now(), kitLeft:{ medkit:1 } };
  w.T.ingestRaidResult(r);
  assert.equal(w.T.state().stash.scrap_alloy, before, "no top-up on a non-FTUE raid");
}

console.log("D3.10 HOMECOMING TEST PASSED");
