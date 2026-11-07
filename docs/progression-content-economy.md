# Protocol Rebirth — M19 Progression & Content Economy (30/60/90-Day Design)

> **Supersession — M19D, 7 November 2026:** [Core, Meta & Commerce Contract](core-meta-commerce.md) is the single source of truth for the connected target design: home Project, probabilistic in-raid material targeting, 2–3 major-room stages within unchanged total cost, and no material offers before gameplay-built Fabricator L1. Earlier conflicting proposals below are historical; unapproved tuning remains hypothetical.

> **Status:** Detailed DESIGN PROPOSAL, 7 November 2026. User requested continuing design while they provide a future Archipelago/collision gameplay recording. Incorporates approved D1/D2/D3, P1.1/P1.3, M5 commercial structure and M9/M12 identity direction; actual reward cadence, item prices, unlock costs and event calendar are **not approved**. No runtime or spreadsheet changes.

## 1. Player promise and product guardrails

**Every successful extraction advances a goal the player chose, while every meaningful milestone visibly changes their home or opens a new way to play.** The bunker answers **where can I go and what can I build?**; operator answers **how do I play?**; equipment answers **what am I risking?**; BIT answers **what do I know and who accompanies me?**; cosmetics answer **who am I and what does my home look like?**. These are one progression experience, **not six competing upgrade grinds**.

- D1: carried material and valuable deployed gear are lost on death; home stash, earned permanent functional rooms and cosmetics stay protected. Only one Vault L1 Secure Slot; free Basic Carbine retry. No paid bag recovery/insurance.
- D2: early physical return extraction always possible independently of the tracked goal; forward-depth nodes unlock only deeper progress; higher risk presents better opportunity, not a mandatory longer raid.
- D3: preserve authored FTUE (fight home; meet BIT inside; use two guaranteed Scrap Alloy for Core L1; first normal extraction closes onboarding). Do not frontload currencies, naming or shop.
- P1.1: Bunker determines access and restoration; operator shapes playstyle; equipment defines losable tactical kit; BIT provides companion support.
- P1.3: Operator XP milestones with **a few meaningful choices**, not separate permanent class-specific grind tracks.
- M5: Approved commercial families are **direct deterministic resources**, **milestone Growth Fund** and **permanent cosmetic identity**. Prices and numerical resource values are proposed and need model tests.

## 2. One primary loop, five supporting layers

| Layer | Main owner question | Core earn source | Spend / unlock and consequence | UI placement | Failure treatment |
| --- | --- | --- | --- | --- | --- |
| **Bunker / Core** | What do I restore next? | Successfully extracted materials, Scrap, specific world intel | Functional facility / next region; visible restoration | **Project** at Home + Track into RAID | Completed restoration permanent |
| **Operator** | What kind of fighter do I become? | Actual raid XP, milestones, authentic challenges | Few build-affecting milestone choices | Profile / Operator | XP retained as authored, not the at-risk material bag |
| **Equipment** | What am I willing to risk for this objective? | Scavenged gear, Fabricator craft, inventory | Gun, armor, attachment, tools, consumables | RAID Prep (lightweight) | Equipped valuable gear and charges follow D1 |
| **BIT** | How can BIT help me learn and find value? | Earned relationship progress, BIT Bay hardware upgrades | Improved contextual information/support with dry personality | BIT Bay + contextual in raid | Permanent progression remains, no item rescue |
| **Identity / Home** | How do I show that this is mine? | Free basics, earned masteries, optional cosmetic purchases | Callsign, plate/title, operator/BIT looks, room-by-room décor | **Customize** unified hub | Cosmetic entitlement never lost on death |

**Not another currency:** Shared Scrap, materials, Data Cores, Contract Chips and premium Signals already exist in current/proposed economy; do not add new "restoration tokens", biome-specific random wallets or 4 independent cosmetic shards. Progress should be measured in **visible before/after and usable capacity**, not the number of bars.

## 3. Progression hierarchy in the home UI

**At any moment show one major tracked Project** (e.g., Fabricator L1, Core L2) and one **next action** (raid in likely source area, spend already owned parts, or choose a different goal). Provide unobtrusive secondary opportunities (repair small home item; claim earned title; BIT option). When a player returns with some materials but not all, the main Project truthfully updates.

**Project card example:**

```
FABRICATOR L1 — Repair the Workshop
HOME: Scrap 20 / 20, Scrap Alloy 2 / 2, Cable 1 / 2
NEXT: Recover one more Cable
LIKELY: Bunker electrical storage
[TRACK & RAID]    [VIEW PROJECT]
Optional, only after gameplay-earned and built Fabricator L1: [GET MATERIALS] — fully disclosed; never blocks free route
```

The above figures are **illustrative** and not intended to replace the current `data/modules.js` actual costs. Do not mislabel already-banked materials as carried. Avoid stacking upgrade completed, nameplate equipped, BIT new trick, Growth Fund and shop prompts at once; show the most important home change, let the player explore the rest.

