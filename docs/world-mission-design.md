# Protocol Rebirth — M18 World & Mission Design

> **Status:** Integrated design **proposal**, 7 November 2026. Prepared after M16–M17. This is design documentation in PR #201, not authorization to change gameplay, area layouts or economic rates. Explicitly preserve D1/D2/D3, including early return extraction. **Owner-approved prior direction:** world order Bunker → Archipelago → Town, permanent bunker/Core progression, earned scouting access and short mobile raids. Exact missions, landmarks, room templates and content targets below are proposed.

## 1. Promise: a world worth reclaiming

**The player goes out into a recognizable, beautiful, abandoned Swedish archipelago to recover useful things, uncover what happened, and slowly bring life back to a place they call home.**

The world should tell its story with what the player *sees and does*, rather than through lengthy text. Keep the established art mood: **Nordic summer night**, calm horizon gradient, sea and islands, granite, pines, old utility installations, warm restored lights and the occasional amber / coral / cyan signal. **Dark, but never hopeless.** No flags or dependence on real restricted military layouts. Fictional coastal installations can take inspiration from Nordic bunker architecture without reproducing sensitive real-world details.

### Three complementary reasons to explore

1. **Practical:** track parts required for a bunker restoration, operator/gear upgrade, or BIT maintenance.
2. **Curiosity:** discover why a facility failed, who was here and what the Protocol is trying to reconstruct.
3. **Mastery:** learn a safe route, identify an enemy weakness, recognize a room system, and voluntarily tackle deeper opportunity.

Each major journey should offer at least two of these, but the player must still understand **one clear personal purpose** when deploying.

## 2. Three places, three gameplay identities

| Biome / region | Visual and emotional identity | Play space and route tension | Tactical grammar and opponents | Example useful rewards | What the player learns |
| --- | --- | --- | --- | --- | --- |
| **Bunker / sealed coastal facility** | Navy/teal concrete, orange emergency lamps, hydraulic doors, repairable machinery; claustrophobic but increasingly welcoming | Short passages, side rooms, relay chambers, abandoned storage. Two ways through a space when possible | T1 **Cut Power**, T3 **Flank**, support disruption; grunt, rusher, shield turret | Scrap Alloy, Cable, common electronics, components for Fabricator/Vault | How the game works: purpose, combat, extraction, first systems and home payoff |
| **Archipelago forest / islands** | Pine forest, summer-night sky, lavender granite slabs, moss, reeds, sea, ruined infrastructure and coastal walks | Irregular forest paths, island chokepoints, bridge approaches, exposed rock and concealed branches; no impassable tight funnels | T2 **Divert Attention**, T3 **Break Sight**, T4 **Use Hazards**; scout, rusher, patrol, sniper as learned | Navigation evidence, coastal components, Tidal Coil, scarce targeted Core parts | How to read patrols, scout lanes, optional routes and environmental cover |
| **Abandoned settlement / Town** | Red/yellow cottages, warm dormant windows, overgrown streets, sheds, shops and warehouses; traces of normal lives | Street-to-house transitions, yard cover, windows, alleys, high-risk crossing, searchable containers | T5 **Disrupt Support** plus attention / crossfire; sniper, repair, turret, artillery in later combinations | Frost Glass, Memory Module / electronics, surveys and late restoration needs | How to prioritize enemy support and plan multi-step routes |

**Constraint:** A biome is not merely a texture set. It must change how the player approaches cover, paths and enemy combinations while preserving learned rules. Small phones need large readable silhouettes; visual dressing cannot compromise collision, route width or frame rate.

## 3. One world map: access, intelligence and player choice

**Existing design reference (confirmed in the repository):**
- Starting region: **Bunker**.
- **Archipelago:** Core L2 **plus a successfully extracted Archipelago Chart** from Bunker.
- **Town:** Core L3 **plus a successfully extracted Town Survey** from Archipelago.

This is the configured access logic in the existing design reference, not a claim that the current UI/runtime is already completely aligned. Both requirements must be surfaced separately: **restore Core** (persistent power) and **bring back reconnaissance intelligence** (actual extraction).

### Proposed world-map UX

One compact accessible map with:
- **Available:** region card with one clear personal target, threat character, likely material families and a recognizable image. "Likely" is not a guaranteed drop.
- **Locked:** show just the next two requirements, e.g. `Core L2` and `Extract Archipelago Chart`, with **Track** functionality. Do not lock behind opaque account level.
- **Visited:** show 2–3 discovered landmark categories and remembered route tendencies (safe/fast/risky), without revealing every random room.
- **RAID:** primary action stays obvious; no nested world-map configuration wizard before every quick raid.

**Critical D2 distinction:** unlocking a *world region* is not permission to block a currently accessible return extraction inside a raid. Scouting an area remains an authored goal; failing it does not invalidate a successful early extraction with ordinary cargo.

