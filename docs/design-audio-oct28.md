# Audio design, October 28

The approved audio layer supports mobile landscape play without changing combat or economy. All runtime tuning lives in `data/audio.js`; the shared manager is `ui/audio.js` and raid event routing is `nodspel/audio.js`.

Owner revision: no footsteps or ambience ship. Movement is silent, there are no area beds, and cached-page restoration cannot request an ambience track. The only loop is a quiet 24-second music pulse with a two-second wrap crossfade, started after audio unlock in base and active raids. Music defaults to 0.12 with a 0.3 track gain; it stops at raid end/page exit and resumes on a cached-page return only if that raid was active.

SFX: carbine, SMG, shotgun and rifle fire/reload/empty; enemy and wall impacts; grunt, rusher, thrower, tank, turret and generator hit/death; kill confirmation; common through legendary pickups; bag full; medkit; dash; perk open/select; UI tap/back/confirm; alarm; hunter wave sting; final raid countdown; extract success; death/failure. Unknown enemies/weapons use the grunt/carbine family. Reload cues follow actual incremental reloads. Only referenced cues ship; unused legacy shoot/hit/pickup/extract aliases are removed.

B.I.T. uses the eight existing F1 Kokoro am_fenrir recordings. Hunters inbound: wave spawned. Scrap detected: first rare-or-better pickup per raid. Heal budget low: low/empty budget threshold crossed. Extraction marked: final extraction revealed. Bag heavy: full bag notice. Nice shot: every fifth kill, with a long cooldown. Signal lost: terminal failure. Welcome back: integrated result ingested on base return. No speculative or random dialogue. Single VO reservation includes loading time; a global 12-second cooldown and per-line 60-second cooldown (90 seconds for nice shot, 15 seconds for death/return) prevent chatter. Events during another VO are dropped, never stacked.

Mix: master feeds music, SFX and voice buses. Voice ducks music only by exactly -6 dB (linear gain 0.501187), restoring the current user volume afterward. Combat cues stay at their chosen volume during VO. Short gain ramps avoid clicks. SFX vary pitch/gain slightly. Both the existing base settings popup and raid pause popup expose a Master toggle and Music/SFX/Voice sliders with independent mutes. Settings persist locally without changing game saves. Legacy ambience and ambienceMuted keys are ignored and omitted on the next settings write. iOS/Safari audio starts after the first pointerdown/touchend; blocked/unsupported audio fails quietly. Assets load and decode lazily with shared promises; stopped loops cannot start from stale loads.

All audio is generated free/local: numpy plus ffmpeg for original CC0 procedural assets; existing local CPU F1 TTS for BIT. BIT recordings remain All rights reserved © Robert Wasser. Every shipping file is listed in `assets/audio/LICENSES.md`. Both mono Vorbis OGG and low-bitrate AAC M4A ship, selecting OGG only when the browser reports Vorbis support. Older iOS uses AAC. Total shipping audio, including both formats, must remain below 2,000,000 bytes. No commercial services, downloaded samples, or noncommercial-only voice auditions ship.

Regenerate with `/workspace/tts-venv/bin/python tools/audio/gen-sfx.py`. Generate the 20-second audition with `python3 tools/audio/mix-demo.py`; the default output is `/workspace/rostprov/mix-demo.ogg`. The demo is outside the shipping asset budget.

## iOS unlock model (PRB-158)

Robert's iPhone playtest of v2.28.36 (Safari / home-screen PWA): "better, but the sound is still
not fully loaded when I start playing, the 'You're back' VO doesn't play." Desktop Chrome's fake
`AudioContext` in every unit test flips `state` to `'running'` effectively synchronously the
instant `resume()` is called; real WebKit does not. `ui/audio.js` now assumes the opposite by
default:

- **State lag.** `context.resume()` can resolve (and `decodeAudioData` can even complete) while
  `context.state` is still `'suspended'` -- the flip to `'running'` is a separate, asynchronous
  event that can land 100ms+ later. `unlockSync()` (called synchronously inside the gesture,
  per PRB-154) arms `armUnlockWait()`, a promise capped at `config.unlockWaitMs` (1500ms) that
  resolves the instant the real `statechange` event reports `'running'`. `play()`/`voice()`/
  `requestVoice()` wait on that promise (when one is in flight) instead of hard-dropping the
  first sound just because the synchronous check still says `'suspended'`; past the cap, they
  give up and drop as before. `markUnlocked()` is the one place `this.unlocked` actually
  changes, so every path that discovers `'running'` -- the real `statechange` handler, a direct
  post-`resume()` check, or the cap timeout itself -- notifies any other in-flight waiter and
  drains anything (`pendingVoices`, desired music) that queued while still locked.
