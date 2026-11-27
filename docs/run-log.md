# Raid run log (PR 0)

Why this exists: Robert runs external playtests of the Depth Raid (`nodspel/depth-raid.js`) and the
FTUE on real devices, with no backend yet and no paid analytics tool. This is the smallest thing that
gets measurable data out of a playtest session: every raid writes one compact JSON record to the
device's `localStorage`, and the raid result screen has a quiet button to copy all of it out.

No network call of any kind is involved -- storage only, same device, same browser. See
`nodspel/run-log.js` (the pure module) and `scripts/bug-lint.mjs`'s `run-log-no-network` rule, which
fails the build if `fetch(`/`XMLHttpRequest`/`sendBeacon(`/`WebSocket` ever creep into that file.

## How to get the data off a device

1. Play one or more raids (Depth Raid or Node Raid, either mode is logged).
2. On the raid result screen, open **Raid details** (bottom-right link), then tap **COPY RUN LOG**.
   The button reads **COPIED** for two seconds once the clipboard write succeeds.
3. Paste the clipboard contents (a JSON array of every stored raid, oldest first, up to the last 20)
   into a message/doc/file to send back.

If clipboard access is blocked (older browser, no secure context), the button falls back to
selecting a hidden textarea and running the browser's copy command -- same two-second confirmation.

Debug-only, `?debug=1`: `window.PR_RUNLOG.get()` returns the same array in the console, and
`window.PR_RUNLOG.clear()` wipes it (useful for starting a clean session before a playtest).

## What's recorded, per raid

```
{
  "v": "2.28.77",            // app version at the time of the raid
  "raidId": "<seed>",         // also used as the raid identifier
  "seed": "<seed>",
  "mode": "depth" | "node",
  "ftue": false,               // true only for the guided first-ever raid
  "area": "bunker",
  "device": {"w":932,"h":430,"dpr":2,"touch":true,"ua":"ios"|"android"|"desktop"},
  "events": [ ... ],           // timeline, capped at 200 entries
  "idleGaps": 3,                // internal running count; also copied into totals below
  "totals": {
    "outcome": "extracted" | "died" | "timeout" | "abandoned",
    "durationMs": 182340,
    "zonesReached": 2,
    "enemiesKilled": 11,
    "shotsFired": 48,
    "shotsHit": 21,
    "damageTaken": 76,
    "lootValue": 120,
    "idleGaps": 3
  }
}
```

`device.ua` is a coarse bucket (ios/android/desktop), never the raw `navigator.userAgent` string.

### Timeline events

Every event has `t` (milliseconds since the raid started, on the game clock -- paused time, like the
pause menu, is excluded) and a `type`. At most 200 events are kept per
raid; once a raid hits that cap, later events in that raid are silently dropped (the totals at the end
are unaffected -- they come from separate counters, not from counting events).

| type | fields | fires when |
|---|---|---|
| `first_move` | - | the player has moved more than 0.5 m total, the first time |
| `first_shot` | - | the first shot is fired |
| `first_hit` | - | the first shot (or thrown tool) actually lands on an enemy |
| `first_kill` | - | the first enemy dies |
| `area_entered` | `zone` | the player enters a Depth Raid zone (including zone 1, at `t:0`) |
| `area_cleared` | `zone`, `ms` | a zone's enemies are all down, opening its door and spawning the clear cache; `ms` is how long that zone took to clear, not the raid-wide timestamp (that's `t`) |
| `door_passed` | `zone`, `how` | the player leaves a zone through its door -- `how:"clear"`, `how:"hack"`, or `how:"key"` records what opened it. Walking through is the choice; combat never pauses. |
| `choice` | `zone`, `kind` | the player completes the beam hold (`"extract"`) or walks through the open door (`"deeper"`) |
| `hack_start` | `zone` | the player steps onto the terminal pad; nearby enemies are alerted |
| `hack_done` | `zone` | the hold reaches its configured duration and opens the door |
| `extract` | `zone`, `cleared` | the player successfully extracts; `cleared:false` means early extraction with the bag kept and no clear bonuses |
| `death` | `cause`, `zone` | the raid ends in death; `cause` is the last hit's source and attack type |
| `timeout` | - | the area clock (Depth) or raid clock (Node) runs out |
| `loot_collected` | `item`, `rarity`, `value` | an item is added to the bag (not gear/weapon offers, which are a separate choice, not an automatic pickup) |
| `pause_open` | - | the settings/pause menu opens (an actual pause of the raid clock) |

### Totals, and the questions they answer

- **Time to first move/shot/kill** -- the `first_*` event timestamps. A new player who takes a long
  time to make their first move is a tutorial/clarity problem, not a difficulty one.
- **Area clear times** -- `area_cleared`'s `ms` field, zone by zone.
- **Extract vs. deeper** -- the `choice` events: do players push on, or bank what they have?
- **Death causes** -- the `death` event's `cause` (e.g. `"Sentry projectile"`), and which `zone`.
- **Accuracy** -- `shotsHit / shotsFired` from totals (`shotsHit` also counts thrown-tool hits that
  land, e.g. grenades, since both go through the same on-hit feedback path game.mjs already has).
- **Idle/confusion** -- `idleGaps`: how many times the player went more than 8 seconds without moving
  or shooting, including a trailing gap if the raid ends on one. High idle counts in the FTUE usually
  mean the player got stuck or didn't understand what to do next.

## Persistence

Stored under the `pr_runlog_v1` `localStorage` key, as an array of raids, oldest first, capped to the
last 20 -- old raids roll off automatically. All storage access is wrapped in `try`/`catch`, so a full
quota or a browser in private-mode storage never breaks the raid (it just silently fails to persist that
one raid). This key is independent of the game's save (`SAVE_VERSION`/`pr_meta_save`) and is never read
by gameplay -- it's write-mostly, for Robert to pull later.
