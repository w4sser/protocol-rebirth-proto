// v2.8.0 SAVE SLOTS: Settings -> Profiles wiring (jsdom). Run: node test/profiles-ui.test.js
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["items","modules","bit","bit-talents","raid_zones","recipes","vendors","retention","quests","progression","combat"];
const APP_SRC = fs.readFileSync(path + "/app.js", "utf8");
function newWindow(){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window;
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/data/" + s + ".js", "utf8"));
  w.eval(fs.readFileSync(path + "/save-slots.js", "utf8"));
  return w;
}
const freshSave = newWindow().eval(APP_SRC + ";freshState()"); // throwaway window, just to read the shape
function boot(patch, entries){
  const w = newWindow();
  if(entries) for(const [key, value] of Object.entries(entries)) w.localStorage.setItem(key, value);
  if(patch) w.localStorage.setItem("pr_meta_save", JSON.stringify(Object.assign({}, freshSave, patch)));
  const urls = []; w.PR_NAVIGATE = u => urls.push(u);
  w.eval(APP_SRC + "\n;window.__T={ S:()=>S, session:()=>session };");
  return { w, A:w.A, S:() => w.__T.S(), session:() => w.__T.session(), doc:w.document, urls, SaveSlots:w.SaveSlots };
}

// 1) menu button opens the panel; migration ran and slot 1 shows the pre-existing save
{
  const { A, doc, SaveSlots, w, S } = boot({ cur:{ scrap:77, dataCores:0, signals:0, chips:0 } });
  A.go("base");
  doc.getElementById("menubtn").click();
  const pbtn = doc.getElementById("profiles-btn"); assert(pbtn, "profiles button exists in settings menu");
  pbtn.click();
  const ov = doc.querySelector("#overlay"); assert(ov, "profiles panel opened");
  const rows = doc.querySelectorAll(".profrow"); assert.equal(rows.length, 3, "three slot rows");
  assert(rows[0].classList.contains("active"), "slot 1 is active after migration");
  assert(/Slot 1/.test(rows[0].textContent), "slot 1 keeps the migrated save");
  assert(/77/.test(rows[0].textContent), "slot 1 shows the migrated scrap total");
  assert(/Empty slot/.test(rows[1].textContent) && /Empty slot/.test(rows[2].textContent), "slots 2/3 start empty");
  const meta = SaveSlots.readMeta(w.localStorage);
  assert.equal(meta.active, 0);
  assert.equal(w.localStorage.getItem(SaveSlots.BACKUP_KEY), w.localStorage.getItem("pr_meta_save"), "pre-slots backup kept verbatim");
  assert.equal(S().cur.scrap, 77, "live save is untouched by migration");
}

// 2) New game in an empty slot switches, snapshotting the old slot first
{
  const { A, SaveSlots, w, S, urls } = boot({ cur:{ scrap:5, dataCores:0, signals:0, chips:0 } });
  A.go("base"); A.openProfiles();
  S().cur.scrap = 999; // unsaved live progress on slot 1
  A.profileNewGame(1);
  assert.equal(urls.length, 1, "new game triggers a reload");
  const meta = SaveSlots.readMeta(w.localStorage);
  assert.equal(meta.active, 1, "slot 2 is now active");
  assert.equal(JSON.parse(SaveSlots.readSlotRaw(w.localStorage, 0)).cur.scrap, 999, "slot 1 snapshot captured the live scrap before leaving");
  assert.equal(JSON.parse(w.localStorage.getItem("pr_meta_save")).cur.scrap, 20, "live save is now slot 2's fresh state");
  const selected = w.localStorage.getItem("pr_meta_save");
  w.dispatchEvent(new w.Event("beforeunload"));
  assert.equal(w.localStorage.getItem("pr_meta_save"), selected, "beforeunload must not overwrite the selected new game's save with the departing slot");
}

// 3) deleting a non-active slot needs no reload and clears its data
{
  const { A, SaveSlots, w, urls } = boot({ cur:{ scrap:5, dataCores:0, signals:0, chips:0 } });
  A.go("base"); A.openProfiles();
  w.confirm = () => true;
  A.profileSaveHere(1); // clone current progress into slot 2 without switching
  assert(SaveSlots.readMeta(w.localStorage).slots[1], "slot 2 now has data");
  A.profileDelete(1);
  assert.equal(urls.length, 0, "deleting a non-active slot never reloads");
  assert.equal(SaveSlots.readMeta(w.localStorage).slots[1], null, "slot 2 cleared");
  assert.equal(SaveSlots.readSlotRaw(w.localStorage, 1), null, "slot 2 data removed");
}

