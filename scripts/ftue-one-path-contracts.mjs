// Static regression contracts complement the behavioral state-machine and browser walks.
export const FTUE_CONTRACTS = [
  ['wake-core-direct', 'wake bypasses extraction choices', 'appSrc', /coreLevel\(\) < 1[\s\S]*?A\.build\("rebirth_core"\); return;/],
  ['sleeping-bit-raid', 'first-sight cards defer without consuming seen flags', 'gameSrc', /function checkDrumIntro\(\)\{\s*if\(!bitAlong\)return;/],
  ['fabricator-base-briefing', 'Fabricator is introduced over the lit base', 'appSrc', /queueBaseIntro\(roomUnlockStages\("fabricator"\)\.teaser/],
  ['fabricator-single-choice', 'successful guided extraction has one direct build action', 'appSrc', /BUILD FABRICATOR<\/button><\/div>', null, "sheet raid-summary-ov", \{noClose:true\}/],
  ['build-skips-activation', 'ready guided builds spend through the build action', 'appSrc', /const ctaFn = \(\(restore \|\| S\.ftuePath\) && g\.ready\) \? 'A.build'/],
  ['reward-after-scene', 'Fabricator reward follows scene completion', 'appSrc', /fabricatorCutsceneBeat\(beat => queueSystemIntro\(beat, \(\) => \{\s*overlay\(upgradeRewardHtml/],
  ['quests-after-vault', 'quest chains and tracking wait for the Vault', 'appSrc', /function questsAfterVault\(\)\{ return !S\.ftuePath \|\| !!S\.bitCardsSeen\.vault_unlocked; \}/],
  ['vault-base-briefing', 'Vault teaser is a base card, powered pair follows build', 'appSrc', /queueBaseIntro\(roomUnlockStages\("storage"\)\.teaser\)/],
  ['labelled-build-goal', 'ready goal keeps a labelled BUILD action', 'appSrc', /g\.ready\?'BUILD ' \+ \(g\.module === 'storage' \? 'VAULT'/]
];
