// v2.11.0 START SCREEN: PLAY/settings/slot wiring on the splash itself (jsdom, full boot).
// Same fake-timer/fake-image technique as test/splash.test.js, applied to the whole app.js
// (not just the sliced setupSplash() body) so PLAY's click handler -- wired in the main init
// block, outside that slice -- is exercised for real. Run: node test/start-screen.test.js
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["items", "modules", "bit", "bit-talents", "raid_zones", "recipes", "vendors", "retention", "quests", "progression", "combat"];
const APP_SRC = fs.readFileSync(path + "/app.js", "utf8");

function boot(){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window, document = w.document;
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/data/" + s + ".js", "utf8"));
  w.eval(fs.readFileSync(path + "/save-slots.js", "utf8"));
  w.eval(fs.readFileSync(path + "/start-quality.js", "utf8"));
  w.matchMedia = () => ({ matches:false });

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

// 1) the splash carries a title, one big PLAY button (shared .playbtn style) and small
// settings/slot icons -- the design's "minimal: title, PLAY, small settings/slot icons".
{
  const t = boot();
  assert(t.document.querySelector(".splash-title"), "title present");
  const play = t.document.getElementById("splash-play");
  assert(play && play.classList.contains("playbtn"), "PLAY button exists and uses the shared primary-action style");
  assert(t.document.getElementById("splash-settings-btn"), "settings icon present on the splash");
  assert(t.document.getElementById("splash-profiles-btn"), "save-slot icon present on the splash");
  t.dom.window.close();
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

// 4) PLAY routes into the exact same tap-anywhere-to-enter flow as splash.test.js already
// proves for a direct tap: waits for artwork, then descends, then hands off to the real screen.
{
  const t = boot();
  t.document.getElementById("splash-play").click();
  t.tick(100);
  assert(!t.splash().classList.contains("descending"), "PLAY still waits for artwork, same as a direct tap");
  t.ready();
  assert(t.splash().classList.contains("descending"), "PLAY starts the descent once ready");
  t.tick(1450);
  assert(!t.splash(), "PLAY hands control to the real base/intro screen");
  t.dom.window.close();
}

console.log("start-screen.test: ok (title/PLAY/settings/slot on the splash; PLAY transition; settings/slot never skip it)");
