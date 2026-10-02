// jsdom UI test: clicks through the full vertical slice + retention layer.
// Run: npm i jsdom (once), then node test/ui.test.js (from prototype/)
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/" });
const { window } = dom;
window.localStorage = (() => { let s={}; return { getItem:k=>s[k]??null, setItem:(k,v)=>s[k]=v, removeItem:k=>delete s[k] }; })();
window.URL.createObjectURL = () => "blob:fake";
for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","app.js"])
  window.eval(fs.readFileSync(path + "/" + s, "utf8"));
const doc = window.document, A = window.A;
const text = () => doc.getElementById("app").textContent;
const tap = el => {
  el.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles:true, clientX:100, clientY:100 }));
  el.dispatchEvent(new window.MouseEvent("pointerup", { bubbles:true, clientX:100, clientY:100 }));
  el.dispatchEvent(new window.MouseEvent("click", { bubbles:true, clientX:100, clientY:100, detail:1 }));
};
const revealRoomThroughHotspot = id => {
  tap(doc.querySelector('.room-spot[data-room="' + id + '"]'));
  const button = doc.querySelector("#overlay button.primary");
  assert(button, id + " ready reveal panel"); A.unlockRoom(id);
};

// shell
assert(doc.getElementById("topbar") && doc.getElementById("rotate"), "landscape shell");
assert(text().includes("PROTOCOL REBIRTH"), "intro");
A.dismissIntro();
assert(doc.querySelectorAll(".room-spot").length === 4, "four side-room hotspots");
assert(doc.querySelector(".baseviewer") && doc.querySelector(".baseworld") && doc.querySelector(".baseplate"), "panoramic base viewer");
assert.equal(doc.querySelector(".baseplate").getAttribute("src"), "assets/production/bunker_plate_00_found.webp", "dormant plate 00 loaded");
const hs0 = doc.querySelector(".mapspot");
assert(hs0 && hs0.style.left.includes("%") && hs0.style.top.includes("%"), "hotspots use percent positioning");
assert.equal(doc.querySelectorAll(".room-spot.locked").length, 4, "four rock-covered rooms start locked");
const dragTarget = doc.querySelector(".core-spot"), viewer0 = doc.querySelector(".baseviewer");
let captures = 0;
viewer0.setPointerCapture = () => { captures++; };
viewer0.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles:true, clientX:300, clientY:180 }));
viewer0.dispatchEvent(new window.MouseEvent("pointerup", { bubbles:true, clientX:300, clientY:180 }));
assert.equal(captures, 0, "a tap must not capture the pointer on the viewer");
viewer0.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles:true, clientX:300, clientY:180 }));
viewer0.dispatchEvent(new window.MouseEvent("pointermove", { bubbles:true, clientX:340, clientY:200 }));
viewer0.dispatchEvent(new window.MouseEvent("pointerup", { bubbles:true, clientX:340, clientY:200 }));
assert.equal(captures, 1, "a real drag captures its pointer");
dragTarget.dispatchEvent(new window.MouseEvent("click", { bubbles:true, detail:1 }));
assert.equal(doc.getElementById("app").className, "s-base", "drag does not activate a hotspot");
Object.defineProperty(viewer0, "clientWidth", { configurable:true, value:844 });
Object.defineProperty(viewer0, "clientHeight", { configurable:true, value:390 });
window.dispatchEvent(new window.Event("resize"));
const mobileCamera = doc.querySelector(".baseworld").style.transform;
Object.defineProperty(viewer0, "clientWidth", { configurable:true, value:1280 });
Object.defineProperty(viewer0, "clientHeight", { configurable:true, value:720 });
window.dispatchEvent(new window.Event("resize"));
assert.notEqual(doc.querySelector(".baseworld").style.transform, mobileCamera, "camera responds across two landscape aspect ratios");
assert(!doc.querySelector(".flagpatch"), "no flag patch needed — env re-rendered without flag");
assert(doc.body.classList.contains("base-dark"), "base starts dark");
assert(doc.querySelector(".baseviewer").className.includes("hub-core_found"), "bunker starts at core_found");
assert(text().includes("CORE FOUND"), "persistent base state label");
assert(text().includes("PLATE 00"), "dormant plate label");
assert.equal(doc.querySelector(".baseviewer").dataset.audio, "dormant_core", "found state restores audio profile");
assert.equal(doc.querySelectorAll("#tabs button").length, 1, "found state locks non-base navigation");
A.go("module","fabricator");
assert.equal(doc.getElementById("app").className, "s-base", "locked room cannot open its module flow");

