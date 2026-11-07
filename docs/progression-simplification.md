# M19A — Progressive Complexity: Less Early, Deeper Endgame

> Owner direction, 7 November 2026: **Less is more for the early and mid game. Endgame may introduce more systems and depth.** This is a design-direction approval, not approval of precise milestone levels, removals, or implementation. Companion to [M19](progression-content-economy.md).

## Thesis

**One goal, one understandable upgrade, one new decision at a time.** A new player should primarily experience **Raid → Extract → Restore Home → Raid again**. System depth should be *earned through mastery*, not dumped into the first session, and endgame depth should come mainly from combining learned rules rather than adding unrelated currencies and parallel grind bars.

### Proposed progression layering

| Player stage | Visible progression | Background or concealed systems | What is new for the player |
| --- | --- | --- | --- |
| **FTUE / first extraction** | One active **Bunker Project** and clear next material goal. Basic Carbine and extraction. | Operator XP can accrue silently; no skill tree, weapon mastery page, BIT talent tree, season pass or store demanded. | Learn one loop and witness Core restoration; preserve D3. |
| **Early game** | Bunker Projects and *simple* loadout choice (one weapon, armor, one tool when unlocked). Small visible home repairs. | Operator XP accrues but only surfaces at a **meaningful milestone**. BIT Bond, if retained, should not require active management. | Player chooses risk vs reward; observes a few different tactical responses. |
| **Midgame** | Bunker/world scouting milestone; Operator milestone choice; BIT's most useful support feature; integrated Customize hub. | Avoid separate skill-use XP, mastery and BIT tree notifications at once. Retain technical counters in save model until migration planned. | More variety and strategic identity without mandatory complexity. |
| **Endgame** | Optional higher-difficulty raid variants, advanced loadout specialization, mastery challenges/earned cosmetics and more elaborate home customization. | Deeper earned specialization only after proven retention and clear gameplay need. | Combine known mechanics; pursue aspirational goals rather than daily chores. |

## Recommended simplification decisions for design review

| Existing system | Proposed action | Reason | Endgame extension |
| --- | --- | --- | --- |
| **Bunker modules / Core / worlds** | **KEEP as primary spine**, one tracked Project at a time | Most tangible reason to raid; functional and visible home restoration | Additional room customization/restoration projects, not another mandatory currency |
| **Operator level + XP** | **KEEP, simplify UI**: background XP with rare, meaningful choices as P1.3 already approves | Player can understand personal advancement without managing five skills | More strategic choice combinations and optional build presets |
| **Five use-based Operator skills** | **COLLAPSE / HIDE during early/midgame**, pending owner approval of exact removal; preserve acquired save state until migration | Movement/search/crafting grind creates competing leveling feedback | Optional mastery challenges rather than five new XP meters |
| **Weapon mastery XP and weapon Mk / attachments** | **KEEP equipment identity**, but **do not foreground independent mastery grind** early. Consider folding handling improvements into equipment/attachment milestones; final schema open | Reinforces M17 tradeoffs without duplicating Operator level | Earned mastery challenges, specialized attachments, rare blueprint paths; avoid universal max-DPS builds |
| **BIT Bond + talents + hardware** | **BIT Bay hardware is functional progression**, BIT personality always visible. Hide Bond-number grind initially; simplify talent tree to a small number of meaningful support choices when justified, not simultaneous trees | BIT should feel like a companion, not three overlapping level bars | Optional deeper companion specialization; no automatic item rescue or extra Secure Slot per D1 |
| **Identity / cosmetics** | **KEEP simple and optional** after D3 FTUE: free Callsign/bunker naming and one Customize hub | Emotional investment without mandatory progression overhead | Larger curated collections, named room themes and earned titles |
| **Temporary raid perks** | **KEEP only if fun/readable during the raid**, no extra persistent advancement track | Supports varying moment-to-moment combat builds | Deeper synergy combos, but cap decision clutter |
| **Currencies** | **NO NEW WALLETS** for mastery or endgame. Follow M5 existing economy planes. | Clear sources/sinks and commercial integrity | Different use cases for existing currencies; never turn failure insurance back on |

