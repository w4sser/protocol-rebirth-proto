# Protocol Rebirth — Meta Prototype v0.1

Playable prototype of the meta-game loop for **Protocol Rebirth** (mobile extraction shooter).
Raids remain simulated for the meta-loop. Raid prep also includes a separate playable combat sandbox
to test touch movement, shooting, BIT support, health and loot pickups.

**Play:** open `index.html`, or the GitHub Pages link for this repo. Landscape only. From Raid Prep,
choose **Try the Combat Test** to enter the live-fire sandbox.

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
