# Audio pipeline (BIT voice + SFX)

Local, free, CPU-only audio generation for prototyping. **Nothing here is wired
into the game yet** — this is a tools/assets pipeline only; hooking sounds up
to gameplay events is a separate task.

## Engine choice

**Kokoro** (via [`kokoro-onnx`](https://github.com/thewh1teagle/kokoro-onnx)) was
tried first and worked well: CPU inference is fast (<1.5s to render a short
line on this box) and the voice quality is clearly better than Piper for a
characterful, slightly playful line read. Piper is kept as a documented
fallback in `tools/audio/gen-bit-voice.py` (`synth_piper`) in case Kokoro's
model files aren't available in a given environment.

SFX use no TTS engine at all — they're synthesized procedurally (see below).

## Install

Everything lives outside the repo, in a venv at `/workspace/tts-venv`, so
nothing extra gets committed.

```bash
python3 -m venv /workspace/tts-venv
source /workspace/tts-venv/bin/activate
pip install kokoro-onnx soundfile

mkdir -p /workspace/tts-venv/models/kokoro
cd /workspace/tts-venv/models/kokoro
curl -L -o kokoro-v1.0.int8.onnx \
  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
curl -L -o voices-v1.0.bin \
  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

Tested with Python 3.13.5, `kokoro-onnx` 0.6.1, `onnxruntime` 1.31.1,
`soundfile` 0.14.0, `numpy` 2.5.4.

The `int8` model (~89 MB) is used instead of the full fp32 build (~326 MB) —
quality is indistinguishable for short lines at this length and it loads/runs
noticeably faster on CPU.

`ffmpeg` (with `libvorbis`) must be on `PATH` for both generators; it's used
to apply the robot filter / encode the final `.ogg` files.

### Piper fallback (not currently needed)

If Kokoro ever fails to install or sounds poor on a given box:

```bash
pip install piper-tts
mkdir -p /workspace/tts-venv/models/piper
# download an en_US voice, e.g. en_US-lessac-medium, into that folder
```

`gen-bit-voice.py` auto-falls-back to Piper if the Kokoro model files aren't
present at `$TTS_VENV/models/kokoro/`.

The venv path defaults to `/workspace/tts-venv` but can be overridden with
`TTS_VENV=/path/to/venv tools/audio/gen-bit-voice.sh`; the wrapper exports
`TTS_VENV` (so `gen-bit-voice.py` derives its model/voice paths from the
same value) and prepends `$TTS_VENV/bin` to `PATH` (so a venv-installed
`piper` executable is found by the Piper fallback).

## Regenerating

```bash
# BIT voice lines -> assets/audio/bit/*.ogg
tools/audio/gen-bit-voice.sh            # runs the venv's python3 against the .py

# Procedural SFX -> assets/audio/sfx/*.ogg
python3 tools/audio/gen-sfx.py          # system python3 + numpy, no venv needed
```

The SFX generator only needs `numpy` and `ffmpeg` — it doesn't touch the TTS
venv. Install numpy for whichever `python3` you run it with, e.g.
`pip install numpy` (tested with numpy 2.5.4 on Python 3.13.5).

Both scripts are idempotent and overwrite their output directory.

## BIT voice: filter chain

BIT is a small CRT-smiley drone companion, so lines are read in a bright,
slightly playful voice (Kokoro voice `am_puck`) and then run through a light
"robot/drone" ffmpeg filter:

```
aresample=24000,                                      # normalize input rate (Kokoro 24k / Piper fallback 22.05k)
asetrate=24000*1.09,aresample=24000,atempo=1/1.09,   # pitch up ~9% without changing duration
highpass=f=150,                                       # thin out low rumble -> more electronic
chorus=0.5:0.9:55:0.4:0.25:2,                          # light synthetic doubling
flanger=delay=2:depth=2:speed=0.5:width=30             # short metallic modulation
```

Output: mono, Vorbis `.ogg` @ 56 kbps, ~24 kHz source. 8 lines, ~13 KB each,
~109 KB total.

## SFX: procedural synthesis

`tools/audio/gen-sfx.py` implements a small subset of the classic
[sfxr](https://www.drpetter.se/project_sfxr.html) model directly in
numpy — waveform generator (square/saw/triangle/sine/noise) + ADSR-style
envelope + optional vibrato/noise-mix — no samples, no external synth
library. Every cue uses a fixed seed (`20261028`) so regenerating produces
byte-identical synthesized samples (and intermediate `.wav` files) every
time. The final `.ogg` files are *not* guaranteed byte-identical across
runs — ffmpeg's Ogg muxer assigns a random stream serial number per encode
(confirmed: two encodes of the same `.wav` produced different `.ogg`
bytes but identical decoded PCM), and `ffmpeg`'s `-serial_offset` option
only offsets that random value rather than pinning it. If byte-identical
`.ogg` output is ever required, this needs a different encoder/muxer with
a fixed-serial mode, or a post-processing step that rewrites the serial
field deterministically — not currently configured.

| file | shape |
|---|---|
| `shoot.ogg` | short square-wave blip, sweeping down, slight noise mix |
| `hit.ogg` | pure noise burst, fast decay |
| `pickup.ogg` | triangle wave, sweeping up (reward "blip") |
| `alarm.ogg` | two-tone square wave siren with vibrato |
| `extract.ogg` | slow sine sweep up, airy noise mix |

Output: mono, Vorbis `.ogg` @ 48 kbps, 22.05 kHz. 5 cues, ~4-11 KB each,
~31 KB total.

## Budget

All of `assets/audio/` together is ~140 KB — well under the ~1 MB target.

## Licenses

- **`kokoro-onnx`** (the Python wrapper/runtime we call): MIT (see its
  [license](https://github.com/thewh1teagle/kokoro-onnx#license)).
- **Kokoro model weights**: Apache-2.0 (see the upstream
  [model card](https://huggingface.co/hexgrad/Kokoro-82M)).
- **`am_puck` voice**: part of the same Kokoro-82M release; per the
  [voice inventory](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
  it's included under the model's Apache-2.0 terms — check that page for
  any voice-specific caveats before shipping in a real build.
- **Generated BIT voice lines**: these specific lines were synthesized
  locally from the model above using the text in `gen-bit-voice.py`. That
  establishes how *this repo's* output was produced; it does not by itself
  establish the full upstream training/data provenance of the Kokoro model
  or voice — consult the model card and voice inventory for that.
- **SFX**: 100% procedurally generated by `tools/audio/gen-sfx.py` in this
  repo — original, no third-party samples, no license restrictions.
