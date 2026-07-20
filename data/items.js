// Protocol Rebirth prototype — item data. Pure data: tune freely, UI never hardcodes these.
window.DATA = window.DATA || {};
window.DATA.items = [
  // POWER
  { id:"power_cell", name:"Power Cell", family:"power", rarity:"uncommon", sellValue:90, stackSize:5,
    desc:"Dense charge pack. The Core is hungry for these.", uses:["upgrade:rebirth_core","recipe"] },
  { id:"cable", name:"Cable", family:"power", rarity:"common", sellValue:25, stackSize:10,
    desc:"Industrial cabling. Unglamorous. Essential.", uses:["upgrade:fabricator","upgrade:bit_bay"] },
  { id:"fuse", name:"Fuse", family:"power", rarity:"common", sellValue:30, stackSize:10,
    desc:"Blown ones are everywhere. Working ones are not.", uses:["upgrade:fabricator","recipe"] },
  { id:"power_relay", name:"Power Relay", family:"power", rarity:"uncommon", sellValue:140, stackSize:5,
    desc:"Routes power between facility sections.", uses:["upgrade:rebirth_core","recipe"] },
  // MECHANICAL
  { id:"scrap_alloy", name:"Scrap Alloy", family:"mechanical", rarity:"common", sellValue:15, stackSize:20,
    desc:"Structural metal. The facility eats it by the ton.", uses:["upgrade:rebirth_core","recipe"] },
  { id:"servo", name:"Servo", family:"mechanical", rarity:"common", sellValue:40, stackSize:10,
    desc:"Small actuator. BIT's joints want them.", uses:["upgrade:storage","barter"] },
  { id:"polymer_plate", name:"Polymer Plate", family:"mechanical", rarity:"common", sellValue:35, stackSize:10,
    desc:"Light armor plating.", uses:["upgrade:storage","recipe"] },
  { id:"hydraulic_component", name:"Hydraulic Component", family:"mechanical", rarity:"uncommon", sellValue:110, stackSize:5,
    desc:"Heavy actuation for doors and lifts.", uses:["upgrade:rebirth_core","barter"] },
  // ELECTRONICS
  { id:"circuit_board", name:"Circuit Board", family:"electronics", rarity:"common", sellValue:45, stackSize:10,
    desc:"Salvaged logic. Half of them still work.", uses:["upgrade:rebirth_core","recipe"] },
  { id:"optical_sensor", name:"Optical Sensor", family:"electronics", rarity:"uncommon", sellValue:120, stackSize:5,
    desc:"Military-grade optics. BIT has opinions about getting one.", uses:["upgrade:bit_bay","recipe"] },
  { id:"memory_module", name:"Memory Module", family:"electronics", rarity:"uncommon", sellValue:100, stackSize:5,
    desc:"Someone's data. Now BIT's data.", uses:["upgrade:bit_bay","barter"] },
  { id:"transmitter", name:"Transmitter", family:"electronics", rarity:"uncommon", sellValue:130, stackSize:5,
    desc:"Long-range comms hardware.", uses:["recipe","barter"] },
  // BIO / MEDICAL
  { id:"med_gel", name:"Med Gel", family:"bio", rarity:"common", sellValue:30, stackSize:10,
    desc:"Sterile wound gel. Craft it into something useful.", uses:["recipe","sell"] },
  { id:"bio_sample", name:"Bio Sample", family:"bio", rarity:"common", sellValue:50, stackSize:10,
    desc:"The surface changed things. Worth studying.", uses:["recipe","sell"] },
  { id:"purification_filter", name:"Purification Filter", family:"bio", rarity:"uncommon", sellValue:95, stackSize:5,
    desc:"Clean air is a luxury item now.", uses:["upgrade:rebirth_core","sell"] },
  // PROTOCOL (found only — never sold by vendors)
  { id:"encrypted_drive", name:"Encrypted Drive", family:"protocol", rarity:"protocol", sellValue:400, stackSize:3,
    desc:"BIT can't read it yet. BIT really wants to read it.", uses:["upgrade:rebirth_core","story"] },
  { id:"ai_fragment", name:"AI Fragment", family:"protocol", rarity:"protocol", sellValue:500, stackSize:3,
    desc:"A shard of something that used to think.", uses:["upgrade:rebirth_core","story"] },
  { id:"rebirth_shard", name:"Rebirth Shard", family:"protocol", rarity:"protocol", sellValue:600, stackSize:3,
    desc:"Resonates near the Core. Nobody knows why. Yet.", uses:["upgrade:rebirth_core","story"] },
  { id:"neural_core", name:"Neural Core", family:"protocol", rarity:"protocol", sellValue:800, stackSize:1,
    desc:"The Protocol's memory of itself.", uses:["upgrade:bit_bay","story"] },
  // VALUABLE (sell-only)
  { id:"prewar_relic", name:"Prewar Relic", family:"valuable", rarity:"valuable", sellValue:250, stackSize:5,
    desc:"Worthless to the facility. Priceless to a collector.", uses:["sell"] },
  // GEAR (loadout items)
  { id:"basic_carbine", name:"Basic Carbine", family:"gear", rarity:"common", sellValue:60, stackSize:1,
    slot:"weapon", desc:"It fires. Usually.", uses:["loadout"] },
  { id:"scavenger_vest", name:"Scavenger Vest", family:"gear", rarity:"common", sellValue:45, stackSize:1,
    slot:"armor", desc:"More pockets than protection.", uses:["loadout"] },
  { id:"medkit", name:"Medkit", family:"gear", rarity:"common", sellValue:35, stackSize:5,
    slot:"consumable", desc:"Fabricator special. Smells like ozone.", uses:["loadout"] },
  { id:"ammo_pack", name:"Ammo Pack", family:"gear", rarity:"common", sellValue:25, stackSize:5,
    slot:"consumable", desc:"Standard rounds, pressed in-house.", uses:["loadout"] }
];
