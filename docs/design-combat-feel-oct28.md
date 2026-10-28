# Designförslag: stridskänsla, läsbara hot och fler verb (PRB, v2.5.1 till nästa)

*Status: dokumentförslag för Roberts beslut, ingen implementation beställd. Endast detta dokument ändras.
Låst riktning gäller: PvE only; död förlorar allt man bär; ingen ny valuta; BIT kör en aktiv uppgift i taget; inga betaltjänster
(ljud enligt `docs/audio-pipeline.md`, procedurell SFX). Bygger på `docs/design-combat-core-oct26.md` och
`docs/design-stakes-perks-oct27.md`. Alla nya siffror ska ligga i `data/*.js` / `RULES`, inte i `game.mjs`.*

## Bakgrund: Lords speltest av v2.5.1

> - var lite mer variation i början nu iaf, blev dödad av en grupp i raid 3
> - irriterande att select unlock grejen kommer upp precis när man dödat nån så man inte får confirmation
> - verkade fortfarande som den enda strategin var att gå fram och skjuta [...] kändes fortfarande tråkigt efter 3-4 raids,
>   undrar om det även har med att göra hur clunky själva skjutandet är
> - den som hade en visuell kon framför sig var den enda som var lite rolig, då fick man iaf gå runt o skjuta den från sidan

Nordstjärna (oförändrad): kul = problemlösning. Flera alternativ med olika utfall, en plan, begriplig återkoppling, bättre plan nästa gång.

Tolkning: (1) varje kill måste kännas och synas innan något annat händer (AGENTS.md: "Clarity over cleverness");
(2) patrullens kon fungerar för att hotet är **synligt i världen och har en svag sida**; det ska bli hela fiendespråket;
(3) spelaren behöver fler verb än "gå fram och skjut" för att olika planer ska finnas.

## 1. Kodfakta (v2.5.1, `main` 17bf5ae)

**Skjutinput.** Vänster stick = gå, höger stick = sikta; skottet avfyras **vid släpp** av höger stick (`release()` i `game.mjs`,
`releaseAim()` i `controls.js`). Sikte: `RULES.aimControls` = dead zone **12 px**, utjämning `responseSeconds` **0,12 s**,
max vridning **6 rad/s** (~344°/s). En 180°-vändning tar alltså minst ~0,52 s plus utjämning; till det kommer att skottet först
går när man släpper. Detta är sannolikt huvuddelen av "clunky": tap-to-shoot på ett mål bakom en kräver ett helt dra-släpp-varv.

**Assist.** `RULES.weapon` (Basic): `assistAngleDegrees` 12, `assistWidth` 1,1 m; i rörelse (`data/raid-combat.js`) **4° / 0,4 m**,
homing 90 → **30 °/s**. Räckvidd 7 m, kon 8°, skada 1, **magasin 3**, omladdning **700 ms**, skottintervall **180 ms**,
kulhastighet 19 m/s. Fiender har oftast 2-3 HP (`enemyHealth` 3, mötestyper 2). Med 3 skott/magasin och 2-3 HP blir varje mål
"ett magasin": skjut 3, vänta 0,7 s, upprepa. Rörelseassisten på 4° gör att skott i rörelse ofta missar, så den effektiva
strategin blir att stå still och skjuta, vilket förstärker "gå fram och skjut".

