# Protocol Rebirth — Meta Prototype v0.1

Playable prototype of the meta-game loop for **Protocol Rebirth** (mobile extraction shooter).
Raids are simulated — this tests the base-building loop: *does the base create "one more raid"?*

**Play:** open `index.html`, or the GitHub Pages link for this repo. Landscape only.

## Structure

- `index.html` — shell + all CSS
- `app.js` — logic + UI (no economy values in here)
- `data/*.js` — **all** game data: items, modules, zones, recipes, vendors, BIT, progression beats. Balance changes happen here only.
- `assets/bit.png` — BIT

## Dev tools

Gear icon (top right): force raid outcomes, grant items, jump between beats, reset save, export the event log (every action is logged — including `ONE_MORE_RAID`, the key metric).

Save lives in `localStorage` (`pr_meta_save`, v2). Old save versions are discarded automatically.

## Design docs

See `META_v0.1.md` and `PROTOTYPE_SPEC_v0.1.md` in the parent project.
