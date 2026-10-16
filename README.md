# Protocol Rebirth — Meta Prototype v0.1

Playable prototype of the meta-game loop for **Protocol Rebirth** (mobile extraction shooter).
Raid Prep's DEPLOY launches the playable Three.js raid in `nodspel/`. Extraction returns loot to the base; death loses the carried bag. The older simulated raid and isolated combat sandbox remain available to tests/dev tools.

**Play:** open the root GitHub Pages site, in landscape. Start at the base, restore the Core, then use RAID → DEPLOY. See [the opening playtest guide](docs/opening-playtest.md) for a fresh-save route and verification notes.

## Structure

- `index.html` — shell + all CSS
- `app.js` — logic + UI (no economy values in here)
- `data/*.js` — **all** game data and tuning: items, modules, zones, recipes, vendors, BIT, combat sandbox and progression beats. Balance changes happen here only.
- `assets/bit.png` — BIT

## Dev tools

Gear icon (top right): force raid outcomes, grant items, jump between beats, reset save, export the event log (every action is logged — including `ONE_MORE_RAID`, the key metric).

Save lives in `localStorage` (`pr_meta_save`, v6). Old save versions are discarded automatically.

## Design docs

See `META_v0.1.md` and `PROTOTYPE_SPEC_v0.1.md` in the parent project.
