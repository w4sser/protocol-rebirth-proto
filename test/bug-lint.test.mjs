// Proves each bug-lint rule actually fires on the regression it guards.
import fs from 'node:fs';
import assert from 'node:assert/strict';import {RULES,runAll} from '../scripts/bug-lint.mjs';
const by=id=>RULES.find(r=>r.id===id);
assert.ok(by('no-tracked-node-modules').check({files:['node_modules'],gitignore:'node_modules/\n'}).length===2,'#129 fires');
assert.equal(by('no-tracked-node-modules').check({files:['a.js'],gitignore:'node_modules\n'}).length,0);
assert.equal(by('audio-ogg-m4a-pairs').check({files:['assets/audio/sfx/x.ogg']}).length,1,'#162 fires');
assert.equal(by('audio-ogg-m4a-pairs').check({files:['assets/audio/sfx/x.ogg','assets/audio/sfx/x.m4a']}).length,0);
{const bad="export function healthKitBlock(round){\n  if(healRemaining(round)<=0)return 'x';\n}\nexport function useHealthKit(round,now){\n  heal(round,now,30);\n}\n";
 assert.equal(by('medkit-independent-of-heal-budget').check({roundSrc:bad}).length,2,'v2.25.1 fires');}
assert.equal(by('raid-spawn-validated').check({gameSrc:'position={...round.level.start};'}).length,2,'spawn rule fires');
assert.equal(by('raid-spawn-validated').check({gameSrc:'position=safeSpawn(round.level);'}).length,0);
assert.ok(by('partition-door-clearance').check({levelsSrc:'room.partition={x:x+gap,z:z-.8};'}).length===1,'v2.28.6 fires');
assert.equal(by('partition-door-clearance').check({levelsSrc:"const sideDoor=area!=='archipelago'&&room.doors.some(p=>p.x!==0);const pz=sideDoor?Math.min(-.8,-(door/2+t/2+.02)):-.8;"}).length,0,'v2.28.6 passes');
assert.ok(by('level-intro-fullscreen').check({htmlSrc:'<div id="viewport"><div id="level-intro"></div></div><script></script>',cssSrc:'.level-intro-card{position:fixed;inset:0;z-index:30}',layoutSrc:''}).length===3,'v2.28.4 card fires');
assert.equal(by('level-intro-fullscreen').check({htmlSrc:'<div id="viewport"></div><script></script><div id="level-intro"></div>',cssSrc:'.level-intro-card{position:fixed;inset:0;width:100vw;height:100vh;z-index:60}',layoutSrc:'level card does not fill the screen'}).length,0,'v2.28.4 card passes');
assert.ok(by('dda-extra-on-floor').check({ddaSrc:'const clear=p=>!solids.some(o=>1);'}).length>=1,'v2.28.4 fires on wall-only extra placement');
assert.ok(by('dda-extra-on-floor').check({ddaSrc:'walkMap(level);level.floors.some(f=>1);filter(d=>d.locked);e=>!e.encounter&&!e.frontShield;(pool.length?pool:all)'}).length>=1,'v2.28.4 fires on fallback');
assert.equal(by('dda-extra-on-floor').check({ddaSrc:'walkMap(level);level.floors.some(f=>1);filter(d=>d.locked);e=>!e.encounter&&!e.frontShield'}).length,0,'v2.28.4 passes with floor+reach+plain checks');
assert.ok(by('scouted-area-no-chart').check({levelsSrc:'if(AR.scout&&AR.scout.level===n){',appSrc:'',gameSrc:''}).length===3,'v2.28.5 fires without scouted plumbing');
assert.equal(by('scouted-area-no-chart').check({levelsSrc:'if(AR.scout&&x&&!SCOUTED.has(t)){',appSrc:'"&scouted=" scouted:scoutedAreas()',gameSrc:'setScouted(launch.scouted);'}).length,0,'v2.28.5 passes');
assert.ok(by('core-loot-hint').check({appSrc:'',htmlSrc:''}).length===3,'v2.28.5 hint fires');
assert.equal(by('core-loot-hint').check({appSrc:'lootHintHtml(p) D.lootSources',htmlSrc:'src="data/loot-sources.js'}).length,0,'v2.28.5 hint passes');
assert.ok(by('dda-extra-on-floor').check({ddaSrc:'const clear=p=>!solids.some(o=>1);'}).length>=1,'v2.28.5 fires on wall-only extra placement');
assert.ok(by('dda-extra-on-floor').check({ddaSrc:'walkMap(level);level.floors.some(f=>1);filter(d=>d.locked);e=>!e.encounter&&!e.frontShield;(pool.length?pool:all)'}).length>=1,'v2.28.5 fires on fallback');
assert.equal(by('dda-extra-on-floor').check({ddaSrc:'walkMap(level);level.floors.some(f=>1);filter(d=>d.locked);e=>!e.encounter&&!e.frontShield'}).length,0,'v2.28.5 passes with floor+reach+plain checks');
assert.ok(by('shield-guard-rear-clearance').check({encSrc:'export function applyEncounters(level,rng){\n  return level.encounters;\n}\n'}).length>=1,'v2.28.1 fires without rear-clearance pass');
assert.ok(by('shield-guard-rear-clearance').check({encSrc:'export function applyEncounters(level,rng){\n  ensureRearClearance(level,rng);\n  return level.encounters;\n}\nfunction hasClearRear(){}\nexport function walkMap(){}\nwalkMap(level,enemy.id)\nexport function ensureRearClearance(l){\n  e.frontShield=0;\n}\n',levelsSrc:'  applyAreaRules(level,AR);\n  // x\n  ensureRearClearance(level,r);'}).length>=1,'v2.28.1 fires when the shield is stripped');
assert.equal(by('shield-guard-rear-clearance').check({encSrc:'export function applyEncounters(level,rng){\n  ensureRearClearance(level,rng);\n  return level.encounters;\n}\nfunction hasClearRear(){}\nexport function walkMap(){}\nwalkMap(level,enemy.id)\nexport function ensureRearClearance(l){\n  omit();\n}\n',levelsSrc:'  applyAreaRules(level,AR);\n  // re-prove\n  ensureRearClearance(level,r);'}).length,0,'v2.28.1 passes with rear-clearance pass');
assert.ok(by('playtest-1108-ui').check({html:'',css:'',game:'',layout:''}).length>=4,'v2.28.2 fires on missing UI fixes');
assert.equal(by('playtest-1108-ui').check({html:'<button id="continue-raid" class="result-continue">',css:'.result-continue{background:var(--ad-continue)}',game:'function showLevelIntro(){\n pausePick(r);resumePick(r);\n}\nshowLevelIntro();',layout:'raidGoalCompactRun(vp)'}).length,0,'v2.28.2 passes');
assert.ok(by('fullscreen-detail').check({app:'',html:''}).length>=3,'fullscreen-detail fires');
assert.ok(by('artillery-fx-prewarm').check({gameSrc:'function prewarmShaders(){}\nprewarmShaders();'}).length>=1,'#196 fires without pre-create');
assert.equal(by('artillery-fx-prewarm').check({gameSrc:'function makeArtilleryShell(){}\nfunction makeToolFxRing(){}\nmakeArtilleryShell();makeToolFxRing();makeToolFxRing();\nfunction prewarmShaders(){}\nprewarmShaders();'}).length,0,'#196 passes with pre-create');
// perk-choice-touch-44 retired in v2.28.25 along with the picker it guarded; see docs/bug-lint.md.
{const badApp='function navAllowed(id){\n  if(id === "bit") return bitOnline();\n  if(id === "prep") return baseAllows("navigation", "prep");\n  return baseAllows("navigation", id);\n}\n  go(screen, param){\n    if(screen === "bit" ? !bitOnline() : (screen !== "dev" && !baseAllows("navigation", screen))) return;\n  },\n';
 assert.equal(by('raid-tab-open-when-goal-needs-loot').check({appSrc:badApp}).length,3,'v2.28.21 fires: missing helper, navAllowed not wired, A.go not wired');}
{const goodApp='function goalNeedsRaidLoot(){return false;}\nfunction navAllowed(id){\n  if(id === "bit") return bitOnline();\n  if(id === "prep") return baseAllows("navigation", "prep") || goalNeedsRaidLoot();\n  return baseAllows("navigation", id);\n}\n  go(screen, param){\n    if(screen === "prep" ? !navAllowed("prep") : (screen === "bit" ? !bitOnline() : (screen !== "dev" && !baseAllows("navigation", screen)))) return;\n  },\n';
 assert.equal(by('raid-tab-open-when-goal-needs-loot').check({appSrc:goodApp}).length,0,'v2.28.21 passes once both navAllowed and A.go consult goalNeedsRaidLoot');}
{const badApp='function ingestRaidResult(r){\n  const extracted = r.outcome === "extract";\n  const added = extracted ? r.extracted.slice() : [];\n  const ftueLaunch = !!(S.coreLaunch && S.coreLaunch.raidId === r.raidId && S.coreLaunch.ftue);\n  if(extracted && ftueLaunch){}\n}\nfunction next(){}\n';
 assert.equal(by('ftue-extract-topup-honors-result-ftue').check({appSrc:badApp}).length,1,'v2.28.22 fires: ftueLaunch ignores r.ftue');}
{const goodApp='function ingestRaidResult(r){\n  const extracted = r.outcome === "extract";\n  const added = extracted ? r.extracted.slice() : [];\n  const ftueLaunch = !!((S.coreLaunch && S.coreLaunch.raidId === r.raidId && S.coreLaunch.ftue) || (r.ftue && (S.raids || 0) === 0));\n  if(extracted && ftueLaunch){}\n}\nfunction next(){}\n';
 assert.equal(by('ftue-extract-topup-honors-result-ftue').check({appSrc:goodApp}).length,0,'v2.28.22 passes once r.ftue is honored on a first extract');}
{const badGame="function finishRound(outcome){\n  if(round.over&&handoffRaidResult(round,{launch,beforeReturn:clearInput})){\n    resultReturning=true;return;\n  }\n}\n";
 assert.equal(by('death-loss-screen-before-handoff').check({gameSrc:badGame}).length,1,'v2.28.24 fires on the old blanket auto-handoff (death/timeout/abandon never saw #round-over)');}
{const goodGame="function finishRound(outcome){\n  if(round.over&&['extract','complete'].includes(round.reason)&&handoffRaidResult(round,{launch,beforeReturn:clearInput})){\n    resultReturning=true;return;\n  }\n}\n";
 assert.equal(by('death-loss-screen-before-handoff').check({gameSrc:goodGame}).length,0,'v2.28.24 passes once death/timeout/abandon fall through to the in-raid presenter');}
{const badGame="function openPerk(key){\n  perkUI.open(key);\n}\n";
 assert.equal(by('no-mid-raid-perk-picker').check({gameSrc:badGame,htmlSrc:'<div></div>',perksSrc:"export function updateClears(round,position){\n  if(r.state==='unresolved'){r.state='cleared';}\n}\nexport function pickReady(){\n  return null;\n}\nexport function autoPickPerks(){\n  return [];\n}\n"}).length,1,'v2.28.25 fires if game.mjs reintroduces openPerk');}
{const badClears="export function updateClears(round,position){\n  if(r.state==='unresolved'){r.state='clearPending';s.queue.push(key);}\n}\nexport function pickReady(){\n  return null;\n}\nexport function autoPickPerks(){\n  return [];\n}\n";
 assert.equal(by('no-mid-raid-perk-picker').check({gameSrc:'function finishRound(){}',htmlSrc:'<div></div>',perksSrc:badClears}).length,1,'v2.28.25 fires if updateClears queues an offer again');}
{const good="export function updateClears(round,position){\n  if(r.state==='unresolved'&&r.entered&&roomEnemies.length&&!roomEnemies.some(e=>e.health>0)){r.state='cleared';cleared.push(key);}\n}\nexport function pickReady(round){\n  return null;\n}\nexport function autoPickPerks(){\n  return [];\n}\n";
 assert.equal(by('no-mid-raid-perk-picker').check({gameSrc:'function finishRound(){}',htmlSrc:'<html></html>',perksSrc:good}).length,0,'v2.28.25 passes when the picker stays gone and clears never queue');}
{const badApp='function load(){\n  return st;\n}\n';
 assert.equal(by('cable-retro-migration-idempotent').check({appSrc:badApp}).length,2,'v2.28.29 fires: migrateCableRetro missing and load() never calls it');}
{const badApp='function migrateCableRetro(st){\n  st.cableRetro1 = "granted";\n  return st;\n}\nfunction load(){\n  migrateCableRetro(st);\n  return st;\n}\n';
 assert.equal(by('cable-retro-migration-idempotent').check({appSrc:badApp}).length,2,'v2.28.29 fires: not idempotent and never sets "n/a"');}
{const goodApp='function migrateCableRetro(st){\n  if(st.cableRetro1) return st;\n  const b1Done = true;\n  const fabBuilt = false;\n  if(b1Done && !fabBuilt){\n    st.stash.cable = (st.stash.cable||0) + 1;\n    st.cableRetro1 = "granted";\n  } else {\n    st.cableRetro1 = "n/a";\n  }\n  return st;\n}\nfunction load(){\n  if(st.v === SAVE_VERSION){ migrateCableRetro(st); return st; }\n}\n';
 assert.equal(by('cable-retro-migration-idempotent').check({appSrc:goodApp}).length,0,'v2.28.29 passes once migrateCableRetro is idempotent and load() calls it');}
{const badApp='  dismissIntro(){\n    document.body.classList.remove("startup-bunker-intro");\n    A.go("base");\n    if(session.pendingHomecomingSummary){\n      showHomecomingSummary(session.pendingHomecomingSummary, { skipVoice:true });\n    }\n  },\n';
 const goodBase="const greet=()=>{if(!welcome)return;void audio.unlock().then(async ok=>{\n  const success=true,skip=skipVoice;skipVoice=false;\n  void audio.play('extract-success');\n  if(success){\n    if(skip)return;\n    if(intro)void audio.requestVoice('youre-back');else void audio.voice('welcome-back');\n    return;\n  }\n});};\n";
 assert.equal(by('greeting-vo-only-with-bit-visible').check({appSrc:badApp,baseAudioSrc:goodBase}).length,1,'v2.28.30 fires when dismissIntro never cancels youre-back');}
{const goodApp='  dismissIntro(){\n    window.PR_AUDIO?.cancelVoice?.(\'youre-back\');\n    document.body.classList.remove("startup-bunker-intro");\n    A.go("base");\n    if(session.pendingHomecomingSummary){\n      showHomecomingSummary(session.pendingHomecomingSummary, { skipVoice:true });\n    }\n  },\n';
 const badBase="const greet=()=>{if(!welcome)return;void audio.unlock().then(async ok=>{\n  const success=true;\n  void audio.play('extract-success');\n  if(success){\n    if(intro)void audio.requestVoice('youre-back');else void audio.voice('welcome-back');\n    return;\n  }\n});};\n";
 assert.equal(by('greeting-vo-only-with-bit-visible').check({appSrc:goodApp,baseAudioSrc:badBase}).length,2,'v2.28.30 fires when greet() has no skipVoice guard at all');}
{const goodApp='  dismissIntro(){\n    window.PR_AUDIO?.cancelVoice?.(\'youre-back\');\n    document.body.classList.remove("startup-bunker-intro");\n    A.go("base");\n    if(session.pendingHomecomingSummary){\n      showHomecomingSummary(session.pendingHomecomingSummary, { skipVoice:true });\n    }\n  },\n';
 const lateSkipBase="const greet=()=>{if(!welcome)return;void audio.unlock().then(async ok=>{\n  const success=true,skip=skipVoice;skipVoice=false;\n  void audio.play('extract-success');\n  if(success){\n    if(intro)void audio.requestVoice('youre-back');else void audio.voice('welcome-back');\n    if(skip)return;\n    return;\n  }\n});};\n";
 assert.equal(by('greeting-vo-only-with-bit-visible').check({appSrc:goodApp,baseAudioSrc:lateSkipBase}).length,1,'v2.28.30 fires when the skip check comes after the voice is already requested');}
{const goodApp='  dismissIntro(){\n    window.PR_AUDIO?.cancelVoice?.(\'youre-back\');\n    document.body.classList.remove("startup-bunker-intro");\n    A.go("base");\n    if(session.pendingHomecomingSummary){\n      showHomecomingSummary(session.pendingHomecomingSummary, { skipVoice:true });\n    }\n  },\n';
 const goodBase="const greet=()=>{if(!welcome)return;void audio.unlock().then(async ok=>{\n  const success=true,skip=skipVoice;skipVoice=false;\n  void audio.play('extract-success');\n  if(success){\n    if(skip)return;\n    if(intro)void audio.requestVoice('youre-back');else void audio.voice('welcome-back');\n    return;\n  }\n});};\n";
 assert.equal(by('greeting-vo-only-with-bit-visible').check({appSrc:goodApp,baseAudioSrc:goodBase}).length,0,'v2.28.30 passes once dismissIntro cancels first and greet() skips before any voice');}
{const badApp='function bootSequence(next,done){\n  return overlay("x",done);\n}\n  build(modId){\n    if(isLightsOn){\n      window.PRBitCutscene?.play(X);\n    } else if(isFabricatorOnline){\n      overlay(upgradeRewardHtml());\n    }\n  },\n';
 assert.equal(by('core-restore-no-power-popup').check({appSrc:badApp}).length,1,'PRB-155 fires if bootSequence() still exists');}
{const badApp='  build(modId){\n    if(isLightsOn){\n      window.PRBitCutscene?.play(X); // POWER RESTORED\n    } else if(isFabricatorOnline){\n      overlay(upgradeRewardHtml());\n    }\n  },\n';
 assert.equal(by('core-restore-no-power-popup').check({appSrc:badApp}).length,1,'PRB-155 fires if "POWER RESTORED" copy still exists anywhere');}
{const badApp='  build(modId){\n    if(isLightsOn){\n      overlay(bootHtml(),done);\n      window.PRBitCutscene?.play(X);\n    } else if(isFabricatorOnline){\n      overlay(upgradeRewardHtml());\n    }\n  },\n';
 assert.equal(by('core-restore-no-power-popup').check({appSrc:badApp}).length,1,'PRB-155 fires if the isLightsOn branch opens any popup');}
{const badApp='  build(modId){\n    if(isLightsOn){\n      save();\n    } else if(isFabricatorOnline){\n      overlay(upgradeRewardHtml());\n    }\n  },\n';
 assert.equal(by('core-restore-no-power-popup').check({appSrc:badApp}).length,1,'PRB-155 fires if the isLightsOn branch never plays the cutscene itself');}
{const goodApp='  build(modId){\n    if(isLightsOn){\n      save();\n      if(!S.bitCardsSeen.core_restored){\n        S.bitCardsSeen.core_restored=true;\n        window.PRBitCutscene?.play(BIT_CUTSCENES.core_restored);\n      } else bitDock("module_built");\n    } else if(isFabricatorOnline){\n      overlay(upgradeRewardHtml());\n    }\n  },\n';
 assert.equal(by('core-restore-no-power-popup').check({appSrc:goodApp}).length,0,'PRB-155 passes once the popup is gone and the cutscene itself plays, even nested inside another if');}
{const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.equal(by('fabricator-art-bounded-cache').check({appSrc:app}).length,0,'cached bounded probe passes');
 assert.equal(by('fabricator-art-bounded-cache').check({appSrc:app.replace('if(!fabricatorArtPromise && window.PRBitCutscene)','if(true)')}).length,1,'uncached probe fails');
 assert.equal(by('fabricator-art-bounded-cache').check({appSrc:app.replace('cb(!fabricatorArtFailed','awaitProbe(!fabricatorArtFailed')}).length,1,'probe-dependent playback fails');}
