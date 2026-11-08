# Big Archipelago – readable enemy archetype variety (Issue #213)

**Status:** Candidate PR for player and CI review. Do not merge before the player reviews the new early combat pacing.

## Observed problem
During the Bungenäs Military Remnants mobile playtest, the player mainly encountered familiar patrol/grunt enemies. The larger Archipelago layout generated one `type:'grunt'` actor for **every** graph room, so the existing rusher, sentry and artillery GLB models were visible mostly in special POI encounters.

This is a **visual/readability and choice problem**, not simply a request for more enemies or higher damage.

## Minimal change
Retype a carefully limited subset of the **existing** basic Big Archipelago enemies after all authored POIs have been placed. Do **not** add bodies, loot, spawn groups, projectiles, special effects, new models, or adjust global damage / HP / per-room counts.

Depth is shortest graph-path distance in doors from the start island:

| Depth | Allowed new basic silhouette | Combat read |
|---|---|---|
| 0 (spawn) | Grunt only | Orient, recognize controls, first readable encounter |
| 1 | Sentry / sniper (existing static long-range enemy) | Identify a fixed firing position, move behind cover |
| 2+ | Rusher (existing telegraphed four-leg charger) | Move laterally, avoid or punish charge |
| 3+ | Thrower / artillery (existing warning ring and lob) | Abandon the dangerous spot before detonation |

The first eligible room at each depth threshold guarantees a silhouette when possible. Other regular enemies use a **seeded, depth-aware** selection, capped at **five non-grunt base enemies** and approximately 45% of eligible ordinary defenders. Existing special POI enemies keep their authored types, positions, shields and tuning.

No scaling based on the player's gear, deaths, damage dealt, achievements or detection. Uses the already authored `RULES.enemyTypes` movement/range/cooldown modifiers and GLB mappings; HP, room assignments, position, enemy count, activation and raid depth are unchanged.

## Player test
Play seeded **Big Map Archipelago**, prefer High first:

`?area=archipelago&levels=big&polyfork=1&polyforkMode=military&q=high&seed=big-enemy-variety-7`

Compare the same seed on `main` and the PR. Look for (1) discernible silhouettes as the first islands are explored, (2) at least two genuinely different tactical choices, (3) no sudden first-room difficulty spike, (4) clear charger wind-up and artillery warning, (5) good performance and no model-loading delay.

## Acceptance / release gates
- [ ] CI seed tests pass: 32 levels reproduce exactly; Bunker/standard levels unchanged.
- [ ] Normal enemy counts, HP, coordinates, POI types, doors, loot and extraction unaffected.
- [ ] Unassisted mobile screenshot, plus seeded sentry/rusher/artillery in the real phone raid camera.
- [ ] Telegraphed attacks remain readable; no off-floor movement/collision, especially on bridges.
- [ ] Owner confirms that the first few islands feel **more varied**, not simply harder.
- [ ] GitHub CI and dedicated visual workflow are green on latest head.
- [ ] No merge before explicit approval.

## Deliberately excluded
No new GLBs, tank/scout/healer AI, extra waves, changes to enemy hitboxes, FTUE, generic level (non-Big) spawns, Bunker, Town or Military Remnants geometry. These require separate combat and performance reviews.
