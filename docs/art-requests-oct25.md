# Art requests — October 25

**47 icon requests: 36 non-weapon item IDs + 5 current currencies/resources + 6 distinct BIT shop unlocks.** Two shop material listings reuse existing item requests. Legacy Salvage reuses Scrap and needs no new image. BIT character art is listed separately in section 2.

Documentation only: these are production briefs, not implemented art hooks or approval of new game systems. Sources: `data/items.js`, `data/recipes.js`, `data/bit.js`, `data/vendors.js`, `data/quests.js`, `data/progression.js`, relevant definitions and rendering in `app.js`, `docs/design-playtest-oct25.md`, `docs/art-direction.md`, and `docs/art-pipeline-and-legacy-guide.md`.

## 1) STASH ITEM ICONS

### Shared STYLE HEADER

Paste this complete header, then append exactly one table row's **Item line**. The resulting message is one full prompt. Attach a weapon reference such as `assets/weapons/carbine-1-512.png` to establish material rendering.

```text
Create one inventory object icon for Protocol Rebirth. Match the attached weapon art: semi-realistic painted 3D rendering of worn, salvaged Cold-War military and industrial equipment, strong readable silhouette, believable matte metal, fabric, rubber and polymer, restrained hand-painted detail, chipped paint and modest use wear. Dark teal, muted olive, navy and neutral steel; small cyan accents only for powered systems, warm amber only where the object calls for it. Neutral soft studio lighting, gentle edge highlights, no dramatic colored environment lighting. Single isolated object or the explicitly requested small bundle, centered, shallow three-quarter product view (front three-quarter for clothing), no human character or hands; only the explicitly requested BIT cosmetic rows may depict a robot character. Square 1024 x 1024 PNG with a genuinely transparent alpha background; no checkerboard, opaque background, floor, environment, cast ground shadow or vignette. Fit the complete silhouette within a centered 880 x 880 box, preserving a 72-pixel minimum transparent margin; make its longest dimension fill that box. Maintain clear separation and readable large forms at small mobile inventory size. No UI frame, rarity border, numbers, captions, readable text, logos, national flags or emblems. Do not add extra objects. Output a transparent PNG, not a mockup.

ITEM: [paste one Item line here]
```

### Verified references and exact delivery spec

Pillow inspection of the actual PNG and WebP pairs (dimensions are width x height):

| Weapon reference | 1600-wide master | 512-wide derivative |
|---|---|---|
| carbine-1 | 1600 x 495 | 512 x 159 |
| carbine-2 | 1600 x 556 | 512 x 178 |
| carbine-3 | 1600 x 540 | 512 x 173 |
| smg-1 / smg-2 | 1600 x 727 | 512 x 233 |
| smg-3 | 1600 x 688 | 512 x 220 |
| smg-4 | 1600 x 700 | 512 x 224 |
| shotgun-1 | 1600 x 349 | 512 x 112 |
| shotgun-2 / shotgun-3 | 1600 x 400 | 512 x 128 |
| shotgun-4 | 1600 x 403 | 512 x 129 |

These are horizontal side-view renders that fill their rectangular crop. The 1600-wide PNGs are palette mode with transparency; their WebPs and the 512-wide derivatives are RGBA. Keep that painted material treatment, using a square crop and shallow three-quarter view for non-weapon objects so armor and small parts remain readable.

**Delivery:** one original 1024 x 1024 transparent PNG per request, saved under `assets/reference/items/<id>-1024.png`; two game-sized exports per request, `assets/items/<id>-512.png` and `assets/items/<id>-512.webp`, both exactly 512 x 512 with alpha. IDs retain exact case, including `dataCores`. Table target notation `<id>-512.{png,webp}` means those two literal files under `assets/items/`.

**Current rendering:** `IC(n)` in `app.js` emits `<svg><use href="assets/icons/sprite.svg#...">`. `itemIcon(id)` uses `artImg` for attachment art in `assets/weapons/`, tiered weapon art for `art`, and otherwise the item's SVG symbol. Stash tiles use this helper; currency/reward and other UI paths also call SVG icons directly. The existing `hero` fields for area materials/shop rewards point to large `assets/art/` previews, not stash icons. Merely adding the proposed files will not display them. The exports are integration-ready assets; a later authorized code change must add an item-image hook and PNG fallback, update relevant callers, and retain SVG fallback. Do not repurpose weapon-only `artImg` paths or replace the shared sprite. This request makes no code, version or save changes.

**Exact export steps (instructions only; run later after assets are approved):**

1. Download the generated PNG with real alpha. Check it against dark and light backgrounds. An image of a checkerboard is not transparency. Regenerate if alpha is missing, the silhouette is clipped, or fine details disappear at inventory size.
2. Save the untouched original to `assets/reference/items/<id>-1024.png`. Never overwrite originals; rejected revisions get separate reference names. The script below reads but never edits it.
3. With Python 3 and Pillow installed, run from the repo root, substituting one exact ID. This trims transparent padding, fits to a 440-pixel box, centers on 512 square, and writes PNG plus lossless WebP with alpha. It refuses nontransparent inputs or existing exports.

