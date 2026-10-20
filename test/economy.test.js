// v1.35 economy: Salvage merged into Scrap, purchasable Data Cores, weapon blueprints, dead items have sinks.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js"])
    w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, SV:SAVE_VERSION, ratio:SALVAGE_TO_SCRAP };");
  return { w, A:w.A, S:() => w.__T.S() };
}
const src = f => fs.readFileSync(path + "/" + f, "utf8");
// 1) No Salvage anywhere in data; modules cost Scrap.
for(const f of ["data/modules.js","data/raid_zones.js","data/retention.js","data/progression.js","data/combat.js"])
  assert(!/\bsalvage\b(?!_crate)/i.test(src(f).replace(/\/\/.*$/gm, "")), f + " has no Salvage currency");
{ const { w, S } = boot();
  assert.equal(w.__T.ratio, 2, "1 Salvage = 2 Scrap");
  assert.equal(w.DATA.items.find(i => i.id === "salvage_crate").grantsCurrency.scrap, 24, "crate gives Scrap (v1.64: 16 -> 24)");
  assert.equal(w.DATA.modules.find(m => m.id === "fabricator").levels[0].cost.scrap, 20, "Fabricator L1 costs 20 Scrap");
  assert(!("salvage" in S().cur), "fresh save has no Salvage"); }
// 2) Legacy save migrates Salvage -> Scrap.
{ const a = boot(); const st = JSON.parse(JSON.stringify(a.S())); st.cur.salvage = 37; st.cur.scrap = 10; st.revealed.salvage = true;
  const { S } = boot(st);
  assert.equal(S().cur.scrap, 10 + 74, "salvage converted at 1:2"); assert(!("salvage" in S().cur) && !S().revealed.salvage); }
// 3) Data Cores purchasable: 120 Scrap or 2 Signals each.
{ const { w, A, S } = boot(); A.dismissIntro();
  const ex = w.DATA.vendors[0].exchange;
  assert.deepEqual(ex.map(x => [x.give, x.receive]), [[{scrap:120},{dataCores:1}],[{signals:2},{dataCores:1}]]);
  S().cur.scrap = 250; S().cur.signals = 2; const d0 = S().cur.dataCores;
  A.exchange("cores_scrap"); A.exchange("cores_scrap"); A.exchange("cores_scrap"); A.exchange("cores_signals");
  assert.equal(S().cur.dataCores, d0 + 3); assert.equal(S().cur.scrap, 10); assert.equal(S().cur.signals, 0); }
// 4) Weapons from crafting + loot: vendor no longer sells SMG/Shotgun; blueprints craft them.
{ const { w, A, S } = boot(); A.dismissIntro();
  const stock = w.DATA.vendors[0].stock.map(s => s.itemId);
  for(const id of ["smg_vector","shotgun_breach","rifle_marksman","basic_carbine","ammo_pack"]) assert(!stock.includes(id), id + " not sold");
  const bp = w.DATA.recipes.filter(r => r.blueprint).map(r => r.output.itemId).sort();
  assert.deepEqual(bp, ["rifle_marksman","shotgun_breach","smg_vector"]);
  Object.assign(S().modules, { rebirth_core:1, fabricator:2 });
  S().cur.scrap = 500; S().stash = { scrap_alloy:7, servo:3, polymer_plate:1, hydraulic_component:1, optical_sensor:1, circuit_board:1, encrypted_drive:1, rebirth_shard:1, neural_core:1 };
  A.craft("rifle_build"); A.devFinishTimers(); assert(!S().stash.rifle_marksman, "rifle blueprint is locked until unlocked (Chip trader / quest)");
  S().unlocks = { recipes:{ rifle_build:true } };
  for(const r of ["smg_build","shotgun_build","rifle_build"]) A.craft(r);
  A.devFinishTimers(); // v1.56: crafts after the first one are queued (finish over time)
  assert(S().stash.smg_vector === 1 && S().stash.shotgun_breach === 1 && S().stash.rifle_marksman === 1, "all three weapons crafted");
  const d0 = S().cur.dataCores; A.craft("shard_synth"); A.craft("neural_synth"); A.devFinishTimers();
  assert.equal(S().cur.dataCores, d0 + 18, "protocol items synthesize Data Cores"); }
// 5) Dead items have a real sink (recipe input or module cost) or are gone from all loot.
{ const { w } = boot();
  const used = new Set(); w.DATA.recipes.forEach(r => Object.keys(r.inputs).forEach(i => used.add(i)));
  w.DATA.modules.forEach(m => m.levels.forEach(l => Object.keys(l.cost.items || {}).forEach(i => used.add(i))));
  const zoneLoot = JSON.stringify(w.DATA.raidZones) + src("nodspel/levels.js");
  for(const id of ["encrypted_drive","rebirth_shard","neural_core","ammo_pack","bio_sample"])
    assert(used.has(id) || !zoneLoot.includes(id), id + " has a sink or no source"); }
console.log("ECONOMY TEST PASSED");
