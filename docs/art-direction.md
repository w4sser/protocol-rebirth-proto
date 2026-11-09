# Art Direction v07 — Gameplay Expression and Mobile Readability

**Status (9 November 2026):** v07 extends the established AD06 visual identity with gameplay art direction aligned to the owner-approved [M38–M41 design decisions](design-decisions.md). It is **not a new visual style**, a new gameplay mechanic, or approval for full-scale asset production. Exact models, facial expressions, animation clips, shaders, timings, technical solutions, and quality budgets remain subject to playable mobile tests.

**Historical source:** `ad06.pdf` (30 pages; owner review, 14 October). Key pages were previously rendered in `/workspace/art-direction/pages/` (p01, p07 palette, p08 readability, p22–23 BIT, p28 locked/open, p30 map). AD06 locked the tone, palette, OP-01, and BIT's original visual identity, while describing UI/HUD, weapons, combat VFX, enemies, and biomes as not yet fully designed.

**Precedence:** AD06's tone, environments, palette, typography, production restraint, and original master assets remain in effect. **v07 changes only the interpretation that OP-01 is the sole permitted playable appearance and that BIT may display only one static default expression**, and adds guidance for motion, enemy reactions, and visual hierarchy. The original BIT face master and previously approved reference assets must not be overwritten. Approved M38–M41 decisions take precedence over older conflicting proposals, including hitstop/slow-motion ideas in `design-combat-feel-oct28.md`.

## Tone

- **"Dark, but never hopeless."** The world is damaged but alive and worth rebuilding. Blue-hour light, a pale peach horizon, and healthy vegetation. No stormy apocalyptic skies, dead forests, toxic fog, or horror-ruin aesthetic. Never generic dystopian science fiction.
- **Pillars:** Stylized clarity (large forms that read on a phone); Nordic melancholy; production restraint (beauty through shape, color, and lighting rather than asset density); and human warmth (BIT).
- **"Soft nature, hard engineering."** Nature is asymmetrical and wind-shaped; built structures are straight, with thick horizontal slabs and modular Cold War concrete. Express Swedish identity through landscape and engineering, **never national symbols**.

## Palette (sampled from AD06, page 7)

| Role | Name | Hex |
| --- | --- | --- |
| World | Deep Navy | `#1B2740` |
| World | Muted Teal | `#2E5C63` |
| World | Violet Granite | `#7C7E97` |
| World | Olive Ground | `#8B8B6C` |
| Hope | Amber Utility | `#FF9D4D` |
| Hope | Coral Horizon | `#E4705F` |
| Hope | Lavender Air | `#B0A0C6` |
| Signal | BIT Cyan | `#3FE0D0` (swatch) / `#75CFCC` (BIT face master, page 23) |
| Signal | Warning | `#D9552F` |
| UI background / document text | | `#070F14` / `#F2E9D6` |

**Locked color semantics:** **Cyan** = BIT, powered systems, extraction; **amber** = loot, human warmth, higher risk/reward; **coral red** = hostile sensors and confirmed danger; **neutral contrast** = Operator separation and walkable terrain. Warm light is rare and therefore meaningful. Every strong light source should communicate a route, reward, threat, extraction, or character readability.

## Typography (from the embedded fonts in the AD06 PDF)

- **Headings:** Archivo Black/ExtraBold; uppercase, tight spacing.
- **Body:** IBM Plex Sans, Regular/Medium.
- **Labels, kickers, data:** IBM Plex Mono; uppercase with generous tracking.

## Iconography and UI Principles (Mobile Direction, Not a Finished HUD Layout)

