// v1.92 weapon art: grade names, hero art per tier, Svartverk, crossfade, art icons. (was: v1.91 merge tiers (3 copies -> next Mk) + Fabricator attachments, v12->v13 save migration.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, stashCapacity, stashSlotsUsed, stashWarnings, quickCleanList, firHave, stashGroup, have, addItem, removeItem, armorySlotsUsed, armoryCapacity, isArmoryItem, SV:SAVE_VERSION, gearTier, gearMax, gearLevel, masteredWeapon, mergeBlock, weaponParam, gearEffect, weaponGrade, gradeName, tierLabel, weaponArtSrc };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const old = JSON.parse(JSON.stringify(g.S()));
Object.assign(old.modules, { rebirth_core:1, fabricator:2, bit_bay:1, storage:1 }); old.baseState = "core_habitable"; old.introSeen = true;
old.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; old.beat = g.D.progression.beats.length - 1;
old.armory = { shotgun_breach:1, smg_vector:1, rifle_marksman:1, att_barrel:2, att_mag:2, att_optic:2 }; old.gearTier = { shotgun_breach:3, smg_vector:3 };
const b = boot(old), S = b.S(), T = b.T, q = s => b.d.querySelector(s);
assert.equal(T.tierLabel("basic_carbine"), "MK I · SALVAGED");
assert.equal(T.weaponArtSrc("basic_carbine", 512), "assets/weapons/carbine-1-512");
assert.equal(T.tierLabel("shotgun_breach"), "MK III · CUSTOM");
assert.equal(T.weaponArtSrc("rifle_marksman", 1600), "assets/weapons/marksman-1-1600", "v1.94 marksman placeholder silhouette");
b.A.openStashItem("shotgun_breach");
assert(q(".wpn-hero img.cur").getAttribute("src") === "assets/weapons/shotgun-3-1600.webp");
assert(q('.wslot.stock[data-slot=stock]'), "stock box for leader line");
for(const k of ["barrel","mag","optic"]) b.w.eval(q('.wslot[data-slot=' + k + ']').getAttribute("onclick"));
assert.equal(T.weaponGrade("shotgun_breach"), 4); assert.equal(T.tierLabel("shotgun_breach"), "MK III · SVARTVERK");
assert(q(".wpn-hero.g4 img.cur").getAttribute("src").includes("shotgun-4-1600"), "Svartverk art");
assert(q(".wpn-hero img.old") && q(".wpn-hero img.old").getAttribute("src").includes("shotgun-3-1600"), "crossfade from Custom");
// smg Svartverk art (v1.93)
b.A.openStashItem("smg_vector"); for(const k of ["barrel","mag","optic"]) b.w.eval(q('.wslot[data-slot=' + k + ']').getAttribute("onclick"));
assert.equal(T.weaponGrade("smg_vector"), 4); assert(q(".wpn-hero img.cur").getAttribute("src").includes("smg-4-1600"));
// armory tiles use the 512 art; marksman keeps its svg
b.w.eval("closeAllPopups()"); b.A.go("stash");
assert(b.d.querySelector('img.ic-art[src*="smg-4-512.webp"]'), "tile art");
const fs2 = require("fs"); for(const k of ["carbine-1","carbine-4","shotgun-4","smg-1","smg-3"]) for(const w of [512,1600]) for(const e of ["webp","png"]) assert(fs2.existsSync(path + "/assets/weapons/" + k + "-" + w + "." + e), k + w + e);
console.log("V1.92 ART TEST PASSED");
process.exit(0);
