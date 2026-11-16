# Protocol Rebirth — Visual North Star (Art Direction Rev 06)

**Visual reference:** *Protocol Rebirth — Art Direction — Visual North Star*, Wild Labs, Rev 06 (30 pages, 14 October 2026).  
**Status:** Adopted as the **visual north star**, not a claim that all depicted assets are final or implemented.  
**Source PDF (owner-held, private):** [Rev 06 — compressed reference copy](https://drive.google.com/file/d/1BRwbdB9-AtmcOW1sX8ygbRfK983Ohd98/view?usp=drivesdk). Access requires the owner's permission; this link does not make the PDF publicly available. The original 30-page source is held separately.  
**Reference integrity:** Original PDF SHA-256 `99d0766ecb5983babc093712192e5410d684c31bee883c5329165211aa904bd0`; 30 pages; approximately 75 MB. The linked reduced-size derivative has SHA-256 `199b6ac5fad186e21dd9572294c0d3881959cb96ff5911b680a2fd40543201a7` (PDF recompressed for reference; not byte-identical to the original).

This document is the searchable, code-reviewable entry point to Rev 06, not a substitute for seeing its art. Read it together with [Art Direction v07](art-direction.md), which extends the visual north star with subsequently approved gameplay art decisions, [BIT's locked character specification](bit-character-spec.md), and the [Archipelago v2 visual target](archipelago-visual-target-v2.md).

## Decision and precedence

- **LOCKED identity principles:** dark but hopeful tone; mobile-first visual clarity; adult, gender-neutral Operator proportions; BIT's recognisable CRT silhouette/screen; Swedish visual identity through landscape/engineering rather than national symbols; physically legible play boundaries (Rev 06 pp. 2–3, 8, 17, 22, 28).
- **Working direction pending in-game validation:** production examples for granite, pines, concrete, material families; camera parameters and occlusion examples; route framing and visual color usage. The PDF labels production concepts as **concept targets, not final game assets** (pp. 12–20, 28).
- **Unresolved disciplines:** enemy factions, weapon language, combat VFX, UI/HUD, bunker interiors, biomes/weather, BIT upgrades and animation are explicitly identified as **not yet designed** in Rev 06 (p. 27). Subsequent decisions may define some of these; do not revert later approvals simply because this historical PDF listed a topic as open.
- **Current detailed constraints take precedence where they conflict:** `docs/art-direction.md` v07, M38–M41 and later owner decisions, `docs/bit-character-spec.md` for BIT, and Archipelago v2 for playable coastline/geology. The PDF's face-master diagram is historical v2 geometry, **not** permission to overwrite the owner-approved v3 master.

## The four visual pillars (pp. 2–4)

1. **Stylized clarity:** large forms must read at physical mobile size, not just in close-up.
2. **Nordic melancholy:** blue-hour shadows, quiet Swedish coastlines, pale peach/lavender horizons; beautiful rather than oppressive.
3. **Production restraint:** shape, lighting and color do the work—not expensive asset density or surface noise.
4. **Human warmth:** BIT provides emotional connection within a damaged but recoverable world.

**Art rule:** "Dark, but never hopeless." Avoid horror-ruin imagery, dead forests, toxic fog, constant storm skies, or generic neon dystopia.

## World grammar and materials (pp. 5–7, 9–16, 26)

| Domain | Visual language | Gameplay implication |
| --- | --- | --- |
| Nature | Asymmetric, wind-shaped granite, coastal pine, broad rounded landforms | A living Nordic archipelago; coherent geological silhouettes |
| Construction | Straight, functional, heavy Cold War concrete; thick horizontal slabs and modular spans | Human structures read as intentional engineering |
| Playable ground | Relatively flat, light, continuous, low-frequency detail | Traversal remains clear under combat |
| Hard boundary | Vertical granite, deep drop, dense dark vegetation and stronger value separation | Unwalkable territory is understandable without UI arrows |
| Valid route | Negative space, clear sightline, broad light pools, warm destination light | The world teaches where to go |
| Cover | Granite, structures and vegetation in recognizable roles | Read combat cover from the ordinary game camera |
| Background | Beautiful water and distant islands, restrained fog and horizon | Atmosphere frames play and is not confused with a walkable route |

Create variety from **scale, rotation, overlap, partial burial, and lighting**, rather than one-off props. Reference kit: granite G1/G2/G3 (low cover/hard boundary/landmark), pine P1/P2/P3 (wind-crouched/sentinel/crooked crown), concrete C1/C2/C3 (portal/wall + corner/slab + support), boundary/cover B1/B2/B3, and M1–M6 restrained material families (pp. 10–16). No grass carpet, arbitrary stone rows, conspicuous rectangular terrain slabs, glossy high-frequency surfaces, or decorative concrete blocks in a natural archipelago.

### Light and color (p. 7)

- **Cyan:** BIT, powered systems, extraction.
- **Amber:** loot, humanity, practical light, higher-risk reward.
- **Coral/red:** hostile sensors and confirmed danger.
- **Neutral:** readability of Operator and navigable ground.

Base palette: deep navy, muted teal, violet granite and olive ground; horizon/hope via amber utility, coral horizon and lavender air. Strong lights must communicate a **route, reward, threat, extraction, or character readability**. Color is information, not ambient decoration.

## Mobile-first readability and camera (pp. 8–9, 19–20)

Review the game in this order: **(1)** Operator, BIT, nearby threats; **(2)** routes and boundaries; **(3)** cover, landmarks and destinations; **(4)** atmosphere. If an asset only works in close-up, it cannot carry the visual direction.

**Rev 06 camera targets (implementation hypotheses, verify on device):**

| Shot | Operator size, % of screen height | Intended use |
| --- | --- | --- |
| Wide awareness | 10–11% | Distant threats, multiple danger directions |
| Default play | 12–13% | Regular exploration and fighting |
| Close pressure | 14–15% | Local pressure, only when no critical off-screen threat is lost |

Nominal pitch ≈52°, vertical FOV ≈38°, focus 2–3 m ahead, blend 0.4–0.7 s with hysteresis. Camera response must follow **threat visibility**, not merely "combat active." Fade geometry locally **only where** it obscures the Operator or critical threats; never make an entire asset invisible. Operator, BIT, enemies and objectives remain opaque. Route choices read through landmarks, light and material contrast—not glowing breadcrumb paths or HUD arrows.

## Operator identity (pp. 17–18)

An **adult**, lean, combat-capable, gender-neutral Operator; approximately 7.5–8 heads tall. Long legs, practical layered clothing, deep hood shadow, covered nose/mouth/jaw/neck, and no cute/chibi silhouette. The original OP-01 is a visual anchor, not a prohibition on the later-approved mechanically equivalent cosmetic Operator identities in Art Direction v07. Never inadvertently expose a full head/face in the opening/cinematic material that is intended to conceal the character.

## BIT — iconic character, locked face (pp. 21–24)

Rounded CRT body in petrol-teal, short antenna, modest side module, tiny **amber** status light and understated hover. BIT is helpful, loyal, emotionally readable, cheeky and capable of dry humor. Upgrades add believable functional hardware while preserving the character.

**Critical version distinction:** Rev 06 page 23 documents a historical **face proportion master v2.0** with a **387 U** endpoint-centre mouth span. The current owner-approved canonical vector in [`assets/bit-face-master-v3.svg`](../assets/bit-face-master-v3.svg) uses **370 U**, as documented by [`bit-character-spec.md`](bit-character-spec.md). The original face-sheet JPEG remains authoritative in the current specification; the legacy SVG remains unmodified for provenance. **Do not recreate the v2 mouth, regenerate a new face from the PDF, or replace any face master.** Preserve the v3 face, eye/mouth geometry and `#75CFCC` within its designated use; no external cyan glow strips. The existing, limited [BIT narrator artwork exception](bit-narrator.md) remains in force.

## The bunker and environmental storytelling (pp. 24–26)

Inside the bunker: CRT and terminal light, visible wiring, sparse practical lamps, selective amber warmth—no daylight pretending to light enclosed underground rooms. BIT's smile may appear at a larger architectural scale as an uncanny, emotionally meaningful mark. The world should frame combat rather than compete with it: readable Operator and BIT, quiet walkable surfaces, granite and trees organizing the edges, and warm destination light.

## Validation and production handoff (pp. 28–29)

Rev 06 proposes a **playable bunker-approach slice**, not another round of unbounded concept exploration. Check the playable implementation at actual phone size:

1. OP-01 is identifiable within 0.25 s.
2. OP-01, BIT and nearest threat are distinguishable without the HUD.
3. Main route, optional reward, and extraction read from world lighting and composition.
4. Foreground architecture/vegetation does not hide the Operator during critical play.
5. Geometry, materials, lighting and overdraw are feasible in mobile Low and High.
6. Overall emotional read is dark but hopeful, never generic dystopian sci-fi.

**Review rule for any new visual PR:** link the relevant Rev 06 pages, describe what is already implemented versus proposed, attach normal gameplay-camera evidence in mobile landscape, verify routes/threats/occlusion on-device or with targeted screenshots, and document deliberate exceptions. Do **not** claim that adopting this guide is equivalent to implementing its visual target.

## Status and source limitations

Rev 06 is a visual source, not a full art production kit; several spreads are concept references, not ready-to-import assets. Its page 30 region map is **orientation only**, not level layout or final scale. The PDF is currently hosted as a **private reduced-size reference on the owner's Drive**, because this documentation-only PR does not contain the original binary. Repository readers without permission can use this complete textual index and later-approved art specs but cannot inspect the illustrations until the owner grants source access or a separately approved PDF is committed to the repository.
