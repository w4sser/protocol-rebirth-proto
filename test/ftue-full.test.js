// FTUE walkthrough with retention "full" enabled from the very start.
// Run: node test/ftue-full.test.js (needs jsdom, same as ui.test.js)
const { JSDOM } = require("jsdom");
const fs = require("fs"); const assert = require("assert");
const path = __dirname + "/..";
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
const dom = new JSDOM(fs.readFileSync(path + "/index.html","utf8"), { runScripts:"outside-only", url:"http://localhost/" });
const { window } = dom;
window.localStorage = (() => { let s={}; return { getItem:k=>s[k]??null, setItem:(k,v)=>s[k]=v, removeItem:k=>delete s[k] }; })();
window.URL.createObjectURL = () => "blob:fake";
for(const s of ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js","app.js"])
  window.eval(fs.readFileSync(path + "/" + s, "utf8")+(s==='app.js'?';window.__TEST_STATE=()=>S;':''));
const doc = window.document, A = window.A;
// v2.22.0: this is a fresh profile, so boot armed the FTUE direct-launch listener; this walkthrough
// drives the base layer directly instead, so a real deploy must not fire mid-sleep below.
A.startFtueDirect = () => {};
const text = () => doc.getElementById("app").textContent;
const sv = () => JSON.parse(window.localStorage.getItem("pr_meta_save"));

A.dismissIntro();
A.go("dev"); doc.getElementById("devret").value = "full"; A.devRetMode();
A.go("base");
assert(!text().includes("Daily contracts"), "contracts hidden during FTUE even in full mode");

A.go("module","rebirth_core"); A.build("rebirth_core");
await sleep(5400); (doc.querySelector("#overlay [data-close]") ? doc.querySelector("#overlay [data-close]").click() : doc.defaultView.A.back());
assert.equal(sv().fuel, 5, "full fuel at start");
A.go("prep");
assert(text().includes("Fuel"), "fuel visible on prep in full mode");
A.deploy(); A.raidStep(); A.backToBase();
assert.equal(sv().fuel, 4, "raid consumed 1 fuel");
A.openRoom("fabricator"); A.unlockRoom("fabricator");
A.go("module","fabricator"); A.build("fabricator");
let ov = doc.getElementById("overlay"); if(ov) (ov.querySelector("[data-close]") ? ov.querySelector("[data-close]").click() : doc.defaultView.A.back());
A.go("prep"); A.devCur(); A.go("prep"); A.prepSet("insuranceId","basic");
A.deploy(); A.raidStep(); A.backToBase();
for(const id of ['storage','bit_bay']){const s=window.__TEST_STATE(),m=window.DATA.modules.find(m=>m.id===id),cost=m.levels[0].cost;for(const [key,n] of Object.entries(cost.items||{}))s.stash[key]=Math.max(n,s.stash[key]||0);s.cur.scrap=Math.max(s.cur.scrap,cost.scrap||0);A.openRoom(id);A.unlockRoom(id);}
A.go("module","bit_bay"); A.build("bit_bay");
ov = doc.getElementById("overlay"); if(ov) (ov.querySelector("[data-close]") ? ov.querySelector("[data-close]").click() : doc.defaultView.A.back());
A.go("bit");
assert(doc.querySelector("#overlay .bitpop .bitbond").textContent.includes("Bond LV"), "BIT online");
A.devForce("extract");
A.go("prep"); A.prepSet("insuranceId","none"); A.deploy(); A.raidStep();
if(text().includes("DECISION POINT")) A.extractNow();
A.backToBase();
if(sv().beat >= 7){
  A.go("bit");
  A.bitTab("tasks");
  assert(doc.querySelector("#overlay .tasktab.active").textContent.includes("Daily contracts"), "contracts visible post-FTUE in full mode");
}
console.log("FTUE FULL-MODE WALKTHROUGH PASSED (beat=" + sv().beat + ", fuel=" + sv().fuel + ")");
process.exit(0);
})().catch(e => { console.error(e.stack); process.exit(1); });
