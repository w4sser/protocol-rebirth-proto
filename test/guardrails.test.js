// Static guardrails (see AGENTS.md): no emoji, shared popup only, AD palette tokens, icon sprite sync + coverage, one version everywhere.
// `node test/guardrails.test.js --update` rewrites the colour ratchet in test/palette-allowlist.json (only ever lower it).
const fs = require("fs"), assert = require("assert"), P = require("path");
const root = P.join(__dirname, "..");
const read = f => fs.readFileSync(P.join(root, f), "utf8");
const list = (dir, re) => fs.readdirSync(P.join(root, dir)).filter(f => re.test(f)).map(f => (dir ? dir + "/" : "") + f);

// ---- a) no emoji / pictographic symbols in shipped UI sources ----
// Extended_Pictographic covers U+1F512 (padlock), U+2B50 (star) etc.; the rest are arrows, geometric shapes, dingbats, bullets.
const BAD = /[\p{Extended_Pictographic}\u2022\u2039\u203A\u2190-\u21FF\u221E\u2300-\u23FF\u2460-\u24FF\u2500-\u259F\u25A0-\u25FF\u2600-\u27BF\u2900-\u297F\u2B00-\u2BFF\u3030\uFE0F\uFF00-\uFFEF]/u;
const uiFiles = [...list("", /\.(html|css|js)$/), ...list("ui", /\.css$/), ...list("data", /\.js$/), ...list("nodspel", /\.(m?js|html|css)$/)];
for(const f of uiFiles) read(f).split("\n").forEach((line, i) => {
  const m = line.match(BAD);
  assert(!m, f + ":" + (i + 1) + " contains emoji/symbol '" + (m && m[0]) + "' (U+" + (m && m[0].codePointAt(0).toString(16).toUpperCase()) + ") - use an icon from assets/icons/sprite.svg");
});
assert(BAD.test("\u{1F512}") && BAD.test("\u2B50") && !BAD.test("\u00D7 \u00B7 \u2014 \u2026"), "emoji detector sanity");

