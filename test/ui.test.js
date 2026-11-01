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
for(const s of ["data/items.js","data/modules.js","data/bit.js","data/bit-lines.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js","app.js"])
  window.eval(fs.readFileSync(path + "/" + s, "utf8")+(s==='app.js'?';window.__TEST_STATE=()=>S;':''));
const doc = window.document, A = window.A;
// v2.22.1: a fresh profile's splash auto-launches the FTUE raid once it finishes fading (see
// test/ftue-direct.test.js); this walkthrough exercises the base layer directly instead, so the
// pending splash timer must not fire a real deploy (medkit consumption, location.assign) partway
// through one of the sleeps below.
A.startFtueDirect = () => {};
const text = () => doc.getElementById("app").textContent;
const bitTasksText = () => doc.querySelector("#overlay .tasktab.active").textContent;
const tap = el => {
  el.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles:true, clientX:100, clientY:100 }));
  el.dispatchEvent(new window.MouseEvent("pointerup", { bubbles:true, clientX:100, clientY:100 }));
  el.dispatchEvent(new window.MouseEvent("click", { bubbles:true, clientX:100, clientY:100, detail:1 }));
};
const revealRoomThroughHotspot = id => {
  // Fund later rooms explicitly; access no longer bypasses a paid activation.
  const st=window.__TEST_STATE(),m=window.DATA.modules.find(m=>m.id===id),next=m&&m.levels.find(l=>l.level===(st.modules[id]||0)+1);
  if(next){for(const [key,n] of Object.entries(next.cost.items||{}))st.stash[key]=Math.max(n,st.stash[key]||0);if(next.cost.scrap)st.cur.scrap=Math.max(st.cur.scrap,next.cost.scrap);}
  A.go('base');
  tap(doc.querySelector('.room-spot[data-room="' + id + '"]'));
  const button = doc.querySelector("#overlay button.primary");
  assert(button, id + " ready reveal panel"); A.unlockRoom(id);A.back();
};

// shell
assert(doc.getElementById("topbar") && doc.getElementById("rotate"), "landscape-only shell with a rotate screen for portrait");
assert(doc.getElementById("splash"), "splash shown at first start");
assert(doc.querySelector("#topbar #menubtn") && doc.querySelector("#settings-menu #reset-progress"), "settings menu holds Reset");
// v2.22.1 FTUE direct path: a fresh profile's splash now goes straight into the first raid (see
// test/ftue-direct.test.js); the cold open shows once, after that raid's first extraction. This
// walkthrough renders it directly so the rest of the base-layer coverage below still runs through
// the familiar intro -> base -> build flow.
A.go("base"); // base redirects to the cold open while !S.introSeen
assert(text().includes("PROTOCOL REBIRTH"), "intro");
assert(doc.querySelector(".intro .intro-face") && doc.querySelectorAll(".intro-lines p").length >= 2 && doc.querySelector(".intro-go"), "cinematic intro: BIT face, lines, compact enter button");
A.introSkip({target: doc.querySelector(".intro")}); assert(doc.querySelector(".intro.done"), "tap skips the intro animation");
A.dismissIntro();
// The combat sandbox opens from prep, accepts a shot, and closes without
// disturbing the meta-game's base screen.
A.playCombatDemo();
assert(text().includes("LIVE FIRE TEST") && doc.getElementById("combat-arena"), "combat test screen opens");
const playerTop = doc.getElementById("combat-player").style.top;
A.combatStep("up");
assert.notEqual(doc.getElementById("combat-player").style.top, playerTop, "tap movement moves the player");
A.combatFire();
assert.equal(doc.getElementById("combat-ammo").textContent, "17 / 18", "firing spends one round");
A.endCombatDemo();
assert(!doc.querySelector(".combat-launch"), "v2.21.1: no Live Fire entry point in raid prep");
A.go("base");
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
assert.equal(doc.querySelectorAll("#tabs button:not([disabled]):not(.active)").length, 0, "found state locks non-base navigation");
assert.equal(doc.querySelectorAll("#tabs button").length, 6, "full bottom bar incl. WEAPONS on every main screen");
A.go("module","fabricator");
assert.equal(doc.getElementById("app").className, "s-base", "locked room cannot open its module flow");

const cur0 = doc.getElementById("currencies").textContent;
assert(cur0.includes("Scrap") && !cur0.includes("Signals") && !cur0.includes("Fuel"), "core mode: scrap only");

// Keyboard activation still works after dragging, without another pointerdown.
dragTarget.dispatchEvent(new window.MouseEvent("click", { bubbles:true, detail:0 }));
assert(doc.querySelector("#overlay .bpop[data-module=rebirth_core]"), "keyboard opens the Core popup after a drag");
assert.equal(doc.querySelectorAll("#overlay .bpop button.primary").length, 1, "popup has exactly one primary action");
assert(/BUILD|RAID FOR/.test(doc.querySelector("#overlay .bpop button.primary").textContent), "primary action is build or raid-for");
(doc.querySelector("#overlay [data-close]") ? doc.querySelector("#overlay [data-close]").click() : doc.defaultView.A.back());
A.go("base");
tap(doc.querySelector(".core-spot"));
assert(doc.querySelector("#overlay .bpop"), "pointer tap opens the Core popup");
assert(doc.querySelector(".core-spot .tag em"), "building plate shows its level");
A.buildingInfo("rebirth_core");
assert(!doc.getElementById("overlay"), "info closes the popup");
assert.equal(doc.getElementById("app").className, "s-module", "ⓘ opens Core details");
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
(doc.querySelector("#overlay [data-close]") ? doc.querySelector("#overlay [data-close]").click() : doc.defaultView.A.back());
assert(!doc.body.classList.contains("base-dark"), "base env lit after Core L1");
assert(doc.querySelector(".baseviewer").className.includes("hub-core_habitable"), "bunker becomes habitable after first build");
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_00"), "powered Core retains covered plate 00");
assert.equal(doc.querySelector(".baseviewer").dataset.audio, "powered_hub", "habitable state selects powered audio profile");
assert(doc.querySelectorAll("#tabs button:not([disabled])").length >= 3, "habitable state unlocks navigation");
assert(text().includes("Fabricator L1")&&text().includes("+25")&&text().includes("+1 SLOT"), "base names the next room and usable benefit");
assert(!text().includes("NEXT UPGRADE"), "next room has no competing upgrade card");
assert(text().includes("Fabricator") && text().includes("Cable"), "goal shows remaining repair materials");
const cameraBeforeReveal = doc.querySelector(".baseworld").style.transform;
tap(doc.querySelector('.room-spot[data-room="fabricator"]'));
assert(doc.querySelector("#overlay button.primary"), "eligible room opens from its hotspot");
(doc.querySelector("#overlay [data-close]") ? doc.querySelector("#overlay [data-close]").click() : doc.defaultView.A.back());
// Both base and raid-result build CTAs route through goBuild: locked rooms must explain access.
A.goBuild("fabricator");
assert(doc.querySelector('.room-spot.goal-target[data-room="fabricator"]'), "Core completion highlights Fabricator target");
assert(!doc.querySelector('.room-spot.ready[data-room="fabricator"]'), "unfunded room is not buildable");
assert(doc.querySelector("#overlay button.primary").textContent.includes("RAID FOR REPAIR MATERIALS"), "missing materials prioritize raiding");
assert(!doc.getElementById("overlay").textContent.includes("Open access only"), "no free reveal bypass");
A.raidForRoom("fabricator");
assert.equal(doc.getElementById("app").className, "s-prep", "room raid CTA goes to prep");
assert(!doc.getElementById("overlay"), "room raid CTA closes the panel");
A.go("base");
A.unlockRoom("fabricator");
const unlockCount = JSON.parse(window.localStorage.getItem("pr_meta_save")).log.filter(e=>e.action==="ROOM_UNLOCKED").length;
A.unlockRoom("fabricator");
assert.equal(JSON.parse(window.localStorage.getItem("pr_meta_save")).log.filter(e=>e.action==="ROOM_UNLOCKED").length, unlockCount, "repeated unlock is idempotent");
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_00"), "unfunded room stays covered");
const unlocksBeforePreview = JSON.stringify(JSON.parse(window.localStorage.getItem("pr_meta_save")).roomUnlocks);
A.go("dev"); A.devPlate(4);
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_04"), "developer can preview the final plate");
assert(text().includes("PREVIEW"), "developer plate is visibly identified as a preview");
assert.equal(JSON.stringify(JSON.parse(window.localStorage.getItem("pr_meta_save")).roomUnlocks), unlocksBeforePreview, "developer preview does not mutate unlock progress");
A.devPlate(null);
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_00"), "developer can return to saved stage");

