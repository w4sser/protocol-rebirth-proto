# Protocol Rebirth enemy model optimization: patrol_grunt pilot

## What the existing contract says

PR #306 says the seven textured enemies are about 16–26k triangles, use one 1024 px base-colour JPEG, and package at 1.3–1.7 MB per GLB. The new models retain +X forward, +Z up, their named part/pivot contract and ground at z=0. Patrol grunt has semantic nodes including `chassis`, `upper_frame`, side panels, four wheel/hub pairs, `battery_cage`, `weakpoint_battery`, `sensor_head_pivot`, `sensor_head`, `sensor_face`, `optic`, `short_machine_gun`, and `head_turntable`. A number of these are empty contract nodes. The wheels are geometry in model space: runtime code derives rolling pivots from their bounds. Keep each object and its transform separate.

The current `nodspel/enemies.js` loader rejects a model if any expected part name is missing. `enemy-animation.js` scans the patrol sensor pivot, gun, wheels and battery, and builds wheel pivots at runtime. PR #306's README says the battery glow reuses the base texture as an emissive map; do not remove or merge that material setup. The patrol optic is also a red emissive detail. Current gameplay motion is runtime-authored; the GLB hierarchy and pivot transforms are the animation interface. The separate red optic material and amber weakpoint/battery region must still read after downscaling; if the 128 px tier loses the weakpoint, keep a small dedicated emissive map for that LOD instead of enlarging all base color textures.

PR #310 is a different class of optimization: the tall pine was rebuilt from source at 874 triangles (29 KB) and a 360-triangle LOD (16 KB), with a baked 512 px JPEG (~40 KB). It replaced a ~230k-triangle generated source with deliberately reconstructed convex forms. That establishes a strong target for assets that can be rebuilt around simple forms; it does not imply an automatic decimator can make detailed enemies read equally well at 874 triangles.

## Proposed first-pass budget

These are pilot targets, not verified mobile-performance limits. Keep 3D silhouette, part breaks, wheel circles, front sensor profile and rear amber weakpoint recognizable at the actual gameplay camera distance. Use an in-game side-by-side review before promoting any tier.

| Tier | Triangle target | Texture | Intended use |
|---|---:|---|---|
| LOD0 | 7,000–10,000 | 512 px base color, JPEG quality ~84 | Default near and combat view |
| LOD1 | 2,500–4,000 | 256 px base color, JPEG quality ~82 | Mid-distance / reduced quality |
| LOD2 | 700–1,500 | 128 px base color, JPEG quality ~80 | Far view or lowest quality |

Treat ±25% as an acceptable first-pass budget while art is judged. Keep named emissive geometry (`optic`, `weakpoint_battery`, `sensor_face`) and the battery cage untouched initially. The script starts with per-object Decimate ratios of 0.32 / 0.12 / 0.035, but applies higher minimum ratios to chassis, sensor head, gun, front plate and panels to protect their functional silhouette; it also keeps a 12-face minimum per mesh. This can put actual totals above targets, so the script reports measured output instead of claiming the budgets are guaranteed. If LOD2 looks too soft, rebuild the chassis and sensor from low-poly primitives like the pine method rather than increasing texture detail.

For the pilot, stay with JPEG for opaque base color and reuse that same image as the battery emissive map, as PR #306 currently does. No alpha is needed for this model. Keep the optic's separate emissive material. Use the same texture image for base color and glow so the exporter does not duplicate payload. Avoid introducing KTX2, Draco or Meshopt in this pilot: the current enemy path uses the standard GLTFLoader and no texture/geometry decoder setup is established in the inspected contract. Those formats may reduce transfer size, but need a runtime decoder and device validation first.

Expected package target for LOD0: 300–600 KB GLB including geometry and 512 JPEG. LOD1: 130–300 KB. LOD2: 50–150 KB. These are estimates; material serialization, geometry attributes and JPEG content change the final byte count. If a tier remains much larger, first inspect duplicate vertex attributes/material images and whether the GLB exporter embedded duplicate images. The script writes three separate GLBs; enemy loading currently has no LOD selector, so wiring tier selection is a separate follow-up after the asset review.

## Reproducible Blender pass

Run `patrol_grunt_optimize.py` in Blender 3.6+ or 4.x against the merged `assets/enemies/patrol_grunt.glb`. It reloads the untouched source independently for each LOD, checks every current patrol node contract, keeps object names/hierarchy/transforms, protects emissive details, simplifies other mesh objects separately, downsizes file-backed textures, re-encodes them as JPEG, exports GLBs, and records triangle count and byte size in JSON.

```sh
blender --background --python patrol_grunt_optimize.py -- \
  --input /path/to/protocol-rebirth-proto/assets/enemies/patrol_grunt.glb \
  --out /path/to/patrol_grunt_optimized
```

The script does not apply object transforms, join meshes, delete empty pivots, rename parts or bake runtime animation. It performs a deterministic first pass from the same input and records output metrics. Review the GLBs in `?debug=1&enemydemo=mixed` and compare at the intended gameplay camera before adopting them. Specifically check wheel silhouette/roll, sensor scan, gun recoil, rear weakpoint glow, front/back read, ground contact and labels. Keep the original GLB as the comparison build until these checks are complete.

## Rollout and mobile validation

1. Pilot patrol_grunt only; run Blender, record GLB size and triangle totals, and inspect each LOD at actual raid scale.
2. Compare original and optimized GLB on the same device/browser build, identical quality setting and scene. Capture load time, transferred bytes, texture memory estimate, frame-time percentiles, draw calls, and visible visual defects at 1, 5, 10 and 20 simultaneous enemies.
3. Test low-end and target phones, both with cold and warm cache. Make LOD selection explicit and verify transitions do not pop. Do not infer frame-rate gains from file-size or triangle reductions alone: GPU, fill rate, draw calls, texture upload and CPU animation may dominate.
4. If the pilot passes, apply archetype-specific caps based on screen-space silhouette and animated part count; do not blindly reuse one ratio across all seven enemies.

No device performance result is claimed here; these figures are candidate targets pending actual in-game and device tests.

## Sources inspected

- [PR #306: textured enemy models and node contract](https://github.com/w4sser/protocol-rebirth-proto/pull/306)
- [Current enemy asset README](https://github.com/w4sser/protocol-rebirth-proto/blob/main/assets/enemies/README.md)
- [PR #310: reconstructed pine and LOD](https://github.com/w4sser/protocol-rebirth-proto/pull/310)
- [Runtime enemy part loader](https://github.com/w4sser/protocol-rebirth-proto/blob/main/nodspel/enemy-models.js)
- [Runtime enemy animation](https://github.com/w4sser/protocol-rebirth-proto/blob/main/nodspel/enemy-animation.js)
