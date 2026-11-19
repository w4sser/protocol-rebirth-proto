#!/usr/bin/env python3
"""
Downscales/recompresses the preview PNGs tools/blender/make_props.py writes
into assets/env/nature/rocks-gen/ (committed to the repo) so each stays
comfortably small. Workbench's raw 1024x768 renders are lossless ~800KB
each, which is fine as scratch output but not for something tracked in git.
Run after make_props.py:

  python3 tools/blender/shrink_previews.py
"""

import os

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
OUT_DIR = os.path.join(REPO_ROOT, "assets", "env", "nature", "rocks-gen")

BUDGET_BYTES = 150_000
PREVIEW_SIZE = (512, 384)  # per-prop preview PNGs (rock_gen_a.png, ...)


def shrink(path, max_size):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    scale = min(1.0, max_size[0] / w, max_size[1] / h)
    if scale < 1.0:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    for colors in (160, 128, 96, 64):
        q = im.convert("P", palette=Image.ADAPTIVE, colors=colors)
        q.save(path, format="PNG", optimize=True)
        size = os.path.getsize(path)
        if size <= BUDGET_BYTES:
            return size, colors
    return size, colors


def main():
    # contact_sheet_compare.png has its own ~600KB budget and is built (and
    # already re-encoded if needed) by compose_contact_sheet.py; don't touch it.
    targets = [f for f in os.listdir(OUT_DIR) if f.endswith(".png") and f != "contact_sheet_compare.png"]
    for name in sorted(targets):
        path = os.path.join(OUT_DIR, name)
        before = os.path.getsize(path)
        max_size = PREVIEW_SIZE if name != "contact_sheet.png" else (1600, 900)
        after, colors = shrink(path, max_size)
        status = "OK" if after <= BUDGET_BYTES else "OVER BUDGET"
        print(f"{name:24s} {before:8d} -> {after:7d} bytes (palette {colors}) [{status}]")


if __name__ == "__main__":
    main()
