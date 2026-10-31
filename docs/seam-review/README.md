# Bunker seams — v2.12.1

Baseline: main `46c39f9` (after #149 and #156). Review branch: `fix/bunker-seams`.

The former renderer layered coping, service bands, plinths and ribs on the same planes as GLB wall faces. Cross walls also stopped 1 cm short, corners overlapped, and `world.js` added overlapping floor slabs beneath the foundation.

The new wall and foundation meshes render only the exposed boundary of the union of their solids. Partial L/T junctions, unequal heights and exact duplicate boxes are clipped before triangulation. Shared faces are removed. Coping, plinth and service bands are material regions of that boundary, rather than coplanar decoration boxes. Walls use exact collision extents; the 1 cm shortening is removed. Floor GLBs still use the shared union grid. Source GLBs, collision, gameplay and the production camera are unchanged.

This visual pass replaces the busy striped joins with continuous matte teal concrete and violet coping. No new light/shadow passes or textures are added. Wall geometry is grouped by four material families; the foundation uses one material. No polygon offset is needed on structural faces; existing decal bias remains.

## Actual game captures

Same seed `seam-review`, 1280×720, High, hidden HUD, software renderer. These are gameplay-camera captures, not concept art. BIG MAP seed has seven rooms. The overview deliberately changes the review camera and disables fog to show the entire map; it is not the gameplay view. No physical-phone FPS claims are made.

| View | Before | After |
| --- | --- | --- |
| L1 | [Before](before-L1.png) | [After](after-L1.png) |
| L2 | [Before](before-L2.png) | [After](after-L2.png) |
| L3 | [Before](before-L3.png) | [After](after-L3.png) |
| BIG MAP | [Before](before-big.png) | [After](after-big.png) |

[Full BIG MAP overview](after-big-overview.png)

## Verification

- 650 raid tests pass, including the three new shell tests.
- 13 focused structure/environment/bunker tests pass on the final geometry.
- Geometry tests check exposed surface area, internal faces and coplanar overlaps, including L/T corners, unequal heights, duplicate boxes, separate elevations, and normal/BIG MAP L1–L3 across three seeds.
- Full base `npm test` passes. Low gameplay smoke passes for movement and firing on normal and seven-room BIG MAP, without JavaScript errors.
- Guardrails pass; the layout guardrail assertions are unchanged (cache-version imports only).
- All captured assets loaded without stand-ins; capture metadata records JavaScript errors.
- Full CI test/layout jobs must complete on the published head before merge.

