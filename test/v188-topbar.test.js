// v1.88 contextual top bar: Level/Scrap/Power everywhere, other currencies per screen, tap-to-explain, BIT bond badge.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, stashCapacity, stashSlotsUsed, stashWarnings, quickCleanList, firHave, stashGroup };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; base.beat = g.D.progression.beats.length - 1; base.cur.scrap = 0;
const click = (b, sel) => { const el = b.d.querySelector(sel); assert(el, "missing " + sel); if(el.disabled) return; const oc = el.getAttribute("onclick"); if(oc) b.w.eval(oc); else el.dispatchEvent(new b.w.MouseEvent("click", { bubbles:true })); }; // jsdom (outside-only) does not run inline handlers
const st = JSON.parse(JSON.stringify(base)); st.cur.dataCores = 10; st.cur.signals = 3; st.cur.chips = 1; st.revealed = { scrap:true, dataCores:true, signals:true };
const b = boot(st), pills = () => [...b.d.querySelectorAll("#currencies .cur")].map(e => e.className);
const has = k => pills().some(c => c.includes("cur-" + k));
b.A.go("stash"); assert(has("scrap") && !has("dataCores") && !has("signals") && !has("chips"), "stash: scrap only " + pills());
b.A.go("base"); assert(has("dataCores") && !has("signals"), "base shows Data Cores");
b.A.go("prep"); assert(has("signals") && !has("dataCores"), "prep shows Signals");
b.A.go("bit"); assert(has("chips"), "BIT shows Chips");
assert(!b.d.querySelector("#currencies .bondpill") && !b.d.querySelector("#tabs .nav-bit .bondlv"), "v1.94: no unexplained bond number on the BIT button");
b.A.go("stash"); b.S().cur.dataCores = 12; b.w.renderCurrencies(); assert(!has("dataCores"), "no pop on an unrelated screen");
b.A.go("bit"); b.S().cur.signals = 9; b.w.renderCurrencies(); assert(has("signals"), "a changed currency flashes in where it matters");
b.w.eval("A.curInfo('dataCores')"); const ci = b.d.querySelector("#overlay .curinfo"); assert(ci && /module levels/i.test(ci.textContent), "tap explains Data Cores");
for(const k of ["scrap","dataCores","signals","chips"]) { b.w.eval("closeAllPopups()"); b.w.eval("A.curInfo('" + k + "')"); assert(b.d.querySelector("#overlay .curinfo[data-cur=" + k + "]"), k + " explainer"); }
console.log("V1.88 TOPBAR TEST PASSED");
