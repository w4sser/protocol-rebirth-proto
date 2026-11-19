"""
Side-by-side render pass for the generated prop kit (tools/blender/make_props.py).
Renders, with the identical Workbench camera/lighting setup used for the kit's
own previews:
  1. existing kit rocks (assets/env/nature/rocks/rock_granite_m_a/b/c)
  2. generated rocks + barrel, BAKED color variant (AO + sky tint)
  3. generated rocks + barrel, UNBAKED color variant (flat stylized color only)

This is the owner addendum's side-by-side evaluation step: baked vs unbaked,
plus (separately, via tools/blender/compose_contact_sheet.py, plain Python/
PIL, no Blender) a cold blue-grey grade approximation of the ruin=3 CSS
filter already shipped in index.html (`filter:brightness(.34) saturate(.3)
sepia(.22) hue-rotate(165deg)`), the only "cold bunker grade" that exists in
this codebase today (PRB-149, docs/design-decisions.md 2026-11-13).

Run:
  /home/box/opt/blender/blender -b -P tools/blender/render_compare.py

Writes raw per-prop PNGs to <repo>/assets/env/nature/rocks-gen/_compare_renders/
(gitignored scratch dir, not part of the shipped kit) for
compose_contact_sheet.py to assemble into contact_sheet_compare.png.
"""

import os
import sys

import bpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
sys.path.insert(0, SCRIPT_DIR)
import make_props as mp  # noqa: E402

RENDER_OUT = os.path.join(REPO_ROOT, "assets", "env", "nature", "rocks-gen", "_compare_renders")
KIT_DIR = os.path.join(REPO_ROOT, "assets", "env", "nature", "rocks")
KIT_ROCKS = ["rock_granite_m_a", "rock_granite_m_b", "rock_granite_m_c"]


def import_kit_glb(name):
    path = os.path.join(KIT_DIR, f"{name}.glb")
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=path)
    after = [o for o in bpy.context.selected_objects]
    obj = next((o for o in after if o.type == 'MESH'), after[0])
    obj.name = name
    # existing kit GLBs ship without a vertex-color material link on import in
    # some Blender versions; force Workbench's VERTEX display mode to read
    # straight from the mesh's color attribute regardless (same as make_props
    # previews), so this is a fair comparison of the geometry+color asset,
    # not of whichever importer-generated material happened to attach.
    return obj


def main():
    os.makedirs(RENDER_OUT, exist_ok=True)

    mp.reset_scene()

    # --- existing kit rocks ---
    kit_objs = [import_kit_glb(n) for n in KIT_ROCKS]

    # --- generated props (both color variants kept on the mesh) ---
    rock_objs, barrel_obj = mp.build_all(apply_bake=True, reset=False)
    gen_objs = rock_objs + [barrel_obj]

    all_objs = kit_objs + gen_objs
    scene = bpy.context.scene
    mp.setup_render_common(scene)

    entries = []  # (png_path, label, group)

    for obj in kit_objs:
        png = os.path.join(RENDER_OUT, f"{obj.name}.png")
        mp.render_preview(obj, png, all_objs, active_color_attr="Color")
        entries.append((png, obj.name.upper(), "kit"))

    for obj in gen_objs:
        # cavity OFF for this pair: isolates the real baked-AO vertex-color
        # contribution from Workbench's own screen-space cavity fake, which
        # would otherwise darken creases on BOTH variants identically and
        # hide the actual difference being evaluated.
        png_baked = os.path.join(RENDER_OUT, f"{obj.name}_baked.png")
        mp.render_preview(obj, png_baked, all_objs, active_color_attr="ColorBaked", cavity=False)
        entries.append((png_baked, obj.name.upper() + " BAKED", "gen_baked"))

        png_unbaked = os.path.join(RENDER_OUT, f"{obj.name}_unbaked.png")
        mp.render_preview(obj, png_unbaked, all_objs, active_color_attr="Color", cavity=False)
        entries.append((png_unbaked, obj.name.upper() + " UNBAKED", "gen_unbaked"))

    manifest_path = os.path.join(RENDER_OUT, "entries.json")
    import json
    with open(manifest_path, "w") as f:
        json.dump(entries, f, indent=2)

    print("\n=== render_compare: wrote", len(entries), "renders to", RENDER_OUT, "===")
    for png, label, group in entries:
        print(f"{group:12s} {label:28s} {png}")


if __name__ == "__main__":
    main()
