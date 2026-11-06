# Protocol Rebirth - Design Decision Register

| Document control | Value |
| --- | --- |
| Decision owner | Robert Wasser |
| Last updated | 6 November 2026 |
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

**Status: D2.1, D2.2, and D2.3 APPROVED by Robert on 6 November 2026 for the current short-session PvE mode. Remaining D2 details are IN REVIEW.**

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

### Other open D2 decisions

| ID | Detail | Status |
| --- | --- | --- |
| D2.4 | Node roles in the quick mode: deeper access, optional objectives, alternative exits, or a defined mix | Open; no replacement node mechanic approved |
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

The next active design question remains **D2.4: what nodes are for in the quick mode**, without assuming they must also exist in the longer modes.

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
| 2026-11-06 | D2.4 through D2.7: Nodes, topology, information hierarchy, and special-mode treatment | Open; not yet approved |
