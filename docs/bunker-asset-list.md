# Bunker asset list – art-dressing the Node Raid Bunker levels

Basis: `docs/art-direction.md` (AD ad06 rev 06, pages in `/workspace/art-direction/pages/`) and the Node Raid Bunker levels in `nodspel/levels.js` + `nodspel/world.js` (procedural boxes before v1.54). Format follows the town kit (`assets/env/town/`, `house_interior/manifest.json`).

> Status: the kit was delivered (85 GLB + 2 atlases + manifest) and is in `assets/env/bunker/`. Integrated in v1.54.0 (`nodspel/bunker.js`).

## Format conventions (same as the town kit)
- **Format:** low-poly `.glb` (glTF 2.0 binary), **1 unit = 1 m**, Y up, **origin at bottom centre**, front = −Z.
- **One file per object**, snake_case, in `assets/env/bunker/`; variants as separate files (`_a`, `_b`, `_broken`, `_on`/`_off`).
- **Size:** < 100 KB per GLB (test-enforced); props 50–800 triangles, hero pieces ≤ 1.5k. No skinning or animation (doors/pads are switched in code).
- **Material:** one shared **palette atlas** `bunker_atlas.png` (256×256 flat swatches) + one `bunker_emissive.png`. No unique textures, no normal maps, flat / low-frequency shading.
- **Floors:** seamless **2×2 m** tiles, 0.05 m thick, top at y = 0.
- **Walls:** **2 m** modular grid, 2.6 m high, 0.3 m thick, lighter top cap (must read from above at 52°).
- **Manifest:** `assets/env/bunker/manifest.json`, each asset `{ file, kind, approx_dimensions_m:[w,h,d], collision:"box|none|walkable", notes }`; code mirrors the dims (like `HOUSE_DIMS`).
- **Camera (AD p19):** pitch ≈ 52°, VFOV ≈ 38°, operator 12–13 % of screen height. Large readable shapes; no close-up-only detail (AD p8).

## Palette (AD p7, locked semantics)
| Use | Colour |
|---|---|
| Concrete (walls, floors) | Deep Navy #1B2740 → Violet Granite #7C7E97 (light caps), Muted Teal #2E5C63 painted fields |
| Ground / wear | Olive Ground #8B8B6C (dust, moss in cracks) |
| **Amber = loot, warmth, optional reward** | #FF9D4D (utility lamps, loot accents, searchables) |
| **Cyan = BIT, systems, extraction** | #3FE0D0 / soft #75CFCC (CRTs, node terminals, extract) |
| **Coral = danger** | #E4705F, Warning #D9552F (shock pads, alarms, sensors) |
| Neutral | #F2E9D6 (markings, stencils – no national symbols) |

Light: **CRT glow, cable runs, sparse lamps – never daylight** (AD p25). Amber utility light is the only warmth; the brightest region points to the next decision.

## Prioritised list
### P1 – must-have (replaces procedural boxes)
| File | Description | Dims w×h×d (m) | Variants | Gameplay |
|---|---|---|---|---|
| floor_concrete_2m | Concrete slab, expansion joint, seamless | 2×0.05×2 | _a, _b crack, _c oil | walkable; calm, slightly lighter than walls |
| floor_grate_2m | Steel grating over pipe channel | 2×0.05×2 | – | walkable; corridors |
| wall_straight_2m | Cold War concrete wall, light cap | 2×2.6×0.3 | _a, _b pipe mount, _damaged | box; cap reads at 52° |
| wall_corner | Corner | 0.3×2.6×0.3 + 2 m legs | in, out | box |
| wall_t | T-junction | 2×2.6×2 | – | box |
| wall_end | Rounded cast end | 0.3×2.6×0.6 | – | box |
| wall_doorway_2m | 1.4 m opening, lintel | 2×2.6×0.3 | – | sides only |
| blast_door | Sliding door, yellow-black edge, amber status lamp | 2×2.4×0.4 | open, closed | code-switched; exit gate |
| pillar_square | Column | 0.6×2.6×0.6 | _a, _cracked | box; cover |
| node_terminal | Objective node: CRT terminal on plinth | 1.2×1.4×1.2 | idle, shielded, active | ring drawn in code; screen = key light |
| shock_pad | Floor plate, coral grille, edge marks | 2×0.06×2 | off, warn, on | walkable; damage in code |
| extract_hatch | Floor hatch, cyan light frame, lamp post | 2.4×2.2×2.4 | locked, open | cyan = extract |
| loot_crate_common | Neutral military crate | 0.8×0.6×0.6 | – | searchable |
| loot_crate_rare | Reinforced crate, amber lamp, rarity stripe | 0.9×0.7×0.6 | uncommon, rare, epic, legendary | amber = loot; in-game rarity colours |
| cover_low_barrier | Jersey barrier | 2×0.9×0.6 | _a, _broken | low cover |
| cover_sandbag | Sandbag wall | 1.6×0.8×0.6 | straight, bend | low cover |
| lamp_wall_amber | Caged wall lamp | 0.3×0.4×0.3 | on, broken | light anchor |
| crt_monitor_wall | Wall CRT (no face) | 0.6×0.5×0.3 | on, off | light anchor |

