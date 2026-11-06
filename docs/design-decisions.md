# Protocol Rebirth - Design Decision Register

| Document control | Value |
| --- | --- |
| Decision owner | Robert Wasser |
| Last updated | 6 November 2026 |
| Review branch | `docs/game-design-reference-2026-11-06` |
| Review PR | [PR #201](https://github.com/w4sser/protocol-rebirth-proto/pull/201) - do not merge until the design review is complete |
| Companion document | [Game Design & Loop Reference](game-design-reference.md) |
| Implementation status | Documentation only. Approval of direction is not evidence of implementation or authorization to merge gameplay changes. |

## Reading this register

**APPROVED** means Robert explicitly accepted the design rule. **PROPOSED DETAIL** is a recommendation awaiting agreement. **IN REVIEW** means the next design question has been opened, not decided. **IMPLEMENTATION CHECK** is work needed to verify or align the game with an approved rule.

Approved decisions supersede conflicting historical design intent. They do not retroactively change what the inspected build actually does. The reference document keeps that distinction visible.

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

**Status: D2.1 and D2.2 APPROVED by Robert on 6 November 2026. Remaining D2 details are IN REVIEW.**

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

**APPROVED.** Every ordinary raid must offer at least one return extraction route available from the beginning. That route must not require completing the personal objective, activating the level's nodes first, or clearing all enemies before it can be used.

Available does not mean instant or safe. The player must physically reach a valid extraction point and complete its extraction procedure. The procedure itself, its duration, the exit's placement, and its behavior during combat remain to be specified. No extraction fee or new cost is approved by this decision.

This replaces the default mandatory-node-gated-return assumption for ordinary raids in the intended design. It does not remove nodes or approve a particular replacement function for them. It also does not change the running game by itself.

### D2.2 - Successful extraction is independent of personal-objective completion

**APPROVED.** A player may extract successfully even when the personal main objective is partly or wholly unfinished.

A successful extraction banks the actual carried haul and returns eligible surviving equipment according to D1. An unfinished quest remains unfinished. Objective progress and rewards are awarded only when their own requirements have actually been satisfied. Extracting early does not automatically count as clearing a depth, completing a scouting goal, finding a missing component, or finishing a quest chain.

Example: a player needs two Cable, finds one Cable and a useful weapon, and chooses to return. The extraction succeeds and the actual possessions come home. The two-Cable requirement is not automatically completed.

**Result distinction:** Extraction outcome, objective completion, and depth-clear progress are separate facts. The result screen and result contract must not collapse them into a single success/failure flag.

### Approval scope and remaining recommendations

Robert's confirmation accepted D2.1 and D2.2. It did **not** approve every proposal discussed alongside them. D1-A through D1-D also remain unresolved.

The following remain proposals:

- Present one primary personal purpose, initially derived from the next useful bunker improvement, without adding an obligatory mission-selection menu.
- Use nodes for deeper access, optional rewards, routes, or alternative extraction points. Their precise roles remain undecided; they may not negate D2.1's ordinary return route.
- Surround the main purpose with optional detours and discoveries rather than a checklist that implies every opportunity is mandatory.
- Apply a consistent, clearly communicated success/loss vocabulary across ordinary raids, Big Map, and FTUE. Mode-specific mapping and any special-mission exception still need an explicit decision; no new exception is granted here.

The D1 rule already remains in force: continuing deeper never automatically banks exposed possessions. Exact access and return topology after a depth transition belongs to the remaining D2 review.

### Design rationale and trade-off

The approved direction preserves a decision to leave when the player finds something valuable before completing the map's systems. Leaving with a useful but incomplete haul can be a deliberate successful extraction rather than being forced to finish a personal task.

Very short extraction runs may become efficient. Evaluate that risk through travel, danger, loot placement, and the value of deeper opportunities. No new anti-farming penalty, minimum kill count, minimum raid duration, loot rebalance, or kill-reward removal is approved here. The former proposal to retain node-gated return as the default ordinary-raid rule was not selected.

### D2.3 - Extraction procedure: next proposal, NOT APPROVED

**Recommendation for the ordinary-raid prototype:** A deliberate start followed by a short, cancellable extraction countdown.

| Aspect | Proposed rule |
| --- | --- |
| Start | Enter the marked extraction zone and tap EXTRACT once. Walking through it must not automatically end the raid. |
| Duration | Start playtesting at five seconds. This is a tuning hypothesis, not an approved final balance value. |
| Player agency | The player can move, aim, and fire while remaining within the extraction zone. No need to hold a UI button throughout. |
| Damage | The player remains vulnerable. Nonlethal damage does not restart the countdown. |
| Cancellation | Leaving the zone cancels the attempt and clears its progress. Re-entering requires another deliberate start. This is not Abandon and does not discard the bag. |
| Completion | Completing the countdown alive secures the haul and ends the raid. Death beforehand follows D1. |
| Enemy pressure | Do not require a newly spawned wave for every extraction in the first test. Existing threats can continue to apply pressure; a quiet departure remains valid. Dedicated extraction encounters would be a separate choice. |
| Readability | Show the zone boundary, countdown, and cancellation clearly; no dependence on audio alone. |

Before implementation, resolve the countdown's interaction with the raid deadline, same-tick death/completion, pausing, app backgrounding, and future co-op. These are open details, not implied approvals. D2.1/D2.2 do not require this particular countdown model.

### Other open D2 decisions

| ID | Detail | Status |
| --- | --- | --- |
| D2.4 | Node roles: deeper access, optional objectives, alternative exits, or a defined mix | Open; no replacement node mechanic approved |
| D2.5 | Extraction topology: spawn distance, return paths after depth transitions, and Big Map mapping | Open; no map redesign approved |
| D2.6 | Objective hierarchy: personal purpose, local tasks, optional rewards, and exit guidance | Open; no HUD redesign approved |
| D2.7 | FTUE and special-mission treatment | Open; no implicit exception to ordinary-raid rules approved |

### Implementation checks required by D2.1 and D2.2

1. In an ordinary raid, the guaranteed return extraction is reachable and usable before node or personal-objective completion, subject only to the eventual extraction procedure and survival.
2. Extracting with an incomplete tracked upgrade or quest banks only the actual haul and correctly leaves unmet requirements unfinished.
3. Extraction does not fabricate `levelsCleared`, node completion, scouting credit, quest rewards, or other objective achievements merely to satisfy old result-ingestion assumptions.
4. Continuing to another depth does not settle the bag. Once topology is decided, verify its return route rather than silently reintroducing the old exit gate.
5. Ordinary successes and failures still follow D1; Secure Slot protection does not turn death into a successful extraction.
6. Check fresh and returning profiles and explicitly document how Big Map, Hard variants, and FTUE map onto the approved rule. Do not assume an exemption or claim those modes were changed.

No gameplay change or fresh runtime test is part of this documentation update.

---

## Decision history

| Date | Decision | Status |
| --- | --- | --- |
| 2026-11-06 | D1: Controlled Risk and all five expressly listed rules | Approved by Robert; implementation alignment pending |
| 2026-11-06 | D1-A through D1-D: Secure Slot specification and interrupted sessions | Proposed details; not yet approved |
| 2026-11-06 | D2.1: At least one return extraction available from the beginning of every ordinary raid | Approved by Robert; implementation alignment pending |
| 2026-11-06 | D2.2: Successful extraction permitted with an incomplete personal objective | Approved by Robert; implementation alignment pending |
| 2026-11-06 | D2.3: Short, deliberately started, cancellable extraction countdown | Proposed for review; five seconds is a test value, not an approved rule |
| 2026-11-06 | D2.4 through D2.7: Nodes, topology, information hierarchy, and special-mode treatment | Open; not yet approved |
