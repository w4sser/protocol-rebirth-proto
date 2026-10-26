# Designförslag: kärnstriden (PRB, v2.1.1 → nästa)

*Status: förslag, inget bygget ännu. Låst riktning som INTE får brytas: PvE only; död förlorar allt man bär på; ingen ny valuta; BIT kör en aktiv uppgift i taget. Konstregel: BIT har inga cyan sidoremsor. Bygger vidare på `docs/design-encounters-toolkit.md` (möten/verktyg) och `docs/design-playtest-oct25.md` (backpack, raid-summary) utan att motsäga dem.*

Bakgrund – Lords speltest-feedback (ordagrant):

> "the core isn't fun, so nothing else matters. You just walk forward and shoot, at least for the ~5 raids I could be bothered to play. You walk around the shield guy, but you get that immediately and then you just do that. Look at Archero or something with a similar core that's fun enough. The levels seem to be the same, only 2 variants? One with a long corridor and one with a single room."

## Nordstjärna: plan → feedback → bättre plan

Lords uppföljningssvar på samma speltest (ordagrant):

> "Fun = problem solving that is challenging and interesting enough: different options that give different results, you can make a plan, get feedback on what worked and what didn't, and improve the plan next time. If a working plan is just walk forward and shoot, it is 100% not fun."

> "The first level is ok, I get bored when I play 2-3 levels in a row that are quite similar and not challenging."

Det här är nu dokumentets facit, inte bara ytterligare feedback. Varje förslag längre ner mäts mot tre frågor, och sektionerna avslutas med en uttrycklig bedömning mot dem:

- **(a) Val:** Skapar förslaget ett riktigt val med olika utfall – eller finns det en dominant plan som alltid vinner, oavsett situation?
- **(b) Feedback:** Får spelaren tydligt veta vad som funkade och inte – dödsorsak, rumsrecap, BIT-kommentar, en resultatskärm i stil med "du blev träffad av X medan du gjorde Y"?
- **(c) Variation + stigande svårighet:** Skiljer sig raid 2–3 och framåt tydligt från varandra och blir svårare, så att "gå fram och skjut" aldrig är en hållbar plan i L2/L3? (L1 får förbli en enkel, oförändrad introduktion.)

Förslag som misslyckas mot en eller flera av dessa skärs eller skrivs om nedan – det räcker inte att vara en bra idé i sig, den måste stödja plan → feedback → bättre plan.

**Kärnpelarna (§3) i nordstjärnans ljus:**
1. Rörelse som färdighet → ger **(a)**: positionering/dodge är ett beslut med olika utfall, inte ett homing-skyddsnät som gör sikte irrelevant.
2. Läsbart men inte en gång för alla → ger **(c)**: samma fiende kräver en ny plan i nya kombinationer, inte ett permanent inlärt reflexminne efter första mötet.
3. Ett beslut per rum (perks) → ger **(a)** rum för rum, och **(b)** om nästa rums utfall faktiskt visar att valet spelade roll.
4. Risk skalar med belöning → ger **(b)**: resultatskärmen måste visa om risken lönade sig, annars är kopplingen till plan/feedback osynlig för spelaren.
5. Eskalerande tempo mot extract → ger **(c)**, men nordstjärnan skärper kravet: eskaleringen måste synas raid för raid redan från raid 2–3, inte bara i sista rummet av en enskild raid.

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

*(Se Nordstjärna ovan – pelarna nedan är den omsatt i systemregler.)*

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

