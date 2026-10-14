// v1.50.0: no emoji / pictographic unicode icons in the UI. Icons come from the bespoke SVG set (assets/icons, tools/mkicons.py).
const { JSDOM } = require("jsdom");const fs = require("fs");const assert = require("assert");const path = __dirname + "/..";
// Pictographs, dingbats, arrows, geometric shapes, box blocks, enclosed letters, fullwidth forms, angle quotes, bullets, infinity.
const BAD = /[\p{Extended_Pictographic}\u2022\u2039\u203A\u2190-\u21FF\u221E\u2300-\u23FF\u2460-\u24FF\u2500-\u259F\u25A0-\u25FF\u2600-\u27BF\u2900-\u297F\u2B00-\u2BFF\u3030\uFE0F\uFF00-\uFFEF]/u;
// Allowlist: plain typography only (× quantities, · separators, dashes, ellipsis, minus, ≥ ≤ in comments). None of these match BAD; kept for documentation.
const ALLOW = /[×·—–…−≥≤©]/u;
const files = ["index.html", "app.js", "ui/popup.css", ...fs.readdirSync(path + "/data").filter(f => f.endsWith(".js")).map(f => "data/" + f)];
for(const f of files){
  fs.readFileSync(path + "/" + f, "utf8").split("\n").forEach((line, i) => {
    const m = line.match(BAD);
    assert(!m, f + ":" + (i + 1) + " uses an emoji/symbol icon '" + (m && m[0]) + "' (U+" + (m && m[0].codePointAt(0).toString(16).toUpperCase()) + ") - use IC(<icon>) / assets/icons instead");
  });
}
assert(!BAD.test("× · — – … −") && ALLOW.test("×"), "typography allowlist stays clean");
// every icon referenced in code exists in the sprite
const sprite = fs.readFileSync(path + "/assets/icons/sprite.svg", "utf8");
const ids = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const used = new Set([...fs.readFileSync(path + "/app.js", "utf8").matchAll(/IC\(["']([a-z0-9-]+)["']\)/g), ...fs.readFileSync(path + "/index.html", "utf8").matchAll(/sprite\.svg#([a-z0-9-]+)/g)].map(m => m[1]));
const prog = fs.readFileSync(path + "/data/progression.js", "utf8");
for(const m of prog.matchAll(/(?:icon|iconId):"([a-z0-9-]+)"/g)) used.add(m[1]);
assert(used.size > 40, "icons are used (" + used.size + ")");
for(const id of used) assert(ids.has(id), "sprite has icon #" + id);
for(const id of ids) assert(fs.existsSync(path + "/assets/icons/" + id + ".svg"), "standalone svg for " + id);
// rendered screens: no pictographs in visible text or markup
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window;if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js"]) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8"));
  return { w, A:w.A, doc:w.document };
}
const { A, doc } = boot();
let screens = 0;
for(const s of ["base", "prep", "stash", "vendor", "bit", "worldmap", "operator"]){
  try { A.go(s); } catch(e){ continue; }
  screens++;
  const m = doc.body.innerHTML.match(BAD);
  assert(!m, "screen " + s + " renders symbol '" + (m && m[0]) + "'");
}
assert(screens >= 4, "rendered several screens (" + screens + ")");
assert(doc.querySelector("#tabs .pr-ic use"), "nav tabs use sprite icons");
console.log("icons.test: ok (" + ids.size + " icons, " + used.size + " used, " + screens + " screens)");
