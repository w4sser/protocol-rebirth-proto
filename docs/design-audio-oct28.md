# Audio design, October 28

The approved audio layer supports mobile landscape play without changing combat or economy. All runtime tuning lives in `data/audio.js`; the shared manager is `ui/audio.js` and raid event routing is `nodspel/audio.js`.

Owner revision: no footsteps or ambience ship. Movement is silent, there are no area beds, and cached-page restoration cannot request an ambience track. The only loop is a quiet 24-second music pulse with a two-second wrap crossfade, started after audio unlock in base and active raids. Music defaults to 0.12 with a 0.3 track gain; it stops at raid end/page exit and resumes on a cached-page return only if that raid was active.

SFX: carbine, SMG, shotgun and rifle fire/reload/empty; enemy and wall impacts; grunt, rusher, thrower, tank, turret and generator hit/death; kill confirmation; common through legendary pickups; bag full; medkit; dash; perk open/select; UI tap/back/confirm; alarm; hunter wave sting; final raid countdown; extract success; death/failure. Unknown enemies/weapons use the grunt/carbine family. Reload cues follow actual incremental reloads. Only referenced cues ship; unused legacy shoot/hit/pickup/extract aliases are removed.

B.I.T. uses the eight existing F1 Kokoro am_fenrir recordings. Hunters inbound: wave spawned. Scrap detected: first rare-or-better pickup per raid. Heal budget low: low/empty budget threshold crossed. Extraction marked: final extraction revealed. Bag heavy: full bag notice. Nice shot: every fifth kill, with a long cooldown. Signal lost: terminal failure. Welcome back: integrated result ingested on base return. No speculative or random dialogue. Single VO reservation includes loading time; a global 12-second cooldown and per-line 60-second cooldown (90 seconds for nice shot, 15 seconds for death/return) prevent chatter. Events during another VO are dropped, never stacked.

Mix: master feeds music, SFX and voice buses. Voice ducks music only by exactly -6 dB (linear gain 0.501187), restoring the current user volume afterward. Combat cues stay at their chosen volume during VO. Short gain ramps avoid clicks. SFX vary pitch/gain slightly. Both the existing base settings popup and raid pause popup expose a Master toggle and Music/SFX/Voice sliders with independent mutes. Settings persist locally without changing game saves. Legacy ambience and ambienceMuted keys are ignored and omitted on the next settings write. iOS/Safari audio starts after the first pointerdown/touchend; blocked/unsupported audio fails quietly. Assets load and decode lazily with shared promises; stopped loops cannot start from stale loads.

All audio is generated free/local: numpy plus ffmpeg for original CC0 procedural assets; existing local CPU F1 TTS for BIT. BIT recordings remain All rights reserved © Robert Wasser. Every shipping file is listed in `assets/audio/LICENSES.md`. Both mono Vorbis OGG and low-bitrate AAC M4A ship, preferring AAC whenever the browser reports AAC support; OGG is used only when AAC is unsupported. Total shipping audio, including both formats, must remain below 2,000,000 bytes. No commercial services, downloaded samples, or noncommercial-only voice auditions ship.

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
- **Session and background behavior (PRB-159).** `unlockSync()` explicitly selects
  `navigator.audioSession.type = 'ambient'` when available. Ambient respects the silent switch,
  mixes with other apps and does not opt into background audio. The earlier playback category
  caused music to continue after closing/backgrounding the app. Independently, hidden
  `visibilitychange`, window `pagehide` and document `freeze` stop music loops, pause any media
  elements and suspend the shared context. Desired music is retained. Visible/pageshow recovery
  only resumes a previously unlocked context; if iOS requires a gesture, the next gesture retries.
  Playback, resume, pending drains and synchronous unlock all bail while hidden.