**d) Varför "gå fram och skjut" slutar vara en fungerande plan i L2/L3.**
Namngivna mekanismer, inte en förhoppning:
- **Rörelseberoende homing (§4a):** gå och skjut samtidigt tappar träffsäkerhet mot allt bortom närhet – rätt plan mot torn/marksman blir "stanna, skjut, flytta", inte "gå och skjut".
- **Fan-salva (§4b):** ett enda sidosteg räcker inte längre mot sentry/torn; kräver faktisk sidledsrörelse, dvs. ett dodge-krävande mönster.
- **Lobber-egenskap (§4c):** går runt skydd och kräver att man lämnar en ring innan den smäller – ett positioneringspussel som inte går att lösa genom att bara gå och skjuta från valfri ruta.
- **Fiendekombinationer (§6/§7):** Guard+Marksman straffar flankvägen (marksman har fri sikt dit du flankerar); Svärm+Sentry straffar att stå och tanka fan-salvan medan rushers kommer in i flanken. Ingen enskild arketyp löser kombon – planen måste ändras mitt i rummet.
- **Perk-avvägningar (§5):** giriga perks sänker buffert (lägre maxHP, inga medkits) så att tanka-skador inte längre är gratis; "Stillståndsskott" gör det aktivt sämre att bara gå och skjuta eftersom den belönar att stanna.
- **Core Guardian (§6):** tvåfas-fiende tvingar ett planbyte mitt i striden (flankera skölden → dodga bredare fan + ryckframryckning), rakt motsatsen till en enda gå-fram-plan.

**Bedömning mot nordstjärnan:**

| Förslag | (a) Olika utfall? | (b) Tydlig feedback? | (c) Variation/eskalering raid 2–3+? | Dom |
|---|---|---|---|---|
| a) Rörelseberoende homing | Ja – stå still vs. gå ger olika träffsäkerhet, ett verkligt läges-val | Delvis – spelaren känner det i träffprocent, men inget explicit visar "du missade för att du rörde dig" | Ja, men bara om fler arketyper (marksman, PR2) utnyttjar det – utan dem märks skillnaden mest mot torn | **Behåll**, men koppla till en explicit feedback-rad (se §9) |
| b) Svagare homing + fan-/sveep-mönster | Ja – stå still (bättre sikte) mot bredare exponering är en riktig avvägning | Ja – en bredare salva som träffar ger ett tydligt "du stod still för länge"-utfall | Ja – kan trappas upp (bredare fan, snabbare svep) nivå för nivå utan ny konst | **Behåll** |
| c) Lobber som generell egenskap | Ja – "är det säkert att stå still här" är ett äkta beslut per sekund | Delvis – dödsorsak måste peka ut lobbern specifikt (redan möjligt via `round.lastHit.source`, men bara om lobber-typer får ett eget tydligt namn i UI) | Ja – fler arketyper kan bära den i PR2, naturlig eskalering | **Behåll**, men PR1 bör inte lova mer än granatkastaren (redan i §8) |

## 5. In-raid perk-system

Efter varje rensat rum (möte löst / alla fiender i rummet nere) väljer spelaren **1 av 3 slumpade perks**. Perks är **enbart in-raid**: de nollställs helt vid extract eller död, påverkar inte meta-progressionen och skapar ingen ny valuta – de är ett tillfälligt lager ovanpå den redan existerande meta-utrustningen (`RULES.playerStats`, `RULES.weaponIds`). 19 perks nedan, fördelade på fyra kategorier.

### Offense (5)

| Perk | Effekt | Synergi | Nordstjärna |
|---|---|---|---|
| Multiskott | +1 projektil per salva, −10 % spridningsnoggrannhet | Breach Shotgun (fler pellets totalt) | (a) opportunitetskostnad mot de andra 2 valen räcker; (b) syns i träffstatistik. **Behåll** |
| Studs | Ett skott per salva studsar en gång mot närmaste fiende inom 4 m | Vector SMG (hög eldhastighet ⇒ fler studsar) | Samma som ovan. **Behåll** |
| Avrättare | +25 % skada mot fiender under 30 % HP | Marksman Rifle (hög skada per skott når tröskeln snabbt) | (a) stark mot segslitna möten, svag mot snabba kills – reellt val. **Behåll** |
| Kedjereaktion | En kill laddar nästa skott med +50 % skada (1 laddning) | Alla vapen, starkast vid hög eldhastighet | (a/b) belönar sekvensering (kill-ordning), syns direkt i nästa skottskada. **Behåll** |
| Stillståndsskott | Skott avlossade med neutral rörelsespinn (§4a) får full homing + 20 % extra skada | Marksman Rifle, kontrar §4b:s fan-mönster | (a) rak motvikt till §4a – att stanna blir ett eget val, inte bara ett straff. **Behåll** |

