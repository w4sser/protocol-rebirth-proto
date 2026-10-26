# Designförslag: kärnstriden (PRB, v2.1.1 → nästa)

*Status: förslag, inget bygget ännu. Låst riktning som INTE får brytas: PvE only; död förlorar allt man bär på; ingen ny valuta; BIT kör en aktiv uppgift i taget. Konstregel: BIT har inga cyan sidoremsor. Bygger vidare på `docs/design-encounters-toolkit.md` (möten/verktyg) och `docs/design-playtest-oct25.md` (backpack, raid-summary) utan att motsäga dem.*

Bakgrund – Lords speltest-feedback (ordagrant):

> "the core isn't fun, so nothing else matters. You just walk forward and shoot, at least for the ~5 raids I could be bothered to play. You walk around the shield guy, but you get that immediately and then you just do that. Look at Archero or something with a similar core that's fun enough. The levels seem to be the same, only 2 variants? One with a long corridor and one with a single room."

## 1. Diagnos: varför striden känns trist idag

Siffrorna nedan är verifierade mot koden (`nodspel/levels.js`, `nodspel/combat.js`, `nodspel/encounters.js`, v2.1.1).

**1. Du siktar aldrig riktigt själv.**
- `RULES.weapon` (levels.js:145): `assistAngleDegrees:12`, `assistWidth:1.1`, `assistStrength:.65`, `homingDegreesPerSecond:90`.
- Ett löst sikte inom 12° korrigeras automatiskt mot närmaste mål, och kulan svänger sedan 90°/s mot det.
- Kontrollen är "twin-stick, släpp siktespinnen för att skjuta" – men med den korrigeringen räcker det att flicka siktet ungefär åt fiendens håll medan rörelsespinnen fortfarande går framåt. Det är exakt det Lord beskriver.

**2. Fiendens skott är sällan ett hot.**
- `RULES.combat.bulletSpeed:9` (m/s) – enstaka, långsamma skott.
- `cooldownMs:1400–2400` beroende på nivå (`RULES.levels[].enemyCooldownMs`) – max ett skott var 1,4–2,4 s per fiende.
- `maxHitFraction:.3` (encounters.js:35) – ett enskilt möte-skott kan aldrig ta mer än 30 % av max HP.
- En kill ger `+1 ammo +12 hp` (`killReward`, levels.js:143), och BIT läker `5 hp/s` (`bit.healPerSecond`). Nettot är ofta positivt HP-flöde även om man tar en träff per fiende.

**3. Varje "problem" har exakt en statisk lösning, och den är permanent inlärd efter första mötet.**
- Vaktens frontsköld (`RULES.encounters.guard`, encounters.js:26–31): `frontHalfAngleDeg:70`. `shieldBlocks()` (encounters.js:28) blockerar bara träffar inom 70° framför fienden.
- Flankera en gång, och lösningen är identisk varje efterföljande gång, i varje raid, resten av spelet – "you get that immediately and then you just do that".
- Samma statiska mönster för torn (EMP eller rör dig under `recoveryMs:2600`) och skyddad nod (skjut generatorn, `RULES.encounters.shield`). Ingen av dem varierar sig själv över tid.

**4. Bara tre rumsformer existerar.**
- `RULES.levels` (levels.js:12–14): L1 `rooms:1` ("Control Room"), L2 `rooms:2` + `passage:1.8` + `partition:true` ("Narrow Passage"), L3 `rooms:3` + `deadEnd:true` ("Dead End").
- Layoutpoolerna har 5 varianter per nivå (a–e, levels.js:69–89), men de skiljer bara rumsstorlek (10–15 m) och objektoffset – topologin är identisk inom varje nivå.
- Bunker/archipelago/town återanvänder samma generator, bara återskinnad (`townizeLevel`, `clearPassageProps`).
- Lords "bara 2 varianter" stämmer i praktiken: en korridor-form (L2/L3, i grunden samma form med ett rum till) och en enrumsform (L1).

**5. Ingen progression inom raiden.**
- Kommentar i koden själv (levels.js:14): *"No in-raid progression: no perks/abilities, no level-up during the raid; power comes only from meta (gear/skills) before the raid. Loot/extract is the goal, combat is a fee."*
- Striden är en avgift man betalar för loot, inte spelet man spelar – inget bygger sig upp eller känns annorlunda mellan raid #1 och raid #50 förutom meta-gearet.

