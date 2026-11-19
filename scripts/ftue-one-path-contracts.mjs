// Static regression contracts complement the behavioral state-machine and browser walks.
export const FTUE_CONTRACTS = [
  ['sleeping-bit-voice', 'sleeping BIT never comments through raid audio events', 'audioSrc', /const bitVoiceAllowed=bitAccompaniesRaid[\s\S]*?function bitVoice\(name\)\{if\(bitVoiceAllowed\)void audio\.voice\(name\);\}/],
  ['quest-return-intro', 'the real raid-return summary hands off to the deferred quest introduction', 'appSrc', /RAID_SUMMARY_CLOSED[\s\S]*?if\(S\.ftuePath\) maybeShowQuestIntro\(\)/],
  ['legacy-quest-access', 'returning profiles past the previous FTUE retain their behavior', 'appSrc', /const pastIntro = st\.beat > PROG\.beats\.findIndex\(b => b\.id === "raid_1"\);[\s\S]*?st\.ftuePath = !pastIntro/],
  ['resume-held-room', 'migration preserves incomplete powered scenes for reload recovery', 'appSrc', /if\(st\.bitCardsSeen\.vault_unlocked === undefined\) st\.bitCardsSeen\.vault_unlocked = true/],
  ['wake-core-direct', 'wake bypasses extraction choices', 'appSrc', /coreLevel\(\) < 1[\s\S]*?A\.build\("rebirth_core"\); return;[\s\S]*?else if\(S\.ftuePath && S\.raids > 0 && coreLevel\(\) < 1\)\{[\s\S]*?A\.build\("rebirth_core"\)/],
  ['sleeping-bit-raid', 'first-sight cards defer without consuming seen flags', 'gameSrc', /function checkDrumIntro\(\)\{\s*if\(!bitAlong\)return;[\s\S]*?function checkPadIntro\(clock\)\{\s*if\(!bitAlong\)return;[\s\S]*?function checkShelfIntro\(\)\{\s*if\(!bitAlong\)return;/],
  ['fabricator-base-briefing', 'Fabricator is introduced over the lit base', 'appSrc', /queueBaseIntro\(roomUnlockStages\("fabricator"\)\.teaser/],
  ['fabricator-single-choice', 'successful guided extraction has one direct build action', 'appSrc', /BUILD FABRICATOR<\/button><\/div>', null, "sheet raid-summary-ov", \{noClose:true\}/],
  ['build-skips-activation', 'ready guided builds spend through the build action', 'appSrc', /const ctaFn = \(\(restore \|\| guidedBuildPath\(\)\) && g\.ready\) \? 'A.build'/],
  ['reward-after-scene', 'Fabricator reward follows scene completion', 'appSrc', /fabricatorCutsceneBeat\(beat => queueSystemIntro\(beat, \(\) => \{\s*overlay\(upgradeRewardHtml/],
  ['quests-after-vault', 'quest chains and tracking wait for the Vault', 'appSrc', /function questsAfterVault\(\)\{ return !S\.ftuePath \|\| \(!!S\.bitCardsSeen\.vault_unlocked && !!S\.bitCardsSeen\.quest_intro\); \}/],
  ['vault-base-briefing', 'Vault teaser is a base card, powered pair follows build', 'appSrc', /queueBaseIntro\(roomUnlockStages\("storage"\)\.teaser\)/],
  ['labelled-build-goal', 'ready goal keeps a labelled BUILD action', 'appSrc', /g\.ready\?'BUILD ' \+ \(g\.module === 'storage' \? 'VAULT'/]
];
