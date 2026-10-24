// v1.89 Armory/Stash split: gear in S.armory, materials in S.stash, v11->v12 migration keeps every item.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, stashCapacity, stashSlotsUsed, stashWarnings, quickCleanList, firHave, stashGroup, have, addItem, removeItem, armorySlotsUsed, armoryCapacity, isArmoryItem, SV:SAVE_VERSION };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
assert.equal(g.T.SV, 13);
const ids = Object.keys(g.D.items ? Object.fromEntries(g.D.items.map(i => [i.id, i])) : {});
const gearId = g.D.items.find(i => !i.free && g.T.stashGroup(i.id) === 0).id, consId = g.D.items.find(i => !i.free && g.T.stashGroup(i.id) === 2);
const matId = g.D.items.find(i => !i.free && g.T.stashGroup(i.id) >= 3).id;
// v11 save with everything mixed in stash -> v12 moves gear to armory, keeps counts, FIR, upgrades, reservations
const old = JSON.parse(JSON.stringify(g.S())); delete old.armory; old.v = 11;
Object.assign(old.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); old.baseState = "core_habitable"; old.introSeen = true;
old.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; old.beat = g.D.progression.beats.length - 1;
old.stash = { [gearId]:2, [matId]:7 }; if(consId) old.stash[consId.id] = 3;
old.fir = { [gearId]:1, [matId]:2 }; old.gearUp = { [gearId]:2 }; old.reserved = { [gearId]:1 };
const b = boot(old), S = b.S();
assert.equal(S.v, 13); assert.equal(S.armory[gearId], 2, "gear moved"); assert(!S.stash[gearId], "gear not left in stash");
assert.equal(S.stash[matId], 7, "materials stay"); if(consId) assert.equal(S.armory[consId.id], 3, "consumables to armory");
assert.equal(b.T.have(gearId), 2); assert.equal(b.T.firHave(gearId), 1); assert.equal(S.gearUp[gearId], 2); assert(S.reserved[gearId]);
// routing + removal
b.T.addItem(gearId, 1); b.T.addItem(matId, 1); assert.equal(S.armory[gearId], 3); assert.equal(S.stash[matId], 8);
b.T.removeItem(gearId, 3); assert.equal(b.T.have(gearId), 0); assert.equal(S.armory[gearId] || 0, 0);
// gear never counts toward stash slots; quick clean never offers gear
b.T.addItem(gearId, 1); const used = b.T.stashSlotsUsed(); b.T.addItem(gearId, 1); assert.equal(b.T.stashSlotsUsed(), used);
assert(!b.T.quickCleanList(true).some(x => b.T.isArmoryItem(x.id || x)), "clean list is materials only");
assert(b.T.armoryCapacity() >= 8 && b.T.armorySlotsUsed() >= 1);
// screen shows both sections
b.A.go("stash"); if(!b.d.querySelector("#inv-armory")) console.log(b.d.querySelector("#app").innerHTML.slice(0,400)); const ar = b.d.querySelector("#inv-armory"), ma = b.d.querySelector("#inv-stash");
assert(ar && ma && ar.textContent.includes(g.D.items.find(i => i.id === gearId).name) && ma.textContent.includes(g.D.items.find(i => i.id === matId).name), "two sections");
// idempotent reload
b.w.eval("save && save()"); const again = boot(JSON.parse(b.w.localStorage.getItem("pr_meta_save"))); assert.equal(again.T.have(matId), 8); assert.equal(again.S().v, 13);
console.log("V1.89 ARMORY TEST PASSED");
