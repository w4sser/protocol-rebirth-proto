# Enemy model mapping (v2.20.0)

Every enemy type/encounter the raid can actually spawn — `nodspel/levels.js` `RULES.enemyTypes` (grunt,
rusher, sentry, thrower), `nodspel/encounters.js` (guard, grenadier, turret, patrol, swarm, shield,
shield_turret), and `nodspel/stakes.js` hunter waves — now resolves to one of the 8 archetype GLBs in
`assets/enemies/` via `ENEMY_VISUALS`/`visualFor()` in `nodspel/enemies.js`. The procedural box mesh stays
as the fallback for every enemy (`nodspel/enemy-models.js` returns it on any load failure/timeout); nothing
here changes gameplay (health, speed, cooldowns, damage) — only what gets drawn.

## Resolution order (`visualFor(enemy)`, nodspel/enemies.js)

1. `enemy.type==='generator'` → no visual (see "Generator" below).
2. `enemy.encounter` is set and matches a key in `ENEMY_VISUALS` → that entry (most specific).
3. `enemy.type==='rusher' && enemy.swarm` → `swarm_bot` (covers hunter waves, which set `swarm:true` but
   no `encounter`).
4. `enemy.type` matches a key in `ENEMY_VISUALS` → that entry (the "bare" type, no encounter — these are
   the plain room-filler enemies `nodspel/levels.js` re-types from `RULES.variety[n].mix`).

## Mapping table

| Type / encounter | Archetype model | Behaviour kept | Stand-in? |
|---|---|---|---|
| `shield_turret` (encounter) | `shield_turret` | EMP-vulnerable shield (`shieldDownUntil`), burst fire, head tracks player | No — exact fit |
| `turret` (encounter, plain sentry behind cover) | `shield_turret`, `shield_arc` part hidden | Same burst fire + head tracking, no EMP shield mechanic | No — same cabinet, arc hidden so it never implies an EMP-able shield it doesn't have |
| `guard` (encounter, front-shielded grunt) | `tank` | Burst fire, head/front-armor tracks player, front-shield block arc (procedural overlay, unchanged) | **Yes, temporary** — front armor plate reads as "this side is protected"; see Missing models |
| `patrol` (encounter, sight-cone walker) | `scout` | Patrol path, sight cone (procedural floor decal, unchanged), windup telegraph | **Yes, temporary** — twin rotors read as a patrolling scanner drone; see Missing models |
| `grenadier` (encounter, thrower variant) | `artillery` | Lob telegraph ring, fuse, blast radius | No — close fit (towed mortar reads as a lobbing unit) |
| `swarm` (encounter, rusher cluster) | `swarm_bot` | Spawn-point burst, charge-free group rush | No — exact fit |
| hunter wave (`type:'rusher'`, `swarm:true`, no encounter, `nodspel/stakes.js`) | `swarm_bot` | Same as swarm — these reuse swarm's doorway-routing | No — same reasoning as swarm |
| `shield` (encounter, node generator) | — (kept as-is) | — | **No — not an enemy.** See "Generator" below |
| bare `rusher` (no encounter, `isCharger`) | `rusher` | Stalk → windup → charge lunge, wall-stun | No — exact fit |
| bare `sentry` (no encounter) | `sniper` | Long-range single shot, aim-lock telegraph | **Yes, temporary** — stationary long-reach shooter; see Missing models |
| bare `thrower` (no encounter) | `artillery` | Lob telegraph ring, fuse, blast radius | **Yes, temporary** — same reasoning as grenadier, slightly looser fit since bare throwers also reposition between throws (see Missing models) |
| bare `grunt` (no encounter) | `rusher`, scale 0.85, tint `#8a9096` (steel grey) | Basic stand-off shooter, no charge/lunge/stun animation | **Yes, temporary** — see Missing models |

Colour code is unchanged everywhere: coral = damage, blue = shield, green = heal, yellow = AoE
(`ENEMY_COLORS`, `nodspel/enemies.js`). The `grunt` stand-in's steel tint is a separate, purely cosmetic
recolour so it never reads as an actual charging rusher — it is not part of the status-effect palette and
never overrides it.

## Animation hookups (`nodspel/enemy-animation.js`)

Per-archetype idle/move, using named pivots from `assets/enemies/README.md`:

- **shield_turret / turret**: `turret_head_pivot` yaws to `enemy.facing`; `cannon` recoils on each shot of
  a burst (`attackPhase==='burst'`); `shield_arc` visibility follows `shieldDownUntil` (turret always keeps
  it hidden regardless, via `hideParts`).
- **tank** (guard): same head-track + cannon-recoil as shield_turret (`stepGuard` in `nodspel/combat.js`
  drives guard through the same burst-fire state machine).
- **rusher / grunt stand-in**: 4-leg walk-cycle swing while moving; the charge wind-up tilt, wall-stun tilt
  and `back_battery` pulse are gated on `isCharger(enemy)`, so the grunt stand-in only ever gets the plain
  walk cycle, never the lunge tell.
- **swarm_bot**: 6-leg insect-gait swing (`leg_01_pivot`..`leg_06_pivot`) while actively closing in.
- **scout** (patrol): `rotor_left_pivot`/`rotor_right_pivot` spin continuously in opposite directions.
- **artillery** (thrower/grenadier): `mortar_pivot` pitches up while `enemy.windupAt` is set (the throw's
  wind-up). The 4 `stabilizer_0N` parts are static meshes in the GLB (no `_pivot` suffix — see
  `assets/enemies/README.md`), not hinge pivots, so they are not animated.
- **sniper** (bare sentry): `barrel_pivot` gets a small continuous idle scan (it is the only real pivot on
  this model — the 3 `tripod_leg_0N` parts are likewise static meshes, not pivots, and bare sentries never
  move anyway).

