// Shared audio tuning; independent of gameplay/save data.
(function(root){
  root.DATA=root.DATA||{};
  const sfx={};
  const add=(names,gain=0.5,minGap=0)=>names.split(' ').forEach(name=>sfx[name]={file:'sfx/'+name,gain,minGap});
  add('shoot-carbine shoot-smg shoot-shotgun shoot-rifle shoot-air',0.82,40);
  add('reload-carbine reload-smg reload-shotgun reload-rifle empty-carbine empty-smg empty-shotgun empty-rifle',0.35,180);
  add('impact-enemy impact-wall kill medkit dash perk-open perk-select ui-tap ui-back ui-confirm bag-full extract-countdown extract-success death',0.45,100);
  add('hit-grunt hit-rusher hit-thrower hit-tank hit-turret hit-generator death-grunt death-rusher death-thrower death-tank death-turret death-generator',0.35,160);
  add('pickup-common pickup-uncommon pickup-rare pickup-epic pickup-legendary',0.45,120);
  add('alarm hunter-wave',0.55,1000);
  // v2.28.75: mortar/grenade blasts (combat.js stepBlasts) and fuel-drum detonations
  // (round.js detonateDrum) had no dedicated boom -- only unrelated impact/death cues layered
  // over each other. minGap keeps a chain of drum cook-offs from stacking into a buzz.
  add('explosion',0.85,150);
  root.DATA.audio={
    storageKey:'pr-audio-v1',
    defaults:{master:0.8,music:0.12,sfx:0.75,voice:0.9,muted:false,musicMuted:false,sfxMuted:false,voiceMuted:false},
    raidReadyWaitMs:5000,raidSfxWaitMs:150,
    unlockWaitMs:1500,decodeWaitMs:2500,voiceDecodeWaitMs:6000, // iOS state-lag/decode-stall caps (PRB-158); see docs/design-audio-oct28.md
    duckDb:-6,duckAttack:0.04,duckRelease:0.25,
    pitchVariation:0.035,gainVariation:0.08,globalVoiceCooldownMs:12000,
    shots:{
      // v2.28.75 (Robert 24 Nov 2026: shots still read like laser pea-shooters): sharper crack
      // (higher highpassHz), a real sub-range thump (thumpHz dropped an octave-plus) hitting much
      // harder (thumpGain nearly 1.5x), more low-mid body, a denser 3-echo short room tail, and
      // more drive/ceiling headroom so powder weapons land with real weight.
      duration:.32,attack:.0005,fade:.015,crackDecay:.007,bodyDecay:.07,tailDecay:.09,
      highpassHz:1600,bodyHz:1800,tailHz:650,thumpHz:90,thumpDecay:.16,
      crackGain:1.5,bodyGain:1,thumpGain:2,tailGain:.3,drive:2,ceiling:.92,
      echoes:[{delay:.034,gain:.18},{delay:.071,gain:.1},{delay:.11,gain:.05}],
      enemyGain:.46,enemyCrack:.5,enemyThump:.55,
      compressor:{threshold:-10,knee:12,ratio:4,attack:.002,release:.08},
      weapons:{
        carbine:{kind:'powder',pitch:1,gain:1},
        smg:{kind:'powder',pitch:1.17,gain:.86,crackDecay:.004,thumpGain:1,thumpHz:100,thumpDecay:.11,bodyDecay:.05,tailDecay:.07,tailGain:.25},
        shotgun:{kind:'powder',pitch:.78,gain:1.18,crackGain:1.7,bodyGain:1.3,thumpGain:2.4,thumpHz:65,thumpDecay:.18,bodyDecay:.08,tailDecay:.12,tailGain:.4,drive:2.3},
        rifle:{kind:'powder',pitch:.9,gain:1.08,thumpGain:2.1,thumpHz:85,thumpDecay:.17,tailGain:.34,tailDecay:.1},
        air:{kind:'air',pitch:1.18,gain:.82,duration:.2,drive:1.45,crackGain:1.15,hissHz:4200,hissGain:.75,hissDecay:.05,bodyGain:.22}
      }
    },
    explosion:{
      // v2.28.75 (Robert 24 Nov 2026: mortar shells must boom, not tick): low-passed noise,
      // a sub thump and a rumble tail. No sine tone.
      duration:.62,attack:.003,fade:.08,
      bodyHz:280,bodyGain:1.4,bodyDecay:.14,
      thumpHz:45,thumpGain:2.2,thumpDecay:.24,
      rumbleHz:90,rumbleGain:.9,rumbleDecay:.38,
      drive:1.8,ceiling:.9,
      echoes:[{delay:.04,gain:.2},{delay:.09,gain:.12},{delay:.16,gain:.06}]
    },
    voiceCooldownMs:60000,voiceCooldowns:{'nice-shot':90000,'signal-lost':15000,'welcome-back':15000,'youre-back':15000},
    voiceGain:0.95,killStreak:5,extractCountdownSeconds:10,
    rareTiers:['rare','epic','legendary'],
    weaponClasses:{basic_carbine:'carbine',smg_vector:'smg',shotgun_breach:'shotgun',rifle_marksman:'rifle'},
    enemyTypes:{grunt:'grunt',rusher:'rusher',thrower:'thrower',tank:'tank',turret:'turret',generator:'generator',guard:'tank',sentry:'turret'},
    startTheme:'bunker-theme', // Start screen plays the bunker theme and carries it into the base without restart.
    loops:{pulse:{file:'music/pulse',bus:'music',gain:0.3},'bunker-theme':{file:'music/bunker-theme',bus:'music',gain:0.5}},
    voices:['hunters-inbound','scrap-detected','heal-budget-low','extraction-marked','bag-heavy','nice-shot','signal-lost','welcome-back','youre-back'],sfx
  };
})(typeof window!=='undefined'?window:globalThis);
