// v1.64 Oscar playtest: early Scrap pace, honest item purpose (single source DATA.itemInfo), Power Cell has a role.
import fs from "node:fs"; import assert from "node:assert";
globalThis.window = globalThis;
for(const f of ["items","modules","recipes","vendors","retention","progression"]) (0, eval)(fs.readFileSync(new URL("../data/" + f + ".js", import.meta.url), "utf8"));
const { RULES, extractScrapBonus } = await import("../nodspel/levels.js");
const { hintText } = await import("../nodspel/item-hints.js");
const D = globalThis.DATA, item = id => D.items.find(i => i.id === id);

// 1) Scrap bonus: same table in base and raid; paid per cleared level.
assert.deepEqual(D.progression.extractScrapBonus, RULES.extractScrapBonus, "base and raid share the extract Scrap bonus");
assert.deepEqual([0,1,2,3].map(extractScrapBonus), [0,5,15,30]);
assert.equal(D.idle.generator.ratePerHour[1], 10, "recycler L1 10/h");
// Expected Scrap of an extracted raid from the REAL loot tables (crates are the only raid Scrap source besides the bonus).
const crate = item("salvage_crate").grantsCurrency.scrap, L = RULES.loot;
const perLevel = L.weights.map((w, i) => L.counts[i] * (w.salvage_crate || 0) / Object.values(w).reduce((a, b) => a + b, 0) * crate);
const raidScrap = levels => perLevel.slice(0, levels).reduce((a, b) => a + b, 0) + extractScrapBonus(levels);
const cost = (m, lv) => D.modules.find(x => x.id === m).levels.find(l => l.level === lv).cost.scrap;
const raidsTo = (scrap, levels) => Math.ceil(scrap / raidScrap(levels));
// After Fabricator L1: BIT Bay L1 + Storage L1, then the first L2 upgrade (Fabricator L2).
const toStorage = cost("bit_bay", 1) + cost("storage", 1), toFirstL2 = toStorage + cost("fabricator", 2);
assert(raidsTo(toStorage, 2) <= 2, "Storage L1 within 2 raids even when only L1+L2 are cleared: " + raidsTo(toStorage, 2));
assert(raidsTo(toFirstL2, 3) <= 3, "first L2 upgrade within ~3 full raids: " + raidsTo(toFirstL2, 3));
assert(raidsTo(toFirstL2, 2) <= 4, "first L2 upgrade within 4 partial raids: " + raidsTo(toFirstL2, 2));
assert(raidScrap(3) < 120, "a full raid stays below one Data Core worth of Scrap (no runaway)");
console.log("expected Scrap per raid: L1+L2", raidScrap(2).toFixed(1), "· full", raidScrap(3).toFixed(1),
  "· raids to Storage L1", raidsTo(toStorage, 3), "· to first L2", raidsTo(toFirstL2, 3));

// 2+3) Item purpose: `uses` tags and descriptions never promise a use that does not exist.
const MOD = { Core:"rebirth_core", Fabricator:"fabricator", Storage:"storage", "BIT Bay":"bit_bay" };
for(const it of D.items){
  const info = D.itemInfo(it.id);
  const real = new Set(info.uses.map(u => u.kind === "upgrade" ? "upgrade:" + u.module : "recipe"));
  for(const u of it.uses || []) if(/^upgrade:|^recipe$/.test(u)) assert(real.has(u), it.id + ": uses says " + u + " but no real cost/recipe consumes it");
  for(const r of real) assert((it.uses || []).includes(r), it.id + ": real use " + r + " missing from uses");
  const promise = /\b(Core|Fabricator|Storage|BIT Bay)\b[^.]*\b(wants?|needs?|hungry|eats)\b/.exec(it.desc || "");
  if(promise) assert(info.uses.some(u => u.module === MOD[promise[1]] || (promise[1] === "Fabricator" && u.kind === "recipe")), it.id + " desc promises the " + promise[1]);
}
assert(D.itemInfo("power_cell").uses.some(u => u.kind === "upgrade"), "Power Cell is used by an upgrade");
assert.equal(D.itemInfo("power_cell").line, "Base part · Core L2");
assert(!item("rebirth_shard").uses.includes("upgrade:rebirth_core"), "bogus Rebirth Shard upgrade use removed");
assert.equal(hintText("rebirth_shard"), "BIT: Rebirth Shard. Rare. The Fabricator can turn it into Data Cores, or sell it for 360 Scrap.");
assert(!/\p{Extended_Pictographic}/u.test(hintText("rebirth_shard")));
console.log("oscar.test: ok");
