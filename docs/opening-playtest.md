# Opening loop playtest

Start from the root base page, not a bookmarked `nodspel/` seed. Use a private/incognito browser window for a fresh save; do not use Reset in your regular window. Private storage is separate from your progressed save. The local review build uses a separate origin (`http://127.0.0.1:4174/`) for the same reason.

## Route
1. Enter the facility. Activate the Core with the supplied Scrap Alloy.
2. Read the highlighted Fabricator goal: two Cable and two Scrap Alloy total, including one Alloy already secured at home. Its payoff is an existing Scavenger Vest (+25 shield, +1 raid bag slot).
3. RAID → DEPLOY. The introductory mission keeps the standard loadout. Electrical Storage contains the missing recipe materials and one explicitly optional extra cache. Their availability is guaranteed; pickup, survival and extraction are not.
4. Charge the node by standing near it for two seconds, or shoot it. Read the guard's warning, fixed-direction burst and recovery. Try moving around cover during recovery, or approaching the supplies from the opposite angle. No kill is required to open the exit.
5. Watch HOME and BAG separately. Once enough is carried, extract; a death instead empties the bag and leaves the banked counts intact.
6. Return to base and activate Fabricator. Secured materials and Scrap currency are spent once. Its commissioning gift is granted once and auto-equipped on the next default loadout.
7. Verify Vault becomes the next goal. Enter Raid Prep and inspect the shield and fifth bag slot. Reload: the upgrade and next goal must remain.

## Scope and decisions
- Same engines, controls, art, room order, save version and later items. No new weapon, enemy class, external service or framework.
- The introductory loop uses Cable and Scrap Alloy. Core uses supplied Alloy; later material recipes and old inventories remain intact.
- Intro caches are relative placement rules within the existing seeded room, mirrored by the seed. Later area layouts are retained.
- The first supply mission ends at its first extraction, so unfamiliar later material pools do not appear before its upgrade. Later raids retain the existing three levels.
- Shared identities come directly from `data/items.js`, consumed by both the base and raid. Optional quantities and later loot remain random.
- Base camera: drag, pinch or wheel; Overview returns to the initial bounded camera. Background and hotspots share the transform; HUD does not. Drag/pinch cannot activate rooms.

## Verification record
Automated checks cover bank/carried/excess/drop/loss counts, repeated raid-result ingestion, paid activation, one-time reward, real shield/bag launch stats, reload, seeded cache availability, node/cover separation, two complete tactical approaches and camera input bounds.

The tactical checks execute existing movement, projectiles, node holds and loot functions: (1) an alternate-angle supply run activates the node and extracts with the guard alive; (2) bait a burst into a previous position, take cover, and land two carbine shots during recovery. A hit during wind-up commits the guard's prepared burst early; its scheduled bullets remain after its death. A regression test proves that standing and firing rapidly now incurs damage while attacking in recovery avoids that cost. The intro starts behind cover with the one-second warning, rather than a separate artificial grace timer; later-room grace is unchanged. These are mechanical checks, not evidence that players understand the encounter.

Live browser review on an isolated local save verified base → raid, collecting materials, the extraction prompt, successful extraction and return, paid Fabricator activation, automatic Vest in next prep, next Vault goal, reload persistence, and death losing carried supplies. Phone-sized landscape and desktop layouts were inspected. Multi-touch was checked with pointer-event tests; physical-device feel and uncoached player comprehension still need a human playtest.

Observe without coaching whether players can explain their next goal/benefit, recognize required materials, react to the guard, and choose another raid after using the upgrade. Passing code tests does not prove these outcomes.