**Explicitly not approved:** deleting saved skills or talents, converting mastery ranks, setting operator milestone levels, introducing a new endgame resource, or changing live item tuning. This is a **prioritized pruning recommendation** for owner review.

## Passive Growth and Physical Encumbrance — M19B Owner Clarification

**Owner clarification, 7 November 2026:** Simplification means fewer **visible/managed advancement systems**, **not** removing subtle numerical/physical progression. The player particularly values (1) becoming faster as they level and (2) slowing down as the loot bag fills. Preserve those tangible feels as background mechanics, including their extraction-risk consequences.

### Existing code verified

- `nodspel/stakes.js` computes bag load as `carriedWeight(round) = clamp((bag item count + backpack gear count) / bag capacity, 0..1)`, so current burden is **slot occupancy rather than actual item mass**. `speedMultiplier = 1 - carriedWeight * STAKES.bagWeight.maxSpeedPenalty` and `detectionMultiplier = 1 + carriedWeight * STAKES.bagWeight.maxDetectionBonus`. The reference notes up to a **20% full-bag movement penalty**; do not imply it is a kilograms simulation.
- `nodspel/levels.js` defines baseline player speed at **3.6** in its current rule data; actual operator/bundle progression modifiers and runtime combination must be checked before changing leveling. Operator speed growth is a **desired player-experience requirement**, not proof that specific level-to-speed values are presently balanced.
- `data/items.js` contains a mobility-oriented Scout Rig and a defensive Scavenger Vest; avoid introducing another skill tree merely to support gear trade-offs.

### Proposed invisible-mechanics contract

1. **One Operator XP/level progression:** award a bounded, small passive mobility improvement at selected level milestones in the same existing progression. No separately managed Mobility XP tree, no movement-stat allocation on every level.
2. **Bag burden remains tangible:** lighter load means faster movement; approaching capacity steadily reduces speed and increases exposure to enemies (current code also increases detection). This creates *extract now vs collect more* risk and benefits deliberate bag choices.
3. **Higher levels don't trivialize burden:** cap permanent speed growth and preserve a meaningful percentage/full-bag difference for veterans; tuning of base speed, scale, and clamps requires real phone playtests.
4. **Clear feedback, no extra HUD:** a small **Heavy Load** cue only when a meaningful encumbrance threshold is crossed, a readable speed-feel difference, and optional detail in Operator/Bag inspection. Do not put an XP gauge for every invisible mechanic on the main raid screen.
5. **Gear gives real trade-offs:** mobility-focused armor can offset some of the cost of load, but not fully negate a packed bag; defensive armor offers survival in exchange for less speed/other strategic advantage. Exact gear stat interactions are not yet approved.
6. **Fairness:** gameplay speed changes must be stable and predictable, never sudden untelegraphed impairments; test bridge navigation, projectile dodge and chase/extraction at empty, half and full load on low-end phones.
7. **Endgame depth:** advanced player builds can provide earned specializations or loadout compromises that interact with burden, but avoid converting them into a permanent +X% speed purchase ladder.

### Suggested validation, not approved numbers

- Run controlled tests with the **same operator and route** at empty, ~half and full bag, comparing movement, evasion and tactical extraction. Repeat at early vs advanced operator levels and across armor choices.
- Ask players whether their movement feels faster as they progress and whether the full bag feels risky **without reading a stat page**.
- Log current speed/weight multipliers and actual distance-to-extract; ensure faster veterans still face a meaningful loaded-versus-light cost.
- Before coding any level-based speed passive, verify the legacy use-based Mobility progression and actual runtime stat assembly to avoid double-counting the bonus.

**Decision boundary:** Preserve **passive, felt operator speed growth** and **load-induced slowdown** as owner direction. The level milestones, numerical speed curve, encumbrance amount and whether legacy Mobility XP is migrated into Operator milestones remain open. This doc does not implement changes.

