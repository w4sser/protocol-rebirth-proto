# Protocol Rebirth — M19C: First Ten Successful Extractions

> **Status:** Detailed progression design proposal, 7 November 2026. Follows owner direction M19A (**less early, deeper optional endgame**) and M19B (**passive felt movement gains and meaningful full-bag penalty**). Defines a **test journey, not ten guaranteed scripted outcomes**. Retains D1/D2/D3 and M5. No gameplay, drops, rewards, prices or numeric speed tuning implemented.

## 0. Define the measurement unit before designing the rewards

**Successful extraction #N** means the Nth successful **ordinary** quick PvE raid after the approved authored intro, counted per save. Death, abandon, timeout and an unsuccessful extraction do **not** increment the count. Player goals may be partially or wholly incomplete despite a successful extraction (D2.2). Short extraction with modest loot counts as a success; it need not be auto-rewarded with an unrelated rare item.

**Design philosophy:** The table below lists a *recommended focus, possible earned payoff, and next decision to surface* around each successful return. An upgrade must happen **only when the stash and prerequisite conditions are satisfied**; do not force loot, manually advance a Core level or award a specific weapon because a success counter reached N. The first normal raid must remain genuinely winnable/losable as the D3.9 contract requires.

## 1. Anchors from repository data (existing costs, not invented rewards)

Source: `data/modules.js` and `data/progression.js` on design reference branch; all numeric amounts below are **current prototype data**, not approval of final launch balance.

| Existing module | Exact L1 / L2 requirement as configured | What player can actually notice |
| --- | --- | --- |
| **Core L1** | 2 Scrap Alloy, 0 Scrap | Power restored in FTUE before first ordinary extraction |
| **Fabricator L1** | **20 Scrap + 2 Cable + 2 Scrap Alloy** | Scavenger Vest commissioning (+25 shield, +1 bag slot); basic crafting/recycling and Raid Prep |
| **BIT Bay L1** | **20 Scrap + 2 Cable + 1 Polymer Plate** | One loot scan per raid and search guidance; visible dock |
| **Storage/Vault L1** | **50 Scrap + 2 Polymer Plate + 2 Scrap Alloy** | +8 stash slots; **one Secure Slot** under owner-approved D1, detailed handling requires final review |
| **Core L2** | **120 Scrap + 1 Power Relay + 1 Circuit Board + 1 Power Cell + 1 AI Fragment** | Expands power and higher module caps; world access also requires **extracted Archipelago Chart** under later D2/M18 direction |

**Important compatibility warning:** Older module data describes Core L2 as opening *Transit Hub* directly, and old `data/progression.js` includes force-extract and guaranteed first-hour raid drops, insurance and bag recovery. Those are not authorization to override newly approved world order **Bunker → Archipelago → Town**, D1 no insurance / no paid bag rescue or D3.9 truly uncertain first ordinary raid. The new designed **Chart requirement** needs a separately validated real obtainability path; current costs do not include it. Do not imply this reconciliation is already implemented.

**Early-wallet caution:** Current scripted start defines **20 Scrap and 3 Scrap Alloy**. Core L1 spends 2 Scrap Alloy, which leaves **1 Scrap Alloy** if no other state changes. Fabricator L1 would then still need *at least one* additional Scrap Alloy plus 2 Cable, even when the player already has the 20 Scrap. Do not write an incorrect first-raid guarantee. Actual obtainable loot and economic effects must be checked on live Node Raid seeds.

## 2. Ten-extraction journey, designed as a flexible sequence

