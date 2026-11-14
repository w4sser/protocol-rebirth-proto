// PRB-151 BIT narrator card: component API (ui/bit-card.js), queueing/blocking rules, the two
// base moments (core_restored, first_death) firing exactly once and persisting in
// S.bitCardsSeen, and the BIT identity lock (docs/bit-character-spec.md) -- the owner-approved
// cold-open derivative, mood via tilt/hover/brightness only, never hue-rotate.
// Run: node test/bit-card.test.js
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

// show / auto-dismiss (~duration) and the onDone callback
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
  clock.advance(999);
  assert.equal(PRBitCard.isOpen(), true, "still open just before duration elapses");
  clock.advance(2);
  assert.equal(PRBitCard.isOpen(), false, "auto-dismissed once duration elapses");
  assert.equal(done, 1, "onDone fires exactly once");
  assert.equal(el.hidden, true, "element hidden again after dismiss");
}

// long lines extend the auto-dismiss (~40ms/char over 50), capped at 6s
{
  const { clock, PRBitCard } = bootComponent();
  PRBitCard.show({ id: "b", text: "x".repeat(130) }); // default 3000 + (130-50)*40=3200 -> capped 6000
  clock.advance(5999);
  assert.equal(PRBitCard.isOpen(), true, "not dismissed just under the 6s cap");
  clock.advance(2);
  assert.equal(PRBitCard.isOpen(), false, "capped at 6s even for a very long line");
}

// only one card at a time; a second show() while one is open queues and plays after
{
  const { doc, clock, PRBitCard } = bootComponent();
  PRBitCard.show({ id: "first", text: "one", duration: 1000 });
  PRBitCard.show({ id: "second", text: "two", duration: 1000 });
  assert.equal(doc.querySelector(".bit-card-bubble").textContent, "one", "second call queues, does not replace the first");
  clock.advance(1000);
  assert.equal(doc.querySelector(".bit-card-bubble").textContent, "two", "queued card plays once the first is gone");
  assert.equal(PRBitCard.isOpen(), true);
}

// queue caps at 4; further calls beyond that are dropped
{
  const { clock, PRBitCard } = bootComponent();
  let completed = 0;
  for(let i = 0; i < 6; i++) PRBitCard.show({ id: "q" + i, text: "line " + i, duration: 100, onDone: () => completed++ });
  for(let i = 0; i < 6; i++) clock.advance(100);
  assert.equal(completed, 5, "the current card + 4 queued play; the 6th call is dropped");
}

// a duplicate id already current or queued is ignored, not re-queued
{
  const { clock, PRBitCard } = bootComponent();
  let completed = 0;
  PRBitCard.show({ id: "dup", text: "first", duration: 100, onDone: () => completed++ });
  PRBitCard.show({ id: "dup", text: "first-again", duration: 100, onDone: () => completed++ });
  clock.advance(100);
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
  "data/recipes.js", "data/vendors.js", "data/retention.js", "data/quests.js", "data/progression.js", "data/combat.js"];
function boot(seedSave, calls){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  w.localStorage = (() => { let s = {}; return { getItem: k => s[k] ?? null, setItem: (k, v) => s[k] = v, removeItem: k => delete s[k] }; })();
  w.URL.createObjectURL = () => "blob:fake";
  if(seedSave) w.localStorage.setItem("pr_meta_save", JSON.stringify(seedSave));
  w.PR_NAVIGATE = u => { w.launchURL = u; };
  // The real ui/bit-card.js is never eval'd here (runScripts:"outside-only" skips <script src>) --
  // stub it so app.js's window.PRBitCard?.show(...) calls are observable.
  w.PRBitCard = { show: opts => calls.push(opts), dismiss(){}, isOpen(){ return false; } };
  for(const s of FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.eval(fs.readFileSync(path + "/app.js", "utf8") +
    ";window.T={state:()=>S,ingestRaidResult,migrateBitCardsSeen,maybeShowFirstDeathCard,freshState};");
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
  return w;
}

(async () => {

// core_restored: the live transition speaks through PRBitCard (not bitDock), exactly once, persisted.
{
  const calls = [];
  const w = await bootToCoreOneTapAway(calls);
  assert.equal(w.T.state().bitCardsSeen.core_restored, undefined, "not marked seen before the build");
  w.A.build("rebirth_core");
  const closeBtn = w.document.querySelector("#overlay [data-close]");
  assert(closeBtn, "RESTORE EMERGENCY POWER shows the boot payoff overlay");
  closeBtn.dispatchEvent(new w.Event("click", { bubbles: true }));
  await sleep(1700); // >= the ~1.6s bunkerwake lighting the card must not land before
  assert.equal(calls.length, 1, "core_restored card shown exactly once");
  assert.equal(calls[0].id, "core_restored");
  assert.equal(calls[0].mood, "happy");
  assert.match(calls[0].text, /circuits again/);
  assert.equal(w.T.state().bitCardsSeen.core_restored, true, "persisted in S.bitCardsSeen");
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
  assert.equal(calls.length, 1, "death ingest triggers the card");
  assert.equal(calls[0].id, "first_death");
  assert.equal(calls[0].mood, "worried");
  assert.match(calls[0].text, /dragged you back/);
  assert.equal(w.T.state().bitCardsSeen.first_death, true, "persisted once");
  w.T.maybeShowFirstDeathCard(ingestDeath);
  assert.equal(calls.length, 1, "never fires a second time");
}

console.log("BIT CARD BASE MOMENTS TEST PASSED");
})();
