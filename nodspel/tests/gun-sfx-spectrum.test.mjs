// v2.28.75 (Robert 24 Nov 2026): shots still sounded like pea-shooters; mortar had no muffled boom.
// Assert the procedural powder report and explosion stay loud, with real low-end energy (explosion
// heavier below 200 Hz than a carbine). Uses the same gen-sfx.py the shipping files come from.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
test('powder shots and the mortar boom have punch and low-end energy',()=>{
  const run=spawnSync('python3',[resolve(root,'tools/audio/measure-sfx.py')],{encoding:'utf8',cwd:root});
  assert.equal(run.status,0,run.stderr||run.stdout||'measure-sfx.py failed');
  const m=JSON.parse(run.stdout);
  for(const name of ['shoot-carbine','shoot-shotgun','shoot-rifle']){
    assert.ok(m[name].peakDb>-3,`${name} peak ${m[name].peakDb} dBFS is too quiet`);
    assert.ok(m[name].lowFrac>0.2,`${name} low-band fraction ${m[name].lowFrac} is too thin`);
  }
  assert.ok(m.explosion.peakDb>-3,`explosion peak ${m.explosion.peakDb} dBFS is too quiet`);
  assert.ok(m.explosion.lowFrac>0.6,`explosion low-band ${m.explosion.lowFrac} is not a muffled boom`);
  assert.ok(m.explosion.lowFrac>m['shoot-carbine'].lowFrac,'explosion must be heavier in the sub/low band than a carbine shot');
  // Air stays a hiss, not a powder thump.
  assert.ok(m['shoot-air'].lowFrac<0.05,'air cue must stay a hiss, not pick up a powder thump');
});
