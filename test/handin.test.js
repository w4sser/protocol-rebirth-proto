// v1.76 HAND IN popup, found-in-raid (FIR) tracking, TRACK toggle, quest RAID button, debug hooks.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.nav = []; w.PR_NAVIGATE = u => w.nav.push(u);
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, chainState, chainReady, ingestRaidResult, maybeShowHandIn, trackedQuest, firHave, migrateFir, raidFindable, handinFir, chainActive, HANDIN_MS, session };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const g = boot(null); g.A.dismissIntro();
const fresh = JSON.parse(JSON.stringify(g.S()));
assert.equal(fresh.v, 10); assert.deepEqual(fresh.fir, {}, "fresh saves start with no FIR counts");
const open = JSON.parse(JSON.stringify(fresh)); open.v = 10; open.cur.scrap = 0;
Object.assign(open.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); open.baseState = "core_habitable"; open.introSeen = true;
open.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; open.beat = g.w.DATA.progression.beats.findIndex(b => b.id === "choice_upgrade");
let n = 0; const raid = o => Object.assign({ schema:"protocol-rebirth/raid-result", version:1, raidId:"h" + (n++), outcome:"extract", area:"bunker", levelsCleared:1, extracted:[], lost:[], killsByType:{} }, o);

// ---- migration: v9 stash counts as found in raid ----
{ const v9 = JSON.parse(JSON.stringify(open)); v9.v = 9; delete v9.fir; v9.stash = { scrap_alloy: 4, cable: 2 };
  const m = boot(v9), s = m.S(); assert.equal(s.v, 10); assert.deepEqual(s.fir, { scrap_alloy: 4, cable: 2 }, "existing stash is FIR");
  assert.equal(JSON.parse(m.w.localStorage.getItem("pr_meta_save")).v, 10, "migrated save is stored"); }

// ---- FIR tagging: extraction yes, purchase / reward / dead raid no ----
const b = boot(open), { A, T, d } = b, S = b.S; A.go("base");
S().fir = {}; S().stash = {}; S().cur.scrap = 500;
T.ingestRaidResult(raid({ extracted:["scrap_alloy","scrap_alloy","polymer_plate"] }));
assert.equal(S().fir.scrap_alloy, 2); assert.equal(S().fir.polymer_plate, 1);
T.ingestRaidResult(raid({ outcome:"death", extracted:[], lost:["cable"] })); assert(!S().fir.cable, "dead raid brings nothing");
const vend = b.w.DATA.vendors[0].stock.find(x => !x.requires); A.buy(vend.itemId);
assert.equal(S().stash[vend.itemId] - (S().fir[vend.itemId] || 0), 1, "bought copy is not FIR");
A.go("stash"); assert(d.querySelector("#app .slot .firmk use[href$='#fir']"), "FIR marker on stash tiles");
b.w.eval("addItem('cable', 2)"); assert.equal(T.firHave("cable"), 0, "granted copies are not FIR");
b.w.eval("removeItem('scrap_alloy', 1)"); assert.equal(T.firHave("scrap_alloy"), 1, "FIR clamps with the stack");

// ---- FIR only applies to items a raid can drop: A4 (Transmitter) takes plain stash copies ----
{ const a = boot(open), at = a.T, as = a.S; assert(!at.raidFindable("transmitter") && at.raidFindable("scrap_alloy"));
  as().debugAreas = true; as().chains.archipelago = { step:3, prog:0 }; as().stash = { transmitter: 1 }; as().fir = {};
  assert.equal(at.chainActive("archipelago").id, "A4"); assert(!at.handinFir(at.chainActive("archipelago")), "no FIR tag on A4");
  assert(at.chainReady("archipelago"), "a bartered Transmitter completes A4"); a.A.go("base"); a.A.questLog("archipelago");
  assert(!a.d.querySelector("#overlay .qfir, #overlay .qt.fir"), "no FIR tag or marker on A4"); a.d.querySelector("#overlay .pop-x").click();
  a.A.QUEST_HANDIN({ chain:"archipelago" }); assert(!as().stash.transmitter, "transmitter consumed"); }

// ---- FIR credit for newly found gear and medkits, not for gear brought in ----
{ const e = boot(open), et = e.T, es = e.S; es().stash = {}; es().fir = {};
  const r0 = es().stash; es().coreLaunch = { raidId:"gx", gear:["basic_carbine"], kit:{ medkit:1 } };
  et.ingestRaidResult(raid({ raidId:"gx", extracted:[], gearOut:["basic_carbine","smg_vector"], kitLeft:{ medkit:2 } }));
  assert.equal(et.firHave("smg_vector"), 1, "found gear is FIR"); assert.equal(et.firHave("basic_carbine"), 0, "brought-in gear is not");
  assert.equal(et.firHave("medkit"), 1, "only the medkit beyond the one taken in is FIR"); }

