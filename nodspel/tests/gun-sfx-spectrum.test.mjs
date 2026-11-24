// v2.28.75 (Robert 24 Nov 2026): shots still sounded like pea-shooters; mortar had no muffled boom.
// v2.28.76 (Robert 24 Nov 2026, t452u item 3): "still no bang" -- peak was already near 0 dBFS, the
// RMS/punch was the weak link, and UI taps/backs/confirms were cutesy sine chirps. Assert the
// procedural powder report is both loud (RMS louder than the pre-v2.28.76 BEFORE numbers below) and
// a real crack (a genuinely short crack_decay time constant), with real low-end energy in a sane
// range (not a muffled thump), explosion still heavier below 200 Hz than a carbine, air still a
// hiss, and that the UI click generators are dry noise bursts, never a sine/square tone sweep.
// Uses the same gen-sfx.py the shipping files come from.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
// BEFORE v2.28.76 (measured from the then-shipping files; see t452u item 3 task notes).
const BEFORE={'shoot-carbine':-10.32,'shoot-smg':-12.59,'shoot-shotgun':-7.98,'shoot-rifle':-10.15};

test('powder shots and the mortar boom have punch and low-end energy',()=>{
  // CI has no numpy: fall back to the committed measurement (regenerate with measure-sfx.py > sfx-measure.json).
  const hasNumpy=spawnSync('python3',['-c','import numpy'],{cwd:root}).status===0;
  let m;
  if(hasNumpy){
    const run=spawnSync('python3',[resolve(root,'tools/audio/measure-sfx.py')],{encoding:'utf8',cwd:root});
    assert.equal(run.status,0,run.stderr||run.stdout||'measure-sfx.py failed');
    m=JSON.parse(run.stdout);
    const committed=JSON.parse(readFileSync(resolve(root,'tools/audio/sfx-measure.json'),'utf8'));
    assert.deepEqual(committed,m,'tools/audio/sfx-measure.json is stale: rerun measure-sfx.py > tools/audio/sfx-measure.json');
  }else{
    m=JSON.parse(readFileSync(resolve(root,'tools/audio/sfx-measure.json'),'utf8'));
  }
  for(const name of ['shoot-carbine','shoot-shotgun','shoot-rifle']){
    assert.ok(m[name].peakDb>-3,`${name} peak ${m[name].peakDb} dBFS is too quiet`);
    assert.ok(m[name].lowFrac>0.2&&m[name].lowFrac<0.75,`${name} low-band fraction ${m[name].lowFrac} is out of range (crack, not a muffled thump)`);
  }
  for(const [name,before] of Object.entries(BEFORE))
    assert.ok(m[name].rmsDb>before,`${name} rmsDb ${m[name].rmsDb} must be louder than the pre-v2.28.76 ${before} dBFS`);
  assert.ok(m.explosion.peakDb>-3,`explosion peak ${m.explosion.peakDb} dBFS is too quiet`);
  assert.ok(m.explosion.lowFrac>0.6,`explosion low-band ${m.explosion.lowFrac} is not a muffled boom`);
  assert.ok(m.explosion.lowFrac>m['shoot-carbine'].lowFrac,'explosion must be heavier in the sub/low band than a carbine shot');
  // Air stays a hiss, not a powder thump.
  assert.ok(m['shoot-air'].lowFrac<0.05,'air cue must stay a hiss, not pick up a powder thump');
});

test('every powder weapon has a genuinely short (<5ms) broadband crack transient',()=>{
  const src=readFileSync(resolve(root,'tools/audio/gen-sfx.py'),'utf8');
  const profiles=(src.match(/POWDER_PROFILES = \{[\s\S]*?\n\}/)||[''])[0];
  assert.ok(profiles,'tools/audio/gen-sfx.py: POWDER_PROFILES dict not found');
  const decays=[...profiles.matchAll(/'(\w+)':[^\n]*crack_decay=(\.\d+)/g)];
  assert.ok(decays.length>=5,'expected a crack_decay for every powder/air profile');
  for(const [,weapon,value] of decays)assert.ok(Number(value)<.005,`${weapon} crack_decay ${value}s is not a short (<5ms) transient`);
});

test('UI tap/back/confirm are dry mechanical clicks, never a sine-tone chirp',()=>{
  const src=readFileSync(resolve(root,'tools/audio/gen-sfx.py'),'utf8');
  assert.match(src,/UI_CLICK_PROFILES = \{[\s\S]*?'ui-tap':/,'tools/audio/gen-sfx.py: UI_CLICK_PROFILES must register ui-tap');
  assert.match(src,/'ui-back':/);assert.match(src,/'ui-confirm':/);
  assert.match(src,/if name in UI_CLICK_PROFILES:\s*\n\s*return click\(name, rng\)/,'cue() must route ui-tap/back/confirm through click(), not the generic tone()-based dispatch');
  const clickFn=(src.match(/def click\(name, rng\):[\s\S]*?(?=\ndef )/)||[''])[0];
  assert.ok(clickFn,'click() function not found');
  assert.ok(!/tone\(/.test(clickFn)&&!/np\.sin\(/.test(clickFn),'click() must stay a noise burst -- no tone()/np.sin( sine oscillator');
  const params=(src.match(/params = \{[^}]*\}/)||[''])[0];
  assert.ok(!/'ui-tap'|'ui-back'|'ui-confirm'/.test(params),'ui-tap/ui-back/ui-confirm must not also be listed in the generic tone()-based params dict');
});