**6. Fast målkedja.**
- Nod → nod → exit i samma mönster varje raid (`RULES.start`, `RULES.exit`, `nodeHoldMs:2000`).
- Inget spatialt val utöver att gå rätt väg (L2 har ett litet undantag, `routeChoices`, men det är det enda i hela systemet).

**7. Ingen koordinering, inga kulmönster, inga eliter/bossar.**
- AI:n är ett enkelt tillstånd per fiende (`stepEnemy`/`stepGuard`, combat.js): närma dig till standoff, ladda, skjut en rak salva, återhämta.
- Inga formationer mellan fiender, inga fan-/spread-mönster, ingen final-strid någonstans i raiden.

## 2. Vad gör Archero / Survivor.io / Soul Knight / Brawl Stars kul

**Archero** (gamedeveloper.com "Finding the Fun: Archero"; deconstructoroffun "How Archero Shot to the Top"; Macmillan "Difference and repetition in Archero"):
- Man rör sig ELLER skjuter – står man still autofyras närmaste fiende. Rörelse är själva färdigheten, inte transport.
- Fiender har tydliga, konsekventa mönster per typ – man lär sig en fiende en gång men möter den i nya kombinationer.
- Vissa fiendeprojektiler flyger över hinder som ens egna pilar inte gör → ett positioneringspussel, inte bara ett siktepussel.
- Skärmstora rum (man ser alla fiender direkt vid ingång), korta utbrott följt av en paus-rytm.
- Vid level-up väljer man 1 av 3 slumpade förmågor (pool ~50, tak ~11/kapitel) med stapelbara synergier (multishot, studs, frontpil).
- Ängel-/djävulsrum som bonusbeslut, boss var 10:e rum.

**Survivor.io** (Vampire Survivors-släkt):
- Auto-attack, växande horder, XP-kristaller.
- 1-av-3-val vid level-up, vapen- och passiv-evolution.
- Maktfantasi byggs upp gradvis över en 10–15 minuter lång körning.

**Soul Knight**:
- Twin-stick roguelite, rumsbaserad dungeon.
- Stridsrum låses tills de är rensade, sedan öppnas en kista.
- Många vapen + en karaktärsförmåga, buffar mellan våningar.
- Fiender med kulmönster, boss per våning.

**Brawl Stars**:
- Korta matcher, tydliga roller/arketyper per karaktär.
- En super-förmåga laddas av träffar.
- Läsbara projektiler man aktivt dodgear.
- Buskar/väggar som taktisk terräng, inte bara skydd.

**Gemensamt mönster:** rörelse som färdighet, läsbara men varierade/kombinerbara mönster, ett återkommande litet beslut (perk/evolution) som gör varje körning olika, och eskalerande tempo mot en final.

## 3. Kärnpelare

1. **Rörelse är färdigheten, inte transportmedlet.** Positionering/dodge ska vara huvuduttrycket för skicklighet – inte homing/assist som kompenserar för att man inte siktade.
2. **Läsbart men inte en gång för alla.** Telegraf kvarstår (coral-varning ≥ 1 s, ingen träff > 30 % HP), men lösningen ska inte bli ett permanent reflexminne efter första mötet – elitvarianter och nya mönster håller spänningen uppe.
3. **Ett beslut per rum.** Pick-1-av-3-perk efter varje rensat rum ger byggidentitet inom en körning, utan att röra meta-progressionen.
4. **Risk skalar med belöning, i samma logik som extraction.** "Giriga" perks och ruttval kopplar stridsrisk direkt till lootrisk – matchar regeln att död redan kostar allt man bär på sig.
5. **Eskalerande tempo mot extract.** Eliter och en liten guardian före sista extract-fönstret gör slutet till en topp, inte mer av samma.

## 4. Moment-to-moment-förslag

