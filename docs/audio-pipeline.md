# Audio pipeline (BIT voice + SFX)

Local, CPU-only tools/assets pipeline. Audio is wired through `ui/audio.js`,
`nodspel/audio.js`, and minimal event calls. Tuning lives in `data/audio.js`.
See `docs/design-audio-oct28.md` for layers, VO policy, settings and mixing.

## Default BIT voice: F1

`tools/audio/gen-bit-voice.py` ports the F1 treatment from
`/workspace/rostprov/make_f.py`. Kokoro `am_fenrir` at speed `0.9` is the
only shipping engine/voice. No Piper or Ryan fallback exists in the
shipping generator or its wrapper. Model files, imports and engine startup
must succeed before output; all eight clips are staged in a temporary
directory and copied to `assets/audio/bit/` only after every render succeeds.
A missing or broken Kokoro install therefore fails before changing assets.

Each `|`-separated phrase is synthesized separately. Leading/trailing
silence is trimmed with 10 ms RMS blocks and 5 ms edge fades, then phrases
are joined with 150 ms gaps. The reference's optional pitch flattening uses
`pyworld`, then `librosa` if available (retaining 40% of log-F0 variation);
otherwise the generator explicitly reports it skipped. Neither optional
library was installed for this batch.

Processing follows the F1 reference:

1. 40 Hz ring modulation, 15% wet, plus a light moving 3 ms comb (10% mix,
   0.5 ms modulation at 0.25 Hz).
2. C2 chain: resample to 22050 Hz without dither; 350 Hz highpass, 3200 Hz
   lowpass, 9 Hz tremolo at depth 0.4, another 3200 Hz lowpass, and gate
   (`threshold=0.02:ratio=4:attack=3:release=80:range=0.05`). No bitcrushing.
3. No start blip. A 25 ms quiet lead-in and 5 ms voice fades avoid clicks.
   A soft 90 ms sine tail sweeps 560 to 380 Hz, Hann-windowed and lowpassed
   at 1600 Hz. It is added after effects/gating at -40 dB relative to voice
   RMS (margin beyond the required -24 dB), after a 20 ms gap.
4. Reference peak leveling and measured two-pass
   `loudnorm=I=-16:TP=-1.5:LRA=11`, with four cascaded 3300 Hz lowpasses before measurement and a final
   3300 Hz lowpass to remove
   limiting harmonics and a 15 ms tail fade. The extra lowpass stages keep
   all eight phrase openings below the spectral regression threshold. Final mono Vorbis uses quality
   5 at 24000 Hz. Measure the encoded files when checking loudness; short
   clip normalization and lossy encoding can produce small deviations.

## Install and regenerate

System `ffmpeg` with `libvorbis` must be on PATH. Dependencies/models live
outside the repo, by default in `/workspace/tts-venv`:

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

From the repo root:

```bash
# Eight shipping BIT lines; overwrites the eight existing slugs.
tools/audio/gen-bit-voice.sh
# Alternate environment:
TTS_VENV=/path/to/venv tools/audio/gen-bit-voice.sh
# Spectral check; non-zero if any clip is missing or fails.
tools/audio/check-bit-voice.sh
# Optionally check another directory:
tools/audio/check-bit-voice.sh /workspace/rostprov/final
# Procedural SFX (separate from voice generation):
python3 tools/audio/gen-sfx.py
```

The check follows `/workspace/rostprov/check_f.sh`: compare the first
300 ms highpassed at 4 kHz RMS against whole-file 300-3400 Hz speech RMS.
PASS requires intro high-frequency RMS at least 20 dB below speech RMS.
It also reports whole-file high-frequency RMS; this is a filter-based
regression metric, not an ideal brick-wall spectral analysis.

## BIT character and lines

Cold, deadpan and sarcastic, with care underneath. Slugs stay unchanged;
`|` means a separately synthesized phrase and a 150 ms gap.

