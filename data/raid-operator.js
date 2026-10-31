// Human operator art hooks. Gameplay collision, movement and damage remain in raid tuning.
var RAID_OPERATOR_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_OPERATOR_ROOT.DATA = RAID_OPERATOR_ROOT.DATA || {};
RAID_OPERATOR_ROOT.DATA.raidOperator = Object.freeze({
  asset: './assets/human-operator.glb?v=2.14.0',
  // v2.10.0: read small next to the robot (1.4 vs the robot's own ~1.1) on a phone-size viewport; raised
  // clearly above both so the human skin is never the harder-to-spot option.
  height: 1.65,
  clips: Object.freeze({idle:'Idle_Gun',run:'Run',back:'Run_Back',shoot:'Gun_Shoot',aim:'Idle_Gun_Pointing',dash:'Roll',hit:'HitRecieve',death:'Death'}),
});
