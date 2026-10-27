// BIT's end-of-raid voice and presentation thresholds. First matching trigger wins.
var BIT_LINES_ROOT = typeof window !== 'undefined' ? window : globalThis;
BIT_LINES_ROOT.DATA = BIT_LINES_ROOT.DATA || {};
BIT_LINES_ROOT.DATA.bitSummary = {
  closeTimerMs:30000, loadedItems:8, manyKills:4, rareTier:3, nearEmptyItems:1, glutCount:4, shortRaidMs:60000, closeHealthFraction:0.2, closeShieldFraction:0.1,
  priority:['first','rare','quest','close','timer','gearLost','loaded','perks','kills','weapon','empty','glut','short','generic'],
  pools:{
    first:{mood:'impressed',lines:["First extraction logged. Now we have something to build on.","You found the way home. That is the part I care about.","Our first successful return. I saved a shelf for this."]},
    timer:{mood:'relieved',lines:["Next time, beat the clock by more than a rounding error.","I was about to stop counting. You picked a dramatic moment.","That timer was getting personal. Welcome back."]},
    loaded:{mood:'impressed',lines:["That bag earned its stitching today.","I cleared a shelf. Then I cleared another shelf.","You brought enough back to make inventory interesting."]},
    gearLost:{mood:'disappointed',lines:["Equipment spent. We will need replacements.","Equipment lost. Keeping you operational was the better trade.","I marked the missing gear. You still made progress."]},
    perks:{mood:'smug',lines:["Those field upgrades seem to have agreed with you.","A few new tricks and a return trip. Useful research.","I logged your perk choices. We can learn from that run."]},
    kills:{mood:'impressed',lines:["That is a quieter sector than the one you entered.","You cleared a path and brought the evidence home.","Threat count down. Supply count up. Acceptable arithmetic."]},
    rare:{mood:'impressed',lines:["A rare find. Hoarding those now? Fine, be mysterious.","I am recalibrating my expectations of your scavenging. Slightly.","That belongs in a vault. We have a cupboard. It'll do.","An actual rare find. I checked the scanner twice."]},
    quest:{mood:'smug',lines:["Quest complete. I'll allow a moment of pride. One moment.","Objective complete. I had the paperwork ready. Optimism, apparently.","A finished task. My favourite kind of loose end."]},
    weapon:{mood:'smug',lines:["You brought the gun home this time. Wonders happen.","Weapon accounted for. A refreshing approach to inventory.","You and the gun both returned. I'll update the odds."]},
    close:{mood:'relieved',lines:["You left a leg behind. Figuratively. I checked twice.","Your vitals had me reaching for the warranty.","Next time, leave a little more of yourself intact."]},
    empty:{mood:'bored',lines:["A light bag. I have seen vending machines haul more.","A modest haul. Very modest. Almost theoretical.","The bag survived its demanding shift of carrying air."]},
    glut:{mood:'sarcastic',lines:["More duplicates. The stash is judging you.","More of those. Shall I label a second shelf?",
      "Our collection of identical things grows ever more identical."]},
    short:{mood:'bored',lines:["A quick trip and no combat. Efficient, if a little quiet.","Back already. Did the surface close early?","A brief visit. The dust barely had time to settle."]},
    death:{mood:'disappointed',lines:["You're back. The equipment has chosen a longer stay.","I've filed the losses. Sit down; the chair is still ours.","A rough outing. We'll work with what's left."]},
    generic:{mood:'sarcastic',lines:["Extraction secured. Try not to die next time - I have a reputation.","You extracted. Supplies accounted for. I can work with that.","Inventory updated. My enthusiasm remains within safe limits.","A haul, a pulse, and more paperwork. A complete evening."]}
  }
};
