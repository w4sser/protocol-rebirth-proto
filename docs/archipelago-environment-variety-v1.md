# Protocol Rebirth — Archipelago Environment Variety v1

**Status:** Design specification / approved direction, not implemented  
**Date:** 2026-11-06  
**Owner:** Environment art + gameplay engineering  
**Related:** [Polyfork asset evaluation](polyfork-asset-evaluation.md) · [Draft PR #202](https://github.com/w4sser/protocol-rebirth-proto/pull/202)

## 1. Goal and why

Make the Swedish-archipelago raid feel like **a place worth exploring**, not an evenly scattered prop field. Build from the positive phone playtest of the 56-model Polyfork evaluation branch: the aesthetic looks good and the player reports satisfactory performance on their phone. That report is qualitative, **not** a measured FPS result.

The next gain should come mainly from **authored-feeling composition and variation**, not simply raising total asset count.

**Desired emotional direction:** *Dark, but never hopeless.* Swedish summer night, saturated yellow-green grass and moss, cool grey granite with selective violet undertones, pine silhouettes, calm water, warm isolated windows or lamps. Maintain the existing low-poly readability and game camera.

### Non-goals

- No replacement of the ground material, organic coastline, water, terrain blend or existing bridge system.
- No new gameplay colliders or AI navigation behavior as part of decorative dressing.
- No architectural overhaul or rework of bunker assembly in this pass.
- Do not ship or redistribute standalone Polyfork GLBs before the licensing/hosting decision.
- Do not turn the world into a dense forest at the expense of combat visibility.

## 2. Four environment identities

An island or large subregion has one **dominant profile**, with small transition zones and optional landmarks. Profiles control asset weights, placement patterns, open-space ratio, palette accents and one or two distinctive compositions.

| Profile | Intended feeling | Characteristic dressing | Gameplay readability |
|---|---|---|---|
| **A. Dense coastal forest** | Intimate, mysterious, lush | Pine clusters of different heights, birches sparingly, ferns, heather, moss, fallen logs, small granite rocks | Preserve purposeful clearings and 3–4 m readable combat lanes; limit canopy obstruction in the game camera |
| **B. Exposed granite** | Open, quiet, windswept | Large light-grey granite slabs, rock groups, sparse low bushes, occasional twisted pines, bare patches | Wide sightlines; rock masses act as silhouettes, not surprise invisible cover |
| **C. Abandoned coastal life** | Humans were here | Weathered red/yellow sheds where layout permits, old fencing, fishing nets, lobster pots, driftwood, narrow wooden structures, sparse warm light | Hand-place larger props in safe locations; leave shore access and bridge mouths unobstructed |
| **D. Military remnants** | Lost technological past | Small concrete pads, rusted cabinets and tanks, pipes, cable traces, warning markers, abandoned equipment, isolated work lights | Keep key objectives and loot legible; no new collision or LOS blockers from visual dressing |

**Mixing rule:** one dominant identity per playable island/region, with a secondary accent occupying at most ~20% of decorative placements. Avoid four unrelated themes evenly mixed on every island. Do not assign military props everywhere: they should be story landmarks.

## 3. Composition rules (more important than prop count)

1. **Clusters, not uniform noise.** Divide each island into a small number of seeded composition zones: tree stands, rock outcrops, scrub edges, shoreline details, and open clearings. Apply correlated placement within each zone rather than independent random samples everywhere.
2. **Preserve negative space.** At least ~35% of the playable interior should read as relatively open from the raid camera. This is an initial art target to validate with screenshots, not a physical collision guarantee.
3. **Large → medium → small.** Place 1–3 signature forms first, then medium dressing, then sparse ground details. Avoid adding dozens of tiny objects in the hope of creating structure.
4. **Natural transitions.** Use broad, irregular zone edges and a gradual asset-weight mix. No hard biome squares, no visible rectangular scatter limits.
5. **Shoreline follows geometry.** Coastal dressing follows the existing organic coastline profile. Favor granite over sand overall; cluster driftwood and reeds only in appropriate pockets.
6. **Landmarks carry story.** A single abandoned shed, antenna or concrete utility point is more effective than repetitive industrial clutter. Architecture placement is curated and conditional on level layout.
7. **Readable silhouettes.** Inspect at actual game zoom on a phone. Keep tree crowns, dark vegetation, loot colors and enemy outlines distinguishable.
8. **Variation is seeded.** The same level seed + profile version produces the same layout. Restarting cannot produce different cover-adjacent dressing or floating items.

## 4. Proposed deterministic placement system

Do not hard-code environment logic into the large game module. Extend the current opt-in `nodspel/polyfork-dressing.mjs` with separate pure-data planning helpers, and keep rendering and asset loading separate.

```text
level seed + existing floors + organic coast profiles
    -> island / region descriptors
    -> weighted environment identity (A/B/C/D)
    -> reserved gameplay clearances
    -> major composition zones and landmark candidates
    -> medium vegetation/rock clusters
    -> low-cost ground and shore accents
    -> quality budget + deterministic thinning
    -> instanced, visual-only render meshes
```

### Region selection

- Use seeded stable hashes for island profile selection. Bias toward Forest and Granite in first pass; Coastal Life is rarer and Military Remnants rarest.
- Suggested **starting weights** for testing, not final balance: Forest 40%, Granite 35%, Coastal Life 15%, Military Remnants 10%.
- Keep visual identity stable across HIGH/LOW: thin detail but preserve major silhouettes and landmarks.
- For tiny islands, avoid full architecture; use a simple forest/granite identity.
- Record assigned profile per region for debugging and screenshot comparison.

### Placement and gameplay safety

Reuse `propReservations()`, `bridgeClearances()`, coastline sampling, objective/loot/start/extract/enemy spacing and the existing wall footprints. Conservatively enlarge clearance by each candidate's projected horizontal radius and a gameplay buffer.

- **Never** put decorative props on bridge walkways or approach funnels.
- **Never** visually conceal critical targets: extraction, node terminals, loot crates, enemy arrival paths or telegraphs.
- Decorative trees/rocks must not impersonate physical cover. If a large rock seems solid enough to block movement or gunfire, either place it outside reachable play space or route it through a separate explicitly reviewed collider/cover feature.
- Maintain camera readability and not just technical passability: no wall of trees in front of the player at the standard viewing angle.
- No boats by default. Any coastal story scene involving boats requires a separate art approval.
- Visual-only objects must not be included in physics, AI pathfinding, combat raycasts, or cover calculations.

## 5. Asset selection and color

Use `nodspel/polyfork-catalog.mjs` as the **candidate registry**, not a blanket approval list. Review all 56 candidates in `polyfork-preview.html`, but place only a subset suited to the current region and budget. Avoid tropical or vacation-oriented props.

For each approved item store:
- Polyfork ID and category
- intended profile(s), authored height, expected footprint and Y offset
- art notes/palette correction requirements
- estimated triangles / number of mesh parts / material count
- HIGH and LOW spawn weights, landmark-only flag
- test status and screenshot reference

**Art guardrails:** retain lime/moss green vegetation, grey granite with cool-violet variation (not bright purple stones), weathered red/yellow buildings, warm window glow, cyan for BIT/system UI, amber for loot, coral for danger. **Never** allow purely decorative objects to compete with these gameplay signal colors.

## 6. Mobile performance and fallback

The current opt-in raid test limits Polyfork placements to **125 in HIGH** and **40 in LOW**. Treat these as provisional *upper bounds*, not target densities or evidence of GPU safety. Actual cost depends on distinct GLBs, submesh draw calls, triangles, materials and texture use.

- Maintain existing **LOW >40 FPS** performance target on the agreed test phone. Also record HIGH/LOW FPS (median and worst 1% over a repeatable route), first-load time/hitches, mesh counts, triangles, textures and draw calls.
- Prefer instancing repeated submeshes and caching geometry/materials. Draw-call growth matters more than raw instance count.
- On LOW, retain profile signature and major forms; thin grass/ferns/debris first, reduce shadow casting, avoid expensive transparency and overdraw.
- Set limits on **unique models per loaded level** and per material/draw-call budget, not only on instance count. Establish numeric caps after first measurements.
- Failed CDN loads must not block gameplay; fallback is no new object. Record failed asset IDs.
- Profile and density should remain opt-in behind a clear test parameter until tested and approved.
- Decide asset delivery for production separately: remote CDN dependency vs licensed embedded game delivery. The catalog's use permission is **not** permission to mirror an asset library in a public Git repo.

## 7. Implementation passes (small PRs)

| Pass | Work | Visible result / review gate |
|---|---|---|
| **0 — Design lock** | This document, baseline screenshots, reference seeds, candidate shortlists | Agreed profiles, rules, sample seeds, quality targets |
| **1 — Regions** | Pure seeded region/profile assignment, debug overlay and unit tests | Same seeds always have same profile; no impact with flag off |
| **2 — Composition** | Cluster generator and intentional open clearings, forest/granite only | Two visually distinct islands with same playable layout |
| **3 — Human traces** | Curated coastal-life/military landmarks, silhouette and distance checks | Rare believable story moments, not clutter |
| **4 — Polish** | Shoreline blending of detail placement, art colors/scales, HIGH/LOW thinning | Phone screenshots show natural gradients and visible loot/enemies |
| **5 — Ship gate** | CI, target-device FPS, cross-origin/asset availability, licensing/hosting, visual review | Explicit approval before merge / enabling by default |

Each pass should preserve gameplay layout, bridge widths, shore blending and current world lighting. No unrelated HUD or combat edits.

## 8. Test protocol and acceptance criteria

### Comparison matrix

Use one fixed archipelago seed for baseline and 2–3 additional seeds chosen for variation. Capture identical camera routes and spots in:
- Existing environment: `polyfork=0`
- Current 16-type Polyfork baseline: `polyfork=1` on PR #202
- New profile experiment: a *new* explicit opt-in version flag, once implemented
- Each of the above where meaningful in `q=high` and `q=low`

### Must-pass

- [ ] Forest vs Granite areas are recognizable within ~3 seconds from the raid camera.
- [ ] Coastal Life and Military Remnants feel rare, intentional, and consistent with abandoned Swedish archipelago.
- [ ] No visible rectangular biome boundaries, harsh prop distribution bands or repeated obvious patterns.
- [ ] No visual blockage of bridge entrances, objectives, enemy telegraphs, or loot.
- [ ] Same seed always produces identical profile and placement data.
- [ ] FPS meets target on agreed low-end phone; first spawn of a new asset type does not cause unacceptable gameplay hitch.
- [ ] LOW preserves overall identity without overloaded draw calls.
- [ ] Failure to load any model leaves the raid playable.
- [ ] No main build or existing terrain/coast behavior changes when flag is disabled.
- [ ] CI and tests pass; licensing and hosting reviewed before production.

### Review questions

1. Can you tell where you are without looking at the minimap?
2. Does this feel like Nordic summer night rather than generic forest?
3. Can you still read combat, traversal and loot at mobile zoom?
4. Which assets look out of place, duplicated or too large?
5. Does each environment contain one memorable view or landmark?

## 9. Decisions already made vs open decisions

**Decided:** four identities, organic cluster-based composition, seeded layouts, gameplay-safe decoration, mobile-first optimization, optional rollout, current ground/shore/bridges untouched, explicit visual review before merge.

**To validate:** final weights, scale and color per model, density and unique-model budgets, number/placement of authored landmark scenes, LOW FPS on test devices, production GLB hosting/licensing.

**Sequence:** review and land this spec **before** implementing profile generation. The existing PR #202 remains a separate experimental baseline; this document does not claim the next pass has been built.
