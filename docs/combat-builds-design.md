# Protocol Rebirth — M17 Weapons, Tools & Combat Builds

> **Status:** Detailed integrated **design proposal** requested 7 November 2026. Companion to [M16 Enemy Roles](enemy-roles-difficulty-design.md), [M15 Tactical Encounter Grammar](tactical-encounter-grammar.md) and [M14 Eight-Minute Raid](eight-minute-raid-design.md). Distinguish CURRENT data from proposed balancing. No runtime code changed.

## 1. Product rule

**The right weapon or tool changes how you solve a threat, not just how quickly its health bar empties.** Every viable loadout should have a clear strength, a genuine drawback and a sensible counterplay strategy against the same enemy. No purchased loadout creates a guaranteed escape or an exclusive solution to a required objective.

This is a **loadout identity system**, not four more independently leveled classes.

### Relationship to existing progression

- **Operator:** persistent Operator XP and a few meaningful build choices at milestones (approved P1.3). Operator traits are broad approach modifiers, not an additional weapon mastery battle pass.
- **Weapon/armor/tools:** actual deployed items and consumed charges follow **D1 controlled loss**, with Basic Carbine always free/available. The permanent skin does **not** vanish on death.
- **Fabricator:** establishes crafting and tool availability. Existing item data unlocks **Decoy at Fabricator L1**, **EMP and Grenade at Fabricator L2**. These are current prototype input definitions, **not proof that every live tool path, AI interaction or crafting screen is fully verified**.
- **BIT:** situational information and earned tactical support. Its cosmetic shell is not a combat buff. No automatic puzzle solution.
- **Bunker:** functional progression gates preparations; room decor and matching outfit/nameplate bundles do not alter projectile damage.

## 2. Actual prototype equipment references (from `data/items.js`)

The following names, intended descriptions and prototype stats are **current data**, not approved ship values.

| Type | Existing item | Functional identity in data | Key limitations |
| --- | --- | --- | --- |
| Free fallback | **Basic Carbine** | Aiming-friendly, low damage and small magazine; forever available | No premium gating; can beat normal enemies when used skillfully |
| Primary weapon | **Vector SMG** | High rate of fire / large magazine, close-range spray | Short range, ammo use and accuracy tradeoff |
| Primary weapon | **Marksman Rifle** | Longer effective range and precision, slow shots | Less forgiving against swarm/rushers; requires sightlines |
| Primary weapon | **Breach Shotgun** | Close-range pellets and knockback | Danger closing distance; very short effective range |
| Armor | **Scavenger Vest** | Extra shield and carrying convenience in current item data | Lower mobility / tactical specialization than Scout Rig (exact effect requires runtime validation) |
| Armor | **Scout Rig** | Mobility and modest shield | Lower protection; success depends on movement |
| Armor | **Dampener Cloak** | Stealth/movement tradeoff, max-health reduction in item data | Stealth effect must be tested on actual AI; never guaranteed invisibility |
| Tool | **Decoy** | Lures enemies in area; defined to unlock Fabricator L1 | Current behavior must be confirmed for each enemy archetype |
| Tool | **EMP** | Disables certain sentries/node shields for a limited period; Fabricator L2 | Consumable; do **not** require it to solve Relay Room |
| Tool | **Grenade** | Delay + area damage; Fabricator L2 | Must have a telegraph, projectile and performance budget |
| Attachments | **Long Barrel, Extended Mag, Optic** | Range, magazine and damage improvement in existing item data; mag/optic linked to higher weapon Mk | Attachments can become numerical domination if all builds converge on max DPS; treat this as a balancing risk |

**Important:** The data includes only these four named weapons and three named tools. A suggested suppressed weapon, scanner, grappling system, hacking gun, elemental ammo, automated turret, dual class loadout, or unlimited gadget is **not present as a validated existing item**.

## 3. Four emergent loadout archetypes — not classes

