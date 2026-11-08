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

**Owner-approved, 8 November 2026:** After **fully earning and building Fabricator L1 through play**, the player **chooses accessible Vault L1 or accessible BIT Bay L1** as the next primary Bunker Project. BIT may suggest a goal, never select or require it; show only **one actively tracked Project** at a time. If world/access prerequisites are not met, no additional unlock is implied by this choice. Vault L1 offers permanent storage improvements and, **only on full room completion**, the one approved Secure Slot. BIT Bay L1 upgrades the companion's support hardware and pays off **only after final completion**; BIT was already met and accompanies the player before Bay L1. The precise first Bay support effect is still to be approved. Both rooms retain 2–3 visual-only stages within the existing total material cost under M26, and D1/D2 extraction risk is unchanged. Past fixed `Fabricator → Vault → BIT Bay` modeling sequences are **historical scenarios, not required progression**. No new currencies, purchases or forced quests.

## Hypotheses and next decision

Unapproved: exact loot probabilities and route hints, stage resource splits, room-specific art, first-ten-extraction cadence, paid acceleration limits and commercial values. **Intermediate room utility is no longer open**: M26 locks it to *none* until final completion. **Vault vs BIT Bay build order is no longer open:** M27 gives the player the choice where both are accessible. Historical M6/M7 simulations must be recalibrated for the Fabricator gate before supporting balance claims.

**Next single decision — what is BIT Bay L1's first tangible completed-room benefit?**
- **A — Enhanced tactical scanning / situational intelligence (recommended).** BIT helps notice risk, enemy roles, actionable environmental clues, likely material source areas and optional living-world leads in ordinary raids, without guaranteed items, revealing all secrets or adding mandatory buttons. BIT already talks and accompanies the player prior to Bay L1; this is an **upgrade** to its assistance rather than BIT's initial unlock.
- **B — Limited reactive combat support as the first Bay payoff.** BIT can distract a threat or briefly support defense during a real encounter, with fair telegraphs/cooldowns; this must not kill enemies automatically, guarantee survival, rescue lost items or demand complex touch controls.

Neither option is approved yet. The precise ability, cooldowns, UI, balance, higher-level Bay rewards and BIT Bond overlap remain open. Both preserve M22/M23's Basic Carbine viability and D1/D2 extraction rules.
