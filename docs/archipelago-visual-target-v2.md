# Archipelago Visual Target v2 — Nordic Summer Night / Glacial Islands

**Decision (14 November 2026):** Approved visual direction by product owner, followed by an explicit decision to stop using rectangular **playable boundaries** in Archipelago. Authored rectangular rooms are retained solely as temporary seed/encounter data; player and enemy movement must be constrained by the organic island profiles, not by the old room boxes. Combat, progression and bridge rules remain unchanged. This is the visual target for Archipelago only; Bunker and Town retain their own looks.

**Reference:** [Interactive Three.js visual target](../archipelago-visual-target.html) on main; its atmosphere and geological language are targets, not a pixel-perfect mobile promise. See [Art Direction v07](art-direction.md) and [Archipelago Environment Variety v1](archipelago-environment-variety-v1.md).

## Visual contract (locked direction)

1. **The island is the rock.** Its silhouette is a continuous, irregular, rounded glacial landform. Prefer organic oval or asymmetric large islands, headlands, scooped coves, short steep rock lips, and smaller sheltered inlets; avoid rectangular grass slabs with perimeter props. Coast, headland and isolated slabs must share one geological language and color family.
2. **Swedish archipelago without national markings.** Smooth glacial granite, wind-shaped coastal pines, heather, moss, grasses and quiet Baltic shore. Civilian/Cold War structures are weathered and partly buried in granite. No flags, crowns, emblems or explicit geography labels.
3. **Nordic summer night.** Lavender and pale coral in indirect light and water reflection, cold blue-grey shadows, muted teal shallows, subdued healthy olive/moss interiors. No purple grass, glowing rocks, neon cyberpunk, dystopian orange skies or monochrome gloom. The visual contract remains `Dark, but never hopeless`.
4. **Authored-feeling composition.** 1–3 major silhouettes per island, then middle forms, then sparse ground cover. Clusters, open view corridors, and approximately 35% readily readable walkable area. Nature is irregular; engineered concrete is geometric.
5. **Distinctive coastal defenses.** Sealed portals and pillboxes belong in/against granite slopes, not floating in the sea or scattered as freestanding props. They are non-interactive scenery unless separate gameplay work approves them.
6. **Mobile readability first.** Never bury the Operator, BIT, enemies, projectiles, loot, extraction markers, passages or combat telegraphs behind foliage or cosmetic rocks. Cyan/system, amber/reward and coral/danger color semantics are unchanged.

## Implementation and rollout

- `?area=archipelago&archVisual=v2&archTarget=1&seed=archipelago-v2-target&q=high` is the target-island test on the feature branch. LOW is the same URL with `q=low`.
- `nodspel/archipelago-visual-v2.mjs` owns seeded *visual* coast profile and modular shelf/headland data; `nodspel/archipelago.js` consumes it in the existing coast/water/ground pipeline. New geometry uses opaque, low-poly vertex colors. Existing core game assets, water shader, beach/shore texture, grass and other vegetation continue to work.
- The same seeded profile drives the **actual actor movement limit**, the rocky perimeter and the water distance-to-shore bake. The three must agree on the island outline. Geological shelves sit beyond the new playable coastline, have no colliders and must not impersonate cover. LOW retains the same main headlands and coves, with reduced geometric detail.
- `nodspel/game.mjs` applies the summer-night color rig only to Archipelago when v2 is enabled, including each level's fog reset. It cannot bleed into Bunker or Town.
- In the opt-in v2 pass, keep existing authored room data, placements, bridges, combat obstacles, encounters and loot, but **remove obsolete rectangular shore colliders** and extend player/enemy traversal to the deterministic organic shoreline. Physics uses the seeded coastline against actor-radius probes. Bridge deck clearances are preserved and neighboring islands cannot merge across their authored water channel. This is a gameplay-affecting geometry change and requires fresh reachability and bridge regression testing.
- No change to default live gameplay until the owner has compared old vs v2 in the **actual game** on a phone, and test/CI and performance gates pass. `archVisual=v2` is intentionally opt-in during evaluation, and can be disabled instantly by omitting it.
- This implementation is an **in-engine first target**, not a claim of parity with the reference's composition or phone performance. Review silhouette, coast continuity, model integration and color after gameplay capture. Continue with art iteration before generalizing further.

## Acceptance / measurable review

- [ ] A screenshot at 844 × 390 / standard iso immediately reads as a natural archipelago landmass, not a rectangle or circular disc.
- [ ] At least one target island has visible sculpted granite headlands, rounded shelves, a small cove and a sealed military remnant inset in rock; no national symbols.
- [ ] Coast mesh, water foam, ground overlay and visual rock lip stay coherent in HIGH and LOW with no visible seams, water clipping, z-fighting or floating boulders.
- [ ] Player and enemies can traverse the organic shore beyond their old rectangle, cannot enter open water, do not get stuck at bridge landings, and remain able to reach all objectives. No false visual cover near routes, obscured telegraphs, new gameplay objects or changed economy.
- [ ] Deterministic profiles and identical important silhouettes across HIGH and LOW for the same seed; visual scene leaves authored floors unchanged.
- [ ] HIGH and LOW are measured on actual phones, including sustained FPS, worst-frame pacing, draw calls, GPU memory, thermal throttling, and visual readability. Existing LOW >40 FPS minimum remains the initial gate.
- [ ] Team reviews the real gameplay screenshot before merging or enabling default v2.

## Follow-up after approval

