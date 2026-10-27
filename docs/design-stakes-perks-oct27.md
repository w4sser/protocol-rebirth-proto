# Designförslag: stakes och perks (PRB, v2.3.2 till nästa)

*Status: dokumentförslag för Roberts beslut, ingen implementation beställd. Inga filer utom detta dokument ändras av denna commit.
Låst riktning som gäller rakt av: PvE only; död förlorar allt man bär; ingen ny valuta; BIT kör en aktiv uppgift i taget.
Bygger på `docs/design-combat-core-oct26.md` (ej mergad), `docs/design-encounters-toolkit.md`, `docs/design-retention-quests.md`,
`docs/economy-design.md`, samt nuvarande kod `nodspel/perks.js`, `data/raid-perks.js`, `nodspel/round.js`, `nodspel/bit.js`,
`nodspel/levels.js`, `data/raid-combat.js`. Ekonomiförändringar (lootandel, nya sänkor, reparationskostnad) kräver separat
ägarbeslut utöver detta dokument; de är explicit flaggade nedan, inte redan godkända.*

## Bakgrund

Robert spelade 30+ minuter utan att en enda gång dö eller time:a ut. Det är huvudsymptomet, inte ett önskemål om fler
features. Kodfakta som förklarar det:

- `ROUND_DURATION_MS` (`nodspel/round.js:8`) är **480 s** (Hard ×`RULES.hard.timerMul` .8 → 384 s). Ingenting i raiden
  pressar spelaren att röra sig snabbare än så; att stå still kostar bara tid, aldrig HP.
- `stepBIT()` (`nodspel/bit.js`) läker **5 HP/s** (Fältmedik-perken 8 HP/s) så länge spelaren står still, helt utan tak per
  raid. En spelare som bara stannar till efter varje träff går i praktiken aldrig under låg HP.
- Dödskillar läker **upp till 12 HP** (`RULES.killReward.health`, `nodspel/levels.js:145`), också utan tak.
- `encounters.maxHitFraction` är **.30**: ingen enskild träff kan ta mer än 30 % av 100 max HP (30 skada), och möten
  telegraferar ≥1 s innan de attackerar (`encounters.telegraphMs`).
- Hot är **statiska per rum**: när ett rums fiender är besegrade (`updateClears()`, `nodspel/perks.js`) finns inget som
  längre jagar spelaren. Att vänta, loota extra lådor eller fundera på nästa perk kostar bara klockan, aldrig risk.
- De åtta nuvarande perkkorten (`data/raid-perks.js`) är alla **max en stack per raid**, en gång var, och flera är rent
  numeriska plåster (Tidsmarginal: +8 s en gång; Lugn omladdning: −20 % en gång) utan någon synlig bygg-identitet eller
  spelarbeslut mellan korten över tid.

Slutsats: spelet har generös, otaksad läkning, ett mjukt timertryck och inget som eskalerar — så en genomsnittlig
spelare kan spela "säkert" på obestämd tid. Detta dokument föreslår fem sammanhängande ändringar: stakes som gör HP och
tid till ändliga resurser (§4), ett perksystem med faktisk bygg-identitet (§1–3), och mätpunkter för att verifiera att
det fungerar innan det låses in (§5). Allt nedan är siffror för första speltestet, inte slutbalans.

## 1. Stacking perks, Survivor.io-stil (nivå I–V, evolutioner, erbjudandevikt)

**Nivåer.** Varje kort kan tas upp till **fem gånger per raid** (I–V), med ett nytt numeriskt värde per nivå i stället
för dagens engångseffekt. Kort som redan är på nivå V exkluderas ur poolen, utom som ingrediens i en evolution (nedan).
`perkState()` (`nodspel/perks.js:4`) utökas från `taken:[]` (lista av id:n) till `taken:{}` (id → nivå 1–5); all kod som
läser `hasPerk()` blir "nivå ≥ 1".

