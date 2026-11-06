# Polyfork asset pilot - Protocol Rebirth

**Status:** isolated evaluation only; not gameplay integration. No asset files are redistributed in this branch.

## Review harness

Open `nodspel/polyfork-preview.html` on a local web server (the project uses ES modules; do not open with file://). Select a model and switch between Forest, Coast and Bunker. The viewer loads remote GLBs from `https://polyfork.dev/cdn/<asset-id>.glb` via the project-local Three.js GLTFLoader. It reports original bounds, triangle count, mesh/material counts and initial loading time. The grid is 1 m; rendered assets are normalized to 3 m **for comparison only** and should not be taken as approved gameplay scale.

Selected 20 assets:

| Category | Asset | Polyfork ID | Recommendation |
|---|---|---|---|
| Forest | Birch Tree | [birch-tree-181b33](https://polyfork.dev/asset/birch-tree-181b33) | Assess color and silhouette against summer-night forest |
| Forest | Tall Pine | [tall-pine-tree-ab4108](https://polyfork.dev/asset/tall-pine-tree-ab4108) | Assess color and silhouette against summer-night forest |
| Forest | Young Pine | [young-pine-0d7695](https://polyfork.dev/asset/young-pine-0d7695) | Assess color and silhouette against summer-night forest |
| Forest | Fern | [fern-plant-1559b8](https://polyfork.dev/asset/fern-plant-1559b8) | Assess color and silhouette against summer-night forest |
| Forest | Grass Tuft | [grass-tuft-a40a08](https://polyfork.dev/asset/grass-tuft-a40a08) | Assess color and silhouette against summer-night forest |
| Forest | Fallen Log | [fallen-log-1685fb](https://polyfork.dev/asset/fallen-log-1685fb) | Assess color and silhouette against summer-night forest |
| Forest | Large Boulder | [large-boulder-a29b99](https://polyfork.dev/asset/large-boulder-a29b99) | Assess color and silhouette against summer-night forest |
| Forest | Medium Rock | [medium-rock-e08405](https://polyfork.dev/asset/medium-rock-e08405) | Assess color and silhouette against summer-night forest |
| Forest | Round Bush | [round-bush-cd2ac0](https://polyfork.dev/asset/round-bush-cd2ac0) | Assess color and silhouette against summer-night forest |
| Forest | Tree Stump | [tree-stump-ec3f48](https://polyfork.dev/asset/tree-stump-ec3f48) | Assess color and silhouette against summer-night forest |
| Coast | Driftwood Log | [driftwood-log-89a68f](https://polyfork.dev/asset/driftwood-log-89a68f) | Assess rocky coastline/abandoned archipelago fit |
| Coast | Rock Armour | [rock-armour-revetment-aea1ca](https://polyfork.dev/asset/rock-armour-revetment-aea1ca) | Assess rocky coastline/abandoned archipelago fit |
| Coast | Marram Grass | [marram-grass-tuft-8c7a99](https://polyfork.dev/asset/marram-grass-tuft-8c7a99) | Assess rocky coastline/abandoned archipelago fit |
| Coast | Seaweed Drift | [seaweed-drift-line-6566c3](https://polyfork.dev/asset/seaweed-drift-line-6566c3) | Assess rocky coastline/abandoned archipelago fit |
| Coast | Boat Shed | [boat-shed-74c94f](https://polyfork.dev/asset/boat-shed-74c94f) | Assess rocky coastline/abandoned archipelago fit |
| Coast | Mooring Bollard | [mooring-bollard-2d4bc9](https://polyfork.dev/asset/mooring-bollard-2d4bc9) | Assess rocky coastline/abandoned archipelago fit |
| Bunker | Hazard Sign | [hazard-sign-plate-d54657](https://polyfork.dev/asset/hazard-sign-plate-d54657) | Assess bunker dressing and technological mood |
| Bunker | Gas Cylinder Cabinet | [gas-cylinder-cabinet-cea23b](https://polyfork.dev/asset/gas-cylinder-cabinet-cea23b) | Assess bunker dressing and technological mood |
| Bunker | Cargo Crate | [cargo-crate-696892](https://polyfork.dev/asset/cargo-crate-696892) | Assess bunker dressing and technological mood |
| Bunker | Battery Bank | [battery-bank-b4d362](https://polyfork.dev/asset/battery-bank-b4d362) | Assess bunker dressing and technological mood |

## Integration decision and safeguards

- **Keep existing terrain/coast blending, bridges, existing collision, navigation and playable boundaries.** Do not replace the ground shader or coastal mesh.
- This pilot is opt-in and does **not** add loading requests or draw calls to real raids.
- Candidate placement for a later raid branch: forest undergrowth and rocks outside critical combat space; sparse driftwood and shore stones; occasional industrial cabinet/crate in bunker set dressing.
- Validate asset orientation, unit size, pivots, texture/material appearance under game lighting, GPU memory, triangle counts and draw calls before integration.
- Preserve bridge funnel width, clear movement lanes and enemy navigation. Never add physical collision to decorative plants.
- Mobile acceptance: measure HIGH/LOW FPS (target LOW >40 FPS) and first-load hitch; thin or remove decorations on LOW.
- Avoid remote runtime dependency in production without confirming hosting, cache, availability, CORS and licensing.

## License checkpoint

The upstream [README](https://github.com/lucas-martinic/polyfork-catalog) says commercial usage is allowed, but says **not to re-upload or redistribute GLB files**; keeping local copies may require their [platform license](https://polyfork.dev/platform). The viewer links to the CDN only. Before shipping a commercial mobile game, have the current [license terms](https://polyfork.dev/licensing) reviewed, especially if assets are bundled with a game or mirrored into the game repository. A URL-only preview is not evidence of production distribution rights.

## Evaluation criteria

Score each asset from 1-5 for (1) Protocol Rebirth art direction, (2) readability from the actual mobile raid camera, (3) fit with the existing saturated grass/granite palette and (4) estimated mobile cost. **No model is approved for production yet.** Validate in-game screenshots against baseline, retain only the highest-scoring assets and implement separately with a feature flag and fallback.

Upstream source kits: [Nature & Forest](https://github.com/lucas-martinic/polyfork-catalog/blob/main/kits/nature-forest-kit-f29d6a.md), [Coast & Boardwalk](https://github.com/lucas-martinic/polyfork-catalog/blob/main/kits/coast-and-boardwalk-d883fd.md), [Research Lab](https://github.com/lucas-martinic/polyfork-catalog/blob/main/kits/research-lab-9b9b5d.md), [Space Base](https://github.com/lucas-martinic/polyfork-catalog/blob/main/kits/space-base-kit-cf65de.md).
