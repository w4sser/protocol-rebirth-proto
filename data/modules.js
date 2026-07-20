// Protocol Rebirth prototype — module data.
window.DATA = window.DATA || {};
window.DATA.modules = [
  {
    id:"rebirth_core", name:"Rebirth Core", revealedAtCore:0, maxLevelByCore:{"0":1,"1":1,"2":2},
    blurb:"The facility's heart. Everything else waits for it.",
    levels:[
      { level:1,
        cost:{ salvage:0, items:{ power_cell:1, scrap_alloy:2 } },
        unlocks:["lights_on","reveal_modules"],
        unlockText:"Emergency power restored. The facility breathes again.",
        newGoal:"Bring the Fabricator online — find 1× Cable and 1× Fuse." },
      { level:2,
        cost:{ salvage:60, items:{ power_relay:1, circuit_board:2, ai_fragment:1 } },
        unlocks:["zone_transit","module_caps_2"],
        unlockText:"Sector B unlocked. BIT found a way into the Transit Hub.",
        newGoal:"A new zone is open. The good electronics are there." }
    ]
  },
  {
    id:"fabricator", name:"Fabricator", revealedAtCore:1, maxLevelByCore:{"1":1,"2":2},
    blurb:"Turns junk into ammunition, meds and parts.",
    levels:[
      { level:1,
        cost:{ salvage:10, items:{ cable:1, fuse:1 } },
        unlocks:["recipes_basic","scrap_junk"],
        unlockText:"Fabricator humming. Medkits, ammo, and junk recycling online.",
        newGoal:"Repair BIT — find 1× Optical Sensor. Industrial Zone, statistically." },
      { level:2,
        cost:{ salvage:50, items:{ circuit_board:2, hydraulic_component:1 } },
        unlocks:["recipes_advanced"],
        unlockText:"Precision tooling online. Advanced recipes unlocked.",
        newGoal:"Craft a Power Relay for Core Level 2." }
    ]
  },
  {
    id:"bit_bay", name:"BIT Bay", revealedAtCore:1, maxLevelByCore:{"1":1,"2":2},
    blurb:"Where BIT lives, heals, and levels the bond.",
    levels:[
      { level:1,
        cost:{ salvage:10, items:{ optical_sensor:1, cable:1 } },
        unlocks:["bit_online","loot_scan_1"],
        unlockText:"BIT is back online. One loot scan per raid. BIT is pleased. Statistically.",
        newGoal:"Choose your path: Storage (less friction) or save for Core L2 (new zone)." },
      { level:2,
        cost:{ salvage:45, dataCores:6, items:{ memory_module:1 } },
        unlocks:["bit_carry_1"],
        unlockText:"Cargo rack installed — BIT hauls one extra item home. Hardware, not sentiment.",
        newGoal:"Keep feeding the bond. BIT remembers." }
    ]
  },
  {
    id:"storage", name:"Storage / Vault", revealedAtCore:1, maxLevelByCore:{"1":1,"2":1},
    blurb:"Stash space, loadout presets, one secure slot.",
    levels:[
      { level:1,
        cost:{ salvage:25, items:{ polymer_plate:2, servo:1 } },
        unlocks:["stash_plus_8","secure_slot"],
        unlockText:"Vault sealed. +8 stash slots and one secure slot — it survives your death.",
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
