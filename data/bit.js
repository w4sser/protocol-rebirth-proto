// Protocol Rebirth prototype — BIT bond levels and dialogue.
var BIT_DATA_ROOT = typeof window !== 'undefined' ? window : globalThis;
BIT_DATA_ROOT.DATA = BIT_DATA_ROOT.DATA || {};
BIT_DATA_ROOT.DATA.bit = {
  // Bond levels per META_v0.1 §4.2. xp thresholds are cumulative.
  // Bond = relation & intelligence. Hardware (loot scan, cargo) lives in BIT Bay levels.
  // Bond cap 20 (docs/design-bit-skill-tree.md "Points"): 1 talent point per level from Bond 2, so Bond 20
  // gives 19 points. xp deltas after level 5 keep rising (+30 per level) so the climb to 20 stays slow.
  bondLevels:[
    { level:1,  xp:0,    capability:"BIT follows you and comments on your runs." },
    { level:2,  xp:30,   capability:"BIT estimates extraction odds before you deploy." },
    { level:3,  xp:80,   capability:"BIT chooses one non-secure item to rescue when you die." },
    { level:4,  xp:150,  capability:"BIT reveals each zone's most likely drops." },
    { level:5,  xp:250,  capability:"BIT remembers zones — tracked items found twice as fast." },
    { level:6,  xp:380,  capability:"+1 talent point to spend in the BIT screen." },
    { level:7,  xp:540,  capability:"+1 talent point to spend in the BIT screen." },
    { level:8,  xp:730,  capability:"+1 talent point to spend in the BIT screen." },
    { level:9,  xp:950,  capability:"+1 talent point to spend in the BIT screen." },
    { level:10, xp:1200, capability:"+1 talent point to spend in the BIT screen." },
    { level:11, xp:1480, capability:"+1 talent point to spend in the BIT screen." },
    { level:12, xp:1790, capability:"+1 talent point to spend in the BIT screen." },
    { level:13, xp:2130, capability:"+1 talent point to spend in the BIT screen." },
    { level:14, xp:2500, capability:"+1 talent point to spend in the BIT screen." },
    { level:15, xp:2900, capability:"+1 talent point to spend in the BIT screen." },
    { level:16, xp:3330, capability:"+1 talent point to spend in the BIT screen." },
    { level:17, xp:3790, capability:"+1 talent point to spend in the BIT screen." },
    { level:18, xp:4280, capability:"+1 talent point to spend in the BIT screen." },
    { level:19, xp:4800, capability:"+1 talent point to spend in the BIT screen." },
    { level:20, xp:5350, capability:"+1 talent point to spend in the BIT screen." }
  ],
  // v1.86 T3 (PRB-94): three BIT skills, unlocked by bond level, ONE active at a time (S.bitSkill). Mild by design.
  skills:[
    { id:"zone_scout",    bond:2, name:"Zone scout",    brief:"Marks the best zone and route for your tracked part, and shows what drops there." },
    { id:"shield_burst",  bond:3, name:"Shield burst",  brief:"BIT pulses a shield at deploy: +15 shield once per raid.", shield:15 },
    { id:"loot_priority", bond:4, name:"Loot priority", brief:"Scavenge runs lean toward your tracked part (about 60% of picks), when BIT can fetch it.", bias:0.6 }
  ],
  xpPerExtract:15,
  xpPerDeath:5,
  // Node Raid (core) bond XP. Granted like simulated raids (only while BIT Bay is online).
  // Full 3-level clear ≈ 6 nodes·2 + ~8 enemies·1 + 3·3 + 5 ≈ 34 XP; level-1 extract ≈ 12 XP (≈ xpPerExtract).
  coreRaidXp:{ perNode:2, perEnemy:1, perLevelCleared:3, extractBonus:5 },
  dialogue:{
    idle_base:[
      "good morning. you survived the night. statistically impressive.",
      "the facility is 3% less broken than yesterday. progress.",
      "i counted the ceiling tiles again. still 847. still boring.",
      "i would offer coffee, but the machine is one of the broken things."
    ],
    missing_part:[
      "still missing {item}. {zone}, statistically.",
      "we need {item}. i have marked {zone}. bring me back something nice.",
      "{item}. one of those. {zone} has them, probably. probably is my favorite word."
    ],
    tracked_found:[
      "THAT'S IT. that's the one. do not die now.",
      "target acquired. my repair schedule thanks you.",
      "you found it. i am recalibrating my expectations of you. upward."
    ],
    extracted:[
      "you came back. the odds said 85%. i said 100%. i lied, but nicely.",
      "extraction confirmed. let's go be architects.",
      "welcome home. i kept your spot warm. metaphorically. no heating yet."
    ],
    player_died:[
      "well. that happened. the base is fine. you will be too.",
      "you died. i logged it under 'learning experiences'. the log is getting long.",
      "gear is replaceable. you are marginally less replaceable. re-equip and go."
    ],
    module_built:[
      "look at that. it works. i am choosing to take partial credit.",
      "another system online. the facility remembers what it was.",
      "construction complete. i have already updated the to-do list. it grew."
    ],
    quest_handin:[
      "delivered. i filed it under: you are good at this.",
      "that is a correct answer. i checked twice.",
      "paperwork complete. reward dispatched. please act surprised."
    ],
    bond_up:[
      "bond level up. i would hug you but i am a drone.",
      "our working relationship has been upgraded. perks included.",
      "i have decided to trust you with more of my features. use them wisely."
    ],
    energy_low:[
      "Strommen dippar. Forstark vaggarna.",
      "Power is dipping. Reinforce the walls before the lights go.",
      "The grid is soft. Tap the power meter or bring me two Cable."
    ],
    energy_critical:[
      "Rooms are dark. Core stays lit. Reinforce or hand in Cable.",
      "Non-Core systems offline. RAID still works. Everything else waits.",
      "I can see the Core. I cannot see the Fabricator. That is a problem."
    ],
    raid_prep:[
      "check your insurance. i checked mine. i don't have any. i'm the insurance.",
      "loadout looks... adequate. that's a compliment. from me it is.",
      "pick your risk. i'll be there either way. mostly there."
    ],
    route_reco:[
      "{route} is our best lead. best does not mean good. i checked.",
      "if i were a {item}, i would be in the {route}. i have been wrong before. once.",
      "{route}. bring a weapon. bring two."
    ],
    decision_found:[
      "that is the part we need. leaving now would be statistically sensible.",
      "we have what we came for. everything past this point is greed. i respect it, but i log it.",
      "target secured. the exit is that way. the loot is the other way. your call."
    ],
    bit_offline:[
      "…", "[unit offline — optical array missing]", "[BIT is here. BIT cannot see. find the sensor.]"
    ]
  }
};
