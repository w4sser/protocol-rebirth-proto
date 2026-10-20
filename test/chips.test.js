// v1.72 Contract Chips: BIT trader, alternative sources, quest unlock grants, weekly op stub.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window;
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, chainActive, chainComplete, ingestRaidResult, ftueOver, weeklyOpChips, recipeOpen, renderCurrencies };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document };
}
const b = boot(), { A, T, d, w } = b, S = b.S; A.dismissIntro();
const DS = w.DATA.chipShop, ITEMS = Object.fromEntries(w.DATA.items.map(i => [i.id, i]));

// data: currency + icons + every tile resolves
assert.equal(w.DATA.currencies.chips.icon, "cur-chip"); assert(ITEMS.contract_chip.grantsCurrency.chips === 1);
for(const e of DS.stock){ assert(e.price > 0); if(e.itemId) assert(ITEMS[e.itemId], e.id); if(e.recipe) assert(w.DATA.recipes.find(r => r.id === e.recipe && r.locked), e.id + " locks a recipe"); }
for(const id in DS.sources) assert(ITEMS[id], "source item " + id);

// open BIT Bay state
Object.assign(S().modules, { rebirth_core:1, fabricator:2, bit_bay:1, storage:1 }); S().baseState = "core_habitable"; S().introSeen = true;
S().beat = w.DATA.progression.beats.findIndex(x => x.id === "choice_upgrade");
assert(T.ftueOver(), "ftue over");

// top bar: chips only when > 0
S().cur.chips = 0; T.renderCurrencies(); assert(!d.querySelector("#currencies .cur-chips"), "no chips pill at 0");
S().cur.chips = 20; T.renderCurrencies(); assert(d.querySelector("#currencies .cur-chips use[href$='#cur-chip']"), "chips pill with its own icon");

// trader overlay: tiles, shared popup, entry next to QUESTS
A.go("bit"); assert(d.querySelector(".bitrow .questentry"), "entry in BIT Bay");
A.chipShop(); const tr = d.querySelector("#overlay .trader");
assert(tr && tr.classList.contains("pop-card") && d.querySelector("#overlay .pop-x"), "shared popup + X");
assert.equal(tr.querySelectorAll(".ctile").length, DS.stock.length);
assert(tr.querySelector(".ctile[disabled] use[href$='#lock']"), "hard pass is a disabled coming-soon tile");

// buy: deducts, grants, cannot repeat one-time unlocks
assert(!T.recipeOpen(w.DATA.recipes.find(r => r.id === "rifle_build")), "rifle locked");
A.chipBuy("bp_rifle"); assert.equal(S().cur.chips, 12, "8 chips deducted"); assert(S().unlocks.recipes.rifle_build, "blueprint unlocked");
A.chipBuy("bp_rifle"); assert.equal(S().cur.chips, 12, "owned blueprint is not sold twice");
assert(d.querySelector(".ctile.off use[href$='#check']"), "owned tile shows a check");
// weekly cap
const m0 = S().stash.memory_module || 0;
A.chipBuy("mat_memory"); assert.equal(S().cur.chips, 8); assert.equal(S().stash.memory_module, m0 + 1);
A.chipBuy("mat_memory"); assert.equal(S().cur.chips, 8, "weekly cap 1 enforced"); assert.equal(S().stash.memory_module, m0 + 1);
S().unlocks.chipBuys.mat_memory.week--; A.chipBuy("mat_memory"); assert.equal(S().cur.chips, 4, "cap resets next week");
// insufficient
S().cur.chips = 2; A.chipBuy("bit_amber"); assert.equal(S().cur.chips, 2, "not enough chips"); assert(!S().unlocks.cosmetics.bit_amber);
S().cur.chips = 3; A.chipBuy("bit_amber"); assert.equal(S().cur.chips, 0); assert(S().unlocks.cosmetics.bit_amber, "cosmetic flag");
S().cur.chips = 9; A.chipBuy("pass_bunker"); assert.equal(S().cur.chips, 9, "hard pass is a disabled stub"); assert(!S().unlocks.hardPass.bunker);
A.chipBuy("nope"); assert.equal(S().cur.chips, 9);

