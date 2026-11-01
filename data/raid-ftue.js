// Assistance is scoped to the direct first-raid launch, never the legacy intro.
var RAID_FTUE_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_FTUE_ROOT.DATA = RAID_FTUE_ROOT.DATA || {};
RAID_FTUE_ROOT.DATA.raidFtue = Object.freeze({
  enemies: [{x:-.7,z:-.6},{x:.7,z:-.6}],
  attempts: [
    {damageMul:1,healthMul:1,speedMul:1,minHealth:0,minTimeMs:0,line:'BIT: Tap the right stick to shoot. Grab the supplies and extract.'},
    {damageMul:.5,healthMul:.75,speedMul:.8,minHealth:0,minTimeMs:0,line:'BIT: rerouted power to your shields. Try again.'},
    {damageMul:.25,healthMul:.5,speedMul:.6,minHealth:1,minTimeMs:1000,line:"BIT: I've got you this time."},
  ],
});
