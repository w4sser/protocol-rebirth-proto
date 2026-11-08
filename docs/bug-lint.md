# Every bug fix adds a lint rule or a test

Convention (since v2.22.5): a PR that fixes a bug also adds a guard that would have caught it.

- Prefer a **static rule** in `scripts/bug-lint.mjs` (cheap, runs in `npm test` via `test:bug-lint`). Each rule has `id`, `pr` (the PR/bug it guards) and `why`.
- If it can't be caught statically, add a **cheap unit test** (`test/` or `nodspel/tests/`) and reference the PR in a comment.
- Per-frame allocation regressions belong in `scripts/hot-alloc-lint.mjs` (`// @hot` headers).
- Add a fixture case in `test/bug-lint.test.mjs` so the rule is proven to fire.

Current rules: no tracked node_modules (#129), ogg/m4a audio pairs (#162), cache-busted local imports (#154), CI scripts stub FTUE direct launch (#173), transparent DoubleSide single-pass (#178), single APP_VERSION (#69), medkits independent of the BIT/regen heal budget (v2.25.1; plus nodspel/tests/stakes.test.mjs regression), raid spawn validated via nodspel/spawn.js safeSpawn (v2.25.1; plus nodspel/tests/spawn.test.mjs over areas x hard x depths x seeds), perk choice touch targets keep a 44px floor and the debug demo does not auto-close mid layout-check (v2.28.0).

Artillery FX first-use hitch (#196): `artillery-fx-prewarm` requires `makeArtilleryShell`/`makeToolFxRing` plus an init pre-create of 1 shell + 2 landing rings so `prewarmShaders()` compiles them at level load (plus `nodspel/tests/bridge-artillery.test.mjs`).

AI Fragment drop rate (v2.25.1): not a static bug (it was in the L2/L3 tables, just rare: ~0.23 per full-clear bunker L2+L3 raid). Guarded by `nodspel/tests/ai-fragment.test.mjs` (seeded drop sim), not a lint rule.

Shielded guard rear clearance (v2.28.1, playtest 2026-11-08): `shield-guard-rear-clearance` requires `applyEncounters` to end with `ensureRearClearance(level,rng)` so a front-shielded guard/shield_turret is re-checked after every solid (generator, terminals, other enemies) exists and relocated if its flank is boxed in; in the rare layout where no clear spot exists the enemy keeps its collision but loses its front shield (`rearBlocked`), so it can never be unkillable. Plus the seeded sweep in `nodspel/tests/encounters.test.mjs`.