```bash
python3 - power_cell <<'PYEXPORT'
import sys
from pathlib import Path
from PIL import Image
item_id = sys.argv[1]
src = Path('assets/reference/items') / (item_id + '-1024.png')
im = Image.open(src).convert('RGBA')
assert im.size == (1024, 1024), 'Deliver a 1024-square master'
alpha = im.getchannel('A')
assert alpha.getextrema()[0] == 0, 'Missing transparent background'
bbox = alpha.getbbox()
assert bbox, 'Empty image'
assert bbox[0] > 0 and bbox[1] > 0 and bbox[2] < 1024 and bbox[3] < 1024, 'Clipped edge'
obj = im.crop(bbox)
scale = 440 / max(obj.size)
obj = obj.resize(tuple(max(1, round(v * scale)) for v in obj.size), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
canvas.alpha_composite(obj, ((512 - obj.width) // 2, (512 - obj.height) // 2))
dest = Path('assets/items')
png = dest / (item_id + '-512.png')
webp = dest / (item_id + '-512.webp')
assert not png.exists() and not webp.exists(), 'Review existing exports before replacing'
dest.mkdir(parents=True, exist_ok=True)
canvas.save(png, optimize=True)
canvas.save(webp, 'WEBP', lossless=True, method=6, exact=True)
for path in (png, webp):
    check = Image.open(path).convert('RGBA')
    assert check.size == (512, 512) and check.getchannel('A').getextrema()[0] == 0
    print(path)
PYEXPORT
```

The generic `tools/add-art.py` pipeline serves environment/production art; this explicit Pillow recipe preserves square icon framing and alpha. Do not apply environment crops or opaque backgrounds to icons.

### Item prompt catalog

All visual details below are art interpretations of existing definitions, not new gameplay properties. Each row represents one request; repeat the shared header for each generation.

#### Power and electrical materials

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `power_cell` | Power Cell | `power_cell-512.png`, `power_cell-512.webp` | A squat rectangular industrial charge pack, dark olive metal casing, black rubber corners, two exposed steel terminals and a small cyan charge slit, chipped edges. |
| `cable` | Cable | `cable-512.png`, `cable-512.webp` | One compact loop of thick black industrial cable, frayed olive binding strap, exposed dull copper ends, scuffed rubber jacket. |
| `fuse` | Fuse | `fuse-512.png`, `fuse-512.webp` | One chunky ceramic cartridge fuse with brushed steel end caps, off-white ceramic, a tiny amber inspection window, grime at the seams. |
| `power_relay` | Power Relay | `power_relay-512.png`, `power_relay-512.webp` | A salvaged electromechanical relay block, dark teal steel housing, visible copper winding and sturdy contact lugs, worn mounting feet. |
| `tidal_coil` | Tidal Coil | `tidal_coil-512.png`, `tidal_coil-512.webp` | A salt-cured induction coil, thick copper winding around a dark iron core, sea-green oxidation and chalky salt deposits, battered teal mounting bracket. |

#### Mechanical and structural materials

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `scrap_alloy` | Scrap Alloy | `scrap_alloy-512.png`, `scrap_alloy-512.webp` | A small tied bundle of bent alloy offcuts and perforated steel strips, dull gray metal, scratched olive paint and rust at cut edges; visibly raw scrap rather than currency. |
| `servo` | Servo | `servo-512.png`, `servo-512.webp` | One compact actuator motor with a short geared spindle, brushed steel cylinder, olive mounting bracket, black lead and oily scratches. |
| `polymer_plate` | Polymer Plate | `polymer_plate-512.png`, `polymer_plate-512.webp` | One curved armor insert blank, charcoal composite polymer, exposed layered edges and light abrasions, no vest or straps. |
| `hydraulic_component` | Hydraulic Component | `hydraulic_component-512.png`, `hydraulic_component-512.webp` | A heavy compact hydraulic piston assembly, dark steel barrel, polished worn shaft, black hose coupling and chipped teal paint. |
| `frost_glass` | Frost Glass | `frost_glass-512.png`, `frost_glass-512.webp` | One thick angular pane of pale blue frosted glass, cloudy frozen interior, chipped beveled edge and a dull steel retaining clip; no floating particles. |

#### Electronics and communications

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `circuit_board` | Circuit Board | `circuit_board-512.png`, `circuit_board-512.webp` | One salvaged dark green circuit board, large readable chips and copper traces, tarnished edge connector, one repaired solder joint and scuffed corners. |
| `optical_sensor` | Optical Sensor | `optical_sensor-512.png`, `optical_sensor-512.webp` | A compact military optical sensor module, charcoal metal cube with one recessed smoky blue lens, teal mounting ring and scratched edges; not a weapon scope. |
| `memory_module` | Memory Module | `memory_module-512.png`, `memory_module-512.webp` | A rugged removable memory cartridge, dark teal metal shell, gold contact teeth and a small cyan status notch, worn latch. |
| `transmitter` | Transmitter | `transmitter-512.png`, `transmitter-512.webp` | A compact long-range radio transmitter, scratched olive box, short folded whip antenna, heavy tuning knob and black rubber connector covers. |