- **Format selection (PRB-159).** Default construction now passes a detached audio capability
  probe. Any truthy AAC (`audio/mp4; codecs="mp4a.40.2"`) result selects M4A, even if Ogg claims
  probably: WebKit may advertise Ogg yet reject or stall decoding. Ogg is selected only when AAC
  is unsupported; a failed Ogg decode switches future loads/retries to AAC. SFX/VO have decode
  deadlines whereas music awaits load without that deadline, explaining why music could play
  while the first effects dropped. All 56 files have both formats; 55 AAC LC files are 22.05 kHz
  mono and the bunker theme is 44.1 kHz stereo. Web Audio resamples decoded buffers to the context.
- **Gesture retries (PRB-159).** Touchend/click synchronously retry resume and a new silent buffer
  whenever the context is not running, including after a failed touchstart's armed wait expires.
- **Hidden diagnostics (PRB-159).** Triple-tap the base version label (`#app-version` or the
  settings menu version), or the raid pause menu version, within 800 ms. The small overlay
  refreshes every 500 ms while open and shows context state/rate/latency, unlock flags, format,
  decoded/failed/pending files, last eight drop reasons, last error, visibility, audio session,
  short user agent and version. Test beep synthesizes a tone through the SFX bus; Play SFX uses
  decoded ui-confirm. Tap the panel to close it. Closed diagnostics have no polling timer.
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

## Cold-open unlock/ordering (PRB-161)

Robert's iPhone playtest of v2.28.39: "I see no version number. But now the VO played after I'd
been clicking on the screen for a while. It should play when the text shows." Audio itself
worked (the v2.28.38 m4a fix) -- the greeting was simply never requested from a real gesture
until much later.

- **The splash must never auto-advance before a first-launch cold open.** `setupSplash()`'s old
  `else if(!flightActive) autoTimer = setTimeout(begin, 1400)` advanced to the cold open with no
  tap at all whenever the archipelago flight wasn't active (Low quality, no WebGL2, or a failed
  flight -- all plausible on iPhone Safari/PWA, see `start-quality.js`). With no gesture,
  `unlockSync()` never ran, the AudioContext stayed suspended, and `requestVoice('youre-back')`
  only played once some later, unrelated gesture happened to unlock audio (often the ENTER THE
  FACILITY tap itself). `setupSplash` now computes `coldOpenNext = !S.introSeen && !ftueDirect`
  once, up front, and gates both the `ready()` and `flightFailed()` auto-advance call sites on
  `!coldOpenNext` -- a first launch (cold open next) always waits on the "TAP ANYWHERE TO BEGIN"
  prompt, whether or not the flight is/was active. A returning player (`S.introSeen`) or a
  fresh-profile FTUE-direct launch (straight into the tutorial raid, no cold open) keep the old
  gesture-free auto-advance, since neither path needs audio unlocked by a tap. The start tap
  itself was already correct (`activate()` calls `PR_AUDIO.unlockSync()` synchronously, before
  the async `unlock()`/`preload()` work; no `preventDefault` on the splash/flight canvas/
  `lockLandscape` suppresses the click; `.splash-flight`'s canvas host is `pointer-events:none`
  so it can never swallow the tap; there is still only the one shared `AudioContext`) -- the gap
  was purely the missing gesture before any of that machinery ran.
- **The first line now waits (capped) for the VO, instead of the VO racing to catch the line.**
  `SCREENS.intro` adds a `.vo-wait` class to `.intro` (paused via the same
  `animation-play-state:paused` mechanism the existing `body.splash-active .intro *` rule already
  uses, so delay time never burns while hidden/held). `armVoiceGate()` clears it once
  `bit/youre-back` is decoded (`PR_AUDIO.decodedFiles.has(...)`, already true in practice --
  `preload()` decodes it during the splash) and the context is `'running'`, or after 1.5s total,
  whichever comes first. The existing first-line `animationstart` -> `greet()` hook (unchanged)
  then fires the instant the line unpauses, so the VO request and the line's reveal land in the
  same tick. Past the cap, the text still starts and `requestVoice`'s own `pendingVoices`/
  `unlockPromise` queueing lets the VO join once ready -- but never after `A.dismissIntro()` has
  already run `cancelVoice('youre-back')` (the v2.28.3x guard, unchanged).
