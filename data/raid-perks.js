// Temporary raid upgrades; no economy or saved progression.
var RAID_PERKS_ROOT = typeof window !== 'undefined' ? window : globalThis;
RAID_PERKS_ROOT.DATA = RAID_PERKS_ROOT.DATA || {};
RAID_PERKS_ROOT.DATA.raidPerks = Object.freeze({
  logLimit:32, chainBonus:.5, reloadMultiplier:.8, reloadFloorMs:250,
  dashMultiplier:.75, dashFloorMs:2000, shieldThreshold:.2, shieldReduction:.5,
  shieldMs:2000, medicRate:8, dressingHP:20, timeMs:8000,
  terminalDashMs:3000, terminalReconMs:5000, terminalDressingMs:8000,
  cards:[
    {id:'chain',name:'Chain Reaction',category:'OFFENSE',accent:'loot',effect:'Weapon kills charge your next shot: +50% damage.'},
    {id:'reload',name:'Calm Reload',category:'WEAPON',accent:'loot',effect:'Reload interval -20%, minimum 250 ms.'},
    {id:'roll',name:'Rolling',category:'MOBILITY',accent:'cyan',effect:'Dash cooldown -25%, minimum 2 s.'},
    {id:'shield',name:'Emergency Shield',category:'DEFENSE',accent:'danger',effect:'At 1-20% HP: 50% less damage for 2 s, once per room.'},
    {id:'medic',name:'Field Medic',category:'BIT',accent:'cyan',effect:'BIT heals 8 HP/s instead of 5 while you stand still.'},
    {id:'recon',name:'Recon',category:'INTEL',accent:'cyan',effect:'Mark warning sources and loot left in cleared rooms.'},
    {id:'dressing',name:'Field Dressing',category:'RECOVERY',accent:'danger',effect:'Restore up to 20 HP immediately.'},
    {id:'time',name:'Time Margin',category:'SYSTEM',accent:'cyan',effect:'Add 8 s to the raid timer immediately.'}
  ]
});
