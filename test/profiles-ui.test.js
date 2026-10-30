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
function boot(patch){
  const w = newWindow();
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

console.log("profiles-ui.test: ok");
