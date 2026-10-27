// v2.4.1 stakes PR1 (docs/design-stakes-perks-oct27.md section 4 and 6). No heat mechanic: waves run on a
// fixed clock only. Every number a raid's stakes systems use lives here, never hardcoded in nodspel/*.js.
var RAID_STAKES_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_STAKES_ROOT.DATA = RAID_STAKES_ROOT.DATA || {};
RAID_STAKES_ROOT.DATA.raidStakes = Object.freeze({
  // Heal budget: a lifetime cap on healing per raid (BIT regen, medkits, kill reward, perk heals), a
  // fraction of the round's max HP, fixed once at raid start so later maxHealth changes do not shrink it.
  healBudgetFraction: .6,
  // BIT warns once when the remaining budget drops to/under this many HP, and once more when it hits 0.
  healLowThreshold: 15,
  // Alarm + hunter waves: a raid-global clock, independent of room contents. Elapsed time is read off
  // round.durationMs - round.remainingMs, which already freezes while the raid is paused (perk modal).
  alarmDelayMs: 75000,
  waveIntervalMs: 45000,
  // Countdown banner ("Hunters in 0:10") starts this long before each wave spawns.
  waveWarnMs: 10000,
  // How long the one-shot "ALARM" banner stays up when the clock first trips.
  alarmBannerMs: 4000,
  // Wave N sends ceil(N/2) rushers, capped at waveSizeMax, plus a per-level bonus (index = level number - 1).
  waveSizeMax: 3,
  waveLevelBonus: [0, 0, 1],
  // Each rusher's health; speed/range/standoff reuse the existing 'rusher' enemy type (data/raid-combat.js
  // has no stake-specific speed - hunters inherit the current level's base enemy speed).
  waveRusherHealth: 1,
  // Carried-value HUD line: brief pulse whenever the estimated bag value increases.
  carryPulseMs: 900,
  // Bag weight (fraction of capacity used): linear penalty up to these fractions at a full bag.
  bagWeight: { maxSpeedPenalty: .2, maxDetectionBonus: .5 },
});