- **ENTER THE FACILITY's fade reads instantly, not mid-transition.** `introBtn` shortened from
  0.9s to 0.5s, and `pointer-events` now flips to `auto` at 60% of the fade (already .85 opaque)
  instead of only at 100% -- it is never tappable while it still reads as invisible, and never
  looks disabled (clearly mid-fade) once it actually is tappable.
- **An HTMLAudio fallback was considered and rejected.** Once the splash always waits for a tap
  and `armVoiceGate()` holds the text for the decode+running gate, the Web Audio path has no
  remaining gap for `youre-back` specifically: decode already finishes during the splash
  (`preload()`), and `unlockSync()`'s `armUnlockWait()` resolves the `'running'` transition well
  inside the 1.5s cap on every iOS version this codebase models. Adding a parallel
  `HTMLAudioElement` would duplicate the mute/volume/duck/lifecycle logic `ui/audio.js` already
  owns (PRB-159's hidden/pagehide suspension, the `voice`/`music` bus split) for a gap that no
  longer exists; not added.
- **The version label is reachable before and during the cold open.** `#app-version` stayed
  visible (`body.splash-active`/`body[data-screen=intro]` no longer hide it) so the triple-tap
  diagnostics overlay (`ui/audio-debug.js`, PRB-159) works from the very first screen, not only
  the base layer. Because `#app-version` is always a child of `#topbar`
  (`#topbar #app-version{position:static}` makes the label's own z-index inert, and opacity/
  display on an ancestor can't be undone by a descendant), `#topbar` itself stays rendered during
  both states -- its OTHER children (`#navback`/`.title`/`#currencies`/`#menubtn`) hide
  individually instead -- and `#topbar`'s own z-index rises to 94 (above `#splash`'s 90 and
  `.intro`'s 50, below the settings-menu/overlay's 95) so the label is actually visible above
  both screens, not just present in the DOM. Taps on the label never reach `#splash`'s or
  `.intro`'s own click handlers -- it is a DOM sibling of both, not a descendant, so the click
  event never bubbles through them.

Guarded by `splash-no-autoadvance-before-coldopen` and `version-label-visible-on-start` in
`scripts/bug-lint.mjs` plus `test/coldopen-vo-sync.test.js` (the same `FakeIOSAudioContext`
pattern as above) -- see `docs/bug-lint.md` PRB-161 for the full scenario list.

### Second cause: the raid-return cold open has no splash and no gesture at all

The fix above only covers the path where the splash is shown (a first launch, cold open coming
next) -- the start tap already calls `unlockSync()` before any of it matters. Robert's actual
playthrough takes a different path to the same symptom: a brand-new profile goes splash tap ->
`A.startFtueDirect()` -> the FTUE raid on the separate `nodspel/` page -> back to `index.html`
with a raid result (`coreIngest.ok`). On that return load, `setupSplash(...,
returningFromRaid=true, ...)` skips the splash outright (`shown = !!returningFromRaid`, see
"a raid result waiting ... always skips the splash" in `setupSplash`) and returns `null` --
*before* it ever reaches its own `PR_AUDIO.preload()` call. With `!S.introSeen`, `session.screen
= "intro"` then renders the cold open immediately: this is a brand-new document, so its
`AudioContext` is still fully suspended, `bit/youre-back` isn't even decoding yet, and no gesture
has happened on this document at all. Reusing the first fix's 1.5s `.vo-wait` cap here would
silently start line 1 with no VO on every raid return on iOS, once the cap simply expired --
exactly the same symptom, through a second route.

- **`armVoiceGate()` gates on a real gesture, with no cap, whenever one hasn't happened yet on
  this document.** It calls `audio.init?.()` first (building the context/gain graph with no
  resume and no gesture needed -- the splash-shown path already does this via `preload()`, but a
  raid return skips that too, so without this call `audio.context` would still read `null` and a
  platform that genuinely runs with no gesture, e.g. desktop autoplay, would wrongly get the
  prompt). It then shows the gesture prompt only when the context truly isn't running, no unlock
  is already in flight (`audio.unlockPromise`, e.g. `armUnlockWait()` armed by some earlier path),
  and audio isn't muted in settings -- any of those three bypass straight to the ordinary capped
  `waitForVoice()`, same as the first fix. The prompt itself is `.vo-wait-tap`: a pulsing "TAP TO
  WAKE BIT" label styled like the splash's own "TAP ANYWHERE TO BEGIN" prompt (same tokens/pill/
  pulse), low-center and safe-area aware, clear of BIT and of the lines/button (hidden behind
  `.vo-wait` while this shows). BIT himself is forced to his idle float state (`.intro.vo-wait-tap
  .intro-bit`) instead of staying invisible mid power-on under the blanket `.intro.vo-wait *`
  pause rule, so he's not just a blank backdrop while the player is asked to tap. Unlike
  `.vo-wait`'s 1.5s cap, `.vo-wait-tap` has **no timeout at all** -- it only clears on an
  explicit tap, since there is nothing else (no earlier gesture, no splash tap) that could ever
  unlock audio on this document otherwise.
