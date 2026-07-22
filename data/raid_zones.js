// Protocol Rebirth prototype — raid zones + search routes.
// The player chooses WHERE and HOW to search (zone + route + risk).
// The game still decides WHAT they find: routes multiply the zone's weighted
// loot table per item family — they never guarantee a specific item.
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
    likelyFamilies:["power","mechanical","electronics"],
    routes:[
      { id:"tunnels", name:"Maintenance Tunnels", threat:1,
        extractMod:1.08, lootSlotMod:-1,
        desc:"Slow, dark, mostly empty. The safe way in and the safe way out.",
        families:["mechanical","power"],
        weightMult:{ mechanical:2.0, power:1.6, electronics:0.5, bio:1.0, protocol:0.3, valuable:0.8 } },
      { id:"control", name:"Control Room", threat:3,
        extractMod:0.92, lootSlotMod:0,
        desc:"Sealed since the fall. The good electronics are behind the bad company.",
        families:["electronics","power"],
        weightMult:{ mechanical:0.5, power:1.2, electronics:2.5, bio:0.7, protocol:1.0, valuable:1.0 } },
      { id:"reactor", name:"Reactor Floor", threat:4,
        extractMod:0.82, lootSlotMod:2,
        desc:"Hot, loud, crawling. Big hauls come out of here. Not everyone does.",
        families:["power","protocol"],
        weightMult:{ mechanical:0.7, power:2.0, electronics:0.8, bio:0.5, protocol:3.0, valuable:1.5 } }
    ]
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
    likelyFamilies:["electronics","bio","protocol"],
    routes:[
      { id:"concourse", name:"Upper Concourse", threat:2,
        extractMod:1.05, lootSlotMod:-1,
        desc:"Shops and kiosks, picked over but quick to sweep.",
        families:["bio","valuable"],
        weightMult:{ mechanical:1.0, power:0.8, electronics:0.8, bio:2.0, protocol:0.5, valuable:1.8 } },
      { id:"server_vault", name:"Server Vault", threat:4,
        extractMod:0.85, lootSlotMod:1,
        desc:"The exchange's data heart. If the Protocol left anything behind, it's here.",
        families:["electronics","protocol"],
        weightMult:{ mechanical:0.4, power:1.0, electronics:2.2, bio:0.4, protocol:2.5, valuable:0.8 } }
    ]
  }
];

// Risk levels — global knobs.
window.DATA.riskLevels = [
  { id:"cautious",   name:"Cautious",   extractMod:1.10, extractCap:0.97, lootSlots:3 },
  { id:"standard",   name:"Standard",   extractMod:1.00, extractCap:0.95, lootSlots:4 },
  { id:"aggressive", name:"Aggressive", extractMod:0.80, extractCap:0.90, lootSlots:6 }
];

// Raid meta-config: push-deeper decision + qualitative chance labels.
window.DATA.raidConfig = {
  pushDeeper: {
    extraSlots: 2,             // additional loot rolls when pushing deeper
    deathChanceAdd: 0.15,      // added death probability for the push
    rareFamilyMult: { protocol: 2.5, valuable: 1.5 }  // rare odds improve deeper in
  },
  // p(find tracked item at least once this raid) -> qualitative label
  chanceLabels: [
    { min: 0.45, label: "High" },
    { min: 0.22, label: "Medium" },
    { min: 0,    label: "Low" }
  ]
};
