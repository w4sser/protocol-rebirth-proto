#!/usr/bin/env python3
"""Regenerate the app icon set from assets/reference/app-icon-source.png.
Usage: python3 tools/make-app-icons.py
"""
import os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/reference/app-icon-source.png")
OUT = os.path.join(ROOT, "assets/icons/app")
BG = (7, 21, 28)  # #07151C, matches manifest background_color/theme_color

PNG_SIZES = [512, 192, 180, 167, 152, 120, 96, 48, 32, 16]
WEBP_SIZE = 1024  # PNG at this size runs >1MB; WEBP q92 keeps it under ~200KB at equal quality
SHARPEN_MAX = 128  # unsharp small renders where downscaling softens detail too much


def load_source():
    im = Image.open(SRC).convert("RGB")
    assert im.width == im.height, "source must be square"
    return im


def resize(im, size):
    out = im.resize((size, size), Image.LANCZOS)
    if size <= SHARPEN_MAX:
        out = out.filter(ImageFilter.UnsharpMask(radius=1.1, percent=60, threshold=2))
    return out


def save_png(im, path):
    im.convert("RGB").save(path, format="PNG", optimize=True, compress_level=9)


def make_maskable(im, size=512):
    # Safe-zone per the maskable-icon spec: keep art inside the centered ~72% circle.
    canvas = Image.new("RGB", (size, size), BG)
    art_size = round(size * 0.72)
    art = im.resize((art_size, art_size), Image.LANCZOS)
    art = art.filter(ImageFilter.UnsharpMask(radius=1.1, percent=40, threshold=2))
    offset = (size - art_size) // 2
    canvas.paste(art, (offset, offset))
    return canvas


def make_favicon_ico(im):
    sizes = [16, 32, 48]
    imgs = [resize(im, s) for s in sizes]
    path = os.path.join(OUT, "favicon.ico")
    imgs[0].save(path, format="ICO", sizes=[(s, s) for s in sizes], append_images=imgs[1:])
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    im = load_source()

    webp = resize(im, WEBP_SIZE)
    webp_path = os.path.join(OUT, f"icon-{WEBP_SIZE}.webp")
    webp.save(webp_path, format="WEBP", quality=92, method=6)
    print(webp_path, os.path.getsize(webp_path), "bytes")

    for size in PNG_SIZES:
        out = resize(im, size)
        path = os.path.join(OUT, f"icon-{size}.png")
        save_png(out, path)
        print(path, os.path.getsize(path), "bytes")

    maskable = make_maskable(im, 512)
    path = os.path.join(OUT, "icon-512-maskable.png")
    save_png(maskable, path)
    print(path, os.path.getsize(path), "bytes")

    ico_path = make_favicon_ico(im)
    print(ico_path, os.path.getsize(ico_path), "bytes")


if __name__ == "__main__":
    main()