**Erbjudandevikt mot redan tagna kort.** `offer()` (`nodspel/perks.js:69-76`) byter från "lika sannolikhet, en gång
per kort" till en viktad dragning över tre korts-slots:
- **Slot 1 (vikt mot befintlig bygg):** vikt(kort) = `1` om otaget, annars `3 + nivå` (nivå 1→4, nivå 2→5, … nivå 4→7).
  Kort på nivå V har vikt 0 (exkluderat).
- **Slot 2:** samma viktning, oberoende dragning, utan dubbletter inom samma erbjudande (seedad Fisher–Yates som idag,
  men viktad i stället för uniform).
- **Slot 3 (garanterad variation):** alltid uniformt slumpad bland korten med lägst nivå (inklusive otagna), så en
  spelare som vill byta bygge fortfarande ser ett alternativ varje gång — motsvarar dagens krav på "minst tre ovalda
  kort" men för en stapelbar pool.
- **Evolutionsöverskrivning:** om en evolutions förutsättning är uppfylld (båda ingrediens-korten på nivå V, se §3)
  ersätts det lägst viktade av de tre rullade korten med evolutionskortet. Spelaren väljer fortfarande fritt — ingen
  automatisk upplåsning, bara garanterad synlighet första gången den är möjlig.

Detta ger samma känsla som Survivor.io: tidiga val är brett utforskande, men dras snabbt mot att committa till en linje
när ett kort redan tagits en gång, utan att låsa bort möjligheten att byta.

## 2. Ett extra förmågefack, upplåst via perks

**Fack, inte BIT-uppgift.** Förmågan triggas av spelaren själv (egen knapp, eget cooldown-state), inte via BIT:s
uppgiftskö — den tävlar alltså inte med Fältmedik/BIT-läkning om BIT:s "en uppgift i taget". Det håller den låsta
regeln intakt utan undantag.

**Upplåsning.** En ny kortkategori **Protokoll** (fyra kort, en per förmåga) ger facket vid nivå I av *vilket* protokoll
som tas först; facket är singulärt, så så fort ett protokollkort är taget filtreras de tre andra bort ur `offer()`
(samma "redan tagen/maxad"-filter som exkluderar nivå V-kort). Ytterligare nivåer II–V på samma protokoll sänker
cooldown och höjer effekt; de ersätter inte den valda förmågan.

**UI.** Ett fjärde runt fack bredvid dash/verktygsknapparna i `nodspel/hud.js`, cyan ring (`--ad-*`: cyan = BIT/system,
samma familj som dagens verktygsfack), gråtonat med låsikon ur befintlig sprite tills upplåst, cooldown som ett sweep
precis som dash. Inga nya glyfer, ingen ny modal — återanvänder `.pop-card`/HUD-komponenter.

**De fyra protokollen** (återanvänder befintliga RULES.tools-värden som startpunkt, men cooldown-baserade i stället
för ändliga laddningar):

| Protokoll | Nivå I (upplåsning) | Nivå V (tak) |
|---|---|---|
| Sköldstöt (`shield_bash`) | 2,0 m kon, 90°, 1,2 s stun, 30 s cooldown | 2,4 m kon, 110°, 1,8 s stun, 14 s cooldown |
| EMP-protokoll (`emp_pulse`) | radie 3 m, 3 s stun (sentry/turret/nodsköld), 30 s cooldown | radie 4 m, 5 s stun, 14 s cooldown |
| Lockbete-protokoll (`decoy_pulse`) | radie 5 m, 4 s lockad tid, 30 s cooldown | radie 7 m, 6 s lockad tid, 14 s cooldown |
| Granat-protokoll (`grenade_lob`) | skada 3, radie 2 m, 900 ms stubin, 30 s cooldown | skada 5, radie 2,6 m, 700 ms stubin, 14 s cooldown |

Cooldown-kurva samma för alla fyra: **30 / 26 / 22 / 18 / 14 s** för nivå I–V. Detta gör dagens ändliga `tool_grenade`/
`tool_emp`/`tool_decoy` (laddningar 1–2, aldrig återfyllda) om till en obegränsad men cooldown-begränsad spelarresurs
*om* man investerar i bygget — rätt riktning för "fler intressanta beslut", fel riktning om det trivialiserar möten;
flaggat som en punkt att titta extra noga på i speltestet (se §5 och öppna frågor).

