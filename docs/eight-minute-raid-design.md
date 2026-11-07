# Protocol Rebirth — The Eight-Minute Raid: Combat, Tactical Problems, Extraction and Home

> **Status:** M14 detailed design proposal, 7 November 2026. The owner requested this integrated definition. It refines previously approved D1 (risk), D2 (extraction/depth), D3 (FTUE) and M9–M13 (frequent home progress, identity and more enjoyable tactical gameplay). **The exact pacing, room frequency, rewards and tactical mechanics are proposals for playtest, not newly approved shipped constants.** Documentation only.

## 1. Design thesis

**Go out with a purpose. Find an opportunity. Understand and outsmart a problem. Decide whether to bank what you have or gamble on more. Come home visibly changed.**

The raid is the product's playable heart, **not a toll to pay before the bunker screen**. A great raid should tell a tiny emergent story: *I saw a dangerous system; used my head or loadout; secured something I cared about; got out when it mattered.*

The home loop makes that story persist: recovered materials change functional rooms and the visible bunker; operator/Callsign/nameplate customization shows who did it; BIT's relationship and visual changes acknowledge it. Meta incentives must not substitute for fun combat, discovery or decisions in the raid itself.

### Four emotional beats

| Beat | Desired feeling | Source of enjoyment | Player's question |
| --- | --- | --- | --- |
| **Deploy** | Purpose and anticipation | Readable target, prepare a tactical approach | Why am I risking this? |
| **Engage & discover** | Competence and curiosity | Punchy shooting, interesting rooms, tactical alternatives, loot discoveries | What can I do with this situation? |
| **Risk & extract** | Tension and agency | Bank now vs push deeper; weigh bag, health, time and a visible payoff | Is another room worth my haul? |
| **Restore & express** | Relief, ownership, pride | Upgrade function, visibly repair home, personalize identity, next ambition | What changed because I survived? |

## 2. The eight-minute quick PvE raid: target beat sheet

**Eight minutes is a session/time-budget target**, not a requirement that every raid lasts eight minutes. Returning early is a successful decision. The approved D2.3 extraction procedure begins after the player intentionally enters/starts it; current test value is five seconds, during which the player may move, aim and shoot, and damage alone does not cancel it. Leaving the extraction zone or dying cancels/fails it. A return extraction is available from the start of every ordinary raid (D2.1), regardless of personal-goal completion (D2.2). **Do not gate return on nodes or problems.** Required depth-progression nodes still unlock forward progress (D2.4), and deeper play has distinct payoff (D2.8).

| Time elapsed in an illustrative full run | Raid beat | Typical content | Intended decision / interaction |
| --- | --- | --- | --- |
| **0:00–0:30** | **Deploy & orient** | Player spawns with visible personal need, one clear destination/goal, BIT's concise relevant hint, route/exit awareness | Identify why this raid matters and see where to return. No compulsory briefing UI |
| **0:30–1:45** | **First combat & first find** | One short readable enemy encounter and early common-material opportunity | Reacquire touch/shoot rhythm; take or ignore first useful loot. No overlong easy-wave farm |
| **1:45–3:00** | **Tactical problem room** | A shielded turret + exposed relay, patrol/alarm or power hazard; 2–3 solutions | Observe, shoot, flank, use a gadget or find alternative cover. Gain a memorable tactical advantage |
| **3:00–3:30** | **First payoff / decision** | Useful component or cache, bag partially full; return extraction still accessible | Bank now, detour for a missing part, or advance using the requisite node |
| **3:30–5:30** | **Riskier depth / optional encounter** | Better combination of enemies and one situational twist; richer targeted loot | Spend health/tool/time to chase a higher-value opportunity; decide when to disengage |
| **5:30–7:15** | **Final opportunity, if player chose depth** | Distinct final high-value objective, escalating pressure or unusual puzzle-combat remix | The high-risk, high-reward decision should feel *different*, not merely more HP |
| **7:15–8:00** | **Return & extract, if still in raid** | Reach chosen exit, intentionally begin short countdown while retaining combat control | Close out at chosen risk; early extraction may happen much sooner |

**Do not use this timeline as a rail:** a player can reach the return point anytime, may never encounter a special room on a quick scavenging run, or may spend more time solving a difficult situation. The final payoff may be missed. No forced new wave appears merely because the player begins the first extraction test.

### Target composition for prototyping, not approved quotas

