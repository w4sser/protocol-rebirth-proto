# Protocol Rebirth / Node Raid – Ground Pass v2 (assets only)

Original locally generated low-poly environment assets, no paid dependencies. The goal of this pass is **readability from the ~52-degree isometric raid camera**, with bigger granite/moss islands, distinctly greener moss and pale-green lichen, brighter paths, and a cheaper mobile alternative. See `contact_sheet_v2.png` and `dusk_preview_v2.png`. These are **illustrations, not in-engine screenshots**.

## Changes from v1
- Replaced the corresponding albedo textures (granite/moss/grass/gravel/pine needles) with flatter and more distinct Nordic colors. Added lichen and worn-concrete/grime textures.
- Replaced the nature splat mask `chunk_0_0_splat.png` with larger patches; added `chunk_0_0_bunker_splat.png` (dry concrete, wet concrete, worn concrete, grime; no natural ground in bunkers).
- Added separate **4 m** and **8 m** walkable terrain tiles, both nature and bunker. All tiles have exact nominal horizontal bounds, origin at ground-contact center, and Y-up / front -Z. Splat and vertexpaint meshes have interior variation, but boundaries meet at height 0.
- Seven brighter 1.8m-wide trails rebuilt with finer edge bands and alpha test texture `ground_trail_albedo.png` (local Y=+0.016m).
- Six 2–3x-larger muted decals in `decal_atlas.png`: wear / wheel tracks / **lichen** / needles / puddle / mud. **No footprints or red/coral**. Footstep GLB removed.

## Rendering profiles (engine integration required)
**High – 4+1 samples per pixel:** `terrain_tile_{4|8}m_splat_{nature|bunker}.glb` + four repeated albedo textures (tile every 4m) + one RGBA splat. `TEXCOORD_1` is mask UV. RGBA channels in `ground_layers.json`, separately for bunker and nature. Existing 16m samples remain for backwards comparison.

**High alternative – 4 samples per pixel:** `terrain_tile_4m_vertexpaint_{nature|bunker}.glb`. `COLOR_0.rgba` contains normalized blending weights (NOT albedo/AO), so a custom shader is still required. Avoid multiplying COLOR_0 into the normal PBR color for these tiles.

**Mobile cheap – one sample per pixel:** `terrain_tile_{4|8}m_mobile_{nature|bunker}_{a|b|c|d}.glb` + **one** premade 512px 2x2 atlas `ground_mobile_nature_atlas.png` or `ground_mobile_bunker_atlas.png`. Four local variants reduce repeating patterns. These are flat walkable meshes rendered with standard GLTFLoader/MeshStandardMaterial, no 5-texture splat shader. This is the proposed baseline for low/mid-range phones.

**Important:** PR #188's preview still always constructs a *five-texture* splat shader and references the now-removed `decal_footprints.glb`. Someone integrating this PR must switch the preview to the `mobile` set for LOW, change `decals` to `decal_lichen`, use the correct bunker mask in bunker areas, and place 4/8m tiles. That **engine work is explicitly outside this asset-only PR**.

## GLB/texture conventions
Metres, Y-up, front -Z, pivot at center ground contact, scale 1, rotation 0. One mesh and material per GLB; normal and COLOR_0 included. No Draco / KTX2 / Meshopt. External PNG textures must reside beside GLBs. Trails/decals are non-colliding and lie 0.016m above placement plane; conform/project them to uneven terrain at runtime. Do not apply wall/floor `fitStructure` to terrain. Bunker/nature tiles are walkable. Collision metadata, dimensions, triangles and sizes in `manifest.json`.

## QA and acceptance status
This is a **draft**, and NOT a ready-to-merge performance claim. Structural GLB checks are not a substitute for Khronos `npx gltf-validator`. Validation still needed: zero validator errors; in-engine LOW/HIGH mobile frame times vs existing terrain; 4 adjacent tiles with no gaps/z-fighting; trail alpha edges at camera angle; 3x3 texture repeat. The mobile profile uses one ground atlas sample per pixel **by design**, but actual measured fps depends on the full renderer.

No gameplay files, shaders, existing bunker kit, or other assets outside `assets/env/terrain` are modified. See stacked PR #189 on asset PR #183. PR #188 remains a non-merge test preview.

## Ground Pass 3 preview review (stacked above preview PR #190)
- Removed sub-pixel speckling from all six decal atlas cells. The cutout coverage is now continuous and smoothly feathered; use alpha blending in the v3 preview material rather than alphaTest 0.49.
- Granite is now neutral cool gray (no saturated lilac). Nature and bunker splat masks use irregular, softly feathered macro patches (96 px previews); separate bunker concrete, worn/wet concrete and grime are maintained.
- Low/mobile nature and bunker atlases are now 256px with four 128px variants. The new surfaces are intentionally low-frequency to improve distant readability and reduce shimmer.
- These lower resolution textures replace only six example PNGs; GLB meshes and layout stay unchanged. Revisit the resolution/quality tradeoff if low-device texture quality is insufficient. This branch remains an unmerged draft and should be visually assessed from the same raid camera.
