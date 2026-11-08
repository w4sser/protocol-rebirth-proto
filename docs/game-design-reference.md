# Protocol Rebirth

> **Supersession — M19D, 7 November 2026:** [Core, Meta & Commerce Contract](core-meta-commerce.md) is the single source of truth for the connected target design: home Project, probabilistic in-raid material targeting, 2–3 major-room stages within unchanged total cost, and no material offers before gameplay-built Fabricator L1. Earlier conflicting proposals below are historical; unapproved tuning remains hypothetical.

## Game Design & Loop Reference

> **Go out with a purpose. Decide what is worth the risk. Come home with something that changes what you can do next.**

| Document control | Value |
| --- | --- |
| Document status | Living design reference, v4.16 - M27 player choice of Vault or BIT Bay after Fabricator|
| Prepared / updated | 8 November 2026 |
| Design owner | Robert Wasser |
| Audience | Game design, UX, art, engineering, production, and AI-assisted analysis |
| Repository baseline | `w4sser/protocol-rebirth-proto`, `main`, commit `88a9ac6364d0dcf5463c2a5f700f4817960ecaca` |
| Prototype version inspected | `2.28.0`; meta save version `15` |
| Scope | Current short-session PvE design and connected systems; future longer PvP/co-op directions are recorded separately, not specified as implemented modes |
| Verification | Repository documents and selected implementation/data files inspected. No new end-to-end playtest was performed for this document. |
| Subsequent owner decisions | [Design Decision Register](design-decisions.md): D1 and D2.1-D2.3 approved for the quick mode; M1 clarifies current scope and future-mode exploration; D1 details and D2.4-D2.7 remain in review |

### How to read this document

This is a consolidated explanation of the game, not a claim that every design idea has shipped. It deliberately separates six kinds of information:

- **CURRENT**: supported by inspected code or configuration at the baseline above. A data entry is not, by itself, proof that every associated UI path works.
- **DIRECTION**: recorded design intent. It may be implemented only partly.
- **APPROVED**: a decision explicitly accepted by Robert and recorded in the decision register. Approval changes the intended design; it does not prove runtime implementation.
- **PROPOSAL**: a recommendation for discussion, including adaptations of the supplied Helldivers 2 analysis. It is not an approved implementation brief.
- **OPEN**: an unresolved decision, detail, contradiction, or behavior requiring verification.
- **FUTURE EXPLORATION**: a direction the owner wants to examine later, not an approved feature specification, implementation task, or delivery commitment.

Where these differ, both are recorded rather than quietly rewriting history. Numerical values below are a snapshot, not permanent balance commitments. Follow the linked sources when changing them.

**Approved after the inspected code baseline:** D1 establishes full risk for carried and equipped gear, one Secure Slot at Vault L1, removal of BIT's automatic item rescue, removal of insurance and paid bag recovery from the core loop, and an always-available free retry. The exact Secure Slot specification and interrupted-session handling remain open. [D01]

**D2.1-D2.3 are also approved for the current quick PvE mode:** At least one return extraction is available from the beginning, and the player may extract successfully with an incomplete personal objective. Extraction starts deliberately and uses a short, cancellable countdown while the player can move, aim, and fire. Five seconds is the approved initial test value, not permanent tuning. Nodes, return topology, timer/interruption edge cases, and existing-variant mapping still require review. These approvals do not change the running game by themselves. [D01]

**M1 scope clarification:** The mode being designed now is the fast, short-session experience. Later exploration should consider longer, freer PvP extraction and longer cooperative PvE, potentially without node activation as the organizing activity. "PvE only" therefore describes the current quick mode, not an irreversible product-wide ban on future PvP. No new multiplayer mode is approved for implementation. [D01]

**Reading routes:** Read sections 1-4 for the game in one sitting. Read sections 5-12 to understand its systems. For onboarding and UX work, continue with sections 13-14 and the review register in section 18. Read the separate [Design Decision Register](design-decisions.md) for approvals and proposed details. AI tools should also read section 21.

---

## Contents

