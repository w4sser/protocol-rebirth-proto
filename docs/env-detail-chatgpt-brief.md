# Beställning till ChatGPT: miljödetaljpaket (props + decals)

Mål: rikare, tätare miljöer utan att ändra spelkod, kamera eller ljus. Fast isometrisk kamera (52° pitch) ⇒ detaljer ska läsas på 6–12 m avstånd på en mobilskärm: tydliga siluetter, få stora former, inga småmönster.

**Stil:** mörk nordisk low-poly, "The Long Nordic Night" (`/workspace/art-ref/start-direction-nordic-night.png`). Skymning, fyr, radar, granit, dimma. Svensk skärgård + betongbunker. Falurött, lila granit, mörka granar, gatlyktor i skymningen. Platt färg / gradient-atlas, ingen fotorealism.
**Undvik:** det svart-tomma, sterila neon-utseendet i `archipelago-wrong.png` — tomma golv, raka kanter utan avbrott, allt samma svarta.

**Palett (låst, `docs/art-direction.md`):** Deep Navy `#1B2740`, Muted Teal `#2E5C63`, Violet Granite `#7C7E97`, Olive Ground `#8B8B6C`, Amber Utility `#FF9D4D`, Coral `#E4705F`, Lavender Air `#B0A0C6`, BIT Cyan `#3FE0D0` (bara signal/teknik), Warning `#D9552F`. Falurött ca `#8E2B22`, granskog ca `#1F3A30`.

## Tekniska krav (samma som befintliga `assets/env/bunker/`)
- `.glb`, meter, Y upp, framsida −Z, origo nederst i mitten (väggprops: origo på väggens baksida, nederst i mitten; hängande: i fästpunkten).
- En mesh per fil, inga animationer/skinning, inga lampor/kameror i filen. Tom nod `light_anchor` där en lampa ska sitta.
- Delad atlas per zon, extern bredvid GLB: `props_atlas.png` (max 512×512) + ev. `props_emissive.png` (max 256×256). sRGB, nearest-filter som bunker-kitet. Inga normalkartor.
- Tri-budget per item enligt listan; hela paketet < 25 000 tris.
- Bakat AO: mörka vertexfärger eller mörkare atlasfält i hörn, under föremål och i skarvar (inte separat AO-karta). Lätt "kontaktskugga" (mörk quad, ingen alpha-gradient > 64 px) under fristående props.
- Decals: genomskinliga PNG i en atlas `decals_atlas.png` (1024×1024, 4×4 eller 4×6 rutor à 256 px) + en platt quad-`.glb` per decal (2 tris, 0,01 m över golv, origo i mitten) som pekar på rätt ruta. Ingen kollision.
- Namn: `snake_case`, prefix zon: `bk_` (bunker), `ind_` (industri), `ark_` (skärgårdsby). Varianter `_a/_b/_c`. Decals `dc_`.
- Mappar: `assets/props/<bunker|industri|skargard>/`, `assets/decals/`. Varje mapp har `manifest.json` (namn, zon, mått, tris, kollision: none/box/cylinder, varianter) och `contact_sheet.png` i 52°-vinkel.
- Leverans: PR från `main`, bara filer under `assets/props/`, `assets/decals/` och denna doc. **Ingen spelkod, inga ändringar av befintliga GLB, ljus eller kamera.**
- Finns redan (gör inte om): tunnor, sandsäckar, rör/kabelrännor, skräphögar, oljefläck, sprickor, riskstreck, pöl, mossfläck, gatlykta, gran, buskar, staket, hus.

