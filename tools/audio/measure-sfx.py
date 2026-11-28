#!/usr/bin/env python3
"""Peak dBFS and low-band energy for the shipping powder shots, mortar launch and explosion.

v2.28.80: measures the actual shipping `assets/audio/sfx/*.ogg` files (decoded with ffmpeg) --
ui/audio.js play() prefers these decoded samples over gen-sfx.py's synthesis fallback, so the
synth's own numbers no longer describe what the game actually plays.
"""
import json
import subprocess
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SFX = ROOT / 'assets/audio/sfx'
SR = 22050
NAMES = ['shoot-carbine', 'shoot-smg', 'shoot-shotgun', 'shoot-rifle', 'shoot-air', 'explosion', 'mortar-launch']


def decode(path):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(path), '-f', 's16le', '-acodec', 'pcm_s16le', '-ar', str(SR), '-ac', '1', '-'],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768


def measure(samples, sr=SR, low_hz=200):
    x = np.asarray(samples, dtype=float)
    peak = float(np.max(np.abs(x)))
    peak_db = 20 * np.log10(peak + 1e-12)
    w = np.hanning(len(x))
    power = np.abs(np.fft.rfft(x * w)) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    total = power.sum() or 1e-20
    low = float(power[freqs <= low_hz].sum() / total)
    rms_db = 20 * np.log10(float(np.sqrt(np.mean(x * x))) + 1e-12)
    return dict(peak=round(peak, 4), peakDb=round(peak_db, 2), rmsDb=round(rms_db, 2), lowFrac=round(low, 3))


out = {name: measure(decode(SFX / f'{name}.ogg')) for name in NAMES if (SFX / f'{name}.ogg').exists()}
print(json.dumps(out))
