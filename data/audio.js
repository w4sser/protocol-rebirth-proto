// Shared audio tuning; independent of gameplay/save data.
(function(root){
  root.DATA=root.DATA||{};
  const sfx={};
  const add=(names,gain=0.5,minGap=0)=>names.split(' ').forEach(name=>sfx[name]={file:'sfx/'+name,gain,minGap});
  add('shoot-carbine shoot-smg shoot-shotgun shoot-rifle shoot-air',0.95,40);
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
    defaults:{master:0.8,music:0.12,sfx:0.95,voice:0.9,muted:false,musicMuted:false,sfxMuted:false,voiceMuted:false},
    raidReadyWaitMs:5000,raidSfxWaitMs:150,
    unlockWaitMs:1500,decodeWaitMs:2500,voiceDecodeWaitMs:6000, // iOS state-lag/decode-stall caps (PRB-158); see docs/design-audio-oct28.md
    duckDb:-6,duckAttack:0.04,duckRelease:0.25,
    pitchVariation:0.035,gainVariation:0.08,globalVoiceCooldownMs:12000,
    shots:{
      // v2.28.76 (Robert 24 Nov 2026: "still no bang" -- peak was already near 0 dBFS, RMS/punch
      // was not): crack_decay under 5ms for a true short broadband transient (was 4-7ms), much
      // harder drive into the tanh saturation for a louder, saturated body at the same clamped
      // ceiling (RMS was the weak link, not peak), and a longer buffer/tailDecay so the room tail
      // actually rings out ~250-400ms instead of being cut off by the old .32s buffer. Mirrors
      // tools/audio/gen-sfx.py's POWDER_PROFILES exactly (see tools/audio/sfx-measure.json).
      duration:.34,attack:.0005,fade:.015,crackDecay:.003,bodyDecay:.07,tailDecay:.1,
      highpassHz:1600,bodyHz:1800,tailHz:650,thumpHz:90,thumpDecay:.16,
      crackGain:1.6,bodyGain:1.15,thumpGain:2.2,tailGain:.32,drive:3.4,ceiling:.92,
      echoes:[{delay:.034,gain:.18},{delay:.071,gain:.1},{delay:.11,gain:.05}],
      enemyGain:.46,enemyCrack:.5,enemyThump:.55,
      // A real limiter, not a compressor: threshold close to 0 dBFS (only the loudest peaks ever
      // touch it), the Web Audio API's max ratio (20:1, hard-knee), and a near-instant attack so
      // it catches a transient without "pumping" -- the old threshold:-10/ratio:4 engaged on
      // almost the whole shot and was the reason shots stayed quiet even after every gain above.
      compressor:{threshold:-2,knee:0,ratio:20,attack:.0005,release:.06},
      weapons:{
        carbine:{kind:'powder',pitch:1,gain:1},
        smg:{kind:'powder',pitch:1.17,gain:.86,duration:.3,crackDecay:.0022,crackGain:1.6,bodyGain:1.1,thumpGain:1.1,thumpHz:100,thumpDecay:.11,bodyDecay:.05,tailDecay:.08,tailGain:.27,drive:3.1},
        shotgun:{kind:'powder',pitch:.78,gain:1.18,duration:.4,crackDecay:.0035,crackGain:1.8,bodyGain:1.4,thumpGain:2.6,thumpHz:65,thumpDecay:.18,bodyDecay:.08,tailDecay:.12,tailGain:.42,drive:3.6},
        rifle:{kind:'powder',pitch:.9,gain:1.08,duration:.34,crackDecay:.003,crackGain:1.6,bodyGain:1.1,thumpGain:2.3,thumpHz:85,thumpDecay:.17,tailGain:.36,tailDecay:.1,drive:3.4},
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
