# Enemy model mapping (v2.20.0)

Every enemy type/encounter the raid can actually spawn — `nodspel/levels.js` `RULES.enemyTypes` (grunt,
rusher, sentry, thrower), `nodspel/encounters.js` (guard, grenadier, turret, patrol, swarm, shield,
shield_turret), and `nodspel/stakes.js` hunter waves — now resolves to one of the 9 archetype GLBs in
`assets/enemies/` via `ENEMY_VISUALS`/`visualFor()` in `nodspel/enemies.js`. The procedural box mesh stays
as the fallback for every enemy (`nodspel/enemy-models.js` returns it on any load failure/timeout); nothing
here changes gameplay (health, speed, cooldowns, damage) — only what gets drawn. The one exception is the
`patrol_grunt` back-battery hit bonus (see "Back-battery bonus" below), which is gameplay, not presentation.

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
| `patrol` (encounter, sight-cone walker) | `patrol_grunt` | Patrol path, sight cone (procedural floor decal, unchanged), windup telegraph, back-battery hit bonus | No — exact fit (same chassis as bare grunt) |
| `grenadier` (encounter, thrower variant) | `artillery` | Lob telegraph ring, fuse, blast radius | No — close fit (towed mortar reads as a lobbing unit) |
| `swarm` (encounter, rusher cluster) | `swarm_bot` | Spawn-point burst, charge-free group rush | No — exact fit |
| hunter wave (`type:'rusher'`, `swarm:true`, no encounter, `nodspel/stakes.js`) | `swarm_bot` | Same as swarm — these reuse swarm's doorway-routing | No — same reasoning as swarm |
| `shield` (encounter, node generator) | — (kept as-is) | — | **No — not an enemy.** See "Generator" below |
| bare `rusher` (no encounter, `isCharger`) | `rusher` | Stalk → windup → charge lunge, wall-stun | No — exact fit |
| bare `sentry` (no encounter) | `sniper` | Long-range single shot, aim-lock telegraph | **Yes, temporary** — stationary long-reach shooter; see Missing models |
| bare `thrower` (no encounter) | `artillery` | Lob telegraph ring, fuse, blast radius | **Yes, temporary** — same reasoning as grenadier, slightly looser fit since bare throwers also reposition between throws (see Missing models) |
| bare `grunt` (no encounter) | `patrol_grunt` | Basic stand-off shooter, scanning head, back-battery hit bonus | No — exact fit |

Colour code is unchanged everywhere: coral = damage, blue = shield, green = heal, yellow = AoE
(`ENEMY_COLORS`, `nodspel/enemies.js`).

## Back-battery bonus (`patrol_grunt`: bare grunt and the patrol encounter)

`patrol_grunt.glb` authors a `weakpoint_battery` on the back of the chassis. `rusherBackBonus`-style pure
function `patrolGruntBackBonus(enemy, from)` in `nodspel/enemies.js` gives a flat **1.75x** to any hit whose
origin sits more than 120 deg off the enemy's facing (the dot-product test `forwardDot<-.5`), regardless of
aggro state — unlike the generic flank/unaware bonus in `weakSide` (`nodspel/encounters.js`), which needs
`aggro` for its own 2x and is capped to the first unaware hit for its 3x. `round.js` `hitEnemy` chains it
ahead of `weakSide`: `rusherBackBonus(...) ?? patrolGruntBackBonus(...) ?? weakSide(...)`, so a grunt/patrol
hit beyond 120 deg always gets 1.75x instead of whatever `weakSide` would have given it. Right at the shared
120 deg seam the two cones differ by a hair (`patrolGruntBackBonus` requires *strictly* more than 120 deg;
`weakSide`'s back-cone is 120 deg *inclusive*), so a hit landing exactly on the seam still gets the generic
2x — see `nodspel/tests/enemies.test.mjs` for the exact boundary case. `guard` (`type:'grunt'`,
`encounter:'guard'`) is explicitly excluded (`isPatrolGrunt`): it stands in on the `tank` archetype, which
has no `weakpoint_battery`, so it keeps only the generic bonus. The hit reuses the existing flank feedback
(`enemy.weakMarker='FLANK'`, combat log line) — no new feedback plumbing needed.

## Animation hookups (`nodspel/enemy-animation.js`)

Per-archetype idle/move, using named pivots from `assets/enemies/README.md`:

- **shield_turret / turret**: `turret_head_pivot` yaws to `enemy.facing`; `cannon` recoils on each shot of
  a burst (`attackPhase==='burst'`); `shield_arc` visibility follows `shieldDownUntil` (turret always keeps
  it hidden regardless, via `hideParts`).
- **tank** (guard): same head-track + cannon-recoil as shield_turret (`stepGuard` in `nodspel/combat.js`
  drives guard through the same burst-fire state machine).
- **rusher** (the charger; `isCharger` is always true for anything resolving to this archetype): 4-leg
  walk-cycle swing while moving; the charge wind-up tilt, wall-stun tilt and `back_battery` pulse are
  gated on `isCharger(enemy)`.
- **patrol_grunt** (bare grunt and the patrol encounter): `sensor_head_pivot` holds a zero local offset
  while `enemy.aggro` (the body itself already turns to face the player, per `nodspel/game.mjs` + the
  generic aim logic in `nodspel/combat.js`, so "tracking" falls out of that for free) and does a slow
  side-to-side scan otherwise; `short_machine_gun` (a child of the head pivot, so it swings with it) kicks
  back along local X for 120 ms after `enemy.lastShotAt` (set by the generic fire path in
  `nodspel/combat.js`, render-only bookkeeping); `weakpoint_battery`'s emissive pulses coral
  (`ENEMY_COLORS.damage`). The four wheels (`wheel_front_left`/`hub_front_left` etc.) have no authored
  pivot — the GLB bakes each wheel/hub mesh's position straight into its vertex data — so
  `attachEnemyModel` derives one per wheel from the mesh's own local bounding-box center and reparents
  wheel+hub under a synthesized pivot `THREE.Group` (`wheelRollPivots()`), then rolls each pivot every
  frame by the enemy's forward-signed movement distance divided by the wheel radius.
- **swarm_bot**: 6-leg insect-gait swing (`leg_01_pivot`..`leg_06_pivot`) while actively closing in.
- **scout**: `rotor_left_pivot`/`rotor_right_pivot` spin continuously in opposite directions. (`scout`
  itself is not currently mapped to any spawnable type/encounter — see Missing models' `patrol` history;
  it remains in the registry as a Phase-2 archetype.)
- **artillery** (thrower/grenadier): `mortar_pivot` pitches up while `enemy.windupAt` is set (the throw's
  wind-up). The 4 `stabilizer_0N` parts are static meshes in the GLB (no `_pivot` suffix — see
  `assets/enemies/README.md`), not hinge pivots, so they are not animated.
- **sniper** (bare sentry): `barrel_pivot` gets a small continuous idle scan (it is the only real pivot on
  this model — the 3 `tripod_leg_0N` parts are likewise static meshes, not pivots, and bare sentries never
  move anyway).

## Health pips / labels

`nodspel/game.mjs`'s enemy label used a fixed `y=1.7`. It now uses `v.labelY`, computed once per attached
model in `attachEnemyModel()` from the mounted model's actual bounding-box height (archetype `scale` and
any per-visual `scale` override both applied) plus a small margin, clamped to a sane minimum. The 9
archetypes range from ~0.5m tall (`swarm_bot`) to ~1.55m (`shield_turret`), so a single constant would have
sat inside the small models and floated well above the tall ones. Falls back to `1.7` for the generator
(no GLB) and for any enemy while its model is still loading.

