// v1.93 full art pack + built-copy gear (save v14) + carbine rebuild + 3/9 merge. (prev: v1.92 weapon art: grade names, hero art per tier, Svartverk, crossfade, art icons. (was: v1.91 merge tiers (3 copies -> next Mk) + Fabricator attachments, v12->v13 save migration.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, stashCapacity, stashSlotsUsed, stashWarnings, quickCleanList, firHave, stashGroup, have, addItem, removeItem, armorySlotsUsed, armoryCapacity, isArmoryItem, SV:SAVE_VERSION, gearTier, gearMax, gearLevel, masteredWeapon, mergeBlock, weaponParam, gearEffect, weaponGrade, gradeName, tierLabel, weaponArtSrc, mergeNeed, mergeBlock, gearMerge, ingestRaidResult, gearLevel, gearMax, preloadWeaponArt };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro(); assert.equal(g.T.SV, 14);
const old = JSON.parse(JSON.stringify(g.S())); old.v = 13;
Object.assign(old.modules, { rebirth_core:1, fabricator:2, bit_bay:1, storage:1 }); old.baseState = "core_habitable"; old.introSeen = true;
old.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; old.beat = g.D.progression.beats.length - 1; old.cur.scrap = 5000;
old.armory = { smg_vector:1, att_barrel:3, att_mag:3, att_optic:3 };
old.gearTier = { smg_vector:2, shotgun_breach:3, basic_carbine:1 }; old.attach = { shotgun_breach:{ barrel:1 }, smg_vector:{ barrel:1 } }; old.gearUp = { shotgun_breach:2, smg_vector:1 };
const b = boot(old), S = b.S(), T = b.T, q = s => b.d.querySelector(s);
// migration v13 -> v14: orphaned shotgun build (no copy owned) cleared, owned smg kept
assert.equal(S.v, 14); assert(!S.gearTier.shotgun_breach && !S.attach.shotgun_breach && !S.gearUp.shotgun_breach, "orphan cleared"); assert.equal(T.gearTier("smg_vector"), 2);
// 3/9 merge cost: Mk II needs 3 on hand, Mk III 7 (built Mk II + 6 = 9 base copies in total)
assert.equal(T.mergeNeed("smg_vector"), 7); assert(/6 more/.test(T.mergeBlock("smg_vector")));
// death loses the built copy: carried smg -> plain Mk I copies remain
T.addItem("smg_vector", 1); T.removeItem("smg_vector", 1);
S.coreLaunch = { raidId:"d-1", seed:"s", gear:["smg_vector"] }; T.removeItem("smg_vector", 1);
const res = T.ingestRaidResult({ schema:"protocol-rebirth/raid-result", version:1, raidId:"d-1", seed:"s", outcome:"death", area:"bunker", levelsCleared:1, enemiesDefeated:0, nodesLit:0, remainingMs:0, extracted:[], lost:[], endedAt:Date.now() });
assert(res.ok, JSON.stringify(res)); assert(res.gearLost.includes("smg_vector"));
assert.equal(T.gearTier("smg_vector"), 1, "tier lost with the gun"); assert(!S.attach.smg_vector, "attachments lost"); assert(!S.gearUp.smg_vector, "level lost");
// Basic Carbine: rebuild through tiers with Scrap (no copies), needs max level first
assert(/Max level/.test(T.mergeBlock("basic_carbine")));
S.gearUp.basic_carbine = T.gearMax("basic_carbine"); const sc = S.cur.scrap; assert.equal(T.mergeBlock("basic_carbine"), "");
b.A.openStashItem("basic_carbine"); const rb = q(".wpnscreen button.merge"); assert(rb && /REBUILD TO MK II · RESTORED/.test(rb.textContent), "rebuild button");
b.w.eval(rb.getAttribute("onclick")); assert.equal(T.gearTier("basic_carbine"), 2); assert.equal(S.cur.scrap, sc - g.D.progression.gearMerge.freeRebuildScrap[0]);
assert(q(".wpn-hero img.cur").getAttribute("src").includes("carbine-2-1600"));
S.gearUp.basic_carbine = T.gearMax("basic_carbine"); b.A.gearMerge("basic_carbine"); assert.equal(T.gearTier("basic_carbine"), 3);
b.A.openStashItem("basic_carbine"); for(const k of ["barrel","mag","optic"]) b.w.eval(q('.wslot[data-slot=' + k + ']').getAttribute("onclick"));
assert.equal(T.tierLabel("basic_carbine"), "MK III · SVARTVERK"); assert(q(".wpn-hero img.cur").getAttribute("src").includes("carbine-4-1600"));
// carbine is free: death never resets it
S.coreLaunch = { raidId:"d-2", seed:"s", gear:["basic_carbine"] };
T.ingestRaidResult({ schema:"protocol-rebirth/raid-result", version:1, raidId:"d-2", seed:"s", outcome:"death", area:"bunker", levelsCleared:1, enemiesDefeated:0, nodesLit:0, remainingMs:0, extracted:[], lost:[], endedAt:Date.now() });
assert.equal(T.gearTier("basic_carbine"), 3);
// attachment tiles use the part art
b.w.eval("closeAllPopups()"); T.addItem("att_barrel", 1); b.A.go("stash"); assert(q('img.ic-art[src="assets/weapons/att-barrel-512.webp"]'));
const fs3 = require("fs"); for(const k of ["smg-4","carbine-1","att-mag","att-optic"]) assert(fs3.existsSync(path + "/assets/weapons/" + k + "-512.png"));
assert(fs3.existsSync(path + "/assets/weapons/workbench-1600.webp"));
console.log("V1.93 BUILT-COPY TEST PASSED");
process.exit(0);
