// jsdom: meta boot ingests a pending Node Raid result, shows its summary popup, and prep offers Node Raid deploy.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
const { window } = dom;
window.localStorage.setItem("pr_raid_result_v1", JSON.stringify({ schema:"protocol-rebirth/raid-result", version:1, raidId:"meta-test-1", seed:"s",
  outcome:"extract", levelsCleared:3, enemiesDefeated:4, nodesLit:6, remainingMs:1, extracted:["cable","power_cell"], lost:[], endedAt:1 }));
for(const s of ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js","app.js"])
  window.eval(fs.readFileSync(path + "/" + s, "utf8"));
const doc = window.document, A = window.A;
assert.equal(window.localStorage.getItem("pr_raid_result_v1"), null, "pending result consumed on boot");
{ const summary = doc.querySelector("#overlay .raid-summary-pop.pop-card");
  assert(summary, "merged raid summary popup shown");
  assert(summary.querySelector("h1").textContent === "EXTRACTED", "summary shows the raid outcome");
  const gains = [...summary.querySelectorAll(".summary-row.gain")];
  assert(gains.some(row => row.textContent.includes("Cable")) && gains.some(row => row.textContent.includes("Power Cell")), "summary lists secured loot");
  assert(summary.textContent.includes("LOST / CONSUMED") && summary.querySelector("[data-close]"), "summary includes losses and return action"); }
const saved = JSON.parse(window.localStorage.getItem("pr_meta_save"));
assert(saved.coreRaidsIngested.includes("meta-test-1") && saved.stash.cable >= 1, "ingest persisted");
A.dismissIntro(); A.playCombatDemo(); A.endCombatDemo();
const btn = doc.querySelector(".node-raid-launch");
assert(btn && btn.classList.contains("playbtn") && /DEPLOY/.test(btn.textContent) && btn.getAttribute("aria-label") === "Deploy — Node Raid", "prep offers a compact Node Raid PLAY button");
assert(doc.querySelector(".lobby .lobby-hero .hero-art") && doc.querySelectorAll(".lobby .lobby-side .lslot").length === 4, "lobby: operator centre stage, 4 slot tiles around it");
assert(doc.getElementById("mission-panel").hidden, "mission settings start hidden");
A.planToggle(true); assert(!doc.getElementById("mission-panel").hidden, "mission button opens settings");
A.planToggle(false); assert(doc.getElementById("mission-panel").hidden, "and closes them");
assert(doc.querySelector(".operator-stats") && /Speed/.test(doc.querySelector(".operator-stats").textContent), "prep shows operator stats");
console.log("CORE LOOP UI TEST PASSED");
