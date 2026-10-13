// v1.39.2: the base lobby picks the Node Raid area and passes it to the core (&area=).
const { JSDOM } = require("jsdom");const fs = require("fs");const assert = require("assert");const path = __dirname + "/..";
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window;if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/progression.js","data/combat.js"]) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  const urls=[];w.PR_NAVIGATE=u=>urls.push(u);
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S };");
  return { w, A:w.A, S:()=>w.__T.S(), urls };
}
{ const { w, A, S, urls } = boot(); A.dismissIntro();
  A.deployNodeRaid(); assert.match(urls[0], /[?&]area=bunker(&|$)/, "default deploy is Bunker");
  A.setArea("town"); assert.equal(S().area, "town"); A.deployNodeRaid(); assert.match(urls[1], /[?&]area=town(&|$)/, "town passes &area=town");
  A.setArea("moon"); assert.equal(S().area, "town", "unknown area ignored");
  const saved = JSON.parse(w.localStorage.getItem("pr_meta_save")); assert.equal(saved.area, "town", "persisted in the save");
  const b = boot(saved); b.A.deployNodeRaid(); assert.match(b.urls[0], /area=town/, "survives reload");
  const st = JSON.parse(JSON.stringify(S())); Object.assign(st.modules,{rebirth_core:1,fabricator:1,bit_bay:1}); st.baseState="core_habitable"; st.roomUnlocks={fabricator:true,storage:true,bit_bay:true}; st.introSeen=true;
  const c = boot(st); c.A.go("prep"); const html = c.w.document.body.innerHTML;
   assert(/area-pick/.test(html) && /data-area="town"/.test(html), "lobby shows the area picker"); }
// core honours the URL param (it wins over the remembered localStorage choice)
{ const g = fs.readFileSync(path + "/nodspel/game.mjs", "utf8"); assert(/AREA_PARAM\|\|/.test(g) && /Town failed to load/.test(g), "core reads area and shows a fallback notice"); }
console.log("AREA PICKER TEST PASSED");
