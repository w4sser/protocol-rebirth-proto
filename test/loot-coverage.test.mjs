// Every base requirement (module/room repair costs, FTUE builds, recipe inputs, currencies) must be obtainable.
// Repair/build items must drop in Node Raid (core) itself; recipe inputs may also come from vendor/barter/recipes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { RULES, generateLevel, HOUSE_LOOT } from "../nodspel/levels.js";
import { ITEM_NAMES } from "../nodspel/raid.js";
const ctx = { window:{} }; vm.createContext(ctx);
for(const f of ["items","modules","recipes","vendors","progression"]) vm.runInContext(readFileSync(new URL("../data/" + f + ".js", import.meta.url), "utf8"), ctx);
const D = ctx.window.DATA, ITEMS = Object.fromEntries(D.items.map(i => [i.id, i]));
const coreDrops = new Set(RULES.loot.weights.flatMap(w => Object.keys(w).filter(id => w[id] > 0)));
coreDrops.add("medkit"); // fixed level-two crate

for(const id of RULES.loot.types){ assert(ITEMS[id], "core loot id " + id + " exists in base items"); assert(ITEM_NAMES[id], "core has a label for " + id); }
for(const id of coreDrops) assert(RULES.loot.types.includes(id), id + " fits in the bag");

const costs = D.modules.flatMap(m => m.levels.map(l => ({ where:m.id + " L" + l.level, cost:l.cost })));
const needItems = new Set(), needCur = new Set();
for(const { where, cost } of costs){
  for(const id in (cost.items || {})){ needItems.add(id); assert(coreDrops.has(id), where + " needs " + id + " but Node Raid never drops it"); }
  for(const c of ["salvage","dataCores"]) if(cost[c]) needCur.add(c);
}
for(const c of needCur){
  const src = [...coreDrops].filter(id => ITEMS[id].grantsCurrency && ITEMS[id].grantsCurrency[c] > 0);
  assert(src.length, "currency " + c + " has an item source in Node Raid loot");
}
const vendorIds = new Set(D.vendors.flatMap(v => v.stock.map(s => s.itemId).concat(v.barter.map(b => b.receive.itemId))));
const recipeOut = new Set(D.recipes.map(r => r.output.itemId));
for(const r of D.recipes) for(const id in r.inputs)
  assert(coreDrops.has(id) || vendorIds.has(id) || recipeOut.has(id), "recipe " + r.id + " input " + id + " is unobtainable");
// FTUE vault blocker regression: the exact items the owner got stuck on.
for(const id of ["polymer_plate","servo"]) assert(coreDrops.has(id));
assert(RULES.loot.weights[0].polymer_plate > 0 && RULES.loot.weights[0].scrap_alloy > 0, "vault L1 parts already drop on level one");
assert.deepEqual(Object.keys(RULES.loot.weights[0]).sort(), ["cable","polymer_plate","salvage_crate","scrap_alloy"], "L1 pool: 3 common materials + salvage (v1.60)");
// Simulated drops in BOTH areas, every level (Town adds house containers). Owner blocker: Power Relay for Core L2.
const coreL2 = D.modules.find(m => /core/i.test(m.id)).levels.filter(l => l.level <= 2).flatMap(l => Object.keys(l.cost.items || {}));
const RUNS = 150, seen = {};
for(const area of ["bunker","town"]){ const got = {}; seen[area] = got;
  for(let i = 0; i < RUNS; i++) for(const n of [1,2,3]){ const L = generateLevel(n, "cov" + i, area);
    const items = [...L.lootBoxes.map(b => b.item), ...(L.house ? L.house.containers.map(c => c.item) : [])];
    for(const id of new Set(items)){ got[id] = (got[id] || 0) + 1; }
    if(area === "town"){ assert(L.house, "every Town level has a house"); for(const c of L.house.containers) assert(RULES.loot.types.includes(c.item), "house item fits the bag: " + c.item); } } }
for(const area in seen) for(const id of needItems) assert(seen[area][id] > 0, area + ": " + id + " never dropped in " + RUNS + " simulated runs");
for(const id of coreL2) assert(RULES.loot.weights[1][id] > 0 || id === "power_cell" || id === "scrap_alloy" || RULES.loot.weights[0][id] > 0, "Core L2 part " + id + " drops by level 2");
assert(RULES.loot.weights[1].power_relay > 0 && RULES.loot.weights[2].power_relay >= 3, "Power Relay drops on levels 2 and 3");
assert.equal(HOUSE_LOOT.crateRelay[2], 1, "Town level-3 house crate always holds a Power Relay");
const relayRate = a => seen[a].power_relay / RUNS;
assert(relayRate("bunker") >= .25, "bunker Power Relay rate per full run " + relayRate("bunker"));
assert(relayRate("town") >= 1, "town: guaranteed Power Relay per full run");
console.log("LOOT RATES — Power Relay per full run: bunker " + relayRate("bunker").toFixed(2) + ", town ≥1; AI fragment bunker " + (seen.bunker.ai_fragment / RUNS).toFixed(2));
console.log("LOOT COVERAGE PASSED — " + needItems.size + " repair items, " + needCur.size + " currencies covered by Node Raid");
