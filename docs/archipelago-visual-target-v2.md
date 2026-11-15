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

## 15 Nov 2026 — Fundamental movement constraint: terrain is planar (P0)

The owner noted that rocks stood directly at the far end of a bridge and asked whether the operator can move in elevation. Code inspection confirmed that `physics.mjs` player movement and `archipelago-playable.mjs` walkable-floor checks are entirely X/Z-based: there is currently no slope/step climbing, height navigation or vertical collision for traversable level geography. Therefore **large granite mountains are visual boundary landmarks around the island, not climbable obstacles on the playable floor**.

The latest v2 implementation removes the tall interior geological partition meshes, preserving gameplay-significant internal cover as shorter, clearly man-made coastal-defence concrete structures whose collision matches their render footprint. Actual shoreline bedrock remains outside the organic playable boundary. A rock-free buffer around each bridge is expanded by 4m along each end and is shared by bedrock placement and interior cover filtering, keeping both bridge mouths visually and physically clear. This affects only `archVisual=v2`, never default Archipelago. Verify both HIGH/LOW 844×390 game-camera captures, all bridge traversal, seed invariance, and low-end hardware before visual approval. PR #247 is not approved for merge.

### Bridge landing combat-cover follow-up
The first regression run for the perimeter-only rule detected unintended removal of all level-two cover: rejecting an entire obstacle when just one portion touched the extended rock-free zone was too aggressive. The final code distinguishes **extended tall-granite exclusion zones** from the **shorter physical landing clearance**. Actual interior partition segments are clipped against the physical landing (with actor margin), retaining nonconflicting man-made cover and exact visible colliders. Added bridge crossing movement assertions on top of X/Z floor and collision checks. Both exclusion policies are independent of terrain elevation and keep the standard gameplay camera unchanged.

### Screenshot-driven cover composition correction
Actual HIGH 844x390 capture confirmed that the taller granite was removed from bridge approaches and the crossing was open, but its substitute concrete pieces looked like two straight, long walls. The cover generator now uses **one or two compact (max 2.15 m) offset concrete remnants** per unaffected partition run, rather than filling the entire wall segment. The generated collider is exactly each visible remnant's footprint and the physical bridge landing is still an exclusion zone. This intentional change opens more lateral combat movement instead of retaining the old partition as an artificial wall. Recheck enemy movement and camera readability before approval.

## 15 November 2026 — Pass F: Continuous coast integration for final visual gate

The opt-in v2 coast now uses one indexed ice-worn granite geometry instead of three self-intersecting terraced oval shells. Shoulder forms have deliberately low-frequency asymmetry, broad faces and a shifted crown, with no extra apron mesh. The existing coastal shell rises higher **only between the actor seam and the water edge** near major granitic headlands; the ground seam and sea-water edge remain unchanged. Its material shares a larger mineral-root gradient with the flat ground around granite concentrations, without adding vertical traversal or collision planes. Both quality modes retain the same rock geometry; LOW still uses reduced decorative dressing. This is not automatically accepted as visual parity: the actual 844×390 raid cameras (HIGH and LOW), route tests, browser errors, seam/z-fighting checks and performance determine approval.

The owner has authorized merging PR #247 **only if** the next version is visually convincing and test-clean. If the screenshot or release gates fail, keep it open as a draft and document the gap.

## 15 November 2026 — Pass I: Width-independent granite cliffs

The prior target-island capture remained too close to a flat green island bordered by a smooth pale stone wall. Root cause: the integrated-cliff elevation was scaled down by the *amount of additional offshore radius*, so the mandatory water gaps and bridge reservations suppressed the rock heights. In the new v2-only hero coast, cliff elevation follows a separately authored local rock mask. The shoreline footprint still respects all neighbor and bridge constraints, while 14 radial rings form a single contiguous low-poly coastal mesh: flat ground seam, material transition, broad weathered crest, faceted sea-facing granite and underwater toe. Offset radial fault lines and three unequal cliff profiles disrupt the evenly spaced barrier silhouette. Higher contrast lavender and blue-grey stone exposure is restricted to raised outcrops, not the entire coast. The operator still walks only on flat X/Z gameplay ground; no cliffs or new vertical colliders are traversable. Tests explicitly enforce cliff elevation when width is constrained, a nonuniform coast, preserved bridge clearances and ground/shore seam parity.

**Approval gate:** Review same-seed 844×390 actual HIGH and LOW raid captures, bridge landing, boats, coastline under movement, full regression and target-device 40+ FPS. Do not merge PR #247 until visual quality matches the agreed reference; passing unit tests alone is insufficient.