const cur0 = doc.getElementById("currencies").textContent;
assert(cur0.includes("Scrap") && !cur0.includes("Signals") && !cur0.includes("Fuel"), "core mode: scrap only");

// Keyboard activation still works after dragging, without another pointerdown.
dragTarget.dispatchEvent(new window.MouseEvent("click", { bubbles:true, detail:0 }));
assert.equal(doc.getElementById("app").className, "s-module", "keyboard opens Core after a drag");
A.go("base");
tap(doc.querySelector(".core-spot"));
assert.equal(doc.getElementById("app").className, "s-module", "pointer tap opens Core");
// Core L1 boot
A.build("rebirth_core");
await sleep(5400);
{
  const saved = JSON.parse(window.localStorage.getItem("pr_meta_save"));
  assert.equal(saved.baseState, "core_habitable", "base state is persisted with the first Core upgrade");
  const before = JSON.stringify({ modules:saved.modules, cur:saved.cur, stash:saved.stash, baseState:saved.baseState });
  A.build("rebirth_core");
  const afterSave = JSON.parse(window.localStorage.getItem("pr_meta_save"));
  const after = JSON.stringify({ modules:afterSave.modules, cur:afterSave.cur, stash:afterSave.stash, baseState:afterSave.baseState });
  assert.equal(after, before, "repeating the transition cannot charge resources twice");
}
assert(doc.getElementById("overlay").textContent.includes("POWER RESTORED"), "boot payoff");
assert(doc.getElementById("overlay").textContent.includes("NEW BENEFIT"), "benefit in boot payoff");
doc.querySelector("#overlay [data-close]").click();
assert(!doc.body.classList.contains("base-dark"), "base env lit after Core L1");
assert(doc.querySelector(".baseviewer").className.includes("hub-core_habitable"), "bunker becomes habitable after first build");
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_00"), "powered Core retains covered plate 00");
assert.equal(doc.querySelector(".baseviewer").dataset.audio, "powered_hub", "habitable state selects powered audio profile");
assert.equal(doc.querySelectorAll("#tabs button").length, 3, "habitable state unlocks navigation");
assert(text().includes("NEXT GOAL · OPEN FABRICATOR"), "base names the next room");
assert(!text().includes("NEXT UPGRADE"), "next room has no competing upgrade card");
assert(text().includes("Fabricator") && text().includes("Restore power"), "locked room shows its requirement");
const cameraBeforeReveal = doc.querySelector(".baseworld").style.transform;
tap(doc.querySelector('.room-spot[data-room="fabricator"]'));
assert(doc.querySelector("#overlay button.primary"), "eligible room opens from its hotspot");
doc.querySelector("#overlay [data-close]").click();
// Both base and raid-result build CTAs route through goBuild: locked rooms must explain access.
A.goBuild("fabricator");
assert(doc.querySelector('.room-spot.ready[data-room="fabricator"]'), "Core completion highlights Fabricator in green");
assert(doc.querySelector('.room-spot.ready small').textContent.startsWith("✓"), "ready room checks its completed requirement");
assert(doc.querySelector("#overlay button.primary").textContent.includes("RAID FOR REPAIR MATERIALS"), "missing materials prioritize raiding");
assert(doc.getElementById("overlay").textContent.includes("Opening the room clears access"), "room explains why access is available");
A.raidForRoom("fabricator");
assert.equal(doc.getElementById("app").className, "s-prep", "room raid CTA goes to prep");
assert(!doc.getElementById("overlay"), "room raid CTA closes the panel");
A.go("base");
A.unlockRoom("fabricator");
const unlockCount = JSON.parse(window.localStorage.getItem("pr_meta_save")).log.filter(e=>e.action==="ROOM_UNLOCKED").length;
A.unlockRoom("fabricator");
assert.equal(JSON.parse(window.localStorage.getItem("pr_meta_save")).log.filter(e=>e.action==="ROOM_UNLOCKED").length, unlockCount, "repeated unlock is idempotent");
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_01"), "Fabricator reveal selects plate 01");
assert.equal(doc.querySelector(".baseworld").style.transform, cameraBeforeReveal, "room reveal retains camera transform");
const unlocksBeforePreview = JSON.stringify(JSON.parse(window.localStorage.getItem("pr_meta_save")).roomUnlocks);
A.go("dev"); A.devPlate(4);
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_04"), "developer can preview the final plate");
assert(text().includes("PREVIEW"), "developer plate is visibly identified as a preview");
assert.equal(JSON.stringify(JSON.parse(window.localStorage.getItem("pr_meta_save")).roomUnlocks), unlocksBeforePreview, "developer preview does not mutate unlock progress");
A.devPlate(null);
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_01"), "developer can return to saved stage");

