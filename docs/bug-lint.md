# Every bug fix adds a lint rule or a test

Convention (since v2.22.5): a PR that fixes a bug also adds a guard that would have caught it.

- Prefer a **static rule** in `scripts/bug-lint.mjs` (cheap, runs in `npm test` via `test:bug-lint`). Each rule has `id`, `pr` (the PR/bug it guards) and `why`.
- If it can't be caught statically, add a **cheap unit test** (`test/` or `nodspel/tests/`) and reference the PR in a comment.
- Per-frame allocation regressions belong in `scripts/hot-alloc-lint.mjs` (`// @hot` headers).
- Add a fixture case in `test/bug-lint.test.mjs` so the rule is proven to fire.

Current rules: no tracked node_modules (#129), ogg/m4a audio pairs (#162), cache-busted local imports (#154), CI scripts stub FTUE direct launch (#173), transparent DoubleSide single-pass (#178), single APP_VERSION (#69), medkits independent of the BIT/regen heal budget (v2.25.1; plus nodspel/tests/stakes.test.mjs regression), raid spawn validated via nodspel/spawn.js safeSpawn (v2.25.1; plus nodspel/tests/spawn.test.mjs over areas x hard x depths x seeds), perk choice touch targets keep a 44px floor and the debug demo does not auto-close mid layout-check (v2.28.0).

Artillery FX first-use hitch (#196): `artillery-fx-prewarm` requires `makeArtilleryShell`/`makeToolFxRing` plus an init pre-create of 1 shell + 2 landing rings so `prewarmShaders()` compiles them at level load (plus `nodspel/tests/bridge-artillery.test.mjs`).

AI Fragment drop rate (v2.25.1): not a static bug (it was in the L2/L3 tables, just rare: ~0.23 per full-clear bunker L2+L3 raid). Guarded by `nodspel/tests/ai-fragment.test.mjs` (seeded drop sim), not a lint rule.

Playtest 2026-11-08, item 5: raid result "Continue raid" read as secondary (outline) while "Return to base" read as the primary orange action -- backwards from the push-your-luck framing the owner wants. Fixed with a dedicated `--ad-continue`/`--ad-continue-edge` token pair (an explicit, documented exception to orange-is-primary, scoped to this one CTA) and `.result-continue` in `nodspel/style.css`; `return-base` now carries `.result-secondary`. Not a static rule (it's a one-off visual exception guardrails already lets through); guarded by a `nodspel/tests/raid-result.test.mjs` regression that checks the class wiring and that the token backs it (no raw hex).

Playtest 2026-11-08, item 4: nothing blocked a freshly loaded bunker level while the world was still assembling, so a level transition could become interactive (and the raid clock could tick) before the player had gotten their bearings. Fixed with a blocking "BUNKER LEVEL N" title card (`nodspel/level-intro.mjs` + `showLevelIntro()` in `game.mjs`) shown via the same `pausePick`/`resumePick` clock-freeze already used for the perk picker; `tickRound` itself refuses to advance while `round.pauseAt` is set, so the timer can't tick underneath the card. Archipelago/town (`level.big`) have no discrete level number and never show it. Guarded by `nodspel/tests/level-intro.test.mjs` (pure title/duration checks, a `tickRound`-freeze regression, and a `vm`-extracted test of `showLevelIntro()` itself).

Playtest 2026-11-08, item 2: the top-left bag/NEED-materials HUD (backpack count, tool slots, upgrade material chips) sized its chips and spacing the same regardless of viewport height, so on a short phone landscape screen (844x390, 667x375) a full bag plus a multi-part upgrade goal could stack to over 40% of the screen. Not expressible as a static rule (it's a real rendered-layout measurement); guarded by `scripts/layout-check.mjs`'s `raidGoalCompactRun` (a new `@media(max-height:500px)` rule in `nodspel/style.css` shrinks `.item-tile`/`.need-tiles`/`#raid-goal` and widens `.bag-panel` slightly so chips wrap into fewer rows -- landscape phones have width to spare, not height) plus a debug-only `window.__NR.bagDemo()` hook so the check can fill the bag without playing through pickups.
