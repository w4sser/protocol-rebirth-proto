# Audio pipeline (BIT voice + SFX)

Local, free, CPU-only audio generation for prototyping. **Nothing here is wired
into the game yet** — this is a tools/assets pipeline only; hooking sounds up
to gameplay events is a separate task.

## Engine choice

**Kokoro** (via [`kokoro-onnx`](https://github.com/thewh1teagle/kokoro-onnx)) is
the *only* engine `tools/audio/gen-bit-voice.py` will use for production
output: CPU inference is fast (<1.5s to render a short line on this box),
voice quality is clearly better than Piper for a characterful line read, and
its voice weights are cleared for commercial use (Apache-2.0 — see
**Licenses**). The script does **not** fall back to Piper or any other
engine if Kokoro is unavailable — it exits with an error before touching
`assets/audio/bit/`, so a missing/broken Kokoro install can never silently
produce output from an uncleared model. Piper is only used as one of the
three candidate treatments below, rendered to the git-ignored `candidates/`
directory, never to `assets/audio/bit/`.

SFX use no TTS engine at all — they're synthesized procedurally (see below).

## Install

Everything lives outside the repo, in a venv at `/workspace/tts-venv`, so
nothing extra gets committed.

```bash
python3 -m venv /workspace/tts-venv
source /workspace/tts-venv/bin/activate
pip install kokoro-onnx soundfile numpy

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

`ffmpeg` (with `libvorbis`) must be on `PATH` for all three generators; it's
used to apply filters and encode the final `.ogg` files.

### Piper: candidate-only, never a production fallback

`tools/audio/gen-bit-voice.py` has no Piper code path at all. If Kokoro's
model files aren't present at `$TTS_VENV/models/kokoro/` (or the
`kokoro_onnx` import fails), the script prints an error and exits
non-zero *before* writing anything to `assets/audio/bit/` — there is no
fallback engine for production output, so a broken Kokoro install can
never result in uncleared audio landing in the repo.

Piper is only installed/used for local candidate auditioning
(`tools/audio/gen-bit-voice-candidates.py`, candidate (c)):

```bash
pip install piper-tts
mkdir -p /workspace/tts-venv/models/piper
# download an en_US voice, e.g. en_US-lessac-medium, into that folder
```

Candidate (c) uses `en_US-ryan-medium` — see **Licenses**, that specific
voice is CC BY-NC-SA 4.0 and is for local audition only, written to the
git-ignored `candidates/` directory, never shipped.

The venv path defaults to `/workspace/tts-venv` but can be overridden with
`TTS_VENV=/path/to/venv tools/audio/gen-bit-voice.sh`; the wrapper exports
`TTS_VENV` (so `gen-bit-voice.py` derives its model/voice paths from the
same value) and prepends `$TTS_VENV/bin` to `PATH` (so a venv-installed
`piper` executable is found when running the candidates script).

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

All scripts are idempotent and overwrite their output directory.

## BIT character and lines

BIT is a small CRT-smiley drone companion. Robert's direction (2026-10-28):
Wall-E-like small robot — cynical and cold, but with humor and care
underneath. The 8 lines (unchanged slugs/meaning, rewritten dry and short):

| slug | line |
|---|---|
| `hunters-inbound` | Hunters inbound. Try not to die, I just cleaned you. |
| `scrap-detected` | Scrap detected. Thrilling. |
| `heal-budget-low` | Heal budget low. Please stop bleeding. |
| `extraction-marked` | Extraction marked. You're welcome. |
| `bag-heavy` | Bag's heavy. So is my disappointment. |
| `nice-shot` | Nice shot. Statistically inevitable. |
| `signal-lost` | Signal lost... rebooting. Miss me? |
| `welcome-back` | Welcome back. I kept the lights on. |

## BIT voice: candidates audition

Before picking a default, 3 distinct treatments were rendered for 3 of the 8
lines (`hunters-inbound`, `scrap-detected`, `welcome-back` — spans urgent,
dry-one-liner, and warm-under-cynicism) via
`tools/audio/gen-bit-voice-candidates.py`:

```bash
tools/audio/gen-bit-voice-candidates.sh
```

Output goes to `/workspace/prp-audio/candidates/<variant>/*.ogg` +
`README.txt` per variant. **`candidates/` is never committed** — it's
excluded via `.gitignore` (`/candidates/`).

| variant | dir | treatment |
|---|---|---|
| (a) kokoro-deep | `candidates/a-kokoro-deep/` | Kokoro `bm_lewis` (deepest male voice in the kit, ~82 Hz f0) + 300-3400 Hz small-speaker band-pass + light `acrusher` bitcrush + subtle ring-mod (45 Hz carrier, 25% wet) + short `aecho` metallic comb. |
| (b) walle | `candidates/b-walle/` | Kokoro `am_echo`, phrases synthesized separately and bookended/joined with numpy-generated square-wave chirps, `asetrate` formant-ish pitch shift (+18%, uncorrected), heavy 90 Hz ring-mod (50% wet). |
| (c) piper-cold | `candidates/c-piper-cold/` | Piper `en_US-ryan-medium` (flat/monotone by default) + narrow 350-3200 Hz radio band + 9 Hz tremolo robotize + short numpy square-wave digital blips at start/end. |

Voice selection for (a): Kokoro's male voices were auditioned by rendering
"Scrap detected. Thrilling." with each and estimating median f0 via
autocorrelation (`am_michael` 117 Hz, `am_fenrir` 128 Hz, `bm_george` 147 Hz,
`bm_lewis` 82 Hz) — `bm_lewis` was clearly the deepest and read as the most
cynical/unimpressed of the set, so it was carried into both the (a) candidate
and the shipped default.

All candidate and shipped lines are normalized with
`loudnorm=I=-16:TP=-1.5:LRA=11` (true peak capped at -1.5 dBTP, so no
clipping) as the last filter step before encoding. Note: `loudnorm`
internally resamples to 192 kHz, so every chain re-resamples to 24 kHz
immediately after it — without that, `libvorbis`'s encoder setup fails on
the inflated rate.

### Chosen default: (a) + (b) hybrid

Shipped default is **not** a pure candidate — it combines (a)'s intelligible,
cynical-sounding deep voice and light processing with (b)'s Wall-E-ish chirp
bookends, and drops (b)'s heavy ring-mod/formant shift. Reasoning: pure (b)
sounds the most like Wall-E, but the heavy ring-mod plus 18% pitch-up made
dialogue noticeably harder to parse at a glance — bad for lines that need to
land instantly mid-raid. Pure (a) alone was clear and cynical but didn't
carry an explicit "small robot" cue. Pure (c) (Piper) was the most monotone
and "cold" but the flattest/least characterful of the three, and its voice
model's license rules it out for shipping anyway (see **Licenses**).

To regenerate just one candidate variant in isolation while iterating, run
`tools/audio/gen-bit-voice-candidates.py` directly with the venv's Python —
edit the `LINES` dict or comment out the variants you don't need inside
`main()`.

## BIT voice: shipped filter chain

`tools/audio/gen-bit-voice.py` renders each line with Kokoro voice `bm_lewis`
at `speed=0.97` (slightly slower, deadpan delivery), then:

1. Band-pass the voice to a small-speaker band and lightly bitcrush/ring-mod
   it (voice only — the bookend chirps below stay clean for contrast):
   ```
   aresample=24000,
   highpass=f=300,lowpass=f=3400,                        # small-speaker band
   acrusher=bits=8:mode=log:mix=0.35:aa=0.5:samples=2,    # light digital grit
   amultiply against a 45 Hz sine carrier, mixed 75% dry / 25% wet,  # subtle ring-mod
   aecho=1.0:0.6:8:0.2                                    # short metallic comb
   ```
2. Generate two short clean square-wave chirps with numpy (900->1400 Hz at
   the start, 700->1100 Hz at the end, ~90 ms each) and concatenate
   `chirp, processed voice, chirp`.
3. `loudnorm=I=-16:TP=-1.5:LRA=11` then resample back to 24 kHz and encode.

Output: mono, Vorbis `.ogg` @ 56 kbps, ~24 kHz source. 8 lines, ~24-38 KB
each (the chirps and extra processing pushed size up from the previous
~13 KB/line pass), ~248 KB total for `assets/audio/bit/`.

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

`assets/audio/bit/` is ~248 KB and `assets/audio/sfx/` is ~31 KB — together
~280 KB, still well under the ~1 MB target. `candidates/` (~284 KB,
uncommitted/local-only) doesn't count against this.

## Licenses

- **`kokoro-onnx`** (the Python wrapper/runtime we call): MIT (see its
  [license](https://github.com/thewh1teagle/kokoro-onnx#license)).
- **Kokoro model weights**: Apache-2.0 (see the upstream
  [model card](https://huggingface.co/hexgrad/Kokoro-82M)).
- **`bm_lewis` voice** (shipped default) and **`am_puck`/`am_echo`
  (candidates only)**: all part of the same Kokoro-82M release; per the
  [voice inventory](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
  they're included under the model's Apache-2.0 terms — check that page for
  any voice-specific caveats before shipping in a real build.
- **`piper-tts`** (the Python runtime, used only by candidate (c), never
  for production output): MIT.
- **Piper voice `en_US-ryan-medium`** (candidate (c) only, **not** shipped):
  per its [model card](https://huggingface.co/rhasspy/piper-voices) the
  underlying dataset ([RyanSpeech](https://www.kaggle.com/datasets/roholazandie/ryanspeech))
  is **CC BY-NC-SA 4.0 — non-commercial**. This repo only uses it locally for
  a one-off audition comparison in `candidates/` (excluded from git, never
  committed, never read by the game). Piper voice licenses vary per voice
  (e.g. `en_US-lessac-medium`'s dataset carries its own separate
  [Blizzard Challenge 2013 license](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html))
  — check the [voice index](https://huggingface.co/rhasspy/piper-voices)
  model card for whichever specific voice is used before shipping any Piper
  output; none has been cleared for commercial shipping yet.
- **Generated BIT voice lines**: these specific lines were synthesized
  locally from the model above using the text in `gen-bit-voice.py`. That
  establishes how *this repo's* output was produced; it does not by itself
  establish the full upstream training/data provenance of the Kokoro model
  or voice — consult the model card and voice inventory for that.
- **SFX**: 100% procedurally generated by `tools/audio/gen-sfx.py` in this
  repo — original, no third-party samples, no license restrictions.
