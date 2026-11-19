"""
Protocol Rebirth generated prop kit — rocks + barrel, opt-in (NOT wired into any
level). Matches the AD06 kit language in assets/env/nature/rocks: flat-shaded
faceted low-poly, olive-green moss wedges on top faces, light violet-grey
granite, vertex-color only (no textures). Headless Blender, CPU only (no GPU
on this machine): Workbench for previews, Cycles CPU only for the short AO
bake step described below.

Run:
  /home/box/opt/blender/blender -b -P tools/blender/make_props.py
  /home/box/opt/blender/blender -b -P tools/blender/make_props.py -- /custom/out/dir

Produces, in the output dir (default assets/env/nature/rocks-gen/ next to this
repo): rock_gen_a/b/c.glb, barrel_gen_a.glb, per-prop preview PNGs, a simple
contact_sheet.png, and manifest.json (tris/bbox/bytes computed from the actual
export). Seeded -> re-running yields identical files.

Baked lighting (owner addendum, 2026-11-19): every prop gets a real Cycles
CPU ray-traced AO bake into its vertex colors, plus a cheap analytic
sky/ground tint (no second light bake — the existing kit already proved vertex
color-only AO is enough; a full lighting bake would double CPU time for a
mobile asset that is this already low-poly). Both a "baked" and "unbaked"
color attribute are kept on every mesh so tools/blender/render_compare.py can
render both for a side-by-side judgement call; only the baked colors are
written to COLOR_0 on export (see RECOMMENDATION below) — this matches the
existing kit's own convention (assets/env/nature/rocks/manifest.json:
"vertex_colors": "COLOR_0.rgb baked AO, static alpha=1").

RECOMMENDATION: ship baked. See README.md in the output dir for the full
writeup and the side-by-side contact_sheet_compare.png.
"""

import bpy
import bmesh
import json
import math
import os
import random
import sys

from mathutils import Vector
from mathutils import noise as mnoise

# ---------------------------------------------------------------------------
# paths / constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
DEFAULT_OUT = os.path.join(REPO_ROOT, "assets", "env", "nature", "rocks-gen")


def parse_outdir():
    argv = sys.argv
    if "--" in argv:
        rest = argv[argv.index("--") + 1:]
        if rest:
            return os.path.abspath(rest[0])
    return DEFAULT_OUT


OUT = parse_outdir()

# AD06 tokens (docs/art-direction.md) plus two additions sampled directly from
# the shipped kit atlas (assets/env/nature/rocks/rock_atlas.png) so the
# generated body/moss land on the same values the kit already uses, not just
# the same named token family.
PALETTE = {
    "deep_navy": (0x1B, 0x27, 0x40),
    "muted_teal": (0x2E, 0x5C, 0x63),
    "violet_granite": (0x7C, 0x7E, 0x97),
    "olive_ground": (0x8B, 0x8B, 0x6C),
    "amber_utility": (0xFF, 0x9D, 0x4D),
    "coral_horizon": (0xE4, 0x70, 0x5F),
    "warning": (0xD9, 0x55, 0x2F),
    "lavender_air": (0xB0, 0xA0, 0xC6),
    # sampled from rock_atlas.png (r0c3): light violet-grey granite swatch
    "kit_granite_light": (0x92, 0x8D, 0x98),
    # sampled from rock_atlas.png (r1c0/r1c1): clearer, greener moss than
    # the khaki olive_ground token reads at thumbnail size
    "kit_moss_clear": (0x6B, 0x7A, 0x56),
    "kit_moss_sage": (0x8F, 0x9C, 0x82),
}


def srgb_to_linear(c):
    c = c / 255.0
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def rgb_raw(r255, g255, b255, a=1.0):
    return (srgb_to_linear(r255), srgb_to_linear(g255), srgb_to_linear(b255), a)


# Vertex-color (BYTE_COLOR) attributes are stored sRGB-encoded in Blender;
# writing already-linearized floats double-corrects and crushes everything
# toward black. These return the raw 0-1 sRGB fraction for bmesh color layers.
def vcol(name, a=1.0):
    r, g, b = PALETTE[name]
    return (r / 255.0, g / 255.0, b / 255.0, a)


def vcol_raw(r255, g255, b255, a=1.0):
    return (r255 / 255.0, g255 / 255.0, b255 / 255.0, a)


def lerp(a, b, t):
    return a + (b - a) * t


