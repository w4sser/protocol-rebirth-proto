# Protocol Rebirth — M18A Raid Variety & World Replayability

> **Owner direction, 7 November 2026:** Each return to Bunker, Archipelago or Town should feel different through **different loot, enemies and ways to play**. Variation is a primary product requirement, not visual dressing. This document proposes how to achieve it while maintaining short mobile extraction sessions, clear mission goals, reliable return extraction and coherent biome identities. **No gameplay changes or spawn/economy weights approved.**

## 1. Desired experience

A repeat raid in the *same world* should offer a different question:

- **What am I hunting?** Different resource opportunities, item families and optional valuables.
- **What threatens me?** Different enemy role combinations and threat placements.
- **How do I approach it?** Different routes, cover, tactical mechanics and optional tools.
- **What unexpected opportunity appeared?** Optional event or mini-scenario changing the decision to leave or press on.
- **What do I remember afterward?** A clever maneuver, narrowly missed extraction, surprising loot or a useful new discovery.

**Variety means changes in player decisions, not just changes in random numbers or cosmetic props.** Distinguish a *world's stable identity* (recognizable terrain, architecture, mood, learned rules) from the *raid's variable situation*.

## 2. Six orthogonal variation axes

| Axis | What the director remixes | Example changes | Player-visible effect |
| --- | --- | --- | --- |
| **V1 — Topology & route** | Connected room / terrain modules, fork choices, cover, bridges, entrances, optional POIs | Bunker: sealed side wing vs loop; forest: granite ridge vs pine corridor; town: alley vs house-to-house route | Different path, approach and retreat; return exit always valid |
| **V2 — Enemy composition** | Compatible M16 roles, spawn positions, patrol/alert readiness, reinforcement potential | Rusher + grunt instead of shield turret; scout patrol instead of swarm pocket; repair behind sniper | Different target priority, movement and weapon effectiveness |
| **V3 — Tactical system** | One of M15 T1–T5 opportunities, plus optional second learned rule | Relay shield sabotage; flank/crossfire; alarm/attention; break a repair link | Different viable solutions, not a mandatory puzzle |
| **V4 — Loot opportunity** | Resource-family weights tied to biome/sub-area; cache types, risk-linked valuables and optional route payoff | Same Bunker now favors mechanical supplies vs electronics; forest rare signal cache; town searchable workshop | A different scavenging decision and bag tradeoff; no guaranteed requested rare item unless authored |
| **V5 — Dynamic field event** | One small optional situational twist triggered by seed, state, room entry or player action | Distress signal, drone sweep, power outage, moving supply convoy, dormant bot activation | Something unexpected but understandable; event never blocks return extraction |
| **V6 — Mission & discovery** | Selected personal target, BIT contract, exploration clue, authored milestone, mastery goal | Restore Vault vs hunt signal chart vs recover memory fragment vs earn a nameplate title | Different *reason* to play and a different memorable home payoff |

**Rule:** Combine **2–4 meaningful axes** in one typical full-commit raid instead of changing all six unpredictably. A very short early extract may expose only one or two meaningful differences. An axis is counted only if the player actually sees it and can respond differently.

## 3. Raid Situation Director (DESIGN CONCEPT, not live implementation)

Use seeded **situations** assembled from constrained libraries, rather than pure noise or an expensive authored room for every random combination.

```text
Player chooses area + tracked objective (optional search tendency)
 -> Director reads: biome, unlocked depths, recent situations, loot eligibility,
                     enemy/tutorial mastery, mobile budget, seed
 -> Choose one route topology and available return extraction
 -> Pick one dominant encounter pattern and optional learned counter
 -> Place two or more differentiated loot opportunities (relevant family, not guarantee)
 -> Optional event and/or interesting deep reward
 -> Validate connectivity, collision, D2 extraction, loot/quest reachability, AI and FPS budgets
 -> Run raid; record what was actually encountered, not just what the seed selected
 -> On return: show true material/quest results and home restoration opportunities
```

### Core constraints

