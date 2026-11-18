# Opening loop playtest

Start from the root base page, not a bookmarked `nodspel/` seed. Use a private/incognito browser window for a fresh save; do not use Reset in your regular window. Private storage is separate from your progressed save. The local review build uses a separate origin (`http://127.0.0.1:4174/`) for the same reason.

## Route (current fresh-save FTUE)
1. From a genuinely fresh profile, tap the start screen. The playable FTUE raid launches directly, with the Basic Carbine and starting medkit. There is no BIT scene, Core popup or Raid Prep before this raid.
2. Move through a calm approach, defeat an unaware lone grunt, then notice two grunts clustered beside an explosive fuel drum. Shoot the drum for a double kill with blast knockback, or defeat the enemies conventionally. Collect the guaranteed Scrap Alloy and other supplies, activate the node, and reach the extraction beam. No hunter waves spawn in this opening. Failure retries without revealing BIT.
3. After the successful first extraction, return to the bunker. The cold-open discovery of BIT plays **now**, not before the raid. Dismiss its greeting to enter the facility.
4. Restore emergency power at the Core. The bunker then points to Fabricator L1 as the next restoration project, using the materials carried back from the first raid.
5. Build Fabricator L1 when the required materials are secured; do not auto-build it on extraction. Check the commissioning reward and subsequent Vault/BIT Bay choice. Subsequent raids use normal Raid Prep.
6. Repeat with Settings > Save Slots > NEW GAME in an empty slot. Verify it gets the same raid-first entry; loading an old profile must never inherit the new slot's onboarding. Do not reset your progressed main profile to test this.

## Scope and decisions
- Same engines, controls, art, room order, save version and later items. No new weapon, enemy class, external service or framework.
- The introductory loop uses Cable and Scrap Alloy. Core uses supplied Alloy; later material recipes and old inventories remain intact.
- Intro caches are relative placement rules within the existing seeded room, mirrored by the seed. Later area layouts are retained.
- The first supply mission ends at its first extraction, so unfamiliar later material pools do not appear before its upgrade. Later raids retain the existing three levels.
- Shared identities come directly from `data/items.js`, consumed by both the base and raid. Optional quantities and later loot remain random.
- Base camera: drag, pinch or wheel (zoom 1×–2.4×, bounded). The Overview button was removed in v1.59 (owner). Background and hotspots share the transform; HUD does not. Drag/pinch cannot activate rooms.

## Verification record
Automated checks cover bank/carried/excess/drop/loss counts, repeated raid-result ingestion, paid activation, one-time reward, real shield/bag launch stats, reload, seeded cache availability, node/cover separation, two complete tactical approaches and camera input bounds.

The tactical checks execute existing movement, projectiles, node holds and loot functions: (1) an alternate-angle supply run activates the node and extracts with the guard alive; (2) bait a burst into a previous position, take cover, and land two carbine shots during recovery. A hit during wind-up commits the guard's prepared burst early; its scheduled bullets remain after its death. A regression test proves that standing and firing rapidly now incurs damage while attacking in recovery avoids that cost. The intro starts behind cover with the one-second warning, rather than a separate artificial grace timer; later-room grace is unchanged. These are mechanical checks, not evidence that players understand the encounter.

Earlier browser review on an isolated local save verified base → raid, collecting materials, the extraction prompt, successful extraction and return, paid Fabricator activation, automatic Vest in next prep, next Vault goal, reload persistence, and death losing carried supplies. Phone-sized landscape and desktop layouts were inspected. Multi-touch was checked with pointer-event tests; physical-device feel and uncoached player comprehension still need a human playtest.

Observe without coaching whether players can explain their next goal/benefit, recognize required materials, react to the guard, and choose another raid after using the upgrade. Passing code tests does not prove these outcomes.
