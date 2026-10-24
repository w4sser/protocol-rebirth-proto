// Protocol Rebirth prototype — Fabricator recipes.
// Weapons come mainly from crafting + loot (v1.35). Costs climb T1 -> T3 materials.
// output: { itemId, qty } for items, or { currency, qty } for currency (Data Core synthesis).
window.DATA = window.DATA || {};
window.DATA.recipes = [
  { id:"medkit", name:"Medkit", fabricatorLevel:1,
    inputs:{ med_gel:2 }, scrapCost:10, output:{ itemId:"medkit", qty:1 } },
  { id:"bio_medkit", name:"Medkit (bio)", fabricatorLevel:1,
    inputs:{ bio_sample:1, med_gel:1 }, scrapCost:5, output:{ itemId:"medkit", qty:2 } },
  { id:"armor_patch", name:"Scavenger Vest", fabricatorLevel:1,
    inputs:{ polymer_plate:2, scrap_alloy:1 }, scrapCost:15, output:{ itemId:"scavenger_vest", qty:1 } },
  { id:"smg_build", name:"Vector SMG", fabricatorLevel:1, blueprint:true,
    inputs:{ scrap_alloy:3, servo:1, polymer_plate:1 }, scrapCost:40, output:{ itemId:"smg_vector", qty:1 } },
  { id:"shotgun_build", name:"Breach Shotgun", fabricatorLevel:2, blueprint:true,
    inputs:{ scrap_alloy:2, servo:2, hydraulic_component:1 }, scrapCost:60, output:{ itemId:"shotgun_breach", qty:1 } },
  { id:"rifle_build", name:"Marksman Rifle", fabricatorLevel:2, blueprint:true,
    inputs:{ optical_sensor:1, circuit_board:1, encrypted_drive:1, scrap_alloy:2 }, scrapCost:80, output:{ itemId:"rifle_marksman", qty:1 } },
  // v1.91 attachments (fitted from the weapon screen; give Servo / Optical Sensor / Circuit Board a clear use)
  { id:"att_barrel_build", name:"Long Barrel", fabricatorLevel:1,
    inputs:{ servo:2, scrap_alloy:1 }, scrapCost:40, output:{ itemId:"att_barrel", qty:1 } },
  { id:"att_mag_build", name:"Extended Mag", fabricatorLevel:2,
    inputs:{ servo:1, circuit_board:1 }, scrapCost:60, output:{ itemId:"att_mag", qty:1 } },
  { id:"att_optic_build", name:"Optic", fabricatorLevel:2,
    inputs:{ optical_sensor:1, circuit_board:1 }, scrapCost:80, output:{ itemId:"att_optic", qty:1 } },
  // Tools (stash count = charges; output qty = a full load). Level matches items.js tool.unlock.
  { id:"decoy_build", name:"Decoy", fabricatorLevel:1,
    inputs:{ cable:1, polymer_plate:1 }, scrapCost:10, output:{ itemId:"tool_decoy", qty:2 } },
  { id:"grenade_build", name:"Grenade", fabricatorLevel:2,
    inputs:{ scrap_alloy:1, fuse:1 }, scrapCost:10, output:{ itemId:"tool_grenade", qty:2 } },
  { id:"emp_build", name:"EMP", fabricatorLevel:2,
    inputs:{ cable:1, circuit_board:1 }, scrapCost:15, output:{ itemId:"tool_emp", qty:1 } },
  { id:"filter_rig", name:"Purification Filter", fabricatorLevel:2,
    inputs:{ bio_sample:2, polymer_plate:1 }, scrapCost:20, output:{ itemId:"purification_filter", qty:1 } },
  { id:"relay_build", name:"Power Relay", fabricatorLevel:2,
    inputs:{ circuit_board:2, transmitter:1 }, scrapCost:30, output:{ itemId:"power_relay", qty:1 } },
  { id:"shard_synth", name:"Data Core synthesis (shard)", fabricatorLevel:2,
    inputs:{ rebirth_shard:1 }, scrapCost:20, output:{ currency:"dataCores", qty:6 } },
  { id:"neural_synth", name:"Data Core synthesis (neural)", fabricatorLevel:2,
    inputs:{ neural_core:1 }, scrapCost:30, output:{ currency:"dataCores", qty:12 } }
];
// "Scrap it" (junk recycling): any common item -> scrap. Unlocked with Fabricator L1.
window.DATA.scrapJunkRate = 0.5; // scrap gained = sellValue * rate

// Quick clean (stash OVERFLOW): only items worth at most this much Scrap each are suggested.
window.DATA.quickCleanMaxValue = 60;