- **Determinism / reproducibility:** Same director version + player-state snapshot + seed should produce the same scenario. Record situation ID and version for debugging and comparison.
- **Constrained randomization:** Choose from authored compatible room/encounter templates; do not combine threats with mutually impossible counters, broken enemy navigation, inaccessible loot, invisible cues or unwalkable bridge funnels.
- **Anti-repetition:** Track recently *experienced* encounter pattern, route silhouette, optional event and loot flavor for the current local save slot. Downweight repeats across the next 3–5 committed raids; **do not absolutely ban repeats** or create deceptive rarity promises.
- **Purpose first:** A tracked item may bias search *opportunities* according to real legal loot tables but does not force a guaranteed drop. Never create an impossible BIT quest, scouting step or mandatory target in the chosen area.
- **Risk stays intelligible:** Deep/high-threat opportunities should generally offer richer potential without punishing short extract; preserve the player decision to bank what is already carried.
- **Physical extraction:** At least one reachable ordinary return extraction from spawn, with D2.3 deliberate extraction procedure and no personal-goal/puzzle/node gate. Only forward depth uses approved node gate. A world-map region lock is a different rule.
- **Phone budget:** Reuse instantiated enemy/room/prop assets, culling and clear silhouettes. Use event intensity caps and avoid performance spikes from first artillery VFX or overlapping effects. Validate under real mobile Low FPS goal.

### Lightweight scenario metadata (PROPOSED schema)

```json
{
  "id": "bunker-relay-crossfire-01",
  "version": 1,
  "area": "bunker",
  "depthBand": "early",
  "routeShape": "loop-with-side-cache",
  "encounterRoles": ["shield_turret", "grunt"],
  "tacticalVerb": "T1",
  "optionalVerb": "T3",
  "lootFamilies": ["power", "electronics"],
  "optionalEvent": "power_flicker",
  "fallback": "basic_carbine_viable",
  "returnExit": "reachable-from-spawn",
  "mobileCostTier": "low"
}
```

This is a **design schema**; the live code does not implement a situation director, anti-repeat memory or all listed dynamic events.

## 4. Biome-specific variety pools

### Bunker — technology and pressure

**Stable identity:** claustrophobic industrial facility, damaged panels, relay links, control rooms, warm repairable lights.

- **Route silhouettes:** tight corridor + side vault; circular service loop; hub with two differently defended wings; broken utility tunnel with exposed shortcut.
- **Enemy variants:** grunt/rusher skirmish, shield turret with flank opportunity, sentry crossfire, later repair-supported defense.
- **Tactical variants:** power link cut (T1), flank/weakpoint (T3), support disable (T5).
- **Loot themes:** mechanical repair supplies, wiring/circuit parts, occasional protected higher-tier electronic cache; exact eligibility follows real area/depth loot tables.
- **Event ideas:** temporary lights-out with visible emergency lamps; generator starts and wakes nearby machines; maintenance door becomes a shortcut.
- **Three-example contrast:** (A) fast service tunnel scavenging with rusher; (B) relay side-room defended by shield turret; (C) repair room with valuable circuit cache, longer exposed detour.

### Archipelago — terrain and movement

**Stable identity:** summer-night sky, granite shelves, sea, irregular pine forest, moss, abandoned coastal utility and bridges.

- **Route silhouettes:** low-shore path vs ridge; narrow but adequately traversable bridge vs long safe loop; split clearing with rock cover; abandoned signal post side spur.
- **Enemy variants:** scout scanning a clearing; fast rushers in pine lanes; open-ground sniper pressure; swarms near an optional cache.
- **Tactical variants:** scanner diversion (T2), line-of-sight breakup (T3), carefully telegraphed coastal machinery hazard (T4).
- **Loot themes:** utility, navigation/signal components and local rarities from actual legal pools; **Tidal Coil** already appears as area-specific material in loot data.
- **Event ideas:** moving scout sweep; short communications burst from an optional signal mast; activated searchlight reveals a route/threat without becoming an invisibility gimmick.
- **Three-example contrast:** (A) rocky overlook with scout and safe return; (B) pine corridor with swarm and environmental funnel; (C) hidden coastal relay with a premium-looking but earnable rare cache opportunity.

### Town — rooms and support networks

**Stable identity:** quiet, abandoned Swedish settlement: red/yellow houses, garages, streetlights, overgrown gardens and industrial workshops.

- **Route silhouettes:** main street + alley flank; crossing between searchable houses; fenced yard and garage; workshop with two entrances.
- **Enemy variants:** patrol/scout alert duo, turret supported by repair bot, sniper line with rushers in side streets, rare artillery-supported open crossing.
- **Tactical variants:** disable support (T5), distract patrol (T2), break sight (T3), alternate door/alley risk (T6).
- **Loot themes:** household recovery items, electronics, high-value technical salvage, **Frost Glass** as current area-specific item in loot data.
- **Event ideas:** automated alarm suddenly powers up; a supply hatch opens after a player action; nearby machines respond to the destruction of their controller.
- **Three-example contrast:** (A) quick searchable houses with patrol; (B) defended garage with repair unit; (C) risky street crossing toward protected archive.

