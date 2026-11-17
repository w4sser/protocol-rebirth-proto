# Protocol Rebirth — Cinematic Raid Preparation (Visual Target V2)

Status: implementation in PR #279, visual approval pending.

## Approved reference

The user-approved cinematic Deploy mockup from the Protocol Rebirth conversation is the visual target. The implemented first-pass layout was approved as a functional foundation but failed art-direction parity: the central operator was toy-like, the full-screen background was the **base overview**, and the Archipelago destination tile contained a **branded promotional graphic**.

**Design intent:** the last quiet moment before a dangerous deployment, standing at a weathered bunker threshold overlooking the Swedish archipelago during a beautiful pink-violet summer night.

## Non-negotiables

- Actual physical staging scene, **never** the Base map/interactive bunker overview behind the Raid Prep UI.
- Summer landscape, not snow or a winter palette: granite, still water, pine silhouettes, gentle maritime haze, muted dusk-pink horizon.
- The operator's face is never visible. The close-up operator is hooded, visibly equipped, weathered, with a darker, bulkier scavenger silhouette and modest cloak.
- BIT is a small, worn boxy CRT drone. Two oval face eyes and a neutral short mouth; cyan belongs on the CRT face only, with a restrained amber side lamp. No kawaii expression or blue thruster glow.
- The Archipelago destination tile is an **in-world view of that destination**, never a splash/promo image with a logo, game title or UI baked into the picture.
- UI hierarchy: loadout left; operator and BIT middle; destination, mission, loss warning and one strong orange DEPLOY CTA right. No bottom navigation.
- Existing loadout, mission, route and `A.deployNodeRaid()` logic must not change. The preview query parameter uses a demo state only, with no persistence to a real save.

## Implementation mapping

- `assets/production/raid-prep-bunker.avif`: optimized full-bleed bunker doorway / summer archipelago backdrop (no characters, no UI).
- `assets/production/raid-prep-archipelago.avif`: environment-only destination crop (no branding).
- `assets/production/raid-prep-operator.avif`: hooded faceless operator portrait for low-quality/WebGL fallback.
- `ui/raid-prep.css`: background framing, proper loadout/heading visibility, destination image and phone-landscape layout.
- `ui/raid-prep-scene.mjs`: existing GLB and idle animation, shadowed hood and mask, close-up-only jacket/coat/armor silhouette, smaller offset BIT, controlled lighting, interactive rotation.
- `test/cinematic-prep.test.js`: structural and art-direction safeguards.

## Visual review checklist

1. Test the actual `?preview=deploy` branch preview in **844 × 390 landscape** and a larger landscape viewport; the target art and UI must remain legible and fit within safe areas.
2. Check there are **no Base module labels** in the background; verify the destination preview contains **no Protocol Rebirth title**.
3. Check the operator has a convincing full hood, hidden face, cape/gear silhouette, no bright shorts or exposed beige head, and is large enough to read.
4. Check BIT is subordinate in size, has cyan only on its face, with restrained amber lamp.
5. Test user interactions: rotation, weapon/armor/consumables, destination selection, mission settings, Deploy launch.
6. Verify no overflow, cut-off controls or distracting labels in phone landscape. On low graphics, the existing operator fallback must remain usable.
7. Run the full existing `npm test`, `cd nodspel && npm test`, and visual layout CI before merge.

**Art review is required before merging**; technical CI success alone does not establish visual parity.
