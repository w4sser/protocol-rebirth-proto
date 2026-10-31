// Phase 1 enemy tuning. Future phases are registry-only and never enter spawn pools.
var ENEMY_DATA_ROOT = typeof window !== 'undefined' ? window : globalThis;
ENEMY_DATA_ROOT.DATA = ENEMY_DATA_ROOT.DATA || {};
ENEMY_DATA_ROOT.DATA.raidEnemies = {
  colors:{damage:'#E4705F',shield:'#5D8FD6',heal:'#70C98D',aoe:'#EBCB63'},
  shieldTurret:{health:3,lane:4.4,side:2.2,frontHalfAngleDeg:60,fireHalfAngleDeg:90,turnRadPerSec:1.7,warningMs:1100,burstShots:3,burstIntervalMs:200,recoveryMs:2600,damagePct:.12,counterOnHit:false,variantChance:.5},
  rusher:{windupMs:600,speedMul:2.5,stunMs:1500,backDamageMul:2,stalkMin:4,stalkMax:6,stalkMs:1400,recoveryMs:2000},
  patrolGrunt:{backDamageMul:1.75},
  models:{timeoutMs:3500},
  demo:{rusherHealth:3,rusherSpeed:1.6},
  stats:{shield_turret:{hpMul:1.5,speedMul:0,damageMul:1.2,rangeMul:1.35},rusher:{hpMul:1,speedMul:1.6,damageMul:1,rangeMul:.6},tank:{hpMul:4,speedMul:.5,damageMul:1.8,rangeMul:1},swarm_bot:{hpMul:.5,speedMul:1.8,damageMul:.5,rangeMul:.4},scout:{hpMul:.75,speedMul:1.5,damageMul:.5,rangeMul:1.2},artillery:{hpMul:1.5,speedMul:.4,damageMul:1.8,rangeMul:2},repair:{hpMul:1,speedMul:.8,damageMul:0,rangeMul:1},sniper:{hpMul:1,speedMul:.6,damageMul:2,rangeMul:2},patrol_grunt:{hpMul:1,speedMul:1,damageMul:1,rangeMul:1}},
};
