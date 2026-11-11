#!/usr/bin/env python3
"""Shipping BIT F1 generator: Kokoro am_fenrir only, never an engine fallback.

Run tools/audio/gen-bit-voice.sh. See docs/audio-pipeline.md.
Outputs are staged before publishing to assets/audio/bit.
Pass --only SLUG (or BIT_VOICE_ONLY) to render just that line without touching the others.
"""
import argparse
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
    "youre-back": "You're back! | You're late, but you're back!",
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


def selected_lines():
    parser = argparse.ArgumentParser(description="Render shipping BIT F1 voice lines.")
    parser.add_argument("--only", metavar="SLUG", help="Render only this slug; leave every other clip untouched.")
    args, _unknown = parser.parse_known_args()
    only = args.only or os.environ.get("BIT_VOICE_ONLY")
    if not only:
        return dict(LINES)
    if only not in LINES:
        raise SystemExit(f"unknown BIT voice slug: {only}")
    return {only: LINES[only]}


def encode_m4a(ogg_path):
    """AAC fallback matching gen-sfx.py's BIT copies (32 kbps, 22050 Hz)."""
    dest = ogg_path.with_suffix(".m4a")
    ffmpeg("-i", ogg_path, "-ac", "1", "-ar", "22050", "-c:a", "aac", "-b:a", "32k",
           "-movflags", "+faststart", dest)
    return dest


# --- youre-back greeting recipe --------------------------------------------
# Special VO performance for the homecoming greeting, approved take A with the
# phrase-1 /k/ fix. Only this slug uses the pipeline below; the other eight
# lines keep the speed-0.9/150ms-gap pipeline above untouched. See
# docs/audio-pipeline.md.

YOURE_BACK_VOICE = "am_fenrir"
YOURE_BACK_PHRASES = [
    {
        "text": "You're... back?",
        "synth_text": "You're... back? Home.",
        "dummy_release": True,
        "keep_release": True,
        "speed": 0.72,
        "rise_st": 5.0,
        "rise_tail_s": 0.34,
    },
    {"text": "You're late...", "speed": 0.73, "gain_db": -2.0},
    {
        "text": "But you're back.",
        "synth_text": "But you're back. Home.",
        "dummy_release": True,
        "keep_release": True,
        "speed": 0.79,
    },
]
YOURE_BACK_PAUSES_MS = [600, 350]
YOURE_BACK_PRE_S = 0.100
YOURE_BACK_TAIL_S = 0.250
YOURE_BACK_FADE_S = 0.050
YOURE_BACK_END_PAD_S = 0.500
YOURE_BACK_UNGATED_TAIL_S = 0.400
YOURE_BACK_GATE = "agate=threshold=0.02:ratio=4:attack=8:release=250:range=0.30"


def _speech_bounds(audio, sr, rel=0.008, floor=0.00035):
    block = max(1, round(sr * 0.010))
    padded = np.pad(audio, (0, (-len(audio)) % block))
    energy = np.sqrt(np.mean(padded.reshape(-1, block) ** 2, axis=1))
    thresh = max(floor, float(energy.max()) * rel)
    active = np.flatnonzero(energy > thresh)
    if not active.size:
        raise RuntimeError("Empty synthesized phrase")
    start = active[0] * block
    end = min(len(audio), (active[-1] + 1) * block)
    return start, end


def _band_rms(x, sr, lo=2000.0, hi=4000.0):
    x = np.asarray(x, dtype=np.float64)
    if x.size < 32:
        return 0.0
    spec = np.fft.rfft(x * np.hanning(len(x)))
    freqs = np.fft.rfftfreq(len(x), 1.0 / sr)
    mask = (freqs >= lo) & (freqs <= hi)
    if not np.any(mask):
        return 0.0
    return float(np.sqrt(np.mean(np.abs(spec[mask]) ** 2)) / len(x))


def _hop_features(audio, sr, win=0.015, hop=0.005):
    n = max(8, int(sr * win))
    h = max(1, int(sr * hop))
    times, rms_v, hf_v = [], [], []
    x = np.asarray(audio, dtype=np.float64)
    for i in range(0, max(1, len(x) - n), h):
        seg = x[i:i + n]
        times.append((i + n / 2) / sr)
        rms_v.append(float(np.sqrt(np.mean(seg ** 2))))
        hf_v.append(_band_rms(seg, sr))
    return np.asarray(times), np.asarray(rms_v), np.asarray(hf_v)


