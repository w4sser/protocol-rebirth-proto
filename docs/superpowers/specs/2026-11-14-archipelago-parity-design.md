# Archipelago v2 visual parity

Owner approved 2026-11-14: match the existing visual target, starting with bedrock and composition, then lighting; show actual gameplay before any merge.

Use the sculpted glacial geometry and vertex-color language of `archipelago-visual-target.html` in the existing raid renderer. Compose a few broad outcrops outside the walkable shoreline, low connected shelves, open olive/moss interiors and sparse coastal pines. Keep bridge channels, landings and gameplay objectives unobstructed. Match the reference's softer lavender-grey rock, cool fill and warm side light. Keep the actual camera, actors, collision, authored floors, combat, economy and reference unchanged. All changes remain behind `archVisual=v2`; legacy Archipelago, Bunker and Town retain current rendering.

Approach: port the reference's visual primitives into the existing world, using deterministic geometry and shared GPU resources. A lighting-only pass cannot repair the missing forms; a replacement diorama cannot prove gameplay fidelity. Use the real target seed in HIGH and LOW, preserving primary silhouettes across tiers. Reduce overlapping cosmetic dressing rather than hide gameplay objects. Any nonwalkable rock must remain visibly beyond the walk boundary, clear of bridge/water gaps.

Acceptance: before/after captures from normal raid camera at 844x390, a coast/portal view and bridge view; no uncaught errors or failed local assets; deterministic geometry and bridge/neighbor clearance tests; base and raid suites. Desktop Chromium emulation is not actual Safari or physical phone performance. No merge or production default enablement.
