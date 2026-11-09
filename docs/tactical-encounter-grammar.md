# Protocol Rebirth — Tactical Encounter Grammar

> **Status:** M15 detailed **design proposal**, 7 November 2026. User asked to continue designing a reusable tactical system before implementing Issue #205. No gameplay code changed, no numeric balance or implementation authorized by this file.

## 1. Design goal

Make a normal eight-minute mobile extraction raid more fun by letting players **read, influence and exploit** a situation, rather than just kill one more enemy. Every environment uses the **same six interaction verbs**. Each special room combines at most two primary verbs, one readable enemy role, one optional reward, and an ordinary combat fallback.

**Encounter equation:** `Room = Threat + Readable Mechanism + 2+ Actions + Cost/Risk + Optional Payoff + Exit Choice`.

The player should say **"I understood how that worked, and I used it"**, not "I guessed which switch the designer wanted."

### Guardrails

- Keep D2 intact: **return extraction usable from raid start**, while forward-depth nodes can remain required to go deeper. Personal objectives, special-room puzzles and loot never gate return extraction.
- Keep D1 intact: risked loot and deployed valuable gear are lost on failed extraction; free Basic Carbine always enables a retry. No permanent paid-only counter.
- Existing mobile controls first: move, aim/fire, and existing touch interaction, movement abilities and optional equipment. No "hacking minigame" or extra button cluster.
- Most special rooms should resolve in **20–60 seconds**, and short runs can ignore them. A special room is **not mandatory every raid**.
- BIT helps the player notice relationships but does not solve the room automatically. Readable clues must work without audio.
- Avoid unique code per room; keep one common interaction behavior reused with different props, enemy combinations, and cover arrangements.

## 2. Six reusable tactical mechanics

| ID | Verb | Player-readable opportunity | At least two responses | Mechanical payoff | First reuse candidates |
| --- | --- | --- | --- | --- | --- |
| **T1** | **CUT POWER** | Bright powered cable / generator / shield feed | Shoot exposed relay; reach switch; fight through powered defense | Shield drops, turret slows, alarm or hazard powers down temporarily | Shield turret, defense door, electrified pool |
| **T2** | **DIVERT ATTENTION** | Patrol path, scanner cone, exposed noise source | Wait for patrol gap; throw decoy / hit noise prop; fight it | Change enemy facing/path or postpone alarm | Scout, patrol grunt, rusher ambush |
| **T3** | **FLANK / BREAK SIGHT** | Directional armor, lit rear weakpoint, cover lanes | Circle cover to weak side; reposition to block line-of-fire; use existing tool | Vulnerable attack angle, evasion, temporary defense bypass | Shield turret, tank, sniper |
| **T4** | **TRIGGER ENVIRONMENT** | Large, clear hazard and warning cycle | Activate hazard on enemy; bypass its range/timing; deliberately fight normally | Temporary stun, damage, cleared lane or area denial | Artillery, rusher, swarm pack |
| **T5** | **DISRUPT SUPPORT** | Obvious repair beam / control signal / signal tower | Target support unit first; break link; isolate main enemy then fight | Healing, reinforcement or coordination stops | Repair bot, scout, turret group |
| **T6** | **TRADE ACCESS FOR RISK** | Optional locked cache/route with readable threat | Take exposed fast route; investigate safe alternate route; ignore/extract | More valuable or targeted loot for chosen time/risk; never guaranteed free extraction | Rare cache, relay station, power vault |

**Note:** T6 is an **encounter outcome/decision**, not a new button. T1–T5 are reusable systemic verbs. T1 and T3 are strongest first-slice candidates because the shield turret already presents a frontal defense and weak rear; adding a visible relay can extend an existing readable encounter. T2/T4/T5 require feasibility checks against current AI, physics, area hazards, and mobile performance.

## 3. Enemy roles and mechanic combinations

Current character/behavior roles in the prototype are design anchors, not proof every interaction already exists. Avoid claiming these combinations are implemented.

