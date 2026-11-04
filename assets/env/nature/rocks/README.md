# Protocol Rebirth — Granite Rocks v0.1

Original procedural low-poly stone assets for 52° isometric Node Raid. No purchased assets, no runtime code. One GLB = 1 mesh + 1 material. Y-up, metres, front -Z, bottom-centre pivot; glTF v2 without compression. All stone GLBs externally reference the same **rock_atlas.png** color palette (512x512, nearest-filtered). COLOR_0.rgb contains baked root/crevice AO, alpha 1 (non-vegetation); all meshes opaque and no animations.

## Contents
- Granite rock size S, M and L, each with variants a, b, c. Rock silhouettes are irregular and top surfaces show lichen/moss in shared atlas.
- Each L rock also has separate `_lod1.glb` and `_lod2.glb` geometry. S/M variants use their LOD0 mesh at all qualities.
- Flat granite shelves (`rock_slab_a/b`), one open-ended `cliff_wall_4m`, and `rock_scree_a` rockfall prefab.

All models and dimensions are in `manifest.json`. Adjacent `cliff_wall_4m` modules use identical 1.65m end heights, exactly X=-2 to +2, **no endcaps** to prevent adjacent coplanar surfaces. Use box collision for cliffs; small rocks use cylinder radii listed in manifest. Place rocks above terrain by their Y=0 ground origin.

LOD variants are manual asset choices, not glTF MSFT_lod; low-quality instance density and distance culling remain runtime work. No normal/roughness maps on props. Atlas features granite grey-pink, olive moss, sage lichen, blue-grey cold stone, and low-saturation shadow accents.

`contact_sheet.png` / `dusk_preview.png` are procedural illustrative ~52° previews, not real-engine screenshots. Khronos `npx gltf-validator`, four-module seam review, and high/low mobile performance testing remain required before merging.
