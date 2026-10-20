// Protocol Rebirth prototype — vendor. Common buyable, uncommon barter-only, Protocol never sold.
window.DATA = window.DATA || {};
window.DATA.vendors = [
  {
    id:"quartermaster", name:"The Quartermaster",
    blurb:"Runs a stall out of a shipping container. Asks no questions. Answers none either.",
    stock:[
      { itemId:"cable", price:40, currency:"scrap" },
      { itemId:"fuse", price:50, currency:"scrap" },
      { itemId:"scrap_alloy", price:25, currency:"scrap" },
      { itemId:"med_gel", price:45, currency:"scrap" },
      { itemId:"polymer_plate", price:55, currency:"scrap" },
      { itemId:"servo", price:60, currency:"scrap" },
      { itemId:"medkit", price:55, currency:"scrap" },
      { itemId:"scavenger_vest", price:40, currency:"scrap", requires:{ module:"fabricator", level:1 } },
      { itemId:"scout_rig", price:120, currency:"scrap" },
    ],
    barter:[
      { give:{ servo:3 }, receive:{ itemId:"hydraulic_component", qty:1 } },
      { give:{ memory_module:2 }, receive:{ itemId:"transmitter", qty:1 } },
      { give:{ prewar_relic:1 }, receive:{ itemId:"power_cell", qty:1 } }
    ],
    // Data Cores are purchasable at a steep rate (loot stays the main source): 1 Core = 120 Scrap or 2 Signals.
    exchange:[
      { id:"cores_scrap", give:{ scrap:120 }, receive:{ dataCores:1 } },
      { id:"cores_signals", give:{ signals:2 }, receive:{ dataCores:1 } }
    ],
    buysEverything:true,
    sellMultiplier:0.6
  }
];

// v1.72 BIT trader (Contract Chips, docs/design-retention-quests.md 2). Chips come from chain quests, rare loot, the Drive/Relic
// alternatives below and (stub) the weekly op. kind: recipe | item | hardPass | cosmetic. weeklyCap = buys per ISO week.
// soon:true tiles are shown disabled (hard variants do not exist yet). Memory Module / Hydraulic Component stand in for Tidal Coil / Frost Glass.
window.DATA.chipShop = {
  // sources: stash item -> chips per piece (alternative to its Scrap value); label is the button text
  sources: { encrypted_drive: { chips: 2, label: "Recycle" }, prewar_relic: { chips: 1, label: "Sell to BIT" } },
  weeklyOp: [ { topPct: 10, chips: 5 }, { topPct: 50, chips: 2 } ],
  stock: [
    { id:"bp_rifle", kind:"recipe", recipe:"rifle_build", icon:"item-rifle", name:"Marksman Rifle blueprint", price:8 },
    { id:"mat_memory", kind:"item", itemId:"memory_module", qty:1, price:4, weeklyCap:1 },
    { id:"mat_hydraulic", kind:"item", itemId:"hydraulic_component", qty:1, price:4, weeklyCap:1 },
    { id:"pass_bunker", kind:"hardPass", area:"bunker", icon:"area-bunker", name:"Bunker Hard pass", price:5, soon:true },
    { id:"bit_amber", kind:"cosmetic", cosmetic:"bit_amber", icon:"bit-face", name:"BIT amber glow", price:3 }
  ]
};
