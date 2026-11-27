# Shipping audio sources and licenses

Most synthesis is local and free; a handful of combat/UI cues below are Lumina SFX renders (free offline OSS, commercial-game-use license, no credit required -- see `tools/audio/lumina-masters/credits.json` for the exact recipe/recording per file). We ship only the rendered cues; the Lumina catalog/sources/recipes are not vendored or redistributed.
Everything else (original procedural SFX and music) is dedicated to the public domain under CC0-1.0 by the project owner.
Generator: `tools/audio/gen-sfx.py`, numpy seed 20261028 with SHA256 per-file seeds; Lumina-replaced cues ship from the committed master in `tools/audio/lumina-masters/` instead, so a regen cannot silently overwrite them.
The existing F1 BIT recordings are preserved; AAC copies use ffmpeg locally.
BIT source: `tools/audio/gen-bit-voice.py`, original project text, Kokoro-82M am_fenrir (Apache-2.0 model/voice), kokoro-onnx (MIT runtime). All 18 BIT voice files (nine recordings in Ogg and AAC formats) are our own generated outputs. Copyright © 2026 Robert Wasser. All rights reserved; not licensed for reuse. Apache-2.0 and MIT describe upstream model and runtime provenance, not the license of these recordings.
Provenance: https://huggingface.co/hexgrad/Kokoro-82M and https://github.com/thewh1teagle/kokoro-onnx . See `docs/audio-pipeline.md` for the exact F1 processing.
CC0 dedication: https://creativecommons.org/publicdomain/zero/1.0/ . No Piper audition clips ship.