### P2 – variation and readability
| File | Description | Dims (m) | Variants | Notes |
|---|---|---|---|---|
| pipe_run_2m | Wall pipe bundle | 2×0.3×0.3 | straight, bend, valve | along walls |
| cable_run_2m | Floor cable bundle | 2×0.08×0.4 | straight, corner | walkable; leads to nodes |
| cable_tray_wall | Wall cable tray | 2×0.2×0.4 | – | never hides operator |
| locker_row | 3 lockers, amber lock lamp | 1.5×2×0.5 | closed, open | searchable |
| desk_metal | Desk (+radio) | 1.4×0.8×0.7 | _a, _with_radio | searchable |
| shelf_supply | Shelving | 1.8×2×0.5 | full, empty | box |
| generator | Diesel generator, amber indicator | 1.6×1.3×0.9 | on, off | landmark |
| radar_console | Control panel, several CRTs | 2.4×1.2×0.8 | – | landmark |
| barrel_steel | Barrel | 0.6×0.9×0.6 | upright, tipped | box |
| debris_pile | Rubble | 1.2×0.5×1.2 | _a, _b | partial burial |
| alarm_lamp_coral | Alarm lamp | 0.25×0.3×0.25 | on, off | danger zones |
| sign_stencil | Stencil plate, numbers/arrows only | 0.8×0.4×0.02 | 1–9, A–C, arrow | no national symbols |

### P3 – atmosphere
vent_wall 0.8×0.6×0.1 · fan_wall 0.6×0.6×0.3 · bunk_bed 2×1.6×0.9 · map_table 1.6×0.9×1 · moss_patch 1×0.02×1 (nature flows in, AD p6) · water_puddle 1.5×0.01×1.

## Decals (0.01 m planes, atlas alpha, no collision)
decal_floor_marking_lane, decal_hazard_stripes (coral/black), decal_crack_a/b, decal_oil_stain, decal_cable_scorch, decal_arrow_exit (small, subtle cyan – AD: routes via light, not arrows), decal_bit_smile_graffiti (**locked face geometry** from `assets/bit-face-master.svg`, AD p24).

## Lighting / emissive
Emissive via `bunker_emissive.png` only: cyan (terminals, CRTs, extract), amber (lamps, loot, door status), coral (pads, alarms). Real lights are placed in code at each asset's empty `light_anchor` node. Few strong lights per room; the next goal is the brightest region.

## Mapping to the level code (verified against v1.53 `levels.js` / `world.js`)
| Procedural (world.js) | Level data | Replaced by |
|---|---|---|
| floor box + 2 m seam lines + trim | `level.floors` (rooms + corridors, arbitrary w×d) | floor_concrete_2m_a/b/c tiled on 2 m grid (edge tiles scaled), floor_grate_2m in corridors |
| wall box + cap + neon trim | `level.walls` (0.4 m thick, arbitrary length) | wall_straight_2m variants tiled along the wall, scaled to length/height; collision stays the level rect |
| cover box 1.1 m | `level.boxes` | cover_low_barrier / cover_sandbag / pillar_square / debris_pile (seeded), fitted to footprint |
| node: plinth + body + emissive face | `level.nodes` (`shielded`) | node_terminal_idle / _shielded → _active on activation (halo/hold ring kept) |
| hazard plane + rings | `level.hazards` (shock pads) | shock_pad_off / _warn / _on per state, decal_hazard_stripes around (telegraph ring kept) |
| exit gate + posts + pad + beam | `level.exit` | blast_door_closed → _open, extract_hatch_locked → _open (rings/beam kept) |
| loot crate box + rarity band | `level.lootBoxes` (rarity via rarity.js) | loot_crate_common / _uncommon / _rare / _epic / _legendary (pulse/beam kept) |
| props crate/terminal/pipes/vent/plant/cables | `propSpots()` (visual only) | lockers, desks, shelves, barrels, generator, radar console, map table, bunk bed, debris |
| point lights at prop spots | – | lamp_wall_amber_on / crt_monitor_wall_on on walls; alarm_lamp_coral near shock pads |
| (none) | – | decals: cracks, oil, lane markings, cable scorch, exit arrow, BIT smile graffiti |
| route markers | `level.routeChoices` | unchanged (gameplay UI) |