#### Bio, medical and consumables

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `med_gel` | Med Gel | `med_gel-512.png`, `med_gel-512.webp` | One squat sealed sterile gel tube, translucent pale aqua contents, off-white cap and faded teal sleeve, scuffed outer packaging without text. |
| `bio_sample` | Bio Sample | `bio_sample-512.png`, `bio_sample-512.webp` | One sealed laboratory vial in a protective steel collar, cloudy amber-green sample inside, dark rubber stopper and worn transport clip; no gore. |
| `purification_filter` | Purification Filter | `purification_filter-512.png`, `purification_filter-512.webp` | One cylindrical air filter cartridge, dark gray ribbed shell, off-white pleated filter visible through cutouts, olive end cap and grime on the outer rim. |
| `medkit` | Medkit | `medkit-512.png`, `medkit-512.webp` | A compact field medical pouch, faded off-white coated canvas, teal webbing, tough zipper and visibly repaired seams, no cross or emblem. |
| `ammo_pack` | Ammo Pack | `ammo_pack-512.png`, `ammo_pack-512.webp` | A compact opened military ammunition carton showing a tidy row of brass cartridge bases, muted olive cardboard and dark fabric retaining strap, worn corners; no gun. |

#### Protocol and rare story materials

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `encrypted_drive` | Encrypted Drive | `encrypted_drive-512.png`, `encrypted_drive-512.webp` | A rugged sealed data drive, blackened steel shell, recessed connector, small cyan lock-shaped hardware inset without lettering, scratched tamper plate. |
| `ai_fragment` | AI Fragment | `ai_fragment-512.png`, `ai_fragment-512.webp` | An irregular broken processor substrate held in a dark metal protective bracket, translucent smoky teal layers, restrained cyan light along fractured internal traces. |
| `rebirth_shard` | Rebirth Shard | `rebirth_shard-512.png`, `rebirth_shard-512.webp` | One dense angular crystalline technology shard, smoky blue-green translucent body, dark metallic inclusions and a faint cyan inner seam, chipped facets. |
| `neural_core` | Neural Core | `neural_core-512.png`, `neural_core-512.webp` | A compact spherical computing core inside a thick segmented dark teal metal cage, cyan central lens, exposed gold contacts and heat-darkened edges. |
| `core_ash` | Core Ash | `core_ash-512.png`, `core_ash-512.webp` | A shallow sealed sample canister of coarse charcoal ash and burnt metallic flakes, soot-blackened steel rim, a few faint amber flecks, worn teal lid leaned against the canister. |

#### Scouting, quest and sellable valuables

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `archipelago_chart` | Archipelago Chart | `archipelago_chart-512.png`, `archipelago_chart-512.webp` | A folded waterproof island chart with one opened flap, muted blue-gray coast shapes, cream weatherproof paper, worn transparent cover and a dark teal binding clip; no readable labels or flags. |
| `town_survey` | Town Survey | `town_survey-512.png`, `town_survey-512.webp` | A compact stack of cream survey sheets on a battered olive clipboard, simple gray building plan shapes and cyan pencil strokes, curled corners, no readable writing. |
| `prewar_relic` | Prewar Relic | `prewar_relic-512.png`, `prewar_relic-512.webp` | One old precision pocket chronometer in a tarnished brass case, cracked dark glass, simple unnumbered dial and worn leather loop; quietly valuable rather than magical. |

#### Armor, rigs and clothing

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `scavenger_vest` | Scavenger Vest | `scavenger_vest-512.png`, `scavenger_vest-512.webp` | An empty salvaged utility vest shown front three-quarter, faded olive canvas, mismatched dark pouches, thin protective panels, repaired stitching and worn buckles; no mannequin. |
| `scout_rig` | Scout Rig | `scout_rig-512.png`, `scout_rig-512.webp` | An empty lightweight scout chest rig, dark teal and charcoal webbing, slim olive pouches, a pair of worn black field boots arranged tightly beneath it as one loadout bundle; no body. |
| `dampener_cloak` | Dampener Cloak | `dampener_cloak-512.png`, `dampener_cloak-512.webp` | A loosely folded hooded dampening cloak, charcoal fabric with muted teal lining, layered sound-absorbing weave, patched hem and dull fasteners; no wearer. |

#### Raid tools

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `tool_grenade` | Grenade | `tool_grenade-512.png`, `tool_grenade-512.webp` | One compact military fragmentation grenade, worn olive metal body with broad segment grooves, dark steel lever and pin, chipped paint; inert product render. |
| `tool_emp` | EMP | `tool_emp-512.png`, `tool_emp-512.webp` | One compact electronic pulse device, squat dark teal cylinder, exposed copper coil band, cyan indicator slit and black rubber end caps, field wear. |
| `tool_decoy` | Decoy | `tool_decoy-512.png`, `tool_decoy-512.webp` | One palm-sized deployable sound lure, dark olive wedge housing, sturdy black speaker grille, short folding antenna and small amber status lamp, scuffed corners. |

#### Currency-sourcing raid loot (converts on return; never a stored stash stack)

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `salvage_crate` | Salvage Crate | `salvage_crate-512.png`, `salvage_crate-512.webp` | One small closed industrial salvage crate, battered olive steel, reinforced corners and dark straps, a few sorted metal offcuts visible through a mesh opening; distinguish from loose Scrap currency. |
| `data_core` | Data Core | `data_core-512.png`, `data_core-512.webp` | One rugged intact data storage cell, dark teal rectangular cartridge with a cyan inset lens and steel connector cap, scratched shell; a single raid pickup. |
| `contract_chip` | Contract Chip | `contract_chip-512.png`, `contract_chip-512.webp` | One thick square contract token, worn dark teal metal with clipped corners and a cyan recessed square contact pattern, matte surface; a single raid pickup. |

