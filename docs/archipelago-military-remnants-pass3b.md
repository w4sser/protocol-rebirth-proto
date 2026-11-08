# Military Remnants — Bungenäs exterior fortifications (Pass 3B)

**Status:** Draft experimental branch, pending CI and phone QA. **Default:** approved Coastal Life remains unchanged. **Visual references:** supplied photos of Bungenäs, Gotland: overgrown rectilinear concrete foundations, partially buried coastal defence pillboxes and bunker doors in granite/tall pine landscape.

## Creative decision (owner, 8 November 2026)

Military Remnants is **architecture and headland first, not a scatter of generic military equipment**. Low, partly buried concrete, water stains, moss, granite rubble, dry coastal grass and subdued gray-green material values. The iconic Swedish coastal-defence silhouettes matter from the gameplay camera. No flags, NATO emblems, glowing fantasy technology or new HUD.

Separate future work: **a large sealed/cut-into-rock aircraft hangar with a derelict, weathered camouflage Saab 37 Viggen** belongs *inside the Bunker area*. This is explicitly NOT part of the current archipelago pass and remains unimplemented.

## Implemented exterior forms

1. **Coastal pillbox** — partially buried low circular/rounded-roof concrete position with a dark horizontal observation/firing slit and fractured stony berm.
2. **Overgrown foundations** — low orthogonal and zigzag concrete strips with open sky, weathering and pale moss, taking inspiration from the maze-like first reference.
3. **Sealed rock-cut portal** — closed dark steel door framed by concrete and granite rubble; not an accessible area, door, loot object or game promise.

The geometry is **generated locally** from instanced low-poly boxes, angular granite, a 10-sided rounded pillbox roof and restrained moss/grime. No new GLB model, remote licensing or player-facing images required. On LOW, preserve primary silhouettes and remove decorative detail. On HIGH, use additional scattered rock and roof lichen but remain mobile-conscious. The forms vary deterministically with the seed. Following a mobile playtest in which the first ruin was missed, we now target up to **two distinct fortifications in standard multi-island raids or three in BIG MAP**, prioritize the starting island and require the first ruin to have a recognizable pillbox/portal silhouette.

## Safety / scope

- Opt-in only: `polyforkMode=military`; `coastal` remains the default and `profiles`, `scatter`, `polyfork=0` are unaffected.
- Choose safe exterior **seaward cliff shelves**, beside but beyond the authored walkable island rectangles. Buildings extend *away* from the island into the existing rocky coast and are not walk-through fake cover. Reject locations crossing any room, bridge, landward approach, prop reservation, exit, pickup or enemy spawn.
- Bury the supports in surrounding granite; avoid hovering and z-fighting. Rocky shoreline colliders are intentional headland material, not blockers in the non-playable strip.
- The Bungenäs ruins remain **visual-only** outside playable floor rectangles: no new ruin collision, projectile blockers, AI, missions, camera, terrain, water or weather.
- **Separate observed Big Map bridge defect fixed in this PR:** BIG Archipelago corridors inherited 1.8 m Bunker widths. They now use 4.2 m logical corridor floors, wall mouths, bridge meshes and matching AI graph metadata. Bunker Big Map remains 1.8 m.
- Existing collidable brown crates on islands are **reskinned, not removed**, to old mossy concrete cover only when `polyforkMode=military`. Their collision rectangles remain identical, removing distracting generic boxes without breaking gameplay.
- Forest/Granite/Coastal Life stays as base composition with reduced density to keep item budgets HIGH ≤125 and LOW ≤40. The new architectural geometry is separately audited for instancing and draw calls.
- No dynamic lights; details should read under the existing nordic twilight exposure.

## Validation and review gates

- [ ] Unit tests for seeded placement, hard exclusion of gameplay floors, safe reserves, LOW/HIGH identical silhouette, memory disposal and draw-call budget.
- [ ] `ci`, `ground-v2-khronos`, `coastal-life-preview`, `military-remnants-preview` all green at the latest PR head.
- [ ] Level 3 iPhone viewport captures show an identifiable concrete fortification in HIGH and LOW (not absent or invisible). Save the **unassisted first player view before teleport** as well as the close-up for both qualities. Record its position, distance from the spawn and screen projection. No texture or material regressions.
- [ ] Physical-device test confirms a fortification is discoverable from the starting island, not merely present after a teleport; no floating foundations. Verify that the actual widened Big Map bridges accept diagonal entries and Low remains >40 FPS.
- [ ] User visually approves the Bungenäs exterior direction before merging or enabling it by default.

## Test URL

`?area=archipelago&polyfork=1&polyforkMode=military&q=high&seed=military-qa-01`.

Compare the same seed with `polyforkMode=coastal` and LOW. For the focused screenshot, CI launches Level 3 using `MILITARY_FOCUS=1` on an 844×390 mobile viewport.

## Explicit exclusions

No Viggen, hangar interior, usable bunker door, ladders, playable tunnels, loot, new destructible cover or large road infrastructure. Those require separate level design, collision, sightline, authored navigation and camera review.
