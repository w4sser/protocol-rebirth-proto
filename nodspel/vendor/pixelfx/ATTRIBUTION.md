# PixelFX

Source: https://github.com/patch-gg/pixelfx
Revision: a84159688af3ca37a4be05a0d422b94451b2e24e
License: MIT (see LICENSE), copyright 2026 Patch and Hugo Duprez.

Vendored src/core and eight effects with their category helpers: respawn-beam,
bullet-impact, hit-flash, barrel-explosion, emp-blast, force-field, chest-open,
collect-burst. Several effects derive from Hugo Duprez's MIT Sprite Fusion
effects; the original attribution comments are preserved in each source file.

Local modification: core/font.js, the font export, and Painter text/measure
methods are omitted. No Patch Pixel font, embedded glyph tables, or font files
are included. The game uses the raster drawing API only. PixelFX Lights are
software pixels in the texture; the adapter creates no Three.js lights.