## 4. Missions: five player-facing types, one priority at a time

| Mission layer | Who sets it | Example / player intent | Completion rule | Reward |
| --- | --- | --- | --- | --- |
| **Personal Recovery Goal** | Player tracks next desired upgrade | Recover Cable to finish Fabricator L1 | Materials must be **successfully extracted** then spent on real upgrade | Functional room and visible home change |
| **Story / World Milestone** | Authored spine | Recover the Archipelago Chart and bring it to BIT | Extract the actual chart and satisfy Core access condition | Next region + a short mystery reveal |
| **BIT Contract** | Optional repeatable offer | Search two cabinets, defeat scouts, extract specific part | Use each quest's own measurable event/result and claim rule | Scrap, Operator XP, tool, Contract Chips as currently configured |
| **Opportunity / Tactical Discovery** | Generated by room and player curiosity | Investigate a defended signal room, open a side cache | Local accomplishment may count for mastery; any carried item still needs extraction | Optional high-value material, earned skill/title progress |
| **Deep Expedition Payoff** | Authored end-of-depth objective under D2.8 | Reach a guarded transmission archive with a distinct final decision | Complete its own action and extract eligible cargo; no automatic success from reaching room | Rare targeted reward and story reveal |

**Anti-complexity rule:** The raid HUD prioritizes **(1) current tracked purpose, (2) return extraction route, (3) optional opportunities**. BIT Contract progress should appear only when relevant, not as a second competing primary mission. Personal missions should be optional: extraction can succeed with none completed.

### Existing quest source caution

- `data/quests.js` has generated BIT quests based on **reachable enemy/loot facts**, three per day and one free swap, plus authored permanent chains `Wake the Core` and `Signals at Sea`.
- The existing quest-chain table does **not** contain an equivalent fully authored Town chain; adding one is a **future content proposal**, not currently shipped.
- `data/progression.js` contains an older scripted first-hour sequence and legacy insurance/recovery settings. It is **not** current design authority where D1/D3 decisions supersede it. Do not port its forced outcomes, paid rescue or guaranteed loot assumptions to the new plan as if approved.
- `data/raid_zones.js` describes an older simulated zone/route/risk system with extraction chance modifiers. Those probability tables should not dictate the physical D2.3 extraction procedure for the intended playable raid.

## 5. One simple mission card: objective, location hint, extraction promise

**Example (PROPOSED, bunker material raid):**

```text
FABRICATOR / POWER RESTORATION
Need: 2 Cable (1 already HOME)
Likely source: Electrical Storage — Bunker
Optional: Search the Relay Room for higher-value components
Return: Extraction route available immediately
Risk: Any carried materials are lost on failed extraction
[ TRACK ]     [ RAID ]
```

Do **not** guarantee precise drops through a "likely" label, except explicitly authored FTUE guarantees approved under D3. World-map targets should be derived from real obtainable loot/pools and updated when pools change; avoid quests asking for items that cannot spawn.

**When successful:** results clearly separate **extracted**, **quest objective accomplished**, **depth/area progress** and **newly available restoration**. If the player returns with only one Cable of two needed, this is a good partial homecoming, not a failed raid.

## 6. Map grammar and procedural variety

**Goal:** repeatable spatial language and handcrafted-feeling outcomes. Instead of fully random spaghetti, assemble seeded, validated spaces from a small number of legible templates.

| Template | Purpose | Typical combat | Optional find | Appropriate biome |
| --- | --- | --- | --- | --- |
| **Approach / First Contact** | Short readable fight or safe orientation | One grunt/rusher, clear cover | Common material hint | All |
| **Fork & Landmark** | Let player choose an obviously different route | Light threat or patrol | Unknown cache / short route | Bunker + forest + town |
| **Tactical Room** | One dominant T1–T5 mechanism and alternative solutions | Shield turret or support pairing | Protected cache | All |
| **Scavenge Pocket** | Improve material recovery without lengthy combat | Minimal or predictable risk | Searchables and themed loot | All |
| **Pressure Transition** | Change geometry and make deeper movement challenging | Two readable complementary enemies | High-value optional | All |
| **Distinct Deep Objective** | Memorable final set piece with genuine payoff | Known rules recombined | Rare target + story fragment | All |
| **Return / Extraction Approach** | Allow clear navigation and a conscious exit decision | Optional external pressure | No required boss or node | All |

### Generation requirements

