# Protocol Rebirth - Node Raid / Terrain Kit (ground pass 1)

Original procedural assets; no external paid art or code changes. All dimensions are metres, Y-up, forward -Z. Separate GLB files: `_lod1` and `_lod2` are lower-detail geometry, not runtime LOD logic. Every GLB has **one mesh, one material, no compression**, no animation. External PNGs in this folder are required beside the GLBs.

## Ground layers
Nine seamlessly repeatable 512x512 indexed PNG albedo maps: granite, moss, pine needles, gravel, mud, grass, sand, concrete, wet concrete. Tile each at **4x4 m**, nominal 128 px/metre. sRGB for albedo. Source colors are intentionally harmonized for dusk lighting. Texture memory is approximately 9 MiB if expanded to RGBA8; actual runtime memory depends on the loader/mipmaps.

## Terrain blending (requires engine integration)
`terrain_chunk_16m_vertexpaint.glb` is a 31x31-grid quad terrain (1922 tris, 0.516m step). COLOR_0.rgba stores **normalized blending weights**, **not baked albedo**, in order **granite / moss / gravel / pine_needles**; weights total 1.00 at every vertex. Do **not** multiply these weights as ordinary vertex tint when doing final rendering. `_lod1` / `_lod2` use 22 / 15 segments.

`terrain_chunk_16m_splat.glb` is the alternative approach with repeated material UV0 and UV1 in [0,1] for `chunk_0_0_splat.png`. The RGBA splat is 256x256, same layer order, weights total 255 per pixel. The GLB's moss baseColorTexture is a **fallback preview only**; standard glTF does not implement 4-way texture blending. Engine shader must blend the four layer textures. Each 16m edge is **exactly Y=0**, so neighboring chunks share no cracks; interior height variation is below 0.34m. `terrain_chunk_8m_vertexpaint.glb` is an 8m sample.

## Trails and decals
- `trail_straight_2m/4m/8m`, `trail_curve_45/90`, `trail_t_junction`, `trail_end` are gravel-colored strips approximately 1.36m wide. The edges use COLOR_0.a=0. **Alpha test** is used, not alpha blending. More attractive dithered edge fading needs a runtime shader.
- Trails/decal mesh heights are locally Y=0.012m; when laid on rolling terrain, project/conform to ground in the placement system so they remain 1.2cm above it. The four T-junction quads butt up without overlap.
- Six decals share `decal_atlas.png` (3 columns x 2 rows): wear, wheel tracks, footprints, pine needles, puddle, mud. All have one material and use binary alpha-test cutout.
- There is no collision for trails/decals. Terrain is walkable. Terrain mesh origin is bottom-centre, with local edges at Y=0.

## Engine integration (not included in this PR)
Support a four-layer onBeforeCompile splat/vertex-weight blend, displacement or CPU ground projection for strips, repeat texture sampling, chunk culling, and InstancedMesh for repeated decals. Vertex color alpha on trail strips is a transparency/fade mask and must be preserved. Three.js GLTFLoader can load all files, but glTF alone does not blend layers.

## QA notes
All generated GLBs are GLB v2 with 4-byte aligned chunks, valid POSITION/NORMAL/TEXCOORD_0/COLOR_0, UINT16 indices and one material. Byte lengths, tris, bounds and material counts are listed per file in `manifest.json`. No Draco, KTX2, Meshopt or extensions. Full Khronos `npx gltf-validator` and in-engine visual review are **still required** before merging; they have not been claimed as executed. Textures are forced to identical left/right and top/bottom edge pixels in addition to periodic noise. Verification previews accompany this kit.

Do not apply `fitStructure` to terrain: the intended footprints are 8m or 16m, with exact 0m boundary heights.
