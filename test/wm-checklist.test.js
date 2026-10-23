// v1.81.0 T1-C: locked world-map checklist (Core N + scout item), amber next target, CTA routing.
const { JSDOM } = require("jsdom");const fs = require("fs");const assert = require("assert");const path = __dirname + "/..";
function boot(mod){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window;
  for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js"]) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, areaReqs, session:()=>session };");
  const A = w.A, S = w.__T.S(); A.dismissIntro();
  S.introSeen = true; S.beat = w.DATA.progression.beats.length - 1; Object.assign(S.modules, { fabricator:1, bit_bay:1 }); S.baseState = "core_habitable"; S.roomUnlocks = { fabricator:true, storage:true, bit_bay:true };
  mod(S, w, A); return { w, A, S };
}
const rows = (w, id) => [...w.document.querySelectorAll('.wm-label[data-label="' + id + '"] .wm-req > span')].map(r => ({ text: r.textContent.trim(), done: r.classList.contains("ok"), icon: (r.querySelector("use") || {}).getAttribute && r.querySelector("use").getAttribute("href") }));

// Town: Core 2 + Archipelago open, survey done, Core short -> amber next target with Core CTA
{ const { w, A, S } = boot(s => { s.modules.rebirth_core = 2; s.areaScouted = { archipelago:true, town:true }; s.areaSeen = { archipelago:true }; });
  A.go("worldmap"); const d = w.document;
  const r = rows(w, "town");
  assert.deepEqual(r.map(x => [x.text, x.done]), [["Core L3", false], ["Town Survey", true]], "town checklist labels + done state");
  assert(/#dot/.test(r[0].icon) && /#check/.test(r[1].icon), "sprite dot/check icons, no glyphs");
  const lab = d.querySelector('.wm-label[data-label="town"]');
  assert(lab.classList.contains("locked") && lab.classList.contains("next"), "town label is the amber next target");
  assert(d.querySelector('.wm-region[data-area="town"]').classList.contains("next"), "town region marked next");
  assert(/wm-beacon next dest" data-beacon="Town depot"/.test(d.body.innerHTML), "amber next beacon");
  assert.equal(lab.querySelector(".wm-blurb").textContent, "Core 3 + Town Survey from Archipelago.");
  assert.equal(lab.querySelector(".wm-cta").dataset.cta, "core"); assert.equal(lab.querySelector(".wm-cta").textContent.trim(), "RAISE CORE");
  const css = fs.readFileSync(path + "/index.html", "utf8");
  assert(/\.wm-label\.locked\.next\{[^}]*var\(--ad-loot\)/.test(css), "amber via --ad-loot token");
  A.wmLocked("town"); assert.equal(w.__T.session().screen, "base", "Core CTA goes to base"); assert(d.querySelector("#overlay"), "Core popup opens");
}
// Town: Core ok, survey missing -> SCOUT, Raid Prep with Archipelago preselected
{ const { w, A, S } = boot(s => { s.modules.rebirth_core = 3; s.areaScouted = { archipelago:true }; s.areaSeen = { archipelago:true }; s.area = "bunker"; });
  A.go("worldmap");
  assert.deepEqual(rows(w, "town").map(x => [x.text, x.done]), [["Core L3", true], ["Town Survey", false]]);
  const cta = w.document.querySelector('.wm-label[data-label="town"] .wm-cta'); assert.equal(cta.dataset.cta, "scout"); assert.equal(cta.textContent.trim(), "SCOUT");
  A.wmLocked("town"); assert.equal(S.area, "archipelago", "scout run preselects the source area"); assert.equal(w.__T.session().screen, "prep");
}
// Archipelago: same pattern (Core 2 + Archipelago Chart from Bunker); non-next locked areas get no CTA
{ const { w, A } = boot(s => { s.modules.rebirth_core = 1; s.areaScouted = {}; s.areaSeen = {}; });
  A.go("worldmap"); const d = w.document;
  assert.deepEqual(rows(w, "archipelago").map(x => [x.text, x.done]), [["Core L2", false], ["Archipelago Chart", false]]);
  assert(d.querySelector('.wm-label[data-label="archipelago"]').classList.contains("next"));
  assert(/wm-beacon next dest" data-beacon="Lighthouse rock"/.test(d.body.innerHTML), "amber beacon on Archipelago");
  assert.equal(d.querySelector('.wm-label[data-label="archipelago"] .wm-blurb').textContent, "Core 2 + Archipelago Chart from Bunker.");
  const tl = d.querySelector('.wm-label[data-label="town"]'); assert(!tl.classList.contains("next") && !tl.querySelector(".wm-cta"), "town not next yet: checklist only");
  assert.deepEqual(rows(w, "town").map(x => x.text), ["Core L3", "Town Survey"]);
}
console.log("wm-checklist ok");
