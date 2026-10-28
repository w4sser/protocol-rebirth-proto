# Protocol Rebirth — agent guide

## Product direction
Mobile **landscape**, mass-market game: a Tarkov-lite extraction raid (Node Raid, `nodspel/`) feeding a base builder
(meta layer: `index.html`, `app.js`, `style`/inline CSS, `data/*.js`). Static site, no build step, published via GitHub Pages.
All economy/tuning values live in `data/*.js` (a test enforces it); every player action goes through `act()`.

## Stack
- Base/meta layer: `index.html` + `app.js` (shell, UI, save/load). No economy numbers live here.
- Raid game: `nodspel/` (Three.js extraction raid — movement, combat, loot, extract).
- Tuning data: `data/*.js` — items, modules, zones, recipes, vendors, BIT, progression, and raid
  balance (e.g. `data/raid-stakes.js`, `data/raid-perks.js`, `data/raid_zones.js`).
- Tests: Puppeteer/jsdom for the base layer, `node --test` for `nodspel/`.

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
- **Clarity over cleverness.** The player must always understand what just happened to them — what
  they gained, lost, or triggered — before doing the next thing.
- **Quests name their source.** A quest that asks for an item must say where to find it, and that
  item must spawn reliably wherever the quest claims — no quest should depend on RNG the player
  can't act on.
- **Locks explain themselves.** Anything gated (recipe, zone, gear slot) must say why it's locked
  and what unlocks it. Never a bare "locked" with no path forward.
- **No paid services.** Everything (audio, art, tooling) must run free/local. Audio generation
  follows `docs/audio-pipeline.md` (local CPU TTS + procedural SFX, nothing commercial; lands with
  PR #133 `feat/bit-audio-pipeline`, not yet on `main`).
- **Locked design decisions** (do not revisit without the owner): PvE only, no PvP. Dying in a raid
  loses everything currently carried. No new currencies beyond what already exists. BIT (the
  companion) runs exactly one active task at a time — never stack scavenge/expedition/raid-buff.

## Run the checks
```
npm test                        # base logic + jsdom UI + guardrails (needs `npm ci`)
cd nodspel && npm test           # raid unit tests (node:test)
npm run verify                   # both of the above + headless-Chrome layout check, screenshots in verify-out/
node scripts/layout-check.mjs    # overlap/off-screen/popup-fit check at 844x390, 932x430, 667x375
node scripts/viewport-check.mjs  # viewport-only browser check
```
`test/guardrails.test.js` covers: no emoji, shared popup, palette tokens/ratchet, primary-button token, sprite sync
and icon coverage, version agreement. `scripts/layout-check.mjs` checks overlap/covered/off-screen controls, popup fit,
world-label and notice overlap, and canvas full-bleed at all three viewport sizes.

## Versioning
Each PR bumps the version once and everywhere with the same number: every `?v=X.Y.Z` tag (`index.html`,
`nodspel/index.html`, `nodspel/*.js` imports), `APP_VERSION` in `app.js`, and `package.json`. The guardrails test fails on a mismatch.
Bump `SAVE_VERSION` only when the save shape changes.

## Art and assets
Originals live in `assets/reference/` (never overwrite); `tools/add-art.py` derives the `.webp` the game loads.
Image pipeline details: `docs/art-pipeline-and-legacy-guide.md`. Art direction: `docs/art-direction.md` (enclosed Cold-War bunker hub, dark teal/navy, cyan UI accents, warm orange light,
BIT = square CRT smiley, no national flags). Wire new art through `data/*.js` hooks, then bump the version.

## Workflow
- Claude Code (`claude -p`) does ALL implementation, debugging and small fixes. Codex (`codex exec`) reviews diffs
  read-only before merge — it does not edit code. The orchestrating assistant (Grok Bot) only plans scoped prompts,
  verifies (`npm run verify`, CI, screenshots), merges and updates Linear — and must keep its own token usage minimal
  (scoped context, no reading large files unnecessarily). Grok Bot falls back to doing work itself only when Claude
  or Codex hit limits, and it must say so when that happens.
- Before anything ships, run the QA gate: `/workspace/qa.sh` (runs `npm test`, `nodspel` tests, `layout-check`, and a
  smoke playthrough end to end). Don't merge on a QA gate that hasn't gone green.
- Use `/workspace/progress-shot.sh "<short desc>"` to capture a screenshot of the current state into
  `/workspace/prp-progress` whenever a change is worth showing, not just at the end.
- One PR per change. Merge only when CI is green. Never force-push. Never commit `node_modules`.

## Future backend (not built yet)
Cloudflare Workers + D1 (DB) + R2 (asset storage), with Better Auth and an anonymous-start flow
(play before creating an account). Nothing in the current codebase assumes a backend exists yet —
don't build against it speculatively.

## Model policy (Robert, Oct 25)
- `claude -p`: use the default model (Sonnet). Use `--model opus` only for hard tasks (complex debugging, large refactors, tricky game logic).
- `codex exec`: use a lighter model (e.g. `-m gpt-6-luna`) for simple tasks (small CSS fixes, docs, quick reviews); default model (gpt-6.1-sol) for non-trivial reviews and implementation.