### Defense (5)

| Perk | Effekt | Synergi | Nordstjärna |
|---|---|---|---|
| Rullning | Dash-cooldown −25 % | Alla vapen; synergi med giriga perks nedan | **Behåll** |
| Fantomrull | Osårbarhet under hela dashen (idag ingen i-frame) | Räddar giriga byggen från en felläst fan-salva | (a) FAILAR – hel dash-osårbarhet gör dash till en universallösning mot alla mönster (fan, lobber, svärm), ingen kvarvarande plan behövs. **Omarbeta:** kort i-frame (t.ex. 150–200 ms kring dashstarten), inte hela dashens längd |
| Taggpansar | Fiender som träffar dig på <1,5 m tar 2 skada tillbaka | Rusher/svärm-tunga rum | (a) nischval mot specifika arketyper. **Behåll** |
| Nödsköld | Under 20 % HP: automatisk 2 s skadereduktion, en gång per rum | Kompenserar för giriga HP-perks | (b) engångs-karaktären gör att spelaren märker exakt när den tog slut. **Behåll** |
| Barriärkliv | Dash flyttar dig förbi en redan avlossad salva utan att träffas | Kontrar torn/guard-salvor direkt | (a) begränsat till en redan avfyrad salva, kräver fortfarande timing – inte en blankocheck. **Behåll** |

### BIT (4)

BIT gör fortfarande bara en aktiv uppgift åt gången (följ, läka, eller en perk-uppgift) – perks byter *vilken* uppgift eller stärker den, de lägger inte till en parallell andra uppgift.

| Perk | Effekt | Synergi | Nordstjärna |
|---|---|---|---|
| Fältmedik | BIT:s läkning 5 → 8 hp/s | Alla byggen | **Behåll** |
| Lockfågel | BIT kan dra en fiende till sig i 3 s (cooldown 20 s) – byter BIT:s enda aktiva uppgift från följ/läka till lock | Löser patrull/vakt-mötet utan Decoy-verktyget | (a) cooldown tvingar ett timing-val (lock nu eller spara till värre rum). **Behåll** |
| Spaning | BIT flaggar fiender i synkonen 1 s tidigare ("!" kommer tidigare) | Kontrar §4b:s snabbare mönster | (c) blir viktigare ju mer §4b-mönster eskalerar – skalar naturligt med svårighet. **Behåll** |
| Nödreparation | BIT byter automatiskt till läkning om du går under 30 % HP, oavsett vad den gjorde innan | Säkerhetsnät för aggressiva byggen | (a) FAILAR som skriven – helt automatisk och obegränsad tar bort beslutet "retirera eller fortsätt pusha" som pelare 4 bygger på. **Omarbeta:** samma engångs-per-rum-begränsning som Nödsköld |

### Loot-risk / "giriga" perks (5)

| Perk | Effekt | Synergi | Nordstjärna |
|---|---|---|---|
| Girig ficka | +2 väskkapacitet, men −15 % max HP så länge perken är aktiv | Risk ökar ju senare man extraherar | (a/b) HP-sänkningen gör efterföljande träffar synligt farligare. **Behåll** |
| Högriskhandel | Loot i rummet räknas som nästa materialnivå, men fiendeskada +15 % resten av raiden | Starkt tidigt, farligt sent | (a) tidsberoende avvägning (tidig vs sen i raiden) är ett äkta val. **Behåll** |
| Plundrarens tur | +20 % chans på sällsynt material i rummet, men inga medkits kan användas förrän extract | Tvingar perfekt spel, inte bara bra tur | (a) hög risk, kräver att man faktiskt undviker träffar – inte bara tur. **Behåll** |
| Allt eller intet | Extraherar man nivån utan att ta skada dubblas `extractScrapBonus` för den nivån, annars halveras den | Belönar att faktiskt lösa mötena, inte tanka dem | (b) kräver att resultatskärmen visar vilket utfall som triggades (se §9 – ny rad). **Behåll**, men beroende av synlig feedback |
| Djupdykare | En extra lootlåda i rummet, men nästa rums fiendeantal +1 | Direkt risk/reward-koppling, rum för rum | (a/c) fiendeantal+1 eskalerar naturligt rum för rum. **Behåll** |