**a) Testa en stanna-för-att-skjuta-variant, inte en fullständig Archero-konvertering.**
- Behåll dagens kontroll (sikte-spinn släpps för att skjuta) – ingen ny inputmetod.
- Gör homing/assist rörelseberoende: `homingDegreesPerSecond` sänks från 90 till ~20–30 medan rörelsespinnen är aktiv, återgår till fullt (eller högre, t.ex. 110) när den är neutral.
- Samma princip för `assistAngleDegrees` (12° → 4° i rörelse).
- Resultat: att gå och skjuta funkar fortfarande mot stillastående/svaga mål på nära håll, men "bara gå framåt och skjuta" mot torn/vakt på distans slutar träffa pålitligt – man måste stanna för rena skott mot de farligare fienderna.

**b) Svagare homing generellt + fiendemönster som kräver sidledsrörelse.**
- Torn/sentry-salvan (`RULES.encounters.turret`, idag en rak 3-skotts salva) byggs om till en **fan** (±15° spridning över `burstShots`) så ett enda steg i sidled inte räcker för att stå still och tanka.
- Kombinerat med (a): att stanna ger bättre sikte men exponerar dig för en bredare spridning – en riktig avvägning i stunden, inte bara ett lönsamt val.
- Patrullens sikte-kon (`RULES.encounters.patrol`, 35°) kan på samma sätt få en bredare men långsammare svep-variant på senare nivåer, så "sno bakom den" fortfarande funkar men kräver bättre timing.

**c) Hinder som blockerar spelarens skott men inte alla fiendeprojektiler.**
- `traceTargets` blockerar redan linje för båda sidor mot lådor/väggar (symmetriskt) – idag är skydd alltid 100 % pålitligt.
- Förslag: gör granatkastarens ring-på-marken-mekanik (encounters.js, `placeGrenadier`) till en generell egenskap (`lobber:true`) som fler arketyper kan bära.
- En lobbers skott flyger i en båge över 1,1 m-lådor och kan inte blockeras av vanligt skydd – bara dodgeas genom att lämna ringen innan den smäller.
- Resultat: skydd blir pålitligt mot grunt/sentry/torn men inte mot lobber-typer, vilket tvingar ett aktivt beslut ("är det säkert att stå still här just nu?") istället för "hitta ett skydd en gång, stå där resten av rummet".

## 5. In-raid perk-system

Efter varje rensat rum (möte löst / alla fiender i rummet nere) väljer spelaren **1 av 3 slumpade perks**. Perks är **enbart in-raid**: de nollställs helt vid extract eller död, påverkar inte meta-progressionen och skapar ingen ny valuta – de är ett tillfälligt lager ovanpå den redan existerande meta-utrustningen (`RULES.playerStats`, `RULES.weaponIds`). 19 perks nedan, fördelade på fyra kategorier.

### Offense (5)

| Perk | Effekt | Synergi |
|---|---|---|
| Multiskott | +1 projektil per salva, −10 % spridningsnoggrannhet | Breach Shotgun (fler pellets totalt) |
| Studs | Ett skott per salva studsar en gång mot närmaste fiende inom 4 m | Vector SMG (hög eldhastighet ⇒ fler studsar) |
| Avrättare | +25 % skada mot fiender under 30 % HP | Marksman Rifle (hög skada per skott når tröskeln snabbt) |
| Kedjereaktion | En kill laddar nästa skott med +50 % skada (1 laddning) | Alla vapen, starkast vid hög eldhastighet |
| Stillståndsskott | Skott avlossade med neutral rörelsespinn (§4a) får full homing + 20 % extra skada | Marksman Rifle, kontrar §4b:s fan-mönster |

### Defense (5)

| Perk | Effekt | Synergi |
|---|---|---|
| Rullning | Dash-cooldown −25 % | Alla vapen; synergi med giriga perks nedan |
| Fantomrull | Osårbarhet under hela dashen (idag ingen i-frame) | Räddar giriga byggen från en felläst fan-salva |
| Taggpansar | Fiender som träffar dig på <1,5 m tar 2 skada tillbaka | Rusher/svärm-tunga rum |
| Nödsköld | Under 20 % HP: automatisk 2 s skadereduktion, en gång per rum | Kompenserar för giriga HP-perks |
| Barriärkliv | Dash flyttar dig förbi en redan avlossad salva utan att träffas | Kontrar torn/guard-salvor direkt |

### BIT (4)

BIT gör fortfarande bara en aktiv uppgift åt gången (följ, läka, eller en perk-uppgift) – perks byter *vilken* uppgift eller stärker den, de lägger inte till en parallell andra uppgift.