| Enemy role | Natural pressure | Core counterplay | Optional tactical combination |
| --- | --- | --- | --- |
| Basic grunt / patrol | Movement, cover, attrition | Aim, reposition, prioritize | T2 lure, T4 hazard |
| Rusher | Closes distance and punishes static play | Sidestep / force into chokepoint | T4 timed machinery, T3 break line |
| Shield turret | Directional frontal defense | T3 flank rear weakpoint | T1 disable shield feed; optional EMP |
| Tank | Heavy directional threat | Use cover and attack weak side | T3 flank + T1 disable associated power |
| Scout flying drone | Spots and escalates pressure | Spot it, avoid its scan, shoot it | T2 distract or T5 interrupt alert |
| Swarmers | Overwhelm open positions | Funnel, reposition, controlled fire | T4 hazard or cover chokepoint |
| Repair bot | Extends enemy survival | T5 prioritize support | T1 sever visible repair power link |
| Artillery | Forces relocation | Read telegraph and move out of strike | T3 break sight + T4 use danger zone |
| Sniper | Denies long sightlines | T3 cover reposition | T2 distraction and flanking |

**Readability rule:** Every new counter should use a *consistent visual language*: cyan powered line / amber interactable relay / coral imminent threat, while respecting existing shield blue and art direction. Color is never the sole information channel; use shape, motion, orientation and particle/sound cues sparingly.

## 4. Room construction grammar

### Data authoring structure (conceptual, not approved code schema)

```text
EncounterTemplate {
  biome: bunker | forest | town
  baseThreat: enemyRole[]
  tacticalVerb: T1..T5
  optionalVerb?: T1..T5
  roomGeometry: coverAnchors + path / flank lane
  affordances: visiblePowerLink? | patrolLine? | supportBeam? | hazard?
  rewardChoice: T6? // optional and extractable
  returnExit: governed by raid topology, NEVER locked by room
  constraints: readability, touch, low-end FPS, no softlock
}
```

Use **one primary verb** at first; a second only after players understand the first. A room with a power relay, alarm, moving lasers, multiple locked doors and a timed platform is four new tutorial concepts, not an elegant tactical challenge.

### Bunker example — Shielded Relay Room (Issue #205)

- **Threat:** shielded turret rotates toward player, protecting a cache.
- **Environmental clue:** bright cable from an amber industrial relay to the turret.
- **Solution 1:** flank around cover, shoot rear vulnerable area (T3).
- **Solution 2:** disable relay with shots / existing interaction, then attack (T1).
- **Solution 3:** if supported, spend a found/earned EMP to open a temporary window.
- **Risk:** front attack consumes ammo/health and may be faster for skilled players. Room is optional if the player can instead return with secured supplies.
- **Reward:** optional target material/rare cache determined by authored loot rules; don't guarantee a specific story key merely for using the "intended" solution.
- **Fail-safe:** power returns after a readable delay or turret remains destroyable; Basic Carbine works, relay cannot become permanently inaccessible, and an empty EMP slot is not a softlock.

### Forest example — Scout Crossing

- **Threat:** aerial scout scans across a narrow clearing near a useful supply container.
- **Mechanics:** T2 (wait, use decoy/noise, or quickly disable scout), T3 (break line of sight using trees/rocks); optional T6 for cache.
- **Readability:** visible scan sweep and concealment zones, not invisible stealth stats. Failure means a fight or some reinforcement pressure, never an unfair instant loss.
- **Risk:** playing slowly costs time; fighting costs health/ammo and risks drawing more bots; return exit remains available.
- **Biome art:** island granite, irregular shoreline, sparse pine cover and summer-night lighting; do not add stealth grass requiring high-cost foliage shaders.

### Town example — Alarmed Workshop

- **Threat:** repair unit supporting a turret near a valuable tool cabinet; alarm camera watches one access lane.
- **Mechanics:** T5 (take out repair support) + optional T2 (time or disable camera); T6 (risky cache).
- **Readability:** repair beam is obvious; disable action gives immediate visible shutdown. More experienced players can combine techniques.
- **Variant:** if T2 not yet supported by runtime, use T5 alone and clear cover angle. Do not ship unsupported imaginary AI.

## 5. Encounter progression: skill grows, not button count

| Player stage | What changes | Tactical verbs introduced | Design target |
| --- | --- | --- | --- |
| Intro/FTUE | Immediate shooting to bunker; Core L1 restored and BIT met inside | **No required puzzle** | Preserve approved D3.9 authored opening |
| First ordinary raids | Simple enemies, one readable weakpoint and optional relay | T3, then T1 | Discover one smart counter without a mandatory tutorial |
| Early progression (Fabricator / BIT Bay / Vault) | Two simple threat roles together, gadgets useful but not mandatory | T2 or T5 introduced individually | Player recognizes prior rules in new contexts |
| Deeper raids / next biome | Timing hazards or support and escalating combinations | T4 + earlier learned verbs | Recombine known systems under pressure |
| Mastery / special encounters | One or two verbs at once, multiple optional valuables | Any learned subset | Deliberate solutions and genuinely meaningful loadout choices |