#### Currencies and deploy resource (art representations of balances)

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `scrap` | Scrap | `scrap-512.png`, `scrap-512.webp` | A tightly bound stack of stamped industrial metal trade tabs, dull steel with small amber edge marks, visibly worn and sorted; distinct from raw Scrap Alloy and a Salvage Crate. |
| `dataCores` | Data Cores | `dataCores-512.png`, `dataCores-512.webp` | A tight pair of intact dark teal data storage cells, cyan inset lenses and steel connector caps, lightly scuffed; use the single Data Core pickup design consistently. |
| `chips` | Contract Chips | `chips-512.png`, `chips-512.webp` | A compact overlapping stack of three square contract tokens, worn dark teal metal with clipped corners and cyan recessed square contact patterns; same design as the single Contract Chip pickup. |
| `signals` | Signals | `signals-512.png`, `signals-512.webp` | A compact rugged communications voucher module, dark navy polymer and brushed steel, a cyan wave-shaped light inset with no lettering, worn corners; a visual metaphor for the existing Signals balance. |
| `fuel` | Fuel | `fuel-512.png`, `fuel-512.webp` | One compact rectangular military fuel canister, muted olive metal, black screw cap, reinforced handle and amber inspection strip, scratched paint and oily wear; represents the full-mode deploy resource. |

#### BIT shop unlocks (flags, not physical stash stacks)

| ID | Display name | Target filenames in `assets/items/` | Item line |
|---|---|---|---|
| `bp_gull_drone` | Gull Drone blueprint | `bp_gull_drone-512.png`, `bp_gull_drone-512.webp` | One folded technical blueprint sheet, faded cyan drafting paper, white line drawing of a compact gull-shaped utility drone, clipped with a worn dark steel tab, curled edges, no readable text; depicts a blueprint unlock, not a new drone inventory item. |
| `hard_bunker` | Hard pass: Bunker | `hard_bunker-512.png`, `hard_bunker-512.webp` | One battered charcoal access credential, brushed steel rim and inset amber bunker-door relief, dark teal inset panel, no lettering; art metaphor for a Bunker Hard unlock flag. |
| `hard_archipelago` | Hard pass: Archipelago | `hard_archipelago-512.png`, `hard_archipelago-512.webp` | One battered charcoal access credential, brushed steel rim and inset amber island-and-radio-mast relief, dark teal inset panel, no lettering; art metaphor for an Archipelago Hard unlock flag. |
| `hard_town` | Hard pass: Town | `hard_town-512.png`, `hard_town-512.webp` | One battered charcoal access credential, brushed steel rim and inset amber blocky town-roof relief, dark teal inset panel, no lettering; art metaphor for a Town Hard unlock flag. |
| `bit_bunker` | BIT look: Arctic | `bit_bunker-512.png`, `bit_bunker-512.webp` | A miniature BIT robot cosmetic preview, chunky rounded dark teal CRT frame with worn off-white arctic exterior panels, cyan side glow strips and the exact attached master smiley face, modest chipped paint; isolated character, no platform. |
| `bit_neon` | BIT look: Rust | `bit_neon-512.png`, `bit_neon-512.webp` | A miniature BIT robot cosmetic preview, chunky rounded dark teal CRT frame with weathered rusty orange exterior panels, cyan side glow strips and the exact attached master smiley face, modest oxidation; isolated character, no neon rainbow or platform. |

**Catalog accounting:** 25 materials/scouting/valuables + 3 armor/rigs + 2 loadout consumables + 3 tools + 3 currency-converting loot = 36 item definitions. Add 5 currencies/resources and 6 shop unlocks = **47 unique requests / 94 exported icon files**. The shop IDs `mat_tidal_coil` and `mat_frost_glass` reuse the `tidal_coil` and `frost_glass` files; no duplicate generation. `bp_gull_drone` unlocks recipe ref `gull_drone`, but neither a `gull_drone` item nor its craft recipe is defined in the inspected item/recipe lists. Do not invent one. The cosmetic IDs remain `bit_bunker` and `bit_neon` for save compatibility despite their Arctic/Rust names. For cosmetic rows, attach the approved BIT master from section 2 as well as the weapon material reference.

**Excluded and deduplicated:** weapons `basic_carbine`, `smg_vector`, `rifle_marksman`, `shotgun_breach`; existing illustrated attachments `att_barrel`, `att_mag`, `att_optic` (PNG/WebP pairs already in `assets/weapons/`). Alternate recipe IDs such as `bio_medkit` and `armor_patch` output existing items, not extra objects. Recipe blueprint flags for existing guns can retain their existing weapon images; there is no extra stash object to draw. Quest hand-ins and BIT task rewards reuse the listed materials/currencies; quest IDs are not items. Legacy `salvage` is migrated into Scrap and deleted from balances in `app.js`; its fallback icon is Scrap, so reuse `scrap-512.*` if needed for historical references. Power, player XP, BIT Bond XP, talent points, mastery stars, levels, bag capacity, timers, insurance state and unlock flags are not additional item/currency definitions. The six shop unlocks above are intentionally represented for their shop cards, without making them inventory stacks. Real-money SKUs in the playtest proposal are not defined products; no new token or currency art is invented here.

## 2) BIT ART

### Character lock and ChatGPT workflow

