// Protocol Rebirth prototype — item data. Pure data: tune freely, UI never hardcodes these.
var ITEM_DATA_ROOT = typeof window !== 'undefined' ? window : globalThis;
ITEM_DATA_ROOT.DATA = ITEM_DATA_ROOT.DATA || {};
ITEM_DATA_ROOT.DATA.currencies = {scrap:{name:'Scrap',icon:'cur-scrap'},dataCores:{name:'Data Cores',icon:'cur-datacore'},chips:{name:'Contract Chips',icon:'cur-chip'}};
ITEM_DATA_ROOT.DATA.items = [
  // POWER
  { id:"power_cell", icon:"item-powercell", name:"Power Cell", family:"power", rarity:"uncommon", sellValue:90, stackSize:5,
    desc:"Dense charge pack. The Core is hungry for these.", uses:["upgrade:rebirth_core"] },
  { id:"cable", icon:"item-cable", name:"Cable", source:"Electrical storage", family:"power", rarity:"common", sellValue:25, stackSize:10,
    desc:"Industrial cabling. Unglamorous. Essential.", uses:["upgrade:fabricator","upgrade:bit_bay","recipe"] },
  { id:"fuse", icon:"item-fuse", name:"Fuse", family:"power", rarity:"common", sellValue:30, stackSize:10,
    desc:"Blown ones are everywhere. Working ones are not.", uses:["recipe"] },
  { id:"power_relay", icon:"item-relay", name:"Power Relay", family:"power", rarity:"rare", sellValue:140, stackSize:5,
    desc:"Routes power between facility sections.", uses:["upgrade:rebirth_core"] },
  // MECHANICAL
  { id:"scrap_alloy", icon:"item-alloy", name:"Scrap Alloy", source:"Supply caches", family:"mechanical", rarity:"common", sellValue:15, stackSize:20,
    desc:"Structural metal. The facility eats it by the ton.", uses:["upgrade:rebirth_core","upgrade:fabricator","upgrade:storage","recipe"] },
  { id:"servo", icon:"item-servo", name:"Servo", family:"mechanical", rarity:"common", sellValue:40, stackSize:10,
    desc:"Small actuator. Storage racks and the Fabricator want them.", uses:["upgrade:storage","recipe","barter"] },
  { id:"polymer_plate", icon:"item-plate", name:"Polymer Plate", family:"mechanical", rarity:"common", sellValue:35, stackSize:10,
    desc:"Light armor plating.", uses:["upgrade:bit_bay","upgrade:storage","recipe"] },
  { id:"hydraulic_component", icon:"item-hydraulic", name:"Hydraulic Component", family:"mechanical", rarity:"uncommon", sellValue:110, stackSize:5,
    desc:"Heavy actuation for doors and lifts.", uses:["upgrade:fabricator","upgrade:storage","recipe","barter"] },
  // ELECTRONICS
  { id:"circuit_board", icon:"item-circuit", name:"Circuit Board", source:"Technical storage", family:"electronics", rarity:"common", sellValue:45, stackSize:10,
    desc:"Salvaged logic. Half of them still work.", uses:["upgrade:rebirth_core","upgrade:fabricator","upgrade:storage","recipe"] },
  { id:"optical_sensor", icon:"item-sensor", name:"Optical Sensor", family:"electronics", rarity:"uncommon", sellValue:120, stackSize:5,
    desc:"Military-grade optics. BIT has opinions about getting one.", uses:["upgrade:bit_bay","recipe"] },
  { id:"memory_module", icon:"item-memory", name:"Memory Module", family:"electronics", rarity:"uncommon", sellValue:100, stackSize:5,
    desc:"Someone's data. Now BIT's data.", uses:["upgrade:rebirth_core","upgrade:bit_bay","barter"] },
  { id:"transmitter", icon:"item-transmitter", name:"Transmitter", family:"electronics", rarity:"uncommon", sellValue:130, stackSize:5,
    desc:"Long-range comms hardware.", uses:["recipe","barter"] },
  // BIO / MEDICAL
  { id:"med_gel", icon:"item-medgel", name:"Med Gel", family:"bio", rarity:"common", sellValue:30, stackSize:10,
    desc:"Sterile wound gel. Craft it into something useful.", uses:["recipe","sell"] },
  { id:"bio_sample", icon:"item-bio", name:"Bio Sample", family:"bio", rarity:"common", sellValue:50, stackSize:10,
    desc:"The surface changed things. Worth studying.", uses:["recipe","sell"] },
  { id:"purification_filter", icon:"item-filter", name:"Purification Filter", family:"bio", rarity:"uncommon", sellValue:95, stackSize:5,
    desc:"Clean air is a luxury item now.", uses:["sell"] },
  // PROTOCOL (found only — never sold by vendors)
  { id:"encrypted_drive", icon:"item-drive", name:"Encrypted Drive", family:"protocol", protocolTarget:true, rarity:"epic", sellValue:400, stackSize:3,
    desc:"BIT can't read it yet. BIT really wants to read it.", uses:["upgrade:rebirth_core","recipe","story"] },
  { id:"ai_fragment", icon:"item-ai", name:"AI Fragment", family:"protocol", rarity:"epic", sellValue:500, stackSize:3,
    desc:"A shard of something that used to think.", uses:["upgrade:rebirth_core","story"] },
  { id:"rebirth_shard", icon:"item-shard", name:"Rebirth Shard", family:"protocol", rarity:"legendary", sellValue:600, stackSize:3,
    desc:"Resonates near the Core. Nobody knows why. Yet.", uses:["recipe","story"] },
  { id:"neural_core", icon:"item-neuralcore", name:"Neural Core", family:"protocol", rarity:"legendary", sellValue:800, stackSize:1,
    desc:"The Protocol's memory of itself.", uses:["recipe","story"] },
  // AREA MATERIALS (v1.75, docs/design-retention-quests.md sections 1.4, 2, 3): one per area, found only there.
  // Tidal Coil: Archipelago L2+. Frost Glass: Town L2+ (house containers). Core Ash: L3 in any area until Hard variants exist.
  { id:"tidal_coil", icon:"item-tidal-coil", hero:"assets/art/tidal-coil.webp", name:"Tidal Coil", family:"power", rarity:"rare", sellValue:160, stackSize:5,
    desc:"Salt-cured induction coil from the Archipelago. Quest reward and BIT trade good.", uses:["quest","barter","sell"] },
  { id:"frost_glass", icon:"item-frost-glass", hero:"assets/art/frost-glass.webp", name:"Frost Glass", family:"mechanical", rarity:"rare", sellValue:150, stackSize:5,
    desc:"Pane that never thawed. Turns up in Town houses.", uses:["quest","barter","sell"] },
  { id:"core_ash", icon:"item-core-ash", hero:"assets/art/core-ash.webp", name:"Core Ash", family:"protocol", rarity:"epic", sellValue:350, stackSize:3,
    desc:"What a burned-out Core leaves behind. Deep runs only.", uses:["sell"] },
  // VALUABLE (sell-only)
  // v1.44 scouting items: extracting one scouts the next area on the world map (consumed on extract).
  { id:"archipelago_chart", icon:"item-chart", name:"Archipelago Chart", family:"valuable", rarity:"rare", sellValue:0, stackSize:1, scouts:"archipelago",
    desc:"A waterproof chart of the islands beyond the bunker. Extract it to scout the Archipelago.", uses:["scout"] },
  { id:"town_survey", icon:"item-survey", name:"Town Survey", family:"valuable", rarity:"rare", sellValue:0, stackSize:1, scouts:"town",
    desc:"Survey notes on the abandoned town across the strait. Extract it to scout the Town.", uses:["scout"] },
  { id:"prewar_relic", icon:"item-relic", name:"Prewar Relic", family:"valuable", rarity:"legendary", sellValue:250, stackSize:5,
    desc:"Worthless to the facility. Priceless to a collector.", uses:["sell"] },
  // GEAR (loadout items)
  { id:"basic_carbine", art:"carbine", icon:"item-carbine", name:"Basic Carbine", family:"gear", rarity:"common", sellValue:60, stackSize:1,
    slot:"weapon", free:true, weapon:{ dmg:1, mag:3, rld:700, int:180, rng:7, cone:8, ast:12, spr:0, kb:0, pel:1, hom:90 },
    desc:"It fires. Usually. Tracers bend gently toward a target in front of you. Always free in the bunker — never lost in a Node Raid.", uses:["loadout"] },
  // Node Raid weapons (stats go to core as ?w=; see docs/meta-core-integration.md). Taken weapons are at risk like armour.
  { id:"smg_vector", art:"smg", icon:"item-smg", name:"Vector SMG", family:"gear", rarity:"uncommon", sellValue:110, stackSize:1,
    slot:"weapon", weapon:{ dmg:1, mag:8, rld:450, int:110, rng:6, cone:10, ast:14, spr:5, kb:0, pel:1, hom:0 },
    desc:"Sprays fast, hits soft. Big magazine.", uses:["loadout"] },
  { id:"rifle_marksman", art:"marksman", icon:"item-rifle", name:"Marksman Rifle", family:"gear", rarity:"rare", sellValue:160, stackSize:1,
    slot:"weapon", weapon:{ dmg:2, mag:4, rld:900, int:450, rng:11, cone:5, ast:8, spr:0, kb:0, pel:1, hom:0 },
    desc:"Long reach, tight lock. Slow and deliberate.", uses:["loadout"] },
  { id:"shotgun_breach", art:"shotgun", icon:"item-shotgun", name:"Breach Shotgun", family:"gear", rarity:"uncommon", sellValue:130, stackSize:1,
    slot:"weapon", weapon:{ dmg:3, mag:2, rld:1000, int:600, rng:4.5, cone:18, ast:22, spr:9, kb:1.1, pel:5, hom:0 },
    desc:"Five-pellet fan at close range. A hit shoves the target back. Useless past a few steps.", uses:["loadout"] },
  { id:"scavenger_vest", icon:"item-vest", name:"Scavenger Vest", family:"gear", rarity:"common", sellValue:45, stackSize:1,
    slot:"armor", stats:{ shield:25 }, bagSlots:1, desc:"More pockets than protection.", uses:["loadout"] },
  { id:"scout_rig", icon:"item-rig", name:"Scout Rig", family:"gear", rarity:"uncommon", sellValue:80, stackSize:1,
    slot:"armor", stats:{ speed:0.45, shield:10 }, bagSlots:1, desc:"Light webbing and good boots. You move like you mean it.", uses:["loadout"] },
  { id:"dampener_cloak", icon:"item-cloak", name:"Dampener Cloak", family:"gear", rarity:"rare", sellValue:110, stackSize:1,
    slot:"armor", stats:{ stealth:0.18, speed:0.1, maxHealth:-10 }, desc:"Soaks up sound and heat. Not bullets.", uses:["loadout"] },
  // v1.91 attachments: crafted at the Fabricator from existing T2 parts, fitted to one gun for good (kept on merge). Armory items.
  { id:"att_barrel", artImg:"att-barrel", icon:"item-att-barrel", name:"Long Barrel", family:"gear", rarity:"uncommon", sellValue:40, stackSize:3,
    slot:"attachment", desc:"Barrel attachment: +2 m range. Fit it on the weapon screen.", uses:["attachment"] },
  { id:"att_mag", artImg:"att-mag", icon:"item-att-mag", name:"Extended Mag", family:"gear", rarity:"rare", sellValue:60, stackSize:3,
    slot:"attachment", desc:"Mag attachment: +25% magazine. Needs a Mk II gun.", uses:["attachment"] },
  { id:"att_optic", artImg:"att-optic", icon:"item-att-optic", name:"Optic", family:"gear", rarity:"rare", sellValue:70, stackSize:3,
    slot:"attachment", desc:"Optic attachment: +1 damage. Needs a Mk III gun.", uses:["attachment"] },
  { id:"medkit", icon:"item-medkit", name:"Medkit", family:"gear", rarity:"common", sellValue:35, stackSize:5,
    slot:"consumable", desc:"Fabricator special. Smells like ozone.", uses:["loadout"] },
  // CURRENCY-SOURCING LOOT (Node Raid): converted on ingest, never stored in the stash.
  { id:"salvage_crate", icon:"item-crate", name:"Salvage Crate", family:"mechanical", rarity:"common", sellValue:20, stackSize:10,
    grantsCurrency:{ scrap:24 }, desc:"Sorted structural salvage. Becomes Scrap when you bring it home.", uses:["currency"] },
  { id:"data_core", icon:"item-datacore", name:"Data Core", family:"electronics", rarity:"rare", sellValue:60, stackSize:10,
    grantsCurrency:{ dataCores:2 }, desc:"Intact storage cell. Becomes Data Cores when you bring it home.", uses:["currency"] },
  { id:"contract_chip", icon:"item-chip", name:"Contract Chip", family:"protocol", rarity:"rare", sellValue:0, stackSize:10,
    grantsCurrency:{ chips:1 }, desc:"BIT's trade token. Becomes a Contract Chip when you bring it home.", uses:["currency"] },
  { id:"ammo_pack", icon:"item-ammo", name:"Ammo Pack", family:"gear", rarity:"common", sellValue:25, stackSize:5,
    slot:"consumable", desc:"Standard rounds, pressed in-house.", uses:["loadout"] },
  // TOOLS (Raid Prep tool slot, one per raid). Stash count = charges. tool.charges = most you carry in (and bring home);
  // tool.unlock = Fabricator level that grants the first charge free. Effects/ranges live in nodspel RULES.tools (same ids).
  { id:"tool_grenade", icon:"tool-grenade", name:"Grenade", family:"gear", rarity:"uncommon", sellValue:40, stackSize:6,
    slot:"tool", tool:{ charges:2, unlock:{ module:"fabricator", level:2 } },
    desc:"1 s fuse, 2 m blast, 3 damage. Thrown, does not bounce.", uses:["loadout"] },
  { id:"tool_emp", icon:"tool-emp", name:"EMP", family:"gear", rarity:"uncommon", sellValue:60, stackSize:3,
    slot:"tool", tool:{ charges:1, unlock:{ module:"fabricator", level:2 } },
    desc:"Shuts down sentries and node shields within 3 m for 4 s.", uses:["loadout"] },
  { id:"tool_decoy", icon:"tool-decoy", name:"Decoy", family:"gear", rarity:"common", sellValue:30, stackSize:6,
    slot:"tool", tool:{ charges:2, unlock:{ module:"fabricator", level:1 } },
    desc:"Lures enemies within 6 m for 5 s.", uses:["loadout"] }
];
