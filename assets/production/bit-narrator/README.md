# BIT narrator art (PRB-153)

Source art: Robert Wasser's ChatGPT deliveries, 2026-11-14 (chat t379u, re-sent in t380u). He approved them for use as-is. The original PNG masters are kept outside git at `/home/box/prp-art/bit-narrator-2026-11-14/` on the build box; none of them were modified.

| File | Use | Transformations |
|---|---|---|
| `bust-tilt-happy-v1.webp` | BIT card, mood `happy` | cropped to the alpha bbox, longest side 384 px, WebP q82 |
| `bust-tilt-sad-v1.webp` | BIT card, mood `sad`/`worried` | same |
| `bust-tilt-smile-v1.webp` | BIT card, mood `smile`/`calm` | same |
| `bust-tilt-skeptical-v1.webp` | BIT card, mood `skeptical`/`tired` | same |
| `bust-tilt-happy-alt-v1.webp` | spare happy | same |
| `bust-pedestal-{happy,happy-alt,sad,smile,skeptical}-v1.webp` | alternates (pedestal framing), unused for now | same |
| `cutscene-core-restore-start-v1.webp` -> `cutscene-core-restore-end-v1.webp` | first Core restore mini cutscene (crossfade) | 1870x841 resized to 1600x720, WebP q78 |
| `cutscene-first-death-sad-v1.webp` -> `cutscene-first-death-happy-v1.webp` | first death mini cutscene (sad -> happy crossfade) | same |
| `cutscene-fabricator-dark-v1.webp` -> `cutscene-fabricator-powered-v1.webp` | first Fabricator built mini cutscene (dark -> powered crossfade); delivered by Robert 2026-11-15 from the ChatGPT brief, masters at `/home/box/prp-art/fabricator-2026-11-15/` | 1870x841 resized to 1600x720, WebP q78/q72 (55 KB / 71 KB) |
| `cutscene-vault-dark-v1.webp` -> `cutscene-vault-powered-v1.webp` | Vault unlock mini cutscene (dark -> powered crossfade); delivered by Robert 2026-11-16, masters at `/home/box/prp-art/vault-2026-11-16/` | 1870x841 resized to 1600x720, WebP q78/q72 (82 KB / 106 KB) |

The `bust-tilt-bright-cyan` delivery is intentionally not shipped: its bright cyan face conflicts with the #248 face color.

Identity note: these busts show BIT with expressions (cracked screen, amber lamp). Robert approved them on 2026-11-14 for the BIT narrator card and its cutscenes only, as an explicit exception to the single-face rule in `docs/bit-character-spec.md` (#248). The #248 rules still apply everywhere else: the 3D BIT, the HUD, and the cold open.
