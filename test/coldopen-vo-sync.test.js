// PRB-161 (v2.28.40). Robert's iPhone, v2.28.39: "I see no version number. But now the VO played
// after I'd been clicking on the screen for a while. It should play when the text shows." The
// splash's gesture-free auto-advance (Low quality/no WebGL2/a failed flight) skipped straight to
// the cold open with no tap, so unlockSync() never ran and 'youre-back' only played on whatever
// later gesture happened to unlock audio. This file covers the full fix:
//  - a first launch never auto-advances from the splash without a tap (flightActive false/true);
//  - the start tap calls unlockSync synchronously;
//  - the first intro line waits (capped at 1.5s) for youre-back to be decoded + the context
//    running, then starts together with the VO (same animationstart -> greet() hook as before);
//  - past the cap the text starts anyway and the VO still joins once ready, but never after ENTER;
//  - a triple-tap on the version label never starts/skips anything and opens the debug overlay.
// Uses jsdom plus the FakeIOSAudioContext pattern from test/ios-audio.test.js (async state lag,
// gesture-gated resume(), async decodeAudioData) -- see docs/design-audio-oct28.md.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.join(__dirname, "..");
const appSrc = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

// Static check (jsdom cannot run real CSS animations -- see the Puppeteer shot harness for the
// behavioral proof): a CSS animation's fill-mode:forwards only locks in the value each property
// had at ITS OWN last keyframe. introBtn set pointer-events:auto at 60% but not 100%, so once the
// 0.5s fade actually finished, the button silently went back to pointer-events:none even though
// it read as fully opaque -- caught via the coldopen-enter-844x390.png screenshot.
{
  const start = html.indexOf("@keyframes introBtn{");
  const rule = html.slice(start, html.indexOf("\n", start));
  assert.match(rule, /100%\{[^}]*pointer-events:auto/, "introBtn's 100% keyframe must set pointer-events:auto explicitly, or fill-mode:forwards reverts it to none once the fade finishes");
}

// ---------------------------------------------------------------------------
// FakeIOSAudioContext (trimmed from test/ios-audio.test.js): resume() resolves only inside a
// gesture (ctx.gestureOpen) and the state flip to 'running' lands ~120ms later via a real timer,
// never synchronously -- the exact lag that hid the VO-after-a-later-gesture bug in every test
// whose fake context flips state synchronously.
class Param{ constructor(){ this.value = 0; } cancelScheduledValues(){} setValueAtTime(v){ this.value = v; } linearRampToValueAtTime(v){ this.value = v; } setTargetAtTime(v){ this.value = v; } }
class Gain{ constructor(){ this.gain = new Param(); } connect(node){ this.destination = node; } disconnect(){} }
class Source{ constructor(){ this.playbackRate = { value: 1 }; } connect(node){ this.destination = node; } disconnect(){} start(){ this.started = true; } stop(){ this.stopped = true; this.onended?.(); } }
class FakeIOSAudioContext{
  constructor(){
    this.state = "suspended"; this.currentTime = 0; this.sampleRate = 44100; this.destination = {};
    this.sources = []; this.gestureOpen = false; this.decodeBroken = false; this.onstatechange = null; this.neverRuns = false;
  }
  createBuffer(channels, length, sampleRate){ const data = new Float32Array(length); return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data }; }
  createGain(){ return new Gain(); }
  createBufferSource(){ const s = new Source(); this.sources.push(s); return s; }
  createDynamicsCompressor(){ return { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param(), connect(node){ this.destination = node; } }; }
  resume(){
    if(this.neverRuns) return new Promise(() => {}); // a context that is never granted (muted/blocked) -- never resolves, never flips
    if(this.state === "running") return Promise.resolve();
    if(this.resuming) return this.resuming;
    if(this.state === "suspended" && !this.gestureOpen) return Promise.reject(new Error("resume() outside a trusted gesture does nothing on iOS"));
    this.resuming = new Promise(resolve => {
      setTimeout(() => {
        this.resuming = null;
        if(this.state !== "closed"){ this.state = "running"; this.onstatechange?.(); }
        resolve();
      }, 120);
    });
    return this.resuming;
  }
  decodeAudioData(){
    return new Promise((resolve, reject) => {
      setTimeout(() => { if(this.decodeBroken) reject(new Error("decode stalled")); else resolve({ duration: 1 }); }, 20);
    });
  }
  suspend(){ this.state = "suspended"; this.onstatechange?.(); return Promise.resolve(); }
}

