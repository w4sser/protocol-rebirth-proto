# M19D - First Ten Extractions: Source-Calibrated Economy Review

**7 November 2026 | Analysis completed; proposed balance, not gameplay approval.**

Companion to [M19C: First Ten Successful Extractions](../first-ten-extractions.md). This report tests whether that proposed experience can be supported by the current generated loot. It does not implement new drop rates, module costs, starting grants, purchases or gameplay rules.

## Executive conclusion

**Fix the distribution and discoverability of useful resources before lowering construction costs.** The current Big Map generator largely inherits late-depth room loot. Early construction needs Cable and Scrap Alloy, while one required Core L2 component, Power Cell, is missing from the audited Big Map floor-loot source. The free Scrap trader already provides an effective alternative for common materials, so a direct-loot-only result must not be presented as the full live economy.

A candidate using existing early/middle/deep loot pools in appropriate places, with deliberate bag-item replacement, produces a much healthier early progression without guaranteed drops or cheaper buildings. It remains a playtest candidate, not a validated player retention result.

## 1. Reproducible evidence

- Gameplay baseline: [`88a9ac6364d0dcf5463c2a5f700f4817960ecaca`](https://github.com/w4sser/protocol-rebirth-proto/tree/88a9ac6364d0dcf5463c2a5f700f4817960ecaca), prototype 2.28.0.
- Analysis lives separately in [draft PR #204](https://github.com/w4sser/protocol-rebirth-proto/pull/204), not in production gameplay files.
- [Baseline run: 42390092083](https://github.com/w4sser/protocol-rebirth-proto/actions/runs/42390092083): nine scenarios, 1,000 profiles each. [Raw CSV and JSON](https://github.com/w4sser/protocol-rebirth-proto/actions/runs/42390092083/artifacts/13581058264).
- [Final corrected refinement: 42390604557](https://github.com/w4sser/protocol-rebirth-proto/actions/runs/42390604557): seven scenarios, 1,000 profiles each. [Raw CSV and JSON](https://github.com/w4sser/protocol-rebirth-proto/actions/runs/42390604557/artifacts/13581920219).
- Analysis source at [`6b22e277917a506ca7b92fc1a3e147233b1d3e83`](https://github.com/w4sser/protocol-rebirth-proto/tree/6b22e277917a506ca7b92fc1a3e147233b1d3e83). Refinement executed merge snapshot `5a1042dd5f01017d5ebb6a1e36a292e5926519b3`; baseline executed `44733f9ef99c6a6ee8e1c6aff31bc8111889e4d5`.
- Both focused workflows passed the existing harness regressions and analysis self-tests. Raw per-profile counts were checked against aggregate milestone thresholds. An earlier intermediate refinement was superseded after correcting bag-swap priority; use only the final refinement linked above.

Reproduce from the analysis commit:

```sh
node scripts/economy-first-ten.mjs 1000
node scripts/economy-first-ten-refine.mjs 1000
```

The refinement adapter alters a temporary analysis script and simulated level objects only. It imports production functions unchanged.

## 2. What is real, and what is assumed?

**Source-linked:** actual `generateLevel`, `collectLoot`, node activation, forward transitions, `enterExit`, `extractRound`/`abandonRound`, actual `swapLoot` in refined cases, slot capacity, item currency grants, current module costs and existing vendor prices.

**Scenario assumptions:** 70% successful extraction per attempt, independently selected rather than simulated combat; 30% deeper-route preference. Big Map visits the nearest four rooms, or six on deeper attempts. Small mode visits two or three depths. Pickup access is optimistic teleportation, with a separate 65%-access sensitivity case. Nodes and reachability are assumed for the chosen path, not proven by these economy runs.

**Starting state:** Core L1 already restored. Primary cases have **zero spare Scrap Alloy** because the approved intro finds two and consumes both. They retain **20 starting Scrap as an explicit legacy-cash assumption**, not a newly approved grant. Separate baseline tests include one legacy spare Alloy and zero starting Scrap.

**Correction to M19C:** its one-spare-Alloy calculation describes the older three-Alloy start, not the approved two-Alloy introductory mission. Do not combine the old surplus with the new intro silently.

**Build policy:** fixed order Fabricator L1 -> BIT Bay L1 -> Vault L1 -> Core L2, spending real accumulated resources whenever affordable. This is one policy, not a forced player sequence. The commissioned vest contributes capacity only while that actual copy survives; it is lost on a failed attempt and is not replaced free.

**Secure Slot:** after Vault, the model preserves one selected needed ordinary material unit on failure. This is an explicitly assumed interpretation of still-open D1 details, not a finalized protection specification.

**Excluded:** live combat, pathfinding, traversal time, damage-dependent survival, quest rewards/hand-ins, pity overrides, initial scripted force-success, crafting, maintenance, normal gear restocks, home overflow and premium purchases. Vendor trading appears only in its own scenario. Thus neither results nor milestone timing are complete production-economy forecasts.

## 3. Current source mismatch

[`big-level.js`](https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/nodspel/big-level.js) samples depth 1 for the initial room and depth 3 for the other room templates. It does not reproduce a normal early-to-middle-to-deep loot progression.

Across **1,000 entire generated Big Maps**, before player pickup or extraction:

| Required resource | Maps containing it | Total generated units | Interpretation |
| --- | ---: | ---: | --- |
| Cable | 294 / 1,000 | 294 | Very few early-purpose sources |
| Scrap Alloy | 256 / 1,000 | 256 | Same first-module bottleneck |
| Polymer Plate | 262 / 1,000 | 282 | Limited downstream BIT/Vault source |
| Power Cell | 0 / 1,000 | 0 | Missing in this floor-loot path |

Power Cell does occur in the current small depth-2 pool: 290 / 1,000 generated depth-2 maps contained it. The source inspection explains the Big Map omission; this is not merely a claim based on a finite zero-drop sample.

**Do not call the entire game globally softlocked.** Existing quest rewards, barter, alternate raid paths and legacy flows may supply components. In particular, the Bunker quest chain includes a Power Cell reward. Those paths need end-to-end verification in the active mode. The conclusion is that the advertised direct exploration source is inconsistent, not that every possible player route is blocked.

## 4. Main comparison

All figures below are **shares of 1,000 simulated profiles** reaching the milestone by the indicated successful ordinary extraction. No percentages are measured human-player behavior.

| Scenario | Fabricator by #3 | Fabricator by #5 | BIT Bay by #10 | Vault by #10 | Core L2 by #10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current small levels, direct loot | 45.7% | 82.6% | 93.5% | 89.2% | 78.4% |
| Current Big Map, direct loot | 0.0% | 8.9% | 13.4% | 0.1% | 0.0% |
| Current Big Map + existing free trader | 82.7% | 99.4% | 100.0% | 99.4% | 0.0% |
| Test A: three early common-loot rooms | 43.0% | 82.2% | 95.1% | 85.5% | 0.0% |
| Test B: early/middle tiers + bag swaps | 48.7% | 85.4% | 95.8% | 90.0% | 8.0% |
| **Test C: stronger early coverage, then tiers + swaps** | **68.8%** | **96.0%** | **98.1%** | **94.1%** | **6.4%** |
| Test C, only 65% pickup access | 32.7% | 73.9% | 83.1% | 60.7% | 0.6% |

The trader scenario uses **earned Scrap**, not Signals or real money. It automatically sells surplus/non-project materials and buys missing common parts at the existing prices. This demonstrates a potential free recovery path, not that a new player naturally discovers or optimizes trading. We should not require early inventory administration to make the main raid-and-repair loop feel rewarding.

The small-versus-big comparison includes different traversal/pickup policies and fixed extraction bonuses (15/30 Scrap after two/three small depths versus 5 in the modeled Big Map return). It is not an isolated experiment measuring only map size.

## 5. Candidate C: concrete proposed change

Keep current module costs. Reuse existing loot pools rather than inventing new currencies or guaranteed milestone drops:

1. **Before Fabricator L1:** four nearby ordinary room opportunities use the current depth-1 pool: Cable, Scrap Alloy, Polymer Plate and Salvage Crate.
2. **After Fabricator:** three early rooms use that common pool; the next two ordinary rooms use the existing depth-2 electronics/parts pool; deeper opportunities retain advanced rewards.
3. Preserve ordinary carrying capacity and real replacement decisions. The refined model uses `swapLoot` to discard a lower-priority item for a useful part, without mistakenly throwing out the last unit needed for the active project.
4. Preserve container counts. This is a distribution test, not additional free loot or automatic construction.
5. In a production implementation, explicitly preserve authored scouting items/keys, validate required-item availability, and tie loot tiers to readable locations/routes. The test's nearest-room ordering is not a finished level-design rule.

The main comparison combines loot distribution and improved pickup policy. Test A isolates the simple early-pool change more closely; do not attribute all Test C improvement to a single parameter.

## 6. Revise the first-ten experience, not just the numerical model

Under Test C's optimistic access policy, **all-profile cumulative medians** are Fabricator at success #3, BIT Bay at #5 and Vault at #7. Most profiles have not built Core L2 by #10. With only 65% pickup access, those median milestones move to #4, #7 and #10.

**Recommended design target for the next mobile test:**

| Experience | Working target, not guaranteed payout |
| --- | --- |
| First successful return | Truthful banked progress and one clear Project; optional identity entry after FTUE |
| First major functional repair | Fabricator around 3-5 successful returns for a player finding relevant opportunities |
| Early companion/storage choice | BIT Bay or Vault around 5-8 successes, allowing player preference rather than fixed order |
| Between larger builds | Several inexpensive visible repairs that do not consume the scarce tracked components |
| Around ten successes | A materially changed home, understood loadout/risk loop and a feasible Core L2/scouting ambition, not a promised region unlock |

The earlier Fabricator-at-#2 suggestion is not a dependable broad outcome in these direct-loot scenarios. Treat it as a fast outcome, not the general design expectation.

## 7. Small restoration sensitivity

An additional unapproved scenario charges **5 Scrap each** for three optional visual repairs offered around successful returns #1/#3/#5, only if the next main project's Scrap cost remains reserved.

- **650 / 1,000** profiles could afford all three.
- 271 could afford two; 72 one; 7 none at those exact offer moments.
- Fabricator completion by #5 remains **96.0%**, BIT Bay by #10 **98.1%**, and Vault by #10 **94.1%** in this sample.
- Some intermediate Vault/Core timing shifts; the cost is not economically free.

**Recommendation:** use this as a small-repair budget experiment, not a promise of three repairs for every player. Repairs should remain available later rather than disappear because an artificial offer moment passed. No costs or automatic grants are approved here.

## 8. Failures: ten successes is not ten attempts

| Assumed per-attempt extraction chance | Median attempts to 10 successes | P10-P90 attempts |
| --- | ---: | ---: |
| 50% | 19 | 15-25 |
| 70% | 14 | 11-17 |
| 85% | 11 | 10-13 |

Failure rates are scenario inputs, not measured skill bands. A lower-success cohort receives more attempts before its tenth success; after Vault, that can mean more modeled Secure Slot saves. This can make late success-index completion look counterintuitively higher despite slower attempt-based progress. **Never infer from this that death is beneficial to players.** Analyze attempts, successful returns, resource losses and time together.

## 9. What to change next, and what not to claim

**Recommend for the next isolated implementation/playtest:**

- Preserve current first-module costs until location-appropriate loot sources are corrected and tested.
- Fix Big Map early/middle/deep material coverage, especially Power Cell availability in a genuinely reachable middle area.
- Keep the free trader as an optional recovery path, surfaced contextually when useful, not as a required early tutorial/menu burden.
- Test three small low-cost visual repairs funded from surplus, with a genuine before/after and no rare-material diversion.
- Validate actual container discoverability and the reported collision/navigation problems. The 65%-access case shows how easily a good table becomes a poor experience when players miss or cannot reach its contents.
- Re-run on the new outdoor layout after it is integrated; these results are based on the pinned existing Bunker/Big Map generation, not the unfinished outdoor branch.

**Not validated:** live mobile enjoyment, FPS, collision correctness, actual extraction probability, operator-speed feel, 30/60/90-day retention, premium prices, revenue, or full post-raid quest/maintenance economy. The old 30-day workbook is not silently replaced or retroactively recalibrated by this first-ten companion analysis.

**Decision boundary:** M19D is analytical evidence and a concrete balancing recommendation. It does not lock new drop rates, grant prices, Secure Slot details or final starting resources. No gameplay balance has been changed or merged.
