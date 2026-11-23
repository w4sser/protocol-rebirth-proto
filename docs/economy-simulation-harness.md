# Economy Simulation Harness

**Scope:** Non-production offline analysis on a separate PR. GitHub Pages is unaffected: Node.js runs this script locally or in GitHub Actions. No backend, shop, wallet, or game rules are added.

## Commands

```sh
node --test test/economy-sim.test.mjs
node scripts/economy-sim.mjs --runs 1000 --seed economy-ci-v1 --success 0.7 --depth3 0.3 --area bunker --out verify-out/economy
```

Outputs:

- `verify-out/economy/runs.csv` — 1,000 seeded attempts, actual generated loot boxes, items picked, bag before settlement, secured/lost bag, Scrap, Data Cores
- `verify-out/economy/summary.json` — assumptions, distributions, and banked/spawned item totals
- GitHub Actions **economy simulation** uploads those files as a downloadable workflow artifact on PR and manual runs

## What is actual game code?

- `generateLevel()` chooses the real level geometry/loot tables, placement, hardcoded crates and seeded items from `nodspel/levels.js`.
- `collectLoot()` applies the real inventory-capacity/pickup semantics (including items that do not occupy material bag slots) from `nodspel/round.js`.
- `extractRound()` and `abandonRound()` apply the current secure-vs-loss logic. `extractScrapBonus()` and `DATA.items[].grantsCurrency` determine awarded currency values.

**Caution:** The script makes **optimistic pickup attempts at every loot box by teleporting to its position**. It does not simulate walls, pickups denied by required nodes, combat, enemy survival, actual timing, wayfinding, player bag-item decisions, gear prompts, bonuses from other systems, or paid transactions. `--success` and `--depth3` are scenario assumptions, **not measured probabilities**. The script sets `levelsCleared` when settling a hypothetical successful raid; it therefore does *not* validate the real extraction gate or the signed-off future D2 behavior. The selected baseline is `small` levels, bunker area unless passed otherwise. Actual live raid currently also has a distinct big-level path; that must be instrumented separately.

**This harness is for calibrating the distribution of generated and bankable loot under a simplified optimistic policy, not a production-economy forecasting engine.** Never assume `runs.csv` is actual player telemetry.

## Next calibration tasks

1. Instrument live raid pickup decisions and actual successful/failed extraction outcomes, including `big` levels, without changing gameplay.
2. Run controlled free-vs-paid progression simulations with identical seeded player actions using actual secured resource distributions; compare with the workbook `Protocol_Rebirth_30_Day_Economy_Model_v2.xlsx`.
3. Measure median/P10/P90 of resources per attempt and time to Fabricator L1, Core L2 and Core L3. Do not assign final item prices until calibrated.
4. Document D1/D2/D3 mismatches found in the existing runtime separately, without quietly changing game behavior.

The source-of-truth design analysis is on PR #201 under `docs/design-decisions.md` (M6/M7) and `docs/economy/README.md`. The workbook binary upload is a separate outstanding task and is **not bundled in this PR**.