1. **"Read the game before the detail."** If an element only works in close-up, it does not meet the art direction. Icons should be large, legible silhouettes at actual phone size, with minimal fine detail.
2. **Color carries meaning, not decoration:** cyan for systems/BIT/extraction, amber for loot/rewards, coral for danger, and neutral colors for everything else.
3. **No emoji, generic smileys, or national symbols.** BIT's **original face is the identity master**: vertical pill-shaped eyes and a filled U-shaped smile with tapered width (32→64→32; 1000×875 original master). M40 permits **controlled animated variation in gameplay**, not replacement or overwriting of the original master. See the expression rules below.
4. **Routes are conveyed through landmarks, pools of light, and material contrast**, not glowing paths or world-space UI arrows. Menu arrows remain acceptable.
5. **Baseline visual priority:** readable Operator, BIT, and immediate threats → routes/boundaries → cover/landmarks/objectives → atmosphere. **During active combat, enemy silhouettes, incoming attacks, telegraphs, lines of fire, and controls always take precedence over BIT emotes, cosmetics, and decorative effects.**

## Environment

- **Small kit, coherent world.** Reuse the AD06 material and asset families: granite for cover, boundaries, and landmarks; coastal pines in crouched/sentinel/crown forms; modular Cold War concrete portals, walls, and slabs; structural cover; and low-frequency terrain. No manicured lawns or one-off decorative props. Create variation through scale, rotation, overlap, partial burial, and light.
- **Walkable ground:** relatively flat, lighter, continuous, and low in texture noise. Hard boundaries use vertical granite, dense vegetation, and compressed values. Valid routes are framed by negative space, clear sightlines, and warm destination light.
- **Bunker interior:** CRT glow, wiring, and sparse practical lamps, never daylight. Amber utility lighting provides the only warmth.
- **Camera reference:** pitch ≈52°, vertical FOV ≈38°. Operator occupies 12–13% of screen height in the nominal view (10–11% for wider threats; 14–15% for near threats); focus is 2–3 m ahead; transitions take 0.4–0.7 seconds with hysteresis. Fade foreground objects locally only when they obscure OP-01 or a relevant threat.

## Characters and Original Identity

- **OP-01 (visual anchor, not the only playable appearance):** adult Operator, 7.5–8 heads tall; slender, agile, long-legged; gender-neutral silhouette; deep hood revealing only the eye area; cloth covering nose, mouth, and neck; straight clothing cuts. Stylized but never cute or chibi. **"Someone who chose to walk into danger."** Other cosmetic Operator looks may differ substantially while following M38's common gameplay foundation and phone-scale readability.
- **BIT (identity master):** softly rounded CRT body, petrol-teal casing, cyan screen, vertical pill eyes, broad U-shaped smile, short antenna, small side module, small amber status lamp, and calm hover. Earlier tier 1–3 hardware references and cosmetic shells should retain a recognizable BIT silhouette and face family; they do not automatically confer abilities. Personality: helpful, loyal, cheeky, with gallows humor. M40 allows selective expression animation, not a redesign into another character.
- **"The smile belongs to the world."** BIT's familiar smile may recur on environmental signs and screens, at once friendly and slightly unsettling.

## M38 — Character Art and Cosmetic Identities

- **One mechanical Operator, multiple looks.** OP-01 is a visual anchor, not an exclusive gameplay choice. Head shapes, clothing, materials, colors, and silhouettes may create distinct cosmetic identities, including human and more technological appearances. All retain **identical movement, reach, hitboxes/collision, weapon timing, and tactical outcomes**. No skin may provide more effective camouflage, a misleading visible body size, or another gameplay advantage.
- **Compatible movement language does not require identical rigs.** Every appearance must communicate the same functional actions and respond equally to input. A procedural character may use a different animation implementation, but cannot lack perceptible run/aim/fire/hit/death readability or behave differently mechanically.
- **Readability at the actual camera angle.** Facial and tiny outfit details are secondary. Players must locate their Operator quickly, understand facing and weapon direction, and distinguish the character from enemies in dark terrain, firefights, and dense vegetation. The visual target is landscape-mobile gameplay, not portraits or close-up renders.
- **Cosmetics are permanent visual ownership, not protected equipment.** Operator and BIT looks persist after raid death; weapons, armor, and loot remain subject to D1 risk rules. Skins introduce no classes, active skills, or separate progression trees. Prove the foundation with a few appearances before building a large catalog.

## M39 — Character Animation and Weapon Response