**Story coherence:** Randomized situation doesn't mean random world logic. The same relay system behaves consistently across seeds; scouts signal the same kind of threat; buildings have plausible contents. Repeated landmarks and recurring environmental clues give the player *knowledge* to apply.

## 5. Loot variety without loot frustration

**Two kinds of loot variety:**
1. **Biome character:** each area/sub-region has recognizable material families and rarity profiles (Bunker parts, Archipelago signals, Town household/electronics).
2. **Per-run distribution:** actual container selection, item rolls, enemy-guarded opportunities and side-route caches vary substantially, while quest-required items remain obtainable somewhere in reachable content.

**Design proposal:** Let players select a *search tendency* (e.g. **Power Systems / Mechanical Salvage / Unidentified Signal**) only if it meaningfully biases **where/what they search** and which optional opportunities appear. It should never become a fake button that guarantees the target item or changes real extraction odds behind the scenes.

- A *short route* offers reliable lower-tier recovery; a *riskier detour* offers a chance at valuable components. Neither route promises success.
- A personal goal can show `Likely here`, `Possible deeper` or `Not available`, based on verified tables and current region access. Show `Not available` rather than misleading the player.
- Avoid flooding the bag with irrelevant junk. Rebalance family distributions to support current upgrades only **after simulation and playtest**; preserve existing M6/M7 model as hypotheses.
- Larger variety must not bury new players under 50 indistinguishable materials. Start with meaningful named items and recognizable families; variation mostly comes from **placement, paths and risk**, not countless currency types.
- Rare loot opportunities should be memorable and occasionally surprising, but no guaranteed jackpot every run and no punitive drop drought that blocks all early visible home restoration.

## 6. Enemy / playstyle variety matrix

**A changing threat should make a different current loadout or tactic advantageous**, not mandatory.

| Situation | Gunplay-first approach | Tactical alternative | Natural loadout advantage |
| --- | --- | --- | --- |
| Turret relay chamber | Flank rear weakness, shoot | Cut linked power | Recon/Marksman positioning; Saboteur EMP optional |
| Forest scout crossing | Quickly shoot scout | Break sight / distract | Recon/Decoy where implemented |
| Swarm cache | Kite and funnel while firing | Use choke/hazard | Breacher shotgun, Assault SMG |
| Repair-supported town defense | Kill support then turret | Break repair link or flank | Marksman priority, Saboteur disruption |
| Artillery street crossing | Run between telegraphs, shoot | Use cover/alternate road | Mobile Scout Rig, Assault all-rounder |

The same player's favorite weapon remains viable through learned movement and counterplay; never make progress depend on buying a specific weapon, gadget or cosmetic.

## 7. Events: memorable but bounded

Start with **three low-cost event types**, each reusing existing game systems as much as possible:
- **Patrol Shift:** a known patrol/scout changes route, creating a new window or alarm risk.
- **Power Disturbance:** a clearly visible linked system toggles (lights, shield feed, alarm); players can exploit it if they understand T1.
- **Signal Opportunity:** an optional, discoverable cache or communication clue appears away from the direct objective route.

**Later proposals:** moving repair convoy, weather affecting silhouette/visibility, larger rare encounter variants. Weather must not undermine readable enemy warnings; avoid broad shader/lighting changes until phone performance is measured.

Events are not scripted surprises that invalidate D2 or force every player to complete a new quest. They do not occur on a fixed daily schedule. Avoid stacking two events that create impossible/no-win situations.

## 8. Controlled novelty and mastery curve

| Player stage | Familiar anchors | New variation introduced |
| --- | --- | --- |
| FTUE | Entirely authored combat and return to bunker, Core L1, BIT | **Do not randomize away** its guaranteed two Scrap Alloy, first lesson or extraction clarity |
| First 3 ordinary raids | Same easy-to-read Bunker enemy tells and known return rule | Route/fork and basic loot family vary; first optional tactical system glimpsed |
| 4–10 ordinary raids | Known primary encounters | Add 1–2 different enemy pairs, optional event, meaningful tool alternative and extra cache type |
| After first major world unlock | Known power/cover/counterplay fundamentals | New terrain topology, enemy combinations and local loot families; familiar rules transfer |
| Mature play | Recognizable landmarks and threat vocabulary | Harder mixed systems, deeper high-value opportunities and cosmetic mastery rewards |

Use a **novelty budget**: do not introduce new biome, enemy, tool, tactical mechanism and story event all in the same first encounter. A player must recognize one thing while learning another.