## 3. 16 kort som ersätter dagens åtta (12 stat/bygg + 4 protokoll)

Dagens pool (`data/raid-perks.js` `cards`) byts ut helt. Fyra av de gamla korten återanvänds och görs stapelbara
(Kedjereaktion, Nödsköld, Fältmedik, Rullning); de fyra tråkigaste engångsplåstren (**Lugn omladdning, Spaning,
Fältförband, Tidsmarginal**) tas bort som egna kort — Tidsmarginal/Fältförband/Lugn omladdning ger inget nytt beslut
andra gången de dyker upp, bara samma fasta tal. Spaning görs om till ett nivåbundet informationsverktyg i stället för
att försvinna helt (rad 11 nedan), eftersom intel i sig är ett giltigt bygge om det ger ett faktiskt beslut per nivå.

| # | Kort (id) | Kategori/accent | Nivå I → V |
|---|---|---|---|
| 1 | Kedjereaktion (`chain`) | OFFENSE/loot | +50/65/65/85/100 % skada på nästa skott efter kill; laddningskapacitet 1/1/2/2/3 |
| 2 | Överladdning (`overcharge`) | WEAPON/loot | Vapenskada +10/20/30/40/50 % |
| 3 | Genomslag (`pierce`) | WEAPON/loot | Genomslag 1/1/2/2/3 extra mål; skadefall −40/−30/−25/−15/−10 % per genomslag |
| 4 | Adrenalin (`adrenaline`) | OFFENSE/danger | Vid träff, 2,5 s: eldfrekvens +10/15/20/25/30 %, rörelse +8/10/12/15/18 %; 1/1/2/2/∞ (10 s intern cooldown) utlösningar per rum |
| 5 | Nödsköld (`shield`) | DEFENSE/danger | Vid ≤20/20/25/25/25 % HP: 40/50/50/60/65 % skadereduktion i 1,5/1,8/2,2/2,5/3 s; 1/1/1/1/2 laddningar per rum |
| 6 | Bålverk (`bulwark`) | DEFENSE/danger | +8/16/26/38/52 max HP (skillnaden läggs även till aktuell HP) |
| 7 | Bärsärk (`berserk`) | OFFENSE/danger | Under 50 % HP: skada +10/15/20/25/30 %. Under 25 % HP: +20/30/40/55/75 % |
| 8 | Fältmedik (`medic`) | BIT/cyan | BIT:s stillastående läkning 5 → 6,5/7,5/9/10,5/12 HP/s |
| 9 | Rullning (`roll`) | MOBILITY/cyan | Dash-cooldown ×0,85/0,75/0,65/0,55/0,45, golv 2200/1900/1600/1300/1000 ms |
| 10 | Magnet (`magnet`) | INTEL/amber | Upplockningsradie för lådor/ammo/medkit +30/55/80/110/150 % |
| 11 | Spaning (`recon`) | INTEL/cyan | I: varningskälla+loot i rensade rum (som idag). II: + antal fiender i nästa rum vid tröskeln. III: + fiendetyp. IV: + lootsällsynthet i okollade lådor. V: + grov skadeuppskattning ("~X skada om du går in obehindrad") |
| 12 | Rustning (`plating`) | DEFENSE/danger | Flat skadereduktion per träff: −1/−2/−3/−4/−5, lägst 1 skada går alltid igenom |
| 13–16 | Protokoll ×4 (`shield_bash`, `emp_pulse`, `decoy_pulse`, `grenade_lob`) | PROTOCOL/cyan | Se §2-tabellen |

**Fem evolutioner** (ett nytt kort som dyker upp enligt §1 när båda ingredienserna är nivå V; kostar ett vanligt val,
ingen extra slot):