// raid_1
A.go("prep");
assert(doc.querySelector(".prepgrid"), "prep grid");
assert(text().includes("Standard loot mission") && text().includes("Basic loadout"), "first raid has one mission and equipped gear");
assert.equal(doc.querySelectorAll("#app select").length, 0, "first raid has no selectable loadout");
assert.equal(doc.querySelectorAll(".prep-locked[aria-disabled=true]").length, 3, "future raid choices are visibly disabled");
A.prepSet("routeId","control"); A.prepSet("riskId","aggressive"); A.prepLoadout("weapon","");
assert(!text().includes("Insurance"), "no insurance on raid_1");
A.deploy(); A.raidStep();
const firstDeploy = JSON.parse(window.localStorage.getItem("pr_meta_save")).log.find(e=>e.action === "RAID_DEPLOYED").payload;
assert.equal(firstDeploy.routeId, window.DATA.progression.starterRaid.routeId, "first route cannot be changed through actions");
assert.equal(firstDeploy.riskId, "standard", "first risk stays standard");
assert(firstDeploy.loadout.includes(window.DATA.progression.starterRaid.loadout.weapon), "first loadout retains its weapon");
assert(text().includes("EXTRACTED") && text().includes("PROGRESS MOVED"), "result");
assert(text().includes("NEXT UPGRADE") || text().includes("READY TO BUILD"), "one-more-raid card");
A.backToBase();
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_01"), "raid return restores Fabricator plate");

A.go("module","fabricator"); A.build("fabricator");
let ov = doc.getElementById("overlay"); if(ov) ov.querySelector("[data-close]").click();

assert(doc.querySelector('.room-spot.ready[data-room="storage"]'), "Fabricator completion highlights Vault");
assert(doc.querySelector('.room-spot.ready[data-room="storage"] small').textContent.includes("✓ Bring the Fabricator online"), "Vault checks its completed prerequisite");
assert(text().includes("NEXT GOAL · OPEN VAULT"), "base names the next room goal");
A.raidForRoom("storage");
assert(text().includes("Gather repair materials for Storage / Vault"), "raid goal follows the chosen next room instead of the scripted BIT goal");
A.go("base"); A.track("bit_bay",1);
revealRoomThroughHotspot("storage");
assert(doc.querySelector('.room-spot.ready[data-room="bit_bay"]'), "Vault access highlights BIT Bay next");
revealRoomThroughHotspot("bit_bay");
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_03"), "ordered reveals retain Fabricator and Vault through BIT Bay");