| Perk | Effekt | Synergi |
|---|---|---|
| Fältmedik | BIT:s läkning 5 → 8 hp/s | Alla byggen |
| Lockfågel | BIT kan dra en fiende till sig i 3 s (cooldown 20 s) – byter BIT:s enda aktiva uppgift från följ/läka till lock | Löser patrull/vakt-mötet utan Decoy-verktyget |
| Spaning | BIT flaggar fiender i synkonen 1 s tidigare ("!" kommer tidigare) | Kontrar §4b:s snabbare mönster |
| Nödreparation | BIT byter automatiskt till läkning om du går under 30 % HP, oavsett vad den gjorde innan | Säkerhetsnät för aggressiva byggen |

### Loot-risk / "giriga" perks (5)

| Perk | Effekt | Synergi |
|---|---|---|
| Girig ficka | +2 väskkapacitet, men −15 % max HP så länge perken är aktiv | Risk ökar ju senare man extraherar |
| Högriskhandel | Loot i rummet räknas som nästa materialnivå, men fiendeskada +15 % resten av raiden | Starkt tidigt, farligt sent |
| Plundrarens tur | +20 % chans på sällsynt material i rummet, men inga medkits kan användas förrän extract | Tvingar perfekt spel, inte bara bra tur |
| Allt eller intet | Extraherar man nivån utan att ta skada dubblas `extractScrapBonus` för den nivån, annars halveras den | Belönar att faktiskt lösa mötena, inte tanka dem |
| Djupdykare | En extra lootlåda i rummet, men nästa rums fiendeantal +1 | Direkt risk/reward-koppling, rum för rum |

**Interaktion med extraction-risken:** de giriga perkseffekterna (ficka, handel, tur, allt-eller-intet, djupdykare) gör exakt samma avvägning som redan finns i loot/extract-loopen – mer värde nu mot mer risk att dö och förlora allt man bär (den låsta regeln). De nollställs helt vid extract eller död; nästa raid börjar om från tre nya slumpade val, utan spår av föregående raids perks.

## 6. Fiendearketyper

Bygger på befintliga typer (`RULES.enemyTypes`, `RULES.encounters`) plus en ny föreslagen arketyp.

| Arketyp | Beteende | Mönster | Kontring | Område/nivå |
|---|---|---|---|---|
| Grunt | Närmar sig till standoff 3,5 m, skjuter enstaka skott | Rak salva, cooldown 1,4–2,4 s | Bryt linjen, flytta mellan skott | Alla nivåer |
| Rusher | Snabb, kort räckvidd (standoff 1,2 m) | Rusar rakt på | Dasha undan, dra in i korridor | L2–L3, `swarm` |
| Sentry/Torn | Stillastående, lång räckvidd, salva + återhämtning | Idag rak salva → föreslagen fan (§4b) | EMP, eller flytta under `recoveryMs:2600` | L2+, Town L2 |
| Thrower/Granatkastare | Stannar ~5 m ut, varnar 1,2 s, kastar på ringad ruta | Ring-på-marken, bågskott (lobber, §4c) | Kliv ur ringen, eller döda (2 HP) innan kastet | Archipelago L2, mix L2–L3 |
| Guard (sköld) | Står vid noden, 70° frontsköld, salva | Vänder sakta mot spelaren | Flankera eller lockbete | L2+ (aldrig L1) |
| Patrull | Fast slinga, 35°-synkon, 1 s "!" | Rak gångslinga | Smyg bakom/stealth, lockbete | L1, alla områden |
| Svärm | 4–5 rushers ur en spawnpunkt | Samtidigt utbrott vid trigger-radie 6,5 m | Granat på klustret, backa in i korridor | L3 |
| **Marksman (ny)** | Håller 8–10 m avstånd, skjuter ett långsamt telegraferat linjeskott som straffar att stå still | Siktlinje syns 1,5 s innan avfyring | Håll dig i rörelse; vanligt skydd funkar (ej lobber) | Föreslagen: L3, Town, kontrar "Stillståndsskott"-perken |

