// Power-pad narrator persistence uses the existing raid bitSeen contract.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";

const FILES = ["data/items.js", "data/modules.js", "data/bit.js", "data/bit-talents.js", "data/raid_zones.js",
  "data/recipes.js", "data/loot-sources.js", "data/vendors.js", "data/retention.js", "data/quests.js", "data/progression.js", "data/combat.js"];

function boot(){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  w.localStorage = (() => { let s = {}; return { getItem: k => s[k] ?? null, setItem: (k, v) => s[k] = v, removeItem: k => delete s[k] }; })();
  w.URL.createObjectURL = () => "blob:fake";
  w.PR_NAVIGATE = u => { w.launchURL = u; };
  w.PRBitCard = { show(){}, dismiss(){}, isOpen(){ return false; } };
  w.PRBitCutscene = { play(){}, preload(){ return Promise.resolve(["", ""]); }, released:[], release(){}, isOpen(){ return false; } };
  w.eval(fs.readFileSync(path + "/save-slots.js", "utf8"));
  for(const s of FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.eval(fs.readFileSync(path + "/app.js", "utf8") +
    ";window.T={state:()=>S,ingestRaidResult,migrateBitCardsSeen,freshState};");
  return w;
}
function result(extra){
  return Object.assign({ schema:"protocol-rebirth/raid-result", version:1, raidId:"raid-bit-1", seed:"s1",
    outcome:"death", area:"bunker", levelsCleared:0, enemiesDefeated:0, nodesLit:0, remainingMs:400000,
    extracted:[], lost:[], endedAt:Date.now() }, extra);
}

{
  const w = boot();
  assert.equal(w.T.state().bitCardsSeen.power_pad_intro, undefined, "unseen on a fresh profile");
  const res = w.T.ingestRaidResult(result({ bitSeen:["power_pad_intro"] }));
  assert.equal(res.ok, true);
  assert.equal(w.T.state().bitCardsSeen.power_pad_intro, true, "the live raid card is persisted into the profile's save");
  w.close();
}
{
  // Any outcome (not just extract) persists it -- the card was shown regardless of how the raid ended.
  const w = boot();
  w.T.ingestRaidResult(result({ outcome:"timeout", reason:"timeout", bitSeen:["power_pad_intro"] }));
  assert.equal(w.T.state().bitCardsSeen.power_pad_intro, true);
  w.close();
}
{
  // No bitSeen field at all (the common case: no BIT card fired this raid) must not throw or set it.
  const w = boot();
  const res = w.T.ingestRaidResult(result({}));
  assert.equal(res.ok, true);
  assert.equal(w.T.state().bitCardsSeen.power_pad_intro, undefined);
  w.close();
}
{
  // Pre-feature raid counts do not prove pad sight. Keep unseen even for veterans.
  const w = boot();
  const veteran = Object.assign(w.T.freshState(), { raids: 30 });
  delete veteran.bitCardsSeen.power_pad_intro;
  w.T.migrateBitCardsSeen(veteran);
  assert.equal(veteran.bitCardsSeen.power_pad_intro, undefined);
  veteran.bitCardsSeen.power_pad_intro = true;
  w.T.migrateBitCardsSeen(veteran);
  assert.equal(veteran.bitCardsSeen.power_pad_intro, true, "explicit seen flag survives migration");
  const reloaded=JSON.parse(JSON.stringify(veteran));w.T.migrateBitCardsSeen(reloaded);
  assert.equal(reloaded.bitCardsSeen.power_pad_intro,true);
  const fresh = Object.assign(w.T.freshState(), { raids: 0 });
  w.T.migrateBitCardsSeen(fresh);
  assert.equal(fresh.bitCardsSeen.power_pad_intro, undefined);
  w.close();
}

console.log("power-pads-bit.test.js: ok");