References to attach: `assets/bit.png` (551 x 451 RGB, a flat teal face/frame with baked-in background and a legacy wordmark), `assets/bit-portrait.png` (1024 x 1024 RGB, a worn hovering CRT robot with a dark background and warmer face), and **`assets/bit-face-master.svg`** (1000 x 875, the locked cyan face geometry). The two PNGs are opaque references, not ready transparent UI cutouts. Do not copy the legacy wordmark, yellow face or background into new deliveries. If the SVG cannot be attached to the image tool, attach a faithful PNG rasterization of it as the face reference; do not ask the generator to redesign it.

Use Robert's store direction: boxy dark-teal robot, teal CRT/LCD head, two vertical oval white-cyan eyes and a broad curved smile, chunky rounded metal frame and cyan glow strips on its sides. Preserve the master eye and smile geometry. Express moods through tilt, pose, orientation, props and glow intensity; no eyebrows, teeth, pupils, extra facial marks, frowns or replacement emoticons. Preserve the approved master silhouette and hardware across every image. Small tool manipulators may be established on the master for pointing/handling poses; do not invent different limbs in later generations.

Generate the **master sheet first**, select one consistent character, then attach it and the face reference to every subsequent prompt. Generate each request separately, never a collage of final assets. Ask explicitly for a **transparent PNG with actual alpha** for every UI cutout; check against dark and light backgrounds. A transparent checkerboard drawn into an RGB image is not acceptable. Preserve originals under `assets/reference/bit/`; filenames below are intended future deliveries under `assets/bit/` and do not overwrite the existing references. For UI cutouts, output the exact listed square dimensions, center the complete silhouette within 86% of the canvas, and keep glow inside the margin. Derive WebP counterparts with alpha later using Pillow; do not bake UI captions into cutouts.

For scene art only: dark Nordic low-poly isometric underground bunker enclosed in faceted purple/indigo rock, dark teal/navy engineering, warm orange lamps and restrained cyan system lights. No national flags, windows to daylight, surface vista or generic neon dystopia. Store headlines use bold white and cyan uppercase sans, Archivo Black/ExtraBold where available. Add final typography as an editable layout overlay for legibility; the optional store mockup prompt below requests the example headline explicitly.

These are requested assets. The raid-summary triggers below come from section d of `docs/design-playtest-oct25.md`, which is a design proposal, not shipped mood-selection code. Existing `data/bit.js` dialogue triggers and the BIT tasks/talents/trader UI motivate the additional requests. Quartermaster BIT is a requested presenter asset; the current Quartermaster vendor is a separate named vendor, and this brief does not replace that character or implement the proposed shop rework.

### 1. bit-master-sheet.png

- **Delivery:** `assets/bit/bit-master-sheet.png`, 2048 x 2048 PNG; **transparent alpha background**.
- **Use:** Production reference; generate first, never use the whole sheet as a UI icon.

```text
Create the definitive Protocol Rebirth BIT character master. BIT is a boxy dark-teal robot whose head is a teal CRT/LCD screen, with chunky rounded metal framing and cyan glow strips along the sides. The face must match assets/bit-face-master.svg: two vertical oval white-cyan eyes and the exact broad curved smile, with no extra facial features. Create a clean consistent character sheet showing front, left three-quarter, right three-quarter and rear views of the SAME BIT, plus one close-up of its screen. Establish one compact hovering chassis, a short antenna, small side hardware modules and compact foldaway tool manipulators for tutorial gestures. Preserve the attached locked face geometry in every visible screen. Arrange views with generous separation on a genuinely transparent background, no labels, no floor, no wordmark. Use assets/bit.png for the teal face/frame and assets/bit-portrait.png for worn material and hover cues, but replace the portrait's warm yellow face with the locked cyan face. Output a 2048 x 2048 transparent PNG.
```

### 2. bit-summary-smug.png

- **Delivery:** `assets/bit/bit-summary-smug.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Proposed raid summary: quest completion or weapon brought home milestone; also quest-hand-in dialogue.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT angled slightly back in quiet self-satisfaction, one compact manipulator resting against its chassis, a small confident tilt, restrained glow. Dry pride rather than cheering. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 3. bit-summary-impressed.png

- **Delivery:** `assets/bit/bit-summary-impressed.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Proposed raid summary: rare/legendary haul; existing tracked_found dialogue.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT leaning attentively toward a single recovered rare technological shard held close to the chassis, body slightly raised as if recalibrating expectations. Mild surprised respect conveyed only by pose and a slightly brighter cyan screen. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 4. bit-summary-disappointed.png

- **Delivery:** `assets/bit/bit-summary-disappointed.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Proposed raid summary: empty or near-empty extraction.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT hovering slightly lower, head/chassis tipped down toward one tiny dull metal offcut, manipulators held low. Convey dry disappointment without sadness, cruelty or a frown; keep the canonical smile. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 5. bit-summary-sarcastic.png

- **Delivery:** `assets/bit/bit-summary-sarcastic.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Proposed raid summary: duplicate glut, such as another Polymer Plate.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT at a mildly skeptical sideways tilt, one small manipulator presenting a familiar worn polymer plate and the other turned outward in an understated what-now gesture. Convey affectionate deadpan sarcasm with the unchanged face. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 6. bit-summary-bored.png

- **Delivery:** `assets/bit/bit-summary-bored.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Optional proposed raid-summary variant: very short, low-activity raid.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT in a perfectly still low hover, body leaning slightly sideways and one folded manipulator resting against its frame. Convey patient boredom through posture and subdued steady glow, with the unchanged friendly smile. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 7. bit-summary-relieved.png

- **Delivery:** `assets/bit/bit-summary-relieved.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Optional proposed raid-summary variant: low-health close call or safe extraction; extracted dialogue fallback.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT returning from a tense forward tilt into a gentle upright hover, both compact manipulators relaxed and lowered, subtle warm rim light and calm cyan screen. Convey understated relief after a close call without changing the face. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 8. bit-quartermaster.png

