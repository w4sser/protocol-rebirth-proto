# Abandoned Town enterable house kit v0.4

This replaces the first pass of the existing interior GLBs while keeping every runtime filename and room dimension used by `nodspel/town.js` and `nodspel/house.js`. The playable room, door behaviour, furniture positions, search interactions and colliders stay game-side.

## Visual and performance choices

- Warm plaster, dark timber framing, worn wood floors, muted teal fabric and small amber/red accents suit the abandoned-town lighting already in the game.
- All colour is embedded in GLB materials. There are no texture maps, image requests or external dependencies.
- Hard-edged, low-poly boxes keep geometry simple. Each model groups geometry by material, so each asset uses only a few draw calls. The kit totals about 167 KB across 17 GLBs.
- The separate roof remains removable; wall modules retain the existing door/window openings and dimensions. Do not change those openings without updating the game colliders and house layout together.

## Use in the game

The game already loads these files from `assets/env/town/house_interior/` and builds one furnished room. The door prompt opens the front door; move inside and stand near the wardrobe, crate, or medicine cabinet to search it. The roof and camera-side walls fade as the player enters. The player can leave through the same doorway.

For a quick preview, run the existing Node server from `nodspel/` (`node serve.mjs`) and open the Town area. On the title screen select Abandoned Town, or add `?area=town`. Desktop: WASD or arrows; mobile: use the on-screen movement controls. Walk up to the door, wait for it to open, then walk inside.

## Rebuild

From the repository root:

```sh
python tools/generate-house-kit.py
```

This writes the 17 GLBs to `assets/env/town/house_interior/`. It uses only Python's standard library. A different output directory can be passed for local checks:

```sh
python tools/generate-house-kit.py /tmp/house_interior
```

See `manifest.json` for dimensions and placements. Keep the runtime filenames stable; the loader falls back to simple stand-ins when an asset is missing.
