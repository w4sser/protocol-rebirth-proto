// Shared audio tuning; independent of gameplay/save data.
(function(root){
  root.DATA=root.DATA||{};
  const sfx={};
  const add=(names,gain=0.5,minGap=0)=>names.split(' ').forEach(name=>sfx[name]={file:'sfx/'+name,gain,minGap});
  add('shoot-carbine shoot-smg shoot-shotgun shoot-rifle',0.55,40);
  add('reload-carbine reload-smg reload-shotgun reload-rifle empty-carbine empty-smg empty-shotgun empty-rifle',0.35,180);
  add('impact-enemy impact-wall kill medkit dash perk-open perk-select ui-tap ui-back ui-confirm bag-full extract-countdown extract-success death',0.45,100);
  add('hit-grunt hit-rusher hit-thrower hit-tank hit-turret hit-generator death-grunt death-rusher death-thrower death-tank death-turret death-generator',0.35,160);
  add('pickup-common pickup-uncommon pickup-rare pickup-epic pickup-legendary',0.45,120);
  add('step-concrete step-gravel step-metal step-wood',0.2,320);
  add('alarm hunter-wave',0.55,1000);
  root.DATA.audio={
    storageKey:'pr-audio-v1',
    defaults:{master:0.8,music:0.3,ambience:0.45,sfx:0.75,voice:0.9,muted:false,musicMuted:false,ambienceMuted:false,sfxMuted:false,voiceMuted:false},
    duckDb:-6,duckAttack:0.04,duckRelease:0.25,
    pitchVariation:0.035,gainVariation:0.08,globalVoiceCooldownMs:12000,
    voiceCooldownMs:60000,voiceCooldowns:{'nice-shot':90000,'signal-lost':15000,'welcome-back':15000},
    voiceGain:0.95,killStreak:5,footstepMs:420,extractCountdownSeconds:10,
    rareTiers:['rare','epic','legendary'],
    weaponClasses:{basic_carbine:'carbine',smg_vector:'smg',shotgun_breach:'shotgun',rifle_marksman:'rifle'},
    enemyTypes:{grunt:'grunt',rusher:'rusher',thrower:'thrower',tank:'tank',turret:'turret',generator:'generator',guard:'tank',sentry:'turret'},
    areaBeds:{archipelago:'archipelago',bunker:'bunker',town:'bunker',base:'base'},
    areaSurfaces:{archipelago:'gravel',bunker:'concrete',town:'concrete'},
    surfaceTags:{archipelago:{pier:'wood',house:'wood'}},
    loops:{archipelago:{file:'ambience/archipelago',bus:'ambience',gain:0.65},bunker:{file:'ambience/bunker',bus:'ambience',gain:0.55},base:{file:'ambience/base',bus:'ambience',gain:0.5},pulse:{file:'music/pulse',bus:'music',gain:0.3}},
    voices:['hunters-inbound','scrap-detected','heal-budget-low','extraction-marked','bag-heavy','nice-shot','signal-lost','welcome-back'],sfx
  };
})(typeof window!=='undefined'?window:globalThis);
