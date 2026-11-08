# Military Remnants — Bungenäs exterior fortifications (Pass 3B)

**Status:** Mobile-reviewed and approved for default Archipelago on 8 November 2026. **Default:** Military Remnants combined with Coastal Life, forest and granite. The original comparison modes remain available. **Visual references:** supplied photos of Bungenäs, Gotland: overgrown rectilinear concrete foundations, partially buried coastal defence pillboxes and bunker doors in granite/tall pine landscape.

## Creative decision (owner, 8 November 2026)

Military Remnants is **architecture and headland first, not a scatter of generic military equipment**. Low, partly buried concrete, water stains, moss, granite rubble, dry coastal grass and subdued gray-green material values. The iconic Swedish coastal-defence silhouettes matter from the gameplay camera. No flags, NATO emblems, glowing fantasy technology or new HUD.

Separate future work: **a large sealed/cut-into-rock aircraft hangar with a derelict, weathered camouflage Saab 37 Viggen** belongs *inside the Bunker area*. This is explicitly NOT part of the current archipelago pass and remains unimplemented.

## Implemented exterior forms

1. **Coastal pillbox** — partially buried low circular/rounded-roof concrete position with a dark horizontal observation/firing slit and fractured stony berm.
2. **Overgrown foundations** — low orthogonal and zigzag concrete strips with open sky, weathering and pale moss, taking inspiration from the maze-like first reference.
3. **Sealed rock-cut portal** — closed dark steel door framed by concrete and granite rubble; not an accessible area, door, loot object or game promise.

The geometry is **generated locally** from instanced low-poly boxes, angular granite, a 10-sided rounded pillbox roof and restrained moss/grime. No new GLB model, remote licensing or player-facing images required. On LOW, preserve primary silhouettes and remove decorative detail. On HIGH, use additional scattered rock and roof lichen but remain mobile-conscious. The forms vary deterministically with the seed. Following a mobile playtest in which the first ruin was missed, we now allow up to **four coastal fortifications in standard multi-island raids or six in BIG MAP** (maximum two distinct, safely spaced sites per island), prioritize the starting island and require the first ruin to have a recognizable pillbox/portal silhouette. Adjacent companion outworks may be low foundations or broken retaining walls; procedural grass, lichen, dry moss and sparse saplings reclaim the concrete. This variation is deterministic for the same seed.

## Safety / scope

- **Default:** ordinary Archipelago raids automatically use `military` with Coastal Life/forest/granite; no URL flags required. `polyforkMode=coastal` restores the earlier scenery for comparison; `polyforkMode=profiles` and `polyforkMode=scatter` remain explicit alternatives. `polyfork=0` disables all Polyfork dressing. Bunker/Town are unaffected.
- Choose safe exterior **seaward cliff shelves**, beside but beyond the authored walkable island rectangles. Buildings extend *away* from the island into the existing rocky coast and are not walk-through fake cover. Reject locations crossing any room, bridge, landward approach, prop reservation, exit, pickup or enemy spawn.
- Bury the supports in surrounding granite; avoid hovering and z-fighting. Rocky shoreline colliders are intentional headland material, not blockers in the non-playable strip.
- The Bungenäs ruins remain **visual-only** outside playable floor rectangles: no new ruin collision, projectile blockers, AI, missions, camera, terrain, water or weather. Clusters have a minimum 6 m center-to-center separation and a maximum two sites per island. Perimeter geometry is kept inside the verified non-playable shore footprint.
- **Separate observed Big Map bridge defect fixed in this PR:** BIG Archipelago corridors inherited 1.8 m Bunker widths. They now use 4.2 m logical corridor floors, wall mouths, bridge meshes and matching AI graph metadata. Bunker Big Map remains 1.8 m.
- Existing collidable brown crates on islands are **reskinned, not removed**, to old mossy concrete cover in the default `military` composition. Their collision rectangles remain identical; explicit `polyforkMode=coastal` retains the original crates for comparison.
- Forest/Granite/Coastal Life stays as base composition with reduced density to keep item budgets HIGH ≤125 and LOW ≤40. The new architectural geometry is separately audited for instancing and draw calls.
- No dynamic lights; details should read under the existing nordic twilight exposure. Added vegetation is built from low-poly procedural instanced pieces. All ruin fragments share global batches by geometry/material, so adding complexes does not linearly increase draw calls.

