# Art direction – sammanfattning (ad06, Wild Labs rev 06)

Källa: `ad06.pdf` (30 sidor, ägaren 14 okt). Nyckelsidor renderade i `/workspace/art-direction/pages/` (p01, p07 palett, p08 läsbarhet, p22–23 BIT, p28 låst/öppet, p30 karta). Status enligt AD: ton, palett, BIT och operatör är **låsta**; "UI and HUD", vapenspråk, combat-VFX, fiender och biomer är **"not designed yet"**.

## Ton
- "Dark, but never hopeless": skadat men levande och värt att bygga upp. Blå timme, blek persikohorisont, frisk vegetation. Ingen stormhimmel, döda skogar, giftdimma eller ruin-skräck. Aldrig generisk dystopisk sci-fi.
- Pelare: Stylized clarity (stora former som läses på mobil) · Nordic melancholy · Production restraint (skönhet från form, färg, ljus – inte tätheten av assets) · Human warmth (BIT).
- "Soft nature, hard engineering": natur asymmetrisk och vindformad; konstruktion rak, tjocka horisontella plattor, modulär kallakrigsbetong. Svensk identitet genom ingenjörskonst, **aldrig symboler**.

## Palett (samplad från sid 7)
| Roll | Namn | Hex |
|---|---|---|
| World | Deep Navy | `#1B2740` |
| World | Muted Teal | `#2E5C63` |
| World | Violet Granite | `#7C7E97` |
| World | Olive Ground | `#8B8B6C` |
| Hope | Amber Utility | `#FF9D4D` |
| Hope | Coral Horizon | `#E4705F` |
| Hope | Lavender Air | `#B0A0C6` |
| Signal | BIT Cyan | `#3FE0D0` (swatch) / `#75CFCC` (BIT-ansiktets master, sid 23) |
| Signal | Warning | `#D9552F` |
| UI-bakgrund / text i dokumentet | | `#070F14` / `#F2E9D6` |

Färgsemantik (låst): **Cyan** = BIT, strömförande system, extraction · **Amber** = loot, mänsklig värme, högre risk/belöning · **Coral red** = fientliga sensorer och bekräftad fara · **Neutral** = operatörens separation och gångbar mark. Varmt ljus är sällsynt och därför meningsfullt – varje starkt ljus ska kommunicera rutt, belöning, hot, extraction eller karaktärsläsbarhet.

## Typografi (från PDF:ens inbäddade typsnitt)
- Rubriker: **Archivo** Black/ExtraBold, versaler, tight.
- Brödtext: **IBM Plex Sans** (Regular/Medium).
- Etiketter, kickers, data: **IBM Plex Mono**, versaler med bred spärrning.

## Ikonografi / UI-regler (härledda – AD markerar UI/HUD som ej designat)
1. "Read the game before the detail": om något bara fungerar i närbild bär det inte AD → ikoner = stora, läsbara siluetter i fysisk mobilstorlek, minimalt med fina detaljer.
2. Färg är semantik, inte dekor: cyan för system/BIT/extraction, amber för loot/belöning, coral för fara, neutral för resten.
3. Inga emoji, generiska smileys eller nationella symboler. BIT:s ansikte är en **låst asset** (vertikala piller-ögon, fylld U-formad smile med avsmalnande bredd 32→64→32, master 1000×875) – får aldrig ritas om eller förenklas.
4. Rutter kommuniceras med landmärken, ljuspooler och materialkontrast – inte glödande stigar eller UI-pilar (gäller världen; UI-pilar i menyer ok).
5. Prioritetsordning: spelare, BIT, omedelbara hot → rutter/gränser → skydd/landmärken/mål → atmosfär.

## Miljö
- Liten kit, koherent värld: 6 materialfamiljer – granit (cover/boundary/landmark), kustpinjer (crouched/sentinel/crown), kallakrigsbetong (portal/wall/slab), boundaries & cover, lågfrekvent mark. Ingen gräsmatta, inga engångsprops. Variation genom skala, rotation, överlapp, delvis begravning, ljus.
- Gångbar mark: plan, ljusare, kontinuerlig, låg texturbrus. Hård gräns: vertikal granit, tät vegetation, komprimerade valörer. Giltig rutt: inramat negativt rum, fri siktlinje, varmt destinationsljus.
- Bunkern inuti: CRT-glöd, kabeldragningar, enstaka lampor – aldrig dagsljus. Amber utility light är enda värmen.
- Kamera: pitch ≈52°, VFOV ≈38°, operatören 12–13 % av skärmhöjden (10–11 % vid vida hot, 14–15 % vid nära), fokus 2–3 m framför, övergång 0,4–0,7 s med hysteres. Förgrund tonas bara lokalt där den skymmer OP-01/hot.

## Karaktärer
- **OP-01**: vuxen operatör, 7,5–8 huvuden lång, smal, rörlig, långbent. Könsneutral siluett, djup huva (bara ögonregionen syns), tyg över näsa/mun/hals, raka snitt. Stiliserad men aldrig söt/chibi. "Någon som gick in i faran medvetet."
- **BIT**: mjuk rundad CRT-kropp, petrol-teal hölje, cyan skärm, vertikala piller-ögon, bred U-smile, kort antenn, liten sidomodul, liten amber statuslampa, lugn hover. Uppgraderingar (tier 1–3) lägger till hårdvara men behåller chassi och ansikte. Personlighet: hjälpsam, lojal, fräck, galghumor.
- "Leendet tillhör världen": samma smile återkommer i miljön (skyltar, skärmar) – vänligt som kan kännas olustigt.

## Nästa milstolpe enligt AD
Spelbar "bunker approach slice": OP-01 identifierbar på 0,25 s, OP-01/BIT/närmaste hot skiljbara utan HUD, huvudrutt/valfri belöning/extraction läses via ljus, ingen ocklusion av OP-01, mobil-rimlig produktion, känslan mörk men hoppfull.
