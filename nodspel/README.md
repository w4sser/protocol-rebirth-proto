# Node Raid

A static Three.js extraction game for landscape phones. No backend, account, or persistent progression. Only this directory contains the playable shooter; the root prototype is separate.

Each round starts with 100 health, an empty bag, three loaded rounds and nine reserve rounds. The shared timer lasts eight minutes. Death or timeout ends the round. An exit opens only after every node is active and extracts the current bag. Continue advances to the next level; completing level three finishes the round. Restart creates a new seed and resets the bag and health.

## Procedural levels

`levels.js` defines room sizes, connections, passages, obstacles, nodes, loot, enemies and weapon tuning. The same seed recreates the same choices. Restart changes the seed and swaps the short route's side. Cover never blocks the paths to nodes or exits.

- **Open Room:** one visible node, one enemy and one loot crate near the player.
- **Narrow Passage:** two rooms connected by a narrow passage. Two hidden nodes and two initial enemies occupy the second room; two more enemies activate after the first node. A short loot branch and a longer node route are visible from the start.
- **Dead End:** three rooms, six faster enemies and a branching dead end containing the marked loot crate. The exit is in the third room along the other route.

The level name and seed appear prominently for three seconds, then stay in the corner. Each level has one marked crate with a yellow ring and beacon. Loot crates are not solid obstacles. Grey boxes remain cover. Route signs and floor markers remain until their marked crate is collected or all nodes on their route are active.

## Controls and combat

Move with the left stick or keyboard. Drag the right stick to show the range circle and aim line; release to shoot. Releasing without dragging does not fire, and the movement stick never fires. On desktop, hold and release the mouse button or Space to shoot.

Aim assistance gently locks onto visible enemies or nodes near the aim line. A marker identifies the target. Shots have width, expire at weapon range and cannot pass through walls. The same weapon is used throughout. Enemies on levels one and two take two hits; level three enemies take three. Enemy hits remove 20 health. A kill restores 15 health and loads one round from reserve when available. Entering a room grants three seconds of protection.

The magazine holds three rounds and reloads one round every 0.7 seconds. The HUD shows magazine and reserve, such as `3/3 · 9`, with a reload meter. An empty magazine never ends the round. Marked crates can contain `ammo_pack`, which adds four reserve rounds rather than entering the bag.

Any inactive node can be activated without shooting: stay within 1.8 units with an unobstructed path for two seconds, regardless of ammunition. Its meter fills while in range and resets on leaving or moving behind cover. A shot still activates it immediately. Enemies require shots. Resource tuning lives in `RULES.resources`; weapon tuning lives in `RULES.weapon`.

## Order and results

`order.json` specifies industrial / maintenance_tunnels / standard, objectives cable and fuse, weapon basic_carbine, ammo 12 and health 100. Level one loot can contain cable; the marked crate on level two can contain fuse. Other possible items include scrap_alloy and power_cell. Loot is determined by the seed.

An extraction result contains the current bag in `extracted`, an empty `lost`, `died: false`, `weaponReturned: basic_carbine`, remaining magazine plus reserve in `ammoReturned`, and industrial in `seen`. Death puts the current bag in `lost`, leaves `extracted` empty, sets `died: true`, returns no weapon and returns zero ammo. Timeout returns no equipment and sets `died: false`. Previously extracted loot is shown separately and is not counted twice.

The result screen requests a `result.json` download. Save result.json downloads it again if the browser blocked the automatic download. The latest result is also stored as `nodspel.result.json` in localStorage, without restoring progression. GitHub Pages cannot overwrite server files: the committed `result.json` is a verified example; actual results are exported from the result screen. There is no runtime or storage integration with the root prototype.

## Run and install

Run `npm test` in this directory for seeded layouts, reachable paths, combat, resources, route signs, timer and complete rounds. Start a local preview with `node serve.mjs`.

Add the page to the phone's home screen using the browser menu. The manifest launches Node Raid as a standalone page without the address bar. iOS also has an Apple touch icon and standalone metadata. Icons are provided at 192 and 512 pixels. There is no install button.
