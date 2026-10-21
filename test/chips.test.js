// v1.73 Contract Chips: BIT trader (buy / caps / owned), Drive recycle, Relic sale, quest unlock grant, loot conversion, weekly stub, shop UI.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, chipCanBuy, chipBuy, chipExchange, grantWeeklyChips, chainReward, ingestRaidResult, isoWeekId, chipShopState, load };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document };
}
const g = boot(null); g.A.dismissIntro();
const fresh = JSON.parse(JSON.stringify(g.S())), CS = g.w.DATA.chipShop;
assert.equal(fresh.v, 10); assert.deepEqual(Object.keys(fresh.unlocks).sort(), ["cosmetic", "hard", "recipe"]);
const ITEMS = g.w.DATA.items;
// catalog sanity: prices in range, items exist, icons exist in sprite
const sprite = fs.readFileSync(path + "/assets/icons/sprite.svg", "utf8");
for(const it of CS.items){ assert(it.price >= 3 && it.price <= 12, it.id + " price"); assert(sprite.includes('id="' + it.icon + '"'), it.id + " icon"); if(it.kind === "item") assert(ITEMS.some(i => i.id === it.ref)); }
assert(sprite.includes('id="cur-chip"') && sprite.includes('id="item-chip"'), "chip symbols");
const ids = k => CS.items.filter(i => i.kind === k);
assert(ids("recipe").length && ids("item")[0].weeklyCap === 1 && ids("hard").every(i => i.price === 5) && ids("cosmetic").every(i => i.price >= 3 && i.price <= 8));

const mk = chips => { const b = boot(fresh); b.A.dismissIntro(); b.S().cur.chips = chips; return b; };
// insufficient
{ const b = mk(2), r = b.T.chipBuy("hard_bunker"); assert.deepEqual([r.ok, r.reason], [false, "chips"]); assert.equal(b.S().cur.chips, 2); assert(!b.S().unlocks.hard.bunker); }
// success + owned (flag stored, chips spent once)
{ const b = mk(12), r = b.T.chipBuy("hard_bunker"); assert(r.ok); assert.equal(b.S().cur.chips, 7); assert.equal(b.S().unlocks.hard.bunker, true);
  const r2 = b.T.chipBuy("hard_bunker"); assert.deepEqual([r2.ok, r2.reason], [false, "owned"]); assert.equal(b.S().cur.chips, 7);
  assert(b.T.chipBuy("bp_gull_drone").reason === "chips" && b.T.chipBuy("bit_bunker").ok && b.S().unlocks.cosmetic.bit_bunker); assert.equal(b.S().cur.chips, 4); }
{ const b = mk(10); assert(b.T.chipBuy("bp_gull_drone").ok); assert.equal(b.S().unlocks.recipe.gull_drone, true); assert.equal(b.S().cur.chips, 0); }
// weekly cap: material 1/week, resets with a new ISO week
{ const b = mk(20), before = b.S().stash.tidal_coil || 0; assert(b.T.chipBuy("mat_tidal_coil").ok); assert.equal(b.S().stash.tidal_coil, before + 1);
  const r = b.T.chipBuy("mat_tidal_coil"); assert.deepEqual([r.ok, r.reason], [false, "cap"]); assert.equal(b.S().cur.chips, 16);
  b.S().chipShop.week = "2000-W01"; assert(b.T.chipBuy("mat_tidal_coil").ok, "new week resets the cap"); assert.equal(b.S().cur.chips, 12); }
assert.equal(g.T.isoWeekId(new g.w.Date(Date.UTC(2026, 9, 19))), "2026-W43"); assert.equal(g.T.isoWeekId(new g.w.Date(Date.UTC(2027, 0, 3))), "2026-W53");
assert.deepEqual([mk(5).T.chipCanBuy("nope").reason], ["unknown"]);
// Drive recycle and Relic sale
{ const b = mk(0); assert.equal(b.T.chipExchange("drive").ok, false);
  b.S().stash.encrypted_drive = 1; b.S().stash.prewar_relic = 2; const scrap = b.S().cur.scrap;
  assert.equal(b.T.chipExchange("drive").chips, 2); assert.equal(b.S().stash.encrypted_drive || 0, 0); assert.equal(b.S().cur.chips, 2);
  assert.equal(b.T.chipExchange("relic").chips, 1); assert.equal(b.S().cur.chips, 3); assert.equal(b.S().stash.prewar_relic, 1); assert.equal(b.S().cur.scrap, scrap, "relic sale gives chips instead of scrap");
  b.S().reserved.prewar_relic = true; assert.equal(b.T.chipExchange("relic").ok, false); }
// quest unlock grant (B4 recipe, B8 hard + cosmetic, A8 chips + recipe + hard)
{ const b = mk(0), C = b.w.DATA.questChains;
  b.T.chainReward(C.archipelago.steps[7]); assert.equal(b.S().cur.chips, 3); assert(b.S().unlocks.recipe.gull_drone && b.S().unlocks.hard.archipelago);
  b.T.chainReward(C.bunker.steps[7]); assert(b.S().unlocks.hard.bunker && b.S().unlocks.cosmetic.bit_bunker);
  b.T.chainReward(C.bunker.steps[3]); assert(b.S().unlocks.recipe.tool_emp); }
