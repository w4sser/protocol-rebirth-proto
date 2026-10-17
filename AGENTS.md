# Protocol Rebirth — agent guide

## Product direction
Mobile **landscape**, mass-market game: a Tarkov-lite extraction raid (Node Raid, `nodspel/`) feeding a base builder
(meta layer: `index.html`, `app.js`, `style`/inline CSS, `data/*.js`). Static site, no build step, published via GitHub Pages.
All economy/tuning values live in `data/*.js` (a test enforces it); every player action goes through `act()`.

## Hard rules
- Work only in this repo. Never force-push. Do not commit/push unless asked.
- **No emoji or symbol glyphs** anywhere in UI sources. Icons are bespoke SVG in `assets/icons/sprite.svg`,
  mirrored byte-for-byte to `nodspel/ui-icons.svg` (`cp assets/icons/sprite.svg nodspel/ui-icons.svg`).
  Every item/currency in `data/items.js` has its own symbol.
- **One popup component**: base uses `overlay()` in `app.js`, raid uses `.pop-card` + `.pop-x` (`ui/popup.css`).
  Close badge is top-left. No ad-hoc modals, no inline `position:fixed` boxes. Popups must fit the viewport.
- UI stays inside the safe area; the playfield/canvas is full-bleed. Notices are unobtrusive (small, short-lived,
  never covering the HUD, timer or world labels).
- **AD palette** (`ui/tokens.css`, `--ad-*`): cyan = BIT / system / extract, amber = loot, coral = danger,
  orange (`--ad-primary`) = the one primary action (RAID tab, DEPLOY, PLAY/Start). New UI uses tokens, not raw hex.
  `test/palette-allowlist.json` is a ratchet of legacy raw colours: it may only go down.
- Meta raids are simulated; Live Fire stays an isolated sandbox. Monetization only in retention `full` mode.
  Every raid moves at least one progression bar. See the invariants in `README.md` / `docs/`.
- Design proposals (new systems, screens, economy changes) go to the owner **before** building.

## Run the checks
```
npm test                 # base logic + jsdom UI + guardrails (needs `npm ci`)
cd nodspel && npm test   # raid unit tests (node:test)
npm run verify           # both of the above + headless-Chrome layout check, screenshots in verify-out/
node scripts/layout-check.mjs   # layout only (needs puppeteer, or puppeteer-core + CHROME_PATH)
```
`test/guardrails.test.js` covers: no emoji, shared popup, palette tokens/ratchet, primary-button token, sprite sync
and icon coverage, version agreement. `scripts/layout-check.mjs` checks overlap/covered/off-screen controls, popup fit,
world-label and notice overlap, and canvas full-bleed at 844x390, 932x430 and 667x375.

## Versioning
Each PR bumps the version once and everywhere with the same number: every `?v=X.Y.Z` tag (`index.html`,
`nodspel/index.html`, `nodspel/*.js` imports), `APP_VERSION` in `app.js`, and `package.json`. The guardrails test fails on a mismatch.
Bump `SAVE_VERSION` only when the save shape changes.

## Art and assets
Originals live in `assets/reference/` (never overwrite); `tools/add-art.py` derives the `.webp` the game loads.
Image pipeline details: `docs/art-pipeline-and-legacy-guide.md`. Art direction: `docs/art-direction.md` (enclosed Cold-War bunker hub, dark teal/navy, cyan UI accents, warm orange light,
BIT = square CRT smiley, no national flags). Wire new art through `data/*.js` hooks, then bump the version.