- **Action first.** Movement, changes in direction, aiming, and firing should follow the player's intent quickly and legibly. Animation can convey weight and momentum but must not gratuitously lock input, delay otherwise valid actions, or take away player control.
- **A shared behavior vocabulary across skins:** idle/running, turning, aiming, firing, dash, receiving damage, interacting, extracting, and defeat require readable visual states where applicable to actual actions. This is a **validation checklist**, not a fixed clip count or mandated rig.
- **Weapon weight through presentation.** Poses, perceived recoil, muzzle/impact response, and recovery motion can differentiate weapons and make the Basic Carbine satisfying. Animation alone must not cause extra damage, change hit validation, move hitboxes, or introduce a new recovery or interruption window.
- **Isometric discipline.** Important poses must read from the gameplay camera and at normal character scale. Excessive weapon swings, bodies blocking lines of sight, or theatrical movement should be cut when they compete with threat readability.
- **Open for production tests:** clip counts, blending and cancel priorities, root motion, rigs, timing, control feel, accessibility, and mobile performance. M39 does **not** grant blanket approval for hitstop or slow motion.

## M40 — BIT Expression Without Losing Its Identity

- **Preserve the signature face.** Two vertical pill eyes and the broad U-shaped mouth must remain recognizable. The approved `assets/bit-face-master.svg` is the reference and must not be overwritten. No eyebrows, teeth, pupils, interchangeable emoji faces, or decorative external glowing cyan strips. Avoid inventing a new character for each emotion.
- **Allow controlled gameplay expression.** Preferred tools are subtle eye/attention changes, CRT brightness, body tilt, altitude, hover rhythm, antenna motion, and small body poses. Gentle changes within the existing eye-and-smile family may be explored in art tests, **without locking new face geometry or a complete expression vocabulary here**. The original logo and static master assets remain unchanged.
- **Respond to real events, not constant timers.** Exploration, emerging threats, Operator damage, valuable discoveries, route decisions, extraction, and failure may prompt brief, understandable reactions. BIT should feel present during ordinary raids, yet stay restrained when the player needs to aim, dodge attacks, or comprehend the result of combat.
- **Body language before more UI.** No new mandatory popups, reaction meters, unwanted dialogue, constant flashing, or mood indicators in the HUD. Essential information must not depend on audio.
- **Expression is not a power.** BIT exists and can show personality before BIT Bay L1. Active combat support remains governed by M28–M35, requiring completed BIT Bay L1 and deliberate player activation. An animation cannot grant defense, distract enemies, rescue loot, reveal guaranteed loot, or auto-extract. Cosmetic BIT looks do not alter mechanics.

## M41 — Enemy Art and Combat Feedback

| Actual gameplay outcome | Visual and audio goal | Must not imply |
| --- | --- | --- |
| **Validated damaging hit** | Visible localized response on the correct enemy, suitable impact VFX, and a distinct short audio cue when audio is enabled | A miss, a blocked shot, or newly added stagger/stun |
| **Shield/armor block under existing rules** | Clearly different material and impact response from a damaging hit, readable from flank/rear angles where relevant | Confirmed damage when no damage was registered |
| **Confirmed enemy defeat** | A recognizable end state: pose/collapse, brief effect, and/or audio differentiated from an ordinary hit; disappearance should not look like a missed shot | Extra loot, another kill registration, or an invented mechanical state |
| **Miss/unvalidated hit** | Only the real world impact or projectile outcome; no false target reaction | Damage or defeated enemy |

- **Event truth over spectacle.** Every target response follows an actual validated game event. Visual flinch, deformation, or motion is *presentation*, not knockback, a new forced attack interruption, stun, extra damage, invulnerability, or changed collision. Existing legitimate mechanical effects must not be silently removed.
- **Distinct archetype rhythms, shared feedback language.** Fast enemies, armored targets, shields, and turrets may react differently, but players should understand damage, blocking, and defeat without first learning each animation. Enemy threats, front shields, attack telegraphs, and counterplay must remain visible.
- **Basic Carbine is the baseline.** Ordinary hits and defeats should feel satisfying with the starter weapon, without expensive skins, advanced weapons, or extra abilities. Feedback supports rather than obscures positional decisions and tactical combinations.
- **Reuse before inventing new technology.** Existing `nodspel/fx-feedback.js` already contains impact/hit/shield/explosion flows. Verify event binding and extend where needed before proposing an independent effects system. The older `design-combat-feel-oct28.md` contains *proposed* hitstop/slow-motion values; M41 did **not** approve them and they must not be included automatically.
- **Audio reinforces, rather than enables, comprehension.** The player must distinguish damage, blocking, and defeat when the phone is muted. Effects must not mask incoming shots, projectiles, danger telegraphs, interaction points, extraction, or UI controls. No particular timings, particle budgets, or technical approach are locked here.

