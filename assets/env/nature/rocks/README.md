# Protocol Rebirth — Granite Rocks v0.1

Original procedural low-poly stone assets for 52° isometric Node Raid. No purchased assets, no runtime code. One GLB = 1 mesh + 1 material. Y-up, metres, front -Z, bottom-centre pivot; glTF v2 without compression. All stone GLBs externally reference the same **rock_atlas.png** color palette (512x512, nearest-filtered). COLOR_0.rgb contains baked root/crevice AO, alpha 1 (non-vegetation); all meshes opaque and no animations.

## Contents
- Granite rock size S, M and L, each with variants a, b, c. Rock silhouettes are irregular and top surfaces show lichen/moss in shared atlas.
- Each L rock also has separate `_lod1.glb` and `_lod2.glb` geometry. S/M variants use their LOD0 mesh at all qualities.
- Flat granite shelves (`rock_slab_a/b`), one open-ended `cliff_wall_4m`, and `rock_scree_a` rockfall prefab.

All models and dimensions are in `manifest.json`. Adjacent `cliff_wall_4m` modules use identical 1.65m end heights, exactly X=-2 to +2, **no endcaps** to prevent adjacent coplanar surfaces. Use box collision for cliffs; small rocks use cylinder radii listed in manifest. Place rocks above terrain by their Y=0 ground origin.

LOD variants are manual asset choices, not glTF MSFT_lod; low-quality instance density and distance culling remain runtime work. No normal/roughness maps on props. Atlas features granite grey-pink, olive moss, sage lichen, blue-grey cold stone, and low-saturation shadow accents.

`contact_sheet.png` / `dusk_preview.png` are procedural illustrative ~52° previews, not real-engine screenshots. Khronos `npx gltf-validator`, four-module seam review, and high/low mobile performance testing remain required before merging.

## Textured XL granite (v2.28.69)

`rock_granite_xl_a`, `rock_cliff_xl_a`, `rock_slab_xl_a` and `rock_shore_xl_a` (each + `_lod1`) are rebuilt from owner-supplied generated models: a clean low-poly shell shrink-wrapped onto the source, colour baked across, then packed for mobile:
- one shared external texture, `granite_xl_atlas.jpg` (1024 px JPEG, ~135 KB; boulder bottom-left, slab bottom-right, cliff top-left, shore top-right quadrant, 6 px inset against bleed), loaded once;
- welded positions + UVs only, **no normals** (GLTFLoader flat-shades primitives without normals), 8-24 KB per GLB;
- LOD0 600-650 tris (slab 420), `_lod1` 234-260 tris.
Generated grass skirts and the shore cluster's water/foam sheet are removed and bright moss toned to olive. `rock_shore_xl_a` (900 / 300 tris) is rebuilt as per-rock convex hulls (k-means split of the source), which keeps the faceted look; its +X side faces the sea. Y-up, metres, bottom-centre origin.

They are wired in by `nodspel/granite-kit.js`: once loaded, they replace the procedural rock visuals of the default archipelago (wall rocks and coast rocks; neighbouring wall rocks pair into one cliff block) add a few visual-only, walkable granite shelves on island interiors, and turn every third rocky coast point into a shoreline cluster facing the sea. Every placed piece is one instance of an InstancedMesh per kind (four draw calls per level, one material). Colliders and reservations are unchanged; the procedural rocks remain the fallback. High quality uses LOD0, low quality `_lod1`.
