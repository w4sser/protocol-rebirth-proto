// v1.83 T4 (PRB-91): gear upgrade popup in the Stash, costs, persistence, Basic Carbine path.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/bit-talents.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, SV:SAVE_VERSION, playerStats, masteredWeapon, weaponParam, gearLevel, gearBlock, gearCost, gearMax, load, migrateGearUp, nodeRaidGear:()=>nodeRaidGear(), removeItem };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; base.beat = g.D.progression.beats.length - 1;
base.cur.scrap = 500; base.stash = { smg_vector:1, scavenger_vest:1, scrap_alloy:5, servo:5, polymer_plate:5, cable:5, };
const fresh = () => { const b = boot(JSON.parse(JSON.stringify(base))); b.A.go("stash"); return b; };
const pop = b => b.d.querySelector("#overlay .bpop.gearpop");
const txt = (b, sel) => [...b.d.querySelectorAll(sel)].map(e => e.textContent).join("|");

// 1) popup opens for weapon, vest and the free carbine; shared popup + X; effect tiles
for(const [id, stats] of [["smg_vector", ["damage","firerate","mag","range"]], ["scavenger_vest", ["shield"]], ["basic_carbine", ["damage","firerate","mag","range"]]]){
  const b = fresh(); b.A.openStashItem(id);
  const p = pop(b); assert(p, id + " opens gear popup"); assert(p.classList.contains("pop-card") && p.querySelector(".pop-x"), id + " shared popup + X");
  assert.deepEqual([...p.querySelectorAll(".rtile,.wbar")].map(t => t.dataset.stat), stats, id + " effect tiles");
  assert(p.querySelector("button.primary"), id + " upgrade button"); assert(p.querySelector(".gu-cost"), id + " cost readout");
  assert(p.querySelector(".gu-lvl"), id + " level shown");
}
// non-gear keeps the sell popup
{ const b = fresh(); b.A.openStashItem("cable"); assert(!pop(b)); assert(b.d.querySelector("#overlay .bpop.stashpop .sp-qty"), "sell popup unchanged"); }

// 2) upgrade spends scrap + materials, bumps level and tiles
{ const b = fresh(), S = () => b.S();
  b.A.openStashItem("smg_vector");
  const before = txt(b, ".gearpop .rtile b, .gearpop .wbar b"), c = b.T.gearCost("smg_vector", 1), scrap0 = S().cur.scrap, alloy0 = S().stash.scrap_alloy;
  assert.equal(b.T.gearBlock("smg_vector"), ""); b.w.eval(b.d.querySelector(".gearpop button.primary").getAttribute("onclick"));
  assert.equal(b.T.gearLevel("smg_vector"), 1); assert.equal(S().gearUp.smg_vector, 1);
  assert.equal(S().cur.scrap, scrap0 - c.scrap); assert.equal(S().stash.scrap_alloy, alloy0 - c.items.scrap_alloy);
  assert(S().log.some(l => l.action === "GEAR_UPGRADED" && l.payload.id === "smg_vector"), "GEAR_UPGRADED logged");
  assert.notEqual(txt(b, ".gearpop .rtile b, .gearpop .wbar b"), before, "tiles changed"); assert(/LEVEL 1\//.test(pop(b).textContent), "popup rerendered at L1");
  const w0 = b.T.masteredWeapon("smg_vector", 0), w1 = b.T.masteredWeapon("smg_vector");
  assert(w1.int < w0.int, "fire rate up"); assert(/dmg:1/.test(b.T.weaponParam("smg_vector")));
  b.A.gearUpgrade("smg_vector"); assert.equal(b.T.gearLevel("smg_vector"), 2);
  assert.equal(b.T.masteredWeapon("smg_vector").dmg, 2, "L2 adds damage");
  assert(/dmg:2/.test(b.T.weaponParam("smg_vector")), "weaponParam carries the upgrade to the raid");
}
// 3) vest: shield in playerStats and gear at risk
{ const b = fresh(); const s0 = b.T.playerStats(["scavenger_vest"]).shield;
  b.A.gearUpgrade("scavenger_vest"); const s1 = b.T.playerStats(["scavenger_vest"]).shield;
  assert.equal(s1 - s0, b.D.progression.gearUpgrade.armor.shieldPerLevel, "shield per level");
  b.A.openStashItem("scavenger_vest"); assert(/SHIELD/.test(pop(b).textContent) && /33/.test(txt(b, ".gearpop .rtile b, .gearpop .wbar b")));
}
// 4) unaffordable / max
{ const b = fresh(); b.S().cur.scrap = 0; b.A.openStashItem("smg_vector");
  const btn = b.d.querySelector(".gearpop button.primary"); assert(btn.disabled, "disabled when unaffordable"); assert(/Need/.test(b.d.querySelector(".gearpop .sp-why").textContent));
  b.A.gearUpgrade("smg_vector"); assert.equal(b.T.gearLevel("smg_vector"), 0, "no free upgrade");
  assert.equal(b.S().cur.scrap, 0);
  b.S().cur.scrap = 9999; b.S().stash.servo = 20; b.S().stash.scrap_alloy = 20;
  for(let i = 0; i < 5; i++) b.A.gearUpgrade("smg_vector");
  assert.equal(b.T.gearLevel("smg_vector"), b.T.gearMax("smg_vector"));
  b.A.openStashItem("smg_vector"); const m = b.d.querySelector(".gearpop button.primary"); assert(m.disabled && /MAX/.test(m.textContent), "max disabled");
  const s = b.S().cur.scrap; b.A.gearUpgrade("smg_vector"); assert.equal(b.S().cur.scrap, s, "max spends nothing");
}
// 5) Basic Carbine: light rate-only upgrade + mastery UI, free forever
{ const b = fresh(); b.S().mastery = { basic_carbine:12 }; b.A.openStashItem("basic_carbine");
  assert(pop(b).querySelector(".gu-mastery .stars"), "mastery stars shown"); assert(/kills to next star/.test(pop(b).textContent));
  assert.equal(b.T.gearMax("basic_carbine"), 2);
  const w0 = b.T.masteredWeapon("basic_carbine"); b.A.gearUpgrade("basic_carbine");
  const w1 = b.T.masteredWeapon("basic_carbine"); assert(w1.int < w0.int && w1.dmg === w0.dmg, "carbine: rate only");
  assert.equal(b.S().stash.basic_carbine, undefined, "still never stored");
}
// 6) persistence + migration; level survives raid loss (keyed by id)
{ const b = fresh(); b.A.gearUpgrade("scavenger_vest"); b.A.gearUpgrade("scavenger_vest");
  const saved = JSON.parse(b.w.localStorage.getItem("pr_meta_save")); assert.equal(saved.v, b.T.SV); assert.equal(saved.gearUp.scavenger_vest, 2);
  const r = boot(saved); assert.equal(r.T.gearLevel("scavenger_vest"), 2, "reload keeps level");
  r.T.removeItem("scavenger_vest", 1); assert.equal(r.T.gearLevel("scavenger_vest"), 2, "lost gear keeps level (keep-by-id)");
  const old = JSON.parse(JSON.stringify(saved)); old.v = 10; delete old.gearUp;
  const m = boot(old); assert.equal(m.S().v, m.T.SV); assert.deepEqual(m.S().gearUp, {}, "v10 save migrates additively"); assert.equal(m.S().cur.scrap, saved.cur.scrap);
}
assert.equal(g.T.SV, 14);
console.log("t4-gear-upgrade ok"); process.exit(0);
