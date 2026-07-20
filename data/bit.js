// Protocol Rebirth prototype — BIT bond levels and dialogue.
window.DATA = window.DATA || {};
window.DATA.bit = {
  // Bond levels per META_v0.1 §4.2. xp thresholds are cumulative.
  // Bond = relation & intelligence. Hardware (loot scan, cargo) lives in BIT Bay levels.
  bondLevels:[
    { level:1, xp:0,   capability:"BIT follows you and comments on your runs." },
    { level:2, xp:30,  capability:"BIT estimates extraction odds before you deploy." },
    { level:3, xp:80,  capability:"BIT chooses one non-secure item to rescue when you die." },
    { level:4, xp:150, capability:"BIT reveals each zone's most likely drops." },
    { level:5, xp:250, capability:"BIT remembers zones — tracked items found twice as fast." }
  ],
  xpPerExtract:15,
  xpPerDeath:5,
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
    bond_up:[
      "bond level up. i would hug you but i am a drone.",
      "our working relationship has been upgraded. perks included.",
      "i have decided to trust you with more of my features. use them wisely."
    ],
    raid_prep:[
      "check your insurance. i checked mine. i don't have any. i'm the insurance.",
      "loadout looks... adequate. that's a compliment. from me it is.",
      "pick your risk. i'll be there either way. mostly there."
    ],
    bit_offline:[
      "…", "[unit offline — optical array missing]", "[BIT is here. BIT cannot see. find the sensor.]"
    ]
  }
};