def lerp3(c0, c1, t):
    return tuple(lerp(c0[i], c1[i], t) for i in range(len(c0)))


def clamp01(x):
    return max(0.0, min(1.0, x))


# ---------------------------------------------------------------------------
# scene bootstrap
# ---------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.unit_settings.system = 'METRIC'
    return scene


def new_mesh_object(name, mesh):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_transforms(obj):
    select_only(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def settle_to_base(obj):
    """Move object so its bounding box bottom sits exactly on z=0 and it is
    centered in X/Y, then bake that into the mesh data (origin at base)."""
    mesh = obj.data
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    cx = (min(xs) + max(xs)) * 0.5
    cy = (min(ys) + max(ys)) * 0.5
    minz = min(zs)
    for v in mesh.vertices:
        v.co.x -= cx
        v.co.y -= cy
        v.co.z -= minz
    mesh.update()


def shade_flat_hard(obj):
    """Hard faceted shading (verdict: 'flat shading / hard facets like the
    kit, not smooth blobs') — no auto-smooth angle at all."""
    select_only(obj)
    bpy.ops.object.shade_flat()


def tri_count(obj):
    mesh = obj.data
    total = 0
    for p in mesh.polygons:
        total += len(p.vertices) - 2
    return total


def dims(obj):
    return tuple(round(d, 4) for d in obj.dimensions)


def bbox(obj):
    mesh = obj.data
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return {
        "min": [round(min(xs), 6), round(min(ys), 6), round(min(zs), 6)],
        "max": [round(max(xs), 6), round(max(ys), 6), round(max(zs), 6)],
    }


# ---------------------------------------------------------------------------
# baked lighting (addendum): real AO bake (Cycles CPU) + cheap sky/ground tint
# ---------------------------------------------------------------------------

def compute_sky_tint(mesh, ground_tint, sky_tint, strength=0.55):
    """Analytic 'simple key/sky lighting' approximation: brighter toward
    +Z-facing (sky), slightly cooler/darker toward -Z-facing (ground bounce).
    Cheap (no raytracing) — a real directional-light bake was evaluated and
    rejected, see module docstring / README.md."""
    out = {}
    for p in mesh.polygons:
        t = clamp01(p.normal.z * 0.5 + 0.5)
        tint = lerp3(ground_tint, sky_tint, t)
        tint = lerp3((1.0, 1.0, 1.0, 1.0), tint, strength)
        out[p.index] = tint
    return out


def bake_ao_to_attribute(obj, attr_name, samples=32):
    """Real raytraced AO via Cycles (CPU only — no /dev/dri on this box).
    Bakes into a fresh BYTE_COLOR CORNER attribute and returns it as a dict
    of per-loop (r,g,b) in 0..1, leaving the mesh's other color attributes
    and the active one untouched."""
    mesh = obj.data
    if attr_name in mesh.color_attributes:
        mesh.color_attributes.remove(mesh.color_attributes[attr_name])
    attr = mesh.color_attributes.new(name=attr_name, type='BYTE_COLOR', domain='CORNER')
    mesh.color_attributes.active_color_name = attr_name

    scene = bpy.context.scene
    prev_engine = scene.render.engine
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False

    # AO bake needs a material slot to exist; a bare default is fine, the
    # vertex-color target is independent of the material's own shading.
    if not mesh.materials:
        mesh.materials.append(bpy.data.materials.new(f"{obj.name}_bake_tmp"))

    # Every prop gets built into the same scene at/near the origin before
    # being spread out for export; without this, AO bakes each rock against
    # its still-overlapping siblings and reads almost solid black. Hide every
    # other mesh from rendering (Cycles bake respects hide_render) for the
    # duration of this object's bake only.
    hidden = []
    for o in bpy.data.objects:
        if o is not obj and o.type == 'MESH' and not o.hide_render:
            o.hide_render = True
            hidden.append(o)

    select_only(obj)
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=2)

    for o in hidden:
        o.hide_render = False
    scene.render.engine = prev_engine

    out = [tuple(attr.data[i].color)[:3] for i in range(len(attr.data))]
    mesh.color_attributes.remove(attr)
    return out