// raid_2 + insurance
A.go("prep");
assert(text().includes("Insurance") && text().includes("Optical Sensor"), "insurance + tracked target");
assert.equal(doc.querySelectorAll("#app select").length, 4, "Fabricator unlocks customizable loadout");
assert(text().includes("RAID PLANNING UNLOCKED") && text().includes("FIELD CRAFTING"), "Fabricator reward is visible on prep");
A.prepSet("routeId","control");
assert(doc.querySelector(".mappanel").style.backgroundImage.includes("env_route_map"), "unlocked raid planning shows its map");
const beforeCraft = JSON.parse(window.localStorage.getItem("pr_meta_save"));
A.craft("ammo_pack");
const afterCraft = JSON.parse(window.localStorage.getItem("pr_meta_save"));
assert.equal(afterCraft.stash.ammo_pack, (beforeCraft.stash.ammo_pack || 0) + 1, "field crafting creates usable supplies from prep");
A.devCur(); A.go("prep"); A.prepSet("insuranceId","basic");
A.deploy(); A.raidStep(); A.backToBase();

A.go("module","bit_bay"); A.build("bit_bay");
ov = doc.getElementById("overlay"); if(ov) ov.querySelector("[data-close]").click();
assert(text().includes("BIT — Bond LV"), "bond card");
// curated self-expression: cosmetic style for the built BIT Bay
A.go("module","bit_bay");
assert(text().includes("Cozy Tech") && text().includes("Retro-Tech"), "style options for built room");
A.setStyle("bit_bay","warm");
assert(doc.querySelector(".modart") && doc.querySelector(".modart").style.backgroundImage.includes("bitbay_warm"), "chosen style swaps BIT Bay art");
A.go("base");
assert(doc.querySelector(".room-spot.unlocked[data-room=\"bit_bay\"]"), "BIT Bay remains available on the panoramic hub");
assert(text().includes("Cozy Tech"), "chosen BIT Bay style remains visible on its panoramic hotspot");
// The persistent habitable state remains active while individual rooms progress.
assert(doc.querySelector(".baseviewer").className.includes("hub-core_habitable"), "habitable state remains stable as rooms are repaired");

// raid_3 death with premium insurance
A.devForce("death");
A.go("prep"); A.prepSet("insuranceId","premium");
A.deploy(); A.raidStep();
assert(text().includes("KIA") && text().includes("PROGRESS MOVED"), "death keeps progress");
assert(text().includes("NEXT UPGRADE") || text().includes("READY TO BUILD"), "one-more-raid card on death");
A.backToBase();

// --- Agency v0.7: staged checkpoints on a live raid ---
// Force a live, unforced raid onto a deep route (reactor => 3 stages) and survive pushes.
A.go("dev"); doc.getElementById("devbeat").value = "6"; A.devJump();  // raid_3 (not forced)
A.go("prep"); A.prepSet("routeId","reactor");
window.eval("window.__origRnd = Math.random; Math.random = function(){ return 0.9; };"); // survive pushes
A.deploy(); A.raidStep();
assert(text().includes("CHECKPOINT 1/"), "staged raid shows a checkpoint");
assert(text().includes("EXTRACT NOW") && text().includes("PUSH DEEPER"), "both choices present");
assert(text().includes("In your bag") && text().includes("at risk"), "communicates haul + risk");
A.pushDeeper();            // survives -> next stage feed
A.raidStep();
assert(text().includes("CHECKPOINT 2/") || text().includes("EXTRACTED"), "advances to next checkpoint or ends");
if(text().includes("CHECKPOINT")) A.extractNow();
assert(text().includes("EXTRACTED"), "extract-now banks the haul");
A.backToBase();
// push deeper and die (rng 0.01 < pushDeathChance)
A.go("dev"); doc.getElementById("devbeat").value = "6"; A.devJump();
A.go("prep"); A.prepSet("routeId","reactor");
A.deploy(); A.raidStep();
assert(text().includes("CHECKPOINT"), "checkpoint before the fatal push");
window.eval("Math.random = function(){ return 0.01; };");
A.pushDeeper();
assert(text().includes("KIA"), "push deeper can kill and lose the haul");
window.eval("Math.random = window.__origRnd;");
A.backToBase();

