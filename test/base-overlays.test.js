// Decorative base-map overlays must not intercept taps; version string is visible and consistent everywhere.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const html = fs.readFileSync(path + "/index.html", "utf8");
const dom = new JSDOM(html, { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
const w = dom.window;
for(const s of ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js","app.js"])
  w.eval(fs.readFileSync(path + "/" + s, "utf8"));
// v2.22.1: this is a fresh profile, so boot armed the FTUE direct-launch listener; this test drives
// the base layer directly instead, so a real deploy must not fire once the splash's pending timers
// resolve after this test returns.
w.A.startFtueDirect = () => {};
const doc = w.document; w.A.dismissIntro(); w.A.go("base");
assert.equal(doc.getElementById("app").className, "s-base");
const pe = el => w.getComputedStyle(el).pointerEvents;
for(const sel of [".hubstate"]){
  const el = doc.querySelector(sel); assert(el, sel + " exists"); assert.equal(pe(el), "none", sel + " must not take taps");
}
assert(doc.querySelector('.progress-goal'),'recipe-backed goal visible');
const spots = [...doc.querySelectorAll(".mapspot")]; assert(spots.length >= 5);
for(const s of spots) assert.notEqual(pe(s), "none", "map spots stay tappable");
const z = el => Number(w.getComputedStyle(el).zIndex);
assert(z(spots[0]) > z(doc.querySelector(".hubstate")), "map spots sit above the state label");
// HUD: plates carry a solid tag, bottom bar + settings menu exist
for(const s of spots) assert(s.querySelector(".tag"), "every map spot is a solid building plate");
assert.equal(doc.querySelectorAll("#tabs button").length, 6, "bottom bar BASE/STASH/SHOP/BIT/WEAPONS/RAID");
assert(doc.querySelector("#settings-menu[hidden] #reset-progress"), "Reset lives in the closed settings menu");
doc.getElementById("menubtn").click();
assert(!doc.getElementById("settings-menu").hidden, "gear opens settings");
doc.body.click();
assert(doc.getElementById("settings-menu").hidden, "outside tap closes settings");
assert.equal(doc.getElementById("menu-version").textContent, doc.getElementById("app-version").textContent, "menu shows version");
// tapping a building pans the map so its plate clears the popup
{ const t0 = doc.querySelector(".baseworld").style.transform;
  w.A.openBuilding("rebirth_core");
  assert(doc.querySelector("#overlay .bpop"), "core popup open");
  assert.notEqual(doc.querySelector(".baseworld").style.transform, t0, "map pans to the tapped building");
  (doc.querySelector("#overlay [data-close]") ? doc.querySelector("#overlay [data-close]").click() : doc.defaultView.A.back()); }
// landscape only: no portrait layouts, rotate gate + splash + manifests
{ const html = fs.readFileSync(path + "/index.html", "utf8");
  assert.equal((html.match(/orientation: *portrait/g)||[]).length, 1, "only the rotate gate reacts to portrait");
  assert(/@media \(orientation:portrait\)\{ #rotate\{display:flex;\} \}/.test(html), "portrait shows the rotate screen");
  for(const f of ["manifest.json", "nodspel/manifest.webmanifest"]) assert.equal(JSON.parse(fs.readFileSync(path + "/" + f, "utf8")).orientation, "landscape", f + " locks landscape");
  assert(fs.readFileSync(path + "/nodspel/index.html", "utf8").includes('class="rotate"'), "core has a rotate screen");
  for(const a of ["assets/production/splash.webp", "assets/production/operator_op01.webp", "assets/icons/app/icon-192.png", "assets/icons/app/icon-512.png"]) assert(fs.existsSync(path + "/" + a), a);
  assert(typeof w.eval("typeof lockLandscape") === "string"); }
// installed app name is "Protocol Rebirth" everywhere
{ const m = JSON.parse(fs.readFileSync(path + "/manifest.json", "utf8")); assert.equal(m.name, "Protocol Rebirth"); assert.equal(m.short_name, "Protocol Rebirth");
  const h = fs.readFileSync(path + "/index.html", "utf8");
  for(const re of [/apple-mobile-web-app-title" content="Protocol Rebirth"/, /application-name" content="Protocol Rebirth"/, /<title>Protocol Rebirth<\/title>/]) assert(re.test(h), String(re)); }
// any screen change closes popups (building popup over RAID bug)
{ const A = w.A, d = w.document;
  d.getElementById("phone").insertAdjacentHTML("beforeend", '<div id="overlay"><div class="inner"><div class="bpop">RAID FOR REPAIR MATERIALS</div></div></div>');
  d.getElementById("settings-menu").hidden = false;
  A.go("dev"); A.go("base");
  assert(!d.getElementById("overlay") && !d.querySelector(".bpop"), "popups closed on screen change");
  assert(d.getElementById("settings-menu").hidden, "menu closed on screen change");
  assert(/closeAllPopups\(\);\s*session\.screenEnterTs/.test(fs.readFileSync(path + "/app.js", "utf8")), "A.go closes popups");
  assert(/closeAllPopups\(\);\s*const raidUrl = coreLaunchUrl/.test(fs.readFileSync(path + "/app.js", "utf8")), "deploy closes popups");
  assert(d.getElementById("app-version").closest("#topbar"), "version label sits in the top bar, never over the bottom bar"); }
// consistent BACK top-left; popups use only the shared top-left X (POP_X, v1.45); bottom bar hidden under a popup
{ const A = w.A, d = w.document, app = fs.readFileSync(path + "/app.js", "utf8");
  assert(d.querySelector("#topbar > #navback:first-child"), "back button is first in the top bar");
  assert(!/data-close>BACK</.test(app) && (app.match(/data-close aria-label="Close">' \+ IC\("close"\)/g) || []).length === 1 /* only the shared POP_X (v1.45) */ && !/IC\("nav-back"\) \+ ' (Base|Stash|Back)</.test(app), "no ad-hoc back/close buttons");
  A.go("base"); assert(d.getElementById("navback").hidden, "no back on base");
  A.go("dev"); assert(!d.getElementById("navback").hidden, "back on sub-screens");
  A.back(); assert.equal(d.body.dataset.screen, "base", "back -> base");
  A.openBuilding("rebirth_core");
  if(d.getElementById("overlay")){
    assert(d.body.classList.contains("has-overlay") && !d.getElementById("navback").hidden, "popup: back shown, bottom bar hidden");
    A.back(); assert(!d.getElementById("overlay") && !d.body.classList.contains("has-overlay"), "back closes popup");
  } }
// version
const V = fs.readFileSync(path + "/app.js", "utf8").match(/const APP_VERSION = "([\d.]+)"/)[1];
assert.equal(doc.getElementById("app-version").textContent, "v" + V);
assert(!/v0\.9\.9|prototype v0\.1/.test(doc.title + html), "no stale version titles");
assert.equal(JSON.parse(fs.readFileSync(path + "/package.json", "utf8")).version, V);
const files = ["index.html", ...fs.readdirSync(path + "/nodspel").filter(f => /\.(js|mjs|html|webmanifest)$/.test(f)).map(f => "nodspel/" + f)];
for(const f of files) for(const m of fs.readFileSync(path + "/" + f, "utf8").matchAll(/\?v=([\d.]+)/g)) assert.equal(m[1], V, f + " uses ?v=" + m[1]);
assert(fs.readFileSync(path + "/nodspel/index.html", "utf8").includes('id="core-version">v' + V + "<"), "core shows the version");
console.log("BASE OVERLAYS + VERSION TEST PASSED");
