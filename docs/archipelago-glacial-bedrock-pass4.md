# Archipelago – glacial headlands and embedded coastal bunker portals

**Owner visual lock, 8 November 2026:** The Swedish archipelago needs substantial, glacially smoothed granite walls, not just a scatter of small islands. No bunker's dark entrance should appear to open directly onto empty water. Its concrete frame should be cut into a visible large rock mass, partly reclaimed by moss, with a recessed sealed door. Existing Bungenäs/Swedish coastal-defence mood remains. Viggen aircraft hangar stays in the Bunker interior scope, not here.

## Test observation -> underlying issue
In the iPhone screenshot during PR #212 testing, the visible bunker door stands as a boxy freestanding seaward fixture, behind which the game shows uninterrupted water; bright moss/roof slabs also flicker due to nearly coplanar/overlapping geometry. The bridge navigation itself was reported good. Fixing only the concrete door's material or its placement point would not create the missing landscape silhouette.

## New standalone original GLB assets
Four locally authored models under `nodspel/assets/env/glacial/` (separate solid headland and inset-portal variants, each HIGH and LOW). Every asset is a single opaque smooth-shaded low-poly mesh with vertex-color glacier-polished gray-violet granite, subtle lichen and a bedrock base down to Y=-1.22m. No remote assets, albedo maps, transparencies, flags or alpha planes. Long rock face is 12.8m and extends 8.4m seaward, reaching roughly 5m high. HIGH 900 tris, LOW 282 tris; model loaded once per kind/quality and instances batched.

## Placement contract
- **Portal requires cliff**: place a sealed door only when its larger 12.8 × 8.4m glacier-polished headland footprint is collision-safe. Embed concrete door 1.05m into a ~2.6m-wide natural central rockcut niche. Other sites may remain low pillboxes or ruins; never a freestanding door.
- **Larger land masses**: allow 1 extra headland on normal multi-island maps and up to 2 extra on Big Map, in addition to a rock-backed portal if one fits. Vary scale subtly by seed and retain sparse original forest/lichen dressing.
- **No fake playable cliff**: all GLBs occupy non-navigable seaward space and are visually continuous with their source island. Test bounding rectangles against every authored floor and expanded bridge clearance. No new collision bodies, blocked bridge entry, A* changes, loot/extraction obstruction, actor sight blockers or terrain physics. The bases sink into the water instead of hovering in it.
- **Roof/moss**: the top lintel, top cap and moss plane now have positive separation (at least 1–2cm; the cap covers the lintel in silhouette but not in depth). The prior pillbox cap/dome overlap is also removed.
- **Cameras/performance**: only one instanced GLB draw call per kind; no independent dynamic lighting; HIGH and LOW use distinct local triangle LOD files with matching placement. Existing coast/ground shaders and Coastal Life remain as before.

## Verification
- [ ] Binary glTF headers/positions/normals/vertex colors and actual `GLTFLoader.parseAsync` work in Node for all four models.
- [ ] All portal placements have matching visual cliff backing; no cliff footprint overlaps floor or bridge clearance across 32 seeded raids. No actor/bot/wall/layout mutation.
- [ ] Existing Military Remnants tests and all CI workflows pass.
- [ ] Real iPhone viewport captures on High and Low show **rock behind the dark door** from an ordinary approach; the door is not a shack by water.
- [ ] No roof/facade shimmering, no visible floating rock foot, repetitive patterns, flat slab silhouettes or moiré from moss patches.
- [ ] Manual iPhone gameplay: bridge entry, collision rocks, incoming artillery and performance remain acceptable, in both directions.
- [ ] User approves the visual result before merging.

## Boundaries
Do not reopen PR #212 navigation changes, change the player camera or UX, add climbable mountains or the Viggen hangar. Large playable cliffs, caves and interior traversal require a separate authored topography/collision/AI design pass.