**Interaktion med extraction-risken:** de giriga perkseffekterna (ficka, handel, tur, allt-eller-intet, djupdykare) gör exakt samma avvägning som redan finns i loot/extract-loopen – mer värde nu mot mer risk att dö och förlora allt man bär (den låsta regeln). De nollställs helt vid extract eller död; nästa raid börjar om från tre nya slumpade val, utan spår av föregående raids perks.

**Sammanfattande dom §5:** 17 av 19 perks klarar alla tre nordstjärnekriterier. Två (Fantomrull, Nödreparation) skrivs om enligt ovan innan PR2 – båda i sin nuvarande form tar bort ett beslut istället för att skapa ett.

## 6. Fiendearketyper

Bygger på befintliga typer (`RULES.enemyTypes`, `RULES.encounters`) plus en ny föreslagen arketyp.

| Arketyp | Beteende | Mönster | Kontring | Område/nivå | Nordstjärna: ensam / i kombo |
|---|---|---|---|---|---|
| Grunt | Närmar sig till standoff 3,5 m, skjuter enstaka skott | Rak salva, cooldown 1,4–2,4 s | Bryt linjen, flytta mellan skott | Alla nivåer | Ensam: svag, gå-fram-skjut funkar. I kombo: tvingar andra arketyper att dela uppmärksamhet |
| Rusher | Snabb, kort räckvidd (standoff 1,2 m) | Rusar rakt på | Dasha undan, dra in i korridor | L2–L3, `swarm` | Ensam: kräver ett dash-/sidstegsbeslut. I kombo (Svärm): se nedan |
| Sentry/Torn | Stillastående, lång räckvidd, salva + återhämtning | Idag rak salva → föreslagen fan (§4b) | EMP, eller flytta under `recoveryMs:2600` | L2+, Town L2 | Ensam: bryter gå-fram-skjut själv efter §4b. I kombo (+Svärm): tankar fan samtidigt som flank hotas |
| Thrower/Granatkastare | Stannar ~5 m ut, varnar 1,2 s, kastar på ringad ruta | Ring-på-marken, bågskott (lobber, §4c) | Kliv ur ringen, eller döda (2 HP) innan kastet | Archipelago L2, mix L2–L3 | Ensam: bryter gå-fram-skjut själv (skydd hjälper inte) |
| Guard (sköld) | Står vid noden, 70° frontsköld, salva | Vänder sakta mot spelaren | Flankera eller lockbete | L2+ (aldrig L1) | Ensam: FAILAR (c) – statisk lösning lärs en gång (diagnos §1.3). I kombo (+Marksman): flankvägen straffas, tvingar ny plan |
| Patrull | Fast slinga, 35°-synkon, 1 s "!" | Rak gångslinga | Smyg bakom/stealth, lockbete | L1, alla områden | L1-arketyp, avsiktligt enkel – gå-fram-skjut får funka här |
| Svärm | 4–5 rushers ur en spawnpunkt | Samtidigt utbrott vid trigger-radie 6,5 m | Granat på klustret, backa in i korridor | L3 | Ensam: tvingar dodge-mönster, inte gå-fram-skjut |
| **Marksman (ny)** | Håller 8–10 m avstånd, skjuter ett långsamt telegraferat linjeskott som straffar att stå still | Siktlinje syns 1,5 s innan avfyring | Håll dig i rörelse; vanligt skydd funkar (ej lobber) | Föreslagen: L3, Town, kontrar "Stillståndsskott"-perken | Ensam: straffar stillastående, rak motvikt till §4a. I kombo (+Guard): se ovan |

