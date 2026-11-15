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
 for(const [from,to] of [['void window.PR_AUDIO?.unlockSync?.();','await window.PR_AUDIO?.unlock?.();'],["requestVoice('youre-back')","voice('youre-back')"],['preload.call(window.PR_AUDIO)','Promise.resolve()'],['Promise.resolve(activationAudio).then','Promise.resolve().then'],['addEventListener("animationstart", greet','addEventListener("click", greet']])
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
