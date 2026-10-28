#!/usr/bin/env bash
# Thin wrapper: activates the TTS venv and runs gen-bit-voice.py.
# See docs/audio-pipeline.md for how the venv/models were set up.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TTS_VENV="${TTS_VENV:-/workspace/tts-venv}"

if [ ! -x "$TTS_VENV/bin/python3" ]; then
  echo "error: TTS venv not found at $TTS_VENV (set TTS_VENV or see docs/audio-pipeline.md)" >&2
  exit 1
fi

# Make the selected environment available to Kokoro and ffmpeg.
export PATH="$TTS_VENV/bin:$PATH"

"$TTS_VENV/bin/python3" "$HERE/gen-bit-voice.py"