## Props (36 st)
| Fil | Zon | Syfte | Mått (m, B×H×D) | Tris | Pivot | Material / variation |
|---|---|---|---|---|---|---|
| bk_ammo_crate_stack | Bunker | Fylla hörn | 1.2×0.8×0.6 | 150 | botten | Olivgrön, stencil; a/b (2 resp. 3 lådor) |
| bk_jerrycan | Bunker | Liten fyllnad | 0.35×0.5×0.2 | 60 | botten | Olive/Warning; a/b (stående/liggande) |
| bk_gas_mask_hook | Bunker | Väggdetalj | 0.6×0.5×0.15 | 80 | vägg | 3 masker på krok |
| bk_fuse_box | Bunker | Vägg, teknik | 0.6×0.8×0.2 | 60 | vägg | Grå; a stängd/b öppen m. cyan glow |
| bk_hanging_bulb | Bunker | Ljuspunkt | 0.2×0.6×0.2 | 40 | i taket | Amber emissive, `light_anchor`; a hel/b trasig |
| bk_cot_folded | Bunker | Liv | 1.9×0.4×0.7 | 120 | botten | Grönt tyg |
| bk_radio_set_shelf | Bunker | Teknik | 0.8×0.5×0.4 | 140 | botten | Grå + amber ratt-glow |
| bk_paper_stack | Bunker | Golvskräp | 0.4×0.15×0.3 | 40 | botten | Beige; a/b/c |
| bk_water_tank | Bunker | Stor siluett | 1.0×1.8×1.0 | 200 | botten | Teal metall, rost |
| bk_rubble_corner | Bunker | Bryta raka hörn | 1.0×0.4×1.0 | 120 | hörnets yttre punkt | Betonggrå + lila granit; a/b |
| bk_cable_drape | Bunker | Över tak/vägg | 2.0×0.6×0.1 | 60 | vägg | Svart, hänger i båge |
| bk_first_aid_wall | Bunker | Läsbar vägg | 0.5×0.5×0.15 | 40 | vägg | Vit + coral kors |
| ind_pallet | Industri | Fyllnad | 1.2×0.15×0.8 | 60 | botten | Trä; a tom/b med säckar |
| ind_oil_drum_cluster | Industri | Kluster | 1.4×0.9×1.2 | 180 | botten | Warning/teal, 3 fat |
| ind_gas_bottles | Industri | Vägg | 0.8×1.3×0.3 | 140 | botten | Gula/blå flaskor + kedja |
| ind_crate_wood_large | Industri | Täckning | 1.5×1.2×1.2 | 80 | botten | Trä, stencil; a/b (öppen) |
| ind_scaffold_section | Industri | Höjd/siluett | 2.0×3.0×1.0 | 250 | botten | Galv. grå, plankor |
| ind_chain_hoist | Industri | Hänger | 0.4×2.0×0.4 | 100 | i taket | Kedja + krok, amber |
| ind_workbench_tools | Industri | Liv | 1.8×1.0×0.7 | 180 | botten | Trä + verktyg |
| ind_scrap_metal_pile | Industri | Golvskräp | 1.5×0.5×1.2 | 140 | botten | Rost/grå; a/b |
| ind_cable_reel | Industri | Rund siluett | 1.0×1.0×0.6 | 120 | botten | Trä + svart kabel |
| ind_warning_sign_post | Industri | Läsbarhet | 0.5×1.6×0.1 | 50 | botten | Warning-gul; a/b/c (ikon) |
| ind_vent_stack | Industri | Takprofil | 0.6×2.0×0.6 | 120 | botten | Grå, rök-anchor |
| ind_puddle_grate | Industri | Golvdetalj | 1.0×0.05×1.0 | 20 | botten | Galler + mörk pöl |
| ark_boat_rowing | Skärgård | Strand/brygga | 3.0×0.6×1.2 | 200 | botten | Vit/falurött; a rätt/b upp-och-ned |
| ark_fish_crates | Skärgård | Bryggfyllnad | 1.0×0.6×0.6 | 100 | botten | Blå plast/trä; a/b |
| ark_fishing_net_pile | Skärgård | Mjuk form | 1.2×0.4×1.0 | 120 | botten | Grönt nät + orange flöten |
| ark_buoy | Skärgård | Färgaccent | 0.5×0.8×0.5 | 60 | botten | Coral/vit; a/b |
| ark_mooring_post | Skärgård | Brygga | 0.3×1.0×0.3 | 40 | botten | Mörkt trä + rep |
| ark_rowan_tree | Skärgård | Ny trädsiluett | 2.5×4.0×2.5 | 250 | botten | Rönn, coral bär; a/b |
| ark_granite_boulder | Skärgård | Lila granit | 1.5×0.9×1.2 | 80 | botten | Violet Granite + lav; a/b/c |
| ark_juniper_bush | Skärgård | Kustbuske | 1.0×0.8×1.0 | 80 | botten | Mörk grön |
| ark_firewood_stack | Skärgård | Hus-liv | 1.5×1.0×0.5 | 140 | botten | Ved, mot falurött |
| ark_outhouse | Skärgård | Liten byggnad | 1.2×2.2×1.2 | 150 | botten | Falurött + vita knutar, hjärta i dörr |
| ark_bike_old | Skärgård | Liv | 1.7×1.0×0.5 | 160 | botten | Svart, lutad |
| ark_lantern_post_small | Skärgård | Skymningsljus | 0.3×1.2×0.3 | 70 | botten | Amber emissive + `light_anchor` |

