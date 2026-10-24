// v1.71 quest log UI: log rendering, tracked goal card, TRACK toggle, hand-in, launch param, auto turn-in row.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, trackedQuest, chainActive, chainState, ingestRaidResult, questLaunchParam, chainReady };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document };
}
const g = boot(null); g.A.dismissIntro();
const fresh = JSON.parse(JSON.stringify(g.S()));
const open = JSON.parse(JSON.stringify(fresh)); open.v = 8; open.cur.scrap = 0;
Object.assign(open.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); open.baseState = "core_habitable"; open.introSeen = true;
open.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; open.beat = g.w.DATA.progression.beats.findIndex(b => b.id === "choice_upgrade");

// FTUE unchanged: no tracked card, the upgrade goal stays
{ const f = boot(fresh); f.A.dismissIntro(); f.A.go("base");
  assert(f.d.querySelector(".s-base .progress-goal") && !f.d.querySelector(".qgoal"), "FTUE keeps the upgrade goal card"); }

const b = boot(open), { A, d, T } = b; A.dismissIntro(); A.go("base");
assert(T.trackedQuest(), "a chain is tracked");
// v1.76 tab bar: RAID last (far right, after the gap), pulsing while a quest is tracked and the tab is usable
{ const tabs = [...d.querySelectorAll("#tabs > button, #tabs > .nav-gap")];
  assert.deepEqual(tabs.filter(x => x.tagName === "BUTTON").map(x => x.getAttribute("aria-label").replace(" (locked)", "")), ["BASE","STASH","SHOP","BIT","WEAPONS","RAID"]);
  assert(tabs[tabs.length - 2].classList.contains("nav-gap") && tabs[tabs.length - 1].classList.contains("nav-prep"), "gap sits right before RAID");
  const raid = d.querySelector("#tabs .nav-prep");
  assert.equal(raid.classList.contains("quest-pulse"), !raid.classList.contains("locked"), "pulse follows tracked quest on a usable RAID tab"); }
