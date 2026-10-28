#!/usr/bin/env bash
# Thin wrapper: activates the TTS venv and runs gen-bit-voice-candidates.py.
# Audition-only -- renders the 3 candidate variants into candidates/ (never
# committed; excluded via .git/info/exclude). See docs/audio-pipeline.md.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TTS_VENV="${TTS_VENV:-/workspace/tts-venv}"

if [ ! -x "$TTS_VENV/bin/python3" ]; then
  echo "error: TTS venv not found at $TTS_VENV (set TTS_VENV or see docs/audio-pipeline.md)" >&2
  exit 1
fi

export PATH="$TTS_VENV/bin:$PATH"

"$TTS_VENV/bin/python3" "$HERE/gen-bit-voice-candidates.py"
