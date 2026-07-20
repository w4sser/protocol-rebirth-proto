// Protocol Rebirth prototype — raid zones.
window.DATA = window.DATA || {};
window.DATA.raidZones = [
  {
    id:"industrial", name:"Industrial Zone", threat:1, unlockedAtCore:0,
    tagline:"Rusting factories. Common parts everywhere, if you don't mind the company.",
    baseExtractChance:0.85,
    lootTable:[
      { itemId:"cable", weight:18 }, { itemId:"fuse", weight:14 },
      { itemId:"scrap_alloy", weight:20 }, { itemId:"servo", weight:12 },
      { itemId:"polymer_plate", weight:12 }, { itemId:"circuit_board", weight:10 },
      { itemId:"med_gel", weight:10 }, { itemId:"optical_sensor", weight:6 },
      { itemId:"power_cell", weight:5 }, { itemId:"prewar_relic", weight:4 },
      { itemId:"hydraulic_component", weight:4 }, { itemId:"encrypted_drive", weight:1 }
    ],
    salvageRange:[10,25], dataCoresOnExtract:[2,4],
    likelyFamilies:["power","mechanical","electronics"]
  },
  {
    id:"transit", name:"Transit Hub", threat:2, unlockedAtCore:2,
    tagline:"Collapsed metro exchange. Better electronics. Worse neighbors.",
    baseExtractChance:0.75,
    lootTable:[
      { itemId:"circuit_board", weight:16 }, { itemId:"memory_module", weight:12 },
      { itemId:"transmitter", weight:10 }, { itemId:"optical_sensor", weight:8 },
      { itemId:"power_relay", weight:8 }, { itemId:"bio_sample", weight:10 },
      { itemId:"purification_filter", weight:8 }, { itemId:"prewar_relic", weight:6 },
      { itemId:"power_cell", weight:6 }, { itemId:"encrypted_drive", weight:3 },
      { itemId:"ai_fragment", weight:2 }, { itemId:"rebirth_shard", weight:1 }
    ],
    salvageRange:[15,35], dataCoresOnExtract:[3,6],
    likelyFamilies:["electronics","bio","protocol"]
  }
];

// Risk levels — global knobs.
window.DATA.riskLevels = [
  { id:"cautious",   name:"Cautious",   extractMod:1.10, extractCap:0.97, lootSlots:3 },
  { id:"standard",   name:"Standard",   extractMod:1.00, extractCap:0.95, lootSlots:4 },
  { id:"aggressive", name:"Aggressive", extractMod:0.80, extractCap:0.90, lootSlots:6 }
];