| Evolution | Kräver (båda nivå V) | Effekt |
|---|---|---|
| Kärnkedja | Kedjereaktion + Överladdning | Varje kill har 25 % chans att utlösa en extra explosion: 150 % vapenskada, radie 2 m |
| Dödsföraktare | Genomslag + Bärsärk | Under 25 % HP: alla skott genomslår samtliga mål i linjen utan skadefall |
| Reaktorsköld | Nödsköld + Bålverk | Sköldaktivering återställer även 15 % max HP under sina 3 s |
| Vindlöpare | Rullning + Adrenalin | Dash ger 0,3 s skadeimmunitet (i-frame) |
| Fästning | Fältmedik + Rustning | Stillastående ≥1 s: skadereduktion +5 %/s, tak 25 %, nollställs av rörelse |

Magnet och Spaning har avsiktligt ingen evolution i detta förslag — de är informations-/girighetshävstänger, inte
stridskraft, och en kombination med dem skulle snarast ändra lootbalans (ägarbeslut, se §4). Vindlöpare och Fästning
är de två evolutionerna som mest direkt kan motverka §4:s eskalering (osårbar dash, passiv tanking) och bör speltestas
separat innan de släpps brett (öppen fråga 9).

## 4. Stakes: varför man måste tillbaka

**Grundorsak till "aldrig dör, aldrig time:ar":** otaksad läkning. Fixen är en **livstidsbudget för läkning per raid**,
inte hårdare möten.

- Ny regel: `round.telemetry.healed` (fältet finns redan, `nodspel/round.js:18`) blir en hård budget på **60 HP per
  raid** (60 % av 100 max HP), delad mellan BIT:s stillastående läkning, dödskill-läkningen och perk-läkning (Fältmedik,
  Reaktorsköld-evolutionen). När budgeten är spenderad läker inget av detta längre denna raid — BIT fortsätter visa
  stillastående-animationen (ingen förvirrande tyst avstängning), men `amount` blir 0.
  - Undantag: Bålverks engångs-HP (§3, rad 6) räknas INTE mot budgeten — det är ett spenderat perkval, inte gratis
    sustain, så bygg-identitet förblir meningsfull även efter att budgeten tagit slut.
  - Tuningvärde `healBudgetFraction:.6` läggs i en ny `data/raid-stakes.js` (samma mönster som `data/raid-combat.js`),
    inte hårdkodat i `bit.js`/`round.js`.

- **Eskalerande hot: Larm och jaktvågor.** En raid-global klocka, oberoende av rumsinnehållet:
  - `alarmDelayMs: 75000` — vid 75 s in i raiden går ett telegraferat "LARM" (banner, inte en jumpscare; samma
    varnings-först-princip som `encounters.telegraphMs`).
  - Därefter en **jaktvåg** var `waveIntervalMs: 45000`: våg N skickar `ceil(N/2)` rushers (1,1,2,2,3,3-tak) från
    närmaste redan rensade rum mot spelarens senast kända position. 1 HP per rusher (ett tryck, inte en vägg) och
    rusher-hastighet enligt befintlig `enemySpeed` för arean.
  - Vågor spawnar aldrig inuti den säkra extract-zonen, så sista sträckan till exit kan inte permanent blockeras — men
    de jagar aktivt genom tidigare rum, vilket gör det att stanna och loota klart olönsamt bortom en viss punkt.
  - **Girighetsslinga:** varje bonuslåda utöver den garanterade vägens lådor (en redan rensad extralåda, ej den
    garanterade loot-vägen) lägger `+8000` ms till en dold "heat"-räknare. Vid `heat ≥ 60000` ms kommer nästa jaktvåg
    20 s tidigare. Det gör "en till låda" till ett verkligt vägval mot klockan, inte en gratis sidoväg.
  - Om spelaren totalt är passiv (ingen rums-progress) i >240 s: BIT:s läkningstakt halveras ("comms jam") så att
    man inte kan permanent camping-läka sig förbi larmet heller.