def _estimate_f0(audio, sr, fmin=80.0, fmax=320.0, frame_ms=30.0, hop_ms=10.0):
    x = np.asarray(audio, dtype=np.float64)
    if not x.size:
        return np.array([]), np.array([])
    x = x - np.mean(x)
    frame = max(16, int(sr * frame_ms / 1000))
    hop = max(1, int(sr * hop_ms / 1000))
    window = np.hanning(frame)
    min_lag = max(1, int(sr / fmax))
    max_lag = min(int(sr / fmin), frame - 2)
    times, f0s = [], []
    for start in range(0, max(1, len(x) - frame), hop):
        seg = x[start:start + frame] * window
        if len(seg) < frame:
            break
        energy = float(np.dot(seg, seg))
        t = (start + frame / 2) / sr
        if energy < 1e-10:
            times.append(t); f0s.append(0.0); continue
        corr = np.correlate(seg, seg, mode="full")[frame - 1:]
        region = corr[min_lag:max_lag + 1]
        peak_i = int(np.argmax(region))
        peak = float(region[peak_i])
        lag = min_lag + peak_i
        if corr[0] <= 1e-12 or peak / corr[0] < 0.45:
            times.append(t); f0s.append(0.0); continue
        if 0 < peak_i < len(region) - 1:
            a, b, c = (float(region[peak_i + k]) for k in (-1, 0, 1))
            denom = a - 2 * b + c
            if abs(denom) > 1e-12:
                lag = lag + 0.5 * (a - c) / denom
        freq = sr / lag if lag > 0 else 0.0
        if freq >= fmax * 0.98:
            freq = 0.0
        times.append(t)
        f0s.append(freq)
    return np.asarray(times), np.asarray(f0s)


def _stabilize_f0(f0):
    out = f0.copy()
    voiced_idx = np.flatnonzero(f0 > 0)
    if voiced_idx.size < 3:
        return out
    med = float(np.median(f0[voiced_idx]))
    for i in voiced_idx:
        val = out[i]
        if val <= 0 or med <= 0:
            continue
        ratio = val / med
        if ratio > 1.85:
            out[i] = val / 2
        elif ratio < 0.55:
            out[i] = val * 2
        if 0.7 < (out[i] / med) < 1.4:
            med = 0.85 * med + 0.15 * out[i]
    return out


def _voiced_runs(audio, sr):
    times, f0 = _estimate_f0(audio, sr)
    f0 = _stabilize_f0(f0)
    voiced = np.flatnonzero(f0 > 0)
    if voiced.size == 0:
        return times, f0, []
    runs, cur = [], [int(voiced[0])]
    for idx in voiced[1:]:
        if times[idx] - times[cur[-1]] <= 0.03:
            cur.append(int(idx))
        else:
            runs.append(cur)
            cur = [int(idx)]
    runs.append(cur)
    return times, f0, runs


def _merged_voiced_span(audio, sr, max_gap=0.55, min_frames=4):
    times, f0, runs = _voiced_runs(audio, sr)
    if not runs:
        return times, f0, np.array([]), np.array([])
    subst = [run for run in runs if len(run) >= min_frames] or [max(runs, key=len)]
    chosen = [subst[0]]
    end_t = float(times[subst[0][-1]])
    for run in subst[1:]:
        if float(times[run[0]]) - end_t <= max_gap:
            chosen.append(run)
            end_t = float(times[run[-1]])
        else:
            break
    idx = np.array([i for run in chosen for i in run], dtype=int)
    return times, f0, times[idx], f0[idx]