- **50–60%** movement, responsive shooting and moment-to-moment threat handling.
- **15–25%** inspection, optional environmental problem solving and route choice **inside** those combat spaces, not in isolated pause-the-action puzzles.
- **10–20%** loot appraisal, bag prioritization and navigation toward chosen reward.
- **10–15%** extraction decision, reaching the exit and settlement tension.
- **Zero mandatory shopping, naming, profile or bunker UI during a raid.**

These percentages overlap in actual play; they are intended to challenge designs dominated by either uninterrupted bot shooting or too many stop-and-solve breaks.

## 3. Three encounter layers, mixed deliberately

| Encounter class | Job | Frequency hypothesis | Duration target | Design example |
| --- | --- | --- | --- | --- |
| **Combat pulse** | Maintain action, aiming and movement satisfaction | Most transitions / ordinary rooms | ~10–25 sec | Grunts + one rusher; clear telegraph and counterplay |
| **Tactical special room** | Give player agency and an "I figured it out" moment | Approximately one in an ordinary committed short raid; optional and variant-driven | ~20–60 sec | Shield turret with visible power source, flank and optional EMP |
| **Opportunity / risk room** | Make extraction trade-offs tangible | One or two discoverable opportunities | ~15–45 sec | High-value cache behind alarm with an alternate safer route |

**Authoring rule:** An enemy composition plus its surroundings should create the interesting problem. Avoid making a separate minigame. A good special room is understandable from the actual mobile camera and normally works without reading text.

### Reusable systemic ingredients

Only add one small family at a time and reuse across bunker, coastal forest and town:
- **Power link:** shooting or interacting with a bright conduit changes a turret shield, light, door or alarm.
- **Information:** a patrol/search cone or sound source is predictable enough to manipulate.
- **Position:** vulnerable rear armor, cover gaps, high ground/angles, flankable choke.
- **Hazard:** visible energized water, steam burst, crush machinery or exposed power arc.
- **Opportunity cost:** fighting openly uses ammunition/healing/time; a smart route uses navigation or scarce gadgets.

Do not require pixel-perfect aiming at tiny targets, new input buttons or major shader effects to make a solution possible. Environmental objects are large and contrast-readable.

## 4. Vertical slice A: Shielded Relay Room

**Problem, seen from doorway:** An armored turret protects a power relay/valuable cache. Its frontal shield turns toward the player, while a large cyan power cable runs to a visibly vulnerable amber-lit relay. The cover layout creates a safe route around one side.

| Plan | Inputs | Cost / threat | Outcome |
| --- | --- | --- | --- |
| **Fight / flank** | Move, dodge, shoot rear weak area | More exposure, health/ammo risk, quick if skilled | Turret defeated; cache accessible |
| **Sabotage power** | Shoot the large relay or interact with existing mechanism | Requires observing environment / reaching angle | Shield drops or turret stops briefly; player chooses follow-up |
| **Use tool (optional)** | Existing EMP, if equipped and enabled | Expends a limited tool; saves position/time | Temporary power outage creates opening |

No one solution is a required premium item. Direct combat may be faster for a strong player and should remain viable. The special reward is **not** a guaranteed extraction, paid currency or a story gate. If the player has already found what they came for, they can go back without solving it.

**Telegraph:** Clear line between relay and turret; animated/hummed current; shield reacts immediately when power is cut; BIT optionally says a short contextual hint after genuine hesitation, not at room entrance. All mechanics work without sound (shapes, color contrast, target highlight).

**Variation without making content arbitrary:** Rotate relay placement between readable anchor points; change cover and turret facing; sometimes add a patrol grunt; sometimes reward an extra cache or less risk instead of opening a mandatory door. Keep the same underlying rules so learning transfers.

**Failure and recovery:** Shooting the relay with weak ammo must produce clear feedback; disabling power should last long enough to exploit at normal mobile input speed. Turret drops normal combat stakes. If player ignores relay, ordinary gunplay continues. No unwinnable state if tool inventory is empty or the player arrives with Basic Carbine.

## 5. The real extraction decision should recur

At moments when the player has gained something valuable, give the information needed to **return now or continue**. This does not mean a forced modal.

**Example state:** player has two Cable and one Scrap Alloy, 60% health, a half-filled bag, and can see a deeper opportunity for a Power Relay.

- **Return:** retain secured material, potentially finish Fabricator progress; leave rare component behind.
- **Push:** gamble an increasingly valuable bag on more loot, perhaps a research item or final depth payoff.
- **Alternative:** continue just far enough to investigate a tactical room, then return by the known route.

