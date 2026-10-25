// v1.98 playtest fix: Fabricator fullscreen screen (#overlay.fabov) recipe timer buttons. Bug: once the
// craft queue is full, the row stayed fully lit (no "disabled" dimming) with its onclick still attached,
// so A.craft() ran its busy-guard and queued a "Fabricator queue is full" toast() — but toastPump() defers
// every toast while #overlay exists (see test/t3-bit-confirm-skills.test.js #7), and the Fabricator screen
// IS that overlay. Net effect from the player's seat: tap the timer button, nothing visibly happens at all.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, idleState, fabSlots };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; base.beat = g.D.progression.beats.length - 1;
base.cur.scrap = 500; base.stash.med_gel = 20;

{ // 1) healthy recipe: button is live and actually starts the craft (baseline, must keep working)
  const b = boot(JSON.parse(JSON.stringify(base)));
  b.A.go("base"); b.A.openBuilding("fabricator");
  const row = () => b.d.querySelector('#overlay .fabrow[data-recipe="medkit"] button');
  assert(!row().disabled && row().getAttribute("onclick") === "A.craft('medkit')", "medkit starts live with scrap+materials in hand");
  const before = JSON.stringify(b.S().idle);
  b.w.eval(row().getAttribute("onclick")); // first-ever craft: instant
  assert.notEqual(JSON.stringify(b.S().idle), before, "tapping the live button actually crafts");
  assert.equal(b.S().idle.crafted, 1, "first craft recorded");
}

{ // 2) the bug: once the queue is full, the row must say so and stop pretending to be tappable —
  // not stay lit with an onclick that fires into a toast the open Fabricator screen will swallow.
  const b = boot(JSON.parse(JSON.stringify(base)));
  b.A.go("base");
  b.A.craft("medkit"); b.A.craft("medkit"); b.A.craft("medkit"); // instant, then fills both L1 slots, 3rd is the busy one
  assert.equal(b.S().idle.fab.length, b.T.fabSlots(), "queue is at capacity");
  b.A.openBuilding("fabricator");
  const row = b.d.querySelector('#overlay .fabrow[data-recipe="medkit"] button');
  assert(row.disabled, "busy recipe button must be disabled, not silently inert while looking tappable");
  assert(!row.getAttribute("onclick"), "no onclick wired up once the queue is full");
  assert(/QUEUE FULL/.test(row.textContent), "the row states why nothing will happen");
  const scrapBefore = b.S().cur.scrap, fabBefore = JSON.stringify(b.S().idle.fab);
  b.A.craft("medkit"); // simulate a stray tap reaching A.craft anyway (defense in depth)
  assert.equal(b.S().cur.scrap, scrapBefore, "no scrap spent while busy");
  assert.equal(JSON.stringify(b.S().idle.fab), fabBefore, "queue untouched while busy");
}

{ // 3) once a slot frees up, the same recipe goes back to being live
  const b = boot(JSON.parse(JSON.stringify(base)));
  b.A.go("base"); b.A.craft("medkit"); b.A.craft("medkit"); b.A.craft("medkit");
  b.S().idle.fab.shift(); // one job finishes
  b.A.openBuilding("fabricator");
  const row = b.d.querySelector('#overlay .fabrow[data-recipe="medkit"] button');
  assert(!row.disabled && row.getAttribute("onclick") === "A.craft('medkit')", "frees up once a slot opens");
}

console.log("V1.98 BUGS TEST PASSED");
