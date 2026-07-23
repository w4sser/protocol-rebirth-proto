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
for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","app.js"])
  window.eval(fs.readFileSync(path + "/" + s, "utf8"));
const doc = window.document, A = window.A;
const text = () => doc.getElementById("app").textContent;
const sv = () => JSON.parse(window.localStorage.getItem("pr_meta_save"));

A.dismissIntro();
A.go("dev"); doc.getElementById("devret").value = "full"; A.devRetMode();
A.go("base");
assert(!text().includes("Daily contracts"), "contracts hidden during FTUE even in full mode");

A.go("module","rebirth_core"); A.build("rebirth_core");
await sleep(5400); doc.querySelector("#overlay [data-close]").click();
assert.equal(sv().fuel, 5, "full fuel at start");
A.go("prep");
assert(text().includes("Fuel"), "fuel visible on prep in full mode");
A.deploy(); A.raidDone(); A.backToBase();
assert.equal(sv().fuel, 4, "raid consumed 1 fuel");
A.go("module","fabricator"); A.build("fabricator");
let ov = doc.getElementById("overlay"); if(ov) ov.querySelector("[data-close]").click();
A.go("prep"); A.devCur(); A.go("prep"); A.prepSet("insuranceId","basic");
A.deploy(); A.raidDone(); A.backToBase();
A.go("module","bit_bay"); A.build("bit_bay");
ov = doc.getElementById("overlay"); if(ov) ov.querySelector("[data-close]").click();
assert(text().includes("BIT — Bond LV"), "BIT online");
A.devForce("extract");
A.go("prep"); A.prepSet("insuranceId","none"); A.deploy(); A.raidDone();
if(text().includes("DECISION POINT")) A.extractNow();
A.backToBase();
if(sv().beat >= 7){
  A.go("base");
  assert(text().includes("Daily contracts"), "contracts visible post-FTUE in full mode");
}
console.log("FTUE FULL-MODE WALKTHROUGH PASSED (beat=" + sv().beat + ", fuel=" + sv().fuel + ")");
process.exit(0);
})().catch(e => { console.error(e.stack); process.exit(1); });
