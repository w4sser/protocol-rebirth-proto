# Raid VFX notes

## Extraction beam + loot pickup burst (PRB-156)

Two pooled, quality-scaled 3D effects, both built to read correctly from the isometric camera (flat
quads/planes alone look 2D from that angle -- see `docs/design-decisions.md` 2026-11-15).

- `nodspel/vfx-extract-beam.js` (`createExtractBeam`): the extraction point. A volumetric beam
  (open-ended `CylinderGeometry` + a custom `ShaderMaterial` -- vertical alpha fade to 0 at the top,
  a fresnel term that brightens the rim over the center, additive blending, `depthWrite:false`, and
  an optional scrolling noise-band scroll at high quality), a ground decal (a radial-gradient glow
  pad, a dark contact ring just outside it for grounding, two expanding pulse rings, all with
  `polygonOffset` to avoid z-fighting with the floor), and size-attenuated `THREE.Points` spiraling
  up inside the beam. `update(time, open, progress)` drives visibility and a cosmetic "approach
  progress" (0..1, read from the player's distance to the exit while it's open) that brightens the
  beam and speeds the particles -- purely cosmetic; the real extract radius/logic stay in
  `round.js`/`levels.js`.
- `nodspel/vfx-loot-burst.js` (`createLootBurstPool`): the pickup burst. A fixed-capacity pool of
  sparkles (a single `THREE.InstancedMesh` of small octahedra, SoA typed arrays) that pop up with gravity, then home
  toward a target (the player's position) over ~0.5s, plus a small pooled ground flash ring.
  `spawn(x, y, z, color)` takes the caller's rarity colour (`rarity.js` already owns that lookup);
  `update(dt, targetX, targetY, targetZ)` advances every active sparkle in place.
- `nodspel/vfx-textures.js`: the one procedural "soft dot" texture both modules share, built as a
  `THREE.DataTexture` (not a canvas texture -- these modules build real THREE objects under plain
  `node --test`, which has no DOM/canvas).

Both factories accept `{quality:'low'|'high'}` and `setQuality(next)` changes quality immediately: low drops the beam's
shader noise bands and roughly halves the particle/sparkle counts. Both pools are allocation-free in
their `update()` (enforced by `scripts/hot-alloc-lint.mjs`'s `// @hot` headers, also guarding loot `spawn()` and world `updateVfx()`) -- a spawn only
overwrites the next slice of an already-allocated typed array, never grows one.

`nodspel/world.js` owns one extraction effect per exit and one loot pool per level. Big-map exits
follow their individual availability; the mobile loot pool stays outside room partitions. Extraction
uses 40 particles on low and 72 otherwise; Points sizes are in pixels under the existing orthographic
camera. Loot emits 12 or 22 world-sized instances per pickup; fixed buffers retain capacity for high
quality so a live switch never reallocates. Low disables shader noise immediately.

`animate(time, playerPos, round)` uses scalar arguments for allocation-free updates. The existing game
extracts immediately, so proximity controls cosmetic intensity without adding a countdown. The homing
target follows the player's chest; the flash ring stays on the floor. Transparent DoubleSide materials
explicitly use `forceSinglePass`. `disposeVfx()` runs at terminal raid end, detaches the owned effects,
and releases their geometries, materials and instance buffers once. Level teardown calls the same
idempotent cleanup before its generic traversal. The single shared procedural texture remains cached
for later raids.

See `nodspel/tests/vfx-extract-loot.test.mjs` for the behavioural tests and `docs/bug-lint.md`
("Extraction/loot VFX read flat...") for the regression guard.
