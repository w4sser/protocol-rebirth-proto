"""Build reproducible patrol_grunt GLB LODs in Blender 3.6+ / 4.x.

Usage:
  blender --background --python patrol_grunt_optimize.py -- \
    --input /path/to/patrol_grunt.glb --out /path/to/out

Each LOD is rebuilt from the original GLB, so simplification does not compound.
The script keeps the imported hierarchy, object names, transforms, empties and
materials. It does not join meshes or apply object transforms. It writes a
triangle/size report and fails if the patrol_grunt node contract is missing.
"""
from __future__ import annotations
import argparse
import json
import math
import sys
import tempfile
from pathlib import Path
import bpy

# Approximate, deliberately testable budgets for the first pass. PR #306's
# patrol_grunt is ~16-26k triangles. Emissive/critical pieces are excluded from
# decimation and can push totals above these targets; the report makes that clear.
PROFILES = [
    ("lod0", 0.32, 512, 84),  # near/medium gameplay view
    ("lod1", 0.12, 256, 82),  # mid-distance / lower quality
    ("lod2", 0.035, 128, 80), # far-distance / lowest quality
]

# These must remain as separate nodes because nodspel/enemies.js and
# enemy-animation.js look them up by name. Several are intentionally empty.
CONTRACT = {
    "chassis", "upper_frame", "front_plate", "side_panel_left", "side_panel_right",
    "wheel_front_left", "hub_front_left", "wheel_front_right", "hub_front_right",
    "wheel_rear_left", "hub_rear_left", "wheel_rear_right", "hub_rear_right",
    "battery_cage", "weakpoint_battery", "sensor_head_pivot", "sensor_head",
    "sensor_face", "optic", "short_machine_gun", "head_turntable",
}
PROTECTED_NAMES = {"optic", "weakpoint_battery", "sensor_face", "battery_cage"}
# Per-LOD minimum ratios for silhouette/functional parts; these override a harsher
# global ratio. Values are starting points, not artist-approved final geometry.
SILHOUETTE_MIN_RATIOS = {
    "chassis": (0.50, 0.30, 0.16),
    "sensor_head": (0.65, 0.42, 0.25),
    "short_machine_gun": (0.55, 0.35, 0.22),
    "front_plate": (0.45, 0.25, 0.14),
    "upper_frame": (0.40, 0.22, 0.12),
    "side_panel_left": (0.40, 0.22, 0.12),
    "side_panel_right": (0.40, 0.22, 0.12),
}


def args_after_double_dash():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args(argv)


def load_source(path: Path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    names = {obj.name for obj in bpy.context.scene.objects}
    missing = sorted(CONTRACT - names)
    if missing:
        raise RuntimeError("Missing patrol_grunt contract nodes: " + ", ".join(missing))


def is_emissive(obj):
    if obj.name in PROTECTED_NAMES:
        return True
    for mat in obj.data.materials if obj.type == "MESH" else ():
        if not mat or not mat.use_nodes or not mat.node_tree:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                color = node.inputs.get("Emission Color") or node.inputs.get("Emission")
                strength = node.inputs.get("Emission Strength")
                if color and strength and strength.default_value > 0.001:
                    if max(color.default_value[:3]) > 0.001:
                        return True
    return False


def triangle_count(objects):
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        mesh = obj.data
        total += sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)
    return total


def resize_textures(max_side: int, quality: int, temp_dir: Path):
    """Resize source textures and re-encode to JPEG; preserve each image's color space."""
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.quality = quality
    image_map = {}
    for old in list(bpy.data.images):
        if old.source != "FILE" or old.size[0] <= 0 or old.size[1] <= 0:
            continue
        width, height = old.size
        if max(width, height) <= max_side:
            continue
        scale = max_side / max(width, height)
        new_w = max(1, round(width * scale))
        new_h = max(1, round(height * scale))
        old.scale(new_w, new_h)
        old.file_format = "JPEG"
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in old.name)
        path = temp_dir / f"{safe}_{max_side}.jpg"
        old.filepath_raw = str(path)
        old.save_render(str(path), scene=scene)
        new = bpy.data.images.load(str(path), check_existing=False)
        try:
            new.colorspace_settings.name = old.colorspace_settings.name
        except Exception:
            pass
        new.pack()
        image_map[old] = new
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image in image_map:
                node.image = image_map[node.image]
    return len(image_map)


def simplify(ratio: float, lod_index: int):
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or is_emissive(obj):
            continue
        faces = len(obj.data.polygons)
        if faces < 16:
            continue
        # GLB imports can suffix duplicate object names with .001, .002, etc.
        semantic_name = obj.name.rsplit(".", 1)[0] if obj.name.rsplit(".", 1)[-1].isdigit() else obj.name
        silhouette_floor = SILHOUETTE_MIN_RATIOS.get(semantic_name, (0, 0, 0))[lod_index]
        # Retain a modest minimum per mesh to avoid collapsing small mechanical forms.
        actual_ratio = max(ratio, silhouette_floor, min(1.0, 12.0 / faces))
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        mod = obj.modifiers.new(name="PR_Decimate", type="DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = actual_ratio
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.select_set(False)


def export_glb(path: Path):
    # Selecting all imported scene nodes keeps empty semantic/pivot nodes in GLB.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True,
        export_materials="EXPORT", export_image_format="AUTO",
        export_cameras=False, export_lights=False,
        export_apply=False, export_texcoords=True, export_normals=True,
    )


def main():
    opts = args_after_double_dash()
    source = opts.input.expanduser().resolve()
    out = opts.out.expanduser().resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    out.mkdir(parents=True, exist_ok=True)
    records = []
    for lod_index, (name, ratio, tex_size, quality) in enumerate(PROFILES):
        load_source(source)
        objects = list(bpy.context.scene.objects)
        starting = triangle_count(objects)
        with tempfile.TemporaryDirectory(prefix="pr_patrol_") as temp:
            image_count = resize_textures(tex_size, quality, Path(temp))
            simplify(ratio, lod_index)
            remaining = triangle_count(objects)
            dest = out / f"patrol_grunt_{name}.glb"
            export_glb(dest)
        records.append({
            "lod": name, "input_triangles": starting, "output_triangles": remaining,
            "texture_max_side": tex_size, "jpeg_quality": quality,
            "resized_images": image_count, "bytes": dest.stat().st_size,
            "file": dest.name,
        })
        print(f"{name}: {starting:,} -> {remaining:,} triangles; {dest.stat().st_size:,} bytes")
    report = out / "patrol_grunt_lod_report.json"
    report.write_text(json.dumps({"source": str(source), "profiles": records}, indent=2) + "\n")
    print(f"Wrote {report}")


if __name__ == "__main__":
    main()
