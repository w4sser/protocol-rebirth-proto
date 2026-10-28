// PR1 combat experiment. Shared by simulation and previews, including level one.
var RAID_COMBAT_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_COMBAT_ROOT.DATA = RAID_COMBAT_ROOT.DATA || {};
RAID_COMBAT_ROOT.DATA.raidCombat = Object.freeze({
  // Short archetype warnings are clamped to RULES.encounters.telegraphMs at runtime.
  telegraphs:{gruntMs:600,sentryMs:1200,sentryLockMs:300,sentryRecoveryMs:2000,
    chargerMs:800,chargerRange:6,chargerSpeed:12,turnRadPerSec:2,enemyRadius:.48,collisionEpsilon:.001,chargerStunMs:1200,chargerCooldownMs:2000,
    lineOpacity:.85,shieldDimOpacity:.18,shieldBrightOpacity:.7,shieldRadius:1.6,arcSegments:32,floorHeight:.12},
  weakSides:{backHalfAngleDeg:60,flankMultiplier:2,unawareMultiplier:3,markerMs:400},
  coverLeanReach:.9,
  enemyHitboxMargin:1.12, nearMissRadius:1.2,
  // Tap selects only the initial direction; minimum base cone also covers zero-spread Basic.
  tapSpreadMul: 1.5,
  tapMinSpreadDegrees: 3,
  tapRangeMul: 0.8,
  movingAssistAngleDegrees: 7,
  movingAssistWidth: 0.7,
  movingHomingDegreesPerSecond: 30,
  movementEpsilon: 0.000001,
  turretFanDegrees: [-15, 0, 15]
});