// raid_1
A.go("prep");
assert(doc.querySelector(".prepgrid"), "prep grid");
assert(text().includes("Standard loot mission") && text().includes("Basic loadout"), "first raid has one mission and equipped gear");
assert.equal(doc.querySelectorAll("#app select").length, 0, "first raid has no selectable loadout");
assert.equal(doc.querySelectorAll(".prep-locked[aria-disabled=true]").length, 3, "future raid choices are visibly disabled");
assert.equal(doc.querySelectorAll(".lslot[disabled]").length, 2, "starter weapon/armor slots locked; owned medkit stays selectable");
A.prepSet("routeId","control"); A.prepSet("riskId","aggressive"); A.prepLoadout("weapon","");
assert(!text().includes("Insurance"), "no insurance on raid_1");
A.deploy(); A.raidStep();
const firstDeploy = JSON.parse(window.localStorage.getItem("pr_meta_save")).log.find(e=>e.action === "RAID_DEPLOYED").payload;
assert.equal(firstDeploy.routeId, window.DATA.progression.starterRaid.routeId, "first route cannot be changed through actions");
assert.equal(firstDeploy.riskId, "standard", "first risk stays standard");
assert(firstDeploy.loadout.includes(window.DATA.progression.starterRaid.loadout.weapon), "first loadout retains its weapon");
assert(text().includes("EXTRACTED") && text().includes("RAID SECURED"), "result");
assert(text().includes("NEXT UPGRADE") || text().includes("READY TO BUILD"), "one-more-raid card");
A.backToBase();
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_00"), "extract funds but does not auto-activate the room");

A.go("module","fabricator"); A.build("fabricator");
let ov = doc.getElementById("overlay"); if(ov) (ov.querySelector("[data-close]") ? ov.querySelector("[data-close]").click() : doc.defaultView.A.back());

assert(doc.querySelector('.room-spot.goal-target[data-room="storage"]'), "Fabricator completion highlights Vault");
assert(text().includes("Storage / Vault"), "base names the next room goal");
A.raidForRoom("storage");
assert(text().includes("Gather repair materials for Storage / Vault"), "raid goal follows the chosen next room instead of the scripted BIT goal");
A.go("base"); A.track("bit_bay",1);
revealRoomThroughHotspot("storage");
assert(doc.querySelector('.room-spot.goal-target[data-room="bit_bay"]'), "Vault activation highlights BIT Bay next");
revealRoomThroughHotspot("bit_bay");
assert(doc.querySelector(".baseplate.current").getAttribute("src").includes("plate_03"), "ordered reveals retain Fabricator and Vault through BIT Bay");