// retention: core mode has none of it
A.go("base");
assert(!text().includes("Send BIT on expedition"), "no expedition in core mode");
// full mode
A.go("dev"); doc.getElementById("devret").value = "full"; A.devRetMode();
assert(doc.getElementById("currencies").textContent.includes("Fuel"), "fuel chip in full");
A.go("base");
assert(text().includes("Send BIT on expedition"), "expedition card in full");
A.go("prep"); assert(text().includes("Fuel"), "fuel section on prep");
// expedition round trip via dev timer
A.go("base"); A.sendExpedition();
assert(text().includes("BIT is in the field"), "expedition running");
A.go("dev"); A.devFinishTimers();
const ovm = doc.getElementById("overlay");
assert(ovm && ovm.textContent.includes("MORNING REPORT"), "morning report on return");
ovm.querySelector("[data-close]").click();
A.go("base");
assert(!doc.getElementById("overlay"), "no morning report without events");

// softlock guard
A.go("stash");
while(true){
  const sv = JSON.parse(window.localStorage.getItem("pr_meta_save"));
  const wid = Object.keys(sv.stash).find(id => sv.stash[id] > 0 && window.DATA.items.find(i=>i.id===id).slot === "weapon");
  if(!wid) break;
  A.sell(wid);
}
A.go("prep");
assert(text().includes("EMERGENCY LOADOUT"), "emergency loadout");
A.emergencyLoadout();

// vendor/craft/stash + survey + end
A.go("vendor"); A.buy("cable"); A.craft("ammo_pack");
A.go("stash"); A.itemDetail("cable"); A.sell("cable");
// The choice upgrade must advance to a reachable end screen; repairing the final
// room also promotes and persists the original refined bunker transformation.
A.go("dev"); doc.getElementById("devbeat").value = "7"; A.devJump();  // choice_upgrade
A.devCur();
doc.getElementById("devitem").value = "polymer_plate"; A.devGrant(); A.go("dev");
doc.getElementById("devitem").value = "polymer_plate"; A.devGrant(); A.go("dev");
doc.getElementById("devitem").value = "servo"; A.devGrant();
A.go("module","storage"); A.build("storage");
ov = doc.getElementById("overlay"); if(ov) ov.querySelector("[data-close]").click();
assert(doc.querySelector(".baseviewer").className.includes("hub-core_refined"), "all repaired rooms persist the refined bunker state");
revealRoomThroughHotspot("living_quarters");
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_04"), "Living Quarters selects final plate");
{ const sv = JSON.parse(window.localStorage.getItem("pr_meta_save"));
  assert(sv.beat === 8, "choice upgrade advances to end after Storage is built (got beat " + sv.beat + ")");
  assert.equal(sv.baseState, "core_refined", "refined base state is saved"); }
A.go("end");
assert(doc.getElementById("app").className === "s-end", "end screen navigation is reachable");
assert(text().includes("QUICK QUESTION"), "survey first");
for(const q of window.DATA.progression.survey) A.survey(q.id, q.opts[0]);
assert(text().includes("END OF PROTOTYPE"), "end screen");
assert(window.DATA.progression.survey.length === 6, "six survey questions");

const S = JSON.parse(window.localStorage.getItem("pr_meta_save"));
for(const a of ["SCREEN_TIME","STYLE_SELECTED","NEXT_UPGRADE_SHOWN","RESULT_TO_DEPLOY","EXPEDITION_SENT","EXPEDITION_RETURNED","MORNING_REPORT","RETENTION_MODE_SET",
  "RAID_ROUTE_SHOWN","TRACKED_ROUTE_RECOMMENDED","RAID_ROUTE_SELECTED","CHECKPOINT_REACHED","EXTRACT_NOW_SELECTED","PUSH_DEEPER_SELECTED","RAID_FAILED_AFTER_PUSHING_DEEPER"])
  assert(S.log.some(e=>e.action===a), a + " logged");
// ads must NOT appear in the default/core test flow (only full mode)
assert(!S.log.some(e=>e.action==="AD_STARTED" && e.payload && /haul|recover/i.test(e.payload.label||"")) ||
  S.log.some(e=>e.action==="RETENTION_MODE_SET" && e.payload.mode==="full"),
  "no 2x-haul / recovery ads shown in core mode");
console.log("ALL UI TESTS PASSED — " + S.log.length + " events");
process.exit(0);
})().catch(e => { console.error(e.stack); process.exit(1); });
