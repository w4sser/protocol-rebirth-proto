#!/usr/bin/env python3
"""
Plain Python (system python3, NOT Blender) compositor for
contact_sheet_compare.png. Consumes the raw Workbench renders that
tools/blender/render_compare.py writes to
assets/env/nature/rocks-gen/_compare_renders/ and assembles a labeled,
4-row comparison:

  1. EXISTING KIT     — assets/env/nature/rocks/rock_granite_m_a/b/c, same
                         Workbench camera/lighting as our own previews.
  2. GENERATED BAKED   — the shipped variant (AO + sky tint baked into
                         vertex colors).
  3. GENERATED UNBAKED — flat stylized vertex color only, no AO/lighting.
  4. BAKED, COLD GRADE — row 2 run through a CSS-filter approximation of the
                         only "cold bunker grade" that exists in this
                         codebase today: the ruin=3 filter in index.html
                         (`filter:brightness(.34) saturate(.3) sepia(.22)
                         hue-rotate(165deg)`, PRB-149 / docs/design-
                         decisions.md 2026-11-13). There is no separate
                         "gfx grading PR" in this repo; this is it.

Run:
  python3 tools/blender/compose_contact_sheet.py

Writes assets/env/nature/rocks-gen/contact_sheet_compare.png, kept under the
~600 KB budget via JPEG-quality-equivalent PNG palette reduction / explicit
re-encode at the requested tile size.
"""

import json
import math
import os

from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
OUT_DIR = os.path.join(REPO_ROOT, "assets", "env", "nature", "rocks-gen")
RENDER_DIR = os.path.join(OUT_DIR, "_compare_renders")
ENTRIES_PATH = os.path.join(RENDER_DIR, "entries.json")
OUT_PATH = os.path.join(OUT_DIR, "contact_sheet_compare.png")

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
FONT_PATH_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

TILE_W, TILE_H = 340, 255
PAD = 14
LABEL_H = 26
ROW_LABEL_W = 150
BG = (0x10, 0x16, 0x24)
ROW_LABEL_BG = (0x1B, 0x27, 0x40)
TEXT_COLOR = (0xE8, 0xE6, 0xEE)


# ---------------------------------------------------------------------------
# cold blue-grey grade approximation — exact CSS Filter Effects / SVG
# feColorMatrix matrices, applied in the same left-to-right order CSS lists
# them (brightness -> saturate -> sepia -> hue-rotate), matching the DOM
# filter string verbatim:
#   filter: brightness(.34) saturate(.3) sepia(.22) hue-rotate(165deg);
# (index.html, .baseviewer[data-ruin="3"] .baseworld)
# ---------------------------------------------------------------------------

def _mat_mul(m, rgb):
    r, g, b = rgb
    return (
        m[0] * r + m[1] * g + m[2] * b,
        m[3] * r + m[4] * g + m[5] * b,
        m[6] * r + m[7] * g + m[8] * b,
    )


def _saturate_matrix(s):
    return (
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
    )


def _sepia_matrix(a):
    full = (
        0.393, 0.769, 0.189,
        0.349, 0.686, 0.168,
        0.272, 0.534, 0.131,
    )
    ident = (1, 0, 0, 0, 1, 0, 0, 0, 1)
    return tuple(ident[i] * (1 - a) + full[i] * a for i in range(9))