| Success | Primary player-facing feeling | Earnable progress / possible payoff (never automatically granted by count) | What we reveal or teach | Next choice / why go out again |
| --- | --- | --- | --- | --- |
| **#1 — I got home** | "I can make it back with something." | Actual secured Cable / Scrap Alloy / Scrap; first Fabricator Project progress | Finish D3.9; **one** tracked Project, one clear RAID action; optional name/Callsign *after* onboarding | Gather next missing Fabricator part, or revisit a new observed room |
| **#2 — I have a purpose** | "I know what I'm hunting." | More banked Fabricator materials; if affordable, build **Fabricator L1** and see workbench activate/vest | Show `HOME x / NEED y`; explain likely source, not guaranteed loot; no skills tree | Try available crafting/prep or choose one attractive likely-source route |
| **#3 — My bunker changes** | "I improved this place." | Fabricator commissioning payoff *if earned*; otherwise small **cosmetic/visible repair** using an explicitly separate low-cost source (not automatically free) | Notice armor/weapon choice difference; one passive Operator improvement may accrue quietly | Track either BIT Bay L1 or Vault L1 depending on materials |
| **#4 — I can try a different tactic** | "I learned another solution." | Earned loadout option, Decoy after Fabricator L1, or first optional encounter tactic; no guaranteed item | One optional tool / enemy counter at a time; preserve free Carbine effectiveness | Choose a risky detour for a relevant part or take a safe return |
| **#5 — BIT matters** | "My companion helps me find things." | **BIT Bay L1** if 20 Scrap + 2 Cable + 1 Polymer Plate obtained; otherwise visible dock/project stage progress and context advice | Introduce BIT's **actual gameplay benefit** on completion, not a Bond XP dashboard | Choose BIT upgrade vs Storage; try guidance in a varied raid |
| **#6 — Loot becomes a decision** | "Do I leave now with a heavy bag?" | Bank better gear / targeted component; possibly a small restoration stage; no scripted payout | Make carried load vs speed/detection legible; one small **Heavy Load** cue if threshold meaningful | Extract safely with current valuables or push into an optional cache |
| **#7 — My gear changes my approach** | "I can build for the situation." | Earning weapons/armor/tools through actual loot/crafting; optionally improve a weapon, keep at-risk gear loss intuitive | Compare one alternative to Carbine; avoid mastery or 5-skill grid | Select enemy/loot target suitable for the desired build |
| **#8 — I made a smart investment** | "Storage or power changes future runs." | **Vault L1** *if* 50 Scrap + 2 Polymer Plate + 2 Scrap Alloy; D1 one Secure Slot. Alternatively save toward Core L2; no fabricated Vault grant | Reveal Secure Slot only when unlocked and precisely explain protection vs bag capacity, never extra insurance | Invest in capacity/convenience or scarce Core inputs |
| **#9 — The world is opening** | "I'm close to somewhere new." | Real Core L2 inputs and/or tracking future Archipelago Chart; potential discovery if encounter/loot supports it | Explain Core L2 **and** extracted Chart as *separate* access requirements; no world unlock based only on success count | Choose targeted rare-component route, or first scouting mission when actually obtainable |
| **#10 — This is my game** | "I have a home, my playstyle, and a bigger ambition." | A coherent Project/bunker/identity overview reflecting **only earned** upgrades, possibly a first optional mastery/nameplate if its conditions were actually met | Surface one deeper goal and at most one optional specialized system; still simple return-to-raid flow | Continue Core+Chart ambition, varied Archipelago opportunities **only if unlocked**, or end-of-Bunker tactical mastery |

**Interpretation:** The row labels are *intended emotional beats*. If the player obtains different materials or has failures between successes, shift which module completes. The player who completes Fabricator on success #4 should still see its first-activation payoff then. Do **not** replay a delayed "success #2" script, or spawn a corresponding rare drop to force the timetable.

## 3. Fallback when the player is behind the proposed curve

The correct response to slow progress is **better choices and visible truthful partial progress**, not secret success-count grants.

