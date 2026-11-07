# M19E - Bunker Big Map loot distribution implementation trial

**7 November 2026. Owner authorized the bounded loot adjustment and accessibility test recommended in M19D.** This is authorization for an isolated implementation/playtest, not automatic merge, production deployment or final economy targets.

Implementation: [draft PR #206](https://github.com/w4sser/protocol-rebirth-proto/pull/206), branch `fix/big-map-loot-bands`, based on main `88a9ac6364d0dcf5463c2a5f700f4817960ecaca`. Analysis remains separate in [M19D](first-ten-calibration.md) and PR #204.

## Implemented scope

Ordinary **Bunker Big Map** material opportunities are ordered by graph distance from spawn. Up to three eligible near rooms use the existing depth-1 pool; the following two use the existing depth-2 pool, including Power Cell; later ordinary opportunities use depth-3. Small eligible-room lists reserve a middle source. Container-specific seeded rolls keep outcomes reproducible without forcing a desired item.

Existing keys, scouting/story items, node-locked vault loot, authored/marked pickups, already-generated gear, medkits and ammo stay intact. No additional containers or moved pickup positions. No changes to construction costs, initial inventory, premium products, bag capacity, player-controlled swapping, extraction losses, enemies or map geometry. Small-level generation and other biomes are unchanged. The unfinished Archipelago outdoor-layout branch is not part of this trial.

**Deliberate difference from simulated Test C:** This is the smaller fixed spatial-band experiment. The four-room pre-Fabricator variant, automatic simulated bag swapping and three 5-Scrap visual repairs are not implemented here. Do not claim the simulation's 96% Fabricator completion result is a measured outcome for this code. Existing earned-Scrap trading remains an optional recovery path.

## Matched generation evidence

For the same 1,000 Bunker seeds (`loot-audit-0` through `loot-audit-999`), the successful workflow reported:

| Item | Baseline maps containing it | Candidate maps containing it |
| --- | ---: | ---: |
| Cable | 286 | 621 |
| Scrap Alloy | 208 | 616 |
| Polymer Plate | 282 | 551 |
| Power Cell | 0 | 101 |

These counts measure **generated presence across complete maps**, not player discovery, successful extraction, ten-raid progression or retention. This is a different seed set from M19D's original audit; do not compare the raw counts as if they were identical samples.

The automated baseline comparison asserts identical geometry, enemies, exits and loot positions, plus unchanged protected pickups. The unchanged Archipelago and Town generators are compared separately. New contract tests cover determinism, idempotence, input validation, loot pools and protected pickups.

## Verified accessibility and regression evidence

Validated implementation head: `fc6bb1986e637f05adb3df0dbffb13d6c6ad5147`.

- **Seven focused loot tests passed**, including the 1,000-map source coverage sweep. Baseline geometry/protected-pickup equality passed.
- **Twelve static movement audits passed:** actual player radius 0.36, node-pedestal colliders, real movement function and pickup radius. No unreachable sampled ordinary loot or open exits were reported. This excludes renderer-added props, live combat and enemy pathfinding.
- **Eighty-nine relevant local tests passed** across loot, Big Map, collision regression, collection, bag swaps, quests, resources, round settlement and result handoff.
- **Browser touch smoke passed at 844x390 and 667x375**, Low quality, seed `loot-audit-0`. Both runs physically walked via the actual joystick touch input and collected `big-loot-3` (Polymer Plate), producing one unit in the carried bag. No teleport, direct item grant or direct call to collection was used. Enemy pressure and room-clear reward prompts were disabled to isolate navigation. Screenshots and motion logs were inspected.
- **The ordinary repository and Node Raid test job passed** on the same head. The full mobile-layout matrix was not all finished at the last inspection; do not describe the whole CI run as complete until its result confirms that.

[Successful focused validation](https://github.com/w4sser/protocol-rebirth-proto/actions/runs/42396016961) contains the generation/access report and the [touch screenshots and report](https://github.com/w4sser/protocol-rebirth-proto/actions/runs/42396016961/artifacts/13583502201). [General CI](https://github.com/w4sser/protocol-rebirth-proto/actions/runs/42396016985) is separate.

The first touch test failed because its test controller oscillated around small waypoints under slow headless timing. Retained motion logs showed back-and-forth movement, not a proven blocked passage. The controller was corrected to advance after crossing a waypoint and to stop input between short touch gestures. **The same original seed and target passed afterward**; neither collision geometry nor pickup position was changed to satisfy the test.

The current PR contains the detailed [physical-phone protocol](https://github.com/w4sser/protocol-rebirth-proto/blob/fix/big-map-loot-bands/docs/economy/big-map-loot-playtest.md).

## Remaining acceptance before merge

Physical-phone navigation, shot and enemy collisions, readable loot discovery and device FPS still require the player's footage and a real device pass. Headless browser frame rates are not phone performance. These two viewport smoke tests do not prove every room/seed is accessible. Re-run the ten-extraction model against the candidate and genuine player pickup behavior before locking further economy values.

Do not merge this trial merely because generation and browser tests pass. Do not deploy the feature over production Pages without explicit release approval. The smaller early/mid/deep loot experiment is implemented; broader collision corrections, outdoor generation and final progression balance remain separate work.
