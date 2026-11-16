// PRB-153: narrator mood busts, shared card behavior and once-only base cutscene triggers.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- a) component unit tests, with a fake clock (no real waiting) ---------- */

// Replaces w.setTimeout/w.clearTimeout with a manually-advanced fake clock so show/queue/dismiss/
// auto-dismiss can be tested without waiting in real time.
function makeClock(w){
  let now = 0, nextId = 1; const jobs = new Map();
  w.setTimeout = (fn, ms) => { const id = nextId++; jobs.set(id, { at: now + (ms || 0), fn }); return id; };
  w.clearTimeout = id => { jobs.delete(id); };
  return {
    advance(ms){
      now += ms;
      let ran = true;
      while(ran){
        ran = false;
        const due = [...jobs.entries()].filter(([, j]) => j.at <= now).sort((a, b) => a[1].at - b[1].at);
        for(const [id, job] of due){ if(!jobs.has(id)) continue; jobs.delete(id); job.fn(); ran = true; }
      }
    }
  };
}
function bootComponent(){
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  const clock = makeClock(w);
  w.eval(fs.readFileSync(path + "/ui/bit-card.js", "utf8"));
  return { w, doc: w.document, clock, PRBitCard: w.PRBitCard };
}

// Busts preload lazily on first presentation, once per page, and raid paths retain ../.
{
  const { w, doc, clock, PRBitCard } = bootComponent();
  const requests = [];
  w.Image = class { set src(src){ requests.push(src); } };
  assert.equal(requests.length, 0);
  const vp = doc.createElement("div"); vp.id = "viewport"; doc.body.append(vp);
  PRBitCard.show({ id:"raid-bust", text:"new material", mood:"happy" });
  assert.equal(requests.length, 4);
  assert.equal(new Set(requests).size, 4);
  assert(requests.every(src=>src.startsWith("../assets/production/bit-narrator/")));
  assert.equal(doc.querySelector(".bit-card-img").getAttribute("src"), "../assets/production/bit-narrator/bust-tilt-happy-v1.webp");
  PRBitCard.dismiss(); PRBitCard.show({ id:"next-bust", text:"next", mood:"sad" });
  assert.equal(requests.length, 4, "no repeated preload");
}

// PRB-158 (Robert's playtest): base cards hold until tapped -- no auto-dismiss, however long they
// sit; a tap in the first second is ignored (no accidental skip); TAP TO CONTINUE fades in ~3s.
{
  const { doc, clock, PRBitCard } = bootComponent();
  assert.equal(PRBitCard.isOpen(), false, "closed before any show()");
  let done = 0;
  PRBitCard.show({ id: "a", text: "hello", mood: "happy", duration: 1000, onDone: () => done++ });
  assert.equal(PRBitCard.isOpen(), true, "card opens");
  const el = doc.querySelector(".bit-card");
  assert(el, "card element rendered");
  assert.equal(el.hidden, false);
  assert.equal(el.querySelector(".bit-card-bubble").textContent, "hello");
  assert(el.classList.contains("mood-happy"), "mood class applied");
  el.click();
  assert.equal(PRBitCard.isOpen(), true, "a tap in the first second is ignored");
  clock.advance(999); el.click();
  assert.equal(PRBitCard.isOpen(), true, "still ignored just under one second");
  clock.advance(59000);
  assert.equal(PRBitCard.isOpen(), true, "never auto-dismisses, however long it sits");
  el.click();
  assert.equal(PRBitCard.isOpen(), false, "a tap well after one second dismisses");
  assert.equal(done, 1, "onDone fires exactly once");
  assert.equal(el.hidden, true, "element hidden again after dismiss");
}

// TAP TO CONTINUE fade-in timing, and reduced motion shows it instantly instead (same convention
// as the mini cutscenes).
{
  const { doc, clock, PRBitCard } = bootComponent();
  PRBitCard.show({ id: "hint", text: "hello" });
  const el = doc.querySelector(".bit-card");
  clock.advance(2999);
  assert(!el.classList.contains("hint-visible"), "hint not shown yet");
  clock.advance(1);
  assert(el.classList.contains("hint-visible"), "hint fades in at ~3s");
  PRBitCard.dismiss();
}
{
  const { doc, w, PRBitCard } = bootComponent();
  w.matchMedia = query => ({ matches: query.includes("reduced-motion") });
  PRBitCard.show({ id: "reduced-hint", text: "hello" });
  assert(doc.querySelector(".bit-card").classList.contains("hint-visible"), "reduced motion shows the hint instantly");
  PRBitCard.dismiss();
}

