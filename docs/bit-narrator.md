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
| `core_restored` (cutscene) | `app.js` `A.build("rebirth_core")`, first Core L1 | "Power… I can feel my circuits again." | happy |
| `first_death` (cutscene) | `app.js` `maybeShowFirstDeathCard`, first ordinary-raid death ingest | "I dragged you back. Don't make it a habit." | worried |

## Mini cutscenes

`ui/bit-cutscene.js` + `ui/bit-cutscene.css` provide a silent full-bleed narrative gate using the
cold-open visual language. They load on the base page only:

```js
const beat = { id, from, to, line, onDone };
window.PRBitCutscene.preload(beat); // warm just this pair before the trigger
window.PRBitCutscene.play(beat);    // queue until the base is clear
window.PRBitCutscene.dismiss();
window.PRBitCutscene.isOpen();
```

The helper deduplicates in-flight ids, waits for landscape on the base screen, intro/splash/popups (including Settings), cards and
active BIT speech, and rechecks blockers after loading. It does not persist or request VO.
Image errors or a 3-second load timeout show the line over the dark gradient instead.

The scene pushes from scale 1 to 1.06 over 6 seconds, crossfades at 3.15 seconds (45% of its
7-second duration), reveals the line with the crossfade, and shows TAP TO CONTINUE after
1.5 seconds. Tap anywhere, the focused continue button, or Escape dismisses; otherwise it
auto-ends at 7 seconds and fades back over 350 ms. Focus returns to the previous control.
Reduced motion removes push-in and fades, shows the line immediately and cuts instantly
between frames at the same midpoint. The art covers the entire viewport; only copy respects
safe insets, with at least 15 px text and a scrim/shadow.

`app.js` defines `BIT_CUTSCENES`:

- `core_restored`: `cutscene-core-restore-start-v1.webp` to
  `cutscene-core-restore-end-v1.webp`. Preload at bunkerwake start; play after the boot payoff
  closes and at least 1.6 seconds of lighting have elapsed.
- `first_death`: `cutscene-first-death-sad-v1.webp` to
  `cutscene-first-death-happy-v1.webp`. Preload/play after loss/homecoming dismissal.

These replace the two cards. Both reuse `S.bitCardsSeen` and its existing migration: players
who already saw a card, built Core L1, or had a prior death do not get the cutscene retroactively.
The first-material raid card remains happy. No other base card callers currently remain.

To add a cutscene, obtain owner approval for the moment/art, add its pair and line to
`BIT_CUTSCENES`, preload just before the trigger and call `play()` from that actual transition.
Use a stable seen id guarded and saved by the caller; back-fill existing saves when appropriate.
Do not also show a card for the same beat. Extend `test/bit-cutscene.test.js` for helper behavior
and the feature's trigger tests for once-only persistence. Capture early and late frames at
844x390, 667x375 and 932x430; assert full viewport coverage and safe copy placement.