// alternative sources
S().cur.chips = 0; S().stash.encrypted_drive = 1; A.chipTradeIn("encrypted_drive");
assert.equal(S().cur.chips, 2, "drive recycles into 2 chips"); assert(!S().stash.encrypted_drive);
S().stash.prewar_relic = 1; const sc = S().cur.scrap; A.chipTradeIn("prewar_relic");
assert.equal(S().cur.chips, 3, "relic sells for 1 chip"); assert.equal(S().cur.scrap, sc, "no scrap for the chip route");
A.chipTradeIn("prewar_relic"); assert.equal(S().cur.chips, 3, "nothing left to trade");
// raid loot chip converts on extract
const c0 = S().cur.chips;
T.ingestRaidResult({ schema:"protocol-rebirth/raid-result", version:1, raidId:"chip-1", seed:"c", outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:0, nodesLit:0, remainingMs:0, extracted:["contract_chip","contract_chip"], lost:[], endedAt:1 });
assert.equal(S().cur.chips, c0 + 2, "contract_chip loot becomes chips"); assert(!S().stash.contract_chip, "never sits in the stash");

// quest unlock grants: chain finale unlocks hard variant + cosmetic; recipe unlock opens EMP; unknown recipe stored
S().chains.bunker = { step:7, prog:0 }; T.chainComplete("bunker");
assert(S().unlocks.hard.bunker && S().unlocks.cosmetics.bit_bunker, "B8 stores hard + cosmetic");
S().debugAreas = true; S().chains.archipelago = { step:7, prog:0 }; T.chainComplete("archipelago");
assert(S().unlocks.recipes.gull_drone && S().unlocks.hard.archipelago, "A8 stores recipe + hard");
delete S().unlocks.recipes.rifle_build; w.DATA.questChains.bunker.steps[0].reward = { unlock:{ recipe:"rifle_marksman" } };
S().chains.bunker = { step:0, prog:0 }; T.chainComplete("bunker"); assert(S().unlocks.recipes.rifle_build, "recipe unlock by output item opens the locked recipe");

// grandfathering: existing saves that could craft the rifle keep it (once); fresh / low-level saves stay locked
function loadWith(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const x = dom.window; for(const f of DATA_FILES) x.eval(fs.readFileSync(path + "/" + f, "utf8")); x.PR_NAVIGATE = () => {};
  const src = fs.readFileSync(path + "/app.js", "utf8"), key = /SAVE_KEY\s*=\s*(["'`][^"'`]+["'`])/.exec(src)[1];
  x.eval("localStorage.setItem(" + key + ", " + JSON.stringify(JSON.stringify(save)) + ")");
  x.eval(src + "\n;window.__T={ S:()=>S };"); return x.__T.S();
}
const base = JSON.parse(JSON.stringify(S())); base.unlocks = {}; base.stash = {}; base.modules.fabricator = 2;
assert(loadWith(base).unlocks.recipes.rifle_build, "fabricator 2 save keeps the rifle recipe");
const own = JSON.parse(JSON.stringify(base)); own.modules.fabricator = 0; own.stash = { rifle_marksman:1 };
assert(loadWith(own).unlocks.recipes.rifle_build, "owning a rifle keeps the recipe");
const low = JSON.parse(JSON.stringify(base)); low.modules.fabricator = 1;
const lo = loadWith(low); assert(!lo.unlocks.recipes.rifle_build, "low-level save stays locked");
lo.modules.fabricator = 2; assert(!loadWith(JSON.parse(JSON.stringify(lo))).unlocks.recipes.rifle_build, "no re-grant on later loads");

// weekly op stub
assert.equal(T.weeklyOpChips(5), 5); assert.equal(T.weeklyOpChips(10), 5); assert.equal(T.weeklyOpChips(30), 2); assert.equal(T.weeklyOpChips(50), 2); assert.equal(T.weeklyOpChips(80), 0);
console.log("chips ok");
