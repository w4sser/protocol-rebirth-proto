// Protocol Rebirth prototype — BIT talent tree (docs/design-bit-skill-tree.md, v1.95).
// Data-driven: new branches/nodes are added here only, app.js never hardcodes a node id outside this file's ids.
// Row gate: row N needs rowGateStep*(N-1) points already spent in that branch (app.js: talentRowReq/talentRowUnlocked).
// Node: { id, row, ranks, choiceGroup?, effect:{ key, perRank } }. perRank[i] is the CUMULATIVE value at rank i+1.
// Row-2 "core" nodes (id === existing S.bit skill id) replace the old single-active-skill toggle: once learned,
// the skill is simply on (bitSkillOn checks talentLearned(id)), same as every other passive in the tree.
var BIT_TALENTS_ROOT = typeof window !== 'undefined' ? window : globalThis;
BIT_TALENTS_ROOT.DATA = BIT_TALENTS_ROOT.DATA || {};
BIT_TALENTS_ROOT.DATA.bitTalents = {
  // Rows 1-3 of a branch cap at 7 points (3+3+1), so a step of 3 (old rule) made rows 4-5 unreachable; 2 keeps
  // every row reachable while still forcing a real commitment per row.
  rowGateStep:2,
  branches:[
    {
      id:"scout", name:"Scout", color:"cyan",
      brief:"Information and finding the right loot.",
      nodes:[
        { id:"scout_keen_sensors", name:"Keen Sensors", row:1, ranks:3,
          desc:"Tracked part drop chance in BIT's marked zone.",
          effect:{ key:"scoutKeenSensors", perRank:[0.05, 0.10, 0.15] } },
        { id:"zone_scout", name:"Zone Scout", row:2, ranks:1,
          desc:"Marks the best zone and route for your tracked part, and what drops there.",
          effect:{ key:"scoutCore", perRank:[1] } },
        { id:"scout_long_ping", name:"Long Ping", row:2, ranks:2,
          desc:"Map reveals loot rooms in a 1/2 room radius on deploy.",
          effect:{ key:"scoutLongPing", perRank:[1, 2] } },
        { id:"scout_pathfinder", name:"Pathfinder", row:3, ranks:1, choiceGroup:"scout_row3",
          desc:"Route arrow to the exit; -10% extraction time.",
          effect:{ key:"scoutPathfinder", perRank:[0.10] } },
        { id:"scout_appraiser", name:"Appraiser", row:3, ranks:1, choiceGroup:"scout_row3",
          desc:"Rare and above loot glows through walls.",
          effect:{ key:"scoutAppraiser", perRank:[1] } },
        { id:"scout_memory_banks", name:"Memory Banks", row:4, ranks:3,
          desc:"Areas cleared before reveal containers on entry (per raid).",
          effect:{ key:"scoutMemoryBanks", perRank:[1, 2, 3] } },
        { id:"scout_recon_drone", name:"Recon Drone", row:5, ranks:1, capstone:true,
          desc:"Once per raid, BIT scouts the next room: shows enemies and the best container.",
          effect:{ key:"scoutReconDrone", perRank:[1] } }
      ]
    },
    {
      id:"guardian", name:"Guardian", color:"coral",
      brief:"Keeping you alive in raids.",
      nodes:[
        { id:"guardian_plating", name:"Plating", row:1, ranks:3,
          desc:"Max shield at deploy.",
          effect:{ key:"guardianPlatingShield", perRank:[5, 10, 15] } },
        { id:"shield_burst", name:"Shield Burst", row:2, ranks:1,
          desc:"BIT pulses a shield at deploy: +15 shield once per raid.",
          effect:{ key:"guardianCore", perRank:[1] } },
        { id:"guardian_warning_chirp", name:"Warning Chirp", row:2, ranks:2,
          desc:"Telegraphs elite attacks earlier.",
          effect:{ key:"guardianWarningChirp", perRank:[0.3, 0.6] } },
        { id:"guardian_second_wind", name:"Second Wind", row:3, ranks:1, choiceGroup:"guardian_row3",
          desc:"The first lethal hit leaves you at 1 HP, once per raid.",
          effect:{ key:"guardianSecondWind", perRank:[1] } },
        { id:"guardian_overcharge", name:"Overcharge", row:3, ranks:1, choiceGroup:"guardian_row3",
          desc:"Shield Burst also stuns nearby enemies for 1.5 s.",
          effect:{ key:"guardianOvercharge", perRank:[1] } },
        { id:"guardian_field_medic", name:"Field Medic", row:4, ranks:3,
          desc:"Medkits heal more.",
          effect:{ key:"guardianFieldMedic", perRank:[0.10, 0.20, 0.30] } },
        { id:"guardian_safe_return", name:"Safe Return", row:5, ranks:1, capstone:true,
          desc:"On death, BIT saves one pre-chosen material if it was found this raid (not gear).",
          effect:{ key:"guardianSafeReturn", perRank:[1] } }
      ]
    },
    {
      id:"scavenger", name:"Scavenger", color:"amber",
      brief:"The home economy.",
      nodes:[
        { id:"scav_deep_pockets", name:"Deep Pockets", row:1, ranks:3,
          desc:"Scavenge haul: extra basic parts.",
          effect:{ key:"scavDeepPockets", perRank:[1, 2, 3] } },
        { id:"loot_priority", name:"Loot Priority", row:2, ranks:1,
          desc:"Scavenge runs lean toward your tracked part (about 60% of picks), when BIT can fetch it.",
          effect:{ key:"scavCore", perRank:[1] } },
        { id:"scav_quick_legs", name:"Quick Legs", row:2, ranks:2,
          desc:"Scavenge run time.",
          effect:{ key:"scavQuickLegs", perRank:[0.10, 0.20] } },
        { id:"scav_salvager", name:"Salvager", row:3, ranks:1, choiceGroup:"scav_row3",
          desc:"Recycling yields +20% Scrap.",
          effect:{ key:"scavSalvager", perRank:[0.20] } },
        { id:"scav_haggler", name:"Haggler", row:3, ranks:1, choiceGroup:"scav_row3",
          desc:"Trader prices -15%.",
          effect:{ key:"scavHaggler", perRank:[0.15] } },
        { id:"scav_night_shift", name:"Night Shift", row:4, ranks:3,
          desc:"Offline cap for the generator (hours).",
          effect:{ key:"scavNightShift", perRank:[1, 2, 3] } },
        { id:"scav_lucky_find", name:"Lucky Find", row:5, ranks:1, capstone:true,
          desc:"1 in 4 hauls includes a rare part from the tracked chain.",
          effect:{ key:"scavLuckyFind", perRank:[1] } }
      ]
    }
  ]
};
