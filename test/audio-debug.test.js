// PRB-159: hidden audio debug overlay for Robert to screenshot from his iPhone. Triple-tap the
// version label within ~800ms toggles it; it must cost nothing while closed beyond the single
// document-level tap-counting listener (no overlay DOM, no timer, no polling).
const assert = require("assert");
const fs = require("fs");
const path = __dirname + "/..";
const { JSDOM } = require("jsdom");

function boot(html){
  const dom = new JSDOM(html || '<div id="app-version">v2.28.38</div><div class="menu-ver">Protocol Rebirth <span id="menu-version">v2.28.38</span></div>', { runScripts: "outside-only", url: "http://game/" });
  const w = dom.window;
  let intervalCalls = 0, clearCalls = 0;
  const realSetInterval = w.setInterval.bind(w), realClearInterval = w.clearInterval.bind(w);
  w.setInterval = (...args) => { intervalCalls++; return realSetInterval(...args); };
  w.clearInterval = (...args) => { clearCalls++; return realClearInterval(...args); };
  w.eval(fs.readFileSync(path + "/ui/audio-debug.js", "utf8"));
  return { dom, w, doc: w.document, counts: () => ({ intervalCalls, clearCalls }) };
}

function tripleTap(w, selector){
  const el = w.document.querySelector(selector);
  for(let i = 0; i < 3; i++) el.dispatchEvent(new w.Event("click", { bubbles: true }));
}

// 1) Triple-tapping #app-version within the window opens the overlay; tapping it again (also a
// triple-tap, since each call dispatches 3 clicks) closes it. No overlay DOM exists until the
// first open, and no interval runs until then either.
{
  const { w, doc, counts } = boot();
  assert.equal(doc.querySelector(".audio-debug-ov"), null, "no overlay DOM before any tap");
  assert.equal(counts().intervalCalls, 0, "no refresh timer before the overlay opens");
  tripleTap(w, "#app-version");
  assert.equal(w.PRAudioDebug.isOpen(), true, "triple-tap on #app-version opens the overlay");
  assert.equal(counts().intervalCalls, 1, "opening starts exactly one refresh timer");
  tripleTap(w, "#app-version");
  assert.equal(w.PRAudioDebug.isOpen(), false, "a second triple-tap closes it again");
  assert.equal(counts().clearCalls, 1, "closing clears the refresh timer");
  dom_close(w);
}
function dom_close(w){ w.PRAudioDebug.close(); }

// 2) #menu-version is an equally valid trigger (delegated listener, not one bound per element).
{
  const { w } = boot();
  tripleTap(w, "#menu-version");
  assert.equal(w.PRAudioDebug.isOpen(), true, "#menu-version also triple-tap-opens the overlay");
  w.PRAudioDebug.close();
}

// 3) The raid page's #core-version (inside the settings dialog) works too, even though the
// overlay script itself has no idea the dialog exists -- delegation needs no per-page wiring.
{
  const { w } = boot('<span class="version" id="core-version">v2.28.38</span>');
  tripleTap(w, "#core-version");
  assert.equal(w.PRAudioDebug.isOpen(), true, "#core-version triple-tap-opens the overlay on the raid page too");
  w.PRAudioDebug.close();
}

// 4) Taps spread out beyond the ~800ms window never accumulate into a toggle.
{
  const { w } = boot();
  let t = 0;
  const realNow = w.Date.now;
  w.Date.now = () => t;
  try{
    const el = w.document.querySelector("#app-version");
    el.dispatchEvent(new w.Event("click", { bubbles: true })); t += 500;
    el.dispatchEvent(new w.Event("click", { bubbles: true })); t += 500; // >800ms since the first tap
    el.dispatchEvent(new w.Event("click", { bubbles: true }));
    assert.equal(w.PRAudioDebug.isOpen(), false, "three taps spread past the window never open it");
  } finally { w.Date.now = realNow; }
}

// 5) Stats contents: every field the task asks for shows up once PR_AUDIO is present.
{
  const { w, doc } = boot();
  w.PR_AUDIO = {
    debugStats: () => ({
      contextState: "suspended", sampleRate: 44100, baseLatency: 0.0125,
      unlocked: false, wasUnlocked: true, format: "m4a",
      decoded: 3, total: 56, pending: ["sfx/ui-tap"],
      failed: [{ file: "sfx/alarm", error: "ogg-decode-stalled" }],
      drops: [{ name: "ui-confirm", reason: "hidden" }, { name: "nice-shot", reason: "voice-busy" }],
      lastError: "ogg-decode-stalled", visibilityState: "visible", audioSessionType: "ambient",
    }),
  };
  tripleTap(w, "#app-version");
  const html = doc.querySelector(".audio-debug-body").innerHTML;
  for(const needle of ["suspended", "44100 Hz", "0.0125", "false / true", "m4a", "3 / 56",
    "sfx/ui-tap", "sfx/alarm", "ogg-decode-stalled", "visible", "ambient", "ui-confirm: hidden",
    "nice-shot: voice-busy", "v2.28.38"]){
    assert.ok(html.includes(needle), "overlay body missing " + JSON.stringify(needle));
  }
  w.PRAudioDebug.close();
}

// 6) Missing PR_AUDIO (e.g. construction failed entirely) renders a clear message, not a crash.
{
  const { w, doc } = boot();
  tripleTap(w, "#app-version");
  assert.match(doc.querySelector(".audio-debug-body").innerHTML, /not present/);
  w.PRAudioDebug.close();
}

// 7) Tapping the overlay itself closes it; tapping its action buttons does not, and routes to the
// right PR_AUDIO call (synthesized test beep vs. a real decoded SFX, to tell synth failures from
// decode failures).
{
  const { w, doc } = boot();
  const calls = [];
  w.PR_AUDIO = {
    debugStats: () => ({ contextState: "running", sampleRate: 44100, baseLatency: 0, unlocked: true,
      wasUnlocked: true, format: "m4a", decoded: 1, total: 1, pending: [], failed: [], drops: [],
      lastError: null, visibilityState: "visible", audioSessionType: "ambient" }),
    init: () => { calls.push("init"); return true; },
    context: { createOscillator: () => ({ frequency: { value: 0 }, connect(){}, start(){}, stop(){} }), createGain: () => ({ gain: { value: 0 }, connect(){} }), currentTime: 0 },
    buses: { sfx: {} },
    play: name => { calls.push(["play", name]); },
  };
  tripleTap(w, "#app-version");
  doc.querySelector(".audio-debug-beep").dispatchEvent(new w.Event("click", { bubbles: true }));
  assert.equal(w.PRAudioDebug.isOpen(), true, "the beep button does not close the overlay");
  assert.ok(calls.includes("init"), "Test beep synthesizes through PR_AUDIO.init()/context, not a decoded file");
  doc.querySelector(".audio-debug-sfx").dispatchEvent(new w.Event("click", { bubbles: true }));
  assert.equal(w.PRAudioDebug.isOpen(), true, "the Play SFX button does not close the overlay");
  assert.deepEqual(calls.filter(c => Array.isArray(c)), [["play", "ui-confirm"]], "Play SFX plays the decoded ui-confirm cue");
  doc.querySelector(".audio-debug-ov").dispatchEvent(new w.Event("click", { bubbles: true }));
  assert.equal(w.PRAudioDebug.isOpen(), false, "tapping the overlay body (not a button) closes it");
}

console.log("audio debug overlay tests PASSED");
