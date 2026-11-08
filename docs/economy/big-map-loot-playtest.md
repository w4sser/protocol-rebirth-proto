# Bunker Big Map: spatial loot trial

Status: isolated implementation trial, 7 November 2026. PR #206, based on main `88a9ac6364d0dcf5463c2a5f700f4817960ecaca`. Related analysis: design PR #201, `docs/economy/first-ten-calibration.md` (M19D), simulation PR #204.

## Implementation contract

Only ordinary **Bunker Big Map** material opportunities are re-rolled. Rooms with eligible loot are sorted by graph distance from spawn, then stable room ID. Up to three near rooms use the current depth-1 pool; the next two use depth-2, including Power Cell; remaining ordinary rooms use depth-3. Very short eligible-room lists reserve a middle source. Each container has an independent seeded roll.

Existing keys, scouting/story items, node-gated vault contents, marked/authored rewards, gear already generated, medkits and ammo are preserved exactly. No crates are added and their positions do not move. Areas other than Bunker and all small-level generation are unchanged. Prices, module costs, starting inventory, item quantities, extraction, enemy behavior, geometry and saves are unchanged.

The first code trial is intentionally **narrower than simulation Test C**: no save-dependent four-room introductory bias, no automated bag replacement, no cosmetic-repair charges, no automatic achievement grant. Player-controlled swapping and the existing earned-Scrap trader remain unchanged. The prior 96% Fabricator result must NOT be advertised as this implementation's measured completion rate.

## Automated checks

```sh
node --test nodspel/tests/big-loot.test.mjs
node scripts/big-loot-access-check.mjs 1000
npm --prefix nodspel test
```

The focused workflow publishes `report.json` and a source-only snapshot. Coverage means generated item presence, not a promise a human finds or extracts it. It compares geometry and protected pickups with the pinned baseline. Static access samples use the real movement function and pickup radius on pre-render collision rectangles. They do not reproduce rendered prop colliders, enemy pursuit, mobile touch behavior, combat survival or FPS. Any blocked loot/exit in that audit must be recorded, not called fixed by a loot-table change.

## Phone playtest

Use an isolated test profile/origin and this branch build, NOT the unchanged production Pages build. Record build SHA, mode, seed, device and quality. Do not overwrite a valued save. Start with Big Map Bunker on Low; repeat a smaller selection on High. Preserve the existing camera and controls.

1. **Find useful materials:** play three fresh seeded runs. Note time to first useful component, useful materials seen, collected and successfully banked. A missing requested item is a valid random outcome, not automatically a defect.
2. **Power Cell source:** deliberately investigate middle-distance opportunities. Record availability over multiple seeds, whether the container is actually reachable and whether the component survives successful extraction.
3. **Load and choice:** test near-full bag; voluntarily replace an unneeded material or leave it. Ensure no automatic replacement or free material grant occurs.
4. **Access:** walk around each relevant container, doorway, bridge and cover edge. Aim/fire across apparently clear space and let enemies pursue through it. Record exact points where movement/projectiles/AI disagree with visible geometry.
5. **Specials and loss:** confirm chart/key/vault gates remain as before; on death ordinary exposed loot is lost, and a successful return banks only the actual haul.
6. **Regression areas:** sample existing small Bunker, Archipelago and Town. This PR should not change their layouts, item rolls or controls.

Capture **attempts and successes separately**. Use actual home resources and current build costs; do not give testers missing materials to hit a scripted third-raid milestone.

## Acceptance before merge

- Focused tests, baseline equality and existing tests pass.
- Seeded candidate has early basic material coverage and a nonzero middle Power Cell source; no per-run guarantee is introduced.
- Phone testers can discover and physically collect useful loot without repeated invisible collisions.
- No loss of authored chart/key/vault items, no altered costs/paid products, no new menu burden.
- Physical phone FPS and real collision behavior are checked separately. Browser emulation alone is insufficient.

Leave this PR draft until results and device observations have been reviewed. No automatic merge or production deployment.
