#!/usr/bin/env python3
"""Generate BIT's short voice lines with a local TTS engine, then run them
through a small-robot filter chain and bookend them with short synth
chirps, into small mono .ogg files.

Engine: Kokoro (kokoro-onnx) ONLY, CPU-only, run from a venv at $TTS_VENV
(defaults to /workspace/tts-venv; see docs/audio-pipeline.md for install
steps). Kokoro's model weights and voices are Apache-2.0 (commercially
usable); this script does not fall back to any other engine for
production output, since Piper's candidate voice is non-commercial
(CC BY-NC-SA 4.0) and must never land in assets/audio/bit. If the Kokoro
model files or the kokoro_onnx import are unavailable, this script exits
with an error before touching assets/audio/bit.

This is the shipped/default treatment, chosen after auditioning 3 distinct
candidates (see docs/audio-pipeline.md "BIT voice: candidates audition" and
tools/audio/gen-bit-voice-candidates.py). It combines candidate (a)'s deep,
intelligible voice + light robot processing with candidate (b)'s Wall-E-ish
chirp bookends, dropping (b)'s heavy ring-mod because it hurt intelligibility
for lines that need to be understood at a glance mid-raid.

Usage:
  tools/audio/gen-bit-voice.sh                  # uses $TTS_VENV or the default
  TTS_VENV=/path/to/venv tools/audio/gen-bit-voice.sh

Writes: assets/audio/bit/<slug>.ogg (mono, ~56 kbps vorbis)
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "assets", "audio", "bit")

TTS_VENV = os.environ.get("TTS_VENV", "/workspace/tts-venv")
KOKORO_DIR = os.path.join(TTS_VENV, "models", "kokoro")
KOKORO_MODEL = os.path.join(KOKORO_DIR, "kokoro-v1.0.int8.onnx")
KOKORO_VOICES = os.path.join(KOKORO_DIR, "voices-v1.0.bin")
VOICE = "bm_lewis"  # deepest male voice in the kit -> cold/cynical, not soft
SPEED = 0.97  # slightly slower -> deadpan, unhurried delivery

# (output slug, line) -- dry, cynical-with-care BIT lines
LINES = [
    ("hunters-inbound", "Hunters inbound. Try not to die, I just cleaned you."),
    ("scrap-detected", "Scrap detected. Thrilling."),
    ("heal-budget-low", "Heal budget low. Please stop bleeding."),
    ("extraction-marked", "Extraction marked. You're welcome."),
    ("bag-heavy", "Bag's heavy. So is my disappointment."),
    ("nice-shot", "Nice shot. Statistically inevitable."),
    ("signal-lost", "Signal lost... rebooting. Miss me?"),
    ("welcome-back", "Welcome back. I kept the lights on."),
]

# Small-robot filter chain applied to the voice only (not the bookend
# chirps, which stay clean/digital for contrast):
#   aresample       - normalize input to 24 kHz (Kokoro's native rate)
#   highpass/lowpass - small-speaker band (300-3400 Hz), strips rumble/air
#   acrusher        - light bitcrush, digital grit without mangling words
#   amultiply       - subtle ring-mod against a 45 Hz sine carrier (metallic edge)
#   aecho           - short/tight -> metallic comb resonance
VOICE_FILTER = (
    "aresample=24000,"
    "highpass=f=300,lowpass=f=3400,"
    "acrusher=bits=8:mode=log:mix=0.35:aa=0.5:samples=2,"
    "aecho=1.0:0.6:8:0.2"
)
RING_MIX = "amix=inputs=2:weights=0.75 0.25:normalize=0"
RING_CARRIER_HZ = 45

# loudnorm resamples to 192kHz internally; resample back down after or
# libvorbis's encoder setup fails on the inflated rate.
LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=24000"


def synth_kokoro(text, wav_path):
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(KOKORO_MODEL, KOKORO_VOICES)
    samples, sr = kokoro.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    sf.write(wav_path, samples, sr)


def check_kokoro_available():
    """Verify Kokoro is usable before writing anything to assets/audio/bit.

    This is production output: Kokoro is the only cleared (Apache-2.0)
    engine, so we fail fast here rather than silently falling back to an
    uncleared model (e.g. Piper's non-commercial candidate voice).
    """
    if not (os.path.exists(KOKORO_MODEL) and os.path.exists(KOKORO_VOICES)):
        print(
            f"error: Kokoro model files not found under {KOKORO_DIR}\n"
            "See docs/audio-pipeline.md for install steps. Refusing to generate "
            "with any other engine for production output in assets/audio/bit.",
            file=sys.stderr,
        )
        sys.exit(1)
    try:
        import kokoro_onnx  # noqa: F401
    except ImportError as exc:
        print(
            f"error: kokoro_onnx import failed ({exc}).\n"
            "See docs/audio-pipeline.md for install steps. Refusing to generate "
            "with any other engine for production output in assets/audio/bit.",
            file=sys.stderr,
        )
        sys.exit(1)


def gen_chirp_wav(path, sr, freq_start, freq_end, dur, vol=0.18):
    """Short clean square-wave chirp (Wall-E-ish bookend blip). No sox needed."""
    n = int(sr * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    freq = np.linspace(freq_start, freq_end, n)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    sig = np.sign(np.sin(phase))
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


def main():
    check_kokoro_available()
    os.makedirs(OUT_DIR, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for slug, text in LINES:
            print(f"-> {slug}: \"{text}\"")
            raw_wav = os.path.join(tmp, slug + "_raw.wav")
            synth_kokoro(text, raw_wav)
            sr = sf.info(raw_wav).samplerate
            dur = sf.info(raw_wav).frames / sr

            carrier_wav = os.path.join(tmp, slug + "_carrier.wav")
            gen_carrier_wav(carrier_wav, sr, RING_CARRIER_HZ, dur)

            voice_wav = os.path.join(tmp, slug + "_voice.wav")
            run_ffmpeg(
                [
                    "-i", raw_wav, "-i", carrier_wav,
                    "-filter_complex",
                    f"[0:a]{VOICE_FILTER}[dry];[dry][1:a]amultiply[ring];"
                    f"[dry][ring]{RING_MIX}[out]",
                    "-map", "[out]",
                    voice_wav,
                ]
            )

            start_chirp = os.path.join(tmp, slug + "_chirp0.wav")
            end_chirp = os.path.join(tmp, slug + "_chirp1.wav")
            gen_chirp_wav(start_chirp, sr, 900, 1400, 0.09)
            gen_chirp_wav(end_chirp, sr, 700, 1100, 0.09)

            concat_wav = os.path.join(tmp, slug + "_concat.wav")
            list_file = os.path.join(tmp, slug + "_list.txt")
            with open(list_file, "w") as f:
                for p in [start_chirp, voice_wav, end_chirp]:
                    f.write(f"file '{p}'\n")
            run_ffmpeg(["-f", "concat", "-safe", "0", "-i", list_file, "-c", "pcm_s16le", concat_wav])

            out_path = os.path.join(OUT_DIR, slug + ".ogg")
            run_ffmpeg(
                [
                    "-i", concat_wav,
                    "-af", LOUDNORM,
                    "-ac", "1",
                    "-c:a", "libvorbis", "-b:a", "56k",
                    out_path,
                ]
            )
    print(f"done -> {OUT_DIR}")


if __name__ == "__main__":
    main()
