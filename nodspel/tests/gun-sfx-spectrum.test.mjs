// v2.28.75 (Robert 24 Nov 2026): shots still sounded like pea-shooters; mortar had no muffled boom.
// v2.28.76 (Robert 24 Nov 2026, t452u item 3): "still no bang" -- peak was already near 0 dBFS, the
// RMS/punch was the weak link, and UI taps/backs/confirms were cutesy sine chirps.
// v2.28.80 (Lumina SFX pass): shoot-*/explosion/mortar-launch now ship as Lumina SFX renders that
// ui/audio.js play() prefers over the procedural fallback, so the numbers that matter are the
// shipping files' (tools/audio/measure-sfx.py decodes assets/audio/sfx/*.ogg), not the synth's own
// output. Assert the shipping powder report is both loud (RMS louder than the pre-v2.28.76 BEFORE
// numbers below) and a real crack (low-end energy in a sane range, not a muffled thump), the
// explosion is heavier below 200 Hz than a carbine shot and the new mortar-launch thump reads
// lighter than the full boom, air stays a hiss, and that the UI click generators and the fallback
// synth are dry noise bursts, never a sine/square tone sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
// BEFORE v2.28.76 (measured from the then-shipping files; see t452u item 3 task notes).
const BEFORE={'shoot-carbine':-10.32,'shoot-smg':-12.59,'shoot-shotgun':-7.98,'shoot-rifle':-10.15};

test('shipping powder shots, mortar launch and the explosion boom have punch and low-end energy',()=>{
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
  // The launch thump is audible but must read lighter in the low band than the full detonation --
  // it is a tube report, not the boom (that stays on 'explosion', fired from stepBlasts/detonateDrum).
  assert.ok(m['mortar-launch'].peakDb>-3,`mortar-launch peak ${m['mortar-launch'].peakDb} dBFS is too quiet`);
  assert.ok(m['mortar-launch'].lowFrac<m.explosion.lowFrac,'mortar-launch must read lighter than the full explosion boom');
});

test('play() prefers an already-decoded Lumina sample over synthesis for shots/explosion, and never awaits a decode to do it',()=>{
  const src=readFileSync(resolve(root,'ui/audio.js'),'utf8');
  const body=src.slice(src.indexOf('async play(name'),src.indexOf('cancelVoice('));
  const shotBranch=(body.match(/if\(shot\)\{[\s\S]*?\n {6}\}\n/)||[''])[0];
  assert.match(shotBranch,/this\.decodedBuffers\.get\(cue\.file\)\|\|this\.shotBuffer\(/,'play() must prefer an already-decoded sample over shotBuffer()');
  assert.ok(!/await\s+this\.(load|raceLoad)\(/.test(shotBranch),'shot playback must never await a decode -- fall back to synthesis synchronously instead');
  const explosionBranch=(body.match(/if\(name===['"]explosion['"]\)\{[\s\S]*?\n {6}\}\n/)||[''])[0];
  assert.match(explosionBranch,/this\.decodedBuffers\.get\(cue\.file\)\|\|this\.explosionBuffer\(/,'play() must prefer an already-decoded sample over explosionBuffer()');
  assert.ok(!/await\s+this\.(load|raceLoad)\(/.test(explosionBranch),'explosion playback must never await a decode -- fall back to synthesis synchronously instead');
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
