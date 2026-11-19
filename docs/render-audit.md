# Raid renderer audit — graphics pilot 2.28.53

Baseline: origin/main `23ddddf8` (2.28.52). The inherited WIP `f7654231` already starts the pilot; this audit records the baseline rather than treating that snapshot as shipped behavior.

| Feature / baseline | Low | Medium | High | Cost / implementation |
| --- | --- | --- | --- | --- |
| Tone mapping / exposure | ACES | ACES | ACES | Renderer ACESFilmic, initial exposure 1.2; bunker environment rig overrides to 1.18. Town and archipelago have their own lighting/exposure blocks. |
| Bloom | Off | Off | On | postfx.js: UnrealBloomPass, strength .28, radius .35, threshold 1.1. Threshold over the entire scene, no layer selection: bright light props can contribute. Five blur mip levels plus bright extraction/composite. |
| Colour grade / vignette | Off | Off | On | One ShaderPass before OutputPass: desaturation .08, tint [.94,.97,1.05], strength .08, vignette .16 / radius .78. Same cold grade everywhere. No LUT. |
| Film grain | Off | Off | Off | No film-grain pass. Pixel combat particles are separate effects. |
| Antialias | Off | Renderer AA | Renderer AA | WebGLRenderer antialias follows boot quality. No FXAA/TAA or explicitly multisampled composer render targets (samples=0), so renderer AA does not smooth the High composer scene target. Context AA cannot be changed at runtime. |
| Shadows / resolution | Off / DPR cap 1 | 1024 / DPR cap 1.6 | 1024 / DPR cap 1.6 | PCF soft shadows; one directional shadow map. Actual DPR capped by devicePixelRatio. Props .55 / 1 / 1 density. |
| AO / lightmaps | Asset-dependent | Asset-dependent | Asset-dependent | No SSAO or general lightmap pass. GLTFLoader preserves occlusion textures / vertex colours when provided. environment-look.js groundPatchParts makes cheap soft contact patches, not ray-traced AO. Opt-in rocks-gen kit has CPU-baked vertex AO multiplied by analytic sky tint; it is not enabled in normal play. |
| Fake beams | Reduced | On | On | world.js loot cylinders gated by Q.beams; extraction shader cylinder + core + fence + ground decal remain on all tiers (40 particles / no scrolling noise on Low, 72 / noise otherwise). These are mesh effects, not volumetric scattering. |
| Ambient dust | Off | Off | On | dust.js: 80 additive points following the player, CPU-updated positions, one draw. |
| Combat cue FX | Reduced | On | On | pixel-fx.js and operator/vfx modules use pools, transparent particles/lines; these are not film grain or bloom selection. |

Sources: nodspel/game.mjs (renderer, area lights, runtime quality/watchdog, render loop), art.js (qualitySettings, fog, glow), postfx.js (composer), environment-look.js (light rig and contact patches), world.js (cue materials and beams), quality-ui.js (existing settings), dust.js, vfx-extract-beam.js, vendor/GLTFLoader.js, assets/env/nature/rocks-gen/README.md.

## Pilot scope and review criteria

Keep the bunker grade gentle and unchanged in numeric strength; town/archipelago use neutral colour transforms with the existing vignette. High retains grade/dust. Low renders directly. Medium adds half-width/half-height bloom (quarter pixel count), High full-size bloom. No new controls, art, camera changes, or kit activation.

Explicitly tag only gameplay emission: BIT lamp, fuel-drum danger bands/lid, live pad indicator and junction panel, extraction emission, and shelf strap. Environment, loot beams and light props must not become bloom sources. A black occluder mask must retain wall depth; the additive combine must use blurred bloom alone, not the original cue image plus bloom. Preserve original materials, fog and background even if a render throws; dispose pass-owned resources on quality changes. Review danger colours and telegraphs at phone sizes, especially High. Headless SwiftShader timings are relative comparisons only, never physical-phone performance evidence.
