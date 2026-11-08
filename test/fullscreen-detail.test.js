// Playtest 2026-11-08: room, quest and weapon detail screens fill the app viewport, cover the currency top bar, close top-left.
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
const html = fs.readFileSync(path + "/index.html", "utf8");
assert(/#overlay\.fsdetail,#overlay\.sheet\.fsdetail\{position:fixed!important;inset:0!important;[^}]*z-index:60!important/.test(html), "fsdetail fills the app viewport above the top bar (z 60 > topbar 25)");
assert(/#overlay\.fsdetail \.pop-card>\.pop-x\{[^}]*left:8px!important;right:auto!important/.test(html), "fsdetail close badge top-left");
assert(/\.wpnscreen>\.wpn-close\{left:[^}]*right:auto!important/.test(html), "weapon close badge top-left");
const closeFirst = () => { const c = q("#overlay .pop-card"); return c && c.firstElementChild && c.firstElementChild.classList.contains("pop-x"); };
for(const id of ["rebirth_core","bit_bay","storage"]){
  b.A.openBuilding(id);
  assert(q("#overlay.fsdetail"), id + ": room detail uses the fullscreen layout");
  assert(closeFirst(), id + ": close badge is the card's first child (top-left)");
  b.w.closeAllPopups();
}
b.A.questLog("bunker", 0); assert(q("#overlay.qlogov.fsdetail"), "quest/task detail fullscreen"); assert(closeFirst(), "quest log close first"); b.w.closeAllPopups();
b.A.openStashItem("smg_vector"); const scr = q("#overlay.wpnov .wpnscreen");
assert(scr && scr.querySelector(":scope > .wpn-close"), "weapon close is a direct child of the screen (not inside the stats column)");
assert(!q(".wpn-r .wpn-close"), "no close left in the stats column");
// Fabricator already had its own fullscreen layout (fabov, v1.9x): same contract, keep it.
assert(/#overlay\.fabov\{position:fixed!important;inset:0!important;[^}]*z-index:60!important/.test(html), "fabricator fills the viewport above the top bar");
assert(/#overlay\.fabov \.pop-x\{top:10px!important;left:/.test(html), "fabricator close top-left");
b.A.openBuilding("fabricator"); assert(q("#overlay.fabov"), "fabricator opens fullscreen"); assert(q("#overlay.fabov .pop-x"), "fabricator has the shared close badge"); b.w.closeAllPopups();
console.log("FULLSCREEN DETAIL TEST PASSED");