// raid context keeps the old timed, non-blocking auto-dismiss (the player is mid-combat there,
// per docs/bit-narrator.md): no tap-guard, no hint, duration (and its long-line extension/cap)
// still governs when it clears itself.
{
  const { doc, clock, PRBitCard } = bootComponent();
  const vp = doc.createElement("div"); vp.id = "viewport"; doc.body.append(vp);
  let done = 0;
  PRBitCard.show({ id: "raid-auto", text: "hi", duration: 1000, onDone: () => done++ });
  assert(doc.querySelector(".bit-card.ctx-raid"), "raid placement");
  clock.advance(999);
  assert.equal(PRBitCard.isOpen(), true, "still open just before duration elapses");
  clock.advance(2);
  assert.equal(PRBitCard.isOpen(), false, "raid keeps its non-blocking auto-dismiss");
  assert.equal(done, 1, "onDone fires exactly once");
}
{
  const { doc, clock, PRBitCard } = bootComponent();
  const vp = doc.createElement("div"); vp.id = "viewport"; doc.body.append(vp);
  PRBitCard.show({ id: "raid-long", text: "x".repeat(130) }); // default 3000 + (130-50)*40=3200 -> capped 6000
  clock.advance(5999);
  assert.equal(PRBitCard.isOpen(), true, "not dismissed just under the 6s cap");
  clock.advance(2);
  assert.equal(PRBitCard.isOpen(), false, "capped at 6s even for a very long line");
}

// only one card at a time; a second show() while one is open queues and plays after
{
  const { doc, PRBitCard } = bootComponent();
  PRBitCard.show({ id: "first", text: "one" });
  PRBitCard.show({ id: "second", text: "two" });
  assert.equal(doc.querySelector(".bit-card-bubble").textContent, "one", "second call queues, does not replace the first");
  PRBitCard.dismiss();
  assert.equal(doc.querySelector(".bit-card-bubble").textContent, "two", "queued card plays once the first is gone");
  assert.equal(PRBitCard.isOpen(), true);
}

// queue caps at 4; further calls beyond that are dropped
{
  const { PRBitCard } = bootComponent();
  let completed = 0;
  for(let i = 0; i < 6; i++) PRBitCard.show({ id: "q" + i, text: "line " + i, onDone: () => completed++ });
  for(let i = 0; i < 6; i++) PRBitCard.dismiss();
  assert.equal(completed, 5, "the current card + 4 queued play; the 6th call is dropped");
}

// a duplicate id already current or queued is ignored, not re-queued
{
  const { PRBitCard } = bootComponent();
  let completed = 0;
  PRBitCard.show({ id: "dup", text: "first", onDone: () => completed++ });
  PRBitCard.show({ id: "dup", text: "first-again", onDone: () => completed++ });
  PRBitCard.dismiss();
  assert.equal(completed, 1, "a duplicate id already in flight is not re-queued");
}

// manual dismiss() advances immediately to the next queued card
{
  const { PRBitCard } = bootComponent();
  let a = false;
  PRBitCard.show({ id: "m1", text: "a", duration: 5000, onDone: () => { a = true; } });
  PRBitCard.show({ id: "m2", text: "b", duration: 5000 });
  PRBitCard.dismiss();
  assert(a, "manual dismiss fires onDone for the current card");
  assert.equal(PRBitCard.isOpen(), true, "queued card takes over immediately");
}

// blocked while the cold-open/intro is present: base queues until it clears
{
  const { doc, clock, PRBitCard } = bootComponent();
  const intro = doc.createElement("div"); intro.className = "intro"; doc.body.appendChild(intro);
  let completed = 0;
  PRBitCard.show({ id: "blocked", text: "later", duration: 100, onDone: () => completed++ });
  assert.equal(PRBitCard.isOpen(), false, "never shows while .intro is present");
  clock.advance(250);
  assert.equal(PRBitCard.isOpen(), false, "still blocked on the next poll");
  intro.remove();
  clock.advance(250);
  assert.equal(PRBitCard.isOpen(), true, "queued card plays once the intro clears");
}

// blocked while a base popup/overlay is open
{
  const { doc, clock, PRBitCard } = bootComponent();
  const ov = doc.createElement("div"); ov.id = "overlay"; doc.body.appendChild(ov);
  PRBitCard.show({ id: "ovblocked", text: "later", duration: 100 });
  assert.equal(PRBitCard.isOpen(), false, "never shows while #overlay is open");
  ov.remove();
  clock.advance(300);
  assert.equal(PRBitCard.isOpen(), true, "plays once the popup closes");
}

// blocked while the splash is active
{
  const { doc, clock, PRBitCard } = bootComponent();
  const splash = doc.createElement("div"); splash.id = "splash"; doc.body.appendChild(splash);
  PRBitCard.show({ id: "splashblocked", text: "later", duration: 100 });
  assert.equal(PRBitCard.isOpen(), false, "never shows while the splash is active");
  splash.classList.add("out");
  clock.advance(300);
  assert.equal(PRBitCard.isOpen(), true, "plays once the splash is dismissed");
}

// raid context (presence of #viewport, nodspel's own landscape container): a blocked call is
// dropped outright, never queued, and the placement class differs from the base corner.
{
  const { doc, clock, PRBitCard } = bootComponent();
  const vp = doc.createElement("div"); vp.id = "viewport"; doc.body.appendChild(vp);
  const ro = doc.createElement("div"); ro.id = "round-over"; ro.hidden = false; doc.body.appendChild(ro);
  let completed = 0;
  PRBitCard.show({ id: "raiddrop", text: "dropped", duration: 100, onDone: () => completed++ });
  clock.advance(5000);
  assert.equal(PRBitCard.isOpen(), false, "raid: dropped rather than queued while blocked");
  assert.equal(completed, 0, "dropped card never plays or completes");
  ro.hidden = true;
  PRBitCard.show({ id: "raidok", text: "hi", duration: 100 });
  assert(doc.querySelector(".bit-card.ctx-raid"), "raid page gets the ctx-raid placement, not the base corner");
}

