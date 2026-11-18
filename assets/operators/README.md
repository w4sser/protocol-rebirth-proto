# OP-01 authored operator — binary assets

Deploy uses the real TRELLIS 2 / Blender operator geometry, not the procedural character, when the GLBs below are present.

| File | Source | Triangles | File size | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `OP01_Mobile.glb` | uploaded `OP01_Mobile_1.glb` | 68,072 | 3,617,348 bytes | `7ca1f1c49709bbd825490327fde87e260183944229fffb43eb48933fafc3a7ac` |
| `OP01_Hero.glb` | uploaded `OP01_Hero_1.glb` | 247,895 | 16,218,588 bytes | `379b53d4755492765517348698cd9571849f02006d47ab7c2273eec7caa2f56f` |

Both use glTF 2.0 (GLB), embedded textures, four PBR materials, +Y up and approximately 1.78 m height. Four parts: Backpack, Body, Coat, Gear. No rig.

## Staging and deployment

**These binary files must be committed to this directory before PR #279 can be merged.** The GitHub connector for this task cannot upload local binary files, so the actual source GLBs were not added by the code commit. The new `test/op01-assets.test.js` guardrail intentionally blocks merge until both files are present. Do not remove the guardrail or claim that fallback V4 proves OP-01 works.

Upload the originals, renamed exactly `OP01_Mobile.glb` and `OP01_Hero.glb`, to `assets/operators/` on `feat/cinematic-raid-prep-3d`. Preserve GLB bytes, no recompression necessary.

`ui/raid-prep-op01.mjs` loads the Mobile GLB by default, and `?opQuality=hero` selects Hero. If a GLB fails to load or validate, the existing V4 procedural character is displayed as a safety fallback. The 3D BIT is unchanged.

After uploading, CI must validate both GLBs and real-browser touch rotation, and visual review must compare the operator's height/framing, clothing PBR, hidden face, and BIT screen before merging.
