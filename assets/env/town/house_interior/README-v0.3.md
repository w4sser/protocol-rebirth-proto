# Protocol Rebirth — Abandoned Town Enterable House Slice v0.3

This is a small modular interior kit for testing one enterable, single-storey house. It complements town kits v0.1/v0.2. These are GLB meshes only: collision, navigation, door states, interactions, loot, lights and roof visibility are implemented in the game.

## Files and scale

- Put the `assets/env/town/house_interior/` folder beside the existing town assets.
- GLB is glTF 2.0 binary. Units are metres, Y is up.
- The room has 4 m clear interior dimensions, 2.6 m wall height and a 4.3 x 4.3 m floor slab. Wall modules are 4 m wide and 0.16 m thick.
- Front-facing door/window openings face -Z. Wall origins sit at floor level; the floor and props have their origin at the centre of their footprint.
- Models use embedded material colours from one named low-poly palette; no external textures are needed.

## Assemble a test house

1. Place `floor_4m.glb` at the room centre.
2. Place four wall modules around it: three `wall_plain_4m.glb` and one `wall_doorway_4m.glb`. Rotate modules in 90-degree steps. Keep the doorway centred on the front side and clear.
3. Add `door_closed.glb` in the opening. Use `door_open.glb` as the open-state mesh or animate the closed leaf around its left hinge. Add the door trigger and locked/open state in game code.
4. Add `wall_window_4m.glb` only where exterior windows are wanted. The actual opening is 1.2 m wide, sill at 0.95 m, top at 1.95 m. Decide whether windows can be entered separately.
5. Place `roof_removable_4m.glb` as a separate object. Hide/fade it while the player is inside, then restore it on exit. Do not merge it into the walls.
6. Furnish lightly with the included props. Keep the centre lane from doorway to room open so combat and navigation remain readable.

## Game-side setup

- Create simple colliders from the manifest dimensions. Walls block movement; doorway and window openings do not. Add a floor collider and navmesh/pathing for the room.
- Use one interaction trigger per door. Door and loot state must persist for the raid according to the game save/session model.
- Treat `loot_crate.glb`, `wardrobe.glb`, `bookshelf.glb`, `medicine_cabinet.glb` and optionally `fridge.glb` as visual candidates only. Add search prompts, loot tables, progress feedback and open/searched states in code.
- Add a short interior reveal or fade when crossing the threshold. Keep the exterior house shell outside the interior volume; the v0.2 solid house GLBs are not themselves walk-through houses.
- For the isometric camera, test roof fade, wall occlusion, player visibility, door interaction range and sightlines before making more house variants.

## First test acceptance

The player can approach the house, open or unlock the front door, enter without snagging on the threshold, move between furniture, search one container, fight or evade inside, and exit. The roof does not hide the player indoors, and the town exterior remains navigable.

See `assets/env/town/house_interior/manifest.json` for per-asset dimensions and placement notes.
