# BIT narrator card

PRB-151 (2026-11-14, Robert): BIT narrates everywhere, like the Villager in Clash of Clans. One
shared component — `ui/bit-card.js` + `ui/bit-card.css` — is reused by both the base page
(`index.html`/`app.js`) and the raid page (`nodspel/index.html` + `game.mjs`). It is NOT a toast and
NOT the existing `#bitdock` line; it is a small corner card with BIT's face, a one-line speech
bubble, and a mood.

Read [docs/bit-character-spec.md](bit-character-spec.md) (BIT IDENTITY LOCK) before touching
anything here. PRB-153 (Robert, 2026-11-14) approves the shipped narrator busts in
`assets/production/bit-narrator/` as a card/cutscene-only exception to #248. They are used as-is,
without recoloring or brightness mood filters. The cold open, HUD and 3D BIT keep #248.

| Mood | Bust filename |
| --- | --- |
| happy | `bust-tilt-happy-v1.webp` |
| sad / worried | `bust-tilt-sad-v1.webp` |
| smile / calm / unknown | `bust-tilt-smile-v1.webp` |
| skeptical / tired | `bust-tilt-skeptical-v1.webp` |

The four busts preload only on the first actual card presentation. Busts are 60 px at normal
landscape widths and 52 px at widths up to 700 px. Body tilt and subtle hover remain, with
animation disabled for reduced motion. Raid asset paths retain the `../` prefix.

## API

```js
window.PRBitCard.show({ id, text, mood, duration, onDone });
window.PRBitCard.dismiss();   // force-dismiss whatever is currently showing
window.PRBitCard.isOpen();    // true while a card is visible
```

- `id` (required): a stable string for this moment. The component only uses it to avoid double-
  queueing the same call while it is already current or queued — it does **not** persist
  anything itself.
- `text` (required): one line, ideally under ~90 characters so it fits 2 lines at 667×375 and
  13px+ type.
- `mood`: see the map above; default `"smile"`.
- `duration`: base auto-dismiss time in ms, default 3000. The component extends this by 40ms per
  character over 50, capped at 6000ms total, so longer lines stay readable.
- `onDone`: called once the card is dismissed (auto or manual), before the next queued card plays.

Only one card shows at a time. Further `show()` calls while one is up queue (max 4) and play in
order. `show()` is a no-op while the cold open/intro, the splash, a cutscene, or a popup/overlay is open — on
the base page the call queues until clear; on the raid page (detected by the presence of
nodspel's `#viewport` element) a blocked call is dropped instead, since raid dialogs (pause,
round-over, bag) are short-lived and the moment is no longer meaningful by the time they close.

## Persistence is the caller's job

The component never writes to a save or to `localStorage` itself — that way the same card helper
works for a one-time base narrative beat and a per-session raid hint without baking in either
policy. Each caller picks whatever persistence fits:

- **Base** (`app.js`): one-time moments add a key to the additive `S.bitCardsSeen` object (no
  `SAVE_VERSION` bump — follow the existing pattern in `migrateCableRetro`/`migrateAreaSeen`).
  Guard the call with `if(!S.bitCardsSeen.<id>){ S.bitCardsSeen.<id> = true; save(); PRBitCard.show(...); }`.
  If the moment can already have happened in the past for an existing save (e.g. a module already
  built, a counter already above zero), back-fill `S.bitCardsSeen.<id> = true` in
  `migrateBitCardsSeen` so the card never fires retroactively just because a save loaded — only a
  live transition should ever show it.
- **Raid materials** (`nodspel/loot-value.js`): the existing `nr_seen_materials_v1` localStorage
  key (`hasSeenMaterial`/`markMaterialSeen`) already tracks first-ever pickups per device; reuse
  it rather than adding a second seen-list.

## Adding a new BIT card moment

1. Decide the `id`, the line (one short sentence, in BIT's voice, no leading `"BIT: "` — the card
   already shows BIT's face so the prefix would repeat it), and the `mood`.
2. Pick the persistence mechanism above and write the one-time guard around the `show()` call.
3. Call `window.PRBitCard?.show({ id, text, mood })` from the real gameplay moment — not from a
   generic render/tick function, so it only ever fires on the actual trigger.
4. If this is a base moment that could already be true for existing saves, add the retroactive
   back-fill to `migrateBitCardsSeen`.
5. Add a test: component-level behaviour belongs in `test/bit-card.test.js`; a new moment's own
   trigger/persistence belongs next to the feature it's attached to (see how
   `nodspel/tests/pickup-toast.test.mjs` and `test/bit-card.test.js` cover the three existing
   moments).
