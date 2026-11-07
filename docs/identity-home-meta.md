# Protocol Rebirth — Identity & Home Meta Systems

> **Supersession — M19D, 7 November 2026:** [Core, Meta & Commerce Contract](core-meta-commerce.md) is the single source of truth for the connected target design: home Project, probabilistic in-raid material targeting, 2–3 major-room stages within unchanged total cost, and no material offers before gameplay-built Fabricator L1. Earlier conflicting proposals below are historical; unapproved tuning remains hypothetical.

> **Status:** Integrated design proposal, 7 November 2026. Owner direction approved for all four identity pillars (bunker/room, operator, BIT and player callsign/nameplates). Exact progression rewards, content counts, art scope, pricing and build UI are **not approved**. No gameplay implementation in this docs PR.

## 1. Product promise

**A raid changes your home; your home reflects who you are; who you are travels back into the next raid.**

The meta has two complementary jobs:

- **Functional progression:** extraction-earned materials restore the bunker, unlock capabilities and widen tactical options.
- **Personal identity:** the player names and customizes their operator, bunker, companion BIT, and visible player profile. Paid and earned cosmetics persist when at-risk gear is lost.

Do not convert these into four disconnected menus, four currencies, or a mandatory cosmetic tutorial.

## 2. Four identity surfaces, one shared inventory

| Surface | Player-owned identity | Unlock examples | Uses | Where it is seen |
| --- | --- | --- | --- | --- |
| **Player profile** | Free editable **Callsign**, equipable nameplate, titles, emblem, profile background | Free base plate; earned extraction/title achievements; selected premium sets | Profile expression; future co-op identity | Bunker home card, results, eventual co-op lobby |
| **Operator** | Outfit, headgear/helmet style, palette, backpack look, weapon skin | Free starter outfit; raid/milestone cosmetic; premium collections | Visual expression. Real armor/weapon stats belong to separate losable gear | Bunker overview/inspection and readable in raids |
| **BIT** | CRT expression/theme, shell, colorway, docking appearance | Initial free accent; BIT Bay milestones; themes | Companion identity. BIT hardware, Bond and talents remain distinct | Bunker and raids |
| **Bunker** | Separate free editable home name, room furnishing slots, wall/floor palette, lighting, trophies | Functional room restored through play; free starter furnishing; premium room theme | Visual proof of recovery and ownership | Home, room focus, after raid |

**Single shared cosmetic inventory:** a purchase or reward grants a permanent owned item entitlement for its intended surface; it is never consumed on death. Each cosmetic item specifies `surface`, `slot`, `themeId`, `source`, `owned` and `equipped`. A theme bundle is a collection of item grants, not a second currency.

**Display names:** Callsign and bunker name are different strings; both are free, skippable and editable. Offline storage cannot guarantee globally unique callsigns. BIT retains the authored name BIT. Avoid flags.

## 3. Two scales of bunker restoration

### Major functional restoration

Rebirth Core, Fabricator, Vault and BIT Bay materially alter what a player can do. Their existing data costs, unlocks and risk consequences must remain authoritative until explicitly rebalanced.

### Small visual restoration

Restore lights, a sleeping corner, workshop dressing, a power conduit, a BIT docking fixture, a shelf or a wall panel. The player immediately sees a before/after and sometimes a new decoration slot. These should use **abundant resources or free milestone grants**, not compete against the scarce Cable / Scrap Alloy / Polymer Plate needed by the first functional rooms.

**Design rule:** In the first five successful raids after FTUE, target at least **three visible bunker changes beyond Core L1** (playtest hypothesis). A small repair must not be disguised as a major unlock, additional currency, maintenance tax, time gate, or separate skill tree.

**Technical reality:** The bunker currently uses staged pre-rendered art plates with DOM hotspots. Begin with curated room presets / fixed furniture slots and visual states rather than assuming a fully free-form 3D Home Designer already exists.

## 4. One coherent home UX

**Primary home composition:** character/operator presence; BIT companion presence; bunker background with named home; one current project / next raid need; accessible **Customize** entry.

**Customize** is one hub with four lightweight tabs or focus targets:
1. **Operator** — preview outfit / headgear / color, equip existing item; owned vs locked clearly marked.
2. **Bunker** — tap an already-restored room, select wall/floor/furniture preset, preview before purchase.
3. **BIT** — preview shell, CRT expression, dock accent; distinguish functional hardware.
4. **Profile** — Callsign, nameplate, emblem, earned title; bunker name editable at home rather than hidden inside a monetization shop.

Keep fast navigation and persistent **RAID** action. Do not make a new top-level screen for each equipable cosmetic. Home overview, projects, store and cosmetics have different jobs: `Home=progress`, `Projects=function`, `Customize=identity`, `Shop=optional acquisition`.

**Contextual commerce:** On an unowned cosmetic preview, show direct price or Signals and what is included; on a missing functional repair input, show likely in-raid routes; optional `Get Materials` is eligible only after gameplay-built Fabricator L1. Before that, no material or mixed resource offers; cosmetic-only commerce follows D3.9 and its result summary. Purchased gear and resources never rescue raid losses or auto-extract. Growth Fund lives in Projects and rewards earned bunker milestones; theme packs can contain operator + BIT + room + nameplate cosmetics.

## 5. Proposed week-one experience; no calendar gating