assert.equal(by('cutscene-reduced-motion-instant').check({cutsceneSrc:'',cutsceneCss:''}).length,2,'missing instant hint and bust override fail');
assert.equal(by('cutscene-reduced-motion-instant').check().length,0,'reduced motion reveals all copy immediately');
assert.equal(by('narrator-hologram-above-copy').check({cutsceneCss:'.bit-cutscene-hologram{bottom:22%;}'}).length,1,'low hologram anchor fails');
assert.equal(by('narrator-hologram-above-copy').check().length,0,'hologram stays above copy');
{const badBeam='export function createExtractBeam(){\n  const beam=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:EXTRACT_COLOR}));\n  return {beam};\n}\n';
 assert.equal(by('extract-loot-3d-vfx').check({beamSrc:badBeam}).length,1,'PRB-156 fires when the beam is a flat MeshBasicMaterial, not a ShaderMaterial');}
{const goodBeam='export function createExtractBeam(){\n  const beamMaterial=new THREE.ShaderMaterial({vertexShader:v,fragmentShader:f});\n  return {beamMaterial};\n}\n';
 assert.equal(by('extract-loot-3d-vfx').check({beamSrc:goodBeam,burstSrc:'export function createLootBurstPool(){}\n'}).length,0,'PRB-156 passes once the beam is shader-based');}
{const badBurst='function createLootBurstPool(){}\n'; // missing "export"
 assert.equal(by('extract-loot-3d-vfx').check({burstSrc:badBurst}).length,1,'PRB-156 fires when createLootBurstPool is not exported');}
{const badWorld='const exitBeam=new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.1, 1, 20, 1, true),mat);\n';
 const r=by('extract-loot-3d-vfx').check({worldSrc:badWorld});
 assert.ok(r.length>=3,'PRB-156 fires when world.js still builds the old flat exitBeam and never wires the new VFX');}
{const goodWorld='const extractBeamFx=createExtractBeam({color:EXTRACT_COLOR,quality});\nconst lootBurstFx=createLootBurstPool({quality});\n';
 assert.equal(by('extract-loot-3d-vfx').check({worldSrc:goodWorld}).length,0,'PRB-156 passes once buildWorld wires both factories and drops the old cylinder');}
{const badGame='if(v.loot.collected&&v.group.visible)world.burst?.(v.loot.x,v.loot.z,v.color);\nworld.animate(elapsed);\n';
 assert.equal(by('extract-loot-3d-vfx').check({gameSrc:badGame}).length,2,'PRB-156 fires when the pickup still uses the flat world.burst() and animate() drops the player position');}
{const goodGame='if(v.loot.collected&&v.group.visible)world.spawnLootBurst?.(v.loot.x,.5,v.loot.z,v.color);\nworld.animate(elapsed,position,round);\n';
 assert.equal(by('extract-loot-3d-vfx').check({gameSrc:goodGame}).length,0,'PRB-156 passes once the pickup spawns the pooled burst and animate threads the player position');}