6. Screenshot it at 844×390 and 667×375 and confirm the card is inside the viewport and clear of
   the RAID button / goal card (base) or the joystick / fire buttons (raid) — see
   `/workspace/prp-bit-card-v22830-shots/shot.mjs` for the harness pattern.

## Current moments

| id | Where | Line | Mood |
| --- | --- | --- | --- |
| `mat:<item>` | `nodspel/game.mjs` `pickupToast` | first-ever pickup of that material (`nodspel/loot-value.js` `materialPickupBitLine`, "BIT: " prefix stripped) | happy |
| `core_restored` (cutscene) | `app.js` `A.build("rebirth_core")`, first Core L1 | "Power… I can feel my circuits again. Also my toes. I don't have toes." | happy |
| `first_death` (cutscene) | `app.js` `maybeShowFirstDeathCard`, first ordinary-raid death ingest | "I dragged you back. Don't make it a habit." | sad → happy |
| `fabricator_built` (cutscene) | `app.js` `A.build("fabricator")`, first Fabricator L1 | "Fabricator's humming. Bring me raid scrap and I'll make you gear — starting with a Scavenger Vest." | happy |

## Mini cutscenes

`ui/bit-cutscene.js` + `ui/bit-cutscene.css` provide a silent full-bleed narrative gate using the
cold-open visual language. They load on the base page only:

```js
const beat = { id, from, to, line, onDone, bust, info, effect, hologramIcon };
window.PRBitCutscene.preload(beat); // warm just this pair (+ bust pair, if any) before the trigger
window.PRBitCutscene.play(beat);    // queue until the base is clear
window.PRBitCutscene.dismiss();
window.PRBitCutscene.isOpen();
```

The helper deduplicates in-flight ids, waits for landscape on the base screen, intro/splash/popups (including Settings), cards and
active BIT speech, and rechecks blockers after loading. It does not persist or request VO.
Image errors or a 3-second load timeout show the line over the dark gradient instead.

The scene pushes from scale 1 to 1.06 over 6 seconds, crossfades at 3.15 seconds (45% of its
7-second duration), pops in the bubble (+ bust, if any) with the crossfade, slides in the info
strip (if any) ~0.6s later, and shows TAP TO CONTINUE after 1.5 seconds. Tap anywhere, the
focused continue button, or Escape dismisses; otherwise it auto-ends at 7 seconds and fades back
over 350 ms. Focus returns to the previous control. Reduced motion removes push-in and fades and
shows the bubble, bust and info strip immediately, cutting instantly between frames at the same
midpoint. The art covers the entire viewport; only copy respects safe insets, with at least 15 px
text and a scrim/shadow.

### Standard narrator-cutscene layout (PRB-155)

Every moment below uses the same layout -- `play()`'s optional `bust`/`info`/`effect` fields,
not a one-off per moment:

