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

**Status: D3.1, D3.2, D3.5, D3.6, D3.7, and D3.8 APPROVED — intro combat, bunker-entry extraction, BIT discovery, actual Core L1 restoration using intro loot, and free full intro restart on failure. Presentation details remain OPEN.**

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

### D3.9 — Final FTUE closure package (PROPOSED, awaiting owner approval)

This six-rule implementation contract consolidates the remaining *design* decisions; exact seconds, enemy stats, camera staging, performance and voice line variations should be decided through implementation and mobile playtesting, not mistaken for approved fixed numbers.

1. **Intro layout:** Short authored linear outdoor combat approach to a clear bunker destination; the two guaranteed Scrap Alloy are placed along the mandatory path. Do not introduce node-gating, the full inventory/economy, or a parallel mission structure during this approach. Gameplay begins immediately.
2. **Intro exit/settlement:** Entering the bunker requires one explicit door interaction. This concludes the special introductory mission and banks the introductory items exactly once; **do not** require the ordinary five-second EXTRACT countdown, a normal node clear or a separate interrupting result screen before meeting BIT.
3. **BIT/Core moment:** BIT first appears inside and says the owner's canonical greeting. The player has one meaningful contextual Core L1 activation using the two extracted Scrap Alloy, with a visible power/lighting/door response. Avoid extra tutorial menus or granting the upgrade for free. The Fabricator is shown as the only next major goal.
4. **First ordinary raid:** The normal quick-mode extraction/risk/node rules apply, with BIT's approved context-sensitive guidance. Cable is the suggested tracked immediate goal for Fabricator; there is no mandatory Cable requirement to extract. Forward nodes open depth progression, while a usable return extraction route exists from the beginning and uses the deliberate five-second initial test extraction.
5. **Failure:** Intro death restarts the special intro free with no permanently lost progression or duplicated items. First ordinary-raid death follows normal D1 losses/free Basic Carbine retries and the D3.8 bounded progressive assistance, never an automatic victory, resurrection, or retained carried bag.
6. **FTUE completion:** End compulsory onboarding after the **first successful ordinary extraction** and its honest Fabricator-progress/next-goal presentation; **do not** require completing Fabricator L1, clearing every depth, finding two Cable, or reaching the final stage first. Thereafter the normal game is accessible. If the first normal raid fails, replay with progressively more suitable assistance rather than keeping players in a mandatory pop-up loop.

**Non-blocking UX acceptance criteria (proposed):** After starting, the player can move/shoot without any required explanatory card. The two pickups cannot be permanently missed or duplicated. The player recognizes the bunker entrance, gets an uninterrupted first BIT greeting, spends exactly the earned two alloy, sees an unmistakable change in the home, can explain the first post-home objective, can identify node-forward vs extraction-home separately, and sees accurate banked vs lost inventory after the first regular raid. Every key cue works with audio muted on a small phone viewport.

**Deferred to tuning/test rather than new strategic votes:** exact first-shot/bunker discovery durations; damage/HP/speed assistance multipliers; helper bark cooldowns; exact staging and wording beyond “You're late, but you're back”; spawn placement and encounter intensity; animations/FX; and action button placement. Validate first-run completion, fail/retry, no-Cable extraction, and full-clear paths on phone.

**Boundary:** These six details are a proposed owner sign-off package, **not yet APPROVED** merely because the parent FTUE philosophy was approved. No gameplay code changed.

### D3.4 — Validation questions (OPEN)

- Can first-time players identify the bunker as their destination without BIT guiding them verbally from the outset?
- Is there meaningful shooting and movement almost immediately, with minimal blocking instructions?
- Does discovering BIT feel like a character moment rather than opening another tutorial menu?
- Can players explain *why they should go back into danger* after meeting BIT?
- Is the introductory run's success, loot settlement, and failure behavior consistent with the extraction rules they subsequently learn?

**Implementation boundary:** Existing docs and code describe a direct-raid FTUE with assisted attempts and a different timing of the bunker reveal. This revised narrative direction is **not an assertion that the current build already matches it**, and this docs-only PR does not implement it.
---

## Decision history

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
| 2026-11-07 | D3.9: Proposed final six-rule FTUE closure contract including bunker entry, first ordinary extraction, and onboarding completion | Proposed for owner sign-off; no code changes |
| 2026-11-06 | D3.3/D3.4: Exact entrance and pickup UI, introductory pacing, BIT follow-up dialogue, tutoring/assistance, and comprehension checks | Open |