- **`'interrupted'`** (a phone call, Siri, an app switch, the lock screen) is treated the same as
  `'suspended'` throughout. `resume()` can reject or just stay interrupted; `installUnlock()`
  retries on the next `visibilitychange` → visible, the next `pageshow` (bfcache restore) and the
  next gesture. Both `pageshow` and `visibilitychange` fire on a normal first load too, not only
  a real interruption, and `resume()` cannot do real work outside a trusted gesture anyway -- so
  both are gated on having unlocked at least once already (`wasUnlocked`).
- **Gesture listeners.** `installUnlock()` listens on `touchstart`/`pointerdown` in addition to
  `touchend`/`pointerup`/`click`/`keydown`: a raid joystick hold is `touchstart`/`pointerdown`
  with no matching `touchend` for seconds, and iOS does accept `resume()` from the earlier event
  in recent versions. Every page installs this before any game UI can be tapped -- nodspel's raid
  page now imports `data/audio.js` + `ui/audio.js` from an early `<script type=module>` in
  `<head>`, ahead of `game.mjs`'s much larger dynamic `import()` graph (same cached module, not a
  second `AudioManager`/`AudioContext` -- see "single shared AudioContext" below).
- **Decode timing.** `decodeAudioData` on a context created before any gesture (as `preload()`
  does, deliberately, during the splash) can stall or fail silently on older iOS. `ui/audio.js`
  keeps the raw fetched `ArrayBuffer` per file/extension (`buffers`) separately from the decoded-
  buffer cache (`cache`); a failed decode still evicts its `cache` entry (so a later call retries)
  but never re-fetches, since `decodeAudioData` detaches/consumes its input and every attempt
  gets its own `slice()` copy of the stored bytes. `retryDecodes()` reruns right after
  `unlockSync()`. `raceLoad()` caps how long `play()`/`voice()` wait on a single decode
  (`config.decodeWaitMs`, 2500ms) so one stalled file cannot block playback forever.
- **Silent switch.** Web Audio on iOS follows the ringer/mute switch under the default `'ambient'`
  session category. `unlockSync()` opts into `navigator.audioSession.type = 'playback'` (iOS
  17+) so unlocked game audio plays even with the switch on; feature-detected and wrapped in a
  `try`/`catch`, so its absence (or a setter that throws) is harmless everywhere else. Robert:
  this does not affect players who leave the switch off, but means the switch no longer silences
  the game for players who leave it on, same as most other mobile games.
- **Single shared `AudioContext` per page.** `ui/audio.js` is the only place that creates an
  `AudioContext` (its module-scope `root.PR_AUDIO` singleton); nothing else creates a second
  `AudioContext`, a bare `new Audio()`/`<audio>` element, or uses `navigator.mediaSession`
  (`test/bunker-theme.test.js` enforces this, with the one approved `navigator.audioSession`
  exception above). The base page and the raid page are separate documents/browsing contexts, so
  each legitimately gets its own single `AudioManager`/`AudioContext` -- that split is expected,
  not a second surface on the same page.
- **Sample rate.** `new AudioContext()` is created with no explicit `sampleRate` option, so iOS
  may hand back 48kHz instead of 44.1kHz. Nothing in `ui/audio.js` assumes a fixed rate --
  `shotBuffer()`'s synthesis and the silent unlock buffer both read `this.context.sampleRate`.

Guarded by `ios-audio-waits-for-running` in `scripts/bug-lint.mjs` plus the simulated-iOS
regression suite `test/ios-audio.test.js` (`FakeIOSAudioContext`: asynchronous state lag,
gesture-gated `resume()`, asynchronous `decodeAudioData`, `'interrupted'`) -- see
`docs/bug-lint.md` PRB-158 for the full list of scenarios covered.
