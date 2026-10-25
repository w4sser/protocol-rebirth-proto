// Reset progress: topbar button + ?reset=1, both confirmed, clear every PR key and reload.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const assert = require("assert");
const path = __dirname + "/..";
const SCRIPTS = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js","app.js"];
function boot(url, seed, answer){
  const vc = new VirtualConsole(); // jsdom does not implement navigation; keep output quiet
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url, virtualConsole:vc });
  const w = dom.window;
  for(const [k,v] of Object.entries(seed.local || {})) w.localStorage.setItem(k, v);
  for(const [k,v] of Object.entries(seed.session || {})) w.sessionStorage.setItem(k, v);
  const asked = []; w.confirm = m => { asked.push(m); return answer; };
  const nav = []; w.PR_NAVIGATE = u => nav.push(u);
  for(const s of SCRIPTS) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  return { w, asked, nav };
}
const seed = { local:{ pr_meta_save:'{"v":99}', pr_raid_result_v1:"{}", "nodspel.result.json":"{}", other_app:"keep" }, session:{ "nodspel.tutorial.seen":"1" } };

// Button exists in the topbar, cancel keeps everything.
{
  const { w, asked } = boot("http://localhost/index.html", seed, false);
  const btn = w.document.querySelector("#topbar #reset-progress");
  assert(btn && /Reset/.test(btn.textContent), "reset button in topbar");
  btn.click();
  assert.equal(asked.length, 1, "confirm shown");
  assert(w.localStorage.getItem("pr_meta_save"), "cancel keeps save");
}
// Button + confirm clears all PR keys (local + session), keeps foreign keys, reloads.
{
  const { w, nav } = boot("http://localhost/index.html", seed, true);
  w.document.getElementById("reset-progress").click();
  for(const k of ["pr_meta_save","pr_raid_result_v1","nodspel.result.json"]) assert.equal(w.localStorage.getItem(k), null, k + " cleared");
  assert.equal(w.sessionStorage.getItem("nodspel.tutorial.seen"), null, "core FTUE flag cleared");
  assert.equal(w.localStorage.getItem("other_app"), "keep", "non-PR keys untouched");
  assert.deepEqual(nav, ["/index.html"], "reloads to fresh start");
  w.dispatchEvent(new w.Event("beforeunload"));
  assert.equal(w.localStorage.getItem("pr_meta_save"), null, "unload does not re-save old state");
}
// ?reset=1 confirmed: clears before boot and reloads without the param.
{
  const { w, asked, nav } = boot("http://localhost/index.html?reset=1&x=2", seed, true);
  assert.equal(asked.length, 1);
  assert.equal(w.localStorage.getItem("pr_meta_save"), null);
  assert.deepEqual(nav, ["/index.html?x=2"]);
}
// ?reset=1 cancelled: keeps progress, strips param, boots normally.
{
  const { w, nav } = boot("http://localhost/index.html?reset=1", seed, false);
  assert(w.localStorage.getItem("pr_meta_save"));
  assert.equal(nav.length, 0); assert.equal(w.location.search, "");
  assert(w.document.getElementById("app").innerHTML.length > 0, "app booted");
}
console.log("RESET PROGRESS TEST PASSED");
