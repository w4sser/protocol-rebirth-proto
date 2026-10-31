// v2.7.0 stakes PR1 (docs/design-stakes-perks-oct27.md section 4 and 6). No heat mechanic: waves run on a
// fixed clock only. Every number a raid's stakes systems use lives here, never hardcoded in nodspel/*.js.
var RAID_STAKES_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_STAKES_ROOT.DATA = RAID_STAKES_ROOT.DATA || {};
RAID_STAKES_ROOT.DATA.raidStakes = Object.freeze({
  extractHoldMs:1000,
  // Heal budget: a fixed lifetime cap on healing per raid (BIT regen, medkits, kill reward, perk heals).
  // Fixed HP, not a fraction of max HP, so Vitality progression never raises or lowers this allowance.
  healBudgetHP: 60,
  // BIT warns once when the remaining budget drops to/under this many HP, and once more when it hits 0.
  healLowThreshold: 15,
  // Alarm + hunter waves: a raid-global clock, independent of room contents. Elapsed time is read off
  // round.durationMs - round.remainingMs, which already freezes while the raid is paused (perk modal).
  alarmDelayMs: 75000,
  waveIntervalMs: 45000,
  // Retry a deferred wave when no hidden, distant, unlocked spawn route exists.
  waveRetryMs: 3000,
  // Countdown banner ("Hunters in 0:10") starts this long before each wave spawns.
  waveWarnMs: 10000,
  // How long the one-shot "ALARM" banner stays up when the clock first trips.
  alarmBannerMs: 4000,
  // Wave N sends ceil(N/waveSizeDivisor) rushers, capped at waveSizeMax, plus a per-level bonus (index =
  // level number - 1).
  waveSizeMax: 3,
  waveSizeDivisor: 2,
  waveLevelBonus: [0, 0, 1],
  // Each rusher's health; speed/range/standoff reuse the existing 'rusher' enemy type (data/raid-combat.js
  // has no stake-specific speed - hunters inherit the current level's base enemy speed).
  waveRusherHealth: 1,
  // A hunter wave must appear at least this far (metres) from the player's position at spawn time -
  // re-checked then, not just when the countdown first picked a target - and never in the room the player
  // currently occupies.
  hunterMinSpawnDistanceM: 14,
  // Widest supported landscape aspect (932x430); expanded frustum plus hunter body bounds.
  hunterCamera: { maxAspect: 932 / 430, frustumMargin: 1.15, centreHeight: .75, radius: 1.5 },
  // Free-point search within a candidate spawn zone (room / corridor / dead end / closet): attempts before
  // giving up on that zone, the jitter radius floor/minimum, clearance kept from the zone's own walls, and
  // the margin kept from any wall/box solid.
  spawnAttempts: 40,
  spawnRadiusMin: .6,
  spawnRadiusFloor: .1,
  spawnWallClearance: 1.4,
  spawnSolidMargin: .6,
  // Carried-value HUD line: brief pulse whenever the estimated bag value increases.
  carryPulseMs: 900,
  // Bag weight (fraction of capacity used): linear penalty up to these fractions at a full bag.
  bagWeight: { maxSpeedPenalty: .2, maxDetectionBonus: .5 },
});