// loot conversion: contract_chip never reaches the stash
{ const it = ITEMS.find(i => i.id === "contract_chip"); assert.deepEqual(it.grantsCurrency, { chips:1 }); assert(g.w.DATA.currencies.chips);
  const b = mk(0), res = b.T.ingestRaidResult({ schema:"protocol-rebirth/raid-result", version:1, raidId:"chip-1", seed:"s", outcome:"extract", area:"bunker", levelsCleared:3, enemiesDefeated:0, nodesLit:1, remainingMs:1000, extracted:["contract_chip", "contract_chip", "cable"], lost:[], endedAt:Date.now() });
  if(res.ok){ assert.equal(b.S().cur.chips, 2); assert(!b.S().stash.contract_chip); assert.equal(res.currency.chips, 2); assert.equal(res.added.length, 3); } else { throw new Error("ingest failed: " + JSON.stringify(res)); }
  assert(!b.S().revealed.chips, "no currency-bar reveal for chips"); }
// weekly op stub: 0 / 2 / 5 by percentile
{ const b = mk(0); assert.equal(b.T.grantWeeklyChips(80), 0); assert.equal(b.S().cur.chips, 0); assert.equal(b.T.grantWeeklyChips(50), 2); assert.equal(b.T.grantWeeklyChips(10), 5); assert.equal(b.T.grantWeeklyChips(1), 5); assert.equal(b.S().cur.chips, 12); }
// migration: v8 save keeps everything and gains the new fields; v7 too
{ for(const v of [7, 8]){ const old = JSON.parse(JSON.stringify(fresh)); old.v = v; delete old.chipShop; delete old.unlocks; if(v === 7){ delete old.chains; delete old.trackedQuest; delete old.cur.chips; } old.cur.scrap = 91;
    const b = boot(old), s = b.S(); assert.equal(s.v, 10); assert.equal(s.cur.scrap, 91); assert.equal(s.cur.chips, 0); assert(s.unlocks.hard && s.chipShop.bought); } }
// migration backfills unlock flags from completed chain steps only (B4 recipe, B8 hard+cosmetic done; A8 not), no rewards replayed
{ const old = JSON.parse(JSON.stringify(fresh)); old.v = 8; delete old.chipShop; delete old.unlocks; old.cur.scrap = 5; old.cur.chips = 1;
  old.chains = { bunker:{ step:8, prog:0 }, archipelago:{ step:7, prog:0 } };
  const s = boot(old).S(); assert.equal(s.unlocks.recipe.tool_emp, true); assert.equal(s.unlocks.hard.bunker, true); assert.equal(s.unlocks.cosmetic.bit_bunker, true);
  assert(!s.unlocks.recipe.gull_drone && !s.unlocks.hard.archipelago, "incomplete step not granted"); assert.equal(s.cur.scrap, 5); assert.equal(s.cur.chips, 1); }
// UI: shop opens in the shared popup, tiles buy via the click path, rows for Drive/Relic, no glyphs, quest log chip count opens it
{ const b = mk(12); b.S().stash.encrypted_drive = 1; const d = b.d; b.A.chipShop();
  const ov = d.querySelector("#overlay.chipshopov"); assert(ov && ov.querySelector(".pop-card .cshop, .pop-card.cshop") && ov.querySelector(".pop-x"), "shared popup");
  assert.equal(ov.querySelectorAll("[data-chip]").length, CS.items.length); assert.equal(ov.querySelectorAll("[data-ex]").length, 2);
  assert(ov.querySelector(".qchips svg use[href$='#cur-chip']") && ov.querySelector("[data-ex=drive] use[href$='#item-drive']"));
  assert(!/[←-⯿☀-➿\u{1F300}-\u{1FAFF}]/u.test(ov.textContent), "no glyphs");
  assert.equal(ov.querySelector("[data-chip=hard_town]").getAttribute("onclick"), "A.chipBuy('hard_town')"); b.A.chipBuy("hard_town"); assert.equal(b.S().cur.chips, 7); assert(d.querySelector("[data-chip=hard_town].owned"), "owned state shown");
  b.A.chipExchange("drive"); assert.equal(b.S().cur.chips, 9); assert(d.querySelector("[data-ex=drive].off"));
  d.querySelector("#overlay .pop-x").click(); assert(!d.querySelector("#overlay.chipshopov"));
  b.A.questLog("bunker"); assert.equal(d.querySelector(".qlog button.qchips").getAttribute("onclick"), "A.chipShop()", "chip count in the quest log opens the shop"); }
// tile names come from data; Chips pill in the top bar appears once chips > 0
{ assert(CS.items.every(it => typeof it.short === "string" && it.short.length > 0 && it.short.length <= 18), "short name per catalog entry");
  const b = mk(12), d = b.d; b.A.chipShop();
  for(const it of CS.items) assert.equal(d.querySelector("[data-chip=" + it.id + "] .cs-nm").textContent, it.short);
  b.A.chipBuy("mat_tidal_coil"); d.querySelector("#overlay .pop-x").click(); const pill = d.querySelector("#currencies .cur-chips"); assert(pill && pill.querySelector("use[href$='#cur-chip']") && pill.querySelector("b").textContent === "8", "chips pill in top bar");
  const z = mk(0); z.A.chipShop(); z.d.querySelector("#overlay .pop-x").click(); assert(!z.d.querySelector("#currencies .cur-chips"), "no chips pill at 0"); }
console.log("chips.test.js ok"); process.exit(0);
