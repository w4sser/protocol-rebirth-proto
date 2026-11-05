# Protocol Rebirth — Nature Ground Cover Kit

Independent, original procedural low-poly GLBs for instanced ground spread. One mesh and one material per asset, no modifiers or extra transforms; Y up, -Z forward, bottom-centre pivot. The 512x512 `nature_atlas.png` is a **shared** nearest-filtered color palette, referenced externally by every GLB. Do not duplicate/inline textures.

15 props: grass tufts A/B/C; moss clump; lichen; heather; fern; pine-needle pile; 5 granite pebbles; pine cone; fallen twig. Triangle count, bbox, collision, and size in manifest. Recommended varied scale ±15%, no strong specularity, no shadow receivers on low quality.

**Vertex wind/AO contract:** `COLOR_0.rgb` = AO multiplier (strong dark root and crevices, light leaves/tips), `COLOR_0.a` = bend weight 0 at roots to 1 at tips (all static rock/branches alpha 1). glTF core renders RGB naturally; shader must read **vertex alpha as WIND**, not transparency. All materials are OPAQUE, so alpha should not fade leaves. The loader must preserve COLOR_0 as VEC4 normalized UNSIGNED_BYTE. Alpha channel has no glTF extension or custom attribute.

All blades and fern leaflets are small, opaque triangular 3D geometry with doubleSided material, **no alpha blending**. Spread via InstancedMesh per asset and skip ~45% of instances on low quality. Place on terrain height with ground normal, avoid dense vegetation over combat readability. Asset names use snake_case.

Contact sheet: 52° isometric thumbnail render of the true triangle meshes, not a game screenshot. Same 52° camera assumption as Node Raid. Khronos validation and in-engine checks pending before merge.