**What the HUD must tell the player without clutter:** (1) personal resource need and what is actually in the bag vs at home; (2) return-extraction direction and whether it is usable; (3) a depth/reward hint; (4) remaining time and immediate danger. Everything else should be contextually collapsed. Never put a full commercial shop prompt in this decision.

**Approved risk remains real:** D1 loses exposed inventory and valuable equipped gear on death; home inventory and cosmetic entitlements stay safe; free Basic Carbine fallback remains; Vault L1 unlocks only one Secure Slot. D2 completion of a special room, node or personal quest is **not** synonymous with extraction success.

## 6. How a raid changes the meta

| In-raid accomplishment | Immediate raid experience | Persistent home/operator/BIT effect **if eligible and secured** | Identity and monetization relation |
| --- | --- | --- | --- |
| **Extract specific components** | Spot useful loot; choose what to keep and survive | Build Fabricator/Vault/BIT Bay or advance Core | Targeted material shortage can show optional **Find in Raid** vs **Get Materials** at home only |
| **Earn common supplies** | Reliable partial value even on a modest return | Low-cost visible repairs: lighting, workshop dressing, sleeping corner, fixtures | Creates furniture slots and a desire to decorate; no pay-for-basic-home requirement |
| **Discover or master a tactical system** | Solve the turret/power problem in a satisfying way | Progress toward **earned** title, emblem/nameplate and eventually optional operator cosmetic | Achievement-specific identity is primarily earned, not automatically duplicated in the shop |
| **Use BIT intelligently** | Scans, opportunities and readable tactical hints | BIT Bond/earned equipment progression as appropriate; new shell/CRT looks from meta milestones | Functional bond separate from a purchasable BIT look |
| **Survive with valuable gear** | Satisfaction of preserving a carefully built loadout | Operator XP, a gear-related achievement or new appearance reward where specified | Weapon skins persist; weapon stats and losable copies remain distinct |
| **Push for final depth payoff** | Risk and distinct reward opportunity, not just more enemies | Rare functional component, authored scouting progress when **actually extracted**, commemorative identity cosmetics | Never bypass scouting or automatically purchase a raid clear |

**Accounting rule:** Permanent meta entitlement or trophy earned by an action can be granted according to its own requirement, but **loot material must only be banked on actual successful extraction**. Death cannot quietly bank the dropped Cable. Full missions/scouting still require their authored conditions.

### First-week homecoming example

1. **Raid 1, modest return:** Player extracts first Cable and Scrap Alloy; home screen shows Fabricator requirement clearly and highlights a low-cost **light repair** that does not consume the rare Fabricator input.
2. **After early successful returns:** Fabricator L1 becomes functional; visual workshop changes; free basic outfit/nameplate personalization has already become available after FTUE.
3. **A tactical achievement run:** Player disables a turret through its relay; earns progress toward a **Signal Hunter**-like title or distinct nameplate (exact achievement count open). BIT acknowledges the intelligent move briefly on return.
4. **Next major choice:** Vault or BIT Bay first; choose according to preferred playstyle, and small repairs remain available between bigger targets.
5. **Medium-term ambition:** Core L2 and access to more of the archipelago/next region. Growth Fund grants are tied to earned permanent milestones, with retroactive claims if purchased; purchase cannot replace actually completing scouting extraction.

**Important:** Do not promise a visible repair after *every* failed raid or manufacture materials from missing loot. Variety and visible progress should derive from real earned resources, previously secured supplies and optional free non-loot rewards explicitly defined by gameplay achievements.

## 7. BIT's role inside the raid

BIT is a **companion and tactical observer**, not a puzzle solver or raid autopilot. Its existing identity—helpful, dry, a little cheeky—should make its interventions meaningful.

| Situation | BIT role | Example style, not approved exact dialogue |
| --- | --- | --- |
| Arrival | Point out personal material need / known route | "We need Cable. There's an electrical room to the east." |
| Player observes room | Mark a linked relay or tell a short story about the system *after* observation/stall | "That shield is powered by something." |
| Player finds valuable item | Explain build relevance, not a currency upsell | "That's the last Cable for the workshop." |
| Player can choose to push | Surface deeper opportunity and the risk of carried loot | "We could look deeper. Or make it home with this." |
| Player returns | Comment on actual gain or failed goal without falsely congratulating loss | "At least the lights will stay on now." |

Guardrails: no repeating every pickup, no hints every second, never obscure telegraphs, no instant solution reveal at entry. BIT may have upgrades improving **information quality** while all core solutions remain independently learnable and usable without a paid BIT purchase.

