// Depth Raid is an opt-in game mode (NODE RAID = existing loop, DEPTH RAID = prototype).
// Ordinary launches stay unchanged; the selector appears only on Bunker after FTUE.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save, url){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url: url || "http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = u => { w.__nav = u; };
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, depthRaidAvailable, depthRaidOn, depthRaidSelected, setDepthRaid, coreLaunchUrl, ftueOver:typeof ftueOver==='function'?ftueOver:undefined, guidedRaid:typeof guidedRaid==='function'?guidedRaid:undefined };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:3, fabricator:1, bit_bay:1, storage:1 }); base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; base.beat = g.D.progression.beats.length - 1;
base.area = "bunker";
const fresh = (mut, url) => { const st = JSON.parse(JSON.stringify(base)); if(mut) mut(st); return boot(st, url); };

// coreLaunchUrl: default stays a Node Raid (no depth=); opt-in adds depth=1
{
  const url = g.T.coreLaunchUrl("r1", "s1", "./", {});
  assert(!/depth=/.test(url), "ordinary launch URL has no depth param: " + url);
  assert(/[?&]depth=1(&|$)/.test(g.T.coreLaunchUrl("r1", "s1", "./", { depth:true })));
}

// First-raid / pre-Fabricator prep does not show the selector (regression vs overwriting Node Raid)
{
  const b = boot(null); b.A.dismissIntro(); b.A.go("prep");
  assert(!b.d.querySelector(".pr-mode-sel"), "no mode selector before Fabricator / FTUE");
  assert.equal(b.d.querySelector(".pr-mission-btn b")?.textContent, "NODE RAID");
  b.A.deployNodeRaid();
  assert(!/depth=/.test(b.w.__nav || ""), "first-raid deploy is not Depth Raid: " + b.w.__nav);
}

// Post-FTUE Bunker: selector is visible, NODE RAID is the default, deploy stays unchanged
{
  const b = fresh(); b.A.go("prep");
  const sel = b.d.querySelector(".pr-mode-sel");
  assert(sel, "mode selector shown on Bunker after FTUE");
  assert.equal(sel.getAttribute("aria-label"), "Raid mode");
  const btns = [...sel.querySelectorAll(".pr-mode-btn")];
  assert.deepEqual(btns.map(x => x.textContent), ["NODE RAID", "DEPTH RAID"]);
  assert.equal(btns[0].getAttribute("aria-checked"), "true");
  assert.equal(btns[1].getAttribute("aria-checked"), "false");
  assert.equal(b.d.querySelector(".pr-mission-btn b")?.textContent, "NODE RAID");
  assert(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(sel.textContent), "no emoji in the mode selector");
  b.A.deployNodeRaid();
  assert(!/depth=/.test(b.w.__nav), "default post-FTUE deploy is still Node Raid: " + b.w.__nav);
}

// Choosing DEPTH RAID persists, updates the mission label, and launch carries ?depth=1
{
  const b = fresh(); b.A.go("prep");
  b.A.setRaidMode("depth");
  assert(b.T.depthRaidSelected());
  assert.equal(b.w.localStorage.getItem("pr.depthRaid"), "1");
  assert.equal(b.d.querySelector(".pr-mode-btn.on")?.textContent, "DEPTH RAID");
  assert.equal(b.d.querySelector(".pr-mission-btn b")?.textContent, "DEPTH RAID");
  assert(b.S().log.some(l => l.action === "RAID_MODE_TOGGLED" && l.payload.mode === "depth"));
  assert(!b.d.querySelector("#mission-panel .bigmap-btn"), "BIG MAP hides while Depth Raid is selected");
  b.A.deployNodeRaid();
  assert(/[?&]depth=1(&|$)/.test(b.w.__nav), "depth deploy carries depth=1: " + b.w.__nav);
  assert(!/levels=big/.test(b.w.__nav), "depth deploy does not also force BIG MAP");

  const d = fresh();
  d.w.localStorage.setItem("pr.depthRaid", "1");
  d.A.go("prep");
  assert.equal(d.d.querySelector(".pr-mode-btn.on")?.textContent, "DEPTH RAID", "last choice persists");
  d.A.setRaidMode("node");
  assert.equal(d.w.localStorage.getItem("pr.depthRaid"), "0");
  assert.equal(d.d.querySelector(".pr-mode-btn.on")?.textContent, "NODE RAID");
}

// Hidden on other areas, even with a persisted Depth Raid choice
{
  const b = fresh();
  b.w.localStorage.setItem("pr.depthRaid", "1");
  b.S().debugAreas = true;
  b.A.setArea("archipelago");
  b.A.go("prep");
  assert(!b.d.querySelector(".pr-mode-sel"), "no mode selector on Archipelago");
  assert.equal(b.d.querySelector(".pr-mission-btn b")?.textContent, "NODE RAID");
  b.A.deployNodeRaid();
  assert(!/depth=/.test(b.w.__nav), "Archipelago deploy is not Depth Raid: " + b.w.__nav);
}

// ?depth=1 on the meta URL forces the selector on; ?depth=0 forces it off
{
  const on = fresh(null, "http://localhost/index.html?depth=1"); on.A.go("prep");
  assert.equal(on.d.querySelector(".pr-mode-btn.on")?.textContent, "DEPTH RAID");
  on.A.deployNodeRaid();
  assert(/[?&]depth=1(&|$)/.test(on.w.__nav), "meta ?depth=1 deploy: " + on.w.__nav);

  const off = fresh(st => {}, "http://localhost/index.html?depth=0");
  off.w.localStorage.setItem("pr.depthRaid", "1");
  off.A.go("prep");
  assert.equal(off.d.querySelector(".pr-mode-btn.on")?.textContent, "NODE RAID");
  off.A.deployNodeRaid();
  assert(!/depth=/.test(off.w.__nav), "meta ?depth=0 keeps a Node Raid launch: " + off.w.__nav);
}

console.log("depth-raid-mode.test: ok");
