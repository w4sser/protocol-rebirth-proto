# Armory, gear merge, fullscreen weapon upgrade, top-bar audit (design only, v1.87)

Status: proposal from Robert's v1.86 playtest. No code yet. It has to fit the locked direction: bunker is the home and main driver, PvE only, death loses what you carried and did not secure, the starter kit is free, extracting early is a real decision, raids last 5-8 min, BIT runs one task at a time, and no pocket lint.

## Recommendation (summary)
1. **Split Armory and Stash.** The Armory holds weapons, armor, rigs, consumables and tools, with its own slot count that Armory upgrades raise. The Stash holds only materials. Overflow and Quick Clean only ever act on the Stash.
2. **Merge duplicates, Survivor.io style.** 3 of the same weapon or armor make 1 at the next tier (Mk I → Mk II → Mk III). Tier raises the stat cap and adds an attachment slot. The existing Scrap Alloy levels 0-3 stay and are the per-tier fill-up. Duplicates stop being lint because they become merge fodder.
3. **Fullscreen weapon screen.** Big weapon art, 4 stat bars (DMG, RATE, MAG, RANGE), 3 attachment slots (Barrel, Mag, Optic) that each change one bar visibly, and one big UPGRADE or MERGE button. The aim is "build a fat gun", not Tarkov's depth.
4. **Top bar: show only what the screen spends.** By default show Level, Scrap and Power. Every other currency appears on the screen that uses it. Tapping any pill opens a one-line explainer that says where to get it and what it does.
5. **Build order:** (1) top-bar context and tooltips, which is small and fixes confusion today, (2) Armory/Stash split, (3) fullscreen weapon screen with the existing levels 0-3, (4) merge tiers plus attachments.

## (a) Armory vs Stash
- Armory: one slot per item. Stackable consumables share a slot, e.g. Medkit x5. It starts at 8 slots, and the Storage module's Armory upgrades add +4 per level. The free Basic Carbine is always there and takes no slot.
- Stash: materials only, with the current capacity and stack sizes. OVERFLOW and Quick Clean only see the Stash, so the game can never suggest selling gear (v1.87 already blocks this in code).
- Raid Prep reads from the Armory only. Loot that comes home is routed by type automatically. If the Armory is full, new gear waits in a "Pending" row (max 3). From there you merge, scrap or sell it, so nothing is lost silently.
- Save migration: `S.stash` is split by `stashGroup()` (v1.87 sort groups 0-2 go to the Armory, group 3 to the Stash).

## (b) Merging duplicates
- 3x the same item at the same tier → 1x at the next tier. Rarity colour shows the tier: Mk I is the item's base rarity, Mk II is +1 rarity, Mk III is +2. Merging resets the upgrade level to 0 but raises the max level by 1, and it keeps the item's attachments.
- Levels 0-3 with Scrap Alloy and Scrap stay as the cheap "fill" between merges. A merge is the "jump". Merging costs no materials, only the duplicates, so duplicates are worth bringing home. That makes loot from early extracts more valuable, which supports the real early-extract decision.
- No lint: you cannot merge different items. There is no fodder currency and no separate shard item, because the duplicates themselves are the progress. Duplicates you don't want can still be scrapped to Scrap Alloy.
- Death rule: a merged gun you carry is lost like any other gun. The free starter kit keeps that risk tolerable. Optional: the Secure slot can protect 1 merged item.

## (c) Fullscreen weapon upgrade screen
- Layout (landscape): the left 60% is large weapon art on a lit workbench. The art changes per tier and per attachment, with a barrel or scope drawn on. The right 40% has the name, a tier badge and level pips, then 4 horizontal stat bars, each showing the current value plus a ghost segment for the next upgrade.
- 3 attachment slots under the art: Barrel (+RANGE), Mag (+MAG), Optic (+DMG at range). Slots unlock by tier (Mk I: 1, Mk II: 2, Mk III: 3). Attachments are crafted at the Fabricator from existing T2 materials (Servo, Optical Sensor, Circuit Board), which gives those materials a clear use.
- One primary button: UPGRADE L+1 (cost chips shown) or MERGE (3/3 owned). Add a short "chunk" animation and screen shake on success, because that payoff is what creates the urge.
- Entry points: tapping a weapon in the Armory or in the Raid Prep weapon tile. The green upgrade arrow (v1.87) points here.

## (d) Top-bar audit
What each icon is today (v1.86/1.87, `renderCurrencies()` in app.js):

| Icon (as seen) | What it is | Earned from / used for | Proposal |
|---|---|---|---|
| Yellow circle with a number + XP bar ("7  44/200 XP") | Operator level and XP | XP from raids. Tapping it opens Operator skills | Keep on every screen. Make the XP bar thinner |
| Hex nut "2746" | Scrap, the soft currency | Raids, selling. Spent on builds, upgrades and crafting | Keep everywhere |
| Blue crystal "10" | Data Cores, the premium-ish build currency | Data Core loot (L2/L3) and BIT. Spent on module levels | Show only on Base and module popups |
| Purple signal "0" | Signals, the insurance currency | Watching ads and rewards. Spent on raid insurance tiers | Show only in Raid Prep, and only when insurance is on offer. Hide it when it's 0 and nothing can be bought |
| Chip "1" | Contract Chips | Quest steps. Spent at the BIT chip trader | Show only on the BIT and quest screens |
| Power button + bar "63" | Bunker Power (0-100) | Drains over time and is refilled by power quests. Under 30 the maintenance quest takes over the tracked slot | Keep it, but as a slim battery icon with a colour state. Show the number only after a tap |
| Teal pill "5  610" | BIT Bond level 5, 610 bond XP | BIT tasks and haul confirms. Tapping it opens BIT | Merge it into the BIT nav button as a badge. Remove it from the top bar |

- Rules: show at most 4 pills: Level, Scrap, Power, plus whichever currency the current screen spends. A currency pill also appears for 3 s when its value changes (a "+12" fly-in).
- Tap to explain: tapping any pill opens a small anchored tooltip with the name, one line of "what it's for", one line of "where to get it", and a GO button when there is a screen for it. On first reveal it auto-opens once, replacing today's "New resource: Signals" toast.
- Data: a `CUR_CONTEXT = { base:[...], prep:[...], bit:[...], stash:[...] }` table next to `CUR_LABELS`, so tests can pin the layout per screen.