| Journey beat | Functional change | Free visual/identity payoff | Potential optional commercial relevance |
| --- | --- | --- | --- |
| Authored first session / FTUE | Core L1 and BIT discovered; first normal extraction required to end FTUE | Core dramatically lights up; BIT becomes a character | **No shop in FTUE** |
| First completed ordinary extraction | Begin Fabricator repair path | **Optional** Callsign / bunker naming; free nameplate and one operator appearance choice | Nonblocking welcome identity offer afterward |
| Early following extractions | Fabricator L1 and first real loadout preparation | Workshop visual activation; small room repair and first free furnishings | Clearly scoped room/outfit starter, not forced |
| Next meaningful return | One additional small repair | BIT CRT color accent or companion cosmetic | Preview BIT shell, no hardware confusion |
| Midweek option | Vault L1 **or** BIT Bay L1 | Room storage/companion upgrade visibly transforms home; new decorative slots | Relevant room pack / BIT set |
| End of week | 2–3 more small restorations, resources toward Core L2 | First earned title/emblem/nameplate variation; identity set starts to look personal | Matching cross-surface thematic set |

The above is a **sequence of player accomplishments**, not a forced day-by-day schedule or fixed reward specification. Extra cosmetics are presented after gameplay payoff; avoid four popups at one homecoming.

## 6. Example cohesive theme collections

| Theme | Operator | BIT | Bunker | Profile |
| --- | --- | --- | --- | --- |
| **Nordic Summer Night** | Warm-weather survivor outfit | Soft cyan lens/shell | Pine wood, warm lights, plants | Dusk archipelago nameplate |
| **Cold War Utility** | Restored field gear | Radar CRT treatment | Teal/gray industrial panels and lockers | Brushed steel unit plate |
| **Salvaged Workshop** | Heavy repair overalls | Orange maintenance shell | Shelves, tools, improvised lamps | Industrial stamped nameplate |
| **Signal Keeper** | Radio operator attire | CRT scanline expression | Radio room furniture/antenna display | Amber lighthouse signal plate |

These are art/commerce proposals, not a confirmed SKU catalog or bundle pricing. Prioritize combinations that read at mobile-camera distance. No new national flags or combat-relevant hitbox modifications.

## 6A. Two named player nameplates — owner-supplied names

**Owner-selected copy, 7 November 2026:** Two identity/nameplate names to include in the Protocol Rebirth design catalog, with exact capitalization and wording:

| Nameplate (exact text) | Emotional theme | Suggested visual treatment (PROPOSAL) | Suggested earning path (PROPOSAL) |
| --- | --- | --- | --- |
| **Ghost of the Past** | Memory, loss and searching for what remains of the old world | Weathered slate/metal, muted lavender granite, faint archival CRT signal and restrained cyan interference | Find and successfully extract a distinctive archive/memory discovery in the abandoned Town; do not treat witnessing or looting alone as banking an at-risk item |
| **No Fear of Tomorrow** | Courage and the determination to rebuild rather than just survive | Deep navy base, optimistic warm-amber horizon and narrow cyan edge light | Complete a difficult voluntary extraction challenge, or a major multi-raid bunker restoration milestone; exact challenge requires fair playtesting |

**Decision boundary:** The **two exact names are owner-provided content to preserve**. Art direction, rarity, rarity tier, unlock criteria, achievement-only versus purchasable availability and technical representation remain **unapproved proposals**. Preference is to make these **earned identity titles/nameplates**, rather than a paid substitute for an actual difficult achievement. Show them in the single Profile/Customize surface, not as two new currencies or independent upgrade tracks. No new gameplay/UI code is implied.

## 7. Economy rules

- Free path: meaningful room progress and starter decor, one functional operator look selection and basic nameplate available early, earned thematic rewards over time.
- Paid path: targeted resource acceleration under approved commercial Model C/M5 and deterministic cosmetic item/collection purchases.
- **Never paid:** Callsign entry/renaming, bunker name/renaming, FTUE completion, auto-extraction, death recovery, extra purchased Secure Slot.
- Cosmetics permanently owned regardless of field gear loss; functional equipment bought with Signals and carried into a raid stays at risk.
- No unique globally visible identity guarantees, shared inventory server authority or real-money transactions until a backend and consent/security design exist.

## 8. Instrumentation and acceptance

**Event candidates:** `name_chosen`, `bunker_named`, `room_repaired`, `room_customized`, `cosmetic_previewed/equipped`, `profile_plate_equipped`, `bit_style_equipped`, `outfit_equipped`, `shop_opened`, `theme_bundle_purchased`.

Track: first 3/5/10 successful raids -> visible restorations, time until identity creation, percentage selecting an outfit, percentage equipping a nameplate, cosmetics used in actual raids, room decor engagement, return rate and effect on raid participation.

**First milestone playtest acceptance:**
- After a first normal extraction, a player can change at least one visible element for free **without interrupting FTUE**.
- A player can identify the next **functional** upgrade and one optional visual restoration.
- Operator / BIT / nameplate skins remain equipped and owned after raid death; purchased/earned equipped *gear* does not.
- A screenshot of the operator, BIT, profile plate and first personalized room looks meaningfully distinct while matching the coherent Protocol Rebirth visual language.

## 9. Adjacent gameplay fun mandate

**Owner direction:** Current core combat/extraction needs to become more fun. Investigate **Metal Gear Solid-era tactical room problem solving** as a complementary pillar: readable situations, observation, multiple solutions, meaningful consequences. See M13 in the decision register. Meta loop must not be used to mask uninteresting raids.

## 10. Remaining approvals

- Operator visual slot count and MVP art scope.
- Exact profile naming UX and first nameplate content.
- Which small home restorations are purely visual, their costs, and actual first-week availability.
- Which cosmetics are achievement-only versus also purchasable.
- First commercial theme's SKU and price.
- Whether optional room problem-solving modifies extraction routes or loot; do not change approved D2 rules inadvertently.

**Design-only.** No new gameplay or customization code is authorized by this file.
