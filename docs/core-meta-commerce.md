# Protocol Rebirth — Core, Meta & Commerce Contract

> **Single source of truth for the connected target design.** Owner-approved direction, 7 November 2026 (M19D). Documentation only; not evidence of shipped behavior. This contract supersedes conflicting core/meta/commerce proposals. [Decision register](design-decisions.md) retains the detailed approvals and history; [game reference](game-design-reference.md) describes the inspected prototype.

## Approved experience

**Choose a bunker Project at home → make meaningful route and loot decisions in a raid → choose when to extract → bank the actual haul → visibly restore home → pursue the next ambition.**

| Rule | Approved contract |
| --- | --- |
| **Project and material hunt** | At home, select the overarching bunker Project. Resource targeting happens through meaningful **in-raid route choices and loot probabilities**, with understandable likely sources and risk/reward tradeoffs. No guaranteed requested item, auto-grant at extraction N, or home menu that reserves a material drop. Project tracking is guidance, not a loot entitlement. |
| **Major room restoration (M26)** | Major bunker rooms have **2–3 clearly visible, visual-only restoration stages within the existing TOTAL resource cost**. Allocate each original material requirement across stages so their sum equals the existing total. **No gameplay function, stats, room rewards or other mechanical utility unlock at intermediate stages**; all existing room functionality unlocks at **full completion**. No extra mandatory grind, currency or full-cost repetition. Exact stages, cost split and visual treatment remain open. |
| **Material commerce eligibility** | Resource purchases become available **only after Fabricator L1 has been earned and built through gameplay**. Core L1, first ordinary extraction, a success count, a partial Fabricator stage or ability to afford construction alone does not qualify. Before completion, show **no material purchase offers**, including repair shortcuts, supply kits, mixed bundles or a paid resource-bearing Growth Fund. Fabricator L1 cannot be bought into existence. |
| **Earlier cosmetics** | Cosmetic monetization may appear only after the established D3.9 milestone: first successful ordinary extraction **and its result summary**, with progression shown first. Before gameplay-built Fabricator L1, eligible offers are **cosmetic-only**. Free naming/customization remains optional; nothing commercial interrupts FTUE. |

The no-guaranteed-item rule concerns ordinary material hunting. Preserve D3's authored two guaranteed introductory Scrap Alloy for Core L1; do not remove that explicit FTUE exception.

## Risk, progression and ownership remain intact

- **D1:** Valuable deployed gear and exposed cargo are at risk until extraction. One Secure Slot unlocks at Vault L1; detailed eligibility/handling remains unresolved. No BIT item rescue, insurance, paid bag recovery or extra paid protection. Safe home stash and permanent progression/cosmetics persist. Always allow a viable free Basic Carbine retry.
- **D2:** At least one physical return extraction is available from the start, independently of personal-goal completion. Deliberate short cancellable extraction; five seconds is initial test tuning. Required nodes open forward depth progression; continuing never banks cargo. Deeper opportunities and a distinct final payoff remain. Scouting/world-access requirements cannot be bought away.
- **D3:** Fight home, enter the bunker to finish the authored intro, discover BIT, spend intro loot on Core L1, then pursue Fabricator. FTUE ends after the first successful **ordinary** extraction, not Fabricator construction. Genuine first-raid failure and approved contextual assistance remain.
- Bunker progression opens the world; Operator progression supports playstyle; gear supplies risky tactical choices; BIT supports the player. Keep early UI simple while preserving passive felt speed growth and bag burden. No new wallets or compulsory advancement tracks.

## Commerce structure retained

**Approved M5 families:** disclosed deterministic resource packages, milestone Growth Fund, and permanent operator/BIT/bunker cosmetic ownership. Purchases may accelerate permitted meta progression after eligibility; they cannot buy extraction, replace required exploration or create a paid-only combat solution.

**Growth Fund structure retained:** one-time explicit purchase; real earned bunker milestones; free and paid tracks; late purchase with retroactive claims of eligible earned milestones. No subscription, login chore or purchased milestone completion. Its detailed contents, price and numbers remain proposals. A paid resource-bearing Fund is offered only after gameplay-built Fabricator L1; earlier achievements can still be recorded and claimed retroactively later. A free earned milestone reward is not a material purchase offer.

**UX hypotheses after eligibility:** missing-part panels pair a truthful free source/route with an optional disclosed purchase; paid goods go to home storage; building remains explicit. Exact placements, pack catalogs, caps, prices, rewards and production entitlement verification need separate design/validation. No commerce during raids, extraction or loss screens.

## Approved deep-raid experience (M21)

