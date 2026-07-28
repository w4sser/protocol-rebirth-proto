#!/usr/bin/env python3
"""Add a piece of art to the prototype: crop/resize a source image and write an
optimized WebP into assets/production/.

Usage:
  python tools/add-art.py <source> <out_name> [--maxw 1400] [--q 80] \
                          [--crop x0 y0 x1 y1]   (crop box in PERCENT of the image)

Examples:
  # full image, downscaled to 1600px wide, quality 80
  python tools/add-art.py assets/reference/hub_refined.png hub_refined --maxw 1600 --q 80

  # crop the right 60% (a clean UI-free region), then resize
  python tools/add-art.py assets/reference/pre_raid.png hero_preraid --crop 40 8 79 84

Writes: assets/production/<out_name>.webp  (create the folder if missing)
Then wire the file into data/*.js (baseMap/hubStates/styleOptions/module art/etc)
and run the tests before committing.

Needs Pillow:  pip install pillow  (or pip install pillow --break-system-packages)
"""
import sys, os, argparse
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                       # prototype/
PROD = os.path.join(ROOT, "assets", "production")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("out_name")
    ap.add_argument("--maxw", type=int, default=1400)
    ap.add_argument("--q", type=int, default=80)
    ap.add_argument("--crop", type=float, nargs=4, metavar=("X0","Y0","X1","Y1"),
                    help="crop box in PERCENT: left top right bottom")
    a = ap.parse_args()

    src = a.source if os.path.isabs(a.source) else os.path.join(ROOT, a.source)
    im = Image.open(src).convert("RGB")
    if a.crop:
        w, h = im.size
        x0, y0, x1, y1 = a.crop
        im = im.crop((int(w*x0/100), int(h*y0/100), int(w*x1/100), int(h*y1/100)))
    if im.width > a.maxw:
        im = im.resize((a.maxw, round(im.height * a.maxw / im.width)), Image.LANCZOS)

    os.makedirs(PROD, exist_ok=True)
    out = os.path.join(PROD, a.out_name + ".webp")
    im.save(out, "WEBP", quality=a.q)
    print(f"wrote {os.path.relpath(out, ROOT)}  {im.size[0]}x{im.size[1]}  "
          f"{os.path.getsize(out)//1024} kB")

if __name__ == "__main__":
    main()
