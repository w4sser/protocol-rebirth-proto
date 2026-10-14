// v1.49.0: every boxed popup uses the shared component (ui/popup.css): top-left close X (≥44px), shared header, backdrop tap-to-close.
const { JSDOM } = require("jsdom");const fs = require("fs");const assert = require("assert");const path = __dirname + "/..";
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window;if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js"]) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, overlay };");
  return { w, A:w.A, S:()=>w.__T.S(), doc:w.document };
}
function checkX(card, label){
  assert(card, label + ": popup rendered");
  const x = card.firstElementChild;
  assert(x && x.classList.contains("pop-x"), label + ": first child is the shared close X (top-left)");
  assert(/close/i.test(x.getAttribute("aria-label") || "") || /Keep/.test(x.getAttribute("aria-label")), label + ": X has an accessible label");
  assert(card.classList.contains("pop-card"), label + ": uses the shared card");
}
const css = fs.readFileSync(path + "/ui/popup.css", "utf8");
assert(/\.pop-x[^{]*\{[^}]*top:-16px;left:-16px[^}]*width:44px;height:44px[^}]*border-radius:50%/.test(css), "close badge: circular 44px, straddles the top-left corner");
assert(/:where\(\.pop-card\)\{position:relative\}/.test(css) && /\.pop-card\{overflow:visible!important\}/.test(css), "cards never clip the badge and never override a panel's own positioning");
const st0 = boot(); st0.A.dismissIntro(); const s = JSON.parse(JSON.stringify(st0.S()));
Object.assign(s.modules,{rebirth_core:1,fabricator:1,bit_bay:1}); s.baseState="core_habitable"; s.roomUnlocks={fabricator:true,storage:true,bit_bay:true}; s.introSeen=true; s.stash.medkit=2;
const migrated = [];
{ const { A, doc } = boot(s);
  // building popups
  for(const m of ["rebirth_core","fabricator","storage"]){ A.openBuilding(m); checkX(doc.querySelector("#overlay .bpop"), "building " + m); migrated.push("building:" + m);
    doc.querySelector("#overlay .pop-x").dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles:true })); assert(!doc.getElementById("overlay"), "X closes " + m); }
  // backdrop tap closes
  A.openBuilding("fabricator"); const ov = doc.getElementById("overlay"); ov.dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles:true })); assert(!doc.getElementById("overlay"), "backdrop tap closes");
  // lobby slot pickers (weapon, armour, ITEM 1/2)
  A.go("prep");
  for(const k of ["weapon","armor","c1","c2"]){ A.pickSlot(k); checkX(doc.querySelector("#overlay .bpop"), "slot " + k); migrated.push("slot:" + k); doc.getElementById("overlay").remove(); }
  // mission panel
  A.planToggle(true); { const mp = doc.getElementById("mission-panel"), mx = mp.previousElementSibling; assert(mx && mx.classList.contains("pop-x") && mx.classList.contains("mission-x"), "mission: close badge sits on the frame corner (sibling, panel scrolls)"); assert(mp.classList.contains("pop-card")); } assert(doc.querySelector(".pop-backdrop"), "mission has a backdrop"); A.planToggle(false); assert(doc.getElementById("mission-panel").hidden, "mission closes"); migrated.push("mission");
  // settings menu
  checkX(doc.getElementById("settings-menu"), "settings"); migrated.push("settings");
  // generic overlays (payoff popups) get the X automatically; scripted sequences opt out
  doc.defaultView.__T.overlay('<h1>TEST</h1>'); checkX(doc.querySelector("#overlay > .pop-frame"), "payoff"); assert(doc.querySelector("#overlay > .pop-frame > .inner"), "payoff content keeps its own scroller"); doc.getElementById("overlay").remove();
  doc.defaultView.__T.overlay('<div class="boot"></div>', null, null, { noClose:true }); assert(!doc.querySelector("#overlay .pop-x"), "noClose opt-out"); doc.getElementById("overlay").remove(); }
// every overlay() call site either gets the X or is a documented opt-out
{ const app = fs.readFileSync(path + "/app.js", "utf8"); const optouts = (app.match(/noClose:true/g) || []).length; assert.equal(optouts, 2, "only boot sequence + timed ad opt out"); }
// Node Raid popups
{ const html = fs.readFileSync(path + "/nodspel/index.html", "utf8"), g = fs.readFileSync(path + "/nodspel/game.mjs", "utf8");
  assert(/ui\/popup\.css/.test(html), "core loads the shared popup css");
  assert(/inventory-card pop-card"><button id="close-bag" class="pop-x"/.test(html), "bag popup: X first, top-left"); migrated.push("core:bag");
  assert(/className='pop-x swap-close'/.test(g) && /el\.append\(close,head\)/.test(g), "swap row: X first, top-left"); migrated.push("core:swap-row");
  assert(/e\.target===\$\('#inventory'\)/.test(g), "bag backdrop tap closes"); }
console.log("POPUP TESTS PASSED (" + migrated.join(", ") + ")");