console.log("BIT CARD COMPONENT TESTS PASSED");

/* ---------- b) BIT identity lock: static source checks ---------- */
{
  const css = fs.readFileSync(path + "/ui/bit-card.css", "utf8");
  const js = fs.readFileSync(path + "/ui/bit-card.js", "utf8");
  assert(!/hue-rotate/.test(css), "no hue-rotate anywhere in bit-card.css");
  assert(!/hue-rotate/.test(js), "no hue-rotate anywhere in bit-card.js");
  assert(!/bright-cyan|bit-coldopen-v1/.test(js), "only approved mood busts");
  assert(!/filter:brightness/.test(css), "mood art needs no brightness filters");
  const { PRBitCard, doc } = bootComponent();
  for(const [mood, asset] of Object.entries({happy:"happy",sad:"sad",worried:"sad",smile:"smile",calm:"smile",skeptical:"skeptical",tired:"skeptical",unknown:"smile",constructor:"smile"})){
    PRBitCard.show({ id:mood, text:"hello", mood });
    const file = "assets/production/bit-narrator/bust-tilt-" + asset + "-v1.webp";
    assert.equal(doc.querySelector(".bit-card-img").getAttribute("src"), file);
    assert(fs.existsSync(path + "/" + file), "mapped asset exists");
    PRBitCard.dismiss();
  }
  assert(/prefers-reduced-motion:reduce\)\{[\s\S]*animation:none!important/.test(css), "reduced motion turns off hover/tilt animation");
}

/* ---------- c) wiring sanity: both shells load the shared component ---------- */
{
  assert(/ui\/bit-card\.css/.test(fs.readFileSync(path + "/index.html", "utf8")), "index.html loads ui/bit-card.css");
  assert(/ui\/bit-card\.js/.test(fs.readFileSync(path + "/index.html", "utf8")), "index.html loads ui/bit-card.js");
  const nodspelHtml = fs.readFileSync(path + "/nodspel/index.html", "utf8");
  assert(/\.\.\/ui\/bit-card\.css/.test(nodspelHtml), "nodspel/index.html loads ui/bit-card.css");
  assert(/\.\.\/ui\/bit-card\.js/.test(nodspelHtml), "nodspel/index.html loads ui/bit-card.js");
}

/* ---------- d) base moments: fire once, persist in S.bitCardsSeen ---------- */

const FILES = ["data/items.js", "data/modules.js", "data/bit.js", "data/bit-talents.js", "data/raid_zones.js",
  "data/recipes.js", "data/loot-sources.js", "data/vendors.js", "data/retention.js", "data/quests.js", "data/progression.js", "data/combat.js"];
