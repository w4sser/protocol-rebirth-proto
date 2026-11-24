#!/usr/bin/env python3
"""Original seeded numpy synthesis, no samples. Rebuild OGG + AAC shipping assets.
PCM is reproducible; Ogg serial IDs may differ by encoder invocation.
Run with /workspace/tts-venv/bin/python tools/audio/gen-sfx.py.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/audio'
SR = 22050
SEED = 20261028
LOOP_SECONDS = 24
CROSSFADE_SECONDS = 2


def rng_for(name):
    return np.random.default_rng(SEED + int.from_bytes(hashlib.sha256(name.encode()).digest()[:4], 'little'))


def tone(duration, start, end, noise, rng):
    t = np.arange(round(duration * SR)) / SR
    phase = np.cumsum(np.linspace(start, end, len(t))) / SR
    envelope = np.minimum(t / .004, 1) * np.exp(-t * 6 / duration)
    envelope *= np.minimum((duration - t) / .012, 1)
    return (.7 * np.sin(2 * np.pi * phase) + noise * rng.normal(0, .4, len(t))) * envelope


def one_pole(x, hz):
    a = 1 - np.exp(-2 * np.pi * hz / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


# v2.28.76 (Robert 24 Nov 2026: "still no bang"): crack_decay under 5ms for a true short broadband
# transient (was 4-7ms); a harder drive into the tanh saturation for a louder, saturated body at the
# same clamped ceiling (RMS, not peak, was the weak link); duration/tail_decay stretched so the room
# tail actually rings out ~250-400ms instead of being cut off by the old .32s buffer. Module-level so
# tools/audio/measure-sfx.py and nodspel/tests/gun-sfx-spectrum.test.mjs can assert on the parameters
# directly (match nodspel/data/audio.js's shots.weapons -- the runtime's own shotBuffer() mirrors this).
POWDER_PROFILES = {
    'carbine': dict(kind='powder', duration=.34, crack=1.6, body=1.15, thump=2.2, tail=.32, thump_hz=90, highpass=1600, crack_decay=.003, body_decay=.07, thump_decay=.16, tail_decay=.1, drive=3.4, ceiling=.92),
    'smg': dict(kind='powder', duration=.3, crack=1.6, body=1.1, thump=1.1, tail=.27, thump_hz=100, highpass=1600, crack_decay=.0022, body_decay=.05, thump_decay=.11, tail_decay=.08, drive=3.1, ceiling=.92),
    'shotgun': dict(kind='powder', duration=.4, crack=1.8, body=1.4, thump=2.6, tail=.42, thump_hz=65, highpass=1600, crack_decay=.0035, body_decay=.08, thump_decay=.18, tail_decay=.12, drive=3.6, ceiling=.92),
    'rifle': dict(kind='powder', duration=.34, crack=1.6, body=1.1, thump=2.3, tail=.36, thump_hz=85, highpass=1600, crack_decay=.003, body_decay=.07, thump_decay=.17, tail_decay=.1, drive=3.4, ceiling=.92),
    'air': dict(kind='air', duration=.2, crack=1.15, body=.22, hiss=.75, hiss_hz=4200, hiss_decay=.05, crack_decay=.0035, body_decay=.03, drive=1.45, ceiling=.86),
}


def gunshot(name, rng):
    """Noise-burst powder report or pneumatic hiss. No sine/square tone sweeps."""
    cls = name.split('-')[-1]
    P = POWDER_PROFILES.get(cls, POWDER_PROFILES['carbine'])
    n = int(round(P['duration'] * SR))
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    attack = np.minimum(t / .0005, 1)
    fade = np.minimum((P['duration'] - t) / .015, 1)
    if P['kind'] == 'air':
        low = one_pole(noise, 1400)
        mid = one_pole(noise, 1800)
        hiss = one_pole(noise, P['hiss_hz'])
        x = attack * ((noise - low) * P['crack'] * np.exp(-t / P['crack_decay']) + mid * P['body'] * np.exp(-t / P['body_decay']) + (noise - hiss) * P['hiss'] * np.exp(-t / P['hiss_decay'])) * fade
    else:
        low = one_pole(noise, P.get('highpass', 1600))
        mid = one_pole(noise, 1800)
        thump = one_pole(one_pole(noise, P['thump_hz']), P['thump_hz'])
        high = one_pole(noise, 650)
        x = attack * ((noise - low) * P['crack'] * np.exp(-t / P['crack_decay']) + mid * P['body'] * np.exp(-t / P['body_decay']) + thump * P['thump'] * np.exp(-t / P['thump_decay']) + high * P['tail'] * np.exp(-t / P['tail_decay'])) * fade
    dry = x.copy()
    for delay, gain in ((.034, .18), (.071, .1), (.11, .05)):
        j = int(round(delay * SR))
        if j < n:
            x[j:] += dry[:n - j] * gain
    return P.get('ceiling', .86) * np.tanh(x * P['drive'])


def explosion(rng):
    """Deep muffled boom: low-passed noise, sub thump, rumble tail. No sine tones."""
    duration=.62
    n=int(round(duration*SR))
    t=np.arange(n)/SR
    noise=rng.normal(0,1,n)
    attack=np.minimum(t/.003,1)
    fade=np.minimum((duration-t)/.08,1)
    body=one_pole(noise,280)
    thump=one_pole(one_pole(noise,45),45)
    rumble=one_pole(one_pole(noise,90),90)
    x=attack*(body*1.4*np.exp(-t/.14)+thump*2.2*np.exp(-t/.24)+rumble*.9*np.exp(-t/.38))*fade
    dry=x.copy()
    for delay,gain in ((.04,.2),(.09,.12),(.16,.06)):
        j=int(round(delay*SR))
        if j<n:
            x[j:]+=dry[:n-j]*gain
    return .9*np.tanh(x*1.8)


# v2.28.76 (Robert 24 Nov 2026: UI buttons are "too cute"): dry mechanical clicks, not chirpy sine
# tones -- a filtered noise burst per press, with a short low body thump added for the heavier
# back/confirm presses. Module-level (like POWDER_PROFILES) so tests can assert on it directly.
UI_CLICK_PROFILES = {
    'ui-tap': dict(duration=.045, hz=3200, decay=.006, drive=2.2, ceiling=.55),
    'ui-back': dict(duration=.07, hz=2000, decay=.009, body_hz=380, body_gain=.35, body_decay=.025, drive=2, ceiling=.5),
    'ui-confirm': dict(duration=.1, hz=2600, decay=.007, body_hz=260, body_gain=.55, body_decay=.05, drive=2.2, ceiling=.6),
}


def click(name, rng):
    """Dry mechanical click: a filtered noise burst, never a sine oscillator. The heavier
    back/confirm presses add a short low body thump so they read as more substantial than a bare
    tap."""
    P = UI_CLICK_PROFILES[name]
    n = int(round(P['duration'] * SR))
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    attack = np.minimum(t / .0006, 1)
    fade = np.minimum((P['duration'] - t) / max(.012, P['duration'] * .25), 1)
    tick_lp = one_pole(noise, P['hz'])
    x = attack * (noise - tick_lp) * np.exp(-t / P['decay'])
    if P.get('body_gain'):
        body = one_pole(noise, P['body_hz'])
        x = x + attack * body * P['body_gain'] * np.exp(-t / P['body_decay'])
    return P['ceiling'] * np.tanh(x * fade * P['drive'])


def cue(name):
    rng = rng_for(name)
    if name.startswith('shoot'):
        return gunshot(name, rng)
    if name=='explosion':
        return explosion(rng)
    if name in UI_CLICK_PROFILES:
        return click(name, rng)
    if name.startswith('reload'): return np.concatenate([tone(.09, 1200, 300, 1, rng), np.zeros(int(.08*SR)), tone(.12, 850, 200, 1, rng)])
    if name.startswith('empty'): return tone(.06, 900, 400, .8, rng)
    if name.startswith('impact'): return tone(.1, 600 if name.endswith('wall') else 120, 65, 2, rng)
    if name.startswith('hit-') or name.startswith('death-'):
        f = {'grunt':160,'rusher':280,'thrower':210,'tank':80,'turret':800,'generator':500}[name.split('-')[1]]
        return tone(.48 if name.startswith('death') else .16, f, f*.35, .8, rng)
    if name.startswith('pickup'):
        tier = {'common':0,'uncommon':1,'rare':2,'epic':3,'legendary':4}.get(name.split('-')[-1],0)
        return np.concatenate([tone(.1, 550+i*180, 800+i*220, .02, rng) for i in range(tier+1)])
    if name in ('alarm', 'hunter-wave'):
        return np.concatenate([tone(.35, f, f*1.08, .2, rng) for f in ([520,780,520,780] if name=='alarm' else [120,160,240])])
    params = {'kill':(.18,900,1400), 'medkit':(.5,400,1000), 'dash':(.2,180,900), 'perk-open':(.25,400,800), 'perk-select':(.3,700,1400), 'bag-full':(.3,320,160), 'extract-countdown':(.1,950,950), 'extract-success':(.8,350,1400), 'death':(.8,300,55)}
    dur, a, b = params[name]
    return tone(dur,a,b,.08,rng)


def loop(name):
    rng = rng_for(name)
    duration = LOOP_SECONDS + CROSSFADE_SECONDS
    n = int(SR*duration); t = np.arange(n)/SR
    x=.06*(np.sin(2*np.pi*110*t)+.4*np.sin(2*np.pi*165*t))*(.5+.5*np.sin(2*np.pi*t/2))**4
    # Wrap the final 2 s onto the beginning. The seam follows the original
    # contiguous waveform, with a smooth raised-cosine transition in the overlap.
    length=int(LOOP_SECONDS*SR); fade=int(CROSSFADE_SECONDS*SR)
    w=.5-.5*np.cos(np.linspace(0,np.pi,fade))
    result=x[:length].copy();result[:fade]=x[length:length+fade]*(1-w)+x[:fade]*w
    return result


def encode(samples, stem, tmp):
    stem.parent.mkdir(parents=True,exist_ok=True)
    pcm=np.clip(samples,-.9,.9)
    wav=Path(tmp)/'input.wav'
    with wave.open(str(wav),'wb') as out:
        out.setnchannels(1);out.setsampwidth(2);out.setframerate(SR);out.writeframes((pcm*32767).astype('<i2').tobytes())
    for suffix,codec in [('ogg',['-c:a','libvorbis','-b:a','24k']),('m4a',['-c:a','aac','-b:a','24k','-movflags','+faststart'])]:
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-ac','1','-ar',str(SR),*codec,str(stem.with_suffix('.'+suffix))],check=True)


def main():
    # Read the actual shipping cue manifest to prevent generated/registered drift.
    listing=subprocess.check_output(['node','-e',"require('./data/audio.js');console.log(JSON.stringify(Object.keys(globalThis.DATA.audio.sfx)))"],cwd=ROOT,text=True)
    names=json.loads(listing)
    with tempfile.TemporaryDirectory() as tmp:
        for name in names:
            encode(cue(name),OUT/'sfx'/name,tmp)
        encode(loop('pulse'),OUT/'music'/'pulse',tmp)
    for path in sorted((OUT/'bit').glob('*.ogg')):
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-ac','1','-ar','22050','-c:a','aac','-b:a','32k','-movflags','+faststart',str(path.with_suffix('.m4a'))],check=True)
    lines=['# Shipping audio sources and licenses','',
           'All synthesis is local and free. No downloaded samples or sound packs are used.',
           'Original procedural SFX and music are dedicated to the public domain under CC0-1.0 by the project owner.',
           'Generator: `tools/audio/gen-sfx.py`, numpy seed 20261028 with SHA256 per-file seeds.',
           'The existing F1 BIT recordings are preserved; AAC copies use ffmpeg locally.',
           'BIT source: `tools/audio/gen-bit-voice.py`, original project text, Kokoro-82M am_fenrir (Apache-2.0 model/voice), kokoro-onnx (MIT runtime). All 18 BIT voice files (nine recordings in Ogg and AAC formats) are our own generated outputs. Copyright © 2026 Robert Wasser. All rights reserved; not licensed for reuse. Apache-2.0 and MIT describe upstream model and runtime provenance, not the license of these recordings.',
           'Provenance: https://huggingface.co/hexgrad/Kokoro-82M and https://github.com/thewh1teagle/kokoro-onnx . See `docs/audio-pipeline.md` for the exact F1 processing.',
           'CC0 dedication: https://creativecommons.org/publicdomain/zero/1.0/ . No Piper audition clips ship.','',
           '| File | Source | License/provenance |','|---|---|---|']
    paths=sorted(p for p in OUT.rglob('*') if p.suffix in ('.ogg','.m4a'))
    for path in paths:
        bit=path.parent.name=='bit'
        lines.append(f'| `{path.relative_to(OUT)}` | '+('Local F1 Kokoro am_fenrir TTS; original project dialogue' if bit else 'Original seeded numpy procedural synthesis')+' | '+('All rights reserved © Robert Wasser' if bit else 'CC0-1.0')+' |')
    total=sum(p.stat().st_size for p in paths)
    lines.extend(['',f'Total shipping audio: {total:,} bytes, {len(paths)} files (both formats included).'])
    (OUT/'LICENSES.md').write_text('\n'.join(lines)+'\n')
    print(f'{len(paths)} files, {total:,} bytes')
    if total>=2_000_000: raise SystemExit('Audio budget exceeded')

if __name__=='__main__':main()
