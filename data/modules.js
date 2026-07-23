// Protocol Rebirth prototype — module data.
window.DATA = window.DATA || {};
window.DATA.modules = [
  {
    id:"rebirth_core", name:"Rebirth Core", revealedAtCore:0, maxLevelByCore:{"0":1,"1":1,"2":2},
    blurb:"The facility's heart. Everything else waits for it.",
    benefit:"Power facility · Unlock sectors",
    levels:[
      { level:1,
        cost:{ salvage:0, items:{ power_cell:1, scrap_alloy:2 } },
        unlocks:["lights_on","reveal_modules"],
        unlockText:"Emergency power restored. The facility breathes again.",
        benefitText:"Facility powered — Fabricator, BIT Bay and Vault sections revealed.",
        preview:{ before:"A dead reactor ring. Severed cables. The whole facility is dark around it.",
                  after:["Lights and machinery come on across the facility","Fabricator, BIT Bay and Vault become repairable","The rebuild can begin"] },
        artBefore:"assets/production/core_dim.webp",
        artAfter:"assets/production/core_powered.webp",
        newGoal:"Bring the Fabricator online — find 1× Cable and 1× Fuse." },
      { level:2,
        cost:{ salvage:60, items:{ power_relay:1, circuit_board:2, ai_fragment:1 } },
        unlocks:["zone_transit","module_caps_2"],
        unlockText:"Sector B unlocked. BIT found a way into the Transit Hub.",
        benefitText:"New raid zone: Transit Hub. Higher module caps (BIT Bay L2, Fabricator L2).",
        preview:{ before:"The core runs at minimum output. Half the facility is still without power.",
                  after:["Power reaches a new bunker sector","Transit Hub raid zone unlocks","BIT Bay and Fabricator can reach L2"] },
        artBefore:"assets/production/core_dim.webp",
        artAfter:"assets/production/core_powered.webp",
        artAdd:"grid",
        newGoal:"A new zone is open. The good electronics are there." }
    ]
  },
  {
    id:"fabricator", name:"Fabricator", revealedAtCore:1, maxLevelByCore:{"1":1,"2":2},
    blurb:"Turns junk into ammunition, meds and parts.",
    benefit:"Craft gear · Recycle junk",
    levels:[
      { level:1,
        cost:{ salvage:10, items:{ cable:1, fuse:1 } },
        unlocks:["recipes_basic","scrap_junk"],
        unlockText:"Fabricator humming. Medkits, ammo, and junk recycling online.",
        benefitText:"Craft medkits and ammo. Recycle junk into Scrap. Cheaper recovery after a death.",
        preview:{ before:"Broken assembly arms over a dead printer bed. No control panel.",
                  after:["Craft medkits and ammo packs","Recycle common junk into Scrap","Rebuild lost gear without the vendor markup"] },
        artBefore:"assets/production/fab_broken.webp",
        artAfter:"assets/production/fab_online.webp",
        newGoal:"Repair BIT — find 1× Optical Sensor. Industrial Zone, statistically." },
      { level:2,
        cost:{ salvage:50, items:{ circuit_board:2, hydraulic_component:1 } },
        unlocks:["recipes_advanced"],
        unlockText:"Precision tooling online. Advanced recipes unlocked.",
        benefitText:"Advanced recipes: craft Power Relays and Purification Filters from parts.",
        preview:{ before:"The printer works, but precision assembly is still offline.",
                  after:["Precision arms come online","Craft Power Relays (needed for Core L2)","Craft Purification Filters"] },
        artAdd:"arm2",
        newGoal:"Craft a Power Relay for Core Level 2." }
    ]
  },
  {
    id:"bit_bay", name:"BIT Bay", revealedAtCore:1, maxLevelByCore:{"1":1,"2":2},
    blurb:"Where BIT lives, heals, and levels the bond.",
    benefit:"Loot intel · Recovery support",
    levels:[
      { level:1,
        cost:{ salvage:10, items:{ optical_sensor:1, cable:1 } },
        unlocks:["bit_online","loot_scan_1"],
        unlockText:"BIT is back online. One loot scan per raid. BIT is pleased. Statistically.",
        benefitText:"BIT adds one loot scan per raid and recommends where to search for tracked items.",
        preview:{ before:"A dark docking cradle. BIT sits in it, optics smashed, one LED blinking.",
                  after:["BIT comes online and follows you","+1 loot scan every raid","BIT recommends the best search route for tracked items"] },
        artBefore:"assets/production/bitbay_broken.webp",
        artAfter:"assets/production/bitbay_online.webp",
        newGoal:"Choose your path: Storage (less friction) or save for Core L2 (new zone)." },
      { level:2,
        cost:{ salvage:45, dataCores:6, items:{ memory_module:1 } },
        unlocks:["bit_carry_1"],
        unlockText:"Cargo rack installed — BIT hauls one extra item home. Hardware, not sentiment.",
        benefitText:"BIT carries one extra item home from every successful extraction.",
        preview:{ before:"BIT flies fine but carries nothing. He finds this undignified.",
                  after:["Cargo rack appears on the dock","BIT hauls +1 item home per extraction"] },
        artAdd:"cargo",
        newGoal:"Keep feeding the bond. BIT remembers." }
    ]
  },
  {
    id:"storage", name:"Storage / Vault", revealedAtCore:1, maxLevelByCore:{"1":1,"2":1},
    blurb:"Stash space, loadout presets, one secure slot.",
    benefit:"+8 stash slots · Secure one item",
    levels:[
      { level:1,
        cost:{ salvage:25, items:{ polymer_plate:2, servo:1 } },
        unlocks:["stash_plus_8","secure_slot"],
        unlockText:"Vault sealed. +8 stash slots and one secure slot — it survives your death.",
        benefitText:"+8 stash slots. One secure slot: that item survives your death.",
        preview:{ before:"A vault door hanging off its hinges. Containers looted and scattered.",
                  after:["Vault door seals","+8 stash slots","Secure slot: one chosen item survives death"] },
        artBefore:"assets/production/vault_broken.webp",
        artAfter:"assets/production/vault_sealed.webp",
        artAdd:"vault",
        newGoal:"Pick a secure item before your next raid. Choose like it matters." }
    ]
  }
];

