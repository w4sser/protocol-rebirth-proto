#!/usr/bin/env python3
"""Peak dBFS and low-band energy for shipping powder shots and the mortar boom."""
import importlib.util, json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('gensfx', ROOT / 'tools/audio/gen-sfx.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
SR = m.SR

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

out = {name: measure(m.cue(name)) for name in
       ['shoot-carbine', 'shoot-smg', 'shoot-shotgun', 'shoot-rifle', 'shoot-air', 'explosion']}
print(json.dumps(out))
