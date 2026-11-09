# Protocol Rebirth — M16 Enemy Roles & Difficulty Progression

> Status: **Design proposal**, 7 November 2026. Paired with [M17 Weapons, Tools & Combat Builds](combat-builds-design.md). Owner requested a combined M16/M17 design pass. Details and quantitative thresholds require playtesting; no runtime code changes.

## 1. Design principle

**Enemies are tactical questions, not stat bundles.** Their role is to force a clear decision. A compelling combination asks the player to choose priorities and positioning under pressure. Raw HP, higher damage or bigger waves do not substitute for changing decisions. The player must understand what happened and why.

The existing prototype contains model archetypes and mechanics in `nodspel/enemies.js`, `data/raid-enemies.js`, `nodspel/round.js` and encounter generation. Some archetypes (e.g. tank, scout, repair, sniper, artillery) are described in phase comments or model mappings and must not be assumed active in all live encounter pools. Check the current big-level runtime and behavior before treating the table below as shipped.

## 2. Enemy tactical role contract

| Enemy | Primary pressure / player question | Readable tell | Viable baseline counter | Optional T1–T6 counter | Difficulty lever other than HP |
| --- | --- | --- | --- | --- | --- |
| **Patrol Grunt / Basic Grunt** | How do I dodge fire and find a useful angle? | Coral aim line / weapon orientation | Move laterally, shoot, use cover | T3 flank rear; T2 diversion | Placement with cover and overlapping sightlines |
| **Rusher** | Do I reposition *now* or get pinned? | Distinct charge windup and lane | Sidestep, use corner; shoot its back / punish wall impact | T3, T4 | Compress safe space; pair with ranged pressure |
| **Shield Turret** | Can I beat frontal defense without trading health? | Blue directional shield; shield turns toward player | Flank the rear; shoot weakness from cover | T1 exposed relay, optional EMP | Cover, turret facing, proximity to higher-value cache |
| **Unshielded Turret / Sentry** | Can I time sightline crossings? | Locked line, pre-fire warning and recovery | Break line, move on recovery, suppress/kill | T3, optional T1 if environment supports link | Multiple lanes, not shorter invisible warnings |
| **Swarm Bot** | Where should I funnel the pack? | Small rushing cluster, approach vectors | Backpedal, exploit choke, high area coverage | T4 hazard, T3 cover | Multi-angle approach but keep retreat available |
| **Scout Drone** | Can I prevent escalation or survive the alert? | Visible scan arc and warning / tell | Shoot it, avoid scanner | T2 diversion, T5 interrupt alert link | Timing and route with patrol threat |
| **Repair Bot** | Which enemy do I prioritize? | Obvious heal beam from support | Eliminate or isolate healer first | T5 sever visible beam/power source | Heal priority and support position (no resurrection) |
| **Artillery** | Can I move while under attack? | Large visible incoming ring/projectile arc | Move out, break rhythm/cover, attack between strikes | T4 exploit hazard in a crowd | Different lane geometry and pressure overlap |
| **Sniper** | How do I traverse dangerous open ground? | Long clear warning / fixed sightline | Cover-to-cover, flank, close distance | T3 break sight, T2 diversion if AI supports | Exposure windows and patrol timing |
| **Tank** | Where is its weak side and can I get there? | Large frontal armor and turning behavior | Kite, flank or exploit slow turn | T3, T1 optional linked power | Room layout/side access and companion pressure |

**Player-learning requirement:** A player should discover an accessible response with the free Basic Carbine and default movement, even if a chosen gadget offers a more efficient alternative. Never sell the sole counter.

**Art/audio consistency:** Existing enemy data references coral attack, blue shield, green healing and yellow AoE. Match them with shape/animation/trajectories, not colors alone. At mobile camera height, important weakpoints and linked power components must be large and highlighted.

## 3. Encounter combination grammar: one pressure plus one complication

| Encounter | Enemy roles | Tactical problem | Minimum viable choices | Recommended phase |
| --- | --- | --- | --- | --- |
| **Crossfire Basics** | Grunt + grunt/sentry | Isolate one angle without taking both shots | Cover, flank, kill near threat | Intro / Depth 1 |
| **Dislodged** | Rusher + grunt/sentry | Movement that avoids rush exposes the ranged lane | Sidestep into cover, kill charger, reposition | Depth 1–2 |
| **Guarded Relay** | Shield turret + grunt | Target relay / flank while a grunt covers lane | Disable power, focus grunt, flank turret | Depth 2 / Issue #205 |
| **Pressure Funnel** | Swarmers + rusher | Keep retreat lane while massing rush threats | Choke/hazard, kite then fire | Depth 2 |
| **Priority Support** | Repair + turret/grunt | Target healer or suppress primary threat? | Kill/heal-break support, break sight, push | Depth 2–3 |
| **Spotted Crossing** | Scout + patrol grunt | Avoid or interrupt alert before reinforcements | Eliminate scout, divert, cross quietly | Forest / Depth 2–3 |
| **Open Ground** | Sniper + rusher | Move quickly, but wrong angle puts you in long sightline | Cover-to-cover, punish rusher, flank sniper | Forest / Depth 3 |
| **Breaking Cover** | Artillery + patrol/tank | Where is safe to move during bombardment? | Cross between strikes, use cover, pressure artillery | Depth 3 |
| **Command Pocket** | Tank + repair/scout | Read which support role makes frontal fight worse | Disrupt support, flank or leave | Rare high-depth optional |

