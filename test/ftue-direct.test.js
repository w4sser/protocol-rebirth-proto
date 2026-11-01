// FTUE direct path (docs/ftue-design.md, v2.22.0): a fresh profile's splash goes straight into the
// first raid -- no cold open, no Core popup, no loadout screen. A returning save is untouched. The
// cold open shows once, on return from the first extraction, with Core as the single next step.
// Run: node test/ftue-direct.test.js (needs jsdom, same as ui.test.js)
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
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + ";window.T={state:()=>S,ingestRaidResult,progressionGoal};");
  return w;
}
const text = w => w.document.getElementById("app").textContent;

// 1) Fresh profile: splash PLAY (the splash's fade finishing) goes straight into the FTUE raid --
// no cold open, no Core popup, no loadout screen, fixed default loadout.
{
  const w = boot(null);
  assert.equal(w.document.getElementById("app").innerHTML, "", "nothing rendered yet -- the direct path waits for the splash to finish");
  assert.equal(w.launchURL, undefined, "no raid launched before the splash finishes");
  w.dispatchEvent(new w.Event("pr:splash-finished")); // the fade completing (PLAY was already tapped to get here)
  assert(typeof w.launchURL === "string" && w.launchURL.includes("./nodspel/"), "PLAY lands straight in the raid");
  const url = new w.URL(w.launchURL, "http://localhost/");
  assert.equal(url.searchParams.get("intro"), "1", "the FTUE raid carries intro=1 (scripted room, no tutorial card)");
  assert.equal(url.searchParams.get("ftue"), "1", "the FTUE raid carries its own dedicated ftue=1 -- distinct from intro=1, which a returning save mid-onboarding also gets");
  assert(/basic_carbine/.test(url.searchParams.get("w") || ""), "fixed default loadout: Basic Carbine");
  assert.equal(url.searchParams.get("kit"), "medkit:1", "fixed default loadout: 1 medkit, as today");
  assert(!text(w).includes("PROTOCOL REBIRTH"), "cold open never shown before the first raid");
  const S = w.T.state();
  assert.equal(S.introSeen, false, "cold open deferred, not skipped");
  assert.equal(S.modules.rebirth_core, 0, "Core build deferred -- it becomes the next step after the raid, not built silently");
}

// 2) Returning save (cold open already seen) behaves exactly as before: no auto-launch, no FTUE
// metrics key, base/intro renders immediately like v2.21.1.
{
  const seed = boot(null);
  seed.A.startFtueDirect = () => {}; // this throwaway window's own direct-launch must not fire while we read its state
  seed.T.state().introSeen = true;
  const returningSave = JSON.parse(JSON.stringify(seed.T.state()));

  const w = boot(returningSave);
  assert.equal(w.localStorage.getItem("pr_ftue_v1"), null, "returning save never gets the FTUE metrics key");
  assert.equal(w.launchURL, undefined, "no auto-launch for a returning save");
  w.dispatchEvent(new w.Event("pr:splash-finished"));
  assert.equal(w.launchURL, undefined, "still no auto-launch once the splash finishes -- a returning save ignores the direct-path listener entirely");
  assert(text(w).length > 0, "returning save renders a screen immediately, exactly as before");
  assert(!text(w).includes("PROTOCOL REBIRTH"), "returning save does not see the cold open again");
}

// 2b) Legacy save closed before dismissing the old intro (introSeen false, raids 0, no pr_ftue_v1):
// keeps the legacy flow -- no direct launch, no ftue=1, no FTUE retries.
{
  const seed = boot(null);
  seed.A.startFtueDirect = () => {};
  const legacySave = JSON.parse(JSON.stringify(seed.T.state()));
  const w = boot(legacySave);
  assert.equal(w.localStorage.getItem("pr_ftue_v1"), null, "legacy save never gets the FTUE metrics key");
  w.dispatchEvent(new w.Event("pr:splash-finished"));
  assert.equal(w.launchURL, undefined, "legacy un-dismissed-intro save is not FTUE-eligible");
}

// 3) pr_ftue_v1 metrics: written only for the fresh profile, with a play timestamp once PLAY is tapped.
{
  const w = boot(null);
  assert(JSON.parse(w.localStorage.getItem("pr_ftue_v1")).step === "start", "metrics seeded at profile creation");
  w.dispatchEvent(new w.Event("pr:splash-finished"));
  const ftue = JSON.parse(w.localStorage.getItem("pr_ftue_v1"));
  assert.equal(ftue.attempts, 0);
  assert.equal(ftue.step, "play");
  assert(Number.isFinite(ftue.t.play), "play timestamp recorded");
}

// 4) Cold open shows once, after the first extraction; Core is the single next step on return.
{
  const w = boot(null);
  w.dispatchEvent(new w.Event("pr:splash-finished"));
  const url = new w.URL(w.launchURL, "http://localhost/");
  const raidId = url.searchParams.get("raidId"), seed = url.searchParams.get("seed");
  assert(raidId && seed, "raid launched with a real raidId/seed");
  const result = { schema:"protocol-rebirth/raid-result", version:1, raidId, seed, outcome:"extract", area:"bunker",
    levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["cable","cable","scrap_alloy"], lost:[], endedAt:Date.now(), kitLeft:{ medkit:1 } };
  const ingested = w.T.ingestRaidResult(result);
  assert(ingested.ok, "first extraction ingests cleanly");
  assert.equal(w.T.state().introSeen, false, "cold open not shown yet -- extraction alone doesn't dismiss it");

  w.A.go("base");
  assert(text(w).includes("PROTOCOL REBIRTH"), "base redirects to the cold open the first time, right after the first extraction");

  // 5) Reloading right here -- after the first extraction, before dismissing the cold open -- must
  // show the cold open again, not launch a second FTUE raid (S.raids===0 would otherwise still look
  // "pre-first-raid" since introSeen is still false too).
  const postExtractSave = JSON.parse(w.localStorage.getItem("pr_meta_save"));
  assert.equal(postExtractSave.introSeen, false, "cold open genuinely not dismissed yet in the saved state");
  assert.equal(postExtractSave.raids, 1, "the extraction was persisted as a completed raid");
  {
    const reload = boot(postExtractSave);
    assert.equal(reload.launchURL, undefined, "no auto-launch on reload before the splash even finishes");
    reload.dispatchEvent(new reload.Event("pr:splash-finished"));
    assert.equal(reload.launchURL, undefined, "reloading mid-cold-open must not launch a second FTUE raid");
    assert(text(reload).includes("PROTOCOL REBIRTH"), "the cold open shows again on reload instead");
  }

  w.A.dismissIntro();
  w.A.go("base");
  assert(!text(w).includes("PROTOCOL REBIRTH"), "cold open shows only once");
  assert.equal(w.T.progressionGoal().module, "rebirth_core", "Core is the single next step the base shows on return");
}

console.log("FTUE DIRECT PATH TEST PASSED");