## 8. Difficulty and player mastery

**Challenge should migrate from accuracy checks toward choices.** Mix pressured dodging/aiming with tactical counterplay, route planning, limited gadgets and extraction judgment. Easy early encounters teach counterplay; later combinations test it and reward mastery.

Use **the same rule consistently** across biomes: a power relay always looks and behaves like a power relay even if it drives a different obstacle. A learned skill becomes useful, reinforcing operator mastery without another percentage-stat tree.

Do not simulate intelligence by letting enemies unfairly detect players, extending combat with huge HP pools, or removing reliable telegraphs. Difficulty should make a known solution harder to execute under pressure without hiding the information needed to choose it.

## 9. Production plan: smallest meaningful fun test

**Slice 1 — one room, one rule (design proposal):**
- Reuse a current bunker room and existing shield turret; add one readable **destroyable power link** and one flank route.
- Three tactics: direct combat, power sabotage, optional EMP if current tool behavior supports it.
- Provide one useful non-guaranteed loot opportunity, retain the existing return extraction choice and controlled-risk contract.
- Add BIT one short hint only after stall, and track event `room_seen`, `power_link_hit`, `power_link_disabled`, `turret_destroyed`, `emp_used`, `room_abandoned`, `room_time_ms`, `extract_attempted`, `extract_success`, `items_banked`.
- Avoid new UI buttons or paid content.

**Slice 2 — a whole short raid containing the room:**
- Place the first common-material reward before or near the tactical room.
- Offer a safe exit any time and clear optional route deeper.
- Seed the room between runs with 2–3 layout variations.
- Track whether players discover a second method **without explanation**.

**Slice 3 — home result:**
- Show truthful earned materials, function-build opportunity and one small **non-blocking** visual restoration.
- Demonstrate an optional operator/nameplate/room identity reward based on a completed achievement; no purchased cosmetic prerequisite.
- Measure if the post-raid incentive makes the next raid attractive without distracting from excitement.

### Playtest gates (proposed; calibrate before formal approval)

- **Comprehension:** At least 4 of 5 new players can explain the room's immediate threat and one solution after seeing it.
- **Agency:** At least two different successful solutions are actually used across a small playtest group; don't claim three alternatives if a route never works.
- **Fun delta:** More players rate the special-room raid as fun and memorable than a matched combat-only raid, without a material drop in responsiveness or first-time understanding.
- **Pacing:** Median time in the room approximately 20–60 seconds; most full-commit raids stay inside the 8-minute ambition, while quick returns remain worthwhile.
- **Economy:** Better tactics may save ammunition/health/time or expose an optional reward; no free bag rescue or material duplication.
- **Mobile quality:** Normal phone thumb interaction; clear visuals at actual game camera; performance and geometry pass existing low-end checks (previous Low-quality >40 FPS goal, subject to device verification).

**Before code implementation:** Validate the mechanics against current big-level collision, camera angle, shield-turret component support, BIT hints and existing test harness. This document authorizes *design and test proposal*, not modification of a running raid.

## 10. Anti-patterns and explicit exclusions

- **Not:** 8 minutes of non-stop easy shooting.
- **Not:** five locked logic puzzles requiring text reading.
- **Not:** all material progress made through shop skips.
- **Not:** a new mechanic for every room or a unique button per gimmick.
- **Not:** a required special-room completion before an ordinary return extraction.
- **Not:** guaranteed loot or restored valuable equipment on death.
- **Not:** selling an exclusive EMP or a premium-only smart solution.
- **Not:** overcomplicated home menus that bury RAID beneath cosmetics.

## 11. Open decisions (not owner approved)

1. What percentage of standard raids should contain one tactical room, and should it be always optional?
2. Which special-room mechanics survive with the current camera and controls?
3. How are relays, alarms and hazards surfaced without HUD clutter?
4. Should the first gameplay mastery rewards be **nameplate/title**, small room prop, or operator cosmetic?
5. What is the realistic baseline enjoyment and time-to-extract for the current live big-level raid?
6. Which mechanics should scale across bunker, archipelago forest and town without bespoke art or performance regression?

**Recommendation:** Playtest **Shielded Relay Room first** as the decisive fun experiment; keep first-week Home/Identity progress in parallel rather than delaying gameplay fun behind monetization. Once actual player outcomes and extraction rates are measured, tune the pacing and economy with the Node Raid Simulation Harness from separate draft PR #204.