| Slug | Text |
|---|---|
| `hunters-inbound` | Hunters inbound. \| Wonderful. \| Try not to die. \| I just cleaned you. |
| `scrap-detected` | Scrap detected. \| My circuits are trembling. \| With joy. |
| `heal-budget-low` | Heal budget low. \| Bleeding is expensive. \| Please stop. |
| `extraction-marked` | Extraction marked. \| An exit. \| Do try using it. |
| `bag-heavy` | Bag heavy. \| Excellent. \| More scrap than sense. \| Come home. |
| `nice-shot` | Nice shot. \| Almost competent. \| Keep doing that. |
| `signal-lost` | Signal lost. \| A moment of peace. \| Stay there. \| I am coming. |
| `welcome-back` | Welcome back. \| Still alive. \| Statistically surprising. |

## Local auditions: non-shipping

`tools/audio/gen-bit-voice-candidates.sh` keeps the historical comparison
harness: (a) Kokoro `bm_lewis`, (b) Kokoro `am_echo` with heavier effects,
(c) Piper `en_US-ryan-medium`. These are not the default F1 pipeline.
Outputs go only to git-ignored `candidates/`. Never copy audition audio into
shipping assets. Piper is optional for these local auditions only, requires
its own runtime/model installation, and is never a production fallback.

## SFX: procedural synthesis

`tools/audio/gen-sfx.py` reads the SFX registry from `data/audio.js` and
synthesizes every cue using numpy (tones, filtered noise and envelopes),
plus a quiet 24-second music pulse. Footsteps and ambience were removed
per owner feedback. A two-second raised-cosine wrap crossfade makes the
music loop seamless. Only registered SFX are generated; unused aliases
do not ship.

Per-cue SHA256-derived seeds extend master seed `20261028`, so adding a cue
never changes another cue's synthesized PCM. Decoded PCM is reproducible;
Ogg container serial numbers are encoder-generated and may differ.
Both formats are mono at 22.05 kHz: 24 kbps Vorbis and 24 kbps AAC M4A.
Existing F1 OGG files are preserved, with 32 kbps AAC fallback copies.

```bash
/workspace/tts-venv/bin/python tools/audio/gen-sfx.py
python3 tools/audio/mix-demo.py
```

The generator writes a per-file `assets/audio/LICENSES.md` inventory and
fails if the complete OGG plus M4A shipping payload reaches 2,000,000 bytes.
The 20-second demo is written outside the shipping assets, by default to
`/workspace/rostprov/mix-demo.ogg`. It combines quiet music,
shots/impacts/pickup, alarm/hunter sting and F1 hunters-inbound, applying
exactly -6 dB to music only for the duration of the voice.

## Budget and licenses

All shipping audio, including both formats, remains below 2 MB. Exact sizes
and every file's provenance are in `assets/audio/LICENSES.md`. Local auditions
and the mix demo do not count as shipping assets.

- **Kokoro model weights and `am_fenrir` voice**: Apache-2.0. See the
  [Kokoro-82M model card](https://huggingface.co/hexgrad/Kokoro-82M) and
  [voice inventory](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md).
- **kokoro-onnx runtime**: MIT. See the
  [upstream license](https://github.com/thewh1teagle/kokoro-onnx#license).
- **Piper `en_US-ryan-medium`**: CC BY-NC-SA 4.0, non-commercial,
  **local audition only, not shipped**. See the
  [Ryan voice model card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ryan/medium/MODEL_CARD)
  and [RyanSpeech dataset](https://www.kaggle.com/datasets/roholazandie/ryanspeech).
  Piper runtime licensing is separate from each voice's dataset license.
- **Generated BIT lines**: synthesized locally from the Kokoro model and
  texts above. All rights reserved © Robert Wasser. Consult upstream model
  documentation for training provenance.
- **SFX and music**: original procedural synthesis in
  `tools/audio/gen-sfx.py`, dedicated to CC0-1.0; no third-party samples.