// raid_2 + insurance
A.go("prep");
assert(text().includes("Insurance") && !text().includes('need 1× Optical Sensor'), "insurance unlocked; completed BIT target is not stale");
assert.equal(doc.querySelectorAll("#app .lslot:not([disabled])").length, 5, "Fabricator unlocks customizable loadout slots (weapon, armor, 2 items, tool)");
assert(doc.querySelector("#app .operator-stats .ostats") && doc.querySelector("#app .riskbar"), "compact operator row + gear risk line");
assert.equal(doc.querySelectorAll("#app .node-raid-launch").length, 1, "one deploy button");
/* v2.0.0 */
assert(!doc.querySelector('#tabs .nav-prep') && !doc.querySelector('#tabs .nav-gap'), "deploy screen has no redundant RAID tab or gap");
A.pickSlot("armor");
assert(doc.querySelector("#overlay .picker .pick"), "slot opens an item picker");
A.chooseSlot("armor", "");
assert(!doc.getElementById("overlay"), "choosing closes the picker");
assert(doc.querySelector('.lslot[data-slot="armor"]').textContent.match(/Empty|None/), "armor slot emptied");
assert(/Medkit/.test(doc.querySelector(".riskbar").textContent), "medkit in a consumable slot is at risk");
A.prepLoadout("c1", ""); A.prepLoadout("c2", "");
assert(doc.querySelector(".riskbar.safe"), "no gear at risk once armor and medkits are removed");
assert(text().includes("RAID PLANNING UNLOCKED") && text().includes("FIELD CRAFTING"), "Fabricator reward is visible on prep");
A.prepSet("routeId","control");
assert(doc.querySelector(".mappanel").style.backgroundImage.includes("env_route_map"), "unlocked raid planning shows its map");
A.devCur(); A.buy("med_gel"); A.buy("med_gel"); A.go("prep");
const beforeCraft = JSON.parse(window.localStorage.getItem("pr_meta_save"));
A.craft("medkit");
const afterCraft = JSON.parse(window.localStorage.getItem("pr_meta_save"));
assert.equal(((afterCraft.stash.medkit || 0) + ((afterCraft.armory || {}).medkit || 0)), (((beforeCraft.stash.medkit || 0) + ((beforeCraft.armory || {}).medkit || 0)) || 0) + 1, "field crafting creates usable supplies from prep");
/* v2.0.0 */
{
  // outside-only jsdom does not compile inline handlers; exercise them explicitly.
  const press = el => { el.onclick = window.Function('event', el.getAttribute('onclick')); el.click(); };
  const st = window.__TEST_STATE(), realNow = window.Date.now;
  const savedIdle = JSON.parse(JSON.stringify(st.idle));
  const savedModules = {...st.modules}, savedArmory = {...st.armory}, savedStash = {...st.stash};
  const now = realNow();
  st.modules.fabricator = 2; st.idle.clock = now;
  st.idle.fab = [
    {rid:'medkit', startAt:now - 1000, doneAt:now + 2500},
    {rid:'armor_patch', startAt:now + 2500, doneAt:now + 6500},
    {rid:'shard_synth', startAt:now + 6500, doneAt:now + 10500}
  ];
  A.go('base');
  assert(doc.querySelector('#tabs .nav-prep'), 'RAID tab returns outside deploy');
  A.openBuilding('fabricator');
  let queue = doc.querySelector('#overlay .fabq');
  assert(queue && !queue.open && queue.querySelector('summary').textContent.includes('3/3'), 'tappable queue starts collapsed with its capacity');
  press(queue.querySelector('summary'));
  assert(queue.open && queue.querySelectorAll('.fab-job').length === 3, 'queue expands to all three jobs');
  assert([...queue.querySelectorAll('.fab-job')].every(row => row.querySelector('i svg, i img') && row.querySelector('b').textContent), 'every job has an icon and name, including currency outputs');
  assert([...queue.querySelectorAll('.fab-collect')].every(btn => btn.hidden && btn.disabled), 'unfinished crafts cannot be collected');
  const before = (st.armory.medkit || 0) + (st.stash.medkit || 0);
  A.collectFab(0);
  assert.equal(st.idle.fab.length, 3, 'collect handler rejects unfinished jobs');
  window.Date.now = () => now + 1000;
  await sleep(1100);
  assert(queue.querySelector('.fab-time').textContent.includes('0:02'), 'countdown updates while the Fabricator popup is open');
  window.Date.now = () => now + 3000;
  await sleep(1100);
  assert.equal(queue.querySelector('.fab-time').textContent, 'Ready', 'timer reaches Ready without navigating');
  assert(!queue.querySelector('.fab-collect').hidden && !queue.querySelector('.fab-collect').disabled, 'ready job exposes COLLECT');
  A.go('prep');
  assert.equal(st.idle.fab.length, 3, 'refresh keeps completed jobs available to collect');
  assert(doc.querySelector('.fabq').open, 'expanded queue survives navigation');
  press(doc.querySelector('.fab-collect'));
  assert.equal(st.idle.fab.length, 2, 'collect removes only the chosen job');
  assert.equal((st.armory.medkit || 0) + (st.stash.medkit || 0), before + 1, 'collect grants the output exactly once');
  A.collectFab(0);
  assert.equal(st.idle.fab.length, 2, 'second tap cannot collect the next unfinished job');
  window.Date.now = () => now + 7000;
  A.openBuilding('fabricator');
  press(doc.querySelector('#overlay .fab-collect'));
  assert.equal(doc.querySelectorAll('#overlay .fab-job').length, 1, 'collect also refreshes the Fabricator popup');
  assert(!doc.querySelector('#overlay .fabcraft').textContent.includes('QUEUE FULL'), 'collect frees a crafting slot in the open popup');
  window.Date.now = realNow;
  st.idle = savedIdle; st.modules = savedModules; st.armory = savedArmory; st.stash = savedStash;
  A.go('base');
  const questState = {beat:st.beat, tracked:st.trackedQuest, chains:JSON.parse(JSON.stringify(st.chains)), area:st.area};
  st.beat = window.DATA.progression.beats.findIndex(b => b.id === 'choice_upgrade');
  st.trackedQuest = 'bunker'; st.chains.bunker = {step:0, prog:0};
  let launches = 0; window.PR_NAVIGATE = () => launches++;
  const gearBefore = JSON.stringify(st.armory);
  press(doc.querySelector('#tabs .nav-prep'));
  assert.equal(doc.getElementById('app').className, 's-prep', 'bottom RAID with a tracked quest opens loadout');
  A.go('base'); A.questLog('bunker', 0);
  assert(doc.querySelector('#overlay .qraid'), 'tracked quest offers RAID');
  press(doc.querySelector('#overlay .qraid'));
  assert.equal(doc.getElementById('app').className, 's-prep', 'quest RAID opens deploy/loadout');
  assert(!doc.querySelector('#overlay') && !doc.querySelector('#tabs .nav-prep'), 'quest log closes and redundant RAID stays absent');
  assert.equal(doc.querySelectorAll('.node-raid-launch').length, 1, 'one DEPLOY CTA remains after quest RAID');
  assert.equal(launches, 0, 'RAID entry points never launch directly');
  assert.equal(JSON.stringify(st.armory), gearBefore, 'opening deploy does not consume gear');
  delete window.PR_NAVIGATE;
  st.beat = questState.beat; st.trackedQuest = questState.tracked; st.chains = questState.chains; st.area = questState.area;
}
A.devCur(); A.go("prep"); A.prepSet("insuranceId","basic");
A.deploy(); A.raidStep(); A.backToBase();

A.go("module","bit_bay"); A.build("bit_bay");
ov = doc.getElementById("overlay"); if(ov) (ov.querySelector("[data-close]") ? ov.querySelector("[data-close]").click() : doc.defaultView.A.back());
A.go("bit");
assert(doc.querySelector("#overlay .bitpop .bitbond").textContent.includes("Bond LV"), "bond card on the BIT screen");
assert(!doc.querySelector("#currencies .bondpill") && !doc.querySelector("#tabs .nav-bit .bondlv"), "v1.94: bond level shown on the BIT screen only");
assert(doc.querySelector("#tabs .nav-bit:not([disabled])"), "BIT button unlocked in bottom bar");
// curated self-expression: cosmetic style for the built BIT Bay
A.go("module","bit_bay");
assert(text().includes("Cozy Tech") && text().includes("Retro-Tech"), "style options for built room");
A.setStyle("bit_bay","warm");
assert(doc.querySelector(".modart") && doc.querySelector(".modart").style.backgroundImage.includes("bitbay_warm"), "chosen style swaps BIT Bay art");
A.go("base");
assert(doc.querySelector(".room-spot.unlocked[data-room=\"bit_bay\"]"), "BIT Bay remains available on the panoramic hub");
assert(text().includes("Cozy Tech"), "chosen BIT Bay style remains visible on its panoramic hotspot");
// The persistent habitable state remains active while individual rooms progress.
assert(doc.querySelector(".baseviewer").className.includes("hub-core_refined"), "paid canonical rooms promote the fully repaired base");