def _hue_rotate_matrix(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return (
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
    )


def cold_bunker_grade(im):
    """brightness(.34) saturate(.3) sepia(.22) hue-rotate(165deg), applied
    to sRGB pixel values exactly as a browser's CSS `filter` would (no
    linearization — DOM filters operate on the encoded pixel)."""
    im = im.convert("RGB")
    px = im.load()
    w, h = im.size
    sat = _saturate_matrix(0.3)
    sep = _sepia_matrix(0.22)
    hue = _hue_rotate_matrix(165)
    # precompute a 256^3-sized LUT would be ideal, but a per-pixel pass over
    # a small contact-sheet tile is already fast enough (<1s).
    cache = {}
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            key = (r, g, b)
            out = cache.get(key)
            if out is None:
                rf, gf, bf = r / 255.0 * 0.34, g / 255.0 * 0.34, b / 255.0 * 0.34
                rf, gf, bf = _mat_mul(sat, (rf, gf, bf))
                rf, gf, bf = _mat_mul(sep, (rf, gf, bf))
                rf, gf, bf = _mat_mul(hue, (rf, gf, bf))
                out = (
                    max(0, min(255, round(rf * 255))),
                    max(0, min(255, round(gf * 255))),
                    max(0, min(255, round(bf * 255))),
                )
                cache[key] = out
            px[x, y] = out
    return im


# ---------------------------------------------------------------------------
# layout
# ---------------------------------------------------------------------------

def load_tile(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    scale = min(TILE_W / w, TILE_H / h)
    im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    canvas = Image.new("RGB", (TILE_W, TILE_H), BG)
    canvas.paste(im, ((TILE_W - im.width) // 2, (TILE_H - im.height) // 2))
    return canvas


def label_font(size, bold=True):
    try:
        return ImageFont.truetype(FONT_PATH if bold else FONT_PATH_REGULAR, size)
    except OSError:
        return ImageFont.load_default()


def draw_centered(draw, box, text, font, color=TEXT_COLOR):
    x0, y0, x1, y1 = box
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((x0 + (x1 - x0 - tw) / 2, y0 + (y1 - y0 - th) / 2 - bbox[1]), text, font=font, fill=color)


def main():
    with open(ENTRIES_PATH) as f:
        entries = json.load(f)
    by_group = {}
    for path, label, group in entries:
        by_group.setdefault(group, []).append((path, label))

    kit = by_group["kit"]
    gen_baked = by_group["gen_baked"]
    gen_unbaked = by_group["gen_unbaked"]

    cols = max(len(kit), len(gen_baked))
    rows = [
        ("EXISTING KIT\n(rock_granite_m)", [load_tile(p) for p, _ in kit], [l for _, l in kit]),
        ("GENERATED\nBAKED (ship)", [load_tile(p) for p, _ in gen_baked], [l for _, l in gen_baked]),
        ("GENERATED\nUNBAKED", [load_tile(p) for p, _ in gen_unbaked], [l for _, l in gen_unbaked]),
        ("BAKED,\nCOLD GRADE", [cold_bunker_grade(load_tile(p)) for p, _ in gen_baked], [l for _, l in gen_baked]),
    ]

    sheet_w = ROW_LABEL_W + cols * (TILE_W + PAD) + PAD
    sheet_h = PAD + len(rows) * (TILE_H + LABEL_H + PAD)
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    title_font = label_font(15)
    label_font_small = label_font(13, bold=False)
    row_font = label_font(16)

    for ri, (row_title, tiles, labels) in enumerate(rows):
        ry = PAD + ri * (TILE_H + LABEL_H + PAD)
        draw.rectangle([0, ry, ROW_LABEL_W - 6, ry + TILE_H + LABEL_H], fill=ROW_LABEL_BG)
        lines = row_title.split("\n")
        ly = ry + TILE_H / 2 - len(lines) * 10
        for line in lines:
            draw_centered(draw, (0, ly, ROW_LABEL_W - 6, ly + 20), line, row_font)
            ly += 20
        for ci, tile in enumerate(tiles):
            tx = ROW_LABEL_W + PAD + ci * (TILE_W + PAD)
            sheet.paste(tile, (tx, ry))
            draw_centered(draw, (tx, ry + TILE_H, tx + TILE_W, ry + TILE_H + LABEL_H), labels[ci], title_font)

    note = ("cold grade = CSS filter approximation of index.html's ruin=3 (PRB-149) bunker filter "
            "- brightness(.34) saturate(.3) sepia(.22) hue-rotate(165deg)")

    # footer strip
    footer_h = 20
    final = Image.new("RGB", (sheet_w, sheet_h + footer_h), BG)
    final.paste(sheet, (0, 0))
    fdraw = ImageDraw.Draw(final)
    fdraw.text((PAD, sheet_h + 3), note, font=label_font_small, fill=(0xA0, 0xA6, 0xB4))

    os.makedirs(OUT_DIR, exist_ok=True)
    final.save(OUT_PATH, format="PNG", optimize=True)
    size = os.path.getsize(OUT_PATH)
    print(f"wrote {OUT_PATH} ({size} bytes, {final.size[0]}x{final.size[1]})")

    if size > 600_000:
        # re-encode as WebP (lossy, visually transparent at this content) to
        # stay inside the ~600KB budget without shrinking the layout.
        webp_path = OUT_PATH.replace(".png", ".webp")
        final.save(webp_path, format="WEBP", quality=88, method=6)
        wsize = os.path.getsize(webp_path)
        print(f"PNG over budget ({size}B) -> wrote {webp_path} ({wsize} bytes) instead, removing the PNG")
        os.remove(OUT_PATH)


if __name__ == "__main__":
    main()
