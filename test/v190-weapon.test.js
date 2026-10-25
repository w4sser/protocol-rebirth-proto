// v1.90 fullscreen weapon screen: opens from Armory and the Raid Prep weapon tile, covers the top bar, own close.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, stashCapacity, stashSlotsUsed, stashWarnings, quickCleanList, firHave, stashGroup, have, addItem, removeItem, armorySlotsUsed, armoryCapacity, isArmoryItem, SV:SAVE_VERSION };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const st = JSON.parse(JSON.stringify(g.S()));
Object.assign(st.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); st.baseState = "core_habitable"; st.introSeen = true;
st.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; st.beat = g.D.progression.beats.length - 1; st.armory = { smg_vector:1, scavenger_vest:1 };
const b = boot(st), q = s => b.d.querySelector(s);
b.A.openStashItem("smg_vector"); assert(q("#overlay.wpnov .wpnscreen"), "weapon opens fullscreen");
assert.deepEqual([...b.d.querySelectorAll(".wpnscreen .wbar")].map(e => e.dataset.stat), ["damage","firerate","mag","range"]);
assert.equal(b.d.querySelectorAll(".wpnscreen button.wslot").length, 3); assert(q(".wpnscreen .wslot.open[data-slot=barrel]"));
assert(q(".wpnscreen .wpn-close")); b.w.eval(q(".wpn-close").getAttribute("onclick")); assert(!q("#overlay"), "own close works");
b.A.openStashItem("scavenger_vest"); assert(q("#overlay .gearpop") && !q("#overlay.wpnov"), "armor keeps the popup"); b.w.eval("closeAllPopups()");
b.A.go("prep"); b.A.prepLoadout("weapon", "smg_vector"); const up = q('.lslot[data-slot=weapon] .lslot-up'); assert(up, "prep weapon tile has bench button");
b.w.eval(up.getAttribute("onclick").replace("event.stopPropagation();", "")); assert(q("#overlay.wpnov .wpnscreen[data-gear=smg_vector]"), "opens from prep");
console.log("V1.90 WEAPON TEST PASSED");
