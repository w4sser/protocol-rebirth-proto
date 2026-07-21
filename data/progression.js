// Protocol Rebirth prototype — the scripted spine (first 60 minutes) + global knobs.
window.DATA = window.DATA || {};
window.DATA.progression = {
  trackedPityRaids:2,        // tracked item guaranteed by Nth consecutive tracked raid
  insurance:{
    tiers:[
      { id:"none",    name:"None",    recovers:0, cost:0 },
      { id:"basic",   name:"Basic",   recovers:1, cost:2, desc:"Recover one equipped item" },
      { id:"premium", name:"Premium", recovers:2, cost:5, desc:"Recover any two equipped items" }
    ],
    adSignalsGrant:3         // fake rewarded ad grants this many Signals
  },
  recovery:{
    restoreBagSignals:4,     // post-death: restore whole bag
    cheapLoadoutScrap:15,    // one-tap recovery loadout cost
    cheapLoadoutItems:["basic_carbine","scavenger_vest"]
  },
  start:{
    currencies:{ scrap:20, dataCores:0, salvage:0, signals:0 },
    stash:{ power_cell:1, scrap_alloy:3, basic_carbine:1, scavenger_vest:1, medkit:1 }
  },
  beats:[
    { id:"tutorial", type:"intro",
      goalText:"Return to the facility",
      introTitle:"PROTOCOL REBIRTH",
      introText:"You made it out of the tutorial raid alive. Barely. A damaged AI drone followed you home — it calls itself BIT.\n\nThe facility you found is dark. Dead, almost. BIT says it doesn't have to stay that way." },
    { id:"core_l1", type:"build", module:"rebirth_core", level:1,
      goalText:"Restore the Rebirth Core — 1× Power Cell, 2× Scrap Alloy" },
    { id:"raid_1", type:"raid",
      goalText:"Find 1× Cable and 1× Fuse for the Fabricator",
      forceOutcome:"extract", forceExceptRisk:"aggressive",
      guaranteedDrops:["cable","fuse"], insuranceOffered:false },
    { id:"fabricator_l1", type:"build", module:"fabricator", level:1,
      goalText:"Build the Fabricator" },
    { id:"raid_2", type:"raid",
      goalText:"Find 1× Optical Sensor to repair BIT",
      forceOutcome:"extract", forceExceptRisk:"aggressive",
      guaranteedDrops:["optical_sensor","cable"], insuranceOffered:true,
      autoTrack:{ module:"bit_bay", level:1 } },
    { id:"bit_l1", type:"build", module:"bit_bay", level:1,
      goalText:"Repair BIT in the BIT Bay" },
    { id:"raid_3", type:"raid",
      goalText:"Your call now. Raid for Storage parts — or save toward Core L2.",
      forceOutcome:null, guaranteedDrops:[], insuranceOffered:true },
    { id:"choice_upgrade", type:"build_any", modules:["storage","rebirth_core"],
      goalText:"Build Storage L1 — or push for Core L2. Your strategy." },
    { id:"end", type:"end",
      goalText:"Prototype complete",
      endText:"That's the vertical slice. Everything past this point is the real game." }
  ]
};

// Progressive currency reveal (UI only — economy unchanged underneath).
window.DATA.progression.currencyReveal = { scrap:"start", salvage:"first_raid", dataCores:"bit_online", signals:"insurance_offered" };

// Post-prototype playtest survey (3 taps, logged to the event log).
window.DATA.progression.survey = [
  { id:"knew_target", q:"Did you always know what you were looking for before a raid?", opts:["Always","Mostly","Often lost"] },
  { id:"one_more",    q:"Did you catch yourself wanting one more raid?", opts:["Yes, several times","Once","Not really"] },
  { id:"best_moment", q:"Best moment?", opts:["Power restored","Finding a tracked item","Repairing BIT","Surviving a close raid"] },
  { id:"pull_back",   q:"When you stopped playing, was something in the base still pulling you back?", opts:["Yes, strongly","A little","No"] },
  { id:"confusion",   q:"What confused you the most?", opts:["Nothing","The currencies","Where to find items","Death and insurance rules"] }
];