## 4. Three intertwined reward frequencies — proposed targets, not promises

| Frequency | Reward type | Practical example | Design rule |
| --- | --- | --- | --- |
| **Every meaningful successful return** | Visible useful partial progress | One fewer missing Cable, newly banked gear or completed small repair | Even early extraction can be a legitimate success; never conjure dropped loot on death |
| **Every few successful raids** | Distinct visible/functional milestone | Fabricator functionality, room lighting, BIT dock, Vault, small furnishings | Small repairs must not compete with rare core-upgrade inputs or create busywork |
| **Major expedition milestone** | New future possibilities | Core L2 + extracted Archipelago Chart; Core L3 + extracted Town Survey | Actual world intelligence extracted; purchase alone never bypasses scouting |

**Approved M19D restoration rule:** Major rooms use 2–3 clearly visible stages within their existing total resource requirements. Stage costs sum to the original amount for each resource; no extra wallet or mandatory grind. Exact splits and intermediate function remain hypotheses. Separate optional decorative repairs below must not become required room stages with extra costs.

**Complication to test:** Some longer-term projects have significant real requirements. If a player experiences 5–6 successful short raids with no visible new home change, test additional low-cost earned repairs or rebalanced acquisition—not artificial "instant progression" purchase pressure.

## 5. Thirty / sixty / ninety-day journey (NOT time-gated)

The calendar bands below are **cohort-analysis lenses and content pacing hypotheses**, not login streaks or hard timers. A fast player can progress sooner; a slow player need not lose access. Measure milestones by successful raids, secured materials and actually completed objectives.

| Lens | Dominant goal / novelty | Bunker / world | Operator / BIT / loadout | Identity + economy |
| --- | --- | --- | --- | --- |
| **First 30 days: Establish a home** | Understand extraction risk, learn varied tactical encounters and make early home changes | Core L1 and Fabricator path; small repairs; Vault or BIT Bay; prepare real Core L2 + Chart access to Archipelago | Try four differentiated existing weapons/tools; first operator milestone decisions, first BIT hints and useful hardware | Free bunker name/Callsign, first earned nameplates, optional small decor; Growth Fund preview tied to real permanent milestones |
| **Days 31–60: Expand reach** | Confidently choose routes and push deeper for distinct payoffs | Explore biome variations, Archipelago scouting, Core L2 and progress toward Core L3/Town as earned; enrich restored home spaces | Counterplay based on enemy combinations, different builds for outdoor terrain; BIT specialties matter | Themed multi-pillar appearance collections, challenge titles; deterministic resource offers optional |
| **Days 61–90: Deepen mastery** | More complex encounters and meaningful long-term Projects rather than repeating a fixed farm | Town access when prerequisites completed, distinct discovery/expedition rewards, further room restoration and optional visual themes | More meaningful operator choice combinations (not new XP trees), advanced equipment specialization and BIT information mastery | Longer-term earned identity, cosmetic collection goals, milestone fund claims if previously earned |

**Crucial:** Do **not** hard-design that players must be in Town by Day 61. This is a testable pacing scenario, not an approved unlock schedule. The world should have enough content to sustain multiple months **without manufacturing impossible grind walls**; the real 30-day economy model and simulation harness must be calibrated against actual raid success/loot and human playtesting before defining 60/90-day conversion or progress.

## 6. The content economy: what is costly to create, what is cheap to recombine

Instead of shipping a bespoke mission for every return, reuse authored gameplay ingredients from M15–M18A:

| Content unit | Creation cost shape | Replayable use | Persistent value |
| --- | --- | --- | --- |
| **Encounter rule / threat pair** | Engineering/AI/telegraph test | Many bunker/forest/town layouts, varying loadouts and optional approaches | Mastery and achievement evidence |
| **Room/terrain macro-template** | Level art, collision/navigation, validation | Many seeded routes and encounters | Recognizable biome identity |
| **Optional field event** | One reusable readable system | Changes tactical situation | Memorable story and exploration log |
| **Loot-family opportunity / cache** | Shared loot tables and props | Changes chosen risk/route | Material for tracked project |
| **Authored world milestone** | More narrative design/testing | First-time unlock and earned story reveal | Core + scouting opens a genuinely new playable region |
| **Visual restoration/cosmetic set** | Art/design + previews/entitlements | Appears on every home visit and player identity | Ownership and emotional attachment |

**Recommendation:** Build **systems that multiply other content**, not sheer volume of one-off missions. An enemy pairing + route variation + different loot family creates distinct runs with minimal new art, as long as generation validates fairness, collision, sightlines and legitimate item availability.

## 7. World-to-home flow examples

**Example A — Fast scavenging return:** Player needs Cable and selects Bunker. Finds one useful part, declines a turret relay room, extracts after a short route. Home Project updates; may afford a lamp repair with separate common supplies. No false quest completion.

