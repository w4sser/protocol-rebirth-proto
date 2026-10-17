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
// v1.51: every item in data/items.js has its own bespoke icon (unique, exists, no generic fallback)
{
  const w = {}; new Function("window", fs.readFileSync(path + "/data/items.js", "utf8"))(w);
  const D = w.PR_DATA || w.DATA || Object.values(w).find(v => v && v.items); const items = D.items;
  assert(items.length >= 30, "items loaded (" + items.length + ")");
  const seen = new Map();
  for(const it of items){
    assert(it.icon && /^(item|tool)-/.test(it.icon), it.id + " names an item-* (or tool-*) icon");
    assert(ids.has(it.icon), it.id + " icon #" + it.icon + " exists in sprite");
    assert(!seen.has(it.icon), it.id + " shares icon " + it.icon + " with " + seen.get(it.icon));
    seen.set(it.icon, it.id);
    assert(/--ic-loot/.test(fs.readFileSync(path + "/assets/icons/" + it.icon + ".svg", "utf8")), it.icon + " carries the amber loot accent (AD: amber = loot)");
  }
  for(const must of ["encrypted_drive", "archipelago_chart", "town_survey"]) assert(items.find(i => i.id === must), must + " present");
  const fn = fs.readFileSync(path + "/app.js", "utf8").match(/function itemIcon[^\n]*/)[0];
  assert(!/item-crate|item-vest/.test(fn), "itemIcon has no generic box/vest fallback");
}
// v1.52: BIT icons use the LOCKED face geometry (AD ad06 p23): vertical pill eyes 78x170 U, 486 U apart, filled smile
{
  const master = fs.readFileSync(path + "/assets/bit-face-master.svg", "utf8");
  const eyes = [...master.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/g)].map(m => m.slice(1).map(Number));
  assert.equal(eyes.length, 2, "master has two eyes");
  assert(Math.abs(eyes[1][0] - eyes[0][0] - 486) < 0.01 && eyes[0][1] === 364 && eyes[0][2] * 2 === 78 && eyes[0][3] * 2 === 170, "eye geometry locked");
  assert(/<path d="M[^"]+Z" fill="#75CFCC"/.test(master), "smile is a filled shape");
  for(const id of ["nav-bit", "bit-face"]){
    const svg = fs.readFileSync(path + "/assets/icons/" + id + ".svg", "utf8");
    const e = [...svg.matchAll(/<ellipse cx="([\d.]+)" cy="[\d.]+" rx="([\d.]+)" ry="([\d.]+)"/g)].map(m => m.slice(1).map(Number));
    assert.equal(e.length, 2, id + ": two pill eyes");
    const k = e[0][1] / 39; assert(Math.abs(e[0][2] / k - 85) < 0.5 && Math.abs((e[1][0] - e[0][0]) / k - 486) < 2, id + ": eyes scaled uniformly from the master");
    assert(/<path d="M[^"]+Z"[^>]*fill="var\(--ic-accent/.test(svg), id + ": filled tapered smile");
  }
}
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