- **Connectivity:** every ordinary raid has a reachable return extraction at spawn and no required personal-objective gate; after optional traversal or activating nodes, return must remain possible. Never put an enemy, tree, railing or room prop on the sole walkable exit path.
- **Bridges/shorelines:** entry and exit should funnel naturally, navigation and bot movement should not snag, no tree on bridge, actual player movement/shoot space maintained. This directly addresses prior bridge playtest issues.
- **Visible purpose:** camera and path curvature should suggest where to go without a giant arrow filling the screen. Recognizable landmarks instead of texture-only biome distinction.
- **Procedural reward:** actual container/loot locations and item tables must be consistent with the selected mission's likely family; if a resource is impossible, the UI must not suggest it.
- **Mobile performance:** reuse existing geometry/assets, strong culling/LOD and restrained VFX; use existing Low-quality >40 FPS device-test target as a verification gate, not a guaranteed live metric.
- **Failure containment:** fallback to a known-valid route if procedural placement creates an unreachable door/loot/extraction. Seeds can reproduce a reported failure.

### Reuse before content explosion

Suggested initial library **per biome**: 2–3 recognizable landmarks, 2 approach patterns, 2 tactical/opportunity templates, and one authored deep objective. These are **production sizing hypotheses**, not locked content counts. Apply one learned mechanic in multiple spaces before inventing more.

## 6A. Variation within each world — M18A

**OWNER-REQUESTED DESIGN REQUIREMENT, 7 November 2026:** Replaying the same world must feel substantially different because **loot opportunities, enemies, route topology, tactical challenges and ways to play** change from raid to raid. Merely changing prop colors, room order or random damage numbers does not count as meaningful replayability.

**Companion specification:** [M18A Raid Variety & World Replayability](raid-variety-system.md) defines six variation axes (routes, enemies, tactical verbs, loot opportunities, optional field events, and changing mission/discovery purpose); seeded situation grammar; biome-specific encounter pools; possible anti-repeat weighting; mobile/extraction validity constraints; and actual-play verification criteria.

**Guiding rule:** Stable biome identity + remixed tactical situation. Reuse recognizable buildings, granite/pine/coastal landmarks and learned systems while changing the threats and opportunities around them. In three consecutive committed raids to the same biome, players should have at least two meaningfully different decisions to make (playtest hypothesis). No procedural generator is accepted if it makes extraction unreachable, quest loot impossible, mobile combat unreadable, or a paid-only tool mandatory.

**Status:** Approved owner *direction for substantial within-world variety*; exact director algorithm, variants, encounter frequencies, loot adjustments and dynamic event catalog are design proposals only. Existing big-level procedural generation should be measured for real coverage before replacing it.

## 7. Exploration and discovery without slowing an eight-minute raid

**A raid should contain at least one moment of curiosity, but not necessarily a mandatory lore collectible.**

Suggested discoveries:
- **Functional:** map fragment or equipment hint reveals a likely supply route.
- **Environmental:** abandoned dinner table, unused life jackets, a generator room someone tried to repair; no text wall.
- **Mystery:** a signal that BIT recognizes but does not fully explain; gradually reveals the Protocol's history.
- **Tactical:** a link between a relay and a defense mechanism the player can exploit.

**Discovery reward boundary:** The first encounter with a landmark can grant an **earned journal/log entry** (persistent exploration knowledge), but a **physical chart, rare component or salvage must be extracted** to be banked. No automatic risk cancellation.

**Presentation:** one short BIT observation or visual environmental event, optional deeper lore in a safe home archive. No interrupting gameplay with forced cinematic dialogue or a codex pop-up during combat.

## 8. Region-by-region story spine (PROPOSED)

### Act I — Bunker: A dead home

- **Question:** Why does the Core still respond to the operator and BIT?
- **FTUE:** fight toward the bunker, meet BIT inside, restore Core L1 with guaranteed two Scrap Alloy (approved D3), then enter ordinary raid.
- **Mid-term discovery:** equipment stores and control rooms expose the first fragment of the network. The player learns that more facilities remain connected outside the bunker.
- **World milestone:** locate and **successfully extract the Archipelago Chart**, then restore Core L2 to venture outside.

### Act II — Archipelago: Lights across the water

- **Question:** Who or what is still operating the abandoned coastal system?
- **Adventure:** summer-night forest clearing, ferry pier remnant, rocky waterline, drowned utility post, pine-covered paths; no boat-based traversal is required.
- **Tactical identity:** moving scouts, readable sight lines and side routes around exposed crossings.
- **World milestone:** find the **Town Survey**, extract it, then restore Core L3.
- **Distinct payoff:** a transmission or sign of other life that changes the player's interpretation of the facility, without answering every mystery.

### Act III — Town: Echoes of ordinary life

- **Question:** What happened to the people who lived here, and what does rebuilding actually mean?
- **Adventure:** abandoned houses, street corners, dark windows, garages, depot/storage, workshop, human traces in otherwise quiet surroundings.
- **Tactical identity:** alarms, support bots, interlocking sightlines and attractive indoor opportunities.
- **Story milestone (OPEN):** propose a short Town authored chain after playtesting—**not** a current repository chain. The payoff should create the next *reason to build*, not imply that the story is over at Town.