// raid_3 death with premium insurance
A.devForce("death");
A.go("prep"); A.prepSet("insuranceId","premium");
A.deploy(); A.raidStep();
assert(text().includes("KIA") && text().includes("RAID LOST"), "death keeps progress");
assert(text().includes("NEXT UPGRADE") || text().includes("READY TO BUILD"), "one-more-raid card on death");
A.backToBase();

// --- Agency v0.7: staged checkpoints on a live raid ---
// Force a live, unforced raid onto a deep route (reactor => 3 stages) and survive pushes.
A.go("dev"); doc.getElementById("devbeat").value = "6"; A.devJump();  // raid_3 (not forced)
A.go("prep"); A.prepSet("routeId","reactor");
window.eval("window.__origRnd = Math.random; Math.random = function(){ return 0.9; };"); // survive pushes
A.deploy(); A.raidStep();
assert(text().includes("CHECKPOINT 1/"), "staged raid shows a checkpoint");
assert(text().includes("EXTRACT") && text().includes("PUSH DEEPER"), "both choices present");
assert(text().includes("IN YOUR BAG") && text().includes("NOT SECURED") && doc.querySelector(".cp-risk"), "communicates haul + risk (PRB-9)");
if(process.env.DUMP_CP) fs.writeFileSync(process.env.DUMP_CP, JSON.stringify({ cls:doc.getElementById("app").className, html:doc.getElementById("app").innerHTML }));
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
A.go("bit", "tasks");
assert(!bitTasksText().includes("Send BIT on expedition"), "no expedition in core mode");
// full mode
A.go("dev"); doc.getElementById("devret").value = "full"; A.devRetMode();
assert(doc.getElementById("currencies").textContent.includes("Fuel"), "fuel chip in full");
A.go("bit", "tasks");
assert(bitTasksText().includes("Send BIT on expedition"), "expedition card in full");
A.go("prep"); assert(text().includes("Fuel"), "fuel section on prep");
// expedition round trip via dev timer
A.go("bit", "tasks"); A.sendExpedition();
assert(bitTasksText().includes("BIT is in the field"), "expedition running");
A.go("dev"); A.devFinishTimers();
const ovm = doc.getElementById("overlay");
assert(ovm && ovm.textContent.includes("MORNING REPORT"), "morning report on return");
(ovm.querySelector("[data-close]") ? ovm.querySelector("[data-close]").click() : doc.defaultView.A.back());
A.go("base");
assert(!doc.getElementById("overlay"), "no morning report without events");

// softlock guard
A.go("stash");
while(true){
  const sv = JSON.parse(window.localStorage.getItem("pr_meta_save"));
  const inv = Object.assign({}, sv.stash, sv.armory || {}); const wid = Object.keys(inv).find(id => inv[id] > 0 && window.DATA.items.find(i=>i.id===id).slot === "weapon");
  if(!wid) break;
  A.sell(wid);
}
A.go("prep");
assert(text().includes("EMERGENCY LOADOUT"), "emergency loadout");
A.emergencyLoadout();

// vendor/craft/stash + survey + end
A.go("vendor"); A.buy("cable"); A.craft("medkit");
A.go("stash"); A.itemDetail("cable"); A.sell("cable");
// The choice upgrade must advance to a reachable end screen; repairing the final
// room also promotes and persists the original refined bunker transformation.
A.go("dev"); doc.getElementById("devbeat").value = "7"; A.devJump();  // choice_upgrade
A.devCur();
doc.getElementById("devitem").value = "polymer_plate"; A.devGrant(); A.go("dev");
doc.getElementById("devitem").value = "polymer_plate"; A.devGrant(); A.go("dev");
doc.getElementById("devitem").value = "servo"; A.devGrant();
A.go("base"); // Vault L1 was already paid and activated in canonical order above.
ov = doc.getElementById("overlay"); if(ov) (ov.querySelector("[data-close]") ? ov.querySelector("[data-close]").click() : doc.defaultView.A.back());
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

