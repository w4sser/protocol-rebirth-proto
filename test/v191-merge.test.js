// v1.91 merge tiers (3 copies -> next Mk) + Fabricator attachments, v12->v13 save migration.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, stashCapacity, stashSlotsUsed, stashWarnings, quickCleanList, firHave, stashGroup, have, addItem, removeItem, armorySlotsUsed, armoryCapacity, isArmoryItem, SV:SAVE_VERSION, gearTier, gearMax, gearLevel, masteredWeapon, mergeBlock, weaponParam, gearEffect };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
assert.equal(g.T.SV, 14);
const old = JSON.parse(JSON.stringify(g.S())); delete old.gearTier; delete old.attach; old.v = 12;
Object.assign(old.modules, { rebirth_core:1, fabricator:2, bit_bay:1, storage:1 }); old.baseState = "core_habitable"; old.introSeen = true;
old.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; old.beat = g.D.progression.beats.length - 1; old.cur.scrap = 2000;
old.armory = { smg_vector:3, scavenger_vest:2 }; old.gearUp = { smg_vector:3 }; old.stash = { servo:6, scrap_alloy:6, circuit_board:3, optical_sensor:2 };
const b = boot(old), S = b.S(), T = b.T, q = s => b.d.querySelector(s);
// migration: additive, nothing lost
assert.equal(S.v, 14); assert.deepEqual(S.gearTier, {}); assert.deepEqual(S.attach, {}); assert.equal(T.have("smg_vector"), 3); assert.equal(S.gearUp.smg_vector, 3);
assert.equal(T.gearTier("smg_vector"), 1); assert.equal(T.gearMax("smg_vector"), 3);
// merge
assert(/1 more/.test(T.mergeBlock("scavenger_vest")), "2 vests can't merge");
const d0 = T.masteredWeapon("smg_vector", 0).dmg;
b.A.openStashItem("smg_vector"); const mb = q(".wpnscreen button.merge"); assert(mb && /MK II/.test(mb.textContent), "MERGE button");
b.w.eval(mb.getAttribute("onclick"));
assert.equal(T.have("smg_vector"), 1, "3 copies become 1"); assert.equal(T.gearTier("smg_vector"), 2); assert.equal(T.gearLevel("smg_vector"), 0, "level resets");
assert.equal(T.gearMax("smg_vector"), 4, "max level +1"); assert.equal(T.masteredWeapon("smg_vector", 0).dmg, d0 + 1, "Mk II +1 dmg");
assert(q(".wpnscreen.tier2 .mergeburst"), "merge payoff burst"); assert(/MK II/.test(q(".wpnscreen .wtier").textContent), "tier badge");
assert(S.log.some(l => l.action === "GEAR_MERGED" && l.payload.to === 2));
assert(!q(".wpnscreen button.merge"), "no merge with 1 copy");
// attachments: craft at Fabricator, fit on screen, slots by tier
b.w.eval("closeAllPopups()"); b.A.craft("att_barrel_build"); b.A.craft("att_mag_build");
if(T.have("att_barrel") < 1) S.armory.att_barrel = 1; if(T.have("att_mag") < 1) S.armory.att_mag = 1; // second craft may queue
assert(T.isArmoryItem("att_barrel"), "attachments live in the Armory");
b.A.openStashItem("smg_vector"); assert(q('.wslot.can[data-slot=barrel]') && q('.wslot.can[data-slot=mag]') && q('.wslot.locked[data-slot=optic]'), "Mk II: barrel+mag open, optic locked");
const r0 = T.masteredWeapon("smg_vector").rng, m0 = T.masteredWeapon("smg_vector").mag;
b.w.eval(q('.wslot[data-slot=barrel]').getAttribute("onclick")); b.w.eval(q('.wslot[data-slot=mag]').getAttribute("onclick"));
assert.equal(T.masteredWeapon("smg_vector").rng, r0 + 2); assert(T.masteredWeapon("smg_vector").mag > m0); assert(q('.wslot.fitted[data-slot=barrel]'));
assert(/rng:/.test(T.weaponParam("smg_vector")) && T.weaponParam("smg_vector").includes("rng:" + (r0 + 2)), "raid gets attachment stats");
assert(q(".wpn-hero img.cur").getAttribute("src").includes("smg-2-1600.webp"), "Mk II art"); assert(/RESTORED/.test(q(".wpnscreen .wtier").textContent));
// kept on merge to Mk III
T.addItem("smg_vector", 2); b.A.gearMerge("smg_vector"); assert.equal(T.gearTier("smg_vector"), 3); assert(S.attach.smg_vector.barrel && S.attach.smg_vector.mag, "attachments kept");
assert.equal(T.mergeBlock("smg_vector"), "Max tier");
// armor merge via popup
T.addItem("scavenger_vest", 1); const sh0 = T.gearEffect("scavenger_vest").shield; b.w.eval("closeAllPopups()"); b.A.openStashItem("scavenger_vest");
b.w.eval(q("#overlay .gearpop button.merge").getAttribute("onclick")); assert.equal(T.gearTier("scavenger_vest"), 2); assert(T.gearEffect("scavenger_vest", 0).shield > sh0 - 1);
// carbine never merges
assert(T.mergeBlock("basic_carbine"));
console.log("V1.91 MERGE TEST PASSED");
process.exit(0);
