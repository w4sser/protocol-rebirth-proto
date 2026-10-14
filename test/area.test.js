// v1.47.0: the base lobby picks the Node Raid area and passes it to the core (&area=).
const { JSDOM } = require("jsdom");const fs = require("fs");const assert = require("assert");const path = __dirname + "/..";
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window;if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js"]) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  const urls=[];w.PR_NAVIGATE=u=>urls.push(u);
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, areaUnlocked, applyAreaProgress, areaReqs };");
  return { w, A:w.A, S:()=>w.__T.S(), urls };
}
{ const { w, A, S, urls } = boot(); A.dismissIntro();
  A.deployNodeRaid(); assert.match(urls[0], /[?&]area=bunker(&|$)/, "default deploy is Bunker");
  A.setArea("town"); assert.notEqual(S().area, "town", "locked Town cannot be selected");
  A.setArea("archipelago"); assert.notEqual(S().area, "archipelago", "locked Archipelago cannot be selected");
  // legacy save that had Town selected: not grandfathered, falls back to Bunker
  S().area = "town"; A.deployNodeRaid(); assert.match(urls[1], /area=bunker/, "locked legacy area falls back to Bunker");
  // step 1: core level alone is not enough
  S().modules.rebirth_core = 2; assert.equal(w.__T.areaUnlocked('archipelago'), false, "core 2 alone does not unlock");
  // step 2: a scouting extract carrying the chart (from a bunker raid that cleared 3 zones)
  const notes = w.__T.applyAreaProgress('bunker', 3, ['archipelago_chart']);
  assert(notes.some(n => /Archipelago scouted — UNLOCKED/.test(n)), notes.join("|"));
  assert.deepEqual(S().areaZones.bunker, [1,2,3], "bunker zones lit");
  A.setArea("archipelago"); assert.equal(S().area, "archipelago"); A.deployNodeRaid(); assert.match(urls[2], /area=archipelago/);
  assert.equal(S().coreLaunch.area, "archipelago", "launch remembers area");
  // town: survey before core 3 records the scout but stays locked
  w.__T.applyAreaProgress('archipelago', 1, ['town_survey']);
  assert.equal(w.__T.areaUnlocked('town'), false, "town needs core 3");
  const req = w.__T.areaReqs('town'); assert.equal(req[0][1], false); assert.equal(req[1][1], true, "scout step shown done");
  S().modules.rebirth_core = 3; assert.equal(w.__T.areaUnlocked('town'), true);
  assert.deepEqual(S().areaZones.archipelago, [1]);
  const saved = JSON.parse(JSON.stringify(S())); w.localStorage.setItem("pr_meta_save", JSON.stringify(saved));
  const b = boot(saved); b.A.deployNodeRaid(); assert.match(b.urls[0], /area=archipelago/, "survives reload");
  const st = JSON.parse(JSON.stringify(S())); Object.assign(st.modules,{fabricator:1,bit_bay:1}); st.baseState="core_habitable"; st.roomUnlocks={fabricator:true,storage:true,bit_bay:true}; st.introSeen=true; st.areaScouted={archipelago:true}; st.modules.rebirth_core=2;
  const c = boot(st); c.A.go("prep"); let html = c.w.document.body.innerHTML;
  assert(/map-open/.test(html) && !/data-area="town"/.test(html), "lobby shows the world map button, not the old toggle");
  c.A.go("worldmap"); html = c.w.document.body.innerHTML;
  assert(/class="worldmap"/.test(html) && /world_placeholder\.svg/.test(html), "map screen with swappable background");
  assert(/wm-region locked" data-area="town"/.test(html) && /🔒/.test(html) && /Rebirth Core L3/.test(html) && /Town Survey/.test(html), "town fogged with lock + requirement");
  assert(/wm-back/.test(html), "back button");
  assert.equal((html.match(/<i class="wm-zone/g) || []).length, 6, "zones shown for the 2 open areas");
  c.A.setArea("archipelago"); assert.equal(c.S().area, "archipelago");
  // debug unlock
  const d = boot(); d.A.debugUnlockAreas(); assert.equal(d.w.__T.areaUnlocked('town'), true, "debug unlock");
  // scouting items are consumed on extract, not stashed
  const items = fs.readFileSync(path + "/data/items.js", "utf8"); assert(/scouts:"archipelago"/.test(items) && /scouts:"town"/.test(items)); }
// core honours the URL param (it wins over the remembered localStorage choice)
{ const g = fs.readFileSync(path + "/nodspel/game.mjs", "utf8"); assert(/AREA_PARAM\|\|/.test(g) && /Town failed to load/.test(g), "core reads area and shows a fallback notice"); }
console.log("WORLD MAP / AREA TEST PASSED");