**Elitmodifierare:**
- En elitversion (coral kontur som visuell telegraf) får samma `hpMul:1.4` som Hard redan ger (`RULES.hard.hpMul`).
- Plus ett extra lager på sitt mönster – t.ex. en elit-guard som även lobbar en granat med jämna mellanrum, eller en elit-sentry vars fan-salva (§4b) får en fjärde linje.
- Detta är en förlängning av det redan planerade "vakten som elit på Hard L2–L3" (`docs/design-encounters-toolkit.md` §5), inte en ny mekanik från grunden.

**Mini-boss/guardian före extract:**
- En "Core Guardian" i L3:s sista rum/döda-ände: en hybrid av guard (sköld man måste flankera) och sentry (fan-salva efter att skölden brutits).
- Fas 1: skölden tvingar flankering som en vanlig guard. Fas 2 (efter sköldträff): fan-salvan (§4b) men bredare, plus en kort ryckframryckning mot spelaren.
- Placeras precis före extract-fönstret, så sista biten läser som en tydlig höjdpunkt, inte bara "fler kroppar att gå igenom".

## 7. Level- och rumsplan

**Rumsbaserat, inte bara nodkedja.** Behåll befintlig rums-/korridorgenerering (`generateLevel`, levels.js), men lägg en dörr/spärr som låser nästa rum tills det aktuella rummets möte/fiender är lösta. Samma `combat.visited`-spårning som redan finns för grace-timern (combat.js:15–18) kan återanvändas för att trigga dörrlås/upplåsning – ingen ny generator behövs, bara ett nytt tillstånd ovanpå.

**Rumsmallar:**
- 12–16 små skärmstora arenor (10–14 m, samma storleksintervall som idag).
- Fler hinderset än dagens två lådor per rum (`boxesPerRoom:2`): pelarkluster (motvikt mot marksman), lobber-fria skyddsnischer, öppna ytor avsedda för svärm-utbrott.
- Varje mall taggas med vilka arketyper den stödjer (t.ex. en mall med pelarkluster passar marksman + grunt, en öppen mall passar svärm), så placeringslogiken i `encounters.js` kan välja mall efter planerat möte istället för tvärtom.

**Modifierare per rum** (slumpade, seedade som idag):
- Mörker – kortare synradie, men telegraf syns ändå via coral (bryter inte regeln om ≥ 1 s varning).
- Översvämning – rörelse-debuff, ingen direkt skada (skiljer sig från stötplattorna).
- Befintliga stötplattor (`RULES.hazard`) återanvänds som bas, bara nya placeringsregler för fler rumstyper.

**Ruttval:**
- Bygg vidare på L2:s befintliga `routeChoices` (nod-väg vs loot-döda-ände) till ett riktigt risk/reward-val i varje nivå, inte bara L2.
- Kort väg: hoppar över ett möte, mindre loot. Lång väg: extra fiende, extra lootlåda. Valet görs synligt innan man går in (en skylt, som idag).

**Mappning L1–L3 + extract:**
- **L1** = ett rum, tutorial: lär ut §4a (stanna-för-att-skjuta) och patrull-mötet, första perk-valet kommer direkt efter rummet.
- **L2** = två rum + passage: ett nytt möte per rum (t.ex. guard + marksman), perk-val efter varje rum.
- **L3** = tre rum i kedja + döda ände: kombinerar två möten per rum som idag, avslutas med Core Guardian precis före extract. Det högsta-insats-perkvalet kommer direkt innan den striden.
- Samma struktur återskinnas per område (bunker/archipelago/town) som idag – ingen ny generator, bara nya hinder-/modifierarset och de nya mötena ovanpå den befintliga.

## 8. MVP-slice (1–2 PR:er)

**PR 1 – kärnkänsla** (bygger direkt på `combat.js`/`encounters.js`/`levels.js`, ingen ny rumsgenerator):
- §4a: rörelseberoende homing/assist (`RULES.weapon`, villkorlig på rörelsespinnens läge – liten ändring i spelarens skott-kod).
- §4b: en ny fan-salva för torn/sentry (liten ändring i `stepGuard`, combat.js).
- Perk-systemet, kapat till ~8 perks till start (2 per kategori) för att hålla scope litet: ny state för "aktiva perks denna raid", en pick-1-av-3-UI efter rumsclear, reset vid extract/död.
- Ingen rumslåsning än – perk-valet triggas på samma `combat.visited`-händelse som redan finns.

