// v1.69.2: a newly unlocked world-map area is obvious: NEW badge, tab alert, zoom-in on open, seen flag persisted.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), root = __dirname + "/..";
const files = ["items","modules","bit","bit-talents","raid_zones","recipes","vendors","retention","quests","progression","combat"];
function boot(save, url){
  const dom = new JSDOM(fs.readFileSync(root + "/index.html", "utf8"), { runScripts:"outside-only", url:url || "http://localhost/index.html" });
  const w = dom.window, raf = []; w.requestAnimationFrame = f => (raf.push(f), raf.length); w.cancelAnimationFrame = () => {};
  for(const f of files) w.eval(fs.readFileSync(root + "/data/" + f + ".js", "utf8"));
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(root + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, session:()=>session, wmNewUnlockTarget, areaUnlocked, wmFitUnlock };");
  w.A.dismissIntro();
  const flush = () => { let t = 0, n = 400; while(raf.length && n--){ t += 100; raf.shift()(t); } };
  return { w, d:w.document, T:w.__T, A:w.A, flush };
}
const prime = b => { const S = b.T.S(); S.baseState = b.w.DATA.baseStates[b.w.DATA.baseStates.length - 1].id; S.introSeen = true; S.beat = b.w.DATA.progression.beats.length - 1; };
const unlock = b => { prime(b); const S = b.T.S(); S.modules.rebirth_core = 2; S.areaScouted = { archipelago:true }; };
const tabAlert = b => { const cur = b.T.session().screen; b.A.go("worldmap"); const r = !!b.d.querySelector("#tabs .nav-prep .badge.alert"); b.A.go(cur); return r; };
{ // not shown before unlock
  const b = boot(); prime(b); b.A.go("prep"); assert.equal(b.T.wmNewUnlockTarget(), null);
  assert(!tabAlert(b) && !b.d.querySelector(".new-tag"), "no NEW before unlock");
  b.A.go("worldmap"); assert(!b.d.querySelector(".wm-new"), "no NEW label before unlock"); }
{ // shown after unlock; cleared by selecting; persisted across reload
  const b = boot(); unlock(b); b.A.go("prep");
  assert.equal(b.T.wmNewUnlockTarget(), "archipelago");
  assert(tabAlert(b), "! on the RAID tab"); assert(b.d.querySelector(".area-pick.map-open .new-tag"), "NEW on the map button");
  b.A.go("worldmap");
  assert(b.d.querySelector('.wm-label[data-label="archipelago"] .wm-new'), "NEW on the label");
  assert(b.d.querySelector('.wm-region[data-area="archipelago"].fresh'), "region highlighted");
  assert(!b.d.querySelector('.wm-label[data-label="bunker"] .wm-new'), "only the new area");
  b.A.go("prep"); assert(tabAlert(b), "opening the map is not seeing it");
  b.A.setArea("archipelago"); assert.equal(b.T.wmNewUnlockTarget(), null);
  assert(!b.d.querySelector(".wm-new"), "label cleared"); assert(!b.d.querySelector(".new-tag"), "map button cleared"); assert(!tabAlert(b), "tab cleared");
  const saved = JSON.parse(b.w.localStorage.getItem("pr_meta_save")); assert.equal(saved.areaSeen.archipelago, true);
  const re = boot(saved); re.A.go("worldmap"); assert.equal(re.T.wmNewUnlockTarget(), null, "stays seen after reload"); assert(!re.d.querySelector(".wm-new")); }
{ // debug access does not mark an area seen; the later real unlock still shows NEW
  const b = boot(); prime(b); const S = b.T.S(); S.debugAreas = true; b.A.setArea("archipelago");
  assert(!(S.areaSeen && S.areaSeen.archipelago), "debug select leaves it unseen");
  S.debugAreas = false; S.modules.rebirth_core = 2; S.areaScouted = { archipelago:true };
  assert.equal(b.T.wmNewUnlockTarget(), "archipelago"); }
{ // tapping the label marks it seen too
  const b = boot(); unlock(b); b.A.go("worldmap"); b.w.eval(b.d.querySelector('.wm-label[data-label="archipelago"]').getAttribute("onclick")); // jsdom (outside-only) does not run inline handlers
  assert.equal(b.T.wmNewUnlockTarget(), null); }
{ // old save (no areaSeen) with the area already open: no surprise NEW
  const b = boot(); unlock(b); b.A.go("prep"); const old = JSON.parse(JSON.stringify(b.T.S())); delete old.areaSeen;
  const re = boot(old); re.A.go("prep"); assert.equal(re.T.areaUnlocked("archipelago"), true);
  assert.equal(re.T.wmNewUnlockTarget(), null); assert(!tabAlert(re) && !re.d.querySelector(".new-tag"));
  const half = JSON.parse(JSON.stringify(old)); half.areaScouted = {}; const re2 = boot(half); re2.T.S().areaScouted = { archipelago:true };
  assert.equal(re2.T.wmNewUnlockTarget(), "archipelago", "unlocked after load still shows NEW"); }
{ // debug areas never badge
  const b = boot(); prime(b); b.A.debugUnlockAreas(true); b.A.go("prep"); assert.equal(b.T.wmNewUnlockTarget(), null); assert(!tabAlert(b));
  b.A.go("worldmap"); assert(!b.d.querySelector(".wm-new"));
  const q = boot(null, "http://localhost/index.html?debug"); q.A.go("worldmap"); assert.equal(q.T.wmNewUnlockTarget(), null); assert(!q.d.querySelector(".wm-new")); }
{ // zoom-in: starts at the selected area, glides to the new area once, then settles; pan afterwards is free
  const b = boot(); unlock(b); b.A.go("worldmap");
  const cam = b.T.session().wmCam, D = b.w.DATA.worldMap, T = D.areas.find(a => a.id === "archipelago").region, B = D.areas[0].region;
  assert.equal(b.T.wmNewUnlockTarget(), "archipelago");
  assert(cam.intro && cam.intro.area === "archipelago" && cam.fx < (T.x + T.w / 2) / 100 - 0.1 && cam.z === 1.4, "starts at the selected area default framing, glide pending");
  b.flush(); assert.equal(cam.intro, null, "glide finished"); assert(cam.z > 1 && cam.z <= D.newUnlockZoom.z + 1e-6, "fit zoom " + cam.z);
  assert(Math.abs(cam.fx - (T.x + T.w / 2) / 100) < 0.02 && cam.fy * 100 > T.y && cam.fy * 100 < T.y + T.h + 12, "centred on the new area"); }
{ // framing: region + label card fit the visible box (viewport minus chrome) with padding, at the largest zoom that allows it
  const b = boot(), D = b.w.DATA.worldMap, A = D.areas.find(a => a.id === "archipelago"), lbl = { w:150, h:70 }, pad = D.newUnlockZoom.pad;
  assert(pad > 0, "pad is data-driven");
  for(const [vw, vh, ins] of [[844, 280, { t:0, r:0, b:0, l:0 }], [667, 265, { t:0, r:0, b:0, l:0 }], [932, 300, { t:0, r:30, b:0, l:20 }]]){
    const F = b.T.wmFitUnlock(vw, vh, ins, A.region, A.label, lbl, { z:D.newUnlockZoom.z, pad }), x = F.box;
    const cx = (x.x0 + x.x1) / 2, ax = ins.l + (vw - ins.l - ins.r) / 2, ay = ins.t + (vh - ins.t - ins.b) / 2, cy = (x.y0 + x.y1) / 2;
    assert(x.x1 - x.x0 <= vw - ins.l - ins.r - 2 * pad + 1e-6 && x.y1 - x.y0 <= vh - ins.t - ins.b - 2 * pad + 1e-6, vw + "x" + vh + " region+label fit");
    // screen position of the union box given the camera: must sit inside the visible box
    const sx = v => vw / 2 + v - F.fx * x.s, sy = v => vh / 2 + v - F.fy * x.sh;
    assert(sx(x.x0) >= ins.l + pad - 1e-6 && sx(x.x1) <= vw - ins.r - pad + 1e-6 && sy(x.y0) >= ins.t + pad - 1e-6 && sy(x.y1) <= vh - ins.b - pad + 1e-6, vw + "x" + vh + " box inside visible area");
    assert(Math.abs(sx(cx) - ax) < 1e-6 && Math.abs(sy(cy) - ay) < 1e-6, "centred in the visible area");
    // label sits below the region's own area (anchor below) and the region top is covered by the box
    assert(x.y0 <= A.region.y * x.sh / 100 + 1e-6 && x.y1 >= A.label.y * x.sh / 100 + lbl.h - 1e-6, "box covers region top and label bottom"); }
}
{ const b = boot(); unlock(b); b.A.go("worldmap"); b.flush(); b.A.go("prep"); assert.equal(b.T.wmNewUnlockTarget(), "archipelago", "still unseen"); }
{ // reduced motion jumps directly
  const b = boot(); unlock(b); b.w.matchMedia = () => ({ matches:true }); b.A.go("worldmap");
  const cam = b.T.session().wmCam, T = b.w.DATA.worldMap.areas[1].region;
  assert.equal(cam.intro, null); assert(Math.abs(cam.fx - (T.x + T.w / 2) / 100) < 0.02, "jumped without animation"); }
console.log("MAP NEW UNLOCK PASSED");
