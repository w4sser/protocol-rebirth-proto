// Live power-pad tuning. Day-2 unlock uses completed raids, not a wall-clock wait.
(function(){
  const D=globalThis.DATA=globalThis.DATA||{};
  D.raidJunction={unlockRaids:2,r:.7,cableLength:2,shootingDistance:1.5,clearance:.2,exitClearance:2.2,
    enemyDps:2,stunMs:180,overloadDamage:5,overloadRadius:3,overloadMs:450,cooldownMs:5000,introRange:6};
})();
