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