## Health pips / labels

`nodspel/game.mjs`'s enemy label used a fixed `y=1.7`. It now uses `v.labelY`, computed once per attached
model in `attachEnemyModel()` from the mounted model's actual bounding-box height (archetype `scale` and
any per-visual `scale` override both applied) plus a small margin, clamped to a sane minimum. The 8
archetypes range from ~0.5m tall (`swarm_bot`) to ~1.55m (`shield_turret`), so a single constant would have
sat inside the small models and floated well above the tall ones. Falls back to `1.7` for the generator
(no GLB) and for any enemy while its model is still loading.

## Perf

- Geometry and materials stay shared across all instances of an archetype (`userData.shared=true`), as
  before — this still holds for 7 of the 8 archetypes.
- The one exception is the `grunt` stand-in's tint: giving it a different base colour than the real rusher
  requires a per-instance material clone (the same pattern already used for `shield_arc`/`back_battery`).
  Grunts are common filler enemies but each clone is cheap (a handful of `MeshStandardMaterial`s); this
  was judged an acceptable one-off cost for a temporary stand-in rather than a perf-sensitive path.
- No enemy archetype adds a `THREE.Light`; the existing "zero lights, shared geometry" test
  (`nodspel/tests/enemies.test.mjs`) now covers all 8 archetypes.

## Debug demos

- `?debug=1&enemydemo=1` is unchanged (shield_turret + rusher, bunker L1 only).
- `?debug=1&enemydemo=mixed` (new) places all 8 archetypes near the start of bunker L1's first room —
  grunt, sentry, thrower, swarm, turret, guard, patrol, rusher — for a single screenshot that shows every
  mapped model at once. Gated identically to `enemydemo=1` (both params, bunker, L1, small level, applies
  once); never runs without both query params.
- `?debug=1&exitdemo=1` (new, TASK 1) unlocks every node and stands the player next to the exit so a
  screenshot shows the lit, active extraction point (bright emissive gate, light beam, pulsing ring).
  Small levels only; never runs without both query params.

## Missing models

Types below got a temporary stand-in because no archetype's silhouette/behaviour is a close match. Specs
below follow the existing archetypes' conventions: local **+X forward, +Z up** (matching
`assets/enemies/README.md`), named glTF nodes, empty-transform pivots for anything animated, under 1.5k
triangles.

### grunt — basic infantry trooper (highest priority)

The most common enemy in the game (default room-filler, `RULES.variety` mix) has no matching archetype at
all today — all 8 existing archetypes are specialists (turret, charger, tank, swarm unit, scanner drone,
mortar, medic, sniper). It currently borrows the `rusher` chassis at a smaller scale with a steel-grey tint
so it never reads as an actual charger.

- **Silhouette**: upright bipedal or simple wheeled-torso trooper — closer to a foot soldier than any
  wheeled/tracked/legged chassis on the list. Should read as "generic armed infantry," not a specialist.
- **Size vs. player**: roughly player-height (~1.7m), a little leaner than `tank`/`shield_turret`.
- **Named parts/pivots**: `chassis` (or `torso`), `head_pivot` (small yaw pivot, mostly cosmetic — grunt
  doesn't currently track the player independent of body facing), `optic` (eye/sensor, keeps the existing
  red emissive convention), `weapon_mount` (static), 2x `leg_left_pivot`/`leg_right_pivot` if bipedal (fore-
  aft swing only, same convention as rusher's legs) **or** `wheel_left`/`wheel_right` if wheeled (no pivot
  needed, matches `repair`'s wheels).
- **Tri budget**: < 1.5k, in line with the other 8 (all currently under 150KB).
- **Emissive spots**: one `optic` (red, `ENEMY_COLORS.damage` family) — no shield/heal/AoE emissive, grunt
  has none of those mechanics.
- **Role**: baseline stand-off shooter (`RULES.enemyTypes.grunt`: speedMul 1, rangeMul 1, cooldownMul 1,
  standoff 3.5m) — no shield, no charge, no AoE.
- **Telegraph needs**: none beyond the existing generic windup/aim-lock telegraph already driven by
  `enemy.windupAt` in `nodspel/combat.js` — no new mechanic, just a body to carry it.

### guard — front-shielded melee-range defender (stand-in: tank, moderate fit)

`tank`'s `front_armor` plate on `turret_head_pivot` already reads reasonably as "this side is protected,"
and its burst-fire state machine matches guard's exactly (`stepGuard` in `nodspel/combat.js` drives both).
The weaker part of the fit is scale/role: `tank` is tier 3 ("crushes light cover," per `nodspel/enemies.js`)
while guard is a tier-1 node defender — the stand-in is scaled down (0.82x) to compensate, but a dedicated
model would be sized and tri-budgeted for a tier-1 role from the start, and would not carry `tank`'s tread
geometry (guard doesn't drive tracks; it walks a short, slow approach).

### patrol — sight-cone walker (stand-in: scout, weaker fit)

`scout`'s twin rotors read as "scanning/alert" well, but it is a Phase-2, tier-2 flying unit
(`nodspel/enemies.js`: `scout` phase 2) that may pull aggro across rooms in the big map — tonally and
mechanically heavier than patrol, which is the gentlest tier-1 encounter in the game (a fixed back-and-forth
walk with a floor-projected sight cone). A dedicated model should be a simple ground walker (no rotors, no
flight implication), sized like `grunt`/`rusher`, with no named pivots beyond a body yaw if any — patrol's
sight cone is already a separate floor decal (`nodspel/world.js` `enemyVisual()`, procedural, untouched by
this change) and does not need to live on the body mesh.