// ---------------------------------------------------------------------------
// Part A: splash auto-advance, exercised with the same extracted-setupSplash pattern as
// test/splash.test.js (a fake clock so "even after a long wait" doesn't cost real time).
const setupSplashSrc = appSrc.slice(appSrc.indexOf("function setupSplash("), appSrc.indexOf("/* ---------- init ---------- */"));

function bootSplash({introSeen = false, flightPending = false, ftueDirect = false} = {}){
  const dom = new JSDOM(html, { url: "https://game.example/" });
  const { window } = dom, { document } = window;
  window.matchMedia = () => ({ matches: false });
  let now = 0, id = 0;
  const tasks = new Map(), images = [];
  const later = (fn, delay) => { const key = ++id; tasks.set(key, { fn, at: now + delay }); return key; };
  class Picture{ constructor(){ this.complete = false; images.push(this); } }
  let splashCtl = null;
  new Function(
    "document", "window", "sessionStorage", "S", "D", "bunkerStage", "Image", "setTimeout", "clearTimeout",
    "lockLandscape", "APP_VERSION", "flightPending", "returning", "ftueDirect", "capture",
    setupSplashSrc + ";capture(setupSplash(flightPending, returning, ftueDirect));"
  )(
    document, window, window.sessionStorage, { introSeen }, { baseMap: { plates: [{ art: "x.webp" }] } }, () => 0,
    Picture, later, key => tasks.delete(key), () => {}, "2.28.40", flightPending, false, ftueDirect, ctl => { splashCtl = ctl; }
  );
  const tick = ms => {
    const until = now + ms;
    while(true){
      const next = [...tasks].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if(!next) break;
      now = next[1].at; tasks.delete(next[0]); next[1].fn();
    }
    now = until;
  };
  return { dom, document, window, images, tick, splashCtl: () => splashCtl, splash: () => document.getElementById("splash"), ready: () => images.forEach(i => i.onload?.()) };
}

// 1) A first launch never auto-advances without a tap, whether or not the archipelago flight is
// active -- the old `else if(!flightActive) autoTimer = setTimeout(begin, 1400)` fired regardless
// of whether the cold open was coming up next.
for(const flightPending of [false, true]){
  const t = bootSplash({ introSeen: false, flightPending });
  t.ready(); t.tick(20000);
  assert.ok(t.splash() && !t.splash().classList.contains("descending"), `flightPending=${flightPending}: first launch never auto-advances, even after a long wait`);
  t.dom.window.close();
}

// 1b) A flight that starts active and later fails (flightFailed()) must still not fall back to
// the gesture-free timer for a first launch -- only flightActive toggling from true to false.
{
  const t = bootSplash({ introSeen: false, flightPending: true });
  t.ready(); t.tick(10);
  t.splashCtl().flightFailed();
  t.tick(20000);
  assert.ok(t.splash() && !t.splash().classList.contains("descending"), "first launch: a failed flight fallback still waits for the tap");
  t.dom.window.close();
}

// 1c) Control: a returning player (introSeen) and a fresh-profile FTUE-direct launch (no cold
// open coming) both keep the old gesture-free auto-advance -- nothing on either path needs audio
// unlocked by a tap, so this must not regress.
{
  const t = bootSplash({ introSeen: true, flightPending: false });
  t.ready(); t.tick(1400);
  assert.ok(t.splash().classList.contains("descending"), "returning player still auto-advances");
  t.dom.window.close();
}
{
  const t = bootSplash({ introSeen: false, flightPending: false, ftueDirect: true });
  t.ready(); t.tick(1400);
  assert.ok(t.splash().classList.contains("descending"), "ftueDirect still auto-advances");
  t.dom.window.close();
}
console.log("part A (splash auto-advance) PASSED");

// ---------------------------------------------------------------------------
// Part B: full app.js boot (cold open next: !S.introSeen && !ftueDirect) with a real AudioManager
// driven by FakeIOSAudioContext, covering the start-tap unlock and the VO/text sync.
//
// A truly brand-new profile takes the FTUE-direct path straight into the tutorial raid (no splash
// wait, no cold open) -- "You're... back?" only plays once that player returns from it. So the
// scenario this bug actually hits (splash shown, then the cold open, as in Robert's screenshot)
// needs a profile that's already past the FTUE raid (or a legacy save predating it): raids > 0,
// introSeen still false. SAVE_KEY/the save shape mirror app.js's own freshState(); seeded via one
// throwaway boot so this never drifts from whatever fields app.js actually expects.
const DATA_FILES = ["data/items.js", "data/modules.js", "data/bit.js", "data/bit-talents.js", "data/raid_zones.js",
  "data/recipes.js", "data/vendors.js", "data/retention.js", "data/progression.js", "data/combat.js", "data/audio.js"];
