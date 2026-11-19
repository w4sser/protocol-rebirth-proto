// PRB-149 (v2.28.27): "make the bunker even more destroyed in the beginning... start from something
// primitive, and smaller steps to the progression." Covers the CSS-only progressive ruin level
// (data-ruin 3..0 on .baseviewer, computed by app.js' ruinLevel()) and the smaller Fabricator L1 cost.
// Run: node test/ruined-bunker.test.js
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(seedSave){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/" });
  const w = dom.window;
  w.localStorage = (() => { let s = {}; return { getItem:k=>s[k]??null, setItem:(k,v)=>s[k]=v, removeItem:k=>delete s[k] }; })();
  w.URL.createObjectURL = () => "blob:fake";
  if(seedSave) w.localStorage.setItem("pr_meta_save", JSON.stringify(seedSave));
  w.PR_NAVIGATE = u => { w.launchURL = u; };
  for(const s of FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + ";window.T={state:()=>S,ruinLevel,progressionGoal,progressionGoalHtml,navAllowed,goalNeedsRaidLoot,baseState};");
  w.A.startFtueDirect = () => {};
  return w;
}
const htmlOf = w => w.document.getElementById("app").innerHTML;
const indexSrc = fs.readFileSync(path + "/index.html", "utf8");

// 1) Pure ruinLevel(): powers on immediately after Core restore.
{
  const w = boot(null);
  assert.equal(w.T.ruinLevel("core_found", 0), 3, "pre-Core-L1 is the darkest tier");
  assert.equal(w.T.ruinLevel("core_habitable", 0), 1, "Core L1 restored, Fabricator not built");
  assert.equal(w.T.ruinLevel("core_habitable", 1), 1, "Fabricator built, not yet fully refined");
  assert.equal(w.T.ruinLevel("core_refined", 1), 0, "fully refined reads unchanged from today");
}

// 2) The rendered .baseviewer carries data-ruin matching live progress, one notch brighter per step.
{
  const w = boot(null);
  const S = w.T.state();
  S.introSeen = true;
  w.A.go("base");
  assert.equal(w.document.querySelector(".baseviewer").dataset.ruin, "3", "fresh start renders ruin 3");

  S.modules.rebirth_core = 1; S.baseState = "core_habitable"; S.modules.fabricator = 0;
  w.A.go("base");
  assert.equal(w.document.querySelector(".baseviewer").dataset.ruin, "1", "Core L1 restored renders powered ruin 1");

  S.modules.fabricator = 1;
  w.A.go("base");
  assert.equal(w.document.querySelector(".baseviewer").dataset.ruin, "1", "Fabricator built renders ruin 1");

  Object.assign(S.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 });
  S.baseState = "core_refined";
  w.A.go("base");
  assert.equal(w.document.querySelector(".baseviewer").dataset.ruin, "0", "core_refined renders ruin 0 (unchanged from today)");
}

// 3) CSS rules exist for ruin 3/2/1 and target only the plate layer, never HUD text or buttons.
{
  for(const level of ["3","2","1"]) assert(indexSrc.includes('[data-ruin="' + level + '"]'), "a CSS rule exists for ruin " + level);
  const block = indexSrc.slice(indexSrc.indexOf("PRB-149"), indexSrc.indexOf("@keyframes bunkerwake"));
  assert(block.includes(".baseworld"), "ruin CSS block touches the plate layer");
  assert(!/\.progress-goal|\.hubstate|\.basemenu-btn|<button|\bbutton\b/.test(block), "ruin CSS never filters HUD text or buttons, only .baseworld/::after");
  // every filter: declaration inside the ruin block is scoped to a selector naming .baseworld
  const rules = block.split("}").filter(r => r.includes("filter:"));
  for(const r of rules) assert(/\.baseworld(?!\w)/.test(r.slice(0, r.indexOf("{"))), "a filter: rule is scoped to .baseworld: " + r.slice(0, 80));
}

// 4) prefers-reduced-motion disables the ruin-3 flicker/grain animation; the static look is still fine.
{
  const media = indexSrc.match(/@media \(prefers-reduced-motion: reduce\)\{([\s\S]*?)\n  \}/);
  assert(media, "a prefers-reduced-motion block exists");
  assert(media[1].includes('data-ruin="3"'), "reduced motion rule covers the ruin-3 flicker/grain layer");
  assert(/animation:\s*none/.test(media[1]), "reduced motion turns the animation off");
}

// 5) Fabricator L1's smaller cost (v2.28.27: scrap 20->10, cable 2->1) and the "next goal" UI shows it.
{
  const w = boot(null);
  const S = w.T.state();
  const fab1 = w.DATA.modules.find(m => m.id === "fabricator").levels[0];
  assert.deepEqual(fab1.cost, { scrap:10, items:{ cable:1, scrap_alloy:2 } }, "Fabricator L1 cost is the smaller v2.28.27 step");

  S.introSeen = true; S.modules.rebirth_core = 1; S.baseState = "core_habitable";
  const goal = w.T.progressionGoal();
  assert.equal(goal.module, "fabricator");
  const cablePart = goal.parts.find(p => p.id === "cable");
  assert.equal(cablePart.need, 1, "goal reflects the reduced Cable requirement");
  w.A.go("base");
  const goalHtml = w.T.progressionGoalHtml();
  assert(/need 1/.test(goalHtml), "the next-goal UI shows the reduced need: " + goalHtml);
}

// 6) Guard still holds: reducing Fabricator's cost never reopens the D3.10 Carlos softlock around
//    Core L1 (goalNeedsRaidLoot / RAID tab availability is unaffected by a later-room cost change).
{
  const w = boot(null);
  const S = w.T.state();
  S.introSeen = true;
  assert.equal(w.T.state().stash.scrap_alloy, 1, "fresh stash still short of Core L1's 2 Scrap Alloy");
  assert.equal(w.T.goalNeedsRaidLoot(), true, "Core L1 still needs raid-findable Scrap Alloy");
  assert.equal(w.T.navAllowed("prep"), true, "RAID stays open while Core L1 needs raid loot");

  // Once Core L1 is in (core_habitable), RAID is unconditionally open via baseAllows regardless of
  // whether the now-cheaper Fabricator goal is already affordable -- no new softlock introduced.
  S.modules.rebirth_core = 1; S.baseState = "core_habitable";
  assert.equal(w.T.navAllowed("prep"), true, "core_habitable keeps RAID open independent of goalNeedsRaidLoot");
}

console.log("RUINED BUNKER TEST PASSED");
