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
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, ingest:r=>ingestRaidResult(r), finish:(m, l)=>finishModuleLevel(m, l) };");
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
  assert.equal(((S().stash.smg_vector || 0) + ((S().armory || {}).smg_vector || 0)) || 0, 0, "taken weapon leaves the stash");
  assert.equal(((S().stash.medkit || 0) + ((S().armory || {}).medkit || 0)), 1, "two medkits leave the stash");
  // Extract with one medkit left: weapon, armour and 1 medkit come home.
  const raidId = S().coreLaunch.raidId;
  const res = w.__T.ingest({ schema:"protocol-rebirth/raid-result", version:1, raidId, seed:"x", outcome:"extract", levelsCleared:1, enemiesDefeated:0, nodesLit:1, remainingMs:1, extracted:[], lost:[], endedAt:1, kitLeft:{ medkit:1 } });
  assert(res.ok && res.kitBack === 1 && res.kitLost === 1, "unused medkit returns");
  assert.equal(((S().stash.smg_vector || 0) + ((S().armory || {}).smg_vector || 0)), 1, "weapon returns on extract");
  assert.equal(((S().stash.medkit || 0) + ((S().armory || {}).medkit || 0)), 2, "1 left + 1 returned");
}
// v1.46: kits picked up in the raid go to the kit slot; unused ones (up to 2) come home on extract.
{
  const { w, nav, A, S } = boot();
  A.go("prep"); A.prepLoadout("c1", ""); A.prepLoadout("c2", ""); const before = ((S().stash.medkit || 0) + ((S().armory || {}).medkit || 0)) || 0; A.deployNodeRaid();
  assert(!decodeURIComponent(nav[0]).includes("&kit="), "no kit brought");
  const raidId = S().coreLaunch.raidId;
  const res = w.__T.ingest({ schema:"protocol-rebirth/raid-result", version:1, raidId, seed:"x", outcome:"extract", levelsCleared:3, enemiesDefeated:0, nodesLit:1, remainingMs:1, extracted:[], lost:[], endedAt:1, kitLeft:{ medkit:5 } });
  assert(res.ok && res.kitBack === 2 && res.kitLost === 0, "picked-up kits come home, capped at the 2-kit slot");
  assert.equal(((S().stash.medkit || 0) + ((S().armory || {}).medkit || 0)), before + 2, "stashed and persisted");
  { const sv = JSON.parse(w.localStorage.getItem("pr_meta_save")); assert.equal((sv.stash.medkit || 0) + ((sv.armory || {}).medkit || 0), before + 2, "saved"); }
}
{
  const { w, nav, A, S } = boot();
  A.go("prep"); A.chooseSlot("weapon", "smg_vector"); A.prepLoadout("c1", "medkit");
  A.deployNodeRaid();
  const raidId = S().coreLaunch.raidId;
  const res = w.__T.ingest({ schema:"protocol-rebirth/raid-result", version:1, raidId, seed:"x", outcome:"death", levelsCleared:0, enemiesDefeated:0, nodesLit:0, remainingMs:1, extracted:[], lost:[], endedAt:1, kitLeft:{ medkit:1 } });
  assert(res.gearLost.includes("smg_vector") && res.kitBack === 0, "death loses the weapon and the medkit");
  assert.equal(((S().stash.smg_vector || 0) + ((S().armory || {}).smg_vector || 0)) || 0, 0);
  // Basic is never consumed.
  nav.length = 0; A.go("prep"); A.chooseSlot("weapon", "basic_carbine"); A.deployNodeRaid();
  assert(decodeURIComponent(nav[0]).includes("w=id:basic_carbine") && !/gear=[^&]*basic_carbine/.test(decodeURIComponent(nav[0])), "Basic goes in free, never as gear");
}
// Bug: looted Breach Shotgun couldn't be equipped. Every core-lootable weapon/gear lands in the stash
// under its item id and can be picked, equipped and deployed — also during the guided first raid.
{
  const levels = fs.readFileSync(path + "/nodspel/levels.js", "utf8");
  const gear = JSON.parse(levels.match(/gear:(\[[^\]]*\])/)[1].replace(/'/g, '"'));
  const weapons = JSON.parse(levels.match(/weaponIds:(\[[^\]]*\])/)[1].replace(/'/g, '"')).filter(id => id !== "basic_carbine");
  const all = [...new Set([...gear, ...weapons])];
  assert(all.includes("shotgun_breach"));
  for(const guided of [false, true]) for(const id of all){
    const { w, nav, A, S } = boot();
    const it = w.DATA.items.find(i => i.id === id); assert(it && it.slot, id + " is a slotted item");
    if(guided){ S().modules.fabricator = 0; }
    S().stash = { medkit:1 };
    const res = w.__T.ingest({ schema:"protocol-rebirth/raid-result", version:1, raidId:"loot-" + id + guided, seed:"x", outcome:"extract", levelsCleared:1, enemiesDefeated:0, nodesLit:1, remainingMs:1, extracted:[id], lost:[], endedAt:1 });
    assert(res.ok && ((S().stash[id] || 0) + ((S().armory || {})[id] || 0)) === 1, id + " lands in stash");
    A.go("prep");
    const key = it.slot === "weapon" ? "weapon" : "armor";
    A.pickSlot(key);
    assert([...w.document.querySelectorAll("#overlay .pick")].some(b => b.textContent.includes(it.name)), id + " offered in picker (guided=" + guided + ")");
    A.chooseSlot(key, id);
    assert.equal(w.__T.S && w.document.querySelector('[data-slot="' + key + '"]').getAttribute("aria-label"), (key === "weapon" ? "Weapon: " : "Armor: ") + it.name, id + " equipped");
    A.deployNodeRaid();
    const url = decodeURIComponent(nav[nav.length - 1] || "");
    assert(url.includes("gear=") && url.includes(id), id + " deployed (guided=" + guided + "): " + url);
  }
}
// PRB-74 toolkit: one tool slot in Raid Prep; taken from the stash (charges) at deploy, &tool= in the launch URL,
// unused charges come home on extract (never more than were taken), death loses them. Data-driven, ids only in data/.
{
  const { w, nav, A, S } = boot();
  const items = w.DATA.items, tools = items.filter(i => i.slot === "tool");
  assert.deepEqual(tools.map(t => t.id).sort(), ["tool_decoy", "tool_emp", "tool_grenade"], "three tools");
  for(const t of tools) assert(t.tool.charges >= 1 && t.tool.unlock && w.DATA.recipes.some(r => r.output.itemId === t.id && r.fabricatorLevel === t.tool.unlock.level), t.id + " has charges, an unlock level and a matching recipe");
  const rec = id => w.DATA.recipes.find(r => r.output.itemId === id);
  assert.deepEqual([rec("tool_grenade").inputs, rec("tool_grenade").scrapCost, rec("tool_grenade").fabricatorLevel], [{ scrap_alloy:1, fuse:1 }, 10, 2]);
  assert.deepEqual([rec("tool_emp").inputs, rec("tool_emp").scrapCost, rec("tool_emp").fabricatorLevel], [{ cable:1, circuit_board:1 }, 15, 2]);
  assert.deepEqual([rec("tool_decoy").inputs, rec("tool_decoy").scrapCost, rec("tool_decoy").fabricatorLevel], [{ cable:1, polymer_plate:1 }, 10, 1]);
  assert(!/tool_(grenade|emp|decoy)/.test(fs.readFileSync(path + "/app.js", "utf8")), "no tool ids hardcoded in app.js");

  S().stash = { tool_grenade:3, medkit:1 };
  A.go("prep");
  assert(w.document.querySelector('[data-slot="tool"]'), "tool slot is shown in Raid Prep");
  assert.equal(w.document.querySelectorAll('[data-slot="tool"]').length, 1, "exactly one tool slot");
  A.pickSlot("tool");
  const picks = [...w.document.querySelectorAll("#overlay .pick")].map(b => b.textContent);
  assert(picks.length >= 1 && picks[0].includes("Grenade") && picks[0].includes("3 charges"), "picker lists owned tools with charges: " + picks);
  assert(w.document.querySelector("#overlay .pop-x"), "shared popup close badge");
  A.chooseSlot("tool", "tool_grenade");
  assert(/Grenade/.test(w.document.querySelector(".riskbar").textContent), "risk bar lists the tool");
  A.deployNodeRaid();
  assert(decodeURIComponent(nav[0]).includes("&tool=tool_grenade:2"), "tool + charges in launch url (capped at 2 of the 3 owned): " + decodeURIComponent(nav[0]));
  assert.equal(((S().stash.tool_grenade || 0) + ((S().armory || {}).tool_grenade || 0)), 1, "the carried charges leave the stash");
  const raidId = S().coreLaunch.raidId;
  const base = { schema:"protocol-rebirth/raid-result", version:1, seed:"x", outcome:"extract", levelsCleared:1, enemiesDefeated:0, nodesLit:1, remainingMs:1, extracted:[], lost:[], endedAt:1 };
  const res = w.__T.ingest({ ...base, raidId, toolLeft:{ id:"tool_grenade", n:1 } });
  assert(res.ok && res.toolBack === 1 && res.toolLost === 1, "one unused charge returns, one was used");
  assert.equal(((S().stash.tool_grenade || 0) + ((S().armory || {}).tool_grenade || 0)), 2, "1 left in stash + 1 returned");
}
{
  const { w, nav, A, S } = boot();
  S().stash = { tool_emp:1 };
  A.go("prep"); A.chooseSlot("tool", "tool_emp"); A.deployNodeRaid();
  assert(decodeURIComponent(nav[0]).includes("&tool=tool_emp:1"));
  const raidId = S().coreLaunch.raidId;
  const res = w.__T.ingest({ schema:"protocol-rebirth/raid-result", version:1, raidId, seed:"x", outcome:"death", levelsCleared:0, enemiesDefeated:0, nodesLit:0, remainingMs:1, extracted:[], lost:[], endedAt:1, toolLeft:{ id:"tool_emp", n:1 } });
  assert(res.ok && res.toolBack === 0 && res.toolLost === 1, "death loses the unused charge");
  assert.equal(((S().stash.tool_emp || 0) + ((S().armory || {}).tool_emp || 0)) || 0, 0);
}
{
  // a forged toolLeft can neither add charges nor swap the tool for another one
  const { w, nav, A, S } = boot();
  S().stash = { tool_decoy:2 };
  A.go("prep"); A.chooseSlot("tool", "tool_decoy"); A.deployNodeRaid();
  const raidId = S().coreLaunch.raidId;
  const res = w.__T.ingest({ schema:"protocol-rebirth/raid-result", version:1, raidId, seed:"x", outcome:"extract", levelsCleared:1, enemiesDefeated:0, nodesLit:1, remainingMs:1, extracted:[], lost:[], endedAt:1, toolLeft:{ id:"tool_decoy", n:99 } });
  assert.equal(res.toolBack, 2, "capped at what was taken in");
  assert.equal(((S().stash.tool_decoy || 0) + ((S().armory || {}).tool_decoy || 0)), 2);
  nav.length = 0; A.go("prep"); A.deployNodeRaid(); // slot still set; no kit/tool param for a different id
  const r2 = S().coreLaunch.raidId;
  const bad = w.__T.ingest({ schema:"protocol-rebirth/raid-result", version:1, raidId:r2, seed:"y", outcome:"extract", levelsCleared:1, enemiesDefeated:0, nodesLit:1, remainingMs:1, extracted:[], lost:[], endedAt:1, toolLeft:{ id:"tool_grenade", n:2 } });
  assert.equal(bad.toolBack, 0, "mismatched tool id is ignored");
  assert.equal(((S().stash.tool_grenade || 0) + ((S().armory || {}).tool_grenade || 0)) || 0, 0);
}
{
  // first charge of each tool is free when the Fabricator level that unlocks it is built (once)
  const { w, S } = boot();
  S().stash = {}; S().toolsGiven = {};
  w.__T.finish("fabricator", 1);
  assert.equal(((S().stash.tool_decoy || 0) + ((S().armory || {}).tool_decoy || 0)), 1, "Fabricator L1 grants one Decoy charge");
  assert(!((S().stash.tool_grenade || 0) + ((S().armory || {}).tool_grenade || 0)) && !((S().stash.tool_emp || 0) + ((S().armory || {}).tool_emp || 0)), "grenade/EMP wait for L2");
  w.__T.finish("fabricator", 2);
  assert.equal(((S().stash.tool_grenade || 0) + ((S().armory || {}).tool_grenade || 0)), 1); assert.equal(((S().stash.tool_emp || 0) + ((S().armory || {}).tool_emp || 0)), 1);
  w.__T.finish("fabricator", 2); w.__T.finish("fabricator", 1);
  assert.equal(((S().stash.tool_decoy || 0) + ((S().armory || {}).tool_decoy || 0)), 1, "granted once only"); assert.equal(((S().stash.tool_grenade || 0) + ((S().armory || {}).tool_grenade || 0)), 1);
}
console.log("WEAPONS + KIT TEST PASSED");
