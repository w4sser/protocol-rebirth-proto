// BIT's end-of-raid voice and presentation thresholds. First matching trigger wins.
var BIT_LINES_ROOT = typeof window !== 'undefined' ? window : globalThis;
BIT_LINES_ROOT.DATA = BIT_LINES_ROOT.DATA || {};
BIT_LINES_ROOT.DATA.bitSummary = {
  rareTier:3, nearEmptyItems:1, glutCount:4, shortRaidMs:60000, closeHealthFraction:0.2, closeShieldFraction:0.1,
  priority:['rare','quest','weapon','close','empty','glut','short','generic'],
  pools:{
    rare:{mood:'impressed',lines:["A memory module. Hoarding those now? Fine, be mysterious.","Legendary. I'm recalibrating my expectations of you upward. Slightly.","That belongs in a vault. We have a cupboard. It'll do.","An actual rare find. I checked the scanner twice."]},
    quest:{mood:'smug',lines:["Quest complete. I'll allow a moment of pride. One moment.","Objective complete. I had the paperwork ready. Optimism, apparently.","A finished task. My favourite kind of loose end."]},
    weapon:{mood:'smug',lines:["You brought the gun home this time. Wonders happen.","Weapon accounted for. A refreshing approach to inventory.","You and the gun both returned. I'll update the odds."]},
    close:{mood:'relieved',lines:["You left a leg behind. Figuratively. I checked twice.","Your vitals had me reaching for the warranty.","Next time, leave a little more of yourself intact."]},
    empty:{mood:'bored',lines:["Four scrap alloy. I've seen vending machines haul more.","A modest haul. Very modest. Almost theoretical.","The bag survived its demanding shift of carrying air."]},
    glut:{mood:'sarcastic',lines:["That's the fourth polymer plate today. The stash is judging you.","More of those. Shall I label a second shelf?",
      "Our collection of identical things grows ever more identical."]},
    short:{mood:'bored',lines:["No loot, no kills, you just... walked. Impressive, somehow.","Back already. Did the surface close early?","A brief visit. The dust barely had time to settle."]},
    death:{mood:'disappointed',lines:["You're back. The equipment has chosen a longer stay.","I've filed the losses. Sit down; the chair is still ours.","A rough outing. We'll work with what's left."]},
    generic:{mood:'sarcastic',lines:["Extraction secured. Try not to die next time - I have a reputation.","You extracted. Nothing died. Low bar, you cleared it.","Inventory updated. My enthusiasm remains within safe limits.","A haul, a pulse, and more paperwork. A complete evening."]}
  }
};