def _cut_after_stop_release(audio, sr, after_peak_s=0.085, pre_dummy_s=0.055):
    """Keep through the /k/ burst of '...back. Home.' and drop the dummy word."""
    times, _f0, runs = _voiced_runs(audio, sr)
    subst = [run for run in runs if len(run) >= 4]
    if len(subst) < 2:
        return None
    dummy_start = float(times[subst[-1][0]])
    prev_end = float(times[subst[-2][-1]])
    gap = dummy_start - prev_end
    if gap < 0.12:
        return None
    t, rms_v, hf_v = _hop_features(audio, sr)
    vowel_mask = (t >= prev_end - 0.04) & (t <= prev_end + 0.04)
    vowel_rms = float(np.max(rms_v[vowel_mask])) if np.any(vowel_mask) else float(np.max(rms_v))
    dip_thresh = max(0.008, 0.08 * vowel_rms)
    mid = (t >= prev_end) & (t <= dummy_start)
    if not np.any(mid):
        return None
    local_t, local_rms, local_hf = t[mid], rms_v[mid], hf_v[mid]
    dip = np.flatnonzero(local_rms < dip_thresh)
    if dip.size:
        dip_t = float(local_t[dip[0]])
        after = local_t >= dip_t
        peak_i = int(np.flatnonzero(after)[int(np.argmax(local_hf[after]))])
    else:
        later = local_t >= (prev_end + 0.35 * gap)
        if not np.any(later):
            return None
        peak_i = int(np.flatnonzero(later)[int(np.argmax(local_hf[later]))])
    peak_t = float(local_t[peak_i])
    cut_t = min(peak_t + after_peak_s, dummy_start - pre_dummy_s)
    cut_t = max(cut_t, peak_t + 0.060)
    cut = max(1, min(len(audio), int(round(cut_t * sr))))
    return np.asarray(audio[:cut], dtype=np.float32)


def _extend_through_release(audio, sr, voiced_end):
    """Include vowel decay and a nearby unvoiced burst, not leftover syllables."""
    e_start, e_end = _speech_bounds(audio, sr)
    cap = voiced_end + round(sr * 0.380)
    if e_end <= voiced_end + round(sr * 0.020):
        return min(len(audio), voiced_end + round(sr * 0.120))
    if e_end <= cap:
        return e_end
    block = max(1, round(sr * 0.010))
    region = audio[voiced_end:min(len(audio), cap)]
    padded = np.pad(region, (0, (-len(region)) % block))
    energy = np.sqrt(np.mean(padded.reshape(-1, block) ** 2, axis=1))
    thresh = max(0.00035, float(np.max(np.abs(audio))) * 0.008)
    active = np.flatnonzero(energy > thresh)
    if not active.size:
        return min(len(audio), voiced_end + round(sr * 0.120))
    return min(len(audio), voiced_end + (int(active[-1]) + 1) * block)


