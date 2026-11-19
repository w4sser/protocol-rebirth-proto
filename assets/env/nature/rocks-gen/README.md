# Protocol Rebirth — Generated Props v0.1 (opt-in, NOT wired into any level)

Proof that headless Blender + a seeded Python script can produce game-ready props in this repo's
art direction. **This kit is not referenced by any level, data file, or gameplay code.** It exists
for owner review next to the hand-authored kit at [`assets/env/nature/rocks`](../rocks/README.md)
so the two can be judged side by side. Nothing in `assets/env/nature/rocks` was touched.

## Contents

| File | Kind | Tris | Bytes |
| --- | --- | --- | --- |
| `rock_gen_a.glb` | rock | 320 | ~34 KB |
| `rock_gen_b.glb` | rock | 320 | ~33 KB |
| `rock_gen_c.glb` | rock | 320 | ~33 KB |
| `barrel_gen_a.glb` | barrel | 370 | ~26 KB |

All glTF 2.0 binary, Y-up, metres, front `-Z`, origin at bottom centre, transforms applied, one
mesh + one material each, vertex colors only (no textures), no lights/cameras/animations. Exact
per-asset tris/bbox/bytes are in [`manifest.json`](manifest.json), generated from the real export
(not hand-typed).

`rock_gen_a.png`, `rock_gen_b.png`, `rock_gen_c.png`, `barrel_gen_a.png` and `contact_sheet.png`
are Workbench preview renders of the shipped (baked) variant, downscaled/recompressed for git
(`tools/blender/shrink_previews.py`) — not real-engine screenshots.

## How to regenerate

```
/home/box/opt/blender/blender -b -P tools/blender/make_props.py
python3 tools/blender/shrink_previews.py
```

Optional second argument after `--` overrides the output directory (default: this directory).
Everything is seeded — re-running yields byte-identical GLBs. No network, no paid tools.

To rebuild the side-by-side evaluation sheet (existing kit vs generated, baked vs unbaked, cold
grade — see below):

```
/home/box/opt/blender/blender -b -P tools/blender/render_compare.py
python3 tools/blender/compose_contact_sheet.py
```

`render_compare.py` writes scratch per-frame renders to a gitignored `_compare_renders/`
subdirectory; `compose_contact_sheet.py` (plain Python + Pillow, not Blender) assembles
`contact_sheet_compare.png` from them.

## Art notes (owner verdict, 2026-11-19)

Robert's call on the first pass: rocks could work once adjusted toward the shipped kit's
language — flatter/faceted (flat shading, not smooth blobs), clearer olive-green moss wedges on
top faces, a slightly lighter violet-grey granite, and a taller `rock_c` (the first pass was too
flat). The barrel was already decent; only minor kit-palette alignment was asked for. This pass:

- **Hard flat shading**, no auto-smooth angle at all — matches the kit's faceted read instead of
  the smoothed-blob look of the original `/workspace/blender-props` proof.
- **Body color** sampled from the shipped kit's own `rock_atlas.png` (the light violet-grey
  swatch, `#928D98`) blended with the AD06 `violet_granite` token, then kept light rather than
  the proof's darker/muddier granite.
- **Moss** is drawn as 2-3 angular, non-adjacent sector wedges near the apex (not a noise blotch),
  colored from the kit atlas's clearer green swatches (`#6B7A56` / `#8F9C82`) rather than the AD06
  `olive_ground` token, which reads more khaki/yellow at thumbnail size.
- **`rock_gen_c`** uses a much shallower Z-squash (`sz=0.92` vs. `0.58-0.62` for the other two) so
  it reads as a taller boulder instead of a flattened pancake.
- **Barrel** switched from an embedded baked PNG texture to vertex colors only (same geometry,
  same hazard-stripe/rust logic, now evaluated per-vertex instead of per-texel), matching the kit
  convention of vertex colors / a tiny shared atlas over per-asset textures, and cutting its GLB
  from ~65 KB to ~26 KB in the process. Steel tones nudged a step cooler to sit closer to the
  rocks' violet-grey body.