## Ready-to-paste prompt (ChatGPT)
```text
You are building a low-poly 3D asset kit for "Protocol Rebirth", a mobile top-down (52° pitch, ~38° vertical FOV) extraction shooter. Build the BUNKER level kit described below.

STYLE (art direction, locked):
- "Dark, but never hopeless." Nordic melancholy, Cold War concrete bunker: thick horizontal slabs, repeated modular proportions, built to survive, not to impress. Swedish identity through engineering, never national symbols or flags.
- Stylized clarity: big readable shapes at phone size (player is 12–13% of screen height). Nothing that only works in close-up. Low-frequency surfaces, no texture noise, no one-off clutter.
- Interior light is CRT glow, cable runs and sparse lamps – never daylight.
- Colour semantics: CYAN #3FE0D0 / soft #75CFCC = BIT, powered systems, extraction. AMBER #FF9D4D = loot, warmth, optional reward. CORAL #E4705F / warning #D9552F = danger. Concrete/world: Deep Navy #1B2740, Muted Teal #2E5C63, Violet Granite #7C7E97, Olive Ground #8B8B6C. Neutral markings #F2E9D6.

TECHNICAL FORMAT:
- glTF 2.0 binary (.glb), 1 unit = 1 metre, Y up, origin at bottom centre, front faces -Z.
- One file per object, snake_case filenames exactly as listed, variants as separate files.
- Each file < 100 KB; props 50–800 tris, hero pieces up to 1.5k. No animation, no skinning.
- ONE shared 256×256 palette atlas "bunker_atlas.png" and ONE "bunker_emissive.png" (cyan/amber/coral). No unique textures, no normal maps.
- Floors: seamless 2×2 m tiles, 0.05 m thick, top at y=0. Walls: 2 m grid, 2.6 m high, 0.3 m thick, lighter top cap.
- Emissive props contain an empty node "light_anchor".

ASSETS (filename – description – approx w×h×d m):
P1: floor_concrete_2m_a/_b/_c 2×0.05×2; floor_grate_2m 2×0.05×2; wall_straight_2m_a/_b/_damaged 2×2.6×0.3; wall_corner_in/_out; wall_t 2×2.6×2; wall_end 0.3×2.6×0.6; wall_doorway_2m 2×2.6×0.3; blast_door_open/_closed 2×2.4×0.4; pillar_square_a/_cracked 0.6×2.6×0.6; node_terminal_idle/_shielded/_active 1.2×1.4×1.2; shock_pad_off/_warn/_on 2×0.06×2; extract_hatch_locked/_open 2.4×2.2×2.4; loot_crate_common 0.8×0.6×0.6; loot_crate_uncommon/_rare/_epic/_legendary 0.9×0.7×0.6 (rarity stripe green #3ddc6a, blue #3d8bff, purple #b05cff, gold #ffc12e); cover_low_barrier_a/_broken 2×0.9×0.6; cover_sandbag_straight/_bend 1.6×0.8×0.6; lamp_wall_amber_on/_broken 0.3×0.4×0.3; crt_monitor_wall_on/_off 0.6×0.5×0.3.
P2: pipe_run_2m_straight/_bend/_valve 2×0.3×0.3; cable_run_2m_straight/_corner 2×0.08×0.4; cable_tray_wall 2×0.2×0.4; locker_row_closed/_open 1.5×2×0.5; desk_metal_a/_with_radio 1.4×0.8×0.7; shelf_supply_full/_empty 1.8×2×0.5; generator_on/_off 1.6×1.3×0.9; radar_console 2.4×1.2×0.8; barrel_steel_upright/_tipped 0.6×0.9×0.6; debris_pile_a/_b 1.2×0.5×1.2; alarm_lamp_coral_on/_off 0.25×0.3×0.25; sign_stencil_1..9/_a.._c/_arrow 0.8×0.4×0.02.
P3: vent_wall 0.8×0.6×0.1; fan_wall 0.6×0.6×0.3; bunk_bed 2×1.6×0.9; map_table 1.6×0.9×1; moss_patch 1×0.02×1; water_puddle 1.5×0.01×1.
DECALS (0.01 m planes): decal_floor_marking_lane, decal_hazard_stripes, decal_crack_a, decal_crack_b, decal_oil_stain, decal_cable_scorch, decal_arrow_exit (small subtle cyan), decal_bit_smile_graffiti (use the supplied bit-face-master.svg geometry exactly – never a generic smiley).

DELIVERY: one zip "bunker_kit.zip" with folder "bunker/" containing all .glb, bunker_atlas.png, bunker_emissive.png, manifest.json ({"file","kind","approx_dimensions_m":[w,h,d],"collision":"box|none|walkable","notes"} per asset) and a 52° contact-sheet PNG on dark navy. Verify seamless tiling, bottom-centre origins, every file < 100 KB.
```
