# October 25 art delivery

This is an asset-only handoff for `w4sser/protocol-rebirth-proto`, based on main commit `b5741f20c60be5393426854ac0ae45f7566c4aa4`.

## Delivered

- 47 inventory icons: `assets/items/<id>-512.png` and `.webp`, with real alpha.
- 47 normalized 1024 PNG masters: `assets/reference/items/<id>-1024.png`.
- Untouched generated item renders: `assets/reference/generated-native/items/`. The two BIT cosmetics reuse their matching BIT cutout originals.
- 21 BIT assets with PNG/WebP pairs in `assets/bit/`; approved native renders in `assets/reference/bit/oct25/`.
- Exact item IDs and paths: `docs/art-oct25-item-manifest.json`. Preserve case, especially `dataCores`.
- Inventory overview: `docs/art-oct25-items-preview.jpg`.

BIT master sheet is 2048 square. UI cutouts are 1024 square. The store scene is opaque 1536 x 1024. Item exports are 512 square.

## Owner correction

BIT must have NO glowing vertical cyan strips outside the screen. This overrides the side-strip wording in `docs/art-requests-oct25.md`. Keep two vertical oval cyan eyes and the broad curved smile. Mood comes from pose, tilt and props. No eyebrows, teeth, pupils or replacement emoticons. Preserve the existing `assets/bit-face-master.svg`; generated facial geometry is visually guided by it rather than an exact SVG overlay.

`bit-master-sheet-v2.png` and `bit-summary-bored-v3.png` are the selected native revisions. Rejected older renders are deliberately excluded from this Git handoff. Do not substitute them.

## Integration still needed

No gameplay, UI hooks, application version or save format changed. Adding these files alone does not display them in the game.

Follow the repository AGENTS.md work split for implementation. Add an item-image hook with PNG and SVG fallbacks, update relevant stash/reward/currency callers, and retain the shared sprite. Do not repurpose weapon-only `artImg` semantics. Wire BIT assets to authorized existing screens; mood triggers in the proposal are not implemented by this delivery. Apply the normal version bump and run `npm run verify` when shipping integration.

Inspect the 47-icon overview and BIT renders in the actual mobile landscape UI before final art approval. Native renders are preserved separately because generated source sizes differ from the normalized delivery sizes.

## Validation performed

All 47 PNG/WebP pairs and 47 masters were decoded and checked for exact dimensions and alpha. All 21 BIT pairs were checked for expected dimensions and cutout/scene alpha. Filenames were checked against the request catalog. No application test result is claimed for this asset-only handoff.

## Import the local Git bundle

The upload tool required approval unavailable in the session, so the remote repository was not changed. The bundle contains one local additive asset commit on `art/oct25-items-bit`; its root is an empty staging repository, not a clone of main.

In a clean checkout of the real repository, fetch the bundle branch, then cherry-pick its single commit onto a new branch based on current main. Git will stop on any path conflict; resolve deliberately and never overwrite newer originals blindly. Review the result and push normally without force. The application code and existing reference files are absent from this commit.