No purchased-only puzzle key. Paid resource acceleration may expand prepared tool access under M4/M5, but no player should require purchased gear to understand or solve a required situation.

## 6. Encounter mix and replayability

**Illustrative initial mix (not final spawn table):** per standard committed raid, 2–4 ordinary combat pulses, 0–1 tactical special room and 1–2 optional loot opportunities; deeper path raises **combinations and exposure**, not just raw health. Before a special-room prototype is proven fun, avoid guaranteeing one every raid. Repeatable encounter content should change (a) enemy/cover positioning, (b) optional mechanic present, (c) loot opportunity, or (d) approach angle, while preserving **the same learned mechanic rules**.

### Avoid systemic failure modes

- **One dominant solution:** test if every player shoots the same relay instantly; change *trade-off* or positional availability, not its legibility or health arbitrarily.
- **Fake choice:** if stealth takes 50 seconds but combat 5 seconds with no meaningful cost, T2 is not viable.
- **Invisible hazard:** if an effect cannot be seen from the default mobile camera, remove or resize it.
- **Unfair price:** if every option consumes more scarce materials than the reward is worth, players avoid special rooms.
- **Decision clutter:** simplify the primary objective and HUD before adding more icons or BIT narration.
- **Overhead:** don't create a slow walking/stealth requirement across an entire eight-minute run.

## 7. How mechanics strengthen home / identity

- Secure useful material and use it for **major or low-cost visual bunker restoration**; always bank materials only after successful extraction.
- Operator clothing, BIT shells and profile nameplates persist outside D1's losable gear risk.
- Optional **earned achievement titles/nameplates** reflect genuine encounter mastery (e.g. power-disabling a turret without an EMP), not simply paying Signals.
- BIT can recognize a clever action with short context-aware dialogue. **No new Bond meter or mastery wallet** required.
- Store products can be cosmetic themes spanning operator/room/BIT/nameplate, but the in-raid mechanic must never be a sales funnel.
- The gameplay reason to return: *I learned how to tackle that system, and now I want to use it on a tougher variant while earning parts for my home.*

## 8. Fastest validation plan

**Phase 0: design review** (this file). No code changes.

**Phase 1: Issue #205** Shielded Relay Room vertical slice:
- Reuse shield turret, cover and existing EMP.
- Add only one visible relay / power link interaction if technically feasible.
- Verify T3 direct flank, T1 sabotage and optional EMP are individually viable on phone.
- Compare matched combat-only room vs special room. Track understanding, completion time, fun, failure, use of each solution, and FPS.

**Phase 2: second systemic room** ONLY if Phase 1 increases enjoyment. Pick forest Scout Crossing **or** town Support Workshop (avoid two at once). Build it from T2 or T5 and the same authoring grammar, then test whether learned rules transfer.

**Phase 3: economy + metagame**. Validate useful loot and first-week home restoration actually motivate replay; measure return rate without requiring a purchase.

### Suggested success gates (not fixed approvals)

1. At least 4/5 uncoached playtesters can explain the special room's threat and identify a viable response from the live camera.
2. At least **two different approaches are actually used successfully** across test participants; if not, simplify or rebalance the alternatives.
3. Players describe the room as more interesting than a matched combat-only room without substantially harming short-raid flow.
4. No softlocks and no forced gate to the standard return extraction.
5. Low-quality mobile performance remains within the project's target after instrumentation.

## 9. Open owner choices

1. **How common** should tactical special rooms be once proven? Frequent signature vs occasional surprise.
2. Should an environmental tactic grant a **better reward**, or primarily save health, ammo and time? Recommendation: its primary reward is **better odds of survival / lower cost**, not magic bonus loot that makes combat style wrong.
3. Are repeatable mastery achievements best expressed as **titles/nameplates** or operator/room cosmetics? Recommendation: nameplates/titles for exceptional demonstrations of skill; room/operator looks for broader progression.

**Recommendation:** Treat **T1 Power Links**, **T3 Flanking** and **T5 Support Disruption** as the most cost-efficient starting rules. Keep **T2 Diversion** and **T4 Hazards** as subsequent experiments pending feasibility and fun validation; T6 is the player-facing risk-reward rule binding them all together.

**Design documentation only.** Do not infer current runtime already supports every proposed mechanic.