{
 const rule=by('vfx-visible-pooled-lifecycle');
 assert.equal(rule.check({lootVfxSrc:'new THREE.Points()',feedbackVfxSrc:"hold(record,'respawn');pixel.spawn('collect');",lifecycleGameSrc:''}).length,4);
 assert.equal(rule.check({lootVfxSrc:'new THREE.InstancedMesh()',feedbackVfxSrc:'',lifecycleGameSrc:'world?.setVfxQuality(next);if(round.over)world?.disposeVfx();'}).length,0);
}
{
 const rule=by('vfx-phone-depth-layers');
 assert.equal(rule.check({phoneBeamSrc:'group.add(beam)',phoneLootSrc:'points.setMatrixAt(i,matrix)'}).length,2);
 assert.equal(rule.check({phoneBeamSrc:'group.add(core);group.add(fence);',phoneLootSrc:'r.pillar=new THREE.Mesh(geo,mat);r.flash=new THREE.Mesh(geo,mat);'}).length,0);
}
assert.equal(runAll({files:null,gitignore:'node_modules\n'}).length,0,'repo is clean');
console.log('bug-lint.test: ok');

{
 const rule=by('coldopen-vo-after-start-unlock');
 const appSrc=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const audioSrc=fs.readFileSync(new URL('../ui/audio.js',import.meta.url),'utf8');
 assert.equal(rule.check({appSrc,audioSrc}).length,0,'start audio wiring passes');
 for(const [from,to] of [['void window.PR_AUDIO?.unlockSync?.();','await window.PR_AUDIO?.unlock?.();'],["requestVoice('youre-back')","voice('youre-back')"],['preload.call(window.PR_AUDIO)','Promise.resolve()'],['Promise.resolve(activationAudio).then','Promise.resolve().then'],['addEventListener("animationstart", () => { firstLineStarted = true; greet(); }','addEventListener("click", () => { firstLineStarted = true; greet(); }']])
   assert(rule.check({appSrc:appSrc.replace(from,to),audioSrc}).length>0,'fires when removing '+from);
 assert(rule.check({appSrc,audioSrc:audioSrc.replace('source.start(0);','Promise.resolve().then(()=>source.start());')}).length>0,'fires when priming leaves the gesture stack');
}

