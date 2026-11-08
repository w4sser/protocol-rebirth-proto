# Military Remnants — Archipelago Pass 3B

**Status:** Experimental, opt-in, no gameplay changes. **Default:** Coastal Life remains unchanged.

## Creative target
The islands were once lived in and defended. A rare, abandoned military listening/power post on a rocky coastal shelf is a small evidence of that history, not a generic army base. No flags, overt faction identifiers, or loot signals. The tone stays Nordic summer night: quiet, faded technology and granite, dark but never hopeless.

## Player-visible change
`?polyforkMode=military` in an Archipelago raid adds at most **one** clustered vignette, alongside the current forest, granite and coastal-life dressing.
- **Listening post:** restrained floodlight mast (not powered), field console, warning plate.
- **Power node:** gas cylinder cabinet, dead battery equipment, warning plate.
- Tiny/marginal sites are omitted entirely when safety checks cannot find a position.
- HIGH uses up to three details; LOW retains the first two silhouettes, and remains a subset of HIGH.
- Use existing curated Polyfork asset identifiers; do not download or redistribute the GLB models to the repo.

## Technical boundaries
- Pure-data seeded site planning; choose a **rocky** island shelf beyond the authored walkable floor, but within the organic coast mesh.
- Prefer a different island from Coastal Life. Validate the entire HIGH vignette including each model footprint, collisions/reservations, bridge mouths, objectives and nearby walls.
- No new collision, cover, paths, navigational shortcuts, buildings, dynamic lights, water, terrain or coastline alterations.
- Within existing **125 HIGH / 40 LOW** instance budgets; keep default Coastal Life and all other opt-in modes unchanged.
- No asset dependency outside the pre-existing Polyfork CDN. Production hosting and redistribution still require explicit licensing review.

## Review gate
- [ ] New unit tests for seeded repeatability, placement safety, budgets and default no-op pass.
- [ ] CI, ground-v2-khronos and military-remnants-preview workflows pass at current head SHA.
- [ ] High and Low iPhone screenshots show a recognizable, small military trace, with no floating or hidden object.
- [ ] Actual mobile playtest retains aim readability, bridge access and frame rate (Low target >40 FPS).
- [ ] User accepts visual direction before merging or making the vignette default.

## Test
Run the draft preview with `area=archipelago&levels=big&polyfork=1&polyforkMode=military&q=high&seed=military-qa-01` and compare against `polyforkMode=coastal` with the same seed. The dedicated image workflow captures a Level 3 island from an 844x390 viewport at HIGH and LOW.