- **The first tap/touchend unlocks explicitly and must never read as a cold-open skip.**
  `onGestureTap` calls `PR_AUDIO.unlockSync()` directly (in addition to `installUnlock`'s own
  capture listeners) and clears `.vo-wait-tap`, then proceeds through the same `waitForVoice()`
  gate as the capped path. The tricky part is iOS: it fires `touchend` first, then a **separate**
  synthesized `click` a beat later. The first cut of this fix had `onGestureTap` only remove
  `.vo-wait-tap` on `touchend` and relied on `A.introSkip` checking that class -- by the time the
  later `click` reached the inline `onclick="A.introSkip(event)"` (which fires before any
  `addEventListener`-registered handler added by script, since it was set when `.intro`'s markup
  was parsed), the class was already gone and `introSkip` had nothing left to check, so it fell
  through and skipped the cold open on every iOS raid return -- precisely the kind of regression
  this whole gate exists to prevent. `onGestureTap` now also stamps
  `intro.dataset.gateTapAt = String(Date.now())` the instant it fires; `A.introSkip` ignores a
  click while `.vo-wait-tap` is still present (the ordinary case, a single click/keyboard
  activation) **or** within `GATE_TAP_SKIP_GUARD_MS` (800ms -- real synthesized-click delays are
  well under 300ms) of that timestamp, `stopPropagation`ing either way so the tap never bubbles
  into some unrelated ancestor handler either.
- **Reduced motion gets the same gate, no pulse.** The prompt's pulsing animation is suppressed
  (`@media (prefers-reduced-motion: reduce)` already forces the lines/button to full opacity
  elsewhere in this file's CSS; the gate's own rule re-hides them under `.vo-wait-tap` so the
  gesture requirement still holds even though the ordinary reveal animation is disabled).

Guarded by `coldopen-gesture-gate-after-raid-return` in `scripts/bug-lint.mjs` plus
`test/coldopen-vo-sync.test.js`'s Part C (`bootAppReturningFromRaid()`, seeding
`pr_raid_result_v1` so `coreIngest.ok` is true the same way a real raid return sets it): no
gesture at all holds the prompt with no release even after 5s; a tap calls `unlockSync()`
synchronously and, once running + decoded, clears the gate with `requestVoice('youre-back')`
landing in the same tick as the first line's `animationstart`; the gate tap never counts as a
skip for a plain click or for touchend-then-a-separate-synthesized-click (the latter verified to
actually fail without the `gateTapAt` fallback, proving the regression test catches the real
bug); and both already-running (e.g. desktop autoplay) and muted-in-settings skip the prompt
entirely -- see `docs/bug-lint.md` PRB-161 follow-up for the full scenario list.
