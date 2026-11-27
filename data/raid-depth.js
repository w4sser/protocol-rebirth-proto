// Depth Raid: walking chooses extraction or the next wing (Robert, 27 Nov 2026).
var RAID_DEPTH_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_DEPTH_ROOT.DATA = RAID_DEPTH_ROOT.DATA || {};
RAID_DEPTH_ROOT.DATA.raidDepth = Object.freeze({
  // Prototype tuning: per-area HUD clock, ms. Index 0 = Area 1. Replaces the global 8-minute
  // round timer as the HUD clock in depth mode; the global timer keeps running underneath but
  // never fails the raid (nodspel/round.js tickRound).
  zoneTimerMs: [90000, 90000, 120000],
  extractCountdownMs: 800,
  unclearedExtract: {scrapBonusMul:0},
  clearCache: {enabled:true, items:['cable','memory_module','encrypted_drive'], offset:2},
  hack: {holdMs:4000, radius:1.3, decayPerSec:0.25, noiseRadius:12, introRadius:8, placementStep:0.5},
  extractRadius: 1.45,
  // Prototype tuning: Area 3's full-clear bonus, paid on top of the existing RULES.extractScrapBonus
  // ladder (5/10/15 for areas reached) -- not a replacement for it.
  z3ClearBonusScrap: 25,
  // Modest per-area difficulty ramp (v2.28.61). Area 1 stays at the base L1 numbers.
  // Areas 2 and 3 add regular fillers and scale HP/damage on top of the stitched L2/L3
  // layouts, so going deeper is clearly harder without rewriting the encounters.
  areaScale: Object.freeze([
    Object.freeze({enemyCountAdd: 0, healthMul: 1,    damageMul: 1}),
    Object.freeze({enemyCountAdd: 2, healthMul: 1.25, damageMul: 1.15}),
    Object.freeze({enemyCountAdd: 3, healthMul: 1.5,  damageMul: 1.3}),
  ]),
  bitLines: {
    introId:'depth_walk_extract_intro',
    intro:'Beam is open. Leave whenever. Clear the wing if you want the bonus. Restraint pays poorly.',
    hackId:'depth_loud_terminal_intro',
    hack:'Stand on the terminal pad to hack. It is loud. A keycard also opens the door.',
    hackStart:'Subtle as a dropped toolbox. Expect company.',
    goDeeper:'Deeper it is. Harder toys ahead. Try not to donate them back to the floor.',
  },
});
