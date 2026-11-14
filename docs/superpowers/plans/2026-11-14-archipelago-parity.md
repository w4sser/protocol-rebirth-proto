# Archipelago visual parity implementation plan

Goal: bring opt-in v2 closer to the approved visual target in real gameplay.
Architecture: retain the existing world and coast registry; share deterministic sculpted bedrock and a calm vertex-colored ground, then thin cosmetic layers and soften the v2 light rig.
Tech stack: existing Three.js, node:test, Puppeteer.
Spec: ../specs/2026-11-14-archipelago-parity-design.md

Constraints: no merge, no default enablement, no gameplay/camera/economy changes, no new dependencies, no reference edits. Use current PR #247 and preserve coherent version tags/cache suffixes.

Review focus: neighboring islands must retain water gaps; every bridge and landing must remain visually and physically clear; visual rocks must not become false traversable cover; HIGH/LOW main masses must agree; shared geometry/materials must survive world disposal/rebuild.

## 1. Bedrock and ground
- [x] Add failing deterministic mass, real mesh and clearance tests in nodspel/tests/archipelago-bedrock-v2.test.mjs; run RED.
- [x] Implement planArchipelagoBedrock(profile,{reservations,neighbors}), shared sculpted geometry, primary outcrops, ground and integrated portal in nodspel/archipelago-visual-v2.mjs. Integrate in archipelago.js with v2 coast profiles at a fixed sample count.
- [x] Run new tests and existing v2, coast, bridge and reachability tests GREEN.

## 2. Composition and light
- [x] Add failing v2-only dressing policy test; implement quiet native v2 composition in world.js and archipelago-dressing-policy.mjs. Preserve defaults.
- [x] Integrate native v2 ground instead of overlapping legacy texture decoration; soften only the v2 light rig in game.mjs. Refresh changed runtime import suffixes.
- [ ] Run base and raid test suites. Capture HIGH/LOW actual gameplay, coast and bridge with existing debug hooks; inspect and iterate.

## 3. Review and preview
- [x] Independent read-only review against spec, clearance and lifecycle requirements; fix significant findings.
- [ ] Re-run affected checks; preserve before/after screenshots as outputs. Push only after local visual/check evidence; publish existing isolated preview workflow if branch is pushed.
- [ ] Verify exact public SHA and boot HIGH/LOW. Show real gameplay screenshots. Leave draft PR #247 unmerged.

## Verification ledger
Initial geometry/policy tests: 5 RED, then GREEN. Ground normal-direction assertion reproduced invisible top surface, corrected winding. Full raised-vertex test reproduced own-coast overlap, corrected complete footprint checks.

Independent review found two Important issues: authored neighbor rectangles did not represent organic coasts, and the portal frame extended beyond the validated rock ellipse. Added generated-level real rendered-vertex regression (review-1, review-21 and target seed, levels 1–3), observed RED, passed full neighbor coast profiles and included the concrete portal envelope, then GREEN. Shared resources/lifecycle and import cache chain reviewed without significant findings.

Local Windows limits: baseline guardrail and audio license test require LF; local checkout normalized for testing only. Unchanged polyfork-vendored-assets test assumes POSIX separators, and unchanged base loot-sources test imports a Windows absolute path as an ESM URL. Canonical Linux CI remains required. Desktop Chromium screenshots are not physical Safari/performance measurements.

## Owner follow-up: parity to the original visual target (14 Nov, 17:22 CET)

### Decision and review hypothesis
The playable island still does not evoke the standalone Three.js target. Treat that as a **presentation/landform** gap, not an invitation to redesign combat, traversal rules or the camera. The standalone target's orbit view exaggerates scale and sculpted height; only equal-size screenshots from the **actual 844x390 raid camera** are valid parity evidence. Preserve the reference HTML itself.

### Prioritized execution (work on this PR; never merge without owner approval)

**P0 — Establish evidence before another art pass.**
- [ ] Add a PR-scoped Actions capture job with full history (git-show baseline required) that runs v2 geometry tests and scripts/shot-archipelago-v2.mjs.
- [ ] Save BEFORE/AFTER screenshots for HIGH/LOW at spawn, coast/portal and bridge, plus capture JSON. Publish as Actions artifact even on failure.
- [ ] Confirm exact PR head SHA in public isolated preview; separate browser boot success from full-raid and physical-Safari verification.
- [ ] Inspect paired screenshots for the three largest discrepancies: island-as-rock silhouette, quiet/sparse composition, Nordic summer-night light. Annotate failures before modifying geometry.

**P1 — One hero island; make the target seed feel like the reference.**
- [ ] Improve only the archipelago-v2-target island before generalising. Geometry should read as connected glacial bedrock, 1–3 dominant masses, headlands, scooped cove, soft shelf-to-waterline transition, and portal embedded in rock.
- [ ] Same coast profile must drive walkable outline, shell and water shore-map; leave objective positions and collisions unchanged. Raised scenery MUST stay outside the actual actor boundary, bridge reservations and neighbouring organic coastlines.
- [ ] Reject evenly spaced boulders, cliffs shaped like discs, artificial coast rings, decorative false cover and rocks obscuring enemy/bridge visibility.
- [ ] Match subdued granite, olive/moss interiors, warm side light/cool fill and pale lavender/coral summer-night reflection; **do not** tint the entire level purple.
- [ ] Reduce scatter. Place wind-shaped pines in clusters with open combat sight lines. Keep distant islets varied and sparse to imply open water.

**P2 — Prove gameplay, mobile parity and production safety.**
- [ ] Repeat same-seed HIGH/LOW screenshots at normal camera scale. Primary silhouette and portal must remain identifiable in LOW.
- [ ] Regression-test bridges, island/water gap, coastline traversal, all objectives, z-fighting, no false cover or JavaScript asset failures; run complete base and raid suites in Linux CI.
- [ ] Owner reviews paired phone screenshots and complete real-device raid before approval. Measure LOW sustained >40 FPS and worst-frame pacing on a physical iPhone; desktop emulation is **not** proof.

### Non-goals and safety
Do not edit the reference, camera, player hitboxes, AI, raid timer, weapons, economy, progression, Bunker/Town, production default or main. Keep archVisual=v2 opt-in. No broad open-world rewrite disguised as a visual change.

### Current evidence and blockers
Commit 647b84c already includes seeded bedrock, shared geometry, calm ground, v2 lighting, native pine composition and bridge/neighbor clearance tests. Public GitHub Pages smoke of that commit succeeded at desktop Chromium iPhone-size viewport on 14 November at 16:31Z. **There is no PR CI run on this commit, no inspected paired screenshots in the PR, and no physical Safari/FPS proof.** These remain explicit gates.
