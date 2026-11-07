# Protocol Rebirth — Core, Meta & Commerce Contract

> **Single source of truth for the connected target design.** Owner-approved direction, 7 November 2026 (M19D). Documentation only; not evidence of shipped behavior. This contract supersedes conflicting core/meta/commerce proposals. [Decision register](design-decisions.md) retains the detailed approvals and history; [game reference](game-design-reference.md) describes the inspected prototype.

## Approved experience

**Choose a bunker Project at home → make meaningful route and loot decisions in a raid → choose when to extract → bank the actual haul → visibly restore home → pursue the next ambition.**

| Rule | Approved contract |
| --- | --- |
| **Project and material hunt** | At home, select the overarching bunker Project. Resource targeting happens through meaningful **in-raid route choices and loot probabilities**, with understandable likely sources and risk/reward tradeoffs. No guaranteed requested item, auto-grant at extraction N, or home menu that reserves a material drop. Project tracking is guidance, not a loot entitlement. |
| **Major room restoration** | Major bunker rooms have **2–3 clearly visible restoration stages within the existing TOTAL resource cost**. Allocate the existing requirements across stages; their sum must equal the original total for each resource. Do not charge the full room cost per stage, add currencies, or create additional mandatory grind. Exact stage allocation and intermediate functional benefits remain hypotheses. |
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

## Hypotheses and next decision

Unapproved: exact loot probabilities and route hints, stage resource splits, room-specific art, intermediate functionality, first-ten-extraction cadence, paid acceleration limits and commercial values. Historical M6/M7 simulations must be recalibrated for the Fabricator gate before supporting balance claims.

**Next single decision — what do intermediate room stages grant?**
- **A — Visible restoration; full room function on completion (recommended).** Each stage visibly changes the room; existing functional unlocks arrive at the final stage. Keeps unlocks and D1 protection easy to understand.
- **B — Visible restoration plus limited intermediate utility.** Some stages grant a small existing room benefit before completion; requires a room-by-room benefit split and explicit protection of Vault L1's unlock.

Neither option is approved yet. Both retain 2–3 stages, the same total cost and no extra grind.
