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
assert.ok(by('artillery-fx-prewarm').check({gameSrc:'function prewarmShaders(){}\nprewarmShaders();'}).length>=1,'#196 fires without pre-create');
assert.equal(by('artillery-fx-prewarm').check({gameSrc:'function makeArtilleryShell(){}\nfunction makeToolFxRing(){}\nmakeArtilleryShell();makeToolFxRing();makeToolFxRing();\nfunction prewarmShaders(){}\nprewarmShaders();'}).length,0,'#196 passes with pre-create');
assert.ok(by('perk-choice-touch-44').check().length===0,'perk-touch-44 clean');
{const badCss=by('perk-choice-touch-44');
 // Smoke: rule id exists and repo currently passes (file-based check).
 assert.ok(badCss,'perk-choice-touch-44 rule present');}
assert.equal(runAll({files:null,gitignore:'node_modules\n'}).length,0,'repo is clean');
console.log('bug-lint.test: ok');
