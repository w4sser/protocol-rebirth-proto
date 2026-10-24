// v1.82 T2 (PRB-90): room explain popups, Fabricator room craft, Living Quarters rest buff.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html" });
  const w = dom.window; let now = Date.UTC(2026, 9, 23, 12);
  w.Date.now = () => now;
  if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  const urls = []; w.PR_NAVIGATE = u => urls.push(u);
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, restBuff, canRest, powerValue };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, doc:w.document, urls };
}
const g0 = boot(null); g0.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g0.S()));
Object.assign(base.modules, { rebirth_core:2, fabricator:2, bit_bay:1, storage:1 });
base.baseState = "core_habitable"; base.introSeen = true; base.beat = g0.w.DATA.progression.beats.length - 1;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true, living_quarters:true };
base.power = { value:60, at:Date.UTC(2026, 9, 23, 12), offlineDrained:0, reinforceAt:0, lastRoom:null, maintain:null };
base.cur.scrap = 200;
base.stash = Object.assign({}, base.stash, { cable:3, polymer_plate:3, scrap_alloy:3, fuse:3, circuit_board:3 });

const D = g0.w.DATA;
for(const id of ["rebirth_core","fabricator","storage","bit_bay","living_quarters"]){
  const x = D.roomExplain[id]; assert(x && x.blurb && x.blurb.length < 100 && x.tiles.length >= 2 && x.tiles.length <= 3, "short explain for " + id);
}

// 1) explain popup: every room, locked and unlocked, shared popup + X, icons
{ const b = boot(Object.assign(JSON.parse(JSON.stringify(base)), { roomUnlocks:{} }));
  b.A.go("base");
  for(const id of ["fabricator","storage","bit_bay","living_quarters"]){
    b.doc.querySelectorAll("#overlay").forEach(o => o.remove());
    b.A.openRoom(id);
    const o = b.doc.querySelector("#overlay .bpop.pop-card"); assert(o, id + " locked opens shared popup");
    assert(o.querySelector(".pop-x"), id + " has X"); assert(o.querySelector(".rx p"), id + " blurb"); assert(o.querySelectorAll(".rxt svg").length >= 2, id + " icon tiles");
  }
}
{ const b = boot(base); b.A.go("base");
  for(const id of ["fabricator","storage","bit_bay","rebirth_core"]){
    b.doc.querySelectorAll("#overlay").forEach(o => o.remove());
    id === "rebirth_core" ? b.A.openBuilding(id) : b.A.openRoom(id);
    const o = b.doc.querySelector("#overlay .bpop.pop-card"); assert(o && o.querySelector(".pop-x"), id + " open popup");
    assert(o.querySelector(".rx") && o.querySelectorAll(".rxt svg").length >= 2, id + " explain on unlocked room");
  }
}

// 2) Fabricator room craft: decoy / grenade / EMP
{ const b = boot(base); b.A.go("base");
  b.A.openRoom("fabricator");
  const rows = id => b.doc.querySelector('#overlay .fabrow[data-recipe="' + id + '"]');
  for(const id of ["decoy_build","grenade_build","emp_build"]){ assert(rows(id), id + " listed"); assert(!rows(id).querySelector("button").disabled, id + " craftable"); }
  assert(b.doc.querySelector("#overlay .fabq"), "queue shown");
  const before = b.S().cur.scrap;
  assert(/A\.craft\('decoy_build'\)/.test(rows("decoy_build").querySelector("button").getAttribute("onclick"))); b.A.craft("decoy_build");
  assert.equal(((b.S().stash.tool_decoy || 0) + ((b.S().armory || {}).tool_decoy || 0)), 2, "first craft is instant");
  assert(b.S().cur.scrap < before);
  assert(b.doc.querySelector('#overlay .bpop[data-module="fabricator"]'), "popup stays open after craft");
  b.A.craft("grenade_build");
  assert.equal(b.S().idle.fab.length, 1, "second craft queues");
  assert(!((b.S().stash.tool_grenade || 0) + ((b.S().armory || {}).tool_grenade || 0)), "queued, not instant");
  b.A.craft("emp_build"); assert.equal(b.S().idle.fab.length, 2);
  b.A.craft("emp_build"); assert.equal(b.S().idle.fab.length, 3, "L2 has 3 slots"); b.A.craft("decoy_build"); assert.equal(b.S().idle.fab.length, 3, "queue cap respected");
}
{ // Fab L1: grenade/EMP shown gated, not craftable
  const s = JSON.parse(JSON.stringify(base)); s.modules.fabricator = 1;
  const b = boot(s); b.A.go("base"); b.A.openRoom("fabricator");
  const g = b.doc.querySelector('#overlay .fabrow[data-recipe="grenade_build"]'); assert(g && g.classList.contains("gated") && g.querySelector("button").disabled);
  const before = JSON.stringify(b.S().stash); b.A.craft("grenade_build"); assert.equal(JSON.stringify(b.S().stash), before, "gated craft refused");
}

// 3) Living Quarters rest
{ const b = boot(base); b.A.go("base");
  b.A.openRoom("living_quarters");
  assert(b.doc.querySelector('#overlay .bpop[data-module="living_quarters"] .pop-x'));
  assert(!/arrive beyond this prototype/.test(b.doc.body.textContent));
  const p0 = b.T.powerValue(); assert(b.T.canRest().ok);
  assert(/A\.rest\(\)/.test(b.doc.querySelector("#overlay button.primary.big").getAttribute("onclick"))); b.A.rest();
  assert(b.T.restBuff() && b.T.restBuff().shield === D.rest.buff.shield, "buff granted");
  assert.equal(b.T.powerValue(), p0 + D.rest.powerGain, "power restored");
  assert(b.doc.querySelector("#overlay .idlecard.rested"), "status shown");
  assert(b.doc.querySelector("#overlay button.primary.big").disabled, "no spam");
  assert.equal(b.T.canRest().reason, "rested");
  b.A.rest(); assert.equal(b.T.powerValue(), p0 + D.rest.powerGain, "second rest is a no-op");
  assert(b.S().rest.buff, "persisted in state"); JSON.parse(b.w.localStorage.getItem("pr_meta_save")).rest.buff.shield;
  // next raid consumes it and applies it to launch stats
  b.S().stash.weapon_basic = b.S().stash.weapon_basic || 1;
  b.A.deployNodeRaid();
  const url = b.urls[0]; assert(url, "raid launched");
  const shd = +/shd:(\d+)/.exec(decodeURIComponent(url))[1];
  assert(shd >= D.rest.buff.shield, "shield buff in launch stats: " + shd);
  assert.equal(b.T.restBuff(), null, "consumed on launch");
  assert(b.T.canRest().ok, "can rest again after the raid started");
  // a raid without the buff has lower shield
  b.A.deployNodeRaid(); const shd2 = +/shd:(\d+)/.exec(decodeURIComponent(b.urls[1]))[1];
  assert.equal(shd - shd2, D.rest.buff.shield, "buff is next-raid only");
}
{ // power shut off: Living Quarters will not rest
  const s = JSON.parse(JSON.stringify(base)); s.power.value = 4;
  const b = boot(s); b.A.go("base"); assert.equal(b.T.canRest().reason, "power");
  b.A.openRoom("living_quarters"); assert(!b.doc.querySelector('#overlay [data-module="living_quarters"]'), "power popup instead");
}
console.log("T2 LIVING BASE TEST PASSED"); process.exit(0);
