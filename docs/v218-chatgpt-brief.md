# Archipelago village environment handoff

v2.18 fixes the big-level generator dropping the selected area. `?area=archipelago&levels=big` now selects the existing Archipelago renderer instead of bunker corridors. Standard Archipelago levels already selected that renderer.

This worktree contains procedural islands, granite-style rocks, piers, boats and a pine model loaded from the town kit. It has no dedicated Archipelago village asset collection for the requested falun-red houses, spruces and streetlights. No environment art, materials, lighting or camera settings were changed for this bundle; environment source changes outside selection are cache-version stamps only.

ChatGPT art handoff: supply or identify the approved village environment set, with falun-red timber houses, grey granite, spruces and streetlights, compatible with the existing island room footprints and pier connections. Preserve playable passage clearances and the current camera. Provide asset names and the intended selection/loading entry point so implementation can wire them without replacing procedural art or changing lighting.

Requested external handoff path: `/workspace/v218-chatgpt-brief.md`. This copy stays in the authorized worktree because the session permits writes only inside this repository and `/tmp`.
