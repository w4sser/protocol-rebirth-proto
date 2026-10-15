# Protocol Rebirth — Bunker Kit

## Use
- Import each `.glb` as an individual static prop. Scale is metres; Y is up; front is -Z; object origin is at the bottom centre.
- Place floor tiles on a 2 m grid. Their outer edge geometry is flush, so repeat them without overlap. `floor_concrete_2m_a`, `_b`, `_c` and `floor_grate_2m` share the same 2×2 m footprint and 0.05 m thickness.
- Place wall modules on a 2 m grid. Standard straight walls are 2×2.6×0.3 m; cap is lighter for top-down readability. Corner pieces have two 2 m legs.
- Keep `bunker_atlas.png` and `bunker_emissive.png` next to the GLBs. They are shared external glTF textures, not duplicated inside each model. Import as sRGB color textures; nearest filtering is set in the GLBs. No normal maps are used.
- Runtime emissive meshes sample cyan/amber/coral regions in the emissive atlas. `light_anchor` is an empty node suitable for attaching a point light in-engine; tune actual light intensity/range in your renderer.
- Use `manifest.json` for collision intent. Decals use no collision; floor modules are walkable; wall and prop bounds are box collision suggestions. Doorways need opening-aware collision as noted.
- Broken/open variants preserve the nominal module bounds.

## Included
Static low-poly environment kit, shared palette and emissive atlases, manifest, and a 52° pitch contact sheet. Each model uses a single lightweight mesh and no animation or skinning.
