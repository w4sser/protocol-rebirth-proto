// Protocol Rebirth prototype — the scripted spine (first 60 minutes) + global knobs.
window.DATA = window.DATA || {};
window.DATA.progression = {
  raidPrepUnlockModule:"fabricator",
  // Node Raid bag size (v1.40.5): base + module upgrades + armour pockets, capped (core clamps to 4..10 again).
  raidBag:{ base:4, max:10, modules:{ storage:2 } },
  // default gear (was hardcoded in app.js, PRB-43): free infinite weapon, auto-equipped armor, Node Raid kit consumable
  freeWeapon:"basic_carbine",
  defaultLoadout:{ armor:"scavenger_vest", c1:"medkit" },
  kitItem:"medkit",
  starterRaid:{
    name:"Standard loot mission", zoneId:"industrial", routeId:"tunnels", riskId:"standard", insuranceId:"none",
    loadout:{ weapon:"basic_carbine", armor:null, c1:"medkit", c2:null }
  },
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
    cheapLoadoutItems:["medkit"]   // Basic Carbine is infinite; the vest is a later unlock
  },
  start:{
    currencies:{ scrap:20, dataCores:0, signals:0 },   // Salvage merged into Scrap (v1.35, 1 Salvage = 2 Scrap)
    stash:{ power_cell:1, scrap_alloy:3, medkit:1 }   // Basic Carbine is infinite (never in stash); Scavenger Vest unlocks at Fabricator L1
  },
  // Operator level: overall player level from total raid XP (core Node Raid + simulated raids).
  // XP to go from level n to n+1 = xpBase + xpStep*(n-1)  →  L2 at 50, L3 at 125, L4 at 225, L5 at 350, L10 at 1350.
  operator:{ xpBase:50, xpStep:25, maxLevel:30, simExtractXp:12, simDeathXp:4, coreMinXp:3 },
  beats:[
    { id:"tutorial", type:"intro",
      goalText:"Return to the facility",
      introTitle:"PROTOCOL REBIRTH",
      introText:"You made it out. A damaged drone — BIT — followed you home to a dead facility.\n\nBIT says it doesn't have to stay dead." },
    { id:"core_l1", type:"build", module:"rebirth_core", level:1,
      goalText:"Restore the Rebirth Core — 1× Power Cell, 2× Scrap Alloy" },
    { id:"raid_1", type:"raid",
      goalText:"Find 1× Cable and 1× Fuse for the Fabricator",
      forceOutcome:"extract", forceExceptRisk:"aggressive",
      guaranteedDrops:["cable","fuse"], insuranceOffered:false,
      autoTrack:{ module:"fabricator", level:1 } },
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
window.DATA.progression.currencyReveal = { scrap:"start", dataCores:"bit_online", signals:"insurance_offered" };

// Post-prototype playtest survey (3 taps, logged to the event log).
window.DATA.progression.survey = [
  { id:"end_building",   q:"What were you building at the end of the prototype?", opts:["Rebirth Core","Fabricator","BIT Bay","Storage / Vault","Not sure"] },
  { id:"benefit_known",  q:"What gameplay benefit would that upgrade have given you?", opts:["I knew exactly","Roughly","No idea"] },
  { id:"search_decision",q:"How did you decide where to search?", opts:["Followed the recommended route","Weighed risk vs reward myself","Picked more or less randomly"] },
  { id:"randomness",     q:"Did raid results feel random, controllable, or both?", opts:["Mostly random","Mostly controllable","Both — in a good way","Both — frustrating"] },
  { id:"push_deeper",    q:"Did you ever push deeper after finding useful loot? Why?", opts:["Yes — wanted a bigger haul","Yes — and regretted it","No — extracted safe","Never saw the choice"] },
  { id:"first_upgrade",  q:"Which upgrade would you choose first if you continued?", opts:["Core L2 — new zone","Fabricator L2 — better crafting","BIT Bay L2 — cargo rack","Storage — secure slot"] }
];

// Player stats passed to Node Raid (core). See docs/meta-core-integration.md §10.
// final = base + skill bonuses (level × perLevel) + gear modifiers, then clamped to `clamp` (core clamps again).
window.DATA.progression.playerStats = {
  base:{ speed:3.6, stealth:0, maxHealth:100, dashCooldownMs:4000 },
  clamp:{ speed:[2.5,6], stealth:[0,0.6], maxHealth:[50,200], dashCooldownMs:[2000,6000] },
  // Skills rise by use in raids (any outcome). xp needed for level n = xpPerLevel × n (cumulative), max level 10.
  // Three automatic skills (v1.41): they rise by playing, never need menus. Accessible: small, always-positive bonuses.
  skills:{
    mobility:{ name:"Mobility", icon:"🏃", xpPerLevel:20, maxLevel:10, perLevel:{ speed:0.06, dashCooldownMs:-100 },
      xp:{ perMetre:0.1, perDash:1 }, desc:"Move and dash to run faster and dash more often." },
    stealth:{ name:"Stealth", icon:"👁", xpPerLevel:15, maxLevel:10, perLevel:{ stealth:0.03 },
      xp:{ perHoldNode:5 }, desc:"Charge nodes up close; enemies notice you later." },
    crafting:{ name:"Crafting", icon:"🔧", xpPerLevel:15, maxLevel:10, perLevel:{}, craftDiscountPerLevel:0.03,
      xp:{ perCraft:6, perItemExtracted:1 }, desc:"Craft and bring loot home to pay less Scrap at the Fabricator." }
  },
  // Operator level adds a gentle speed bonus: +2% per level above 1, capped at +20%.
  operatorSpeed:{ perLevel:0.02, cap:0.2 },
  // Weapon mastery: kills with a weapon earn up to 3 stars; each star makes it reload/fire a bit faster.
  weaponMastery:{ killsForStar:[10, 30, 75], perStar:{ rld:-0.06, int:-0.04 } }
};
