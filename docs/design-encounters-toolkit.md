# Designförslag: problem per nivå, verktyg och färre material i början (PRB-73)
*Endast design. Inget är byggt förrän ägaren godkänt det.*

## Varför
I playtesten tyckte spelarna att raids var för lätta och kändes som ett släp. Idag blir det svårare genom att det kommer fler fiender: Open Room har 1 fiende, Narrow Passage 4 och Dead End 6 (enligt `nodspel/levels.js`). Förslaget är att varje nivå i stället får **ett tydligt problem att lösa** och att spelaren har **en liten verktygslåda** att lösa det med. Fiendetyperna grunt, rusher och sentry, de skyddade noderna (shielded nodes), stötplattorna, skydden och introduktionsvakten (`introGuard`: varning, salva, återhämtning) finns redan, så förslaget bygger vidare på dem.

## 1. Möten: ett problem per nivå
Varje problem har tre regler:
- **Varning först:** fienden visar en coral-färgad siktlinje eller ett "!" minst 1 sekund innan något händer.
- **Ingen omedelbar död:** högst 30 % av HP per träff.
- **Alltid två lösningar:** en med verktyg och en med rörelse eller timing.

| # | Möte | Mekanik (befintligt system) | Lösning | Var |
|---|---|---|---|---|
| 1 | **Kärnvakt** | Vakt som står still vid noden, med frontsköld (introvakten utökad) | Flankera bakifrån, eller locka bort den med lockbete | Bunker L1 (lärs ut), alla områden |
| 2 | **Torn bakom skydd** | Sentry-fiende med lång räckvidd och skydd framför sig | EMP stänger av den i 4 sekunder, eller spring mellan skydden under återhämtningen | Bunker L2, Town L2 |
| 3 | **Låst dörr** | Rummet med noden är stängt. Nyckelkortet ligger i en låda (loot-systemet) | Hitta kortet, eller ta en längre sidoväg | Town L2–3 (hus finns redan) |
| 4 | **Patrull** | Grunt som går en fast slinga och har en synlig synkon | Smyg bakom den (stealth-statsen finns redan), eller använd lockbete | Town L1–2, Archipelago |
| 5 | **Svärm** | 4–5 rushers kommer samtidigt ur en spawnpunkt | Granat, eller backa in i en korridor | Bunker L3, Archipelago L3 |
| 6 | **Skyddad nod** (befintlig) | Noden är skyddad tills en generator har slagits ut | Skjut eller EMP:a generatorn | Alla områden, L3 |

**Spelaren lär sig problemet själv:** första gången ett problem dyker upp är rummet litet, problemet står ensamt och etiketten har en kort ledtråd, till exempel "VAKT · FLANKERA". Ledtråden ges bara en gång (sparas lokalt) och visas som en diskret notis. **Retry:** dör man förlorar man som vanligt det man bär på, men resultatskärmen säger vad som löser problemet ("Tips: EMP stoppar tornet").
**Fördelning:** L1 har ett problem, L2 har ett problem plus vanliga fiender, och L3 kombinerar två problem. Antalet fiender ökar inte längre.

## 2. Verktygslåda
| Verktyg | Effekt | Laddningar | Tillverkas i Fabricator | Ikon (egen SVG) |
|---|---|---|---|---|
| **Granat** | Exploderar efter 1 s, radie 2 m, 3 i skada, studsar inte | 2 | 1 Scrap Alloy + 1 Fuse + 10 Scrap | `tool-grenade` |
| **EMP** | Stänger av torn och sköldar inom 3 m i 4 s | 1 | 1 Cable + 1 Circuit Board + 15 Scrap | `tool-emp` |
| **Lockbete** | Drar till sig fiender inom 6 m i 5 s | 2 | 1 Cable + 1 Polymer Plate + 10 Scrap | `tool-decoy` |
| (senare) Rökridå | Bryter synlinjen i 4 s | 1 | Bio Sample + Polymer | `tool-smoke` |

- **Raid Prep:** en ny **verktygsslot** (en enda) bredvid förbrukningsslottarna. Man väljer ett verktyg och tar med alla laddningar. Det man inte använder kommer hem vid extract (samma regel som medkits, `kitLeft`) och förloras vid död.
- **Upplåsning:** Fabricator L1 låser upp lockbete, så att problem 1 och 4 går att lösa från början. Fabricator L2 låser upp granat och EMP. Den första laddningen av varje verktyg får man gratis när det låses upp, så man hinner prova.
- **Mobilkontroller:** en rund knapp ovanför DASH med verktygsikon och antal kvar. **Tryck** = kasta automatiskt mot närmaste mål inom 6 m (samma auto-aim som vapnet). **Håll och dra** = en kastbåge med landningsring syns, och man släpper för att kasta. På dator: tangent E.
- **Färger enligt AD:** verktygsknappen och EMP är cyan (system). Granatens explosionsring och fiendens varningar är coral (fara).