def _enforce_pre_tail(audio, sr, pre_s, tail_s, fade_s, keep_release=False):
    e_start, e_end = _speech_bounds(audio, sr)
    _, _, vt, _ = _merged_voiced_span(audio, sr)
    consonant = round(sr * (0.120 if keep_release else 0.070))
    if vt.size:
        v_start = max(0, int(round(float(vt[0]) * sr)) - round(sr * 0.020))
        v_end = min(len(audio), int(round(float(vt[-1]) * sr)) + consonant)
        start = min(e_start, v_start)
        if keep_release:
            end = _extend_through_release(audio, sr, int(round(float(vt[-1]) * sr)))
            end = max(end, v_end)
        else:
            # Do not stretch end out to a distant energy island (question leftover).
            end = v_end if e_end > v_end + round(sr * 0.050) else max(v_end, e_end)
    else:
        start, end = e_start, e_end
    speech = np.asarray(audio[start:end], dtype=np.float32)
    pre_n, tail_n, fade_n = round(sr * pre_s), round(sr * tail_s), round(sr * fade_s)
    have_pre = np.asarray(audio[max(0, start - pre_n):start], dtype=np.float32)
    if len(have_pre) < pre_n:
        have_pre = np.concatenate([np.zeros(pre_n - len(have_pre), dtype=np.float32), have_pre])
    tail = np.zeros(tail_n, dtype=np.float32)
    result = np.concatenate([have_pre[:pre_n], speech, tail])
    fade_n = min(fade_n, pre_n, tail_n, len(result) // 4)
    if fade_n > 1:
        result[:fade_n] *= np.linspace(0.0, 1.0, fade_n, dtype=np.float32)
        result[-fade_n:] *= np.linspace(1.0, 0.0, fade_n, dtype=np.float32)
    return result.astype(np.float32)


def _rising_tail(audio, sr, tail_s, end_st):
    """Question-rise the vowel only; the closure/burst after voiced end is untouched."""
    x = np.asarray(audio, dtype=np.float32)
    if end_st <= 0 or tail_s <= 0:
        return x
    _, _, vt, _ = _merged_voiced_span(x, sr)
    if vt.size == 0:
        return x
    voiced_end = min(len(x), int(round(float(vt[-1]) * sr)))
    n_tail = min(voiced_end - 1, int(round(sr * tail_s)))
    if n_tail < int(sr * 0.08):
        return x
    head, tail, after = x[:voiced_end - n_tail], x[voiced_end - n_tail:voiced_end], x[voiced_end:]
    n = len(tail)
    out = []
    pos = 0.0
    while pos < n - 1:
        frac = min(1.0, pos / max(1, n - 1))
        rate = 2 ** ((frac * end_st) / 12)
        i0 = int(pos)
        i1 = min(i0 + 1, n - 1)
        f = pos - i0
        out.append(tail[i0] * (1.0 - f) + tail[i1] * f)
        pos += rate
    new_tail = np.asarray(out, dtype=np.float32)
    fade = min(int(sr * 0.008), len(head) // 2, len(new_tail) // 2)
    if fade:
        ramp = np.linspace(1.0, 0.0, fade, dtype=np.float32)
        joint = head[-fade:] * ramp + new_tail[:fade] * (1.0 - ramp)
        body = np.concatenate([head[:-fade], joint, new_tail[fade:]])
    else:
        body = np.concatenate([head, new_tail])
    return np.concatenate([body, after]) if len(after) else body


def _apply_gain(audio, gain_db):
    if abs(gain_db) < 1e-6:
        return audio
    return (audio * (10 ** (gain_db / 20))).astype(np.float32)


def _perceived_gap(prev, nxt, sr, pause_s):
    _, prev_end = _speech_bounds(prev, sr)
    next_start, _ = _speech_bounds(nxt, sr)
    already = (len(prev) - prev_end) + next_start
    need = round(sr * pause_s) - already
    return np.zeros(max(0, need), dtype=np.float32)


def _synthesize_raw(engine, text, voice, speed, attempts=8,
                     min_raw=0.70, max_raw=2.80, min_speech=0.45, max_speech=1.60):
    """Kokoro's default trim=True is unstable and can swallow endings; disable it."""
    for _ in range(attempts):
        samples, sr = engine.create(text, voice=voice, speed=speed, lang="en-us", trim=False)
        audio = np.asarray(samples, dtype=np.float32)
        raw = len(audio) / sr
        try:
            start, end = _speech_bounds(audio, sr)
        except RuntimeError:
            continue
        speech = (end - start) / sr
        if min_raw <= raw <= max_raw and min_speech <= speech <= max_speech:
            return audio, sr
    raise RuntimeError(f"No stable Kokoro synthesis for {text!r} at speed {speed}")


def _prepare_youre_back_phrase(engine, phrase, voice, sr_expected, tmp, tag):
    text = phrase.get("synth_text", phrase["text"]).strip()
    speed = float(phrase["speed"])
    audio, sr = None, None
    if phrase.get("dummy_release"):
        for _ in range(8):
            cand, cand_sr = _synthesize_raw(
                engine, text, voice, speed,
                min_raw=1.4, max_raw=2.7, min_speech=0.90, max_speech=1.70,
            )
            cut = _cut_after_stop_release(cand, cand_sr)
            if cut is None:
                continue
            start, end = _speech_bounds(cut, cand_sr)
            speech = (end - start) / cand_sr
            if 0.68 <= speech <= 1.05:
                audio, sr = cut, cand_sr
                break
        if audio is None:
            # Fallback: trailing dots to force a release, then energy end.
            audio, sr = _synthesize_raw(
                engine, phrase["text"].rstrip(".!?") + "...", voice, speed,
                min_raw=0.9, max_raw=2.4, min_speech=0.70, max_speech=1.30,
            )
    else:
        audio, sr = _synthesize_raw(engine, text, voice, speed)
    if sr_expected is not None and sr != sr_expected:
        raise RuntimeError(f"Inconsistent sample rates: {sr} vs {sr_expected}")
    keep_release = bool(phrase.get("keep_release") or phrase.get("dummy_release"))
    audio = _enforce_pre_tail(audio, sr, pre_s=0.080, tail_s=0.080, fade_s=0.015, keep_release=keep_release)
    rise_st = float(phrase.get("rise_st", 0.0))
    rise_tail_s = float(phrase.get("rise_tail_s", 0.0))
    if rise_st:
        audio = _rising_tail(audio, sr, rise_tail_s, rise_st)
    gain_db = float(phrase.get("gain_db", 0.0))
    if gain_db:
        audio = _apply_gain(audio, gain_db)
    audio = _enforce_pre_tail(
        audio, sr, pre_s=YOURE_BACK_PRE_S, tail_s=YOURE_BACK_TAIL_S,
        fade_s=YOURE_BACK_FADE_S, keep_release=keep_release,
    )
    return audio, sr


def _render_youre_back_f1(audio, sr, tmp, phrase_ends):
    """F1 colour with a relaxed gate and the final releases copied back ungated."""
    source = tmp / "youre-back-f1-source.wav"
    filtered = tmp / "youre-back-f1-filtered.wav"
    gated = tmp / "youre-back-f1-gated.wav"
    mixed = tmp / "youre-back-f1-mixed.wav"
    sf.write(source, robot(audio, sr, F1), sr, subtype="FLOAT")
    filters = [
        "aresample=22050:dither_method=0",
        "highpass=f=350", "lowpass=f=3200",
        "tremolo=f=9:d=0.4", "lowpass=f=3200",
    ]
    ffmpeg("-i", source, "-af", ",".join(filters), "-c:a", "pcm_f32le", filtered)
    ffmpeg("-i", filtered, "-af", YOURE_BACK_GATE, "-c:a", "pcm_f32le", gated)
    voice_g, rate = sf.read(gated, dtype="float32")
    voice_u, rate_u = sf.read(filtered, dtype="float32")
    if rate != rate_u:
        raise RuntimeError("gated/ungated sample-rate mismatch")
    n = min(len(voice_g), len(voice_u))
    voice_g, voice_u = voice_g[:n], voice_u[:n]
    _, speech_end = _speech_bounds(voice_u, rate)
    voice = voice_g.copy()
    scale = rate / sr
    ends = [int(round(e * scale)) for e in phrase_ends] + [speech_end]
    for end_i in ends:
        end_i = max(0, min(n, end_i))
        protect_start = max(0, end_i - round(rate * YOURE_BACK_UNGATED_TAIL_S))
        protect_end = min(n, end_i + round(rate * 0.040))
        voice[protect_start:protect_end] = voice_u[protect_start:protect_end]
    nfade = round(rate * YOURE_BACK_FADE_S)
    nfade = min(nfade, len(voice) // 6)
    voice[:nfade] *= np.linspace(0.0, 1.0, nfade, dtype=np.float32)
    # Do not fade the last word -- the trailing zeros of the phrase tail take this fade.
    voice[-nfade:] *= np.linspace(1.0, 0.0, nfade, dtype=np.float32)
    rms_v = float(np.sqrt(np.mean(voice ** 2)))
    n_blip = round(rate * 0.09)
    frequencies = np.linspace(560, 380, n_blip)
    blip = np.sin(2 * np.pi * np.cumsum(frequencies) / rate)
    blip *= np.hanning(n_blip)
    blip *= rms_v * 10 ** (-40 / 20) / np.sqrt(np.mean(blip ** 2))
    blip_raw, blip_filtered = tmp / "youre-back-blip-raw.wav", tmp / "youre-back-blip-filtered.wav"
    sf.write(blip_raw, blip.astype(np.float32), rate, subtype="FLOAT")
    ffmpeg("-i", blip_raw, "-af", "lowpass=f=1600", "-c:a", "pcm_f32le", blip_filtered)
    blip, _ = sf.read(blip_filtered, dtype="float32")
    data = np.concatenate([
        np.zeros(round(rate * 0.025), dtype=np.float32),
        voice,
        np.zeros(round(rate * 0.020), dtype=np.float32),
        blip.astype(np.float32),
        np.zeros(round(rate * YOURE_BACK_END_PAD_S), dtype=np.float32),
    ])
    sf.write(mixed, data, rate, subtype="FLOAT")
    analysis = ffmpeg("-i", mixed, "-af", LOUDNORM + ":print_format=json", "-f", "null", "-")
    stats, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind("{"):])
    leveled = mixed
    for iteration in range(4):
        previous = leveled
        leveled = tmp / f"youre-back-f1-leveled-{iteration}.wav"
        gain = -15.5 - float(stats["input_i"])
        ffmpeg("-i", previous, "-af", f"volume={gain:.5f}dB,alimiter=limit=0.65:level=false:latency=true",
               "-c:a", "pcm_f32le", leveled)
        analysis = ffmpeg("-i", leveled, "-af", LOUDNORM + ":print_format=json", "-f", "null", "-")
        stats, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind("{"):])
        if float(stats["input_i"]) >= -15.8:
            break
    filtered2 = tmp / "youre-back-f1-lp.wav"
    ffmpeg("-i", leveled, "-af", ",".join(["lowpass=f=3300"] * 4), "-c:a", "pcm_f32le", filtered2)
    analysis = ffmpeg("-i", filtered2, "-af", LOUDNORM + ":print_format=json", "-f", "null", "-")
    stats, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind("{"):])
    norm = LOUDNORM + ":linear=true:" + ":".join(
        f"{key}={stats[value]}" for key, value in (
            ("measured_I", "input_i"), ("measured_TP", "input_tp"),
            ("measured_LRA", "input_lra"), ("measured_thresh", "input_thresh"),
            ("offset", "target_offset"),
        )
    )
    wav_tmp = tmp / "youre-back-master.wav"
    ogg = tmp / "youre-back.ogg"
    # 50 ms tail fade sits inside the 500 ms end pad, not on the last word.
    ffmpeg(
        "-i", filtered2, "-af",
        norm + ",lowpass=f=3300,areverse,afade=t=in:d=0.050,areverse",
        "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav_tmp,
    )
    ffmpeg("-i", wav_tmp, "-ar", "24000", "-ac", "1", "-c:a", "libvorbis", "-q:a", "5", ogg)
    return ogg


