// jsdom: weapons + medkits drive Node Raid launch params; Basic is free; taken gear/kit is at risk.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
function boot(){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window, nav = [];
  w.PR_NAVIGATE = u => nav.push(u);
  for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js"])
    w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  // Test hook appended in the same eval so it shares app.js lexical scope.
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, ingest:r=>ingestRaidResult(r) };");
  w.A.dismissIntro();
  const st = w.__T.S();
  Object.assign(st.modules, { rebirth_core:1, fabricator:1 }); st.baseState = "core_habitable"; st.stash = { smg_vector:1, scavenger_vest:1, medkit:3 }; st.roomUnlocks = { fabricator:true };
  return { w, nav, A:w.A, S:() => w.__T.S() };
}
const D = { items:null };
{
  const { w, nav, A, S } = boot();
  D.items = w.DATA.items;
  // Data: every weapon has the full stat block the core expects.
  for(const it of w.DATA.items.filter(i => i.slot === "weapon"))
    for(const k of ["dmg","mag","rld","int","rng","cone","ast","spr"]) assert(Number.isFinite(it.weapon[k]), it.id + " has " + k);
  assert(w.DATA.items.find(i => i.id === "basic_carbine").free, "Basic is the free weapon");
  A.go("prep");
  assert(w.document.querySelector(".hero-weapon").textContent.includes("Basic Carbine"), "Basic equipped by default even without one in the stash");
  A.pickSlot("weapon");
  const picks = [...w.document.querySelectorAll("#overlay .pick")].map(b => b.textContent);
  assert(picks[0].includes("Basic Carbine") && picks[0].includes("FREE"), "picker always offers free Basic first");
  assert(picks.some(t => t.includes("Vector SMG") && t.includes("MAG 8")), "picker shows weapon stats");
  A.chooseSlot("weapon", "smg_vector"); A.prepLoadout("armor", "scavenger_vest"); A.prepLoadout("c1", "medkit"); A.prepLoadout("c2", "medkit");
  assert(/Vector SMG/.test(w.document.querySelector(".riskbar").textContent) && /Medkit/.test(w.document.querySelector(".riskbar").textContent), "risk bar lists weapon + medkits");
  A.deployNodeRaid();
  const url = decodeURIComponent(nav[0]);
  assert(url.includes("&w=id:smg_vector,dmg:1,mag:8,rld:450,int:110,rng:6,cone:10,ast:14,spr:5"), "weapon stats passed to core: " + url);
  assert(url.includes("&kit=medkit:2") && url.includes("gear=smg_vector,scavenger_vest"), "kit + gear passed");
  assert.equal(S().stash.smg_vector || 0, 0, "taken weapon leaves the stash");
  assert.equal(S().stash.medkit, 1, "two medkits leave the stash");
  // Extract with one medkit left: weapon, armour and 1 medkit come home.
  const raidId = S().coreLaunch.raidId;
  const res = w.__T.ingest({ schema:"protocol-rebirth/raid-result", version:1, raidId, seed:"x", outcome:"extract", levelsCleared:1, enemiesDefeated:0, nodesLit:1, remainingMs:1, extracted:[], lost:[], endedAt:1, kitLeft:{ medkit:1 } });
  assert(res.ok && res.kitBack === 1 && res.kitLost === 1, "unused medkit returns");
  assert.equal(S().stash.smg_vector, 1, "weapon returns on extract");
  assert.equal(S().stash.medkit, 2, "1 left + 1 returned");
}
{
  const { w, nav, A, S } = boot();
  A.go("prep"); A.chooseSlot("weapon", "smg_vector"); A.prepLoadout("c1", "medkit");
  A.deployNodeRaid();
  const raidId = S().coreLaunch.raidId;
  const res = w.__T.ingest({ schema:"protocol-rebirth/raid-result", version:1, raidId, seed:"x", outcome:"death", levelsCleared:0, enemiesDefeated:0, nodesLit:0, remainingMs:1, extracted:[], lost:[], endedAt:1, kitLeft:{ medkit:1 } });
  assert(res.gearLost.includes("smg_vector") && res.kitBack === 0, "death loses the weapon and the medkit");
  assert.equal(S().stash.smg_vector || 0, 0);
  // Basic is never consumed.
  nav.length = 0; A.go("prep"); A.chooseSlot("weapon", "basic_carbine"); A.deployNodeRaid();
  assert(decodeURIComponent(nav[0]).includes("w=id:basic_carbine") && !/gear=[^&]*basic_carbine/.test(decodeURIComponent(nav[0])), "Basic goes in free, never as gear");
}
console.log("WEAPONS + KIT TEST PASSED");
