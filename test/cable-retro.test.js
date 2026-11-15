// PRB-139 (v2.28.29): one-time retro credit of 1 Cable. Before v2.28.17 (PRB-132) Power Trace (bunker
// B1) opened before the Fabricator existed; a save that already finished B1 but never built Fabricator
// L1 can only be one of those pre-PRB-132 saves, so it is short the Cable the Fabricator now costs
// (v2.28.27, PRB-149: {scrap:10, items:{cable:1, scrap_alloy:2}}). migrateCableRetro(st) in app.js'
// load() path grants it once (st.cableRetro1 "granted"/"n/a") and freshState() always starts at "n/a".
// Run: node test/cable-retro.test.js (needs jsdom, same style as test/d3-homecoming.test.js)
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
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + ";window.T={state:()=>S,canAfford,costParts,migrateCableRetro};");
  w.A.startFtueDirect = () => {};
  return w;
}

// Build a plausible pre-PRB-132 save shape: booted once to get a real save, then shaped to the
// eligible condition (B1 done, Fabricator not built) with cableRetro1 deleted -- a genuine old save
// never had that field at all.
function oldSave(overrides){
  const seed = boot(null);
  seed.T.state().introSeen = true;
  const st = JSON.parse(JSON.stringify(seed.T.state()));
  delete st.cableRetro1;
  st.chains = st.chains || {};
  st.chains.bunker = { step: 1, prog: 0 }; // B1 (index 0) already completed
  st.modules.fabricator = 0;
  st.stash.cable = 0;
  Object.assign(st, overrides);
  return st;
}

// 1) Eligible old save (B1 done, Fabricator 0, Cable 0) gets exactly +1 Cable and flag "granted".
{
  const seed = oldSave();
  const before = seed.stash.cable || 0;
  const w = boot(seed);
  assert.equal(w.T.state().cableRetro1, "granted", "eligible save is flagged granted");
  assert.equal(w.T.state().stash.cable, before + 1, "eligible save gets exactly +1 Cable");
}

// 2) Loading the same (already-migrated) save again does NOT grant again (idempotent).
{
  const seed = oldSave();
  const once = boot(seed);
  const migrated = JSON.parse(JSON.stringify(once.T.state()));
  assert.equal(migrated.cableRetro1, "granted");
  assert.equal(migrated.stash.cable, 1);
  const twice = boot(migrated);
  assert.equal(twice.T.state().cableRetro1, "granted", "still granted, not re-evaluated");
  assert.equal(twice.T.state().stash.cable, 1, "Cable is not granted a second time");
}

// 3) B1 done but Fabricator already built -> no cable, flag "n/a".
{
  const seed = oldSave({ modules: Object.assign({}, oldSave().modules, { fabricator: 1 }) });
  const before = seed.stash.cable || 0;
  const w = boot(seed);
  assert.equal(w.T.state().cableRetro1, "n/a", "Fabricator already built -- not eligible");
  assert.equal(w.T.state().stash.cable, before, "no Cable granted when Fabricator is already built");
}

// 4) B1 not done -> no cable, flag "n/a".
{
  const seed = oldSave();
  seed.chains.bunker = { step: 0, prog: 0 };
  const before = seed.stash.cable || 0;
  const w = boot(seed);
  assert.equal(w.T.state().cableRetro1, "n/a", "Power Trace (B1) not completed -- not eligible");
  assert.equal(w.T.state().stash.cable, before, "no Cable granted when B1 is not done");
}

// 5) Fresh profile -> flag "n/a", no cable.
{
  const w = boot(null);
  assert.equal(w.T.state().cableRetro1, "n/a", "new players never get the retro credit");
  assert.equal(w.T.state().stash.cable || 0, 0, "fresh profile starts with no Cable");
}

// 6) After the grant, the eligible save can afford Fabricator L1 (10 Scrap + 2 Alloy, plus the
// granted Cable) via canAfford -- the credited Cable is a plain stash copy, not blocked from the cost.
{
  const seed = oldSave();
  seed.cur.scrap = 10;
  seed.stash.scrap_alloy = 2;
  const w = boot(seed);
  const S = w.T.state();
  assert.equal(S.cableRetro1, "granted");
  assert.equal(S.stash.cable, 1);
  const cost = { scrap: 10, items: { cable: 1, scrap_alloy: 2 } };
  assert.equal(w.T.canAfford(cost), true, "the credited Cable counts toward the Fabricator L1 cost");
}

console.log("CABLE RETRO TEST PASSED");
