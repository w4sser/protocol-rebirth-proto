// v1.77 stash: sell/recycle popup, quest/FIR warnings, free weapon, OVERFLOW quick-clean, usage icons, stash expansion.
const { JSDOM } = require("jsdom"), fs = require("fs"), assert = require("assert"), path = __dirname + "/..";
const DATA_FILES = ["data/items.js","data/modules.js","data/bit.js","data/raid_zones.js","data/recipes.js","data/vendors.js","data/retention.js","data/quests.js","data/progression.js","data/combat.js"];
function boot(save){
  const dom = new JSDOM(fs.readFileSync(path + "/index.html", "utf8"), { runScripts:"outside-only", url:"http://localhost/index.html", pretendToBeVisual:true });
  const w = dom.window; if(save) w.localStorage.setItem("pr_meta_save", JSON.stringify(save));
  for(const s of DATA_FILES) w.eval(fs.readFileSync(path + "/" + s, "utf8"));
  w.PR_NAVIGATE = () => {};
  w.eval(fs.readFileSync(path + "/app.js", "utf8") + "\n;window.__T={ S:()=>S, stashCapacity, stashSlotsUsed, stashWarnings, quickCleanList, firHave };");
  return { w, A:w.A, S:() => w.__T.S(), T:w.__T, d:w.document, D:w.DATA };
}
const g = boot(null); g.A.dismissIntro();
const base = JSON.parse(JSON.stringify(g.S()));
Object.assign(base.modules, { rebirth_core:1, fabricator:1, bit_bay:1, storage:1 }); base.baseState = "core_habitable"; base.introSeen = true;
base.roomUnlocks = { fabricator:true, storage:true, bit_bay:true }; base.beat = g.D.progression.beats.length - 1; base.cur.scrap = 0;
const click = (b, sel) => { const el = b.d.querySelector(sel); assert(el, "missing " + sel); if(el.disabled) return; const oc = el.getAttribute("onclick"); if(oc) b.w.eval(oc); else el.dispatchEvent(new b.w.MouseEvent("click", { bubbles:true })); }; // jsdom (outside-only) does not run inline handlers
const fresh = () => { const b = boot(JSON.parse(JSON.stringify(base))); b.S().stash = {}; b.S().fir = {}; b.S().reserved = {}; b.S().secureItem = null; b.S().tracked = null; b.A.go("stash"); return b; };

// ---- stash expansion: capacity is data-driven per Storage level ----
{ const b = fresh(), D = b.D, sl = D.modules.find(m => m.id === "storage").levels;
  assert(sl.every(l => l.stashSlots > 0), "every Storage level expands the stash");
  let cap = D.baseStashCapacity; assert.equal(D.stashCapacityFor(0), cap);
  sl.forEach(l => { cap += l.stashSlots; assert.equal(D.stashCapacityFor(l.level), cap, "capacity at Storage L" + l.level); assert(/stash expansion/i.test(l.unlockText), "L" + l.level + " unlock text names the expansion"); });
  for(const lvl of [0, 1, 2, 3]){ b.S().modules.storage = lvl; assert.equal(b.T.stashCapacity(), D.stashCapacityFor(lvl)); }
  assert(D.stashCapacityFor(3) > D.stashCapacityFor(1), "L3 holds more than L1"); }

// ---- recycle map sanity ----
{ const D = g.D, ids = new Set(D.items.map(i => i.id));
  for(const [id, r] of Object.entries(D.recycleTo)){
    assert(ids.has(id) && ids.has(r.to) && r.qty >= 1 && r.to !== id, id + " recycles to a real material");
    let hops = 0, cur = r.to; while(D.recycleTo[cur] && hops++ < 10) cur = D.recycleTo[cur].to; assert(hops < 10 && cur === "scrap_alloy", id + ": chains end in Scrap Alloy, never loop");
    const it = D.items.find(i => i.id === id), to = D.items.find(i => i.id === r.to);
    assert(to.sellValue * r.qty < it.sellValue, id + ": recycling is lossy");
    assert(!it.free && !it.weapon && !it.slot, id + ": gear is not recyclable");
  }
  assert.equal(D.recycleTo.cable.to, "scrap_alloy"); assert(D.recycleBlockReason("basic_carbine")); assert(D.recycleBlockReason("neural_core")); }