**Example B — Riskier outdoor mission:** Player hunts a navigation component in Archipelago; the open forest layout and scout pattern differ from last run. A rare signal cache appears. Player pushes deeper and survives; secured parts move Core/field knowledge forward. On death, no rescue currency, but persistent knowledge/mastery/previous home stays.

**Example C — Tactical mastery raid:** Player exploits power link to defeat shield turret using free Carbine; if a specific achievement is authored, title/nameplate can register mastery. Field loot still requires extraction. BIT comments briefly. New cosmetics can display achievement, not purchase its underlying skill.

## 8. Monetization is connected to ambition but not required for gameplay integrity

**Three approved product families:**
- **Deterministic resources (only after gameplay-built Fabricator L1):** existing spendable currency/material packages for clear missing requirements, with free raid source beside paid path. Never sell a purchased item as an immune piece of field gear.
- **Rebirth Growth Fund:** purchase once, claim real earned milestone rewards including previously attained eligible milestones. No calendar pay-to-log-in progression or fake checkpoint completion.
- **Permanent cosmetic identity:** themed operator/room/BIT/profile components, owned across loss. Room naming and Callsign edits always free; earned mastery cosmetics should retain meaningful exclusive identity.

**In-raid exclusion:** No upsell while choosing whether to extract; no extra Secure Slots, bag rescue, death insurance or paid-only environmental solution.

**Offline limitation:** GitHub Pages/offline prototype has local storage, not authoritative anti-fraud purchasing or cross-device entitlement. Commercial payment, Signal grant and owned cosmetic inventories require explicit backend/verification before launch. Do not present a local balance as production-valid.

## 9. Metrics and economic validation

### North-star candidate (product hypothesis)

**Meaningful Returns per Active Player:** the number of successfully extracted raids in which the player made real progress toward a chosen project, discovered meaningful world information or consciously secured gear. Define instrumentation carefully: a merely successful empty extraction should **not** automatically qualify, and spend cannot substitute for gameplay accomplishment.

**Counterbalance:** Fun / encounter choice and replay variety are necessary; do not optimize one loot-delivery number while raids become monotonous.

### Instrumentation by layer

- Raid: start/end, area/depth, seed, duration, success, extracted items, damage/tool decisions, early vs deep extraction, actual variety axes seen.
- Project: chosen goal, verified reachable source, materials needed/home/in bag, successful upgrade, elapsed **successful returns** to finish, visible stage change.
- Operator/BIT: milestone earned, meaningful choice made, tool or intel actually used, not just unlocked.
- Identity: free names chosen, customization used, earned item displayed, optional purchase (only when verified).
- Economy: sources/sinks per unit, currency supply/inflation, shortage frustration, resource purchase exposure/conversion, fund milestone earned vs claimed, cosmetics previews and purchases.

### Concrete proposed weekly balance review

Review cohorts by 1/3/5/10/20 successful raids and by total elapsed playtime, **not** only calendar day. Look for: no early visible repair, impossible material source, too many resource denominations, expensive upgrades that never unlock a new action, 1 dominant weapon, one monotonous raid variant, paid acceleration making free path painful, 3–5 repeated identical encounter types.

### Gate for accepting the first 30-day loop

1. A fresh player understands the next meaningful Bunker Project after FTUE.
2. At least two small visible home restorations occur between major functional milestones without locking economic inputs away from Core path.
3. Each functional upgrade produces a recognizable play/home consequence in the next 1–2 raids.
4. Player chooses at least two tactically different loads/approaches as encounters vary.
5. Archipelago exploration feels genuinely larger and different while maintaining shorter early extracts and collision-free routes.
6. The economy has a viable free route and spends neither eliminate meaningful extraction risk nor skip extracted scouting intel.
7. Source/sink expectations are supported by real code-linked simulations **and** human device playtests, not fabricated Day 30 revenue outcomes.

## 10. Dependencies and recommended next decisions

**Before final balance:** Finish/validate real optional outdoor graph and collision path (Archipelago / shots / player / enemies), test the M13 Shielded Relay Room, verify actual drops/quest facts, reconcile legacy insurance with approved D1, and compare economy harness simulations to observed raids.

**Historical planning list — next-question priority superseded by M19D:** The [contract](core-meta-commerce.md#hypotheses-and-next-decision) now presents one next owner decision: intermediate room-stage functionality. The following remain later review work, not additional questions for this sign-off.
1. **Simplify progression explicitly:** Which existing use-based skill/weapon mastery/talent tracks are retained, collapsed or removed? Owner has approved Operator hybrid **direction** but has not approved individual deletions. Recommend a consolidation pass before adding any new bar.
2. **Set first 10 successful-raid reward cadence:** Based on actual progression costs from `data/modules.js` and plausible playtest data, lock goals and small home improvements with source/sink budget.
3. **Plan M20 Retention & LiveOps** without calendar chores, and only after replay variety/mission design has a validated core.

**Document owner request status:** The user asked to continue documenting design while providing an Archipelago collision video later; M19 is a **design proposal**, no pricing, drops, paid product implementation or gameplay code changed.
