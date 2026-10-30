# Separate bunker assembly review

Stacked on #149, this draft isolates `fitStructure`, floor union/grid, floor rotation/height changes, wall-height scaling, foundation/coping/service bands and ribs. This is a runtime module-fitting change and requires separate owner review; it is deliberately absent from the materials/lighting PR.

Source GLBs, manifest dimensions, collision and level generation data are unchanged. Floors are partitioned by explicit `floor.y` before union tiling; floor instances and wall transforms retain their supplied vertical origins.

Tests cover exact structural bounds, floor union without overlap/gaps, seeded L1/L2/L3 maps and a synthetic two-storey render assembly. The existing gameplay/actor/collision system is planar; this verifies assembly at separate heights and does not claim a fully playable vertical-floor system.

No merge or deployment is authorized. Review this diff against the #149 branch, independently of its material and lighting changes.

## Rendered review captures

- [L1](bunker-assembly-L1.png)
- [L2](bunker-assembly-L2.png)
- [L3](bunker-assembly-L3.png)

Fresh captures use seed `post151-review`, after rebasing #149 onto main `3124ce1` (#151 and #154; #152 closed without merge). The game camera and viewport match the new #149 L1–L3 images. These replace the previous review images. No HUD redesign is included. The full raid suite passes 646/646 tests. All 21 focused assembly, bunker and larger-level tests pass, including the L1–L3 coverage and two-elevation instance test. Earlier CI results are historical, not evidence for the rebased head. Layout-check is rerun after this rebase; its result is reported separately.

An additional [11-room overview](bunker-big-overview.png) renders the actual larger-map geometry with an overview camera and all rooms visible. This is a review view, not a production camera or culling change. Cache/version 2.11.3; runtime fitting remains isolated from #149.