- **Delivery:** `assets/bit/bit-quartermaster.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Requested shop presenter for vendor/Quartermaster and BIT trader contexts; no change to vendor identity.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT in a helpful trader pose, one compact manipulator presenting a small tray of two contract chips and the other indicating the tray, three-quarter view. Worn dark teal chassis, tiny amber reflected edge light, dry professional warmth. No counter, stall, shop UI, price labels or background. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 9. bit-screen-portrait.png

- **Delivery:** `assets/bit/bit-screen-portrait.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** BIT fullscreen header, Bond/talent screen and reusable dialogue portrait; currently SVG-driven.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Create a tightly framed head-and-upper-chassis portrait of BIT at a calm front three-quarter angle. Keep the entire rounded CRT frame and side glow strips visible with safe margins. Friendly composed canonical smile, dark teal material, crisp cyan face and controlled highlights; no environment. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 10. bit-tutorial-pointing.png

- **Delivery:** `assets/bit/bit-tutorial-pointing.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Tutorial, missing-part hints, raid prep and route recommendation.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show the whole BIT hovering at three-quarter angle on the left side of its own silhouette, extending the master-approved compact tool manipulator toward image-right as if pointing at a UI control. Keep the pointing tip inside the safe margin. Screen directed toward the viewer, clear helpful pose, no arrow, caption or UI target. Do not mirror the final art to make a second version with inconsistent hardware. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 11. bit-death.png

- **Delivery:** `assets/bit/bit-death.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Death result/player_died dialogue and loss/re-equip messaging.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show intact BIT hovering low with a gentle forward tilt and an open reassuring compact manipulator, slightly dusted from a raid. Quiet concern and deadpan encouragement through posture, unchanged cyan smile. No dead body, gore, broken robot or skull icon; the player died, BIT remains available. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 12. bit-scavenging-away.png

- **Delivery:** `assets/bit/bit-scavenging-away.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** BIT tasks scavenging and expedition-away state; bitDock away notice.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT moving image-right at a rear three-quarter angle, carrying one compact worn salvage satchel secured beneath the chassis, screen partly turned back so the canonical smile is visible. Purposeful scouting posture with no speed streaks, no terrain, no background; preserve all master hardware. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 13. bit-haul-return.png

- **Delivery:** `assets/bit/bit-haul-return.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Existing scavenging pending-haul Confirm card and expedition return.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT facing the viewer in a calm proud hover beside one small open salvage tote containing a cable loop and a servo. One compact manipulator presents the haul. Keep robot and tote as a single tightly composed cutout with clear silhouette; no extra loot shower, rewards text or confetti. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 14. bit-offline.png

- **Delivery:** `assets/bit/bit-offline.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** BIT Bay unrepaired/offline state and bit_offline dialogue.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show the same intact but dormant BIT, slight downward tilt, dusty dark teal frame and one loose maintenance cable tucked alongside the chassis. Screen and cyan side strips are dim but the exact face is still faintly readable. No red danger face, sparks or destroyed chassis; this is repairable dormant equipment. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 15. bit-build-bond.png

- **Delivery:** `assets/bit/bit-build-bond.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** module_built, bond_up, quest completion and new talent availability.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT in an upright quietly pleased hover, one compact manipulator raised a little in acknowledgement, tiny warm utility-lamp reflection on worn metal and steady cyan screen. Modest pride, no exaggerated victory pose, confetti, text or badges. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 16. bit-power-warning.png

- **Delivery:** `assets/bit/bit-power-warning.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** energy_low and energy_critical dialogue; existing power-system hints.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT leaning forward attentively, compact manipulator indicating one frayed cable loop held close to the chassis, small amber hardware status lamp lit and canonical cyan face unchanged. Urgent but controlled helpful posture, no large warning icon, lightning overlay or UI frame. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 17. bit-zone-scout.png

- **Delivery:** `assets/bit/bit-zone-scout.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Existing zone_scout/route_reco and missing-part recommendations; Scavenger task hints.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT studying a single folded island chart held in its master-approved manipulators, angled to camera so its exact smile remains visible. Chart has simple pale coastline shapes with no text. Attentive analytical lean, restrained cyan illumination, no holographic UI or landscape. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 18. bit-shield-burst.png

- **Delivery:** `assets/bit/bit-shield-burst.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Existing shield_burst talent/deploy assistance and Guardian branch illustration.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show BIT braced slightly forward in a protective hover, one compact manipulator extended. A small translucent cyan curved shield panel sits close to one side of the chassis, clearly bounded and fully contained within the transparent margin, not a full-screen energy effect. Keep the canonical face fully readable. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 19. bit-arctic-cutout.png

- **Delivery:** `assets/bit/bit-arctic-cutout.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Existing cosmetic bit_bunker, displayed as BIT look: Arctic; alternate shop preview.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show a neutral front three-quarter full-body BIT wearing the Arctic finish: worn off-white outer armor panels over the same dark teal chassis, tiny gray edge scuffs, original cyan side strips and unchanged face. No snow, winter hat, flags or new hardware. Match item icon bit_bunker for the same cosmetic. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 20. bit-rust-cutout.png

