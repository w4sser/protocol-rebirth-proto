# M19E - Bunker Big Map loot distribution implementation trial

**7 November 2026. Owner authorized the bounded loot adjustment and accessibility test recommended in M19D.** This is authorization for an isolated implementation/playtest, not automatic merge, production deployment or final economy targets.

Implementation: [draft PR #206](https://github.com/w4sser/protocol-rebirth-proto/pull/206), branch `fix/big-map-loot-bands`, based on main `88a9ac6364d0dcf5463c2a5f700f4817960ecaca`. Analysis remains separate in [M19D](first-ten-calibration.md) and PR #204.

## Implemented scope

Ordinary **Bunker Big Map** material opportunities are ordered by graph distance from spawn. Up to three eligible near rooms use the existing depth-1 pool; the following two use the existing depth-2 pool, including Power Cell; later ordinary opportunities use depth-3. Small eligible-room lists reserve a middle source. Container-specific seeded rolls keep outcomes reproducible without forcing a desired item.

Existing keys, scouting/story items, node-locked vault loot, authored/marked pickups, already-generated gear, medkits and ammo stay intact. No additional containers or moved pickup positions. No changes to construction costs, initial inventory, premium products, bag capacity, player-controlled swapping, extraction losses, enemies or map geometry. Small-level generation and other biomes are unchanged. The unfinished Archipelago outdoor-layout branch is not part of this trial.

**Deliberate difference from simulated Test C:** This is the smaller fixed spatial-band experiment. The four-room pre-Fabricator variant, automatic simulated bag swapping and three 5-Scrap visual repairs are not implemented here. Do not claim the simulation's 96% Fabricator completion result is a measured outcome for this code. Existing earned-Scrap trading remains an optional recovery path.

## Initial matched generation evidence

For the same 1,000 Bunker seeds (`loot-audit-0` through `loot-audit-999`), the initial successful workflow reported:

| Item | Baseline maps containing it | Candidate maps containing it |
| --- | ---: | ---: |
| Cable | 286 | 621 |
| Scrap Alloy | 208 | 616 |
| Polymer Plate | 282 | 551 |
| Power Cell | 0 | 101 |

These counts measure **generated presence across complete maps**, not player discovery, successful extraction, ten-raid progression or retention. This is a different seed set from M19D's original audit; do not compare the raw counts as if they were identical samples.

The automated baseline comparison asserts identical geometry, enemies, exits and loot positions, plus unchanged protected pickups. The unchanged Archipelago and Town generators are compared separately. New contract tests cover determinism, idempotence, input validation, loot pools and protected pickups.

## Accessibility validation

The static movement audit uses the actual movement function, `RULES.playerRadius`, node-pedestal colliders and the real pickup radius. It samples 12 seeded maps and publishes unreachable ordinary-loot/open-exit findings. It does not simulate live combat or renderer-added collision changes; this is not proof that all phone collision bugs are fixed.

A separate browser smoke test runs at **844x390 and 667x375**, Low quality, in a touch-emulated Chromium viewport. It plans a valid route, then moves with real joystick touch input and collects a real item through ordinary gameplay rather than teleporting or granting the item. Enemy pressure is disabled to isolate access. It publishes screenshots and a report; the workflow result, not this description, determines whether it passed.

[Focused validation run](https://github.com/w4sser/protocol-rebirth-proto/actions/runs/42395047402). The current PR contains the detailed [phone protocol](https://github.com/w4sser/protocol-rebirth-proto/blob/fix/big-map-loot-bands/docs/economy/big-map-loot-playtest.md).

## Remaining acceptance before merge

Physical-phone navigation, shot and enemy collisions, readable loot discovery and device FPS still require the player's footage and a real device pass. Headless browser frame rates are not phone performance. Re-run the ten-extraction model against the shipped candidate and genuine player pickup behavior before locking further economy values.

Do not merge this trial merely because generation tests pass. Do not deploy the feature over production Pages without explicit release approval. The smaller early/mid/deep loot experiment is implemented; broader collision corrections, outdoor generation and final progression balance remain separate work.