// Base stash capacity before Storage upgrades.
window.DATA.baseStashCapacity = 12;
window.DATA.storageBonus = 8;

// Facility layout (rows of rooms, top to bottom) and per-module art style.
window.DATA.baseLayout = [["rebirth_core"], ["fabricator", "bit_bay"], ["storage"]];
window.DATA.moduleArt = { rebirth_core:"core", fabricator:"fab", bit_bay:"bit", storage:"vault" };

// Enclosed bunker hub: interior env + percent-positioned hotspots (responsive).
// No windows, no exterior. The outside world exists only during raids.
// Coordinates are % of hub_interim.webp (core hall) — retune when hub art lands.
window.DATA.baseMap = {
  env: "assets/production/hub_interim.webp",
  hotspots: {
    rebirth_core: { x:50, y:33 },
    fabricator:   { x:17, y:49 },
    bit_bay:      { x:83, y:51 },
    storage:      { x:50, y:74 }
  },
  raidGate: { x:88, y:75, label:"Raid Gate — sealed" },
  locked: [
    { id:"living_quarters", label:"Living Quarters", x:12, y:75 },
    { id:"sealed_sector",   label:"Sealed Sector B", x:88, y:23 }
  ]
};

// Bunker restoration states (Merge Mansion-style visible transformation).
// State derives from total module levels; thresholds are tunable here.
window.DATA.hubStates = [
  { id:"abandoned", min:0, label:"ABANDONED", env:"assets/production/hub_abandoned.webp" },
  { id:"restored",  min:1, label:"RESTORED",  env:"assets/production/hub_restored.webp" },
  { id:"refined",   min:4, label:"REFINED",   env:"assets/production/hub_refined.webp" }
];

// Curated self-expression (cosmetic only, one room for now): pick a look for the BIT Bay.
window.DATA.styleOptions = {
  bit_bay: [
    { id:"warm",     name:"Cozy Tech",   desc:"Soft light, a rug, a kettle. BIT pretends not to like it.", art:"assets/production/bitbay_warm.webp" },
    { id:"military", name:"Disciplined", desc:"Everything labeled. Everything in rows. BIT salutes.",       art:"assets/production/bitbay_military.webp" },
    { id:"retro",    name:"Retro-Tech",  desc:"CRT glow and tape decks. BIT feels seen.",                   art:"assets/production/bitbay_retro.webp" }
  ]
};
