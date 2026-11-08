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
assert.equal(by('partition-door-clearance').check({levelsSrc:"const sideDoor=area==='bunker'&&room.doors.some(p=>p.x!==0);const pz=sideDoor?Math.min(-.8,-(door/2+t/2+.02)):-.8;"}).length,0,'v2.28.6 passes');
assert.ok(by('dda-extra-on-floor').check({ddaSrc:'const clear=p=>!solids.some(o=>1);'}).length>=1,'v2.28.4 fires on wall-only extra placement');
assert.ok(by('dda-extra-on-floor').check({ddaSrc:'walkMap(level);level.floors.some(f=>1);filter(d=>d.locked);e=>!e.encounter&&!e.frontShield;(pool.length?pool:all)'}).length>=1,'v2.28.4 fires on fallback');
assert.equal(by('dda-extra-on-floor').check({ddaSrc:'walkMap(level);level.floors.some(f=>1);filter(d=>d.locked);e=>!e.encounter&&!e.frontShield'}).length,0,'v2.28.4 passes with floor+reach+plain checks');
assert.ok(by('scouted-area-no-chart').check({levelsSrc:'if(AR.scout&&AR.scout.level===n){',appSrc:'',gameSrc:''}).length===3,'v2.28.6 fires without scouted plumbing');
assert.equal(by('scouted-area-no-chart').check({levelsSrc:'if(AR.scout&&x&&!SCOUTED.has(t)){',appSrc:'"&scouted=" scouted:scoutedAreas()',gameSrc:'setScouted(launch.scouted);'}).length,0,'v2.28.6 passes');
assert.ok(by('core-loot-hint').check({appSrc:'',htmlSrc:''}).length===3,'v2.28.6 hint fires');
assert.equal(by('core-loot-hint').check({appSrc:'lootHintHtml(p) D.lootSources',htmlSrc:'src="data/loot-sources.js'}).length,0,'v2.28.6 hint passes');
assert.ok(by('dda-extra-on-floor').check({ddaSrc:'const clear=p=>!solids.some(o=>1);'}).length>=1,'v2.28.6 fires on wall-only extra placement');
assert.ok(by('dda-extra-on-floor').check({ddaSrc:'walkMap(level);level.floors.some(f=>1);filter(d=>d.locked);e=>!e.encounter&&!e.frontShield;(pool.length?pool:all)'}).length>=1,'v2.28.6 fires on fallback');
assert.equal(by('dda-extra-on-floor').check({ddaSrc:'walkMap(level);level.floors.some(f=>1);filter(d=>d.locked);e=>!e.encounter&&!e.frontShield'}).length,0,'v2.28.6 passes with floor+reach+plain checks');
assert.ok(by('shield-guard-rear-clearance').check({encSrc:'export function applyEncounters(level,rng){\n  return level.encounters;\n}\n'}).length>=1,'v2.28.1 fires without rear-clearance pass');
assert.ok(by('shield-guard-rear-clearance').check({encSrc:'export function applyEncounters(level,rng){\n  ensureRearClearance(level,rng);\n  return level.encounters;\n}\nfunction hasClearRear(){}\nexport function walkMap(){}\nwalkMap(level,enemy.id)\nexport function ensureRearClearance(l){\n  e.frontShield=0;\n}\n',levelsSrc:'  applyAreaRules(level,AR);\n  // x\n  ensureRearClearance(level,r);'}).length>=1,'v2.28.1 fires when the shield is stripped');
assert.equal(by('shield-guard-rear-clearance').check({encSrc:'export function applyEncounters(level,rng){\n  ensureRearClearance(level,rng);\n  return level.encounters;\n}\nfunction hasClearRear(){}\nexport function walkMap(){}\nwalkMap(level,enemy.id)\nexport function ensureRearClearance(l){\n  omit();\n}\n',levelsSrc:'  applyAreaRules(level,AR);\n  // re-prove\n  ensureRearClearance(level,r);'}).length,0,'v2.28.1 passes with rear-clearance pass');
assert.ok(by('playtest-1108-ui').check({html:'',css:'',game:'',layout:''}).length>=4,'v2.28.2 fires on missing UI fixes');
assert.equal(by('playtest-1108-ui').check({html:'<button id="continue-raid" class="result-continue">',css:'.result-continue{background:var(--ad-continue)}',game:'function showLevelIntro(){\n pausePick(r);resumePick(r);\n}\nshowLevelIntro();',layout:'raidGoalCompactRun(vp)'}).length,0,'v2.28.2 passes');
assert.ok(by('fullscreen-detail').check({app:'',html:''}).length>=3,'fullscreen-detail fires');
assert.ok(by('artillery-fx-prewarm').check({gameSrc:'function prewarmShaders(){}\nprewarmShaders();'}).length>=1,'#196 fires without pre-create');
assert.equal(by('artillery-fx-prewarm').check({gameSrc:'function makeArtilleryShell(){}\nfunction makeToolFxRing(){}\nmakeArtilleryShell();makeToolFxRing();makeToolFxRing();\nfunction prewarmShaders(){}\nprewarmShaders();'}).length,0,'#196 passes with pre-create');
assert.ok(by('perk-choice-touch-44').check().length===0,'perk-touch-44 clean');
{const badCss=by('perk-choice-touch-44');
 // Smoke: rule id exists and repo currently passes (file-based check).
 assert.ok(badCss,'perk-choice-touch-44 rule present');}
assert.equal(runAll({files:null,gitignore:'node_modules\n'}).length,0,'repo is clean');
console.log('bug-lint.test: ok');