// 4) Load/New/Delete-active are disabled mid-raid; Delete on another slot stays enabled
{
  const { A, doc, session } = boot({ cur:{ scrap:5, dataCores:0, signals:0, chips:0 } });
  A.go("base"); A.openProfiles();
  A.profileSaveHere(1); // give slot 2 data so a LOAD button exists to check
  session().screen = "checkpoint"; // mid-raid
  A.openProfiles();
  const rows = doc.querySelectorAll(".profrow");
  const loadBtn = [...rows[1].querySelectorAll("button")].find(b => b.textContent === "LOAD");
  assert(loadBtn && loadBtn.disabled, "LOAD disabled during a raid");
  const deleteActive = [...rows[0].querySelectorAll("button")].find(b => b.textContent === "DELETE");
  assert(deleteActive && deleteActive.disabled, "DELETE on the active slot disabled during a raid");
  const deleteOther = [...rows[1].querySelectorAll("button")].find(b => b.textContent === "DELETE");
  assert(deleteOther && !deleteOther.disabled, "DELETE on a non-active slot stays enabled during a raid");
  session().screen = "base";
}

// 5) Regression: NEW GAME in another slot must start raid-first FTUE. Switching back to
// a legacy save must not inherit its marker; loading the new slot restores the raid-first path.
function storageSnapshot(w){
  const saved = {};
  for(let i=0;i<w.localStorage.length;i++){
    const key = w.localStorage.key(i);
    saved[key] = w.localStorage.getItem(key);
  }
  return saved;
}
{
  const original = boot({ introSeen:false, raids:0 }); // old legacy save, no FTUE marker
  assert.equal(original.w.localStorage.getItem("pr_ftue_v1"), null);
  original.A.openProfiles();
  original.A.profileNewGame(1);
  assert.equal(JSON.parse(original.w.localStorage.getItem("pr_ftue_v1")).step, "start", "NEW GAME creates FTUE tracking even when the previous slot already had a save");
  assert.equal(original.w.localStorage.getItem("pr_slot_1_ftue_v1"), original.w.localStorage.getItem("pr_ftue_v1"), "new slot gets its own FTUE marker");

  const fresh = boot(null, storageSnapshot(original.w));
  assert.equal(fresh.urls.length, 0, "fresh slot launches after the splash, not before it finishes");
  fresh.A.openProfiles();
  fresh.A.profileLoad(0);
  const legacy = boot(null, storageSnapshot(fresh.w));
  assert.equal(legacy.w.localStorage.getItem("pr_ftue_v1"), null, "legacy profile never inherits the new game's FTUE marker");
  legacy.w.dispatchEvent(new legacy.w.Event("pr:splash-finished"));
  assert.equal(legacy.urls.length, 0, "legacy save does not auto-launch another raid");
  assert(legacy.doc.getElementById("app").textContent.includes("PROTOCOL REBIRTH"), "legacy save keeps its pre-existing intro");

  legacy.A.openProfiles();
  legacy.A.profileLoad(1);
  const restored = boot(null, storageSnapshot(legacy.w));
  assert(restored.w.localStorage.getItem("pr_ftue_v1"), "loading the new slot restores its FTUE marker");
  restored.w.dispatchEvent(new restored.w.Event("pr:splash-finished"));
  const raidUrl = new restored.w.URL(restored.urls.at(-1), "http://localhost/");
  assert.equal(raidUrl.searchParams.get("ftue"), "1", "new profile enters its dedicated FTUE raid");
  assert.equal(raidUrl.searchParams.get("intro"), "1", "first raid gets the scripted intro encounter");
  assert(restored.urls.at(-1).includes("/nodspel/"), "first playable destination is the raid, not BIT or the bunker");
}

// 6) Copies, deletes and imports must not leave orphaned FTUE flags attached to a slot.
{
  const first = boot(null);
  first.A.openProfiles();
  first.A.profileSaveHere(1);
  assert.equal(first.w.localStorage.getItem("pr_slot_1_ftue_v1"), first.w.localStorage.getItem("pr_ftue_v1"), "save-copy carries the profile's FTUE tracking");
  first.w.confirm = () => true;
  first.A.profileDelete(1);
  assert.equal(first.w.localStorage.getItem("pr_slot_1_ftue_v1"), null, "deleting a slot removes its FTUE marker");
  first.A.profileImport(JSON.stringify(Object.assign({}, freshSave, {introSeen:true, raids:2})), 1);
  assert.equal(first.w.localStorage.getItem("pr_slot_1_ftue_v1"), null, "imported profile does not inherit FTUE tracking");
}

console.log("profiles-ui.test: ok");
