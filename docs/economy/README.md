# Protocol Rebirth — 30-day economy model

## Canonical model

Expected workbook path (binary upload pending):
`docs/economy/Protocol_Rebirth_30_Day_Economy_Model_v2.xlsx`

This document tracks the model from decisions **M6–M7** in [design-decisions.md](../design-decisions.md). The `.xlsx` has been generated and validated in the conversation, but **has not yet been uploaded to this Git branch**. Do not claim otherwise until the file is visible at the path above.

File SHA-256 from the conversation's verified artifact:
`7935b78faf4188a51ef85350cbc983673a95d5d5cda4f5c8ec43fca83fa088e9`

After uploading the file, check the checksum to verify it matches. If re-exported/recalculated, record a new checksum and model version.

## Workbook contents (11 worksheets)

- `Dashboard` — overall scenario outcomes
- `Monte Carlo Summary` — simulated progression metrics
- `Controlled Comparison` — matched-seed free/paid comparison
- `Simulation Setup` — randomized scenario assumptions
- `Monte Carlo Runs` — 4,000 simulated outcomes
- `Cohort Inputs` — four sample spending/activity settings
- `Raid Yields` — expected drop model
- `Upgrade Costs` — requirements derived from modules
- `30D Engine` — formula-based post-FTUE progression
- `Method & Sources` — methodology and assumptions
- `Simulation Notes` — limits and interpretation

**Important limitations:** 1,000 matched seeds × 4 spending tiers, 2 attempted raids/day, 70% extraction success, 30% deeper-route preference. Monetary levels (0/89/399/1999 SEK) and prices are synthetic. Loot draws are weighted from `nodspel/levels.js`, but **do not reproduce actual scene placement, player pickup choice, bag stacking or runtime retention**. Monte Carlo result sheets are **snapshots**, not live Excel calculations: rerun the simulation when changing its inputs.

## Initial controlled results

| 30-day spend assumption | Core L2 by day 30 | Median Core L2 day | Core L3 by day 30 |
| ---: | ---: | ---: | ---: |
| 0 SEK | 89.4% | 16 | 0.1% |
| 89 SEK | 89.4% | 15.5 | 0.1% |
| 399 SEK | 97.6% | 9 | 0.7% |
| 1,999 SEK | 97.6% | 9 | 0.7% |

These are **model outputs**, not player telemetry, a sales forecast, or approved economy targets.

## Next engineering work: actual runtime loot calibration

1. Instrument real `nodspel` Node Raid loot tables, generated pickups, bag selection, actual extraction, banked materials, and per-raid Scrap. Keep identifiers and timing, without collecting unnecessary personal data.
2. Build a deterministic seed-based harness that runs the **current real** loot/retention logic rather than sampling a simplified table.
3. Export per-run `seed, depth, items_spawned, items_taken, successful_extraction, items_banked, scrap_banked` and provide aggregate percentiles by depth.
4. Re-run the same-activity payer-vs-free model on the real distributions and compare Core L2 and Core L3 median and P10/P90 days.
5. Flag inconsistencies with D1–D3 design contracts separately. This is calibration work, **not authorization to change drop odds, product prices, paid story keys, or extraction rules**.

**Definition of done:** reproducible seed log, traceable source commit, 1,000+ simulated runs per configuration, distribution comparison against simplified M7, and a short recommendation on Core L2 free-player bottlenecks and Signals product value.

## Version control

Keep the workbook under `docs/economy/` alongside this file on PR #201's docs branch. When the spreadsheet is amended, increment its suffix and update the reference document and checksum. Do not merge PR #201 solely because this workbook is added; it remains a design-review branch.
