// Proves each bug-lint rule actually fires on the regression it guards.
import assert from 'node:assert/strict';import {RULES,runAll} from '../scripts/bug-lint.mjs';
const by=id=>RULES.find(r=>r.id===id);
assert.ok(by('no-tracked-node-modules').check({files:['node_modules'],gitignore:'node_modules/\n'}).length===2,'#129 fires');
assert.equal(by('no-tracked-node-modules').check({files:['a.js'],gitignore:'node_modules\n'}).length,0);
assert.equal(by('audio-ogg-m4a-pairs').check({files:['assets/audio/sfx/x.ogg']}).length,1,'#162 fires');
assert.equal(by('audio-ogg-m4a-pairs').check({files:['assets/audio/sfx/x.ogg','assets/audio/sfx/x.m4a']}).length,0);
assert.equal(runAll({files:null,gitignore:'node_modules\n'}).length,0,'repo is clean');
console.log('bug-lint.test: ok');