## Perf

- Geometry and materials stay shared across all instances of an archetype (`userData.shared=true`), as
  before — this still holds for every archetype; there is no per-instance recolour left in the registry
  (the former `grunt` stand-in's steel tint was the one exception and is gone now that `patrol_grunt` is a
  dedicated model).
- `shield_arc`, `back_battery` and `weakpoint_battery` are the three parts that need an individually
  animated emissive pulse, so each instance gets its own material clone of just those parts
  (`animatedMaterials` in `attachEnemyModel()`); their geometry stays shared.
- No enemy archetype adds a `THREE.Light`; the existing "zero lights, shared geometry" test
  (`nodspel/tests/enemies.test.mjs`) now covers all 9 archetypes.

## Debug demos

- `?debug=1&enemydemo=1` is unchanged (shield_turret + rusher, bunker L1 only).
- `?debug=1&enemydemo=mixed` places 8 enemy kinds near the start of bunker L1's first room — grunt,
  sentry, thrower, swarm, turret, guard, patrol, rusher — for a single screenshot that shows every mapped
  visual at once. Grunt and patrol now share the same `patrol_grunt` model (so the 8 placed enemies render
  7 distinct archetype visuals, not 8), which is expected: see the mapping table above. Gated identically
  to `enemydemo=1` (both params, bunker, L1, small level, applies once); never runs without both query
  params.
- `?debug=1&exitdemo=1` unlocks every node and stands the player next to the exit so a screenshot shows
  the lit, active extraction point (bright emissive gate, light beam, pulsing ring). Small levels only;
  never runs without both query params.

## Missing models

Types below got a temporary stand-in because no archetype's silhouette/behaviour is a close match. Specs
below follow the existing archetypes' conventions: local **+X forward, +Z up** (matching
`assets/enemies/README.md`), named glTF nodes, empty-transform pivots for anything animated, under 1.5k
triangles.

### guard — front-shielded melee-range defender (stand-in: tank, moderate fit)

`tank`'s `front_armor` plate on `turret_head_pivot` already reads reasonably as "this side is protected,"
and its burst-fire state machine matches guard's exactly (`stepGuard` in `nodspel/combat.js` drives both).
The weaker part of the fit is scale/role: `tank` is tier 3 ("crushes light cover," per `nodspel/enemies.js`)
while guard is a tier-1 node defender — the stand-in is scaled down (0.82x) to compensate, but a dedicated
model would be sized and tri-budgeted for a tier-1 role from the start, and would not carry `tank`'s tread
geometry (guard doesn't drive tracks; it walks a short, slow approach).

### bare sentry — stationary long-range shooter (stand-in: sniper, close fit)

`sniper`'s long-barrel-on-a-tripod silhouette already reads correctly for a stationary long-reach shooter;
the only gap is that `sniper` is tier 3 while a bare sentry is the plain, ungated version of the same role.
No dedicated spec is written up here since the stand-in's fit is already close and bare sentries never
move, so there is little behavioural surface a dedicated model would add.

### bare thrower — mobile lobber (stand-in: artillery, loose fit)

Same reasoning as `grenadier` (towed mortar reads as a lobbing unit), but a bare thrower also repositions
between throws, which the towed-mortar silhouette doesn't sell as well as it does for the stationary
grenadier encounter. A dedicated model would keep the lob telegraph/fuse/blast-radius behaviour but trade
the tripod/stabilizer legs for a mobile chassis.