/* v2.0.0: outcome reactions are ordered, cached, and use the shipped portraits. */
{
  const pools = window.DATA.bitSummary.pools;
  for(const pool of Object.values(pools)) assert(pool.lines.length >= 3 && pool.lines.length <= 4, 'small varied BIT pool');
  const react = (r, res) => window.pickRaidReaction({outcome:'extract', ...r}, {added:[], ...res});
  const common = ['scrap_alloy','cable'];
  assert.equal(react({}, {added:['power_relay'], questChanges:[{complete:true}], returnedGear:['smg_vector']}).trigger, 'rare', 'rare precedes quest and weapon');
  assert.equal(react({}, {questChanges:[{complete:true}],returnedGear:['smg_vector']}).trigger, 'quest', 'quest precedes weapon');
  assert.equal(react({}, {returnedGear:['smg_vector']}).mood, 'smug', 'surviving weapon reaction');
  assert.equal(react({health:5,maxHealth:100}, {added:common}).mood, 'relieved', 'close-call health');
  assert.equal(react({shield:0,maxShield:20}, {added:common}).trigger, 'close', 'depleted shield');
  assert.equal(react({elapsedMs:100}, {}).trigger, 'empty', 'near empty precedes short');
  assert.equal(react({elapsedMs:100}, {added:common,stashBefore:{cable:8}}).trigger, 'glut', 'duplicates precede short');
  assert.equal(react({elapsedMs:100}, {added:common}).trigger, 'short', 'brief quiet raid');
  assert.equal(react({}, {added:common}).trigger, 'generic', 'generic fallback');
  assert.equal(react({outcome:'death'}, {added:['power_relay']}).mood, 'disappointed', 'death overrides rare');
  assert.equal(react({outcome:'timeout'}, {}).trigger, 'death', 'timeout uses death voice');
  assert(Object.values(pools).reduce((n,p)=>n+p.lines.length,0)>=30,'at least thirty lines');
  for(const [r,res,trigger] of [
    [{firstExtract:true},{},'first'],[{remainingMs:1},{added:common},'timer'],
    [{},{added:Array(8).fill('cable')},'loaded'],[{perksTaken:['reload']},{added:common},'perks'],
    [{enemiesDefeated:4},{added:common},'kills'],[{gearConsumed:['scout_rig']},{added:common},'gearLost']
  ])assert.equal(react(r,res).trigger,trigger);
  const before=react({},{}),after=react({},{});
  assert.notEqual(before.id,after.id,'no consecutive repeated line');
  assert.equal(window.localStorage.getItem('pr_bit_last_raid_line'),after.id,'last id persisted');


  // Boot real return flows: ingest once, one shared popup, itemised ledger and one BIT line.
  let lastReturnLine='gearLost:0';
  for(const [outcome, gearOut, consumed] of [['extract',['smg_vector','scout_rig']], ['death',['smg_vector','scavenger_vest']], ['death',['rifle_marksman','scavenger_vest']], ['timeout',['smg_vector','scavenger_vest']], ['extract',['smg_vector'],true]]){
    const rd = new JSDOM(fs.readFileSync(path + '/index.html','utf8'), {runScripts:'outside-only',url:'http://localhost/'});
    const w = rd.window, seed = JSON.parse(JSON.stringify(window.__TEST_STATE()));
    seed.introSeen = true; seed.retentionMode = 'core'; seed.bondXp = 0;
    seed.modules.bit_bay = 1; seed.secureItem = null; seed.coreRaidsIngested = [];
    seed.coreLaunch = {raidId:'summary-test',gear:['smg_vector','scout_rig'],kit:{medkit:2},tool:{id:'tool_emp',n:2},area:'bunker'};
    seed.quests = {day:window.dayStr(),swaps:0,list:[{id:'summary-q',type:'extract',item:'cable',n:2,prog:0,done:false,claimed:false}]};
    const result = {schema:'protocol-rebirth/raid-result',version:1,raidId:'summary-test',outcome,area:'bunker',levelsCleared:1,nodesLit:1,enemiesDefeated:0,
      extracted:outcome==='extract'?['cable','cable','salvage_crate']:[],lost:outcome!=='extract'?['cable','cable']:[],gearOut:outcome==='extract'?gearOut:[],equipmentLost:outcome==='extract'?[]:gearOut,gearConsumed:consumed?['scout_rig']:[],weapon:'smg_vector',kitLeft:{medkit:1},toolLeft:{id:'tool_emp',n:1},health:60,maxHealth:100,elapsedMs:90000};
    w.localStorage.setItem('pr_meta_save',JSON.stringify(seed)); w.localStorage.setItem('pr_raid_result_v1',JSON.stringify(result));
    w.localStorage.setItem('pr_bit_first_extract','1');w.localStorage.setItem('pr_bit_last_raid_line',lastReturnLine);
    w.URL.createObjectURL = () => 'blob:fake';
    const scripts = [...doc.querySelectorAll('script[src]')].map(el => el.getAttribute('src').split('?')[0]).filter(src => !src.startsWith('http'));
    for(const src of scripts) w.eval(fs.readFileSync(path + '/' + src,'utf8'));
    const popup = w.document.querySelector('#overlay .raid-summary-pop.pop-card');
    assert(popup && w.document.querySelectorAll('#overlay').length === 1, 'one merged shared result popup on return');
    assert(popup.textContent.includes(outcome==='extract' ? 'RAID SECURED' : 'RAID LOST'), 'outcome header shown');
    assert.equal(popup.querySelectorAll('.rs-bubble p').length,1,'exactly one BIT line');
    const lineId=w.localStorage.getItem('pr_bit_last_raid_line'),[trigger,lineIndex]=lineId.split(':');
    assert.notEqual(lineId,lastReturnLine,'real returns do not repeat BIT lines');lastReturnLine=lineId;
    assert.equal(popup.querySelector('.rs-bubble p').textContent,w.DATA.bitSummary.pools[trigger].lines[Number(lineIndex)],'selected context line appears inside the speech bubble');
    assert.equal(popup.querySelector('.raid-summary').dataset.trigger,trigger,'bubble uses the actual return context');
    assert(popup.querySelector('source').srcset.includes('bit-summary-'), 'existing summary art through bitImg');
    const gainRows = [...popup.querySelectorAll('.loot-card.gain')];
    const lossRows = [...popup.querySelectorAll('.loot-card.loss')];
    if(outcome==='extract'){
      assert(popup.querySelector('.rs-xp-head .xp-gain'), 'operator XP gain shown on every outcome');
      assert(gainRows.some(el=>el.textContent.includes('SMG')), 'equipped weapon brought home');
      const gear=popup.querySelector('.rs-gear');assert(gear.textContent.includes('GEAR RETURNED') && gear.textContent.includes('SMG'),'dedicated returned gear row');
      assert.equal(gear.textContent.includes('Scout Rig'),!consumed,'only surviving rigs listed as returned');
      assert.equal(gainRows.some(el=>el.textContent.includes('Scout Rig')),!consumed,'consumed rigs not shown as secured loot');
      assert(gainRows.some(el=>el.textContent.includes('Cable') && el.querySelector('b').textContent==='x2'), 'duplicate materials aggregate');
      assert(gainRows.some(el=>el.textContent.includes('Scrap')), 'converted currency and extract bonus shown');
      assert.equal(lossRows.length, 0, 'extract shows the secured grid, not a loss grid');
    } else {
      assert(popup.querySelector('.rs-xp-head .xp-gain'), 'operator XP gain shown on every outcome');
      assert.equal(gainRows.length, 0, 'death shows the lost grid, not a gain grid');
      assert.equal(popup.querySelector('.rs-gear'),null,'lost gear is never labeled returned');
      assert(lossRows.some(el=>el.textContent.includes('SMG') && el.querySelector('b').textContent==='x1'), 'launch gear lost exactly once on death, even if still equipped');
      assert(lossRows.some(el=>el.textContent.includes('Scavenger Vest') && el.querySelector('b').textContent==='x1'), 'armor found and equipped during the raid is lost on death');
      if(gearOut.includes('rifle_marksman')) assert(lossRows.some(el=>el.textContent.includes('Marksman Rifle') && el.querySelector('b').textContent==='x1'), 'found replacement weapon is lost alongside launch gear');
      assert(lossRows.some(el=>el.textContent.includes('Cable') && el.querySelector('b').textContent==='x2'), 'bag loss counted');
      assert(popup.querySelector('source').srcset.includes('disappointed'), 'death mood');
    }
    assert.equal(w.localStorage.getItem('pr_raid_result_v1'), null,'return consumed exactly once');
    assert.equal(w.ingestRaidResult(result).reason,'duplicate','summary does not grant rewards twice');
    rd.window.close();
  }
}
/* Extract screen: title/time, rare-find tag, full scrolling loot grid, death state — direct markup checks. */
{
  const reaction = { trigger:'generic', mood:'smug', line:'test line' };
  const manyIds = ['power_relay','cable','fuse','scrap_alloy','servo','polymer_plate','circuit_board','optical_sensor'];
  const res = { added:manyIds, currency:{}, operatorXp:50, xp:10 };
  const r = { outcome:'extract', elapsedMs:272000, lost:[] };
  const div = window.document.createElement('div');
  div.innerHTML = window.raidSummaryHtml(r, res, reaction, 'Node Raid');
  assert.equal(div.querySelector('h1').textContent, 'EXTRACTED', 'extract title word');
  assert(div.querySelector('.rs-sub').textContent.includes('04:32'), 'raid time formatted as mm:ss from elapsedMs');
  assert(div.querySelector('.loot-card.rare .rare-tag'), 'rare item gets the RARE FIND tag');
  assert.equal(div.querySelectorAll('.loot-grid>.loot-card').length, manyIds.length, 'all extracted items render');
  assert.equal(div.querySelector('.loot-extra'), null, 'no overflow placeholder');
  const names=[...div.querySelectorAll('.loot-card-row>span')].map(e=>e.textContent);
  const items=Object.values(window.DATA.items);
  const values=names.map(name=>items.find(it=>it.name===name).sellValue||0);
  assert(values.every((value,i)=>i===0||value<=values[i-1]), 'highest unit value first');
  const gearDiv=doc.createElement('div');
  gearDiv.innerHTML=window.raidSummaryHtml(r,{added:['scout_rig'],gearFound:['scout_rig'],returnedGear:['scout_rig'],currency:{}},reaction,'Node Raid');
  assert.equal(gearDiv.querySelector('.gear-tag').textContent,'GEAR RETURNED');
  assert.equal(gearDiv.querySelectorAll('.loot-card').length,1,'returned found gear not duplicated');
  assert(gearDiv.querySelector('.rs-gear').textContent.includes('Scout Rig'),'gear row names the surviving rig');
  gearDiv.innerHTML=window.raidSummaryHtml(r,{added:['rifle_marksman','rifle_marksman'],gearFound:['rifle_marksman','rifle_marksman'],returnedGear:['rifle_marksman','rifle_marksman'],currency:{}},reaction,'Node Raid');
  assert.equal(gearDiv.querySelector('.rs-gear-chip>b').textContent,'x2','two returned weapons preserve quantity');
  assert.equal(gearDiv.querySelector('.loot-card-row>b').textContent,'x2','gear loot card counts found equipment once');
  assert(gearDiv.querySelector('.rare-tag'),'rare returned weapons retain the RARE FIND badge');
  const allIds=window.DATA.items.filter(it=>!it.free&&!it.grantsCurrency&&!it.scouts).map(it=>it.id);
  for(const outcome of ['extract','death','timeout']){
    const all=doc.createElement('div');all.innerHTML=window.raidSummaryHtml({outcome,lost:allIds},{added:outcome==='extract'?allIds:[],currency:{}},reaction,'Node Raid');
    assert.equal(all.querySelectorAll('.loot-grid>.loot-card').length,allIds.length,'every item renders for '+outcome);
    const values=[...all.querySelectorAll('.loot-grid>.loot-card')].map(el=>window.DATA.items.find(it=>it.id===el.dataset.item).sellValue||0);
    assert(values.every((v,i)=>!i||values[i-1]>=v),'all '+outcome+' items sort by value');
    assert(!all.querySelector('.loot-extra'),'no +N overflow for '+outcome);
  }
  const css=fs.readFileSync(path+'/index.html','utf8');
  assert(/\.loot-grid\{[^}]*overflow-y:auto/.test(css),'loot grid scrolls inside result');
  assert(!/loot-card:nth-child/.test(css),'no hidden tail of loot cards');

  const rTimeout = { outcome:'timeout', elapsedMs:5000, lost:[] };
  const divTimeout = window.document.createElement('div');
  divTimeout.innerHTML = window.raidSummaryHtml(rTimeout, { added:[], currency:{} }, { trigger:'death', mood:'bored', line:'...' }, 'Node Raid');
  assert.equal(divTimeout.querySelector('h1').textContent, 'LOST', 'timeout title word');

  const rDeath = { outcome:'death', elapsedMs:5000, lost:['cable'] };
  const resDeath = { added:[], lost:['cable'], currency:{} };
  const divDeath = window.document.createElement('div');
  divDeath.innerHTML = window.raidSummaryHtml(rDeath, resDeath, { trigger:'death', mood:'disappointed', line:'...' }, 'Node Raid');
  assert.equal(divDeath.querySelector('h1').textContent, 'KIA', 'death title word');
  assert(divDeath.querySelector('.rs-right-head').textContent.includes('RAID LOST'), 'death header reads RAID LOST');
  assert(divDeath.querySelector('.loot-card.loss'), 'lost item rendered as a dimmed/red loss card');

  // Recovered items (BIT rescue / secure slot / Guardian talent) must still render on death/timeout, not vanish:
  // non-dimmed, tagged SAVED, alongside the dimmed/red loss cards for whatever was actually lost.
  const rSaved = { outcome:'death', elapsedMs:5000, lost:['cable', 'fuse'] };
  const resSaved = { added:[], currency:{}, saved:{ secure:'medkit' }, gearLost:['scavenger_vest'] };
  const divSaved = window.document.createElement('div');
  divSaved.innerHTML = window.raidSummaryHtml(rSaved, resSaved, { trigger:'death', mood:'disappointed', line:'...' }, 'Node Raid');
  const savedCard = divSaved.querySelector('.loot-card.saved');
  assert(savedCard, 'secure-slot recovery renders its own SAVED card on death');
  assert(savedCard.querySelector('.saved-tag') && savedCard.querySelector('.saved-tag').textContent === 'SAVED', 'recovered card carries the SAVED tag');
  assert(savedCard.textContent.includes('Medkit'), 'recovered card names the saved item');
  assert(!savedCard.classList.contains('loss'), 'recovered item is not dimmed/red like a loss card');
  const savedLossCards = [...divSaved.querySelectorAll('.loot-card.loss')];
  assert(savedLossCards.some(el => el.textContent.includes('Cable')), 'bag losses still render alongside the recovered item');
  assert(savedLossCards.some(el => el.textContent.includes('Scavenger Vest')), 'gearLost still renders alongside the recovered item');

  // Saved items must sort ahead of losses so they survive the small-tier cap (nth-child(n+6) hidden in CSS)
  // even when there are enough distinct losses to otherwise push them past the "+N" overflow tile.
  const manyLosses = ['cable','fuse','servo','scrap_alloy','circuit_board','optical_sensor','polymer_plate'];
  const rSavedCap = { outcome:'death', elapsedMs:5000, lost:manyLosses };
  const resSavedCap = { added:[], currency:{}, saved:{ secure:'medkit' } };
  const divSavedCap = window.document.createElement('div');
  divSavedCap.innerHTML = window.raidSummaryHtml(rSavedCap, resSavedCap, { trigger:'death', mood:'disappointed', line:'...' }, 'Node Raid');
  const capCards = [...divSavedCap.querySelectorAll('.loot-grid>.loot-card')];
  const savedCapIdx = capCards.findIndex(el => el.classList.contains('saved'));
  assert(savedCapIdx >= 0, 'saved item stays in the full scrolling grid despite many distinct losses');
  assert.equal(capCards.length,manyLosses.length+1,'no saved or lost items are capped');

  // A recovered item that happens to be rare must still read SAVED, not RARE FIND, on death/timeout.
  const rRareSaved = { outcome:'death', elapsedMs:5000, lost:['cable'] };
  const resRareSaved = { added:[], currency:{}, saved:{ secure:'power_relay' } };
  const divRareSaved = window.document.createElement('div');
  divRareSaved.innerHTML = window.raidSummaryHtml(rRareSaved, resRareSaved, { trigger:'death', mood:'disappointed', line:'...' }, 'Node Raid');
  const rareSavedCard = divRareSaved.querySelector('.loot-card.saved');
  assert(rareSavedCard, 'rare recovered item renders as a saved card');
  assert(rareSavedCard.querySelector('.saved-tag') && rareSavedCard.querySelector('.saved-tag').textContent === 'SAVED', 'rare recovered item carries the SAVED tag, not RARE FIND');
  assert(!rareSavedCard.querySelector('.rare-tag'), 'rare recovered item does not carry a RARE FIND tag');

  // v2.1.1: weapon loot cards (hero/art icons) must use the identical card structure as plain item
  // cards — icon wrapped in .pr-itemimg (centered, sized to fit via CSS), name/qty row unchanged —
  // instead of a bare <img> that breaks the card's flex layout (image pinned to the top, uncentred).
  const rWeapons = { outcome:'extract', elapsedMs:5000, lost:[] };
  const resWeapons = { added:['smg_vector','shotgun_breach','cable'], currency:{} };
  const divWeapons = window.document.createElement('div');
  divWeapons.innerHTML = window.raidSummaryHtml(rWeapons, resWeapons, { trigger:'generic', mood:'smug', line:'...' }, 'Node Raid');
  const weaponCards = [...divWeapons.querySelectorAll('.loot-card')].filter(c => /SMG|Shotgun/.test(c.textContent));
  const itemCard = [...divWeapons.querySelectorAll('.loot-card')].find(c => c.textContent.includes('Cable'));
  assert.equal(weaponCards.length, 2, 'both weapons render their own loot card');
  assert.equal(itemCard.firstElementChild.className, 'pr-itemimg', 'plain item card icon is wrapped in .pr-itemimg');
  for(const card of weaponCards){
    assert.equal(card.querySelector(':scope>.pr-itemimg').className, 'pr-itemimg', 'weapon card icon is wrapped in .pr-itemimg, same as a plain item card');
    assert.equal(card.lastElementChild.className, itemCard.lastElementChild.className, 'weapon card and item card end with the same name/qty row');
    assert(card.querySelector(':scope>.loot-card-row'), 'name/qty row still renders for weapon cards');
  }
}
/* v2.0.0: real badge handlers open, highlight and scroll the matching tab content. */
{
  const st = window.__TEST_STATE(), saved = JSON.parse(JSON.stringify(st));
  const oldScroll = window.HTMLElement.prototype.scrollIntoView;
  let scrolled = null;
  window.HTMLElement.prototype.scrollIntoView = function(){ scrolled = this; };
  const press = el => { assert(el,'badge exists'); el.onclick = window.Function('event',el.getAttribute('onclick')); el.click(); };
  st.modules.bit_bay = 1; st.bondXp = 0; st.talents = {spent:{},respecs:0}; st.retentionMode = 'core';
  st.idle.scavPending = {items:{cable:1},scrap:0};
  A.go('base');
  press(doc.querySelector('#tabs .nav-bit .badge'));
  assert(doc.querySelector('#overlay .tasktab.active'), 'HAUL badge opens TASKS');
  assert(scrolled && scrolled.matches('.scav.pending.badge-pulse'), 'pending haul pulses and scrolls');
  assert(doc.querySelector('#overlay .bittabs [aria-selected=true] .bit-tab-badge').textContent==='HAUL', 'TASKS tab has haul badge');
  st.idle.scavPending = null;
  st.quests = {day:window.dayStr(),swaps:0,list:[{id:'badge-q',type:'extract',item:'cable',n:1,prog:1,done:true,claimed:false,rewards:[]}]};
  A.go('base');
  press(doc.querySelector('#tabs .nav-bit .badge'));
  assert(doc.querySelector('#overlay .questtab.active'), 'READY badge opens QUESTS');
  assert(doc.querySelector('#overlay .bittabs [aria-selected=true] .bit-tab-badge').textContent.includes('READY'), 'destination tab owns badge');
  assert(scrolled && scrolled.matches('.quest.done.badge-pulse'), 'ready quest pulses and scrolls into view');
  A.go('base'); st.bondXp = window.DATA.bit.bondLevels.find(b=>b.level===2).xp;
  press(doc.querySelector('#tabs .nav-bit .badge'));
  assert(doc.querySelector('#overlay .talentstab.active'), 'POINTS badge opens TALENTS');
  assert(scrolled.matches('.talnode.badge-pulse'), 'learnable node pulses and scrolls');
  st.bondXp = 0; st.retentionMode = 'full'; st.contractsDay = window.dayStr();
  const contract = window.DATA.retention.contracts.daily[0]; st.contracts = {[contract.id]:'done'};
  A.go('base'); press(doc.querySelector('#tabs .nav-bit .badge'));
  assert(doc.querySelector('#overlay .tasktab.active'), 'contract READY opens TASKS even when daily quests are ready');
  assert(scrolled.matches('[data-contract="' + contract.id + '"].badge-pulse'), 'ready contract pulses and scrolls');
  Object.keys(st).forEach(k=>delete st[k]); Object.assign(st,saved);
  window.HTMLElement.prototype.scrollIntoView = oldScroll;
  A.go('base');
}
/* CLAIM must tolerate completed quests without reward cards (the browser repro), and return
   to the source tab after paying exactly once. Do not pre-populate rewards in this fixture. */