| Approach | Example existing equipment | Tactical strength | Explicit weakness | Enemy/micro-situation fit |
| --- | --- | --- | --- | --- |
| **Assault / All-Rounder** | Basic Carbine or Vector + Scavenger Vest; Decoy | Forgiving movement and consistent damage; adaptable | Less precise at distance; no single-purpose disabling power | Grunts, mixed waves, gathering common resources |
| **Breacher** | Breach Shotgun + Scout Rig or Vest; Grenade later | Strong close-range interruption/knockback; wins tight cover | Must expose self to approach, hard versus long sightlines | Rusher, shield turret flank, bunker chokepoints |
| **Recon** | Marksman Rifle + Scout Rig or Dampener Cloak; Decoy | Long-range weakpoint pressure, scanning/positioning and safe route choice | Weak if swarmed or caught at close range; relies on terrain | Scouts, snipers, patrol lines, forest crossings |
| **Saboteur** | Carbine/Vector + chosen armor + EMP/Decoy | Manipulates attention and temporary defenses; efficiently solves linked systems | Tool charges are scarce and at risk; must improvise once spent | Shield Relay Room, support disruption, alarm room |

**These are suggested playstyles, not locked loadout combos.** Allow mixing components. Do not add class-exclusive skills or separate class XP; Operator milestones can offer a small number of cross-loadout choices. Free Carbine plus movement should remain a baseline solution to every required early threat.

## 4. Counterplay matrix — enemy problem vs meaningful equipment

| Enemy tactical role | Core free counter | Weapon advantage | Tool advantage | Counterplay rule |
| --- | --- | --- | --- | --- |
| Grunt / Patrol | Sidestep, shoot, cover | Carbine flexible; SMG close-angle burst | Decoy diverts if supported | No mandatory gadget |
| Rusher | Read charge, dodge into space, punish recovery | Shotgun knockback close; SMG sustained burst | Grenade vs crowd after telegraph | No unavoidable damage due to spawn proximity |
| Shield Turret | Move to flank vulnerable side | Marksman weakpoint at safe angle; shotgun close flank | EMP interruption; T1 relay is environmental alternative | Always at least one no-tool path |
| Swarm | Move to a choke, fire while kiting | Shotgun pellets/SMG crowd damage (validate spread) | Grenade for grouped targets | Group control should require spatial play |
| Scout | Spot/kill before alarm or use cover | Marksman fast precision from range | Decoy if scanner supports it | Alert outcome predictable; no instant unavoidable cascade |
| Repair | Focus and kill support, split line | Marksman priority shot, SMG close burst | EMP if machine behavior supports it | Healer must not revive dead enemies |
| Sniper | Break sight, cover route | Marksman can contest long range | Decoy to reposition if implemented | No inaccessible forced sniper duel |
| Artillery | Move out of visible landing zone | Any weapon while moving; Marksman exposed shots | Grenade/EMP only if supported | Projectile arc and land warning visible |
| Tank | Exploit slow turn and rear weak side | Shotgun or SMG after safe flank; Marksman angle | T1 link/EMP only if linked system supports it | Toughness is positional, not only HP |

**Do not assert tool synergies exist until verified.** For example, current EMP item copy mentions sentries and node shields, but extending it to repair bots or tanks is a **new gameplay proposal** and should not be treated as free implementation.

## 5. Build decision in ~8-minute loop

**Before deployment (10–25 s optional target):** Show one main weapon, one armor choice, one tool slot, and a simple one-line reason a kit may help with the selected route. Never force a build wizard. A player's chosen current goal (e.g. Cable/Power Relay) should make a route attractive but not guarantee item drops. Persist loadout choice when possible and offer free carbine fallback in one tap.

**During raid:** Advantages show as readable outcomes (shotgun knockback, scout spotted sooner, shield interrupted, enemy baited), not only +5% damage UI. Environmental solves remain available even to basic loadouts. Tool usage is an **opportunity cost**; saving an EMP for a deeper threat may be smarter than spending it immediately.

**After raid:** Reconcile recovered or lost deployed gear, consumed charges and secured loot accurately. If valuable equipped weapon/armor is lost, the player returns to free Basic Carbine and can redeploy; a cosmetic skin remains owned but cannot make a lost weapon appear for free. Show the next useful Fabricator or room upgrade in the home without selling rescue.

## 6. Distinct combat/build choices, avoiding power creep

**Operator milestone examples (PROPOSED, not approved perks):**
- **Mobility:** brief route-crossing resilience / movement behavior improvement, bounded; no invulnerability.
- **Recon:** slightly clearer scan/weakpoint intel; no reveal-all fog cheat.
- **Recovery:** more reliable combat recovery or consumable efficiency; not guaranteed return of lost gear.
- **Engineering:** improve execution window for environmental interaction *without* removing the basic manual solution.

