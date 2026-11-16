# BIT narrator card

## Design rule (PRB-162, Robert's playtest 2026-11-16): BIT introduces every system first

**BIT ALWAYS introduces every new system/concept (rooms, quests, crafting, vault, power, materials)
before it is shown or unlocked. No UI element appears unexplained.** Any new unlockable room, chip,
badge or mechanic must play (or have already played) a BIT narrator moment -- the shared layout below,
not an invented one-off -- before the player can see or use it. See
[docs/ftue-design.md](ftue-design.md) §0 for the standing rule and
[the systems-first backlog](#systems-first-backlog-prb-162-audit-2026-11-16) below for the current
audit. Guarded by bug-lint rule `bit-introduces-systems-first` (`scripts/bug-lint.mjs`,
[docs/bug-lint.md](bug-lint.md)).

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
- `duration`: base auto-dismiss time in ms, default 3000, extended by 40ms per character over 50
  and capped at 6000ms total. **Raid only** (PRB-158): the base card ignores `duration` entirely
  and holds until tapped -- see "Hold until tap" below.
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
| `fabricator_built` (cutscene) | `app.js` `A.build("fabricator")`, first Fabricator L1 | "Fabricator's humming. Bring me raid scrap and I'll make you gear — starting with a Scavenger Vest." (+ a live shortage clause and a HAVE/NEED info row when the Vest recipe is short, PRB-162) | happy |
| `raid_briefing` (cutscene, PRB-162) | `app.js` `maybeShowRaidBriefing`, first base visit with the Fabricator still locked, after `core_restored` | "Bunker's barely breathing. I need Cable, Scrap Alloy and Scrap to wake the Fabricator — raid for them. I'd go myself, but I don't have legs." | skeptical |
| `quest_intro` (cutscene, PRB-162) | `app.js` `maybeShowQuestIntro`, before the tracked-quest chip (`trackedGoalHtml`) can ever render | "Quests: little jobs, real rewards. Finish one, I pay up. The quest chip tracks progress — tap it any time for the fine print." | smile |
| `vault_intro` (cutscene, PRB-162) | `app.js` `maybeShowVaultIntro`, before the Vault is ever the build target or built | "The Vault adds stash space and secures one chosen raid item against death. I used to store feelings here. Now it's scrap." | smile |

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

The scene pushes from scale 1 to 1.06 over 6 seconds and crossfades at 3.15 seconds, popping in
the bubble (+ bust, if any) with the crossfade and sliding in the info strip (if any) ~0.6s
later. It holds until the player dismisses it -- see "Hold until tap" below -- and fades back
over 350 ms when they do. Focus returns to the previous control. Reduced motion removes push-in
and fades and shows the bubble, bust and info strip immediately, cutting instantly between
frames at the same midpoint. The art covers the entire viewport; only copy respects safe insets,
with a scrim/shadow. Standard copy starts at 15 px; Fabricator uses 12–16 px to keep its longer
speech in the calm lower area on the smallest landscape viewport.

### Hold until tap (PRB-158)

Robert's playtest of the Fabricator cutscene: "the Fabricator box doesn't stay long enough. Keep
it until I want to continue, and TAP TO CONTINUE can appear after ~3 s." Both components now
hold until the player dismisses them, with no fixed-timeout auto-end:

- **Mini cutscenes** (`ui/bit-cutscene.js`): no auto-end timer exists at all. TAP TO CONTINUE
  fades in (0.4s) at ~3 seconds (was 1.5s). A tap anywhere, Escape, or the continue button
  (including its native Enter/Space keyboard activation, since focus lands there on open)
  dismisses -- but only after a one-second guard (`run.locked`) first: anything in that first
  second is ignored, so a reflexive tap right as the scene opens cannot skip it by accident.
- **Base cards** (`ui/bit-card.js`): the same change, the same way -- no auto-dismiss `timer`,
  the same one-second guard (`current.locked`), and a TAP TO CONTINUE hint (`.bit-card-hint`)
  that fades in at ~3 seconds.
- **Raid cards are the one deliberate exception.** `present()` branches on `isRaidPage()`
  (presence of nodspel's `#viewport`): the raid card keeps its old timed, non-blocking
  auto-dismiss (`duration`/`computeDuration()`) with no tap guard and no hint. Rationale: the
  player is mid-combat when a raid card appears (e.g. a first-seen material pickup); a card that
  could only be cleared by a dedicated tap would compete with movement/aim input for attention,
  while the existing self-clearing behavior never blocks anything. This is a deliberate
  product/UX decision, not an oversight -- see `docs/design-decisions.md` (2026-11-15, PRB-158).
- **Reduced motion** shows the hint immediately rather than fading it in at ~3s (the existing
  convention this component already used for the bubble/bust/info strip) but still observes the
  one-second tap guard and still never auto-advances.

Guarded by `narrator-holds-until-tap` in `scripts/bug-lint.mjs` (no auto-end timer for the base
moments, the one-second guard present in both components) plus the updated hold-timing/tap-guard
regressions in `test/bit-cutscene.test.js` and `test/bit-card.test.js` (including the
base/raid split).

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
- `fabricator_built` (PRB-157): dedicated `cutscene-fabricator-dark-v1.webp` →
  `cutscene-fabricator-powered-v1.webp`, with the same 3.15s crossfade and slow push-in as Core.
  `effect:null` keeps the painted vest unobscured: no hologram, spark or sweep overlays.
  The pair and happy bust warm through the renderer's shared image cache at startup while
  Fabricator L1 is pending, with affordability/build hooks as additional entry points. Playback
  uses the shipped URLs immediately while warming is pending (`waitForArt:true`); slow loading
  neither holds the story behind a three-second probe nor selects the placeholder. Actual image
  errors use the existing powered-Core safety backdrop; errors detected before the beat select
  the older effect fallback. Each displayed image also has a non-looping error fallback.
  Play after the ordinary Fabricator L1 reward popup closes and bunkerwake (~1.6s) finishes.
  Bust: happy, left, retained for consistency with Core/death. A shorter lower speech bubble
  clears the painted BIT and vest; info stays top-right. `PRBitCutscene.geometry` records their
  normalized bounds in the 1600×720 source; `paintedRect()` projects them through centred
  object-fit cover and the current push-in transform for screenshot assertions.
  Info: NEW is fixed flavor copy ("Craft gear from raid materials"); FIRST RECIPE names the
  real commissioning recipe (`fabricatorFirstRecipe()`, joining `data/modules.js`'s commissioning
  gift to `data/recipes.js`'s output item) with its real cost (`recipeCostText`).

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

PRB-155's reproducible capture harness is `scripts/narrator-cutscene-shots.mjs`. Run it with
`NODE_PATH=/workspace/pptr/node_modules CHROME_PATH=/usr/bin/google-chrome node scripts/narrator-cutscene-shots.mjs`.
It serves the unchanged `/workspace/prp-before-main` baseline and this worktree, drives the real
Core/Fabricator build and death-return triggers, and captures all three landscape sizes with
47/47/0/21 safe insets. PNGs and `results.json` go to `/workspace/prp-narrator-cs-v22834-shots/`.
`AFTER_ONLY=1` refreshes current captures and writes `after-results.json`. Assertions cover full
bleed, safe copy/bust/strip bounds, no popup/card stacking, text/hologram separation, runtime
errors, and immediately visible content without transitions under reduced motion.

For PRB-157's six dedicated Fabricator captures, run the same command with `FAB_ONLY=1`.
It writes `fab-early-<width>x<height>.png` (dark, before crossfade),
`fab-late-<width>x<height>.png` (powered, readable bubble and strip), and `after-results.json`
to `/workspace/prp-fab-art-v22836-shots/`. The live transformed stage rect drives painted-BIT
and vest overlap assertions against bubble, bust and strip at every late frame.


### Instant presentation (PRB-160, 2026-11-15)

Story triggers append the cutscene synchronously as soon as the base UI is clear. Core restore
and the Fabricator reward close no longer wait for the 1.6-second bunker lighting animation.
First death uses the same immediate path after its summary closes. Existing BIT voice playback
continues; audio never blocks the visual and no audio implementation was changed.

During the splash and at base entry, the warm cache requests cold-open images first (when the
intro is unseen), then unseen Core, first-death and Fabricator backdrops and busts, including the
Fabricator safety backdrop. Cold-open URLs include the intro's exact APP_VERSION query. Each
image is loaded and decoded with img.decode(), and its Image object stays referenced until its
scene is dismissed. Shared art stays retained for other unseen scenes. Seen scenes are skipped.

Presentation never waits for this cache. Cold images load and fade in over the scrim and readable
line; dedicated Fabricator art is replaced only after a real load error. Overlay and BIT-card
closes dispatch pr:ui-clear for immediate queue advancement; a requestAnimationFrame retry
(50ms timer fallback) catches other blockers clearing. The splash-to-intro path already paints
the intro underneath the splash; its intentional entrance animation and line-by-line reveals stay.

Run node scripts/cutscene-latency.mjs for real-trigger CPU-throttled browser measurements and
50ms screenshots, and npm run test:bit-cutscene for deterministic loading/decoding regressions.

Popup cancellation preserves the Fabricator/first-death story callback when navigation or Profiles
replaces the reward/summary, while unrelated popup close actions remain cancelled. The cache's
isWarm(id) query lets the benchmark observe production decoding without holding harness Images
on AFTER. BEFORE is manually warmed to isolate the old waits. Three fresh-browser trials at each
viewport report medians and retain raw timings; cold-open timing requires the real splash finish.

Use node scripts/cutscene-latency.mjs --screenshots-only for a separate early-frame capture pass.
It requests Core/Fabricator screenshots near 50ms without perturbing the benchmark trials,
and records actual screenshot request times in shot-times.json beside latency.json.

## Systems-first backlog (PRB-162 audit, 2026-11-16)

Audit against the design rule above, current as of this PR. Not a build list -- most gaps below
are intentionally left open; pick them up as their own small PRs when the system matters enough to
explain, following "Adding a new BIT card moment" above.

**Already had a BIT intro before this PR:**

| System | Moment |
| --- | --- |
| Rebirth Core / emergency power | `core_restored` cutscene |
| Fabricator / crafting | `fabricator_built` cutscene |
| Death consequence (what you lose/keep) | `first_death` cutscene |
| Raid materials (first-ever pickup of each) | `mat:<item>` card (`nodspel/loot-value.js`) |

**Added in this PR (PRB-162):**

| System | Moment |
| --- | --- |
| Raid / the RAID button, while the Fabricator is still locked | `raid_briefing` cutscene |
| Quests (what they are, why, the tracked chip) | `quest_intro` cutscene, gates the chip (`trackedGoalHtml`) |
| Vault / Storage (stash expansion, the secure slot) | `vault_intro` cutscene, gates "next goal"/build |
| Scavenger Vest craft shortage (materials you don't have yet) | shortage clause + HAVE/NEED row on `fabricator_built`, live from the stash |

**Remaining gaps (backlog, not built here):**

| System | Where it currently appears unexplained | Priority note |
| --- | --- | --- |
| BIT Bay coming online | Reward popup + `bitDock("bond_up")` line only, no narrator moment | High -- next FTUE beat after the Vault/quests |
| World map areas (Archipelago, Town) + scouting charts | World map unlock badge only | Medium -- bigger than a one-liner, needs its own design pass |
| Contract Chips / BIT trader catalog | Chip shop UI, no intro | Medium |
| BIT Talents (Bond tree) | Talents tab, no intro | Medium |
| Gear merge / upgrade / mastery | Gear popups explain themselves inline, no BIT framing | Low |
| Bunker power as its own concept (brownouts, `roomPowered`) | Contextual `bitDock("energy_critical")` line only, not a one-time explainer | Low -- already has a contextual line, just not a first-time card |
| Idle scavenging / expeditions while away | Scavenge popup, no intro | Low |
| Daily quests | Quest log "daily" tab, no intro | Low |
| Living Quarters / rest buff | Room unlock only | Low -- late-game room, not yet reachable in the scripted spine |

PRB-162 completion details: `queueSystemIntro` deduplicates pending intros and saves `false` until
its dismissal callback marks the scene seen. Reloading a queued intro does not migrate it away.
The quest dismissal refreshes the chip immediately; a Vault build cannot spend materials before
its intro has been dismissed. All three use the existing one-second guard and three-second hint.
The vest offer's HAVE/NEED row includes every recipe cost and a compact generated cache location
for each missing material. Craft list shows full generated loot-source hints; confirmation uses compact generated cache labels so its actions fit landscape.
Each real raid launch recalculates the shortage, including Scrap represented by existing salvage
crates. Units are grouped in ordinary level-one caches using `quantity` / `contents`; no extra
cache, no replacement of a quest/key/scout supply, and no free stash grant. A death leaves the
shortage to be guaranteed again; extracting enough stops the guarantee.


## Two-stage room unlock standard

Every room introduction has two distinct stages, supplied by `DATA.roomUnlockStages` and
`roomUnlockStages(id)`. The teaser plays when the room becomes the next goal: hold the dark
image, give BIT a short introduction, and show NEXT with the real module cost plus missing
part sources. A teaser never blocks a valid build. On the first actual build, the unlock
uses that same dark image and morphs to the powered/open image; BIT explains the payoff and
NEW names the real L1 benefits. Never show the powered room at the teaser stage.

Each room requires a matched dark/powered art pair, teaser/unlock scene IDs, BIT lines, and
strips derived from module/recipe data. Fabricator (`raid_briefing`, `fabricator_built`) and
Vault (`vault_intro`, `vault_unlocked`) implement this pattern. Other rooms are backlog.
Fabricator keeps its existing lines and live vest HAVE/NEED strip. Vault builds immediately;
if its teaser was missed, the unlock is sufficient. Any already queued teaser stays ahead
of the unlock in the single held narrator queue. No stacked popups. Existing built Vaults
migrate both stages as seen; an old `vault_intro` on an unbuilt Vault counts only as teaser.
Art still warms through the shared cache; each scene holds until tap and hints at 3 seconds.

The first NEW FIND popup includes BIT's bust and speech bubble inside the shared overlay,
explaining Used for once. Later finds use the compact item card alone. The next progression
goal leads, then a tracked quest or affordable recipe, then general uses; additional uses
start collapsed. Sell/Recycle values remain visible. Old saves with an already seen find
skip the explanation; items still queued for their first popup do not count as seen.