## 9. Anti-repeat metrics and playtest acceptance (PROPOSED)

For each player and each seed, record **encounters actually seen**, not merely generated: `situation_id`, `area`, `route_shape`, `threat_roles`, `tactical_verb`, `loot_families_seen`, `event_seen`, `items_extracted`, `extract_success`, `raid_duration`, `player_route_choice`.

### Hypotheses to test, not final KPIs

1. In **three consecutive committed raids in the same biome**, at least **two** differ meaningfully in both encounter decisions and route/loot opportunity. Do not count just changing cosmetics.
2. In **five consecutive committed raids**, players can recall **three distinct situations** and describe why they behaved differently.
3. A repeat raid never relies on a known impossible quest item, unreachable exit, trapped bot or one unavoidable high-cost build.
4. No mandatory paid tool, no need to gamble for rare materials just to make any early home progress.
5. Major variants remain readable at the real camera on a mobile phone, with Low quality meeting the existing target (>40 FPS on designated low-end test phone when measured).

### Automated validity checks

- Seed sweep **100–1,000 runs/biome** in the actual playable big-level path: connected extraction, no navmesh/bridge obstacle, required quest item eligibility, stable generation, coverage of route and encounter templates, capped VFX/actor budget.
- Simulate player-relevant **scenario choice coverage**, not only loot weights: if 90% of seeds lead to the same turret room despite a large apparent template list, actual replayability is low.
- Compare one baseline pool to a proposed remixed pool at identical user goals, account progression and seed conditions; avoid passing noise for gameplay improvement.
- Screen capture actual phone raids to check repeated compositions, not only generator output.

## 10. Production sequencing

1. **Design first:** define variation axes and episode grammar here; identify current big-map generator, POIs and loot tables as baseline.
2. **Instrument and audit live generator:** distinguish actual existing variants from conceptual ones; track seen scenarios and extract validity. Do not add a separate economic simulator as a stand-in for playable layout checks.
3. **First controlled variety slice:** three seeded variations of the **same** Bunker micro-area with different enemy pair, power/flank option and loot side pocket. Compare side by side and watch three real phone playthroughs.
4. **Extend to forest:** one fork with two enemy role mixes and optional signal opportunity, preserving collision and safe retreat.
5. **Extend to town:** house/garage access + support network permutations; tune performance and visual readability.
6. **Only after qualitative proof:** implement bounded anti-repeat weighting and persistent recent-situation memory; avoid overfitting to a small seed sample.

