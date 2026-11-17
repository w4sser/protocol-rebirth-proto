# Protocol Rebirth — Cinematic Raid Preparation (Visual Target V2)

Status: implementation in PR #279, visual approval pending.

## Approved reference

The user-approved cinematic Deploy mockup from the Protocol Rebirth conversation is the visual target. The implemented first-pass layout was approved as a functional foundation but failed art-direction parity: the central operator was toy-like, the full-screen background was the **base overview**, and the Archipelago destination tile contained a **branded promotional graphic**.

**Design intent:** the last quiet moment before a dangerous deployment, standing at a weathered bunker threshold overlooking the Swedish archipelago during a beautiful pink-violet summer night.

## Non-negotiables

- Actual physical staging scene, **never** the Base map/interactive bunker overview behind the Raid Prep UI.
- Summer landscape, not snow or a winter palette: granite, still water, pine silhouettes, gentle maritime haze, muted dusk-pink horizon.
- The operator's face is never visible. The close-up operator is hooded, visibly equipped, weathered, with a darker, bulkier scavenger silhouette and modest cloak.
- BIT is a small, worn boxy CRT drone. Two oval face eyes and the owner-approved curved smile; cyan belongs on the CRT face only, with a restrained amber side lamp. No kawaii expression or blue thruster glow.
- The Archipelago destination tile is an **in-world view of that destination**, never a splash/promo image with a logo, game title or UI baked into the picture.
- UI hierarchy: loadout left; operator and BIT middle; destination, mission, loss warning and one strong orange DEPLOY CTA right. No bottom navigation.
- Existing loadout, mission, route and `A.deployNodeRaid()` logic must not change. The preview query parameter uses a demo state only, with no persistence to a real save.

## Implementation mapping

- `assets/production/raid-prep-bunker.avif`: optimized full-bleed bunker doorway / summer archipelago backdrop (no characters, no UI).
- `assets/production/raid-prep-archipelago.avif`: environment-only destination crop (no branding).
- `assets/production/raid-prep-operator.avif`: hooded faceless operator portrait for low-quality/WebGL fallback.
- `ui/raid-prep.css`: background framing, proper loadout/heading visibility, destination image and phone-landscape layout.
- `ui/raid-prep-operator-v3.mjs`: new sculpted menu-only 3D character model. Cloth-textured anatomical limbs, asymmetrical cloak, angular hood with a recessed face void, tactical rig, gloves, reinforced boots, and a modeled weapon. Independent of gameplay's low-resolution GLB.
- `ui/raid-prep-models.mjs`: physical CRT companion BIT using `assets/bit-face-master-v3.svg` as its screen texture, with a geometric face fallback.
- `ui/raid-prep-scene.mjs`: camera, iPhone touch/pointer capture, operator yaw rotation, companion idle, high-DPR rendering, lights and resource disposal.
- `scripts/layout-check.mjs`: real browser rotation smoke test in landscape.
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

## Character-focused iteration (v3)

Owner feedback on the first rotatable version: the mannequin-like round limbs, large tubular hood, symmetrical gear and rectangular gun still failed art direction. Fix the **character asset**, do not keep restyling the Deploy UI.

The new operator:
- is genuine 3D geometry with 360-degree rotation (not a painted card);
- uses smooth custom volumetric clothing meshes with external-facing normals, stitched folds and fabric microtexture;
- has an actual cloth hood crown, folded side flaps, a dark recessed face void and wrapped lower face — no head or skin;
- has a strong asymmetrical cloak, padded load-bearing vest, weathered cargo pockets, layered leg protections, gloved hands, structured boots and a modelled diagonal rifle;
- keeps the physical 3D BIT and the owner-approved face master as-is;
- uses the existing menu-only Three.js rendering system without changing Node Raid assets.

Acceptance: judge the real landscape screenshot from the browser job against the approved hi-res reference, especially the hood outline, rifle hold and lower-body proportions. A green automated test confirms technical behavior but does not certify visual parity.
