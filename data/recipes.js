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