// Recycle map (v1.77): item -> base material it breaks down into. Always lossy (test: the output is worth less than the input).
// Base materials are the stackable commons the base builds with: Scrap Alloy (mechanical, power, bio filler) and Cable /
// Circuit Board (power / electronics parts). Not listed = not recyclable (base materials themselves, protocol and story
// items, valuables, gear, currencies, tools). `reason` strings for the disabled button come from recycleBlockReason().
window.DATA.recycleTo = {
  cable:{ to:"scrap_alloy", qty:1 }, fuse:{ to:"scrap_alloy", qty:1 }, power_cell:{ to:"cable", qty:2 }, power_relay:{ to:"cable", qty:3 },
  servo:{ to:"scrap_alloy", qty:2 }, polymer_plate:{ to:"scrap_alloy", qty:1 }, hydraulic_component:{ to:"scrap_alloy", qty:3 },
  circuit_board:{ to:"scrap_alloy", qty:1 }, optical_sensor:{ to:"circuit_board", qty:2 }, memory_module:{ to:"circuit_board", qty:2 },
  transmitter:{ to:"circuit_board", qty:2 },
  med_gel:{ to:"scrap_alloy", qty:1 }, bio_sample:{ to:"scrap_alloy", qty:1 }, purification_filter:{ to:"scrap_alloy", qty:2 },
  tidal_coil:{ to:"cable", qty:2 }, frost_glass:{ to:"scrap_alloy", qty:2 }
};
window.DATA.recycleBlockReason = function(id){
  var D = window.DATA, it = (D.items || []).find(function(i){ return i.id === id; });
  if(!it) return "Unknown item";
  if(it.free) return "Always available";
  if(D.recycleTo[id]) return "";
  if(it.id === "scrap_alloy") return "Already a base material";
  if(it.slot || it.weapon || it.tool || (it.uses || []).indexOf("loadout") >= 0) return "Gear can only be sold";
  if(it.family === "protocol" || (it.uses || []).indexOf("story") >= 0) return "Too valuable to break down";
  return "Nothing to salvage";
};

// Single source of truth for "what is this item for?" (v1.64). Derived at call time from the REAL module costs and
// recipe inputs, so the raid loot label, the first-find info card and the stash card can never promise a use that
// does not exist. Returns { uses:[{kind,label,short}], sell, recycle, line }.
window.DATA.itemInfo = function(id){
  var D = window.DATA, it = (D.items || []).find(function(i){ return i.id === id; });
  if(!it) return null;
  var SHORT = { rebirth_core:"Core", fabricator:"Fab", bit_bay:"BIT Bay", storage:"Storage" }, uses = [];
  (D.modules || []).forEach(function(m){ (m.levels || []).forEach(function(l){
    if(l.cost && l.cost.items && l.cost.items[id]) uses.push({ kind:"upgrade", module:m.id, level:l.level, label:m.name + " L" + l.level, short:(SHORT[m.id] || m.name) + " L" + l.level });
  }); });
  (D.recipes || []).forEach(function(r){
    if(r.inputs && r.inputs[id]) uses.push({ kind:"recipe", recipe:r.id, label:"Fabricator: " + r.name, short:"Fabricator" });
  });
  var mult = D.vendors && D.vendors[0] ? D.vendors[0].sellMultiplier : 1;
  var sell = Math.floor((it.sellValue || 0) * mult);
  var recycle = it.rarity === "common" ? Math.floor((it.sellValue || 0) * (D.scrapJunkRate || 0)) : 0;
  var g = it.grantsCurrency, line;
  if(g) line = Object.keys(g).map(function(c){ return "+" + g[c] + " " + (c === "scrap" ? "Scrap" : c === "dataCores" ? "Data Cores" : c); }).join(", ");
  else if(it.slot || it.weapon) line = "Gear";
  else if(it.scouts) line = "Scouting";
  else { var ups = uses.filter(function(u){ return u.kind === "upgrade"; }), up = ups.filter(function(u){ return !(u.module === "rebirth_core" && u.level === 1); })[0] || ups[0]; // Core L1 is built in the intro
    line = up ? "Base part · " + up.short : uses.length ? "Fabricator part" : "Sell " + sell; }
  // Usage flags for stash tile icons, all derived from existing data: quest (chain objectives, quest items), build (module
  // costs, recipes), shop (vendor stock / barter), chip (chip shop item or chip recycle source).
  var chains = D.questChains || {}, quest = (it.uses || []).indexOf("quest") >= 0, shop = false, chip = false;
  Object.keys(chains).forEach(function(c){ (chains[c].steps || []).forEach(function(st){
    var o = st.objective || {};
    if((o.items && o.items[id]) || o.item === id || (st.reward && st.reward.items && st.reward.items[id])) quest = true;
  }); });
  (D.vendors || []).forEach(function(v){
    (v.stock || []).forEach(function(x){ if(x.itemId === id) shop = true; });
    (v.barter || []).forEach(function(b){ if(b.give[id] || b.receive.itemId === id) shop = true; });
  });
  var cs = D.chipShop;
  if(cs){
    (cs.items || []).forEach(function(x){ if(x.kind === "item" && x.ref === id) chip = true; });
    Object.keys(cs.recycle || {}).forEach(function(k){ if(cs.recycle[k].item === id) chip = true; });
  }
  var usage = { quest:quest, build:uses.length > 0, shop:shop, chip:chip };
  return { item:it, uses:uses, sell:sell, recycle:recycle, line:line, usage:usage };
};