Once this one target island looks right and performs safely, extend visual profiles across all islands, refine the granite/vegetation GLB kit and shoreline blending, then validate and expand **non-rectangular playable/AI boundaries**, including replacing the temporary rectangular seed graph with an island-native region graph when warranted. Do not conflate passing an art review with passing navigation QA.

### Open-world composition note (14 Nov owner feedback)

The archipelago must feel **expansive like the lighthouse intro**, not like disconnected tiny combat plates. Compose multiple scales of land: foreground playable headlands, near offshore skerries, distant muted land silhouettes and open water. Use the horizon and sea lanes to imply a wider archipelago while maintaining the camera's combat readability. Distant islands are scenery, not traversal promises. Do not use a dense ring of equal-sized rocks or symmetrical islets; favor varied mass and negative water space. The visual target must be judged from normal gameplay zoom and on the phone, not only in a pulled-back editor camera.

## 15 November 2026 — Owner visual reference refinement (P0)

The owner approved a new comparison image emphasizing **large stepped/sculpted stylised granite cliffs** (inspired by the clarity of Clash of Clans rock masses, not its geometry or IP) and an **almost mirror-still Baltic Sea** with small ripples and broad pink/lavender reflections of a Nordic summer-night sky.

### Opt-in implementation update, awaiting visual approval
- The major bedrock mesh now has broad, layered, gently rounded shoulders and flatter crowns, made from a single continuous indexed mesh and existing instancing. The coast/ground seams and actor boundary are unchanged. Rock color stays weathered blue-grey/lavender with soft warm highlights, not candy-pink.
- The v2-only `WATER_BALTIC` shading path uses near-static, broad procedural sky-colour bands, pink reflection and much smaller surface-normal perturbation. Its water remains one opaque mesh, one shore-map bake and no reflection render target. HIGH and LOW share the same sky treatment. Normal Archipelago retains its existing shader.
- Reflection is an intentionally cheap stylized **sky approximation**, not real reflected island/tree geometry. It must be visually checked on a phone before claiming it matches the owner reference.
- Preserve the approved feature flag, gameplay collision, deterministic island profiles, bridges and camera. This is an **iteration toward parity, not approved parity**.

### Remaining visual gates
- Capture and inspect actual same-seed 844x390 raid screenshots at spawn, bunker/shore, bridge and boats, both HIGH and LOW, alongside the owner target image.
- Confirm that major rock masses read as part of the island and that the sea reads as quiet Baltic water rather than flat plastic or an animated wave effect. Check shoreline joins, portal legibility, no false cover, low-end FPS and physical Safari behavior.
- If terrain still reads as a flat plate, prioritize a single composed hero island and connected geological transitions over further materials or scattered props. **Do not merge PR #247 before owner approval**.

## 15 Nov 2026 — Geological cleanup P0

Owner reported artificial wall-length rows of stones across gameplay land and z-fighting where adjacent island surfaces overlap, particularly beside a wooden bridge. V2 now discards obsolete straight shoreline/bridge-rail rock placement and its stale collider data; genuine interior partitions use a continuous glacial bank mesh with collider segments derived from that same geometry. Level, cover and bridge behavior must be regression-tested, including no invisible walls. The independently generated organic coasts are reconciled against a shared island-center bisector, preserving a positive water gap between both outer coast shells and deriving water-map, actor bounds, terrain and rock placement from those final coast profiles. Legacy rendering and default mode remain untouched. Verify the actual 844×390 screenshots and mobile performance before approving.

### Post-capture correction: faceted geology (15 November)
The first real gameplay-capture after removing repetitive walls passed targeted geometry tests, but showed smooth, sausage-like bank silhouettes for authored level-two partitions. Replaced the regular narrow ribbon with a wider, strongly irregular pair of faceted glacial shoulders and a lower saddle, still using one opaque vertex-colored mesh per wall segment. The raised center and its colliders are generated from the same sections; flat 2–3 cm erosion skirts blend visually into the walking ground without acting as extra blocking collision. No default-mode changes. Await same-camera comparison of HIGH and LOW before approval.

## 15 November 2026 — Pass E: replace smooth partition ribbons with isolated rock masses

Owner visual review of 844×390 raid screenshots found that the preceding terrain cleanup removed stone rows but still left two long, smooth, grey, sausage-shaped banks crossing the playable clearing next to the bridge. This is not the intended glacial-granite landscape.

Pass E uses 1–3 large, unevenly oriented, facet-shaded stone outcrops per actual interior partition segment. Each rock is authored as a separate buried solid, but assembled into **one mesh per partition** with a single material, so it does not reproduce the continuous ridge. Rock crests differ in height and shape; broad crowns use lavender blue-grey stone and limited lichen. Generated blocking boxes are three narrow slices of the mid-height polygon per rock, avoiding one invisible bounding rectangle across the whole formation. Rock skirts start below the gameplay plane; there is no flat extra terrain overlay. Deterministic generation, existing passage openings and the `archVisual=v2` flag remain unchanged. Acceptance requires new HIGH/LOW screenshots and route checks before merge.

### Gameplay screenshot correction — second sculpting pass
The first clustered outcrop screenshots still appeared as several long ovals arranged in a visible line beside the bridge. The latest iteration therefore reduces outcrops to one or two for most partitions; widens and offsets their footprints, increases faceted angular variation, and uses broader stepped crowns. Each remains a real cover mesh with three narrow collider slices based on its raised core; no invisible continuous original wall was added. Review 844x390 HIGH and LOW screenshots at the bridge before owner approval. This pass is not approved visual parity.