for(const source of ['bit', 'log']) {
  const st = window.__TEST_STATE(), saved = JSON.parse(JSON.stringify(st));
  const press = el => { el.onclick = window.Function('event', el.getAttribute('onclick')); el.click(); };
  st.modules.bit_bay = 1; st.beat = 999; st.bondXp = 900; st.retentionMode = 'core'; st.quests = null;
  const quests = window.questState();
  quests.list[0].done = true; quests.list[0].prog = quests.list[0].n || 1;
  quests.list[1].done = true;
  assert(!quests.list[0].rewards, 'repro starts with a completed quest missing rewards');
  if(source === 'bit') A.bitTab('quests'); else A.questLog('daily');
  assert.equal(window.dailyReadyCount(), 2, source + ': two quests ready before claiming');
  for(const remaining of [1, 0]) {
    const q = quests.list.find(q => q.done && !q.claimed);
    press(doc.querySelector('#overlay .quest.done:not(.claimed) .claim'));
    assert.equal(doc.querySelectorAll('#overlay').length, 1, source + ': one overlay after CLAIM');
    assert(doc.querySelector('#overlay .qpick'), source + ': CLAIM opens reward picker');
    assert.equal(st.bondXp, 900 + (1 - remaining) * window.DATA.quests.bondXp, 'opening picker does not pay bond XP');
    const rewards = JSON.stringify(q.rewards);
    press(doc.querySelector('#overlay .pop-x'));
    assert.equal(window.dailyReadyCount(), remaining + 1, 'cancel does not claim');
    press(doc.querySelector('#overlay .quest.done:not(.claimed) .claim'));
    assert.equal(JSON.stringify(q.rewards), rewards, 'reopening picker preserves reward choices');
    const idx = q.rewards.findIndex(c => c.kind !== 'mystery'), reward = q.rewards[idx];
    const balance = () => reward.kind === 'scrap' ? st.cur.scrap : reward.kind === 'xp' ? st.opXp || 0 : st.stash[reward.item] || 0;
    const before = balance();
    const card = doc.querySelectorAll('#overlay .qcards button.qcard')[idx];
    press(card);
    assert.equal(balance(), before + reward.n, source + ': selected reward is paid');
    assert.equal(st.bondXp, 900 + (2 - remaining) * window.DATA.quests.bondXp, source + ': bond XP is paid');
    assert(q.claimed, source + ': quest marked claimed');
    assert.equal(doc.querySelectorAll('#overlay').length, 1, source + ': one overlay after picking');
    assert(doc.querySelector(source === 'bit' ? '#overlay .questtab.active' : '#overlay .qlog'), source + ': returns to source tab');
    assert(doc.querySelector('#overlay .quests .quest'), source + ': quest list remains visible');
    assert.equal(window.dailyReadyCount(), remaining, source + ': ready count updates');
    if(source === 'bit') assert.equal(doc.querySelector('#overlay .bittabs button[aria-selected="true"] .bit-tab-badge')?.textContent || '', remaining ? remaining + ' READY' : '', 'BIT ready badge updates');
    press(card);
    assert.equal(balance(), before + reward.n, 'repeated selection cannot pay twice');
  }
  Object.keys(st).forEach(k=>delete st[k]); Object.assign(st,saved);
  A.go('base');
}

