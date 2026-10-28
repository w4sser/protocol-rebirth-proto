#!/usr/bin/env python3
"""Audition harness: renders 3 DISTINCT candidate BIT-voice treatments for
LOCAL NON-SHIPPING comparison only. Piper Ryan is CC BY-NC-SA 4.0.
Never copy these auditions into shipping assets. NOT the production generator (that's gen-bit-voice.py).

Writes: /workspace/prp-audio/candidates/<variant>/<slug>.ogg + README.txt
(candidates/ is excluded via .git/info/exclude -- never committed).

Variants:
  a) kokoro-deep   - Kokoro bm_lewis (deepest male voice in the kit), small-
                      speaker band-pass, light bitcrush, subtle ring-mod +
                      metallic comb (aecho).
  b) walle         - Kokoro am_echo, heavy ring-mod + formant-ish pitch
                      shift, numpy-generated chirps/beeps bookending and
                      between phrases.
  c) piper-cold    - Piper en_US-ryan-medium (already flat/monotone), crisp
                      narrow radio band, tremolo/robotize, short digital
                      blips (numpy square-wave) at start/end.

Usage:
  TTS_VENV=/workspace/tts-venv tools/audio/gen-bit-voice-candidates.sh
  (or just run this file with the venv's python3 directly)
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CAND_DIR = os.path.join(ROOT, "candidates")

TTS_VENV = os.environ.get("TTS_VENV", "/workspace/tts-venv")
KOKORO_DIR = os.path.join(TTS_VENV, "models", "kokoro")
KOKORO_MODEL = os.path.join(KOKORO_DIR, "kokoro-v1.0.int8.onnx")
KOKORO_VOICES = os.path.join(KOKORO_DIR, "voices-v1.0.bin")
PIPER_MODEL = os.path.join(TTS_VENV, "models", "piper", "en_US-ryan-medium.onnx")

# 3 of the 8 rewritten lines, picked to span the tone range (urgent, dry
# one-liner, warm-under-cynicism).
LINES = {
    "hunters-inbound": "Hunters inbound. Try not to die, I just cleaned you.",
    "scrap-detected": "Scrap detected. Thrilling.",
    "welcome-back": "Welcome back. I kept the lights on.",
}

# loudnorm internally resamples to 192kHz; resample back down afterward or
# libvorbis's encoder setup fails on the inflated rate.
LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=24000"


def kokoro_engine():
    from kokoro_onnx import Kokoro

    return Kokoro(KOKORO_MODEL, KOKORO_VOICES)


def synth_kokoro(engine, text, voice, speed, wav_path):
    samples, sr = engine.create(text, voice=voice, speed=speed, lang="en-us")
    sf.write(wav_path, samples, sr)
    return sr, len(samples) / sr


def synth_piper(text, wav_path):
    subprocess.run(
        ["piper", "--model", PIPER_MODEL, "--output_file", wav_path],
        input=text.encode("utf-8"),
        check=True,
    )
    info = sf.info(wav_path)
    return info.samplerate, info.frames / info.samplerate


def gen_tone_wav(path, sr, freq_start, freq_end, dur, wave="square", vol=0.25):
    """Write a short synth chirp/beep (no sox needed -- plain numpy)."""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = np.linspace(freq_start, freq_end, n)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    if wave == "square":
        sig = np.sign(np.sin(phase))
    else:
        sig = np.sin(phase)
    # quick envelope so the blip doesn't click
    env = np.ones(n)
    a = max(1, int(sr * 0.005))
    env[:a] = np.linspace(0, 1, a)
    env[-a:] = np.linspace(1, 0, a)
    sf.write(path, (sig * env * vol).astype(np.float32), sr)


def gen_carrier_wav(path, sr, freq, dur):
    """Pure sine carrier for ring modulation, exact length match to voice."""
    n = int(sr * dur)
    t = np.arange(n) / sr
    sig = np.sin(2 * np.pi * freq * t)
    sf.write(path, sig.astype(np.float32), sr)


def run_ffmpeg(args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + args, check=True)


def encode_ogg(wav_path, out_path, af_chain, extra_inputs=None, filter_complex=None, b_kbps=56):
    args = ["-i", wav_path]
    if extra_inputs:
        for p in extra_inputs:
            args += ["-i", p]
    if filter_complex:
        args += ["-filter_complex", filter_complex, "-map", "[out]"]
    else:
        args += ["-af", af_chain]
    args += ["-ac", "1", "-c:a", "libvorbis", "-b:a", f"{b_kbps}k", out_path]
    run_ffmpeg(args)


def variant_kokoro_deep(engine, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for slug, text in LINES.items():
            voice_wav = os.path.join(tmp, slug + "_voice.wav")
            sr, dur = synth_kokoro(engine, text, "bm_lewis", 0.97, voice_wav)
            carrier_wav = os.path.join(tmp, slug + "_carrier.wav")
            gen_carrier_wav(carrier_wav, sr, 45, dur)
            out_path = os.path.join(out_dir, slug + ".ogg")
            fc = (
                "[0:a]aresample=24000,highpass=f=300,lowpass=f=3400,"
                "acrusher=bits=8:mode=log:mix=0.35:aa=0.5:samples=2,"
                "aecho=1.0:0.6:8:0.2[dry];"
                "[dry][1:a]amultiply[ring];"
                f"[dry][ring]amix=inputs=2:weights=0.75 0.25:normalize=0,{LOUDNORM}[out]"
            )
            encode_ogg(voice_wav, out_path, None, extra_inputs=[carrier_wav], filter_complex=fc)
            print(f"  [a] {slug}.ogg")


def variant_walle(engine, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for slug, text in LINES.items():
            phrases = [p.strip() for p in text.split(".") if p.strip()]
            phrase_wavs = []
            sr = 24000
            for i, phrase in enumerate(phrases):
                pwav = os.path.join(tmp, f"{slug}_p{i}.wav")
                sr, _ = synth_kokoro(engine, phrase + ".", "am_echo", 1.0, pwav)
                phrase_wavs.append(pwav)

            start_beep = os.path.join(tmp, slug + "_beep0.wav")
            mid_beep = os.path.join(tmp, slug + "_beepm.wav")
            end_beep = os.path.join(tmp, slug + "_beep1.wav")
            gen_tone_wav(start_beep, sr, 900, 1400, 0.09, "square", 0.22)
            gen_tone_wav(mid_beep, sr, 1200, 800, 0.06, "square", 0.18)
            gen_tone_wav(end_beep, sr, 700, 1100, 0.09, "square", 0.22)

            # concat: beep, phrase0, [mid-beep, phrase1, ...], beep
            concat_list = [start_beep]
            for i, pwav in enumerate(phrase_wavs):
                concat_list.append(pwav)
                if i < len(phrase_wavs) - 1:
                    concat_list.append(mid_beep)
            concat_list.append(end_beep)

            concat_wav = os.path.join(tmp, slug + "_concat.wav")
            list_file = os.path.join(tmp, slug + "_list.txt")
            with open(list_file, "w") as f:
                for p in concat_list:
                    f.write(f"file '{p}'\n")
            run_ffmpeg(["-f", "concat", "-safe", "0", "-i", list_file, "-c", "pcm_s16le", concat_wav])

            carrier_wav = os.path.join(tmp, slug + "_carrier.wav")
            dur = sf.info(concat_wav).frames / sf.info(concat_wav).samplerate
            gen_carrier_wav(carrier_wav, sr, 90, dur)

            out_path = os.path.join(out_dir, slug + ".ogg")
            # formant-ish shift: pitch the whole thing up without correcting
            # tempo (asetrate), then heavy ring-mod on top for the Wall-E buzz
            fc = (
                "[0:a]aresample=24000,asetrate=24000*1.18,aresample=24000,"
                "highpass=f=250,lowpass=f=3800[dry];"
                "[dry][1:a]amultiply[ring];"
                f"[dry][ring]amix=inputs=2:weights=0.5 0.5:normalize=0,{LOUDNORM}[out]"
            )
            encode_ogg(concat_wav, out_path, None, extra_inputs=[carrier_wav], filter_complex=fc)
            print(f"  [b] {slug}.ogg")


def variant_piper_cold(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for slug, text in LINES.items():
            voice_wav = os.path.join(tmp, slug + "_voice.wav")
            sr, dur = synth_piper(text, voice_wav)

            start_blip = os.path.join(tmp, slug + "_blip0.wav")
            end_blip = os.path.join(tmp, slug + "_blip1.wav")
            gen_tone_wav(start_blip, sr, 2200, 2600, 0.035, "square", 0.15)
            gen_tone_wav(end_blip, sr, 2600, 2200, 0.035, "square", 0.15)

            concat_wav = os.path.join(tmp, slug + "_concat.wav")
            list_file = os.path.join(tmp, slug + "_list.txt")
            with open(list_file, "w") as f:
                for p in [start_blip, voice_wav, end_blip]:
                    f.write(f"file '{p}'\n")
            run_ffmpeg(["-f", "concat", "-safe", "0", "-i", list_file, "-c", "pcm_s16le", concat_wav])

            out_path = os.path.join(out_dir, slug + ".ogg")
            af = (
                "aresample=22050,"
                "highpass=f=350,lowpass=f=3200,"
                "tremolo=f=9:d=0.4,"
                f"{LOUDNORM}"
            )
            encode_ogg(concat_wav, out_path, af)
            print(f"  [c] {slug}.ogg")


def write_readme(path, text):
    with open(path, "w") as f:
        f.write(text.strip() + "\n")


def main():
    os.makedirs(CAND_DIR, exist_ok=True)
    engine = kokoro_engine()

    print("variant (a) kokoro-deep ...")
    dir_a = os.path.join(CAND_DIR, "a-kokoro-deep")
    variant_kokoro_deep(engine, dir_a)
    write_readme(
        os.path.join(dir_a, "README.txt"),
        "Kokoro bm_lewis (deepest male voice available, ~82Hz f0) + 300-3400Hz "
        "small-speaker band-pass + light acrusher bitcrush + subtle ring-mod "
        "(45Hz carrier, 25% wet) and short aecho metallic comb.",
    )

    print("variant (b) walle ...")
    dir_b = os.path.join(CAND_DIR, "b-walle")
    variant_walle(engine, dir_b)
    write_readme(
        os.path.join(dir_b, "README.txt"),
        "Kokoro am_echo, phrases synthesized separately and bookended/joined "
        "with numpy-generated square-wave chirps, asetrate formant-ish pitch "
        "shift (+18%, uncorrected), heavy 90Hz ring-mod (50% wet).",
    )

    print("variant (c) piper-cold ...")
    dir_c = os.path.join(CAND_DIR, "c-piper-cold")
    variant_piper_cold(dir_c)
    write_readme(
        os.path.join(dir_c, "README.txt"),
        "Piper en_US-ryan-medium (flat/monotone by default) + narrow "
        "350-3200Hz radio band + tremolo robotize (9Hz) + short numpy "
        "square-wave digital blips at start/end.",
    )

    print(f"done -> {CAND_DIR}")


if __name__ == "__main__":
    main()