## Mobile Visual Hierarchy — Priority in a Playable Scene

1. **Operator and immediately safety-critical information:** player location, orientation, nearby enemy threats, projectiles, and attack telegraphs.
2. **Actual combat outcome and navigation:** validated hit/block/kill cues, cover, walkable ground, navigable routes, interactables, and extraction.
3. **BIT and context:** BIT's silhouette, presence, and brief meaningful expressions, always visually quieter during active firefights.
4. **Worldbuilding and decoration:** atmosphere, secondary props, subtle particles, and microdetail; reduce these first on Low settings.

Always test on a real small phone in landscape, with sound on/off and limited effects. Readability must not rely on rim lighting, tiny face details, advanced shaders, or high-quality-only settings. Favor clean large forms and a few distinct effects over dense particles and high-frequency textures. Work toward the game's existing Low-mode performance target; set new numerical graphics budgets only after measuring the actual build.

**Concept art versus game production:** Earlier phone and environmental concepts approaching photorealism are references for *mood, lighting, composition, and material feel*. They are not requirements for photorealistic geometry, high-frequency textures, or extra post-processing. The world's stylized low-poly foundation and production restraint are unchanged.

## Current Implementation Checkpoints (Not a Delivery Report)

- `nodspel/characters.js` lists `operator`, `punk`, and `robot`. The first two declare shared animation clips; `robot` is procedural and declares null for all named clips. This does **not** prove that the robot lacks procedural motion, but M38–M39 require **perceived animation and behavior parity** on a phone before treating it as equivalent.
- `nodspel/fx-feedback.js` already includes multiple visual events. Their presence does not prove that the playable game meets M41; in particular, damage versus shield blocks and distinct visible defeats still need playtesting.
- The code references above are an inventory at documentation revision, **not** a claim that the playable build already complies with M38–M41.

## Next Step — Mobile Proof of Fun / Vertical Slice (Not Implementation Authorization)

*Only after separate approval for code and asset production*, build a small ordinary raid scene featuring one fully responsive animated Operator, Basic Carbine, a few existing representative enemies, event-accurate hit/block/defeat feedback, and 2–3 meaningful event-driven BIT reactions. Also test a visually distinct second Operator look (potentially the procedural robot if suitable) for mechanical and animation parity, **not** to pad the skin catalog.

**Validate on a real phone with the normal gameplay camera, Low settings, and sound on/off:**
- Can players predict movement, aim and fire clearly, locate their Operator, and recognize hits and defeats without hesitation?
- Can they tell damaging hits, shield blocks, misses, and confirmed kills apart while still reading enemy threats, projectiles, and counterplay?
- Does BIT's response convey character without competing with combat or suggesting a locked/unlocked power that was not actually used?
- Do visually distinct skins behave identically mechanically, and do their movements feel equally responsive?
- Do frame pacing and readability hold during dense encounters and reduced mobile effects, including with sound muted?

**Record observations and misunderstandings** (misread hits/kills, perceived unfair damage, obscured threats, lost control, FPS and frame pacing) before producing more skins, larger expression libraries, or more elaborate FX. Exact animation choices, timings, system architecture, and mobile budgets are to be settled through that validation.

## Original AD06 Milestone (Historical Reference)

The playable **"bunker approach slice"** originally aimed for: OP-01 identifiable in 0.25 seconds; OP-01, BIT, and the nearest threat distinguishable without HUD; primary route, optional reward, and extraction communicated through light; no occlusion of OP-01; production feasible on mobile; and a mood that is dark but hopeful.
