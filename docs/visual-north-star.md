# Protocol Rebirth — Visual North Star (Rev 06)

**Primary visual reference:** [Art Direction — Visual North Star (Rev 06, PDF)](reference/protocol-rebirth-art-direction-rev06.pdf) — 30 pages, Wild Labs, October 2026. This is the visual guide for the game's atmosphere, forms, material families, color language and mobile-scale composition.

**Living production extensions:** [Art Direction v07](art-direction.md), [Archipelago Visual Target v2](archipelago-visual-target-v2.md), [BIT Character Specification](bit-character-spec.md) and the current [BIT face master v3](../assets/bit-face-master-v3.svg). The PDF remains the historical visual foundation; later explicit owner-approved decisions in these documents govern implementation where they differ.

## How to use this guide

1. **Start with the PDF.** Study its actual compositions and silhouettes rather than relying on a prose-only summary or reproducing concept art pixel-for-pixel.
2. **Respect status labels.** **LOCKED** denotes approved identity and readability constraints; **DIRECTION** and **PRODUCTION REFERENCE** are targets requiring proof in the normal playable camera, not an asset production order; **TO EXPLORE** denotes unfinished design.
3. **Read v07 and the relevant area/character specifications before implementation.** Rev 06 does not silently reverse newer decisions, grant abilities, or authorize a production pass.
4. **Review at physical landscape-phone size.** Silhouette, safe routes and immediate threats take priority over material fidelity, decorative detail, post-processing and asset density.

## Page map

| Pages | Reference | Production takeaway |
| --- | --- | --- |
| 2–4 | Dark but never hopeless; visual pillars; Nordic night | Beautiful, melancholic blue-hour archipelago; healthy nature, pale warm horizon; BIT supplies emotional warmth |
| 5–7 | Soft nature / hard engineering; color roles | Wind-shaped, asymmetrical nature versus strong Cold War concrete; navy, muted teal, violet, amber, lavender, cyan and warning coral |
| 8–9 | Mobile hierarchy and route grammar | Player, BIT and threats first; walkable ground calm/continuous; cliff/vegetation boundaries hard to misread; routes shown through light and landmarks |
| 10–16 | Small modular environment kit; production language | Granite (cover/boundary/landmark), coastal pine (crouched/sentinel/crown), concrete (portal/wall/slab), cover, quiet ground and six restrained material families |
| 17–18 | OP-01 form language | Adult 7.5–8-head-tall Operator; practical, gender-neutral, concealed identity, readable at phone scale |
| 19–20 | Camera, occlusion and decisions | Baseline 12–13% Operator screen height; wider 10–11%, tighter 14–15%; pitch ~52°, vertical FOV ~38°; selectively fade foreground occluders, not whole assets |
| 21–23 | BIT tiers, body language and legacy face drawing | Recognizable small CRT companion with amber side lamp and minimal hover; preserve canonical face but see the v3 exception below |
| 24–26 | World smile, bunker mood and combat composition | Familiar smile can live in the world; sparse practical bunker lighting; play space stays calm while vegetation and rocks frame combat |
| 27–28 | Open vs locked language | Do not treat enemy factions, weapon language, combat VFX, UI/HUD, biomes, weather or animation references as finished solely because the PDF depicts them |
| 29–30 | Bunker-approach validation and area map | Verify silhouette, threat, route and occlusion readability on device; the area map is for orientation, not a level layout |

## Locked visual principles

- **Tone:** damaged but alive and worth rebuilding — “Dark, but never hopeless.” No ruin-horror, dead forests, toxic fog or neon dystopian sci-fi.
- **Hierarchy:** read the game before the detail. Player, BIT and nearest threats; then routes and hard boundaries; then cover and landmarks; finally atmosphere.
- **Color meaning:** cyan = BIT / powered systems / extraction; amber = loot / warmth / higher-risk reward; coral red = confirmed danger; neutral ground differentiates navigable terrain.
- **Environment:** asymmetrical Swedish granite and pines alongside restrained, functional Cold War infrastructure. No national symbols or national flags.
- **Assets:** large, reusable, low-frequency forms. Variation from scale, rotation, overlap, burial and lighting, not hundreds of bespoke props.
- **Navigation:** no glowing paths or arrow overlays as a substitute for composition. Routes read through sightlines, material contrast and broad light pools.
- **Legibility:** test every critical asset at the normal camera and actual mobile viewport; environment must frame gameplay, not compete with it.

## Reconciliation with the current design

**BIT face master conflict (Rev 06 p. 23):** the PDF records the historical v2.0 smile geometry with a **387 U** endpoint-centre span. The owner-approved [BIT specification](bit-character-spec.md) and [v3 SVG](../assets/bit-face-master-v3.svg) dated 14 November 2026 explicitly supersede it for new artwork and use **370 U**. The original owner proportion sheet and canonical v3 SVG remain authoritative. Do not reproduce p. 23 geometry, regenerate or overwrite v3, or add cyan strips outside the screen. The PDF's BIT mood, materials, proportions and body references remain relevant.

**Operator variants:** the PDF's OP-01 is the core visual anchor; [Art Direction v07](art-direction.md) records the later M38 decision permitting mechanically equivalent cosmetic appearances.

**Archipelago:** follow the [approved organic-island visual target](archipelago-visual-target-v2.md) for playable coastlines; do not read older rectangular prototype boundaries as desired world geometry.

**Camera and production target:** Rev 06 camera numbers and asset plates are implementation starting points, not claims of validation. Preserve the playtest and performance gates described in v07.

## Asset provenance

The repository PDF is an **optimized derivative** of the owner-uploaded `Protocl Rebirth Art Direction 06.pdf`: all 30 pages and selectable text are preserved; images were re-encoded for practical repository distribution. The owner's original 78,498,133-byte PDF was not modified. Hashes and provenance are recorded in [reference/README.md](reference/README.md).

**Scope of this change:** documentation and visual reference only. No runtime, economy, UI, character-asset or gameplay changes are authorized by adding the guide.