**Dom:** Guard ensam klarar inte (c) – det är precis Lords "you get that immediately and then you just do that"-klagomål (§1). Den behålls som arketyp (bra mot (a) och (b) isolerat: tydligt flankeringsval, tydlig feedback) men **måste** paras med minst en annan arketyp (Marksman eller Sentry) i varje L2+-rum den förekommer i – se kombolistan i §7. Guard utan partner-arketyp ska inte längre förekomma i L2/L3 efter raid 1.

**Elitmodifierare:**
- En elitversion (coral kontur som visuell telegraf) får samma `hpMul:1.4` som Hard redan ger (`RULES.hard.hpMul`).
- Plus ett extra lager på sitt mönster – t.ex. en elit-guard som även lobbar en granat med jämna mellanrum, eller en elit-sentry vars fan-salva (§4b) får en fjärde linje.
- Detta är en förlängning av det redan planerade "vakten som elit på Hard L2–L3" (`docs/design-encounters-toolkit.md` §5), inte en ny mekanik från grunden.
- **Nordstjärna:** elitlagret är (c) per definition (höjer svårighet), men ger bara (a)/(b) om det extra lagret kräver en *annan* kontring än basversionen (elit-guard+lobb tvingar att inte bara stå kvar efter flankering) – annars är det bara mer HP, vilket inte är en ny plan.

**Mini-boss/guardian före extract:**
- En "Core Guardian" i L3:s sista rum/döda-ände: en hybrid av guard (sköld man måste flankera) och sentry (fan-salva efter att skölden brutits).
- Fas 1: skölden tvingar flankering som en vanlig guard. Fas 2 (efter sköldträff): fan-salvan (§4b) men bredare, plus en kort ryckframryckning mot spelaren.
- Placeras precis före extract-fönstret, så sista biten läser som en tydlig höjdpunkt, inte bara "fler kroppar att gå igenom".
- **Nordstjärna:** klarar (a) och (c) tydligt – tvåfas-fienden tvingar ett planbyte mitt i striden. (b) kräver att fas-övergången har en egen telegraf (t.ex. BIT-kommentar "skölden är nere, nu kommer salvan bredare") så spelaren förstår *varför* planen måste ändras, inte bara att den gör det. **Behåll**, men lägg till den telegrafen i scope.

## 7. Level- och rumsplan

**Rumsbaserat, inte bara nodkedja.** Behåll befintlig rums-/korridorgenerering (`generateLevel`, levels.js), men lägg en dörr/spärr som låser nästa rum tills det aktuella rummets möte/fiender är lösta. Samma `combat.visited`-spårning som redan finns för grace-timern (combat.js:15–18) kan återanvändas för att trigga dörrlås/upplåsning – ingen ny generator behövs, bara ett nytt tillstånd ovanpå.

**Rumsmallar – delad pool, men L1/L2/L3 får inte dra från samma delmängd:**
- 12–16 små skärmstora arenor (10–14 m, samma storleksintervall som idag), men indelade i tre taggade delmängder så att L2 och L3 *ser* annorlunda ut mot L1 och mot varandra, inte bara möter andra fiender i samma rum:
  - **L1-delmängd (2 mallar):** dagens enkla "Control Room"-form, oförändrad.
  - **L2-delmängd (5–6 mallar):** pelarkluster (motvikt mot marksman), lobber-fria skyddsnischer – mellanstora arenor med brytande siktlinjer.
  - **L3-delmängd (5–6 mallar):** större öppna ytor för svärm-utbrott + en trång döda-ände-form för Core Guardian.
- Varje mall taggas med vilka arketyper den stödjer (t.ex. en mall med pelarkluster passar marksman + grunt, en öppen mall passar svärm), så placeringslogiken i `encounters.js` kan välja mall efter planerat möte istället för tvärtom.