{
 const rule=by('dedicated-narrator-art-exists');
 const file='assets/production/bit-narrator/cutscene-fabricator-dark-v1.webp';
 assert.equal(rule.check({appSrc:'from:"'+file+'"',files:[file]}).length,0);
 assert.equal(rule.check({appSrc:'from:"'+file+'"',files:[]}).length,1,'missing shipped art fails');
}

assert.equal(by('dedicated-narrator-art-exists').check({appSrc:'',files:[],cutsceneSrc:''}).length,1,'poisoned shared bust cache fails');

{
 const rule=by('ios-audio-waits-for-running');
 const audioSrc=fs.readFileSync(new URL('../ui/audio.js',import.meta.url),'utf8');
 assert.equal(rule.check({audioSrc}).length,0,'PRB-158 passes on the real ui/audio.js');
 const badPlay='    async play(name,{enemy=false}={}){\n      if(this.context?.state!==\'running\'&&(this.unlocked||this.wasUnlocked))await this.resume();\n      if(!this.unlocked||this.context?.state!==\'running\')return false;\n    }\n    async voice(name){\n      if(this.context?.state!==\'running\'&&(this.unlocked||this.wasUnlocked))await this.resume();\n    }\n    installUnlock(target){\n      for(const type of [\'touchend\',\'click\',\'keydown\',\'pointerup\'])gestures.addEventListener(type,unlock,{capture:true,passive:true});\n    }\n';
 assert.equal(rule.check({audioSrc:badPlay}).length,3,'fires when play()/voice() stop waiting for an in-flight unlock and installUnlock drops touchstart/pointerdown');
 assert.equal(rule.check({audioSrc:''}).length,3,'fires when play/voice/installUnlock are all missing');
}

{
 const rule=by('narrator-holds-until-tap');
 const cutsceneSrc=fs.readFileSync(new URL('../ui/bit-cutscene.js',import.meta.url),'utf8');
 const cardSrc=fs.readFileSync(new URL('../ui/bit-card.js',import.meta.url),'utf8');
 assert.equal(rule.check({cutsceneSrc,cardSrc}).length,0,'PRB-158 passes on the real narrator components');
 const autoEnd=cutsceneSrc.replace('var CROSSFADE = 3150','var DURATION = 7000, CROSSFADE = 3150').replace('run.locked = true;','later(run, dismiss, DURATION);\n    run.locked = true;');
 assert.equal(by('narrator-holds-until-tap').check({cutsceneSrc:autoEnd,cardSrc}).length,1,'fires if an auto-end timer returns');
 const noGuard=cutsceneSrc.replace('run.locked = true;','').replace('if(current && current.locked) return;','');
 assert.equal(by('narrator-holds-until-tap').check({cutsceneSrc:noGuard,cardSrc}).length,1,'fires if the one-second tap guard is removed');
 const noBaseBranch=cardSrc.replace('if(raid){','if(false){');
 assert.equal(by('narrator-holds-until-tap').check({cutsceneSrc,cardSrc:noBaseBranch}).length,1,'fires if the card stops branching base vs raid');
 const noCardGuard=cardSrc.replace('locked:true, hintTimer:null };','hintTimer:null };').replace('if(current && current.locked) return;','');
 assert.equal(by('narrator-holds-until-tap').check({cutsceneSrc,cardSrc:noCardGuard}).length,1,'fires if the base card drops its one-second tap guard');
}

// PRB-159: mutate shipping source to prove each lifecycle/probe regression is rejected.
{
 const audioSrc=fs.readFileSync(new URL('../ui/audio.js',import.meta.url),'utf8');
 const background=by('audio-no-background-playback'),format=by('audio-format-probe-default');
 assert.deepEqual(background.check({audioSrc}),[]);
 assert.deepEqual(format.check({audioSrc}),[]);
 assert.ok(background.check({audioSrc:audioSrc.replace("audioSession.type='ambient'", "audioSession.type='playback'")}).length);
 assert.ok(background.check({audioSrc:audioSrc.replace("else if(visibility.visibilityState==='hidden')this.suspendForHidden();",'')}).length);
 assert.ok(background.check({audioSrc:audioSrc.replace("gestures.addEventListener('pagehide'", "visibility.addEventListener('pagehide'")}).length);
 assert.ok(background.check({audioSrc:audioSrc.replace('if(this.hidden()||!this.init())return false;', 'if(!this.init())return false;')}).length);
 assert.ok(format.check({audioSrc:audioSrc.replace('new AudioManager(root.DATA.audio,probe?{probe}:{})', 'new AudioManager(root.DATA.audio)')}).length);
 assert.ok(format.check({audioSrc:audioSrc.replace("document.createElement('audio')",'null')}).length);
 assert.ok(format.check({audioSrc:audioSrc.replace("this.format=aac?'m4a':'ogg'", "this.format='ogg'")}).length);
 assert.ok(format.check({audioSrc:audioSrc.replace("this.format=aac?'m4a':'ogg'", "this.format=aac&&vorbis!=='probably'?'m4a':'ogg'")}).length);
}

{
 const rule=by('audio-debug-trigger-reachable');
 const audioDebugCss=fs.readFileSync(new URL('../ui/audio-debug.css',import.meta.url),'utf8');
 assert.deepEqual(rule.check({audioDebugCss}),[]);
 assert.ok(rule.check({audioDebugCss:audioDebugCss.replace('display:block;pointer-events:auto','pointer-events:auto')}).length);
 assert.ok(rule.check({audioDebugCss:audioDebugCss.replace('display:block;pointer-events:auto','display:block;pointer-events:none')}).length);
 assert.ok(rule.check({audioDebugCss:audioDebugCss.replace('#topbar #app-version','')}).length);
}