## Decals (20 st, `assets/decals/`)
| Fil | Zon | Storlek (m) | Not |
|---|---|---|---|
| dc_footprints_mud | Alla | 1.0×0.5 | Mörk, låg kontrast |
| dc_drag_marks | Alla | 2.0×0.6 | Släpspår |
| dc_burn_mark | Alla | 1.2×1.2 | Svart/kol |
| dc_bullet_holes_wall | Alla | 0.8×0.6 | Vägg |
| dc_dirt_corner | Alla | 1.0×1.0 | AO-smuts för hörn (viktigast) |
| dc_dirt_edge_strip | Alla | 2.0×0.4 | Smuts längs väggfot |
| dc_water_stain_wall | Bunker | 0.8×1.6 | Rinnande fukt |
| dc_rust_bleed | Bunker/Ind | 0.6×1.2 | Rost under rör |
| dc_stencil_sector_a | Bunker | 1.0×1.0 | "SEKTOR A", sliten |
| dc_stencil_no_entry | Bunker | 0.8×0.8 | "TILLTRÄDE FÖRBJUDET" |
| dc_bit_tag_small | Bunker | 0.4×0.4 | BIT-smiley, cyan, sparsamt |
| dc_tire_tracks | Industri | 3.0×0.8 | Truckspår |
| dc_paint_spill | Industri | 1.0×1.0 | Warning-gul |
| dc_grate_shadow | Industri | 1.0×1.0 | Gallerskugga |
| dc_floor_number_set | Industri | 1.0×1.0 | 1–4 i atlasrutor |
| dc_moss_rock | Skärgård | 1.0×1.0 | Mossa på granit |
| dc_lichen_orange | Skärgård | 0.6×0.6 | Orange lav |
| dc_pine_needles | Skärgård | 1.5×1.5 | Barr på mark |
| dc_wet_sand_edge | Skärgård | 2.0×0.6 | Strandlinje |
| dc_leaf_litter_red | Skärgård | 1.0×1.0 | Rönnlöv, coral |

## Täthetsmål
Varje 4×4 m golvyta: minst 1 stor siluett, 2–3 små props, 2 decals, smuts i alla hörn. Spelbara gångar (≥ 1,5 m) hålls fria.

## Prompt att klistra in i ChatGPT
> Du gör ett miljödetaljpaket för mobilspelet Protocol Rebirth (Three.js, fast isometrisk kamera 52°). Läs `docs/env-detail-chatgpt-brief.md` i repot w4sser/protocol-rebirth-proto och följ den exakt. Stil: mörk nordisk low-poly, svensk skärgård och betongbunker i skymning, falurött, lila granit, mörka granar, amber lyktor, palett enligt briefen. Gör alla 36 props och 20 decals i tabellerna: .glb, meter, Y upp, origo nederst i mitten, delad atlas ≤ 512 px per zon, decal-atlas 1024 px, inga normalkartor, bakat AO i vertexfärg/atlas, tri-budget per item. Lägg filer i `assets/props/<bunker|industri|skargard>/` och `assets/decals/`, med `manifest.json` och `contact_sheet.png` (52° vinkel) per mapp. Leverera som en PR från main som bara innehåller dessa filer – ändra ingen spelkod, befintliga modeller, ljus eller kamera.