/* Mystery rewards replace the picker, then restore the originating quests tab. */
for(const source of ['bit', 'log']) {
  for(const dismissal of ['nice', 'close']) {
    const st = window.__TEST_STATE(), saved = JSON.parse(JSON.stringify(st));
    const press = el => { el.onclick = window.Function('event', el.getAttribute('onclick')); el.click(); };
    st.modules.bit_bay = 1; st.beat = 999; st.bondXp = 900; st.retentionMode = 'core'; st.quests = null;
    const quests = window.questState(), q = quests.list[0];
    q.done = true; q.prog = q.n || 1; q.rewards = [{kind:'mystery'}];
    quests.list[1].done = true;
    if(source === 'bit') { A.go('bit'); A.bitTab('quests'); } else A.questLog('daily');
    const label = source + '/' + dismissal;
    assert.equal(window.dailyReadyCount(), 2, label + ': two quests ready before claiming');
    press(doc.querySelector('#overlay .quest.done:not(.claimed) .claim'));
    assert.equal(doc.querySelectorAll('#overlay').length, 1, label + ': one reward picker');
    press(doc.querySelector('#overlay .qcard.mystery'));
    assert(q.claimed, label + ': mystery reward claimed');
    assert.equal(st.bondXp, 900 + window.DATA.quests.bondXp, label + ': bond XP paid once');
    assert.equal(doc.querySelectorAll('#overlay').length, 1, label + ': exactly one overlay during reveal');
    assert(doc.querySelector('#overlay .mreveal'), label + ': mystery reveal visible');
    doc.querySelector(dismissal === 'nice' ? '#overlay .mreveal .primary[data-close]' : '#overlay .pop-x').click();
    assert.equal(doc.querySelectorAll('#overlay').length, 1, label + ': exactly one overlay after dismissal');
    assert(doc.querySelector(source === 'bit' ? '#overlay.bitov .questtab.active' : '#overlay .qlog'), label + ': source quests tab restored');
    assert(doc.querySelector('#overlay .quests .quest.claimed'), label + ': claimed quest visible');
    assert.equal(window.dailyReadyCount(), 1, label + ': ready count updated');
    if(source === 'bit') assert.equal(doc.querySelector('#overlay .bittabs button[aria-selected="true"] .bit-tab-badge').textContent, '1 READY', label + ': BIT badge updated');
    Object.keys(st).forEach(k=>delete st[k]); Object.assign(st,saved);
    A.go('base');
  }
}