**Tradeoff requirement:** Each build should sacrifice something observable: rate of fire vs accurate distance, protection vs speed, close burst vs positioning risk, gadget utility vs limited charges. Attachments should strengthen an archetype rather than erase its weakness. A universal max-damage loadout dominating all scenarios is a design failure.

**Monetization boundary:** Functional gear, resources and upgrade speed follow approved M4/M5 controlled-risk monetization direction, but paid options must not confer sole access to an encounter's necessary counter or cancel extraction loss. Premium cosmetic looks, weapon skins, nameplates and BIT shell are persistent identity, separate from actual purchased/lost gear.

## 7. Build teaching curve

| Stage | Player sees | Key mastery |
| --- | --- | --- |
| FTUE | Basic Carbine, movement, simple threat and bunker discovery | Shooting and survival before menu complexity |
| First successful ordinary raids | Carbine plus one alternative found gear; optional early Decoy after Fabricator L1 | Try weapon identity, use cover and a tactical alternative |
| Mid first-week | Accessible Vector/Shotgun/Marksman opportunities; armor differences | Choose mobility vs protection, effective range and recoil/accuracy |
| Fabricator L2 or later | EMP/Grenade access and optional Shield Relay / support room | Plan limited-charge tools, hold for deeper danger |
| Deeper runs | Enemies appear in mixed roles, optional high-value caches | Change loadout by mission, not by a universal "best gear" score |
| Long term | Limited meaningful Operator milestone choices and equipment improvement | Combine mastered mechanics, no large hidden stat stack |

**Guardrail:** Do not force tool selection or operator skill tree before first ordinary extraction completes the signed-off D3.9 FTUE. No compulsory store screen.

## 8. Test plan: counterplay and variety must be proved, not inferred

### Controlled playtests

**Test A — Weapon feel:** Same 1–2 room encounters and seeds, players try Carbine, Vector, Marksman and Shotgun. Ask which felt strongest/funnest *and where*. Record hit rate, actual range of combat, ammo use, time, damage taken, player-reported readability, FPS.

**Test B — Tool as alternative, not key:** Shield Relay Room with Basic Carbine alone, with Decoy where applicable, and with EMP after L2. Basic must remain viable; more expensive solutions should be faster/safer in some situations, not universally mandatory.

**Test C — Build identity:** 3–4 loadouts against a mixture of rusher, turret and support encounter. If one loadout dominates survival, time and ammo across all, inspect terrain/weakpoint/gadget tuning before buffing everyone.

**Test D — Risk/recovery:** Die with a valuable weapon, then verify free Carbine retry and permanent cosmetics; successful extraction banks only carried winnings under D1/D2. Verify supply returns/loss/consumption in actual runtime and save-slot system.

### Candidate telemetry

`loadout_chosen`, `weapon_fired`, `weakpoint_hit`, `tool_used`, `tool_effect_applied`, `tool_charge_spent`, `enemy_counter_executed`, `incoming_damage`, `extraction_success`, `loadout_lost`, `fallback_equipped`.

Capture actual weapon/tool ID, encounter type, enemy role, biome and seed, and whether a gadget effect **really applied** rather than merely being equipped. Avoid instrumenting personal Callsigns or other user identifiers as debug keys.

### Accept/reject gates (proposals)

1. At least two distinct loadouts are preferred by different testers for clear reasons, rather than everyone using the highest DPS.
2. Basic Carbine/movement can complete every required early tactical encounter; specialty tools provide useful but not exclusive routes.
3. Encounter mechanics remain visible and fun on an actual phone.
4. Swapping weapon/armor changes movement/decision strategy more than just a number in a tooltip.
5. Death/loss and cosmetic persistence are intuitive and correctly reconciled; no covert paid safety.

## 9. Implementation priorities and open questions

**Proposed order:** (1) polish baseline enemy tells and existing weapons' moment-to-moment feel; (2) Shield Relay Room T3 flank and T1 power sabotage using Carbine; (3) EMP optional alternative; (4) a mixed role encounter with support/scout only when verified live; (5) adjust Operator milestone rewards based on what playtesters need.

**Still open:** exact attachment/Mk and operator bonus simplification, whether Decoy's actual AI integration supports scout diversion, area-specific weapon preference distribution, consumables economy and how to avoid runaway pay-to-progress or loot scarcity. Do not add new weapon families until these core archetypes show real tactical differentiation.

**Design only.** No weapon or enemy stats changed in the prototype.
