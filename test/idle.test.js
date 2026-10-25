// v1.56 base idle/offline layer: recycler, build timers, fabricator queue, BIT scavenging, welcome-back, clock guard.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
function boot(save, t0){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window; let now = t0; w.Date.now = () => now;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js"]) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, genStored, genCap, tickIdle, welcomeBack, session:()=>session };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, doc:w.document, set:t => { now = t; }, get now(){ return now; } };
}
const MIN = 60000, H = 3600000, T0 = Date.UTC(2026, 9, 15, 8);
const I = (() => { const d = new JSDOM("", { runScripts:"outside-only" }).window; d.eval(fs.readFileSync(path + "/data/retention.js", "utf8")); return d.DATA.idle; })();
// numbers stay in the documented ranges
assert.deepEqual(I.generator.ratePerHour, { 1:10, 2:14, 3:20 }); assert.equal(I.generator.capHours, 8);
for(const t of Object.values(I.buildMinutes)) for(const m of Object.values(t)) assert(m >= 15 && m <= 120, "build timers 15 min - 2 h");
const doc = fs.readFileSync(path + "/docs/economy-design.md", "utf8");
assert(/## 12\. Idle/.test(doc) && /10 \/ 14 \/ 20/.test(doc) && /80 \/ 112 \/ 160/.test(doc), "numbers documented in economy-design.md");

const g = boot(null, T0); g.A.dismissIntro(); const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true };
{ // 1) recycler: accrues per hour, caps at 8 h, one-tap collect keeps the partial hour
  const b = boot(base, T0); b.A.go("base");
  assert.equal(b.T.genStored(b.now), 0);
  b.set(T0 + 3.5 * H); assert.equal(b.T.genStored(b.now), 35, "10/h for 3.5 h");
  b.set(T0 + 30 * H); assert.equal(b.T.genStored(b.now), 80, "capped at 8 h (80)");
  b.A.go("base"); assert(b.doc.querySelector(".gen-chip"), "collect chip on the base map");
  const s0 = b.S().cur.scrap; b.A.collectScrap(); assert.equal(b.S().cur.scrap, s0 + 80, "one-tap collect"); assert.equal(b.T.genStored(b.now), 0);
  b.set(T0 + 30 * H + 10 * MIN); assert.equal(b.T.genStored(b.now), 1); }
{ // clock rollback: nothing completes early, nothing is lost
  const b = boot(base, T0); b.A.go("base"); b.set(T0 + 2 * H); b.A.go("base"); const st = b.T.genStored(b.now);
  b.set(T0 - 5 * H); b.A.go("base"); assert.equal(b.T.genStored(b.S().idle.clock), st, "rollback keeps stored scrap");
  assert.equal(b.S().idle.clock, T0 + 2 * H, "idle clock never moves backwards"); }
{ // 2) build timers: first L2+ instant (FTUE), later ones timed and finished offline via the save timestamps
  const s = JSON.parse(JSON.stringify(base)); s.cur.scrap = 9999; for(const id of Object.keys(s.stash)) s.stash[id] = 50;
  Object.assign(s.stash, { power_relay:5, circuit_board:9, ai_fragment:5, hydraulic_component:5, memory_module:5, servo:9, cable:9, fuse:9, optical_sensor:9, transmitter:5, power_cell:5 }); s.cur.dataCores = 50;
  const b = boot(s, T0); b.A.build("rebirth_core"); assert.equal(b.S().modules.rebirth_core, 2, "first L2 upgrade instant");
  b.A.build("fabricator"); assert.equal(b.S().modules.fabricator, 1, "second L2 upgrade is timed");
  const job = b.S().idle.builds.fabricator; assert.equal((job.doneAt - job.startAt) / MIN, 15);
  b.A.go("base"); assert(b.doc.querySelector('.mapspot.constructing[data-room="fabricator"]'), "scaffolding/lights on the room");
  b.A.openBuilding("fabricator"); assert(/UNDER CONSTRUCTION/.test(b.doc.querySelector(".bpop").textContent));
  b.A.build("fabricator"); assert.equal(Object.keys(b.S().idle.builds).length, 1, "no double build");
  // close the app, come back 20 min later
  const saved = JSON.parse(JSON.stringify(b.S())); const c = boot(saved, T0 + 20 * MIN);
  assert.equal(c.S().modules.fabricator, 2, "finished while away"); }
{ // 3) fabricator queue: first craft instant, then queued, sequential, finishes offline, slots enforced
  const s = JSON.parse(JSON.stringify(base)); s.cur.scrap = 500; s.stash.med_gel = 20;
  const b = boot(s, T0); const m0 = ((b.S().stash.medkit || 0) + ((b.S().armory || {}).medkit || 0)) || 0;
  b.A.craft("medkit"); assert.equal(((b.S().stash.medkit || 0) + ((b.S().armory || {}).medkit || 0)), m0 + 1, "first craft instant");
  b.A.craft("medkit"); b.A.craft("medkit"); b.A.craft("medkit");
  assert.equal(b.S().idle.fab.length, 2, "Fabricator L1: 2 slots"); assert.equal(b.S().stash.med_gel, 14, "a full queue never takes materials");
  assert.equal((b.S().idle.fab[1].doneAt - T0) / MIN, 6, "jobs run one after another");
  /* v2.0.0 */
  const c = boot(JSON.parse(JSON.stringify(b.S())), T0 + 4 * MIN);
  assert.equal(c.S().idle.fab.length, 2, "offline crafts wait for collection");
  c.A.collectFab(0); assert.equal(((c.S().stash.medkit || 0) + ((c.S().armory || {}).medkit || 0)), m0 + 2, "one ready to collect after 4 min");
  c.set(T0 + 7 * MIN); c.A.go("base"); c.A.collectFab(0);
  assert.equal(((c.S().stash.medkit || 0) + ((c.S().armory || {}).medkit || 0)), m0 + 3); }
{ // 4) BIT scavenging run: timed, never fails, small haul
  const s = JSON.parse(JSON.stringify(base)); const b = boot(s, T0); const sc = b.S().cur.scrap;
  b.A.sendScavenge(); const run = b.S().idle.scav; assert(run && (run.returnAt - T0) / MIN === 20, "20 min at BIT Bay L1");
  b.A.sendExpedition(); assert(!b.S().expedition, "BIT cannot be in two places");
  const items = Object.values(run.loot.items).reduce((a, q) => a + q, 0);
  assert(run.loot.scrap >= 8 && run.loot.scrap <= 15 && items >= 1 && items <= 3, "small haul");
  // 5) welcome-back strip after time away (non-blocking, not an overlay)
  const c = boot(JSON.parse(JSON.stringify(b.S())), T0 + 3 * H); c.A.go("base");
  assert.equal(c.S().cur.scrap, sc, "v1.86: scavenge loot waits for Confirm (not auto-deposited)"); assert.deepEqual(c.S().idle.scavPending, run.loot);
  c.A.confirmHaul(); assert.equal(c.S().cur.scrap, sc + run.loot.scrap, "scavenge loot delivered on Confirm"); c.A.go("base");
  const wel = c.doc.querySelector(".welcome"); assert(wel, "welcome-back strip shown");
  assert(/BIT is back/.test(wel.textContent) && /Recycler: 30 Scrap ready/.test(wel.textContent), "summary lists what happened");
  assert(!c.doc.getElementById("overlay"), "no blocking popup"); assert(wel.querySelector(".pop-x"), "shared close X");
  c.A.dismissWelcome(); assert(!c.doc.querySelector(".welcome")); }
{ // short absence: no welcome strip
  const b = boot(base, T0); b.A.go("base"); const c = boot(JSON.parse(JSON.stringify(b.S())), T0 + MIN); c.A.go("base"); assert(!c.doc.querySelector(".welcome")); }
console.log("IDLE / OFFLINE TEST PASSED");
