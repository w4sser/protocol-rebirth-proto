# Polyfork asset pilot - Protocol Rebirth

**Status:** isolated evaluation only; not gameplay integration. No asset files are redistributed in this branch.

## Review harness

Open `nodspel/polyfork-preview.html` on a local web server (the project uses ES modules; do not open with file://). Select a model and switch between Forest, Coast and Bunker. The viewer loads remote GLBs from `https://polyfork.dev/cdn/<asset-id>.glb` via the project-local Three.js GLTFLoader. It reports original bounds, triangle count, mesh/material counts and initial loading time. The grid is 1 m; rendered assets are normalized to 3 m **for comparison only** and should not be taken as approved gameplay scale.

The shared registry now contains **56 asset candidates** (24 Forest, 16 Coast, 16 Bunker). The table below is the original 20-model starting shortlist; the full live registry and viewer contain all 56. This is a catalogue selection, not a visual approval.

Original 20 selected assets:

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
- The model gallery is separate. The **in-raid Polyfork test** is opt-in with `?polyfork=1&area=archipelago`; without this parameter there are **no** Polyfork CDN requests and no additional mesh draw calls. The new test adds visual dressing to a real raid but never changes collision geometry.
- Candidate placement for a later raid branch: forest undergrowth and rocks outside critical combat space; sparse driftwood and shore stones; occasional industrial cabinet/crate in bunker set dressing.
- Validate asset orientation, unit size, pivots, texture/material appearance under game lighting, GPU memory, triangle counts and draw calls before integration.
- Preserve bridge funnel width, clear movement lanes and enemy navigation. Never add physical collision to decorative plants.
- Mobile acceptance: measure HIGH/LOW FPS (target LOW >40 FPS) and first-load hitch; thin or remove decorations on LOW.
- Avoid remote runtime dependency in production without confirming hosting, cache, availability, CORS and licensing.

## License checkpoint

The [Polyfork licensing page](https://polyfork.dev/licensing) (updated July 2026) explicitly allows using models in commercial games, including shipping models *inside a game*, with no attribution requirement. It forbids distributing the GLB files as standalone assets or asset packs. The upstream [catalog README](https://github.com/lucas-martinic/polyfork-catalog) also warns against re-uploading or independently redistributing the model files. This experiment links to the CDN only; before moving models into the public source repository or hosting model files directly as downloadable standalone GLBs, clarify the exact distribution scenario with Polyfork. CDN availability remains a separate production consideration.

## Evaluation criteria

Score each asset from 1-5 for (1) Protocol Rebirth art direction, (2) readability from the actual mobile raid camera, (3) fit with the existing saturated grass/granite palette and (4) estimated mobile cost. **No model is approved for production yet.** Validate in-game screenshots against baseline, retain only the highest-scoring assets and implement separately with a feature flag and fallback.

Upstream source kits: [Nature & Forest](https://github.com/lucas-martinic/polyfork-catalog/blob/main/kits/nature-forest-kit-f29d6a.md), [Coast & Boardwalk](https://github.com/lucas-martinic/polyfork-catalog/blob/main/kits/coast-and-boardwalk-d883fd.md), [Research Lab](https://github.com/lucas-martinic/polyfork-catalog/blob/main/kits/research-lab-9b9b5d.md), [Space Base](https://github.com/lucas-martinic/polyfork-catalog/blob/main/kits/space-base-kit-cf65de.md).


## Expanded playable experiment (draft PR #202)

**How to try the branch locally**
1. Checkout `feat/polyfork-asset-evaluation` from the repository and start a local HTTP server in the repository root, e.g. `python3 -m http.server 8000`.
2. Browse `http://localhost:8000/nodspel/polyfork-preview.html` for the full **56-model gallery**. Use **Auto-cycle** to review all models, noting triangle counts, materials and original dimensions.
3. Open the existing raid URL for this branch with `?area=archipelago&polyfork=1&q=high&seed=polyfork-qa`. Keep the rest of your normal raid launch parameters. **Compare the same seed with `polyfork=0`.** Use `q=low` as the mobile budget test.
4. Inspect `window.__polyforkPreview.stats` in developer tools after `ready` resolves. It reports planned/loaded instances, mesh and triangle counts, and failures. A failure is not hidden.
5. Run `node --test nodspel/tests/polyfork-dressing.test.mjs` and the existing `npm run verify` from a local checkout. Until CI or the browser confirms, these are verification instructions, not a claim tests passed.

**Runtime behavior:** 16 vegetative/shoreline model types are currently eligible for seeded placement; the remaining reviewed items are gallery-only. The broader set of 56 is deliberate: large buildings/industrial structures should not be sprinkled into navigable terrain. A later separately reviewed pass can hand-place them in bunker and town scenes.

Limits: max 125 decorative instances in HIGH and 40 in LOW per level, with geometry shared per GLB and one InstancedMesh per mesh part. All are visual-only. Placement uses `propReservations()` from the existing props system, extra clearance for big assets, and preserves the current coast, ground, bridges and pathfinding.

**Current limitations:** CDN reachability/CORS, actual appearance and mobile FPS have not yet been verified in a device browser. Source GLBs can be much heavier than their low-poly labels imply; measure GPU cost before any merge. Load failures are logged and do not block the raid. This is not a production asset-redistribution solution.
