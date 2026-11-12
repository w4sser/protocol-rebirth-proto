// Assistance is scoped to the direct first-raid launch, never the legacy intro.
var RAID_FTUE_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_FTUE_ROOT.DATA = RAID_FTUE_ROOT.DATA || {};
RAID_FTUE_ROOT.DATA.raidFtue = Object.freeze({
  clutch: {hunters:2,countdownMs:10000},
  enemies: [{x:-.7,z:-.6},{x:.7,z:-.6}],
  // D3.1 / D3.10: BIT is not present in the first raid at all (no drone, distract, heal, or
  // lines) -- he hasn't greeted the player yet (that happens in the cold open after this raid's
  // extraction). Move/shoot still works with no explanatory card; empty lines keep the
  // assist-ramp wiring (attempts/health/speed) intact.
  attempts: [
    {damageMul:1,healthMul:1,speedMul:1,minHealth:0,minTimeMs:0,line:''},
    {damageMul:.5,healthMul:.75,speedMul:.8,minHealth:0,minTimeMs:0,line:''},
    {damageMul:.25,healthMul:.5,speedMul:.6,minHealth:1,minTimeMs:1000,line:''},
  ],
});