// tracked goal card replaces the goal card in the same slot
const card = d.querySelector(".s-base .progress-goal.qgoal");
assert(card, "tracked quest card on base"); assert.equal(d.querySelectorAll(".s-base .progress-goal").length, 1, "one card in the slot");
assert(card.textContent.includes("Power Trace") && card.textContent.includes("0/3"), "title + prog/n"); assert(card.querySelector("svg use[href$='#item-cable']"), "objective item icon");
// tapping opens the quest log (shared overlay, X top-left)
assert.equal(card.getAttribute("onclick"), "A.questLog('bunker')"); A.questLog("bunker");
let log = d.querySelector("#overlay .qlog"); assert(log, "quest log opens"); assert(log.closest(".pop-card") || log.classList.contains("pop-card"), "uses the shared popup frame"); assert(d.querySelector("#overlay .pop-x"), "shared close X");
assert.equal(log.querySelectorAll(".qtab").length, 3, "bunker, archipelago, daily tabs");
assert(log.querySelector(".qtab.on use[href$='#area-bunker']"), "bunker tab selected");
assert(log.querySelector(".qtab[disabled] use[href$='#lock']"), "locked area shows a lock");
assert.equal(log.querySelectorAll(".qrow").length, 8);
assert(log.querySelector(".qrow.cur.sel .pips i") && log.querySelectorAll(".qrow.cur .pips i").length === 3, "current step has progress pips");
assert.equal(log.querySelectorAll(".qrow.lock").length, 7, "future steps are locked"); assert(log.querySelector(".qrow.lock use[href$='#lock']"));
assert(log.querySelector(".qobj .qt use[href$='#item-cable']") && log.querySelector(".qobj").textContent.includes("0/3"), "objective tiles");
assert(log.querySelector(".qrw .qt use[href$='#cur-scrap']") && log.querySelector(".qrw .qt use[href$='#star']"), "reward tiles");
assert(!/[←-⯿☀-➿\u{1F300}-\u{1FAFF}]/u.test(log.textContent), "no glyphs");
A.questLog("bunker", 0); { const br = d.querySelector('#overlay .qlog .qdet .qbrief'); assert(br, 'brief line shown'); assert.equal(br.textContent, T.chainActive('bunker').brief); log = d.querySelector('#overlay .qlog'); }
// TRACK toggle: already tracked -> TRACKED; a locked step shows no toggle
assert(log.querySelector(".qtrack.on") && log.querySelector(".qtrack").textContent.includes("Tracked"));
A.questLog("bunker", 3); log = d.querySelector("#overlay .qlog"); assert(!log.querySelector(".qtrack"), "future step: no track toggle"); assert(log.querySelector(".qobj.dim"));
assert.equal(d.querySelectorAll("#overlay").length, 1, "never stacked popups");
// switching track changes the tracked quest and the card
b.S().debugAreas = true; A.questLog("archipelago");
log = d.querySelector("#overlay .qlog"); assert(log.querySelector(".qtrack:not(.on)").textContent.trim() === "Track");
A.QUEST_TRACK({ chain:"archipelago" }); assert.equal(T.trackedQuest().chain, "archipelago");
log = d.querySelector("#overlay .qlog"); assert(log.querySelector(".qtrack.on"), "now Tracked"); assert(log.querySelector(".qrow.cur.trk"), "tracked step highlighted in the list"); assert(log.querySelector(".qtab.trk use[href$='#area-archipelago']"), "tracked tab marked");
assert(d.querySelector(".s-base .qgoal").textContent.includes("Landfall"), "card follows the tracked quest");
assert.equal(T.questLaunchParam(), null, "area bunker raid: archipelago quest has no chip");
// daily tab shows the existing daily quests
A.questLog("daily"); log = d.querySelector("#overlay .qlog"); assert(log.querySelector(".quests .quest"), "daily quests inside the log");
// BIT Bay entry
d.querySelector("#overlay [data-close]").click(); assert(!d.getElementById("overlay"));
A.go("bit"); const ent = d.querySelector(".questentry"); assert(ent, "QUESTS entry in BIT Bay"); assert.equal(ent.getAttribute("onclick"), "A.questLog()"); A.questLog(); assert(d.querySelector("#overlay .qlog"), "entry opens the log");
// hand-in
d.querySelector("#overlay [data-close]").click();
A.QUEST_TRACK({ chain:"bunker" }); b.S().chains.bunker.step = 2; b.S().stash.scrap_alloy = 3; b.S().stash.polymer_plate = 1; b.S().fir = {};
A.questLog("bunker"); log = d.querySelector("#overlay .qlog"); assert(log && ![...log.querySelectorAll(".qact button")].some(x => x.textContent.includes("HAND IN")), "plain copies: no HAND IN, the log stays open");
assert(log.querySelector(".qobj .qt.fir .firmk"), "requirement tiles carry the FIR marker"); assert(log.querySelector(".qfir"), "FIR tag on the quest");
b.S().fir = { scrap_alloy: 3, polymer_plate: 1 };
A.questLog("bunker"); assert(d.querySelector("#overlay .handin"), "ready quest opens the HAND IN popup"); assert.equal(d.querySelectorAll("#overlay").length, 1);
A.QUEST_HANDIN({ chain:"bunker" }); assert.equal(T.chainActive("bunker").id, "B4");
b.S().chains.bunker.step = 3; b.S().chains.bunker.prog = 0;
// launch param (bunker raid, tracked fuse quest on L2)
assert.equal(T.questLaunchParam(), "extract:fuse:0:2:2");
assert(b.w.eval('coreLaunchUrl("r","s","../",{quest:"extract:fuse:0:2"})').includes("&quest=extract%3Afuse%3A0%3A2"));
// completed extract steps wait for the HAND IN popup (no silent turn-in, no toast)
d.querySelector("#overlay [data-close]") && d.querySelector("#overlay [data-close]").click(); b.S().chains.bunker.step = 0;
const res = T.ingestRaidResult({ schema:"protocol-rebirth/raid-result", version:1, raidId:"x1", outcome:"extract", area:"bunker", levelsCleared:1, extracted:["cable","cable","cable"], lost:[], killsByType:{} });
assert.deepEqual(res.chainsDone.map(c => c.id), ["B1"]); assert.equal(T.chainActive("bunker").id, "B1", "still B1 until handed in");
A.go("base"); assert(!d.getElementById("overlay"), "no popup yet"); const shown = b.w.eval("maybeShowHandIn()"); assert(shown && d.querySelector("#overlay .handin"), "popup on base load");
console.log("QUEST LOG TEST PASSED");
