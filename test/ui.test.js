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

// shell
assert(doc.getElementById("topbar") && doc.getElementById("rotate"), "landscape shell");
assert(text().includes("PROTOCOL REBIRTH"), "intro");
A.dismissIntro();
assert(doc.querySelectorAll(".room").length === 4, "facility rooms");
assert(text().includes("Power Cell 1/1"), "requirement chips");
assert(doc.querySelector(".roombar"), "room progress bars");
const cur0 = doc.getElementById("currencies").textContent;
assert(cur0.includes("Scrap") && !cur0.includes("Signals") && !cur0.includes("Fuel"), "core mode: scrap only");

// Core L1 boot
A.go("module","rebirth_core"); A.build("rebirth_core");
await sleep(5400);
assert(doc.getElementById("overlay").textContent.includes("POWER RESTORED"), "boot payoff");
doc.querySelector("#overlay [data-close]").click();

// raid_1
A.go("prep");
assert(doc.querySelector(".prepgrid"), "prep grid");
assert(!text().includes("Insurance"), "no insurance on raid_1");
A.deploy(); A.raidDone();
assert(text().includes("EXTRACTED") && text().includes("PROGRESS MOVED"), "result");
assert(text().includes("NEXT UPGRADE") || text().includes("READY TO BUILD"), "one-more-raid card");
A.backToBase();

A.go("module","fabricator"); A.build("fabricator");
let ov = doc.getElementById("overlay"); if(ov) ov.querySelector("[data-close]").click();

// raid_2 + insurance
A.go("prep");
assert(text().includes("Insurance") && text().includes("Optical Sensor"), "insurance + tracked target");
A.devCur(); A.go("prep"); A.prepSet("insuranceId","basic");
A.deploy(); A.raidDone(); A.backToBase();

A.go("module","bit_bay"); A.build("bit_bay");
ov = doc.getElementById("overlay"); if(ov) ov.querySelector("[data-close]").click();
assert(text().includes("BIT — Bond LV"), "bond card");

// raid_3 death with premium insurance
A.devForce("death");
A.go("prep"); A.prepSet("insuranceId","premium");
A.deploy(); A.raidDone();
assert(text().includes("KIA") && text().includes("PROGRESS MOVED"), "death keeps progress");
assert(text().includes("NEXT UPGRADE") || text().includes("READY TO BUILD"), "one-more-raid card on death");
A.backToBase();

// one-more-raid CTA
A.oneMoreRaid("storage", 1);
assert(text().includes("Raid Prep"), "one-more-raid goes to prep");

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
A.go("dev"); doc.getElementById("devbeat").value = "8"; A.devJump();
A.go("end");
assert(text().includes("QUICK QUESTION"), "survey first");
for(const q of window.DATA.progression.survey) A.survey(q.id, q.opts[0]);
assert(text().includes("END OF PROTOTYPE"), "end screen");
assert(window.DATA.progression.survey.length === 5, "five survey questions");

const S = JSON.parse(window.localStorage.getItem("pr_meta_save"));
for(const a of ["ONE_MORE_RAID","SCREEN_TIME","NEXT_UPGRADE_SHOWN","RESULT_TO_DEPLOY","EXPEDITION_SENT","EXPEDITION_RETURNED","MORNING_REPORT","RETENTION_MODE_SET"])
  assert(S.log.some(e=>e.action===a), a + " logged");
console.log("ALL UI TESTS PASSED — " + S.log.length + " events");
process.exit(0);
})().catch(e => { console.error(e.stack); process.exit(1); });