**Narrative tone:** restrained and hopeful. Let player curiosity and the act of restoring home drive emotion; avoid exposition-heavy dialogue.

## 9. Long-term world cadence and meta synergy

The outer loop should balance three kinds of satisfaction:

1. **Every successful short return:** something usable came home, even if partial; it may contribute to a low-cost visible repair.
2. **Every few worthwhile returns:** a major functional bunker improvement or new capability becomes possible. Exact pace calibrated through M6/M7 plus the actual raid simulator, not simply picked for monetization.
3. **At major world milestones:** a genuinely different region, combat grammar, resources and story question opens; cosmetics/nameplates can commemorate earned scouting mastery without buying access.

**Operator / BIT / Profile:** Combat mastery earns titles or nameplates, BIT recognition and optional cosmetic accents; operator clothes/weapon looks display identity. They do not change the logic of a world map key. Room-by-room bunker restoration displays tangible progress and supplies the resource demand that gives missions purpose.

**Monetization:** optional Signals/resource bundles and Growth Fund can help with **material progression under approved M4/M5** but may not substitute for extracting the required scouting chart/survey or physically using extraction. Cosmetic purchases do not unlock a world region. No cash shop prompt during a raid or forced FTUE.

## 10. Content validation matrix

| What must be tested | Why | Evidence / suggested pass signal |
| --- | --- | --- |
| Player understands deployed purpose | First-time clarity issue | After first 30 sec: can state goal, what is in bag and where return is |
| Ordinary return extraction genuinely accessible | D2 rule | From every generated seed, return can be reached and intentionally completed before nodes/personal goal |
| Chart/Survey drop and hand-in match UI | Prevent progression softlocks | Obtainability verified by area, depth, current mode, plus actual successful extraction persistence |
| Each biome plays differently | Not only art variation | Blind testers describe different route/combat decisions across Bunker/Forest/Town |
| Meaningful route choice | Avoid empty exploration | At least two routes generate different observed risks and opportunities |
| Tactical room allows alternatives | M13–M17 core fun priority | At least two distinct methods work and are discovered on phone |
| Bridge/bot navigation and props | Known playtest risk | No player/enemy stuck incidents on tested seeds; no trees on crossing |
| Short-raid pacing | Protect mobile format | Meaningful early short returns and full runs around target budget without mandatory detours |
| World unlocks feel earned | Tie exploration to home | Player understands both Core milestone and scouting item, no premium-only route |
| Mobile quality | Playability | Test real phone FPS, readability, touch targets, correct collisions at Low/High |

**Suggested seed test:** sweep 100–1,000 deterministic level/biome seeds per topology change and validate connectivity, reachable extraction, bridge clearances and obtainable loot; follow with actual device playtesting. Seed automation verifies generation correctness, not whether a space is fun.

## 11. Minimal production rollout (DESIGN HANDOFF, not authorized code)

1. **Alignment audit:** reconcile `data/raid_zones.js` simulation vs current playable Node Raid + Big Map and current world map/quest UI. Explicitly list which code paths are actually used before changing data.
2. **Mission UX vertical slice:** one tracked Fabricator material goal, plausible destination hint, no promised drop, a clear usable return extraction and distinct post-raid result fields.
3. **Bunker tactical test:** Issue #205 Shielded Relay Room, with optional cache and no mandatory exit gate.
4. **Forest exploration slice:** one scenic path/fork, scout patrol, side objective and safe return corridor; preserve bridge navigation and FPS.
5. **Town search slice:** readable building access, one searchable house and one support/priority encounter; avoid spawning overlapping colliders.
6. **Progression review:** real Core L2 + Chart and Core L3 + Survey requirements, no softlocks, documentation and economy alignment. Add Town story chain only if warranted.

## 12. Design questions remaining (OPEN)

- Should players select a specific **sub-zone / route** on the world map, or initially only an area + tracked goal and let the raid generate the path? **Recommendation:** initial mobile UI should show area + tracked goal and perhaps one simple safe/risky search-route choice only if it creates real gameplay differences. Avoid legacy probability sliders.
- How much of the map becomes permanently known after discovery versus remixed each raid?
- What is the first deep objective's authored payoff beyond a rare part?
- What is the shortest satisfying raid, and should quick-return materials be calibrated separately from deep-run profits?
- Does the real big-level mode support physical D2 return extraction for every seed after map changes?
- When do we author the Town chain and what should it unlock beyond Town?

**M18 recommendation:** Commit to a **single coherent world-map and mission contract** with two independent unlock requirements (Core restoration + actually extracted scouting intel), strong biome gameplay identity, mission-based exploration and physically available return extraction. Keep detailed map generations, drop rates and story payoffs provisional until playtested.

**Design documentation only. No game implementation has been changed.**