1. [The game in one page](#1-the-game-in-one-page)
2. [Design pillars and boundaries](#2-design-pillars-and-boundaries)
3. [The connected loops](#3-the-connected-loops)
4. [An ordinary raid, from intention to consequence](#4-an-ordinary-raid-from-intention-to-consequence)
5. [Combat and encounter design](#5-combat-and-encounter-design)
6. [Loot, inventory, extraction, and loss](#6-loot-inventory-extraction-and-loss)
7. [The bunker: restoration as progression](#7-the-bunker-restoration-as-progression)
8. [Economy, crafting, and trading](#8-economy-crafting-and-trading)
9. [Operator and equipment progression](#9-operator-and-equipment-progression)
10. [BIT: companion, capability, and relationship](#10-bit-companion-capability-and-relationship)
11. [World structure, objectives, and quests](#11-world-structure-objectives-and-quests)
12. [Difficulty and replayability](#12-difficulty-and-replayability)
13. [First-time player experience](#13-first-time-player-experience)
14. [UX and information architecture](#14-ux-and-information-architecture)
15. [Between-session and retention loops](#15-between-session-and-retention-loops)
16. [World, tone, art, and presentation](#16-world-tone-art-and-presentation)
17. [Lessons to adapt from the Helldivers 2 reference](#17-lessons-to-adapt-from-the-helldivers-2-reference)
18. [Decisions, contradictions, and scope boundaries](#18-decisions-contradictions-and-scope-boundaries)
19. [What a successful playtest should demonstrate](#19-what-a-successful-playtest-should-demonstrate)
20. [Glossary](#20-glossary)
21. [Source map and maintenance contract](#21-source-map-and-maintenance-contract)

---

## 1. The game in one page

**Protocol Rebirth is a landscape-mobile extraction game connected to persistent bunker restoration, currently focused on a short-session PvE mode.** The player is an operator exploring a damaged Nordic world with BIT, a small hovering CRT-faced companion. Short raids supply the materials, equipment, knowledge, and access needed to rebuild the facility and reach further into the world. Future modes are exploration directions, not existing multiplayer functionality. [S01] [S02] [S03] [D01]

The central fantasy is not simply collecting better guns. It is **turning dangerous expeditions into a place worth returning to**. A dark room becomes operational. A useful tool becomes available. BIT gains capability. A previously unreachable area becomes a plausible next expedition.

The player has two connected responsibilities:

| In the field | At home |
| --- | --- |
| Read threats, move, aim, and survive | Understand the next useful improvement |
| Find supplies that matter to a chosen goal | Spend, craft, equip, or save what came home |
| Decide which fights and detours are worthwhile | Restore the bunker and develop BIT |
| Manage limited carrying capacity and increasing pressure | Choose the purpose of the next raid |
| Extract before the risk exceeds the value | See a concrete consequence of the last raid |

### The central player question

> **"I have something useful. Is the next opportunity worth risking what I already carry?"**

That question only works when the player understands what the loot does, what is at risk, and how to get home. Confusing menus, unexplained currencies, or unclear exit conditions weaken the central decision rather than merely making the interface less attractive.

### Format and scope

**CURRENT:** The prototype is a browser-based static game, with a base/meta layer at the repository root and a Three.js raid layer in `nodspel/`. These are connected through the launch/result flow; they should not be described as two unrelated products. Progress is stored locally. The normal raid clock is eight minutes, while players may end a raid sooner by extracting. The first-time flow is a separate, shorter experience. These are baseline facts about the current prototype, not universal duration rules for future modes. [S01] [S02] [S04] [S05]

**DIRECTION FOR THE CURRENT QUICK MODE:** Accessible PvE extraction tension for a broader mobile audience, not a full military simulation. The bunker is the home and a principal motivation for taking risks. The older blanket "PvE only; no PvP" statement is qualified by M1: it still describes the present focus, but no longer rules out future PvP exploration. [S01] [S06] [D01]

### Current focus and future-mode tracks

| Track | Session and objective direction | Status |
| --- | --- | --- |
| Quick PvE raid | The current short-session experience. Nodes exist in the inspected build; their revised role remains under review. D1/D2 define the approved target risk and extraction behavior. | Current design focus; approved changes are not a claim of implementation. |
| Longer, freer PvP extraction | Later explore more player-directed sessions, with Tarkov as the owner's reference and node activation not assumed as the mandatory structure. | FUTURE EXPLORATION; player counts, squads, duration, objectives, and economy are not decided. |
| Longer cooperative PvE | Later explore extended sessions with other players against AI, potentially with different objectives and pacing from the quick mode. | FUTURE EXPLORATION; team size, revives, loot ownership, and team extraction are not decided. |

These are descriptive tracks, not approved player-facing mode names. The owner's "free for all" reference is not silently treated as a finalized deathmatch, solo-only, or squad ruleset. A shared world and systems may be useful foundations, but cross-mode progression and inventory transfer remain open. [D01]

**Not established by this baseline:** production multiplayer, a server-authoritative economy, cross-device accounts, a shared global campaign, or a released real-money business model. Do not present these as existing features.

---

## 2. Design pillars and boundaries

The following consolidates recorded direction into a common design vocabulary. It is not an instruction to add more systems.

### 2.1 Purpose before collection

A desirable improvement should create a concrete need, and that need should point toward an actionable source. "Find Cable for the Fabricator" is stronger than "Collect resources." A quest must name where an item comes from, and that source must actually support the request. [S01] [S07] [S08]

### 2.2 Risk should produce a decision

Carried loot remains exposed until extraction. Going deeper, taking a detour, replacing an item in a full bag, or bringing valuable equipment should change the player's risk calculation. Clearing a stage is not the same as banking its loot. [S04] [S05]

### 2.3 Combat should create readable problems

Movement, cover, timing, range, and flanking should matter. An encounter should be understandable before it is lethal. Tools should offer an alternative solution, not be the only way a player can pass a basic encounter. [S09] [S10]

### 2.4 Progression should be visible and useful

The player should be able to connect a reward to a changed capability: an extra bag slot, a functioning room, a different weapon behavior, a tool, or a newly accessible location. The current game includes numerical progression too; the principle is not a ban on numbers, but a demand that their benefit be legible. [S07] [S11] [S12]

### 2.5 BIT makes the loop personal

BIT is a companion, not merely a menu for bonuses. Its voice connects danger, loss, recovery, discovery, and rebuilding. Relationship progression, hardware progression, and task assignment should feel related without being confused with one another. [S03] [S13] [S14]

### 2.6 Clarity before complexity

Introduce a system when it helps the player make a meaningful decision. Explain what happened before asking for the next action. Locked content must explain its unlock path. The existence of a system does not justify putting it on the first screen. [S01] [S15]

### Boundaries to preserve

PvE remains the current quick-mode focus. M1 allows later exploration of PvP and longer co-op sessions; it does not insert them into the current implementation scope. Do not add currencies casually. BIT may perform one active assignment at a time. Design proposals that change systems, economy, or player-facing scope require an explicit decision; documenting them does not approve them. [S01] [D01]

**APPROVED D1:** Carried and equipped valuable gear is at risk. One Secure Slot unlocks at Vault L1. BIT does not automatically return lost items, and insurance/paid bag recovery are not part of the target core loop. The player can always retry with the free Basic Carbine. Precise Secure Slot eligibility, quantity, and interrupted-session behavior are not yet settled. [D01]

**APPROVED D2.1/D2.2:** Ordinary quick raids provide at least one return extraction available from the start. Personal-objective completion does not gate that return. The player must still get there and complete extraction; successful extraction does not automatically complete a quest or clear a depth. [D01]

**APPROVED D2.3:** The player deliberately starts a short, cancellable extraction countdown and remains able to move, aim, and fire within the zone. Nonlethal hits do not reset it; leaving cancels the attempt, not the raid. Five seconds is the first test value. No newly spawned extraction wave is required in that first test. This rule is scoped to the quick mode, not automatically to future multiplayer. [D01]

---

## 3. The connected loops

### 3.1 Core session loop

```mermaid
flowchart LR
    A[Choose a useful goal] --> B[Prepare a raid]
    B --> C[Explore and fight]
    C --> D[Find useful loot]
    D --> E{Extract or continue?}
    E -->|Continue at risk| C
    E -->|Extract| F[Bank the haul]
    F --> G[Build, craft, equip, or save]
    G --> H[See a new capability or next need]
    H --> A
    C -->|Death, timeout, or abandon| I[Lose exposed cargo]
    I --> J[Understand the loss and re-equip]
    J --> A
```

The diagram shows the main loss rule. The one approved Secure Slot exception is explained in section 6.4. Historical BIT rescue and insurance definitions are implementation-alignment work, not additional approved protection mechanisms. [D01]

The sequence is illustrative, not a set of mandatory exit prerequisites. Under D2.1/D2.2, the player may return with an incomplete personal goal; neither finding all required loot nor finishing every encounter is a prerequisite for the guaranteed ordinary return extraction. D2.3 defines the quick-mode departure procedure. [D01]

### 3.2 Nested loops and their jobs

| Loop | Player action | Payoff | What it contributes |
| --- | --- | --- | --- |
| Moment-to-moment combat | Read a threat, reposition, attack, recover | Survive or create an opening | Immediate play quality and mastery |
| Room/encounter | Solve a tactical problem, interact, search | Access, loot, or a cleared route | Local accomplishment and pacing |
| Raid | Pursue a purpose, weigh detours, extract | Banked materials and equipment | Risk/reward tension |
| Restoration | Track a requirement, secure parts, activate an upgrade | A functioning bunker system | Tangible persistent progress |
| Equipment | Find/craft gear, improve a build, deploy it | A different or stronger combat option | Preparation and attachment to possessions |
| Operator/BIT progression | Play, learn, develop skills and talents | Persistent capability and relationship | Continuity across success and failure |
| World progression | Improve the Core and complete scouting | New areas and objective chains | Medium-term aspiration |
| Return-session | Collect completed work and select the next goal | A useful starting point for another raid | Continuity between sessions |

**Design interpretation:** The raid supplies the bunker; the bunker gives the raid its purpose. Neither half should become a detached checklist.

### 3.3 The restoration loop in concrete terms

```text
I want the Fabricator online
  -> I need Cable, Scrap Alloy, and Scrap
  -> I know where to search
  -> I find the missing parts
  -> I choose whether to secure them now
  -> I return and activate the Fabricator
  -> I receive the Scavenger Vest and access to crafting/preparation
  -> The next raid has a visible benefit and a new purpose
```

This example uses an existing upgrade and reward, not a new tutorial item. Fabricator L1 currently costs 20 Scrap, two Cable, and two Scrap Alloy; its one-time commissioning reward is a Scavenger Vest. [S07]

### 3.4 The emotional loop

**DIRECTION / SYNTHESIS:** Curiosity -> tension -> a deliberate commitment -> relief or loss -> visible recovery/rebuilding -> renewed ambition.

Success should feel like bringing something home. Failure should create a comprehensible setback and another approach, not uncertainty about what the game did to the player's possessions.

---

## 4. An ordinary raid, from intention to consequence

This section specifies the current quick PvE track. Its approved target changes are distinguished from the older inspected build. Future modes need their own rules rather than inheriting every detail here. [D01]

### Before deployment

The player identifies a purpose: a tracked upgrade part, a quest, scouting an area, a useful weapon, or a deliberately larger haul. Available preparation draws on the player's equipment, consumables, tools, BIT capabilities, and unlocked destinations. The early flow restricts preparation before the Fabricator is online. [S07] [S11]

**UX requirement:** The preparation screen should answer three questions before exposing extra statistics: Where am I going? Why am I going? What am I putting at risk?

**APPROVED D1:** Insurance is excluded from the target core preparation loop. This is a design change to align in implementation, not a claim that the old configuration is already removed. [D01]

### During the raid

**CURRENT AT THE INSPECTED BASELINE:** The standard structure has three depths within a shared round. The player moves through spaces with enemies, cover, loot, and control nodes. In the ordinary non-Big-Map flow, all nodes on the current level must be active before its exit opens. Nodes can be interacted with through the supported shooting/proximity mechanics, with shielded variants creating additional problems. [S04] [S09]

The baseline does not automatically require killing every enemy to open an exit. Its node-gated return is recorded here as implementation history, not the newly approved future rule.

**APPROVED D2.1:** Every ordinary quick raid must offer at least one return extraction available from the beginning, without first activating the level's nodes, completing the personal objective, or clearing all enemies. The player must physically reach and complete extraction; availability does not promise safety or an instant exit. [D01]

**APPROVED D2.2:** Extracting with a partially or wholly incomplete personal objective is a successful extraction. Only the actual haul is banked. Unfinished objectives remain unfinished and receive only the progress or rewards their own conditions support. [D01]

### Approved quick-mode extraction procedure

**APPROVED D2.3:** A deliberate start followed by a short, cancellable countdown. [D01]

| Step or event | Approved behavior |
| --- | --- |
| Enter the marked zone | Show the EXTRACT action; merely walking through does not end the raid. |
| Tap EXTRACT once | Start the countdown. Five seconds is the first playtest value, not a permanently fixed balance number. |
| During the countdown | The player may move inside the zone, aim, and fire without holding an interaction button. |
| Take a nonlethal hit | Health/damage rules still apply, but the countdown is not reset. The player remains vulnerable. |
| Leave the zone | Cancel and reset the extraction attempt. The raid continues and the bag remains exposed; this is not Abandon. Returning requires another deliberate start. |
| Finish alive | Secure the actual haul and end the raid. Death before completion follows D1. |
| Enemy pressure | Existing threats may continue to attack. A new extraction-specific wave is not required in the first test, and a quiet departure is valid. |

The zone, countdown, and cancellation must be readable without sound. The first test does not add an extraction fee, a compulsory final kill count, or a forced wave. [D01]

**OPEN DETAILS:** Node roles, return topology, countdown/deadline priority, same-tick death/completion, pause/background behavior, and existing-variant mapping require explicit follow-up. Dedicated dramatic extraction encounters would be a separate choice. Do not infer that all nodes were removed or the running game was changed. Future team extraction is not specified by this single-player-oriented quick-mode contract. [D01]

**APPROVED D2.4/D2.8:** Required control nodes consistently open the **forward route** to the next part of the quick raid; they do not gate the separately available **return extraction**. The raid has an authored final stage, with better reward opportunities deeper in and a meaningful terminal objective/payoff. The exact final encounter or reward is not yet specified; a boss and an automatic full-clear bonus have not been approved. [D01]

### At a depth exit

In the inspected baseline, after an early depth, the player may extract or continue. Continuing does **not** secure the bag. The same carried value remains at risk in the next depth. The final normal depth completes the raid when the player deliberately enters the available exit. [S04] [S05]

The no-banking-on-continue rule remains approved under D1. The baseline's automatic-on-entry final extraction needs alignment with D2.3's deliberate start; it is not an additional approved exception. D2's topology review must specify how ordinary return routes work after a depth transition without silently treating the historical node gate as the target rule. [D01]

**CURRENT variant:** Big Map has separate extraction availability logic and multiple extraction definitions. It should be treated as a mode-specific structure, not assumed to follow every rule of the three-depth flow. Big Map's presence is not proof that the future longer PvP or co-op modes already exist. [S04] [D01]

### Pressure during a run

Several configured systems constrain indefinite wandering:

| Pressure | Current design/data | Intended decision |
| --- | --- | --- |
| Round clock | Eight-minute normal budget; Hard uses a shorter clock | Finish the purpose or leave before time runs out |
| Hunter waves | Alarm after 75 seconds, then waves on a 45-second cadence | Avoid treating cleared space as permanently safe |
| Healing allowance | A shared 60 HP raid healing budget | Decide when further damage exposure is no longer worthwhile |
| Carrying capacity | Base bag of four; progression can raise it, capped at ten | Prioritize what to bring home |
| Bag burden | Configured full-bag penalties up to 20% movement speed and increased detection | More value can also make leaving harder |
| Deeper encounters | Additional enemies, encounter combinations, and valuable loot | Accept greater danger for a better return |

These are baseline settings, not universal guarantees for FTUE or every mode. Waves use a fixed clock, not a separate heat mechanic. Spawn rules seek hidden, distant valid locations rather than simply placing hunters beside the player. D2.3's rejection of a compulsory new extraction wave does not remove this existing raid-pressure system. [S04] [S09] [S11] [S16] [D01]

### After the raid

Successful loot is reconciled into the persistent economy. Currency-bearing pickups convert to the relevant currency; materials and gear have different storage destinations. An unsuccessful raid records loss rather than silently treating a previous depth as a successful bank. The result should then lead back to a useful next action. [S02] [S05] [S08] [S12]

**D2.2 result contract:** Extraction outcome, personal-objective completion, and depth-clear progress are distinct facts. Early extraction must not fabricate cleared depths, completed nodes, scouting credit, or quest rewards merely to satisfy old result-ingestion assumptions. [D01]

**PROPOSAL for result-screen hierarchy:** Outcome -> what came home or was lost -> progress toward the chosen goal -> one recommended next action. Secondary XP bars should not obscure that explanation. A protected item must be shown separately from successful extraction rather than implying the entire failed raid was a success. [D01]

---

## 5. Combat and encounter design

### 5.1 Player capabilities

The player moves, aims/fires, uses cover, dashes, interacts with nodes and loot, and uses available healing or a selected tool. Weapon range, damage, firing/reload behavior, spread, and assistance create different handling profiles. Avoid deriving current input behavior from the old Node Raid README; it describes an earlier combat model. [S09] [S10] [S12]

### 5.2 Weapon identities

| Weapon | Current identity | Decision it should support |
| --- | --- | --- |
| Basic Carbine | Always-available starter; forgiving guided tracer behavior | Re-enter the loop without needing a replacement gun |
| Vector SMG | Fast fire and a larger magazine at shorter range | Maintain pressure while moving and managing proximity |
| Breach Shotgun | Short-range pellet fan and knockback | Commit to a close engagement and exploit space/control |
| Marksman Rifle | Longer range, stronger deliberate shots, slower cadence | Use sightlines and time attacks carefully |

These are existing weapon families. The document does not imply that every family is equally balanced or available during onboarding. [S12]

### 5.3 Enemies as tactical problems

The inspected encounter configuration includes the following roles:

| Encounter | What the player reads | Non-tool response | Tool-assisted response |
| --- | --- | --- | --- |
| Patrol / grunt | Detection cone or a telegraphed firing line | Avoid its view, sidestep, flank, or attack from an advantageous angle | Decoy can redirect attention |
| Front-shield guard | Protected front, slow turning, burst and recovery | Circle to the side/rear or move during recovery | Decoy can pull it away from its position |
| Sentry / turret | A firing lane and a recovery window | Use cover and advance between attacks | EMP provides an opening |
| Grenadier / thrower | A marked landing area before the blast | Leave the ring or interrupt the enemy | A tool is not required to understand the solution |
| Rusher / swarm | A charge or emerging close-range group | Sidestep, retreat, or funnel enemies through constrained space | Grenade can clear a cluster |
| Shielded node | A visible generator/shield relationship | Break the generator | EMP temporarily disables the shield |
| Locked passage | A locked direct route and an alternative | Find the keycard or take the longer route | Not every obstacle requires a tool solution |

The rows summarize configured problems, not a promise that all appear in every area. Front shields are directional; a shielded enemy should not be interpreted as invulnerable from every angle. [S09] [S10]

### 5.4 Toolkit

The current toolkit contains **Decoy**, **Grenade**, and **EMP**. The loadout supports one tool type for a raid, with limited charges; Fabricator progression and recipes supply them. Medkits are a separate consumable/kit system. [S08] [S12]

The point is to make preparation relevant without making it a test with one correct answer. A player should be able to recognize a problem in the field and understand why a different tool would have helped next time.

### 5.5 Temporary raid upgrades

**CURRENT:** Field perks are temporary, not permanent account upgrades. The configuration offers them after two room clears and includes a four-second choice timeout. Examples include Chain Reaction, Calm Reload, Rolling, Emergency Shield, Field Medic, Recon, Field Dressing, and Ricochet. [S17]

Their job is to add variation within a run. Their presentation must make their lifetime clear: **"For this raid"**, not an ambiguous upgrade that appears to persist forever. FTUE suppression and default timeout behavior should be checked in the actual flow rather than inferred from the card list.

### 5.6 Readability is part of difficulty

Telegraphs, projectile visibility, impact areas, enemy orientation, and recovery windows communicate the rules. Difficulty should come from responding to a readable problem, not from invisible attacks or contradictory cues. Existing combat data supports flanking/unaware bonuses and explicit warning behavior. [S09] [S10]

---

## 6. Loot, inventory, extraction, and loss

### 6.1 Three different places a possession can be

| State | Meaning | Risk |
| --- | --- | --- |
| At home | Persistent materials, gear, or currency already secured | Not lost merely because the next raid fails |
| Carried in the raid | Newly found materials and unequipped carried gear | Exposed until successful extraction, except the approved Secure Slot rule |
| Equipped in the raid | Selected weapon/armor and relevant carried supplies | Valuable equipment is part of the raid's risk; the basic free weapon is the fallback |

**CURRENT:** Unequipped backpack gear shares the raid's overall carrying-space constraint with materials and also has its own smaller backpack limit. Medkits use a dedicated kit count rather than ordinary material-bag slots. Encounter keycards are handled separately. [S04]

### 6.2 Home storage

The **Stash** holds materials. The **Armory** holds equipment, consumables, tools, and attachments. Their capacitiesities are separate: current data starts each at 12 slots, with Storage progression expanding them. Stack sizes are item-defined; do not equate a home-storage slot with a raid pickup. [S07] [S12]

This separation prevents a material-cleanup workflow from implicitly treating a valuable weapon as disposable clutter. It also lets preparation focus on usable gear while construction focuses on required parts.

### 6.3 What makes loot meaningful

A found item should communicate at least one actionable use: a tracked build, a recipe, a quest, a scouting unlock, a trade, equipment, or sale value. The shared `itemInfo` helper derives usage from actual module and recipe data, reducing the chance that a description promises a nonexistent use. [S08]

A full bag creates a comparison: keep the parts for today's goal, replace them with rarer future value, or extract. The interface must distinguish the amount already **HOME** from the amount still in the **BAG**.

### 6.4 Approved loss rule and remaining specification

**APPROVED D1 - Controlled Risk:** Carried and equipped valuable gear is at risk until extraction. Death, timeout, and deliberate abandonment lose exposed cargo and risked equipment. Possessions left at home and previously earned permanent progression remain intact. Advancing to another depth never banks the bag. This is the current quick-loop contract; future modes require an explicit decision about what they share or vary. [D01]

Vault / Storage L1 unlocks **one Secure Slot** as the single item-protection mechanism. BIT's automatic item rescue is removed from the intended design. Insurance and paid bag recovery are removed from the core loop. A free Basic Carbine retry must always remain possible; this does not restore the previous bag or grant free replacement armor, tools, or medkits. [D01]

**OPEN DETAILS, not a reopening of D1:** The owner has not yet finalized one unit versus a stack, allowed item categories, whether the protected item occupies ordinary bag capacity, exact in-raid selection/settlement, or interrupted-session behavior. The recommendation is one unit using ordinary capacity, with materials/ordinary valuables eligible but no equipment or dedicated mission/scouting keys. These refinements remain proposals in D1-A through D1-D, not approved facts. [D01]

**IMPLEMENTATION ALIGNMENT:** Baseline data and historical documents still contain Storage secure-slot copy, BIT Bond rescue, Guardian Safe Return, insurance, and post-death bag recovery. Audit and align their active and legacy paths with D1. Their continued presence is not an alternative approved design. No runtime removal or full end-to-end verification is claimed by this documentation change. [S07] [S11] [S13] [S14] [D01]

Persistent learning is separate from preserving loot. D1 preserves previously earned progression but does not set new XP awards for a failed run. Any protected-item result must be explicit, limited to the final eligibility rule, and reconciled exactly once.

---

**APPROVED P1.1 — Progression architecture C:** The bunker drives world development and is the clearest long-term objective; Operator progression drives the player's playstyle; gear/loadout provides tactical choices at risk under D1; BIT develops as a companion through relationship and useful field capabilities. These are complementary roles, not four equally prominent competing goal trees. Every major upgrade should explain both the new choice/capability it creates and where it will be felt in the next raid or at home. [D01]

**OPEN P1.2–P1.3 (simplification proposals, NOT owner-approved removals):** Keep the Core, Fabricator, Vault and BIT Bay as distinct purposeful facilities, but review the overlap between operator level, use-based skills, weapon mastery, Mk/attachment upgrades, BIT Bond and hardware, and ancillary maintenance systems. BIT must already be encountered and able to accompany the player before BIT Bay L1; therefore the existing description that BIT becomes 'online' only when building BIT Bay L1 conflicts with approved FTUE and needs implementation reconciliation. Likewise, BIT item rescue/insurance language conflicts with D1. Do not remove features solely because they are listed for audit. [D01] [S07] [S11] [S13]

## 7. The bunker: restoration as progression

The bunker is a persistent place whose systems become functional. Its progression gives meaning to otherwise generic resources. The base presentation uses staged artwork and interactive room hotspots, while raids use the separate 3D game layer. This distinction matters for implementation, not for the player's understanding of one connected world. [S02] [S07]

### Main facilities

| Facility | Role | Current progression examples and approved direction |
| --- | --- | --- |
| Rebirth Core | Power, facility access, broader progression gates | L1 restores initial power; L2 opens further access and module caps; L3 supports Town access |
| Fabricator | Crafting, recycling, and preparation | L1 awards a Scavenger Vest and basic crafting/prep; L2 provides advanced recipes and tools |
| Storage / Vault | Capacity and inventory convenience | Stash expansion, Armory expansion, additional raid carrying capability; one Secure Slot at L1 approved by D1, with its detailed specification pending |
| BIT Bay | BIT hardware and supported capabilities | Initial functionality and loot intelligence; later cargo capability |
| Living Quarters | Rest and readiness | Rest is configured to restore some bunker power and provide a shield benefit for the next raid |

Living Quarters exists in the room/access and rest systems; it should not be presented as an identical multi-level module tree to the four main module definitions. [S07] [S18] [D01]

### Separate access, construction, and benefit

A room being revealed is not the same as it being operational. A room being operational is not the same as having every later level unlocked. Likewise, a visual restoration stage and the Core's persistent power state are separate concepts in the data. UI copy should say which transition the player is making. [S07]

### A strong upgrade payoff

The Fabricator commissioning reward illustrates the intended connection: bringing the facility online awards a Scavenger Vest with **+25 shield and +1 bag slot**, ready for the next default loadout. The system also contains first-upgrade payoff configurations, such as a nearby loot cluster that makes additional carrying capacity useful. [S07] [S11]

**PROPOSAL:** Treat this as the model for important unlocks. Show what changed at home, then let the player experience its value in the next raid. Avoid awarding five unrelated systems at the same instant.

---

## 8. Economy, crafting, and trading

### 8.1 Resource vocabulary

| Resource | Role supported by the inspected data | Important distinction |
| --- | --- | --- |
| Scrap | Main soft currency for purchases, construction, crafting, and upgrades | Not the same as the material Scrap Alloy |
| Scrap Alloy | Physical construction/crafting material | Carried as an item and consumed by specific requirements |
| Data Cores | Currency used in selected progression costs and exchanges | Not the same as every item with "Core" in its name |
| Contract Chips | Quest/trade currency for the BIT catalog | Separate from Operator XP and Bond XP |
| Signals | Historical/prototype insurance, recovery, and exchange currency | D1 removes insurance/paid bag recovery from the target core loop; other uses and the eventual business model remain undecided |
| Operator XP / Bond XP | Progression measures | Not ordinary spendable currencies |
| Bunker Power / Fuel | System-specific meters | Power is a facility state; Fuel belongs to the optional retention layer |

**CURRENT:** Salvage is no longer a separate soft currency. A **Salvage Crate** remains a valid loot item and currently converts to 24 Scrap on successful ingestion. Older documents cite different conversion values; current item data is the baseline here. [S11] [S12] [S18] [S19] [D01]

### 8.2 Material families

The data groups materials into Power, Mechanical, Electronics, Bio/Medical, Protocol, and valuables/scouting items. Examples include Cable and Power Cells; Scrap Alloy, Servo, and Polymer Plate; Circuit Boards and Optical Sensors; Med Gel and Bio Samples; and AI Fragments, Encrypted Drives, Rebirth Shards, and Neural Cores. [S12]

Different materials should make destination and depth choices meaningful. Avoid inventing a universal four-tier rarity structure from an old economy proposal: the current item rarities and actual loot tables are the implementation baseline.

### 8.3 Sources and sinks

```text
Raids, quests, supported idle activities, and trading
  -> materials / currency / equipment
  -> facility upgrades / crafting / equipment improvements / trades
  -> new capacity, capability, or access
  -> new raid purposes
```

The Fabricator turns materials plus Scrap into consumables, weapons, attachments, tools, advanced components, or Data Cores through supported synthesis recipes. Recipes are gated by the relevant Fabricator level and, where applicable, unlock flags. [S08]

Examples already present include crafting the Vector SMG, Breach Shotgun, Marksman Rifle, Scavenger Vest, medkits, a Power Relay, and attachments. These are not all available at the beginning.

### 8.4 Trading and recycling

The Quartermaster sells selected common supplies and gear, buys items, and provides specific barter exchanges. Current barter examples include Servo for a Hydraulic Component and Memory Modules for a Transmitter. The vendor data does not list the SMG or shotgun as direct stock. [S19]

Selling for Scrap and breaking an item into base materials are different actions. The recycle map is deliberately lossy and excludes protected categories such as Protocol/story items; the exact allowed action should come from data, not a blanket "all junk is recyclable" assumption. [S08]

### 8.5 Monetization boundary: partly resolved, partly open

**APPROVED D1:** Insurance and paid bag recovery are excluded from the core loop. This resolves those two uses; it does not decide every other use of Signals or the eventual business model. [D01]

**M4 APPROVED DIRECTION:** The owner chose full midcore paid progression (Model C). The baseline still includes Signals-to-Data-Cores exchange, and the precise future rate, material catalog and premium-player-power limits remain **OPEN**. Old insurance and full-bag recovery are excluded under D1, regardless of Model C. [S19] [S20]

---

**OWNER-REQUESTED M2 — Meta-game monetization direction, proposals not final commercial approval:** The long-lived bunker identity is a natural cosmetic canvas. Propose a simple two-wallet separation: gameplay-earned Scrap and materials for functional upgrades, and a single premium-like cosmetic currency (potentially a repurposed **Signals**, subject to removing its historic recovery/insurance and Data-Core conversion functions). Candidate spend surfaces are **room-by-room bunker decor**, persistent **operator outfits/weapon looks**, and **BIT shells/screens/accessories**, with themed sets across surfaces. Paid visuals should not vanish on raid death, while gameplay equipment remains at risk. A room must first be functionally restored through gameplay before it becomes a decoration canvas; direct decor packs and earnable starter furnishings can then create optional identity-driven spending. Propose slot-based/curated decoration first because the current bunker is pre-rendered art with DOM hotspots rather than a free-placement 3D editor. Pricing, cosmetic-only premium restriction, catalog, regional compliance, and earn rates remain **OPEN**. [D01] [S07]

**OWNER SUGGESTION M2.3a — Name your bunker:** Offer a free editable persistent bunker name to strengthen the feeling of home, with a default identity until chosen. This is **not a required FTUE screen**; offer it as an optional action after home restoration or during a later return. Show the name on the home overview and after returning from raids; sharing names publicly needs separate social/privacy requirements. The name is not itself a paid item. Inspired by the user's *Hay Day* farm-naming reference, not a commitment to copy that game's monetization. [D01]

### 8.6 M3 monetization benchmark and proposed economy

**RESEARCHED PROPOSAL M3 (7 November 2026; NOT APPROVED FOR IMPLEMENTATION):** Whiteout Survival demonstrates a persistent base/progression/social/event commercial model; Survivor.io combines approachable combat with chapter milestone packs, monthly products, paid passes and event-linked progression; Toca Boca World demonstrates appealing room/character identity and purchasable decoration sets. Their monetization cannot simply be cloned into an extraction shooter: paid risk removal, forced social dependence and wide stat/power gaps could compromise the approved D1 risk contract and future PvP viability. Sources and detailed comparators are recorded in [decision register M3](design-decisions.md#m3--world-class-meta-game-economy--monetization-benchmark).

**Proposed economy spine:** Scrap as earned day-to-day currency; materials/Data Cores as extracted progression; **Signals**, if repurposed, as a single premium currency with transparent limited earned availability, initially focused on persistent cosmetics. Direct-price room bundles and collections should remain understandable without currency conversion. The former paid-progression choice is now resolved as **Model C** (M4): functional meta progression may be sold, but exact offer rules are still open.

**Proposed commercial loops:** (1) raid -> extract -> restore room -> unlock new function/region -> next purposeful raid, (2) name and decorate bunker room -> style operator and BIT -> acquire optional themed looks/collections, (3) themed weekly/monthly goals using the ordinary raid and customization mechanics -> free earned cosmetics + optional paid collections. Do not introduce compulsory event tasks or a swarm of separate wallets.

**Indicative test offers, not approved prices:** 19–39 kr starter decorations, 39–99 kr operator/BIT style bundle, 59–129 kr room set, 129–249 kr cross-surface collection. These are internal initial price hypotheses, not competitor market quotes. **Historical M3 sequencing superseded by M5:** Growth Fund is an approved product family; contents and values remain hypotheses. Seasonal passes and monthly cards remain later-phase hypotheses. M19D controls eligibility.

**Implementation reality:** The current bunker is rendered as pre-authored stage plates with interactive DOM hotspots, not an existing free-placement room decorator. Test **small room-specific fixed slots/presets** with starter furniture first; measure actual engagement before funding a full Toca Boca-style editor. Cosmetic inventory must be permanent and independent from gear that is lost on raid death. Display the same operator/BIT cosmetics in base and raid if feasible.

**Success metrics:** D1/D7/D30 retention and meaningful upgrades completed; first room customization, first preview/purchase, repeat purchases, room pack adoption, owner style use, cohort LTV and net revenue, as well as free-vs-paid access gap. Optimize with limits on friction and purchase pressure, not monetization in isolation. [D01]

### 8.7 M4 — Full midcore monetization, approved direction and provisional economy

**APPROVED M4 (7 November 2026):** The owner selected **commercial Model C**, explicitly allowing the game to sell both **functional meta progression and resources** and lasting visual customization of bunker rooms, operator and BIT. The old M3 cosmetic-first recommendation is **superseded on the paid-power boundary**. This approval establishes the business strategy, **not** final purchasable items, balance or shop implementation. [D01]

**Non-negotiable existing gameplay contract:** No paid raid insurance, whole-bag recovery, automatic extraction, extra paid Secure Slots or purchase that reverses death (D1/D2). At-risk deployed gear remains losable even if purchased directly; the free Basic Carbine remains available. Paid progress may shorten bunker and operator development, but must not bypass the need to undertake real raids and execute player-controlled extraction. Later PvP requires explicit combat-power normalization or other visibly fair segmentation.

**Candidate economy, testing only:** Scrap = earned common currency; physical items and Data Cores = gameplay progression inputs also potentially sold as **specific disclosed resource packs**; Signals = one premium wallet bought or modestly earned and spent on resources, progression acceleration and lasting cosmetics; XP/Bond = persistent progression meters rather than yet another currency. No additional room/decor/drone paid wallets. Prior historical insurance and Signals-to-Data-Cores code must be reconciled to this design; the item-sale catalog is not approved yet.

**Illustrative price and sink test, unapproved:** 100 Signals/19 kr, 550/89 kr, 1,200/179 kr, 2,600/349 kr; resource pack ~100–600 Signals, advanced research ~500–1,000, outfit/BIT skin ~150–450, room collection ~400–900, coordinated full set ~900–1,600 Signals. These are *economy model starting assumptions*, not real store prices, a currency exchange-rate claim or competitor benchmarks. Avoid inventing artificial upgrade wait times solely to sell speed-ups.

**Recurring offer loop:** A raid produces extraction-earned materials -> a tangible bunker goal becomes reachable -> a free earnable path and a disclosed Signals route are shown without blocking gameplay -> upgrade changes room/capability -> optional decorated room, operator/BIT themes and milestone bundles gain emotional value -> weekly thematic events use normal raid/base actions rather than separate chores. **Historical M4 sequencing superseded by M5/M19D:** the Growth Fund family is approved, with paid resource-bearing offers gated by gameplay-built Fabricator L1. Monthly Supply Card and seasonal pass remain unapproved. Give room naming away for free and keep purchased cosmetics independent of raid-death loss.

**Validation:** Cohort analysis over free/occasional/regular/high-spending players; measured D1/D7/D30, upgrade time and payer/free progression gap, material inflation, payer conversion, first purchase, repeat purchase, net revenue/LTV, cosmetic uptake, refunds and raid abandon/death rates. Preserve clearly labeled prices, age/platform consumer safeguards, and no loss-triggered manipulative revival offers. See detailed ledger, trial offer catalog, open decisions and benchmark references in [decision register M4](design-decisions.md#m4--full-midcore-monetization-premium-economy-and-extraction-integrity).

### 8.8 M5 — Approved hybrid commercial product structure (7 November 2026)

**OWNER APPROVAL M5:** The full midcore Model C (M4) is delivered commercially through **three complementary product families:** (1) deterministic direct **resource offers** for a specific room/upgrade need, (2) a **Rebirth Growth Fund** that pays out rewards at earned bunker milestones, and (3) lasting cosmetic **room/operator/BIT collections**. These categories are locked; balance and precise offer definitions are still in review. [D01]

**Growth Fund v1 — proposed product specification:** A one-off explicit purchase reveals a premium track parallel to a free bunker-restoration milestone track; achievements are earned by real play and building, **not by buying the fund**. The proposed six milestones are FTUE first normal extraction, Fabricator L1, Vault L1, BIT Bay L1, Core L2 and Core L3. A player purchasing late may **claim all previously earned eligible premium rewards retroactively**. Reward claiming must be exactly-once and recoverable across reinstall/sync/refund. Show total reward contents without fake multiplier/value claims. Proposed test reward ladder: 150/250/300/350/500/750 Signals on the respective paid milestones (2,300 total) plus explicitly listed resources and cosmetics; the currency amounts and eventual fund price are **not approved**.

**Direct resource offers — proposed interaction, eligibility revised by M19D:** Only after Fabricator L1 has been earned and built through gameplay, show the exact shortfall in an accessible functional room's missing-requirements panel. Earlier material offers, including Fabricator supply kits, are superseded. Provide equal legibility for `Find in raid` (earned acquisition) and optional `Get materials` (deterministic disclosed Signals purchase). Any paid inputs land in secured home storage and must not force a BUILD interaction or bypass other eligibility gates. No paid scouting/quest completion, extra Secure Slots, death recovery or automatic successful extraction. Stash capacity/overflows require non-lossy pending claims for purchases. Potential product examples: Scrap/Alloy supply, Cable/Fabricator kit, Electronics cache and bounded research kits. Prices, quantities, source availability and rare-material permissions remain proposed.

**Monetization surfaces — proposed UI responsibilities:** No shop before completed FTUE or during a raid/death/extraction. Post-first-normal-extraction: an optional welcome identity offer **after** the result and core next-goal; bunker overview: one non-blocking store link, cosmetic-only before gameplay-built Fabricator L1; room build detail: exact requirements and likely in-raid routes, with optional `Get materials` only after gameplay-built Fabricator L1; Projects/Progression tab: earned free milestones and, only after gameplay-built Fabricator L1, the paid resource-bearing Growth Fund; room decorator: furniture/room themes; Operator and BIT Bay appearances: cosmetic preview/equip; after milestone: one relevant non-forced offer shortcut after showing the actual upgrade result. Never substitute a commercial modal for BIT's approved storytelling or interrupt movement/aim/fire.

**Test sequence and economics:** Prove free room decorating; validate deterministic repair-adjacent products; then one bunker milestone Growth Fund with late retroactive claiming; only later scale curated themed collections and live events. Monitor paid vs free progression timing, first/return purchase, purchase refunds, room personalization, fund milestone completion/claim rate, raid participation after purchases and D1/D7/D30 retention. Detailed decision record, numerical hypotheses and unresolved offer questions are in [M5](design-decisions.md#m5--hybrid-commercial-product-structure-direct-resources--growth-fund--cosmetics). [D01]

### 8.9 M6 — First 30-day economy simulation (analysis, not a tuning decision)

A first-pass formula-based Excel model now covers **four illustrative post-FTUE 30-day personas** with editable daily raiding, extraction rates, depth preferences, expected loot/scrap yields, real module ingredient costs, Signals wallet, deterministic common-material supply purchases, and a milestone-based retroactive Growth Fund. It treats Core L1 as completed in the signed-off introductory mission, and models one upgrade/day through Fabricator L1, Vault L1, BIT Bay L1, Core L2, Fabricator L2, BIT Bay L2 and Core L3. The workbook was produced as a **downloadable conversation artifact**; only the methodology and result synopsis are recorded in repository docs (see [M6 in decision register](design-decisions.md#m6--30-day-economy-scenario-model-analysis-7-november-2026)). **This is not a forecast or authorization to ship new prices/resources.**

**Initial assumed example results:** free persona (1.2 raids/day, 66% extraction success, no spend) reaches Fabricator L2 by day 28 and Core L2 day 20; occasional paid persona (89 kr modeled spend, 1.6 raids/day, 70% extraction success) reaches BIT Bay L2 by day 25 and Core L2 day 14; regular paid persona (399 kr and 2.2 raids/day, 75%) reaches BIT Bay L2 by day 14 and Core L2 day 9; high spender (1,999 kr and 3 raids/day, 80%) reaches Core L3 by day 19 and Core L2 day 6. **Different time investment and extraction skill heavily confound purchase effects.** These results are deterministic expected-inventory threshold crossings, not per-player outcome probabilities. Rare drops need stochastic Monte Carlo validation.

**Priority next analysis:** compare free-versus-paid under identical playing time and success rate to isolate *payment effect*, then replace hypothesized loot per successful extraction with instrumented actual runs and stochastic distributions. A separate population, retention and store-fees model is needed before any revenue/LTV/ROAS conclusions. [D01]

### 8.10 M7 — Matched spend-only + stochastic loot analysis (7 November 2026)

**Completed analytic second pass, NOT approved tuning:** The separate updated Excel workbook (conversation artifact, `Protocol_Rebirth_30_Day_Economy_Model_v2.xlsx`) compares 1,000 paired random seeds under four spend settings with **identical** attempted raids, extraction outcomes and generated loot across spend tiers. The new Monte Carlo uses the actual relative three-depth item **weights** from `nodspel/levels.js` but simplifies spawned/picked items to a 3–4-item retained-sample policy; it is **not** a faithful simulation of game-level loot placement, movement or pickup behavior. Numeric assumptions: 2 attempts/day, 70% extraction chance, 30% deeper choice, 30 days after FTUE. Payments are 0 / 89 / 399 / 1,999 SEK assumed per persona, including a day-7 Growth Fund for the last two tiers and deterministic common-resource Signal bundles. The full interpretation is in [M7](design-decisions.md#m7--controlled-spend-comparison--random-loot-simulation-7-november-2026).

**Illustrative results:** Core L2 day-30 unlock rate **89.4% / 89.4% / 97.6% / 97.6%** (free, occasional, regular, high); median arrival **day 16 / 15.5 / 9 / 9**. Core L3 day-30 unlock rate only **0.1% / 0.1% / 0.7% / 0.7%** due to rare ingredient gates under the sampling assumptions. Since gameplay conditions are paired, the late-game spend plateau is a model property rather than a skill/time confound; it does **not** establish the live economy or support unbounded rare-component sales.

**Next validation:** run actual loot generation + inventory retention from game runtime or instrument device playtests, then revise paid-basket composition, free rare-item acquisition routes and prices with fully stochastic observed input data. All revenues/prices/progression percentages in this section are hypothetical scenario outputs; no game code or monetization catalog changed. [D01]

### 8.11 M8 — Economy calibration tooling and first-week meta progression

**IMPLEMENTATION SUPPORT:** [Draft PR #204](https://github.com/w4sser/protocol-rebirth-proto/pull/204) contains an offline CI-runnable economy harness invoking the real Node Raid level generation, pickups, bag settlement and currency grants. It does **not** change gameplay. It outputs seed-level `runs.csv` and `summary.json` for comparison with M6/M7, available from the GitHub Actions `economy simulation` artifact. First focused action run passed. Navigation, combat, current big-level routes and actual player choices are **not** simulated; there is no actual commercial system or server backend here. The Excel workbook remains outside GitHub pending manual binary upload; see [economy model guide](economy/README.md).

**NEXT OPEN DESIGN DECISION:** Set the **first-week free-player restoration cadence** before locking purchased resource bundles. Proposed baseline: Fabricator L1 after a few successful post-FTUE raids, one other significant restoration within roughly the first week, Core L2 as the following medium-term journey. This is a test hypothesis, **not owner-approved timing or a commitment to inject artificial upgrade timers**. The first-week rhythm must be validated against gameplay and actual loot/pickup distributions, then benchmarked against spend-only scenarios. [D01]

### 8.12 M9 — More frequent first-week restoration (owner direction)

**APPROVED M9 DIRECTION:** Players should restore **more tangible things early** than the initial week-one suggestion implied, because the bunker must visibly come alive after successful raids. Keep two complementary scales of progress: **major functional upgrades** (Rebirth Core, Fabricator, Vault, BIT Bay), and **small, frequent, low-cost visual restoration beats** (lighting, improvised bed, repaired workbench, docking corner, furnishings). These should produce a noticeable before/after and often make new room-customization spots available, **without becoming an additional progression tree or currency**. This is an owner-approved principle, not a fixed tuning calendar. See [M9](design-decisions.md#m9--early-restoration-cadence-more-visible-progress).

**PROPOSED PLAYTEST CADENCE:** The approved FTUE already restores Core L1 and introduces BIT. Fabricator L1 remains an early major milestone over the first few ordinary extractions. Between major milestones, give 1–2 small visible restorations in early homecomings and a free starter decoration/corner after onboarding. Across roughly days 3–7, allow a choice of Vault L1 or BIT Bay L1 plus another 2–3 small restoration beats, keeping Core L2 a larger medium-term ambition. These are **experience targets, not hard day gates**.

**Do not compromise FTUE or economy:** No compulsory naming/decorator/repair screens before the first successful ordinary extraction ends D3.9. Small restorations must not consume the exact scarce materials required for critical core progress, or use timers invented to sell skips. A successful extraction can contribute to functional room restoration, home visuals, and customization without manufacturing a new spendable resource or reward notification stack. Evaluate visible-home-change rate, room-upgrade delay and first-week retention in playtests. [D01]

## 9. Operator and equipment progression

### 9.1 Progression layers

| Layer | What persists | What the player understands |
| --- | --- | --- |
| Operator level | Overall raid-derived XP and level | "I am becoming more experienced." |
| Use-based skills | Mobility, Stealth, Vitality, Search, Crafting | "Doing this makes me better at it." |
| Weapon mastery | Weapon-use/kill-based mastery progression | "I know this weapon better." |
| Equipment build | Upgrade levels, Mk tier, fitted attachments on the relevant built copy | "This is a valuable piece of gear I prepared." |
| Bunker and area unlocks | Operational facilities and access | "My home and available expeditions have expanded." |
| BIT | Bond, hardware, and talents | "My companion is growing with me." |
| Raid perks | Nothing beyond the current run | "This raid has a particular temporary build." |

The distinction between persistent character development, a losable item build, and temporary perks must remain explicit. [S02] [S11] [S14] [S17]

### 9.2 Operator development

**CURRENT data:** Operator progression is configured up to level 30. Use-based skills include Mobility through movement/dashing, Stealth through close node interaction, Vitality through damage/healing/survival, Search through searching containers, and Crafting through crafting/extracted items. Weapon mastery uses kill thresholds and modifies handling. [S11]

The current design is therefore a mixture of automatic numerical development and explicit preparation choices. It is not purely horizontal progression.

**APPROVED P1.3 — Operator milestone hybrid (7 November 2026):** Keep Operator XP/level as a simple background progression with a limited number of meaningful playstyle choices at milestones. Review and consolidate redundant minor use-based percentage skills and overlapping mastery tracks, without assuming any specific skill has already been removed. Attachments and equipment builds remain an independent tactical system. Exact milestone levels, number of choices, loadout constraints and respec behavior are still open. [D01]

### 9.3 Equipment development

The equipment model includes incremental upgrades, Mk tiers, and attachments. Barrel, magazine, and optic attachments create visible range, capacity, or damage changes, with tier requirements. The art data also distinguishes visual grades: Salvaged, Restored, Custom, and Svartverk. The last is a configured visual grade, not automatically an independent fourth merge tier. [S11] [S12]

**Important implementation detail:** The current save-model comments describe tier, attachments, and upgrade level as belonging to a built copy. Older comments describing permanent per-item-ID upgrades must not be used to promise that a lost upgraded gun returns with its investment intact. D1 confirms that valuable deployed equipment is at risk, not automatically rebuilt after failure. [S02] [D01]

**OPEN:** Merge documentation describes a universal three-copy rule, while current configuration uses `copies: [3, 7]`. Use the live merge logic and UI when explaining the exact requirement; do not reproduce the obsolete rule as settled design. [S06] [S11]

### 9.4 Progression should widen useful choices

**PROPOSAL:** Review each major upgrade against two questions: What can the player do differently? Where will they notice it immediately? Preserve satisfying numerical growth, but prioritize new tactical options, carrying decisions, and access over layers of nearly invisible percentage bonuses.

---

### 9.5 M10 — Operator cosmetic customization is a first-class meta pillar

**OWNER DIRECTION, 7 November 2026:** The next bunker-room/restoration specification must include **operator character customization** as an equally intentional meta pillar, along with bunker room decoration and BIT identity. It is **not** relegated to a later optional feature. The owner-approved scope is the principle; exact slots, art counts and purchase offers are not yet approved. [D01]

**PROPOSED initial operator editor:** Preview the operator in the bunker and loadout menu; choose clothing/outfit, headwear/helmet look, optional colors and equipment/weapon appearances. Keep permanent purchased/earned cosmetic ownership separate from any actual deployed weapon or armor copies which remain at risk under D1. Prioritize customization whose visual difference is readable from the actual mobile gameplay camera, and test animation/silhouette/PvP readability. Start with an affordable art scope (e.g. full-body outfit + headwear + palette) before proliferating tiny gear sub-slots.

**FIRST WEEK PROPOSAL:** After the *first successful ordinary extraction ends the approved FTUE*, allow a free operator appearance choice in the home. Introduce starter room furnishings and an earned BIT visual accent alongside additional small bunker restorations. Thematic matching collections can later span **operator + BIT + bunker room** without creating more paid currencies. No compulsory early shop/customization screen interrupts the signed-off D3.9 onboarding. [D01]

### 9.6 M11 — Callsigns, nameplates and collectible player identity

**OWNER DIRECTION:** Expand cosmetic customization into an intentionally collectable **player identity** layer, including a player-selected name/callsign and cool, distinct nameplates. The player also names the bunker separately. The precise recalled external game reference ('Legion Morning' / 'Trapdoor') remains **unverified**, so do not attribute features to it as fact. [D01]

**PROPOSED model:** **Callsign** is free, editable operator/player display text; **Bunker Name** is a different free editable home identity; **BIT** remains the recognizable companion name with customizable CRT/shell/visuals; **Nameplate** is a separate permanent earned/purchased visual frame that displays the Callsign and may combine material, emblem, themed banner, and short title. Account names should not be confused with unique identifiers. In offline GitHub Pages, use local-profile persistence only and do not claim globally unique handles/cloud identity until a backend exists. If shared online later, moderation/reporting/privacy and identity collision rules are required.

**PROPOSED additional collectible products:** nameplate frames (salvaged steel, naval radar/CRT glow, coast lighthouse motifs), earned achievement titles, sleeve patches and facility emblems, profile banners, portraits/poses and restrained homecoming animations. The most valuable treatments should visibly reinforce the game art direction, not introduce combat readability noise or tiny low-value visual clutter. Avoid flags and paid advantages. Every purchased plate/title/appearance should survive death under D1.

**FIRST-WEEK INTEGRATION:** After the first successful ordinary extraction finishes the approved D3.9 FTUE, offer an optional single 'Make it yours' profile action (Callsign and separate bunker naming, both skippable); supply a free plate/frame, an initial operator look, a BIT accent and one room-decoration starter. Later rewards and commercial themes connect **profile/nameplate + operator + BIT + bunker** instead of creating four independent progression economies or wallets. All specific rewards, store sets, display moments and editor scope are proposals. [D01]

### 9.7 M12 — Integrated Identity & Home Meta system

**SPECIFICATION NOW DRAFTED:** [Identity & Home Meta](identity-home-meta.md) combines **player Callsign/nameplates, operator appearance, BIT visuals, bunker restoration and room decoration** into one product journey and a shared permanent cosmetic inventory. The owner's previously approved direction is that these surfaces matter together; the exact free rewards, UI tab design and themed SKU catalog remain proposals. [D01]

**Suggested product model:** `Home` communicates recovery and next objective; `Projects` communicates functional upgrades and Growth Fund; `Customize` is a single accessible place for the four identity surfaces; `Shop` sells optional deterministic resources and themed cosmetic sets. Each successful homecoming ideally changes something visible or brings a concrete functional restoration closer. The first identity choices are **free and optional after FTUE**, not mandatory prompts inside it. The bunker can be named separately from the operator. A shared theme may cover all four identity surfaces; no separate premium wallet for each. [D01]

## 10. BIT: companion, capability, and relationship

BIT is the emotional connection between the hostile field and the recovering bunker. Its established tone is helpful, loyal, dry, and slightly cheeky. It comments on discoveries, death, returning home, completed construction, and the player's next need. [S03] [S13]

### Four systems that should not be conflated

| BIT layer | Purpose | Current evidence |
| --- | --- | --- |
| Character/presentation | Make the journey feel shared | Contextual dialogue and a fixed CRT-faced identity |
| Bay hardware | Improve physical capability | BIT Bay module levels and cargo/scan-related benefits |
| Bond | Represent accumulated relationship/experience | Bond thresholds, raid XP sources, and a configured cap of 20 |
| Talent tree | Let the player specialize | Scout, Guardian, and Scavenger branches with ranks, row gates, choices, and capstones |

Early narrative presence does not mean every Bay hardware function is already unlocked. Likewise, Bond level, Bay level, and Operator level are not three names for the same progression bar. [S07] [S13] [S14]

### Talent identities

**Scout** supports information and finding useful loot. **Guardian** supports survival and defensive capability. **Scavenger** supports the home economy and scavenging. The configured tree includes mutually exclusive choices on some rows as well as passive effects. [S14]

**APPROVED D1:** Automatic item rescue is no longer part of the intended BIT design. Existing Bond rescue and Guardian Safe Return must not remain as additional death-protection paths beside the Secure Slot. Their removal or replacement needs an implementation plan; the exact replacement talent is not approved here. This does not remove pre-loss support such as warnings or shields. [D01]

The newer talent data explicitly replaces the older single-active-skill toggle for the core skills: learned nodes become passive. This does **not** overturn the separate rule that BIT can perform only one active assignment at a time. [S01] [S14]

### BIT assignments

Scavenging, a longer expedition, and accompanying/supporting a raid represent opportunity costs. A companion away on an assignment should not simultaneously provide every field benefit. The exact availability rules should remain visible rather than requiring the player to infer them from missing bonuses. [S01] [S18]

**PROPOSAL for guidance:** BIT should identify a need, point to a useful source, acknowledge a meaningful find, and explain a consequence. It should not narrate every pickup or compete with urgent combat information.

---

## 11. World structure, objectives, and quests

### 11.1 World progression

The configured world-map order is **Bunker -> Archipelago -> Town**. A new area's access combines Core progression with a successful scouting extraction. [S11]

| Area | Identity | Configured access |
| --- | --- | --- |
| Bunker | Facility interiors, constrained routes, initial encounters | Starting area |
| Archipelago | Islands, piers, rocky shores, patrols | Core L2 plus an extracted Archipelago Chart from the Bunker |
| Town | Abandoned settlement, searchable houses, harder encounters | Core L3 plus an extracted Town Survey from the Archipelago |

This makes exploration itself part of progression: the player does not unlock every destination merely by accumulating a generic account level.

### 11.2 Keep objective types distinct

A raid can contain several different reasons to act:

| Objective type | Example | What completes it |
| --- | --- | --- |
| Return extraction | Under approved D2.1, at least one ordinary quick-mode return route is available from the start | Reach and complete D2.3's extraction procedure; personal-goal completion is not required. The inspected baseline's node gate needs alignment. |
| Personal build goal | Find Cable for a facility upgrade | Bring home enough usable materials and perform the build |
| Quest | Extract specified items, defeat a specified enemy, or hand in parts | Meet that quest's own objective and claim/hand in as required |
| Optional opportunity | Extra cache, equipment pickup, searchable room | Take the opportunity and, for exposed carried rewards, extract |
| Scouting goal | Recover a chart/survey | Extract the relevant scouting item under the baseline rule |

**APPROVED D2.2:** Personal-goal completion and successful extraction are independent. The player may leave successfully with an incomplete goal; the missing requirement does not become completed merely because the player got home. [D01]

**PROPOSAL:** Present these as a hierarchy, not five competing primary missions. The player needs to know both why they entered the raid and how to get home. The exact HUD hierarchy and revised node functions remain under review. Node activation is not established as a requirement for future longer modes. [D01]

### 11.3 Quest systems

**CURRENT configuration:** Generated BIT quests draw from reachable world facts and cover kills, searches, extraction, or clears. The data sets three per day, one free swap, and a choice of rewards. Permanent quest chains separately provide ordered area progression, named steps, material hand-ins, and unlocks. [S21]

The configured Bunker chain is **Wake the Core**. The Archipelago chain is **Signals at Sea**. Rewards include materials, tools, Scrap, XP, Contract Chips, recipes, cosmetics, and Hard access. There is not an equivalent authored Town chain in the inspected quest-chain table; do not invent one to make the presentation symmetrical. [S21]

Contract Chips feed BIT's catalog of recipe access, selected materials, Hard passes, and cosmetic looks. A weekly-operation reward table is explicitly a stub: the weekly operation should not be described as implemented. The catalog also mentions items such as the Gull Drone blueprint; catalog presence alone does not prove a complete playable drone system. [S21]

---

### 11.4 M13 — Tactical room problem-solving as a core-gameplay improvement priority

**OWNER REQUEST, 7 November 2026:** The present combat/extraction core needs to be **more enjoyable**, beyond improvements to loot and meta rewards. Inspired by *classic Metal Gear Solid* room situations, selected raid rooms should offer a legible problem, multiple viable tactical solutions and meaningful consequences; the player should be able to observe, experiment and outsmart enemies. [D01]

**PROPOSED first vertical slice: Shielded Relay Room.** A visible turret/shield system can be handled by flanking its vulnerable side, destroying a visible power source to disable the defense, or bringing an EMP (optional if the current loadout/tool implementation supports it). The solution is readable from the mobile camera, uses existing movement/shoot/interaction affordances, and rewards players who understand the environment. Other proposals include camera/alarm rooms, patrol diversion, flooded power hazards and destructible supply chokepoints. See [M13 in decisions](design-decisions.md#m13--core-gameplay-must-become-more-fun-tactical-room-problem-solving).

**Key constraints:** No forced puzzles on every room; most instances should resolve in ~20–60 seconds and keep the short-raid tempo. Aggressive shooting remains valid, not a fail state; it may be costlier in ammo/time/risk. BIT offers hints without solving automatically. Do not add paid-only puzzle solutions or reinterpret D2 return extraction/optional objectives as hard gates. Prioritize the highest fun delta per engineering/art cost and test enjoyment, comprehension, multiple-solution usage and raid length before committing a new mechanic family. **Design exploration only; no code changes authorized by this statement.**

### 11.5 M14 — Eight-minute raid gameplay and meta reward architecture

**OWNER-REQUESTED DESIGN DEFINITION, 7 November 2026:** See the dedicated [Eight-Minute Raid Design](eight-minute-raid-design.md) for the proposed moment-to-moment timeline, combat/tactical/opportunity encounter taxonomy, Shielded Relay Room vertical slice, extraction-risk decision loop, BIT behavior, progression rewards, first-week homecoming and fun/performance acceptance criteria. **This is a detailed proposal, not newly approved numerical balance or runnable implementation.** [D01]

**Experience thesis:** Go out with a purpose, get satisfying mobile action early, discover an understandable tactical situation with multiple workable solutions, acquire something personally useful, choose **bank now vs push deeper**, and make the successful homecoming visibly change functional rooms, operator/BIT identity or a profile/nameplate. The raid must be enjoyable in its own right; meta restoration is reinforcement, not a substitute.

**Illustrative complete-raid rhythm:** 0:00–0:30 orientation; 0:30–1:45 first short combat/loot; 1:45–3:00 optional environmental/tactical problem; 3:00–3:30 return-or-depth decision; 3:30–5:30 more dangerous combinations; 5:30–7:15 distinct deeper payoff; 7:15–8:00 return and extraction when the player stayed. An ordinary raid **never requires waiting eight minutes or clearing the tactical room before using the D2.1 return exit**. D2.4 nodes gate forward depth, not the guaranteed available return route. D1 risk remains and D2.3's deliberately begun five-second first-test extraction contract remains intact. [D01]

**Paced problem-solving, not puzzle overload:** Propose one special room in a committed short raid as a test; reuse a readable linked power supply, flankable turret and existing optional EMP without new control buttons. Maintain substantial responsive combat and movement, a few loot/risk opportunities and room responses in ~20–60 seconds. BIT can hint after genuine hesitation without auto-solving. Achievement-only titles/plates may acknowledge mastering a mechanic, but field materials **only** enter home storage through actual successful extraction.

**First playable validation:** Compare a matched combat-only raid and a raid with Shielded Relay Room on new-player comprehension, fun, second-method exploration, time and deaths, visible gear/material payoff, after-return desire to play again, extraction clarity and mobile FPS. Keep cosmetics permanent, fielded gear at risk and any commerce outside active raids. Details and proposed gates are in [M14](design-decisions.md#m14--eight-minute-raid-pacing-and-tactical-to-meta-loop).

### 11.6 M15 — Six reusable tactical encounter mechanics

**NEW DESIGN SPECIFICATION:** The [Tactical Encounter Grammar](tactical-encounter-grammar.md) proposes six small reusable mechanisms to produce varied decision-rich rooms without bespoke puzzles: **T1 Cut Power** (visible relays linked to shields/alarms), **T2 Divert Attention** (patrol/noise/decoy), **T3 Flank/Break Sight** (directional armor/cover), **T4 Trigger Environment** (visible hazards), **T5 Disrupt Support** (repair, scout and reinforcement links), and **T6 Trade Access for Risk** (optional loot routes with time/health/gear consequences). T6 is a player choice/reward pattern, not a new interaction button. [D01]

**Proposed room construction:** one readable enemy threat + one primary mechanic + optionally a second familiar mechanic + two or more viable responses, including straightforward mobile shooting + optional worthwhile loot + the preserved D2 return-extraction choice. Test T1/T3 first via Shielded Relay Room ([Issue #205](https://github.com/w4sser/protocol-rebirth-proto/issues/205)), then test T5 or T2 in the next biome only if the first tactical-room playtest actually improves enjoyment. The code already includes several relevant enemy archetypes, **but this design does not assert that the environmental link/AI behaviors are currently implemented**. [D01]

**Transfer across locations:** Bunker Shielded Relay = power + flank, summer-night forest Scout Crossing = attention + sight lines, town Alarmed Workshop = disrupt support + optional alarm route. Keep expected special-room duration roughly 20–60 seconds, use existing touch actions, protect mobile FPS, no mandatory stealth/puzzles or expensive unique art. Skill mastery can yield optional **earned** titles/nameplates, while all field-carried materials obey D1 loss and D2 successful extraction. All numerical encounter frequency and reward details remain unapproved playtest hypotheses. [D01]

### 11.7 M16 — Enemy roles and difficulty as decision complexity

**DESIGN SPECIFICATION:** [Enemy Roles & Difficulty Progression](enemy-roles-difficulty-design.md) defines enemy tactical questions, warning tells, free/basic counters, proposed pairings and progression through three biomes and raid depths. Shield turret teaches flanking/power, rusher teaches movement, repair teaches priority, scout teaches awareness, artillery teaches movement under pressure, sniper teaches sightline management; combinations change **the decision**, not just HP. [D01]

**PROPOSED progression:** Intro simple telegraphed threat; depth one readable basic/grunt/rusher, depth two one role combination and optional tactical problem, depth three a more demanding combination of already learned rules and distinct deeper reward. Bunker teaches power/cover, forest emphasizes scout/landscape lanes and town emphasizes alarms/support/crossfire. These are design targets; archetype models in code do not prove all behaviors live in current big levels. No spawn or numeric balancing changes are approved. [D01]

### 11.8 M17 — Equipment counterplay and flexible builds

**DESIGN SPECIFICATION:** [Weapons, Tools & Combat Builds](combat-builds-design.md) connects the prototype's four weapons (Basic Carbine, Vector SMG, Marksman Rifle, Breach Shotgun), three armor choices (Scavenger Vest, Scout Rig, Dampener Cloak) and available tool data (Decoy, EMP, Grenade) to M16 tactical needs. The four **proposed emergent playstyles** are Assault, Breacher, Recon and Saboteur; they are **not new classes or another XP track**. [D01]

**Core rule:** Equipment should change options, strengths and limitations in a fight. Fast SMG, precise Marksman, close knockback Shotgun and free/basic Carbine each suit different threats, while Decoy/EMP/Grenade support optional tactics rather than exclusive progress. Existing item data puts Decoy at Fabricator L1 and EMP/Grenade at L2; this is source data, not an owner approval of the final tool economy or proof all runtime pathways function. Gear loss still obeys D1; skins remain permanently owned, and no paid-only counter or shop intervention appears in active raids. See the M17 counterplay matrix and controlled playtest design. [D01]

### 11.9 M18 — Region identities, exploration, world gates and mission hierarchy

**NEW DESIGN SPECIFICATION:** [World & Mission Design](world-mission-design.md) defines Bunker, Archipelago and Town as three distinct gameplay spaces rather than visual skins; proposes an environmental narrative spine, mission-purpose hierarchy, world-map contracts, procedural map grammar, and the practical relationship between exploration, extraction, bunker restoration, BIT quests, operator mastery and identity cosmetics. Exact mission catalog, art quantities and pacing are proposed, not locked. [D01]

**Configured access carried forward:** Bunker available at start; Archipelago requires **Core L2 + successfully extracted Archipelago Chart**, while Town requires **Core L3 + successfully extracted Town Survey**. Tracking a goal or completing a tactical room is **not** permission to gate an ordinary return extraction. D2.1 return access from the beginning, D2.2 personal objective optionality and D2.3 deliberate short physical extraction continue to apply, alongside D2.4 node-only forward progression. For scouting items, extraction is what banks carried intel; purchasing upgrade resources cannot substitute for the actual reconnaissance objective. [D01]

**One visible purpose:** Make the primary tracked restoration/scouting goal unmistakable, with one likely area/route hint and visible return exit. BIT contracts, tactical discoveries and deeper opportunities remain secondary; the result distinguishes **successful extraction**, **quest completion**, **extracted materials**, **scouting unlock**, and **depth reached**. Present uncertain loot families as likely, not guaranteed. [D01]

**Biome gameplay:** Bunker emphasizes short technical spaces, Cut Power, flanking and industrial systems; Archipelago emphasizes granite/pine route choices, forest scouts and crossing sightlines; Town emphasizes searchable homes, support enemies, alarm/ambush opportunities and environmental storytelling. Test procedural map connectivity, bridges, spawned obstacles and return extraction across seeds; guard the established mobile performance target and the hopeful Nordic summer-night mood. [D01]

**Implementation audit required:** The legacy `data/raid_zones.js` probability-based extraction simulator and old scripted progression settings conflict with parts of the intended quick playable Node Raid; treat them as existing historical code, **not an override of D1/D2/D3**. The existing BIT quest data offers daily tasks and Bunker/Archipelago authored chains, but an equivalent Town chain is currently a content proposal. Do not claim the new design has been implemented. [D01]

### 11.10 M18A — Meaningful replayability within every world

**OWNER DIRECTION, 7 November 2026:** Each visit to Bunker, Archipelago or Town must offer compelling **variation in loot opportunities, enemy roles/compositions and ways to approach encounters**. Replaying the same biome should create different decisions, not just different visual decoration or damage statistics. The detailed proposed solution is [Raid Variety & World Replayability](raid-variety-system.md). [D01]

**Six proposed variation axes:** route/layout topology, enemy combinations, tactical mechanism, loot opportunity family/placement, bounded dynamic field event, and personal mission/discovery purpose. Build seeded, constrained and debug-reproducible encounter situations from a compatible library, preserving learned combat rules and each biome's visual identity. The *Raid Situation Director* is a **design proposal**, not an asserted current feature. Track what a player actually encounters, not only what the map generator technically places. [D01]

**Proposed test benchmark:** across three consecutive committed raids in one biome, at least two should produce meaningfully different route and enemy/loot decisions; across five, players should remember three different situations. Anti-repeat weighting and events should be tuned from data, not automatically added. Maintain D2 return-extraction accessibility, D3 FTUE consistency, real loot and quest legality, and low-end mobile performance. Exact percentages, spawn weights, event lists and changes to game code are **not approved**. [D01]

### 11.11 M18B — Larger Archipelago; more varied same-scale Bunker

**OWNER DIRECTION, 7 November 2026:** Current Archipelago areas feel **too small** and require substantially larger meaningful **playable** outdoor space, while the **Bunker size is broadly adequate** and instead needs more room/route/encounter variety. See [M18A/M18B Raid Variety Spec](raid-variety-system.md#11a-m18b--biome-scale-and-structural-variety-correction-owner-direction) for spatial requirements, current source audit, proposed terrain and room archetypes, navigation/performance safeguards and test gates. [D01]

**PROPOSED test:** Compare roughly **1.5–2x** present reachable Archipelago ground area with three terrain shapes—granite coast, pine forest glades, and island crossing—without multiplying empty traversal time or introducing bridge bottlenecks. Keep early combat/loot accessible, viable short returns and full runs near the ~8-minute aspiration. For Bunker, compare three same-footprint room compositions (reactor loop, storage branch, security wing) with varied loot and tactical enemies. The multipliers, templates and targets are playtest hypotheses, **not approved balance**. [D01]

**Source alignment:** Big Map uses shared `data/raid-big-layout.js` room spacing, shared graph generation (`nodspel/zone-graph.js`) and Bunker-authored templates inside `nodspel/big-level.js`, although terrain/dressing can differ downstream. Thus a larger forest is a **topology and encounter-space problem**, not just a model-size or cosmetic change. Verify the complete generated geometry/runtime path before implementation. No game code was changed. [D01]

### 11.12 M19 — Progression and content economy integrated across 30/60/90 days

**DESIGN PROPOSAL:** The [M19 Progression & Content Economy](progression-content-economy.md) connects one player-selected persistent home Project, meaningful raid loot and early extraction, Operator XP and few deliberate choices, losable loadout, BIT companion support, four identity/cosmetic focus areas, and scouting gates for Archipelago/Town. The bunker and its visible restoration remain the primary long-term anchor, not one of six competing progress bars. [D01]

**Cadence hierarchy:** useful partial progress at each meaningful successful return; occasional small restoration or functional upgrade after several raids; a distinct region/world milestone only after a real Core upgrade **and** the relevant successfully extracted Chart/Survey. The 30/60/90-day framing is for validating content depth and long-term progression, **not calendar gates or guaranteed unlock timing**. [D01]

**Content multiplier:** systematic enemy pairing, tactical mechanics, variable route topology, optional world incidents and relevant loot opportunity produce repeat value from a constrained validated content kit. Shop products under approved M5 remain deterministic resource acceleration, retroactive Growth Fund based on earned milestones, and permanent cosmetics. No paid death protection, bypassing extracted reconnaissance, exclusive gadget counter or shop during active raid. [D01]

**Still open:** Simplification/removal of currently overlapping skill/mastery tracks, precise first-ten-successful-raids reward cadence, actual economy source/sink tuning and M20 retention/LiveOps. All need real generated/played raid results and mobile testing; this documentation does not modify runtime or spreadsheet data. [D01]

### 11.13 M19A — Fewer progression systems early, deeper optional endgame

**OWNER DIRECTION:** Less is more at the start of Protocol Rebirth; endgame can introduce more complexity and avenues of mastery. [M19A Progression Simplification](progression-simplification.md) defines a proposed progressive reveal and a practical consolidation review. One visible Bunker Project, understandable raid purpose and useful immediate restoration remain the early-game focus. Operator XP should rise quietly with occasional meaningful choices under P1.3, equipment remains the primary tactical choice, and BIT feels like a companion rather than an extra set of XP bars. [D01]

**Review recommendation, not approved system removal:** Hide or consolidate five separate use-based Operator skills, independent early weapon mastery interface and overlapping BIT Bond/talent tree presentation. Preserve acquired save state until a reviewed migration exists. Advanced difficulty variants, meaningful build specialization, earned identity and richer bunker room customization can open later as *optional strategic depth* without more currencies, mandatory daily login loops, paid death protection or a forced new tutorial. [D01]

### 11.14 M19B — Passive operator growth and tangible carried-load risk

**OWNER CLARIFICATION:** "Less is more" means fewer visible progression management tasks, **not** removal of subtle movement mechanics. Retain a noticeable but bounded feeling of **getting faster when leveling** and **slowing down when carrying more loot**, preferably as invisible/background progression under existing Operator level. See [M19A passive growth and physical encumbrance](progression-simplification.md#passive-growth-and-physical-encumbrance--m19b-owner-clarification). [D01]

**CURRENT CODE vs PROPOSAL:** `nodspel/stakes.js` already applies bag/backpack-slot occupancy penalties to movement and increased detection, up to the existing configured cap; this is a *slot fraction*, not a mass/weight simulation. A permanent level-based movement improvement with a suitable bounded milestone curve and clean replacement/consolidation of legacy Mobility XP is a design proposal until runtime stats are checked and tuning validated. **Preserve a tactical full-bag cost even for advanced operators.** No extra early skill tree, five background progress bars or onerous per-level selection UI. [D01]

### 11.15 M19C — First ten successful ordinary extractions

**DESIGN PROPOSAL:** [M19C First Ten Successful Extractions](first-ten-extractions.md) specifies a **playtest journey of ten ordinary successful returns**, not a guaranteed ten-raid sequence or scripted resource grants. It links each success to a possible tangible outcome, one clear tracked Bunker Project and a new reason to return: extraction confidence → Fabricator progress/commissioning → visible home change → tool choice → BIT usefulness → heavy-bag risk decision → loadout identity → Vault/Core tradeoff → actual scouting ambitions → a coherent longer-term home goal. Missed milestones slide naturally with real acquired items, failures and player choice. [D01]

**Current module requirements checked in `data/modules.js`:** Fabricator L1 20 Scrap + 2 Cable + 2 Scrap Alloy; BIT Bay L1 20 Scrap + 2 Cable + 1 Polymer Plate; Vault L1 50 Scrap + 2 Polymer Plate + 2 Scrap Alloy; Core L2 120 Scrap + Power Relay + Circuit Board + Power Cell + AI Fragment. These are current prototype costs, not approved new tuning. `data/progression.js` still contains legacy scripted first-hour guarantees and insurance/recovery; the D1/D3.9 target direction supersedes those. Core L2's old zone unlock copy requires alignment with M18 extracted Chart/Archipelago goal before treating world access as implemented. [D01]

**Experience contract:** Each meaningful extraction should show truthfully banked loot, progress to the chosen Project and **one** next action. Optional low-cost visual home repairs and earned equipment affordances should help avoid an empty-feeling early economy without competing for scarce Core parts; temporary M19B level movement improvements and existing bag-burden penalties stay tactile and largely behind the scenes. No extra early skill bars, forced Growth Fund prompt or rare-part completion through the success counter. [D01]

## 12. Difficulty and replayability

The game varies through seeded layouts, area identity, depth, encounter combinations, loot, weapon/tool selection, and temporary perks. Hard variants remix existing spaces with more demanding settings and rewards, rather than constituting an entirely separate world. [S09] [S17]

### Readable challenge, not invisible punishment

The intended encounter contract preserves warnings and alternative tactical responses. More enemies, stronger combinations, and reduced time can create pressure without making cues unreliable. Preparation should help, but the player should still understand how to respond after an imperfect loadout choice.

**APPROVED M27 — Choose Vault or BIT Bay after Fabricator:** After the player **earns and fully builds Fabricator L1**, the next tracked Bunker Project is a **real choice between accessible Vault L1 and accessible BIT Bay L1**, not a fixed progression chain. Vault L1's complete restoration unlocks storage functionality and the **one Secure Slot** under D1; BIT Bay L1's complete restoration improves BIT's support hardware (precise ability still to be specified). BIT was already discovered and accompanies the player before BIT Bay L1. BIT may make a contextual recommendation but must not require one option; **only one primary Project is actively tracked** at a time. Both rooms keep their existing accessibility gates, total material cost split over 2–3 visual-only stages, and functional unlock only on completion under M26. Earlier simulation build-order tables are illustrative, not mandatory design. Details of recommendation and switching/tracking UX remain open. [D01]

**APPROVED M26 — Visual-only restoration stages:** For each major bunker room, break the **existing total construction materials** into 2–3 stage costs (never add them to the original total). The room becomes **visibly more restored after every stage**, but **no new gameplay function, stat, equipment reward, Secure Slot, or meta utility is granted until the entire room is complete**. The final step must deliver a clearly felt functional payoff. Do not activate Fabricator L1's crafting/commissioning reward or unlock material commerce until full Fabricator L1 is earned and built; Vault L1's Secure Slot likewise waits until its full completion. Earlier proposals for intermediate utility are superseded by M26; exact cost split, art and timings remain unapproved. D3's actual Core L1 FTUE activation remains intact. [D01]

**APPROVED M25 — Read risk in the world:** Signal route and enemy danger primarily through **environmental evidence, visible threat behaviors/telegraphs and short, situational BIT cues**, rather than numeric danger ratings or exhaustive advance disclosure. A player should be able to *suspect* which approach is riskier and choose intelligently while retaining discovery. Warnings must be readable at mobile scale and comprehensible with audio muted; surprise is fine, untelegraphed unavoidable punishment is not. BIT remains contextual and non-blocking (D3.7). Exact cue art, trigger timing and any accessibility alternatives require test-based design, not default new HUD elements. This is the presentation contract for M24's player-chosen risk; D1/D2 extraction rules remain. [D01]

### Adaptive difficulty

**APPROVED M24 — Chosen risk, not hidden performance scaling:** In the target ordinary quick-raid experience, challenge primarily follows **the route/depth and optional dangerous encounters the player chooses**, with clear environmental, enemy and contextual BIT risk signals. Do not invisibly scale enemy health, damage or intensity according to performance in order to steer success rates. Player skill, threat recognition and intentional extraction should matter. **Exception:** Approved D3.8 permits bounded progressive assistance on repeated failures of the **first ordinary raid after BIT is found**, without guaranteed survival or bag recovery. This first-raid onboarding exception is *not* a global dynamic difficulty policy. The existing adaptive system described immediately below is **legacy implementation evidence**, not an approved design requirement. Exact signal UX and encounter numbers remain open. [D01]

**CURRENT code:** A between-raid adaptive difficulty system uses recent outcomes and combat/performance signals to adjust bounded parameters for later raid generation. It does not claim to change those parameters in the middle of a fight. It requires repeated signals before shifting and treats the early FTUE separately. [S22]

The source contains target extraction bands, but those are tuning inputs, not measured player retention or proof of a good experience. Its storage key is also currently shared rather than save-slot namespaced, which matters when comparing fresh profiles on one device.

### Replayability test

**PROPOSAL:** A repeated raid should provide at least one changed reason to play: a new purpose, a different route, a meaningful loadout choice, a different encounter decision, a desirable haul, or a useful upgrade payoff. Changing only the seed is not sufficient evidence of meaningful variation.

---

## 13. First-time player experience

### 13.1 The problem to solve

The supplied team feedback is that too much is introduced without explanation. The repository's FTUE audit similarly describes multiple pre-combat screens and competing goals. These are reasons to investigate comprehension, not proof that every new player fails every step. [S15]

The onboarding goal is not to teach the entire system inventory. It is to establish one complete, memorable loop:

> **Act -> find something useful -> get out -> make home better -> understand why to go again.**

### 13.2 Current direction and implementation evidence

The older opening-playtest guide begins at the base with the Core. A later FTUE decision instead prioritizes immediate shooting and moves the cold open to after the first extraction. These are different historical flows, not steps to concatenate. [S15] [S23]

**DIRECTION recorded in the FTUE document:** The first attempt has real risk. A failed attempt leads to an easier second attempt, followed by a strongly assisted third attempt. Important guidance must also work without sound. [S15]

**CURRENT code/data:** The direct-raid FTUE has a fixed pair of initial grunt positions, an assistance ramp, and a clutch sequence that adds two hunters once the nodes are active. The third assistance setting includes minimum-health and minimum-time protection. Its ten-second clutch countdown creates pressure but explicitly does not close the beam or independently end the raid. [S24] [S25]

The FTUE design document's final implementation-status paragraph is older than some of this code. Treat the code as evidence that these pieces exist, while still verifying the full fresh-save experience on a device.

**D1 boundary:** The Secure Slot unlock remains Vault L1. Do not quietly grant a second item-rescue system before that upgrade. D1 does not by itself overturn the separately recorded FTUE assistance direction. [D01]

**D2.3 alignment:** The historical FTUE pressure countdown is not the newly approved five-second extraction procedure. D2.7 must explicitly reconcile FTUE teaching and any scripted encounter with the quick-mode contract. This update neither changes the running tutorial nor automatically approves an exception or a replacement hunter sequence. [D01]

**REVISED OWNER DIRECTION D3.1 — Opening:** The player begins **without BIT**, fights toward and discovers the bunker, and **first meets BIT inside the bunker**. BIT greets the returning operator with the owner's line: **“You're late, but you're back.”** The encounter is a narrative/character payoff, not BIT tutorial narration before combat. Immediate playable movement and combat remain essential; no extended menus or exposition should precede the action. This explicitly supersedes the previous assumption that BIT guides the opening before combat and the bunker is first revealed only after a separate initial extraction. **APPROVED D3.2:** Reaching/entering the bunker **completes the introductory playable mission as its first successful extraction**; this is a bespoke FTUE endpoint, not the ordinary D2.3 extraction procedure. The first standard quick raid follows after the meeting with BIT and is the first such mission played with BIT. Exact intro loot settlement, entrance interaction, and failure/retry details remain **OPEN**. [D01] [D01]

**APPROVED D3.5 — First restoration sequence:** After meeting BIT, the player uses an item found on the opening approach to restore a meaningful piece of the bunker, with an immediately visible change. The **approved implementation direction** is to guarantee two Scrap Alloy on the approach, settle them through the bunker-entry extraction, spend them on the **actual Rebirth Core L1** upgrade (current cost: 2 Scrap Alloy; restores emergency power and reveals room access), and show the Core hall lighting up. Then BIT points to **Fabricator L1** as the next concrete reason to raid (current cost: 20 Scrap, 2 Cable, 2 Scrap Alloy; first build yields Scavenger Vest, +25 shield and +1 bag slot). **APPROVED D3.6:** If the player dies before reaching the bunker, the complete introductory mission restarts free of charge from its beginning, with the two guaranteed Scrap Alloy available again; no intro loot or Core upgrade is duplicated on failure. Regular D1 risk rules still govern unsuccessful attempts. The exact pickup/activation UI, retry presentation, and BIT dialogue beyond the owner's greeting remain open. [D01] [S07]

**APPROVED D3.7 — First ordinary raid BIT guidance:** Use contextual, non-blocking guidance rather than constant instructions or forced dialogue. The **proposed teaching triggers** are: (1) Fabricator/Cable purpose at deployment, (2) combat danger warnings only when useful, not a repeat of basic shooting controls, (3) first relevant Cable pickup and progress, (4) first required node opens the **forward** gate, (5) extraction vs. continue with exposed cargo, and (6) results that accurately describe retained/lost items and the next home goal. Suppress chatter during urgent combat; explain new mechanisms once and help only when a player stalls. Exact barks, timeouts, iconography, and event scheduling remain design/implementation proposals; only the contextual guidance approach is approved. [D01]

**APPROVED D3.8 — Failure assistance in first ordinary raid:** The first attempt retains genuine risk. After failure, BIT provides more targeted context and the encounter becomes incrementally more forgiving on later retries. This should not auto-complete nodes, save exposed loot, guarantee survival, or perform extraction for the player. The first successful extraction must remain a player achievement. `data/raid-ftue.js` currently contains specific attempt multipliers and a third-attempt minimum-health aid; those values are code baseline only, **not owner-approved final tuning**. The system must be reconciled with the now-separate introductory bunker approach and the first actual raid undertaken with BIT. [D01] [S25]

**APPROVED D3.9 — FTUE design closure (owner sign-off, 7 November 2026):** Use a short authored no-BIT combat approach with two guaranteed Scrap Alloy; enter the bunker through one deliberate door interaction to complete the exceptional intro extraction without an ordinary countdown/result interruption; first meet BIT inside, spend the real two alloy on Core L1, and show the facility revive; track Fabricator/Cable for the next standard raid with BIT. In that first ordinary raid teach node-forward vs extract-home under D1/D2 without requiring Cable or full depth clear to extract. Intro death fully restarts the opening; first regular-raid failure retains D1 losses and D3.8 adaptive aid. **Compulsory FTUE ends on the first successful normal extraction and the Fabricator progress/next-goal reveal, not on completing the Fabricator.** Exact timings, encounter values, bark cooldowns, and visual polish remain playtest/implementation details. All six rules were explicitly approved by the owner; this is the approved FTUE behavioral implementation contract. Exact tuning and presentation need playtesting and do not require further strategic design approval. [D01]

### 13.3 Intended learning sequence

This is a consolidated design sequence, not a frame-by-frame claim about the current UI.

| Stage | Player experience | What should be learned | What should wait |
| --- | --- | --- | --- |
| First contact | Move, aim/fire while approaching the unknown bunker, without BIT as an early guide | "I can control this, and attacks can be read." | Full equipment statistics and economy |
| First useful find | Recognize and collect supplies | "This is worth taking home." | Every item family and crafting recipe |
| Intro completion / first successful extraction | Enter the bunker to end/extract the introductory mission; meet BIT inside, then teach regular extraction in the next raid | "Finding is not keeping; getting home matters." | Multiple competing quest systems |
| First bunker discovery and restoration payoff | Meet BIT, apply a meaningful intro pickup to the Core, see the room come alive, and identify the Fabricator as next goal | "My raid changes this place." | All long-term currencies and upgrade trees |
| First preparation | Use a relevant piece of equipment or benefit | "What I built affects my next attempt." | Advanced optimization |
| First independent choice | Choose a goal or decide to push further | "I am making my own risk/reward decision." | Optional retention and commerce experiments |

### 13.4 Targets, not measured achievements

The FTUE design proposes first shot in under 15 seconds and first extraction in under 90 seconds. These are targets from the design document, not results established by this review. The more important comprehension checks are whether the player knows their purpose, recognizes what they gained, and voluntarily chooses another raid. [S15]

**PROPOSAL:** Reveal systems by demonstrated relevance. Do not simply replace eight opening screens with an eight-screen tutorial after extraction.

---

## 14. UX and information architecture

### 14.1 Information hierarchy

The raid should prioritize immediate danger, the current actionable objective, and the path/rules for extraction. Bag value and progress toward a tracked goal should support decisions without covering the playfield. Temporary offers must not obscure an urgent attack. [S01] [S03]

At home, prioritize the next useful improvement and its benefit. At the Fabricator, show craftable outputs and missing inputs. In the Armory, show usable equipment and meaningful comparisons. On BIT screens, distinguish Bond, talents, and assignment availability.

### 14.2 Screen responsibilities

| Surface | Primary question |
| --- | --- |
| Base | What should I restore or improve next, and why? |
| Room detail | What does this room do, and what changes at the next level? |
| World map | Where can I go, what is there, and what unlocks the next area? |
| Raid preparation | What is my purpose and what am I taking/risking? |
| Raid HUD | What requires action now? |
| Loot comparison | Why would I take this instead of what I already carry? |
| Raid result | What did I secure or lose, and what can I do with the outcome? |
| Armory / equipment | What does this item let me do, and what improvement is available? |
| BIT | What has BIT learned, what can it do, and is it available? |

This table is a responsibility model, not a requirement to add new screens.

### 14.3 Reveal information where it is used

The armory/UI design calls for contextual currency presentation instead of showing all counters everywhere. Apply the same logic to mechanics: show a missing part beside the build it serves; explain a stat beside the choice it changes; show a locked area's actual requirements beside that area. [S06]

**PROPOSAL:** Every introduced system should have four explicit answers: What is it? Why should I care now? What action can I take? How will I recognize the outcome?

### 14.4 Existing presentation constraints

Keep controls within the safe area, preserve a full-bleed playfield, use shared popup components, keep notices unobtrusive, and use bespoke icons rather than emoji. The art direction prioritizes player/BIT/immediate threats, then routes and boundaries, then cover/objectives, then atmosphere. [S01] [S03]

---

## 15. Between-session and retention loops

### 15.1 Always-on idle systems in the data

The current idle configuration is separate from the optional retention-mode experiment. It includes a Core Scrap generator, construction timers, a sequential Fabricator queue, BIT scavenging, and a welcome-back summary. The first eligible higher-level build and first craft have instant-completion exceptions to preserve early momentum. [S18]

These systems should return the player to a useful raid purpose: a craft completed, an upgrade is ready, or a missing-material gap has narrowed.

### 15.2 Optional retention modes

| Mode | Configured role in the inspected baseline |
| --- | --- |
| `core` | Default; test the base loop without the optional retention package |
| `bit` | Adds the Morning Report and BIT expeditions |
| `full` | Adds Fuel, additional daily contracts, decryption, streak, and overnight-yield features |

Do not confuse these optional daily contracts with the separately configured BIT quests and permanent quest chains. They are different systems with overlapping terminology. Retention-mode switches are also not the future PvP/co-op game modes described by M1. [S18] [S21] [D01]

**APPROVED D1 constraint:** Whatever optional retention mode is enabled in the current quick experience, the free starter retry must remain available. Any Fuel/payment/wait restriction that blocks it must be reconciled. Insurance and paid bag recovery must not reappear as a hidden exception to the target core loop. The retained baseline table is not approval of every experimental feature. [D01]

### 15.3 Power and rest

Bunker Power is a separate urgency/maintenance meter. It drains mildly, has a capped offline drain, and supports reinforcement or a Cable hand-in. Low power can affect non-Core room availability; the design copy preserves the ability to raid. Living Quarters rest provides configured power recovery and a next-raid shield benefit. [S07] [S13] [S18]

**Design risk to review:** Power, Fuel, construction, crafting, scavenging, quests, and a Morning Report can collectively turn a simple return into administrative work. Their combined cost must be tested, not assessed one feature at a time.

**APPROVED M23 — Learn roles in play, then combine:** Teach distinct enemy archetypes rapidly through actual combat and readable telegraphs rather than long instructional sequences. An early encounter should reveal a behavior and reward an intuitive response (moving, flanking, using cover or prioritizing targets); later encounters combine learned archetypes, terrain and positions into new tactical problems. Difficulty should grow from decision richness rather than simple HP inflation. Keep mobile controls uncluttered, Basic Carbine viable and BIT hints contextual/non-blocking. The FTUE's authored intro and D1/D2 risk/extraction rules remain intact. Exact archetype order, first mixed encounter, stats and timings need playtesting. [D01]

**APPROVED M22 — Combat depth from threats and terrain first:** Ordinary combat earns tactical depth mainly from enemy behavior, enemy-role combinations, positioning and the environment. Players read and counter threats using movement, flanks, terrain, timing and route selection. **Basic Carbine alone must remain genuinely fun and viable**; later weapons, gadgets and builds introduce alternative solutions and tradeoffs, not a mandatory equipment gate or a cure for otherwise dull fights. Deep-raid escalation (M21) should combine legible patterns into richer problems without demanding more mandatory touch-HUD buttons. Exact encounter scripts, tuning and gadget controls are open. M4/M5 commercial meta progression does not authorize bought combat bypasses or automatic wins. [D01]

**APPROVED M21 — Tactical depth and probabilistic opportunity:** The ordinary quick raid's deeper areas should become more interesting through varied enemy-role combinations, readable counters, positioning, route choices and optional risk — *and* provide better chances at valuable loot. Deeper must not mean merely higher HP, damage or fixed material payouts. Valuable finds remain uncertain, carried goods remain at risk under D1, and a player can intentionally return-extract before full depth completion under D2. Specific enemy setups, map layout, loot weights and balance require design/playtests; they are not locked by this directional decision. [D01]

### 15.4 Desired reason to return

**APPROVED M20 — Living world, optional raid side paths:** BIT surfaces fresh leads (signals, unusual enemy activity, salvage rumors) that create **voluntary tactical detours inside ordinary raids**. **No separate mission queue**, compulsory daily quest board or streak chores. The player chooses their primary Bunker Project at home, then chooses whether to investigate the lead during play, continue the main route or extract. The lead may change what is possible, but never guarantees an item, pays out without extraction or blocks ordinary D1/D2/D3 rules. The **player's home should visibly change** through 2–3 meaningful stages per major room **within the same total cost**, and direct material purchasing opens **only after Fabricator L1 is earned and built through gameplay**, while the approved hybrid Growth Fund and cosmetic product families remain optional. [D01]

**APPROVED M20A — Bunker preview, in-raid discovery:** BIT provides a subtle, optional hint *while the player is at the bunker before deployment* (e.g. a strange signal), giving the player a reason to wonder about the world. The **meaning and tangible opportunity are discovered only while playing an ordinary raid**. The cue is neither a compulsory pre-raid contract nor a new mission queue or guaranteed loot promise. Players can ignore it, investigate on a side path or extract normally. Keep the introduction's approved D3 pacing intact and make the hint understandable with audio muted. Exact teaser language, trigger timing and presentation are not yet approved. [D01]

**APPROVED M20B — Persistent, organically changing leads:** BIT's teaser refers to an optional world opportunity that **can be investigated across multiple ordinary raids**. It does not disappear after one run or on a short daily countdown. Opportunities turn over through believable **world changes**, not daily-quest resets or designed FOMO. Players can ignore the clue and continue their Bunker Project without losing access merely because they did not play immediately. A persistent *lead* is not a loot guarantee, fixed chest or a new mission log, and all acquired loot still requires genuine extraction under D1.

**APPROVED M20C — One foregrounded home lead:** BIT highlights **at most one active opportunity at a time in the bunker**, distinct from the player's **single primary Bunker Project**. Do not present a task list or mission queue. **Other voluntary discoveries can occur spontaneously within ordinary raids** without prior hints. The bunker teaser can persist across several raids without short expiry under M20B; there is no penalty for ignoring it. The one-lead limit applies to BIT's visible **home preview**, not to the total variety of emergent in-raid events.

**Still open:** Exact frequency, conditions for organic replacement, how one lead is selected and displayed at home, rewards, narrative presentation, eligible regions and source tuning. No fixed expiry thresholds, item grants or new UI/menu are approved. Do not convert these into another login checklist. Pre-existing `bit`/`full` modes with morning/daily systems are historical prototype configurations, not approvals of mandatory daily content.

---

## 16. World, tone, art, and presentation

### 16.1 Tone and setting

**DIRECTION:** "Dark, but never hopeless." A damaged world can still be alive, beautiful, and worth rebuilding. Nordic melancholy sits beside human warmth, rather than generic dystopian horror. [S03]

The contrast is **soft nature and hard engineering**: asymmetrical vegetation and rock against deliberate Cold War concrete and machinery. Swedish identity should come through the landscape and built environment, not national flags.

The operator is an adult, slender, hooded figure rather than a cute/chibi hero. BIT's friendly CRT face and distinctive body are locked visual assets, not invitations to invent a different smile for each use. [S03]

### 16.2 Readability and color

| Signal | Meaning |
| --- | --- |
| Cyan | BIT, powered systems, extraction |
| Amber | Loot, human warmth, optional opportunity/value |
| Coral / danger red | Hostile sensing and confirmed danger |
| Neutral contrast | Player separation and readable walkable space |

The primary UI action also has its own tokenized treatment. Color is semantic, not decoration. Large forms, controlled density, and clear silhouettes should survive phone-scale viewing. [S01] [S03]

### 16.3 Narrative through action

The existing premise connects the operator, BIT, a dead facility, and the possibility of restoring it. Protocol fragments add mystery through decryption in the optional layer. The inspected sources do not define a complete ending, final antagonist, or fully authored campaign; those must remain unspecified here. [S11] [S18]

**PROPOSAL:** Let turning on a room, reaching a new coastline, recovering a signal, or discovering a useful machine carry story significance. Personal visible restoration can deliver a larger purpose before any shared-world live-service system exists.

### 16.4 Audio and silent play

BIT's established dialogue tone should remain consistent across base and raid. Important guidance cannot depend on hearing a voice line; the recorded FTUE decision explicitly requires critical information on screen as well. Music and atmosphere should support the world's restrained, hopeful mood without masking actionable combat information. The latter is a presentation recommendation, not a new audio implementation claim. [S13] [S15]

---

## 17. Lessons to adapt from the Helldivers 2 reference

**Status: PROPOSAL.** This section interprets the video and transcript supplied for the design discussion. It is not an independent verification of Helldivers 2's current mechanics, and it does not silently replace Protocol Rebirth's existing rules.

| Reference principle | Adaptation for Protocol Rebirth | Boundary |
| --- | --- | --- |
| Clear primary objective, optional secondary work, uncertain discoveries | Establish one understandable purpose, then offer optional opportunities around it | Do not turn a short mobile raid into a long checklist |
| A visible mission/reward/upgrade loop | Connect the haul to a specific bunker or equipment payoff | Avoid rewards that lack an understandable use |
| Enemies create pressure, not just farming opportunities | Make routing, avoidance, timing, and extraction worthwhile decisions | Current kills contribute to other systems; removing those rewards is a separate design change |
| Big, perceivable capability choices | Favor noticeable tools, weapon identities, capacity, and access | Do not falsely describe the existing numerical progression as absent |
| Preparation near the moment it matters | Explain and offer equipment choices when there is an actual mission context | Do not teach the whole loadout system before the player has experienced combat |
| Progression through participation and efficiency | Preserve a recoverable path and useful progress after setbacks | Do not erase the meaning of extraction loss |
| Player-favoring clarity and recoverability | Make warnings, consequences, and return paths understandable | Generosity is not the same as guaranteeing every raid succeeds |
| Participation in a larger purpose | Use visible bunker/world restoration as the near-term purpose | A global campaign is not required for the current slice |
| Spending that feels supportive | Define business-model boundaries deliberately before implementation | D1 excludes insurance and paid bag recovery from the core loop; broader business-model questions remain open |

The video's respawn resources, friendly fire, shared loot, and stratagem input sequences belong to its particular cooperative design. They are not automatic recommendations for this game. Especially in an extraction game with losable gear, copying an isolated punishment mechanic without its surrounding recovery system would be a different design.

**Reference timestamps:** core loop 1:13-2:26; mission structure 2:36-5:30; death/friendly fire 5:35-8:43; enemy rewards and shared loot 8:50-10:34; distinct input/decision rhythm 10:40-12:24; progression 12:50-17:04; broader campaign and spending 17:09-20:59. [V01]

---

## 18. Decisions, contradictions, and scope boundaries

This is a review register, not permission to implement every item. Explicit approvals and proposed refinements are recorded in the [Design Decision Register](design-decisions.md). [D01]

| Priority | Topic | Status / evidence | Required outcome |
| --- | --- | --- | --- |
| P0 | Death and protection | D1 direction APPROVED: full risk, one Vault L1 Secure Slot, no BIT auto-rescue, no insurance/paid bag recovery, free retry | Finalize D1-A through D1-D and align runtime paths, migration, and UI; do not reopen the five approved rules by treating old code as design authority |
| P0 | Mission purpose and exits | D2.1-D2.3 APPROVED for quick PvE: return available from start, incomplete goals allowed, deliberate cancellable extraction; five seconds is initial test tuning | Align the old node-gated/automatic-entry implementation; resolve timer/interruption edges and D2.4-D2.7 nodes, topology, communication, and existing-variant mapping |
| P0 | Current onboarding | Base-first playtest guide vs later direct-raid FTUE and newer assist/clutch code | One canonical fresh-save journey; label the older route explicitly and reconcile it with the approved quick-mode extraction |
| P0 | Competing goals | Nodes, tracked build, quests, and extraction can all demand attention | One visible objective hierarchy; distinguish purpose from mandatory exit conditions |
| P0 | First upgrade payoff | Existing Fabricator/Vest reward vs multiple simultaneous systems | Show what changed and make it useful in the next raid |
| P1 | BIT system overlap | Older single-active-skill copy vs passive talent tree vs one active assignment; rescue conflicts resolved in direction by D1 | Explain Bond, hardware, talents, and assignments separately; remove/refactor item-rescue effects without adding a second protection route |
| P1 | Equipment persistence | Older per-item upgrade descriptions vs built-copy save semantics; D1 confirms deployed valuable gear is risked | Clearly state what is lost with a particular item |
| P1 | Merge requirements | Three-copy prose vs `[3, 7]` configuration | Verify live behavior and update old descriptions |
| P1 | Bag expansion | Module copy and progression mapping are not perfectly aligned; Secure Slot capacity detail still open | Show the actual computed capacity and each contributing source |
| P1 | Retention layering | Idle/power systems plus optional Fuel/contracts/report systems | Decide default exposure; preserve D1's free retry regardless of optional retention systems |
| P1 | Commerce boundaries | D1 excludes insurance/paid bag recovery; Signals-to-Data-Cores exchange and wider policy remain open | Explicit policy before any real-money release |
| P2 | Future game modes | M1: current mode is quick PvE; longer, freer PvP and co-op PvE are requested exploration tracks | Define separate mode contracts later; do not universalize nodes, timers, inventory transfer, or team rules |
| P2 | Catalog placeholders | Weekly operation stub and blueprint/catalog references | Separate visible promises from complete playable functionality |
| P2 | Old technical documentation | Node Raid README and integration history describe superseded states; older global PvE-only wording is qualified by M1 | Point readers here for the baseline and approved scope; retain history without presenting it as current authority |

### Future scope, not current baseline

**M1 - owner-requested exploration:** The current mode is the quick experience. Later, examine longer, freer PvP extraction with Tarkov as a reference and longer cooperative PvE sessions. Those modes may use objectives other than activating nodes. The owner has not fixed durations, player/team counts, objective structures, or delivery timing. "Free for all" does not settle deathmatch versus extraction, solo versus squads, or the presence of AI. [D01]

The world, bunker, BIT, combat, and extraction identity may provide common foundations, but shared progression, cross-mode inventory, reward rates, and loss/protection variations remain undecided. A later mode review must define these alongside revives, loot ownership, team extraction, and interruption handling. Do not quietly allow easy-mode rewards to transfer into another mode, or prohibit such transfer, without deciding the intended relationship. [D01]

This clarification means "PvE only" remains a current quick-mode constraint, not a permanent product-wide prohibition. It does not authorize PvP implementation, matchmaking, networking, a mode menu, or a parallel build. Low-friction joining has been discussed previously, but no production multiplayer behavior is established by this reference. [D01]

A backend/account system is also described as future work in the agent guide. The current design reference must not assume cloud saves, server-authoritative results, social progression, or a global campaign already exist. [S01]

### What this document does not approve

D1 approves the five specified risk/recovery rules for the loop under review. D2.1-D2.3 approve the quick mode's available return, independent personal-goal completion, and deliberate short extraction procedure. Five seconds is an approved initial test value, not permanent tuning. M1 records current scope and future exploration, not additional game-mode implementation. None of these approvals automatically authorizes a gameplay commit or merge. D1 specification recommendations, D2.3's remaining edge cases, and D2.5-D2.7 and final-payoff specifics remain open. [D01]

No new currencies, replacement economy, guaranteed success outside the defined FTUE assistance, removal of kill rewards, Helldivers-style friendly fire, broader monetization, or combat rewrite is authorized here. The purpose is a shared understanding from which scoped decisions can be made.

---

## 19. What a successful playtest should demonstrate

These are proposed validation questions. They are not measured outcomes of this documentation task.

### Comprehension

After an uncoached first complete loop, ask the player to explain what they were trying to achieve, what they brought home, what would have been lost on failure, what changed at the base, and why they might play another raid. A correct code path is not evidence that the player understood it. [S23]

### Decision quality

Observe whether the player makes a deliberate extraction/continue choice, recognizes an optional opportunity, uses an enemy's tell to change behavior, and selects or values equipment for a reason. Distinguish "I chose not to fight" from "I never noticed the enemy" and "I chose to leave" from "I could not find anything else."

### Suggested measures

| Measure | Definition |
| --- | --- |
| Time to first shot | First valid shot minus first PLAY action, on a genuinely fresh profile |
| Time to first extraction | First successful extraction minus first PLAY action; record attempts separately |
| First-loop completion | New profiles that extract and perform the intended first home payoff |
| Second-raid initiation | Players who voluntarily launch the next raid after seeing the first payoff |
| Goal comprehension | Player can name the active purpose and expected benefit without coaching |
| Risk comprehension | Player can distinguish home inventory, carried value, and relevant protection rules |
| Upgrade comprehension | Player can identify what an upgrade changes in actual play |
| Decision diversity | Different informed approaches are observed, not merely different button presses |

The prototype contains local FTUE timestamps and an event log, including a `ONE_MORE_RAID` concept in its documentation. Audit event definitions before treating them as a complete analytics funnel. No production retention percentages are asserted here. [S26] [S15]

**Recommended first review:** Inspect one fresh-save journey and one returning-player journey. For each interruption, record the triggering system, the decision it enables, whether the player needs it now, and what can be deferred without removing useful agency.

---

## 20. Glossary

| Term | Meaning in this document |
| --- | --- |
| Raid | One launched field run ending in extraction or loss; not a synonym for a single room |
| Quick mode / Quick Raid | Descriptive working label for the current short-session PvE experience, not an approved marketing name |
| Future mode | A separately reviewed ruleset; longer PvP/co-op tracks are exploration directions, not shipped features |
| Depth / level | A stage inside the normal quick raid; not Operator level |
| Area | Bunker, Archipelago, or Town on the world map |
| Node | A control objective involved in opening exits in the inspected baseline; its quick-mode role is under D2.4 review and cannot block the guaranteed ordinary return route; not universal to future modes |
| Extraction | The successful act that banks the exposed carried haul; not automatic personal-objective or depth completion |
| Secure Slot | The one item-protection mechanism approved at Vault L1; quantity, eligibility, and settlement details remain under review |
| HOME | Already secured persistent possessions |
| BAG | Exposed raid cargo except any explicitly protected item |
| Stash | Home storage for materials |
| Armory | Home storage for equipment and related usable items |
| Scrap | Soft currency |
| Scrap Alloy | A physical material, not Scrap currency |
| Rebirth Core | The central bunker facility |
| Data Cores | A progression-related currency |
| Operator level | Overall player progression |
| BIT Bond | Relationship/experience progression with BIT |
| BIT Bay | The companion's hardware facility |
| BIT talent | A learned specialization effect; not the same as an assignment |
| BIT assignment | Work that occupies BIT, subject to the one-active-task rule |
| Mk tier | Equipment build tier, separate from its incremental upgrade level |
| Field perk | A temporary modifier for the current raid |
| FTUE | First-time user experience: the introduction to play and the core loop |
| DDA | Dynamic difficulty adjustment applied to subsequent raid generation |
| Retention mode | A developer-configured experimental layer, not a difficulty setting or the future PvP/co-op game modes |

---

## 21. Source map and maintenance contract

### 21.1 Source hierarchy

For **what the build currently does**, prioritize inspected behavior and current implementation over old prose. For **what the game is intended to become**, prioritize explicit owner decisions and approved direction. The separate decision register records approvals made after the inspected baseline. Code is not automatic design approval, and an old proposal is not implementation evidence.

Implementation and historical-document links below are pinned to the inspected commit. This prevents the document's evidence silently changing underneath a review. Update the baseline and relevant claims together when refreshing it. D01 is intentionally a relative link to the living decision register in the same branch: its approvals are not claims about that older code snapshot.

### 21.2 Sources

| ID | Source | Used for |
| --- | --- | --- |
| D01 | [Design Decision Register][D01] | Owner-approved D1, D2.1-D2.3, M1 scope clarification and future exploration; outstanding details and no gameplay implementation implied |
| S01 | [Agent guide][S01] | Product direction, UI constraints, future backend boundary; its broad PvE-only wording is qualified by later owner clarification M1 |
| S02 | [Base application][S02] | Current app/save versions, persistent state, FTUE instrumentation, built-copy comments |
| S03 | [Art direction][S03] | Tone, setting, character identity, visual priorities, color semantics |
| S04 | [Raid round logic][S04] | Clock, inventory, terminal outcomes, extraction versus continuation, FTUE/Big-Map branches |
| S05 | [Meta/core integration history][S05] | Connected-loop contract and later explicit extraction/loss decisions; earlier sections are historical |
| S06 | [Armory design][S06] | Gear/stock separation and contextual UI intent; proposal-era numbers require current-code checks |
| S07 | [Facility data][S07] | Module requirements and benefits, storage capacities, room/access structure |
| S08 | [Recipes and item-use helpers][S08] | Crafting, recycling, material uses, displayable item purpose |
| S09 | [Raid level rules][S09] | Normal depths, nodes, encounters, alternate solutions, Hard settings |
| S10 | [Combat tuning][S10] | Telegraphs, weak-side bonuses, assistance-related settings |
| S11 | [Progression data][S11] | Starter state, bag progression, skills, Operator/mastery, world access, gear tiers and art |
| S12 | [Item data][S12] | Weapons, armor, materials, tool definitions, currency-bearing loot |
| S13 | [BIT data][S13] | Bond, dialogue, older skill definitions, rescue-related copy |
| S14 | [BIT talent data][S14] | Current branch structure, passive-core replacement, protection talent definitions |
| S15 | [FTUE design and decisions][S15] | Audit, direct-raid direction, owner decisions, target timings |
| S16 | [Raid stakes tuning][S16] | Healing budget, hunter cadence, spawn constraints, bag burden |
| S17 | [Raid perk data][S17] | Temporary upgrades, room-clear trigger, choice timer |
| S18 | [Retention, idle, power, and rest data][S18] | Mode distinctions, offline systems, facility maintenance, rest |
| S19 | [Vendor data][S19] | Stock, barter, currency exchanges, monetization tension |
| S20 | [Economy design history][S20] | Original proposals and later owner decisions; not a single current spec |
| S21 | [Quest and chip-shop data][S21] | Generated quests, authored chains, catalog, explicitly stubbed weekly operation |
| S22 | [Adaptive difficulty][S22] | Between-raid adaptation and local storage limitation |
| S23 | [Opening playtest guide][S23] | Earlier complete-loop route and comprehension-validation questions |
| S24 | [FTUE raid logic][S24] | Fixed opening enemies, clutch sequence, countdown semantics |
| S25 | [FTUE assistance data][S25] | Attempts and assistance settings |
| S26 | [Repository README][S26] | Connected raid entry point and documented event-log concepts; onboarding/save prose is historical |
| V01 | [Supplied Helldivers 2 design video][V01] | External design inspiration, interpreted from the supplied transcript/screenshots |

The user's supplied feedback and design discussion motivate the review questions and proposed adaptations. They are not substituted for current repository behavior.

### 21.3 Maintenance rules

When a change alters a player-facing loop, update the relevant section in the same PR or link the documentation follow-up. State whether the change is approved direction, implemented behavior, an experiment, or a proposal. Once a direction is decided, mark the former design conflict as resolved and separately track any remaining implementation mismatch or specification detail.

Keep exact balance tables in their source data. This reference should explain the job of the system and only repeat selected numbers that materially help a reader understand it. Documentation-only updates should not silently change runtime behavior or balance. Never relabel an approved rule as CURRENT until implementation evidence supports it.

State the applicable mode whenever a rule depends on session length, node objectives, team structure, extraction, or reward transfer. Do not turn current quick-mode behavior into a universal product restriction, or turn future exploration into an implementation commitment. [D01]

### 21.4 Instructions for AI-assisted use

Use this document as the navigation layer, then inspect the linked implementation for the question being asked. Preserve the status labels and read D01 for post-baseline approvals. Never turn a proposal, a catalog entry, a stale comment, an approved-but-unimplemented rule, a future-mode idea, or a configured-but-unverified path into a shipped feature. When a source conflicts with this reference, report the conflict and the baseline involved rather than inventing a reconciliation.

Useful questions include: "What must a new player understand before their first extraction?", "Which permanent systems currently interrupt the first raid?", "What does this upgrade change in the next run?", and "Which source defines the actual death behavior for this mode?"

### Document change log

- **v4.16, 8 November 2026:** Owner approved M27: after fully earned Fabricator L1, player chooses accessible Vault L1 or BIT Bay L1 as the single tracked Project. BIT may suggest but cannot enforce; both rooms retain final-stage functional unlock and no extra materials. Earlier fixed build sequences are not mandates. Documentation only.
- **v4.15, 8 November 2026:** Owner approved M26: major rooms gain 2–3 meaningful visual-only restoration stages within their unchanged total resource cost; all functional perks/room rewards unlock at full completion, including Fabricator material-commerce eligibility and Vault Secure Slot. Detailed stages/cost splits remain open. Documentation only.
- **v4.14, 8 November 2026:** Owner approved M25: players read route/encounter risk from environment, enemy tells and concise contextual BIT cues, without explicit numerical risk tiers or total foreknowledge; preserve mobile accessibility, fair counterplay and voluntary extraction. Documentation only.
- **v4.13, 7 November 2026:** Owner approved M24: standard raid difficulty follows chosen depth/routes, readable risks and tactical threats, rather than invisible player-performance scaling. The D3.8 bounded first-normal-raid failure assistance is explicitly retained; inspected adaptive code remains historical baseline only. Docs only.
- **v4.12, 7 November 2026:** Approved M23: introduce distinct enemy archetypes quickly through playable encounters and build subsequent tactical difficulty through combinations, terrain and positioning, not long tutorials or HP inflation. No game code changed.
- **v4.11, 7 November 2026:** Owner locked M22: enemy behavior, combinations, positioning and terrain are the primary combat depth; Basic Carbine alone must stay fun and viable, with later equipment providing additional approaches. Implementation/tuning remain open; docs only.
- **v4.10, 7 November 2026:** Owner approved M21: deeper quick raids should offer richer tactical encounters/route choices alongside improved probabilistic loot opportunities, without guaranteeing rewards or removing voluntary extraction. Specific tuning remains open; docs only.
- **v4.9, 7 November 2026:** Locked M19D's three owner decisions and linked the concise core/meta/commerce contract. Reconciled M5 entry timing and progression guidance; retained history with supersession markers. No gameplay or deployment changes.

- **v4.9, 7 November 2026:** Owner approved M20C: BIT foregrounds no more than one voluntary lead at the bunker, while other optional discoveries remain possible organically in ordinary raids. The single home cue is not another tracked project or quest list. Home selection/replacement timing remains open; no gameplay code.
- **v4.8, 7 November 2026:** Owner approved M20B: optional BIT leads remain discoverable over multiple ordinary raids and are replaced through organic world changes rather than short timers or FOMO. Transition triggers, simultaneous lead count, frequency and rewards remain open. Documentation only, no gameplay code.
- **v4.7, 7 November 2026:** Owner approved M20A: BIT gives a discreet living-world lead in the bunker before an ordinary raid; what it means is discovered during gameplay. The hint is optional, never a mission queue, purchase or loot guarantee. Frequency, persistence, rewards and exact presentation remain open. Documentation only, no gameplay code.
- **v4.6, 7 November 2026:** Owner locked M20: optional BIT-signaled living-world leads exist as detours inside normal raids; no separate mission queue or mandatory daily tasks. Clarified integration with owner-approved home Project, 2–3 cost-neutral visual restoration stages, and post-Fabricator-only material purchases. Presentation and pacing still open; no code change.
- **v4.5, 7 November 2026:** Added M19C concrete first-ten-successful-extraction experience and current module cost audit. Rewards arise only from actually banked resources and earned unlocks; outcomes are a flexible test sequence, not count-based grants or final economy tuning.
- **v4.4, 7 November 2026:** M19B clarified that simplifying progression does not remove tactile passive effects: level-based operator speed growth and current loot-bag movement/detection cost remain central, with their exact curve/visual feedback awaiting device playtest. No gameplay code changed.
- **v4.3, 7 November 2026:** Captured M19A owner direction for simpler early progression and optional endgame depth, with a proposed pruning/reveal plan for Operator skills, weapon mastery and BIT Bond/talents. No implementation or skill deletion.
- **v4.2, 7 November 2026:** Added M19 cohesive 30/60/90-day progression and content economy, one home Project, meaningful post-raid payoff, content reuse, commercial boundaries and explicit remaining tuning decisions. Design only; gameplay updates remain on separate feature branch.
- **v4.1, 7 November 2026:** Owner clarified Archipelago needs substantially larger navigable outdoor areas while Bunker sizing works but needs richer structural/encounter variety. Added M18B, spatial generator audit and playtest-only 1.5–2x footprint hypothesis. No gameplay edits.
- **v4.0, 7 November 2026:** Added owner-requested M18A strong within-biome raid variation: loot, enemy compositions, routes, tactical choices, optional field events and mission purpose. Linked proposed seeded situation-director design and proposed anti-repeat validation; no gameplay or economic changes.
- **v3.9, 7 November 2026:** Defined M18 World & Mission Design across Bunker, Archipelago and Town, region unlocks via Core plus extracted scouting items, one-purpose mission hierarchy, procedural map templates, story/mystery spine and legacy-raid alignment risks. Documented only; no new story canon or gameplay code approved.
- **v3.8, 7 November 2026:** Added the joint M16/M17 design pass. M16 specifies enemy roles, biome/depth difficulty and paired-pressure encounters; M17 maps the current weapons/armor/tools to four emergent tactical build identities, explicitly preserving free counterplay, controlled-risk loss and limited operator milestone choices. Documentation only; no spawn/tuning or gameplay code changes.
- **v3.7, 7 November 2026:** Detailed M15 reusable tactical encounter grammar across bunker/forest/town using six verbs (power, diversion, flank, hazards, support, optional risk/reward) and explicit candidate priority for Shielded Relay Room Issue #205. No gameplay code changes or approved mechanics/rates.
- **v3.6, 7 November 2026:** Added the integrated eight-minute raid blueprint M14 with concrete combat / optional tactical room / extraction / persistent home-and-identity rhythm, first Shielded Relay Room slice, guardrails and playtest acceptance. No game code changes or numerical tuning approval.
- **v3.5, 7 November 2026:** Added the integrated Identity & Home Meta system specification (M12) with shared operator/BIT/bunker/profile identity, early free rewards and cosmetic currency separation. Recorded the owner's new core gameplay enjoyment priority (M13): optional multi-solution tactical problem rooms inspired by classic Metal Gear Solid, starting with a proposed Shielded Relay Room vertical slice. No code changes or balancing approvals.
- **v3.4, 7 November 2026:** Captured M11 player Callsign and collectible nameplate direction, plus earned titles, emblems, profile cards and coordinated cosmetics across operator/BIT/bunker. Specified an optional post-FTUE naming flow and offline local-only identity caveat. Exact catalog and UX remain proposals; no code change.
- **v3.3, 7 November 2026:** Owner reaffirmed that operator appearance is a core meta customization pillar, not subordinate to bunker room restoration. Added proposed cosmetic slots, early free styling reward and strict separation of owned cosmetic identity from losable equipment under D1. Documentation only.
- **v3.2, 7 November 2026:** Owner requested and approved more frequent visible early bunker restorations (M9), differentiating major functional rooms from low-cost visual repair beats. Recorded proposed first-week sequence and critical FTUE/material-gating protections. No code or numeric balance changes.
- **v3.1, 7 November 2026:** Linked draft PR #204 deterministic offline economy harness and initial successful Actions test. Recorded open decision on first-week free restoration rhythm and need for actual big-level/pickup calibration. Workbook binary pending upload. No game changes or new economic approvals.
- **v3.0, 7 November 2026:** Recorded M7 matched-activity/pay-only Monte Carlo (1,000 seeds per cohort) using prototype loot-weighted random pickups. Identified Core L2 free progression bottleneck and late-tier rare material purchase plateau. Explicit sampling limitations and next actual-runtime validation. Analysis only; no live economy changes.
- **v2.9, 7 November 2026:** Completed and documented first-pass post-FTUE 30-day economy scenario (M6) across four spend/activity personas, with explicit baseline sources, assumptions, results and priorities for same-activity controlled experiments and stochastic loot validation. Documentation only; no prices or implementation approved.
- **v2.8, 7 November 2026:** Owner approved commercial hybrid C (M5) direct resources + bunker milestone Growth Fund + cosmetic collections; specified proposed late/retroactive claiming, room-adjacent direct purchase UX, commercial placements, event and offer guardrails without approving numerical rates or implementing commerce. Documentation only.
- **v2.7, 7 November 2026:** Owner selected full midcore Model C, permitting paid functional meta resources/progression alongside cosmetic room/operator/BIT purchases. Proposed a concrete Signals wallet, sinks/sources, starter SEK price ratios, milestone/seasonal offers, paid-vs-free modeling and explicit D1 extraction integrity guardrails. Numerical offers and implementation remain proposals.
- **v2.6, 7 November 2026:** Researched Whiteout Survival, Survivor.io and Toca Boca World as distinct monetization/progression references; proposed M3 three-loop economy, currency separation, clear direct cosmetic packs, phased live events, and measurable commercial validation. Paid progression policy, offers and pricing remain unapproved. Documentation only.
- **v2.5, 7 November 2026:** Owner approved P1.3 hybrid Operator milestone choices; meta monetization direction expanded to premium currency and visual personalization of operator, bunker rooms and BIT. Recorded optional bunker naming inspired by Hay Day as a proposed identity feature without adding FTUE friction. No monetization mechanics, prices or removals were approved. Documentation only.
- **v2.4, 7 November 2026:** Owner approved P1.1 option C — bunker progression opens the world, Operator progression establishes playstyle, equipment provides risky tactical builds, and BIT grows as a companion. Identified overlap and FTUE/BIT Bay inconsistencies for future review without authorizing removals. Documentation only.
- **v2.3, 7 November 2026:** Owner approved all six D3.9 FTUE closure rules; FTUE high-level design is locked for implementation and playtesting. Other game-system design remains under review. Documentation only.
- **v2.2, 7 November 2026:** Drafted D3.9 final FTUE closure package for owner sign-off, including explicit bunker-door completion, no pre-BIT result interruption, first normal extraction as onboarding exit, and Fabricator not required to finish onboarding. Proposal only; no code changes.
- **v2.1, 6 November 2026:** Approved D3.8 progressive contextual and combat assistance after failed attempts at the first ordinary raid with BIT, while preserving genuine loss and player-controlled extraction. Exact assistance values and legacy FTUE reconciliation remain open. Documentation only.
- **v2.0, 6 November 2026:** Approved D3.7 contextual, non-blocking BIT guidance during the first ordinary raid; proposed six event-based learning moments and guidance scheduling, distinguished from the earlier no-BIT introductory approach. Exact bark/trigger tuning and implementation remain open. Documentation only.
- **v1.9, 6 November 2026:** Approved the concrete D3.5 Core L1 first restoration (two guaranteed Scrap Alloy from intro, consumed at Core activation, visible power restoration, Fabricator L1 next goal) and D3.6 (free full intro restart on death, no duplication or permanent-progress loss). Exact UX and pacing still open. Documentation only.
- **v1.8, 6 November 2026:** Approved D3.5 concept (spend intro loot to restore a visible part of home). Proposed a deterministic two-Scrap-Alloy pickup, existing Core L1 restoration, and Fabricator L1 as next raid goal, carefully separating proposed detail from owner approval. Documentation only.
- **v1.7, 6 November 2026:** Approved D3.2: bunker entry concludes the introductory playable mission as the first extraction, BIT is encountered inside, and the first regular raid with BIT follows. Exact entry/intro loot/loss/retry rules remain open. Documentation only.
- **v1.6, 6 November 2026:** Revised D3.1 from BIT-first onboarding to a playable combat approach culminating in discovering BIT inside the bunker. Recorded owner's greeting, “You're late, but you're back.” The boundary between introductory mission completion and extraction is explicitly open. Documentation only.
- **v1.5, 6 November 2026:** Approved D3.1 (option C): very short interactive BIT introduction, immediate combat, bunker introduction after the first extraction. Exact opening beats and FTUE testing remain open. Documentation only.
- **v1.4, 6 November 2026:** Approved D2.4 (required nodes consistently unlock forward progression, separate from return extraction) and D2.8 (deeper loot opportunities plus a distinct valuable terminal objective/payoff, option C). Preserved open reward/encounter tuning, topology, and FTUE questions. Documentation only.
- **v1.0, 6 November 2026:** Consolidated the game's loops and system model, separated current evidence from direction/proposals, and recorded unresolved documentation conflicts.
- **v1.1, 6 November 2026:** Recorded owner-approved Controlled Risk decision D1, linked the decision register, reconciled the loss/BIT/insurance/free-retry direction across relevant sections, and opened D2 as an explicitly unapproved proposal. Secure Slot details and interrupted-session behavior remain open. No gameplay change or fresh runtime validation is implied.
- **v1.2, 6 November 2026:** Recorded D2.1/D2.2 approval: at least one ordinary return extraction available from the start, with extraction success independent of personal-objective completion. Updated the loop, objective, result, glossary, and review sections while retaining the older node-gated behavior as the inspected baseline. D1 details, D2.3's countdown proposal, and D2.4-D2.7 remain open. Documentation only; no gameplay change or new runtime verification.
- **v1.3, 6 November 2026:** Recorded D2.3 approval for deliberate, short, cancellable quick-mode extraction, with five seconds as initial test tuning. Added M1: the current focus is the quick PvE experience, while longer, freer PvP and cooperative PvE are future exploration. Qualified the older global PvE-only wording, separated mode scope from common systems, and left multiplayer/transfer rules unspecified. D1 details, D2.3 edge cases, and D2.4-D2.7 remain open. No gameplay implementation or new runtime verification.

[D01]: design-decisions.md
[S01]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/AGENTS.md
[S02]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/app.js
[S03]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/docs/art-direction.md
[S04]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/nodspel/round.js
[S05]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/docs/meta-core-integration.md
[S06]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/docs/design-armory.md
[S07]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/modules.js
[S08]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/recipes.js
[S09]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/nodspel/levels.js
[S10]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/raid-combat.js
[S11]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/progression.js
[S12]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/items.js
[S13]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/bit.js
[S14]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/bit-talents.js
[S15]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/docs/ftue-design.md
[S16]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/raid-stakes.js
[S17]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/raid-perks.js
[S18]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/retention.js
[S19]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/vendors.js
[S20]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/docs/economy-design.md
[S21]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/quests.js
[S22]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/nodspel/dda.js
[S23]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/docs/opening-playtest.md
[S24]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/nodspel/ftue.js
[S25]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/data/raid-ftue.js
[S26]: https://github.com/w4sser/protocol-rebirth-proto/blob/88a9ac6364d0dcf5463c2a5f700f4817960ecaca/README.md
[V01]: https://www.youtube.com/watch?v=sTa7GatZC98
