# Protocol Rebirth — Shoreline Kit

Procedural low-poly coastline modules for Swedish summer-night archipelago. All GLBs standalone, 1 mesh / 1 material, source `shore_atlas.png` (512² nearest-filtered 4×4 color atlas) via external PNG URI. Metres, Y-up, -Z front, bottom-centre ground pivot; nominal straight lengths 2m or 4m. File sizes and nominal bounding boxes in manifest.

## Pieces
Two straight sand ribbons, two 90-degree curved bands, faceted 4m rock water edge, curving sandbar, three reed clumps, pier footing, driftwood and segmented foam-line strip. Assign collisions from manifest. Shoreline is **not a full ocean shader** or water surface; the runtime must provide ocean mesh and water transparency separately. Never overlap same-depth straight/curve modules or duplicate their faces; use endpoints to butt-join.

## Performance
Each GLB is a single primitive and 1 material with no geometry compression or animation. `COLOR_0.rgb` is baked contact AO. For reeds, `COLOR_0.a` goes 0 at root to 1 at tip for wind-shader. For non-vegetation, alpha is 1. Materials are opaque, so the alpha channel does not introduce transparency. Ground strips remain walkable, reeds/foam/debris have no collision.

The foam strip is elevated 0.012m, not coplanar with the water surface. Coordinate its height with engine-side water level to avoid flicker. Paths on height-varying terrain require conforming in the placement system. Contact sheet renders actual triangle silhouettes from approx 52° with a purple-grey twilight palette; illustrative, not an in-engine screenshot.

## QA pending
Full Khronos `npx gltf-validator` and on-device low/high render are required before merge. Use the model counts and bounding boxes in the manifest. No production code is part of this kit.