## 3. Färre material i början
**Idag** (`data/modules.js`, L1-vikter i `nodspel/levels.js`): L1 kan droppa **6 sorter** (Cable, Scrap Alloy, Power Cell, Polymer Plate, Servo, Salvage Crate). De första uppgraderingarna kräver **6 olika material**.

**Förslag:** L1 droppar bara **Scrap Alloy, Cable och Polymer Plate** (plus Salvage Crate som ger Scrap). Fuse, Servo, Circuit Board, Optical Sensor och Power Cell kommer från L2. Hydraulik, Memory, Relay och AI Fragment kommer från L2–L3, som idag.

| Uppgradering | Före | Efter | Raids (ungefär) |
|---|---|---|---|
| Core L1 | 2 Scrap Alloy | oförändrad | 0 (redan i lager) |
| Fabricator L1 | 2 Cable, 2 Scrap Alloy, 20 Scrap | oförändrad | 1 |
| BIT Bay L1 | 1 Optical Sensor, 1 Cable, 20 Scrap | **2 Cable, 1 Polymer Plate, 20 Scrap** | 1 |
| Storage L1 | 2 Polymer Plate, 1 Servo, 50 Scrap | **2 Polymer Plate, 2 Scrap Alloy, 50 Scrap** | 1–2 |
| BIT Bay L2 | 1 Memory Module, 6 Data Cores, 90 Scrap | **+1 Optical Sensor** | ~3 |
| Fabricator L2 | 2 Circuit Board, 1 Hydraulic, 100 Scrap | oförändrad | ~3 |
| Core L2 | 1 Power Relay, 2 Circuit Board, 1 AI Fragment, 120 Scrap | oförändrad | ~3 |
| Storage L2 | 3 Polymer Plate, 2 Servo, 1 Hydraulic, 120 Scrap | oförändrad | ~3 |

Med det här blir alla L1-uppgraderingar möjliga med **3 materialsorter** som droppar ofta. Från L2 behövs nya material, och då krävs ungefär 3 raids per uppgradering (enligt tempomålet i economy-design.md §7).
Nya vikter för L1: Cable 4, Scrap Alloy 4, Polymer Plate 3, Salvage Crate 2. Power Cell och Servo flyttas från L1:s pool till L2.
Det finns också ett valfritt tillägg: lådor i raid viktas lite mot det spårade målet (+50 % chans för material som målet behöver). Det minskar "jag hittar aldrig X".

## 4. Implementationsplan (3 PR:er för Claude Code)
**PR A – Material och ekonomi (liten)**
Filer: `data/modules.js`, `nodspel/levels.js` (RULES.loot.weights[0]), `docs/economy-design.md`, `test/economy.test.js`, `test/loot-coverage.test.js`, `nodspel/tests/loot*.test.mjs`.
Test: L1-poolen innehåller bara 4 sorter, och alla L1-kostnader går att få från L1-poolen.

**PR B – Verktyg (mellanstor)**
Filer: `data/items.js` (tool_grenade, tool_emp, tool_decoy med slot "tool"), `data/recipes.js`, `app.js` (verktygsslot i Raid Prep, `&tool=` i coreLaunchUrl, toolLeft i resultatet), `nodspel/raid-result.js` (readTool, toolLeft), ny `nodspel/tools.js` (ren logik: kast, radie, effekter), `nodspel/game.mjs` och `index.html` (knapp och kastbåge), `nodspel/combat.js` (stunnedUntil, lure-mål), `assets/icons/*.svg` + sprite (kopiera till `nodspel/ui-icons.svg`), tester i `nodspel/tests/tools.test.mjs` och `test/weapons.test.js`.

**PR C – Möten (mellanstor)**
Filer: `nodspel/levels.js` (RULES.encounters och ett problem per nivå och område), ny `nodspel/encounters.js` (placering i seedat rum, generaliserar `applyIntroEncounter`), `nodspel/combat.js` (frontsköld, patrullslinga, svärm-spawn), `nodspel/round.js` (nyckelkort och låst dörr), `nodspel/world.js` (dörr och synkon), `nodspel/game.mjs` (ledtrådsetiketter, tips på resultatskärmen), `nodspel/tests/encounters.test.mjs`. Varje möte måste ha ett test som visar att det går att lösa både med och utan verktyg.

Ordning: A, sedan B, sedan C. C bygger på verktygen i B.
