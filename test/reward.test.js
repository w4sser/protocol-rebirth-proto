// v1.66.1 reward screen: tiles are derived from data (DATA.upgradeRewardTiles) and never promise more than the level grants.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
const w = dom.window;
for(const s of ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js"]) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
w.PR_NAVIGATE = () => {};
w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ upgradeRewardHtml };");
const D = w.DATA, items = Object.fromEntries(D.items.map(i => [i.id, i]));
let checked = 0;
for(const m of D.modules) for(const l of m.levels){
  const tiles = D.upgradeRewardTiles(m.id, l.level), id = m.id + " L" + l.level;
  assert(tiles.length >= 1, id + ": at least one reward tile");
  const unlocks = l.unlocks || [], gift = Object.keys(l.commissioning || {});
  for(const t of tiles){
    assert(t.value && t.label && t.icon && t.kind && t.source, id + ": tile is complete " + JSON.stringify(t));
    assert(fs.readFileSync(path + "/assets/icons/sprite.svg", "utf8").includes('id="' + t.icon + '"'), id + ": icon exists " + t.icon);
    const [kind, a, b] = t.source.split(":");
    if(kind === "commissioning") assert(gift.includes(a), id + ": gear tile only for commissioned items");
    else if(kind === "item"){
      assert(gift.includes(a), id + ": item stat tile only for commissioned items");
      if(b === "stats.shield") assert(items[a].stats.shield && t.value === "+" + items[a].stats.shield, id + ": shield tile matches item");
      if(b === "stats.speed") assert(items[a].stats.speed, id + ": speed tile needs a speed stat");
      if(b === "bagSlots") assert(items[a].bagSlots && t.value.startsWith("+" + items[a].bagSlots), id + ": bag tile matches item bagSlots");
    }
    else if(kind === "stash") assert(m.id === "storage" && l.stashSlots > 0, id + ": stash tile only for a level with stashSlots");
    else if(kind === "unlock") assert(unlocks.includes(a), id + ": unlock tile only for a listed unlock (" + a + ")");
    else if(kind === "recipes") assert(m.id === "fabricator" && D.recipes.some(r => r.fabricatorLevel === l.level), id + ": recipe tile needs recipes at this level");
    else if(kind === "tool") assert(items[a].tool.unlock.module === m.id && items[a].tool.unlock.level === l.level, id + ": tool tile only for a tool this level unlocks");
    else assert.fail(id + ": unknown tile source " + t.source);
    // text claims
    if(/SLOT/.test(t.value + t.label) && t.kind === "stat"){ const n = parseInt(t.value.replace(/\D/g, ""), 10);
      const okBag = unlocks.includes("raid_bag_plus_1") || gift.some(g => items[g].bagSlots === n), okStash = m.id === "storage" && l.stashSlots === n;
      assert(okBag || okStash, id + ": '+N SLOT' tile only when data grants slots"); }
    if(/SHIELD/.test(t.label)) assert(gift.some(g => items[g].stats && items[g].stats.shield), id + ": shield tile needs shield data");
    if(/RECIPE|CRAFT/.test(t.value + t.label)) assert(D.recipes.some(r => r.fabricatorLevel === l.level) && m.id === "fabricator", id + ": recipe tile needs recipes");
    if(/ZONE/.test(t.label)) assert(unlocks.includes("zone_transit"), id + ": zone tile needs zone unlock");
  }
  // the reverse: the headline grants are shown
  if(gift.length) assert(tiles.some(t => t.source.startsWith("commissioning:")), id + ": commissioned gear is shown");
  if(unlocks.includes("raid_bag_plus_1")) assert(tiles.some(t => t.value === "+1 SLOT"), id + ": bag slot unlock is shown");
  if(l.stashSlots) assert(tiles.some(t => t.value === "+" + l.stashSlots && /STASH/.test(t.label)), id + ": stash expansion is shown");
  checked++;
}
assert(checked >= 8, "all module levels checked");
// Fabricator L1 grants the vest: shield 25 + 1 bag slot, and no stash claim
const fab = D.upgradeRewardTiles("fabricator", 1);
assert(fab.some(t => t.value === "+25" && t.label === "SHIELD") && fab.some(t => t.value === "+1 SLOT" && t.label === "BAG"), "fab L1: vest shield + bag");
assert(!fab.some(t => /STASH SLOTS/.test(t.label)), "fab L1 grants no stash");
assert.deepEqual(D.upgradeRewardTiles("nope", 1), []); assert.deepEqual(D.upgradeRewardTiles("storage", 99), []);
// popup markup: title, shared X, CONTINUE, BIT line outside the card only while BIT Bay is not built
const doc = w.document, html = w.__T.upgradeRewardHtml("fabricator", 1, false), host = doc.createElement("div"); host.innerHTML = html;
assert(/ROOM ONLINE · FABRICATOR L1/.test(host.querySelector("h1").textContent), "first level titled ROOM ONLINE");
assert(host.querySelector(".bpop.reward-card button[data-close]").textContent === "CONTINUE", "CONTINUE inside card");
assert(host.querySelectorAll(".rtile").length === fab.length, "one DOM tile per data tile");
const bit = host.querySelector(".reward-bit"); assert(bit && /Build BIT Bay to wake it/.test(bit.textContent) && !bit.closest(".bpop"), "BIT line outside the card");
assert(/^UPGRADE · /.test((() => { const h = doc.createElement("div"); h.innerHTML = w.__T.upgradeRewardHtml("storage", 2, false); return h.querySelector("h1").textContent; })()), "later levels titled UPGRADE");
const o = w.eval("overlay(upgradeRewardHtml('fabricator',1,false),null,'reward')"); assert(doc.querySelector("#overlay.reward .bpop.pop-card > .pop-x"), "shared corner X"); o.remove();
for(const m of D.modules) for(const l of m.levels) for(const t of D.upgradeRewardTiles(m.id, l.level)) if(/^unlock:module_caps_/.test(t.source)){
  const n = D.modules.filter(x => x.id !== "rebirth_core" && ((x.maxLevelByCore || {})[l.level] || 0) > ((x.maxLevelByCore || {})[l.level - 1] || 0)).length;
  assert(t.value.startsWith(n + " ROOM"), m.id + " L" + l.level + ": cap tile counts only rooms whose cap rises (Core excluded)"); }
