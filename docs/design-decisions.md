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

**Status: IN REVIEW. No D2 rule has been approved.**

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

The inspected baseline reference describes normal three-depth raids where control nodes open a level exit, followed by an Extract / Continue decision at early depths. Big Map uses different extraction-availability logic. This is the recorded baseline, not a claim that the recommendation below is already implemented. See [reference section 4](game-design-reference.md#4-an-ordinary-raid-from-intention-to-consequence) and [section 11](game-design-reference.md#11-world-structure-objectives-and-quests).

### Recommended direction - proposal only

**Let the goal guide the expedition, not hold the player hostage.**

1. Give the player one primary personal purpose. Early on, derive it from the next useful bunker improvement; later allow a choice among relevant existing goals. Do not add a mandatory mission-selection menu just to state a goal.
2. Successful extraction is valid even if the personal goal is incomplete. The player banks the actual haul; an unfinished quest stays unfinished, with any legitimate incremental progress preserved according to its own rules.
3. In ordinary raids, make at least one return extraction reachable from the start without first completing every node or killing every enemy. Reachable does not mean instant or safe: the player must physically reach it and finish its communicated extraction action.
4. Use nodes to unlock optional routes, deeper access, valuable objectives, or alternative exits rather than impose the same mandatory cleanup on every run. This is a proposed role change, not an approved implementation instruction.
5. Offer optional detours and discoveries beyond the main purpose. The player should see the potential value and risk, not a checklist that implies every opportunity must be completed.
6. Preserve the existing core promise at a depth transition: extract now to bank the haul, or continue with all exposed possessions still at risk. A level transition is never an automatic bank.
7. Teach the same success/loss vocabulary across normal raids, Big Map, and FTUE. Any special mission with a mandatory objective or unusual exit rule requires explicit approval and communication before deployment.

### Why this is the recommendation

It preserves the extraction decision even when the player finds something valuable before finishing the map's systems. It also separates agency from completionism: leaving with a useful but incomplete haul can be a deliberate success rather than a failed mission disguised as success.

The trade-off is that very short extractions may become efficient. That should be evaluated through destination, travel, danger, loot placement, and deeper reward value rather than silently invalidating an otherwise valid extraction. No loot rebalance, anti-farming rule, or removal of existing kill rewards is approved here.

### Main alternative

Keep the node-gated exit model as the normal rule, but make the required node objective singular and immediately understandable, with an early achievable exit and optional deeper content. This changes less of the existing structure, but the player cannot freely choose to leave while the required gate is unresolved.

### Decision requested next

Should normal raids provide at least one return extraction reachable from the start, with the player's personal goal guiding what they attempt rather than gating their right to leave?

This is the first D2 choice to settle. Exact extraction interaction, normal/Big Map topology, timer behavior, additional objectives, and special-mission exceptions follow after it; they are not implicitly approved by reading this proposal.

---

## Decision history

| Date | Decision | Status |
| --- | --- | --- |
| 2026-11-06 | D1: Controlled Risk and all five expressly listed rules | Approved by Robert; implementation alignment pending |
| 2026-11-06 | D1-A through D1-D: Secure Slot specification and interrupted sessions | Proposed details; not yet approved |
| 2026-11-06 | D2: Mission purpose, optional objectives, and extraction accessibility | In review; recommendation not yet approved |
