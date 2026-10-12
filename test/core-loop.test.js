// jsdom: meta boot ingests a pending Node Raid result, shows a toast, and prep offers Node Raid deploy.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
const { window } = dom;
window.localStorage.setItem("pr_raid_result_v1", JSON.stringify({ schema:"protocol-rebirth/raid-result", version:1, raidId:"meta-test-1", seed:"s",
  outcome:"extract", levelsCleared:3, enemiesDefeated:4, nodesLit:6, remainingMs:1, extracted:["cable","power_cell"], lost:[], endedAt:1 }));
for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js","app.js"])
  window.eval(fs.readFileSync(path + "/" + s, "utf8"));
const doc = window.document, A = window.A;
assert.equal(window.localStorage.getItem("pr_raid_result_v1"), null, "pending result consumed on boot");
assert.equal(doc.getElementById("toast").textContent, "Node Raid: extracted — +1 Cable, +1 Power Cell", "result toast shown");
const saved = JSON.parse(window.localStorage.getItem("pr_meta_save"));
assert(saved.coreRaidsIngested.includes("meta-test-1") && saved.stash.cable >= 1, "ingest persisted");
A.dismissIntro(); A.playCombatDemo(); A.endCombatDemo();
const btn = doc.querySelector(".node-raid-launch");
assert(btn && btn.textContent.includes("DEPLOY — NODE RAID"), "prep offers Node Raid deploy");
console.log("CORE LOOP UI TEST PASSED");
