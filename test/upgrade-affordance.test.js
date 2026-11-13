// v2.28.23 upgrade-button affordance: one teal enabled state (tokens) for every actionable
// UPGRADE/BUILD/MERGE CTA, clearly disabled (no teal fill, no glow, no pulse) when it isn't
// affordable, and orange stays reserved for the RAID FOR / DEPLOY travel action.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, gearBlock, mergeBlock };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const html = fs.readFileSync(path + "/index.html", "utf8");

// ---- CSS-level: the shared enabled/disabled look for button.primary lives in one place ----
{
  const enabled = html.match(/button\.primary\{[^}]*\}/)[0];
  assert(/background:\s*var\(--accent\)/.test(enabled), "button.primary background is a token (--accent), not a raw hex literal");
  assert(!/#3FE0D0|#040E12/i.test(enabled), "button.primary carries no raw hex (ratchet: new UI uses tokens)");
  const disabled = html.match(/button\.primary:disabled\{[^}]*\}/)[0];
  assert(/background:\s*var\(--panel2\)/.test(disabled), "disabled primary falls back to the neutral panel token, never teal");
  assert(/box-shadow:\s*none/.test(disabled), "disabled primary drops the teal glow box-shadow (it used to leak through from button.primary)");
  const pulse = html.match(/button\.primary\.build-ready[^{]*\{[^}]*animation:\s*buildglow[^}]*\}/)[0];
  assert(/:not\(:disabled\)/.test(pulse) && /:not\(\.raidcta\)/.test(pulse), "the build-ready pulse cannot land on a disabled or RAID-FOR button");
  const raidctaRules = html.match(/button\.primary\.big\.raidcta[^{]*\{[^}]*\}/g) || [];
  assert(raidctaRules.some(r => /var\(--raid-action\)/.test(r)), "raidcta keeps the reserved orange raid-action token");
}

const g = boot(null); g.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 });
base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; base.beat = g.D.progression.beats.length - 1;
const fresh = extra => boot(Object.assign(JSON.parse(JSON.stringify(base)), extra));

// (a) an affordable module UPGRADE/BUILD is the teal primary -- never ghost, never orange
{
  const b = fresh({ cur:{ scrap:9999 }, stash:{ power_relay:5, circuit_board:5, power_cell:5, ai_fragment:5 } });
  b.A.openBuilding("rebirth_core");
  const cta = b.d.querySelector("#overlay .bpop button.primary");
  assert(cta, "affordable Core upgrade renders a primary CTA");
  assert(!cta.classList.contains("ghost") && !cta.classList.contains("raidcta"), "affordable UPGRADE is plain primary, not ghost/raidcta: " + cta.className);
  assert(!cta.disabled, "affordable UPGRADE is not disabled");
  assert(/UPGRADE/.test(cta.textContent));
}

// (b) an unaffordable upgrade is disabled and not teal-filled (CSS already proven above; check the attribute + reason)
{
  const b = fresh({ cur:{ scrap:0 }, armory:{ smg_vector:1 }, stash:{} });
  b.A.go("stash"); b.A.openStashItem("smg_vector");
  const upg = b.d.querySelector(".wpnscreen button.upg");
  assert(upg, "weapon screen renders an UPGRADE button");
  assert(upg.disabled, "unaffordable UPGRADE is disabled");
  assert(upg.classList.contains("primary"), "UPGRADE keeps the one shared class; CSS (checked above), not a second ghost variant, makes it look inert");
  assert(b.d.querySelector(".wpnscreen .sp-why"), "unaffordable upgrade shows a short reason");
}

// (c) weapon screen keeps UPGRADE as the teal primary when MERGE is also offered (the v2.28.20 bug)
{
  const b = fresh({ cur:{ scrap:500 }, armory:{ smg_vector:3 }, stash:{ scrap_alloy:5, servo:5 } });
  assert.equal(b.T.mergeBlock("smg_vector"), "", "fixture actually allows a merge right now");
  assert.equal(b.T.gearBlock("smg_vector"), "", "fixture actually allows the upgrade right now");
  b.A.go("stash"); b.A.openStashItem("smg_vector");
  const merge = b.d.querySelector(".wpnscreen button.merge"), upg = b.d.querySelector(".wpnscreen button.upg");
  assert(merge && !merge.disabled && merge.classList.contains("primary"), "affordable MERGE is also offered as a teal primary CTA");
  assert(upg && !upg.disabled, "UPGRADE is still affordable");
  assert(upg.classList.contains("primary") && !upg.classList.contains("ghost"), "affordable UPGRADE is never demoted to ghost just because MERGE is also on screen: " + upg.className);
}

// (d) RAID FOR stays the orange raid CTA, separate from (and not a substitute for) the upgrade affordance
{
  const b = fresh({ cur:{ scrap:0 }, stash:{} });
  b.A.openBuilding("rebirth_core");
  const cta = b.d.querySelector("#overlay .bpop button.primary");
  assert(cta.classList.contains("raidcta"), "missing materials fall back to the RAID FOR CTA, not a plain disabled UPGRADE only");
  assert(/RAID FOR/.test(cta.textContent));
}

console.log("UPGRADE AFFORDANCE TEST PASSED");
