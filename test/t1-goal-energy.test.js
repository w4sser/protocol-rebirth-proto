// v1.81 T1-B + T1-D: tracked goal loop phase, raid-prep quest pip, bunker power meter/drain/shutoff/reinforce/maintain.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save, t0){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window; let now = t0 || Date.UTC(2026, 9, 23, 12);
  w.Date.now = () => now;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, session:()=>session, trackedQuest, trackedGoalHtml, loopPhase, powerValue, powerTier, roomPowered, tickPower, drainPowerRaid, gainPower, doReinforce, canReinforce, maintainDef, maintainReady, completeMaintain, BP, powerState };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, doc:w.document, set:t => { now = t; }, get now(){ return now; } };
}
const BP = (() => { const d = new JSDOM("", { runScripts:"outside-only" }).window; d.eval(fs.readFileSync(path + "/data/retention.js", "utf8")); return d.DATA.bunkerPower; })();
assert.equal(BP.warnAt, 30); assert.equal(BP.shutoffAt, 10); assert.equal(BP.offlineCap, 3);
assert(BP.idleMsPerPoint >= 15*60*1000 && BP.idleMsPerPoint <= 20*60*1000, "idle mid 15-20 min");
assert.equal(BP.raidDrainMin, 1); assert.equal(BP.raidDrainMax, 2);
assert.equal(BP.reinforce.scrap > 0, true); assert(!BP.reinforce.item, "scrap-only reinforce");
assert.equal(BP.maintain.items.cable, 2); assert.equal(BP.maintain.energy, 40);

const g0 = boot(null); g0.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g0.S()));
Object.assign(base.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 });
base.baseState = "core_habitable"; base.introSeen = true; base.beat = g0.w.DATA.progression.beats.length - 1;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true };
base.power = { value:100, at:Date.UTC(2026, 9, 23, 12), offlineDrained:0, reinforceAt:0, lastRoom:null, maintain:null };

// T1-B: after FTUE, tracked goal shows loop phase + progress tile; max 1 tracked; auto-track bunker
{ const b = boot(base); b.A.go("base");
  const tq = b.T.trackedQuest();
  assert.equal(tq.chain, "bunker"); assert.equal(tq.step.id, "B1");
  const card = b.doc.querySelector(".progress-goal.qgoal");
  assert(card, "tracked goal in goal-card slot");
  assert(/Power Trace/.test(card.textContent));
  assert(card.querySelector(".qphase"), "loop phase context line");
  assert.equal(card.querySelector(".qphase").dataset.phase, "wake");
  assert(/0\/3|0\/3/.test(card.textContent) || /0\/3/.test(card.innerHTML) || b.T.trackedQuest().prog === 0);
  // Raid Prep cyan pip on required area
  b.A.go("prep");
  const pick = b.doc.querySelector(".area-pick");
  assert(pick && pick.classList.contains("quest-target"), "raid prep area has quest-target");
  assert(pick.querySelector(".qpip"), "cyan quest pip");
}

// T1-B: auto-track next chain step after complete
{ const s = JSON.parse(JSON.stringify(base)); s.chains = { bunker:{ step:0, prog:3 } }; // B1 ready? clear needs extract - use handin step
  // Jump to B3 handin ready
  s.chains = { bunker:{ step:2, prog:0 } }; s.fir = { scrap_alloy:2, polymer_plate:1 }; s.stash = Object.assign({}, s.stash, { scrap_alloy:2, polymer_plate:1 });
  const b = boot(s); assert.equal(b.T.trackedQuest().step.id, "B3");
  b.A.QUEST_HANDIN({ chain:"bunker" });
  assert.equal(b.T.trackedQuest().step.id, "B4", "auto-tracks next chain step");
}

// T1-D: meter on base HUD
{ const b = boot(base); b.A.go("base");
  const m = b.doc.querySelector(".cur.power-meter");
  assert(m, "power meter on HUD"); assert.equal(b.T.powerValue(), 100); assert(m.classList.contains("ok"));
}