// ---- tile opens the shared popup, sell qty + ALL, recycle -> material ----
{ const b = fresh(), S = b.S; S().stash = { cable:7, servo:3 };
  b.A.go("stash"); click(b, '.slot[onclick*="cable"]');
  const card = b.d.querySelector("#overlay .pop-card");
  assert(card && card.firstElementChild.classList.contains("pop-x"), "shared popup with the top-left X");
  click(b, '[onclick="A.stashQty(1)"]'); click(b, '[onclick="A.stashQty(1)"]');
  assert.equal(b.d.querySelector(".sp-qty b").textContent, "3");
  click(b, '[onclick="A.stashAct(\'sell\')"]');
  assert.equal(S().stash.cable, 4, "sold 3"); assert.equal(S().cur.scrap, 3 * Math.floor(25 * b.D.vendors[0].sellMultiplier));
  assert(!b.d.getElementById("overlay"), "popup closes after selling");
  // whole stack via ALL
  b.A.openStashItem("cable"); click(b, '[onclick="A.stashQty(0)"]'); assert.equal(b.d.querySelector(".sp-qty b").textContent, "4");
  click(b, '[onclick="A.stashQty(1)"]'.replace("1", "1")); // capped: disabled button does nothing harmful
  click(b, '[onclick="A.stashAct(\'recycle\')"]');
  assert(!S().stash.cable, "stack recycled"); assert.equal(S().stash.scrap_alloy, 4, "recycled into the base material, 1:1"); assert.equal(S().cur.scrap, 3 * Math.floor(25 * 0.6), "recycle gives no Scrap");
  // stepper never exceeds the owned qty
  b.A.openStashItem("servo"); for(let i = 0; i < 6; i++) b.A.stashQty(1); assert.equal(b.d.querySelector(".sp-qty b").textContent, "3");
  b.A.recycle("servo", 99); assert(!S().stash.servo && S().stash.scrap_alloy === 10, "qty capped at owned"); }

// ---- unrecyclable: disabled with a reason; reserved blocks both ----
{ const b = fresh(); b.S().stash = { neural_core:1, scrap_alloy:3, servo:2 }; b.S().reserved.servo = true; b.A.go("stash");
  b.A.openStashItem("neural_core"); const r = b.d.querySelector('[onclick="A.stashAct(\'recycle\')"]'); assert(r.disabled, "recycle disabled"); assert(/valuable/i.test(b.d.querySelector(".sp-why").textContent));
  b.A.recycle("neural_core", 1); assert.equal(b.S().stash.neural_core, 1, "recycle refuses");
  b.A.openStashItem("scrap_alloy"); assert(/base material/i.test(b.d.querySelector(".sp-why").textContent));
  b.A.openStashItem("servo"); assert(b.d.querySelector('[onclick="A.stashAct(\'sell\')"]').disabled, "reserved: no sell"); }

// ---- free Basic Carbine: info only, never sold or recycled ----
{ const b = fresh(); b.S().stash = { cable:1 }; b.A.go("stash"); click(b, '.slot.free');
  assert(b.d.querySelector("#overlay .pop-card"), "info popup"); assert(!b.d.querySelector('[onclick^="A.stashAct"]'), "no sell/recycle actions");
  b.A.sell("basic_carbine", 1); b.A.recycle("basic_carbine", 1); assert.equal(b.S().cur.scrap, 0); assert(!b.S().stash.basic_carbine); }

// ---- quest / FIR warning ----
{ const b = fresh(), S = b.S; S().chains = { bunker:{ step:2, prog:0 } }; // B3 Spare Parts: 2 Scrap Alloy + 1 Polymer Plate (found in raid)
  S().stash = { scrap_alloy:5, polymer_plate:1 }; S().fir = { scrap_alloy:2, polymer_plate:1 }; b.A.go("stash");
  assert(b.T.stashWarnings("scrap_alloy", 1).length === 0 || b.D.questChains.bunker.steps[2].objective.items.scrap_alloy, "sanity");
  assert.equal(b.T.stashWarnings("scrap_alloy", 3).length, 0, "3 left of 5, 2 FIR copies kept: safe");
  assert.equal(b.T.stashWarnings("scrap_alloy", 4).length, 1, "would drop below the 2 FIR copies the hand-in needs");
  assert(/found-in-raid/.test(b.T.stashWarnings("polymer_plate", 1)[0]));
  b.A.openStashItem("polymer_plate"); click(b, '[onclick="A.stashAct(\'sell\')"]');
  assert(b.d.querySelector(".sp-warn"), "confirm step inside the popup"); assert.equal(S().stash.polymer_plate, 1, "nothing sold before confirming");
  click(b, '[onclick="A.stashBack()"]'); assert.equal(S().stash.polymer_plate, 1); assert(b.d.querySelector(".sp-qty"), "cancel returns to the item");
  click(b, '[onclick="A.stashAct(\'sell\')"]'); click(b, '[onclick="A.stashConfirm()"]'); assert(!S().stash.polymer_plate, "sold after confirm"); }
{ const b = fresh(); b.S().stash = { cable:6 }; b.S().tracked = { module:"fabricator", level:1 };
  const need = (b.D.modules.find(m => m.id === "fabricator").levels[0].cost.items || {}).cable;
  if(need) assert(b.T.stashWarnings("cable", 6 - need + 1).some(x => /Tracked upgrade/.test(x)), "tracked upgrade warns"); }

