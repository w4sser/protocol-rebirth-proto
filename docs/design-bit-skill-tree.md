# BIT Talent Tree — design (v1.94, NOT built)

Status: proposal. Nothing here is implemented yet. Owner feedback (24 Oct): BIT skills should feel like a
World of Warcraft talent tree where you commit to a real branch, and BIT deserves its own screen.

## Locked direction this must respect
- PvE only, the bunker is home. No PvP stats, nothing that targets other players.
- BIT does **one active task at a time** (scavenge OR expedition OR a raid buff). Talents change *how well*
  BIT does a task, never let it run two at once.
- No pocket lint, no new currency. Talent points come from **Bond levels** only; respec costs Scrap.
- Death loses carried items; talents are never lost on death (they live on BIT, at home).

## Points
- 1 point per Bond level from Bond 2 (Bond 1 = BIT online, 0 points). Bond cap 20 gives 19 points.
- A full branch is 15 points, so you can finish one branch and dip into a second, never max everything.
- Row gates: row N needs 3·(N−1) points spent **in that branch** (WoW classic rule).
- Respec: free once, then 200 Scrap × number of respecs (cap 1000). Done at the BIT Bay.

## Branches
Each branch has 5 rows. Rows 1–2 are small passives, row 3 has a **choice node** (pick 1 of 2),
row 4 passives, row 5 a **capstone** that changes how BIT plays.

### SCOUT — information and finding the right loot
| Row | Node | Ranks | Effect |
|---|---|---|---|
| 1 | Keen Sensors | 3 | Tracked part drop chance +5/10/15% in the marked zone |
| 2 | **Zone Scout** (existing skill) | 1 | Marks best zone/route for tracked part |
| 2 | Long Ping | 2 | Map reveals loot rooms in a 1/2 room radius on deploy |
| 3 | Choice: *Pathfinder* (route arrow to exit, −10% extraction time) **or** *Appraiser* (rare+ loot glows) | 1 | |
| 4 | Memory Banks | 3 | Areas cleared before reveal containers on entry (1/2/3 per raid) |
| 5 | **Capstone: Recon Drone** | 1 | Once per raid, BIT scouts the next room: shows enemies and best container |

### GUARDIAN — keeping you alive in raids
| Row | Node | Ranks | Effect |
|---|---|---|---|
| 1 | Plating | 3 | +5/10/15 max shield at deploy |
| 2 | **Shield Burst** (existing skill) | 1 | +15 shield pulse once per raid |
| 2 | Warning Chirp | 2 | Telegraphs elite attacks 0.3/0.6 s earlier |
| 3 | Choice: *Second Wind* (first lethal hit leaves you at 1 HP, once per raid) **or** *Overcharge* (Shield Burst also stuns nearby for 1.5 s) | 1 | |
| 4 | Field Medic | 3 | Medkits heal +10/20/30% |
| 5 | **Capstone: Safe Return** | 1 | On death BIT saves **one** carried item of your choice (picked before deploy). Respects "death loses carried items" — it is one pre-chosen item, not insurance spam. |

### SCAVENGER — the home economy
| Row | Node | Ranks | Effect |
|---|---|---|---|
| 1 | Deep Pockets | 3 | Scavenge haul +1/2/3 basic parts |
| 2 | **Loot Priority** (existing skill) | 1 | Scavenge leans toward tracked part (~60%) |
| 2 | Quick Legs | 2 | Scavenge run −10/20% time |
| 3 | Choice: *Salvager* (recycling yields +20%) **or** *Haggler* (Trader prices −15%) | 1 | |
| 4 | Night Shift | 3 | Offline cap +1/2/3 h for scavenge and generator |
| 5 | **Capstone: Lucky Find** | 1 | 1 in 4 hauls includes a rare part from the tracked chain |

## How the existing skills map in
Today BIT has three mutually exclusive skills (one active at a time): Zone Scout, Shield Burst, Loot Priority.
- Each becomes the **row-2 core node** of its branch (Scout / Guardian / Scavenger).
- Migration: on first open, refund all points by Bond level and auto-place 1 point into the core node of the
  skill that was active, so nobody loses what they had.
- "One active at a time" moves from skills to **tasks**: talents are passive and always on; BIT still runs
  one task (scavenge / expedition / raid companion) at a time.

## Screen (fullscreen, like the weapon bench)
Nav: BIT button opens the BIT screen; top tabs: **TALENTS · TASKS · QUESTS · TRADER**.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ◄  BIT · Bond LV 7  ███████░░ 420/600 xp      POINTS 2 available   [RESET] │
│ [TALENTS] [TASKS] [QUESTS] [TRADER]                                        │
├───────────────┬───────────────┬───────────────┬────────────────────────────┤
│   SCOUT  5    │  GUARDIAN 0   │ SCAVENGER 1   │  ◉ Zone Scout        1/1   │
│  (o)(o)(o)    │  ( )( )( )    │  (o)( )( )    │  Marks the best zone and   │
│     │         │     │         │     │         │  route for your tracked    │
│  [ZS]  (o)    │  [SB]  ( )    │  [LP]  ( )    │  part, and what drops.     │
│     │         │     │         │               │                            │
│  <A> or <B>   │  <A> or <B>   │  <A> or <B>   │  Next rank: —              │
│  ( )( )( )    │  ( )( )( )    │  ( )( )( )    │                            │
│     ★         │     ★         │     ★         │  [ LEARN · 1 point ]       │
└───────────────┴───────────────┴───────────────┴────────────────────────────┘
 (o) learned  ( ) available/locked  [XX] core node  <A>/<B> choice row  ★ capstone
```
- Columns light up by branch colour; locked rows are dim with "Spend 6 in Scout" text.
- Tap a node → right panel details + LEARN. Portrait at 844 px: same three columns, detail panel becomes a
  bottom sheet.
- BIT nav badge shows **POINTS** only when unspent points exist (actionable, with a tap-explain).

## Open questions
- Bond cap (20?) and xp curve after Bond 10.
- Whether Safe Return is too strong vs. the death rule; fallback: saves one *material*, not gear.
- Art: node icons reuse ui-icons.svg; branch headers need three small BIT poses.