### Pass J — Broad granite footprint with collision parity
A raised cliff drawn in a 0.65 m-wide shoreline band still reads as a steep man-made retaining wall. The target hero island now reclaims up to 2.5 m of **surplus organic shoreline** beneath prominent granite headlands while preserving the complete original authored rectangular gameplay area plus 1.10 m extra walkable clearance. This broadens the single mesh's rock crown and erosion shoulders. Registered X/Z movement bounds are regenerated from this final terrain profile, so the actor cannot invisibly pass through elevated scenery; physical bridge approaches remain explicitly protected. Default Archipelago and other islands are unchanged. Added regression checks for the registered actor boundary matching the flat ground/raised coast seam, preserved authored floor, bridge crossing, and broad rocky roots. This modifies the opt-in hero preview's extra coastal exploration space only; verify if the new border is too close to objectives before visual approval.

**Narrow-channel qualification (regression review):** The authored coast may already be restricted to roughly 0.19 m beyond the original rectangular gameplay footprint at an opposing island or bridge. The width-preservation rule NEVER reduces this pre-existing narrow corridor. Where there is surplus radial room, cliff roots may reclaim it only down to 1.10 m beyond the original footprint. The original authored floor remains fully walkable in every case. This distinction is now enforced by the target and integration tests; the earlier statement that every segment retained at least 1.10 m was inaccurate for pre-existing narrow sections.

## 15 November 2026 — Natural cover policy on islands (owner correction)

**No scattered concrete blocks on Swedish archipelago islands.** The owner rejected artificial freestanding concrete blocks outside military installations, including the substitute blocks introduced by the interior-rock cleanup. In the **opt-in v2 island environment only**, true authored internal partition cover and generic cover boxes now appear as a few isolated low glacial granite erratics and fallen coastal pine trunks/root balls. There are never long repeated stone rows or high climbable-looking interior cliffs. Each natural visual element retains exactly one matching authored AABB collider, is small/low and is excluded from bridge landing routes. Large carved granite formations remain at island perimeters, while concrete architecture is reserved for the bunker entrance or authentic utility structures. Default/non-v2 Archipelago is unchanged. Acceptance requires actual gameplay screenshots and collision/navigation regression checks before PR #247 is merged.


## 15 November 2026 — Pine silhouette and visibility rule (owner decision)

The opt-in v2 archipelago must use **four distinct Scots pine archetypes**, not identical trees rotated or scaled: low wind-beaten shore dwarf, broadly leaning coastal pine, tall sparse sentinel and irregular crooked pine. Alternate their silhouette families across seeded island-edge placements, vary yaw and scale independently, keep low and tall trees in the same level, and avoid neat rows or dense cover through the playable core. Pine forms use exposed, slightly bent trunks, asymmetric dark-olive crowns, coarse low-poly shapes and no spruce/Christmas-tree cones. Trees stay visual-only: they create no cover, height traversal or colliders.

**Isometric occlusion:** When a tree intersects the orthographic view ray to the Operator or nearby combat-critical actors/loot/nodes/extraction, fade that *individual* tree smoothly toward 22% opacity; restore opacity when the target is visible again. Other trees remain opaque. Avoid raycasting scenery and avoid per-frame whole-world intersections: sample only tree meshes at ~10 Hz, interpolate alpha between samples, cache per-tree fade materials, do not write translucent tree depth or cast opaque shadows while faded. Preserve LOW geometry simplification and readability at actual 844×390 gameplay camera. In v2, the older external Polyfork tall-pine, young-pine and birch GLB instances must be filtered from dressing so no undimmable high foliage competes with the procedural pine system; retain ground-level plants, stumps and fallen logs. Default/legacy rendering keeps those assets unchanged. Require a genuine foreground-camera fade-and-restore screenshot for HIGH/LOW, not only unit tests. Do not merge until gameplay screenshots and sustained phone FPS pass.


## 15 November 2026 — Pass K: asymmetrical glacial cliffs, no continuous seawall

Screenshot review of the playable 844×390 coast showed a long, near-uniform light-grey shoreline wall. Pass K edits **only the existing 14-ring hero coastline mesh**, not gameplay movement, bridge reservations, boat placement, coast profile dimensions, combat or other islands. The high shoulders now have broad low-poly fault facets, uneven angular crowns and discreet darker fracture lines, while stone exposure is concentrated at the authored headland masks. Mossy/olive bays stay green, the cliff crown looks more like granite embedded in the island, and the shaded ocean-facing toe remains joined to the waterline. The playable X/Z seam at ring 0 and submerged toe at ring 13 are unchanged, with no overlay skirt, scattered concrete or large rock in the interior. A targeted regression test checks the headland/bay relief and color separation plus identical collision seam.

