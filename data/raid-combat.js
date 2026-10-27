// PR1 combat experiment. Shared by simulation and previews, including level one.
var RAID_COMBAT_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_COMBAT_ROOT.DATA = RAID_COMBAT_ROOT.DATA || {};
RAID_COMBAT_ROOT.DATA.raidCombat = Object.freeze({
  enemyHitboxMargin:1.12, nearMissRadius:1.2,
  movingAssistAngleDegrees: 4,
  movingAssistWidth: 0.4,
  movingHomingDegreesPerSecond: 30,
  movementEpsilon: 0.000001,
  turretFanDegrees: [-15, 0, 15]
});