**Owner-approved direction, 7 November 2026:** Deeper areas of ordinary raids combine **richer tactical encounters**, meaningful route/positioning tradeoffs and **better probabilistic opportunities** for valuable loot. Reward outcomes remain uncertain and are only secured through actual extraction. Forward nodes enable pushing deeper but never block an early return; D1/D2 risk and voluntary extraction remain intact. Varied enemy combinations, readable counterplay and optional higher-risk routes are design approaches to test, not approved encounter blueprints or drop-rate numbers. Retain simple mobile controls and avoid solving difficulty solely through HP inflation. BIT's one foregrounded home hint and optional living-world in-raid detours (M20–M20C) must fit this same normal raid loop.

## Approved tactical combat foundation (M22)

**Owner-approved direction, 7 November 2026:** The core combat's tactical depth comes first from **enemy behavior and combinations, positioning, environmental geometry and readable counterplay**. An ordinary raid must be engaging with the **free Basic Carbine**, not only after a powerful upgrade or purchase. Weapons, gadgets, builds and meta progression add *alternative solutions* and tradeoffs; they do not substitute for good encounters or create a paid win condition. Combine enemy roles to raise the decision complexity in deeper areas (M21), while preserving mobile readability, voluntary extraction and loot risk. Exact enemy role sequencing, gadget UX, encounter layouts and power curves remain to be designed/tested, not pre-approved implementation details.

## Approved enemy learning curve (M23)

**Owner-approved direction, 7 November 2026:** Establish recognizable enemy archetypes quickly in real combat, with no long tutorial/card sequence. The early combat experience gives the player enough visual information and space to learn each threat's counterplay while using the Basic Carbine. Progressively recombine known roles, terrain, cover and player positioning to make deeper raids more tactically demanding without relying on HP inflation, extra required controls or paid equipment. BIT's coaching remains contextual and unobtrusive. Encounter order, statistics, readability thresholds and mix timings are still hypotheses to validate on phones.

## Approved readable, player-chosen difficulty (M24)

**Owner-approved, 7 November 2026:** The ordinary raid's risk curve comes primarily from **chosen route, depth, encounter and extraction timing**, and the danger should be understandable through enemy telegraphs, environments and BIT's light contextual cues. Do not covertly re-scale difficulty in response to player performance to force a target win rate. Preserve tactical learning and Basic Carbine viability (M22/M23), optional deeper reward opportunities (M21), true loot risk (D1) and voluntary early extraction (D2). **D3.8 is a narrow onboarding exception:** bounded, gradually more forgiving assistance after first-normal-raid failures, still genuinely failable; never automatic survival or loot protection. Existing adaptive-difficulty code is historical baseline, not the agreed target policy. Numerical tuning and exact danger-signaling UX remain open.

## Approved world-readable risk signals (M25)

**Owner-approved, 8 November 2026:** Players infer dangerous routes and encounters mainly from **the environment, visible enemy warnings and brief contextual BIT hints**. Do not replace this with numeric risk scores, explicit universal low/medium/high ratings or complete advance information. Preserve readable mobile tells and silent-play comprehension: players should have an informed choice to investigate, avoid, push deeper or extract, but should still be surprised by the living world. An unknown threat may surprise without causing unavoidable, untelegraphed damage. This extends M24's player-chosen difficulty, M22/M23's enemy-learning foundation and BIT's non-blocking guidance. The D3.8 early-failure support remains a separate first-normal-raid exception. Exact signals, timings and balancing need mobile playtests, not a code change in this design PR.

## Approved room-stage payoff (M26)

**Owner-approved, 8 November 2026:** Every major room's 2–3 progressive repairs **visibly change the home** but do **not** grant intermediate gameplay utility. The final completed stage activates the room's full established functions and gameplay rewards. Sum of stage costs equals the **unchanged original total**, not a surcharge or separate upkeep economy. A completed stage consumes legitimately banked resources once and preserves its visible restoration, even if later raids fail. **Fabricator L1's functional reward and material-commerce eligibility occur only on full, earned completion**, and **Vault L1's one Secure Slot** is likewise not available early. Core L1's approved FTUE activation is unaffected. Older intermediate-utility proposals are superseded by M26; precise stage visuals and ingredient partitioning remain unapproved.

## Approved post-Fabricator project choice (M27)