## Validation and review gates

- [ ] Unit tests for seeded placement, hard exclusion of gameplay floors, safe reserves, multiple safely spaced outworks, LOW/HIGH identical silhouette, memory disposal and globally shared draw-call budget.
- [ ] `ci`, `ground-v2-khronos`, `coastal-life-preview`, `military-remnants-preview` all green at the latest PR head.
- [ ] Level 3 iPhone viewport captures show an identifiable concrete fortification in HIGH and LOW (not absent or invisible). Save the **unassisted first player view before teleport** as well as the close-up for both qualities. Record its position, distance from the spawn and screen projection. No texture or material regressions.
- [ ] Physical-device test confirms a fortification is discoverable from the starting island, not merely present after a teleport; no floating foundations. Verify that the actual widened Big Map bridges accept diagonal entries and Low remains >40 FPS.
- [x] User visually approved the Bungenäs exterior on a physical phone on 8 November 2026, then explicitly requested it be enabled by default.

## Test URL

**Normal/default raid:** `?area=archipelago&q=high&seed=military-qa-01` (no military flags). The older explicit `polyforkMode=military` remains equivalent.

Compare the same seed with `polyforkMode=coastal` and LOW. For the focused screenshot, CI launches Level 3 using `MILITARY_FOCUS=1` on an 844×390 mobile viewport.

## Explicit exclusions

No Viggen, hangar interior, usable bunker door, ladders, playable tunnels, loot, new destructible cover or large road infrastructure. Those require separate level design, collision, sightline, authored navigation and camera review.

## Pass 3C — richer Bungenäs clusters (8 November 2026)

**Playtest feedback:** Structures are visible more frequently but the environment still feels sparsely military. Increase the presence of the same coastal-defence language without replacing established scenery.

- Up to four ruins in standard raids, six on Big Map; at most two sites per island, separated by at least 6 m.
- Select one distinct pillbox or portal first, then vary subsequent outworks among foundations, portals and pillboxes; use safe coastal shelves only.
- Every site gains broken concrete perimeter fragments and small moss, lichen, dry-grass/heather patches; HIGH optionally adds a tiny reclaimed sapling.
- Share instancing across the entire group of ruins to control mobile render cost even with higher site counts. Use identical gameplay-safe primary silhouettes in HIGH and LOW.
- Keep Coastal Life assets and composition available; originally gated enabling military mode by default on a second physical-phone playtest. This historical gate was satisfied by player approval on 8 November 2026 (see Pass 3D).

### Re-review on phone

Check whether fortifications appear naturally in the first part of an ordinary raid (not just after a debug teleport). Compare at least two seeds in HIGH and LOW, verify bridges/cover and watch for floating/overlapping meshes or noticeable frame-time spikes. CI must be green for the latest commit, not a prior successful SHA.

## Pass 3D — normal Archipelago default (8 November 2026)

**Decision:** Promote the mobile-approved Bungenäs Military Remnants experience from an experimental query parameter to the ordinary Archipelago visual configuration. Preserve all deterministic seeding, safe placement, visual-only geometry, HIGH/LOW budgets, native/Polyfork locality, and explicit opt-out modes. The same coastal defence architecture and mossy concrete cover that Robert tested are now loaded with no special flags.

**Launch contract:** `archipelagoDressingConfig({area:'archipelago'})` returns `mode:'military'`; other areas remain disabled. `?polyfork=0` disables all optional dressing; `?polyforkMode=coastal` remains a regression comparison. The iPhone Military Remnants preview workflow must capture the default launch without `polyforkMode`; the Coastal Life preview explicitly selects the original coastal mode. This is a visual-default change, not a raid geometry, enemy, loot, or collision change.