**Fiendekombinationer per nivå (inte bara enskilda arketyper):**
- **L2:** Guard+Marksman (flankvägen straffas) är målbilden, men kräver Marksman-arketypen (PR2). Till dess används **Guard+Sentry** (flankvägen går rätt in i sentryns fan-salva) som en PR1-vänlig stand-in med samma funktion, bara befintliga arketyper. Sentry+Rusher (fan-salva + inträngande flank) är också PR1-vänlig.
- **L3:** Svärm+Sentry (tanka fan medan rushers kommer in), Svärm+Thrower (lobber-ring mitt i ett rörligt utbrott) – båda PR1-vänliga. Avslutas med Core Guardian (PR2).
- Guard förekommer aldrig ensam i L2/L3 efter raid 1 (se §6-dom) – alltid parad med minst en av ovanstående.

**Modifierare per rum** (slumpade, seedade som idag; L2 och L3 får olika styrka, inte samma pool):
- Mörker – kortare synradie, men telegraf syns ändå via coral (bryter inte regeln om ≥ 1 s varning). Introduceras i L2 från och med raid 3.
- Översvämning – rörelse-debuff, ingen direkt skada (skiljer sig från stötplattorna). Introduceras i L3 från och med raid 4, kan staplas med Mörker i döda-änden.
- Befintliga stötplattor (`RULES.hazard`) återanvänds som bas, bara nya placeringsregler för fler rumstyper.

**Ruttval:**
- Bygg vidare på L2:s befintliga `routeChoices` (nod-väg vs loot-döda-ände) till ett riktigt risk/reward-val i varje nivå, inte bara L2.
- Kort väg: hoppar över ett möte, mindre loot. Lång väg: extra fiende, extra lootlåda. Valet görs synligt innan man går in (en skylt, som idag).

**Mappning L1–L3 + extract:**
- **L1** = ett rum, tutorial: lär ut §4a (stanna-för-att-skjuta) och patrull-mötet, första perk-valet kommer direkt efter rummet. Oförändrad raid efter raid – Lord har inget problem med L1.
- **L2** = två rum + passage, L2-mallpool: Guard+Marksman (Guard+Sentry till dess Marksman finns, se §8) i ena rummet, Sentry+Rusher i det andra, perk-val efter varje rum.
- **L3** = tre rum i kedja + döda ände, L3-mallpool: Svärm+Sentry och Svärm+Thrower i de två första rummen, Core Guardian i döda änden. Det högsta-insats-perkvalet kommer direkt innan den striden.
- Samma struktur återskinnas per område (bunker/archipelago/town) som idag – ingen ny generator, bara nya hinder-/modifierarset och de nya mötena ovanpå den befintliga.

**Progressionskurva, raid 1–5** (visar målbilden med både PR1 och PR2 landade – §8 preciserar vilken delmängd som finns redan efter PR1; L2/L3 ska kännas olika redan från start, inte "samma 2–3 varianter" som idag):

| Raid | L2 | L3 |
|---|---|---|
| 1 | Guard+Marksman, ingen modifierare | Svärm+Sentry, Core Guardian fas 1+2 |
| 2 | Sentry+Rusher (ny kombo), fortfarande ingen modifierare | Svärm+Thrower (ny kombo) |
| 3 | Mörker-modifierare introduceras i ett av rummen | Elitmodifierare (§6) på en arketyp i kombon |
| 4 | Lång rutt får en extra fiende från den andra kombon (blandad) | Översvämning introduceras i döda-änden, staplas med Mörker |
| 5 | Mallrotation (seedad) byter vilket rum som får Mörker | Core Guardian fas 2 får den fjärde fan-linjen (elit-lagret, §6) |

Målet är att raid 3 redan känns tydligt annorlunda än raid 1 i både L2 och L3 – direkt svar på "bored when I play 2-3 levels in a row that are quite similar".

**Bedömning mot nordstjärnan:**