**Owner-approved, 8 November 2026:** After **fully earning and building Fabricator L1 through play**, the player **chooses accessible Vault L1 or accessible BIT Bay L1** as the next primary Bunker Project. BIT may suggest a goal, never select or require it; show only **one actively tracked Project** at a time. If world/access prerequisites are not met, no additional unlock is implied by this choice. Vault L1 offers permanent storage improvements and, **only on full room completion**, the one approved Secure Slot. BIT Bay L1 upgrades the companion's support hardware and pays off **only after final completion**; BIT was already met and accompanies the player before Bay L1. M28 locks its first **capability family** to limited active combat support (for example a brief enemy distraction or short defensive assist); M29 selects brief distraction of one dangerous enemy as the first L1 effect; M30 requires a simple player-triggered contextual action, and M31 lets BIT select the most immediately threatening enemy after that action; M32 makes successful distractions reusable after a meaningful cooldown; M34 requires every enemy type to respond, although M33 heavy/specialist resistance may produce weaker, shorter or different effects. Exact input, enemy reaction mapping, threat-priority logic, timer/reset, UI and balance remain open. Both rooms retain 2–3 visual-only stages within the existing total material cost under M26, and D1/D2 extraction risk is unchanged. Past fixed `Fabricator → Vault → BIT Bay` modeling sequences are **historical scenarios, not required progression**. No new currencies, purchases or forced quests.

## Approved BIT Bay L1 combat support (M28)

**Owner-approved, 8 November 2026:** On **full completion of BIT Bay L1**, BIT gains **limited active combat support**, whose first concrete L1 effect is now selected by M29: **briefly distracting one dangerous enemy**. Short-lived defense was an earlier alternative example and is **not** an additional L1 ability. Scanning/intelligence as the primary first BIT Bay completion reward is **superseded**; BIT still accompanies, speaks, gives contextual hints and signals optional living-world opportunities before any Bay upgrade. Support must preserve the primacy of **enemy behavior, terrain, player positioning and the free Basic Carbine** (M22–M25). It cannot automatically kill/win, guarantee survival or extraction, recover lost cargo, add insurance or a second Secure Slot (D1/D2). It must be visibly limited and mobile-readable, with no need to implement a complex new touch HUD. BIT Bay remains optional versus accessible Vault L1 after earned Fabricator L1 (M27); its visual repair steps grant no functional benefit before full completion (M26). M29 locks distraction as the first effect, and M30 locks player-triggered contextual activation; exact controls, threat-priority logic, specific cooldown/reset and visuals, Bond interplay and L2 roadmap remain open after M31–M32.

## Approved BIT Bay L1 first ability: brief distraction (M29)

**Owner-approved, 8 November 2026:** Once BIT Bay L1's **last visual restoration stage** is complete, BIT gains a **brief distraction of one dangerous enemy**. The aim is a player-created flank, reposition or escape opportunity; the player must notice it and act. The effect does not kill for the player, resolve an encounter, guarantee survival or extraction, protect cargo, revive on death, create insurance or add another Secure Slot. It does not replace Basic Carbine counterplay or player choice of risk and depth. Distraction is the **single first L1 combat ability**, not both distraction and a defensive shield; earlier defense/scanning descriptions are unselected alternatives or historical proposals. BIT's companionship and contextual guidance already exist before the upgrade. No new resource cost or intermediate-stage functional benefit is implied.

**M30 approves player-triggered contextual activation, not autonomous ability use; M31 subsequently approves BIT choosing the most immediate enemy threat after activation. Still unapproved:** exact input/button placement, threat-ranking algorithm, cooldown duration/reset, distraction duration, eligible threats, reaction behavior, visuals/audio, control layout, and Bay L2/Bond interaction. M32 resolves that the ability is reusable with cooldown, not a per-raid consumable charge pool. Keep mobile readability and player agency central. This is design documentation, not a gameplay change.

## Approved BIT distraction activation: contextual player action (M30)

**Owner-approved, 8 November 2026:** When BIT Bay L1 is fully complete, the **player chooses when** BIT performs its M29 brief enemy distraction via **one simple contextual player action**. BIT does **not** automatically trigger or consume the combat ability when it detects danger. The action must respect existing mobile movement/aim/fire, be legible in context and avoid a complicated new HUD. This is a decision about **who initiates the action**, not where the button lives. **M31 separately decides that BIT chooses the most immediate threat after manual activation**, without prescribing the target-ranking logic. Existing BIT voice, world hints and presence before BIT Bay remain unchanged.

**Not decided:** Exact action presentation, tap/hold/button positioning, **how BIT ranks eligible immediate threats under M31**, ability-ready/blocked feedback, duration, exact cooldown/reset behavior under M32, balance, target eligibility, interruptions and future Bond/Bay L2 interactions. No guaranteed fight outcome, escape, extraction, survival or saved cargo. No implementation, gameplay or economy alteration is included.

## Approved BIT target selection: most immediate threat (M31)

**Owner-approved, 8 November 2026:** When the player chooses to trigger BIT's distraction (M30), **BIT selects the most immediately threatening enemy** to distract. The player deliberately controls the **timing**, not the specific target. **BIT does not trigger the skill by itself.** This avoids precision target-selection demands during touch combat while retaining a tactical window for player-controlled flanking, repositioning or escape. One dangerous enemy is distracted briefly; no automatic kill, guaranteed survival/extraction, loot recovery or added protection.