- **Extraction choices: öppen vs. kostsam extract.** Från L2 läggs en andra, tidigare extract-punkt till i varje
  nivås startrum ("signalfackla"), kostar 15 s raidtid att kalla in:
  - **Tidig extract:** säkrar bara **70 %** av väskans innehåll (avrundat nedåt); resten räknas som förlorat, som en
    improviserad hämtning i stället för en full dustoff.
  - **Full extract** (dagens nodbaserade exit i sista rummet): säkrar 100 % som idag, men kräver att man överlever
    fram till och genom sista rummet, inklusive eventuella jaktvågor på vägen.
  - Detta ändrar effektiv lootretention och är därmed en ekonomiförändring enligt `AGENTS.md` — **kräver separat
    ägarbeslut** innan implementation, inte redan godkänt av detta dokument (öppen fråga 5).

- **Carried-value risk, synligt.** En ny HUD-rad (amber, loot-accent) som summerar väskans `sellValue` (redan ett fält
  per item i `data/items.js`) löpande: "Du bär för ~X Scrap." Ingen ny valuta, bara en synlig påminnelse om vad döden
  faktiskt kostar just nu — gör den redan låsta regeln "död förlorar allt man bär" kännbar i realtid i stället för att
  bara synas i resultatskärmen efteråt.

- **Rig durability.** Utrustad `round.equip.armor` får en raid-lokal `durability`, start **100**. Varje träff som
  rustningen dämpar förbrukar `1.5× den dämpade skadan` i durability (t.ex. en 22-skadeträff dämpad 20 % → 4,4 skada
  dämpad → 6,6 durability förbrukad). Vid `durability ≤ 0` ger rustningen 0 % skadereduktion resten av raiden — facket
  sitter kvar men är inert. Reparation mellan raider kostar befintlig Scrap (ingen ny valuta), men ny durability-data
  på gear och reparationsflöde är en ekonomi-/progressionsändring och **kräver separat ägarbeslut** (öppen fråga 6).
  Föreslagen omfattning: PR3/backlog, inte del av PR1–PR2.

## 5. Balans mot Tarkov: kurva, timer, mätpunkter, rattar

**Svårighetskurva.** Behåll dagens per-nivå HP/hastighet/cooldown-skalning (L1 lär, L2 medel, L3 svårast) och dagens
Hard-multiplikatorer (`hpMul 1.4`, `dmgMul 1.2`, `timerMul .8`) oförändrade. Lägg §4:s larm/jaktvågs-system som en
**separat, tidsbaserad** eskaleringsaxel ovanpå detta, inte en ny multiplikator på möten. Enda direkta mötesjustering
i detta förslag: höj `encounters.maxHitFraction` från .30 till **.35 i L3 och Hard** (max 35 skada per träff i stället
för 30) så att låg-HP-ögonblick känns mer konsekventa i slutfasen, oförändrat .30 i L1/L2 för inlärningssäkerhet.

**Timer.** `ROUND_DURATION_MS` lämnas oförändrad vid **480 s** (Hard 384 s) som absolut tak. Att Robert aldrig
time:ade ut är inte ett bevis på att klockan är för generös — det är ett bevis på att ingenting gjorde det dyrt att
använda hela klockan. Lita på §4:s eskalering och tidiga-extract-valet för att naturligt sprida raidlängder, i stället
för att hårt korta taket (ett kortare tak straffar även försiktiga nya spelare som bara är långsamma, inte giriga).

**Målmetrik (snitt-spelare, rullande fönster per playtest-batch):**

| Mätpunkt | Mål | Beräkning |
|---|---|---|
| Dödsfrekvens | 20–35 % av raider | `count(raid_end.reason==='death') / count(raid_end)` |
| Time:ar ut | 5–10 % av raider | `count(raid_end.reason==='timeout') / count(raid_end)` |
| Snittlängd | 6–9 min aktiv tid | `mean(raid_end.elapsedMs)` exkl. `abandon` |