| Förslag | (a) Olika utfall? | (b) Tydlig feedback? | (c) Variation/eskalering raid 2–3+? | Dom |
|---|---|---|---|---|
| Rumslåsning | Nej i sig (bara struktur) – men möjliggör (a) genom att tvinga möten att lösas i ordning | Ja – en låst dörr är tydlig feedback på "det här rummet är inte klart" | Neutral | **Behåll** som infrastruktur |
| Delad mallpool per nivå (L1/L2/L3) | Ja – olika hinder/layout kräver olika taktik per nivå | Indirekt (syns i spelet, inte i UI) | Ja – kärnan i att L2/L3 ska skilja sig åt visuellt och taktiskt | **Behåll**, prioritera över en enda delad 12–16-pool |
| Fiendekombinationer per nivå | Ja – kombinationerna är designade just för att bryta enskilda statiska lösningar | Ja, om dödsorsak/recap pekar ut kombon ("du dog för Sentry-fan medan Rusher flankerade") | Ja – nya kombon kan rullas in raid för raid utan ny konst | **Behåll**, högst prioritet av §7-förslagen |
| Modifierare (Mörker/Översvämning) | Svag ensam (påverkar svårighet, inte val) | Ja för Mörker (syns i synradie) | Ja – trappas upp raid 3/4 enligt kurvan ovan | **Behåll**, men inför gradvis (se kurva), inte från raid 1 |
| Ruttval (risk/reward per nivå) | Ja – kort/lång väg är ett väganvändarval med olika pris | Delvis – belöningen syns, men inte alltid varför vägen var farligare | Neutral/upprepat mönster | **Behåll** |

## 8. MVP-slice (1–2 PR:er)

**PR 1 – kärnkänsla** (bygger direkt på `combat.js`/`encounters.js`/`levels.js`, ingen ny rumsgenerator; se nordstjärne-bedömning och rekommendation nedan för varför kombon/Mörker är med trots "ingen ny rumsgenerator"):
- §4a: rörelseberoende homing/assist (`RULES.weapon`, villkorlig på rörelsespinnens läge – liten ändring i spelarens skott-kod).
- §4b: en ny fan-salva för torn/sentry (liten ändring i `stepGuard`, combat.js).
- Perk-systemet, kapat till ~8 perks till start (2 per kategori) för att hålla scope litet: ny state för "aktiva perks denna raid", en pick-1-av-3-UI efter rumsclear, reset vid extract/död.
- Ingen rumslåsning än – perk-valet triggas på samma `combat.visited`-händelse som redan finns.
- L2/L3-fiendekombinationer med befintliga arketyper (Guard+Sentry och Sentry+Rusher i L2, Svärm+Sentry och Svärm+Thrower i L3) och Mörker-modifieraren enligt §7:s raid 1–5-kurva – ny placeringslogik i `encounters.js`, inga nya mallar eller ny konst. Guard+Marksman (målbilden i §7) väntar till Marksman-arketypen i PR2.

**Medvetet skippat i PR1:**
- Rumslåsande dörrar.
- Core Guardian/miniboss.
- Elitmodifierare.
- Nya rumsmallar/hinderset (12–16-poolen).
- Översvämning-modifieraren (Mörker är med, se ovan).
- Marksman-arketypen.
- Lobber som generell egenskap (behåll granatkastaren som den enda lobbern tills vidare).

**PR 2** (om PR1 känns bra i speltest):
- Rumslåsning, Core Guardian före extract.
- Resten av perkpoolen (19 st totalt).
- Elitmodifierare för Hard.
- Marksman-arketyp, lobber-egenskapen generaliserad till fler typer.
- Nya rumsmallar och modifierare (§7).

**Bedömning mot nordstjärnan:**

| Del | (a) Olika utfall? | (b) Tydlig feedback? | (c) Variation/eskalering raid 2–3+? | Dom |
|---|---|---|---|---|
| §4a/§4b (homing + fan) | Ja | Delvis – behöver feedback-raden från §9 | Ja, men bara märkbart mot torn/sentry utan nya kombon | **Behåll** |
| Perks (8 st) | Ja, pick-1-av-3 | Ja om döds-/rumsrecap nämner aktiv perk | Perk-slumpen ger variation, men ersätter inte rum/fiende-variation | **Behåll** |
| Kombon + Mörker (flyttade in i PR1 ovan) | Ja – olika kombo kräver olika plan | Ja om recap pekar ut kombon | Ja – ger ett första, litet (c)-slice redan i PR1 | **Behåll** |