**Still open:** Exact threat priority and eligibility (not necessarily closest), range/visibility rules, behavior if no target is suitable, how to signal the chosen enemy to the player, control placement, exact cooldown/reset under M32, distraction duration and balance. Do not treat M31 as permission for automatic activation, permanent crowd control or new HUD complexity.

## Approved BIT usage cadence: reusable with cooldown (M32)

**Owner-approved, 8 November 2026:** BIT's one-enemy distraction can be **successfully used multiple times during a normal raid**, with a **clear, meaningful cooldown between successful activations**. The ability is **not limited by a fixed count of per-raid charges** as its primary constraint. The player chooses when to use it (M30); BIT chooses the most immediate threat (M31). Communicate temporary unavailability and readiness clearly on a phone without assuming new permanent HUD clutter. Cooldown should leave tactical downtime and cannot allow continuous crowd control, automatic victory, invulnerability, guaranteed extraction or loot recovery.

**Explicitly unapproved:** Exact cooldown length, when/how it starts or resets, feedback, input placement, target/no-target handling, upgrades reducing cooldown, balancing, role eligibility and how interruption affects an activation. An ability that executes against an eligible enemy counts as a successful activation for this rule; a kill is not required.

## Approved BIT enemy susceptibility (M33)

**Owner-approved, 8 November 2026:** BIT's distraction **works against ordinary enemy types**; some heavy or specialized foes **may resist or react differently**, with fair, clear enemy/environment/BIT cues that work on muted mobile devices. **M34 subsequently rules out complete immunity for every enemy type**, without deciding precise resistant reactions. The existing M30 player-triggered activation, M31 BIT selection of the most immediate suitable threat and M32 reusable cooldown remain. No automatic kills, guaranteed escape or loot recovery.

**M34 now resolves full immunity: none. Still open:** Enemy-by-enemy reaction/strength, exact target selection for resistant threats, no-reachable-target/failed activation rules, timing, UI, cooldown/reset, reaction visuals/audio, BIT Bond and balancing. A particular failed-use penalty or targeting algorithm is not implied.

## Approved resistance model: altered effect, never full immunity (M34)

**Owner-approved, 8 November 2026:** Every enemy archetype can be **meaningfully affected** by BIT distraction. Resistant heavy/specialized foes can show **shorter, weaker or tactically different** reactions than ordinary enemies, but **none is fully immune**. Their response must be clearly visible, fair and understandable on a mobile screen even without sound. Resistance must preserve enemy distinctiveness without making BIT appear nonfunctional or granting automatic control/victory.

**Preserve M29–M33:** The player initiates the contextual one-enemy distraction after fully building BIT Bay L1; BIT selects the most immediate threat; successful use is reusable after meaningful cooldown. No change to ordinary extraction risk, loss, Vault's Secure Slot or Basic Carbine viability.

**Unapproved:** Specific enemy list/reactions or timing, threat ranking, availability/range, no-target behavior, input/UI cues, cooldown seconds/reset, balance and BIT Bond/Bay L2 interactions. No gameplay implementation is included.

## Hypotheses and next decision

Unapproved: exact loot probabilities and route hints, stage resource splits, room-specific art, first-ten-extraction cadence, paid acceleration limits and commercial values. **Intermediate room utility is no longer open:** M26 locks it to *none* until final completion. **Vault vs BIT Bay build order is no longer open:** M27 lets the player choose where both are accessible. **BIT Bay L1's benefit is no longer open:** M28 locks limited combat support, M29 locks its first ability to brief enemy distraction, M30 locks player-controlled contextual activation, M31 locks BIT's post-activation choice of the most immediate threat, M32 locks reuse with a meaningful cooldown between successful uses, M33 locks enemy-dependent susceptibility with readable/fair differences, and M34 rules out full immunity while permitting weaker, shorter or different responses. Historical M6/M7 simulations must be recalibrated for the Fabricator gate before supporting balance claims.

**Next single decision — what happens if the player activates BIT but no reachable enemy target exists?**
- **A — No use spent, clear contextual feedback (recommended).** The request cannot execute, so it does not start the cooldown. Indicate why BIT cannot act without hijacking movement or adding complex HUD; exact feedback and range remain open.
- **B — Treat the attempt as a spent activation.** Cooldown starts even when no enemy can be distracted. Simpler failure accounting but punishes experimentation and is difficult to read with automatic target selection.

**Neither failed-use model is approved yet.** M34 rules out enemy-type immunity, but a raid may still have no enemy in range or an unreachable threat. Exact reachability, button position, cooldown duration and feedback remain open.
