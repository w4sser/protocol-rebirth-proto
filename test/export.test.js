// PRB-42: event-log export must work on iOS (anchor attached to the DOM, share sheet, text fallback).
const { JSDOM } = require("jsdom");
const fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const boot = () => {
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/" });
  const w = dom.window;
  w.localStorage = (() => { let s={}; return { getItem:k=>s[k]??null, setItem:(k,v)=>s[k]=v, removeItem:k=>delete s[k] }; })();
  w.URL.createObjectURL = () => "blob:fake"; w.URL.revokeObjectURL = () => {};
  for(const s of ["items","modules","bit","raid_zones","recipes","vendors","retention","progression","combat"]) w.eval(fs.readFileSync(path + "/data/" + s + ".js", "utf8"));
  w.eval(fs.readFileSync(path + "/app.js", "utf8"));
  return w;
};
(async () => {
  // 1) no share API: anchor is attached while clicked, then removed; text fallback shown
  let w = boot(), clickedAttached = null;
  w.HTMLAnchorElement.prototype.click = function(){ clickedAttached = this.isConnected && this.download === "pr_event_log.json"; };
  assert.equal(await w.A.devExport(), "download");
  assert.equal(clickedAttached, true, "anchor must be in the DOM when clicked (iOS Safari)");
  assert.equal(w.document.querySelectorAll("a[download]").length, 0, "anchor cleaned up");
  const ta = w.document.querySelector("#devexport textarea");
  assert(ta && JSON.parse(ta.value), "textarea fallback holds the JSON log");
  let copied = null;
  Object.defineProperty(w.navigator, "clipboard", { value:{ writeText:async t => { copied = t; } }, configurable:true });
  w.document.querySelector("#devexport #devcopy").click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(copied, ta.value, "copy button copies the log");
  // 2) share API with files: used first
  w = boot(); let shared = null;
  w.navigator.canShare = d => !!(d && d.files);
  w.navigator.share = async d => { shared = d; };
  assert.equal(await w.A.devExport(), "share");
  assert.equal(shared.files[0].name, "pr_event_log.json");
  // 3) share cancelled by user: no fallback spam
  w = boot();
  w.navigator.canShare = () => true;
  w.navigator.share = async () => { const e = new Error("x"); e.name = "AbortError"; throw e; };
  assert.equal(await w.A.devExport(), "share-cancelled");
  console.log("EXPORT TESTS PASSED"); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
