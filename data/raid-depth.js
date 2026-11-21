// Depth Raid prototype (PR1, Bunker only). Robert's design lock (21 Nov 2026): once a player goes
// deeper, extract stays closed until the next zone's window -- no always-on entry beam. Every number
// below is prototype tuning (his proposed start values in the brief), not a balanced final pass.
var RAID_DEPTH_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_DEPTH_ROOT.DATA = RAID_DEPTH_ROOT.DATA || {};
RAID_DEPTH_ROOT.DATA.raidDepth = Object.freeze({
  // Prototype tuning: per-zone HUD clock, ms. Index 0 = Zone 1. This replaces the global 8-minute
  // round timer as the HUD clock in depth mode; the global timer keeps running underneath but never
  // fails the raid (nodspel/round.js tickRound).
  zoneTimerMs: [90000, 90000, 120000],
  // Prototype tuning: once a zone timer hits 0, how long the extraction window stays lit before it
  // just... stays lit. Nothing auto-advances when this elapses (Robert: keep the beam open, keep
  // GO DEEPER available, never force a choice) -- it only gates nothing right now, kept as a named
  // constant for the HUD pulse timing and so a future owner call can act on it without a new rule.
  windowMs: 15000,
  // Prototype tuning: walk into the open beam, then this long cancellable in-zone countdown (approved
  // D2.3) before the bag actually secures. Leaving the beam cancels the attempt, not the raid.
  extractCountdownMs: 5000,
  // Prototype tuning: refuse-horde size on GO DEEPER, indexed by the zone just left (0 = leaving Z1,
  // 1 = leaving Z2). Reuses the seeded rusher/swarm spawn in nodspel/stakes.js -- never a new enemy type.
  refuseHordeSize: [{ min: 4, max: 6 }, { min: 6, max: 8 }],
  // Prototype tuning: Z3's full-clear bonus, paid on top of the existing RULES.extractScrapBonus
  // ladder (5/10/15 for zones reached) -- not a replacement for it.
  z3ClearBonusScrap: 25,
  // BIT lines (docs/bit-narrator.md, bug-lint `bit-introduces-systems-first`): the intro plays once
  // per profile, BEFORE the zone timer/pips/beam ever appear (introId is the bitCardsSeen key, same
  // pattern as power_pad_intro/shelf_intro/fuel_drum_intro); window/goDeeper are regular contextual
  // lines, shown every time, never persisted as "seen". None of the three reuse a line already in
  // data/bit-lines.js or another first-sight card.
  bitLines: {
    introId: 'depth_intro',
    intro: "When the clock dies I can pull you out. Or you can be greedy. I enjoy both outcomes, professionally.",
    window: "Beam's up. A perfectly respectable haul for someone who enjoys remaining alive.",
    goDeeper: "Just one more? Bold. I've updated your file from cautious to statistically interesting.",
  },
});
