// Protocol Rebirth prototype — Fabricator recipes.
window.DATA = window.DATA || {};
window.DATA.recipes = [
  { id:"medkit", name:"Medkit", fabricatorLevel:1,
    inputs:{ med_gel:2 }, scrapCost:10, output:{ itemId:"medkit", qty:1 } },
  { id:"ammo_pack", name:"Ammo Pack", fabricatorLevel:1,
    inputs:{ scrap_alloy:1 }, scrapCost:5, output:{ itemId:"ammo_pack", qty:1 } },
  { id:"armor_patch", name:"Scavenger Vest", fabricatorLevel:1,
    inputs:{ polymer_plate:2, scrap_alloy:1 }, scrapCost:15, output:{ itemId:"scavenger_vest", qty:1 } },
  { id:"filter_rig", name:"Purification Filter", fabricatorLevel:2,
    inputs:{ bio_sample:2, polymer_plate:1 }, scrapCost:20, output:{ itemId:"purification_filter", qty:1 } },
  { id:"relay_build", name:"Power Relay", fabricatorLevel:2,
    inputs:{ circuit_board:2, transmitter:1 }, scrapCost:30, output:{ itemId:"power_relay", qty:1 } }
];
// "Scrap it" (junk recycling): any common item -> scrap. Unlocked with Fabricator L1.
window.DATA.scrapJunkRate = 0.5; // scrap gained = sellValue * rate
