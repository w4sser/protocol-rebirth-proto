# Opening playtest implementation plan

**Goal:** Make the existing base → Node Raid → base loop teach a useful, funded upgrade.
**Architecture:** Keep the static JS base and Three.js raid. Build goals from current module recipes and secured inventory, pass an immutable launch snapshot, and count the live bag separately. Limit the introductory cache/guard changes to launches before Fabricator L1. Preserve save version and existing earned equipment.
**Spec:** User-supplied Protocol-Rebirth-Playtest-Implementation-Prompt.txt, 2026-10-16.

## Decisions
- Canonical room order remains Core, Fabricator, Vault, BIT Bay, Living Quarters.
- Fabricator L1 uses Cable + Scrap Alloy and existing Scrap currency; Core uses supplied starter parts.
- Fabricator commissioning grants its existing Scavenger Vest once, with shield preview and immediate equip. No new weapon/tool.
- A launch goal snapshots secured counts; extraction alone commits the live bag. No order/result file integration.
- Intro guard warns, commits a burst at a fixed position, then recovers; solid cover uses existing physics.
- Existing advanced saves keep access and equipment. Isolated playtests use a separate local origin, never reset the user's save.

## Tasks
- [x] Add failing tests: recipe-backed goals, partial/excess bag counts, death/extract/reload idempotency, paid room activation, intro layout and guard states, base camera gestures.
- [x] Implement base goal selection, canonical material identity, launch snapshot and early material/upgrade payoff data.
- [x] Implement compact raid tracker, guaranteed route supplies + optional cache, warning/burst/recovery on existing guard.
- [x] Implement bounded base pinch/wheel zoom and pan with aligned hotspots and overview reset; unify Raid/Deploy amber.
- [x] Run base and raid suites, inspect phone and desktop, exercise fresh and progressed saves without overwriting production storage.
- [x] Update current-loop documentation, cache tags, commit and push main; report executed checks and human-observation limits.

## Review focus
Partial bank + bag must never double-count; dropped/lost loot must clear carried progress. A repeated result must not grant again. Room reveal/build must spend once and keep existing unlocks. Drag/pinch must not activate hotspots or expose empty space. Cover must stop burst projectiles, with recovery available even when line of sight breaks during warning.

## Verification
Base npm test passed, including opening-loop and camera gesture tests. Node Raid: 225 passed, 0 failed. Live isolated-origin run verified loss, extract, paid activation, next target, persistence and Vest (+25 shield / 5-slot bag) launch. Independent review's stationary-fire finding fixed and re-reviewed. Physical multi-touch feel and uncoached human comprehension remain unverified.
