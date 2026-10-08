// Combat sandbox tuning. Kept separate from the meta-game economy.
window.DATA = window.DATA || {};
window.DATA.combat = {
  player: { maxHealth:100, moveSpeed:0.72, tapMoveDistance:5, fireInterval:240, magazine:18, reloadTime:900, pickupRadius:7 },
  drone: { count:5, maxHealth:2, moveSpeed:0.09, contactDamage:4, contactCooldown:1200,
    spawns:[[70,23],[83,64],[64,82],[24,36],[15,70]] },
  bit: { pulseRadius:25, pulseDamage:1, pulseCooldown:5000 },
  loot: { salvagePerDrone:1, medGelEvery:3, medGelHeal:24, medGelItemId:"med_gel" },
  field: { width:100, height:100, edgeMargin:6, spawnX:48, spawnY:56 }
};
