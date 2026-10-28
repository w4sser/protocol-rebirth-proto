#!/usr/bin/env python3
"""Generate BIT's short voice lines with a local TTS engine, then run them
through an ffmpeg "robot/drone" filter chain into small mono .ogg files.

Engine: Kokoro (kokoro-onnx), CPU-only, run from a venv at $TTS_VENV
(defaults to /workspace/tts-venv; see docs/audio-pipeline.md for install
steps). Falls back to Piper if the Kokoro model files or the kokoro_onnx
import are not available.

Usage:
  tools/audio/gen-bit-voice.sh                  # uses $TTS_VENV or the default
  TTS_VENV=/path/to/venv tools/audio/gen-bit-voice.sh

Writes: assets/audio/bit/<slug>.ogg (mono, ~56 kbps vorbis)
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "assets", "audio", "bit")

TTS_VENV = os.environ.get("TTS_VENV", "/workspace/tts-venv")
KOKORO_DIR = os.path.join(TTS_VENV, "models", "kokoro")
KOKORO_MODEL = os.path.join(KOKORO_DIR, "kokoro-v1.0.int8.onnx")
KOKORO_VOICES = os.path.join(KOKORO_DIR, "voices-v1.0.bin")
VOICE = "am_puck"  # bright, slightly playful voice -> suits a small drone after pitch-up
SPEED = 1.05

# (output slug, line)
LINES = [
    ("scrap-detected", "Scrap detected."),
    ("hunters-inbound", "Hunters inbound. Move!"),
    ("heal-budget-low", "Heal budget low."),
    ("extraction-marked", "Extraction point marked."),
    ("bag-heavy", "Bag's getting heavy."),
    ("nice-shot", "Nice shot, boss."),
    ("signal-lost", "Signal lost... rebooting."),
    ("welcome-back", "Welcome back to the bunker."),
]

# Robot/drone filter chain applied to every line:
#   aresample       - normalize input to 24 kHz (Kokoro is 24k, Piper fallback is 22.05k)
#   asetrate+atempo - pitch up a bit without changing duration (small drone voice)
#   highpass        - strip low rumble, keeps it thin/electronic
#   chorus+flanger  - light modulation for a synthetic, slightly metallic timbre
ROBOT_FILTER = (
    "aresample=24000,"
    "asetrate=24000*1.09,aresample=24000,atempo=1/1.09,"
    "highpass=f=150,"
    "chorus=0.5:0.9:55:0.4:0.25:2,"
    "flanger=delay=2:depth=2:speed=0.5:width=30"
)


def synth_kokoro(text, wav_path):
    from kokoro_onnx import Kokoro
    import soundfile as sf

    kokoro = Kokoro(KOKORO_MODEL, KOKORO_VOICES)
    samples, sr = kokoro.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    sf.write(wav_path, samples, sr)


def synth_piper(text, wav_path):
    # Fallback path: expects `piper` on PATH and an en_US voice at
    # $TTS_VENV/models/piper/en_US-*.onnx (see docs/audio-pipeline.md).
    piper_dir = os.path.join(TTS_VENV, "models", "piper")
    model = next(
        (os.path.join(piper_dir, f) for f in os.listdir(piper_dir) if f.endswith(".onnx")),
        None,
    )
    if not model:
        raise RuntimeError("no Piper voice model found in " + piper_dir)
    subprocess.run(
        ["piper", "--model", model, "--output_file", wav_path],
        input=text.encode("utf-8"),
        check=True,
    )


def synth(text, wav_path):
    if os.path.exists(KOKORO_MODEL) and os.path.exists(KOKORO_VOICES):
        try:
            synth_kokoro(text, wav_path)
            return
        except Exception as exc:  # pragma: no cover - fallback path
            print(f"  kokoro failed ({exc}), falling back to piper", file=sys.stderr)
    synth_piper(text, wav_path)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for slug, text in LINES:
            wav_path = os.path.join(tmp, slug + ".wav")
            out_path = os.path.join(OUT_DIR, slug + ".ogg")
            print(f"-> {slug}: \"{text}\"")
            synth(text, wav_path)
            subprocess.run(
                [
                    "ffmpeg", "-y", "-loglevel", "error",
                    "-i", wav_path,
                    "-af", ROBOT_FILTER,
                    "-ac", "1",
                    "-c:a", "libvorbis", "-b:a", "56k",
                    out_path,
                ],
                check=True,
            )
    print(f"done -> {OUT_DIR}")


if __name__ == "__main__":
    main()