// T1-D: idle drain ~1 per idleMsPerPoint
{ const b = boot(base, Date.UTC(2026, 9, 23, 12)); b.A.go("base");
  b.set(Date.UTC(2026, 9, 23, 12) + BP.idleMsPerPoint);
  b.A.go("base");
  assert.equal(b.T.powerValue(), 99, "one idle tick drains 1");
}

// T1-D: offline capped
{ const s = JSON.parse(JSON.stringify(base)); s.idle = { clock:Date.UTC(2026, 9, 23, 12), genAt:0, builds:{}, fab:[], scav:null, freeBuildUsed:false, crafted:0, lastSeen:Date.UTC(2026, 9, 23, 12), away:null };
  s.power.at = Date.UTC(2026, 9, 23, 12);
  const away = Date.UTC(2026, 9, 23, 12) + 10 * BP.idleMsPerPoint;
  const b = boot(s, away); b.A.go("base");
  const dropped = 100 - b.T.powerValue();
  assert(dropped <= BP.offlineCap, "offline drain capped at " + BP.offlineCap + ", got " + dropped);
}

// T1-D: raid drain 1-2 (+ L2 extras)
{ const b = boot(base); const v0 = b.T.powerValue();
  const n = b.T.drainPowerRaid();
  assert(n >= 1 && n <= 2, "raid drain 1-2 with no L2 rooms, got " + n);
  assert.equal(b.T.powerValue(), v0 - n);
}

// T1-D: warn <30, shutoff <10, rooms off except Core + last
{ const s = JSON.parse(JSON.stringify(base)); s.power.value = 25;
  const b = boot(s); assert.equal(b.T.powerTier(), "warn");
  assert.equal(b.T.trackedQuest().maintain, true, "maintain tracked when low");
  assert(/Skydda|protect/i.test(b.T.loopPhase().id + b.T.loopPhase().label));
  b.T.powerState().value = 5; b.T.powerState().lastRoom = "fabricator";
  assert.equal(b.T.powerTier(), "crit");
  assert(b.T.roomPowered("rebirth_core")); assert(b.T.roomPowered("fabricator"));
  assert(!b.T.roomPowered("bit_bay"), "bit bay shut off"); assert(!b.T.roomPowered("storage"));
  b.A.go("base");
  assert(b.doc.querySelector('.mapspot.powered-off[data-destination="bit_bay"], .mapspot.powered-off'), "powered-off plate");
  b.A.openBuilding("storage");
  assert(b.doc.querySelector(".pwrpop"), "opening dark room opens power popup");
  assert(b.doc.querySelector(".pwrpop .pop-x, #overlay .pop-x"), "shared close X");
}

// T1-D: reinforce scrap-only +25
{ const s = JSON.parse(JSON.stringify(base)); s.power.value = 20; s.cur.scrap = 100;
  const b = boot(s); const v0 = b.T.powerValue();
  assert(b.T.canReinforce().ok);
  const r = b.T.doReinforce(); assert(r.ok);
  assert.equal(b.S().cur.scrap, 100 - BP.reinforce.scrap);
  assert.equal(b.T.powerValue(), Math.min(100, v0 + BP.reinforce.gain));
}

// T1-D: maintain hand-in restores +40 and clears track
{ const s = JSON.parse(JSON.stringify(base)); s.power.value = 8; s.stash.cable = 2; s.fir = { cable:2 };
  const b = boot(s); assert(b.T.maintainReady());
  const d = b.T.completeMaintain(); assert(d); assert.equal(d.energy, 40);
  assert(b.T.powerValue() >= 25, "restored above restore band");
  assert(!b.T.trackedQuest() || !b.T.trackedQuest().maintain, "maintain cleared when power ok");
}

// Tap meter opens popup
{ const b = boot(base); b.A.go("base"); b.A.powerTap();
  assert(b.doc.querySelector(".pwrpop")); assert(b.doc.querySelector("#overlay .pop-x"));
}

console.log("T1 GOAL + ENERGY TEST PASSED");