**Visual review required:** compare actual gameplay-camera HIGH/LOW screenshots (bridge, coast and spawn) to the approved interactive visual target. Reject if the coastline still reads as a single retaining wall, if angular facets produce sawtooth peaks or white striping, or if geology pinches a bridge. CI and desktop Chromium captures are necessary but are not equivalent to physical phone FPS/visual approval. PR #247 stays draft until accepted.


## 15 November 2026 — Pass L: headland silhouette over uniform stone wall

Reviewing the Pass K HIGH screenshot against the earlier state showed too little visible improvement: the coast still looked like a continuous gray embankment. Pass L deliberately broadens **only the selected hero coastline headlands** (up to the existing neighbor-water-gap and bridge guards), changes their radial rock crowns to stepped terraces with tall seaward faces, and paints low-slope bays back toward dark olive/moss instead of pale gray. No new meshes, colliders, elevated gameplay floor, decorative concrete, or fake traversable mountains are created. The coastline remains one shared 14-ring indexed mesh and ring 0 stays exactly on the X/Z playable seam.

A new screenshot position targets the highest actual headland in the live raid camera in both HIGH and LOW, in addition to spawn/bridge/coast/boat views. **Approval requires a visible before/after difference**, not merely passing procedural tests. Keep draft and revisit shape if the cliffs still look like a continuous bank.


## 15 November 2026 — Pass M/N: distinct rock knuckles, greener planar terrain

The actual Pass L raid-camera images still showed a massive sloping gray ring under the Operator. Raising and tinting the same coast strip cannot achieve the target. **Pass M** sculpts separated low-poly granite knuckles in each headland (uneven main domes, secondary shoulder, small subsidiary spur and dark cleavage) and quiet, mostly sea-level coves between them. **Pass N** restricts the target island to **two major** headlands rather than a near-continuous chain of three; localized stone ground-color streaks now start almost at the actor boundary rather than covering broad areas of flat playable land. The player, combat, nodes and bridge landing remain on the flat X/Z plane; all raised granite remains beyond the real coast collision limit.

Test the actual 844×390 HIGH/LOW raid camera, not just vertex geometry: (1) broad green and readable middle, (2) substantial separate glacier-shaped rocky silhouettes at the perimeter, (3) no continuous pale concrete-like ring, (4) no z-fighting, waterfront interpenetration or stranded boats, (5) unchanged walkable bridge approaches and pine fade. The original visual target HTML is now captured in the same 844×390 viewport during screenshot QA for direct art-direction comparison. **Do not merge solely on green tests or desktop software rendering; physical phone FPS and owner approval still required.**


## 15 November 2026 — Pass O: rounded, weathered lavender granite, not retaining walls

Direct 844×390 rendering of the *original reference scene* finally made the mismatch objective: the target rocks are distinct, compact rounded pink-lavender masses with exposed shoulders and green ground between, while Pass N still forms a continuous tall dark-grey shoreline face. Pass O narrows the two headland angular footprints, lowers crown height toward ~2–3 m, broadens offshore root only where existing island/bridge gap guards permit, and uses lighter weathered lavender crown colors and darker seawards toes. No interior mountains or extra overlapping meshes. Do not assume parity from geometric tests: compare target-game-camera and actual raid-camera images side by side.

After hero-island parity is accepted, extend the same coast silhouette standard across the remaining Archipelago islands while preserving bridge clearance, water gap, seeded layout, LOW mobile budget, and unchanged combat/FTUE.


## 15 November 2026 — Pass P/Q: rounded perimeter domes and open vegetation apron

The target-vs-raid screenshot review identified a fundamental geometry difference: the reference uses compact, rounded, smooth-worn lavender granite masses separated by natural green land; the earlier raid shoreline still presented a long steep faceted wall. **Pass P** replaces the high, terraced radial cap with a dome-like curvature and interpolated periodic erosion so adjacent angular wedges cannot form conspicuous pointed teeth or a discontinuity at the 360-degree seam. The raised coast remains ONE indexed mesh with exactly flat actor seam and the same submerged outer toe; no extra intersecting cliff shells or interior mountain props. **Pass Q** restricts inward root intrusion (1.12 × local authored influence rather than 2.85), leaving a significantly wider, physically flat vegetated apron between the encounter space and bedrock.

These changes must be evaluated against the *actual reference game-camera capture*, not only against the previous raid. Required rejection criteria: long grey wall, angular comb teeth, narrow false elevations at bridge approaches, coverage of the character/enemies, and coast/water z-fighting. CI geometry and HIGH/LOW screenshot captures are required, plus real device FPS/owner review before merge.
