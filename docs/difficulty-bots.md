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

## 5. Measured baseline (headless sim)
`tools/difficulty-bots/sim.mjs` + `tools/difficulty-bots/tune.mjs` (§4), neutral knobs (`hp=1,dmg=1,count=0,aggro=1`,
i.e. `nodspel/difficulty.js`'s `applyDifficulty` is a no-op), bunker area, **n=50 seeds per tier**, 2026-11-03.
Numbers below are the real `tune.mjs` output, not estimates. A depth's survival/extract is conditioned on
reaching it (§4's own definition): e.g. L2 survival is "of the raids that got past L1 alive, what fraction
did not die while still on L2" (dying one level deeper still counts as surviving L2).

### FTUE raids (attempt ramp; raid 3 is the shipped lethal-clamp guarantee)
| tier | raid | survival | extract | median time-to-extract | mean damage taken | mean TTK |
|---|---|---|---|---|---|---|
| strong | 1 | 100% | 100% | 5.8s | 0.2% | 0.5s |
| strong | 2 | 100% | 100% | 5.9s | 0% | 0.5s |
| strong | 3 | 100% | 100% | 5.4s | 0% | 0.3s |
| avg | 1 | 100% | 100% | 6.3s | 0% | 0.7s |
| avg | 2 | 100% | 100% | 6.3s | 0.1% | 0.8s |
| avg | 3 | 100% | 100% | 5.7s | 0.1% | 0.6s |
| weak | 1 | 100% | 100% | 6.7s | 0% | 1.0s |
| weak | 2 | 100% | 100% | 6.7s | 0% | 1.0s |
| weak | 3 | 100% | 100% | 6.3s | 0% | 0.8s |

Every tier clears every FTUE raid every time, with near-zero damage. That is not the tiers converging
(aim error/reaction barely matter here) -- it is `firstGraceMs:5000` (`nodspel/levels.js` level 1): the FTUE
room's two grunts are dead well inside level 1's 5 s combat grace window, so they never get a shot off.
**Sanity check against the real browser bot's §1 numbers** (`tools/difficulty-bots/run.mjs` + `ftue-bot.mjs`,
5 runs on live v2.22.4): that bot's median time-to-extract was 46.5s with first kill at a 29.0s median, which
§1 already attributes to "the bot's navigation, not combat: it has perfect aim and walks to enemies." The
headless strong tier has the same perfect aim but none of the touch-stick fumbling that dominated the
browser bot's time, which is exactly why 5.8s vs 46.5s is the expected gap, not a discrepancy -- both bots
are aim-perfect; only navigation cost differs.

### Normal raids by depth (one raid per seed, pushed from level 1 through level 3)
| tier | depth | n reached | survival | extract | mean damage taken | mean TTK |
|---|---|---|---|---|---|---|
| strong | L1 | 50 | 100% | 0% | 98.0% | 5.0s |
| strong | L2 | 50 | 4% | 0% | 98.0% | 5.0s |
| strong | L3 | 0 | - | - | - | - |
| avg | L1 | 50 | 100% | 0% | 97.6% | 4.2s |
| avg | L2 | 50 | 6% | 0% | 97.6% | 4.2s |
| avg | L3 | 2 | 100% | 0% | 90.0% | 4.4s |
| weak | L1 | 50 | 100% | 0% | 94.0% | 4.0s |
| weak | L2 | 50 | 6% | 0% | 94.0% | 4.0s |
| weak | L3 | 0 | - | - | - | - |

Extract is 0% everywhere because the bot's policy (§4.2) never calls the voluntary extract action -- it
always pushes toward the next level, so for a normal raid "extracted" only happens by fully clearing level
3 (`reason:'complete'`), and across 150 raids (3 tiers x 50 seeds) that happened twice (both `avg`). Every
tier survives L1 (its own damage still averages 94-98% of max HP -- raids that live are not living
comfortably), then L2's extra bodies (`AREA_RULES.bunker.extraEnemies`, a shorter 3 s combat grace instead
of L1's 5 s, and a partition room) are close to a hard wall: 4-6% survival with almost no separation between
tiers. That near-identical L2 number across strong/avg/weak is itself a finding, not noise: at `n=50` the
skill knobs this PR models (aim error, reaction delay, kiting, Dash) barely move survival once a room's
total incoming ranged DPS exceeds what standing in the open and shooting back can out-race, because none of
them reduce incoming fire (no cover-seeking, no telegraph-dodging -- see §7). This is the real, current,
untuned baseline the DDA system (§3) and the baseline retune (§4.4(a)) are meant to fix; it is deliberately
reported as-is rather than adjusted to look closer to the §2 targets.

## 6. Known sim gaps
Differences from the live game (`nodspel/game.mjs`), in order of how much they matter to the numbers above:
- **No cover-seeking or telegraph-dodging.** Every attack is telegraphed >=600ms before it lands
  (`RULES.shooting.telegraphs`) and real players are expected to sidestep during the windup or duck behind
  a crate. The bot does neither -- "kite" only backs off when a target is already closer than ~45% of
  weapon range, and otherwise strafes in place. This is almost certainly the single biggest reason L2+
  survival is so flat across tiers (see §5): it is the one real mitigation this bot does not model at all.
- **No BIT passive healing, no tool use, no gear/weapon pickups.** The bot never equips a found weapon or
  armor, never throws a grenade/EMP/decoy, and never stands near BIT to regen. All of these only make a
  real run *more* survivable, so the sim's damage-taken numbers are a conservative (pessimistic) estimate.
- **Mid-raid perk offers are not simulated.** In the shipped build, `updateClears()` -- the function that
  populates the room-clear perk queue -- is only called from a `debugRoomClearsEnabled` branch of the frame
  loop, so live play does not currently get mid-raid perk cards either; the sim matches that. Perks are
  still auto-picked once per level exit (`round.js`'s own `autoPickPerks` inside `enterExit`/`extractRound`),
  same as the real game.
- **No hitstop.** Real play briefly freezes the game clock on a hit/kill for impact feel
  (`perks.js` `hitstop`); the sim never calls it, so combat resolves a little faster in sim-seconds than it
  would on screen. Negligible next to the points above.
- **Bunker area only, no Hard mode, no archipelago/town variants, no "big levels."** `setArea('bunker')` /
  `setHard(false)` are fixed; FTUE and most new-player raids are bunker anyway.
- **Approximate navigation.** The bot walks a grid-BFS route (the same technique
  `nodspel/tests/playthrough.test.mjs` uses to prove a route exists) to the next node/medkit/exit, or
  straight at a visible target, with a perpendicular side-step to break a stall -- not true pathfinding
  around other moving bodies. It does not go out of its way for optional loot (e.g. a locked closet's
  keycard); that loot has no effect on survival/extract.
- **Target selection has a deliberate 3-reevaluation hysteresis** (~1s) to stop it thrashing between two
  near-tied targets at a visibility boundary (a flicker the sim hit against a node pedestal's edge during
  development); a human player would not perceive that flicker and would just keep shooting.

## 7. Decisions (Robert, 2026-11-03)
1. **Loot scales with difficulty above neutral.** Loot quantity/rarity bonus proportional to DDA difficulty above neutral, up to **+20% at max bound**. No reduction below neutral (weak players are not punished).
2. **Softer return after a lapse.** If >3 days since last raid, nudge the skill estimate toward easier (s := min(s, s*0.5 - 0.2)) and use double step size for the next 2 raids (faster convergence).
3. Targets in §2 approved as written.
4. Build both: headless sim bots (3 tiers) + tuner, then the DDA system, then tune the baseline. Small PRs.

## 8. v2.23.0 results: extract policy, baseline retune, DDA, convergence (2026-11-03)
Every number here is copied from tool output: `tools/difficulty-bots/baseline.mjs` (n=50 seeds per tier, neutral knobs,
raw JSON in `baseline-before.json` / `baseline-after.json`) and `converge.mjs --seeds 20 --raids 10 --depth 2`
(`convergence-L2.txt`). The sim bot now extracts voluntarily (a depth-N raid plays levels 1..N, then extracts), so extract% is meaningful.

### Baseline BEFORE retune (n=50)
| tier | raid/depth | n reached | survival | extract | median TTE (s) | mean damage |
|---|---|---|---|---|---|---|
| strong | L1 | 50 | 100% | 100% | 6.1 | 0% |
| strong | L2 | 50 | 14% | 0% | - | 88.2% |
| strong | L3 | 1 | 0% | 0% | - | 100% |
| strong | FTUE1 | 50 | 100% | 100% | 6 | 0% |
| strong | FTUE2 | 50 | 100% | 100% | 5.8 | 0% |
| strong | FTUE3 | 50 | 100% | 100% | 5.6 | 0% |
| avg | L1 | 50 | 100% | 100% | 5.9 | 0.2% |
| avg | L2 | 50 | 10% | 0% | - | 92.2% |
| avg | L3 | 0 | -% | -% | - | -% |
| avg | FTUE1 | 50 | 100% | 100% | 6.6 | 0% |
| avg | FTUE2 | 50 | 100% | 100% | 6.6 | 0% |
| avg | FTUE3 | 50 | 100% | 100% | 6.1 | 0% |
| weak | L1 | 50 | 100% | 100% | 5.7 | 0% |
| weak | L2 | 50 | 4% | 0% | - | 96% |
| weak | L3 | 0 | -% | -% | - | -% |
| weak | FTUE1 | 50 | 100% | 100% | 6.7 | 0% |
| weak | FTUE2 | 50 | 100% | 100% | 6.7 | 0% |
| weak | FTUE3 | 50 | 100% | 100% | 6.3 | 0% |

### Baseline AFTER retune (n=50)
| tier | raid/depth | n reached | survival | extract | median TTE (s) | mean damage |
|---|---|---|---|---|---|---|
| strong | L1 | 50 | 100% | 100% | 6.1 | 0% |
| strong | L2 | 50 | 18% | 0% | - | 86.3% |
| strong | L3 | 0 | -% | -% | - | -% |
| strong | FTUE1 | 50 | 100% | 100% | 6 | 0% |
| strong | FTUE2 | 50 | 100% | 100% | 5.8 | 0% |
| strong | FTUE3 | 50 | 100% | 100% | 5.6 | 0% |
| avg | L1 | 50 | 100% | 100% | 5.9 | 0.2% |
| avg | L2 | 50 | 18% | 2% | 135.4 | 91.5% |
| avg | L3 | 2 | 100% | 50% | 75.6 | 63% |
| avg | FTUE1 | 50 | 100% | 100% | 6.6 | 0% |
| avg | FTUE2 | 50 | 100% | 100% | 6.6 | 0% |
| avg | FTUE3 | 50 | 100% | 100% | 6.1 | 0% |
| weak | L1 | 50 | 100% | 100% | 5.7 | 0% |
| weak | L2 | 50 | 4% | 0% | - | 96% |
| weak | L3 | 0 | -% | -% | - | -% |
| weak | FTUE1 | 50 | 100% | 100% | 6.7 | 0% |
| weak | FTUE2 | 50 | 100% | 100% | 6.7 | 0% |
| weak | FTUE3 | 50 | 100% | 100% | 6.3 | 0% |

### Tuning changes (data only)
| field | old | new |
|---|---|---|
| L2 enemyCooldownMs | 1400 (RULES.combat default) | 1700 |
| L2 enemyDamage | 22 (RULES.combat default) | 14 |
| L3 enemyCooldownMs | 1350 | 1500 |
| L3 enemyDamage | 22 (RULES.combat default) | 16 |
| guard burstShots | 3 | 2 |
| guard recoveryMs | 1600 | 2200 |
| guard damagePct | 0.10 | 0.07 |

**Targets not met.** FTUE and L1 meet/exceed targets for every tier. L2 is still a wall for the sim bot (avg 18% survival /
2% extract vs the 70/60 target); L3 is barely reached (avg n=2). The retune moved L2 survival strong 14->18%, avg 10->18%,
weak 4->4%. The remaining gap is most likely the sim bot itself (§6: no cover, no dodging), so this
PR does not retune further against it. Retuning harder to hit 70% on L2 would probably make the game far too easy for real players.

### DDA (nodspel/dda.js)
Implemented per §3/§7: EMA α=0.3 over the last 5 raids, one bounded step per raid, needs 2 same-direction signals,
drifts to neutral after 3 in-band raids, a death eases the next raid by up to one step, off during FTUE/intro, no UI. Applied only
at raid generation (game.mjs reset() via applyDifficulty). Loot multiplier stays within 1.0-1.2. Lapse >3 days -> one step
easier. Storage: `localStorage pr_dda_v1`, falls back to defaults on corrupt data. New knob `cadence` (enemy cooldown multiplier,
bounds 0.9-1.15) and `aggro` is now wired into detection/sight range.

### Convergence (depth L2, 20 simulated players x 10 raids, rolling-5 extract%)
| tier | raid 1 | raid 6 | raid 10 | in 65-75% by raid 6 |
|---|---|---|---|---|
| strong | 0% | 0% | 1% | no |
| avg | 5% | 4% | 2% | no |
| weak | 0% | 1% | 1% | no |

Knob clipping (share of raids where the knob was pinned at a bound): cadence 76.5-80%, aggro 46.5-50%, hp 16.5-20%,
dmg 0%, count 0%. **DDA does not converge on L2 for the sim bot.** It moves to its easy bounds, which is the right direction,
but even all of §3's easiest bounds can't close a gap from about 2% to 70%. It is unclear why dmg never clips (it has the
widest easy range, 0.8); the step ordering in dda.js should be checked next. Follow-ups: give the sim bot cover/dodging (§6), then re-measure and decide
whether L2 needs a deeper data retune or wider DDA bounds.

## 8. Sim-bot fix and re-measure (2026-11-03, NOT shipped)
Why L2 extract was 1-2% for every tier: three bugs in the sim bot, not in the game.
1. `sim.mjs` never moved the player to `round.level.start` after a level exit (`game.mjs` `loadLevelInner` does). The bot stayed at L1's exit coordinates inside L2's geometry and froze. Raids timed out or died with no progress.
2. Front-shield guards block every head-on hit (`encounters.js` `shieldBlocks`), and the bot never flanked. It ended in a stalemate or slow death. Fix: route to a cell in range, with line of sight, outside the shield cone. Per-tier `flankAfterMs` is 0 for strong, 1.5 s for avg and 5 s for weak.
3. The BFS cap (8000 cells) was too small for two-room levels, so routing silently failed. Raised to 40000.

Fixed bot, n=50, neutral knobs, extract% / mean damage%:
| tier | L2 pre-retune | L2 retune | L3 pre-retune | L3 retune |
|---|---|---|---|---|
| strong | 100 / 4.4 | 100 / 3.0 | 95.9 / 20.1 | 95.9 / 16.4 |
| avg | 100 / 8.5 | 100 / 4.1 | 96 / 29 | 96 / 21.8 |
| weak | 90 / 86.3 | 100 / 44.8 | 82.1 / 91.8 | 89.8 / 71 |

The pre-retune game is already easier than the §2 targets for this bot, so the v2.23.0 levels.js easing (L2/L3 damage and cooldown, guard burst) is reverted.
Even at the hardest DDA bounds (hp 1.2, dmg 1.15, count +1, aggro 1.15, cadence 0.9), avg L2 reaches 90% extract (n=20). The doc bounds cannot pull avg or strong into 65-75%. Convergence (n=20, 10 raids) is in `convergence-L*-fixedbot.json`.
Also, sim time-to-extract (L2 ~22-31 s) is far below the targets (3-5 min). The bot is likely still much better or faster than humans, so it needs calibrating against real play before tuning on it.

## 9. v2.25.0: harder depths 2-3 and wider DDA hard bounds (2026-11-03)
Why: Robert plays depths 2-3 and finds them TOO EASY. With the fixed sim bots, strong and avg extracted 94-100% and weak 71-90% on L1-L3. The DDA sat at its hardest bounds, and avg still extracted 90% on L2.

**Baseline (nodspel/levels.js).** A new per-depth `dmgMul` (L2 1.15, L3 1.2) multiplies the area dmgMul. It scales the encounter `damagePct` hits and the fallback damage. The cap `maxHitFraction` still applies, and it multiplies with archipelago/town/hard, so deeper areas scale too. L2/L3 `enemyCooldownMs` is now 1260/1200. Finding: the old per-level `enemyDamage` / `enemyCooldownMs` fields only reach fallback enemies. Bunker raids are almost all encounter-typed, so a baseline retune through those fields was a no-op. That is why the v2.23.0 retune measured nothing.

**DDA (nodspel/difficulty.js KNOB_BOUNDS, nodspel/dda.js).**
| knob | old bounds | new bounds |
|---|---|---|
| hp | 0.85-1.20 | 0.85-1.80 (harder step 0.10) |
| dmg | 0.80-1.15 | 0.80-1.30 |
| count | -1..+1 | -1..+2 |
| aggro | 0.85-1.15 | 0.85-1.30 |
| cadence | 0.90-1.15 | 0.85-1.15 |
- The easy side is unchanged.
- Stepping harder now spends count, then hp, aggro, cadence and dmg last. The sims showed cadence, aggro and dmg barely move strong/avg bots, while dmg mostly punishes weak ones. Easing keeps the cheapest-first order.
- An extra enemy is only added when s ≥ 0.35 and extract EMA ≥ 85%.
- The L2/L3 DDA extract target is 0.75 (was 0.70). The bots are faster than humans, so the time and TTK terms push them a bit harder.
- Lapse rule (>3 days, softer return) is unchanged.
- **Loot fix:** `lootMultiplier` used to give the bonus for a *negative* skill estimate, which is the opposite of §7.1. It now scales with how far the knobs sit on the harder side of neutral: +20% when every knob is at its hard bound, and never below 1.0.

**Baseline, neutral knobs, n=50, L2 extract% / mean damage% (`baseline-v2250-harder.json`):**
| tier | L2 before | L2 after | L3 before | L3 after |
|---|---|---|---|---|
| strong | 100 / 4.4 | 100 / 5.0 | 95.9 / 20.1 | 95.9 / 25.7 |
| avg | 100 / 8.5 | 100 / 10.0 | 96 / 29 | 96 / 33 |
| weak | 90 / 86.3 | 50 / 93.9 | 82.1 / 91.8 | 75 (n=12) / 90.5 |

**Convergence with DDA, L2, 20 players x 15 raids, rolling-5 extract% (`convergence-L2-v2250.txt`):**
| tier | raid 1 | raid 6 | raid 10 | raid 15 | before (v2.23 bounds, raid 10) | knob clip% |
|---|---|---|---|---|---|---|
| strong | 100 | 94 | 83 | 93 | 100 | count 79, hp 17, others ≤1 |
| avg | 100 | 84 | 67 | 71 | 99 | count 73, cadence 29, aggro 10 |
| weak | 50 | 51 | 61 | 72 | 85 | cadence 70, aggro 45, hp 26, count 22 |
Clip% counts either bound. Cadence and aggro stop mattering once they are pinned, so DDA no longer stalls at its limits. The remaining work is done by count and hp, which sit at or within their new bounds. Strong ends in its 85-90% band (83-93), avg is at the low edge of 70-80 (67-71), and weak recovers through the easy side to 61-72. This leans slightly easier than the brief, which was asked for because the bots are much faster than humans (L2 time-to-extract 22-31 s vs a 3-5 min target).

**Convergence with DDA, L3, 20 players x 15 raids, rolling-5 extract% (`convergence-L3-v2250.txt`):**
| tier | raid 1 | raid 6 | raid 10 | raid 15 |
|---|---|---|---|---|
| strong | 100 | 91 | 80 | 86 |
| avg | 90 | 81 | 61 | 63 |
| weak | 50 | 47 | 53 | 68 |
L3 lands harder than L2: strong sits in its band by raid 15, avg ends below the 70-80 target (61-63), and weak recovers through the easy side to 68.
