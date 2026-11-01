# Corridor corner gaps — diagnosis (v2.21.1 feedback item 7)

## Verdict: assembly bug, not an asset problem

The bunker renderer (`nodspel/bunker.js`) never loads wall/corner `.glb` pieces for the raid
geometry — it builds the level purely from boxes: `shellMesh(wallSolids(level.walls))`
(`nodspel/bunker.js:206`), where `level.walls` is a flat array of axis-aligned wall boxes produced
by `generateLevel()` in `nodspel/levels.js`. `structure-shell.js` (`shellFaces`/`wallSolids`) then
unions those boxes and extracts only the exposed boundary faces — it is exact CSG-style geometry,
not an asset kit, so there is no "missing corner piece" to source. The gap in
`/tmp/fb-corridor.png` is the wall-box *list* failing to cover a strip of floor, not a rendering or
asset defect.

## Root cause

`generateLevel()` builds two independent wall systems that are each correct in isolation but don't
overlap where they meet:

- **Room doorway walls** (`nodspel/levels.js:271-277`): for a room with a door facing `dir`, the two
  flanking wall segments run from the door's edge *all the way to the room's own corner*
  (`z ∈ [door/2, room.d/2]` relative to the room center, verified symbolically). These reach the
  nominal room boundary exactly.
- **Corridor side walls** (`nodspel/levels.js:263-268`, pre-fix): for each corridor/dead-end/closet,
  the two side walls span exactly `corridor.w` — the raw gap between the two room edges
  (`a.x` to `b.x`, computed from the room footprints with zero overlap into either room). The floor
  for the same corridor already gets a deliberate `+0.08` overlap pad "to avoid a floating-point
  crack" (see the comment directly above) — **the walls never got the equivalent treatment.**

At each room↔corridor junction the two wall systems are perpendicular boxes that only touch at a
single edge point in both axes simultaneously (corner-to-corner, not face-to-face), which leaves an
uncovered `wallThickness × wallThickness` square (0.4 × 0.4 world units) exactly at the join. That
square is what reads as a gap/notch in the screenshot — not a full missing wall, which is why it
looks like "wrong ends" rather than an absent wall entirely.

### Empirical proof (before fix)

```
$ node -e "
import('./nodspel/levels.js').then(({generateLevel,RULES})=>{
  const level = generateLevel(2,'corner-evidence','bunker',false,false);
  const t = RULES.wallThickness;
  const c = level.corridors[0];
  const minX = c.x - c.w/2, maxX = c.x + c.w/2;
  const probeNear = {x:minX - t/2, z:c.z + (c.width/2 - t/2)};
  const probeFar  = {x:maxX + t/2, z:c.z + (c.width/2 - t/2)};
  const covers = p => level.walls.some(w => Math.abs(p.x-w.x) < w.w/2 && Math.abs(p.z-w.z) < w.d/2);
  console.log('near-end corner covered?', covers(probeNear));
  console.log('far-end corner covered?', covers(probeFar));
});
"
near-end corner covered? false
far-end corner covered? false
```

Both corners of the first corridor in a seeded level are provably uncovered by any wall box.

## Fix

`nodspel/levels.js` (allowed file; `bunker.js`/`structure-shell.js` untouched, both are in the
protected list and weren't the cause): the corridor/dead-end/closet side-wall loop now pads the
room-facing end(s) by the wall thickness `t` so the wall reaches past the corridor's own footprint
into the room's doorway wall:

- A plain corridor (`corridors`) joins a room at **both** ends → both ends padded by `t`
  (`w/d += 2*t`, center unchanged).
- A branch (`deadEnds`/`closets`, built by `addBranch`) joins a room only at its **near** end — the
  far end is a dead end already sealed by its own cap wall (`addBranch` already builds that cap to
  fully overlap the side walls, confirmed separately below) → only the near end is padded
  (`w/d += t`, center shifted by `t/2` toward the room so only that end moves).

Re-running the same probe after the fix: both corners return `true` (covered). A broader sweep (5
seeds × 3 levels, every corridor/dead-end/closet end, 90 probe points total) found 0 uncovered
corners after the fix, versus the originally-reported gaps before it.

### `nodspel/big-level.js` — inspected, not changed

`generateBigLevel()` has its own, structurally different corridor-wall formula
(`sign*(width/2+t/2)` vs. `levels.js`'s `sign*(door/2-t/2)`). Because of that sign difference, the
big-level corridor wall's cross-axis span (`[width/2, width/2+t]`) is already a *subset* of the
room's own flanking wall span (`[width/2, length/2]`) at the shared boundary plane — the two boxes
share a full edge segment there, not just a corner point, which `structure-shell.js`'s
`shellFaces` already resolves correctly (the existing `'L/T corners... keep their exact
boundaries'` test in `structure-shell.test.mjs` covers exactly this shape). Grid-sampling around
several big-level junctions found no uncovered corner square. `setLevelMode('big')` is also never
called anywhere in the app (`grep -rn "setLevelMode" nodspel/` only shows the definition), so this
path doesn't run in the shipped game; it's not touched by this fix since there's no evidence it's
broken.

## Test added

`nodspel/tests/corner-join.test.mjs` — generates levels across 5 seeds × 3 level numbers × 3 areas
(bunker/archipelago/town), and for every corridor/dead-end/closet, probes the exact corner square
that this bug leaves uncovered, asserting some wall box covers it. Verified to fail on the
pre-fix code (reproduces the reported gap) and pass after the fix.

## Files changed

- `nodspel/levels.js` — padded corridor/branch side-wall length at room-facing end(s).
- `nodspel/tests/corner-join.test.mjs` — new regression test.
- `docs/corner-diagnosis.md` — this document.
