#!/usr/bin/env python3
"""Shipping BIT F1 generator: Kokoro am_fenrir only, never an engine fallback.

Run tools/audio/gen-bit-voice.sh. See docs/audio-pipeline.md.
All eight outputs are staged before publishing to assets/audio/bit.
"""
import importlib
import json
import os
from pathlib import Path
import subprocess
import shutil
import tempfile

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parents[1] / "assets/audio/bit"
VENV = Path(os.environ.get("TTS_VENV", "/workspace/tts-venv"))
MODEL = VENV / "models/kokoro/kokoro-v1.0.int8.onnx"
VOICES = VENV / "models/kokoro/voices-v1.0.bin"
LINES = {
    "hunters-inbound": "Hunters inbound. | Wonderful. | Try not to die. | I just cleaned you.",
    "scrap-detected": "Scrap detected. | My circuits are trembling. | With joy.",
    "heal-budget-low": "Heal budget low. | Bleeding is expensive. | Please stop.",
    "extraction-marked": "Extraction marked. | An exit. | Do try using it.",
    "bag-heavy": "Bag heavy. | Excellent. | More scrap than sense. | Come home.",
    "nice-shot": "Nice shot. | Almost competent. | Keep doing that.",
    "signal-lost": "Signal lost. | A moment of peace. | Stay there. | I am coming.",
    "welcome-back": "Welcome back. | Still alive. | Statistically surprising.",
}
F1 = dict(wet=0.15, delay=0.003, comb=0.10)
LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11"


def ffmpeg(*args):
    return subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-y", *map(str, args)],
        check=True, capture_output=True, text=True,
    )


def optional_module(name):
    try:
        return importlib.import_module(name)
    except ImportError:
        return None


def flatten_pitch(audio, sr, world, librosa):
    """Keep 40% of log-F0 deviations from the voiced median (60% flatter)."""
    if world is not None:
        x = np.ascontiguousarray(audio, dtype=np.float64)
        f0, times = world.harvest(x, sr, f0_floor=60, f0_ceil=500)
        voiced = f0 > 0
        if not voiced.any():
            raise RuntimeError("WORLD found no voiced frames")
        envelope = world.cheaptrick(x, f0, times, sr)
        aperiodicity = world.d4c(x, f0, times, sr)
        median = np.median(f0[voiced])
        f0[voiced] = median * (f0[voiced] / median) ** 0.4
        result = world.synthesize(f0, envelope, aperiodicity, sr)
        return np.pad(result[:len(x)], (0, max(0, len(x) - len(result)))).astype(np.float32)
    if librosa is not None:
        # Local pitch shifts with overlapping Hann windows preserve duration.
        hop, size = 256, 2048
        f0, voiced, _ = librosa.pyin(audio, sr=sr, fmin=60, fmax=500, hop_length=hop)
        good = voiced & np.isfinite(f0)
        if not good.any():
            raise RuntimeError("librosa found no voiced frames")
        median = np.median(f0[good])
        shifts = np.zeros(len(f0))
        shifts[good] = -0.6 * 12 * np.log2(f0[good] / median)
        padded = np.pad(audio, (size // 2, size))
        out, weights = np.zeros_like(padded), np.zeros_like(padded)
        window = np.hanning(size)
        for index, shift in enumerate(shifts):
            start = index * hop
            block = padded[start:start + size]
            if len(block) != size:
                break
            shifted = librosa.effects.pitch_shift(block, sr=sr, n_steps=float(shift))
            out[start:start + size] += shifted * window
            weights[start:start + size] += window
        out /= np.maximum(weights, 1e-8)
        return out[size // 2:size // 2 + len(audio)].astype(np.float32)
    return audio


def trim(audio, sr):
    # 10 ms RMS blocks; retain 10 ms around audible speech, then 5 ms fades.
    block = max(1, round(sr * 0.010))
    padded = np.pad(audio, (0, (-len(audio)) % block))
    energy = np.sqrt(np.mean(padded.reshape(-1, block) ** 2, axis=1))
    active = np.flatnonzero(energy > max(0.001, float(energy.max()) * 0.018))
    if not active.size:
        raise RuntimeError("Empty synthesized phrase")
    start = max(0, (active[0] - 1) * block)
    end = min(len(audio), (active[-1] + 2) * block)
    result = audio[start:end].copy()
    fade = min(round(sr * 0.005), len(result) // 2)
    result[:fade] *= np.linspace(0, 1, fade)
    result[-fade:] *= np.linspace(1, 0, fade)
    return result


def robot(audio, sr, config):
    t = np.arange(len(audio)) / sr
    wet = config["wet"]
    result = audio * ((1 - wet) + wet * np.cos(2 * np.pi * 40 * t))
    # A moving short feed-forward delay gives a light comb/flanger, no long echo.
    delay = sr * (config["delay"] + 0.0005 * np.sin(2 * np.pi * 0.25 * t))
    delayed = np.interp(np.arange(len(audio)) - delay, np.arange(len(audio)), result, left=0)
    return ((result + config["comb"] * delayed) / (1 + config["comb"])).astype(np.float32)


def render(audio, sr, slug, tmp):
    variant, config = "F1", F1
    source, processed, mixed = (tmp / f"{variant}-{slug}-{stage}.wav" for stage in ("source", "processed", "mixed"))
    sf.write(source, robot(audio, sr, config), sr, subtype="FLOAT")
    filters = ["aresample=22050:dither_method=0"]
    filters += ["highpass=f=350", "lowpass=f=3200", "tremolo=f=9:d=0.4"]
    filters += ["lowpass=f=3200", "agate=threshold=0.02:ratio=4:attack=3:release=80:range=0.05"]
    ffmpeg("-i", source, "-af", ",".join(filters), "-c:a", "pcm_f32le", processed)
    voice, rate = sf.read(processed, dtype="float32")
    nfade = round(rate * 0.005)
    voice[:nfade] *= np.linspace(0, 1, nfade)
    voice[-nfade:] *= np.linspace(1, 0, nfade)
    # Append AFTER gating/effects so their nonlinear gain cannot boost the blip.
    # -40 dB relative to voice RMS leaves margin for the final 3.3 kHz lowpass.
    rms = float(np.sqrt(np.mean(voice ** 2)))
    n = round(rate * 0.09)
    frequencies = np.linspace(560, 380, n)
    blip = np.sin(2 * np.pi * np.cumsum(frequencies) / rate)
    blip *= np.hanning(n)
    blip *= rms * 10 ** (-40 / 20) / np.sqrt(np.mean(blip ** 2))
    blip_raw, blip_filtered = tmp / "blip-raw.wav", tmp / "blip-filtered.wav"
    sf.write(blip_raw, blip, rate, subtype="FLOAT")
    ffmpeg("-i", blip_raw, "-af", "lowpass=f=1600", "-c:a", "pcm_f32le", blip_filtered)
    blip, _ = sf.read(blip_filtered, dtype="float32")
    data = np.concatenate([np.zeros(round(rate * 0.025)), voice, np.zeros(round(rate * 0.020)), blip])
    sf.write(mixed, data, rate, subtype="FLOAT")
    # Two-pass loudnorm, followed by the requested final lowpass and tail fade.
    analysis = ffmpeg("-i", mixed, "-af", LOUDNORM + ":print_format=json", "-f", "null", "-")
    stats, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind("{"):])
    # Short clips force loudnorm's linear path, which can undershoot severely
    # when a few peaks use all the headroom. Limit those peaks before measuring
    # the final normalization pass; preserve the speech/blip relative gain.
    leveled = mixed
    for iteration in range(4):
        previous = leveled
        leveled = tmp / f"{variant}-{slug}-leveled-{iteration}.wav"
        gain = -15.5 - float(stats["input_i"])
        ffmpeg("-i", previous, "-af", f"volume={gain:.5f}dB,alimiter=limit=0.65:level=false:latency=true",
               "-c:a", "pcm_f32le", leveled)
        analysis = ffmpeg("-i", leveled, "-af", LOUDNORM + ":print_format=json", "-f", "null", "-")
        stats, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind("{"):])
        if float(stats["input_i"]) >= -15.8:
            break
    # Remove HF harmonics introduced by peak limiting before normalization.
    filtered = tmp / f"{variant}-{slug}-filtered.wav"
    ffmpeg("-i", leveled, "-af", ",".join(["lowpass=f=3300"] * 4), "-c:a", "pcm_f32le", filtered)
    leveled = filtered
    analysis = ffmpeg("-i", leveled, "-af", LOUDNORM + ":print_format=json", "-f", "null", "-")
    stats, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind("{"):])
    norm = LOUDNORM + ":linear=true:" + ":".join(
        f"{key}={stats[value]}" for key, value in (
            ("measured_I", "input_i"), ("measured_TP", "input_tp"),
            ("measured_LRA", "input_lra"), ("measured_thresh", "input_thresh"),
            ("offset", "target_offset"),
        )
    )
    destination = tmp / f"{slug}.ogg"
    ffmpeg("-i", leveled, "-af", norm + ",lowpass=f=3300,areverse,afade=t=in:d=0.015,areverse",
           "-ar", "24000", "-ac", "1", "-c:a", "libvorbis", "-q:a", "5", destination)
    print(destination.name, flush=True)
    return destination


