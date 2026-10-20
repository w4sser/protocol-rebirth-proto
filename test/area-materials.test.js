// v1.75 area materials (docs/design-retention-quests.md PR D): Tidal Coil, Frost Glass, Core Ash are real items with own icons,
// drop only where specified, and the quests / BIT trader reference them (no memory_module stand-ins).
const fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const w = {}; for(const f of ["items", "quests", "raid_zones"]) new Function("window", fs.readFileSync(path + "/data/" + f + ".js", "utf8"))(w);
const D = w.DATA, ITEMS = Object.fromEntries(D.items.map(i => [i.id, i]));
const MATS = { tidal_coil: ["item-tidal-coil", "rare"], frost_glass: ["item-frost-glass", "rare"], core_ash: ["item-core-ash", "epic"] };
const sprite = fs.readFileSync(path + "/assets/icons/sprite.svg", "utf8");
assert.strictEqual(sprite, fs.readFileSync(path + "/nodspel/ui-icons.svg", "utf8"), "sprite mirrored byte-for-byte");
for(const id in MATS){ const it = ITEMS[id], [icon, rarity] = MATS[id];
  assert(it, id + " exists"); assert.strictEqual(it.icon, icon); assert.strictEqual(it.rarity, rarity);
  for(const k of ["name", "family", "sellValue", "stackSize"]) assert(it[k], id + "." + k);
  assert(it.sellValue > 0 && it.stackSize >= 1);
  assert(sprite.includes('id="' + icon + '"'), icon + " in sprite");
  const svg = fs.readFileSync(path + "/assets/icons/" + icon + ".svg", "utf8");
  assert(/PLACEHOLDER/.test(svg) && /PLACEHOLDER/.test(sprite.slice(sprite.indexOf('id="' + icon + '"'), sprite.indexOf("</symbol>", sprite.indexOf('id="' + icon + '"')))), icon + " is marked as a placeholder");
  assert.strictEqual(D.items.filter(i => i.icon === icon).length, 1, icon + " is unique to the item"); }
// meta raid zones: area materials only in the later Transit Hub table, never the Industrial Zone, never Core Ash (needs Hard variants)
for(const z of D.raidZones){ const ids = z.lootTable.map(e => e.itemId);
  assert(!ids.includes("core_ash"), z.id + ": no Core Ash yet");
  if(z.id === "industrial") assert(!ids.includes("tidal_coil") && !ids.includes("frost_glass"), "industrial has no area materials");
  for(const e of z.lootTable) assert(ITEMS[e.itemId], e.itemId); }
assert(D.raidZones.find(z => z.id === "transit").lootTable.some(e => e.itemId === "tidal_coil" && e.weight > 0));
// quests + trader
const A = D.questChains.archipelago.steps, byId = id => A.find(s => s.id === id);
assert.deepStrictEqual(byId("A5").reward.items, { tidal_coil: 1 }); assert.deepStrictEqual(byId("A7").reward.items, { tidal_coil: 2 });
const mats = D.chipShop.items.filter(i => i.kind === "item");
assert.deepStrictEqual(mats.map(i => i.ref).sort(), ["frost_glass", "tidal_coil"]);
for(const m of mats){ assert.strictEqual(m.price, 4); assert.strictEqual(m.weeklyCap, 1); assert.strictEqual(m.qty, 1); assert.strictEqual(m.icon, MATS[m.ref][0]); }
assert.deepStrictEqual(mats.map(i => i.short).sort(), ["Frost Glass", "Tidal Coil"]);
// questFacts legitimately lists memory_module (Town L3 loot); chains and the trader must not use it
const questSrc = fs.readFileSync(path + "/data/quests.js", "utf8").split("\n").filter(l => !l.includes("questFacts =")).join("\n");
assert(!/memory_module|item-memory/.test(questSrc), "no memory_module stand-in in quest chains / chipShop");
// questFacts agree with the loot rules
assert(D.questFacts.archipelago[2].items.includes("tidal_coil") && D.questFacts.archipelago[3].items.includes("tidal_coil"));
assert(D.questFacts.town[2].items.includes("frost_glass") && D.questFacts.town[3].items.includes("frost_glass"));
assert(!D.questFacts.archipelago[1].items.includes("tidal_coil") && !D.questFacts.bunker[3].items.includes("tidal_coil"));
// trader grid fits: column count follows the item count
const app = fs.readFileSync(path + "/app.js", "utf8"), html = fs.readFileSync(path + "/index.html", "utf8");
assert(/--cs-cols:' \+ CS\.items\.length/.test(app) && /repeat\(var\(--cs-cols,7\)/.test(html), "chip grid column count follows CS.items");
console.log("area-materials ok");
