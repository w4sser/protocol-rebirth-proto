// Every base requirement (module/room repair costs, FTUE builds, recipe inputs, currencies) must be obtainable.
// Repair/build items must drop in Node Raid (core) itself; recipe inputs may also come from vendor/barter/recipes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { RULES } from "../nodspel/levels.js";
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
assert(RULES.loot.weights[0].polymer_plate > 0 && RULES.loot.weights[0].servo > 0, "vault parts already drop on level one");
console.log("LOOT COVERAGE PASSED — " + needItems.size + " repair items, " + needCur.size + " currencies covered by Node Raid");
