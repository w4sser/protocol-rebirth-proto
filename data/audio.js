// Shared audio tuning; independent of gameplay/save data.
(function(root){
  root.DATA=root.DATA||{};
  const sfx={};
  const add=(names,gain=0.5,minGap=0)=>names.split(' ').forEach(name=>sfx[name]={file:'sfx/'+name,gain,minGap});
  add('shoot-carbine shoot-smg shoot-shotgun shoot-rifle',0.82,40);
  add('reload-carbine reload-smg reload-shotgun reload-rifle empty-carbine empty-smg empty-shotgun empty-rifle',0.35,180);
  add('impact-enemy impact-wall kill medkit dash perk-open perk-select ui-tap ui-back ui-confirm bag-full extract-countdown extract-success death',0.45,100);
  add('hit-grunt hit-rusher hit-thrower hit-tank hit-turret hit-generator death-grunt death-rusher death-thrower death-tank death-turret death-generator',0.35,160);
  add('pickup-common pickup-uncommon pickup-rare pickup-epic pickup-legendary',0.45,120);
  add('alarm hunter-wave',0.55,1000);
  root.DATA.audio={
    storageKey:'pr-audio-v1',
    defaults:{master:0.8,music:0.12,sfx:0.75,voice:0.9,muted:false,musicMuted:false,sfxMuted:false,voiceMuted:false},
    duckDb:-6,duckAttack:0.04,duckRelease:0.25,
    pitchVariation:0.035,gainVariation:0.08,globalVoiceCooldownMs:12000,
    shots:{
      duration:.32,attack:.0005,fade:.015,crackDecay:.007,bodyDecay:.055,tailDecay:.075,
      highpassHz:1400,bodyHz:1800,tailHz:650,thumpStartHz:150,thumpEndHz:40,thumpDrop:.035,thumpDecay:.12,
      crackGain:1.3,bodyGain:.8,thumpGain:1.4,tailGain:.22,drive:1.65,ceiling:.86,
      echoes:[{delay:.034,gain:.15},{delay:.071,gain:.07}],
      enemyGain:.46,enemyCrack:.5,enemyThump:.55,
      compressor:{threshold:-10,knee:12,ratio:4,attack:.002,release:.08},
      weapons:{carbine:{pitch:1,gain:1},smg:{pitch:1.17,gain:.86},shotgun:{pitch:.78,gain:1.18},rifle:{pitch:.9,gain:1.08}}
    },
    voiceCooldownMs:60000,voiceCooldowns:{'nice-shot':90000,'signal-lost':15000,'welcome-back':15000},
    voiceGain:0.95,killStreak:5,extractCountdownSeconds:10,
    rareTiers:['rare','epic','legendary'],
    weaponClasses:{basic_carbine:'carbine',smg_vector:'smg',shotgun_breach:'shotgun',rifle_marksman:'rifle'},
    enemyTypes:{grunt:'grunt',rusher:'rusher',thrower:'thrower',tank:'tank',turret:'turret',generator:'generator',guard:'tank',sentry:'turret'},
    startTheme:null, // Optional loop name on the start screen; silent by default.
    loops:{pulse:{file:'music/pulse',bus:'music',gain:0.3},'bunker-theme':{file:'music/bunker-theme',bus:'music',gain:0.5}},
    voices:['hunters-inbound','scrap-detected','heal-budget-low','extraction-marked','bag-heavy','nice-shot','signal-lost','welcome-back'],sfx
  };
})(typeof window!=='undefined'?window:globalThis);