**Medvetet skippat i PR1:**
- Rumslåsande dörrar.
- Core Guardian/miniboss.
- Elitmodifierare.
- Nya rumsmallar/hinderset (12–16-poolen).
- Mörker-/översvämning-modifierare.
- Marksman-arketypen.
- Lobber som generell egenskap (behåll granatkastaren som den enda lobbern tills vidare).

**PR 2** (om PR1 känns bra i speltest):
- Rumslåsning, Core Guardian före extract.
- Resten av perkpoolen (19 st totalt).
- Elitmodifierare för Hard.
- Marksman-arketyp, lobber-egenskapen generaliserad till fler typer.
- Nya rumsmallar och modifierare (§7).

## 9. Playtest-mätningar

**Metrics att logga per raid/rum:**
- Träffar tagna per rum (snitt + spridning) – mål: synlig minskning jämfört med dagens baslinje när §4a/§4b är på.
- Tid per rum (clear time) – ska inte bara bli "långsammare", utan visa fler rörelse-beslut (stopp-och-skjut-ögonblick).
- Andel skott avlossade med neutral rörelsespinn vs. i rörelse – avgör om §4a faktiskt ändrar beteende eller bara straffar utan att styra spelaren mot det nya valet.
- Perk-valsfördelning: vilka perks väljs, vilka ignoreras konsekvent ("döda" perks att stärka eller ta bort).
- Dödsorsak per arketyp – redan spårat via `round.lastHit.source` / `deathTip()` (encounters.js:46–50), återanvänds direkt utan ny infrastruktur.
- Dash-användning per rum, och andel dashar som sker reaktivt (efter en varning) vs. proaktivt.
- Andel som extraherar med en girig perk aktiv, och andel av dem som dör med den aktiv (mäter om risk/reward-avvägningen känns verklig).

**Frågor till speltestare:**
- Kändes det som ett beslut att stanna och skjuta, eller ett irritationsmoment?
- Vilket möte/arketyp kändes bäst/sämst att läsa och kontra?
- Valde du perks för bygget du höll på att skapa, eller bara det som såg starkast ut i stunden?
- Märkte du någon fiende/mönster du var rädd för, till skillnad från idag?
- Skulle du spela fler raider i rad än idag (~5 innan Lord gav upp)?

**Lords dom:** samma test som gav citatet ovan – låt honom spela ~5 raider igen efter PR1 och ställ samma öppna fråga ("är kärnan kul, oavsett loot?"), inte en ledande följdfråga om specifika features.

## 10. Öppna frågor till Robert

1. Är §4a (rörelseberoende homing) en acceptabel ändring av kärnkontrollen så här sent, eller för stort ingrepp inför nästa speltest?
2. Ska rumslåsning (dörr tills rummet är rensat) in i PR1, eller är uppdelningen i §8 rätt prioritering?
3. Hur mycket ny konst tål vi för en Core Guardian/marksman – återanvänt chassi (sentry+guard) eller en helt ny modell?
4. Får "Allt eller intet"-perken (dubblar/halverar `extractScrapBonus`) röra ekonomin direkt, eller är det för känsligt utanför `economy-design.md`?
5. Ska perk-urvalet vara helt slumpat (1 av 3 ur hela poolen) eller viktat mot spelarens utrustade vapen/BIT-nivå, och är den vikten värd komplexiteten i PR1 eller PR2?
6. Konstregeln "BIT har inga cyan sidoremsor" – gäller det bara BIT:s chassi, eller även BIT-perkens visuella effekter (t.ex. Lockfågel-pulsen)?
7. Hur stor del av L1 (tutorial-rummet) får ändras för §4a-introduktionen innan det krockar med den redan byggda introtexten (`RULES.intro.tip`)?
8. Ska giriga perks kunna kombineras fritt (t.ex. Girig ficka + Plundrarens tur samtidigt), eller ska vi begränsa hur många "risk"-perks man kan bära samtidigt så ingen bygger ett omöjligt-att-klara-men-enormt-lönsamt läge?
9. Är marksman-arketypen värd att bygga i PR2, eller räcker fan-salvan (§4b) på befintliga sentry/torn för att nå samma känsla med mindre arbete?