// Consumed rigs cannot be revived by the secure-slot fallback in the base ledger.
{
  const st=window.__TEST_STATE(),snapshot=JSON.parse(JSON.stringify(st));
  for(const outcome of ['extract','death']){
    st.secureItem='scout_rig';st.coreLaunch={raidId:'spent-'+outcome,gear:['scout_rig'],kit:{medkit:0},area:'bunker'};
    const before=window.qty('scout_rig');
    const result=window.ingestRaidResult({schema:'protocol-rebirth/raid-result',version:1,raidId:'spent-'+outcome,outcome,
      extracted:[],lost:[],gearOut:[],gearConsumed:['scout_rig'],levelsCleared:1,nodesLit:1,enemiesDefeated:0});
    assert.equal(result.ok,true);assert.equal(window.qty('scout_rig'),before,'spent rig stays consumed on '+outcome);
    assert.equal(result.saved.secure,null);
  }
  Object.keys(st).forEach(k=>delete st[k]);Object.assign(st,snapshot);
}

// The mission queue must reserve its own height outside the crafting disclosure.
{
  const st=window.__TEST_STATE(),snapshot=JSON.parse(JSON.stringify(st));
  st.modules.fabricator=Math.max(1,st.modules.fabricator||0);
  A.go('prep');A.planToggle(true);
  const panel=doc.querySelector('#mission-panel'),queue=panel.querySelector('.fabq');
  assert(queue,'mission includes the fabricator queue');
  assert.equal(queue.parentElement,panel,'queue is in normal mission flow, outside closed details');
  assert(!queue.closest('.prep-crafting'),'queue never inherits the crafting disclosure geometry');
  assert(queue.compareDocumentPosition(panel.querySelector('.mappanel')) & window.Node.DOCUMENT_POSITION_FOLLOWING,
    'map follows the queue in document flow');
  A.planToggle(false);
  Object.keys(st).forEach(k=>delete st[k]);Object.assign(st,snapshot);A.go('base');
}

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