function boot(seedSave, calls, artMode = "success", requests = []){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  w.localStorage = (() => { let s = {}; return { getItem: k => s[k] ?? null, setItem: (k, v) => s[k] = v, removeItem: k => delete s[k] }; })();
  w.URL.createObjectURL = () => "blob:fake";
  if(seedSave) w.localStorage.setItem("pr_meta_save", JSON.stringify(seedSave));
  w.PR_NAVIGATE = u => { w.launchURL = u; };
  // The real ui/bit-card.js is never eval'd here (runScripts:"outside-only" skips <script src>) --
  // stub it so app.js's window.PRBitCard?.show(...) calls are observable.
  w.PRBitCard = { show(){ assert.fail("cutscene moments must never also show a card"); }, dismiss(){}, isOpen(){ return false; } };
  w.PRBitCutscene = { play: opts => calls.push(opts), preload(opts){
    requests.push(opts.from, opts.to);
    if(artMode === "stall") return new Promise(() => {});
    return Promise.resolve(artMode === "error" ? ["", ""] : [opts.from, opts.to]);
  }, released:[], release(opts){ this.released.push(opts.id); }, isOpen(){ return false; } };
  w.eval(fs.readFileSync(path + "/save-slots.js", "utf8"));
  for(const s of FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.eval(fs.readFileSync(path + "/app.js", "utf8") +
    ";window.T={state:()=>S,ingestRaidResult,migrateBitCardsSeen,maybeShowFirstDeathCard,freshState,fabricatorCutsceneBeat,showHomecomingSummary,closeAllPopups,fabCraftHtml,craftConfirmHtml,vestGuaranteeNeed,BIT_CUTSCENES,MODS,D,ITEMS,trackedGoalHtml};");
  return w;
}
async function bootToCoreOneTapAway(calls){
  const w = boot(null, calls);
  w.dispatchEvent(new w.Event("pr:splash-finished"));
  const url = new w.URL(w.launchURL, "http://localhost/");
  const result = {
    schema: "protocol-rebirth/raid-result", version: 1, raidId: url.searchParams.get("raidId"), seed: url.searchParams.get("seed"),
    outcome: "extract", area: "bunker", levelsCleared: 1, enemiesDefeated: 1, nodesLit: 1, remainingMs: 400000,
    extracted: ["scrap_alloy", "scrap_alloy"], lost: [], endedAt: Date.now(), kitLeft: { medkit: 1 }
  };
  w.T.ingestRaidResult(result);
  w.A.go("base");
  w.A.dismissIntro();
  assert.deepEqual(w.PRBitCutscene.released,["cold_open"],"cold-open dismissal releases its retained art");
  return w;
}

(async () => {

// PRB-160: startup warms the next story first and skips scenes already seen.
{
  const requests=[], w=boot(null, [], "stall", requests);
  assert.match(requests[0], /coldopen\/bunker-discovery-arch-v1\.webp\?v=\d+\.\d+\.\d+$/);
  assert.match(requests[1], /coldopen\/bit-coldopen-v1\.webp\?v=\d+\.\d+\.\d+$/);
  assert.match(requests[2], /cutscene-core-restore-start/);
  assert(requests.some(src=>/cutscene-vault-dark/.test(src)), "Vault pair warms through the renderer cache");
  assert(requests.some(src=>/cutscene-vault-powered/.test(src)));
  const saved=JSON.parse(JSON.stringify(w.T.state()));
  saved.introSeen=true;saved.bitCardsSeen={core_restored:true,first_death:true,fabricator_built:true,raid_briefing:true,quest_intro:true,vault_intro:true};
  const seenRequests=[], seen=boot(saved, [], "stall", seenRequests);
  assert.deepEqual(seenRequests,[],"seen scenes retain no warm images on boot");
  w.close();seen.close();
}

// core_restored: the live transition plays a cutscene (no card, no popup), exactly once, persisted.
// PRB-162: raid_briefing (Fabricator still locked) queues immediately behind it -- never stacked,
// just the next call in order, exactly as docs/bit-narrator.md's queueing model describes.
{
  const calls = [];
  const w = await bootToCoreOneTapAway(calls);
  assert.equal(w.T.state().bitCardsSeen.core_restored, undefined, "not marked seen before the build");
  w.A.build("rebirth_core");
  // PRB-155 (playtest 2026-11-15, item 4): the POWER RESTORED popup (and its ENTER THE FACILITY
  // gate) is gone for good -- the cutscene is the single screen, so there is nothing to click.
  assert(!w.document.getElementById("overlay"), "no popup shows for the Core restore");
  assert.equal(w.T.state().bitCardsSeen.core_restored, true, "persisted synchronously with the build, no popup left to gate it");
  assert.equal(calls.length, 2, "PRB-162: raid_briefing queues right behind core_restored");
  assert.equal(calls[0].id, "core_restored");
  assert.match(calls[0].line, /circuits again/);
  assert(calls[0].bust && calls[0].info, "core_restored cutscene carries the standard bubble+info layout");
  assert.equal(calls[1].id, "raid_briefing", "raid_briefing is queued next, never shown on top of core_restored");
  assert.equal(w.T.state().bitCardsSeen.raid_briefing, false, "not seen while only queued");
  calls[1].onDone();
  assert.equal(w.T.state().bitCardsSeen.raid_briefing, true, "persisted on dismissal");
  assert(calls[1].info.some(r => r.label === "NEXT" && /Fabricator/.test(r.text)), "raid_briefing names the real Fabricator cost");
}

// raid_briefing: never fires once the Fabricator is already built, even on a fresh base visit.
{
  const calls = [];
  const w = await bootToCoreOneTapAway(calls);
  w.A.build("rebirth_core");
  const st = w.T.state();
  st.modules.fabricator = 1; st.bitCardsSeen.raid_briefing = false; // force the live-trigger path, not migration
  calls.length = 0;
  w.A.go("base");
  assert.equal(calls.filter(c => c.id === "raid_briefing").length, 0, "no raid_briefing once the Fabricator is already built");
}

// raid_briefing: a save that already saw core_restored live (an earlier session) and is still
// Fabricator-locked gets the cutscene on the next base visit -- not retroactively from loading.
{
  const seedWin = boot(null, []);
  const st = seedWin.T.state();
  st.modules.rebirth_core = 1; st.baseState = "core_habitable"; st.introSeen = true;
  st.bitCardsSeen = { core_restored:true, first_death:true, fabricator_built:false };
  const saved = JSON.parse(JSON.stringify(st));
  const calls = [];
  const w = boot(saved, calls);
  assert.equal(w.T.state().bitCardsSeen.raid_briefing, undefined, "loading alone never marks it seen (Fabricator still locked)");
  w.A.go("base");
  assert.equal(calls.filter(c => c.id === "raid_briefing").length, 1, "fires live on the next base visit");
  assert.equal(w.T.state().bitCardsSeen.raid_briefing, false);
  calls.find(c=>c.id === "raid_briefing").onDone();
  assert.equal(w.T.state().bitCardsSeen.raid_briefing, true);
  w.A.go("base");
  assert.equal(calls.filter(c => c.id === "raid_briefing").length, 1, "never fires a second time");
}

// raid_briefing: an existing save that already built the Fabricator is marked seen on load
// (retroactive migration) -- the window already closed for it.
{
  const seedWin = boot(null, []);
  const st = seedWin.T.state();
  st.modules.fabricator = 1;
  delete st.bitCardsSeen;
  const saved = JSON.parse(JSON.stringify(st));
  const calls = [];
  const w = boot(saved, calls);
  assert.equal(w.T.state().bitCardsSeen.raid_briefing, true, "existing save with Fabricator already built is marked seen on load");
  assert.equal(calls.length, 0, "loading a save never fires a cutscene by itself");
}

// core_restored: a save that already had Core L1 built before this field existed is marked seen
// on load (retroactive migration) and never shown live just from loading.
{
  const seedWin = boot(null, []);
  const st = seedWin.T.state();
  st.modules.rebirth_core = 1; st.baseState = "core_habitable"; st.introSeen = true;
  delete st.bitCardsSeen;
  const saved = JSON.parse(JSON.stringify(st));
  const calls = [];
  const w = boot(saved, calls);
  assert.equal(w.T.state().bitCardsSeen.core_restored, true, "existing save with Core already built is marked seen on load");
  assert.equal(calls.length, 0, "loading a save never fires the card by itself");
}

// first_death: parallel retroactive migration for an existing save that already had a death.
{
  const seedWin = boot(null, []);
  const st = seedWin.T.state();
  st.deaths = 2;
  delete st.bitCardsSeen;
  const saved = JSON.parse(JSON.stringify(st));
  const calls = [];
  const w = boot(saved, calls);
  assert.equal(w.T.state().bitCardsSeen.first_death, true, "existing save with a prior death is marked seen on load");
  assert.equal(calls.length, 0);
}

// first_death: fires after a death ingest, not after an extract, and only once ever.
{
  const calls = [];
  const w = boot(null, calls);
  const ingestExtract = { ok: true, raid: { outcome: "extract" } };
  const ingestDeath = { ok: true, raid: { outcome: "death" } };
  w.T.maybeShowFirstDeathCard(ingestExtract);
  assert.equal(calls.length, 0, "extract never triggers the first-death card");
  assert.equal(w.T.state().bitCardsSeen.first_death, undefined);
  w.T.maybeShowFirstDeathCard(ingestDeath);
  assert.equal(calls.length, 1, "death ingest triggers the cutscene");
  assert.equal(calls[0].id, "first_death");
  assert.match(calls[0].line, /dragged you back/);
  assert.equal(w.T.state().bitCardsSeen.first_death, true, "persisted once");
  w.T.maybeShowFirstDeathCard(ingestDeath);
  assert.equal(calls.length, 1, "never fires a second time");
}

// Saves with the v2.28.31 seen ids never replay a cutscene, even if module/death data differs.
{
  const seed = boot(null, []); const st = seed.T.state();
  st.bitCardsSeen = { core_restored:true, first_death:true };
  const calls = []; const w = boot(JSON.parse(JSON.stringify(st)), calls);
  w.T.maybeShowFirstDeathCard({ok:true,raid:{outcome:"death"}});
  assert.deepEqual(calls, [], "already-seen card id suppresses the new cutscene");
  assert.equal(w.T.state().bitCardsSeen.core_restored, true);
  w.close(); seed.close();
}

// PRB-155 (playtest 2026-11-15, item 4): the Core restore never shows the removed POWER RESTORED
// popup -- not on a fresh build, not for an existing save, and not after the cutscene has played.
{
  const calls = [];
  const w = await bootToCoreOneTapAway(calls);
  w.A.build("rebirth_core");
  assert(!w.document.getElementById("overlay"), "first restore: no popup");
  await sleep(1700);
  assert(!w.document.getElementById("overlay"), "after the cutscene has fired: still no popup");
  // A later re-render of the base (any screen change) must never resurrect it either.
  w.A.go("base");
  assert(!w.document.getElementById("overlay"), "re-rendering the base after the cutscene: still no popup");
}
{
  const seed = boot(null, []); const st = seed.T.state();
  st.modules.rebirth_core = 1; st.baseState = "core_habitable"; st.introSeen = true;
  const saved = JSON.parse(JSON.stringify(st));
  const w = boot(saved, []);
  w.A.go("base");
  assert(!w.document.getElementById("overlay"), "existing save with Core already built: no popup on load or render");
}

// fabricator_built: the live transition plays a cutscene exactly once, persisted, and only after
// the Fabricator L1 reward popup (unchanged, unlike the Core restore) closes -- it never stacks.
// The dedicated future art pair (FABRICATOR_CUTSCENE_ART) genuinely does not exist in this repo
// yet, so stub window.Image to fail fast like a real 404 instead of hanging (jsdom never fires
// onload/onerror for real network loads without `resources:"usable"`).
{
  const calls = [];
  const w = await bootToCoreOneTapAway(calls);
  w.Image = class { set src(_src){ setTimeout(() => { if(this.onerror) this.onerror(); }, 0); } };
  w.A.build("rebirth_core");
  const st = w.T.state();
  // PRB-162: fund the Fabricator's own cost (consumed by payCost before the cutscene fires) AND,
  // independently, the Vest recipe's cost left over afterward, so this general fabricator_built
  // test exercises the non-shortage info strip -- the shortage variant has its own tests below.
  st.stash.cable = 1; st.stash.scrap_alloy = 3; st.stash.polymer_plate = 2; st.cur.scrap = 25;
  assert.equal(st.bitCardsSeen.fabricator_built, undefined, "not marked seen before the build");
  const fabCalls = () => calls.filter(c => c.id === "fabricator_built");
  w.A.build("fabricator");
  const closeBtn = w.document.querySelector("#overlay [data-close]");
  assert(closeBtn, "Fabricator L1 still shows its normal reward popup (only the Core restore lost its popup)");
  assert.equal(fabCalls().length, 0, "fabricator_built cutscene waits for the reward popup to close");
  closeBtn.dispatchEvent(new w.Event("click", { bubbles: true }));
  assert.equal(st.bitCardsSeen.fabricator_built, true, "persisted synchronously when the popup closes");
  assert.equal(fabCalls().length, 1, "PRB-160: Fabricator cutscene plays synchronously when reward closes");
  assert.equal(fabCalls().length, 1, "fabricator_built cutscene shown exactly once");
  assert.match(fabCalls()[0].line, /Scavenger Vest/);
  assert(fabCalls()[0].info.some(row => row.label === "FIRST RECIPE" && /Scavenger Vest/.test(row.text)), "info strip names the real first recipe + cost from data/recipes.js");
  assert(fabCalls()[0].bust, "fabricator_built uses the standard bust+bubble layout");
  st.stash.cable = 1; st.stash.scrap_alloy = 2; st.cur.scrap = 10; // Fabricator L2 cost happens to differ; fund generously
  w.A.build("fabricator"); // repeat call (L2): never replays the L1 moment
  await sleep(1700);
  assert.equal(fabCalls().length, 1, "never fires a second time");
}

// PRB-160: replacing a story popup preserves its beat, without replaying general callbacks.
for(const replace of ["navigation", "profiles"]){
  const calls=[],w=await bootToCoreOneTapAway(calls);w.A.build("rebirth_core");
  const st=w.T.state();st.stash.cable=1;st.stash.scrap_alloy=2;st.cur.scrap=10;
  w.A.build("fabricator");
  const reward=w.document.querySelector('#overlay');
  if(replace==="profiles"){
    w.A.openProfiles();
    assert(w.document.querySelector('#overlay.profilesov'),"replacement Profiles stays open");
  }else w.T.closeAllPopups();
  assert.equal(calls.filter(c=>c.id==="fabricator_built").length,1,"Fabricator survives "+replace);
  reward.querySelector('[data-close]').click();
  assert.equal(calls.filter(c=>c.id==="fabricator_built").length,1,"stale close cannot replay story");
  // The summary's normal close callback does other work; cancellation preserves only the story.
  const ingest={ok:true,raid:{outcome:"death",extracted:[],lost:[]},summary:"Returned",reaction:""};
  // Build a real summary from the standard raid result so its rows use the production shape.
  ingest.raid={...ingest.raid,area:"bunker",levelsCleared:1,enemiesDefeated:0,nodesLit:0,remainingMs:0};
  w.T.closeAllPopups();w.T.showHomecomingSummary(ingest);
  if(replace==="profiles")w.A.openProfiles();else w.T.closeAllPopups();
  assert.equal(calls.filter(c=>c.id==="first_death").length,1,"first death survives "+replace);
  w.close();
}

// fabricator_built: an existing save that already has Fabricator L1 built is marked seen on load
// (retroactive migration) and never shown live just from loading.
{
  const seedWin = boot(null, []);
  const st = seedWin.T.state();
  st.modules.fabricator = 1;
  delete st.bitCardsSeen;
  const saved = JSON.parse(JSON.stringify(st));
  const calls = [];
  const w = boot(saved, calls);
  assert.equal(w.T.state().bitCardsSeen.fabricator_built, true, "existing save with Fabricator already built is marked seen on load");
  assert.equal(calls.length, 0, "loading a save never fires the cutscene by itself");
}

// Shared setup for PRB-162 moments 3/4: Core built, then raid_1 extracted (ftueOver() true), then
// the Fabricator built -- the exact live sequence where quest_intro and vault_intro both open up.
async function bootPastFabricator(calls){
  const w = await bootToCoreOneTapAway(calls);
  w.A.build("rebirth_core");
  w.T.ingestRaidResult({ schema:"protocol-rebirth/raid-result", version:1, raidId:"raid-1-extract", seed:"s2",
    outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["cable","cable","scrap_alloy"], lost:[], endedAt:Date.now(), kitLeft:{medkit:1} });
  const st = w.T.state();
  st.stash.cable = 1; st.stash.scrap_alloy = 2; st.cur.scrap = 10;
  w.A.build("fabricator");
  w.document.querySelector("#overlay [data-close]").dispatchEvent(new w.Event("click", { bubbles:true }));
  return w;
}

// quest_intro: queues right behind fabricator_built (ftueOver() + Fabricator built both land on
// the same build), and the tracked-quest chip must not render before it has played.
{
  const calls = [];
  const w = await bootPastFabricator(calls);
  assert.equal(calls.filter(c => c.id === "fabricator_built").length, 1);
  const questCalls = calls.filter(c => c.id === "quest_intro");
  assert.equal(questCalls.length, 1, "quest_intro fires the instant the chain opens up");
  assert.equal(calls.findIndex(c => c.id === "quest_intro") > calls.findIndex(c => c.id === "fabricator_built"), true, "queued after fabricator_built, never on top of it");
  assert.match(questCalls[0].line, /little jobs/);
  assert(questCalls[0].info.some(r => r.label === "TRACKING"), "names the real first quest from data/quests.js");
  assert.equal(w.T.state().bitCardsSeen.quest_intro, false, "queued intro does not reveal chip");
  assert.equal(w.T.trackedGoalHtml(), "");
  questCalls[0].onDone();
  assert.equal(w.T.state().bitCardsSeen.quest_intro, true);
  assert(w.document.querySelector('.qgoal'), "chip appears in DOM immediately after dismissal");
  // trackedGoalHtml is the chip itself -- confirm it only starts rendering once the flag is set.
  const st = w.T.state();
  st.bitCardsSeen.quest_intro = false;
  assert.equal(w.T.trackedGoalHtml(), "", "chip stays hidden if quest_intro is ever unset");
  st.bitCardsSeen.quest_intro = true;
  assert.notEqual(w.T.trackedGoalHtml(), "", "chip renders once quest_intro has played and a quest is tracked");
}

// vault_intro: queues behind quest_intro (progressionGoal() names Storage next, room order after
// Fabricator), before the Vault is ever built or buildable.
{
  const calls = [];
  const w = await bootPastFabricator(calls);
  const vaultCalls = calls.filter(c => c.id === "vault_intro");
  assert.equal(vaultCalls.length, 1, "vault_intro fires the instant the Vault becomes the next goal");
  assert.equal(calls.findIndex(c => c.id === "vault_intro") > calls.findIndex(c => c.id === "quest_intro"), true, "queued after quest_intro");
  assert.match(vaultCalls[0].line, /Vault/);
  assert(vaultCalls[0].info.some(r => r.label === "NEW" && r.text === w.T.MODS.storage.levels[0].benefitText), "names the real Storage/Vault benefit from data/modules.js");
  assert(vaultCalls[0].info.some(r => r.label === "NEXT" && /Vault/.test(r.text)), "names the Vault's own build cost");
  assert.equal(w.T.state().bitCardsSeen.vault_intro, false, "queued Vault intro is not completed");
  const st=w.T.state();st.stash.polymer_plate=2;st.stash.scrap_alloy=2;st.cur.scrap=50;
  w.A.build("storage");
  assert.equal(st.modules.storage,0,"cannot build or spend before the Vault explanation");
  assert.equal(st.cur.scrap,50);
  vaultCalls[0].onDone();
  assert.equal(st.bitCardsSeen.vault_intro,true);
  w.A.build("storage");assert.equal(st.modules.storage,1,"build works after intro");
}

// vault_intro: fires once, even across repeated base visits once the Vault is the named goal.
{
  const calls = [];
  const w = await bootPastFabricator(calls);
  w.A.go("base"); w.A.go("base");
  assert.equal(calls.filter(c => c.id === "vault_intro").length, 1, "never replays");
}

// vault_intro: an existing save that already built Storage is marked seen on load (retroactive
// migration) -- the window to explain it before it was used already closed.
{
  const seedWin = boot(null, []);
  const st = seedWin.T.state();
  st.modules.storage = 1;
  delete st.bitCardsSeen;
  const saved = JSON.parse(JSON.stringify(st));
  const calls = [];
  const w = boot(saved, calls);
  assert.equal(w.T.state().bitCardsSeen.vault_intro, true, "existing save with Storage already built is marked seen on load");
  assert.equal(calls.length, 0, "loading a save never fires a cutscene by itself");
}

// PRB-162: an interrupted queued intro remains explicitly unseen across migration/reload.
{
  const calls=[],w=await bootPastFabricator(calls);
  const saved=JSON.parse(JSON.stringify(w.T.state()));
  assert.equal(saved.bitCardsSeen.quest_intro,false);
  assert.equal(saved.bitCardsSeen.vault_intro,false);
  const replay=[],loaded=boot(saved,replay);
  assert.equal(loaded.T.state().bitCardsSeen.quest_intro,false);
  assert.equal(loaded.T.state().bitCardsSeen.vault_intro,false);
  loaded.A.go('base');loaded.A.go('base');
  assert.equal(replay.filter(b=>b.id==='quest_intro').length,1,'pending scene deduplicated');
  assert.equal(replay.filter(b=>b.id==='vault_intro').length,1);
  assert.equal(loaded.T.trackedGoalHtml(),'');
  loaded.close();w.close();
}

// Scavenger Vest shortage (PRB-162 moment 2): fabricator_built's line/info acknowledge missing
// materials, read live from the stash, and stop once the recipe is actually affordable.
{
  const calls = [];
  const w = await bootToCoreOneTapAway(calls);
  w.A.build("rebirth_core");
  const st = w.T.state();
  st.stash.cable = 1; st.stash.scrap_alloy = 2; st.cur.scrap = 10; // enough for the Fabricator, nothing left for the Vest (0 Polymer Plate)
  w.A.build("fabricator");
  w.document.querySelector("#overlay [data-close]").dispatchEvent(new w.Event("click", { bubbles:true }));
  const built = calls.find(c => c.id === "fabricator_built");
  assert.match(built.line, /short/, "BIT's offer line acknowledges the shortage");
  assert.match(built.line, /polymer_plate|Polymer Plate/i);
  const missing = built.info.find(r => r.label === "HAVE/NEED");
  assert(missing, "FIRST RECIPE is swapped for a MISSING row when short");
  assert(!built.info.some(r => r.label === "FIRST RECIPE"), "never both rows at once");
  assert.match(missing.text, /Polymer Plate 0\/2/);
  assert.match(missing.text, /Scrap Alloy 0\/1/);
  assert.match(missing.text, /Scrap 0\/15/);
  assert.match(missing.text, /Bunker 1 caches/);
  assert.match(w.T.fabCraftHtml(), /0\/2 Polymer Plate/);
  assert.match(w.T.fabCraftHtml(), /Loot crates/);
  assert.match(w.T.craftConfirmHtml('armor_patch'), /0\/2/);
  assert.match(w.T.craftConfirmHtml('armor_patch'), /Bunker 1 caches/);
  const need = w.T.vestGuaranteeNeed();
  assert(need.some(n=>n.id==='polymer_plate'&&n.count===2));
  assert(need.some(n=>n.id==='scrap_alloy'&&n.count===1));
  assert(need.some(n=>n.id==='salvage_crate'&&n.count===1));
  st.stash.polymer_plate=2;st.stash.scrap_alloy=1;st.cur.scrap=15;
  assert.equal(w.T.vestGuaranteeNeed(),null);
}
{
  // Fully stocked: the offer line/info stay the plain, non-shortage version.
  const calls = [];
  const w = await bootToCoreOneTapAway(calls);
  w.A.build("rebirth_core");
  const st = w.T.state();
  st.stash.cable = 1; st.stash.scrap_alloy = 4; st.stash.polymer_plate = 2; st.cur.scrap = 30;
  w.A.build("fabricator");
  w.document.querySelector("#overlay [data-close]").dispatchEvent(new w.Event("click", { bubbles:true }));
  const built = calls.find(c => c.id === "fabricator_built");
  assert(!/short/.test(built.line), "no shortage clause when the Vest recipe is already affordable");
  assert(built.info.some(r => r.label === "FIRST RECIPE"), "FIRST RECIPE row stays when nothing is missing");
}

// PRB-157: early warming shares the renderer cache; slow art never blocks beat selection.
for(const mode of ["success", "error", "stall"]){
  const requests = [], w = boot(null, [], mode, requests);
  assert.equal(requests.filter(src => /fabricator-powered/.test(src)).length, 1, "pair warms at startup");
  await Promise.resolve(); await Promise.resolve();
  const resolveBeat = () => new Promise(resolve => w.T.fabricatorCutsceneBeat(resolve));
  const [a, b] = await Promise.all([resolveBeat(), resolveBeat()]);
  assert.deepEqual(a, b, "both callers receive the same beat: " + mode);
  assert.equal(a.effect, mode === "error" ? "fabricator" : null);
  assert.match(a.from, mode === "error" ? /core-restore-end/ : /fabricator-dark/);
  if(mode !== "error"){
    assert.match(a.to, /fabricator-powered/);
    assert.equal(a.waitForArt, true, "dedicated art paints without waiting for the probe");
  }
  await resolveBeat();
  assert.equal(requests.filter(src => /fabricator-powered/.test(src)).length, 1, "no repeated probes");
  w.close();
}

// Existing saves from the prior narrator release already have bitCardsSeen. Fabricator must
// migrate independently, preserving the earlier moments' flags and never replaying on load.
// PRB-162: raid_briefing/quest_intro back-fill alongside fabricator_built (same fabricator>=1
// signal: the window for all three already closed for a save this far along).
{
  const w = boot(null, []);
  const st = w.T.freshState();
  st.modules.fabricator = 1; st.bitCardsSeen = { core_restored:true, first_death:false };
  w.T.migrateBitCardsSeen(st); w.T.migrateBitCardsSeen(st);
  assert.deepEqual(JSON.parse(JSON.stringify(st.bitCardsSeen)), {core_restored:true,first_death:false,fabricator_built:true,raid_briefing:true,quest_intro:true});
  // Verify each displayed cost against data, including quantities and Scrap (not just the name).
  const beats = w.T.BIT_CUTSCENES, fab = w.T.MODS.fabricator.levels[0].cost;
  const next = beats.core_restored.info.find(r => r.label === "NEXT").text;
  for(const [id, qty] of Object.entries(fab.items)) assert(next.includes(qty + "× " + w.T.ITEMS[id].name));
  assert(next.includes(fab.scrap + "× Scrap"));
  assert.equal(beats.core_restored.info[0].text, w.T.MODS.rebirth_core.benefit);
  const recipe = w.T.D.recipes.find(r => r.output.itemId === "scavenger_vest");
  const first = beats.fabricator_built.info.find(r => r.label === "FIRST RECIPE").text;
  for(const [id, qty] of Object.entries(recipe.inputs)) assert(first.includes(qty + "× " + w.T.ITEMS[id].name));
  assert(first.includes(recipe.scrapCost + "× Scrap"));
  assert(beats.core_restored.line.length <= 90); assert(beats.fabricator_built.line.length <= 110);
  w.close();
}

console.log("BIT CARD BASE MOMENTS TEST PASSED");
})();
