// v2.11.0 START SCREEN: PLAY/settings/slot wiring on the splash itself (jsdom, full boot).
// Same fake-timer/fake-image technique as test/splash.test.js, applied to the whole app.js
// (not just the sliced setupSplash() body) so the real init-block wiring -- outside that slice --
// is exercised for real. Run: node test/start-screen.test.js
// v2.28.33: Robert's playtest found both a PLAY button AND "TAP ANYWHERE TO BEGIN" showing at
// once -- two prompts for one action. PLAY is gone; #splash itself (already role=button
// tabindex=0) is the one focusable/tappable target, with a pulsing "TAP ANYWHERE TO BEGIN" as
// the sole visual cue. This file now asserts PLAY is gone, not that it exists.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["items", "modules", "bit", "bit-talents", "raid_zones", "recipes", "vendors", "retention", "quests", "progression", "combat"];
const APP_SRC = fs.readFileSync(path + "/app.js", "utf8");

function boot(audio){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window, document = w.document;
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/data/" + s + ".js", "utf8"));
  w.eval(fs.readFileSync(path + "/save-slots.js", "utf8"));
  w.eval(fs.readFileSync(path + "/start-quality.js", "utf8"));
  w.matchMedia = () => ({ matches:false });
  if(audio) w.PR_AUDIO = audio;

  // Fake timers + image loads (same approach as test/splash.test.js): override the globals
  // setupSplash() calls bare, before app.js's init block runs setupSplash() for real.
  let now = 0, id = 0; const tasks = new Map(), images = [];
  w.setTimeout = (fn, delay) => { const key = ++id; tasks.set(key, { fn, at: now + (delay || 0) }); return key; };
  w.clearTimeout = key => tasks.delete(key);
  w.Image = class { constructor(){ this.complete = false; images.push(this); } };

  w.eval(APP_SRC + ";window.__T={ A:A };");
  const tick = ms => {
    const until = now + ms;
    while(true){
      const next = [...tasks].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if(!next) break;
      now = next[1].at; tasks.delete(next[0]); next[1].fn();
    }
    now = until;
  };
  return { dom, document, A:w.__T.A, tick, ready:() => images.forEach(i => i.onload?.()), splash:() => document.getElementById("splash") };
}

// 1) the splash carries a title, exactly one tap-anywhere prompt (no PLAY button -- removing it
// is the fix for two prompts showing at once) and small settings/slot icons.
{
  const t = boot();
  assert(t.document.querySelector(".splash-title"), "title present");
  assert(!t.document.getElementById("splash-play"), "the PLAY button is gone -- one prompt, not two");
  const prompt = t.document.getElementById("splash-prompt");
  assert(prompt && prompt.classList.contains("splash-prompt"), "the tap-anywhere prompt exists");
  assert.equal(prompt.textContent.trim(), "TAP ANYWHERE TO BEGIN", "prompt keeps its accessible text");
  assert.equal(t.splash().getAttribute("role"), "button", "#splash itself is the one focusable/tappable target");
  assert.equal(t.splash().getAttribute("tabindex"), "0", "#splash stays keyboard-focusable without PLAY");
  assert(t.document.getElementById("splash-settings-btn"), "settings icon present on the splash");
  assert(t.document.getElementById("splash-profiles-btn"), "save-slot icon present on the splash");
  t.dom.window.close();
  const css = fs.readFileSync(path + "/index.html", "utf8");
  assert(/\.splash-prompt\{[^}]*min-width:44px;min-height:44px/.test(css), "the prompt keeps a >=44px hit area");
  assert(/\.splash-prompt\{[^}]*background:transparent/.test(css), "the prompt has no big filled background");
  assert(/@media\(prefers-reduced-motion:reduce\)\{#splash\.prompt-ready \.splash-prompt\{animation:none;?\}\}/.test(css), "the prompt's pulse is disabled under reduced motion");
}

// 2) settings icon opens the settings menu but never starts the descent (stopPropagation)
{
  const t = boot();
  t.document.getElementById("splash-settings-btn").click();
  assert.equal(t.document.getElementById("settings-menu").hidden, false, "settings menu opens from the splash");
  assert(t.splash(), "splash stays up");
  assert(!t.splash().classList.contains("descending"), "settings icon never triggers tap-to-enter");
  t.dom.window.close();
}

// 3) save-slot icon opens the profiles panel but never starts the descent
{
  const t = boot();
  t.document.getElementById("splash-profiles-btn").click();
  const rows = t.document.querySelectorAll(".profrow");
  assert.equal(rows.length, 3, "profiles panel opens with its three slot rows");
  assert(t.splash(), "splash stays up");
  assert(!t.splash().classList.contains("descending"), "slot icon never triggers tap-to-enter");
  t.dom.window.close();
}

// 4) tapping anywhere on the splash (there is no PLAY to route through any more) waits for
// artwork, reveals the pulsing prompt once ready, then descends on the same tap.
{
  const t = boot();
  assert(!t.splash().classList.contains("prompt-ready"), "prompt stays hidden while artwork/audio are still loading");
  t.splash().click();
  t.tick(100);
  assert(!t.splash().classList.contains("descending"), "a tap still waits for artwork before entering");
  t.ready();
  assert(t.splash().classList.contains("prompt-ready"), "the prompt reveals once loading finishes");
  assert(t.splash().classList.contains("descending"), "the same tap's request now starts the descent once ready");
  t.tick(1500);
  assert(!t.splash(), "the splash hands control to the real base/intro screen");
  t.dom.window.close();
}

console.log("start-screen.test: ok (title/one prompt/settings/slot on the splash; tap-anywhere transition; settings/slot never skip it)");

// Audio readiness must gate the prompt independently of image readiness, with a bounded wait.
(async()=>{
  for(const fallback of [false,true]){
    let release;const calls=[];
    const t=boot({preload:()=>new Promise(r=>{release=r;}),unlockSync:()=>calls.push("sync"),unlock:()=>{calls.push("async");return Promise.resolve();},play:name=>calls.push(name)});
    try{
      t.ready();
      assert(!t.splash().classList.contains("prompt-ready"),"images alone cannot expose the prompt");
      if(fallback)t.tick(2500);else{release();await Promise.resolve();await Promise.resolve();}
      assert(t.splash().classList.contains("prompt-ready"),"decode completion or timeout exposes the prompt");
      t.splash().dispatchEvent(new t.dom.window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
      assert.deepEqual(calls,["sync","async"],"keyboard activation unlocks synchronously before async work");
      // jsdom adopts the stub promise across realms; drain the event loop rather than
      // assuming a fixed number of microtasks before the confirmation callback runs.
      await new Promise(resolve=>setImmediate(resolve));
      assert.deepEqual(calls,["sync","async","ui-confirm"],"confirmation waits for asynchronous resume completion");
      assert(t.splash().classList.contains("descending"));
      release();await Promise.resolve();
    }finally{t.dom.window.close();}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