// ---- b) every boxed popup goes through the shared component ----
// base: overlay() in app.js builds the frame + top-left close X; nodspel: .pop-card + .pop-x (ui/popup.css).
{
  const app = read("app.js");
  const a = app.indexOf("function overlay("), b = app.indexOf("\n}\n", a);
  assert(a > 0 && b > a, "found the shared overlay() helper");
  const outside = app.slice(0, a) + app.slice(b);
  const bad = [
    [/createElement\([^)]*\)[\s\S]{0,160}?(?:className|id)\s*=\s*["'][^"']*(?:modal|overlay|dialog|popup|pop-card)/i, "ad-hoc modal element (createElement + modal/overlay/dialog class or id)"],
    [/cssText\s*=\s*["'][^"']*position:\s*fixed/i, "inline position:fixed box (build it with overlay())"],
    [/(?:innerHTML|insertAdjacentHTML)[^;\n]*(?:class|id)=\\?["'][^"']*\b(?:modal|dialog|overlay)\b/i, "innerHTML builds a modal/dialog/overlay by hand"],
  ];
  for(const [re, why] of bad){ const m = outside.match(re); assert(!m, "app.js: " + why + " near: " + (m && m[0].slice(0, 90).replace(/\n/g, " "))); }
  for(const m of outside.matchAll(/role=\\?["'](?:alert)?dialog/gi)) assert(/pop-card/.test(outside.slice(m.index - 300, m.index + 400)), "app.js: role=dialog markup outside overlay() without the shared .pop-card");
  assert(!/<[^>]*role=["'](?:alert)?dialog/.test(read("index.html")), "index.html: static dialogs must use overlay() / .pop-card");
}
{
  // nodspel: any role=dialog element must carry .pop-card (+ .pop-x); full-screen gates are the documented exceptions.
  const GATES = new Set(["tutorial", "fatal"]);
  for(const f of ["nodspel/index.html", "nodspel/game.mjs"]){
    const src = read(f);
    for(const m of src.matchAll(/role(?:=\\?["']|['"],\s*['"])(?:alert)?dialog/g)){
      const ctx = src.slice(Math.max(0, m.index - 260), m.index + 520);
      const gate = [...GATES].some(g => new RegExp("id=\\\\?[\"']" + g + "\\b|getElementById\\(['\"]" + g + "['\"]\\)|\\$\\(['\"]#" + g + "['\"]\\)").test(ctx));
      assert(gate || /pop-card/.test(ctx), f + ": dialog without the shared .pop-card near: " + ctx.slice(200, 300).replace(/\n/g, " "));
    }
    assert(!/className\s*=\s*['"`][^'"`]*\b(?:modal|overlay)\b/.test(src), f + ": ad-hoc modal/overlay class");
  }
  assert(/pop-x/.test(read("nodspel/index.html")) && /pop-x/.test(read("nodspel/game.mjs")), "nodspel popups carry the .pop-x close badge");
}

// ---- c) AD palette tokens: raw colours are a ratchet, primary action = the orange token ----
const stripCss = t => t.replace(/\/\*[\s\S]*?\*\//g, "");
const stripRoot = t => t.replace(/:root\s*\{[^}]*\}/g, "");
const colourRe = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/g;
function norm(c){
  c = c.toLowerCase().replace(/\s/g, "");
  if(c[0] === "#"){ let h = c.slice(1); if(h.length <= 4) h = h.split("").map(x => x + x).join(""); return "#" + h.slice(0, 6); }
  const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}
const isNeutral = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return Math.max(...v) - Math.min(...v) <= 12; };
const cssFiles = ["index.html", "nodspel/index.html", "nodspel/style.css", ...list("ui", /\.css$/)];
const tokensCss = read("ui/tokens.css");
const tokenVals = new Set([...stripCss(tokensCss).matchAll(/--ad-[a-z-]+\s*:\s*(#[0-9a-fA-F]{3,8})/g)].map(m => norm(m[1])));
for(const t of ["cyan", "bit", "loot", "danger", "primary"]) assert(new RegExp("--ad-" + t + "\\s*:").test(tokensCss), "ui/tokens.css defines --ad-" + t);
assert(cssFiles.filter(f => /\.html$/.test(f)).every(f => /ui\/tokens\.css/.test(read(f))), "both HTML shells load ui/tokens.css");
const allowPath = P.join(__dirname, "palette-allowlist.json");
const allow = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, "utf8")) : { colors: [], legacy: {} };
const okColour = new Set([...tokenVals, ...allow.colors.map(norm)]);
const counts = {}, offenders = {};
for(const f of cssFiles){
  const src = stripRoot(stripCss(read(f)));
  for(const m of src.matchAll(colourRe)){
    const h = norm(m[0]);
    if(isNeutral(h) || okColour.has(h)) continue;
    counts[f] = (counts[f] || 0) + 1; (offenders[f] = offenders[f] || new Set()).add(m[0]);
  }
}
if(process.argv.includes("--update")){
  for(const f of Object.keys(counts)) assert((counts[f]||0) <= (allow.legacy[f]||0), f + ": --update may only lower the palette ratchet"); allow.legacy = counts; fs.writeFileSync(allowPath, JSON.stringify(allow, null, 1) + "\n"); console.log("palette ratchet updated", counts);
} else for(const f of cssFiles){
  const n = counts[f] || 0, cap = allow.legacy[f] || 0;
  assert(n <= cap, f + ": " + n + " off-palette colour literals (ratchet " + cap + "). Use var(--ad-*) tokens or a neutral; e.g. " + [...(offenders[f] || [])].slice(-4).join(", "));
}
{
  const html = stripCss(read("index.html")), rules = [...html.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const last = pred => rules.filter(r => r[1].split(",").some(s => pred(s.trim())) && /(?:^|[;\s])background\s*:/.test(r[2])).pop();
  assert(/--raid-action\s*:\s*var\(--ad-primary\)/.test(html), "base --raid-action is the orange token");
  for(const [label, pred] of [["DEPLOY/PLAY .playbtn", s => /(^|\s)\.playbtn$/.test(s)], ["RAID tab", s => /\.nav-prep:not\(\.locked\)$/.test(s)], ["raid CTA", s => /\.raidcta$/.test(s)]]){
    const r = last(pred); assert(r, label + ": rule found");
    assert(/background\s*:\s*var\(--raid-action\)/.test(r[2]), label + ": final background must be var(--raid-action) (orange token), got " + r[2].match(/background\s*:[^;]*/)[0]);
  }
  const rcss = stripCss(read("nodspel/style.css"));
  assert(/\.tutorial-card button\{[^}]*background:var\(--ad-primary\)/.test(rcss), "raid Start/PLAY button uses var(--ad-primary)");
}

// ---- d) icon sprite: nodspel copy identical, every item + currency has its own symbol, raid shares the data-driven mapping ----
{
  const sprite = fs.readFileSync(P.join(root, "assets/icons/sprite.svg"));
  assert(Buffer.compare(sprite, fs.readFileSync(P.join(root, "nodspel/ui-icons.svg"))) === 0, "nodspel/ui-icons.svg must be byte-identical to assets/icons/sprite.svg (cp assets/icons/sprite.svg nodspel/ui-icons.svg)");
  const ids = new Set([...sprite.toString().matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
  const w = {}; new Function("window", read("data/items.js"))(w); const D = w.DATA;
  const cur = Object.entries(D.currencies), seen = new Map();
  assert(D.items.length >= 30 && cur.length >= 2, "items + currencies loaded");
  for(const [id, d] of [...D.items.map(i => [i.id, i]), ...cur]){
    assert(d.icon && ids.has(d.icon), id + ": icon '" + d.icon + "' missing from sprite");
    assert(!seen.has(d.icon), id + " shares icon " + d.icon + " with " + seen.get(d.icon)); seen.set(d.icon, id);
  }
  const goal = read("nodspel/progression-goal.js");
  assert(/MATERIALS=\{[^}]*DATA\.currencies[^}]*DATA\.items\.map/.test(goal), "raid MATERIALS (icon mapping) is derived from the same DATA items/currencies");
  const game = read("nodspel/game.mjs");
  assert(!/\bicon:\s*['"][a-z0-9-]+['"]/.test(game), "game.mjs defines no icon map of its own");
  for(const m of game.matchAll(/\?\?\s*\(?[^;]{0,40}?['"]([a-z][a-z0-9-]+)['"]/g)) if(/^(pickup|unlock)$/.test(m[1])) assert(ids.has(m[1]), "raid fallback icon " + m[1] + " exists");
}

// ---- e) one version everywhere: ?v= tags == APP_VERSION == package.json ----
{
  const ver = JSON.parse(read("package.json")).version;
  assert.equal(read("app.js").match(/APP_VERSION\s*=\s*"([^"]+)"/)[1], ver, "APP_VERSION == package.json version");
  const skip = new Set(["node_modules", ".git", "docs", "verify-out", "assets"]);
  let tags = 0;
  (function walk(dir){
    for(const e of fs.readdirSync(P.join(root, dir), { withFileTypes: true })){
      if(skip.has(e.name)) continue;
      const rel = dir ? dir + "/" + e.name : e.name;
      if(e.isDirectory()){ walk(rel); continue; }
      if(!/\.(html|js|mjs|css|json|webmanifest)$/.test(e.name) || e.name === "package-lock.json") continue;
      read(rel).split("\n").forEach((line, i) => { for(const m of line.matchAll(/\?v=(\d+\.\d+\.\d+)/g)){ tags++; assert.equal(m[1], ver, rel + ":" + (i + 1) + " ?v=" + m[1] + " but APP_VERSION/package.json is " + ver); } });
    }
  })("");
  assert(tags > 20, "found ?v= tags (" + tags + ")");
}
console.log("guardrails.test: ok");