- **`bust`** `{ from, to, side }`: BIT's mood bust (`assets/production/bit-narrator/bust-tilt-*-v1.webp`,
  same four moods as the card, see the table in [BIT narrator card](#bit-narrator-card) above)
  anchored bottom-left or bottom-right (`side:"left"|"right"`, default left). Replaces the plain
  lower-left line with a speech bubble holding it. `to` is optional -- omit it (or repeat `from`)
  for a static bust; set a different `to` for a mood swap that crossfades with the backdrop (e.g.
  `first_death`'s sad → happy).
- **`info`** `[{ label, text, iconHtml }, ...]` (1-2 rows): a compact strip opposite the bust
  (top-right, clear of the bubble). `label` is a short all-caps tag ("NEW", "NEXT", "LOST",
  "KEPT", "FIRST RECIPE"...); `iconHtml` is caller-rendered trusted HTML (`IC(...)`/`itemIcon(...)`
  from `app.js`) so the component stays ignorant of game data. **Every row's `text` must name a
  real cost or benefit read from `data/*.js` at the trigger** (`costStripText`/`costStripIcons` for
  a module cost, `recipeCostText`/`recipeCostIcons` for a recipe) -- never a hand-typed number, so
  a balance change can't drift out of sync with the copy. A fixed design rule (not a data lookup,
  e.g. `first_death`'s LOST/KEPT) can be a literal string instead, but must still describe the real
  rule (see `docs/design-decisions.md` / `AGENTS.md`'s locked decisions), not an invented one.
- **`effect`** (optional string, e.g. `"fabricator"`) + **`hologramIcon`** (trusted HTML, an
  existing item icon): adds a CSS light sweep + spark particles + a clip-path "assembling"
  hologram outline over the backdrop, timed off the same crossfade. Use only when there's no
  dedicated art for the moment yet (option (b) below) -- it's a decoration, not a data value, so
  it needs no lookup.

All of it is backward compatible: a `play()` call with none of `bust`/`info`/`effect` renders
exactly as the original plain-line cutscene did.

`app.js` defines `BIT_CUTSCENES`:

- `core_restored`: `cutscene-core-restore-start-v1.webp` to `cutscene-core-restore-end-v1.webp`.
  Preload at bunkerwake start; play after the bunkerwake lighting (~1.6s) -- there is no popup to
  wait on, the cutscene is the single screen for the Core restore (PRB-155, v2.28.33; see
  `docs/bug-lint.md`'s `core-restore-no-power-popup`). Bust: happy, left. Info: NEW names
  `MODS.rebirth_core.benefit`; NEXT names the Fabricator's real L1 cost
  (`MODS.fabricator.levels[0].cost`).
- `first_death`: `cutscene-first-death-sad-v1.webp` to `cutscene-first-death-happy-v1.webp`.
  Preload/play after loss/homecoming dismissal. Bust: sad → happy, right (matches the backdrop's
  own sad → happy crossfade). Info: LOST/KEPT name the locked death rule (`AGENTS.md`: dying in a
  raid loses everything currently carried; the stash and buildings are untouched).
- `fabricator_built`: no dedicated art pair exists yet, so it reuses
  `cutscene-core-restore-end-v1.webp` for both frames with `effect:"fabricator"` (CSS sweep/sparks
  + a hologram outline of the real first recipe's item icon) -- option (b) from the PRB-155 task.
  `FABRICATOR_CUTSCENE_ART` names an optional future dedicated pair
  (`cutscene-fabricator-dark-v1.webp` → `cutscene-fabricator-powered-v1.webp`); `app.js` probes
  both with an `Image` `onerror` check *only when the moment actually triggers* (never a blind
  fetch on every page load) and uses them instead of the fallback once both exist. Preload/play
  after the Fabricator L1 reward popup closes (the ordinary module-build popup; unlike the Core
  restore, Fabricator keeps it) and the bunkerwake build animation (~1.6s) finishes. Bust: happy,
  left. Info: NEW is fixed flavor copy ("Craft gear from raid materials"); FIRST RECIPE names the
  real recipe tied to the module's own commissioning gift (`fabricatorFirstRecipe()` --
  `data/modules.js`'s `MODS.fabricator.levels[0].commissioning` matched against
  `data/recipes.js`'s `output.itemId`, so the two can never name different gear) with its real
  cost (`recipeCostText`).

These replace the moments' old cards. All three reuse `S.bitCardsSeen` and its existing migration
(`migrateBitCardsSeen`): players who already saw a card, built Core L1, built Fabricator L1, or had
a prior death do not get the cutscene retroactively. The first-material raid card remains happy.
No other base card callers currently remain.

To add a cutscene, obtain owner approval for the moment/art, add its entry (pair, line, and the
`bust`/`info`/`effect` fields above) to `BIT_CUTSCENES`, preload just before the trigger and call
`play()` from that actual transition -- never stack it with another popup/card/cutscene; let the
component's own queueing (it already waits for `#overlay`/cards/intro/splash) handle that, the
same way `fabricator_built` waits behind its module's ordinary reward popup. Use a stable seen id
guarded and saved by the caller; back-fill existing saves when appropriate (`migrateBitCardsSeen`).
Do not also show a card for the same beat. Extend `test/bit-cutscene.test.js` for helper/layout
behavior and the feature's own test file for once-only persistence (see `test/bit-card.test.js`'s
"base moments" section for the pattern: live trigger, existing-save migration, never-replays, and
-- when the moment used to carry a gating popup -- that no popup shows at all). Capture early and
late frames at 844x390, 667x375 and 932x430; assert full viewport coverage, safe copy placement,
and no overlap between the bubble and the info strip.