**Telemetri (ny, lokal — ingen backend finns i repot idag).** En händelselogg per raid, samma stil som `logCombat()`
(`nodspel/perks.js:12`, redan en 32-händelsers ringbuffert) men för hela raidens livscykel, exporterbar som JSON för
playtest-granskning snarare än en serverbaserad analytics-pipeline (ingen sådan finns att koppla till ännu):

| Händelse | Fält | Syfte |
|---|---|---|
| `raid_start` | seed, area, hard, loadout | baslinje |
| `room_clear` | level, roomIndex, elapsedMs, hpAtClear | kurva/tempo |
| `perk_choice` | perkId, nivå, isEvolution | bygganvändning |
| `damage_taken` | source, attack, amount, hpBefore/After, moving | §4-validering |
| `heal_applied` | source (bit/kill/perk), amount, budgetRemaining | validerar 60-HP-budgeten |
| `alarm_triggered` / `hunter_wave_spawn` | elapsedMs, waveNumber, count | validerar eskaleringen |
| `extract_choice` | type (early/full), bagValueSecured/Lost, elapsedMs | §4 girighetsslinga |
| `raid_end` | reason, elapsedMs, levelsCleared, perksTaken, finalHp | de tre målmetrikerna |

**Rattar (allt i `data/*.js`, inget hårdkodat i spelfunktioner):** `healBudgetFraction`, `alarmDelayMs`,
`waveIntervalMs`, `waveSizeCurve`, `heatPerBonusBoxMs`, `heatThresholdMs`, `earlyExtractTaxPct`,
`armorDurabilityPerDamage`, `encounters.maxHitFraction` (redan existerande ratt, höjs bara för L3/Hard).

**Meta-hakar.**
- **Stash:** ren förvaring för extraherat crafting-material, ingen ny valuta — redan en öppen fråga i
  `docs/economy-design.md` ("stash-platser för föremål"); detta dokument föreslår bara att koppla rig-durability-
  reparation till samma yta när den byggs.
- **Insurance-liknande BIT-återhämtning, en uppgift i taget:** efter en dödad/time:ad raid kan spelaren skicka BIT på
  **exakt en** återhämtningsuppgift ("BIT Recovery"), som upptar BIT:s enda aktiva uppgiftsfack (ömsesidigt uteslutande
  med scavenge/expedition som idag). Kostar 25 Scrap (befintlig valuta) att skicka, tar 20 min realtid, **50 %** chans
  att återfå det **enda högst värderade föremålet** (inte valuta, inte hela lasten) från den förlorade raiden; chansen
  kan höjas av BIT-talangpoäng (`docs/design-bit-skill-tree.md`), tak 80 %. Misslyckande förbrukar ändå hela tiden —
  ingen gratis retry. Detta är en chansbaserad tröst, inte en ångra-knapp: den får aldrig återföra mer än ett föremål
  eller någon valuta/XP, annars urholkas den låsta regeln "död förlorar allt man bär".
- **Gear-progression:** befintliga Hard-drops (`coreAsh`) och rustningstiers (köpta med Scrap, ingen ny valuta) ger
  högre bas-durability (120/150/200) och lägre förbrukningsmultiplikator — en anledning att grinda Scrap som hänger
  ihop med §4:s rig-durability i stället för att vara en fristående progressionslinje.

## 6. Utrullning: tre PR:er

**PR1 — Stakes-kärnan (inget perk-arbete).** `nodspel/round.js` (`tickRound()`: läkningsbudget, larmklocka),
`nodspel/bit.js` (budgetavdrag), ny `nodspel/stakes.js` (jaktvågor, heat-räknare), ny `data/raid-stakes.js`
(alla rattar i §5), `nodspel/hud.js` (larmbanner, "du bär för ~X"-rad). Inga perk- eller lootändringar. Verifiera med
`npm test` / `cd nodspel && npm test` / `npm run verify` samt ett 5-raiders playtest mätt mot §5:s telemetri innan PR2.