// PRB-160: voice, promise and timer regressions each fail independently.
{
 const rule=by('cutscene-no-wait-before-show');
 const good='function advance(){ present(current, sources); }\n  function later(){}';
 assert.equal(rule.check({cutsceneSrc:good,appSrc:'PRBitCutscene.play(beat);'}).length,0);
 assert.equal(rule.check({cutsceneSrc:good+'; if(PR_AUDIO.voiceBusy) return;',appSrc:''}).length,1);
 assert.equal(rule.check({cutsceneSrc:'function advance(){ preload(job).then(() => present(run)); }\n  function later(){}',appSrc:''}).length,1);
 assert.equal(rule.check({cutsceneSrc:good,appSrc:'setTimeout(() => PRBitCutscene?.play(beat), 1600);'}).length,1);
 assert.equal(rule.check({cutsceneSrc:good,appSrc:'setTimeout(() => fabricatorCutsceneBeat(beat => window.PRBitCutscene?.play(beat)), 1600);'}).length,1);
 assert.equal(rule.check({cutsceneSrc:good,appSrc:'window.setTimeout(() => PRBitCutscene.play(beat), 1600);'}).length,1);
 assert.equal(rule.check({cutsceneSrc:'async function advance(){ await preload(job); present(run); }\n  function later(){}',appSrc:''}).length,1);
 assert.equal(rule.check().length,0);
}

{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const rule=by('cutscene-story-survives-popup-replacement');
 assert.equal(rule.check().length,0);
 assert.equal(rule.check({appSrc:app.replace('afterDiscard:narrate','afterDiscard:null')}).length,1);
 assert.equal(rule.check({appSrc:app.replace(/if\(old\) discardOverlay\(old\);/g,'if(old) old.remove();')}).length,1);
}

// PRB-161: the splash must never auto-advance to the cold open without a tap.
{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const rule=by('splash-no-autoadvance-before-coldopen');
 assert.equal(rule.check().length,0,'passes on the real app.js');
 assert.ok(rule.check({appSrc:app.replace('const coldOpenNext = !S.introSeen && !ftueDirect;','')}).length,'fires once coldOpenNext is removed');
 assert.ok(rule.check({appSrc:app.replace('else if(!flightActive && !coldOpenNext) autoTimer = setTimeout(begin, 1400);','else if(!flightActive) autoTimer = setTimeout(begin, 1400);')}).length,'fires when ready() drops the coldOpenNext guard (the original PRB-161 bug)');
 assert.ok(rule.check({appSrc:app.replace('if(phase === "ready"){ if(requested) begin(); else if(!coldOpenNext) autoTimer = setTimeout(begin, 1400); }','if(phase === "ready"){ if(requested) begin(); else autoTimer = setTimeout(begin, 1400); }')}).length,'fires when flightFailed() drops the coldOpenNext guard');
}

// PRB-161: the version label (triple-tap opens the hidden audio debug overlay) must stay visible
// -- and actually reachable above #splash/.intro -- during the splash and the cold open.
{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const rule=by('version-label-visible-on-start');
 assert.equal(rule.check().length,0,'passes on the real index.html');
 assert.ok(rule.check({indexHtml:html.replace(
   'body.splash-active #tabs,body.splash-active #bitdock,body.splash-active .mapspot,body.splash-active .goalpill,body.splash-active .gen-chip{opacity:0;}',
   'body.splash-active #tabs,body.splash-active #bitdock,body.splash-active .mapspot,body.splash-active .goalpill,body.splash-active .gen-chip,body.splash-active #app-version{opacity:0;}'
 )}).length,'fires if #app-version is added back to the splash-active hidden list');
 assert.ok(rule.check({indexHtml:html.replace(
   'body[data-screen=intro] #topbar>#navback, body[data-screen=intro] #topbar>.title, body[data-screen=intro] #topbar>#currencies, body[data-screen=intro] #topbar>#menubtn, body[data-screen=intro] #tabs, body[data-screen=intro] #bitdock{display:none!important;}',
   'body[data-screen=intro] #topbar, body[data-screen=intro] #tabs, body[data-screen=intro] #bitdock{display:none!important;}'
 )}).length,'fires if #topbar itself (not just its other children) is hidden during the cold open again');
 assert.ok(rule.check({indexHtml:html.replace('body.splash-active #topbar,body[data-screen=intro] #topbar{z-index:94;}','')}).length,'fires if #topbar loses the z-index bump that clears #splash/.intro');
}

// PRB-161 follow-up: the raid-return cold open (no splash, no gesture at all on this document)
// must gate on a tap instead of reusing the capped vo-wait, and A.introSkip must ignore that
// tap even once .vo-wait-tap is already gone (iOS touchend-then-a-separate-synthesized-click).
{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const rule=by('coldopen-gesture-gate-after-raid-return');
 assert.equal(rule.check().length,0,'passes on the real app.js');
 assert.ok(rule.check({appSrc:app.replace('audio.init?.();\n      const muted','const muted')}).length,'fires if armVoiceGate stops calling audio.init() first (context would read null on a raid return, which never ran preload())');
 assert.ok(rule.check({appSrc:app.replace('if(running || audio.unlockPromise || muted){ waitForVoice(); return; }\n      intro.classList.add("vo-wait-tap");','intro.classList.add("vo-wait-tap");')}).length,'fires if the already-running/unlocking/muted bypass is dropped (the prompt would then show even when nothing needs a gesture)');
 assert.ok(rule.check({appSrc:app.replace('intro.classList.add("vo-wait-tap");','')}).length,'fires if the gesture prompt itself is removed');
 assert.ok(rule.check({appSrc:app.replace('intro.dataset.gateTapAt = String(Date.now());\n        ','')}).length,'fires if onGestureTap stops stamping gateTapAt (introSkip would have nothing to fall back on once the class is gone)');
 assert.ok(rule.check({appSrc:app.replace(
   'if(el && (el.classList.contains("vo-wait-tap") || withinGateTapGuard)){ if(ev) ev.stopPropagation(); return; }',
   'if(el && el.classList.contains("vo-wait-tap")){ if(ev) ev.stopPropagation(); return; }'
 )}).length,'fires if introSkip drops the gateTapAt fallback and only checks the class (the original bug: touchend already removed it by the time the synthesized click arrives)');
 assert.ok(rule.check({appSrc:app.replace(
   'if(el && (el.classList.contains("vo-wait-tap") || withinGateTapGuard)){ if(ev) ev.stopPropagation(); return; }',
   'if(false){ if(ev) ev.stopPropagation(); return; }'
 )}).length,'fires if introSkip stops checking .vo-wait-tap entirely');
}
{
 const rule=by('debug-sandbox-isolated');
 const rd=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
 const app=rd('app.js'),sb=rd('ui/debug-sandbox.js'),smoke=rd('scripts/debug-unlocks-smoke.mjs'),layout=rd('scripts/layout-check.mjs'),index=rd('index.html'),raid=rd('nodspel/index.html');
 assert.equal(rule.check().length,0,'passes on the real sources');
 assert.ok(rule.check({indexSrc:index.replace('<script src="ui/debug-sandbox.js','<script src="ui/viewport.js"></script><script src="ui/debug-sandbox.js')}).length,'fires if a script runs before the sandbox on the base page');
 assert.ok(rule.check({raidHtmlSrc:raid.replace('<script src="../ui/debug-sandbox.js','<script src="../ui/x.js')}).length,'fires if the raid page stops loading the sandbox first');
 assert.ok(rule.check({sandboxSrc:sb.replace('proto.clear = function','proto.clearX = function')}).length,'fires if a Storage method is left un-namespaced');
 assert.ok(rule.check({sandboxSrc:sb.replace("native.setItem.call(window.localStorage, prefix + 'pr_meta_save', raw)","native.setItem.call(window.localStorage, 'pr_meta_save', raw)")}).length,'fires if seed() writes the normal save key');
 assert.ok(rule.check({appSrc:app.replace('if(!debugMode()) save(); ','')}).length,'fires if devUnlock stops saving pending normal progress first');
 assert.ok(rule.check({smokeSrc:smoke.replace("level.area??'bunker'","level.area")}).length,'fires if the smoke reads level.area raw (undefined for bunker)');
 assert.ok(rule.check({smokeSrc:smoke.replace('Promise.race([handoff,button])','button')}).length,'fires if the smoke only waits for the #return-base click');
 assert.ok(rule.check({layoutSrc:layout.replace("'scripts/debug-unlocks-smoke.mjs'","'scripts/other.mjs'")}).length,'fires if the smoke is unhooked from required CI');
}
// PRB-162: the quest chip and the Vault must each stay gated behind their own BIT intro moment.
{
 const rule=by('bit-introduces-systems-first');
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.equal(rule.check().length,0,'passes on the real app.js');
 assert.ok(rule.check({appSrc:app.replace('if(!S.bitCardsSeen.quest_intro) return "";\n','')}).length,'fires if the quest chip stops checking its intro-seen flag');
 assert.ok(rule.check({appSrc:app.replace('vault_intro:{','vault_intro_renamed:{')}).length,'fires if BIT_CUTSCENES.vault_intro is renamed/removed');
 assert.ok(rule.check({appSrc:app.replace('function maybeShowVaultIntro(){','function vaultIntroTrigger(){')}).length,'fires if the maybeShowVaultIntro trigger function is renamed/removed');
 assert.ok(rule.check({appSrc:app.replace(
   'if(S.bitCardsSeen.vault_intro) return;\n  // Same ordering guard as maybeShowQuestIntro: never queue ahead of fabricator_built.\n  if(!S.bitCardsSeen.fabricator_built) return;\n  const g = progressionGoal();',
   'const g = progressionGoal();'
 )}).length,'fires if maybeShowVaultIntro stops gating on its own seen flag (would replay every base visit)');
 assert.ok(rule.check({appSrc:app.replace(
   'const g = progressionGoal();\n  if((S.modules.storage || 0) >= 1 || !(g && g.module === "storage")) return;',
   'if((S.modules.storage || 0) < 1) return;'
 )}).length,'fires if maybeShowVaultIntro stops checking progressionGoal() (would only ever fire once already built, not the instant it becomes the goal)');
 assert.ok(rule.check({appSrc:app.replace('st.bitCardsSeen.vault_intro === undefined','st.bitCardsSeen.vault_intro_x === undefined')}).length,'fires if migrateBitCardsSeen stops back-filling vault_intro for already-past saves');
 assert.ok(rule.check({appSrc:app.replace('st.bitCardsSeen.quest_intro === undefined','st.bitCardsSeen.quest_intro_x === undefined')}).length,'fires if migrateBitCardsSeen stops back-filling quest_intro');
 assert.ok(rule.check({appSrc:app.replace('st.bitCardsSeen.raid_briefing === undefined','st.bitCardsSeen.raid_briefing_x === undefined')}).length,'fires if migrateBitCardsSeen stops back-filling raid_briefing');
}