def main():
    # Validate imports, models and engine before creating any asset directory.
    if not MODEL.is_file() or not VOICES.is_file():
        raise RuntimeError(f"Kokoro model/voices missing under {MODEL.parent}; refusing to write assets")
    from kokoro_onnx import Kokoro
    engine = Kokoro(str(MODEL), str(VOICES))
    world, librosa = optional_module("pyworld"), optional_module("librosa")
    backend = "pyworld" if world else "librosa" if librosa else None
    print(f"Pitch flattening: {backend or 'SKIPPED (neither pyworld nor librosa is importable)'}", flush=True)
    with tempfile.TemporaryDirectory(prefix="bit-f1-") as directory:
        tmp = Path(directory)
        staged = []
        for slug, text in LINES.items():
            print(f"{slug}: {text}", flush=True)
            parts, sr = [], None
            for phrase in text.split("|"):
                samples, phrase_sr = engine.create(phrase.strip(), voice="am_fenrir", speed=0.9, lang="en-us")
                if sr is not None and sr != phrase_sr:
                    raise RuntimeError("Inconsistent sample rates")
                sr = phrase_sr
                phrase_audio = trim(np.asarray(samples, dtype=np.float32), sr)
                phrase_audio = trim(flatten_pitch(phrase_audio, sr, world, librosa), sr)
                if parts:
                    parts.append(np.zeros(round(sr * 0.150), dtype=np.float32))
                parts.append(phrase_audio)
            audio = np.concatenate(parts)
            staged.append(render(audio, sr, slug, tmp))
        # No production assets change unless all eight syntheses/encodes succeed.
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        for output in staged:
            shutil.copyfile(output, OUT_DIR / output.name)
    print("Done: 8 files; speed 0.9; phrase gaps 150 ms; loudnorm -16 LUFS.", flush=True)


if __name__ == "__main__":
    main()
