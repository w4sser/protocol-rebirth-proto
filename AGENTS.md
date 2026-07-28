# Protocol Rebirth — meta prototype · agent guide

A playable, data-driven prototype of the meta-game loop (base restoration + simulated
extraction raids) for **Protocol Rebirth**. Runs as a static site — open `index.html`,
no build step, no backend. Published via GitHub Pages; landscape, mobile-first.

## Golden rules
1. **All economy/tuning values live in `data/*.js`.** `app.js` is logic + UI only.
   Never hardcode item ids, prices, drop rates or costs in `app.js` — a test enforces this.
2. **Always run the tests before committing.** Keep them green; add coverage for new behaviour.
3. **Bump the cache-bust tag** in `index.html` (`?v=X.Y.Z` on the local `<script>`/asset refs)
   whenever you ship, so players' browsers fetch the new files without a hard reload.
4. Save version: `SAVE_VERSION` in `app.js`. Bump it only when the state shape changes
   (old saves are then discarded — fine in prototype phase).

## Run the tests
```
# pure logic (no deps)
node test/logic.test.js
# UI walkthrough + full-mode FTUE (need jsdom once)
npm install jsdom            # or: NODE_PATH=/tmp/node_modules with a shared install
node test/ui.test.js
node test/ftue-full.test.js
```
All three must print PASS. `test/ui.test.js` clicks the whole vertical slice; extend it
when you add screens or flows.

## Layout
```
index.html            shell + all CSS + per-screen backgrounds + cache-bust tags
app.js                state store, raid sim, screens, actions, analytics (act()/log())
data/
  items.js modules.js raid_zones.js recipes.js vendors.js bit.js progression.js retention.js
assets/reference/     ORIGINAL art (PNG) — never overwrite; source of truth
assets/production/    derived, optimized .webp actually loaded by the game
tools/add-art.py      crop/resize a reference image into a production .webp
test/                 logic + jsdom UI tests
```

## Adding new artwork (the image pipeline)
Chat attachments can be *seen* but not saved to the repo. Get the raw file into the repo
first (drop it in `assets/reference/` — on mobile: GitHub → Add file → Upload files), then:

1. **Derive a production webp** (crop out any baked-in UI; keep a quiet zone for panels):
   ```
   python tools/add-art.py assets/reference/<file>.png <out_name> --maxw 1400 --q 80
   # optional crop in PERCENT (left top right bottom):
   python tools/add-art.py assets/reference/<file>.png <out_name> --crop 40 8 79 84
   ```
2. **Wire it in `data/*.js`** — pick the right hook:
   - hub background per state → `modules.js` `hubStates[].env`
   - module before/after → `modules.js` level `artBefore` / `artAfter`
   - BIT Bay curated style → `modules.js` `styleOptions.bit_bay[].art`
   - raid zone map → `raid_zones.js` zone `mapArt`
   - full-screen backgrounds (prep/vendor/stash/end/…) → CSS `#app.s-<screen>` in `index.html`
3. **Bump the cache-bust tag** in `index.html`.
4. **Run all three test suites**, then commit + push. Pages redeploys automatically.

Art direction: enclosed Cold-War bunker interior (no windows/exterior in the hub), the
outside archipelago only appears during raids. Dark teal/navy, cyan UI accents, warm
orange practical light, BIT = square CRT smiley. No national flags or symbols.

## Core design invariants (don't regress)
- Raids are **simulated**; the real shooter is out of scope here.
- Player chooses **where/how** to search (zone + route + risk); the game decides **what**
  drops. Routes bias family weights, never guarantee a specific item.
- **Staged raids:** deep/risky routes yield 1–3 escalating extract-vs-push checkpoints;
  short safe routes have none. Never promise a tracked item is deeper — show probability.
- **Every raid moves at least one progression bar, even on death.** Base progress never regresses.
- **FTUE is guided; after the first free choice, stop hand-picking upgrades** (show
  "N upgrades ready" + glow, let the player choose).
- **Monetization (ads/timers) only in retention `full` mode.** Default `core` mode is clean
  so playtests measure whether the loop itself is fun.
- Every economy value stays in `data/`; every player action goes through `act()` so the
  event log stays complete (that log is how playtests are analysed).