for(const a of D.worldMap.areas) if(a.requires && a.requires.scoutItem) for(const l of D.modules.find(x => x.id === "rebirth_core").levels)
  for(const t of D.upgradeRewardTiles("rebirth_core", l.level)) if(t.value === a.name.toUpperCase()) assert(t.label !== "AREA ACCESS", "area that still needs scouting is not promised as access");
// v1.66.1 no redundant text: no description paragraph, and no visible paragraph repeats a tile value
for(const m of D.modules) for(const l of m.levels){ const h = doc.createElement("div"); h.innerHTML = w.__T.upgradeRewardHtml(m.id, l.level, true);
  assert(!h.querySelector(".reward-sub"), m.id + " L" + l.level + ": no description paragraph above the tiles");
  const vals = D.upgradeRewardTiles(m.id, l.level).map(t => t.value.toLowerCase()).filter(v => /\d/.test(v)); // granted amounts (+25, +1 SLOT, 5 RECIPES) live in tiles only
  for(const p of h.querySelectorAll("p")) for(const v of vals) assert(!p.textContent.toLowerCase().includes(v), m.id + " L" + l.level + ": paragraph repeats tile '" + v + "'");
  const g = h.querySelector(".reward-goal"); if(g) assert(g.textContent.length <= 80, m.id + " L" + l.level + ": NEXT line is short"); }
console.log("REWARD TILES PASSED (" + checked + " module levels)");