**Dependency:** Issue [#205 Shielded Relay Room](https://github.com/w4sser/protocol-rebirth-proto/issues/205) can validate T1/T3 tactics but is not proof of overall variation. M16 enemy role wiring and M17 tool effectiveness must also be tested before using them as director ingredients.

## 11. Owner choices still open

- Should search tendencies be **explicitly selected on the world map**, or emerge naturally from route choices?
- Is the novelty goal roughly **one optional surprise per committed raid** or more sparse? Recommendation: one is a good first test, *not* a guarantee.
- How rare should unusual encounter combinations and event variants be? Decide from fun/telemetry, not from a desire to sell access.
- Should a few **signature landmarks remain fixed** in each biome while routes/enemy/loot shuffle? **Recommendation: yes**, for identity, mastery and navigation memory.

**Owner direction captured:** Strong variation in loot, opponents, routes, encounter situations and player tactics **within every world** is required. Mechanic lists, event catalog and encounter frequency are **proposed, not yet approved or built**.

## 11A. M18B — Biome Scale and Structural Variety Correction (Owner Direction)

**OWNER REQUIREMENT, 7 November 2026:** Present playable **Archipelago areas are too small**; expand them meaningfully. **Bunker room-area sizing is broadly acceptable**, but it still needs increased encounter and room-composition variety. This is a differentiated design direction; it does **not** approve a blanket global map scaling factor.

### Real implementation baseline verified

- `data/raid-big-layout.js` defines a shared `spacing:22` and shape multipliers of `1.2–1.6` (by axis).
- `nodspel/zone-graph.js` currently generates **6–12 graph nodes** on a three-column grid with shared spacing and shared `RULES.layouts[2]` template selection; exact walkable dimensions vary with authored rooms and multipliers. The numbers **are not a measurement of total Archipelago usable play area**.
- `nodspel/big-level.js` calls `generateZoneGraph(seed)` without an area-specific topology parameter, and populates graph rooms by sourcing `generateLevel(...,'bunker',...)` templates, while keeping an `area`/archipelago flag. Later visual environment transformations may differ, but this baseline does **not** establish a distinct forest-specific spatial director.
- Relevant past playtest issues: bridge entrances too narrow for aiming and movement, bots becoming stuck, trees on bridges, terrain/coast blending and low-end FPS. A larger forest must **not** compound these.

### Separate spatial strategies

| Design axis | **Archipelago (bigger)** | **Bunker (same broad footprint, more variety)** |
| --- | --- | --- |
| World geometry | Own **outdoor terrain graph**, multiple broad traversal spaces and distinct paths | Keep comparable raid reach/travel budget, remix room connections |
| Topology | Open clearings, granite ridges, forest corridors, inlets/shoreline, traversable bridges, utility outposts | Loop vs fork vs hub, alternate side rooms, short utility tunnels |
| Combat | More sightline lengths and approach directions, kiting space and patrol sweep; protected retreat lanes | Cover layouts, narrow pressure with flanking routes, power/support systems |
| Loot | Different visible exploration opportunities around terrain landmarks; optional distant cache | Rotate cache placement and mechanical/electronic rooms |
| Identity | Forest and shore must feel **like outdoor space**, not a bunker grid with trees | Distinct laboratory, generator hall, maintenance, storage, crew quarters |
| Variants | Terrain macro shapes + route choice + enemy roles + optional event | Room type order + alternate connection + defense mechanism + loot |
| Exit | D2 return extraction accessible from spawn through verified physical route | Same D2 return rule, without mandatory objective/room clear |
| Performance | Streaming/culling and LOD as needed; density budget independent of size | Reuse assets, room culling, avoid active enemy/VFX overload |

### Size and pacing tests (hypotheses, NOT approved values)

- Test **roughly 1.5x–2x the meaningful traversable/open-space footprint of current Archipelago** as a *first comparative experiment*, not an across-the-board room-scale multiplier. Measure actual accessible ground area, effective movement distance, number of route decisions and encounter contact time on generated seeds.
- **Do not grow traversal time proportionally:** a larger map should have multiple nearby worthwhile options and alternative extraction approaches, rather than simply placing the objective twice as far away.
- Aim for a **first meaningful choice / first combat or loot opportunity within ~30–45 seconds**, even on a larger forest map; players who prefer a quick raid must still get value.
- A committed raid can explore a *subset* of the bigger terrain and voluntarily push into an optional distant zone. Keep ~8-minute full-run aspiration; avoid a mandatory map clear.
- Compare **three landscape archetypes** in the first playable test: (1) **Granite Coast** with curving shore and a high overlook; (2) **Dense Pine Forest** with two wooded paths and one open glade; (3) **Island Crossing** with a navigable wide bridge and an alternative inland route. These are suggested archetypes, not guaranteed separate islands or boats.
- In Bunker, test **three distinct same-size room sequences**: (1) Reactor Loop, (2) Storage Branch, (3) Security Wing. Deliberately vary encounter/loot/tactical verb; don't simply rotate wall color.

### Acceptance gates

1. Archipelago testers perceive more freedom, distinct approach angles and a stronger sense of wilderness; measure **usable navigable area**, not background sea.
2. Within 3 committed runs in Archipelago, terrain shape and tactical route options demonstrably differ, not only tree props.
3. In 3 Bunker runs of similar footprint, players can describe at least two meaningfully different room sequences/encounters.
4. All generation seeds used in the build preserve reachable D2 return extraction, no bridge pathfinding or shooting funnel, no disconnected objective/loot, and valid bot access.
5. Phone Low settings maintain prior **>40 FPS goal**, with first-use combat VFX performance checked; landscape dressing and distant assets must not introduce disproportionate scene cost.
6. Measure actual time to first combat/loot, distance walked, time to first return possibility, median full-commit duration and fraction of raid spent on uninteresting traversal.

### Concrete next engineering research, after design review

**Audit spatial ownership** across `zone-graph.js`, `big-level.js`, `levels.js`, archipelago terrain dressing/passage collision and town re-skin before proposing a code PR. Build one **area-specific outdoor graph** behind a flag/isolated PR, preserving existing Bunker sizing, then run deterministic seed/collision tests and three phone playthroughs. Avoid changing asset dimensions or the current camera as a shortcut.

**Decision status:** Owner direction **CONFIRMED**: Archipelago larger, Bunker size broadly acceptable with more structural variety. The 1.5x–2x size, example terrain and room templates, time budgets and exact acceptance thresholds are **proposed and require playtest validation**.

