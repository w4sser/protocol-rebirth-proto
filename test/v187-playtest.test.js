// v1.87 playtest fixes: loadout persists, quick clean never sells usable gear, stash sorted by type + upgrade mark.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, stashCapacity, stashSlotsUsed, stashWarnings, quickCleanList, firHave, stashGroup };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; base.beat = g.D.progression.beats.length - 1; base.cur.scrap = 0;
const click = (b, sel) => { const el = b.d.querySelector(sel); assert(el, "missing " + sel); if(el.disabled) return; const oc = el.getAttribute("onclick"); if(oc) b.w.eval(oc); else el.dispatchEvent(new b.w.MouseEvent("click", { bubbles:true })); }; // jsdom (outside-only) does not run inline handlers
const fresh = (stash) => { const b = boot(JSON.parse(JSON.stringify(base))); Object.assign(b.S(), { stash, fir:{}, reserved:{}, secureItem:null }); b.A.go("stash"); return b; };
// 1. loadout survives leaving Raid Prep and a reload
{ const b = fresh({ smg_vector:1, medkit:2, scrap_alloy:3 });
  b.A.go("prep"); b.A.prepLoadout("weapon", "smg_vector"); b.A.go("stash"); b.A.go("prep");
  assert.equal(b.w.session ? b.w.session.prep.loadout.weapon : b.S().loadout.weapon, "smg_vector", "weapon kept after leaving prep");
  const saved = JSON.parse(b.w.localStorage.getItem("pr_meta_save")); assert.equal(saved.loadout.weapon, "smg_vector", "loadout in save");
  const b2 = boot(saved); b2.A.go("prep"); assert(b2.d.body.innerHTML.includes("Vector SMG"), "restored after reload"); }
// 6. quick clean: never Medkit / EMP / weapons / armor, even when over capacity
{ const b = fresh({ medkit:5, tool_emp:3, smg_vector:1, scavenger_vest:1, cable:10, scrap_alloy:10, bio_sample:10, med_gel:10, servo:10, polymer_plate:10, circuit_board:10, optical_sensor:10, power_cell:10, memory_module:10, transmitter:10, hydraulic_component:10, purification_filter:10 });
  const ids = b.T.quickCleanList().map(r => r.id);
  for(const bad of ["medkit","tool_emp","smg_vector","scavenger_vest"]) assert(!ids.includes(bad), "quick clean must not suggest " + bad);
  const only = fresh({ medkit:5, tool_emp:3, power_relay:20, data_core:3 }); for(const r of only.T.quickCleanList()) assert(!["medkit","tool_emp"].includes(r.id), "fallback is materials only"); }
// 5. stash order: weapons, gear, consumables, materials; upgrade mark on upgradable gear
{ const b = fresh({ cable:2, medkit:1, scavenger_vest:1, smg_vector:1, scrap_alloy:9 }); b.S().cur.scrap = 999; b.A.go("stash");
  const names = [...b.d.querySelectorAll("#app .grid .slot:not(.free)")].map(e => e.textContent);
  const at = n => names.findIndex(t => t.includes(n));
  assert(at("Vector SMG") < at("Scavenger Vest") && at("Scavenger Vest") < at("Medkit") && at("Medkit") < at("Cable"), "sorted by type: " + names.join("|"));
  assert(b.d.querySelector("#app .slot .upmark"), "upgrade-available mark shown"); }
console.log("V1.87 PLAYTEST TEST PASSED");
