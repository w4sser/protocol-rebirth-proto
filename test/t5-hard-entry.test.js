// v1.84 T5 (PRB-92): Hard variant entry in Raid Prep. Needs the area's Hard unlock AND Core L3; a Hard deploy sends ?hard=1.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = u => { w.__nav = u; };
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, hardAvailable, hardOn, coreLaunchUrl };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:3, fabricator:1, bit_bay:1, storage:1 }); base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; base.beat = g.D.progression.beats.length - 1;
const fresh = (mut) => { const st = JSON.parse(JSON.stringify(base)); if(mut) mut(st); const b = boot(st); return b; };

// 1) the toggle only exists once the area's Hard flag is unlocked and Core is L3
{ const b = fresh(); b.A.go("prep");
  assert(!b.T.hardAvailable("bunker"), "locked without the flag"); assert(!b.d.querySelector(".hard-btn"), "no toggle while locked");
  b.S().unlocks.hard.bunker = true; b.S().modules.rebirth_core = 2; assert(!b.T.hardAvailable("bunker"), "needs Core L3");
  b.S().modules.rebirth_core = 3; assert(b.T.hardAvailable("bunker")); assert(!b.T.hardAvailable("archipelago"), "per area");
  b.A.go("prep"); const btn = b.d.querySelector(".hard-btn"); assert(btn, "toggle shown"); assert.equal(btn.getAttribute("aria-pressed"), "false");
  assert(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(btn.textContent), "no emoji in the toggle");
}
// 2) toggling flips the state, a Hard deploy carries ?hard=1, a normal deploy does not
{ const b = fresh(st => { st.unlocks.hard.bunker = true; }); b.A.go("prep");
  b.A.toggleHard(); assert(b.T.hardOn(), "on after toggle"); assert.equal(b.d.querySelector(".hard-btn").getAttribute("aria-pressed"), "true");
  assert(b.S().log.some(l => l.action === "HARD_TOGGLED" && l.payload.on === true));
  b.A.deployNodeRaid(); assert(/[?&]hard=1(&|$)/.test(b.w.__nav), "hard=1 in the launch url: " + b.w.__nav); assert.equal(b.S().coreLaunch.hard, true);
  const c = fresh(st => { st.unlocks.hard.bunker = true; }); c.A.go("prep"); c.A.deployNodeRaid(); assert(!/hard=/.test(c.w.__nav), "normal deploy has no hard param");
  // a locked area cannot be forced on
  const d = fresh(); d.A.toggleHard(); assert(!d.T.hardOn());
}
assert(/&hard=1/.test(g.T.coreLaunchUrl("r1", "s1", "./", { hard:true })) && !/hard/.test(g.T.coreLaunchUrl("r1", "s1", "./", {})));
console.log("t5-hard-entry.test: ok");
