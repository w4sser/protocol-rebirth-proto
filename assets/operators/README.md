# OP-01 operator art: static sources and animated production LODs

The original unrigged TRELLIS/Blender assets already committed in this
directory are kept for comparison. The new rigged handoff of 2026-11-18
contains four additional production GLBs. LOD0/1/2 have been committed as
native GLB files. The unchanged Menu GLB is committed as three binary
segments because the connector cannot send a 5.8MB blob in one request.

## New rigged handoff assets (committed on the PR branch)

| File | Triangles including weapon | Bytes | SHA-256 |
|---|---:|---:|---|
| OP01_Menu.glb (split into .part0/.part1/.part2) | 68,417 | 5,821,928 | dc95dcf26cafda33bc19884bee74eaa4664e2ab1e55b689a29f3fcf382e299a3 |
| OP01_Game_LOD0.glb | 25,637 | 2,581,620 | dcac60945a04bf20b62da4f3e06aea48c50ef03121607f7255a46324863134ad |
| OP01_Game_LOD1.glb | 12,106 | 1,326,892 | d7188fff4f31b61b868c68db9c04c000368a26e7f41cea23c10f7e7e521cc6d7 |
| OP01_Game_LOD2.glb | 6,156 | 906,024 | 2563d018a65ad9c365979d8fbc500289c4ace3d028d367b01210041abd6682c4 |

All four are self-contained glTF 2.0, with the same 41-bone Mixamo rig,
identical bind matrices, and embedded PBR textures. Clips: idle, run, aim,
shoot, hit, dash, death, hero_pose.

The supplied OP01_Validation.md labels death as pending, but every actual
export includes a 1.8-second death animation. The GLBs take precedence.
The ZIP does NOT include OP01_Source_Rigged.blend or OP01_Mixamo.fbx.
Those editable source files remain in Claude Cowork and should be archived
separately.

## Game integration

- ui/raid-prep-op01.mjs: Deploy loads OP01_Menu.glb, applies the low-ready
  hero_pose animation and maintains 360-degree touch rotation. The previous
  procedural operator remains as a fallback. BIT stays a separate 3D model.
- nodspel/op01-gameplay.js: isolated adapter with the same presentation API
  as operator.js. One AnimationMixer drives the Mixamo skeleton. All four
  skinned body material primitives swap together. The carbine remains attached
  to the RightHand bone and has a named muzzle for VFX.
- OP01 is the default gameplay skin in every raid, even on low quality and
  during FTUE, without a `skin` URL parameter. For legacy debug comparisons
  use `?skin=operator`, `?skin=punk`, or `?skin=robot`. If the OP01
  asset fails, the prior hooded operator (then robot) is an emergency fallback.
  Gameplay stats, collisions, equipment and saves are unchanged.
- LOD transitions use projected pixel height with hysteresis: roughly
  180 px for LOD0, 70-180 px for LOD1, below 70 px for LOD2.
- test/op01-assets.test.js checks exact triangles, embedded textures,
  bone order, inverse bind matrices and animation presence.
- nodspel/tests/op01-gameplay.test.mjs checks rig actions and LOD switching.

## Gates before merge

1. Verify all six committed binary blobs exist on the PR branch:
   OP01_Game_LOD0/1/2.glb and OP01_Menu.glb.part0/1/2.
   Node tests reassemble the Menu GLB and compare its original SHA-256.
   The browser concatenates the three parts before passing the exact bytes
   to GLTFLoader.parseAsync. Do not treat these as independent GLB files.
2. Run the full CI. A missing rigged asset is a test failure, not approval
   of the procedural fallback.
3. Inspect Deploy normally (or `?preview=deploy` for an isolated preview).
   Enter any raid from Deploy or directly without a skin flag. Explicit
   legacy skins remain available for debugging.
4. Check skinning, coat penetration, low-ready pose, right-hand weapon
   attachment, muzzle FX, damage/hit/dash/death and mobile frame-rate.
5. Compare LOD silhouettes at real top-down gameplay camera scale.
6. Merge only after CI and visual/performance QA pass.

## Original unrigged references

- OP01_Mobile.glb: original unrigged Mobile, 68,072 triangles
- OP01_Hero.glb: original unrigged Hero, 247,895 triangles

These are NOT the animated production assets.