const SAVE_KEY = "pr_meta_save";

function bootApp(ctxOverrides, seedSave){
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://game.example/index.html", pretendToBeVisual: true });
  const w = dom.window, doc = w.document;
  if(seedSave) w.localStorage.setItem(SAVE_KEY, JSON.stringify(seedSave));
  // jsdom never actually loads <img>/<audio> resources -- fire onload on the next tick so the
  // splash's art-preload counters resolve the way a real (fast, cached) image load would.
  class FakeImage{ set src(v){ this._src = v; setTimeout(() => { this.onload && this.onload(); }, 0); } get src(){ return this._src || ""; } get complete(){ return false; } }
  w.Image = FakeImage;
  const ctx = Object.assign(new FakeIOSAudioContext(), ctxOverrides || {});
  w.AudioContext = function(){ return ctx; };
  w.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) });
  for(const f of [...DATA_FILES, "ui/audio.js", "ui/audio-debug.js"]) w.eval(fs.readFileSync(path.join(root, f), "utf8"));
  w.eval(appSrc);
  return { dom, w, doc, ctx };
}

// load()'s migration chain only recognizes st.v 6..SAVE_VERSION(15); a v older than all of those
// migrations falls through every branch (no match, no return) and load() ends up calling the
// same freshState() a truly fresh profile gets (introSeen:false, raids:0) -- but since a raw save
// already exists in storage, load() never calls initFtueMetrics(), so FTUE_KEY stays unset,
// ftueTracked is false, and ftueDirect is false regardless of raids. That's enough to land on the
// splash-then-cold-open path this bug actually hits, without hand-rolling freshState()'s shape.
function seedPastFtue(){ return { v: 1 }; }

// Taps #splash (unlockSync must run synchronously inside the click handler) and instantly
// finishes the splash's exit animation (like test/splash.test.js does) instead of waiting out the
// real 1.5s CSS fallback timer.
function tapSplash(w, doc, ctx){
  ctx.gestureOpen = true;
  const sync = [];
  const original = w.PR_AUDIO.unlockSync.bind(w.PR_AUDIO);
  w.PR_AUDIO.unlockSync = (...a) => { sync.push(true); return original(...a); };
  doc.getElementById("splash").dispatchEvent(new w.Event("click", { bubbles: true }));
  ctx.gestureOpen = false;
  const ev = new w.Event("animationend"); Object.defineProperty(ev, "animationName", { value: "splashBlackout" });
  doc.getElementById("splash")?.dispatchEvent(ev);
  return sync.length > 0;
}

