# Enemy archetype models

Eight standalone low-poly GLB assets for the Protocol Rebirth raid. Each model uses local +X as forward and +Z as up. Geometry uses named nodes; pivot nodes are empty transforms that can be animated by the game runtime. Shield transparency is authored as a glTF blend material.

| File | Named parts and pivots |
|---|---|
| `tank.glb` | `hull`, `track_left`, `track_right`, `turret_head_pivot` (`turret_head`, `front_armor`, `cannon`, `optic`), `weakpoint` |
| `shield_turret.glb` | `base`, `turret_head_pivot` (`turret_head`, `front_armor`, `cannon`, `optic`, `weakpoint`, `shield_arc`) |
| `rusher.glb` | `core`, `wedge_head`, `back_battery`, `optic`; `leg_front_left_pivot`, `leg_front_right_pivot`, `leg_rear_left_pivot`, `leg_rear_right_pivot` |
| `swarm_bot.glb` | `shell`, `optic`; `leg_01_pivot` through `leg_06_pivot` |
| `scout.glb` | `body`, `nose`, `duct_left`, `duct_right`, `rotor_left_pivot`, `rotor_right_pivot`, `scanner`, `optic` |
| `artillery.glb` | `base`, `armor`, `mortar_pivot`, `ammo_drum`, `weakpoint`, `stabilizer_01` through `stabilizer_04` |
| `repair.glb` | `chassis`, `armor_panel`, `wheel_left`, `wheel_right`, `cable_spool`, `arm_base`, `repair_arm_pivot`, `tool_emitter` |
| `sniper.glb` | `core`, `armor_panel`, `optic`, `weakpoint`, `barrel_pivot`, `tripod_leg_01` through `tripod_leg_03` |

Swarm is one reusable unit; spawn several instances for a group. Models are kept deliberately lightweight (all under 150 KB). Scale is normalized around a compact enemy footprint; adjust the root transform to match the raid's existing world units.

## Textured models (v2.28.68)

`patrol_grunt`, `shield_turret`, `tank`, `rusher`, `swarm_bot`, `artillery` and `sniper` are textured meshes cleaned up from generated models to match the art-direction references: ~16-26k tris each, one 1024 px base-colour JPEG, 1.3-1.7 MB per file (they replace the old vertex-colour blockouts, so the "under 150 KB" note above now only holds for `scout` and `repair`). They keep the node contract in `nodspel/enemies.js`: +X forward, +Z up, lowest vertex at z=0, named parts and pivots. Pivot children are rigid meshes positioned relative to the pivot; `patrol_grunt` wheels are baked in model space (see `wheelRollPivots()`).

Differences from the table above:
- `swarm_bot` has eight legs: `leg_01_pivot` .. `leg_08_pivot`, counter-clockwise from the front.
- `sniper` stands on four legs: `tripod_leg_01` .. `tripod_leg_04` (one per quadrant).
- `rusher` legs are authored in their crouched rest pose, so its spec has no `legRest`.
- `shield_arc` is the outer shell of the shield; with it hidden (`turret`) the inner face reads as a curved front plate.
- `optic` on `swarm_bot`, `rusher`, `artillery` and `sniper` is a separate red emissive material. `tank` and `shield_turret` keep `optic` (and `front_armor`) as empty nodes: their eyes are painted into the texture.
- `weakpoint` / `back_battery` meshes use the base texture as an emissive map so the amber cells glow.
- `patrol_grunt` keeps `upper_frame`, `front_plate`, `side_panel_*`, `hub_*`, `battery_cage`, `sensor_face` and `head_turntable` as empty nodes so the loader's part check still passes.

## Patrol Grunt runtime asset

`patrol_grunt.glb` is the LOD 0 model from the Blender pilot ([PR #315](https://github.com/w4sser/protocol-rebirth-proto/pull/315)). It replaces only the runtime asset: the URL, node names, hierarchy, transforms, and optic emission are unchanged. The unmodified textured source is kept at [`../reference/enemies/patrol_grunt_source.glb`](../reference/enemies/patrol_grunt_source.glb), outside the playable deployment.

| Variant | Triangles | Bytes |
|---|---:|---:|
| Original source | 19,969 | 1,288,964 |
| Runtime LOD 0 | 9,640 | 694,404 |

The owner reported almost no visual difference after an in-raid A/B on mobile. No frame-rate or load-time improvement is claimed. There is no runtime LOD switching.
