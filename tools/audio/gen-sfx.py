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


def cue(name):
    rng = rng_for(name)
    if name.startswith('shoot'):
        cls = name.split('-')[-1]; freq = {'carbine':180, 'smg':260, 'shotgun':90, 'rifle':130}.get(cls, 180)
        return tone(.24 if cls == 'shotgun' else .16, freq * 3, freq / 2, 2.4, rng)
    if name.startswith('reload'): return np.concatenate([tone(.09, 1200, 300, 1, rng), np.zeros(int(.08*SR)), tone(.12, 850, 200, 1, rng)])
    if name.startswith('empty'): return tone(.06, 900, 400, .8, rng)
    if name.startswith('step'):
        f = {'concrete':170, 'gravel':450, 'metal':1400, 'wood':260}[name.split('-')[1]]
        return tone(.12, f, f*.65, 2 if f == 450 else .7, rng)
    if name.startswith('impact') or name == 'hit': return tone(.1, 600 if name.endswith('wall') else 120, 65, 2, rng)
    if name.startswith('hit-') or name.startswith('death-'):
        f = {'grunt':160,'rusher':280,'thrower':210,'tank':80,'turret':800,'generator':500}[name.split('-')[1]]
        return tone(.48 if name.startswith('death') else .16, f, f*.35, .8, rng)
    if name.startswith('pickup'):
        tier = {'common':0,'uncommon':1,'rare':2,'epic':3,'legendary':4}.get(name.split('-')[-1],0)
        return np.concatenate([tone(.1, 550+i*180, 800+i*220, .02, rng) for i in range(tier+1)])
    if name in ('alarm', 'hunter-wave'):
        return np.concatenate([tone(.35, f, f*1.08, .2, rng) for f in ([520,780,520,780] if name=='alarm' else [120,160,240])])
    params = {'kill':(.18,900,1400), 'medkit':(.5,400,1000), 'dash':(.2,180,900), 'perk-open':(.25,400,800), 'perk-select':(.3,700,1400), 'ui-tap':(.055,800,600), 'ui-back':(.09,600,300), 'ui-confirm':(.13,600,1100), 'bag-full':(.3,320,160), 'extract-countdown':(.1,950,950), 'extract-success':(.8,350,1400), 'extract':(.8,350,1400), 'death':(.8,300,55)}
    dur, a, b = params[name]
    return tone(dur,a,b,.08,rng)


def loop(name):
    rng = rng_for(name)
    duration = LOOP_SECONDS + CROSSFADE_SECONDS
    n = int(SR*duration); t = np.arange(n)/SR
    # FFT shaped wind/ventilation uses no third-party source recordings.
    noise = rng.normal(0,1,n)
    spectrum = np.fft.rfft(noise); freq = np.fft.rfftfreq(n,1/SR)
    spectrum *= np.exp(-freq/1000) / np.sqrt(np.maximum(freq,35))
    bed = np.fft.irfft(spectrum,n); bed /= max(np.std(bed),1e-9)
    if name == 'archipelago':
        x = .07*bed*(.65+.35*np.sin(2*np.pi*t/7))
        x += .035*np.sin(2*np.pi*75*t)*(.5+.5*np.sin(2*np.pi*t/6))
        for at in [4,13,22]:
            k=int(at*SR); bell=tone(1.5,660,658,.015,rng); bell+=.35*tone(1.5,990,988,0,rng);x[k:k+len(bell)]+=.07*bell
        for at in [8,18]:
            k=int(at*SR); g=np.arange(int(.8*SR))/SR; bird=np.sin(2*np.pi*(1300*g+120*np.sin(2*np.pi*g*2)))*np.sin(np.pi*g/.8)**2;x[k:k+len(g)]+=.018*bird
    elif name == 'bunker':
        x=.045*bed+.05*np.sin(2*np.pi*60*t)+.02*np.sin(2*np.pi*120*t)
        for at in [3,9,17,23]:
            k=int(at*SR); drip=tone(.25,1900,450,.1,rng);x[k:k+len(drip)]+=.05*drip
    elif name == 'base': x=.04*bed+.055*np.sin(2*np.pi*55*t)+.025*np.sin(2*np.pi*82.5*t)
    else: x=.06*(np.sin(2*np.pi*110*t)+.4*np.sin(2*np.pi*165*t))*(.5+.5*np.sin(2*np.pi*t/2))**4
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
        for name in names+['shoot','hit','pickup','extract']:
            encode(cue(name),OUT/'sfx'/name,tmp)
        for name in ['archipelago','bunker','base','pulse']:
            encode(loop(name),OUT/('music' if name=='pulse' else 'ambience')/name,tmp)
    for path in sorted((OUT/'bit').glob('*.ogg')):
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-ac','1','-ar','22050','-c:a','aac','-b:a','32k','-movflags','+faststart',str(path.with_suffix('.m4a'))],check=True)
    lines=['# Shipping audio sources and licenses','',
           'All synthesis is local and free. No downloaded samples or sound packs are used.',
           'Original procedural SFX, ambience and music are dedicated to CC0-1.0 by this project.',
           'Generator: `tools/audio/gen-sfx.py`, numpy seed 20261028 with SHA256 per-file seeds.',
           'The eight existing F1 BIT recordings are preserved; AAC copies use ffmpeg locally.',
           'BIT source: `tools/audio/gen-bit-voice.py`, original project text, Kokoro-82M am_fenrir (Apache-2.0 model/voice), kokoro-onnx (MIT runtime). All 16 BIT voice files (eight recordings in Ogg and AAC formats) are our own generated outputs. Copyright © 2026 Robert Wasser. All rights reserved; not licensed for reuse. Apache-2.0 and MIT describe upstream model and runtime provenance, not the license of these recordings.',
           'Provenance: https://huggingface.co/hexgrad/Kokoro-82M and https://github.com/thewh1teagle/kokoro-onnx . See `docs/audio-pipeline.md` for the exact F1 processing.',
           'CC0 dedication: https://creativecommons.org/publicdomain/zero/1.0/ . No Piper audition clips ship.','',
           '| File | Source | License/provenance |','|---|---|---|']
    paths=sorted(p for p in OUT.rglob('*') if p.suffix in ('.ogg','.m4a'))
    for path in paths:
        bit=path.parent.name=='bit'
        lines.append(f'| `{path.relative_to(OUT)}` | '+('Local F1 Kokoro am_fenrir TTS; original project dialogue' if bit else 'Original seeded numpy procedural synthesis')+' | '+('All rights reserved (© Robert Wasser); Apache-2.0 model, MIT runtime provenance' if bit else 'CC0-1.0')+' |')
    total=sum(p.stat().st_size for p in paths)
    lines.extend(['',f'Total shipping audio: {total:,} bytes, {len(paths)} files (both formats included).'])
    (OUT/'LICENSES.md').write_text('\n'.join(lines)+'\n')
    print(f'{len(paths)} files, {total:,} bytes')
    if total>=2_000_000: raise SystemExit('Audio budget exceeded')

if __name__=='__main__':main()
