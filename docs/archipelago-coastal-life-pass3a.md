# Coastal Life — shoreline vignette Pass 3A

**Status:** experimental visual-only PR, pending CI and mobile visual review. **Base:** main after PR #203; independent from the timber-bridge PR #207.

## Goal
Introduce a believable human trace in the Swedish archipelago without turning every island into a themed park. One curated abandoned fishing or mooring vignette can appear along a sheltered shoreline cove in an opt-in experiment.

## Scope
- `polyforkMode=coastal` activates the new experiment only when `polyfork=1` and the level is archipelago.
- Retain the current forest/granite environment regions, clustered vegetation and 125 HIGH / 40 LOW instance budgets; reserve part of those budgets for at most three extra vignette objects.
- Place a small cluster of net pile, lobster pots, driftwood or bollard. No boat shed yet: a building needs separate collision/visibility review.
- Prefer sheltered cove sites in the organic shoreline band, outside rectangular gameplay floors, bridges, objectives, enemies, player start and exit.
- Deterministic placement and scene choice for a fixed seed; none for non-archipelago and single-island onboarding.
- Visual-only instanced meshes, no collider, pathfinding, water, ground or shore changes. No new assets stored in repo; reuse known Polyfork CDN IDs. Check licensing/CDN before shipping.

## Mobile test
Use a seeded multi-island raid (level 2 or higher), `?area=archipelago&polyfork=1&polyforkMode=coastal&q=high&seed=coastal-life-snapshot`. Compare with `polyforkMode=profiles` and `q=low`. Inspect `window.__polyforkPreview.stats.landmarks`, `loaded`, and `failed` in a debug browser.

## Review gates
- [ ] CI tests pass and no changes when flag disabled.
- [ ] A human recognizes a restrained fishing/mooring trace without feeling cluttered.
- [ ] No props float in open water or appear on walkable island floor; check HIGH and LOW shoreline variations.
- [ ] No translucent/fake cover, combat/aim blockage or lost bridge clearance.
- [ ] Same seed reproducible.
- [ ] Acceptable draw calls and real phone performance; LOW target remains >40 FPS.
- [ ] CDN/asset license reviewed before enabling by default.

## Deferred
Boathouse, red and yellow buildings, fencing and Military Remnants will follow only after a curated review. Keep these out of central combat and bridge approaches.
