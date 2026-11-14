// v2.28.30 fix/ftue-vo-summary-fullbleed (Robert, 2026-11-14): BIT's 'youre-back' cold-open
// greeting may only ever be heard while the intro (.intro, BIT visible) is on screen. Regression
// for the bug where it replayed on the next unlock gesture -- often ENTER THE FACILITY itself --
// landing on the deferred FTUE homecoming summary where BIT isn't shown, and base-audio's greet()
// compounding it with a second 'welcome-back' line. Also covers the raid-summary overlay's
// full-bleed CSS (docs/bug-lint.md "greeting-vo-only-with-bit-visible").
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];

// A stand-in for ui/audio.js's lock/pending/guard contract -- not the real Web Audio engine, but
// the same shape A.dismissIntro and base-audio.js's greet() actually talk to: requestVoice()
// queues while locked and drops 'youre-back' outright once .intro leaves the document,
// cancelVoice() drops it explicitly, and unlock() replays whatever is still pending.
function makeStubAudio(w){
  let unlocked = false;
  const pending = new Set(), calls = [];
  const stub = {
    get unlocked(){ return unlocked; },
    calls, pending,
    config: { startTheme: null },
    play(){ calls.sfx = calls.sfx || []; return Promise.resolve(true); },
    music(){}, fadeMusic(){ return Promise.resolve(); }, stop(){}, settingsUI(){},
    requestVoice(name){
      if(name === "youre-back" && !w.document.querySelector(".intro")){ pending.delete(name); return false; }
      if(!unlocked){ pending.add(name); return false; }
      pending.delete(name); calls.push(name); return true;
    },
    voice(name){ calls.push(name); return Promise.resolve(true); },
    cancelVoice(name){ pending.delete(name); },
    unlock(){ unlocked = true; for(const name of [...pending]) this.requestVoice(name); return Promise.resolve(true); },
  };
  return stub;
}

function boot(seedSave, seedResult){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/" });
  const w = dom.window;
  w.localStorage = (() => { let s = {}; return { getItem:k=>s[k]??null, setItem:(k,v)=>s[k]=v, removeItem:k=>delete s[k] }; })();
  w.URL.createObjectURL = () => "blob:fake";
  w.PR_NAVIGATE = u => { w.launchURL = u; };
  if(seedSave) w.localStorage.setItem("pr_meta_save", JSON.stringify(seedSave));
  if(seedResult) w.localStorage.setItem("pr_raid_result_v1", JSON.stringify(seedResult));
  w.localStorage.setItem("pr_ftue_v1", JSON.stringify({ step:"done", attempts:1, t:{} }));
  const audio = makeStubAudio(w);
  w.PR_AUDIO = audio;
  for(const s of FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.eval(fs.readFileSync(path + "/ui/base-audio.js", "utf8"));
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + ";window.T={state:()=>S,_getSession:()=>session};");
  return { w, audio };
}

// A fresh profile that already completed its first (FTUE) extract: ingestPendingCoreResult runs
// during boot, defers the summary (session.pendingHomecomingSummary) until the intro is dismissed,
// and renders the intro immediately since S.introSeen is still false -- see app.js ~5679-5687.
function freshFtueSeed(){
  global.window = {};
  for(const f of ["items","modules","bit","bit-talents","raid_zones","recipes","vendors","retention","quests","progression","combat"])
    require(path + "/data/" + f + ".js");
  global.window.DATA = window.DATA;
  const app = require(path + "/app.js");
  const save = app.freshState(); save.introSeen = false;
  const result = { schema:"protocol-rebirth/raid-result", version:1, raidId:"nodspel:vo-fix-seed", seed:"vo-fix-seed",
    ftue:true, outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["scrap_alloy","scrap_alloy"], lost:[], endedAt:1700000000000, kitLeft:{ medkit:1 } };
  delete global.window;
  return { save, result };
}

{
  const { save, result } = freshFtueSeed();
  const { w, audio } = boot(save, result);
  assert(w.document.querySelector(".intro"), "FTUE return renders the cold-open intro, not the summary, first");
  assert(audio.pending.has("youre-back"), "youre-back queues while audio is still locked");
  assert.deepEqual(audio.calls, [], "nothing has played yet -- still locked");

  // Dismiss without ever unlocking (e.g. the player's first tap is ENTER THE FACILITY itself,
  // whose unlock-replay would otherwise fire after dismissIntro has already navigated away).
  w.A.dismissIntro();
  assert(!w.document.querySelector(".intro"), "dismissIntro navigates away from the cold open");
  assert(!audio.pending.has("youre-back"), "dismissIntro cancels the still-pending youre-back voice");
  assert(w.document.querySelector("#overlay.raid-summary-ov"), "the deferred FTUE summary opens right after dismissal");

  // Now unlock + pointerdown on the summary -- the exact sequence the bug report hit.
  audio.unlock();
  w.document.dispatchEvent(new w.Event("pointerdown"));
  assert.deepEqual(audio.calls, [], "youre-back (or any other BIT voice) never plays on the summary");
}

{
  // Unlocking WHILE the intro is still visible (e.g. tap-to-skip) must still play the greeting once.
  const { save, result } = freshFtueSeed();
  const { w, audio } = boot(save, result);
  assert(w.document.querySelector(".intro"), "intro is on screen");
  audio.unlock();
  assert.deepEqual(audio.calls, ["youre-back"], "unlocking during the intro plays youre-back exactly once");
  audio.unlock();
  assert.deepEqual(audio.calls, ["youre-back"], "a later unlock call does not replay it a second time");
}

// CSS: the raid-summary overlay (EXTRACTED / RAID SECURED / RETURN TO BASE sheet) must be
// full-bleed -- no padding/border-radius/margin leaking the dark .bpop frame in from the edges --
// scoped to .raid-summary-ov/.raid-summary-pop so other .sheet overlays are untouched.
{
  const css = fs.readFileSync(path + "/index.html", "utf8");
  const ovRule = css.match(/#overlay\.sheet\.raid-summary-ov\{([^}]*)\}/);
  assert(ovRule, "#overlay.sheet.raid-summary-ov rule exists");
  assert(/inset:0!important/.test(ovRule[1]), "overlay container is inset:0 (full-bleed) at all three viewport sizes");
  const popRule = css.match(/#overlay\.raid-summary-ov \.raid-summary-pop\{([^}]*)\}/);
  assert(popRule, "#overlay.raid-summary-ov .raid-summary-pop rule exists");
  assert(/(^|;)padding:0(;|$)/.test(popRule[1]), "raid-summary-pop has no padding -- content reaches every edge: " + popRule[1]);
  assert(/border-radius:0/.test(popRule[1]), "raid-summary-pop has no rounded corners: " + popRule[1]);
  assert(!/margin:(?!0)/.test(popRule[1]), "raid-summary-pop has no offsetting margin: " + popRule[1]);
}

console.log("FTUE VO/summary full-bleed test PASSED");
