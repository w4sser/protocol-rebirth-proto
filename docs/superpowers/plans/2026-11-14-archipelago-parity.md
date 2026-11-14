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
