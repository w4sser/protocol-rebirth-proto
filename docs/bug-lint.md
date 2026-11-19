# Every bug fix adds a lint rule or a test

Convention (since v2.22.5): a PR that fixes a bug also adds a guard that would have caught it.

- Prefer a **static rule** in `scripts/bug-lint.mjs` (cheap, runs in `npm test` via `test:bug-lint`). Each rule has `id`, `pr` (the PR/bug it guards) and `why`.
- If it can't be caught statically, add a **cheap unit test** (`test/` or `nodspel/tests/`) and reference the PR in a comment.
- Per-frame allocation regressions belong in `scripts/hot-alloc-lint.mjs` (`// @hot` headers).
- Add a fixture case in `test/bug-lint.test.mjs` so the rule is proven to fire.

Current rules: no tracked node_modules (#129), ogg/m4a audio pairs (#162), cache-busted local imports (#154), CI scripts stub FTUE direct launch (#173), transparent DoubleSide single-pass (#178), single APP_VERSION (#69), medkits independent of the BIT/regen heal budget (v2.25.1; plus nodspel/tests/stakes.test.mjs regression), raid spawn validated via nodspel/spawn.js safeSpawn (v2.25.1; plus nodspel/tests/spawn.test.mjs over areas x hard x depths x seeds), RAID tab/A.go("prep") stay open whenever goalNeedsRaidLoot() is true (v2.28.21), FTUE extract top-up honors r.ftue on a first extract even when S.coreLaunch.raidId does not match (v2.28.22), death/timeout/abandon render the in-raid loss screen before any automatic handoff to base (v2.28.24), mid-raid perk picker stays removed: game.mjs has no openPerk/createPerkUI/perkPickDemo, updateClears never queues an offer, pickReady and autoPickPerks are no-ops, perk-ui.js/perks.css stay deleted (v2.28.25), the one-time Cable retro migration stays idempotent: migrateCableRetro() returns early once st.cableRetro1 is set, sets it to "granted" or "n/a" on every other path, and load() calls it (v2.28.29 PRB-139), BIT's youre-back greeting only ever plays with the intro on screen -- A.dismissIntro cancels it first and base-audio's greet() skips any voice once skipVoice is set (v2.28.30), start activation synchronously resumes and primes Web Audio, preloads during the splash and requests cold-open VO at the first line reveal (v2.28.3x PRB-154), the Core restore never shows a popup: bootSequence() stays removed, no "POWER RESTORED" copy exists anywhere, A.build's isLightsOn branch never opens a popup, and it still plays the core_restored cutscene itself (v2.28.33 PRB-155), optional Fabricator cutscene art probes share a cached result and time out to the existing-art fallback (v2.28.3x PRB-155), narrator reduced motion reveals the continue hint immediately and disables the bust fade (v2.28.3x PRB-155), the Fabricator hologram stays above speech copy (v2.28.3x PRB-155), the extraction beam stays a shader-based volumetric effect (not a flat MeshBasicMaterial cylinder) and loot pickups spawn the pooled 3D burst instead of the old flat ring (v2.28.33 PRB-156). PRB-156 also guards visible instanced loot, removal of the replaced sprites, runtime quality and terminal VFX disposal (v2.28.3x); phone-scale core/fence and pooled pillar/arrival-flash layers stay present (v2.28.3x pass 2). Dedicated narrator art references must exist as tracked assets (v2.28.3x PRB-157); shipped Fabricator art warms once and playback never awaits the probe, superseding PRB-155's optional-art timeout. iOS audio waits for the real 'running' transition instead of dropping the first sound, and the unlock gesture also catches touchstart/pointerdown (v2.28.3x PRB-158, `ios-audio-waits-for-running`). Narrator cutscenes and base cards hold until tapped, with no auto-end timer and a one-second tap guard (v2.28.3x PRB-158, `narrator-holds-until-tap`). PRB-159 forbids background playback sessions and requires hidden/window-pagehide suspension (`audio-no-background-playback`); the default singleton passes a real probe and prefers any supported AAC (`audio-format-probe-default`); the landscape version label remains visible and tappable (`audio-debug-trigger-reachable`).; `cutscene-no-wait-before-show` (PRB-160).; `cutscene-story-survives-popup-replacement` (PRB-160).; the splash never auto-advances to the cold open without a tap (`splash-no-autoadvance-before-coldopen`, PRB-161).; the version label stays visible (not hidden by CSS) during the splash and the cold open (`version-label-visible-on-start`, PRB-161).; a raid return (no splash, no gesture) gates the cold open on a real tap with no cap, and `A.introSkip` ignores that tap even once `.vo-wait-tap` is gone (`coldopen-gesture-gate-after-raid-return`, PRB-161 follow-up). The Dev Panel debug sandbox stays isolated from the normal save: `ui/debug-sandbox.js` is the first script on both pages, every Storage method is namespaced, seeding writes only prefixed keys, `devUnlock` saves pending normal progress first, and the all-worlds browser smoke (fixed for bunker's missing `level.area` and the automatic extract handoff) runs in the required layout/base job (`debug-sandbox-isolated`, v2.28.42). Rules `quest-chip-never-covers-rooms`, `early-raid-crate-cap`, and `no-post-pickup-chest-sprite` guard the v2.28.4x FTUE playtest fixes. BIT always introduces a new system before it's shown/unlocked: the tracked-quest chip (`trackedGoalHtml`) stays hidden until `S.bitCardsSeen.quest_intro` is true, and the Vault cutscene (`BIT_CUTSCENES.vault_intro`/`maybeShowVaultIntro`) is registered, gates on its own seen flag, and checks `progressionGoal()` so it fires the instant the Vault becomes the next build target (`bit-introduces-systems-first`, v2.28.4x PRB-162). Vest shortages stay grouped in existing non-quest caches (`vest-guarantee-existing-caches`, v2.28.4x).; `coldopen-bit-hibernates-until-wake`; `raid-waits-for-combat-sfx`; `room-unlock-two-stage`; `new-find-highlights-goal`; fuel drums stay Bunker-only, respect the shared per-room interactive cap, never share a room with a scripted encounter, pin the FTUE drum player-safe, and chain-ignite through `igniteDrums` (`fuel-drums-chain-and-cap`, v2.28.48).; `live-pads-junction` (v2.28.49 live power pads).; `collapsing-shelf-lane` (v2.28.50 collapsing shelves).; v2.28.52 FTUE one-path contracts (wake/Core, sleeping BIT, base briefings, single build, activation, reward order, Vault quests, labelled BUILD).; v2.28.52 selected Bunker/new Archipelago label gap.; enemy label collision clearance hold.; `base-bit-card-clears-rooms`, `base-briefing-single-cost`, `core-restore-lights-base` (v2.28.54).

One-time Cable retro credit (v2.28.29, PRB-139, fix/powertrace-cable-retro-v2.28.29): before v2.28.17 (PRB-132) Power Trace (bunker chain step B1, "bring 3 Cable home") opened before the Fabricator existed; since PRB-132 it only opens after Fabricator L1, which (v2.28.27, PRB-149) now costs `{scrap:10, items:{cable:1, scrap_alloy:2}}`. A save that already finished B1 (`S.chains.bunker.step >= 1`) but never built Fabricator L1 (`!S.modules.fabricator`) can only be one of those pre-PRB-132 saves, and would otherwise be stuck 1 Cable short of a cost that didn't exist when it finished B1. Robert decided 2026-11-14 (PRB-139): credit it once. `migrateCableRetro(st)` runs in `load()`'s existing-save path alongside `migratePower`/`migratePayoff` (additive field, no SAVE_VERSION bump, same as those) -- not in `freshState()`, which always starts `cableRetro1: "n/a"` so new players never get it. It is idempotent on `st.cableRetro1` ("granted" once credited, "n/a" once evaluated and found ineligible, either way never re-evaluated). It writes `st.stash.cable` directly (same structure `addItem` uses) rather than calling `addItem`/`act`, since `load()` runs before `S` is assigned; the credited Cable is a plain stash copy, not found-in-raid, so it is never blocked from counting toward the Fabricator cost (`canAfford`/`have` read `S.stash` directly -- only quest hand-ins of raid-findable items gate on `S.fir`). Guarded by `cable-retro-migration-idempotent` in bug-lint plus `test/cable-retro.test.js` (eligible grant, idempotent re-load, Fabricator-already-built, B1-not-done, fresh profile, and a post-grant `canAfford` check for Fabricator L1).

FTUE VO on summary (v2.28.30, fix/ftue-vo-summary-fullbleed, Robert 2026-11-14): on the FTUE's first extraction, BIT's `youre-back` greeting played over the EXTRACTED/RAID SECURED summary instead of the cold-open intro, where BIT isn't shown. `SCREENS.intro` called `PR_AUDIO.requestVoice('youre-back')`, which queues in `pendingVoices` while iOS audio is still locked; `ui/audio.js`'s `unlock()` replays every pending voice on the next gesture -- often the ENTER THE FACILITY tap itself, whose capture-phase unlock listener runs (and, being async, resolves in a microtask) before that same tap's bubble-phase `A.dismissIntro()` has even returned, so by the time the replay actually tries to play `youre-back` the intro is already gone and the deferred summary is already open. Separately, `showHomecomingSummary` always armed `ui/base-audio.js`'s `greet()` (`PR_AUDIO_BASE_RETURN`), which on the next tap played a BIT voice line itself (`youre-back` if still mid-intro, else `welcome-back`) -- also wrong on a summary where BIT already greeted during the intro and isn't shown again. Fixed with `AudioManager.cancelVoice(name)` (drops `pendingVoices` + marks consumed) called from `A.dismissIntro` before it navigates, plus a `requestVoice` guard that drops `youre-back` outright unless `.intro` is actually in the DOM (so unlocking *during* the intro, e.g. tap-to-skip, still plays it once, but unlocking after dismissal never does); and `showHomecomingSummary` now passes `{skipVoice:true}` through `PR_AUDIO_BASE_RETURN` on the deferred FTUE path, so `greet()` keeps the `extract-success` sfx but returns before requesting or playing any BIT voice. A second, independent issue in the same report -- the raid-summary overlay (`.raid-summary-ov`/`.raid-summary-pop`) not being full-bleed -- turned out to be `.bpop`'s short-viewport `padding:4px 10px 6px` (and its `background:var(--solid)`) leaking through because the raid-summary override zeroed `border`/`border-radius`/`margin` but not `padding`/`background`; fixed by also zeroing those on `#overlay.raid-summary-ov .raid-summary-pop`, scoped to that one overlay so other `.sheet` popups keep their padding. Guarded by `greeting-vo-only-with-bit-visible` in bug-lint (dismissIntro cancels before navigating; greet() skips before any voice) plus `test/ftue-vo-summary.test.js` (a locked-audio stub proving the summary never plays a BIT voice while an unlock-during-intro still plays it once, plus a CSS assertion that the overlay is padding-free/full-bleed).

Core restore popup removed (v2.28.33, PRB-155, Robert's playtest 2026-11-15 item 4): right after the first Core restore, a `bootSequence()` popup ("POWER RESTORED" / NEW BENEFIT / NEW GOAL / ENTER THE FACILITY) showed before the `core_restored` mini cutscene (PRB-153) could play -- two screens for one moment, and the ENTER tap gated the cutscene's own bunkerwake-lighting delay. Robert's call: the cutscene is the single screen. `bootSequence()` is deleted outright (and its now-dead `.boot`/`.boot-compact`/`#overlay.boot-ov` CSS in `index.html`); `A.build`'s `isLightsOn` branch (Core L1) no longer opens any overlay -- it commits the same state changes as before (`finishModuleLevel`, `advanceBaseState`, `S.bitCardsSeen.core_restored`, `save()`) and schedules `window.PRBitCutscene.play(BIT_CUTSCENES.core_restored)` directly after the same ~1.6s bunkerwake delay the popup used to gate. The popup's benefit/next-goal copy did not just disappear: it moved into the cutscene's new standard layout (see docs/bit-narrator.md) as a bust+speech-bubble line plus a two-row info strip, with the NEXT row's Fabricator cost read live from `MODS.fabricator.levels[0].cost` (`costStripText`/`costStripIcons`) instead of being retyped. Guarded by `core-restore-no-power-popup` in bug-lint (no `bootSequence`, no "POWER RESTORED" string, no `overlay(` inside `isLightsOn`, the branch still calls `PRBitCutscene?.play`) plus regressions in `test/bit-card.test.js` (first build, an existing save with Core already built, and a re-render after the cutscene has fired -- no popup in any case) and `test/ui.test.js`.
Extraction/loot VFX read flat from the isometric camera (v2.28.33, PRB-156, Robert playtest 2026-11-15: "the extraction point effect looks damn 2D. Same when you've picked up loot."): `exitBeam` was a plain `MeshBasicMaterial` cylinder (one flat colour, no depth cue) and `exitPad` a flat-opacity plane; loot pickups reused the generic `world.burst()` ring + flat billboard quads. Fixed with `nodspel/vfx-extract-beam.js` (`createExtractBeam`: a custom `ShaderMaterial` cylinder with a vertical alpha gradient fading to 0 at the top, a fresnel term that brightens the rim over the center, an optional scrolling noise-band scroll, additive blending/`depthWrite:false`; a ground decal built from one shared procedural soft-dot texture -- a glow pad, a dark contact ring just outside it for grounding, two expanding pulse rings; and GPU-cheap rising particles (`THREE.Points`, size-attenuated) spiraling up inside the beam) and `nodspel/vfx-loot-burst.js` (`createLootBurstPool`: a fixed-capacity typed-array pool of sparkles that pop up with gravity then home toward the player over ~0.5s, plus a pooled ground flash ring, coloured by the caller's rarity colour). Both are quality-scaled (low quality drops the shader noise bands and roughly halves the particle/sparkle counts) and share the one procedural `vfx-textures.js` soft-dot `DataTexture` (a `DataTexture`, not a canvas texture, because these modules build real THREE objects under plain `node --test`, which has no DOM). `nodspel/world.js`'s `animate(time, playerPos)` now takes the player's position so the beam can compute a cosmetic "approach progress" (proximity to the exit while open -- the real extract radius/logic in round.js/levels.js are untouched) and the loot burst can home toward the player; `nodspel/game.mjs`'s pickup handler calls `world.spawnLootBurst` instead of `world.burst`. Guarded by `extract-loot-3d-vfx` in bug-lint (the beam must stay shader-based, the old flat cylinder must stay gone, both pickup/animate call sites must stay wired) plus `nodspel/tests/vfx-extract-loot.test.mjs` (creation, quality scaling, open/progress-driven intensity, pooling with no per-frame allocation (`scripts/hot-alloc-lint.mjs` clean), gravity-then-homing motion, ground-flash-ring reuse, exactly-once disposal, the shared texture, and the full `buildWorld` wiring).

Retired: perk choice touch targets keep a 44px floor and the debug demo does not auto-close mid layout-check (v2.28.0) -- removed in v2.28.25 along with the mid-raid perk picker it guarded (PRB-146, Wild Team playtest "remove round upgrades"; see docs/design-decisions.md). `nodspel/perk-ui.js`, `nodspel/perks.css` and the `perkPickDemo`/`perkForceTimeout` debug hooks were deleted; `nodspel/perks.js` stays as an inert module (room-clear detection, death-cause feedback, hitstop/pause utilities and the now-unreachable card logic) since nothing in production ever queues a card offer anymore.

Carlos softlock (v2.28.21, fix/core-found-raid-softlock): a fresh start's Core L1 still needed 1 more Scrap Alloy, but `navAllowed("prep")` was just `baseAllows("navigation","prep")` (false in `core_found`) and `A.go` gated `"prep"` the same way, so the orange RAID FOR SCRAP ALLOY button (`A.raidForModule`/`A.raidForRoom`) silently no-opped and the player could never raid for the only thing the goal needed. Fixed with `goalNeedsRaidLoot()` (progressionGoal() not ready and at least one missing part is `raidFindable`): `navAllowed("prep")` now also returns true when it's true, and `A.go` gates `"prep"` through `navAllowed("prep")` instead of only `baseAllows`. Guarded by `raid-tab-open-when-goal-needs-loot` in bug-lint plus `test/d3-raid-softlock.test.js` (regression + the never-(goal-needs-loot-and-RAID-disabled) invariant across freshState/no-top-up/top-up/core_habitable).

Carlos 1/2 Alloy (v2.28.22, fix/ftue-topup-raidid-mismatch): the D3.10 FTUE extract top-up required `S.coreLaunch.ftue && S.coreLaunch.raidId === r.raidId`. A fresh FTUE extract whose result already carried `r.ftue` (from `?ftue=1`) still skipped it when `buildRaidResult` emitted a `nodspel:` raidId (`launch.seed !== round.seed` after a mid-raid reset/new-round) or when `S.coreLaunch` was missing or overwritten (mid-raid reload of the base, a second `startFtueDirect`). Fixed by also honoring `r.ftue` on a first extract (`S.raids === 0`). Guarded by `ftue-extract-topup-honors-result-ftue` in bug-lint plus `test/d3-homecoming.test.js`.


Artillery FX first-use hitch (#196): `artillery-fx-prewarm` requires `makeArtilleryShell`/`makeToolFxRing` plus an init pre-create of 1 shell + 2 landing rings so `prewarmShaders()` compiles them at level load (plus `nodspel/tests/bridge-artillery.test.mjs`).

AI Fragment drop rate (v2.25.1): not a static bug (it was in the L2/L3 tables, just rare: ~0.23 per full-clear bunker L2+L3 raid). Guarded by `nodspel/tests/ai-fragment.test.mjs` (seeded drop sim), not a lint rule.

Playtest 2026-11-08, item 5: raid result "Continue raid" read as secondary (outline) while "Return to base" read as the primary orange action -- backwards from the push-your-luck framing the owner wants. Fixed with a dedicated `--ad-continue`/`--ad-continue-edge` token pair (an explicit, documented exception to orange-is-primary, scoped to this one CTA) and `.result-continue` in `nodspel/style.css`; `return-base` now carries `.result-secondary`. Not a static rule (it's a one-off visual exception guardrails already lets through); guarded by a `nodspel/tests/raid-result.test.mjs` regression that checks the class wiring and that the token backs it (no raw hex).

Playtest 2026-11-08, item 4: nothing blocked a freshly loaded bunker level while the world was still assembling, so a level transition could become interactive (and the raid clock could tick) before the player had gotten their bearings. Fixed with a blocking "BUNKER LEVEL N" title card (`nodspel/level-intro.mjs` + `showLevelIntro()` in `game.mjs`) shown via the same `pausePick`/`resumePick` clock-freeze already used for the perk picker; `tickRound` itself refuses to advance while `round.pauseAt` is set, so the timer can't tick underneath the card. Archipelago/town (`level.big`) have no discrete level number and never show it. Guarded by `nodspel/tests/level-intro.test.mjs` (pure title/duration checks, a `tickRound`-freeze regression, and a `vm`-extracted test of `showLevelIntro()` itself).

Playtest 2026-11-08, item 2: the top-left bag/NEED-materials HUD (backpack count, tool slots, upgrade material chips) sized its chips and spacing the same regardless of viewport height, so on a short phone landscape screen (844x390, 667x375) a full bag plus a multi-part upgrade goal could stack to over 40% of the screen. Not expressible as a static rule (it's a real rendered-layout measurement); guarded by `scripts/layout-check.mjs`'s `raidGoalCompactRun` (a new `@media(max-height:500px)` rule in `nodspel/style.css` shrinks `.item-tile`/`.need-tiles`/`#raid-goal` and widens `.bag-panel` slightly so chips wrap into fewer rows -- landscape phones have width to spare, not height) plus a debug-only `window.__NR.bagDemo()` hook so the check can fill the bag without playing through pickups.
Shielded guard rear clearance (v2.28.1, playtest 2026-11-08): `shield-guard-rear-clearance` requires `applyEncounters` to end with `ensureRearClearance(level,rng)` and `generateLevel` to re-run it after `applyAreaRules` (extra bodies). A front-shielded guard/shield_turret must have a flank outside its shield arc with line of sight that is WALKABLE from the start (`walkMap` flood fill around walls, boxes, nodes and static bodies: generators, turrets, guards). Otherwise it is relocated; if no valid spot exists the impossible encounter is omitted at generation (`level.omittedEncounters`), never shield-stripped. Seeded sweep + two fixtures in `nodspel/tests/encounters.test.mjs`.

Hit reaction froze moving legs (v2.28.7, M39 operator-feel review): `createHumanOperator`'s `update()` sent the lower (leg) animation layer into the `HitRecieve` pose for the reaction's full duration on every hit, even while the player's real position kept moving underneath it - an input-steal feel where the legs visually stopped mid-stride despite the character actually still walking/running. Fixed so the lower body only freezes into the hit pose while the player is truly stationary; a hit while moving keeps the legs on `run`/`back` and the reaction plays on the upper body only. Not expressible as a static rule (it's clip-selection behavior over time, not a single source pattern); guarded by a regression in `nodspel/tests/operator.test.mjs` ("a hit while moving keeps the legs running/back...") plus the mirrored robot-presence behavior in `nodspel/tests/robot-operator.test.mjs`.

Death loss screen (v2.28.24, Wild Team playtest "when dying Bunker 3, you're just thrown back, you don't see what you lost"): `finishRound` called `handoffRaidResult` -- write the ledger, navigate to base -- for every terminal base-launched raid, so death/timeout/abandon never rendered `#round-over` at all; the player was thrown back to the base before seeing what their bag or equipped gear actually cost them. Fixed by gating the automatic handoff to `['extract','complete'].includes(round.reason)` only: death/timeout/abandon now fall through to the same in-raid presenter (`resultView`/`renderResult`), upgraded to show every lost item type and every lost gear piece as full extract-style tiles (no more 8-tile compact preview), and only leave the raid when the player taps RETURN TO BASE. That control writes the ledger with `acknowledged:true` so the base ingests silently instead of showing the same losses a second time; extract is unaffected (it never sets `acknowledged` on its normal path, and still opens the shared base summary). Guarded by `death-loss-screen-before-handoff` in bug-lint, `nodspel/tests/eor-handoff.test.mjs` (death/timeout/abandon render and do not navigate), `nodspel/tests/result-screen.test.mjs` (full tiles, no cap, recovered/protected items excluded) and `nodspel/tests/summary-handoff.test.mjs` (an acknowledged death skips the second overlay but still ingests completely).

PRB-154 (2026-11-15): `coldopen-vo-after-start-unlock` guards the start handler's synchronous `unlockSync()` before async `unlock()`, including `resume()` and a silent one-sample source in the same gesture stack. The splash preloads/decode-caches SFX, VO and loops while suspended; artwork and audio readiness gate the single pulsing prompt, with a 2.5-second fallback. The intro requests `youre-back` at the first line's animation start (or a skip/reduced-motion reveal), after the splash uncovers BIT. Nested intro animations pause behind the splash so the first line cannot reveal invisibly and lose its once-only VO cue. The start transition retains its ui-confirm sound after removing PLAY and waits for the gesture unlock promise before playback, since resume can complete asynchronously. The rule also guards that promise dependency. Text proceeds on its normal timing if audio is unavailable. Real-manager integration tests in `nodspel/tests/audio.test.mjs` cover start-tap unlock, a first tap on the locked intro, once-only playback, cancellation on ENTER and rejection after leaving; the FTUE summary regression remains in `test/ftue-vo-summary.test.js`. Ogg/m4a fallback stays unchanged, and the raid manager also preloads on page load.
Optional Fabricator art fallback (PRB-155): preload and play previously created separate Image probes, and neither had a timeout. Missing art caused duplicate 404 requests; a stalled request prevented the story beat from ever falling back. `fabricator-art-bounded-cache` guards a shared promise and a three-second timeout. `test/bit-card.test.js` exercises success, errors and stalled loads, verifies both callers receive the correct beat, and ensures later calls never probe again.

Narrator reduced motion (PRB-155): the new bust still inherited its opacity transition, and the continue hint waited 1.5 seconds even when the bubble and info strip were immediately visible. `cutscene-reduced-motion-instant` guards the instant hint and bust transition override; the component regression and browser screenshot harness verify the reduced-motion presentation.

Fabricator hologram placement (PRB-155): screenshot review at 667x375 found the assembling vest partly behind the speech bubble. `narrator-hologram-above-copy` prevents the low anchor returning; the screenshot harness checks the actual hologram, bubble and info-strip rectangles at all three landscape sizes.
### Visible pooled VFX lifecycle (PRB-156)

`vfx-visible-pooled-lifecycle` prevents returning to subpixel loot Points with the orthographic camera,
reintroducing extraction/collection sprites over the 3D effects, or dropping live quality and raid-end
cleanup hooks. Its bad/good fixture lives in `test/bug-lint.test.mjs`; behavioural allocation, quality,
multiple-exit and idempotent disposal coverage lives in `nodspel/tests/vfx-extract-loot.test.mjs`.

### Phone depth layers (PRB-156 pass 2)

Pass 1 remained too subtle in phone screenshots. `vfx-phone-depth-layers` guards attachment of the
inner extraction core and raised floor fence, plus construction of each pooled pickup pillar and
arrival flash. Fixtures reject the old shell/particles-only form. Behavioural tests in
`nodspel/tests/vfx-extract-loot.test.mjs` cover taper, pulse cadence, quality reuse, launch height,
sideways spread, arrival timing and exactly-once disposal; native-size captures provide visual review.

PRB-157 (2026-11-15): `dedicated-narrator-art-exists` checks every production narrator WebP path in app.js against tracked files, with present/missing fixtures. The existing `fabricator-art-bounded-cache` rule keeps its historical PR attribution and now guards the shipped-art invariant: a shared early warm-up and synchronous beat selection, so a stalled probe cannot block the story. Runtime regressions cover immediate presentation during a stalled warm-up, image-error fallback, the dedicated dark/powered pair with no effects, file budgets, and cover/push-in geometry.

PRB-157 review follow-up: dedicated narrator lint also guards timeout eviction for shared bust images. Early Fabricator warming must not permanently cache a missing happy bust for Core/death; the focused cutscene regression times out startup warming, then recovers and displays the same bust during Core.

PRB-158 (2026-11-15, Robert's iPhone playtest of v2.28.36, "better, but the sound is still not fully loaded when I start playing, the 'You're back' VO doesn't play, and the Fabricator box doesn't stay long enough"): two unrelated iOS/narrator fixes land together.

iOS audio: every existing audio test's fake `AudioContext` flips `state` to `'running'` effectively synchronously the instant `resume()` is called, which hid the real WebKit behavior -- `resume()` can resolve (and `decodeAudioData` can even complete) while `state` is still `'suspended'`, only flipping to `'running'` asynchronously, sometimes 100ms+ later. `ui/audio.js`'s `play()`/`voice()`/`requestVoice()` used to hard-drop the sound the instant that synchronous check failed. Fixed with `armUnlockWait()` (a capped, ~1.5s promise that resolves the moment `context.state` actually becomes `'running'`, via the real `statechange` event) and `markUnlocked()` (the one place `this.unlocked` changes, so every path that discovers `'running'` -- the statechange handler, a direct post-`resume()` check, or the cap itself -- notifies any in-flight waiter and drains anything that queued while locked). `requestVoice()`'s "not yet unlocked" branch now awaits an in-flight `unlockPromise` instead of only queuing for a later explicit `unlock()` call, re-checking the intro-not-present guard and every mute setting at PLAY time, not just at request time. `installUnlock()` also listens on `touchstart`/`pointerdown` (a raid joystick hold has no matching `touchend` for seconds) and recovers on `pageshow` and `visibilitychange`, gated on having unlocked at least once already (both fire on every normal load, not just a real interruption, and `resume()` cannot do real work outside a trusted gesture anyway) -- `'interrupted'` is treated the same as `'suspended'` throughout. `ui/audio.js` keeps the raw fetched `ArrayBuffer` per file/extension (`buffers`) so a decode that fails or stalls on an old-iOS context created before any gesture can be retried from the same bytes (`decodeAudioData` detaches its input, so every attempt gets a fresh `slice()`) without re-fetching (`retryDecodes()`, run right after `unlockSync()`); `raceLoad()` caps how long `play()`/`voice()` wait on a stalled decode. `unlockSync()` also opts into `navigator.audioSession.type = 'playback'` (iOS 17+; the ringer/mute switch otherwise silences the default `'ambient'` category), feature-detected and wrapped so its absence is harmless -- confined to that one call site (`test/bunker-theme.test.js`'s single-audio-surface guard enforces this). nodspel's raid page now also installs the unlock listeners from an early `<script type=module>` in `<head>`, before `game.mjs`'s much larger dynamic `import()` graph has had a chance to evaluate -- previously a tap on `#tutorial-start` could land before any listener existed. Guarded by `ios-audio-waits-for-running` plus the simulated-iOS regression suite in `test/ios-audio.test.js` (`FakeIOSAudioContext`: async state-lag, gesture-gated `resume()`, async `decodeAudioData`, `'interrupted'`).

Narrator hold-until-tap: `ui/bit-cutscene.js`'s mini cutscenes and `ui/bit-card.js`'s base cards auto-advanced/auto-dismissed on a fixed timer, which Robert's playtest flagged as too fast to read. Both now hold until the player taps -- no auto-end timer at all for the cutscene or for a base card -- with TAP TO CONTINUE fading in (0.4s) at ~3s (cutscene: was 1.5s) and a one-second guard (`run.locked`/`current.locked`) that ignores an accidental tap, Escape, Enter/Space or the continue button right after the scene opens; after that second, tap/Escape/keyboard-via-native-button-activation/the continue button all dismiss through the same gate. Reduced motion keeps showing the hint immediately (the existing convention for this component) but still observes the one-second guard and never auto-advances either. The raid card is the one deliberate exception: it keeps its old timed, non-blocking auto-dismiss, since the player is mid-combat there and a card that could only be cleared by a dedicated tap would get in the way (`ui/bit-card.js` branches on `isRaidPage()`; see `docs/bit-narrator.md` "Hold until tap"). Guarded by `narrator-holds-until-tap` plus the updated `test/bit-cutscene.test.js`/`test/bit-card.test.js` regressions (hold timing, the one-second guard, and the base/raid split).

PRB-159 supersedes PRB-158's playback-category choice: `audio-no-background-playback` rejects assigning `audioSession.type='playback'`, requires hidden visibilitychange and window pagehide to call `suspendForHidden()`, and keeps the synchronous unlock hidden guard. `audio-format-probe-default` requires the default singleton to pass `document.createElement('audio')` as its probe and select AAC whenever its capability result is truthy, even if Ogg reports probably. Source-mutation fixtures exercise each failure. The simulated WebKit suite covers rejecting/stalled Ogg, default construction, first-SFX playback without Ogg requests, hidden/freeze/pagehide suspension, visible recovery and synchronous touchend/click retries after a failed touchstart wait.

`audio-debug-trigger-reachable` requires the debug stylesheet to override both the landscape topbar version hiding and its pointer-events rule. The browser capture opens the panel through three real taps at 844x390, 667x375 and 932x430; mutation fixtures reject removal of either override or the required selector specificity.


PRB-160 (v2.28.3x): `cutscene-no-wait-before-show` prevents voiceBusy gates in the renderer,
promise/await waits in advance(), and setTimeout callbacks containing PRBitCutscene.play in
app.js. Fixtures cover voice, preload promises and nested Fabricator timer callbacks. Decoded
warm-cache coverage replaces the old bust timeout requirement in dedicated-narrator-art-exists;
failed images remain retryable and an unresolved warm request never blocks direct rendering.
The Fabricator cache rule continues to require synchronous beat selection independently of its
warm promise. Historical bunkerwake-delay descriptions above describe the previous behavior;
PRB-160 removes that wait.

`cutscene-story-survives-popup-replacement` (PRB-160) guards reward/summary story callbacks on
popup cancellation. Normal Close/Back runs the once-only shared close lifecycle; navigation or
Profiles replacement preserves only the story callback, without running unrelated popup actions.
Fixtures cover a lost Fabricator callback and direct Profiles removal, with integration tests for
both story beats and stale double closes.

PRB-161 (v2.28.40, Robert's iPhone playtest of v2.28.39): "I see no version number. But now the
VO played after I'd been clicking on the screen for a while. It should play when the text
shows." `setupSplash()`'s old gesture-free auto-advance (`else if(!flightActive) autoTimer =
setTimeout(begin, 1400)`) fired on Low quality/no WebGL2/a failed flight regardless of whether
the cold open was coming up next, so `unlockSync()` never ran from an actual tap and BIT's
`youre-back` greeting only played once some later gesture happened to unlock audio.
`splash-no-autoadvance-before-coldopen` requires `setupSplash` to compute `coldOpenNext =
!S.introSeen && !ftueDirect` and to gate both the `ready()` and `flightFailed()` auto-advance
call sites on `!coldOpenNext`; a returning player (`S.introSeen`) or a fresh-profile FTUE-direct
launch (no cold open coming) keep the old gesture-free auto-advance, since neither path depends
on a tap to unlock audio.

`SCREENS.intro` now holds the line/button reveal behind a `.vo-wait` class (paused, same
mechanism as the existing `body.splash-active .intro *` pause) until BIT's greeting is both
decoded (`PR_AUDIO.decodedFiles.has('bit/youre-back')`) and the AudioContext is `'running'`,
capped at 1.5s total (`armVoiceGate()`); past the cap the text starts anyway and the VO still
joins once ready, through the existing `requestVoice`/`pendingVoices` queueing -- never after
`A.dismissIntro()` has already cancelled it (the v2.28.3x `cancelVoice` guard). The first line's
existing `animationstart` -> `greet()` hook is unchanged, so the VO request lands in the same
tick the line actually starts revealing.

`ENTER THE FACILITY`'s fade (`introBtn`) was a 0.9s animation with `pointer-events` only
flipping to `auto` at the very end -- a screenshot taken mid-fade (plausible given how long
Robert had been waiting for the splash to ever advance) reads as "faded/stuck". The fade is now
0.5s with `pointer-events:auto` kicking in at 60% (already .85 opaque), so it is never tappable
while it still reads as invisible and never looks disabled once it is tappable.

`version-label-visible-on-start` requires `#app-version` to stay out of the `body.splash-active`
opacity:0 list and the `body[data-screen=intro]` display:none list, so Robert's on-device
diagnostics (triple-tap, `ui/audio-debug.js`) are reachable before and during the cold open, not
just on the base screen. Because `#app-version` is always a child of `#topbar` (and
`#topbar #app-version{position:static}` means the label's own z-index does nothing), hiding
`#topbar` itself would hide the label too (opacity/display on an ancestor cannot be undone by a
descendant) -- the fix hides `#topbar`'s OTHER children individually
(`#navback`/`.title`/`#currencies`/`#menubtn`) and instead raises `#topbar`'s own z-index to 94
(above `#splash`'s 90 and `.intro`'s 50, below the settings-menu/overlay's 95) during both
states, which the rule also checks for. CI follow-up: while raised over the splash/cold open, `#topbar` is `pointer-events:none` (its hidden siblings use `visibility:hidden`), and `#app-version` is pinned bottom-right, so neither can cover `#splash-profiles-btn`/`#splash-settings-btn` (caught by layout/base).

Guarded by `splash-no-autoadvance-before-coldopen` and `version-label-visible-on-start` in
bug-lint, plus `test/coldopen-vo-sync.test.js` (jsdom + a `FakeIOSAudioContext` modeling the same
asynchronous `resume()`/`decodeAudioData` lag as `test/ios-audio.test.js`): first-launch
auto-advance for `flightActive` false and true (and after a later `flightFailed()`), the
returning-player/ftueDirect control cases, a synchronous `unlockSync()` call on the start tap,
the `.vo-wait` gate holding then clearing within the cap, the cap's own fallback with the VO
queued but never played after ENTER, and triple-tapping the version label on the splash/cold
open opening the debug overlay without starting or skipping anything. `test/splash.test.js` was
updated in place (the old assertion exercised exactly the behavior this PR removes).

PRB-161 follow-up (same bug report, a second path Robert's actual playthrough hits): a
brand-new profile goes splash tap -> `A.startFtueDirect()` -> the FTUE raid on the separate
`nodspel/` page -> back to `index.html` with a raid result (`coreIngest.ok`). On that return
load, `setupSplash(..., returningFromRaid=true, ...)` skips the splash outright (`shown =
!!returningFromRaid`) and returns `null` *before* it ever reaches its own
`PR_AUDIO.preload()` call -- so with `!S.introSeen`, `SCREENS.intro()` renders the cold open
immediately on a brand-new document whose `AudioContext` is still fully suspended, with
`bit/youre-back` not even decoding yet, and absolutely no gesture behind it. The original
`splash-no-autoadvance-before-coldopen` fix above only closes the gap on the splash-shown path
(where the start tap already called `unlockSync()`); reusing its 1.5s `.vo-wait` cap here would
silently start line 1 with no VO on every raid return on iOS, which is exactly "the VO played
after I'd been clicking on the screen for a while" again.

`armVoiceGate()` now calls `audio.init?.()` first (so `audio.context` actually exists -- a raid
return never ran `preload()`, which is the only other thing that builds it before a gesture),
then only shows the gesture prompt (`.vo-wait-tap`, a pulsing "TAP TO WAKE BIT" styled like the
splash's own prompt, BIT forced to his idle float state so he's not invisible mid power-on while
held) when the context genuinely isn't running, no unlock is already in flight
(`audio.unlockPromise`), and audio isn't muted in settings -- in every other case (already
running, e.g. desktop autoplay; a gesture already unlocking; or muted, nothing to wait for
either way) it falls straight through to the ordinary capped `waitForVoice()`. Unlike the
capped gate, `.vo-wait-tap` has **no timeout at all**: it only clears on an explicit tap.

The first tap/touchend on `.intro` (`onGestureTap`) calls `PR_AUDIO.unlockSync()` explicitly and
must never register as a cold-open skip. iOS fires `touchend` first, then a **separate**
synthesized `click` a beat later: the original cut of this fix had `onGestureTap` only remove
`.vo-wait-tap` on `touchend`, so by the time the later `click` reached the inline
`onclick="A.introSkip(event)"`, the class was already gone and nothing was left to check --
`introSkip` fell through and skipped the cold open on every iOS raid return. `onGestureTap` now
also stamps `intro.dataset.gateTapAt = String(Date.now())` the instant it fires;
`A.introSkip` ignores a click while `.vo-wait-tap` is still present (the ordinary, same-event
case) **or** within `GATE_TAP_SKIP_GUARD_MS` (800ms, well past any real synthesized-click delay)
of that timestamp.

Guarded by `coldopen-gesture-gate-after-raid-return` in bug-lint, plus
`test/coldopen-vo-sync.test.js`'s Part C (`bootAppReturningFromRaid()`, which seeds
`pr_raid_result_v1` so `coreIngest.ok` is true and the splash is skipped the same way a real raid
return skips it): no gesture at all holds the prompt with no release even after 5s; a tap calls
`unlockSync()` synchronously and, once running + decoded, clears the gate with
`requestVoice('youre-back')` landing in the same tick as the first line's `animationstart`; the
gate tap never counts as a skip for a plain click or for touchend-then-a-separate-synthesized-
click (the latter verified to actually fail without the `gateTapAt` fallback); and both
already-running and muted-in-settings skip the prompt entirely.

## debug-sandbox-isolated (v2.28.42, debug unlocks)

ChatGPT's debug-unlocks patch puts **Unlock All Worlds** / **Unlock Everything** in a separate storage
namespace (`protocol-rebirth:debug:<mode>:`) by patching `Storage.prototype` in `ui/debug-sandbox.js`.
Review findings that the rule now pins:

- The sandbox must be the first `<script>` in `index.html` and `nodspel/index.html`, and it must namespace
  `getItem`/`setItem`/`removeItem`/`key`/`clear`, otherwise a debug page could write the normal save or
  `pr_raid_result_v1`.
- `seed()` writes only the prefixed `pr_meta_save`.
- `devUnlock` calls `save()` before `resetting = true`, so in-memory normal progress is not dropped when the
  ordinary page stops saving (regression in `test/debug-unlocks.test.js`).
- The browser smoke first failed on main: bunker levels have no `level.area` (`levels.js` only sets it
  off-bunker), and an extract returns to base automatically via `handoffRaidResult`, so `#return-base`
  never appeared. It now compares `level.area??'bunker'` and accepts the handoff (button as fallback).
- The PR token cannot add `.github/workflows/debug-unlocks.yml` (needs `workflow` scope), so
  `scripts/layout-check.mjs` runs the smoke in the `base` group, which is a required CI check.

## bit-introduces-systems-first (v2.28.4x, PRB-162)

Robert's playtest 2026-11-16: the tracked-quest chip (e.g. "Guard Duty") and the Vault both reached
the player with no explanation first. The design rule is now explicit in
[docs/ftue-design.md](ftue-design.md) §0 and [docs/bit-narrator.md](bit-narrator.md): **BIT always
introduces a new system before it is shown or unlocked.** This rule pins the two gates PRB-162 adds
so a later refactor can't silently drop them:

- `trackedGoalHtml()` (the chip's own render path) must return `""` while
  `S.bitCardsSeen.quest_intro` is falsy -- the chip itself enforces the gate, not just its caller.
- `BIT_CUTSCENES.raid_briefing`/`quest_intro`/`vault_intro` must stay registered, each with a
  `maybeShow<Id>()` trigger function.
- `maybeShowVaultIntro()` must gate on its own `S.bitCardsSeen.vault_intro` flag (plays once) and
  check `progressionGoal()` (plays the instant the Vault becomes the next build target, not only
  once it's already built -- the "whichever comes first" rule from the PR).
- `migrateBitCardsSeen()` must back-fill all three flags for saves already past their live trigger,
  the same additive pattern as `fabricator_built`.

Fixture in `test/bug-lint.test.mjs`; the live triggers and the once-only/migration behavior have
their own regressions in `test/bit-card.test.js` (see "PRB-162" there) and the quest-chip gate in
`test/ui.test.js`/`test/d3-ftue-end.test.js`.


Quest chip room clearance (`quest-chip-never-covers-rooms`, v2.28.4x): the chip is in screen coordinates while room targets pan/zoom. `placeBaseGoal` measures both room buttons and labels after map layout, font loading, resize and card expansion. The base layout group checks actual intersections and room tap targets for Fabricator locked/NEXT and Fabricator built with Guard Duty, including narrow/tall viewports and panning.

Early crate cap (`early-raid-crate-cap`, v2.28.4x): guided supplies group repeated units in a crate, with optional loot only below the three-crate cap. FTUE uses three guaranteed caches (two Alloy units, Cable, Salvage converting to at least ten Scrap). The first bag payoff adds its exact authored item cycle to existing caches, dispensing mixed contents through the same pickup and bag-capacity rules. Regression tests count L1/L2 room crates across seeds, prove reachable supplies and extraction, and exercise partial collection and swaps with a full bag. Later levels retain their generator.

Chest sprite removal (`no-post-pickup-chest-sprite`, v2.28.4x): the pixel adapter must not spawn the chest on reveal/collection or in its demo. Its loot observation loop is removed. The pooled 3D burst and textual pickup path remain required. A behavioral regression drives unrevealed, revealed, collected and initially revealed supplies through the adapter.

Vest material guarantee (`vest-guarantee-existing-caches`, v2.28.4x): the launch recomputes the
recipe shortage from live inventory and applies or clears it on raid start. Level-one guarantees
use quantities and mixed contents in existing non-quest caches, preserving the early-room cap.
Mutation fixtures remove the quantity grouping, quest protection or launch wiring; behavioral
regressions exercise 200 seeds with a concurrent quest, normal pickups and extraction. Big Map assertions check exact guaranteed units; per-pass cache claims prevent inherited template metadata from appending duplicate supplies.
`bit-introduces-systems-first` also requires the pending-intro queue and Vault construction gate:
a queued moment cannot count as seen before its dismissal callback. The vest rule also pins the craft confirmation action row; the base layout group opens the missing-material vest confirmation at all three phone sizes to verify both actions remain reachable. Missing Scrap must show its existing salvage cache source as well as have/need; source labels and the guarantee use data, and the shortage uses the live discounted craft cost.


### room-unlock-two-stage

`v2.28.4x room unlock stages`: Fabricator and Vault must each expose teaser and unlock
through the shared data-driven helper. Teasers use dark art, unlocks use the powered pair,
and Vault builds cannot wait for a cutscene dismissal. Already built saves migrate both stages.
Regression fixtures remove either room stage, replace the dark-only teaser, or restore the build gate.

### new-find-highlights-goal

`v2.28.4x new find clarity`: the first NEW FIND uses BIT style once and migrates old seen
finds. Popups wait for narrator scenes, put the current progression goal (or tracked quest /
affordable recipe) first, and collapse remaining uses. Fixtures remove the seen flag,
priority match, popup integration, collapse markup and migration evidence.
BIT hibernation (v2.28.4x): `coldopen-bit-hibernates-until-wake` guards the dim cutout, gesture-only hibernation state and wake completion before line 1. Reduced motion uses a fade with no flicker or breathing. `test/coldopen-vo-sync.test.js` proves tap unlock remains synchronous, VO starts with line 1 after wake, and ungated paths never hibernate.

Raid audio readiness (v2.28.4x): `raid-waits-for-combat-sfx` requires the initial reset to await combat buffers, an input guard during calibration, a capped start wait and ongoing retries. The existing loader shows BIT calibration copy; `nodspel/tests/audio-ready.test.mjs` covers all-buffer readiness, the cap, background completion, AAC selection, queued first SFX and synchronous joystick unlock/retry.

### fuel-drums-chain-and-cap

`v2.28.48 fuel drums` (toy 1/3): the FTUE's single hand-authored barrel and the seeded drums
`placeFuelDrums` (`nodspel/levels.js`) scatters through ordinary Bunker raids are now one shape
(`makeDrum`/`detonateDrum`), so a regression in any one of these silently changes the other:

- `RULES.interactives.maxPerRoom` is the shared per-room interactive cap (future toys count
  against it too); `placeFuelDrums` clamps the drums it places per room to it.
- `placeFuelDrums` skips any room already running a scripted encounter (patrol/guard/turret/swarm/
  shield) -- a room keeps its own single tuned problem, never a drum stacked on top of it.
- Fuel drums only ever place in `area==='bunker'` raids.
- The FTUE drum is pinned `playerSafe:true`; `detonateDrum` skips the player-damage branch for it,
  so the scripted double takedown can never hurt the player, while every ordinary drum (outside
  the FTUE) does.
- A detonating drum calls `igniteDrums`, so a blast -- the drum's own, or an enemy grenadier's --
  can start the next drum's telegraphed cook-off and chain.

Fixture in `test/bug-lint.test.mjs` reverts each guard individually. Behavioral coverage lives in
`nodspel/tests/fuel-drums.test.mjs` (placement cap/determinism/clearance/encounter exclusion, shot
detonation, chained cook-off, player damage outside the FTUE vs none inside it) and
`nodspel/tests/drum-intro.test.mjs`/`test/fuel-drums-bit.test.js` for the BIT first-sight card.

### live-pads-junction

v2.28.49 live power pads: guards enemy damage through normal hit bookkeeping, conventional
projectile activation, radial overload followed by cooldown, the completed-raid day-2 gate and
FTUE/Bunker exclusion, reserving both shared room slots, and BIT's exact first-sight line plus
`round.bitSeen` persistence. Behavioral tests cover timing, seed determinism, cap, firing clearance,
patrol crossings and migration. Pad and box count separately (two slots); their room loses drums.
Day 2 means the third raid onward (`S.raids >= 2` sent as `raids` at launch), avoiding a real-time
wait. No old save can prove it saw a pre-feature pad, so migration preserves explicit seen flags
and leaves every otherwise-unseen profile eligible.

### collapsing-shelf-lane

`v2.28.50 collapsing shelves`: safeguards the fourth-raid Bunker L2 gate and FTUE exclusion,
shared interactive cap, clear active-patrol crossing, final-footprint flood-fill proof to every node and exit, ordinary projectile
hit path, tuned warning/fall timing and impact damage/stun, and movement-only low cover that
allows both sides to shoot over it. The exact calm first-sight BIT line must ride `round.bitSeen`
back to the existing profile ledger. Mutation fixtures remove each contract individually;
`nodspel/tests/collapsing-shelves.test.mjs`, `shelf-intro.test.mjs` and root `shelves-bit.test.js`
exercise the real simulation, placement and persistence behavior.

### v2.28.52 — One clear FTUE path

Thirteen `ftue-*` contracts guard the playtest fixes: direct Core after wake; deferred raid narration while BIT sleeps; base Fabricator briefing; one Fabricator extraction action; direct build without activation; reward after its cutscene; quests after Vault; base Vault briefing; and labelled affordable BUILD. Negative fixtures live in `test/bug-lint.test.mjs`; state transitions and a real browser walk verify the runtime order and migration.

The `ftue-resume-held-room` contract also preserves explicit incomplete Vault scene flags during migration, so reloading a paid build resumes the scene without paying again.

### v2.28.52 — World map label gap

The base QA group reproduced a small selected-Bunker/new-Archipelago label overlap at 844x390. The compact label sits eight pixels higher; the camera, map and artwork are unchanged. `worldmap-new-label-gap` rejects the former CSS offset, its fixture proves the rejection, and the browser layout regression now requires a visible gap between the labels.

The wake/Core contract covers both the live result and a reload after result ingestion but before wake. Behavioral tests also require unfinished base briefings to resume on boot.

`ftue-legacy-quest-access` preserves the prior flow for imported/returning profiles whose original FTUE is complete, or whose Fabricator/quest progress already proves that point. New profiles retain their explicit one-path flag through the Vault. The state-machine test covers both migration branches.

`ftue-quest-return-intro` guards the real extracted-raid return: after Vault, closing the next homecoming summary introduces quests. The browser walk deploys and extracts a third raid, checks that its launch has no quest parameter, then asserts that introduction and Power Trace appear in order.

`ftue-sleeping-bit-voice` guards ambient raid event narration as well as cards: kill/pickup/bag/heal/hunter/extraction/result voice requests are suppressed in the pre-wake raid, with SFX unchanged. A dispatcher regression exercises both sleeping and awake launches, and the browser walk observes voice requests in raid one.

### v2.28.52 — Enemy label clearance hold

The full layout sweep reproduced Town level-three enemy-label flicker at all three landscape sizes. Loot/room label collisions hid enemy labels outside the existing 1300 ms clearance gate. Those collisions now enter the same gate as HUD/objective collisions: hide immediately, show only after sustained clearance. The rendering regression exercises temporary loot clearance and the bug-lint rule rejects the bypass. No camera or art changes are involved.

FTUE base briefing polish (v2.28.54): `base-bit-card-clears-rooms` requires measured placement around room labels, hitboxes and the goal chip, plus browser layout assertions for Fabricator and Vault at all three phone sizes. `base-briefing-single-cost` keeps one fresh BIT line and one data-derived material strip, without the drum joke or a second have/need cost row. `core-restore-lights-base` prevents Fabricator construction from gating the powered lighting tier. Regression coverage is in `test/ftue-one-path.test.js`, `test/ruined-bunker.test.js`, both browser briefings and the negative bug-lint fixtures.

The v2.28.54 ready-to-build Vault regression also checks the compact narrow-screen card footprint and joint placement of BIT and the BUILD chip when neither fits beside the other's default position. `test/base-goal-placement.test.js` reproduces the measured 667x375 geometry with all room hitboxes, and layout-check tests both unaffordable and affordable briefings. The shared raid card retains its existing size.

The base-card rule also guards the optional DOM event subscription: app logic and the measured placement regression load without a full browser window, so the listener must tolerate missing window/addEventListener. Both existing test harnesses reproduce the handoff compatibility failure when that guard is removed.
