# Original glacially rounded Swedish granite cliffs

Reusable **original** (not stock/Polyfork) glTF 2.0 GLB assets for the Scandinavian Archipelago. Silhouette target: wide rounded, ice-polished `rundhäll` / roche moutonnée, asymmetric convex crest, broad exposed pale gray-violet granite, restrained lichen/oxidation and a wet submerged foot.

| File | Triangles | Size | Intended use |
| --- | ---: | ---: | --- |
| `glacial_headland_high.glb` | 900 | 23.2 KB | Smooth 12.8m-wide waterfront granite ridge |
| `glacial_headland_low.glb` | 282 | 8.4 KB | Same profile with mobile LOW detail |
| `glacial_portal_high.glb` | 900 | 23.2 KB | Cliff with a deliberately recessed bunker doorway niche |
| `glacial_portal_low.glb` | 282 | 8.4 KB | Low-end visual model of the same rock-cut bunker cliff |

Geometry uses Y up, local -Z facing the island and positive Z extending away from playable land. Pivot at the landward middle edge. **Nominal footprint:** width 12.8m and outwards depth 8.4m. The mesh begins at Y=-1.22m (below sea level) and rises above +5m. It has indexed triangles, baked smooth normals, vertex color, a single opaque untextured PBR material, no external asset or atlas dependency, no animation, 16-bit indices, no flags.

The portal mesh has a **2.6m central inset** in the rock, designed to envelop the existing sealed Bungenäs-style concrete doorway. Without this cliff mesh, the portal should not be placed. A stand-alone headland without any building is a separate reusable landform.

**Gameplay:** Visual-only outside all navigable floors and protected bridge mouth clearances; does not create invisible gameplay blockers or alter raid terrain/collision. No fake cover placed on playable ground. Do not use this as climbable land without creating real floor geometry, player collision and bot navigation in a separate pass.

**Performance:** Instanced at one draw call per kind for each quality level; HIGH and LOW share the same authored silhouettes, with 900 vs 282 triangles. Ready state must include successful local GLB load; asset errors fail mobile CI rather than leaving a freestanding bunker door.

**QA:** `node --test nodspel/tests/glacial-bedrock.test.mjs` parses all four binary GLBs with the real Three.js glTF loader, checks triangle budgets and geometry; separate GitHub workflow renders a seeded level 3 on a phone-sized viewport in HIGH/LOW.