## Baked lighting evaluation (owner addendum, 2026-11-19)

Evaluated, in Blender, CPU-only (no `/dev/dri`, no GPU on this machine): baking AO and a simple
sky/key light into vertex colors, vs. shipping flat stylized color with none of that baked in.

- **AO**: a real Cycles CPU ray-traced bake (`bpy.ops.object.bake(type='AO', target=
  'VERTEX_COLORS')`, 32 samples, each object isolated from its temporarily-overlapping siblings
  during its own bake — see the comment in `bake_ao_to_attribute()`). This is the same thing the
  shipped kit's own manifest already documents doing (`"vertex_colors": "COLOR_0.rgb baked AO,
  static alpha=1"`), just computed instead of hand-painted.
- **Sky/key light**: *not* a second raytraced light bake — a cheap analytic tint (brighter toward
  +Z/sky-facing, cooler toward -Z/ground-facing) multiplied in alongside the AO. A full directional
  light bake was evaluated and rejected: on CPU-only hardware it roughly doubles the per-object
  bake cost for geometry this low-poly and this convex, for a result the analytic tint already
  gets most of the way to. This tradeoff is worth revisiting if the kit grows larger/more concave
  props later.
- Both variants are kept as separate vertex-color attributes on the mesh while building
  (`Color` = unbaked, `ColorBaked` = baked) so `render_compare.py` can render both; only one is
  ever exported into the shipped GLB (`finalize_for_export()` collapses the mesh down to a single
  `COLOR_0` either way, so baked vs. unbaked costs nothing extra in file size).
- See the "GENERATED BAKED" vs. "GENERATED UNBAKED" rows of `contact_sheet_compare.png`. On this
  low-poly, mostly-convex geometry the AO contribution is honestly subtle (these aren't concave
  enough to self-occlude much); the clearer visible difference is the sky/ground tint giving the
  rocks a touch of directional read instead of flat-lit color.

**Recommendation: ship baked** (already the default — `make_props.py` exports the `ColorBaked`
attribute). It costs nothing extra in file size, it's free at runtime (no SSAO or any other
real-time AO pass needs to exist for mobile), and it matches the convention the shipped kit
already established. If a future pass makes the geometry more concave (overhangs, deeper
crevices), re-evaluate — that's where a real AO bake earns its keep most.

### Cold blue-grey grade approximation

The only "cold bunker grade" that exists in this codebase today is `index.html`'s
`.baseviewer[data-ruin="3"] .baseworld` filter (PRB-149, `docs/design-decisions.md` 2026-11-13):

```
filter: brightness(.34) saturate(.3) sepia(.22) hue-rotate(165deg);
```

`contact_sheet_compare.png`'s bottom row runs the shipped baked renders through an exact
reimplementation of that filter chain (standard CSS Filter Effects / SVG `feColorMatrix` matrices
for `saturate`/`sepia`/`hue-rotate`, applied in the same order the CSS lists them — see
`cold_bunker_grade()` in `tools/blender/compose_contact_sheet.py`). That particular ruin state is
the pre-Core-L1 "emergency power" look and is intentionally near-black/dramatic, not representative
of ordinary lighting; the props stay readable under it (shape/silhouette survives), which is the
actual bar — this grade only applies before the first restoration beat.

## Open items

- Not validated with `npx gltf-validator` (no network in this worktree to install it); the header/
  accessor/byte-size checks in `test/rocks-gen-kit.test.js` and the manual GLB-header check in
  `scripts/validate-props.mjs` both pass.
- Not placed in any scene — purely an opt-in asset-review kit per the task brief.
- `rock_gen_c`'s absolute size (1.0 m target) is similar to `rock_gen_a`; only its proportions
  (taller/rounder) were the ask. Revisit if a visibly bigger `rock_c` is also wanted.