def render_youre_back(engine, tmp):
    """Render the homecoming greeting: three performed phrases, not the |-split LINES text."""
    sr = None
    prepared = []
    for index, phrase in enumerate(YOURE_BACK_PHRASES):
        audio, sr = _prepare_youre_back_phrase(engine, phrase, YOURE_BACK_VOICE, sr, tmp, f"youre-back-p{index}")
        prepared.append(audio)
    parts = [prepared[0]]
    phrase_ends = []
    cursor = 0
    _start0, end0 = _speech_bounds(prepared[0], sr)
    phrase_ends.append(cursor + end0)
    cursor += len(prepared[0])
    for index in range(1, len(prepared)):
        gap = _perceived_gap(prepared[index - 1], prepared[index], sr, YOURE_BACK_PAUSES_MS[index - 1] / 1000.0)
        parts.append(gap)
        cursor += len(gap)
        _start_i, end_i = _speech_bounds(prepared[index], sr)
        phrase_ends.append(cursor + end_i)
        parts.append(prepared[index])
        cursor += len(prepared[index])
    joined = np.concatenate(parts)
    ogg = _render_youre_back_f1(joined, sr, tmp, phrase_ends)
    print(ogg.name, flush=True)
    return ogg


def main():
    lines = selected_lines()
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
        for slug, text in lines.items():
            if slug == "youre-back":
                print(f"{slug}: homecoming greeting recipe (speeds 0.72/0.73/0.79, pauses 600/350 ms)", flush=True)
                staged.append(render_youre_back(engine, tmp))
                continue
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
        # No production assets change unless every requested synthesis/encode succeeds.
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        published = []
        for output in staged:
            dest = OUT_DIR / output.name
            shutil.copyfile(output, dest)
            published.append(dest)
            published.append(encode_m4a(dest))
    other_count = len(lines) - (1 if "youre-back" in lines else 0)
    notes = []
    if other_count:
        notes.append(f"{other_count} line(s) at speed 0.9, 150 ms phrase gaps")
    if "youre-back" in lines:
        notes.append("youre-back via the special greeting recipe")
    print(f"Done: {'; '.join(notes)}; loudnorm -16 LUFS.", flush=True)
    for path in published:
        print(path, flush=True)


if __name__ == "__main__":
    main()