// v2.28.4x owner playtest regressions: each fixture removes its actual guard.
assert.ok(by('quest-chip-never-covers-rooms').check({appSrc:'function setupBaseViewer(){}',layoutSrc:''}).length===2);
assert.equal(by('quest-chip-never-covers-rooms').check({appSrc:'function placeBaseGoal(viewer){} placeBaseGoal(viewer); .mapspot,.mapspot .tag',layoutSrc:'questChipRoomOverlaps chip-fabricator-locked chip-guard-duty'}).length,0);
assert.ok(by('early-raid-crate-cap').check({goalSrc:'level.lootBoxes.push({id:`payoff-${i}`});',ftueSrc:'',dataSrc:'maxCratesPerRoom:7'}).length===3);
assert.equal(by('early-raid-crate-cap').check({goalSrc:'quantity;level.lootBoxes.length<RULES.earlyLoot.maxCratesPerRoom',ftueSrc:'level.lootBoxes=RULES.earlyLoot.supplies.map',dataSrc:'maxCratesPerRoom:3'}).length,0);
assert.equal(by('no-post-pickup-chest-sprite').check({fxSrc:"pixel.spawn('chest',1,2)",gameSrc:''}).length,2);
assert.equal(by('no-post-pickup-chest-sprite').check({fxSrc:"pixel.spawn('shield',1,2)",gameSrc:'world.spawnLootBurst?.();pickupToast(round.lastBagPickup.item)'}).length,0);

// v2.28.4x: queued intros cannot expose systems, and vest supplies cannot add crates.
{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const intro=by('bit-introduces-systems-first');
 assert.ok(intro.check({appSrc:app.replace('pendingSystemIntros.has(beat.id)','false')}).length);
 assert.ok(by('room-unlock-two-stage').check({appSrc:app.replace('    closeBuildingPopup();', '    if(modId === "storage" && !S.bitCardsSeen.vault_intro) return;')} ).length);
 const rule=by('vest-guarantee-existing-caches');
 assert.equal(rule.check().length,0);
 const levels=fs.readFileSync(new URL('../nodspel/levels.js',import.meta.url),'utf8');
 assert.ok(rule.check({levelsSrc:levels.replace('b.quantity=need.count','b.quantity=1')}).length);
 assert.ok(rule.check({levelsSrc:levels.replace('claimed.has(b)','b.guarantee')}).length);
 assert.ok(rule.check({levelsSrc:levels.replaceAll('!b.scout&&!b.quest&&!b.key','!b.scout&&!b.key')}).length);
 assert.ok(rule.check({gameSrc:''}).length);
 assert.ok(rule.check({cssSrc:''}).length);
 const appSource=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(rule.check({appSrc:appSource.replace('craftPartSource({ kind:"cur", id:"scrap" })','""')}).length);
 assert.ok(rule.check({appSrc:''}).length);
}

{
 const rule=by('room-unlock-two-stage');
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const bit=fs.readFileSync(new URL('../data/bit.js',import.meta.url),'utf8');
 assert.equal(rule.check().length,0);
 for(const stage of ['teaser','unlock']) for(const id of ['fabricator','storage'])
   assert.ok(rule.check({appSrc:app.replaceAll('roomUnlockStages("'+id+'").'+stage,'missingStage()')}).length);
 assert.ok(rule.check({appSrc:app.replace('to:powered ? def.powered : def.dark','to:def.powered')}).length);
 assert.ok(rule.check({bitSrc:bit.replace('id:"vault_unlocked"','id:"missing"')}).length);
}

{
 const rule=by('new-find-highlights-goal'),app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.equal(rule.check().length,0);
 for(const token of ['!S.bitCardsSeen.new_find','newFindUsesHtml(id)','u.module === goal.module','<details><summary>+','Object.keys(st.seenItems || {})'])
   assert.ok(rule.check({appSrc:app.replaceAll(token,'removed')}).length,'detects missing '+token);
}
assert.equal(by('coldopen-bit-hibernates-until-wake').check({appSrc:'',htmlSrc:''}).length,4,'sleep regression fires');
assert.equal(by('coldopen-bit-hibernates-until-wake').check({appSrc:fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace('reducedMotion || firstLineStarted','reducedMotion'),htmlSrc:fs.readFileSync(new URL('../index.html',import.meta.url),'utf8')}).length,1,'swallowed greeting fires');
{const a=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),h=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.equal(by('coldopen-bit-hibernates-until-wake').check({appSrc:a,htmlSrc:h}).length,0);
 assert.equal(by('coldopen-bit-hibernates-until-wake').check({appSrc:a.replaceAll('intro-zzz','intro-x'),htmlSrc:h}).length,1,'missing z indicator fires');}
assert.equal(by('coldopen-bit-hibernates-until-wake').check().length,0);

assert.equal(by('raid-waits-for-combat-sfx').check({gameSrc:'',raidAudioSrc:'',readySrc:''}).length,2,'unawaited combat decode regression fires');
assert.equal(by('raid-waits-for-combat-sfx').check().length,0);