- **Delivery:** `assets/bit/bit-rust-cutout.png`, 1024 x 1024 PNG; **transparent alpha background**.
- **Use:** Existing cosmetic bit_neon, displayed as BIT look: Rust; alternate shop preview.

```text
Use the attached approved Protocol Rebirth BIT master sheet and assets/bit-face-master.svg face reference. BIT is a boxy dark-teal hovering robot with a teal CRT/LCD head, chunky rounded worn metal frame, cyan side glow strips, and the exact white-cyan two vertical oval eyes and curved smile from the face master. Preserve the master silhouette, proportions and hardware; no added facial features or altered smile. Semi-realistic painted 3D character with simplified readable forms, restrained wear, soft controlled lighting and subtle cyan accents. Show a neutral front three-quarter full-body BIT wearing the Rust finish: weathered rusty orange exterior panels over the same dark teal chassis, modest oxidation, original cyan side strips and unchanged face. No rainbow neon, flames or new hardware. Match item icon bit_neon for the same cosmetic. Output one 1024 x 1024 PNG with a genuinely transparent alpha background, no floor, cast ground shadow, scenery, checkerboard, text, logo or UI frame. Center the complete silhouette within 86 percent of the canvas; preserve transparent margins and contain all glow.
```

### 21. bit-store-bunker.png

- **Delivery:** `assets/bit/bit-store-bunker.png`, 1536 x 1024 PNG; **opaque scene background**, not a UI cutout.
- **Use:** Requested store/marketing key art matching Robert's store direction. Existing vendor and BIT trader screens are reference contexts; this does not authorize a new screen or IAP system.

```text
Create Protocol Rebirth store key art using the attached approved BIT master and assets/bit-face-master.svg. A boxy dark-teal hovering robot has a teal CRT/LCD screen, chunky rounded metal frame, cyan side glow strips, and exactly the canonical white-cyan two oval eyes and curved smile. Preserve the master proportions and face. Show BIT tending a small salvaged quartermaster counter inside an enclosed dark Nordic low-poly isometric underground bunker cut into purple and indigo faceted rock. Dark teal and navy machinery, thick Cold-War concrete, a small tidy assortment of salvaged parts, warm orange utility lamps and restrained cyan system lighting. Dark but hopeful, readable large shapes, restrained material detail, no national flags, daylight windows or outdoor horizon. Place BIT and the counter in the right two-thirds; keep the left upper third quiet and dark for editable store typography. No UI buttons, price tags, invented products, currency labels or baked-in text. Output one 1536 x 1024 landscape PNG with an opaque complete environment background, not transparency.
```

Optional separate mockup pass, referencing the approved scene above (keep the clean scene master):

```text
Use the attached approved Protocol Rebirth bunker store artwork unchanged in composition and character identity. Add only the headline REBUILD YOUR FUTURE in the quiet upper-left space, bold uppercase Archivo Black-style sans serif: REBUILD YOUR in white and FUTURE in cyan. Keep generous landscape safe margins and a readable two-line composition. No other lettering, buttons, prices or logos. Preserve the dark Nordic isometric bunker, purple/indigo rock, orange lamps, cyan accents and canonical BIT face. Output a 1536 x 1024 opaque PNG named bit-store-bunker-headline.png. This is a presentation mockup; final headline typography will be laid out as editable text separately.
```

### Mood and trigger mapping

For the proposed raid summary, preserve the design's single-reaction priority: rare/legendary haul → **impressed**; quest complete → **smug**; weapon-survived milestone → **smug**; close call → **relieved**; near-empty haul → **disappointed**; duplicate glut → **sarcastic**; short/low-activity raid → **bored**; generic extraction fallback → **relieved** or neutral portrait. The design also illustrates no-loss and rare-item commentary: use relieved and impressed respectively. These are art mappings, not a change to trigger logic. Bored/relieved are useful optional variants; prioritize the master, neutral portrait, four core moods, tutorial, shop, death and away cutouts first.

Existing dialogue `raid_prep`, `route_reco`, `decision_found` and missing-part hints can reuse pointing, scout, power-warning or neutral assets as appropriate; `tracked_found` uses impressed, `extracted` uses relieved, `quest_handin` uses smug, `module_built`/`bond_up` use build-bond. Combat companion and Guardian/Scavenger/Tactician talents reuse neutral, shield or scout art; talent nodes are not new inventory objects. No art here implies that BIT equips a new item or that proposed monetization has shipped.

## 3) MARKSMAN RIFLE WEAPON ART (4 tiers)

`data/progression.js` currently marks Marksman with `placeholder:true`; `assets/weapons/marksman-1-*` is a placeholder silhouette shared across grades. Replace it with four distinct tier illustrations matching the established carbine, SMG and shotgun weapon art: isolated horizontal side-view weapon renders, semi-realistic painted 3D, worn salvaged Cold-War gear, transparent background. Match the carbine's long rectangular presentation: target 1600 x 480–560 px for each master and proportionally 512 x 154–179 px for each derivative. Preserve the full weapon silhouette and alpha; do not square-crop or add a floor shadow.

### Exact filenames and export steps

For each tier `N` from 1 to 4, deliver all four files under `assets/weapons/`:

| Tier | 1600-wide master | 512-wide derivative |
|---|---|---|
| 1 | `marksman-1-1600.png`, `marksman-1-1600.webp` | `marksman-1-512.png`, `marksman-1-512.webp` |
| 2 | `marksman-2-1600.png`, `marksman-2-1600.webp` | `marksman-2-512.png`, `marksman-2-512.webp` |
| 3 | `marksman-3-1600.png`, `marksman-3-1600.webp` | `marksman-3-512.png`, `marksman-3-512.webp` |
| 4 | `marksman-4-1600.png`, `marksman-4-1600.webp` | `marksman-4-512.png`, `marksman-4-512.webp` |

Generate each tier as a separate transparent PNG master, 1600 px wide and 480–560 px high, with the complete side-view rifle filling the same kind of horizontal crop as the carbine references. Keep enough transparent margin to avoid clipping muzzle, stock, optic or suppressor. Check the alpha over both dark and light backgrounds; checkerboard pixels baked into the image do not count as transparency. Save the approved original PNG as `assets/weapons/marksman-N-1600.png`, then create the 512 px PNG by proportional Lanczos resize to exactly 512 px wide (height rounded proportionally, expected 154–179 px). Save lossless RGBA WebP counterparts at both sizes, retaining the same dimensions and alpha. Inspect all eight exports as a tier lineup at both resolutions. Do not overwrite originals or alter the existing placeholder files until replacement art has been approved and integrated.

### Shared style header

Paste this complete header, then append exactly one tier description below it. Attach `assets/weapons/carbine-1-1600.png` through `carbine-4-1600.png` as the visual progression references and `assets/weapons/marksman-1-1600.png` only as a rough silhouette reference if useful; the existing Marksman art is a placeholder and must not inform the finished detail.

```text
Create one Protocol Rebirth Marksman rifle weapon illustration. Match the attached carbine tier references in framing, material treatment and progression scale: long horizontal side-view weapon, semi-realistic painted 3D rendering of worn salvaged Cold-War military equipment, believable matte steel, blued metal, polymer, wood or fabric, restrained hand-painted surface detail, chipped paint, rubbed edges and modest field wear. Dark teal, muted olive, charcoal, worn wood and neutral steel; small cyan detail only for powered systems, no glowing fantasy parts. Neutral soft studio lighting with gentle edge highlights and readable material separation. Show the complete weapon in a clean left-facing side profile, centered and spanning most of a 1600 x 480–560 px transparent canvas; keep muzzle, stock and all attachments inside the canvas with a modest clear margin. Match the carbine artwork's compact horizontal crop and visual scale. Genuinely transparent alpha background; no checkerboard, opaque backdrop, floor, cast shadow, environment, vignette, hands or character. No UI, frame, labels, readable text, logos, national flags or emblems. One weapon only; no duplicate parts or exploded view. Output a transparent PNG master.

TIER DESCRIPTION: [paste exactly one tier prompt below]
```

### Tier prompts

Use the same shared header for each separate image generation. The rifle silhouette and side-view crop stay consistent while components, finish and refinement progress clearly from tier to tier.

#### Tier 1 — Salvaged marksman rifle

```text
TIER DESCRIPTION: A crude but serviceable salvaged bolt-action marksman rifle assembled from mismatched parts. Long narrow barrel, scratched receiver, rough dark olive stock with a taped repair around the fore-end, exposed fasteners and a simple rusty low-power scope with cloudy glass. A few rubbed bare-metal edges and small rust blooms; visibly improvised and lowest grade, but mechanically complete and aimable. Keep the silhouette plain and readable, with no suppressor, no modern rail system and no pristine components.
```

#### Tier 2 — Rebuilt field DMR

```text
TIER DESCRIPTION: A field-rebuilt semi-automatic DMR based on the same long marksman-rifle silhouette. Replace the rough bolt-action receiver with a sturdier, better-fitted receiver and a modest box magazine; add a repaired dark polymer buttstock, a small practical rail section and a clearer but still scratched mid-power optic. Retain olive salvage paint, a few taped or patched areas and visible service wear. It should look reliably rebuilt, one clear step above tier 1, not factory new; no suppressor.
```

#### Tier 3 — Tuned precision rifle

```text
TIER DESCRIPTION: A carefully tuned precision DMR, visibly more capable and refined than the tier 2 field rebuild while remaining used battlefield gear. Use a straight, well-aligned barrel, reinforced receiver, adjustable cheek rest, stable precision stock and a properly mounted higher-quality variable optic with clean readable glass. Add a restrained free-float handguard and a few purposeful fittings; use coordinated charcoal and dark olive finishes with controlled wear at contact points. No taped repairs or prominent rust. No suppressor yet; keep the silhouette recognizably the same family.
```

#### Tier 4 — Refined suppressed marksman rifle

```text
TIER DESCRIPTION: The top-tier refined marksman rifle, an expertly rebuilt precision DMR in the same family silhouette. Fit a clean, match-grade long barrel with a compact suppressor, rigid precision chassis and refined adjustable stock, and a high-end large-aperture optic with crisp glass and robust turrets. Show precise machining, tight fittings and a coherent dark charcoal/olive finish with only subtle field wear; a tiny restrained cyan sensor detail may sit on the optic mount, not glow. This should read as clearly premium and dependable rather than new or ornate. Keep the suppressor and optic fully inside the horizontal crop.
```

When these four files are integrated, remove `placeholder:true` from the Marksman entry in `data/progression.js` and map its four grades to `marksman-1` through `marksman-4`. The placeholder flag must not remain once the art lands.
