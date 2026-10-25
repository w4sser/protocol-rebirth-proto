// v1.97 armory slot rules: 1 slot per item id in the Armory (weapon or any other gear type), dupes held for a
// merge or spare consumables stack into that same slot instead of each copy eating one. Capacity bar in the header.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, addItem, removeItem, armorySlotsUsed, armoryCapacity, isArmoryItem, SV:SAVE_VERSION };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
// no save-shape change: S.armory stays an id->qty map, so no migration bump was needed this round.
assert.equal(g.T.SV, 15, "SAVE_VERSION unchanged, armory slot math is display-side only");

const st = JSON.parse(JSON.stringify(g.S()));
Object.assign(st.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:0 }); st.baseState = "core_habitable"; st.introSeen = true;
st.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; st.beat = g.D.progression.beats.length - 1;
st.armory = {}; st.stash = {};
const b = boot(st), q = s => b.d.querySelector(s);

// 1 weapon, any quantity (e.g. 3 held for a merge), is 1 slot.
b.T.addItem("smg_vector", 1); assert.equal(b.T.armorySlotsUsed(), 1, "first weapon takes 1 slot");
b.T.addItem("smg_vector", 2); assert.equal(b.T.armorySlotsUsed(), 1, "3 copies of the same weapon still 1 slot");

// a different weapon/armor/consumable each adds its own slot (distinct ids), but still ignore quantity.
b.T.addItem("scavenger_vest", 1); assert.equal(b.T.armorySlotsUsed(), 2, "a different gear id adds a slot");
b.T.addItem("medkit", 5); assert.equal(b.T.armorySlotsUsed(), 3, "medkits add one slot regardless of stack");
b.T.addItem("medkit", 20); assert.equal(b.T.armorySlotsUsed(), 3, "piling on medkits does not add slots");

b.T.removeItem("smg_vector", 3); assert.equal(b.T.armorySlotsUsed(), 2, "removing all copies frees the slot");

// capacity bar renders in the armory header and reports used/cap.
b.A.go("stash");
const bar = q("#inv-armory .cap-bar"); assert(bar, "capacity bar renders in the armory header");
assert.equal(bar.getAttribute("aria-valuenow"), String(b.T.armorySlotsUsed()));
assert.equal(bar.getAttribute("aria-valuemax"), String(b.T.armoryCapacity()));
const fill = bar.querySelector("span"); assert(fill && /width:\d+%/.test(fill.getAttribute("style")), "bar has a fill width");
assert(!bar.className.includes("full"), "not full yet");

// fill the armory to capacity and check the bar turns to the warn/full color state.
const cap = b.T.armoryCapacity();
let n = b.T.armorySlotsUsed();
const extraIds = ["smg_vector","rifle_marksman","shotgun_breach","scout_rig","dampener_cloak","ammo_pack","tool_grenade","tool_emp","tool_decoy","att_barrel","att_mag","att_optic"];
for(const id of extraIds){ if(n >= cap) break; b.T.addItem(id, 1); n = b.T.armorySlotsUsed(); }
assert(n >= cap, "filled the armory to capacity for the test");
b.A.go("stash");
const bar2 = q("#inv-armory .cap-bar");
assert(bar2.className.includes("full"), "bar turns to the full/warn state at capacity");

console.log("V1.97 ARMORY TEST PASSED");