{
 const rule=by('fuel-drums-chain-and-cap');
 const levels=fs.readFileSync(new URL('../nodspel/levels.js',import.meta.url),'utf8');
 const ftue=fs.readFileSync(new URL('../nodspel/ftue.js',import.meta.url),'utf8');
 const round=fs.readFileSync(new URL('../nodspel/round.js',import.meta.url),'utf8');
 assert.equal(rule.check({levelsSrc:levels,ftueSrc:ftue,roundSrc:round}).length,0,'v2.28.48 passes as shipped');
 assert.equal(rule.check({levelsSrc:'',ftueSrc:'',roundSrc:''}).length,7,'v2.28.48 fires on every missing guard');
 assert.ok(rule.check({levelsSrc:levels,ftueSrc:ftue.replace('playerSafe:true',''),roundSrc:round})
   .includes('the FTUE drum must be pinned playerSafe so its scripted takedown never hurts the player'),'FTUE player-safe regression fires');
 assert.ok(rule.check({levelsSrc:levels.replace('Math.min(1+(rng()<.5?1:0),cap)','2'),ftueSrc:ftue,roundSrc:round})
   .includes('placeFuelDrums must clamp the drums it places per room to the shared cap'),'per-room cap regression fires');
 assert.ok(rule.check({levelsSrc:levels.replace("e.encounter&&e.encounter!=='patrol'",'false'),ftueSrc:ftue,roundSrc:round})
   .includes('placeFuelDrums must skip any room already running a precision scripted encounter (guard/turret/swarm/shield/door/grenadier)'),'encounter-exclusion regression fires');
 assert.ok(rule.check({levelsSrc:levels,ftueSrc:ftue,roundSrc:round.replace('igniteDrums(round,drum.x,drum.z,drum.chainRadius,now);','')})
   .includes('a drum detonating must call igniteDrums so a chain can propagate to the next one'),'chain regression fires');
}