**Träff-/killfeedback.** Det som finns: `RULES.feedback.hitFlashMs` **240 ms** (DOM-etikett med sprickmönster över fienden),
skadesiffra **700 ms**, blockgnista mot sköld. Det som **saknas**: hitstop, kameraskak, kill-specifik effekt (dödsanimation,
partiklar, ljud), recoil/munflamma, och **allt ljud** i raiden (ingen `AudioContext`/`Audio` i `nodspel/`; ljudpipelinen ligger i
PR #133, ej mergad). En kill ser i praktiken ut som en träff där etiketten försvinner.

**Perk-pickens timing.** `updateClears()` (`perks.js`) sätter rummet `clearPending` i **samma frame** som sista fiendens HP blir 0.
`safePick()` kräver bara: spelaren i rummet, inga levande fiender där, inga projektiler/blaster/telegrafer, ingen aktiv hazard.
Det finns **ingen fördröjning** efter killen, så pickern (`openPerk()` → `pausePick()`) öppnas oftast nästa frame och täcker
dödsögonblicket. `LOCK_MS` 600 i `perk-ui.js` skyddar bara mot felklick, inte mot förlorad bekräftelse.

**Fiendetyper och telegrafer idag.**

| Typ | Hot i världen | Svag sida/fönster | Läsbarhet |
|---|---|---|---|
| Patrol | Golvkon 35° halvvinkel, 5,2 m, alert 1 s | Bakom/sidan, utanför konen | Bäst (Lords favorit) |
| Guard | Frontsköld 70° halvvinkel, ingen golvmarkering | Sida/rygg | Bara via blockgnista |
| Turret | Fan −15/0/+15°, varning 1,1 s, återhämtning 2,6 s | Recovery-fönster, EMP | Medel |
| Grenadier | Korallring r 2 m, varning 1,2 s, säkring 1 s | Gå ur ringen | Bra |
| Swarm | Spawnring, 1 s varning + 2 s emerge | Korridor, granat | Medel |
| Grunt/rusher/sentry (blandning) | **Inget** telegraferat hot | Inget | Dålig |

Slutsats: de vanligaste kropparna (grunts/rushers/sentries från `mix`) saknar läsbart hot och svag sida. De drar ned känslan till
"gå fram och skjut" även när ett möte med kon finns i rummet.

**Verb idag.** Gå, sikta/skjut, dash (4,8 m på 0,22 s, cooldown **4000 ms**, **inga i-frames**), verktyg (Grenade 2, EMP 1, Decoy 2,
via plats), medkit. Ingen flankbonus, ingen miljöinteraktion utöver dörr/nyckelkort och noder.

## 2. Prioriterade förslag

### 2.1 Stridskänsla och killbekräftelse (QUICK WIN, skeppa först)

1. **Fördröj perk-pickern.** Ny regel `RULES.perkPick.killDelayMs` **1000 ms** (spann 800-1200) räknad från senaste fiendedöd i
   rummet, plus kravet att `safePick()` varit sant oavbrutet i **600 ms** ("combat calm"). Under fördröjningen visas en liten
   "ROOM CLEAR"-notis (befintlig `.area-notice`-stil, kort, täcker inte HUD). Timern går som vanligt under fördröjningen; pausen
   börjar först när pickern öppnas (oförändrat beslut 5).
2. **Hitstop.** Träff: **40 ms** frys av spelsimulering (inte UI). Kill: **90 ms**. Sista kill i rummet: **140 ms** + kort
   slow-mo 0,3 s till 50 %. Implementeras via samma pausklocka som perkpausen (`gameTime()`), så inget dubbelt klocksystem.
3. **Kill-läsning.** Dödsanimation **350 ms** (fall/kollaps + skalning till 0), partikelskur i fiendens färg (återanvänd
   `world.burst`), vit flash på meshen **80 ms** vid varje träff (inte bara DOM-etiketten), kill-markör vid siktet (X-symbol
   i SVG-spriten, 300 ms). Kameraskak: träff 0,05 m / 80 ms, kill 0,12 m / 150 ms, spelarskada 0,15 m / 200 ms; av-knapp i inställningar.
4. **Ljud (beroende av PR #133).** Procedurella SFX: skott, träff, sköldblock (metall), kill (tydligt annorlunda, högre ton),
   rum rensat (kort stinger), omladdning klar. Om #133 inte är mergad: skeppa visuellt först, ljud i följd-PR.
5. **Vapenrespons.** Munflamma 50 ms, rekyl i modellen 60 ms, magasinsindikator vid siktet (3 prickar) så att omladdningsrytmen syns.

### 2.2 Sikte och rörelse (QUICK WIN, delvis)

- **Tap-to-fire på höger stick**: se §2.2a (Brawl Stars-modell). Behåller dra-släpp för precisionsskott. Mål: tid från input till
  skott på mål bakom spelaren under **0,25 s** (idag ~0,6-0,8 s uppskattat; mät i PR).
- **Snabbare vridning**: `maxTurnRadiansPerSecond` 6 → **12**, `responseSeconds` 0,12 → **0,06**. Kvar som tuningvärden.
- **Hold-to-fire**: håller man höger stick utanför dead zone > 250 ms skjuter vapnet automatiskt i sin `shotIntervalMs`.
  Detta tar bort "dra, släpp, dra igen" per skott.
- **Rörelseassist**: 4° / 0,4 m → **7° / 0,7 m** (stillastående oförändrat 12° / 1,1 m). Beslut 1 (rörelseberoende assist) står
  kvar; vi minskar bara straffet så att skjuta i rörelse är ett verkligt alternativ, inte en fälla.
- **Magasin**: överväg Basic 3 → **4** skott så att ett 3-HP-mål inte alltid kräver omladdning. Liten ändring, men separat
  tuningbeslut (se fråga 3).

### 2.2a Höger siktstick, Brawl Stars-stil (QUICK WIN, del av PR-A)

Robert: siktsticken är mycket känslig för var man håller och känns inte taktil som Brawl Stars (samma mekanik).

**Mätt nuvarande implementation** (`setupStick()` i `game.mjs`, `controls.js`, `style.css`):
- **Fast stick**: `#aim-stick` är en fast cirkel, **116 px** (112 / 98 px i mindre viewport-mediaqueries). Aktiveringsytan är
  exakt den cirkeln; touch utanför den gör ingenting.
- **Två olika origo**: siktriktningen räknas från **där tummen landade** (`beginAim()`), men tummen ritas relativt
  **stickens centrum**, klampad till radie **32 % av bredden ≈ 37 px**. Landar tummen 30 px från centrum syns den redan
  "utdragen" fast siktet är neutralt, och samma rörelse ger olika visuell utslag beroende på var man satte ned tummen. Det är
  den troliga orsaken till "känslig för var man håller".
- **Deadzone 12 px** (`aimControls.deadZonePx`), ca 10 % av sticken, mindre än tumjitter på telefon (typiskt 8-15 px).
  Riktningen låses vid första rörelse förbi 12 px och följer sedan med utjämning 0,12 s och max 6 rad/s, så siktet släpar efter tummen.
- **Släpp avfyrar**: skott sker på `pointerup` (`releaseAim()`); `pointercancel` avbryter.
- **Tap gör ingenting**: en tap under 12 px ger `direction=null` och inget skott. Det finns ingen tap-to-autofire (Tool-knappen har
  det, siktsticken inte).
- **Ingen haptik** (`navigator.vibrate` används inte), ingen siktlinje i världen från sticken utöver assist-konen, ingen ring-feedback på sticken.

**Förslag (Brawl Stars-modell):**
1. **Flytande stick i stor zon**: aktiveringszon = hela högra ~45 % av skärmen under HUD-raden (exklusive DASH/Tool/medkit-knappar).
   Stickens origo = där tummen landar; basring och tumme ritas där. Visuell radie **48 px**, full utslag vid 48 px.
2. **Generös deadzone**: **20 px** (≈ 40 % av radien). Inom deadzone vid släpp = tap.
3. **Tap = auto-aim-skott** mot närmaste synliga fiende inom vapnets räckvidd (befintlig `assistAim()` med 360° och räckvidd 7 m,
   ocklusion respekteras); ingen fiende = skott i facing-riktning. Tap = touch < **200 ms** och inom deadzone.
4. **Drag = manuellt sikte** med **siktlinje** på golvet (vapnets räckvidd, kortas av vägg), riktning direkt från tummens vinkel
   (ingen utjämning/vridningsgräns för siktlinjen; spelarmodellen får fortsatt vrida mjukt). Assist-konen visas bara i stillastående.
5. **Släpp avfyrar** (som idag). **Avbryt**: dra tillbaka in i deadzone och släpp = inget skott (Brawl Stars-beteende), plus pointercancel.
6. **Haptik**: `navigator.vibrate(12)` vid skott, `vibrate(25)` vid kill, `[0]` om användaren stängt av; feature-detektera (iOS Safari saknar
   API, ingen fallback krävs). Av-knapp tillsammans med kameraskak.
7. **Ringfeedback**: basringen lyser cyan när tummen passerar deadzone (manuellt läge), pulsar 120 ms vid skott, visar grått + omladdningsbåge
   när magasinet är tomt (släpp gör då ingenting, med tydlig visuell orsak).
8. Samma modell för vänster rörelsestick (flytande i vänster zon), så båda tummarna känns lika.

Acceptans (i PR-A): tap utan fiende/med fiende skjuter (test på gestlogiken i `controls.js`); samma drag från olika landningspunkter
ger identisk riktning och identisk visuell tumposition (test); deadzone 20 px; layout-check grön (zonen överlappar inga knappar).
Mått: andel tap-skott vs drag-skott, felavfyrningar (skott inom 300 ms efter tap utan avsikt, fråga Lord), Robert/Lord: "känns det som Brawl Stars?".

### 2.3 "Läsbar telegraf" som fiendespråk (KÄRNAN)

Regel: **varje fiende visar sitt hot i världen (på golvet) innan det skadar, och har en svag sida eller ett fönster.** Ingen fiende
får skada utan telegraf ≥ `encounters.telegraphMs`. Färg: korall = hot, svagt fält i samma form = bara "uppmärksam".

| Arketyp | Telegraf | Svag sida / fönster | Planfråga |
|---|---|---|---|
| **Väktare (patrol, finns)** | Golvkon 35°/5,2 m | Rygg/sida, ingen alert | Smyga runt eller locka |
| **Sköldbärare (guard, utökas)** | Ritad båge 140° framför (sköldens täckning) | Sida/rygg; ×2 skada i ryggen | Flanka eller vänta på vändning |
| **Laddare (rusher, ny beteende)** | Linje på golvet 6 m, 0,8 s, sen rak rusning | Sidosteg ur linjen; 1,2 s stun om den missar och träffar vägg | Tajma dodge, locka in i vägg |
| **Prickskytt (sentry, ny beteende)** | Laser mot spelaren, 1,2 s, låses 0,3 s före skott | Bryt siktlinjen bakom skydd; sårbar under omladdning 2 s | Skydd-till-skydd |
| **Granatkastare (grenadier, finns)** | Korallring r 2 m | Gå ur ringen; kastaren rör sig inte under 1,2 s | Döda först eller dodga |
| **Torn (turret, finns)** | Fan −15/0/+15° ritad på golvet | Recovery 2,6 s; EMP; mellanrummen i fanen | Vänta och rycka fram |

Grunts behålls som "fyllnad", men får också en kort rak siktlinje (0,6 s) innan skott så att även de går att undvika.

**Grupper som kräver ordning.** Mötespaket kombinerar 2-3 arketyper så att svaret på en krockar med den andra, t.ex.:
- *Sköld + prickskytt*: flanka skölden, men flankvägen är prickskyttens öppna linje. Ordning: skydd → döda prickskytten → sköld.
- *Laddare + granatkastare*: ringen tvingar rörelse, laddaren straffar förutsägbar rörelse.
- *Torn + väktare*: tornets recovery är fönstret, väktarens kon stänger den kortaste vägen.
L1 = en arketyp i taget (lär språket). L2 = par. L3 = trio + elit. Detta byggs på befintliga `RULES.encounters.plan` per område.

### 2.4 Spelarverb utöver skjuta

1. **Dodge med i-frames** (quick win, liten kodyta i `dash.js`): dashens första **0,15 s** av 0,22 s ger osårbarhet;
   cooldown 4000 → **2500 ms**. "Perfekt dodge" (i-frame-undvikt projektil/laddning) → nästa skott +50 % skada, kort cyan puls.
   Gör laddare/prickskytt till tajmingsproblem i stället för HP-skatt. Perk "Rullning" tunas om mot nya basvärden (golv 2000 → 1500 ms).
2. **Flank/backstab-multiplikator**: träff inom 60° från fiendens rygg = **×2 skada** (sköldbäraren: enda sättet att skada).
   Visa "FLANK"-markör 400 ms. Oaggade fiender (utanför sin kon) tar **×3** på första träffen (smygöppning). Detta generaliserar
   det Lord tyckte var kul till alla fiender.
3. **Skydd som regel**: låga barriärer (`cover_low_barrier_*`, finns som modeller) blockerar fiendeprojektiler men inte spelarens
   skott när spelaren står intill ("luta över"). Prickskytt/torn blir då skydd-till-skydd-problem.
4. **Miljö**: explosiva tunnor (`barrel_steel_*` finns), r 2,2 m, 3 skada, egen korallring 0,6 s när de träffas; skadar fiender
   och spelaren. Dörrar som kan stängas för att bryta siktlinje (befintliga `blast_door_*`). Max 1-2 per rum, placerade nära
   gruppstarter så att "lura in gruppen" är en plan.
5. **Förmågeslot (EMP/granat)**: befintliga verktyg kopplas till telegrafspråket: EMP avbryter alla pågående telegrafer i radie
   (inte bara sentry/turret), granat avbryter laddarens rusning och kastarens kast. Då blir verktyget ett svar på ett läsbart hot,
   inte bara en panikknapp. Inga nya verktyg, ingen ny valuta.

## 3. PR-uppdelning, acceptanskriterier och mått

### PR-A: Feel + perk-timing (QUICK WIN, först, ~1 dag)
Omfång: §2.1 punkt 1-3 och 5, §2.2a flytande siktstick (tap/drag/släpp, haptik, ring), §2.2 vridning/tap-to-fire/hold-to-fire/rörelseassist, §2.4.1 dodge-i-frames. Ljud bara om #133 är mergad.
Acceptans:
- Perkpickern öppnas aldrig tidigare än `killDelayMs` efter sista kill och aldrig innan 600 ms combat calm (node-test i `nodspel/tests`).
- Hitstop påverkar spelklockan men inte UI/input; ingen drift i raidtimern (test: summan av pauser = loggad paustid).
- Dödsanimation + partiklar + meshflash synliga i headless-screenshot; layout-check grön på 844x390/932x430/667x375.
- Dash: projektil som träffar under i-frame-fönstret ger 0 skada (test).
- Alla nya värden i `RULES`/`data/*.js`; version bumpad överallt.
Mått (Lord, ~5 raider): "fick du bekräftelse på killen?" ja; input→skott bakåt < 0,25 s (mät med loggad tid); andel skott i
rörelse upp från baslinje; träffprocent i rörelse ≥ 50 %.

### PR-B: Telegrafspråk + flank (kärnan, ~2-3 dagar)
Omfång: §2.3 (sköldbåge, laddare, prickskytt, grunt-linje, golvtelegraf för alla), §2.4.2 flank/backstab, §2.4.3 skydd.
Acceptans:
- Varje fiendetyp har en ritad telegraf ≥ `telegraphMs` innan skada (test itererar alla typer).
- Flank ×2 / smygöppning ×3 räknas i `hitEnemy()` och loggas i stridsloggen; recap visar "Flank" när det hände.
- `deathTip()` ger tips för varje arketyp (inte bara mötestyper).
- Nåbarhetstest: varje mötespaket har en flankväg utanför telegrafen.
Mått: andel kills från sidan/ryggen ≥ 30 %; Lord kan beskriva minst 2 olika planer för samma rum; "tråkigt efter 3-4 raids" → spelar ≥ 5 frivilligt.

### PR-C: Miljö + förmågeslot + gruppaket (~2 dagar)
Omfång: §2.4.4 tunnor/dörrar, §2.4.5 EMP/granat avbryter telegrafer, §2.3 gruppaket per nivå.
Acceptans: tunna detonerar med telegraf, skadar fiender och spelare (test); EMP avbryter alla telegrafer i radie (test);
L2/L3-planerna innehåller blandade arketyper per område; layout-check grön.
Mått: ≥ 1 miljökill per raid i snitt; verktygsanvändning före skada (inte efter) ökar; olika dödsorsaker mellan raid 1 och raid 3.

## 4. Öppna frågor till Robert

1. OK att perkpickern väntar ~1 s + 0,6 s lugn efter sista kill (timern går under väntan)?
2. Flytande Brawl Stars-stick (§2.2a) med tap = auto-aim; ska hold-to-fire också med, eller bara tap/drag/släpp? på höger stick, och snabbare vridning (12 rad/s)? Påverkar L1 också.
3. Basic-magasin 3 → 4 och rörelseassist 4° → 7°: tuning OK eller vill du hålla PR-A rent "feel"?
4. Dodge med i-frames + dash-cooldown 2500 ms (ändrar playerStats-basen och Rullning-perken)?
5. Flank ×2 / smygöppning ×3 som global regel?
6. Ska laddare och prickskytt ersätta dagens rusher/sentry-beteende (samma typnamn, ny AI) i stället för nya typer?