// ---- OVERFLOW becomes a quick-clean button ----
{ const b = fresh(), S = b.S, cap = b.T.stashCapacity();
  assert(!b.d.querySelector(".ovf-btn"), "no OVERFLOW while it fits");
  S().stash = { cable:10, fuse:10, scrap_alloy:20, servo:10, med_gel:10, bio_sample:10, power_cell:5, neural_core:1 }; // 1+1+1+1+1+1+1+1 stacks...
  for(const id of ["polymer_plate","circuit_board","optical_sensor","memory_module","purification_filter","hydraulic_component","transmitter","power_relay","frost_glass","tidal_coil","prewar_relic"]) S().stash[id] = 20;
  S().secureItem = "power_cell"; S().reserved.fuse = true; S().chains = { bunker:{ step:2, prog:0 } }; S().fir = { polymer_plate:20 };
  b.A.go("stash"); assert(b.T.stashSlotsUsed() > cap, "forced overflow");
  const ob = b.d.querySelector(".ovf-btn"); assert(ob && /OVERFLOW/.test(ob.textContent), "OVERFLOW is a button"); assert.equal(ob.tagName, "BUTTON");
  const list = b.T.quickCleanList().map(r => r.id);
  for(const id of ["fuse", "power_cell", "neural_core", "polymer_plate", "basic_carbine"]) assert(!list.includes(id), id + " is never suggested (reserved/secure/quest/high value/free)");
  assert(list.includes("med_gel") && list.includes("bio_sample"));
  click(b, ".ovf-btn"); assert(b.d.querySelector("#overlay .pop-card .pop-x"), "quick clean uses the shared popup");
  assert(b.d.querySelectorAll(".qcrow.on").length >= 1, "defaults select enough to clear the overflow");
  const before = S().cur.scrap, usedBefore = b.T.stashSlotsUsed();
  click(b, '[onclick="A.quickCleanAsk()"]'); assert(b.d.querySelector(".sp-warn"), "batch sell asks for confirmation"); assert.equal(S().cur.scrap, before);
  click(b, '[onclick="A.quickCleanConfirm()"]'); assert(S().cur.scrap > before, "scrap gained"); assert(b.T.stashSlotsUsed() < usedBefore, "slots freed");
  assert(S().stash.fuse && S().stash.power_cell && S().stash.neural_core, "protected items kept"); }

// ---- usage icons on tiles, from existing data ----
{ const b = fresh(); b.S().stash = { cable:2, med_gel:2, transmitter:1, tidal_coil:1, core_ash:1 }; b.A.go("stash");
  const icons = id => [...b.d.querySelectorAll('.slot[onclick*="' + id + '"] .uses i')].map(i => i.className);
  assert(icons("cable").includes("u-build") && icons("cable").includes("u-shop") && icons("cable").includes("u-quest"), "cable: build + trader + quest");
  assert(icons("transmitter").includes("u-quest") && icons("transmitter").includes("u-shop"), "transmitter: quest hand-in + barter");
  assert(icons("tidal_coil").includes("u-chip"), "tidal coil: chip shop");
  assert.deepEqual(icons("core_ash"), [], "core ash has no use");
  assert(!/[←-⯿\u{1F000}-\u{1FFFF}]/u.test(b.d.querySelector(".uses").outerHTML), "no emoji"); }
console.log("stash tests ok"); process.exit(0);