**Combination limits (playtest hypothesis):** Start with 1 major tactical role + at most 1 supporting role in early normal raids. Add a third distinct pressure only later/deeper and when both components have already been taught individually. Do not create an arena where a sniper forces cover, artillery destroys all cover, and rushers forbid movement—unless a reliably readable escape lane exists.

## 4. Difficulty progression = player mastery, situational complexity and risk

**Never scale primarily via HP.** Four independent axes:

1. **Decision complexity:** one understandable threat -> two interacting roles -> a known mechanic plus timing.
2. **Execution pressure:** slower, generous warning -> tighter but still reliable telegraph -> moving while dealing damage.
3. **Spatial challenge:** open lane and obvious cover -> alternate routes and flank window -> crossfire/chokepoint with an always reachable safe fallback.
4. **Risk-reward opportunity:** ordinary materials -> targeted rares -> distinctive deep payoff requiring actual extraction.

### Example by depth

| Progression | Introduce | Combine / test | Avoid |
| --- | --- | --- | --- |
| **Intro FTUE** | Basic aiming, dodge, first extraction | A single readable enemy problem | Mandatory stealth, systems tutorial, unfair death |
| **Depth 1** | Grunt + rusher, early cover and flank | Combat feels responsive; one optional power relay observation | Long early empty shooting or difficult triple pressure |
| **Depth 2** | Shield turret, scout/alarm or support | Choose target priority and a route; optional T1/T3 special room | Requiring EMP, missing needed materials, return gate |
| **Depth 3** | Artillery, repair, sniper, tank in constrained curated combinations | React to known threats while deciding whether rare payoff is worth the haul | Pure health inflation or undodgeable overlapping AoE |

### Three biomes as different expressions of learned skills

| Biome | Readability and combat identity | Compositions | Learned mastery |
| --- | --- | --- | --- |
| **Bunker** | Artificial cover and control systems, close corridors | Turret, rusher, grunt, later repair | Flank, cut power, break sight |
| **Archipelago forest** | Pine/granite lanes, partial open clearings, shoreline bridges | Scout, rusher, sniper, swarms | Scout sweep avoidance, cover and movement; exploit chokepoints |
| **Town** | Streets, buildings, windows, alarms and open crossings | Sniper, turret, repair, patrol, artillery | Priority targeting, attention, lane timing and room access |

**Hard mode:** should recombine known rules and tighter pressure while retaining readable warnings/solutions. An HP multiplier is at most a secondary tuning knob, not the gameplay identity.

## 5. Encounter budget as a production tool (PROPOSED, not spawn tuning)

Each encounter has a **readability budget**, not just a threat score:

- Primary pressure: **one** main enemy/goal and clear warning.
- Supporting pressure: **zero or one** added role in early Depth 1–2.
- Environment: **zero or one** primary tactical verb (T1–T5), optional second only for mastery.
- Escape: always a physically navigable retreat or cover angle. D2 return extraction remains independently usable.
- Reward: optional valuable reason to engage; standard path not blocked by the optional room.
- Interaction time: typically 10–25 seconds for an ordinary pulse, 20–60 for tactical special, 15–45 for an opportunity.
- Small-screen clarity: restrict concurrent effects, alerts, projectiles and HUD pings; real low-quality performance must be measured.

**Never invent pressure by increasing spawn count beyond phone performance;** carefully select complementary archetypes.

## 6. Telemetry and playtest

Event candidates: `encounter_started`, `enemy_role_seen`, `enemy_killed`, `weakpoint_hit`, `tool_used`, `damage_taken_by_source`, `cover_broken`, `encounter_abandoned`, `room_exit`, `extraction_decision`. Each event should include a stable encounter/template ID, depth, biome, loadout and seed, not personal identifying data.

Measure: encounter completion/skip rates, 10th/median/90th time, damage/ammo spent, deaths, first-read comprehension, which target players prioritized, how often a special solution is discovered, enjoyment versus combat-only control and whether they choose to push deeper.

**Failure example:** A skilled player always rushes the Repair Bot and kills everything effortlessly. Add counterpressure or room positioning **only after** proving the prioritization is understandable, not simply more healer HP.

## 7. MVP implementation sequencing (not authorized code)

- **A:** Shield Turret + Grunt with visible relay / safe flank; Issue #205. Compare with unmodified encounter.
- **B:** Rusher + ranged grunt in a space with two genuinely safe dodge options. Tune readable overlap.
- **C:** Repair + turret with a clear repair beam, if current behavior support is verified.
- **D:** Scout + patrol in forest; only after sight/alert mechanics work on phone.
- **E:** Artillery + cover/side route, keeping visible flying projectile warning.

Each step should be separately measurable and reusable. Do not implement five encounter families in one PR.

## 8. Open decisions

- How quickly the first Shield Turret / Repair / Scout appear for a new player? Exact ordering requires testing.
- Which specific enemy behaviors truly exist in **current live big-level mode**, versus archetypes with incomplete behavior wiring?
- Should hard mode add new tactical combinations or simply tighten execution? Recommend combination-first.
- Do players enjoy a mix of easier mastery encounters and occasional difficult problems? Recommend deliberately varying tension rather than monotonically escalating.

**M16 recommendation:** Lock the **role-first design approach** for review; leave exact pools, spawn rates, timings and HP pending real mobile tests. No gameplay changes were made.