// ---- hand in: popup appears, consumes only FIR, pays once ----
S().chains.bunker.step = 2; S().stash = { scrap_alloy: 5, polymer_plate: 1 }; S().fir = { scrap_alloy: 2, polymer_plate: 1 };
S().fir = { scrap_alloy: 1, polymer_plate: 1 }; assert(!T.chainReady("bunker"), "1 FIR alloy of 5 is not enough");
S().fir = { scrap_alloy: 2, polymer_plate: 1 }; assert(T.chainReady("bunker"));
A.go("base"); assert(!d.getElementById("overlay")); (T.session.handInShown = {});
assert(T.maybeShowHandIn(), "popup on base load when the requirements are met");
let pop = d.querySelector("#overlay .handin"); assert(pop && pop.closest(".pop-card, .bpop"), "shared overlay popup");
assert(d.querySelector("#overlay .pop-x[data-close]") && pop.firstElementChild.classList.contains("pop-x") || pop.querySelector(".pop-x"), "close X from the shared component");
assert.equal(pop.querySelectorAll(".hi-req .qt").length, 2, "one tile per required item"); assert(pop.querySelector(".hi-req .qt.fir .firmk"), "FIR marker on requirement tiles");
assert(pop.querySelector(".hi-req").textContent.includes("2/2") && pop.querySelector(".hi-req").textContent.includes("1/1"), "have/need counts");
assert(pop.querySelectorAll(".hi-rw .qt").length >= 1, "reward tiles");
assert(pop.querySelector(".hi-unlock") && pop.querySelector(".hi-unlock").textContent.includes("UNLOCKAR:"), "T1-A UNLOCKAR line");
const go = pop.querySelector("button.primary.big.hi-go"); assert(go && go.textContent.includes("HAND IN"), "big primary HAND IN");
assert(!T.maybeShowHandIn(), "not twice per session once shown");
const chips = S().cur.chips; assert.equal(go.getAttribute("onclick"), "A.QUEST_HANDIN({chain:'bunker'})"); A.QUEST_HANDIN({ chain:"bunker" });
assert(pop.classList.contains("consuming"), "item tiles animate out"); assert(!pop.classList.contains("paid"));
assert.equal(S().stash.scrap_alloy, 3, "2 FIR alloy consumed, the 3 plain ones stay"); assert(!S().stash.polymer_plate); assert.equal(S().cur.chips, chips + 1, "reward paid immediately, once");
assert.equal(T.chainState("bunker").step, 3);
A.QUEST_HANDIN({ chain:"bunker" }); A.QUEST_HANDIN({ chain:"bunker" }); assert.equal(S().cur.chips, chips + 1, "no double grant"); assert.equal(T.chainState("bunker").step, 3);
assert(S().log.filter(e => e.action === "QUEST_CHAIN_STEP" && e.payload.step === "B3").length === 1, "one act() entry");
(async () => {
  await sleep(T.HANDIN_MS + 80);
  assert(pop.classList.contains("paid"), "rewards reveal after the consume animation"); assert(pop.querySelector(".hi-go").textContent.includes("DONE"));
  pop.querySelector(".hi-go").click(); assert(!d.getElementById("overlay"), "DONE closes");

  // extract / kill / clear quests: same popup, no item tiles
  S().chains.bunker.step = 0; S().chains.bunker.prog = 0; (T.session.handInShown = {});
  const r = T.ingestRaidResult(raid({ extracted:["cable","cable","cable"] })); assert.deepEqual(r.chainsDone.map(c => c.id), ["B1"]);
  assert.equal(S().chains.bunker.step, 0, "no silent turn-in");
  assert(T.maybeShowHandIn()); pop = d.querySelector("#overlay .handin"); assert(pop.querySelector(".hi-req .qt.ok") && !pop.querySelector(".hi-req .qt.fir"), "objective done tile, no item tiles");
  d.querySelector("#overlay .pop-x").click(); assert(!d.getElementById("overlay")); assert.equal(S().chains.bunker.step, 0, "closing does not hand in");
  A.questLog("bunker"); assert(d.querySelector("#overlay .handin"), "opening the quest reopens the popup"); d.querySelector("#overlay .pop-x").click();
  assert(d.querySelector("#overlay .qlog"), "X from the log-opened popup returns to the log");
  assert(d.querySelector("#overlay .qlog .qact .primary").textContent.includes("HAND IN"), "log detail offers HAND IN");
  A.handInOpen("bunker", "log"); assert(d.querySelector("#overlay .hi-go")); A.QUEST_HANDIN({ chain:"bunker" }); assert.equal(S().chains.bunker.step, 1);
  await sleep(T.HANDIN_MS + 80); d.querySelector("#overlay .hi-go").click();

  // ---- TRACK toggle ----
  A.questLog("bunker"); let log = d.querySelector("#overlay .qlog"); assert(log.querySelector(".qtrack.on").textContent.includes("Tracked"));
  assert(d.querySelector(".s-base .qgoal"), "goal card shows the tracked quest");
  A.QUEST_TRACK({ chain:"bunker" }); log = d.querySelector("#overlay .qlog");
  assert.equal(log.querySelector(".qtrack").textContent.trim(), "Track"); assert(!log.querySelector(".qtrack.on")); assert(log.querySelector(".qtrack").getAttribute("aria-pressed") === "false");
  assert(!d.querySelector(".s-base .qgoal"), "goal card reflects the change at once"); assert.equal(T.trackedQuest(), null);
  A.QUEST_TRACK({ chain:"bunker" }); log = d.querySelector("#overlay .qlog"); assert(log.querySelector(".qtrack.on") && log.querySelector(".qrow.cur.trk")); assert(d.querySelector(".s-base .qgoal"));

  // ---- quest RAID button ----
  const rb = log.querySelector(".qact .qraid"); assert(rb && !rb.disabled && rb.textContent.includes("RAID"), "RAID button in the detail");
  assert.equal(rb.getAttribute("onclick"), "A.QUEST_RAID({chain:'bunker'})"); b.w.nav.length = 0; A.QUEST_RAID({ chain:"bunker" });
  assert.equal(b.w.nav.length, 1, "deploys through the normal flow"); const u = new URL(b.w.nav[0], "http://x/"); assert.equal(u.searchParams.get("area"), "bunker");
  assert(u.searchParams.get("raidId") && u.searchParams.get("seed")); assert(S().coreLaunch && S().coreLaunch.area === "bunker", "launch recorded like the base DEPLOY");
  assert(u.searchParams.get("quest"), "quest chip param for the raid HUD");
  b.w.nav.length = 0; S().debugAreas = false; S().coreLaunch = null; A.QUEST_RAID({ chain:"archipelago" }); assert.equal(b.w.nav.length, 0, "locked area: no deploy");
  { const lk = boot(open); lk.A.go("base"); assert(!lk.w.eval("areaUnlocked('archipelago')")); lk.A.QUEST_RAID({ chain:"archipelago" }); assert.equal(lk.w.nav.length, 0); }
  { const o2 = JSON.parse(JSON.stringify(open)); o2.debugAreas = true; const un = boot(o2); un.A.go("base"); un.A.questLog("archipelago");
    assert(un.d.querySelector("#overlay .qraid") && !un.d.querySelector("#overlay .qraid").disabled); un.A.QUEST_RAID({ chain:"archipelago" }); assert.equal(new URL(un.w.nav[0], "http://x/").searchParams.get("area"), "archipelago"); }

  // ---- debug hooks ----
  { const dm = boot(open); dm.A.handInDemo(); assert(dm.d.querySelector("#overlay .handin .hi-req .qt.fir")); dm.d.querySelector("#overlay .pop-x").click();
    dm.A.handInDemo("extract"); assert(dm.d.querySelector("#overlay .handin")); dm.d.querySelector("#overlay .pop-x").click(); dm.A.questLogDemo(); assert(dm.d.querySelector("#overlay .qlog")); }
  { const hm = boot(open); hm.A.handInDemo("hero"); const im = hm.d.querySelector("#overlay .handin .hi-rw .qt.hero img.hi-hero"); assert(im && im.getAttribute("src") === "assets/art/tidal-coil.webp", "reward with hero art shows it large");
    assert(!hm.d.querySelector("#overlay .handin .hi-rw .qt.hero use"), "hero replaces the small icon in the reveal"); hm.d.querySelector("#overlay .pop-x").click(); }
  console.log("HANDIN TEST PASSED");
})().catch(e => { console.error(e); process.exit(1); });
