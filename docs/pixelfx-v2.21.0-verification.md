# v2.21.0 PixelFX and vibration verification

- Root `npm test`: passed.
- `npm --prefix nodspel test`: 726 passed, zero failures.
- Focused effects/haptics tests after final visual adjustment: 12 passed.
- Guardrails and `git diff --check`: passed.
- Browser demo: all nine variants in a 32-slot pool with 128px textures;
  Low clears all effects, Vibration off persists, zero page errors.
- Smoke playthrough: passed with `NODE_PATH` pointing to this repository's
  locally installed browser tooling and `CHROME_PATH=/usr/bin/google-chrome`.

The full `/workspace/qa.sh` gate was not green. Layout checking reported a
boot-loader timeout, the documented world-map Bunker/Archipelago overlap,
and base generator controls covered by Raid Exit / the tracked quest.
Its smoke invocation could not resolve Puppeteer from the shared tools
directory; the explicit-environment rerun above passed. No merge or release
was performed. These layout findings remain for follow-up.

Protected files were checked against their original contents: only permitted
`?v=` tags changed. No camera logic, GLB files, or font assets changed.

Local screenshots: `verify-out/pixelfx-demo-medium.png` and
`verify-out/pixelfx-settings.png` (ignored artifacts).
