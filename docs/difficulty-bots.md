# Headless difficulty bots + per-player adaptive difficulty (proposal)

Status: design proposal, no balance changes. Owner direction (Robert, 2026-11-03): balance is **per player** (adaptive), subtle and invisible, never weaker than FTUE guarantees. Bots tune the baseline curve, the min/max bounds and the adjustment speed. They do not set the difficulty for real players.

## 1. Measured baseline (real runs, not invented)
Prototype: `tools/difficulty-bots/run.mjs` drives `ftue-bot.mjs` (Puppeteer, swiftshader, 844x390 touch) on a fresh profile against live v2.22.4. It reads state via `__NR` (`&debug=1`).
5 runs, FTUE raid 1, 2026-11-03:

| run | firstShot | firstKill | firstExtract | left raid | attempts (deaths) |
|---|---|---|---|---|---|
| 0 | 4.9s | 33.2s | 50.7s | 54.9s | 0 |
| 1 | 4.8s | 29.0s | 46.5s | 50.6s | 0 |
| 2 | 4.6s | 35.0s | 46.7s | 50.8s | 0 |
| 3 | 3.9s | 26.8s | 32.4s | 36.9s | 0 |
| 4 | 3.9s | 25.9s | 34.3s | 38.8s | 0 |

FTUE raid 1 results: survival **5/5**, extract **5/5**, time-to-extract median **46.5s** (range 32.4–50.7). First kill median **29.0s**. Times are measured from PLAY. Time-to-first-kill is the bot's navigation, not combat: it has perfect aim and walks to enemies. That makes it the **strong** tier.
Not measured yet: damage taken, raids 2–3 and non-FTUE raids per depth. The current bot only plays the FTUE raid and does not log HP deltas. That is the next step (§4).

## 2. Targets (proposal)
| segment | survival | extract | time-to-extract | damage taken / raid |
|---|---|---|---|---|
| FTUE raid 1 | real risk, ≥70% (avg bot) | ≥70% | 30–60s | 40–80% HP |
| FTUE raid 2 (retry is easier, already shipped) | ≥85% | ≥85% | ≤60s | ≤70% |
| FTUE raid 3 | **100% guaranteed** (shipped lethal clamp) | 100% | any | n/a |
| L1 depth (post-FTUE) | 85% | 75% | 2–4 min | 30–60% |
| L2 depth | 70% | 60% | 3–5 min | 40–70% |
| L3 depth | 55% | 45% | 4–7 min | 50–80% |
Adaptive goal: every skill tier converges to about **65–75% extract** on the depth it is playing. Strong players are steered toward the upper bound, weak players toward the lower bound, and no one goes below FTUE floors.

## 3. Per-player adaptive difficulty (DDA)
**Signals** (rolling window, last 5 raids, stored in the profile and decayed with EMA α=0.3): death/extract outcome, damage taken % of max HP, time-to-kill per enemy, time-to-extract, medkits used, and clutch/near-death extracts (HP<15%).
**Skill estimate** `s ∈ [-1, +1]`: weighted z-score against the depth's target band (outcome 0.5, damage 0.25, TTK 0.15, time 0.1).
**Knobs** (multipliers on existing data, applied at raid generation and never in the middle of a fight):
| knob | source | bound (min–max) | step/raid |
|---|---|---|---|
| enemy HP | enemy health | 0.85–1.20 | ±0.05 |
| enemy damage | per-hit dmg | 0.80–1.15 | ±0.05 |
| enemy count | room spawn count | −1 … +1 per room | ±1 every 2 raids |
| aggro / alert radius | alert range | 0.85–1.15 | ±0.05 |
| fire cadence | `enemyTypes.*.cooldownMul` | 0.90–1.15 | ±0.05 |
| type mix | `variety[].mix` rusher/thrower share | ±10 pts | ±5 pts |
| hunter-wave delay | clutch/hunters | ±20% | ±5% |
**Rules:** the system makes at most one knob step per raid and spends the cheapest invisible knobs first (cadence and aggro, then HP and damage, then count). It needs 2 consecutive signals in the same direction before it moves, and it moves back toward neutral after 3 raids in band. It never applies during FTUE (raids 1–3 use `data/raid-ftue.js` as is), and never below the FTUE retry/guarantee floors. A death eases the next raid at most one step. It never visibly announces anything, and labels/UI stay unchanged. It stores `pr_dda_v1 {s, knobs, history}` and keeps it per profile slot.

## 4. Bots as tuner
1. **Headless sim bot** (next PR): drive `round.js` + `combat.stepCombat` + `physics.movePlayer` directly in Node, as `tests/playthrough.test.mjs` does with BFS routing. Thousands of raids per minute, no browser. The browser bot above stays as a smoke check against real rendering and timing.
2. **Skill tiers** as bot parameters: aim error (0°/8°/18°), reaction delay (100/300/600 ms), dash use, kiting (on/off), medkit threshold. Tiers: strong / avg / weak.
3. **Metrics** per tier × depth × seed: survival, extract, time-to-extract, damage taken, TTK.
4. **Tuner script** `tools/difficulty-bots/tune.mjs`: (a) sweeps the baseline knob grid (HP 0.8–1.2, dmg 0.8–1.2, count −1…+1, aggro 0.85–1.15) at DDA off and picks the baseline where **avg** hits the targets in §2. (b) runs 20-raid campaigns with DDA on for each tier and checks that every tier converges into the 65–75% extract band within ≤6 raids without oscillating (≤1 sign flip per 5 raids), and that knobs stay inside the bounds. (c) reports the bounds that clip. If weak still sits below the band at the min bound, either widen the bound or hand the problem to non-combat help such as gear.
5. CI: a small fixed-seed regression (e.g. 50 raids per tier) checks that the avg-tier extract rate stays within ±10 pts of the stored baseline.

## 5. Open questions
- Should DDA also scale loot? Proposal: no, because reward stays honest.
- Should a death in the window soft-reset the skill estimate faster for returning (lapsed) players?