**PR2 — Perkomläggning.** `data/raid-perks.js` (16 stapelbara kort + 5 evolutions-id ersätter dagens 8), `nodspel/perks.js`
(`taken` id→nivå, viktad `offer()`, evolutionsvillkor, protokoll-cooldown-state), `nodspel/perk-ui.js`/`perks.css`
(nivåpips I–V, evolutionsglöd), `nodspel/hud.js`/`game.mjs` (fjärde förmågefack, inputbindning, cooldown-sweep). Inga
loot-/ekonomiändringar. Verifiera med enhetstester för stapling/viktning/evolutionsvillkor plus manuellt speltest av
"bygg-känsla", särskilt Vindlöpare och Fästning (öppen fråga 9).

**PR3 — Extraction och meta (ekonomi-gated, kräver separat ägarbeslut före start).** Tidig/full extract-val och
lootskatt, rig/rustnings-durability och reparationskostnad, BIT Recovery-flödet. Rör `nodspel/round.js`
(`secureBag()`-uppdelning), nivåplacering av signalfackla, `data/items.js`/`data/vendors.js` (durability-fält,
reparationspris), samt BIT-uppgiftskön (`app.js`/`data/bit.js`). Byggs inte förrän §4/§5:s ekonomipunkter är explicit
godkända.

## 7. Öppna frågor till Robert

1. Är den huvudsakliga diagnosen rätt — otaksad läkning (BIT 5 HP/s stillastående + 12 HP/kill, utan tak) är
   anledningen till att ingen dör, snarare än för generösa 480 s? Godkänner du 60-HP-livstidsbudgeten i §4 som första
   fix, före något annat i detta dokument byggs?
2. Godkänner du larm vid 75 s och jaktvågor var 45 s (§4) som eskaleringsmodell, eller vill du hellre skala upp
   befintliga rumsmöten direkt i stället för en separat tidsaxel?
3. Är 16 stapelbara kort (I–V) plus fem evolutioner rätt storlek för PR2, eller vill du starta mindre — t.ex. bara
   stapla om de fyra befintliga goda korten (Kedjereaktion, Nödsköld, Fältmedik, Rullning) och skjuta nya kort/
   evolutioner till en uppföljare?
4. Godkänner du ett fjärde, perk-upplåst förmågefack (§2) med fyra protokoll (Sköldstöt/EMP/Lockbete/Granat), cooldown
   30→14 s? Ska det vara exakt ett protokoll per raid (singulärt fack) som föreslaget, eller ska det kunna bytas om
   spelaren tar ett annat protokollkort senare?
5. Godkänner du principen "tidig extract till reducerat pris" (70 % säkrat, §4)? Detta är en ekonomiändring och
   byggs inte i PR1/PR2 utan ditt separata godkännande av själva procentsatsen.
6. Godkänner du rig/rustnings-durability och tillhörande reparationskostnad i Scrap (§4, §6 PR3)? Samma
   ekonomi-gate som fråga 5.
7. Är BIT Recovery (§5: 25 Scrap, 20 min, 50→80 % chans, max ett föremål, aldrig valuta/XP) en acceptabel
   "insurance-lik" mekanik inom "död förlorar allt man bär", eller är även ett chansbaserat delvis-återtag för långt
   bortom den regeln?
8. Är målmetrikerna (död 20–35 %, time-out 5–10 %, snitt 6–9 min) rätt mål för en genomsnittsspelare, eller vill du
   sätta andra tal för en van spelare kontra en ny spelare separat?
9. Vindlöpare (osårbar dash-ruta) och Fästning (passiv tak-25 %-tanking) är de två evolutionerna som mest direkt kan
   motverka hela stakes-syftet i §4. Vill du speltesta dem separat/senare i stället för att släppa alla fem
   evolutioner samtidigt i PR2?
10. Räcker lokal, exporterbar telemetri (§5, ingen backend) för detta speltest, eller finns redan en plan för en
    analytics-/leaderboard-worker (nämnd som öppen fråga i `docs/design-playtest-oct25.md`) som detta borde skriva
    till i stället?