1. **After each success:** compare actual extracted cargo and banked inventory with active Project. Show what was earned and the *one most useful next action*.
2. **If no suitable materials for several successes:** verify item exists in chosen area/depth; provide a genuinely obtainable route hint, direct player to accessible nodes/containers, or propose a different near-term Project. No fake drop promise.
3. **After a costly death:** free Basic Carbine retry and safe home materials persist; BIT offers subtle assistance according to D3.8, without reimbursing a lost bag or selling restoration.
4. **If early small repairs compete with scarce Core inputs:** postpone decor / use a cosmetic earnable milestone or distinct common input. Never consume the exact part the UI has told player they need for their only active Project without confirmation.
5. **No early hard gate to a better build:** present a tactical technique using free equipment even when a better tool is not yet craftable.
6. **Don't use BIT Bond or weapon mastery XP notifications** to disguise lack of meaningful home progression.

## 4. Passives: movement progression and loot load

Keep M19B's physical/tactile progression in every stage.

- **Operator Level:** XP accumulates with raids; a **small, bounded movement advantage** may become noticeable at a level milestone without requiring the player to level a second Mobility bar. **Actual current level-speed mapping must be audited**; proposal is not a statement that every current level raises speed. No approved numerical speed bonus.
- **Carried load:** existing `nodspel/stakes.js` uses occupied bag/backpack **slot fraction** for current slowdown and increased detection; reference indicates up to 20% speed penalty when fully loaded (source tuning subject to verification). Preserve this tactical tradeoff and do **not** represent it as item weight in kilograms.
- **Player expression:** loadout armor can trade protection vs mobility, but a max-level Operator should still notice a heavy bag. Do not make an unearned permanent speed upgrade cancel extraction risk.
- **UI:** use lightweight in-world movement feel and an optional contextual Heavy Load cue, *not* a Mobility XP page or movement stat popup after each run.

## 5. The first ten raids should produce actual variety too

M18A–M18B requires repeatable variation by layout, loot, enemies and tactics. **Do not pre-script identical room sequences** to manufacture a progression story.

| Learning band | Encounter and world novelty budget | Equipment/system novelty |
| --- | --- | --- |
| **#1–2** | Reliable Bunker early threat/cover and optional familiar route variation | Purpose, looting, physical extraction and Project |
| **#3–4** | A fork, a rusher/sentry variation or optional relay tactical room | First optional gear/tool |
| **#5–6** | Enemy pairing, optional different cache route, bag/retreat decision | BIT guidance when earned, passive burden clarity |
| **#7–8** | Distinct same-scale Bunker room identities and a tactical counter choice | Build matchup and Vault choice if affordable |
| **#9–10** | More of the established patterns, optional deeper signal/scouting route | Meaningful Operator milestone *when actually reached*, broader Core L2 project |

**Not mandatory:** no raid N has to contain a specific enemy, special event, rare item, mission-specific container or world unlock. Requirements still apply across real biome eligibility, seed validity and M15/M16 enemy-tell fairness.

## 6. Post-raid and home UI: one priority, optional depth

**Successful extraction results:**

```text
EXTRACTED
Secured: Cable x1 • Scrap Alloy x1 • Scrap +[actual amount]
FABRICATOR L1
Cable 1/2 secured at HOME
Scrap Alloy 2/2 secured at HOME
Scrap [actual]/20 secured at HOME

NEXT: Find one Cable — likely in electrical storage
[TRACK & RAID]   [HOME]
```

Above shows **illustrative** inventory numbers; derive all live counts from actual stash/currencies and carry reconciliation. If a Project becomes affordable, the result can offer `RESTORE FABRICATOR` at Home. If restoring a room, show a clear visual before/after and a practical *next-raid benefit*, then get out of the player's way.

**Home top-level:** (1) one Project; (2) RAID; (3) optional BIT/Operator/Customize entry. No forced Growth Fund or $ prompt during FTUE or extraction choice. All paid materials must be labeled as optional and the free earn path clearly available.

## 7. Economy integrity and calibration work

**Do not lock a "10 raids = all four rooms" schedule.** Minimum viable quantification needs:

- Current source/sink model with confirmed starting stash after FTUE (including 1 remaining Scrap Alloy), area/depth-specific real drop pools, bag capacity, extraction success and time cost.
- Verify `Fabricator L1` item affordability is not quietly delayed by very low drop chances. Check `BIT Bay L1`, `Vault L1` and `Core L2` separately.
- Reconcile legacy `data/progression.js` scripted `forceOutcome`, `guaranteedDrops`, `insurance` and recovery with D1/D3.9 before live implementation.
- Confirm whether `Archipelago Chart` and `Town Survey` are actually attainable persistent items in current Node Raid; **don't promise** either in a ten-run journey if not.
- Observe early vs later operator movement speed + bag penalty at 0/50/100% occupancy, with actual device path length and AI pursuit.
- Model failure streaks as well as successful raids: **ten successes may require substantially more than ten attempts**.

### Prototype test cohorts

| Cohort | Why |
| --- | --- |
| **New player, low extraction skill** | Check no softlock when deaths interrupt resource accumulation |
| **Competent cautious extractor** | Check short returns lead to useful partial progress rather than exploitably best economics |
| **Skilled deep-run extractor** | Check optional depth is a worthwhile choice without guaranteed rare drops |
| **Equipment optimizer** | Check whether any build/weapon dominates tactical tradeoffs |
| **Unpaid vs optional-spend modeled player** | Check meaningful free progression and ensure pay does not rescue loot or replace scouting extraction |

### Candidate acceptance gates (proposed)

1. After success #1, new players identify the next Bunker Project, needed resource and free path to obtain it.
2. By successes #3–5, players notice *at least one* meaningful improvement (earned material/project completion, visible home repair or practical equipment change) without a forced reward.
3. Within the first 10 successes, no **two consecutive** returns should feel like zero meaningful progress toward the **chosen Project**, unless the player deliberately changed goals / carried nothing; validate via subjective playtest, not a fabricated payout.
4. At least two different enemy/route approaches are experienced and understood; no need to see every biome or own every weapon.
5. One clear explanation of burden and gear loss survives an actual loaded extraction or death.
6. The first-ten experience does not add five foregrounded use-based skills, a BIT talent dashboard and weapon mastery popups.
7. Real simulation and testers confirm Core L2/Chart goals are ambitious but not impossible; avoid economy grind designed to sell relief.

## 8. Smallest practical implementation and test plan (not authorized)

1. **Telemetry readout:** capture real success index, extracted inventory, goal progress, operator level, weight fraction, room completion and earned unlocks in a reproducible test save.
2. **Post-raid Project panel prototype:** show current banked vs needed resources, one route hint, and a single clear Home/Track action, no unearned success-counter reward.
3. **3 scenario saves:** early first ordinary extraction, mid progression with missing BIT/Vault inputs, and a late Bunker progression save aiming for Core L2 + Chart.
4. **Economy simulation:** using actual 2.28 code item tables and 8-minute timing, produce an uncertainty band (P10/P50/P90 *attempts* and *successful extractions*) for each real milestone. Any historical assumptions in older `data/progression.js` must be flagged.
5. **Phone playtest:** observe ten successful extractions across attempts, including failures, with both static camera and varied biomes, measure time to next purposeful raid and clarity of Project payoff.

## 9. Remaining owner decisions

- Should two **small decorative repairs** be possible before the first bigger functional module, and which **noncompeting common sources** fund them? Recommendation: yes, **only when affordably earned**, and they do not add a separate progress bar.
- When is the first **optional passive level-speed improvement** perceptible? Test feel at fixed empty/full load against current runtime before choosing numbers.
- What percentage of players should be able to build **Fabricator L1** within their first ~3 successful ordinary extractions (across losses)? Needs simulation + human testing before target set.
- How should player-facing Chart/Survey tracking behave when the current quest path cannot yield that item? Must fix unlock/content pipeline first; don't surface an impossible goal.

**Working recommendation:** Lock the structure as a **flexible earned sequence**, not an auto-grant ladder. Test against actual source costs and flexible partial progress; prioritize a fun, repeated extraction decision over schedule-driven reward delivery.
