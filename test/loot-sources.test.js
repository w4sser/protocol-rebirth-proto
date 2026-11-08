// Playtest 2026-11-08: room, quest and weapon detail screens fill the app viewport, cover the currency top bar, close top-left.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/loot-sources.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, stashCapacity, stashSlotsUsed, stashWarnings, quickCleanList, firHave, stashGroup, have, addItem, removeItem, armorySlotsUsed, armoryCapacity, isArmoryItem, SV:SAVE_VERSION };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
// v2.28.6: missing Core parts say where they drop, from data/loot-sources.js (generated from the raid loot tables).
(async () => {
  const gen = await import("../scripts/gen-loot-sources.mjs");
  assert.strictEqual(fs.readFileSync(path + "/data/loot-sources.js", "utf8"), gen.fileText(), "data/loot-sources.js is stale: run node scripts/gen-loot-sources.mjs");
  const g = boot(null); g.A.dismissIntro();
  const st = JSON.parse(JSON.stringify(g.S()));
  Object.assign(st.modules, { rebirth_core:2, fabricator:1, bit_bay:1, storage:1 }); st.baseState = "core_habitable"; st.introSeen = true;
  st.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; st.beat = g.D.progression.beats.length - 1;
  const b = boot(st);
  b.A.openBuilding("rebirth_core");
  const costs = [...b.w.document.querySelectorAll("#overlay .cost.miss")];
  const mm = costs.find(c => /Memory Module/.test(c.textContent)), ed = costs.find(c => /Encrypted Drive/.test(c.textContent));
  assert(mm && ed, "Core L2->L3 lists Memory Module and Encrypted Drive as missing");
  for(const c of [mm, ed]) assert.strictEqual(c.querySelector(".lhint").textContent, "Loot crates · Bunker 3 / Archipelago 3", "hint from active loot tables");
  assert(!b.w.document.querySelector("#overlay .cost.ok .lhint"), "owned parts carry no hint");
  const T = b.w.eval("lootHint");
  assert.strictEqual(T("power_relay"), "Loot crates · Bunker 2–3 / Archipelago 2–3", "contiguous levels collapse to a range");
  assert(/^Last crate · Bunker 3 · extract to scout$/.test(T("archipelago_chart")), "chart hint: guaranteed last crate, extract to scout");
  { const s = b.S(); s.areaScouted = Object.assign(s.areaScouted || {}, { archipelago:true }); }
  assert.strictEqual(T("archipelago_chart"), "", "no chart hint once Archipelago is scouted");
  console.log("LOOT SOURCES TEST PASSED");
})().catch(e => { console.error(e); process.exit(1); });
