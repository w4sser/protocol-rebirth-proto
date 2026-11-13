// Proves each bug-lint rule actually fires on the regression it guards.
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
assert.equal(runAll({files:null,gitignore:'node_modules\n'}).length,0,'repo is clean');
console.log('bug-lint.test: ok');
