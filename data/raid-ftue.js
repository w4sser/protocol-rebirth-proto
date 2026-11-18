// Scripted, first playable raid only. Every coordinate is room-relative.
var RAID_FTUE_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_FTUE_ROOT.DATA = RAID_FTUE_ROOT.DATA || {};
RAID_FTUE_ROOT.DATA.raidFtue = Object.freeze({
  earlyLoot:{minCratesPerRoom:2,maxCratesPerRoom:3,
    spots:[{x:-4.05,z:-3.15},{x:-4.15,z:1.1},{x:3.5,z:2.15}],
    supplies:[{item:'scrap_alloy',quantity:2},{item:'cable',quantity:1},{item:'salvage_crate',quantity:1}]},
  opening:{
    start:{x:0,z:4},solo:{x:-1.2,z:-1.45},
    group:[{x:1.15,z:-3.15},{x:3.65,z:-3.15}],
    barrel:{x:2.4,z:-3.15,r:.62,blastRadius:2.5,damage:5,knockback:1.5},
    node:{x:4.5,z:-.7},exit:{x:4.5,z:-4.05},
    cover:[{x:-4.8,z:3.1,w:1,d:1,h:1},{x:4.8,z:3.1,w:1,d:1,h:1}],
    graceMs:5500,detectRadius:3.2,enemyCooldownMs:3600,
    soloHealth:1,groupHealth:2,soloSpeed:.18,groupSpeed:.25,
  },
  // BIT is met in the bunker only after extraction.
  attempts:[
    {damageMul:1,healthMul:1,speedMul:1,minHealth:0,minTimeMs:0,line:''},
    {damageMul:.5,healthMul:.75,speedMul:.8,minHealth:0,minTimeMs:0,line:''},
    {damageMul:.25,healthMul:.5,speedMul:.6,minHealth:1,minTimeMs:1000,line:''},
  ],
});