(async function(){
  const seed = seedPastFtue();

  // 2) The start tap calls unlockSync synchronously, and the first intro line is held (paused,
  // vo-wait) rather than starting immediately, since BIT's greeting isn't decoded+running yet.
  {
    const { w, doc, ctx } = bootApp(null, seed);
    await sleep(150); // let the splash's art + PR_AUDIO.preload() settle so prompt-ready fires
    assert.ok(doc.getElementById("splash")?.classList.contains("prompt-ready"), "splash reaches prompt-ready");
    const intro = doc.querySelector(".intro");
    assert.ok(intro, "the cold open is already mounted underneath the splash");
    assert.ok(intro.classList.contains("vo-wait"), "line reveal starts held, pending the VO gate");
    const calledSync = tapSplash(w, doc, ctx);
    assert.equal(calledSync, true, "the start tap calls PR_AUDIO.unlockSync() synchronously");
    assert.equal(doc.getElementById("splash"), null, "the splash is gone once its exit finishes");
    // bit/youre-back was already decoding since the splash's own preload(); the context itself is
    // still 'suspended' at this exact synchronous instant (resume()'s 120ms lag hasn't landed).
    assert.equal(ctx.state, "suspended", "context is still suspended right after the synchronous tap");
    assert.ok(intro.classList.contains("vo-wait"), "the line reveal is still held immediately after the tap (not yet running)");
    assert.equal(w.PR_AUDIO.lastVoice.has("youre-back"), false, "no voice has played yet");

    // Once the context actually flips to 'running' (well inside the 1.5s cap -- bit/youre-back's
    // decode finished long ago, during the splash), the gate clears.
    await sleep(200);
    assert.equal(ctx.state, "running", "context is running within the cap");
    assert.equal(intro.classList.contains("vo-wait"), false, "the line reveal gate clears once the VO is decoded + running");

    // In a real browser the paused CSS delay resumes counting from zero and fires
    // animationstart once it elapses -- jsdom does not simulate CSS animation timing, so this
    // dispatches that event directly to stand in for "the first line's reveal" and checks that
    // greet()'s requestVoice() call lands in the very same tick (the existing animationstart ->
    // greet() hook, unchanged).
    const firstLine = intro.querySelector(".intro-lines p");
    firstLine.dispatchEvent(new w.Event("animationstart"));
    assert.ok(w.PR_AUDIO.requestedVoices.has("youre-back") || w.PR_AUDIO.lastVoice.has("youre-back"),
      "requestVoice('youre-back') is called within the same tick as the first line's reveal");
    await sleep(10);
    assert.equal(w.PR_AUDIO.lastVoice.has("youre-back"), true, "the greeting actually plays, already unlocked and decoded");
    w.close();
  }
  console.log("part B.1 (start tap + VO/text sync) PASSED");

  // 3) Audio that never unlocks (ctx.neverRuns -- a resume() that never resolves, standing in for
  // a blocked/muted context): the text must still start once the 1.5s cap elapses, and the VO
  // must never surface once ENTER has already dismissed the intro (existing v2.28.3x guards).
  {
    const { w, doc, ctx } = bootApp({ neverRuns: true }, seed);
    await sleep(150);
    const intro = doc.querySelector(".intro");
    tapSplash(w, doc, ctx);
    assert.ok(intro.classList.contains("vo-wait"), "still held well before the cap");
    await sleep(1650);
    assert.equal(intro.classList.contains("vo-wait"), false, "the cap releases the text even though audio never became ready");
    const firstLine = intro.querySelector(".intro-lines p");
    firstLine.dispatchEvent(new w.Event("animationstart"));
    assert.ok(w.PR_AUDIO.pendingVoices.has("youre-back") || w.PR_AUDIO.requestedVoices.has("youre-back"),
      "the VO request still queues, to join once/if audio ever becomes ready");
    // ENTER dismisses the intro -- the queued voice must be cancelled and must never play, even if
    // the context somehow becomes available afterwards.
    w.A.dismissIntro();
    ctx.neverRuns = false; ctx.gestureOpen = true; ctx.state = "suspended";
    await sleep(250);
    assert.equal(w.PR_AUDIO.lastVoice.has("youre-back"), false, "the greeting never plays once ENTER has already dismissed the intro");
    dom_close(w);
  }
  console.log("part B.2 (cap fallback, never-after-ENTER) PASSED");

  // 4) Triple-tapping the version label on the splash never starts the game, and on the cold open
  // never skips it -- it only opens the hidden diagnostics overlay (ui/audio-debug.js).
  {
    const { w, doc, ctx } = bootApp(null, seed);
    await sleep(150);
    for(let i = 0; i < 3; i++) doc.getElementById("app-version").dispatchEvent(new w.Event("click", { bubbles: true }));
    assert.equal(w.PRAudioDebug.isOpen(), true, "triple-tap on the splash opens the debug overlay");
    assert.ok(doc.getElementById("splash") && !doc.getElementById("splash").classList.contains("descending"), "the splash never started from the triple-tap");
    w.PRAudioDebug.close();
    tapSplash(w, doc, ctx);
    await sleep(350);
    assert.equal(w.document.body.dataset.screen, "intro", "now showing the cold open");
    for(let i = 0; i < 3; i++) doc.getElementById("app-version").dispatchEvent(new w.Event("click", { bubbles: true }));
    assert.equal(w.PRAudioDebug.isOpen(), true, "triple-tap on the cold open also opens the debug overlay");
    assert.ok(!doc.querySelector(".intro.done"), "the triple-tap never skipped the intro (A.introSkip's own done marker)");
    assert.equal(w.document.body.dataset.screen, "intro", "still on the cold open, not navigated to base");
    dom_close(w);
  }
  console.log("part B.3 (triple-tap never starts/skips) PASSED");

  console.log("COLD OPEN VO SYNC TEST PASSED");
})().catch(e => { console.error(e); process.exitCode = 1; });

function dom_close(w){ w.close(); }
