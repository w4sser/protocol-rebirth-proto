#!/usr/bin/env python3
"""Procedurally generate game SFX with a small sfxr-style synth (numpy only,
no TTS/engine dependency) and encode to .ogg with ffmpeg.

sfxr (by Tomas Pettersson) generates retro sound effects from a handful of
parameters: waveform, envelope (attack/sustain/decay), frequency + sweep,
and simple effects (vibrato, arpeggio). This reimplements just enough of
that model to cover our five cues; all output is original/procedural, no
samples or third-party audio involved.

Usage:
  python3 tools/audio/gen-sfx.py

Writes: assets/audio/sfx/{shoot,hit,pickup,alarm,extract}.ogg (mono, 48 kbps)
"""
import os
import subprocess
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "assets", "audio", "sfx")
SR = 22050

# Fixed seed -> fully reproducible output across runs/machines.
SEED = 20261028


def _rng():
    return np.random.default_rng(SEED)


def _envelope(n, attack, sustain, decay):
    a = int(n * attack)
    s = int(n * sustain)
    d = max(n - a - s, 1)
    env = np.concatenate([
        np.linspace(0, 1, max(a, 1), endpoint=False),
        np.ones(s),
        np.linspace(1, 0, d),
    ])
    return env[:n] if len(env) >= n else np.pad(env, (0, n - len(env)))


def _wave(kind, phase):
    if kind == "square":
        return np.sign(np.sin(2 * np.pi * phase))
    if kind == "saw":
        return 2 * (phase % 1.0) - 1
    if kind == "triangle":
        return 2 * np.abs(2 * (phase % 1.0) - 1) - 1
    if kind == "noise":
        return None  # handled by caller
    return np.sin(2 * np.pi * phase)  # sine


def synth(kind, duration, freq_start, freq_end, attack, sustain, decay,
          vibrato_hz=0.0, vibrato_depth=0.0, noise_mix=0.0, rng=None):
    rng = rng or _rng()
    n = int(SR * duration)
    t = np.arange(n) / SR
    freq = np.linspace(freq_start, freq_end, n)
    if vibrato_hz:
        freq = freq * (1.0 + vibrato_depth * np.sin(2 * np.pi * vibrato_hz * t))
    phase = np.cumsum(freq) / SR
    tone = _wave(kind, phase)
    if tone is None:
        tone = rng.uniform(-1, 1, n)
    if noise_mix > 0:
        tone = (1 - noise_mix) * tone + noise_mix * rng.uniform(-1, 1, n)
    env = _envelope(n, attack, sustain, decay)
    out = tone * env
    peak = np.max(np.abs(out)) or 1.0
    # Leave headroom below 0 dBFS: lossy vorbis re-encoding can overshoot the
    # original peak slightly on hard square/noise transients.
    return (out / peak * 0.7).astype(np.float32)


def gen_shoot(rng):
    return synth("square", 0.12, 1400, 180, attack=0.0, sustain=0.05, decay=0.8,
                 noise_mix=0.15, rng=rng)


def gen_hit(rng):
    return synth("noise", 0.09, 1, 1, attack=0.0, sustain=0.1, decay=0.9, rng=rng)


def gen_pickup(rng):
    return synth("triangle", 0.22, 500, 1500, attack=0.05, sustain=0.2, decay=0.75,
                 vibrato_hz=0, rng=rng)


def gen_alarm(rng):
    a = synth("square", 0.5, 700, 900, attack=0.02, sustain=0.5, decay=0.1,
              vibrato_hz=6, vibrato_depth=0.08, rng=rng)
    b = synth("square", 0.5, 900, 700, attack=0.02, sustain=0.5, decay=0.1,
              vibrato_hz=6, vibrato_depth=0.08, rng=rng)
    return np.concatenate([a, b])


def gen_extract(rng):
    return synth("sine", 0.6, 300, 1100, attack=0.1, sustain=0.5, decay=0.35,
                 vibrato_hz=0, noise_mix=0.05, rng=rng)


SFX = {
    "shoot": gen_shoot,
    "hit": gen_hit,
    "pickup": gen_pickup,
    "alarm": gen_alarm,
    "extract": gen_extract,
}


def write_wav(path, samples):
    import wave
    import struct

    pcm = (samples * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(struct.pack("<%dh" % len(pcm), *pcm))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name, fn in SFX.items():
            rng = _rng()  # reset seed per-cue so adding cues doesn't reshuffle others
            samples = fn(rng)
            wav_path = os.path.join(tmp, name + ".wav")
            out_path = os.path.join(OUT_DIR, name + ".ogg")
            write_wav(wav_path, samples)
            print(f"-> {name} ({len(samples) / SR:.2f}s)")
            subprocess.run(
                [
                    "ffmpeg", "-y", "-loglevel", "error",
                    "-i", wav_path,
                    "-ac", "1",
                    "-c:a", "libvorbis", "-b:a", "48k",
                    out_path,
                ],
                check=True,
            )
    print(f"done -> {OUT_DIR}")


if __name__ == "__main__":
    main()