| File | Source | License/provenance |
|---|---|---|
| `bit/bag-heavy.m4a` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/bag-heavy.ogg` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/extraction-marked.m4a` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/extraction-marked.ogg` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/heal-budget-low.m4a` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/heal-budget-low.ogg` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/hunters-inbound.m4a` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/hunters-inbound.ogg` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/nice-shot.m4a` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/nice-shot.ogg` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/scrap-detected.m4a` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/scrap-detected.ogg` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/signal-lost.m4a` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/signal-lost.ogg` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/welcome-back.m4a` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/welcome-back.ogg` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/youre-back.m4a` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `bit/youre-back.ogg` | Local F1 Kokoro am_fenrir TTS; original project dialogue | All rights reserved © Robert Wasser |
| `music/pulse.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `music/pulse.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/alarm.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/alarm.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/bag-full.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/bag-full.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/dash.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/dash.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-generator.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-generator.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-grunt.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-grunt.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-rusher.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-rusher.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-tank.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-tank.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-thrower.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-thrower.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-turret.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death-turret.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/death.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/empty-carbine.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/empty-carbine.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/empty-rifle.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/empty-rifle.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/empty-shotgun.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/empty-shotgun.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/empty-smg.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/empty-smg.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/explosion.m4a` | Lumina SFX render, recipe `grenade-explosion`; "Firecracker Explosion" by unfa; "Concrete Breaks Several Denoised" by loganzsound | CC0-1.0 |
| `sfx/explosion.ogg` | Lumina SFX render, recipe `grenade-explosion`; "Firecracker Explosion" by unfa; "Concrete Breaks Several Denoised" by loganzsound | CC0-1.0 |
| `sfx/extract-countdown.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/extract-countdown.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/extract-success.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/extract-success.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-generator.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-generator.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-grunt.m4a` | Lumina SFX render, recipe `dull-torso-hit-followed-by-cloth`; "Feet Landing On Ground" by elynch0901; "Foley_Clothes_Jacket_Whoosh_Sequence_Stereo.wav" by Nox_Sound; "Rustling foliage.WAV" by DDT197 | CC0-1.0 |
| `sfx/hit-grunt.ogg` | Lumina SFX render, recipe `dull-torso-hit-followed-by-cloth`; "Feet Landing On Ground" by elynch0901; "Foley_Clothes_Jacket_Whoosh_Sequence_Stereo.wav" by Nox_Sound; "Rustling foliage.WAV" by DDT197 | CC0-1.0 |
| `sfx/hit-rusher.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-rusher.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-tank.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-tank.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-thrower.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-thrower.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-turret.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hit-turret.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hunter-wave.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/hunter-wave.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/impact-enemy.m4a` | Lumina SFX render, recipe `flesh-impact`; "Cabbage being chopped 2.wav" by MessyAcousticApocalypse666; "digging into mud.wav" by Stefan21100190 | CC0-1.0 |
| `sfx/impact-enemy.ogg` | Lumina SFX render, recipe `flesh-impact`; "Cabbage being chopped 2.wav" by MessyAcousticApocalypse666; "digging into mud.wav" by Stefan21100190 | CC0-1.0 |
| `sfx/impact-wall.m4a` | Lumina SFX render, recipe `metal-ricochet` (studio synthesis, no underlying recording) | Lumina SFX sound license (commercial game use, no credit required) |
| `sfx/impact-wall.ogg` | Lumina SFX render, recipe `metal-ricochet` (studio synthesis, no underlying recording) | Lumina SFX sound license (commercial game use, no credit required) |
| `sfx/kill.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/kill.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/medkit.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/medkit.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/mortar-launch.m4a` | Lumina SFX render, recipe `antique-powder-report`; "Cannon Fires, Take 3, Quarter Speed, Debris" by CHallSmith | CC0-1.0 |
| `sfx/mortar-launch.ogg` | Lumina SFX render, recipe `antique-powder-report`; "Cannon Fires, Take 3, Quarter Speed, Debris" by CHallSmith | CC0-1.0 |
| `sfx/perk-open.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/perk-open.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/perk-select.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/perk-select.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-common.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-common.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-epic.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-epic.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-legendary.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-legendary.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-rare.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-rare.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-uncommon.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/pickup-uncommon.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/reload-carbine.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/reload-carbine.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/reload-rifle.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/reload-rifle.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/reload-shotgun.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/reload-shotgun.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/reload-smg.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/reload-smg.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/shoot-air.m4a` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/shoot-air.ogg` | Original seeded numpy procedural synthesis | CC0-1.0 |
| `sfx/shoot-carbine.m4a` | Lumina SFX render, recipe `patrol-autocarbine-close-dry-report`; "Two close range shots.wav" by moosegravy; "Explosion in a can" by SamsterBirdies; "Bouncing Shell Casings (Various Sizes)" by GryffDavid | CC0-1.0 |
| `sfx/shoot-carbine.ogg` | Lumina SFX render, recipe `patrol-autocarbine-close-dry-report`; "Two close range shots.wav" by moosegravy; "Explosion in a can" by SamsterBirdies; "Bouncing Shell Casings (Various Sizes)" by GryffDavid | CC0-1.0 |
| `sfx/shoot-rifle.m4a` | Lumina SFX render, recipe `marksman-rifle-close-dry-report`; "Rifle Gun Shot AK47. close recording in a shooting range." by felix.blume; "Distant Gunfire" by iainmccurdy; "Tank Tread" by 77Pacer | CC0-1.0 |
| `sfx/shoot-rifle.ogg` | Lumina SFX render, recipe `marksman-rifle-close-dry-report`; "Rifle Gun Shot AK47. close recording in a shooting range." by felix.blume; "Distant Gunfire" by iainmccurdy; "Tank Tread" by 77Pacer | CC0-1.0 |
| `sfx/shoot-shotgun.m4a` | Lumina SFX render, recipe `pump-scattergun-close-dry-report`; "Firecracker Explosion" by unfa; "Rifle Gun Shot AK47. close recording in a shooting range." by felix.blume; "Tank Tread" by 77Pacer | CC0-1.0 |
| `sfx/shoot-shotgun.ogg` | Lumina SFX render, recipe `pump-scattergun-close-dry-report`; "Firecracker Explosion" by unfa; "Rifle Gun Shot AK47. close recording in a shooting range." by felix.blume; "Tank Tread" by 77Pacer | CC0-1.0 |
| `sfx/shoot-smg.m4a` | Lumina SFX render, recipe `security-submachine-gun-close-dry-report`; "Two close range shots.wav" by moosegravy; "Pump Action Shotgun Reload" by AugustSandberg; "Bouncing Shell Casings (Various Sizes)" by GryffDavid | CC0-1.0 |
| `sfx/shoot-smg.ogg` | Lumina SFX render, recipe `security-submachine-gun-close-dry-report`; "Two close range shots.wav" by moosegravy; "Pump Action Shotgun Reload" by AugustSandberg; "Bouncing Shell Casings (Various Sizes)" by GryffDavid | CC0-1.0 |
| `sfx/ui-back.m4a` | Lumina SFX render, recipe `settings-toggle-off-cork`; "Light Switch ON / OFF" by FillSoko | CC0-1.0 |
| `sfx/ui-back.ogg` | Lumina SFX render, recipe `settings-toggle-off-cork`; "Light Switch ON / OFF" by FillSoko | CC0-1.0 |
| `sfx/ui-confirm.m4a` | Lumina SFX render, recipe `settings-toggle-engage-brass`; "Light Switch On Off.flac" by qubodup | CC0-1.0 |
| `sfx/ui-confirm.ogg` | Lumina SFX render, recipe `settings-toggle-engage-brass`; "Light Switch On Off.flac" by qubodup | CC0-1.0 |
| `sfx/ui-tap.m4a` | Lumina SFX render, recipe `physical-light-switch`; "Light Switch On Off.flac" by qubodup | CC0-1.0 |
| `sfx/ui-tap.ogg` | Lumina SFX render, recipe `physical-light-switch`; "Light Switch On Off.flac" by qubodup | CC0-1.0 |

Total shipping audio: 734,095 bytes, 116 files (both formats included).