**Varför kombon flyttades in i PR1:** i den ursprungliga uppdelningen låg allt som ger (c) – nya kombon, delad mallpool, modifierare – i PR2. Lords "bored after 2-3 levels" är specifikt ett (c)-klagomål. Ett fullt 5-raid-speltest direkt efter en PR1 utan någon (c) hade riskerat samma dom som idag ("samma 2-3 varianter"), trots att kärnkänslan blivit bättre. Kombona och Mörker är billiga att dra in tidigt (återanvänder befintliga arketyper, ingen ny konst) och ger PR1 täckning på alla tre kriterier, så Lords 5-raidstest (§9) blir ett verkligt test av nordstjärnan – inte bara av kontrollkänslan. Nya rumsmallar, Core Guardian, elitmodifierare, Marksman och generell lobber kräver mer konst/arbete och väntar till PR2 utan att döda (c)-testet.

## 9. Playtest-mätningar

**Metrics att logga per raid/rum:**
- Träffar tagna per rum (snitt + spridning) – mål: synlig minskning jämfört med dagens baslinje när §4a/§4b är på.
- Tid per rum (clear time) – ska inte bara bli "långsammare", utan visa fler rörelse-beslut (stopp-och-skjut-ögonblick).
- Andel skott avlossade med neutral rörelsespinn vs. i rörelse – avgör om §4a faktiskt ändrar beteende eller bara straffar utan att styra spelaren mot det nya valet.
- Perk-valsfördelning: vilka perks väljs, vilka ignoreras konsekvent ("döda" perks att stärka eller ta bort).
- Dödsorsak per arketyp – redan spårat via `round.lastHit.source` / `deathTip()` (encounters.js:46–50), återanvänds direkt utan ny infrastruktur.
- Dash-användning per rum, och andel dashar som sker reaktivt (efter en varning) vs. proaktivt.
- Andel som extraherar med en girig perk aktiv, och andel av dem som dör med den aktiv (mäter om risk/reward-avvägningen känns verklig).
- **Bytte spelaren plan mellan försök på samma möte/rum?** (t.ex. flankerade annorlunda, väntade in en salva, valde en annan perk) – direkt mätning av nordstjärnans (a)+(c): om planen aldrig ändras är det ett tecken på en dominant lösning, oavsett vad metrics ovan visar.
- **Kan spelaren säga varför de dog**, utan att titta i loggar – jämför spelarens egen förklaring mot `round.lastHit.source`/`deathTip()`. Stämmer de inte överens är feedback-loopen (b) trasig, oavsett hur korrekt dödsorsaken loggas internt.

**Frågor till speltestare:**
- Kändes det som ett beslut att stanna och skjuta, eller ett irritationsmoment?
- Vilket möte/arketyp kändes bäst/sämst att läsa och kontra?
- Valde du perks för bygget du höll på att skapa, eller bara det som såg starkast ut i stunden?
- Märkte du någon fiende/mönster du var rädd för, till skillnad från idag?
- Vad dödade dig – kan du beskriva det själv, innan vi visar loggen?
- Kändes raid 3 annorlunda än raid 1, eller samma rum/fiender igen?
- Skulle du spela fler raider i rad än idag (~5 innan Lord gav upp)?

**Lords dom efter 5 raider:** samma test som gav citaten ovan – låt honom spela ~5 raider igen efter PR1 och ställ samma öppna fråga ("är kärnan kul, oavsett loot?"), inte en ledande följdfråga om specifika features. Facit är nordstjärnan, konkret: (1) kunde han någon gång köra "gå fram och skjut" rakt igenom ett L2/L3-rum och vinna, (2) bytte han plan mellan försök, (3) kunde han förklara sin egen död, (4) kändes raid 3 annorlunda än raid 1. Om svaret på (1) är ja, eller (2)–(4) är nej, är vi inte i mål – oavsett hur bra övriga metrics ser ut.

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
