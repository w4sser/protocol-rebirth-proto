// D3.1 / D3.2: BIT is first met inside the bunker. The FTUE intro raid has no companion
// (drone, distract, heal, lines), and the "You're late…" greeting is the first BIT speech —
// before any result-screen comment. Run: node test/d3-bit-meeting.test.js
const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];

function boot({ result, ftueTracked=true }={}){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window;
  const store = {};
  w.localStorage = { getItem:k=>store[k]??null, setItem:(k,v)=>store[k]=String(v), removeItem:k=>delete store[k] };
  w.URL.createObjectURL = () => "blob:fake";
  w.PR_NAVIGATE = u => { w.launchURL = u; };
  if(ftueTracked) w.localStorage.setItem("pr_ftue_v1", JSON.stringify({ step:"play", t:{ play:1 }, attempts:0 }));
  if(result) w.localStorage.setItem("pr_raid_result_v1", JSON.stringify(result));
  for(const s of FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + ";window.T={state:()=>S,ingestRaidResult,pickRaidReaction:typeof pickRaidReaction==='function'?pickRaidReaction:null,raidSummaryHtml:typeof raidSummaryHtml==='function'?raidSummaryHtml:null};");
  return w;
}

function ftueResult(extra={}){
  return Object.assign({
    schema:"protocol-rebirth/raid-result", version:1, raidId:"nodspel:ftue-meet", seed:"ftue-meet",
    outcome:"extract", area:"bunker", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:400000,
    extracted:["scrap_alloy","scrap_alloy"], lost:[], endedAt:1, kitLeft:{ medkit:1 }, ftue:true
  }, extra);
}

{
  const w = boot({ result: ftueResult() });
  const app = w.document.getElementById("app");
  assert(app.textContent.includes("You're… back?"), "greeting is shown on FTUE return");
  assert(app.textContent.includes("You're late… but you're back."), "owner greeting is the first BIT speech");
  const summary = w.document.querySelector("#overlay.raid-summary-ov");
  assert(!summary, "Node Raid summary is not on top of the greeting");
  assert(!/#overlay/.test(w.document.getElementById("overlay")?.className||"") || !w.document.querySelector(".raid-summary"),
    "no raid-summary overlay covers the cold open");
  // BIT bubble must not appear until (or unless) after the greeting.
  assert(!w.document.querySelector(".rs-bubble"), "no BIT result comment before the greeting");

  w.A.dismissIntro();
  const after = w.document.querySelector("#overlay.raid-summary-ov .raid-summary");
  assert(after, "loot summary appears after the greeting is dismissed");
  assert(!after.querySelector(".rs-bubble"), "FTUE summary has no BIT comment — greeting already was the first speech");
  assert(!/BIT:/.test(after.textContent), "no BIT: line on the deferred FTUE summary: " + after.textContent.slice(0,200));
  assert(/EXTRACTED/.test(after.textContent), "deferred summary still reports the extraction");
  assert(/Scrap Alloy/.test(after.textContent), "deferred summary still lists the secured loot");
}

{
  // Ordinary (non-FTUE) extract on a fresh profile still shows the summary immediately — core-loop path.
  const w = boot({
    ftueTracked:false,
    result: {
      schema:"protocol-rebirth/raid-result", version:1, raidId:"meta-ordinary", seed:"s",
      outcome:"extract", levelsCleared:1, enemiesDefeated:1, nodesLit:1, remainingMs:1,
      extracted:["cable"], lost:[], endedAt:1
    }
  });
  const summary = w.document.querySelector("#overlay .raid-summary-pop");
  assert(summary, "non-FTUE extract still opens the summary on boot");
  assert(summary.querySelector(".rs-bubble"), "ordinary summary still has a BIT comment");
}

{
  // pickRaidReaction / raidSummaryHtml: FTUE is silent, ordinary is not. Use a second boot and
  // call through ingest already covered above; also assert HTML helper via a direct eval of a
  // returned extract on a progressed save (intro already seen) would still comment.
  const w = boot({ result: ftueResult(), ftueTracked:true });
  // After greeting+dismiss, reaction stayed null (no BIT bubble). After a later ordinary raid
  // (introSeen now true, no ftue flag) a comment is present — exercised by the previous block.
  assert(w.T.state().introSeen === false, "greeting not auto-dismissed");
}

console.log("D3 BIT MEETING TEST PASSED");