def apply_baked_variant(obj, base_attr="Color", baked_attr="ColorBaked",
                         ground_tint=None, sky_tint=None):
    """Writes `baked_attr` = base_attr * AO * sky-tint. Leaves base_attr
    (the 'unbaked' colors) untouched so render_compare.py can show both."""
    mesh = obj.data
    ground_tint = ground_tint or vcol_raw(0x55, 0x5A, 0x66)
    sky_tint = sky_tint or vcol_raw(0xC8, 0xD2, 0xDE)

    ao = bake_ao_to_attribute(obj, "_AO_tmp")
    sky = compute_sky_tint(mesh, ground_tint, sky_tint)

    base = mesh.color_attributes[base_attr]
    if baked_attr in mesh.color_attributes:
        mesh.color_attributes.remove(mesh.color_attributes[baked_attr])
    baked = mesh.color_attributes.new(name=baked_attr, type='BYTE_COLOR', domain='CORNER')

    li = 0
    for p in mesh.polygons:
        tint = sky[p.index]
        for loop_index in p.loop_indices:
            bc = base.data[loop_index].color
            ao_v = ao[li] if li < len(ao) else (1.0, 1.0, 1.0)
            ao_scalar = (ao_v[0] + ao_v[1] + ao_v[2]) / 3.0
            # keep AO from crushing the read at thumbnail scale: floor it
            ao_scalar = lerp(0.3, 1.0, ao_scalar)
            r = clamp01(bc[0] * ao_scalar * tint[0])
            g = clamp01(bc[1] * ao_scalar * tint[1])
            b = clamp01(bc[2] * ao_scalar * tint[2])
            baked.data[loop_index].color = (r, g, b, bc[3])
            li += 1
    mesh.update()
    return baked_attr


# ---------------------------------------------------------------------------
# ROCK — faceted low-poly boulder with olive moss wedges
# ---------------------------------------------------------------------------

ROCK_BODY_LIGHT = vcol("kit_granite_light")
ROCK_BODY_VIOLET = vcol("violet_granite")
MOSS_CLEAR = vcol("kit_moss_clear")
MOSS_SAGE = vcol("kit_moss_sage")


