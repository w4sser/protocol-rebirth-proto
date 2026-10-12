// Decorative base-map overlays must not intercept taps; version string is visible and consistent everywhere.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const html = fs.readFileSync(path + "/index.html", "utf8");
const dom = new JSDOM(html, { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
const w = dom.window;
for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js","app.js"])
  w.eval(fs.readFileSync(path + "/" + s, "utf8"));
const doc = w.document; w.A.dismissIntro(); w.A.go("base");
assert.equal(doc.getElementById("app").className, "s-base");
const pe = el => w.getComputedStyle(el).pointerEvents;
for(const sel of [".hubstate", "div.goalpill"]){
  const el = doc.querySelector(sel); assert(el, sel + " exists"); assert.equal(pe(el), "none", sel + " must not take taps");
}
const spots = [...doc.querySelectorAll(".mapspot")]; assert(spots.length >= 5);
for(const s of spots) assert.notEqual(pe(s), "none", "map spots stay tappable");
const z = el => Number(w.getComputedStyle(el).zIndex);
assert(z(spots[0]) > z(doc.querySelector(".hubstate")), "map spots sit above the state label");
// HUD: plates carry a solid tag, bottom bar + settings menu exist
for(const s of spots) assert(s.querySelector(".tag"), "every map spot is a solid building plate");
assert.equal(doc.querySelectorAll("#tabs button").length, 4, "bottom bar RAID/STASH/SHOP/BIT");
assert(doc.querySelector("#settings-menu[hidden] #reset-progress"), "Reset lives in the closed settings menu");
doc.getElementById("menubtn").click();
assert(!doc.getElementById("settings-menu").hidden, "gear opens settings");
doc.body.click();
assert(doc.getElementById("settings-menu").hidden, "outside tap closes settings");
assert.equal(doc.getElementById("menu-version").textContent, doc.getElementById("app-version").textContent, "menu shows version");
// version
const V = fs.readFileSync(path + "/app.js", "utf8").match(/const APP_VERSION = "([\d.]+)"/)[1];
assert.equal(doc.getElementById("app-version").textContent, "v" + V);
assert(!/v0\.9\.9|prototype v0\.1/.test(doc.title + html), "no stale version titles");
assert.equal(JSON.parse(fs.readFileSync(path + "/package.json", "utf8")).version, V);
const files = ["index.html", ...fs.readdirSync(path + "/nodspel").filter(f => /\.(js|mjs|html|webmanifest)$/.test(f)).map(f => "nodspel/" + f)];
for(const f of files) for(const m of fs.readFileSync(path + "/" + f, "utf8").matchAll(/\?v=([\d.]+)/g)) assert.equal(m[1], V, f + " uses ?v=" + m[1]);
assert(fs.readFileSync(path + "/nodspel/index.html", "utf8").includes('id="core-version">v' + V + "<"), "core shows the version");
console.log("BASE OVERLAYS + VERSION TEST PASSED");
