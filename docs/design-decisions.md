# Protocol Rebirth - Design Decision Register

| Document control | Value |
| --- | --- |
| Decision owner | Robert Wasser |
| Last updated | 7 November 2026 |
| Review branch | `docs/game-design-reference-2026-11-06` |
| Review PR | [PR #201](https://github.com/w4sser/protocol-rebirth-proto/pull/201) - do not merge until the design review is complete |
| Companion document | [Game Design & Loop Reference](game-design-reference.md) |
| Mode scope | D1 and D2 specify the current short-session PvE loop. M1 records future-mode exploration, not additional implementation scope. |
| Implementation status | Documentation only. Approval of direction is not evidence of implementation or authorization to merge gameplay changes. |

## Reading this register

**APPROVED** means Robert explicitly accepted the design rule. **PROPOSED DETAIL** is a recommendation awaiting agreement. **IN REVIEW** means the next design question has been opened, not decided. **IMPLEMENTATION CHECK** is work needed to verify or align the game with an approved rule. **FUTURE EXPLORATION** records a direction the owner wants to investigate later, not an approved feature specification or delivery commitment.

Approved decisions supersede conflicting historical design intent. They do not retroactively change what the inspected build actually does. The reference document keeps that distinction visible.

**Mode clarification:** In D1/D2, the current game mode is the fast, short-session PvE experience. "Ordinary raid" refers to that experience, not every future Protocol Rebirth mode. "Quick Raid" is a descriptive working label in this review, not an approved player-facing name. The owner wants later exploration of longer, freer PvP and cooperative PvE sessions; see M1. Do not silently extend the current node structure, clock, or extraction procedure to those future modes.

---

## D1 - Death, Extraction & Risk

**Status: APPROVED - Controlled Risk (option C).**

Robert approved all five rules below without exceptions or additional comments on 6 November 2026:

1. **Full risk for carried and equipped gear.**
2. **One Secure Slot at Vault L1.**
3. **Remove BIT's automatic item rescue.**
4. **Remove insurance and paid bag recovery from the core loop.**
5. **Always allow a free retry.**

These five approvals are final for this review unless Robert explicitly reopens them. The unfinished specification details below must not be mistaken for uncertainty about this direction.

### D1.1 - Risk and extraction contract

Ordinary carried loot and valuable deployed equipment remain at risk until successful extraction. Clearing a room or advancing to another depth is not extraction and does not bank the bag. Death, timeout, and deliberate abandonment are unsuccessful raid outcomes for this contract.

The Secure Slot is the one approved item-protection mechanism. Its exact eligibility and quantity rules remain to be finalized under D1-A through D1-C.

| Possession or progress | Successful extraction | Death, timeout, or deliberate abandonment |
| --- | --- | --- |
| Ordinary materials, valuables, weapons, and armor found in the raid | Retained and reconciled at home | Exposed items are lost |
| Valuable equipped weapon or armor taken from home | Returned | Lost |
| Other carried equipment, unused consumables, and unused tool charges | Returned as applicable | Lost unless explicitly eligible for and selected in the Secure Slot |
| Consumed supplies and spent tool charges | Spent; not refunded | Spent; not refunded |
| Item covered by the approved Secure Slot rule | Retained | Retained |
| Free Basic Carbine | Available for another attempt | Available for another attempt |
| Materials and equipment left at home | Unaffected by raid loss | Unaffected by raid loss |
| Previously earned permanent facility, Operator, skill, and BIT progression | Retained | Retained |

This table records the target outcome, not proof that the current result-ingestion paths already match it. It does not set new XP awards for a failed run; those belong to the progression review. Temporary raid perks are not permanent progression.

### D1.2 - One protection mechanism, not several

Vault / Storage L1 unlocks exactly one Secure Slot. There is no Secure Slot before this upgrade under the approved unlock rule. The first-time experience should teach the ordinary loss rule rather than quietly granting an additional item-protection exception.

BIT's automatic item rescue is removed from the target core loop. Any existing Bond rescue or Guardian item-return effect must be reconciled with that decision; it must not remain as a hidden second protection mechanism. Whether an affected talent is removed or replaced with a different, non-item-rescue benefit requires a separately scoped choice.

Insurance and paid bag recovery are removed from the core loop, including a paid post-loss reversal of the whole bag. This approval does not decide every future use of Signals, every currency exchange, or the eventual business model. Do not expand it into an unapproved removal of the currency or a promise about all future monetization.

BIT can still help the player survive or make decisions before a loss. Scouting, warnings, shielding, and other field support are not equivalent to resurrecting lost items after a failed raid.

### D1.3 - Always allow another attempt

A player who has lost all valuable gear can still launch a viable attempt with the free Basic Carbine. This rule does not grant free replacement armor, tools, medkits, or the previous bag.

Mandatory repairs, debt, payment, crafting completion, facility maintenance, or an energy/Fuel restriction must not remove the free retry path. Premium equipment and full bags are not automatically restored after failure.

The result screen must distinguish lost possessions, any protected item, and retained permanent progress. It should offer a clear free re-entry path without requiring the player to understand optional recovery systems.

### Remaining D1 specification details

The following are **PROPOSED DETAILS, NOT YET APPROVED**. They complete the contract without reopening the five decisions above.

| ID | Detail to finalize | Recommendation | Reason |
| --- | --- | --- | --- |
| D1-A | Quantity and carrying capacity | Protect exactly one item unit, not a stack. It still occupies its ordinary bag capacity; protection is not an extra cargo slot. | Makes the size of the exception predictable and avoids a hidden capacity upgrade. |
| D1-B | Eligible items | Materials and ordinary valuables only. Exclude all weapons and armor, including found/unequipped copies; also exclude tools, consumables, and dedicated scouting/mission-key items. | Merely excluding equipped gear would let players unequip an expensive weapon to protect it. An ordinary material is not excluded just because a quest also requests it. |
| D1-C | Selection and reconciliation | The player selects, replaces, or clears the protected unit during the raid. Replacing protection removes the old protected tag; it never duplicates cargo. A saved unit reaches home exactly once but does not turn a failed raid into an extraction or satisfy an extract-only objective. Currency-bearing valuables, if eligible, convert once at settlement. | Preserves an understandable tactical choice and keeps possession separate from mission success. |
| D1-D | Interrupted sessions | Distinguish a crash/disconnect/backgrounded app from explicit abandonment. Specify durable raid state and recover-or-settle behavior before implementation; do not promise reconnection or compensation that the prototype cannot yet support. | Prevents accidental loss, duplicated results, or force-closing the app to reclaim risked gear. |

The recommended exclusion of found, unequipped gear and the one-unit interpretation are refinements, not facts already approved by the five-rule confirmation.

Exact mission-item eligibility and extraction credit must be checked alongside D2. UI interaction and safe moment-to-moment access to the bag belong in the UX review. Do not insert an unapproved payment, cooldown, or extra rescue mechanic to solve these details.

### Implementation checks required by D1

| Area | Required follow-up |
| --- | --- |
| Raid outcomes | Check extraction, death, timeout, deliberate abandon, depth transitions, and Big Map results. Confirm that continuing never banks ordinary cargo. |
| Equipment ledger | Reserve only what was actually deployed. Return surviving equipment and unused charges once; do not touch equipment left at home or refund consumed charges. |
| Secure Slot | Implement the final D1-A/B/C specification, explicit selection, UI labeling, and loss settlement. Test stacked items, full bags, swaps, and repeated result ingestion. |
| BIT | Audit Bond rescue and Guardian Safe Return. Remove the additional item-rescue behavior and update talent descriptions after a replacement/removal decision. |
| Insurance/recovery | Audit preparation, death screens, Signals costs, optional retention modes, and legacy simulated-raid paths. No live core-loop route should contradict the removal. |
| Free retry | Test an empty Armory and Stash, zero currencies, low power, and any enabled Fuel mode. A free starter attempt must remain possible. |
| Save migration | Plan handling of existing secure-item selections, rescue talents, or insurance-related state without silently deleting unrelated possessions. Refunds or talent replacement are not specified by this record. |
| Interrupted sessions | Resolve D1-D, including single settlement, app backgrounding, reloads, and attempts to replay an old result. |
| Player comprehension | Verify that the HUD and result screen explain risk, protection, and loss accurately without audio. |

Relevant audit locations: `AGENTS.md`, `app.js`, `nodspel/round.js`, `nodspel/raid-result.js`, `data/modules.js`, `data/progression.js`, `data/bit.js`, `data/bit-talents.js`, and `data/retention.js`. These are audit targets, not a claim that code was changed or all paths were inspected in this decision update.

---

## D2 - Mission Purpose, Objectives & Extraction

**Status: D2.1–D2.4 and D2.8 APPROVED by Robert on 6 November 2026 for the current short-session PvE mode. Remaining topology, presentation, and FTUE details are IN REVIEW.**

### The question

What is the player trying to accomplish in a raid, and what must happen before they can leave?

Separate three concepts:

| Concept | Player question | Example |
| --- | --- | --- |
| Personal purpose | Why did I deploy? | Find the missing Cable for the Fabricator. |
| Field actions and optional opportunities | What is worth doing here? | Search a cache, activate a system, take a detour, or tackle a stronger enemy. |
| Extraction condition | How do I get home with the haul? | Reach a valid extraction point and complete its clearly communicated procedure. |

A clear purpose does not automatically justify making that purpose a compulsory exit condition. Likewise, completing an objective does not bank cargo by itself.

### Baseline being reviewed

The inspected baseline reference describes normal three-depth raids where control nodes open a level exit, followed by an Extract / Continue decision at early depths. Big Map uses different extraction-availability logic. This remains the recorded implementation baseline, not the newly approved target design. See [reference section 4](game-design-reference.md#4-an-ordinary-raid-from-intention-to-consequence) and [section 11](game-design-reference.md#11-world-structure-objectives-and-quests).

### D2.1 - At least one return extraction available from the start

**APPROVED.** Every ordinary raid in the current quick PvE mode must offer at least one return extraction route available from the beginning. That route must not require completing the personal objective, activating the level's nodes first, or clearing all enemies before it can be used.

Available does not mean instant or safe. The player must physically reach a valid extraction point and complete the D2.3 extraction procedure. The exit's placement and return-path topology remain to be specified. No extraction fee or new cost is approved by this decision.

This replaces the default mandatory-node-gated-return assumption for ordinary quick raids in the intended design. It does not remove nodes or approve a particular replacement function for them. It also does not change the running game by itself.

### D2.2 - Successful extraction is independent of personal-objective completion

**APPROVED.** A player may extract successfully even when the personal main objective is partly or wholly unfinished.

A successful extraction banks the actual carried haul and returns eligible surviving equipment according to D1. An unfinished quest remains unfinished. Objective progress and rewards are awarded only when their own requirements have actually been satisfied. Extracting early does not automatically count as clearing a depth, completing a scouting goal, finding a missing component, or finishing a quest chain.

Example: a player needs two Cable, finds one Cable and a useful weapon, and chooses to return. The extraction succeeds and the actual possessions come home. The two-Cable requirement is not automatically completed.

**Result distinction:** Extraction outcome, objective completion, and depth-clear progress are separate facts. The result screen and result contract must not collapse them into a single success/failure flag.

### Approval scope and remaining recommendations

Robert's confirmations accepted D2.1, D2.2, and the D2.3 extraction model below for the current quick mode. They did **not** approve every proposal discussed alongside them. D1-A through D1-D also remain unresolved. Longer PvP/co-op modes are future exploration under M1, not implicit extensions of this ruleset.

The following remain proposals:

- Present one primary personal purpose, initially derived from the next useful bunker improvement, without adding an obligatory mission-selection menu.
- Use nodes for deeper access, optional rewards, routes, or alternative extraction points. Their precise roles remain undecided; they may not negate D2.1's ordinary return route.
- Surround the main purpose with optional detours and discoveries rather than a checklist that implies every opportunity is mandatory.
- Apply a consistent, clearly communicated success/loss vocabulary across ordinary raids, Big Map, and FTUE. Mapping existing variants and any special-mission exception still need an explicit decision; no new exception is granted here.

The D1 rule already remains in force: continuing deeper never automatically banks exposed possessions. Exact access and return topology after a depth transition belongs to the remaining D2 review.

### Design rationale and trade-off

The approved direction preserves a decision to leave when the player finds something valuable before completing the map's systems. Leaving with a useful but incomplete haul can be a deliberate successful extraction rather than being forced to finish a personal task.

Very short extraction runs may become efficient. Evaluate that risk through travel, danger, loot placement, and the value of deeper opportunities. No new anti-farming penalty, minimum kill count, minimum raid duration, loot rebalance, or kill-reward removal is approved here. The former proposal to retain node-gated return as the default ordinary-raid rule was not selected.

### D2.3 - Deliberate, short, cancellable extraction

**APPROVED for the current short-session PvE mode. Five seconds is the approved first test value, not a permanently fixed balance number.**

| Aspect | Approved rule |
| --- | --- |
| Start | Enter the marked extraction zone and tap EXTRACT once. Walking through it must not automatically end the raid. |
| Duration | Start playtesting at five seconds; evaluate the duration rather than treating it as permanent tuning. |
| Player agency | The player can move, aim, and fire while remaining within the extraction zone. No need to hold a UI button throughout. |
| Damage | The player remains vulnerable and can die. Nonlethal damage does not restart the countdown. |
| Cancellation | Leaving the zone cancels the attempt and clears its progress. Re-entering requires another deliberate start. This is not Abandon and does not discard the bag; the raid and exposed cargo continue. |
| Completion | Completing the countdown alive secures the haul and ends the raid. Death beforehand follows D1. |
| Enemy pressure | Do not require a newly spawned wave for every extraction in the first quick-mode test. Existing threats can continue to apply pressure; a quiet departure remains valid. Dedicated extraction encounters would be a separate choice. |
| Readability | Show the zone boundary, countdown, and cancellation clearly; no dependence on audio alone. |

**Remaining implementation details:** Resolve the countdown's interaction with the raid deadline, same-tick death/completion, pausing, and app backgrounding before implementation. Approval of D2.3 does not silently decide those edge cases or authorize additional fees, forced waves, or recovery mechanics. Team extraction and other multiplayer rules belong to the future-mode review under M1.

### D2.4 — Nodes open the forward route (APPROVED)

In the current quick PvE mode, activating the required nodes is the **consistent prerequisite for opening the route forward to the next depth**. This repeats from depth to depth until the authored **finite raid ending**; the current three-depth prototype is a concrete implementation baseline, not a universal duration/level-count requirement for future modes.

**Forward progression is not extraction.** Players can instead use the separately accessible return extraction under D2.1 and bank their current haul under D2.2/D2.3. Continuing does not bank any cargo under D1. Do not reclassify the required forward nodes as merely optional side objectives, or use node completion as a hidden condition for returning home.

At the terminal depth, finishing the level's node challenge leads to the raid's designed end, not an infinite cycle of deeper stages. Exact terminal extraction interaction and final reward placement remain implementation/design details to specify.

The owner explicitly preferred preserving this understandable core structure rather than changing it solely in response to onboarding-complexity feedback. Improve the clarity of what nodes open and how return extraction differs before considering a structural redesign.

### D2.8 — Depth rewards and an authored final payoff (APPROVED, option C)

The current quick mode should offer **progressively more attractive loot opportunities deeper into the raid**, plus a **clear, authored final objective or discovery with a meaningful payoff**. The last stage should feel worth reaching beyond simply collecting more of the same loot.

A successful early extraction remains a valid outcome. Full completion is a distinct, desirable achievement, but the approved approach does **not** specify a generic automatic full-clear currency/XP bonus or punish players for leaving early.

A valuable cache, encounter/boss, major discovery, or progression-relevant find are **candidate implementations**, not a fixed choice or a promise that every run must end in a boss fight. The exact final objective, reward type, guarantee/drop rate, pacing, and how to avoid full-clear farming dominance remain **OPEN** for balancing and playtesting.

**Design intent:** Reasons to go deeper should be located in the playable world, clearly anticipated and understood, and connected to the bunker or equipment loop. The cost of continuing is the additional exposure of accumulated carried gear and loot.

---
### Other open D2 decisions

| ID | Detail | Status |
| --- | --- | --- |
| D2.4 | Nodes consistently unlock the route to the next depth in the quick mode; the final depth ends the raid | Approved; implementation alignment pending |
| D2.5 | Extraction topology: spawn distance, return paths after depth transitions, and Big Map mapping | Open; no map redesign approved |
| D2.6 | Objective hierarchy: personal purpose, local tasks, optional rewards, and exit guidance | Open; no HUD redesign approved |
| D2.7 | FTUE and special-mission treatment within the current experience | Open; no implicit exception to ordinary quick-raid rules approved |

### Implementation checks required by D2.1 through D2.3

1. In an ordinary quick raid, the guaranteed return extraction is reachable and usable before node or personal-objective completion, subject only to D2.3 and survival.
2. Extracting with an incomplete tracked upgrade or quest banks only the actual haul and correctly leaves unmet requirements unfinished.
3. Extraction does not fabricate `levelsCleared`, node completion, scouting credit, quest rewards, or other objective achievements merely to satisfy old result-ingestion assumptions.
4. Continuing to another depth does not settle the bag. Once topology is decided, verify its return route rather than silently reintroducing the old exit gate.
5. Ordinary successes and failures still follow D1; Secure Slot protection does not turn death into a successful extraction.
6. Check fresh and returning profiles and explicitly document how Big Map, Hard variants, and FTUE map onto the approved quick-mode rules. Do not assume an exemption or claim those variants were changed.
7. Verify deliberate activation, the five-second initial duration, movement/aim/fire during extraction, and nonlethal hits without countdown reset.
8. Verify leaving the zone cancels only the extraction attempt, preserves exposed cargo, resets its countdown, and requires another EXTRACT action on return.
9. Verify exactly-once settlement on completion, ordinary death handling before completion, and no automatic extraction just from crossing the boundary.
10. Verify no extraction-specific wave is required in the first quick-mode test and no undocumented kill/clear condition blocks departure. Test deadline and interruption races after their policy is decided.

No gameplay change or fresh runtime test is part of this documentation update.

---

## M1 - Mode Scope & Future Exploration

**Status: APPROVED scope clarification and request for FUTURE EXPLORATION. Not approval to implement additional game modes.**

Robert clarified on 6 November 2026 that the game mode being designed now is the quick experience. He also wants to examine later modes with longer sessions, including freer, Tarkov-referenced PvP extraction and cooperative PvE, potentially without node activation as the organizing activity.

### Current mode versus future candidates

| Track | Scope | Status |
| --- | --- | --- |
| Current quick PvE mode | Short sessions; the current design review and D1/D2 apply here. Nodes exist in the inspected build, while their intended role remains D2.4. | Current focus; approved extraction changes still require implementation. |
| Longer, freer PvP extraction | Explore player-directed raids with PvP, using Tarkov as the owner's reference. Mandatory node activation is not an assumed requirement. | Future exploration only. No duration, player count, squad format, or objective contract approved. |
| Longer cooperative PvE | Explore extended sessions with other players against AI, potentially using different objectives and pacing from the quick mode. | Future exploration only. No team size, revive, shared-loot, or team-extraction rule approved. |

"Free for all" is retained as the owner's broad exploration reference, not silently converted into an approved deathmatch, last-player-standing, solo-only, or squad ruleset. Whether PvP includes AI threats and how parties enter remains open.

### Consequences for the design reference

- "PvE only" describes the current quick mode. It is **not a permanent product-wide prohibition on exploring PvP**. This clarification supersedes that broader interpretation of older direction without introducing PvP into the current build.
- Node activation, the existing eight-minute raid budget, three-depth progression, and D2.3's five-second test countdown must not be assumed to define every future mode.
- D1 remains the approved risk contract for the loop currently being reviewed. Future modes need an explicit decision about which rules they share or vary; this is not permission to add hidden protection exceptions now.
- A shared world, bunker, BIT, combat, and extraction identity may be useful foundations. How inventory, progression, rewards, and losses transfer between modes is **not decided**.
- No matchmaking, networking, backend work, new mode menu, or parallel implementation is authorized by recording these exploration tracks. Do not invent release dates, population assumptions, or fixed session lengths.

### Questions reserved for the later mode review

Define each mode's purpose, session length, players/teams, objectives, extraction, death/recovery, and reward contract together. Decide whether progression and inventories are shared, separate, or constrained, and how differing risk levels affect rewards. For co-op, explicitly define revives, loot ownership, leaving separately, and interrupted sessions. For PvP, explicitly define the intended competitive rules and what player information is available.

D2.4 is now approved for the quick mode: nodes consistently unlock the forward route. The next active design review should prioritize the **FTUE and clarity of the complete first raid-to-bunker loop**, followed by the exact final payoff and unresolved extraction topology. Future longer modes need not use nodes.

---

## D3 — First-Time Player Experience (FTUE)

**Status: D3.1, D3.2, D3.5, D3.6, D3.7, D3.8, and D3.9 APPROVED — intro combat, bunker-entry extraction, BIT discovery, actual Core L1 restoration using intro loot, and free full intro restart on failure. Presentation details remain OPEN.**

### D3.1 — Fight your way home; discover BIT in the bunker

**OWNER DIRECTION (6 November 2026, superseding the earlier option-C ordering):** The player **does not begin with BIT acting as an introductory guide**. The player **shoots their way toward the bunker**, discovers it, and **meets BIT for the first time inside**. BIT's introduction is a character/story payoff, not a tutorial voice heard from the outset.

The owner supplied BIT's first greeting, in its slightly sardonic voice:

> **"You're late, but you're back."**

This line strongly suggests a pre-existing history without requiring a lore dump. The encounter should feel like finding a person/companion and the place to which the operator belongs. The damaged bunker and its restoration stakes can then be introduced naturally.

**This explicitly supersedes** the earlier D3.1 assumption that BIT appears before the opening combat and that the first bunker reveal must occur only after a standalone first extraction. We retain the useful principle of *immediate playable action* and avoid extensive menus or exposition before shooting, but the discovery of BIT **inside the bunker** is now the central FTUE narrative beat.

### D3.2 — Intro mission concludes at the bunker entrance (APPROVED)

**OWNER APPROVAL (6 November 2026):** Reaching and entering the bunker **completes the introductory playable mission and serves as its first successful extraction**. The player then discovers BIT **inside the bunker**, where BIT first speaks: **"You're late, but you're back."** The damaged bunker establishes why later raids matter. The **first ordinary raid after this meeting is the first raid undertaken together with BIT**, and is where the regular node-based depth progression, risk/loot choices, and optional return extraction can be taught.

**FTUE-specific onboarding exception:** Bunker entry is the intro's bespoke extraction endpoint. It should not automatically be treated as requiring the five-second player-started ordinary extraction procedure (D2.3), or as requiring completion of ordinary node gates. This is a distinct introductory mission flow, not a change to ordinary quick-raids. The precise interaction with the bunker entrance, any intro loot/result settlement, and death/retry behavior remain to be specified explicitly.

### D3.3 — Candidate experience (PROPOSAL, not a fully approved script)

1. **Approach:** Begin outdoors and establish a simple immediate destination through readable environment design. The operator is controllable almost immediately; encounters teach movement and shooting through play.
2. **Break through:** Fight past a short enemy resistance and find the bunker entrance. Use light, sightlines, and geometry rather than a long tutorial narration.
3. **Discover home:** The bunker entrance opens and the moment of relief contrasts with the hostile exterior.
4. **Meet BIT:** A dormant or waiting BIT comes alive and addresses the operator with the owner's line. Presentation details, animation, exact staging, and any follow-up joke are not yet approved.
5. **See what is broken:** BIT and the damaged Rebirth Core reveal an understandable reason to undertake subsequent raids and restoration.

**Resolved:** Bunker entry itself completes and extracts the introductory playable mission (D3.2). No separate pre-bunker extraction is required. **Still open:** the exact entry interaction, whether introductory loot is carried and banked, what can be lost before reaching the bunker, and how a failed first approach is retried. These require consistent player-facing explanation and deliberate reconciliation with D1, rather than unapproved hidden exceptions.

**Other open details:** Exact seconds to first shot, objective and node placement, loot pickup before discovery, amount of guidance before BIT is found, player failure/retry, first post-discovery raid, and which meta systems remain hidden.

### D3.5 — First home payoff: restore the actual Core L1 (APPROVED)

**Owner choice: Option B (6 November 2026).** After meeting BIT, the player uses something collected during the introductory combat approach to **restore one meaningful part of the bunker**. The outcome must be visibly noticeable, not a token tutorial message. This establishes the lesson: what you safely bring home can rebuild home.

**Owner-approved sequence (6 November 2026):**

1. During the introductory approach, guarantee **two Scrap Alloy** pickups on the mandatory path, showing their use without requiring a full inventory tutorial. The introduction ends as a special extraction when entering the bunker (D3.2); the two items settle once.
2. BIT first greets the player inside: **"You're late, but you're back."** A short visual beat focuses attention on the damaged Rebirth Core.
3. Offer exactly one contextual action: **RESTORE EMERGENCY POWER — Rebirth Core L1**. Consume the two carried-home Scrap Alloy. This matches the currently configured Core L1 cost: **0 Scrap + 2 Scrap Alloy** (`data/modules.js`).
4. Show the Core activating, emergency lights starting up, and access to other rooms becoming visibly possible. Avoid forcing the player through a full crafting/menu tutorial.
5. BIT identifies the **Fabricator** as the next meaningful objective. Its existing L1 requirements are **20 Scrap, 2 Cable, 2 Scrap Alloy**, and its first commissioning reward is a **Scavenger Vest (+25 shield, +1 raid bag slot)** along with basic crafting/preparation. Present Cable as the immediate, legible reason to venture out again, while other requirements can be collected naturally.
6. The first ordinary quick raid begins after this payoff, with BIT now present. Teach forward nodes, loot risk, and optional extraction in that subsequent raid, without changing their already-approved contracts.

**Proposed example BIT reaction after restoration:** "Well. At least something still works." This is draft dialogue, **not approved canonical writing**.

**Open implementation/presentation details:** exact pickup positions and feedback; one-time intro loot settlement; what other loot, if any, can be carried; exact Core activation animation/UI; how much of the base is explorable; and timing. These are not reasons to reopen the approved two-alloy Core L1 contract. BIT's optional follow-up quip is still draft dialogue, not canonical writing.

**Avoid:** creating a separate fake FTUE currency/item, silently awarding a Core upgrade for free, giving out the Fabricator/Vest immediately, multiple required menus before the second raid, or making the narrative reveal depend on a regular raid's three-depth node clear.

### D3.6 — Introduction failure and replay (APPROVED)

**Owner approval (6 November 2026):** If the operator dies before reaching the bunker, **restart the introductory mission from its beginning** with the same guaranteed two Scrap Alloy available again on its authored path. The player can retry without cost, debt, cooldown, or any loss of previously earned permanent progression.

- Failed introductory attempts do **not** trigger successful extraction, consume already-secured home resources, award Core L1, or duplicate loot.
- On successful bunker-entry extraction, settle collected introductory materials **once**. Core L1 then consumes the two Scrap Alloy and visibly powers the bunker.
- Preserve the canonical D1 protection principle: an uncompleted attempt does not secretly bank exposed loot. Deterministic replay is a way to retry the tutorial, **not free recovery of a failed raid's accumulated bag**.
- The introduction must remain completable even if players initially miss or fail to collect a pickup: clearly signal missing required items or keep them on the mandatory route; exact UX is open.

**Next player goal (APPROVED direction):** After Core L1, lead the player toward **Fabricator L1** using its existing requirements (20 Scrap, two Cable, two Scrap Alloy). Highlight Cable as the most legible immediate reason for the first ordinary raid with BIT, without falsely granting the other required resources. The eventual Scavenger Vest reward is the pay-off, not an immediate FTUE grant.

**Still open:** failure point/respawn transition, whether to repeat an opening cinematic after death, difficulty assistance across repeated tries, exact pickup placement, voice lines beyond BIT's owner's greeting, and onboarding telemetry.

### D3.7 — BIT guidance in the first ordinary raid (APPROVED: option B)

**OWNER APPROVAL (6 November 2026):** Use **contextual guidance** in the first ordinary quick raid after the player discovers BIT and restores Core L1. BIT explains each unfamiliar mechanic when relevant, reacts to actions, and helps a player who is visibly stuck. **No long tutorial sequence, mandatory interruptions, or constant hand-holding.** This approved *guidance style* does not mean every line, trigger, UI element, or delay below is already approved.

**Design goal:** The first ordinary raid feels like the actual game, with BIT acting as a companion rather than a tutorial instructor. The player retains control. This is separate from the combat approach intro where BIT has not yet been found.

#### Proposed event-driven teaching script — exact triggers and dialogue under review

| Beat | Suggested trigger | What BIT/UI communicates | Player learning | Skip / repeat logic |
| --- | --- | --- | --- | --- |
| 1. Purpose | Once, on first deployment together after Core L1 | Short BIT cue: find Cable for Fabricator; one unobtrusive tracked-goal marker | Why this raid matters | No blocking mission briefing; omit if already understood |
| 2. Combat | On first enemy contact | **No default controls lecture**; contextual warning only for actual distinctive danger | Player can reuse shooting/movement learned in the intro | Combat warning takes precedence over story/loot |
| 3. Useful loot | On collecting first relevant Cable (or on first relevant tracked pickup if sources are adjusted) | One line plus a contextual `Cable x/2` progress cue, reflecting actual inventory/requirement; do not open the bag | Loot advances a specific home goal | Once per concept; never invent the pickup or progress |
| 4. Forward node | First time a player approaches a required node | Explain it opens the **next forward gate**; light/gate visibly responds on activation | Node controls the route deeper, not the return extraction | No repeat for every node; assist if player demonstrably stalls |
| 5. Extract vs. continue | When a usable return extraction and/or a deeper route present an actionable choice **and** the player has an exposed valuable haul | Identify safe-return direction separately from forward gate and briefly contrast secure-now against deeper-risk | Extracting banks ordinary loot; progressing does not | Present at a safe/clear moment, never as a modal prompt or automatic choice |
| 6. Result | After an actual successful extraction or failed raid | Summarize actual secured/lost/protected items, progress toward Fabricator, and one next step; BIT line is brief and contextual | Why to return and what changed | Results must match D1/D2; do not award an unfinished quest |

**Draft BIT line examples (NOT CANONICAL):** At deployment: “We need Cable for the Fabricator. Try bringing some home this time.” On a relevant find: “There it is. One less excuse for that Fabricator.” At a node: “That relay controls the next gate. Wake it up.” At the risk choice: “We can go home with this. Or push deeper. Your call.” On safe return: “Welcome home. Let's see what we can fix.”

#### Proposed guidance scheduling rules (not separately approved)

1. **Priority:** urgent combat/survival telegraphs > active interaction/return extraction > first-time mechanic explanation > optional lore/personality chatter.
2. **No interruptions:** never take movement/aim/fire controls away for these teaching beats. Never auto-extract, auto-activate nodes, or choose an objective on the player's behalf.
3. **Avoid chatter pileups:** only one non-urgent message at a time. Queue or discard stale informational lines; only display them while the relevant decision can still be made. Re-evaluate after danger clears.
4. **Teach at use:** teach Cable when seen/collected, node use at first node, extraction only when actionable and valuable. Avoid an exhaustive pre-raid briefing.
5. **Reminder escalation:** first give the player space; if stalled, highlight the relevant affordance, then show a single short hint. Use observed non-progress, not a fixed intrusive bark timer. Exact thresholds are tuning work.
6. **Silent accessibility:** critical BIT guidance must be replicated through compact text and world-space markers with legible mobile contrast; dialogue audio is optional, comprehension is not.
7. **Idempotent milestones:** mark the first-time concept as taught in a save-safe way, so repeated attempts do not spam identical first-introduction lines; allow needed tactical reminders on retries.
8. **Node and extraction semantics:** preserve D2.4 (nodes always unlock the route forward) and D2.1–D2.3 (separately available, deliberate return extraction) without implying that node completion banks the bag.

**Integration caveats:** The current `data/raid-ftue.js` still defines a BIT line telling the player to tap the right stick before extraction, and `nodspel/ftue.js` contains an authored hunter/clutch moment; both predate this revised intro/first-raid structure. `data/bit.js` contains relevant bark categories, but also stale insurance/recovery language that conflicts with D1. An implementation PR must distinguish **intro without BIT**, **first regular raid with BIT**, and **later standard raids**, and audit those older paths without silently carrying over old tutorials or protection rules.

**Still to approve:** final exact dialogue (except the owner's initial bunker greeting), which trigger precedes the first node versus first Cable, how the player finds the first usable return extraction, concrete stalled-player timeout thresholds, event sequencing under simultaneous hazards, and first-raid difficulty assistance. Validation must test a player who finds no Cable, an immediate return, death before seeing the extraction, repeated failure, and a player who chooses to complete the entire raid.

### D3.8 — Adaptive assistance after first ordinary-raid failures (APPROVED)

**Owner approval (6 November 2026):** Keep the first real quick PvE raid exciting and genuinely winnable/losable. After failures, offer **subtle, progressive help**, first through BIT's contextual guidance and then through more forgiving combat parameters. A failed player must still **fight, complete appropriate objectives, and intentionally extract**. No automatic win, instant extraction, or hidden banked exposed bag. This assistance is specifically for the **first ordinary raid after BIT is found**, not the standalone fight-to-bunker introduction (D3.6) and not a new global rule for every raid.

**Proposed ramp for implementation / balancing:**

| Attempt at first ordinary raid | Design behavior | Status |
| --- | --- | --- |
| First | Baseline intended combat difficulty, readable enemy telegraphs, contextual BIT guidance | Approved direction; exact tuning open |
| Second (after one unsuccessful attempt) | Slightly less enemy damage/pressure and more precise BIT hints for problems previously encountered | Approved progressive-assistance direction; numbers open |
| Third and later | Additional bounded enemy damage/speed or health forgiveness, optional shield assistance and more decisive anti-stall hints | Approved progressive-assistance direction; numbers and caps open |

**Existing prototype baseline is not approved tuning:** `data/raid-ftue.js` currently defines attempt multipliers (1.0/1.0/1.0; 0.5 damage/0.75 health/0.8 speed; 0.25 damage/0.5 health/0.6 speed), and on the third attempt a 1 HP minimum and 1-second minimum-time protection. These are implementation facts from the inspected snapshot, **not numbers Robert has approved as the target**. The earlier system also includes BIT instructional text and a hunter clutch that must be reconciled with D3.1/D3.7. A hard invulnerability/guaranteed-survival effect must not be treated as authorized by this approval; only a forgiving **but still failable** first regular raid is approved.

**Preserved contract:** D1's at-risk carried and equipped gear and free retry still apply; D2 forward-node/extraction distinctions remain intact. If the player's bag is lost on failure, difficulty assistance does not quietly recover it. The free Basic Carbine and next attempt must be accessible even with empty resources. Progression and permanent state must not be reset merely to apply first-raid help.

**Still open:** exact multipliers, maximum assistance, how to count quits/timeouts/disconnects, whether to cap assistance after a success, how it interacts with DDA and Hard variants, and which BIT lines and visual hints are shown. Validate with repeated first-raid failures and successful early extraction; measure understanding and player agency, not just completion.

### D3.9 — Final FTUE closure package (APPROVED by owner, 7 November 2026)

**OWNER APPROVAL (7 November 2026): All six rules below are locked.** This implementation contract closes the high-level FTUE design review. Exact seconds, enemy stats, camera staging, performance and voice line variations should be decided through implementation and mobile playtesting, not mistaken for approved fixed numbers.

1. **Intro layout:** Short authored linear outdoor combat approach to a clear bunker destination; the two guaranteed Scrap Alloy are placed along the mandatory path. Do not introduce node-gating, the full inventory/economy, or a parallel mission structure during this approach. Gameplay begins immediately.
2. **Intro exit/settlement:** Entering the bunker requires one explicit door interaction. This concludes the special introductory mission and banks the introductory items exactly once; **do not** require the ordinary five-second EXTRACT countdown, a normal node clear or a separate interrupting result screen before meeting BIT.
3. **BIT/Core moment:** BIT first appears inside and says the owner's canonical greeting. The player has one meaningful contextual Core L1 activation using the two extracted Scrap Alloy, with a visible power/lighting/door response. Avoid extra tutorial menus or granting the upgrade for free. The Fabricator is shown as the only next major goal.
4. **First ordinary raid:** The normal quick-mode extraction/risk/node rules apply, with BIT's approved context-sensitive guidance. Cable is the suggested tracked immediate goal for Fabricator; there is no mandatory Cable requirement to extract. Forward nodes open depth progression, while a usable return extraction route exists from the beginning and uses the deliberate five-second initial test extraction.
5. **Failure:** Intro death restarts the special intro free with no permanently lost progression or duplicated items. First ordinary-raid death follows normal D1 losses/free Basic Carbine retries and the D3.8 bounded progressive assistance, never an automatic victory, resurrection, or retained carried bag.
6. **FTUE completion:** End compulsory onboarding after the **first successful ordinary extraction** and its honest Fabricator-progress/next-goal presentation; **do not** require completing Fabricator L1, clearing every depth, finding two Cable, or reaching the final stage first. Thereafter the normal game is accessible. If the first normal raid fails, replay with progressively more suitable assistance rather than keeping players in a mandatory pop-up loop.

**Implementation and playtest acceptance criteria (derived from approved contract):** After starting, the player can move/shoot without any required explanatory card. The two pickups cannot be permanently missed or duplicated. The player recognizes the bunker entrance, gets an uninterrupted first BIT greeting, spends exactly the earned two alloy, sees an unmistakable change in the home, can explain the first post-home objective, can identify node-forward vs extraction-home separately, and sees accurate banked vs lost inventory after the first regular raid. Every key cue works with audio muted on a small phone viewport.

**Deferred to tuning/test rather than new strategic votes:** exact first-shot/bunker discovery durations; damage/HP/speed assistance multipliers; helper bark cooldowns; exact staging and wording beyond “You're late, but you're back”; spawn placement and encounter intensity; animations/FX; and action button placement. Validate first-run completion, fail/retry, no-Cable extraction, and full-clear paths on phone.

**Boundary:** All six rules were explicitly approved by Robert on 7 November 2026. Exact pacing, UI, combat values and dialogue beyond the owner's original BIT greeting remain to be implemented and validated. FTUE design is considered closed at the behavioral-contract level; no gameplay code changed as part of the documentation approval.

### D3.4 — Validation questions (OPEN)

- Can first-time players identify the bunker as their destination without BIT guiding them verbally from the outset?
- Is there meaningful shooting and movement almost immediately, with minimal blocking instructions?
- Does discovering BIT feel like a character moment rather than opening another tutorial menu?
- Can players explain *why they should go back into danger* after meeting BIT?
- Is the introductory run's success, loot settlement, and failure behavior consistent with the extraction rules they subsequently learn?

**Implementation boundary:** Existing docs and code describe a direct-raid FTUE with assisted attempts and a different timing of the bunker reveal. This revised narrative direction is **not an assertion that the current build already matches it**, and this docs-only PR does not implement it.
---

## P1 — Progression Architecture: Bunker, Operator, Equipment, BIT

**Status: APPROVED principle (option C, 7 November 2026). The concrete pruning, pacing, reward mapping and individual system removals below are PROPOSALS.**

### P1.1 — Four complementary roles (APPROVED)

Robert selected **option C: the bunker drives the world; the operator drives playstyle**. Treat this as the progression architecture:

- **Bunker = persistent world restoration and access.** Core power and area gates, Fabricator capabilities, Vault storage/one Secure Slot, and BIT Bay hardware determine what players can explore or do. Bunker restoration is the most visible long-term progress anchor.
- **Operator = personal playstyle.** Growth should let the player approach combat/search/extraction differently. Operator progression must not compete with the bunker for the overarching next objective.
- **Equipment = tactical preparation and at-risk build.** Weapons, armor, attachments and selected tools add meaningful loadout tradeoffs. Valuable deployed builds remain losable under D1; temporary raid perks are not persistent gear.
- **BIT = companion and support.** Relationship and hardware create tangible companion functionality while preserving BIT's personality/identity established in FTUE.

**Hierarchy:** One clear long-term **bunker goal** (e.g. restore Fabricator) drives what to look for; one primary actionable **raid purpose** guides the next session. Other progression layers support interesting choices rather than producing competing mandatory task lists.

**Design test for major unlocks:** (a) What new thing can the player do? (b) Where will the player notice it within the next raid or at home? Simple numeric gains may support a milestone but should not be its entire identity.

### P1.2 — Simplification review (PROPOSED, not approved removals)

| Layer in inspected prototype | Proposed action | Rationale and boundary |
| --- | --- | --- |
| Rebirth Core (L1–L3) | **KEEP as main world spine** | Existing L1 restores power, L2 supports Transit Hub and module caps, L3 Town access. Preserve D3 first Core restoration. Avoid presenting every gate at once. |
| Fabricator (L1–L2) | **KEEP as capability unlock** | Equipment/crafting/preparation; the first Scavenger Vest and extra bag slot are tangible. Reveal advanced recipes only when relevant. |
| Vault / Storage (L1–L3) | **KEEP, streamline presentation** | Permanent capacity and one Secure Slot at L1 under D1; don't reintroduce other insurance/protection. Show concrete haul impact. |
| BIT Bay (L1–L2) | **KEEP, resolve story inconsistency** | BIT is found and follows player *before* BIT Bay L1. Recast L1 as repair/upgrade of scanning capability, **not** first meeting or first activation of BIT. L2 cargo capability remains separate from rescue-on-death. |
| Living Quarters / rest and power meter | **REVIEW / POSSIBLY DEFER** | Not part of the four primary levelled room trees. Assess whether rest/fuel adds choices or upkeep friction; do not silently remove an existing feature. |
| Operator level (1–30) | **KEEP, deemphasize as primary goal** | Show milestones rather than interrupting after every XP increment; audit level-sourced bag upgrades against Vault's capacity role. |
| Use-based skills (Mobility, Stealth, Vitality, Search, Crafting) | **REVIEW / POTENTIALLY CONSOLIDATE** | Multiple invisible percent-only tracks risk busywork. Keep if they meaningfully change decisions; exact removals not approved. |
| Weapon mastery / equipment upgrade / Mk tiers / attachments | **SEPARATE OR SIMPLIFY** | Favor one clear weapon identity and attachments/build decisions; audit overlap among mastery, Mk upgrades and raw incremental stat boosts before removing anything. |
| BIT Bond levels, talents, skills and BIT Bay | **REVIEW OVERLAP** | Distinguish relationship progression, earned companion behavior and hardware capability; avoid three menus that independently improve the same ability. Existing BIT death-item rescue conflicts with D1 and must be removed/replaced under the already-approved rule. |
| Temporary raid perks | **KEEP DISTINCT from persistent progression** | Run-specific tactical variance must not be presented as permanent ability or earned gear. |
| Economy, quests, currencies, retention | **AUDIT AFTER SPINE** | Too many concurrent rewards/notifications obscure bunker purpose. Insurance and paid-bag recovery already excluded under D1; other monetization and currency decisions are open. |

### P1.3 — Operator milestone hybrid (APPROVED, option C)

**OWNER APPROVAL (7 November 2026): Option C — Operator XP and levels remain a simple background progression, with a limited number of significant player-facing playstyle choices at milestones.** Equipment and attachments remain an independent source of tactical options. Consolidate/reassess minor use-based skills and redundant mastery/stat tracks rather than making players administer them all in parallel.

**Original alternatives (for decision history):**

- **A. Passive/milestone track:** Operator XP/levels and a few consequential unlocks; remove/absorb most use-based numerical skills. Equipment and BIT hold tactical specificity.
- **B. Explicit player builds:** Operator level awards scarce choices from a small, visible set of playstyle perks. Avoid many simultaneous mastery/skill trees.
- **C. Hybrid:** Operator level supplies simple milestones and a small number of meaningful build choices; consolidate minor use-based skills and overlaps with weapon mastery, keeping weapon equipment customization independent.

**Status:** C is approved as the operator progression architecture. Exact unlock milestone levels, number of active perks, branch design, respec rules, and which existing skills are merged or removed remain **OPEN**; do not infer authorization to delete all use-based skills.

**Implementation boundary:** P1.1 and P1.3 are owner-approved design direction; P1.2 is a simplification proposal. Preserve all existing behavior until separately authorized to alter it.

---

## M2 — Monetization Connected to the Meta-Game

**Status: Owner-requested direction, 7 November 2026: currency monetization plus character, bunker room-by-room, and BIT visual customization. The following economy, product catalog, technical plan and pricing are design PROPOSALS, not yet owner-approved detailed commercial rules.**

### M2.1 — Owner intent (CONFIRMED)

The game's monetization needs a strong connection to the persistent meta-game. Robert wants **currency** as a commercial lever alongside **visual purchases for the operator, individually customizable bunker rooms, and BIT**. Room-by-room personalization takes inspiration from the owner-cited **Toca Boca** customization experience, but must fit Protocol Rebirth's mood and technical budget. The owner explicitly requested monetization-loop recommendations.

This is **not** an approval to monetize secure slots, loss recovery, or weapons/power. The approved D1 restriction on insurance and paid bag recovery remains intact. Age/audience and platform requirements will be checked before implementation.

### M2.2 — Proposed two-currency model (NOT APPROVED)

| Layer | Proposed purpose | Sources / purchase | Spend | Constraint |
| --- | --- | --- | --- | --- |
| **Scrap** (existing soft currency) | Earned gameplay economy | Raids, legitimate trades/recycling | Gameplay construction, crafting, repair; optionally a limited set of basic earned decorations | Never require paid purchase for core loop |
| **Signals** (existing premium-like currency name, repurposed) | Premium and occasional earned cosmetic purchasing | Direct currency purchases, a few transparent earned grants | Cosmetic room collections, operator outfits, BIT shells/accessories, cosmetic bundles | Proposed cosmetic-only; remove/reconcile existing Signals-to-Data-Cores exchanges, insurance and paid-bag recovery before release |
| **Data Cores / items** | Rare earned progression materials, distinct from premium wallet | Gameplay | Upgrade requirements / equipment opportunities | Do not allow premium purchase of core progression materials under cosmetic-first proposal |

**A single premium wallet is preferable to adding three cosmetic currencies.** Keep prices in real-money locally displayed where required, and do not make the game economy depend on buying Signals.

**Important existing mismatch:** Current `data/progression.js` and `docs/economy-design.md` still reference insurance, recovery, and Signals-to-progression pathways; the economy design document is historical/proposed and contains obsolete Salvage terminology. This proposal does not silently update implementation or settle old monetization contradictions. If paid utility/resource acquisition is desired, that is a separate explicit design decision requiring risk/fairness review.

### M2.3 — Proposed cosmetic ownership and personalization (NOT APPROVED)

- **Bunker room-by-room:** Restore the functional room via gameplay first, then customize its visual identity using furniture, floors, walls, lighting, displays, decorative machinery, props and a small selection of themed styles. Decoration never replaces the room's gameplay upgrade or blocks Core access. Starter free items and earned furnishings should make the feature useful without purchase. Preview/place/reposition/store/reuse owned decorations.
- **Operator:** Outfits, armor appearances, helmets, colors, patches and weapon appearance wraps are persistent **cosmetic entitlements**, separate from losable inventory stats and attachments. Dying must not delete purchased visuals, and cosmetic choices must not camouflage hitboxes or create an information advantage in PvP later.
- **BIT:** Shells, screens/CRT face treatments, visual expression sets, antenna/hover FX and dock skins, with the same companion functionality regardless of purchase. Own one BIT identity across home and field.
- **Themed product sets:** Example candidate collections: *Nordic Summer Night*, *Cold War Utility*, *Cozy Shelter*, *Salvaged Workshop*, and *Retro CRT*. Can be sold as a room pack, matching operator look and BIT style, or a disclosed bundle; no mystery loot-box presentation recommended.
- **Progression connection:** Completing/repairing a room unlocks its new customization canvas (not a price gate). A visible upgrade creates emotional investment and an optional reason to personalize it. Cosmetic purchases apply immediately and persist on the account.
- **Technical reality:** The inspected bunker currently relies on staged image plates and DOM hotspots, not a freely editable 3D room decorator. Room-level interactive decoration would require a new controlled layer, authored room scenes or slot-based placement; avoid assuming full free-placement or instant parity with Toca Boca World. Prefer low-overhead 2.5D/slot-based room customization for mobile proof-of-fun, then expand based on actual engagement and performance.

### M2.3a — Personal bunker name (OWNER SUGGESTION; PROPOSED UX)

Robert suggested a **player-chosen bunker name**, referencing the ownership and identity established by naming a farm in *Hay Day*. This is a proposed addition to the persistent meta-game, **not yet a formally approved final UX contract**.

**Recommended design:** Let the player choose a short, persistent bunker name as an optional identity action, unlocked after the Core L1 home reveal. Give the bunker an editable, non-generic display identity in the home overview and post-raid return. Naming is **free, renameable, and does not require premium currency**; no name-change fees or competitive benefits. Avoid displaying a compulsory naming form before the first ordinary extraction, because D3.9's signed-off FTUE must remain brief and uninterrupted. A subtle optional prompt can appear at the first return or once the player has demonstrated ownership through a restoration.

The player's chosen name then ties cosmetic room themes into a unified authored home: the storefront sells styles and room expression, **not the right to name or own the bunker**.

**Potential future sharing:** Showcase bunker names and decorations to friends only after cooperative/social systems and privacy policy are separately designed. If player-entered names can be public, add length limits, moderation/reporting, profanity screening and safe defaults. Exact name length, default placeholder, first-prompt moment, allowable characters and cross-device storage remain open.

**Draft BIT reaction only:** “You named it? Well, I suppose that makes it official.” Not approved canonical dialogue.

### M2.4 — Proposed commercial engagement loop (NOT APPROVED)

```text
Raid for components -> extract -> repair/upgrade a room (earned functional unlock)
   -> optionally name the bunker and develop a sense of ownership
   -> discover a personalizable room -> earn a starter cosmetic / preview a themed pack
   -> spend earned or purchased cosmetic currency (optional)
   -> decorate room + coordinate operator / BIT appearance
   -> see identity in bunker and raids -> return for new rewards, room unlocks and collections
```

**Value proposition:** Players pay for *identity, expression and a world worth inhabiting*, not relief from losing raids. Include cosmetic rewards from play so the home stays expressive and meaningful without payment.

**Store design candidates:**
- A small, visible room collection (floor/wall plus a curated set of decor assets) and individually purchasable items.
- Operator + BIT match sets and mixed identity bundles.
- A rotating thematic spotlight supported by a persistent evergreen catalog; do not create artificial scarcity to compensate for shallow gameplay.
- Avoid a paid combat booster, pay-to-extract, paid secure slots, premium raid fuel, premium insurance, and automatic paid progression/rare material packs in the baseline proposal.
- Only consider a cosmetic seasonal pass *after* cosmetics have proven repeat demand; it is not approved now.

**Illustrative price tests, NOT promises or external market benchmarks:** $1–3 individual small cosmetic; $4–8 themed room set; $5–10 operator/BIT appearance pack; $10–16 multi-surface collection. Test willingness to pay and local price tiers before choosing actual price points.

### M2.5 — Open decisions before monetization implementation

1. **Fairness boundary:** Is the premium wallet cosmetic-only (recommended starting model), or is paid time/convenience/resource conversion acceptable? No decision here.
2. **Decoration interaction depth:** Room preset/slot-based editor first (recommended MVP), versus full free placement from the outset (expensive in current DOM-art bunker).
3. **Cosmetic entitlement scope:** Account-wide, permanently owned, re-usable across rooms where technically relevant; exact equip/duplicate policy TBD.
4. **Commercial offer structure:** Direct packs vs wallet vs hybrid, earn rates, catalogs, regional pricing, and whether any room-level cosmetics can be earned through loot without tying purchases to death losses.
5. **Audience/platform guardrails:** Confirm target age, local consumer disclosure, app store rules, in-app purchase mechanisms and safeguards before shipping. Do not assume a children's game commerce pattern is appropriate without matching audience rules.

**Source-grounded inspiration:** Official Toca Boca World documentation describes thematic Home Designer houses, furniture packs, character styles and an initially free decoration set; Fortnite's official item shop provides examples of direct sale cosmetic bundles and styles. This is reference research, not evidence about Protocol Rebirth conversion, ARPPU, revenue or feasible implementation costs.

---

## M3 — World-Class Meta-Game Economy & Monetization Benchmark

**Status: Benchmark and detailed systems remain design proposals. The previously open M3.6 monetization boundary is now resolved by owner-approved Model C (M4): functional progress monetization is allowed. Exact mechanics/pricing still require review.**

### M3.1 — What to learn from the benchmarks

- **Whiteout Survival:** Persistent visible city/furnace development, alliance/social ties, stacked long-lived progression, event-linked spending and layered purchase ladders. Official Swedish App Store listings and game descriptions confirm building, alliances, idle rewards, recurring new development and varied IAP packs. Third-party industry estimates validate unusually large commercial scale but revenue is **estimated and not comparable one-for-one across providers**.
- **Survivor.io:** Accessible action core linked to deep meta and short/long-term purchase offers: gems, monthly cards, Growth Fund, chapter packs, Survivor/Equipment Passes. Apple App Store listings confirm actual sale categories; Naavik's earlier deep dive reports chapter completion bundles, time-limited events and the role of progress-tied offers.
- **Toca Boca World** (user-named identity reference): Room decoration, furniture/style packs, predefined style selection and character customization; cosmetic sets give players recognizable, owned spaces. This is a **creative ownership reference**, not a claim it achieves Whiteout's revenue model.

**Transferable product principle:** A meaningful base/character/companion creates visible long-term goals, and well-timed *optional* products let players express ownership or accelerate carefully bounded progress. Do not transplant social-war spending, random loot boxes or meta bloat into a short-session PvE extraction shooter without proving the fit.

### M3.2 — Proposed economy layers and purchase boundaries

| Layer | Example | Primary source | Main sinks | Boundary |
| --- | --- | --- | --- | --- |
| Earned soft currency | Scrap | Raids, selling/recycling, missions | Crafting, non-premium room furniture, non-rare repair costs | Main everyday economy; must remain viable without purchases |
| Earned materials | Cable, Scrap Alloy, electronics, rare cores | Extracted world loot, missions | Core/Fabricator/Vault/BIT upgrades, equipment | Extraction creates value/risk; no direct paid rare-material bypass in baseline |
| Earned progress (not currency) | Operator XP, BIT Bond | Play/behavior | Milestone choices, relationship utility | No purchased combat talents in initial model |
| Premium currency | Existing candidate **Signals** repurposed | Real-money purchases plus transparent modest earned grants | Permanent cosmetic/operator/BIT/room items; optional limited approved convenience | **Open decision:** cosmetic-only vs tightly bounded paid convenience; no insurance/bag recovery |
| Time-/event-specific tokens | Optional, **one at a time**, only if justified | Participating in themed event | Explicit event catalog of primarily cosmetics | Never stack multiple confusing currencies at onboarding |

**Recommend starting with a cosmetic-first wallet, but unlike a claim that cosmetics alone can recreate Whiteout economics, reserve a later explicit review for bounded paid acceleration.** If considered, acceleration should never purchase PvP combat advantage, eliminate gear death risk, sell extraction success, or make paying the only realistic way to unlock functional rooms. Audit old Signals-to-Data-Cores exchanges and insurance code; these contradict the proposed separation and approved D1.

### M3.3 — Three mutually reinforcing loops (PROPOSED)

**A. Gameplay / progression (everyone):**
```
choose next bunker repair -> raid for parts -> extract -> restore a functional room
-> get a new capability/world destination -> raid with a new purpose
```

**B. Identity / cosmetics (earned + optional spend):**
```
name bunker -> restore a new room -> receive free starting decor
-> personalize room / operator / BIT -> display the personalized home / share opt-in
-> browse curated theme collection -> optionally buy a direct item, set or bundle
```

**C. Live events / repeat commercial relevance (only after core validated):**
```
weekly gameplay reason -> themed event goals tied to normal raids and base upgrades
-> free cosmetic collectible + premium thematic option
-> finish visible, non-compulsory collection -> next theme or room unlock
```

Avoid daily chores that compete with the quick extraction loop. A thematic event should reuse ordinary raid and decorating interactions, not add a mandatory separate minigame and multiple new wallets. A seasonal pass should be considered only when a reliable engagement foundation exists.

### M3.4 — Suggested offer ladder (PROPOSED; initial concept tests only)

| Moment | Offer | Example test price in SEK | Core purchase value |
| --- | --- | ---: | --- |
| First room restored / first cosmetic interaction | Small room starter decoration bundle, direct price | 19–39 kr | Immediate personal expression, no gameplay stat |
| First personalization of BIT / operator | Single permanent style, shell or outfit bundle | 39–99 kr | Persistent identity in both raid and bunker |
| New room unlocked | Specific themed room set with surfaces + curated props | 59–129 kr | Meaningful home transformation; clear item list |
| New theme/collection milestone | Matching bunker/operator/BIT collection | 129–249 kr | Coordinated expression across surfaces |
| Later engaged audience | Seasonal cosmetic pass / membership | Test later, no price approved | Sustained optional cosmetic drops tied to ordinary play |
| Later deep progression audience | Growth Fund / progression-linked deal **only if fairness boundary revised** | Not specified | Reference mechanism, not authorized paid materials/power |

Illustrative SEK amounts are **hypotheses**, not claimed competitor prices or approved store prices. Provide direct-money packs in addition to a premium wallet so cosmetic value is understandable. Avoid manipulative countdowns, fake discounts, random paid loot crates and nontransparent chance systems.

### M3.5 — Cohort and economics validation (PROPOSED)

**North star:** Player enjoyment and sustainable long-term revenue *together*, not ARPDAU at the expense of the core loop.

**Progression funnel:** onboarding completed -> first normal raid extracted -> first Fabricator built -> second meaningful upgrade -> first room named/customized -> D1/D7/D30 retention. Record how long upgrades take for both free and paying cohorts.

**Commerce funnel:** store exposure -> first decoration preview -> first earned cosmetic used -> first purchase -> 30-day repeat purchase -> room-pack attach rate -> operator/BIT cross-surface attach -> cohort net revenue / LTV / ARPDAU / ARPPU. Report purchase concentration and paid-vs-free progression disparity. Segment by cohort and playtime; do not rely on aggregate ARPDAU alone.

**Product tests in sequence:**
1. Does room customization itself feel fun with a free starting set, before real money?
2. Do players voluntarily personalize the bunker, operator and BIT? Do they want to show others?
3. Will players buy clear direct offers, and which content has the highest perceived value?
4. Can a lightweight themed event improve return and engagement without hurting raid completion?
5. Only then test premium convenience proposals in a separately signed-off economy review.

### M3.6 — Owner decisions needed (OPEN)

1. **Paid power boundary: RESOLVED by owner — C, full midcore selling functional meta progression/resources as well as cosmetics (see M4).** Specific sellable resources, caps and fairness safeguards remain subject to detailed design and testing.
2. **Currency UX:** one soft currency **Scrap**, earned materials, and one premium **Signals**. Are Data Cores kept as earned progression resource or merged/removed? Do not add a second paid currency without evidence.
3. **Customization MVP:** slot-based/2.5D room editor vs. full free placement in the current pre-rendered bunker. **Recommendation: small room presets/placement first; expand with proven usage.**
4. **Offer sequencing:** direct items/room bundles first, then premium wallet; delay season pass/Growth Fund/monthly card until purchase motivation and retention are measured.
5. **Social exposure:** optional showcase screenshot/room profile first; multiplayer visits later, only with permission/privacy/moderation and a clear player value.
6. **Audience:** target audience and regional store/platform controls must be explicit before purchasing design is implemented.

**Conflicts to resolve, not hide:** Historical `docs/economy-design.md` calls Signals a premium currency funding insurance/bag restoration and contains stale Salvage assumptions; current `data/progression.js` still includes insurance and paid recovery; `data/modules.js` and saved progression support earned room upgrades. These are *baseline facts*, not approval for monetized risk removal. No code changes in this PR.

### External sources inspected

- Whiteout Survival Swedish App Store: https://apps.apple.com/se/app/whiteout-survival/id6443575749
- Survivor.io Swedish App Store: https://apps.apple.com/se/app/survivor-io/id1528941310
- Naavik, *Evolution of Hybridcasual*, Survivor.io monetization case: https://naavik.co/deep-dives/evolution-of-hybridcasual-deepdive/
- Appfigures, August 2025 top-grossing games: https://appfigures.com/resources/insights/highest-earning-mobile-games-august-2025-worldwide
- Toca Boca World official Home Designer store categories: https://tocaboca.helpshift.com/hc/en/3-toca-boca-world/faq/135-what-type-of-content-is-available-for-purchase-on-toca-boca-world/

---

## M4 — Full Midcore Monetization, Premium Economy and Extraction Integrity

**Owner decision (7 November 2026): ECONOMY MODEL C IS APPROVED AS COMMERCIAL DIRECTION.** Signals and offers **may** sell functional metagame progression, progression resources and acceleration, as well as cosmetic customization of the bunker, operator and BIT. This supersedes M2/M3 recommendations that premium spending would initially be restricted to cosmetic-only or limited convenience. **It does not approve specific rates, packs, live-ops mechanics, individual power items or game-code implementation.** The detailed numbers and boundaries below are design proposals for owner tuning/sign-off.

### M4.1 — Commercial boundaries

- Approved D1 remains unchanged: **no premium insurance, full-bag rescue, death reversal, extra paid Secure Slots or automatic extraction**. Field-carried loot and valuable deployed equipment retain risk; the free Basic Carbine retry remains.
- Functional purchases may **shorten metagame grinds**, but premium ownership cannot remove the need to fight, activate nodes for forward progress, decide to extract, and survive the extraction procedure.
- Separate **permanent unlocks** (room tiers, knowledge, operator milestones) from **expendable raid assets** (weapons, consumables, materials currently carried). A purchased noncosmetic asset put into a raid is at risk like its earned equivalent; display this explicitly before purchase/equip.
- For later competitive PvP: choose either a **normalized combat-power mode** or clearly separate paid-power progression matchmaking. A paid metagame imbalance must not silently transfer into nominally fair PvP.
- Include real-money price clarity, accessible free route to gameplay content, no fabricated deadlines/discounts, no misleading currency exchange, and age/platform safeguards. Economic scale is not a license to hide purchase consequences.

### M4.2 — Three resource planes and sources / sinks (PROPOSED)

| Resource | Gameplay sources | Optional premium sources | Sinks / purpose | Persistence |
| --- | --- | --- | --- | --- |
| **Scrap** (soft money) | Successful extractions, sale/recycle, missions, events | Signals -> disclosed Scrap supply package | Crafting, common materials, room upgrades, utility prep | Secured at home |
| **Physical materials** (Scrap Alloy, Cable, electronics, rare parts) | Extractions, supported gameplay crafting/barter, milestone rewards | Signals -> **specific, disclosed materials**; no RNG mystery crates; rare materials require explicit catalog decision | Core, Fabricator, Vault, BIT Bay, build recipes | Home-stored safe; carried loot risky |
| **Data Cores / research components** | Depth rewards, progression, missions | Optional Signals -> bounded research package; tune scarcity and free path | High-tier technology and equipment research | Secured, not automatically lost |
| **Signals** (premium money) | Clear small free grants in milestones/events, optional non-purchase earn loop | Direct IAP / gift card / bundle grants | Resource/research packages, cosmetic collections, expansion/upgrade accelerator, themed offers | Persistent wallet; only one paid wallet |
| **Operator XP, BIT Bond** (progress, not wallet) | Gameplay / survival / BIT actions | Proposed separate limited metagame milestone boosts; no instant maxed talents without explicit review | Operator milestone choices, BIT capability progression | Persistent progression |
| **Season points** (optional one pass track) | Normal raid and home tasks | Paid premium reward track, not a second paid currency | Deterministic reward ladder | Season-specific only |

**Currencies intentionally not added:** separate paint tokens, room coins, drone gems, and a new 'build speed' premium coin. Avoid overlapping premium wallets. No soft-currency inflow for surviving a failed loot extraction unless supported by explicitly disclosed non-bag activity rewards; D1 is the default.

### M4.3 — Starter numerical economy model (PROPOSED TEST CONFIG; NOT APPROVED BALANCE)

**Signals wallet starter IAP ladder (illustrative Swedish nominal prices, not exchange rate/competitor quote):**

| Purchase pack | Signals | SEK (illustrative) |
| --- | ---: | ---: |
| Trial | 100 | 19 kr |
| Small | 550 | 89 kr |
| Medium | 1,200 | 179 kr |
| Large | 2,600 | 349 kr |

These are unit-economics assumptions only: effective SEK/Signal varies across larger packs, should be presented clearly and verified through store price tiers/taxes, refunds, net receipts and purchase telemetry. Do not imply these are current platform prices.

**Example gameplay/economy offers in Signals:** 100–250 for a common construction supply pack; 300–600 for a targeted Fabricator/Vault materials kit; 500–1,000 for selected advanced research components; 150–400 for an upgrade queue acceleration when genuine construction time exists; 150–450 for a BIT shell or single operator style; 400–900 for room furnishing collection; 900–1,600 for an operator+BIT+room matching theme. No timer is introduced solely to monetize skipping it without an explicit separate decision. No paid bag rescue, guaranteed raid extraction or additional paid Secure Slot.

**Initial free earn hypothesis:** 25–60 Signals per week for an engaged nonpayer through clearly stated milestones/events, plus a finite first-week introduction grant of 50 Signals *after* FTUE (never introduce a shop during the signed-off FTUE). Values must be tuned against catalog affordability, progression time, session economy and ARPDAU; guaranteed earn routes are part of economy testing rather than final commitments.

**Prototype throughput targets for simulation (not shipped promises):** First Fabricator should remain feasible for a typical free player within a few successfully completed early raids. Afterward, choose an illustrative meaningful bunker upgrade cadence of about 3–7 days of ordinary engagement; use player-session distributions to tune, not artificial pain points. Paid acceleration may compress the path, but must not bypass authored discovery/area milestones or clear a raid.

### M4.4 — Commercial offer ladder connected to moments (PROPOSED)

| Moment | Offer archetype | Illustrative SEK test range | Delivery / guardrail |
| --- | --- | --- | --- |
| Post-FTUE first successful standard extraction | **Welcome Back** room starter and small Signals bundle | 19–39 kr | No interruption of tutorial, and free decoration exists |
| Fabricator restored | **Workshop Builder** specific Scrap/materials + optional furnishings | 39–99 kr | Inputs explicit, no guaranteed mission completion |
| First Vault unlock / first losable custom loadout | **Operator Preparation** gear blueprint/resources + cosmetic style | 59–129 kr | No death insurance; any fielded purchased equipment is at-risk |
| BIT Bay milestone | **BIT Companion Set** targeted research component + persistent skin | 59–129 kr | BIT function still earnable, cosmetics permanent |
| New world region or Core tier | **Rebirth Growth Fund** milestone-based Signals/resources, paid tier | 99–249 kr | Earned tier grants by actual milestones; no paid world skip |
| Post-retention/engaged cohorts | **Supply Card / monthly** periodic disclosed Signals or base supply | Price test later | Clear subscription/renewal/cancel disclosure; avoid daily-login compulsion |
| Seasonal content | **Restoration Season** free and paid tracks, cosmetic and some functional rewards | Price test later | Activities use existing raids/base; no pay-only combat content |

**Offer hygiene:** show one context-relevant offer max per completed return/restoration beat rather than stacking modals; optional in the shop, visible content/price/expiry, deterministic rewards, no false discounts or manipulative loss-trigger purchase. Never sell a paid revival on a death screen.

### M4.5 — Commercial progression and event loops (PROPOSED)

```text
A. Core:
select bunker need -> do meaningful raid -> physically extract -> bank resources
-> restore permanent capability -> visibly change home -> new region/goal

B. Paid acceleration:
player sees a transparent missing-resource/upgrade requirement
-> compare earnable location/route and optional disclosed Signals package
-> buy or earn -> complete persistent bunker milestone
-> raid remains playable and extraction stakes unchanged

C. Personal expression:
name bunker for free -> restore room -> get a free starter style
-> arrange slot-based furnishings -> coordinate operator/CRT drone skins
-> earn or buy themed set -> display at home and in-field

D. Live operations:
weekly ordinary-raid challenge / optional room-theme activity
-> deterministic event rewards -> curated time-limited thematic collection
-> next season / larger restoration project
```

**Do not:** invent daily forced chores, lock the free Basic Carbine behind pay, charge for renaming the bunker, create drop chance paid loot crates, allow instant mission/extraction completion, or add a universal upgrade timer solely to sell speed-ups.

### M4.6 — Economy balancing, segmentation, safety and rollout (PROPOSED)

Track a double-entry ledger of Signals and key resources (source, sink, reason, granted/purchased, retained/at-risk), prices, inflation, purchases and progression milestones. Baseline free player session economy before introducing the shop. Run cohort simulations for **free / occasional buyer / regular buyer / high spender** across the first 7, 30 and 90 days. Measure upgrade access gap and the free player's ability to recover from gear losses alongside payer spend.

Core KPIs: D1/D7/D30 retention, time to Core L2 / first personalized room, first extraction and Fabricator, first purchase and repeat rates, cosmetics attach rate, payer conversion, net ARPDAU, ARPPU, LTV, refunds, and paid/free time-to-upgrade ratio. A/B test offer clarity and direct packs, never intentionally worsen the free game to force purchases. **Exclusion/safeguards:** age verification as required, no predatory loss-reactive offers, transparent probability where any chance product is ever proposed, purchase limits/parental controls where relevant, region-specific store and consumer obligations.

**First product validation order:** (1) prove base restoration + room decoration engagement without payments, (2) add reliable Signals wallet and deterministic direct cosmetic packs, (3) A/B test optional disclosed materials and progression acceleration, (4) introduce milestone offers, (5) add a lightweight season only if retention and commercial demand support it.

### M4.7 — Approval and implementation status

**APPROVED by owner:** full midcore **Model C** is the direction, including willingness to sell resources/functional metagame progression alongside visual room/operator/BIT products.

**NOT YET APPROVED:** Specific IAP pack ratios/prices, progression boost types/caps, sellable rare materials or research, timers, pay-to-progress ceilings, season pass structure, real-money monetization copy, or live implementation. Explicitly preserve D1/D2/D3 contracts.

**RESOLVED M5 (7 November 2026):** The owner selected **hybrid C**, with direct resource packages and a milestone-based Growth Fund alongside cosmetic ownership offers. The specific product UX and balance are proposed in M5.

**External benchmarks:** Whiteout Survival and Survivor.io are monetization inspiration, not proof these specific assumptions will replicate their revenue results. The M3 sources remain reference-only.

---

## M5 — Hybrid Commercial Product Structure: Direct Resources + Growth Fund + Cosmetics

**OWNER APPROVAL, 7 November 2026:** Commercial offer architecture **C (HYBRID)** is locked. Protocol Rebirth will support **direct resource/functional-progression offers** for an immediate need, **milestone-based Growth Funds** for longer-term engagement, and **cosmetic identity products** for room-by-room bunker decoration, operator and BIT. This is a commercial product-category decision. Specific Signal prices, reward amounts, release milestones, growth-fund contents and payment configuration remain **PROPOSED**, not approved ship balance.

### M5.1 — Three product families (APPROVED structure; definitions below PROPOSED)

1. **Direct supply / missing-part purchase:** A disclosed, deterministic amount of an existing resource or fixed bundle, bought with Signals or a transparently displayed real-money bundle. The UI presents **earnable location/raid path and optional purchase side by side**. Never pretend an item must be purchased, and never unlock a region or complete an extraction directly by buying it.
2. **Rebirth Growth Fund:** A one-off milestone-value product, purchased explicitly, whose reward track is unlocked by **actual completed permanent gameplay achievements**. Players may buy it later and claim qualifying prior milestones retroactively. Separate a free track from the purchased tier; show total included rewards up front. It is not a recurring subscription, random drop, or calendar-driven daily-login task.
3. **Cosmetic ownership:** Permanent directly disclosed products and themed sets for individual bunker rooms, operator clothes/gear appearances, and BIT shell/CRT face/dock. A functional room is earned through the core loop first; decoration belongs to account identity and is not lost when gear is lost. Bunker naming and renaming remain free.

### M5.2 — Candidate Rebirth Growth Fund v1 product (PROPOSED CONTENT AND VALUES)

**UI placement:** An unobtrusive **Growth Fund** card under the bunker **Projects / Progression** area plus a store tab; not a modal during the locked FTUE or after raid death.

**Unlock to *view*:** After the first successful ordinary extraction and results summary (D3.9 completed). **Purchase is never a requirement to continue.**

**Trigger ledger (server-authoritative in a production online economy):** `growth_fund_id`, `purchased_at`, `milestone_id`, `milestone_completed_at`, `reward_claimed_at`, `grant_transaction_id`. Completed milestones can be previewed before buying, and **retroactive paid rewards** become claimable after a later purchase. Exactly-once grants and purchase restoration required. Avoid double rewards on sync, reinstall, receipt restore or replay.

**Illustrative reward ladder (NOT FINAL TUNING):**

| Achievement milestone | Free-track example | Paid-track example |
| --- | --- | --- |
| Complete FTUE / first normal extraction | 50 Signals or a small earned cosmetic (subject to overlap with separately planned FTUE bonus; **not both by default**) | 150 Signals + a bunker starter prop |
| Build Fabricator L1 | Scrap and one basic cosmetic | 250 Signals + identified components |
| Build Vault L1 | Cosmetic room object or earned resource | 300 Signals + Vault-themed decor |
| Build BIT Bay L1 | BIT accessory palette | 350 Signals + unique BIT shell |
| Reach Core L2 | Earned rare component | 500 Signals + themed room set |
| Reach Core L3 | Permanent commemorative cosmetic | 750 Signals + multi-surface identity bundle |

**Illustrative paid track total** = 2,300 Signals plus specified items, not a promised ROI; purchase price/value ratio must be simulated against economy, receipt costs, regional taxes and cannibalization. Avoid a claim such as “20x value” unless methodology and baseline prices genuinely support it. **Do not tie paid milestones to obtaining the purchased bundle itself**. Milestones remain gameplay-earned even if bought resources speed preparation.

**Growth Fund v1 should follow *bunker milestones*, not raw Operator Level**, because the chosen progression architecture makes restoring the world the principal long-term journey. Operator milestones could support a separate product later but are not authorized now.

### M5.3 — Candidate direct resource product behavior (PROPOSED DETAIL)

**Entry point:** In a functional bunker room's repair panel, show: (a) exact missing items and amounts, (b) a **Find in raid** action that takes the player to a relevant accessible source/route, and (c) **Get materials** which opens an optional purchase sheet. Prioritize the earning path visually; never block closing the offer or entering a raid.

**Catalog test products (all numeric values pending tuning):**

| Candidate product | Example contents | Signals trial range | Delivery |
| --- | --- | ---: | --- |
| Salvage Supply | 100 Scrap + 1 Scrap Alloy | 100–200 | Direct secured home stash |
| Workshop Components | 2 Cable + 2 Scrap Alloy + 20 Scrap | 300–500 | Specific inputs, no randomized loot |
| Electronics Cache | 2 Circuit Boards + 1 Power Cell | 450–750 | Named items; check authored region gates |
| Research Kit | Bounded Data Cores plus named component | 600–1,000 | Advanced progression; verify obtainable free route |

**Cart logic:** For the selected room show only materials **actually missing**; if an offered bundle contains excess, show excess explicitly. Never silently consume Signals to fill requirements. A purchase grants items to the **secured home stash**, not carried raid inventory, avoiding confusion about bag protection. Construction still requires the room to be accessible and all non-material eligibility conditions to be met. The player explicitly presses BUILD. Separate purchasing from building; don't auto-complete it. When stash capacity limits are reached, provide a safe pending-claim queue rather than silently discarding paid goods.

**Anti-exploit:** One authoritative entitlement/grant transaction per purchase, duplicate-receipt handling, refund/reversal policy, server-reconciled Signal balance. Free earned materials, inventory overflow and vault upgrades must remain viable. Rare story/area scouting objects should **not be offered in v1** until approved against world-access rules. No purchase of raid outcome, free-extraction, insurance, extra paid Secure Slot or auto-recover lost items.

### M5.4 — Commercial placement in the actual player journey (PROPOSED UX)

| Surface / moment | What the player sees | Offer type | Display priority |
| --- | --- | --- | --- |
| **Before first ordinary extraction** | No shop interruption | None | Protect D3 FTUE |
| **First completed normal extraction** | Results, Fabricator progress, next mission | Optional small welcome identity pack (store entry after result) | Progress first, commerce second |
| **Bunker overview** | Named bunker, current repair, next unlock, owned cosmetics | Single subtle `Shop` link; optional relevant theme spotlight | Bunker action first |
| **Room detail / build requirement** | Owned/missing material counts, target location, `Find in raid` | Optional `Get materials` purchase sheet | Earn path first; buy is a parallel option |
| **Projects / progression** | World restoration milestones and rewards | Growth Fund free/paid ladder | Nonintrusive, persistent |
| **Room decoration mode** | Free starter set, place/preview slots, owned items | Specific room themes; buy direct or Signals | Decoration first |
| **Operator appearance / BIT Bay** | Preview skins/shells, owned/equipped state | Cosmetics and mixed bundles | No combat-stat ambiguity |
| **Post restoration milestone** | Show real gameplay unlock and visual payoff | One context-relevant offer shortcut, never mandatory modal | Celebrate before sale |
| **Raid death / loss screen** | Actual lost gear/items and free Basic Carbine retry | **No loss-triggered purchase** | D1 risk integrity |
| **Raid underway / extraction countdown** | Combat and extraction only | **No commerce UI** | Safety and clarity |

**Max exposure rule (proposed):** At most one contextually selected offer surface per homecoming/build milestone. Permanent shop access is fine, but no offer stack, forced full-screen sale or dark-pattern countdown. Growth Fund and resource prompts must never interrupt active combat, loot decisions, or extraction.

### M5.5 — Pilot release order and product analytics (PROPOSED)

1. Instrument earned/paid resource ledgers, true missing-part demand, upgrade timing, raid failure rates and Signals grants/spends.
2. Make one room's free decoration loop genuinely fun, and release a small direct cosmetic offer to test willingness-to-pay.
3. Add one or two deterministic **Get materials** offers on genuine repair screens and measure purchase conversion versus free raid continuation and Fabricator completion.
4. Add **one** bunker milestone Growth Fund (free and paid track, retroactive claims); test its conversion, claim rate, effect on return sessions, long-term margin and whether it undermines regular supply pack purchases.
5. Expand to other room/Operator/BIT themes and scheduled event collections once these loops work; do not introduce a season pass or a second Fund at launch merely to inflate offer count.

**Telemetry:** `room_requirement_seen`, `find_in_raid_tapped`, `get_materials_opened`, `bundle_previewed`, `iap_started/succeeded/refunded`, `signals_spent`, `fund_viewed/purchased`, `fund_milestone_unlocked/claimed`, `cosmetic_previewed/equipped`, `raid_started/extracted/died`, `room_built`. Cohort analysis free, occasional, regular and high-paying over 7/30/90 days; purchase conversion, repeat rate, paid/free time to unlock, stalled player percentage, raid participation after spending, ARPDAU/LTV and refund rate.

### M5.6 — Still requiring separate sign-off

- Exact real-money packs and premium Signal conversion rates.
- Exact Growth Fund price, rewards, tier count and whether one-time/batch claim UI is preferable; future funds require separate catalog approval.
- Which rare or upgraded resource families can be sold, quantity caps, entitlement handling on refunds, and whether a particular authored gate requires *actual extraction* of a scouting item.
- Whether bought materials can be used for any room upgrade or only a specified catalog scope; trade/exchange restrictions to prevent unlimited arbitrage.
- Whether recurring memberships, speed-ups, paid XP and passes are introduced at all; Model C permits considering them but C *product structure* does not approve them automatically.
- Presentation, platform/age safeguards, account saving and live receipt validation.

**Hierarchy of decisions:** M4 approves selling functional progression; M5 approves **hybrid product families**. M5's catalog and Growth Fund numerical design are **proposed**, not final. D1/D2/D3 remain intact.

---

## M6 — 30-Day Economy Scenario Model (ANALYSIS, 7 November 2026)

**Status:** Completed **first-pass editable Excel scenario model** at the user's request, using module costs verified in `data/modules.js`, the structural Node Raid loot weights/bonus from `nodspel/levels.js`, starting Scrap from `data/progression.js`, and M4–M5's **unapproved** numerical purchase hypotheses. The workbook is a chat artifact, not committed to GitHub in this docs-only PR. **The results are not a revenue forecast and do not authorize balance changes.**

### M6.1 — Scope and explicit assumptions

- Post-FTUE day 1–30; **Core L1 has already been restored** using the two guaranteed introductory Scrap Alloy. Starts with 20 Scrap (old prototype baseline; requires reconciliation with revised FTUE) and zero spare Alloy.
- Prescribed *modeling* build order (not forced design): **Fabricator L1 → Vault L1 → BIT Bay L1 → Core L2 → Fabricator L2 → BIT Bay L2 → Core L3**. The exact individual module ingredient costs are taken from the current `data/modules.js`; no authored scouting gate simulation and at most one upgrade completed per day.
- Four example *spend and engagement personas* (not measured segment sizes): free 1.2 raids/day, 66% successful extraction, 20% deeper-push share; occasional 1.6/day, 70%, 25%, 89 kr wallet/month; regular 2.2/day, 75%, 38%, 250 kr wallet plus 149 kr one-time Growth Fund; high spender 3/day, 80%, 55%, 1,850 kr wallet plus 149 kr Fund.
- Expected item yields per successful raid are editable **assumptions**, not observed drop frequencies. They take the shape of current node-depth weights but are **not** actual data-driven Monte Carlo outcomes. Expected-value fractional items are a mathematical approximation, not inventory a player literally owns.
- Signals reference 1,200/179 kr; simple example free drip 2 Signals/day plus 50 post-FTUE; abstract **300 Signals deterministic supply basket** of common resources (no story keys). These are test inputs only, not live prices or loot offers.
- Fund example payout: first regular extraction 150 Signals; Fabricator L1 250; Vault L1 300; BIT Bay L1 350; Core L2 500; Core L3 750, for 2,300 possible paid Signals if all conditions met. Prior milestones are claimable retroactively after a day-7 fund purchase. This numeric catalog is NOT owner-approved.
- The four personas differ in **time, extraction skill AND purchases**. Differences in milestones cannot be attributed to payment alone. Revenue shown is **assumed spending per sample persona**, not payer conversion, ARPDAU or population-weighted LTV.

### M6.2 — Initial 30-day expected-value model output

| Cohort | Assumed gross spend per player in 30 days | Expected successful extractions | Fabricator L1 | Core L2 | Latest achieved milestone at day 30 |
| --- | ---: | ---: | ---: | ---: | --- |
| Free | 0 kr | 23.76 | Day 5 | Day 20 | Fabricator L2 (day 28) |
| Occasional | 89 kr | 33.60 | Day 3 | Day 14 | BIT Bay L2 (day 25) |
| Regular | 399 kr | 49.50 | Day 2 | Day 9 | BIT Bay L2 (day 14) |
| High spender | 1,999 kr | 72.00 | Day 1 | Day 6 | Core L3 (day 19) |

**Interpreting this output:** high-spend progress is much faster, but the model deliberately gives high spenders substantially more active raids and success. Rare extracted item requirements (e.g., AI Fragment, Memory Module and Encrypted Drive) prevent an instant all-paid world skip under the current proposed supply basket; a real variance-based simulation may produce wide spreads especially for free players. The modeled Fund generates 1,550 Signals claimed by day 30 for the regular persona and 2,300 for the high-spender, with no assumption of instant checkout purchase pressure.

### M6.3 — Next pass before finalizing economy or store

1. **Same-activity controlled experiment:** Keep attempts/day, extraction rate and depth exactly equal for free and paying cohorts, vary only paid Signals supply and Fund purchases; quantify *spend-only* speedup separately from engagement.
2. **Stochastic loot simulation:** Bootstrap genuine Node Raid mechanics and Monte Carlo 100–1,000 players/cohort; output median, P10/P90 upgrade days, dry streak probability, and resource inflation. Reconcile other zone loot tables and actual traversal depth.
3. **Real player telemetry:** Gather fresh-save first-raid and 30-day session data, attempt and extraction rates, retained loot volume, module completion, sink/source ledger, purchase impressions and actual commercial interest. Current workbook is not calibrated.
4. **Full commercial unit economics:** Add DAU cohort mix, D1/D7/D30 retention, conversion rate, cohort payer share, purchase frequency, store revenue share, taxes, refunds, CPI/ROAS and regional price tiers before making LTV claims.
5. **Fairness boundary:** Verify free players can make steady progress and recover from failures, and paid resource supply does not replace physical raiding, secure a bag, or bypass D1/D2 narrative/scouting requirements.

**Approval boundary:** This is documented **analysis**, not a new owner decision. Model ratios and recommended revisions remain OPEN. No gameplay or payment code has changed.

---

## M7 — Controlled Spend Comparison + Random Loot Simulation (7 November 2026)

**Analysis completed, not a new economy approval.** An updated, editable workbook `Protocol_Rebirth_30_Day_Economy_Model_v2.xlsx` was delivered as a conversation artifact; the **binary workbook is not yet in GitHub**. Model contents, SHA-256 and expected upload location are tracked at [docs/economy/README.md](economy/README.md), which is committed to this docs branch. It retains the original expected-value engine but adds `Simulation Setup`, `Monte Carlo Runs`, `Monte Carlo Summary`, `Controlled Comparison`, and `Simulation Notes`. Its Monte Carlo output is a reproducible **snapshot**, requiring an explicit rerun after changing inputs; the original engine and summary cell formulas remain editable.

**Controlled assumptions:** 1,000 matched random seeds per spend tier (4,000 simulated player outcomes); **exactly the same randomized raids and loot per seed across all four tiers**, 2 attempts/day, 70% extraction chance, 30% deep-choice chance, 30 days after FTUE. Spend = 0, 89, 399, or 1,999 SEK over 30 days. Purchases use the M4/M5 provisional Signals wallet/resource basket and Growth Fund assumptions, **not observed sale behavior**. Functional supply packs exclude rare key gate ingredients. The initial Core L1 is already complete as required by D3.9.

**Loot generation:** Weighted random draws take the relative item weights for the three depths from current `nodspel/levels.js` (e.g. depth 1 Cable 4 / Alloy 4 / Polymer 3 / Salvage Crate 4, depths 2–3 supporting rarer finds). For a successful shallow run, sample two depth-1 items and one depth-2 item; for a deep run, sample two depth-1, one depth-2 and one depth-3 item. This simplified sampling respects a base 4-slot bag but **does not emulate actual spawned locations, pathing, pickup selection, node traversal, stacking, zone gating, true extraction Scrap bonuses or player inventory strategies**. It is a much stronger variance test than assuming fractional loot but **NOT** a calibrated replay of the actual game runtime. Avoid describing these synthetic outcomes as actual code-measured drop rates.

| Spend cohort | Core L2 achieved by day 30 | Median Core L2 day (31 means not achieved) | Core L2 P10–P90, days | Core L3 achieved by day 30 | Mean completed milestones |
| --- | ---: | ---: | --- | ---: | ---: |
| Free, 0 SEK | 89.4% | 16 | 9–31 (31 censored) | 0.1% | 4.348 |
| Occasional, 89 SEK | 89.4% | 15.5 | 9–31 (31 censored) | 0.1% | 4.348 |
| Regular, 399 SEK | 97.6% | 9 | 6–21 | 0.7% | 5.326 |
| High spender, 1,999 SEK | 97.6% | 9 | 4–21 | 0.7% | 5.328 |

All tiers averaged **41.966 successful extractions** in the matched test. On these supply baskets, spending from 399 to 1,999 SEK barely accelerates the median world upgrade because Core's rare key ingredients remain a drop-gated bottleneck. **This is a model diagnosis, not a recommendation to make rare story keys purchasable.** The rare-item/late-Core arrival estimate is especially sensitive to simplified pickup policy and drop tables.

**Immediate economy design actions for next tuning pass:**
1. Preserve a viable free path but inspect why the first Core L2 transition misses the first 30 days for ~10.6% of the matched free group; tune item source clarity and earned crafting/barter/pity routes rather than introducing unjustified paid-only gates.
2. Separate money's mechanical value from real skill/engagement across all later commercial scenarios: paired outcomes are preferable to personas that both spend and play more.
3. Test a second **supply basket design** with targeted *non-story* required items, with caps, to learn whether paying meaningfully accelerates without replacing the need for extracting rare authored access keys.
4. Build a run-level instrumentation harness using **actual** loot generation/retention events (not just `levels.js` weights). Compare observed median and P10/P90 first upgrade days to the simplified model; then iterate prices and fund.
5. Do not infer payer conversion, DAU mix, LTV, revenue, or optimal commercial pricing from this simulation.

**No game code changed; no final price, drop-rate, funded reward, or purchase policy was approved.**

---

## M8 — Economy Simulation Harness and Next Design Decisions

**Status: IMPLEMENTATION SUPPORT PR OPEN, no additional balancing decisions approved (7 November 2026).**

The first **Economy Simulation Harness** has been implemented in separate draft [PR #204](https://github.com/w4sser/protocol-rebirth-proto/pull/204) from `main`, specifically to avoid code changes in design [PR #201](https://github.com/w4sser/protocol-rebirth-proto/pull/201).

- Source `scripts/economy-sim.mjs` reuses the current **real** `generateLevel`, `collectLoot`, `extractRound` / `abandonRound`, `extractScrapBonus` and item `grantsCurrency` code.
- GitHub Actions `economy simulation` runs tests and 1,000 deterministic raid seeds, publishing `runs.csv` and `summary.json` as workflow artifacts. First harness run [#1](https://github.com/w4sser/protocol-rebirth-proto/actions/runs/42356595152) completed successfully.
- This is a **generative loot and optimistic collection calibration**, not real navigation, full combat, big-level extraction, player decision making, or production monetization.
- Offline GitHub Pages remains fully supported because the tool is a Node.js developer/CI script; no backend required. A transaction backend will be necessary later for real-money wallets, receipts and authoritative premium inventory.
- The workbook `Protocol_Rebirth_30_Day_Economy_Model_v2.xlsx` remains a local conversation artifact; the **binary file has not been committed to GitHub** by the connector. The upload path and checksum are recorded under [docs/economy/README.md](economy/README.md).

### M8.1 — Next design workstream (PROPOSED)

1. **Earnable progression baseline:** Specify the target raid count and typical number of calendar days to first meaningful restoration (Fabricator L1), first meaningful risk-management choice (Vault L1), and Core L2 world expansion, without arbitrary timer walls.
2. **Authentic extraction economy:** Upgrade harness coverage to the current big-level mode, node/depth path selection, actual backpack/item swaps, persistent storage and real game result ingestion. Calibrate distributions of earned resource value per attempt/success/depth.
3. **Price-to-progress integrity:** Using calibrated distributions, measure same-activity F2P vs paid at 89 / 399 / 1,999 SEK. Decide explicit caps / allowable resource families only after measuring how purchases alter a 30-day progression journey. No model value is a shipping guarantee.
4. **Growth Fund v1:** Retain **bunker milestones** as the primary proposal (not raw Operator Level), retroactive rewards and free + paid tiers. Resolve whether paid resources are meaningful but not world-key substitutes; define real grant and claim flows after engine calibration.
5. **Persistent home identity monetization:** Define each functional bunker room's starting free furniture, purchasable surfaces and 2.5D slot placement interactions; permanent room/operator/BIT looks, independent of gear death.
6. **Monetization UI contract:** No forced popup during FTUE, raid, extraction, or death; resource upsells appear next to **Find in Raid** options and milestone offers after upgrade celebrations.

### M8.2 — Product question to decide next (OPEN)

**What is the intended *first-week progression rhythm* for a normally engaged, free player?**

- **A: Fast restoration:** Fabricator L1 during the first 2–3 successful post-FTUE raids; Vault/Bit Bay soon after; progression emphasizes frequent room customization.
- **B: Balanced restoration (recommended hypothesis):** Fabricator L1 within the first few successful raids, one more meaningful room upgrade within roughly the first week, Core L2 as a medium-term goal. The number of sessions and days must be tested, not chosen solely to monetize.
- **C: Long restoration:** Core and room upgrades take considerably longer; players collect resources and personalize fewer spaces early, which may reduce the perception of progress before the game loop is proven.

This is **not yet approved**. Work from actual raid retention/loot and the user experience before setting Signal prices.

---

## M9 — Early Restoration Cadence: More Visible Progress

**Owner direction, 7 November 2026 — APPROVED design principle:** The first-week progression should deliver **more frequent restorations and visible changes** than the initial M8 proposal. Keep the previously proposed longer-term Core L2 ambition, but ensure the player feels that something tangible is happening in the bunker early and repeatedly. The individual beats, timings, costs and exact ordering below are **PROPOSALS** for playtest, not approved fixed schedule.

### Two scales of restoration

1. **Major functional room milestones** (Core, Fabricator, Vault, BIT Bay) unlock consequential gameplay capabilities and remain meaningful multi-raid goals. Do not cheaply hand out every major system in the first sessions.
2. **Small, immediately visible restoration beats** change the home between major milestones: lighting circuits, an improvised bed, workbench dressing, repairable power conduits, a corner of the living space, BIT docking furniture and starter decor slots. A beat should give a distinct **before/after** and optionally an earned cosmetic or a new usable space; it must not create another currency, upgrade tree or busywork system.

**Essential FTUE compatibility:** The existing approved D3.9 sequence remains unchanged: introductory extraction, Core L1, BIT reveal, first normal raid, end onboarding at first successful ordinary extraction. Any optional naming, decorative placement or additional restoration should be offered **after** that first ordinary extraction or as a non-blocking optional activity. Do not insert mandatory UI into the approved tutorial.

### Proposed early-week experience (tuning targets, not calendar gates)

| Approximate moment | Player payoff | Relationship to major progression |
| --- | --- | --- |
| First session | Dramatic Core L1 power-up, BIT encounter | Already approved FTUE |
| First 2–3 successful ordinary raids | Fabricator L1, first gear preparation, visibly operable workshop | Core functional path |
| Days 1–2 | Repair lighting in an adjacent space; recover improvised bed / small home area | Small, low-cost visual changes |
| Days 2–3 | First free furnishable corner and cosmetics; BIT docking corner restoration | Free identity on-ramp; **not** BIT Bay L1 gameplay gating |
| Days 3–5 | Vault L1 **or** BIT Bay L1 based on player choice | Preserve choice and distinct payoff |
| Days 5–7 | Another 2–3 small restorations; new cosmetic placement spots; visible progress toward Core L2 | Core L2 remains a larger next goal |

**Practical economy rule:** First-week small repairs should use very low quantities of *already used* Scrap/common resources or free milestone rewards. They must **not consume the exact scarce Cable/Alloy/Polymer amounts needed to unlock Fabricator/Vault**, trapping the free player behind decorative progress. More visual progress must not become extra maintenance or an artificial purchase pressure mechanism.

**Proposed UX:** On a successful homecoming, highlight at most one available small restoration, show its visual delta, and reward the act of repairing with an optional first free decoration. Avoid adding separate level bars or many simultaneous exclamation badges. Decoration is permanent; equipment carried into raids still follows D1 risk.

### Validation before changing live economy

Test whether players can answer *what changed in my home after this raid?* and can identify the next larger functional objective. Measure number of visually meaningful restorations per first 3/5/10 extractions, time to first customization, free-player upgrade stagnation, first-week return and whether small repairs delay Core L2.

**Status boundary:** Owner approved **higher early restoration frequency and visual payoff**, not any exact number of repairs, prices or calendar-locked event schedule. M8 proposed balanced pacing is adjusted accordingly; no game code changed.

---

## M10 — Operator Visual Customization as a First-Class Meta Pillar

**OWNER DIRECTION (7 November 2026):** Character customization must remain a **first-class element** of Protocol Rebirth's meta-game, alongside bunker restoration/decor and BIT customization. Do not let the next room-restoration design pass exclude the operator. The specific catalog, slots, early unlock cadence, and monetization balance below are **proposed details**, not approved final implementation.

### Proposed scope and presentation

- **Persistent operator identity:** select character appearance in a dedicated operator customization view, with accessible previews from the bunker, gear preparation, and cosmetics shop.
- **Visual slots, initial concept:** head/face and hair, upper/lower clothing or full outfit, headgear, backpack/armor appearance, and weapon skins; scope down for the first implementation to **one full-body outfit plus helmet/headgear and a palette** if production budget is tight. A slot is cosmetic unless explicitly a *gameplay equipment* slot.
- **Separation of ownership from risk:** cosmetic entitlements persist across death and are not consumed when the player loses an equipped weapon or armor. Actual weapon/armor performance and losable inventory remain governed by D1. Clearly distinguish 'appearance' from loadout power, especially because M4 allows functional meta purchases.
- **Early free expression:** one or more starter looks and an early earned customization reward shortly after the first successful ordinary extraction, rather than forcing an operator editor into the signed-off D3.9 FTUE.
- **Theme coherence:** curated collections can offer matching operator clothes, a BIT shell/CRT style and bunker room props. Any purchased appearance must be visible regularly from the mobile camera or in home/inspection surfaces to have demonstrated value; do not promise visually invisible microdetails as main products.
- **Technical & competitive integrity:** test silhouette readability, mobile rendering budget, character animation compatibility, gear overlays and future PvP visibility. Do not attach combat stats or protected hitboxes to cosmetic looks.

### Proposed first-week integrated ownership progression

```text
Core L1 / discover BIT (approved FTUE)
  -> first normal extraction completes FTUE
  -> discover free starter operator appearance choice
  -> restore first functional workshop + first small home repairs
  -> unlock free room furniture and BIT paint/CRT treatment
  -> earn/select more outfits through progression
  -> optionally coordinate operator + BIT + bunker in themed store collections
```

**Next design review:** Specify the operator's exact customization categories and first-week free outfit reward **together with** each bunker's customizable rooms and BIT skins. Do not prioritize room furnishings alone at the expense of player identity.

---

## M11 — Player Callsign, Nameplates and Collectible Identity

**OWNER DIRECTION (7 November 2026):** Expand meta customization beyond bunker, operator outfit and BIT. Explore **an individual player/operator name** and collectable, visually distinctive **nameplates**, plus other compelling identity cosmetics. The user cites a remembered game possibly named "Legion Morning" by "Trapdoor"; that exact title/feature attribution was **not independently verified** during research and must not be treated as factual design evidence. Treat the underlying player motivation—own name + evocative presentation—as the creative reference.

### M11.1 — Identity architecture (PROPOSED SPECIFICATION)

Three distinct names and one visual presentation layer:
1. **Player / Operator Callsign:** The player's chosen free, editable visible name (e.g. `ECHO-17`). Local profile identity in the offline prototype; account-level identity later if online profiles are introduced. No premium charge for choosing or changing the name. Do not use this as authentication or as the sole permanent ID.
2. **Bunker Name:** A separate personal home name (M2.3a), also free and editable (e.g. `North Light`). Shown on home overview/return, potentially shared later with permission.
3. **BIT:** The companion retains the narrative name **BIT** and recognizable personality. Cosmetic shells/CRT looks can personalize BIT without needing to alter its canonical story name. Optional pet nickname is a separate unapproved future possibility.
4. **Nameplate presentation:** The actual product is an equipable themed plate/border with material treatment, typography, emblem, visual accent, and optional short title, attached to the callsign. Plate cosmetics are independent of name text.

### M11.2 — Proposed collectible cosmetic surfaces

| Cosmetic | Examples | Earned / purchased | Placement |
| --- | --- | --- | --- |
| **Nameplate frames** | Brushed military tag, salvaged steel, CRT terminal, lighthouse signal, rare animated static | Starter frame free; milestones/events; deterministic Signals store | Profile, home return, raid results, future co-op lobby |
| **Titles / epithets** | The Returned, Signal Hunter, Warden of the Coast | Earned accomplishments and optionally cosmetic bundles for non-achievement titles | Beside callsign in profile/results |
| **Emblems / patches** | Unit insignia, rescued facility seal, custom non-national shapes | Gameplay achievements, cosmetic store | Nameplate, operator sleeve, bunker door |
| **Profile background / banner** | Stormy archipelago, illuminated bunker, analog radar | Earned and purchased | Operator profile, results, future social card |
| **Portrait pose / highlight** | Calm after-action pose, BIT hovering near shoulder, silhouette against searchlights | Milestones and thematic collection | Profile/post-extraction |
| **Arrival/homecoming flourish** | Brief subtle screen reveal/scanline for identity, never obstruct combat | Select premium/earned rarity | Bunker return / result transition only |

**Avoid:** expensive microscopic accessories invisible from the mobile camera, national flags (against established art direction), competitive identification ambiguity, visual noise during combat, or gameplay bonuses attached to a nameplate.

### M11.3 — Proposed player first-week UX

- Keep D3.9 mandatory FTUE intact. After the first successful normal extraction, a single optional `Make it yours` card allows a Callsign, then optionally naming the bunker, with deferral and sensible defaults. Do not stack two obligatory naming dialogs.
- Provide one free identity plate and a starter operator look, a visible free BIT style accent, and a free small room-decorating reward; these should feel like a **cohesive first identity kit**, not four separate currency unlocks.
- Early achievements provide the first distinctive frame/title and a banner, so customization feels rewarding without payment.
- Premium thematic collections can coordinate **nameplate + operator outfit + BIT shell + bunker room/door**. Cosmetic ownership is permanent even when raid equipment is lost under D1.
- In the current offline/PAGES prototype, names and cosmetic loadouts are stored locally (without claiming cloud sync, anti-duplication or unique global player names). If multiplayer/social sharing is added: assign stable internal IDs, moderate public names and offer reports, privacy filters and optional visibility.

### M11.4 — Decision boundaries and next integrated pass

**Approved direction:** individual player identity, nameplate cosmetics and additional compelling customization belong in the roadmap alongside bunker/operator/BIT. **Not yet approved:** exact naming flow, uniqueness, character/name limits, plate art counts, equipped slot counts, sale price, animation scope, public profile sharing, rename cost (recommended always free), or specific rarity tiers.

**Next integrated design deliverable:** A single **Identity & Home Meta** spec showing shared style themes and timed first-week payoffs across **player profile/nameplate, operator appearance, BIT and bunker rooms**, with **free earned / premium purchased** access explicitly marked per content item. Present one coherent home customization UI, not four new progression menus.

---

## M12 — Integrated Identity & Home Meta Design Pass

**Owner direction carried forward, 7 November 2026:** Operator, BIT, bunker and player identity/nameplates must work **together**, not as separate disconnected menus or currencies. **Design specification created:** [Identity & Home Meta](identity-home-meta.md), including player journey, a shared cosmetic inventory, functional-versus-cosmetic boundaries, themed collections, early-week free rewards and non-blocking monetization placements.

**Already approved:** M9 higher early restoration frequency, M10 operator appearance as first-class, M11 callsign/nameplates as a customization pillar, M4/M5 hybrid commercial structure, and D1–D3 extraction/FTUE rules.

**New proposals, not yet approved:** a single `Customize` hub for Operator / Bunker / BIT / Profile, an optional post-FTUE `Make it Yours` identity action, permanent cross-surface cosmetic entitlement model, curated examples of four themed collections, first-five-extractions visibility target and detailed SKU/achievement reward mix. Initial bunker customization uses room-based curated slots/presets compatible with current pre-rendered plates, not automatic commitment to a full free-placement editor.

**Acceptance principle:** A post-FTUE free player can select a visible operator look, earn or equip a nameplate and visibly modify one home element early, and still understand their next functional restoration; no extra currency or mandatory popups. A purchased/earned appearance persists through death, but real deployed gear remains at risk.

---

## M13 — Core Gameplay Must Become More Fun: Tactical Room Problem-Solving

**OWNER DIRECTION, 7 November 2026:** Current core gameplay needs substantial improvement in enjoyment. Investigate **room-specific tactical problem-solving reminiscent of early Metal Gear Solid**: observing a situation, understanding its systems, choosing among approaches, and creating satisfying consequences. This is a **separate core-gameplay quality priority**, not something that cosmetics, meta rewards or higher enemy health can compensate for. The game reference is a *creative inspiration*, not a requirement to copy its stealth systems or copyrighted content.

### M13.1 — Experience principle (proposed)

**Every interesting encounter should offer at least one meaningful decision beyond simply choosing which enemy to shoot.** A subset of authored/templated **special rooms** should present a readable problem, 2–3 viable solutions and clearly communicated consequences.

| Room prototype | Readable problem | Multiple possible player solutions | Meaningful outcome |
| --- | --- | --- | --- |
| **Shielded Relay Room** | Rotating shield turret guards a power terminal | Flank shield; shoot exposed power conduit; use scarce EMP | Different ammo/tool exposure and time spent, same reachable mission goal |
| **Patrol & Alarm Workshop** | Drone patrol watches an equipment cache | Time the patrol; draw it away with decoy/noise; destroy alarm hardware then fight | Lower risk and time reward for preparation; loud route still viable |
| **Flooded Generator Bay** | Conductive puddles and switching electrical relays | Cut power then cross; reroute through maintenance path; risk fast dash | Clear trade-off between speed, hazard and optional loot |
| **Security Door / Camera Hall** | Door is sealed and camera can call reinforcements | Locate override; use alternate exposed route; destroy camera and fight | Distinct routes rather than key-item hunt |
| **Supply Chain Ambush** | Enemy weapons/cover are tied to a visible destructible object | Attack chokepoint, move cover, disable turret power first | Player-engineered advantage, not hidden combat stats |

### M13.2 — Mobile-extraction guardrails (proposed)

- A special room should read within seconds and normally resolve in **20–60 seconds**, not turn an ~8-minute raid into a sequence of tedious puzzles.
- Keep controls compatible with current phone shooting: **aim/shoot, movement, existing interaction, and current gadget/BIT affordances**. Avoid adding 5 separate buttons for each room.
- **Optional solutions, not a single brittle answer.** Combat-forward play remains viable but incurs credible risk/resource costs. Telegraph mechanical interactions through art, animation, sound and BIT context, then let players discover combinations.
- Vary only a subset of rooms/raids at first to preserve combat pacing. Rooms may affect optional caches, enemy threat or forward route opportunity; never silently remove the already-approved return extraction or demand completion of personal objectives (D2).
- Make BIT a **hint and opportunity detector**, not an auto-solve feature or a constant narration stream. Equipment (EMP, decoy, explosives) can open alternate solutions without requiring premium purchase.
- Protect mobile FPS budgets by reusing existing props/logic, and don't design puzzles around tiny details invisible from the top-down camera.
- Prefer **mechanical interactions with visible outcomes** (disable shield, reroute power, redirect patrol, break alarm) over numeric damage/health scaling or abstract switch-color code riddles.

### M13.3 — Cheapest vertical slice (proposal, not authorized code change)

Prototype **Shielded Relay Room** first: one existing shielded turret/defense, a clearly highlighted power supply, and two proven routes: (A) flank/shoot it, (B) disable the power supply to expose it, with EMP as an optional third solution if existing tools support it. Instrument first-time comprehension, whether the player chooses more than one method across attempts, time to resolve, deaths, and whether players voluntarily discuss/experiment with their solutions.

**Research and playtest questions:** Can new players describe the problem in one sentence? Does each method work under time pressure and on mobile? Does the room produce a memorable story? Are choices tactically meaningful or just slower versus faster UI actions? Does it improve enjoyment without bloating raid duration? Can one mechanic be reused across multiple biomes?

**Status:** OWNER-REQUESTED CORE GAMEPLAY PRIORITY, not a locked catalogue of rooms or implementation. No gameplay code modified. Progress through a playable vertical slice and playtesting before scaling.

---

## M14 — Eight-Minute Raid Pacing and Tactical-to-Meta Loop

**OWNER REQUEST (7 November 2026):** Define how combat, exploration, Metal Gear Solid-inspired room problem-solving, return extraction and persistent meta work together inside an ordinary ~8-minute quick PvE raid. Detailed design created: [The Eight-Minute Raid](eight-minute-raid-design.md).

**Approved constraints inherited, not reopened:** D1 controlled risk and basic free retry; D2.1 return extraction available at the start, D2.2 extraction independent of personal objective, D2.3 deliberate short extraction (five seconds as first-test value), D2.4 required nodes open **forward** progress, D2.8 distinct deeper payoff; D3.9 mandatory FTUE structure; M9 early visible bunker change; M10–M12 operator/BIT/profile/home identity; M13 fun and multi-solution tactical problem-solving.

**Proposed rhythm, NOT fixed or shipped:** 0:00–0:30 deploy and orient, 0:30–1:45 first combat and meaningful pickup, 1:45–3:00 one optional tactical special room, 3:00–3:30 decision to extract or go deeper, 3:30–5:30 riskier encounters, 5:30–7:15 distinct deeper payoff, 7:15–8:00 final return/extraction for players who stayed. Short successful raids may end earlier; this is **not a forced eight-minute corridor or automatic end-of-run extraction**.

**Proposed encounter library:** combat pulses (~10–25 seconds), optional tactical special rooms (~20–60 seconds) and optional opportunity/risk rooms (~15–45 seconds). Test approximately one tactical room in an engaged short raid; *not* a mandatory new gate for an ordinary return extraction. Preferred first vertical slice remains Shielded Relay Room with direct flank/combat, destroyable large power relay and optionally an existing EMP. The design specifies controls, telegraph, reward relevance, variation, BIT support, test metrics and mobile performance constraints.

**Meta integration:** A successful extraction gives banked materials for functional and smaller visual bunker repairs, existing operator/BIT progression and selected earned identity cosmetics. Tactical feats may unlock an achievement-only title/nameplate, but loot must still be extracted if it is to enter the home stash. Theme cosmetics are permanent and gear copies remain losable. Premium offers occur at home, never in the tactical/extraction decision.

**Playtest success hypothesis:** Players explain a tactical room's problem and use multiple viable solutions, recall a memorable choice, enjoy the raid more than a matched combat-only run, and do not experience an unacceptable reduction in mobile performance or early extraction clarity. Specific timings, frequencies, rewards and thresholds need direct playtest approval before implementation.

**Decision status:** User requested this integrated **design definition**; exact quantitative rhythm, mechanic selection and commercial effects are PROPOSED, not owner-approved tuning. No code changed.

---

## M15 — Reusable Tactical Encounter Grammar

**Design continuation requested, 7 November 2026.** Detailed proposal documented in [Tactical Encounter Grammar](tactical-encounter-grammar.md). This builds on the owner-requested M13 core-gameplay fun direction and M14 eight-minute gameplay-to-meta rhythm, without authorizing new implementation.

**Proposed six tactical mechanics:** **T1 Cut Power** (relay/shield systems), **T2 Divert Attention** (patrols/noise/decoy), **T3 Flank/Break Sight** (directional weakpoints/cover), **T4 Trigger Environment** (telegraphed hazards), **T5 Disrupt Support** (healers/scout alert networks), and **T6 Trade Access for Risk** (optional valuable routes/caches, not a new input verb). Build encounters by combining one primary rule with a readable enemy role, optional secondary rule, a viable direct-combat fallback, and an optional loot payoff. The same mechanics should recur in bunker, summer-night forest and town instead of individual bespoke puzzles.

**Priority design hypothesis:** Start with T1 + T3 + T5 (clearly connected to existing enemy roles); use Issue [#205](https://github.com/w4sser/protocol-rebirth-proto/issues/205) as the T1/T3 Shielded Relay Room prototype when development is scheduled. T2 and T4 require careful patrol and hazard implementation feasibility; T6 binds tactical opportunity to D1/D2 extraction risk. None of these new environmental interactions is claimed to exist in live code.

**Core constraints:** Preserve D1 loss and fallback, D2 return-from-start and depth-only node gating, D3.9 authored FTUE, readable mobile-camera combat, current controls, ~20–60 s optional tactical rooms, modest content complexity, no paid-exclusive puzzle solutions. A successful solution should generally reduce health/ammo/time cost rather than create an extra premium-loot fountain. A smart tactic may later earn distinctive nameplates/titles under M11/M12.

**Next design questions open:** special-room frequency; whether alternative solutions are competitively viable rather than fake choices; how and when to reward encounter mastery cosmetically; and which systemic tactic transfers best across three biomes. Prototype success must be measured against combat-only rooms before scaling content.

**Status:** PROPOSED detailed design, **not yet owner-approved mechanic catalogue, spawn rates, reward tuning or implementation**. No code changes.

---

## M16 — Enemy Roles & Difficulty Progression

**Requested design definition (7 November 2026):** Each enemy should pose a distinct **tactical question** with a readable tell and at least one free/basic response. Difficulty increases primarily through **combinations, spatial constraints, timing and meaningful deeper-risk opportunities**, not just HP inflation. Full proposed design: [M16 Enemy Roles & Difficulty](enemy-roles-difficulty-design.md).

**Current source references:** `nodspel/enemies.js`, `data/raid-enemies.js`, `nodspel/levels.js`, `nodspel/round.js`. Current visual registry includes basic/patrol grunt, rusher, shield turret, tank, swarm, scout, repair, artillery and sniper archetypes, **but presence in the registry is not proof of full live behavior/spawn support**.

**Proposed encounter pairs:** Grunt+Rusher (move under ranged pressure); Shield Turret+Grunt (target power/flank while exposed); Swarm+Rusher (funnel and keep retreat lane); Repair+Turret (support prioritization); Scout+Patrol (avoid/intercept alert); Sniper+Rusher (cross lanes intelligently); Artillery+other (leave telegraphed strike while still fighting). One primary pressure plus one support pressure in early stages; only add more once players understand both.

**Biomes:** Bunker teaches relay, cover, shield/flank; forest uses open granite/pine sightlines, scouts and rushers; town stresses support links, street crossing and alarms. Forward depth adds complexity, not only stronger stats. Every combination must leave clear, fair options for Basic Carbine users, preserve D2 return extraction, and remain readable/performance-safe on phone.

**Status:** PROPOSED role/encounter progression design; precise spawns, tuning, hard-mode treatment and implementation remain unapproved. No game code changed.

---

## M17 — Weapons, Tools & Combat Builds

**Requested joint design definition (7 November 2026):** Weapons and tools are **responses to enemy tactical roles**, not a universal DPS ladder. Full proposed design: [M17 Weapons, Tools & Combat Builds](combat-builds-design.md) tied directly to M16 and M15.

**Actual existing item-data baseline (`data/items.js`):** free Basic Carbine, Vector SMG, Marksman Rifle, Breach Shotgun; Scavenger Vest, Scout Rig, Dampener Cloak; Decoy (Fabricator L1), EMP/Grenade (Fabricator L2); Long Barrel / Extended Mag / Optic attachments. Availability in data is not a claim every interaction is completely functioning end-to-end.

**Proposed build identities, not added classes:** Assault/All-Rounder (flexible), Breacher (close/knockback), Recon (precision/position), Saboteur (EMP/decoy/environment). Real item selection creates the build, with transparent weaknesses and costs. No new class XP tree. Operator milestones P1.3 remain limited, meaningful choices. Basic Carbine/movement gives viable path to all *required* early encounters; gadgets make specific solutions faster/safer but are never a paywalled key.

**Risk/monetization boundary:** D1 valuable gear and tool charges remain at risk; purchased/earned cosmetics remain permanent. No premium-only enemy counter or risk cancellation. M4/M5 commercial economy is not rebalanced by these proposed builds. Combat choices must be evaluated against both survival and alternative tactics, not only raw time-to-kill.

**Status:** PROPOSED counterplay and player build taxonomy; item numerical tuning, attachment simplification and exact unlock cadence pending mobile playtests. No gameplay changes.

---

## M18 — World & Mission Design: Three Distinct Regions and One Clear Purpose

**Requested continuation, 7 November 2026.** Detailed design proposal: [World & Mission Design](world-mission-design.md). World exploration and progression should create a different, recognizable play experience in Bunker, Archipelago forest and abandoned Town, tying the next raid to bunker restoration, player mastery and the mystery of Protocol Rebirth.

**Existing configured world progression (preserved):** Bunker starts available; Archipelago access requires **Core L2 plus a successfully extracted Archipelago Chart**; Town access requires **Core L3 plus a successfully extracted Town Survey**. The intended world is Nordic summer night with pine forest, lavender/gray granite, sea/islands, industrial bunker and abandoned red/yellow coastal buildings. This is a configured design baseline, not proof all unlocks and geometry are aligned in current live code.

**Proposed differentiated biome jobs:**
- Bunker teaches environmental power, shielding, cover, return extraction and short practical restoration quests.
- Archipelago introduces wider granite/pine path choices, readable scouting pressure and bridge/shoreline navigation.
- Town layers home/searchable interiors, support/alarm systems, sightlines and story traces.

**Proposed mission hierarchy:** One **player-selected tracked purpose** leads; authored world/scouting milestones, BIT daily contracts, optional tactical opportunities and deeper payoff are secondary. Each category settles independently. **D2.1/D2.2 remain binding:** every ordinary raid has at least one accessible return extraction from spawn, which neither a personal goal, scouting chart nor special room can gate. Physical chart/survey must actually come home via successful extraction; Core level is a separate persistent access requirement.

**Important code-baseline conflicts:** `data/raid_zones.js` still contains legacy simulated extraction probability multipliers and old risk routes, while Node Raid / Big Map have physical generation and exit logic. `data/progression.js` retains a historical scripted first hour and insurance/whole-bag recovery assumptions superseded by D1/D3. `data/quests.js` includes BIT daily quests and the Bunker and Archipelago chains but no equivalent authored Town story chain. These are integration/authoring gaps, not new approved features. Do not conflate simulated raid probabilities with the approved D2.3 five-second physical extraction interaction.

**Proposed generation language:** recognizable approach, fork/landmark, tactical room, scavenge pocket, pressure transition, distinct deeper payoff and clear return approach. Ensure seedable physical connectivity, no bridge softlocks or blocking props, meaningful route choice and good mobile FPS. Use shared M15 verbs and M16 enemy roles so biome differentiation comes from tactical decisions, not only visuals.

**Story spine (proposed):** Bunker *A Dead Home* (why does the Core still respond?), Archipelago *Lights Across the Water* (what keeps coastal systems running?), Town *Echoes of Ordinary Life* (what happened to the people, what is rebuilding for?). Quiet, hopeful environmental storytelling with brief BIT observations; no forced lore dialogue during fighting.

**Status:** Design proposal documented and referenced, **not an owner-approved mission catalogue, story canon, region content count, loot table, economic tuning or game implementation**. Recommended follow-on is an implementation audit of live world/quest/extraction paths and a playable mission UX slice, after design review.

---

## M18A — Strong Within-World Raid Variety (Owner Direction)

**OWNER REQUIREMENT, 7 November 2026:** Bunker, Archipelago and Town must each produce **highly varied repeat raids** with different **loot, enemies and ways to play**. The goal is differences in the player's decisions and memorable moments, not simply remixed scenery or higher stats.

**New proposed specification:** [Raid Variety & World Replayability](raid-variety-system.md), linked from [M18 World & Mission Design](world-mission-design.md). Six axes: **V1 topology/route, V2 enemy role composition, V3 tactical opportunity (T1–T5), V4 loot opportunity distribution, V5 bounded dynamic field event, V6 mission/discovery purpose**. A seeded, constrained *Raid Situation Director* is a **design option**, not a live system or approved implementation. Variants should reuse recognizable assets, consistent mechanics and biome grammar; meaningful variation should be validated from what players actually encounter rather than theoretical seed variety.

**Examples proposed:** Bunker relay-defense vs service-wing scavenging vs repair-supported cache; forest scout clearing vs pine/swarm choke vs signal-relay detour; Town house search vs repaired-turret garage vs risky archive crossing. Player build choices (M17) must interact with these differences: the same gun remains usable, but different gear/tactics become situationally preferable.

**Must preserve:** authored D3 FTUE, D1 controlled loss, D2.1 available return-from-start and D2.2 objective independence, D2.3 deliberate physical extraction, D2.4 node gating *forward only*, real quest item reachability, readable threats, collision/bridge routing and verified mobile FPS. No required premium item and no false guaranteed loot promises.

**Proposed acceptance:** In three consecutive committed raids to the same biome, at least two should differ in meaningful **route/encounter decisions**; in five, players can describe at least three distinct memorable situations. This is a playtest hypothesis, not an approved KPI. Audit actual Node Raid big-level variant coverage and compare matched seeds before introducing anti-repeat weighting.

**Status:** Strong replayability **approved as owner direction**. Specific director, content variant counts, spawn/loot weighting, event pacing and code remain **unapproved proposals**. No gameplay code changed.

---

## M18B — Larger Archipelago, More Varied Bunker (Owner Direction)

**OWNER REQUIREMENT, 7 November 2026:** Current Archipelago playable areas feel **too small**, whereas the Bunker footprint **works** but needs more room/encounter variation. Do not apply a single global map scale to all biomes. Updated specification: [M18A Raid Variety & World Replayability, section M18B](raid-variety-system.md#11a-m18b--biome-scale-and-structural-variety-correction-owner-direction).

**Observed source baseline:** `data/raid-big-layout.js` has shared spacing 22 and scale shapes; `nodspel/zone-graph.js` builds a common 6–12-node grid; `nodspel/big-level.js` currently sources Bunker room templates even when assembling other named areas, with subsequent area-specific layers. This suggests an outdoor-topology design/implementation gap, **not** a reliable exact measurement of Archipelago walkable area. Audit full rendering and generation before changing code.

**Proposed Archipelago direction:** Separate area-specific outdoor graph with wider *usable* open spaces, granite shelves, forest glades, multiple approaches, shoreline paths and navigable island crossings. Test 1.5–2x actual navigable footprint **as a hypothesis**, without doubling empty travel time; first actionable encounter/choice should remain close, and early D2 extraction always reachable. Prefer more optional branches and tactical possibilities over longer mandatory paths.

**Proposed Bunker direction:** Keep comparable session/traversal footprint but remix geometry/room order, loops/forks, room functions, enemy combos, power/support interactions and loot locations. Potential modular room identities: Reactor Loop, Storage Branch and Security Wing.

**Constraints:** D1/D2/D3 preservation, ~8-minute full-commit aspiration with viable shorter returns, clear pathfinding/bridges, no trees/props on bridge, actual mobile collision/shooting space, Low >40 FPS test goal, nonempty and valid procedural route/loot mix. No changes to camera or model asset scaling as a substitute for redesign.

**Decision boundary:** Owner-approved **direction** (larger Archipelago, Bunker footprint adequate but greater variety). Numerical area multiplier, exact room counts, route lengths, and topology implementation are **proposed, not owner-signed-off or implemented**.

---

## M19 — Integrated Progression & Content Economy (30/60/90 Days)

**User requested continued design work, 7 November 2026**, while preparing a future Archipelago/collision gameplay recording. Full design specification: [M19 Progression & Content Economy](progression-content-economy.md). This describes how raids, home restoration, Operator, BIT, losable gear, identity and world access become **one coherent player journey**, rather than disconnected leveling systems.

**Existing owner-approved decisions preserved:** D1 controlled-risk exposure, one Vault L1 Secure Slot and free Basic Carbine; D2 short optional return extraction and distinct deeper rewards; D3 fixed introductory sequence; P1.1 bunker drives world/operator drives playstyle/equipment is risked/BIT helps; P1.3 a few meaningful Operator milestone decisions; M5 direct resource products, one-time retroactive Growth Fund and permanent cosmetics; M9 frequent visible early restoration; M10–M12 identity/home pillars; M18–M18B varied areas and larger Archipelago.

**Proposed 30/60/90-day architecture:** Not calendar-gated progression. Early play establishes visible home, functional Core/Fabricator/Vault/BIT upgrades and basic loadout choices; medium-term unlocks and explores Archipelago with distinctive tactics; longer-term introduces Town, deeper combinations, authored discoveries, earned mastery identity and more restored living spaces. Exact days, milestone counts, reward sizes and progression speed are **not approved** and must be tuned to successful-raid cohorts, real economy costs and device playtests.

**One primary Project UX:** Each homecoming visibly tracks banked resources against one chosen bunker/world goal and supplies a corresponding free **Track & Raid** action. Secondary Operator/BIТ achievements, visual repairs and optional products remain unobtrusive. A raid is fun in itself; meta provides lasting reason to return. Small repairs do not introduce another currency or block major room inputs.

**Content economy:** Reuse M15 tactical grammar, M16 enemy combinations, M18A raid variation, a small validated map/landmark library and authored world milestones rather than creating one handcrafted mission per visit. Measure actual player-facing diversity, not generator seed novelty.

**Commerce boundaries:** M5 products are optional and transparent; no purchase bypasses physical extraction or scouting, no rescue/extra Secure Slot, no paid-only counter, no mandatory FTUE monetization. Actual backend authority is required for production purchase and cosmetic ownership; offline Pages data is not production-secure.

**Status:** DETAILED DESIGN PROPOSAL; **no newly approved prices, resources, reward timelines, individual skill-tree removals or implementation**. Next owner review is explicit progression simplification, first ten successful-raid rewards, and subsequent M20 LiveOps.

---

## M19A — Progressive Complexity: Less Early, Deeper Endgame

**OWNER DIRECTION, 7 November 2026:** "Less is more" for progression and onboarding; **endgame may carry more systems and complexity**. The first/main loop stays easy to understand and pleasant to use. Detailed proposal: [M19A Progression Simplification](progression-simplification.md).

**Recommended simplification for review:** One visible bunker Project; Operator XP passively accrues with a few high-value milestone choices (approved P1.3); actual gear and a single optional tool create tactical builds; BIT first acts as a character with practical Bay hardware. Avoid simultaneous foregrounded five use-based skill XP tracks, weapon mastery grind and BIT Bond/talent tree. One Customize hub remains optional after FTUE. No new mastery currency or endgame wallet.

**Proposed endgame expansion:** Advanced encounter combinations, optional hard-mode variants, richer tradeoff-driven builds and meaningful Operator/BIT choices, challenge achievements/earned identity and more sophisticated home decoration. Unlocked through genuine progress and mastery, never time-based chores or shop payments. Preserve D1 risk and D2 extraction as the universal core.

**Decision status:** The **minimal-early, deeper-endgame direction is confirmed by owner**. Specific removal/hiding/consolidation of five use-based skills, weapon mastery and BIT talent structure; migration; unlock levels and late-game scope **remain proposals pending approval**. No code or tuning changed.

---

## M19B — Two Named Identity Nameplates (Owner Copy)

**OWNER CONTENT CHOICE, 7 November 2026:** Add two player-facing nameplates/titles, with exact English wording: **Ghost of the Past** and **No Fear of Tomorrow**. Record under the approved identity pillar M11–M12 and [Identity & Home Meta design](identity-home-meta.md#6a-two-named-player-nameplates--owner-supplied-names).

**Proposed thematic treatment, not approved art/unlock:** Ghost of the Past = old-world memory/archive discovery, weathered lavender metal and faint cyan CRT treatment; No Fear of Tomorrow = rebuilding/courage, deep navy with warm-amber horizon. Prefer earned achievements (Town archive extraction vs voluntary high-risk raid or restoration) but owner has **not** yet specified unlock rules, rarity, purchase availability or art.

**Status:** Exact two names **owner supplied and recorded**; design/earn rules and implementation remain proposals. No code changed.

---

## M19B — Preserve Passive Operator Speed and Bag Burden

**Owner clarification, 7 November 2026:** Removing visible progression clutter **must not remove tactile progression**. Specifically retain the feeling of **getting faster through character leveling**, and of **moving more slowly with a fuller loot bag**. These may operate behind the scenes, requiring no extra upgrade menu or separate skill XP meters.

**Existing code reference:** `nodspel/stakes.js` uses bag/backpack **occupied-slot fraction**, not item kilograms, to apply movement slowdown and increased detection; existing reference notes a potential 20% full-load speed penalty. `nodspel/levels.js` defines base speed and clamps; actual source of level-speed improvements must be audited to avoid double counting. Details and tests in [M19A Progression Simplification — Passive Growth and Encumbrance](progression-simplification.md#passive-growth-and-physical-encumbrance--m19b-owner-clarification).

**Proposed system:** One Operator level with occasional bounded passive speed milestones (no visible Mobility XP grind); continuous readable load penalty and optional small Heavy Load cue; gear offers real speed/defense compromises. High Operator level must not completely erase loaded risk. Speed curve, thresholds and migration of legacy Mobility progression **not yet approved**.

**Status:** Owner direction confirmed, numerical tuning and implementation open. No game code changed.

---

## M19C — First Ten Successful Extractions: Earned Progression, Not Scripted Rewards

**Owner requested the first-ten extraction sequence, 7 November 2026.** Detailed design: [M19C First Ten Successful Extractions](first-ten-extractions.md). An extraction count refers to successfully completed **ordinary raids after the authored intro** and excludes failures; this is a **test cohort lens**, not an entitlement to an upgrade or loot drop. Partial Project progress and voluntary short extraction remain meaningful.

**Observed current source data (`data/modules.js`):** Core L1 costs 2 Scrap Alloy (FTUE); Fabricator L1 is 20 Scrap + 2 Cable + 2 Scrap Alloy and commissions the Scavenger Vest; BIT Bay L1 is 20 Scrap + 2 Cable + 1 Polymer Plate; Vault L1 is 50 Scrap + 2 Polymer Plate + 2 Scrap Alloy and yields stash capacity plus the single D1 Secure Slot; Core L2 is 120 Scrap + Power Relay + Circuit Board + Power Cell + AI Fragment. Source values are current code, **not new owner-approved final balance**.

**Proposed progression of experiences:** #1 extraction confidence and next Fabricator Project; #2 purpose and banked material; #3 visible home/gear benefit if earned; #4 tactical choice and light prep; #5 BIT benefit if BIT Bay truly completed; #6 bag-burden extraction decision; #7 loadout identity; #8 Vault versus Core investment; #9 world reconnaissance preparation; #10 coherent owned-home / operator/goal loop and broader ambition. Completion can slide forward or backward based on actual drops, upgrades, deaths and player choices. **No automatic payout or room unlock at success N.**

**Critical code alignment:** `data/progression.js` includes legacy force-success, guaranteed first-hour loot and paid insurance/recovery incompatible with approved D1/D3; Core L2's legacy zone descriptions do not fully reflect the M18 Archipelago Chart rule. Before implementing, validate actual world-unlock scouting items, free return extraction, current simulated vs Node Raid code path and material attainability. Do not surface impossible quests.

**Status:** Detailed design proposal; specific milestones, pacing rates, cosmetic repairs, passives, sources/sinks, tech migration and implementation pending playtests. No gameplay change.

---

## M20 — Living World Opportunities Inside Ordinary Raids (OWNER APPROVED, 7 November 2026)

**Locked:** The return incentive is a **living world**, not a compulsory daily-contract board. BIT notices fresh, optional leads such as a signal, altered enemy activity or potentially useful salvage. The player can return to the same familiar biome and find a meaningfully different opportunity. There are **no mandatory daily chores or punitive log-in streaks** as the primary retention loop.

**Locked follow-up:** Such opportunities occur as **optional side paths within ordinary raids**, never as a separate mission queue, special mission mode or required pre-raid contract selection. Players choose their primary Bunker Project at home; during ordinary raids they can investigate BIT's lead, continue their planned route or voluntarily extract under D2. Any extra reward must be physically found/earned and extracted under D1; the lead is not a grant or guaranteed rare drop. A side path must not block extraction, forward-node progression or FTUE completion.

**Alignment with recently approved core/meta decisions:** The tracked Bunker Project is chosen at home; directional material opportunities and tactical route choices happen during the raid; large rooms deliver 2–3 visibly meaningful restoration stages **within their existing total material cost**; direct material purchases are unavailable until the player has **earned and built Fabricator L1 through play**. After that point, M4/M5 hybrid commerce (optional deterministic resource offers, Growth Fund and cosmetic ownership) may support but must not replace the normal raid/extract/restore loop. No shop interruption within the locked FTUE or a raid, and never paid insurance, bag recovery or successful extraction.

**Open, not approved by this decision:** Whether BIT previews a lead in the bunker before deployment versus revealing it only during exploration; exact opportunity frequency, persistence/expiry, lead selection, costs/rewards, biome eligibility, tactical encounters, iconography, BIT dialogue, event cadence and any monetization tie-in. Avoid turning optional leads into a daily checklist under a different name.

**Acceptance for the future implementation:** A returning player can understand a fresh possible lead without opening a mission board; an ordinary raid remains complete and worth playing if the lead is ignored; following it creates an extra tactical decision and potential earned payoff, not guaranteed loot. The player can still retreat with their haul, and monetization never triggers during combat or extraction. **Documentation only; no implementation approved.**

---

## Decision history

| 2026-11-07 | M20: BIT living-world leads are optional side routes inside ordinary raids; no separate mission queue or required daily tasks | Owner approved. Presentation and reward cadence remain open. |

| Date | Decision | Status |
| --- | --- | --- |
| 2026-11-06 | D1: Controlled Risk and all five expressly listed rules | Approved by Robert; implementation alignment pending |
| 2026-11-06 | D1-A through D1-D: Secure Slot specification and interrupted sessions | Proposed details; not yet approved |
| 2026-11-06 | D2.1: At least one return extraction available from the beginning of every ordinary quick raid | Approved by Robert; implementation alignment pending |
| 2026-11-06 | D2.2: Successful extraction permitted with an incomplete personal objective | Approved by Robert; implementation alignment pending |
| 2026-11-06 | D2.3: Short, deliberately started, cancellable extraction with movement/aim/fire and no forced new wave in the first test | Approved by Robert for the quick PvE mode; five seconds approved as initial test tuning, not a permanent value |
| 2026-11-06 | M1: Current mode is the quick experience; later explore longer, freer PvP and co-op PvE modes | Scope clarified and future exploration requested; no new mode implementation approved |
| 2026-11-06 | D2.4: Required nodes always unlock forward depth progression in quick mode; finite final stage | Approved by Robert; implementation alignment pending |
| 2026-11-06 | D2.8: Option C — deeper reward opportunities and a distinct valuable final objective/payoff | Approved by Robert; final objective and reward tuning open |
| 2026-11-06 | D2.5–D2.7: Return topology, information hierarchy, and special-mode treatment | Open; not yet approved |
| 2026-11-06 | D3.1: Fight toward the bunker, discover BIT inside; opening line: 'You're late, but you're back.' | Revised owner direction; supersedes BIT-before-combat and bunker-after-extraction assumptions; implementation pending |
| 2026-11-06 | D3.2: Reaching the bunker completes the intro mission as its first extraction; BIT is discovered inside; first ordinary raid follows with BIT | Approved by Robert; implementation pending |
| 2026-11-06 | D3.5: Two guaranteed Scrap Alloy from intro are spent on real Core L1; visible power restoration; Fabricator L1 is next goal | Approved by Robert; implementation pending |
| 2026-11-06 | D3.6: Death before bunker entry resets introductory mission from start with guaranteed loot and free retry | Approved by Robert; implementation pending |
| 2026-11-06 | D3.7: Option B — contextual, non-blocking BIT guidance in first ordinary raid, with relevant help and anti-stall assistance | Approved; exact triggers/dialogue and timing proposed |
| 2026-11-06 | D3.8: Gradually increasing subtle BIT and combat assistance after failed first ordinary-raid attempts, without guaranteed success | Approved by Robert; exact numerical ramp and edge cases open |
| 2026-11-07 | D3.9: All six FTUE closure rules including bunker-entry extraction, Core L1 restoration, first-raid failure rules and onboarding ending at first ordinary extraction | Approved by Robert; design closed for implementation and playtesting, no code changes |
| 2026-11-07 | P1.1: Option C — bunker drives world unlocks, Operator drives playstyle, equipment defines tactical builds, BIT companion growth | Approved by Robert; implementation alignment pending |
| 2026-11-07 | P1.2: Progression simplification and specific system removals | Proposed for review; no system removals approved |
| 2026-11-07 | P1.3: Option C — Operator XP/levels with a few meaningful build choices at milestones, reduce redundant minor skill tracks | Approved by Robert; specifics and removals open |
| 2026-11-07 | M2: Meta-game monetization direction: currency, operator looks, room-by-room bunker customization, and BIT visual personalization | Owner-requested direction confirmed; cosmetic-only economy, catalog, pricing and detailed loop proposed, not approved |
| 2026-11-07 | M2.3a: Optional player naming of the bunker, inspired by farm naming in Hay Day | Owner suggestion recorded; free editable name and prompt timing proposed, not yet final approval |
| 2026-11-07 | M3: Benchmark-led world-class economy concept: three loops, currency layers, cosmetic catalog, event strategy and paid-power boundary | Research/proposals recorded; paid-power boundary subsequently resolved by M4 Model C |
| 2026-11-07 | M4: Full midcore Model C permits functional meta progression/resource sales plus cosmetics, but not raid-success insurance or paid death recovery | Approved commercial direction by Robert; economy ratios, sellable items, caps and offers are proposed |
| 2026-11-07 | M5: Hybrid commercial structure C — direct resource offers + bunker milestone Growth Fund + room/operator/BIT cosmetic products | Approved by Robert; UX details, numerical rewards and prices remain proposed |
| 2026-11-07 | M6: Editable post-FTUE 30-day economic scenario across four sample spend/engagement cohorts | Completed modeling analysis; all scenario input values unapproved and nonpredictive |
| 2026-11-07 | M7: Matched spend-only Monte Carlo, 1,000 seeds x 4 tiers, prototype-weighted randomized loot | Analysis complete; rates/packs synthetic and unapproved, no code changes |
| 2026-11-07 | M8: Separate PR #204 for deterministic offline Node Raid economy harness and proposed first-week progression rhythm | Harness test successful; initial pacing superseded by M9's increased early restoration direction |
| 2026-11-07 | M9: Increase frequency of early visible bunker restorations while preserving meaningful major room milestones and D3 FTUE | Approved direction by Robert; exact beats, costs and timings proposed |
| 2026-11-07 | M10: Operator appearance customization must be a first-class meta pillar beside bunker rooms and BIT | Confirmed owner direction; cosmetic categories, rewards and production scope proposed |
| 2026-11-07 | M11: Player callsign, collectible nameplates and wider identity cosmetics added to the meta scope | Owner direction confirmed; specific names, art, costs and UI remain proposals |
| 2026-11-07 | M12: Integrated Identity & Home Meta specification linking profile, operator, BIT, bunker and monetization | Design specification drafted; detailed mechanics remain proposed |
| 2026-11-07 | M13: Core gameplay must be more fun; explore classic MGS-style multi-solution tactical room problems | Owner-requested design priority; examples and slice proposed, no implementation |
| 2026-11-07 | M14: Eight-minute raid design linking action, optional tactical rooms, extraction choice and persistent meta | Integrated proposal documented; pacing/mechanics to validate in playtest, no code changes |
| 2026-11-07 | M15: Reusable Tactical Encounter Grammar (T1–T6) and bunker/forest/town composition | Design proposal documented; no mechanic catalogue or spawn tuning approved |
| 2026-11-07 | M16: Enemy tactical roles, combinations and difficulty across depths/biomes | Design proposed, spawn/tuning approval outstanding |
| 2026-11-07 | M17: Existing weapons, tools and four emergent counterplay builds linked to M16 | Design proposed, no new classes or item changes approved |
| 2026-11-07 | M18: Three distinct world regions, mission hierarchy, scouting unlocks and raid extraction invariants | Integrated design proposed; catalog/mission UX/content counts pending owner review |
| 2026-11-07 | M18A: Strong repeat-raid variation within every world (loot/enemies/routes/tactics/events) | Owner direction confirmed; situation-director design and quantitative targets proposed |
| 2026-11-07 | M18B: Archipelago playable areas larger, Bunker size retained with higher structural variety | Owner direction confirmed; size multiplier and layouts to playtest |
| 2026-11-07 | M19: One integrated 30/60/90-day progression and content economy linked to raids and home | Detailed proposal; timelines and balance require validation |
| 2026-11-07 | M19A: Less early progression UI, optional deeper endgame systems | Owner direction confirmed; exact track consolidation/open decisions remain proposals |
| 2026-11-07 | M19B: Passive level-based movement growth plus full-bag movement/detection consequences | Owner direction confirmed; level curve and exact penalty retained for later tuning |
| 2026-11-07 | M19C: First ten successful ordinary extractions with actual-resource Project progress | Detailed design proposal; no scripted loot/reward grants by success count |
| 2026-11-07 | M19B: Ghost of the Past / No Fear of Tomorrow player nameplates | Owner-supplied names recorded; art and earning rules proposed |
| 2026-11-06 | D3.3/D3.4: Exact entrance and pickup UI, introductory pacing, BIT follow-up dialogue, tutoring/assistance, and comprehension checks | Open |
