// Depth Raid prototype (v2.28.58). Carlos's area-clear loop: an area completes when its
// enemies are dead, then a paused EXTRACT / GO DEEPER popup; GO DEEPER unlocks a door into
// the next area of the same stitched level. Robert's lock (21 Nov 2026): no mid-area extract.
// Timeout of an area clock before a clear is a loss. All tuning is prototype, not a final pass.
var RAID_DEPTH_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_DEPTH_ROOT.DATA = RAID_DEPTH_ROOT.DATA || {};
RAID_DEPTH_ROOT.DATA.raidDepth = Object.freeze({
  // Prototype tuning: per-area HUD clock, ms. Index 0 = Area 1. Replaces the global 8-minute
  // round timer as the HUD clock in depth mode; the global timer keeps running underneath but
  // never fails the raid (nodspel/round.js tickRound).
  zoneTimerMs: [90000, 90000, 120000],
  // Prototype tuning: after the player chooses EXTRACT, walk into the beam, then this long
  // cancellable countdown (approved D2.3) before the bag actually secures.
  extractCountdownMs: 5000,
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
  // BIT lines (docs/bit-narrator.md, bug-lint `bit-introduces-systems-first`): the choice intro
  // plays once per profile, the first time the EXTRACT / GO DEEPER popup appears (introId is the
  // bitCardsSeen key). goDeeper is a regular contextual line. Neither reuses a line already in
  // data/bit-lines.js or another first-sight card. New introId so profiles that saw depth_intro
  // in v2.28.57 still hear the rewritten choice line once.
  // extract / extractFinal / finalArea (v2.28.61): the area-3 hatch used to be invisible because
  // the only 3D extract was built at area 1. BIT points at the hatch in THIS area before the
  // player has to find it (finalArea on entry, extractFinal when the beam opens).
  bitLines: {
    introId: 'depth_choice_intro',
    intro: "Area's clear. Take the loot home like a reasonable person, or walk through that door like the other kind. I'm professionally curious either way.",
    goDeeper: "Deeper it is. Harder toys in the next rooms. Try not to donate them back to the floor.",
    extractId: 'depth_extract_intro',
    extract: "The hatch is in this area, under the beam. The ones you already walked past stay shut. Try not to walk in circles about it.",
    extractFinal: "That's the way out. The hatch is in this last area, under the beam — not back the way you came.",
    finalAreaId: 'depth_final_area_intro',
    finalArea: "Last wing. Clear it, then look for the hatch in this area. The earlier ones are just scenery now.",
  },
});