def build_rock(name, seed, target_size, squash):
    """squash = (sx, sy, sz) proportions; sz close to 1.0 reads as a taller
    boulder, sz ~0.55-0.65 reads as a flatter, wider stone (verdict: rock_03
    was too flat -> give it the tallest sz of the three)."""
    rnd = random.Random(seed)
    seed_off = Vector((rnd.uniform(0, 1000), rnd.uniform(0, 1000), rnd.uniform(0, 1000)))

    # subdivisions=3 -> 320 tris: enough verts for an irregular wind-shaped
    # silhouette while staying inside the 150-400 tri budget and, combined
    # with hard flat shading below, reading as big clean facets rather than
    # the smoothed blobs the verdict called out.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    mesh = obj.data

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.normal_update()

    # low-frequency warp only: shapes the macro silhouette into a lumpy,
    # non-spherical boulder. No fine high-frequency noise pass — that used to
    # add lots of tiny bumps that smooth-shaded into a "blob"; dropping it
    # lets the icosphere's own low-poly triangulation read as clean facets.
    warp_freq = rnd.uniform(0.7, 1.0)
    for v in bm.verts:
        n = v.normal.copy()
        p = v.co * warp_freq + seed_off
        warp = mnoise.noise(p) - 0.25
        v.co += n * warp * 0.45

    sx, sy, sz = squash
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz

    bm.normal_update()

    # flatten the base so the rock rests believably (clamp, no new topology)
    zs = [v.co.z for v in bm.verts]
    minz = min(zs)
    base_clamp = minz + (max(zs) - minz) * rnd.uniform(0.08, 0.14)
    for v in bm.verts:
        if v.co.z < base_clamp:
            v.co.z = base_clamp

    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    # vertex colors: light violet-grey granite body with gentle per-facet
    # hue drift, and clean olive moss WEDGES (angular sectors near the top,
    # not noise-blotches) matching assets/env/nature/rocks/contact_sheet.png.
    col_layer = bm.loops.layers.color.new("Color")

    hue_t = rnd.uniform(0.0, 1.0)
    base_body = lerp3(ROCK_BODY_LIGHT, ROCK_BODY_VIOLET, hue_t * 0.4)

    n_sectors = rnd.choice([7, 8, 9])
    sector_offset = rnd.uniform(0, 2 * math.pi)
    # verdict: "clearer" wedges -> a few small, separated pie-slice patches,
    # never two touching sectors (that reads as one big blob again).
    order = list(range(n_sectors))
    rnd.shuffle(order)
    moss_sectors = set()
    target_n = rnd.choice([2, 2, 3])
    for i in order:
        if len(moss_sectors) >= target_n:
            break
        if (i - 1) % n_sectors in moss_sectors or (i + 1) % n_sectors in moss_sectors:
            continue
        moss_sectors.add(i)
    moss_two_tone = {i: (MOSS_CLEAR if rnd.random() < 0.6 else MOSS_SAGE) for i in moss_sectors}

    maxz = max(v.co.z for v in bm.verts)
    minz2 = min(v.co.z for v in bm.verts)
    height = max(maxz - minz2, 1e-6)

    bm.normal_update()
    for f in bm.faces:
        fn = f.normal
        center = f.calc_center_median()

        # gentle low-frequency facet-to-facet brightness drift, kept subtle
        # so the body still reads LIGHT (verdict) rather than muddy/dark.
        crev_n = mnoise.noise(center * 1.0 + seed_off * 2.3)
        shade = lerp(0.9, 1.08, crev_n)
        face_col = tuple(min(1.0, c * shade) for c in base_body[:3]) + (1.0,)

        up = fn.z
        height_t = (center.z - minz2) / height
        if up > 0.45 and height_t > 0.68:
            az = math.atan2(center.y, center.x) + sector_offset
            sector = int(((az % (2 * math.pi)) / (2 * math.pi)) * n_sectors) % n_sectors
            if sector in moss_sectors:
                # hard per-face wedge (flat shading means no inter-face
                # blending anyway) -> crisp pie-slice edges like the kit.
                face_col = lerp3(face_col, moss_two_tone[sector], 0.88)

        for loop in f.loops:
            loop[col_layer] = face_col

    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    if "Color" in mesh.color_attributes:
        mesh.color_attributes.active_color_name = "Color"
        mesh.color_attributes.render_color_index = mesh.color_attributes.find("Color")

    shade_flat_hard(obj)

    apply_transforms(obj)
    settle_to_base(obj)

    # scale to target largest dimension
    bpy.context.view_layer.update()
    maxdim = max(obj.dimensions)
    scale = target_size / maxdim
    obj.scale = (scale, scale, scale)
    apply_transforms(obj)
    settle_to_base(obj)

    mat = bpy.data.materials.new(f"{name}_mat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    vcol_node = nt.nodes.new("ShaderNodeVertexColor")
    vcol_node.layer_name = "Color"
    nt.links.new(vcol_node.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.88
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    mat.diffuse_color = tuple(srgb_to_linear(c * 255) for c in base_body[:3]) + (1.0,)
    obj.data.materials.append(mat)

    return obj


# ---------------------------------------------------------------------------
# BARREL (200L steel drum) — vertex colors only (kit convention), no texture
# ---------------------------------------------------------------------------

BARREL_HEIGHT = 0.88
BARREL_RADIUS = 0.29
BARREL_SEGMENTS = 16  # was 20: trims tris to stay well under the 500 budget
                       # once the bung detail is added back in, with no
                       # visible loss at mobile/phone scale.

BARREL_PROFILE = [
    (0.000, 0.290),
    (0.020, 0.290),
    (0.050, 0.278),
    (0.115, 0.292),
    (0.155, 0.280),
    (0.450, 0.296),
    (0.740, 0.280),
    (0.780, 0.292),
    (0.820, 0.278),
    (0.860, 0.270),
    (0.880, 0.270),
]

STRIPE_Z = (0.40, 0.58)

# kit alignment (verdict: "barrel is decent, keep, minor alignment with the
# kit palette is fine") — cooled a step toward the violet-grey granite body
# so the barrel reads as part of the same cold Nordic kit, not a separate hue.
STEEL_DARK = vcol_raw(0x43, 0x4C, 0x5C)
STEEL_LIGHT = vcol_raw(0x6A, 0x76, 0x8A)
CAP_COLOR = vcol_raw(0x3A, 0x42, 0x50)


def build_barrel(name, seed):
    rnd = random.Random(seed)
    mesh = bpy.data.meshes.new(name)
    obj = new_mesh_object(name, mesh)

    bm = bmesh.new()
    segs = BARREL_SEGMENTS
    rings = []
    for (z, r) in BARREL_PROFILE:
        ring = []
        for i in range(segs):
            ang = 2.0 * math.pi * i / segs
            x = math.cos(ang) * r
            y = math.sin(ang) * r
            v = bm.verts.new((x, y, z))
            ring.append(v)
        rings.append(ring)
    bm.verts.ensure_lookup_table()

    col_layer = bm.loops.layers.color.new("Color")
    stripe_c = vcol("coral_horizon")
    stripe_warn = vcol("warning")
    rust = vcol_raw(0x8A, 0x4E, 0x2A)

    def vcol_for(z, u):
        v = z / BARREL_HEIGHT
        if STRIPE_Z[0] <= z <= STRIPE_Z[1]:
            warn_n = mnoise.noise(Vector((u * 6.0, v * 20.0, seed + 7)))
            return lerp3(stripe_c, stripe_warn, max(0.0, (warn_n - 0.3) * 1.6))
        rim_bias = 0.0
        if v < 0.12:
            rim_bias = (0.12 - v) / 0.12
        elif v > 0.9:
            rim_bias = (v - 0.9) / 0.1
        mottle = mnoise.noise(Vector((u * 9.0, v * 9.0, seed)))
        base = lerp3(STEEL_DARK, STEEL_LIGHT, mottle)
        n = mnoise.noise(Vector((u * 6.0, v * 6.0, seed + 3)))
        rust_amt = min(1.0, max(0.0, n - 0.55) * 1.5 + rim_bias * 0.7)
        return lerp3(base, rust, rust_amt)

    for ri in range(len(rings) - 1):
        ring_a = rings[ri]
        ring_b = rings[ri + 1]
        za = BARREL_PROFILE[ri][0]
        zb = BARREL_PROFILE[ri + 1][0]
        for i in range(segs):
            i2 = (i + 1) % segs
            v0, v1v, v2, v3 = ring_a[i], ring_a[i2], ring_b[i2], ring_b[i]
            f = bm.faces.new((v0, v1v, v2, v3))
            u0 = i / segs
            c0 = vcol_for(za, u0)
            c1 = vcol_for(zb, u0)
            for loop in f.loops:
                loop[col_layer] = c0 if loop.vert.co.z < (za + zb) * 0.5 else c1

    bottom_ring = rings[0]
    center_b = bm.verts.new((0, 0, BARREL_PROFILE[0][0]))
    for i in range(segs):
        i2 = (i + 1) % segs
        f = bm.faces.new((center_b, bottom_ring[i2], bottom_ring[i]))
        for loop in f.loops:
            loop[col_layer] = CAP_COLOR

    top_ring = rings[-1]
    center_t = bm.verts.new((0, 0, BARREL_PROFILE[-1][0]))
    for i in range(segs):
        i2 = (i + 1) % segs
        f = bm.faces.new((center_t, top_ring[i], top_ring[i2]))
        for loop in f.loops:
            loop[col_layer] = CAP_COLOR

    # bung: small raised cylinder on the top cap, off-center, for readability
    bung_r = 0.035
    bung_h = 0.02
    bung_segs = 6
    bung_cx, bung_cy = BARREL_RADIUS * 0.4, 0.0
    bz = BARREL_PROFILE[-1][0]
    bring_lo, bring_hi = [], []
    for i in range(bung_segs):
        ang = 2.0 * math.pi * i / bung_segs
        x = bung_cx + math.cos(ang) * bung_r
        y = bung_cy + math.sin(ang) * bung_r
        bring_lo.append(bm.verts.new((x, y, bz)))
        bring_hi.append(bm.verts.new((x, y, bz + bung_h)))
    bcenter = bm.verts.new((bung_cx, bung_cy, bz + bung_h))
    for i in range(bung_segs):
        i2 = (i + 1) % bung_segs
        f = bm.faces.new((bring_lo[i], bring_lo[i2], bring_hi[i2], bring_hi[i]))
        for loop in f.loops:
            loop[col_layer] = CAP_COLOR
        f2 = bm.faces.new((bring_hi[i], bring_hi[i2], bcenter))
        for loop in f2.loops:
            loop[col_layer] = CAP_COLOR

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    if "Color" in mesh.color_attributes:
        mesh.color_attributes.active_color_name = "Color"
        mesh.color_attributes.render_color_index = mesh.color_attributes.find("Color")

    shade_flat_hard(obj)

    apply_transforms(obj)
    settle_to_base(obj)

    mat = bpy.data.materials.new(f"{name}_mat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    vcol_node = nt.nodes.new("ShaderNodeVertexColor")
    vcol_node.layer_name = "Color"
    nt.links.new(vcol_node.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.2
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    mat.diffuse_color = tuple(srgb_to_linear(c * 255) for c in STEEL_DARK[:3]) + (1.0,)
    obj.data.materials.append(mat)

    return obj


# ---------------------------------------------------------------------------
# export
# ---------------------------------------------------------------------------

def finalize_for_export(obj, color_attr):
    """Collapses the mesh down to exactly one COLOR_0-bound color attribute
    (the chosen variant), named 'Color', and points the material's vertex
    color node at it, so the glTF export writes a single clean COLOR_0
    instead of every scratch attribute used during baking/compare."""
    mesh = obj.data
    if color_attr != "Color":
        if "Color" in mesh.color_attributes:
            mesh.color_attributes.remove(mesh.color_attributes["Color"])
        mesh.color_attributes[color_attr].name = "Color"
    for extra in [n for n in list(mesh.color_attributes.keys()) if n != "Color"]:
        mesh.color_attributes.remove(mesh.color_attributes[extra])
    mesh.color_attributes.active_color_name = "Color"
    mesh.color_attributes.render_color_index = mesh.color_attributes.find("Color")
    for mat in mesh.materials:
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'VERTEX_COLOR':
                node.layer_name = "Color"


def export_glb(obj, path, color_attr="Color"):
    finalize_for_export(obj, color_attr)
    select_only(obj)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
        export_image_format='NONE',
        export_texcoords=False,
        export_vertex_color='ACTIVE',
        export_all_vertex_colors=False,
        export_normals=True,
        export_cameras=False,
        export_lights=False,
    )


# ---------------------------------------------------------------------------
# preview rendering (Workbench) — shared with render_compare.py
# ---------------------------------------------------------------------------

def setup_render_common(scene):
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    shading = scene.display.shading
    shading.light = 'STUDIO'
    shading.studio_light = 'studio.sl'
    shading.studiolight_rotate_z = math.radians(35)
    shading.studiolight_intensity = 1.4
    shading.show_shadows = True
    shading.shadow_intensity = 0.45
    shading.show_cavity = True
    shading.cavity_type = 'BOTH'
    shading.curvature_ridge_factor = 1.0
    shading.curvature_valley_factor = 1.0
    shading.color_type = 'VERTEX'
    shading.show_specular_highlight = False
    shading.background_type = 'VIEWPORT'
    shading.background_color = rgb_raw(0x1B, 0x27, 0x40)[:3]
    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.color = rgb_raw(0x1B, 0x27, 0x40)[:3]


def make_ground(size=6.0):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    plane = bpy.context.active_object
    plane.name = "Ground"
    navy = vcol_raw(0x22, 0x2B, 0x3F)
    attr = plane.data.color_attributes.new(name="Color", type='BYTE_COLOR', domain='CORNER')
    for i in range(len(attr.data)):
        attr.data[i].color = navy
    plane.data.color_attributes.active_color_name = "Color"
    mat = bpy.data.materials.new("GroundMat")
    mat.use_nodes = True
    mat.diffuse_color = navy
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgb_raw(0x22, 0x2B, 0x3F)
        bsdf.inputs["Roughness"].default_value = 0.95
    plane.data.materials.append(mat)
    return plane


def frame_camera(obj, margin=1.35):
    bpy.ops.object.camera_add(location=(0, 0, 0))
    cam = bpy.context.active_object
    cam.name = "PreviewCam"
    maxdim = max(obj.dimensions)
    center = Vector((0, 0, obj.dimensions.z * 0.5))
    dist = maxdim * margin * 2.6
    az = math.radians(-35)
    # docs/art-direction.md camera reference: pitch ~52 deg. The kit's own
    # contact_sheet.png/dusk_preview.png were shot close to that steep
    # top-down pitch; a low (27 deg) elevation made the existing M rocks
    # read as tall pointed cones instead of the rounded mounds they actually
    # are in-kit, which would have made render_compare.py an unfair, broken
    # comparison.
    el = math.radians(50)
    pos = Vector((
        math.cos(el) * math.sin(az),
        -math.cos(el) * math.cos(az),
        math.sin(el),
    )) * dist + center
    cam.location = pos
    direction = (center - pos)
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    return cam


def render_preview(obj, filepath, other_objs, active_color_attr=None, cavity=True):
    scene = bpy.context.scene
    mesh = obj.data
    if active_color_attr and active_color_attr in mesh.color_attributes:
        mesh.color_attributes.active_color_name = active_color_attr
        # Workbench's VERTEX solid-shading mode (and export) reads the
        # render-active attribute, not the edit-mode "active" one; setting
        # only active_color_name left every preview silently showing
        # whichever attribute was render-active since mesh creation.
        mesh.color_attributes.render_color_index = mesh.color_attributes.find(active_color_attr)
    # Workbench's screen-space cavity fakes its own AO-like darkening in
    # creases regardless of vertex colors, which would mask the real baked
    # AO this script writes into the mesh. Callers comparing baked vs
    # unbaked colors turn this off so the difference shown is only the
    # vertex-color data, not a viewport trick layered on top of both.
    scene.display.shading.show_cavity = cavity
    hidden = []
    for o in other_objs:
        if o is not obj and o.type == 'MESH':
            if not o.hide_render:
                o.hide_render = True
                hidden.append(o)
    ground = make_ground()
    cam = frame_camera(obj)
    scene.render.filepath = filepath
    scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(ground, do_unlink=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    for o in hidden:
        o.hide_render = False


# ---------------------------------------------------------------------------
# contact sheet (VSE compositing of already-rendered PNGs)
# ---------------------------------------------------------------------------

def build_contact_sheet(entries, out_path):
    """entries: list of (png_path, label)"""
    scene = bpy.data.scenes.new("ContactSheet")
    bpy.context.window.scene = scene
    scene.sequence_editor_create()
    se = scene.sequence_editor

    cols = 4
    rows = 1
    tile_w, tile_h = 480, 360
    pad = 24
    label_h = 48
    sheet_w = cols * tile_w + (cols + 1) * pad
    sheet_h = rows * (tile_h + label_h) + (rows + 1) * pad

    scene.render.resolution_x = sheet_w
    scene.render.resolution_y = sheet_h
    scene.render.resolution_percentage = 100
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    scene.frame_start = 1
    scene.frame_end = 1
    scene.frame_set(1)

    bg = se.sequences.new_effect(name="bg", type='COLOR', channel=1, frame_start=1, frame_end=2)
    bg.color = rgb_raw(0x12, 0x18, 0x29)[:3]

    for i, (png_path, label) in enumerate(entries):
        col = i % cols
        row = i // cols
        cx = pad + col * (tile_w + pad) + tile_w / 2
        cy_img = sheet_h - (pad + row * (tile_h + label_h + pad) + tile_h / 2)

        strip = se.sequences.new_image(
            name=f"img{i}", filepath=png_path, channel=2 + i, frame_start=1)
        strip.frame_final_duration = 2
        img_w, img_h = 1024, 768
        scale = min(tile_w / img_w, tile_h / img_h)
        strip.transform.scale_x = scale
        strip.transform.scale_y = scale
        strip.transform.offset_x = cx - sheet_w / 2
        strip.transform.offset_y = cy_img - sheet_h / 2

        txt = se.sequences.new_effect(
            name=f"lbl{i}", type='TEXT', channel=20 + i, frame_start=1, frame_end=2)
        txt.text = label
        txt.font_size = 34
        txt.color = rgb_raw(0xE8, 0xE6, 0xEE)
        txt.use_shadow = False
        txt.use_box = False
        txt.alignment_x = 'CENTER'
        txt.anchor_x = 'CENTER'
        txt.anchor_y = 'CENTER'
        label_y_frac = (pad + row * (tile_h + label_h + pad) + tile_h + label_h * 0.5) / sheet_h
        txt.location = (col * (tile_w + pad) / sheet_w + (tile_w / 2 + pad) / sheet_w, 1.0 - label_y_frac)

    scene.render.filepath = out_path
    scene.render.image_settings.file_format = 'PNG'
    scene.render.use_sequencer = True
    bpy.ops.render.render(write_still=True, scene=scene.name)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

ROCK_VARIANTS = [
    # (name, seed, target_size_m, (sx, sy, sz))
    ("rock_gen_a", 11001, 0.95, (1.18, 1.0, 0.62)),
    ("rock_gen_b", 22002, 1.15, (1.28, 1.05, 0.58)),
    # verdict: rock_03/c was too flat -> much less z-squash, reads as a
    # taller boulder instead of a flattened pancake.
    ("rock_gen_c", 33003, 1.0, (1.0, 0.95, 0.92)),
]
BARREL_VARIANT = ("barrel_gen_a", 44004)


def build_all(apply_bake=True, reset=True):
    """Builds every prop object and (if apply_bake) its baked color variant.
    Returns (rock_objs, barrel_obj) with both 'Color' (unbaked) and, when
    apply_bake, 'ColorBaked' color attributes present on each mesh.
    reset=False lets a caller (render_compare.py) load other objects (e.g.
    the existing kit GLBs) into the same scene first."""
    if reset:
        reset_scene()
    rock_objs = []
    for name, seed, size, squash in ROCK_VARIANTS:
        obj = build_rock(name, seed, size, squash)
        rock_objs.append(obj)

    barrel_name, barrel_seed = BARREL_VARIANT
    barrel_obj = build_barrel(barrel_name, barrel_seed)

    if apply_bake:
        for obj in rock_objs + [barrel_obj]:
            apply_baked_variant(obj)

    return rock_objs, barrel_obj


def main():
    os.makedirs(OUT, exist_ok=True)
    rock_objs, barrel_obj = build_all(apply_bake=True)
    all_objs = rock_objs + [barrel_obj]

    # --- previews (baked, the shipped variant) FIRST: export below collapses
    # each mesh down to a single color attribute, so render before that. ---
    scene = bpy.context.scene
    setup_render_common(scene)

    preview_entries = []
    for obj in rock_objs:
        png = os.path.join(OUT, f"{obj.name}.png")
        render_preview(obj, png, all_objs, active_color_attr="ColorBaked")
        preview_entries.append((png, obj.name.upper().replace("_", " ")))

    png_b = os.path.join(OUT, f"{barrel_obj.name}.png")
    render_preview(barrel_obj, png_b, all_objs, active_color_attr="ColorBaked")
    preview_entries.append((png_b, barrel_obj.name.upper().replace("_", " ")))

    build_contact_sheet(preview_entries, os.path.join(OUT, "contact_sheet.png"))
    bpy.context.window.scene = scene  # build_contact_sheet switches the active scene

    # --- export (collapses to one COLOR_0 attribute per mesh) ---
    summary = []
    manifest_assets = []
    for obj in all_objs:
        tris = tri_count(obj)
        d = dims(obj)
        bb = bbox(obj)
        out_path = os.path.join(OUT, f"{obj.name}.glb")
        # RECOMMENDATION (see README.md): ship the baked variant.
        export_glb(obj, out_path, color_attr="ColorBaked")
        size_bytes = os.path.getsize(out_path)
        summary.append((obj.name, tris, d, size_bytes))
        kind = "rock" if obj in rock_objs else "barrel"
        manifest_assets.append({
            "file": f"{obj.name}.glb",
            "kind": kind,
            "approx_dimensions_m": list(d),
            "bbox_m": bb,
            "collision": "cylinder r=%.2f" % (max(d[0], d[2]) / 2) if kind == "rock" else "cylinder r=0.3",
            "triangle_count": tris,
            "material_count": 1,
            "file_size_bytes": size_bytes,
            "notes": ("Generated faceted low-poly rock, vertex-color body + olive moss wedges, baked AO."
                      if kind == "rock" else
                      "Generated 200L steel drum, vertex-color only (no texture), baked AO."),
        })

    manifest = {
        "kit": "Protocol Rebirth — Generated Props v0.1 (opt-in, not wired into any level)",
        "generator": "tools/blender/make_props.py",
        "units": "metres",
        "up_axis": "Y",
        "front": "-Z",
        "origin": "bottom centre",
        "vertex_colors": "COLOR_0.rgb baked AO + analytic sky tint, static alpha=1 (see README.md)",
        "assets": manifest_assets,
    }
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    print("\n=== Protocol Rebirth generated prop kit — summary ===")
    print(f"output dir: {OUT}")
    for name, tris, d, size_bytes in summary:
        print(f"{name:12s}  tris={tris:4d}  dims(x,y,z)={d}  bytes={size_bytes}")
    print("=== done ===")


if __name__ == "__main__":
    main()