{
 const rule=by('live-pads-junction');
 assert.equal(rule.check().length,0,'live power pads pass as shipped');
 assert.equal(rule.check({levelsSrc:'',combatSrc:'',roundSrc:'',weaponSrc:'',gameSrc:'',padIntroSrc:''}).length,6,'all power-pad guards fire');
 const cases=[['levelsSrc','nodspel/levels.js','completedRaids<J.unlockRaids'],['levelsSrc','nodspel/levels.js','RULES.interactives.maxPerRoom<2'],['levelsSrc','nodspel/levels.js','cap-occupied'],['combatSrc','nodspel/combat.js','RULES.junction.enemyDps*dt'],['roundSrc','nodspel/round.js','pad.deadUntil=pad.overloadUntil+J.cooldownMs'],['weaponSrc','nodspel/weapon.js','shootJunction(round,hit.target.id,now)'],['gameSrc','nodspel/game.mjs',"push('power_pad_intro')"]];
 for(const [key,path,guard] of cases){const src=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');assert.equal(rule.check({[key]:src.replace(guard,'REMOVED')}).length,1,guard+' regression fires');}
}

{
 const rule=by('collapsing-shelf-lane');
 assert.equal(rule.check().length,0,'collapsing shelves pass as shipped');
 assert.equal(rule.check({levelsSrc:'',roundSrc:'',weaponSrc:'',physicsSrc:'',gameSrc:'',shelfIntroSrc:'',shelfDataSrc:''}).length,6);
 const cases=[['shelfDataSrc','data/raid-shelf.js','unlockRaids:3'],['levelsSrc','nodspel/levels.js','!shelfPathsConnected(level,f)'],['levelsSrc','nodspel/levels.js','if(!routeClear)continue'],['levelsSrc','nodspel/levels.js','occupied>=cap'],['weaponSrc','nodspel/weapon.js','shootShelf(round,hit.target.id,now)'],['roundSrc','nodspel/round.js','RULES.shelf.telegraphMs+RULES.shelf.fallMs'],['physicsSrc','nodspel/physics.mjs','if(box.movementOnly)return Infinity'],['physicsSrc','nodspel/physics.mjs','previous>0&&Math.hypot(x-b.x,z-b.z)>Math.hypot(p.x-b.x,p.z-b.z)'],['gameSrc','nodspel/game.mjs',"push('shelf_intro')"]];
 for(const [key,path,guard] of cases){const src=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');assert.equal(rule.check({[key]:src.replace(guard,'REMOVED')}).length,1,guard+' regression fires');}
}

// Each one-path fix has a negative fixture and a real-source positive contract.
for(const id of ['sleeping-bit-voice','quest-return-intro','legacy-quest-access','resume-held-room','wake-core-direct','sleeping-bit-raid','fabricator-base-briefing','fabricator-single-choice','build-skips-activation','reward-after-scene','quests-after-vault','vault-base-briefing','labelled-build-goal']){
 const rule=by('ftue-'+id);assert.equal(rule.check({appSrc:'',gameSrc:'',audioSrc:''}).length,1,id+' rejects regression');assert.equal(rule.check().length,0,id+' holds');
}

assert.equal(by('worldmap-new-label-gap').check({htmlSrc:'.worldmap .wm-label.on[data-label="bunker"]{top:calc(50% + 56px)'}).length,1,'old Bunker offset overlaps the new area');
assert.equal(by('worldmap-new-label-gap').check().length,0);

assert.equal(by('enemy-label-clearance-hold').check({gameSrc:'const blocked=overlapsAt(y,size,hudRects);if(overlapsAt(y,size,labelRects)){l.el.hidden=true;continue;}'}).length,1);
assert.equal(by('enemy-label-clearance-hold').check().length,0);

for(const id of ['selective-bloom-occlusion-and-combine','postfx-pass-disposal-and-size']){
  assert.equal(by(id).check({postfxSrc:''}).length,1,id+' rejects missing protection');
  assert.equal(by(id).check().length,0,id+' accepts current implementation');
}
const postfx=fs.readFileSync(new URL('../nodspel/postfx.js',import.meta.url),'utf8');
for(const token of ['scene.fog=null','masked(m,false)','tBloom.value=bloom.renderTargetsHorizontal[0].texture','scene.background=background;scene.fog=fog;'])assert.equal(by('selective-bloom-occlusion-and-combine').check({postfxSrc:postfx.replace(token,'regression')}).length,1);
for(const token of ['bloomComposer.setSize(bw,bh)','for(const pass of composer.passes)pass.dispose()','for(const pass of bloomComposer.passes)pass.dispose()','bloomMask?.dispose()','cache.delete(source)'])assert.equal(by('postfx-pass-disposal-and-size').check({postfxSrc:postfx.replace(token,'regression')}).length,1);

const world=fs.readFileSync(new URL('../nodspel/world.js',import.meta.url),'utf8');
assert.equal(by('drum-bloom-reads-with-boost').check({worldSrc:world,postfxSrc:postfx}).length,0,'current implementation passes');
assert.equal(by('drum-bloom-reads-with-boost').check({worldSrc:world.replace('tagBloom(band,{boost:3})','tagBloom(band)'),postfxSrc:postfx}).length,1,'unboosted band regresses');
assert.equal(by('drum-bloom-reads-with-boost').check({worldSrc:world.replace('tagBloom(lid,{boost:3})','tagBloom(lid)'),postfxSrc:postfx}).length,1,'unboosted lid regresses');
assert.equal(by('drum-bloom-reads-with-boost').check({worldSrc:world,postfxSrc:postfx.replace('emissiveIntensity*boost','emissiveIntensity')}).length,1,'mask dropping the boost multiplier regresses');
for(const [id,ctx] of [['base-bit-card-clears-rooms',{appSrc:'',layoutSrc:''}],['base-briefing-single-cost',{appSrc:'',bitSrc:''}],['core-restore-lights-base',{appSrc:'function ruinLevel(id,fabricator){if(!fabricator)return 2;return 1;}'}]]){
 const rule=by(id);assert.equal(rule.check().length,0,id+' passes');assert.ok(rule.check(ctx).length,id+' rejects regression');
}

assert.ok(by('base-bit-card-clears-rooms').check({cardCssSrc:''}).length,'wide base cards regress narrow Vault placement');

{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(by('base-bit-card-clears-rooms').check({appSrc:app.replace('if(typeof window !== "undefined") window.addEventListener?.("pr:ui-show"','window.addEventListener("pr:ui-show"')}).length,'unguarded card listener breaks DOM-free logic and geometry tests');
}
{const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.equal(by('fabricator-marker-once').check({appSrc:app,html}).length,0,'v2.28.55 passes on app.js');
 assert.equal(by('fabricator-marker-once').check({appSrc:app.replace('markGoalOnMap(trackedGoalHtml()','(trackedGoalHtml()'),html}).length,1,'v2.28.55 fires when the base renders both labels');
 assert.equal(by('fabricator-marker-once').check({appSrc:app,html:html.replace('.on-map-marked{display:none','.on-map-marked{opacity:1')}).length,1,'v2.28.55 fires without the CSS hide');
 assert.equal(by('fabricator-marker-once').check({appSrc:'',html:''}).length,3,'v2.28.55 fires on missing pieces');}

{
 const rule=by('depth-raid-area-clear-choice');
 assert.equal(rule.check().length,0,'depth raid area-clear choice holds on real source');
 assert.equal(rule.check({roundSrc:'',depthRaidSrc:'',stakesSrc:'',gameSrc:''}).length,8,'all depth-raid area-clear guards fire');
 const round=fs.readFileSync(new URL('../nodspel/round.js',import.meta.url),'utf8');
 const depthRaid=fs.readFileSync(new URL('../nodspel/depth-raid.js',import.meta.url),'utf8');
 const stakes=fs.readFileSync(new URL('../nodspel/stakes.js',import.meta.url),'utf8');
 const game=fs.readFileSync(new URL('../nodspel/game.mjs',import.meta.url),'utf8');
 assert.equal(rule.check({roundSrc:round.replace('if(round.depth)return !!round.depth.extractOpen;','')}).length,1,'exitIsOpen regressing off extractOpen fires');
 assert.equal(rule.check({roundSrc:round.replace('if(round.remainingMs===0&&!round.depth)','if(round.remainingMs===0)')}).length,1,'the global clock failing a depth raid fires');
 assert.equal(rule.check({roundSrc:round.replace('export function extractDepthZone(','function removedDepthZone(')}).length,1,'a missing extractDepthZone fires');
 assert.equal(rule.check({roundSrc:round.replace('export function timeoutRound(','function removedTimeout(')}).length,1,'a missing timeoutRound fires');
 assert.equal(rule.check({depthRaidSrc:depthRaid.replace('export function areaIsCleared(','function removedClear(')}).length,1,'removing areaIsCleared fires');
 assert.equal(rule.check({depthRaidSrc:depthRaid.replace("if(!d||round.over||d.phase!=='choice'||d.zone>=3||!d.choice?.canGoDeeper)return null;",'')}).length,1,'goDeeper missing its choice/zone-3 guard fires');
 assert.equal(rule.check({stakesSrc:stakes.replace('round.ftue || round.depth','round.ftue')}).length,1,'the hunter-wave clock staying on in depth mode fires');
 assert.equal(rule.check({gameSrc:game.replace('if(round.depth){\n      const dres=stepDepthRaid(round,clock,position);','if(true){\n      const dres=stepDepthRaid(round,clock,position);')}).length,1,'enterExit running unconditionally for a depth round fires');
}

{
 const rule=by('depth-choice-touch');
 assert.equal(rule.check().length,0,'depth choice touch holds on real source');
 assert.equal(rule.check({gameSrc:'',cssSrc:'',htmlSrc:'id="go-deeper"'}).length,5,'all depth-choice touch guards fire');
 const game=fs.readFileSync(new URL('../nodspel/game.mjs',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../nodspel/style.css',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../nodspel/index.html',import.meta.url),'utf8');
 assert.equal(rule.check({gameSrc:game.replace("bindHUDTap($('#depth-extract'),onDepthExtract)","$('#depth-extract').addEventListener('click',onDepthExtract)")}).length,1,'click-only EXTRACT wiring fires');
 assert.equal(rule.check({gameSrc:game.replace("e.target.closest?.('#depth-choice,.bit-card')","e.target.closest?.('#nope')")}).length,1,'a paused-input gate that swallows the popup fires');
 assert.equal(rule.check({gameSrc:game.replace('#quest-chip,#depth-choice','#quest-chip')}).length,1,'stick routing that ignores #depth-choice fires');
 assert.equal(rule.check({cssSrc:css.replace('.depth-choice .pop-backdrop{z-index:0;pointer-events:none}','')}).length,1,'a covering backdrop fires');
 assert.equal(rule.check({htmlSrc:html+'<button id="go-deeper" type="button">GO DEEPER</button>'}).length,1,'a leftover HUD chip fires');
}

{
 const rule=by('depth-raid-retag-refs');
 assert.equal(rule.check().length,0,'depth raid retag refs hold on real source');
 assert.equal(rule.check({depthLevelSrc:'',worldSrc:''}).length,2,'all depth-raid retag guards fire');
 const depth=fs.readFileSync(new URL('../nodspel/depth-level.js',import.meta.url),'utf8');
 const world=fs.readFileSync(new URL('../nodspel/world.js',import.meta.url),'utf8');
 assert.equal(rule.check({depthLevelSrc:depth.replace('if(o&&o.padId!=null)o.padId=`${prefix}-${o.padId}`','')}).length,1,'a retag that leaves padId unprefixed fires');
 assert.equal(rule.check({worldSrc:world.replace('const pad=level.hazards.find(h=>h.id===j.padId);if(!pad)return null;','const pad=level.hazards.find(h=>h.id===j.padId),g=new THREE.Group();')}).length,1,'a buildWorld that assumes every junction has a pad fires');
}

{
 const rule=by('depth-final-extract-signpost');
 assert.equal(rule.check().length,0,'depth final extract signpost holds on real source');
 assert.equal(rule.check({depthLevelSrc:'',depthRaidSrc:'',worldSrc:'',gameSrc:'',raidDepthSrc:'',htmlSrc:''}).length,6,'all depth-final extract guards fire');
 const depth=fs.readFileSync(new URL('../nodspel/depth-level.js',import.meta.url),'utf8');
 const raid=fs.readFileSync(new URL('../nodspel/depth-raid.js',import.meta.url),'utf8');
 const world=fs.readFileSync(new URL('../nodspel/world.js',import.meta.url),'utf8');
 const game=fs.readFileSync(new URL('../nodspel/game.mjs',import.meta.url),'utf8');
 const data=fs.readFileSync(new URL('../data/raid-depth.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../nodspel/index.html',import.meta.url),'utf8');
 assert.equal(rule.check({depthLevelSrc:depth.replace('level.extracts=depthExits.map(','level.exitOnly=depthExits.map(')}).length,1,'a layout that does not publish per-area extracts fires');
 assert.equal(rule.check({depthRaidSrc:raid.replace('const exit=round.level.depthExits?.[zone-1]','const exit=round.level.exit')}).length,1,'chooseExtract that leaves the beam at the default exit fires');
 assert.equal(rule.check({worldSrc:world.replaceAll('depthExtractOpen','depthBeamIgnore')}).length,1,'world opening every depth beam at once fires');
 assert.equal(rule.check({gameSrc:game.replaceAll('renderDepthExtractGuide','renderNothing')}).length,1,'a missing extract guide fires');
 assert.equal(rule.check({htmlSrc:html.replace('id="depth-extract-guide"','id="no-guide"')}).length,1,'missing guide markup fires');
 assert.equal(rule.check({raidDepthSrc:data.replaceAll('extractFinal','extractGone')}).length,1,'dropping the final-area BIT line fires');
}
