# Environment dressing on main 3124ce1

#149 is rebased onto `3124ce16fb9685ed012cf8296a0f762c8fdb8f17`, after #151 and #154. #152 is superseded and closed without merge. The #154 RUSHER caption/bar obstacle fix, deliberate bar-on-bar overlap rule, character registry and raised player health/shield anchors are preserved. After query-version normalization, character, level, operator and layout-check code match main.

This PR contains environment materials/foliage, bunker lighting and a debug performance profiler. Source asset dimensions and the production camera remain unchanged. Structural runtime fitting, floor union/rotation/elevation, wall scaling and foundation/band geometry remain isolated in #153.

Outdoor sky/hemi/fog/exposure follow v2.10.0. Town ground lift is ×1.45 and window glow 2.6: yellow-green grass, warm windows, red/ochre houses, lavender granite and plaza planks/grooves. Town bushes/hedges retain their original angular geometry, recolored without scaling; the generation script preserves it.

Bunker point lights, lamp emissive strength and light-pool opacity are halved from the first review. Wall lamps require walls at least 1.5 m high. Barrels retain cylindrical native geometry and are excluded from rectangular cover fitting. Missing-barrel fallback is cylindrical.

## Post-rebase validation

- Full raid suite: 642/642 pass on this rebased code. Guardrails and syntax checks pass.
- L1–L3 generation and environment regressions are included. #153 separately exercises floor union and two supplied floor elevations.
- New renderer captures use seed `post151-review`, the current main operator and the same game camera/1688×780 viewport on each side. HUD is hidden only for screenshots. The capture metadata is in `visual-dressing/integration-captures.json`.
- An 11-room overview renders actual larger-map geometry with all rooms visible and an overview camera. Production camera and culling are unchanged; larger maps require `?levels=big`.
- Sequential full layout-check: current main first, then #149. Both use the same resize-settlement fixture and browser. Current status/results are in `layout-review-comparison.json`; the pre-3124 comparison is explicitly historical in `layout-review-comparison-pre3124.json`. This is not a claim of a green standalone layout job while the new run is pending.

## Physical-phone measurement

Open `tools/raid-performance.html` on the review build, enter the exact phone model, confirm physical hardware, and capture one High and one Low raid while moving/fighting. The raid expands to the full viewport and waits for resize before recording metadata, with a 2-second warm-up and 15-second capture. Download JSON for FPS, frame-time percentiles and whole-frame draw calls including postprocessing. Full-viewport operation has been smoke-tested at 844×390 with `physicalPhoneVerified: false`.

Physical-phone High/Low results remain pending. Owner target: Low stays above 40 FPS; median FPS alone does not establish stability. Software-renderer results are not phone performance. Medium is a separate start-screen water setting, not a raid profile.

Cache/version 2.11.2. Start-screen water and lighting are untouched. This PR remains draft; no merge is included.