## Reveal rules for UX

1. **Start with next action:** Home shows a Project and a RAID entry point, not six progress bars.
2. **Only reveal a system when it changes a decision:** show a tool when the Fabricator grants it, an Operator choice when the choice is available, and advanced builds when players encounter threats where they matter.
3. **One new concept at a time:** don't reveal BIT talent choice, weapon attachment tree, Vault Secure Slot, Growth Fund and bunker decor at the same homecoming.
4. **Use outcome-focused presentation:** "Your new Workshop lets you bring an EMP" is better than a generic +5% stat popup. Distinguish permanent room vs losable gear.
5. **No calendar unlock:** gates are demonstrated skill, functional bunker restoration, scouting extraction and optional depth; not 30 days spent logging in.
6. **Endgame must still be optional:** complex build crafting, challenge collections and mastery titles should improve breadth of play, not invalidate the simple accessible extraction loop.

## Endgame design: depth without compulsory work

Proposed high-mastery goals:
- **Hard variant expeditions:** combinations of already learned enemy roles, environment systems and higher-value optional loot; keep early return extraction.
- **Specialization choices:** limited tradeoff-driven Operator/weapon/BIT options, not endless arithmetic boosts; one clear weakness per build.
- **Mastery achievements:** encounter-completion style feats that yield earned Callsign titles, nameplates, operator/BIT/room cosmetics. No purchased skill badge.
- **Long restoration projects:** large visual identity payoffs in named bunker rooms; smaller consistent upgrades continue to be earnable.
- **Novel world situations:** M18A director recombines terrain, threat, loot and dynamic events so content feels different each raid rather than requiring 10 progression systems.
- **No fail-safe monetization:** D1 item loss, D2 return, free fallback and no paid-only solution apply in endgame too.

## Concrete first-10-successful-extraction experience (sequencing hypothesis)

**Milestones are accomplishment-based, not guaranteed loot/calendar days.** Numbers denote the order of *illustrative* successful returns, not fixed reward schedules.

| Successful returns | Player-facing priority | What not to show yet |
| --- | --- | --- |
| **First** | First normal-raid success ends FTUE; clear Fabricator next step, optional Callsign/home name | No skill tree, Growth Fund interruption, BIT talent grid |
| **2–3** | Build meaningful progress on Fabricator; one visible small restoration; choose useful alternative gear when available | No five parallel use-based skills |
| **4–6** | More varied encounters and a simple prep-tool choice; next meaningful room; first earned cosmetic choice | No nested mastery dashboards |
| **7–10** | Meaningful Operator milestone (if naturally reached), Vault/BIT Bay project choice, track longer-term Core L2 + Chart | No mandatory store, season pass, advanced talent tree |

Actual affordability of these beats requires checking `data/modules.js`, loot eligibility, and M6/M7 simulation against played outcomes. Do **not** guarantee a rare item or force a successful raid on a fixed count.

## Validation

- Ask fresh players after the first two raids: **what is your one next goal, and how will you achieve it?**
- Count visible permanent progression areas and notifications at each return; target **one primary, at most one voluntary secondary decision** in the earliest sessions (proposed UX target).
- Compare simple-vs-current progression UI for comprehension, time from home to next raid, felt home progress, repeat play and whether players understand loss rules.
- At advanced stages ask whether depth offers genuinely different approaches or just mandatory grind; compare run variety and build strategies.
- Safeguard existing saves: migrate or silently preserve acquired ranks; never remove entitlements without a migration plan.

## Recommendation / next work

**Lock as product direction:** minimal early/midgame surface, expand genuine strategic depth for endgame. Before coding, make an explicit owner decision on the three most important simplifications: (1) hide/collapse five use-based skills, (2) suppress weapon mastery as a separate early UI, (3) simplify BIT bond/talents into a companion + hardware-first UX. Then model the first-ten-successful-raid cost/cadence and specify M20 optional long-term content. No implementation performed.
