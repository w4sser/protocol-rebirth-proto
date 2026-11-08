# Speltestfeedback 2026-11-08 (Johannes, Carlos)

*Status: sammanställning av muntlig/skriven feedback från ett speltest. Inget ekonomi- eller
balansbeslut är taget av detta dokument. Låst riktning gäller rakt av (`AGENTS.md`): PvE only,
död förlorar allt man bär, ingen ny valuta, BIT kör en uppgift i taget. Underlag: kod på `main`
(v2.28.0), `docs/ftue-design.md`, `docs/design-encounters-toolkit.md`, `docs/difficulty-bots.md`,
`docs/design-stakes-perks-oct27.md`, samt design-konsolideringen i PR #201 (§3).*

## 1. Sammanfattning

Två spelare (Johannes, Carlos) körde ett pass. Positivt: fiendevariation, BIT-uppgifter, och
Carlos tyckte basens UI var mycket renare med trevlig karaktär. Problemen föll i tre kluster:
(1) fiende-läsbarhet — sköldade vakter fastnar, inget tydligt "upptäckt → jakt"-skede, inte varje
fiende telegraferar sitt skott; (2) UI-friktion — detaljskärmar inte fullskärm, stängknapp inte
konsekvent, HUD visar valuta där den inte behövs, inget nivåtitelkort, Continue-knappen sticker
inte ut; (3) systemfriktion — perk-valet mitt i en raid kommer för tidigt och stressar med en
timer utan att kännas meningsfullt, och "Lämna in" är otydligt för en spelare som redan är
överväldigad av skärmar och text.

Status 2026-11-08 kväll: #219 (v2.28.1), #220 (v2.28.2) och #221 (v2.28.3) är mergade och live. Kartmarkeringen och förslagen A–F är inte byggda.
mot `main` och räknas som levererade först när de är mergade och live; övriga punkter (A–F) är förslag.

| Småfix (egen PR, status uppdateras vid merge) | Förslag – kräver Roberts beslut |
|---|---|
| Sköldad vakt fastnar: placeringen kräver en gångbar flank med fri sikt från start, annars flyttas vakten (omöjligt möte utelämnas, skölden tas aldrig bort) – [PR #219](https://github.com/w4sser/protocol-rebirth-proto/pull/219), **mergad, live i v2.28.1**. "Förutsägbar rörelse" för sköldade fiender är kvar som förslag (A/D) | A. Upptäckt + jakt: synligt alert-läge, jaktläge, läsbar leash/give-up |
| Kompakt raid-HUD uppe till vänster – [PR #220](https://github.com/w4sser/protocol-rebirth-proto/pull/220), **mergad, live i v2.28.2** | B. Pre-shot-telegraf på alla fiendetyper, behåll de röda lasrarna |
| Detaljskärmar (rum, uppdrag, vapen; Fabricator var redan fullskärm) fyller appens vy, stängknapp uppe till vänster, valutarad dold – [PR #221](https://github.com/w4sser/protocol-rebirth-proto/pull/221), **mergad, live i v2.28.3** | C. Ersätt timad perk-väljare mitt i raiden med en fysisk terminal i ett rum, ingen nedräkning |
| "Bunker Level 1/2…"-titelkort, raidtimern pausad under kortet – [PR #220](https://github.com/w4sser/protocol-rebirth-proto/pull/220), **mergad, live i v2.28.2** | D. Fler fiendemönster – i första hand varianter av befintliga arketyper, max 1–2 nya |
| Grön "Continue Raid"-knapp på resultatskärmen – [PR #220](https://github.com/w4sser/protocol-rebirth-proto/pull/220), **mergad, live i v2.28.2** | E. Rum som taktiska pussel: grindordning, riskrum, fjärrbrytare – spelarval, inte tvång |
| Markering av vald/ej vald karta/område – **under utredning**, se §1.1 | F. FTUE-fördjupning: progressiv disclosure, tydligare "Lämna in", bevarat det som gillades |

### 1.1 Om "under utredning"-raden

Kommentaren "unselected map parts visually distinct (selected coloured, unselected blue)" matchar
sannolikt världskartan (`app.js` `SCREENS.worldmap`, `.wm-region`/`.wm-label` i `index.html`):
vald area får idag en guldfärgad ring (`.wm-region.on`, `#e8c547`), olåsta-men-ej-valda areor en
genomskinlig kant på ytan men en cyan/turkos kant på etikettboxen (`#75CFCCaa` — nära "blå"), och
låsta areor en streckad turkos kant. Det *kan* vara det Johannes/Carlos menade, men ingen av oss
såg speltestet live, så fixPR:en bör bekräfta målskärmen med Robert innan den stämplas klar. Om
det i stället gäller BIG MAP-läget (bara en växel, ingen egen kartvy) hör biten till förslag E
eller en egen liten uppgift i stället.

## 2. Förslag A–F

### A. Upptäckt + jakt

**Nuläge.** `aggro` är en enda boolean (`nodspel/combat.js`): sätts till `true` inom `detectRange`
(10 m, skalad av stealth/bagvikt/`aggroMul`), vid en nästan-miss, eller vid ett träffat skott
(`round.js:283`) — och **nollställs aldrig** (ingen kod sätter `aggro=false`). Patrullen
(`RULES.encounters.patrol`) har en egen mellanstation: synkon + 1 s `alertMs` ("!") innan aggro,
men beter sig som alla andra därefter. En aggro fiende rör sig mot spelaren så länge avståndet är
under 14 m (obegränsat för svärm) — ett rörelsevillkor, inte ett synligt jaktläge, och det finns
ingen "ge upp"-logik eller återgång till patrull/vila.

**Förslag.** Tre synliga tillstånd: *ovetande* (dagens tysta default), *upptäckt* (patrullens "!"
återanvänt för alla typer — kort varningssignal när `aggro` precis blivit sant), *jagar* (dagens
förflyttning, men med ett rörelsemönster/ljud som skiljer sig från ovetande patrullering). Lägg
till en leash: utom räckvidd/synlinje i N sekunder → tillbaka till *ovetande* med en lika tydlig
nedtrappningssignal. Exakt ikon/ljud är en UI/audio-uppgift, inte ett speldesignval här.

**Varför.** "Reagerar men hittar aldrig tillbaka till ro" känns billigt; permanent aggro gör även
DDA-justeringar (`docs/difficulty-bots.md` §3, `aggro`-ratten) svårare att läsa, eftersom samma
boolean aldrig syns förrän ett skott kommer.

**Risker.** För snäll leash → lätt att "resetta" ett svårt rum genom att gå ut och in; för snål
→ känns som fusk. Patrullens `alertMs=1000ms` (combat.js:282) får inte krocka med den nya
generiska upptäckt-signalen.

**Prioritet.** P1 (förutsättning för "shielded enemies ska röra sig förutsägbart" och för att
B:s telegrafer ska kännas som ett system, inte isolerade skott).

**Acceptanskriterier.** (1) Varje fiende som går från ovetande till aggro visar en distinkt,
kort signal innan den agerar. (2) En aggro fiende som tappar spelaren ur sikte/räckvidd i >X s
visar en lika tydlig nedtrappning och återgår till sitt ursprungsbeteende (patrull/stillastående).
(3) Test: ingen fiende kan vara permanent aggro med spelaren utom synhåll längre än leash-tiden.

**Öppna beslut för Robert.** Leash-radie/tid (förslag: återanvänd `detectRange`-skalan i stort,
men dubbla den för "tappa" jämfört med "upptäck", så att det inte flimrar fram och tillbaka).
Ska svärm-fiender (som redan ignorerar 14 m-gränsen) undantas från leash helt?

### B. Pre-shot-telegraf för alla fiendetyper

**Nuläge, uppmätt i kod** (`nodspel/combat.js`, `data/raid-combat.js`, `data/raid-enemies.js`,
`nodspel/levels.js`). Alla telegrafer visas i korall/rött (`ENEMY_COLORS.damage:'#E4705F'`,
`telegraphColors` i `nodspel/enemies.js`) — det är redan "de röda lasrarna" spelarna gillar, och
ska bevaras rakt av.

| Arketyp | Telegraf idag | Windup idag |
|---|---|---|
| grunt (vanligt skott) | riktad linje mot last-known aim | `max(encounters.telegraphMs=1000, gruntMs=600, enemyWindupMs)` → **1000 ms** i praktiken |
| sentry | linje + sikte "låser" sista biten | `max(1000, sentryMs=1200)` = **1200 ms**, varav sista `sentryLockMs=300 ms` är ett låst sikte |
| guard (kärnvakt, frontsköld) | riktad linje, vänder långsamt | `warningMs=1000 ms`, sedan salva 3 skott × 180 ms, sedan 1600 ms återhämtning |
| turret / shield_turret | samma som guard, fläktmönster 3 riktningar | `warningMs=1100 ms`, salva 3×200 ms, 2600 ms återhämtning |
| thrower/grenadier | korallring på golvet där granaten landar | `warningMs=1200 ms` + `fuseMs=1000 ms` till smällen = **2200 ms** total från första tecken |
| patrol (synkon) | kort "!" när spelaren syns i konen | `alertMs=1000 ms`, **sedan** ett nytt grunt-windup (1000 ms) innan första skottet |
| swarm (rusher, encounter) | spawn-ring + "armerad→varning" | `warnMs=1000 ms` + `emergeMs=2000 ms` = 3000 ms innan den är aktiv, därefter grunt-telegraf (1000 ms) per skott |
| rusher/charger (bare, `isCharger`) | riktad linje, räckvidd 6 m | **`ENEMY_TUNING.rusher.windupMs=600 ms`, ej påverkad av 1000 ms-golvet** |

**Det är alltså redan sant att nästan alla arketyper har ≥1000 ms telegraf.** Det verkliga
undantaget är **chargern** (`stepCharger` i `combat.js:121`): dess egen `telegraphDuration()`
returnerar `ENEMY_TUNING.rusher.windupMs` (600 ms) direkt, utan det generella
`RULES.encounters.telegraphMs`-golvet alla andra typer går igenom — kortare än varje annan
arketyp och den enda platsen som bryter mot den egna regeln "varning ≥ 1 s"
(`docs/design-encounters-toolkit.md` §1). Det är troligen chargern som gav upphov till "jag hann
inte reagera" bakom denna feedbackpunkt, snarare än att telegrafer helt saknas.

**Förslag.** (1) Höj charger-windup till samma golv, **≥1000 ms** — en datavärdesändring i
`data/raid-enemies.js` (`rusher.windupMs`), inget nytt system. (2) Dokumentera telegraf-längden
konsekvent *per händelsetyp* (varning → commit → recovery) så framtida arketyper (förslag D)
automatiskt ärver golvet via `telegraphDuration()` i stället för att varje ny typ måste komma
ihåg att klämma sitt eget värde. (3) Inga nya färger eller ljud — bara att stänga 600 ms-luckan.

**Varför.** "Every enemy should have a visual pre-shot charge" är redan uppfyllt för 7 av 8
arketyper; den åttonde (chargern) känns farligast eftersom den är snabb och närstrids-orienterad
— troligen källan till intrycket att telegrafer saknas helt.

**Risker.** Höjd charger-windup gör den lättare att undvika och kan göra den mindre hotfull i
små rum. Bör mätas mot `docs/difficulty-bots.md`s sim (chargern ingår inte i dagens
bot-mätning — ny mätning krävs innan värdet låses).

**Prioritet.** P1 (litet, isolerat datavärde; löser en konkret, namngiven klagopunkt).

**Acceptanskriterier.** Alla åtta arketyper i tabellen ovan har mätbar windup ≥1000 ms i ett
test (`nodspel/tests/combat.test.mjs` har redan liknande assertions för guard/turret/patrol —
lägg till en för chargern). Inget färg- eller ljudbyte för de telegrafer som redan finns.

**Öppna beslut för Robert.** Godkänn 1000 ms (samma golv som allt annat) som nytt
`rusher.windupMs`, eller ett annat specifikt tal för just chargern om den ska kännas snabbare än
grunt/sentry av avsiktliga designskäl?

### C. Terminal i stället för timad perk-väljare

**Nuläge.** Perk-väljaren (`nodspel/perk-ui.js`, `nodspel/perks.js`) öppnas automatiskt när ett
rum är klarat: `updateClears()` köar rummet, `pickReady()` väntar tills spelaren stått stilla och
säkert (`calmMs=600 ms` efter `safePick()`, minst `killDelayMs=1000 ms` efter sista dödandet) och
öppnar sedan automatiskt. Panelen har en synlig nedräkningsstapel och **`PERKS.pickTimeoutMs=
4000 ms`** (`data/raid-perks.js`): väljer spelaren inte inom 4 s auto-väljs första alternativet
(`action('timeout')` → `autoPickPerks`). Raidklockan fortsätter under calm-väntan — bara det
korta valfönstret pausar spelklockan (`pausePick`/`resumePick`). Detta är live som default
(`debugRoomClearsEnabled=true` i `game.mjs`), inte en debug-only-funktion.

**Förslag.** Ta bort den automatiska öppningen helt. Lägg en fysisk, synlig terminal/dator-prop
i ett rum per nivå (återanvänder `.pop-card`-mönstret, samma knapp-interaktion som en nod).
Spelaren går fram och trycker aktivt för att öppna kortvalet. Ingen nedräkningsstapel, ingen
auto-pick — `timeoutMs:0`-läget finns redan i `perk-ui.js` (idag bara använt för
layout/debug-mätning) och kan bli produktionsläget rakt av.

**Varför.** Valet triggas av rum-clear, inte spelarens eget initiativ, och 4 s räcker inte för
att läsa tre korts text + siffror första gången, särskilt med adrenalin kvar. "No felt impact"
pekar på att ett val som dyker upp passivt känns mindre som ett eget beslut än ett man sökt upp.

**Paus av raidklockan under terminalen — två alternativ.** **Alt 1 (rekommenderas): paus**,
samma mekanism som redan finns men utan 4-sekundersgränsen — matchar "no timer, intended choice"
ordagrant, men gör ett sent perkval till en gratis paus mitt i en jaktvåg om larm/jaktvågsförslaget
i `docs/design-stakes-perks-oct27.md` §4 byggs; stäm av de två förslagen mot varandra då. **Alt 2:
ingen paus** — tryggare mot framtida eskalering, men motsäger delvis "no timer, no stress" om en
jaktvåg hinner komma ikapp under läsningen.

**Risker.** En terminal man måste gå till kan missas helt om spelaren rusar mot nästa rum — i
värsta fall tas inget perkval under hela raiden. Mildrat genom att placera terminalen på vägen
mellan nod och utgång, inte i en valfri sidogren. Ingen ekonomi-/balansändring föreslås (perk-
poolen m.m. är `docs/design-stakes-perks-oct27.md` §1–3 och kräver eget beslut).

**Prioritet.** P1 (adresserar en namngiven, specifik klagopunkt med en avgränsad UI-ändring —
ingen ändring av perk-korten själva).

**Acceptanskriterier.** (1) Inget perkval öppnas automatiskt vid rum-clear. (2) En synlig,
interagerbar terminal-prop finns i varje nivå som idag ger minst ett perkval. (3) Panelen öppnas
utan nedräkningsstapel och utan auto-pick-timeout. (4) Om spelaren extraherar/dör utan besök:
samma `autoPickPerks(..., {all:true})`-väg som redan finns för FTUE/extraktion säkerställer att
inget kort går förlorat.

**Öppna beslut för Robert.** (1) Paus eller ingen paus av raidklockan — rekommendation: paus.
(2) En terminal per rum som ger ett kort, eller en central terminal per nivå med kö? (3) Egen
visuell/ljudsignal när ett nytt kort väntar, eller ska spelaren komma ihåg att kolla själv?

### D. Fler fiendemönster

**Nuläge — fullständig arketyplista** (`nodspel/levels.js` `RULES.enemyTypes`/`RULES.encounters`,
`nodspel/encounters.js`, `nodspel/enemies.js`): spelmekaniskt finns idag **grunt** (baseline),
**rusher** (två varianter: fri `charger` med stalk→charge→stun/recovery, och `swarm`-flaggad
variant som skjuter som grunt men rör sig snabbare och spawnar i grupp), **sentry** (stillastående,
lång räckvidd, siktlås sista 300 ms), **thrower/grenadier** (kastar en lobbad granat med
korallring), **guard** (kärnvakt med frontsköld, `frontHalfAngleDeg`, vänder sig mot spelaren men
**förflyttar sig aldrig** — se småfix-tabellen i §1), **turret/shield_turret** (stillastående, fläktar
3 skottriktningar, `shield_turret` dessutom EMP-bar sköld), **patrol** (grunt med fast slinga +
synkon), och **generator** (ingen vapenlogik, bara en hitpoint-objekt som styr `shield`-encountern).
Utöver detta finns redan modellerade men oanvända "Phase 2/3"-arketyper i `nodspel/enemies.js`
(`tank`, `swarm_bot`, `scout`, `artillery`, `repair`, `sniper`, `patrol_grunt`) — dessa är idag
bara återanvända som *visuella* stand-ins för befintliga typer (t.ex. `artillery.glb` visar både
grenadier och thrower, `sniper.glb` visar sentry, `scout.glb` är helt oanvänd i spel-logik men
redan modellerad med rotor-delar, vilket råkar matcha en flygande fiende visuellt).

**Mappning av önskemålen (i första hand varianter, inte nya arketyper):**

| Önskemål | Bedömning | Hur |
|---|---|---|
| Fast fragile vs. slow strong | **Ingen ny arketyp.** `RULES.enemyTypes` är redan en tabell med `speedMul`/`rangeMul`/`cooldownMul`/`standoff` per typ (rusher är redan "fast"). Lägg till en `heavy`-variant (lägre `speedMul`, högre HP-multiplikator, kortare `standoff`) i samma tabell. | Datavärden i `levels.js`/`data/raid-enemies.js`, ingen ny kod i `combat.js`. |
| Dash+charge "sågklinga" som skadar på dashen | **Ingen ny arketyp — redan chargern.** `stepCharger` gör exakt detta: stalk, riktad warning-linje, lunge, skada vid träff (`e.chargeHit`), stun om den kraschar i en vägg. "Sågklinga" är en ny visuell skin på samma mekanik, plus B:s windup-fix. | Ny `.glb`/variant-färg, ingen ny speldesignlogik. |
| Granater som studsar, med plats- + stubin-indikator | **Delvis nytt — liten mekanisk tillägg till thrower, inte ny arketyp.** Plats- och stubinindikatorn finns redan (korallring + `warningMs`/`fuseMs`). "Studsar" är en ny kort hopp-fas innan ringen låses fast, inte en ny fiendetyp. | Liten tillägg i `lobGrenade()`/`stepBlasts()` i `combat.js`. |
| Flygare som går över hinder/skydd | **Det enda genuina kandidaten för en ny arketyp.** Inget idag ignorerar väggar/lådor i rörelse (`stepEnemy` väjer alltid för `obstacles`). En flygande typ som bara väjer för andra fiender/spelaren (inte terräng) är en ny rörelseregel. Återanvänd redan modellerade `scout.glb` (rotor-delar, `ENEMY_VISUALS` har redan en oanvänd `scout`-arketyp) i stället för att beställa ny konst. | Ny men liten: ett alternativt `stepEnemy`-spår utan `obstacles` i kollisionslistan. |

Nettoresultat: **noll till en ny arketyp** (flygaren), resten är datavarianter eller små tillägg
på befintlig logik — i linje med att undvika "arketyp-explosion".

**Varför.** Fler mönster ger spelarna fler lösningar att lära sig (matchar
`design-encounters-toolkit.md`s princip "alltid två lösningar"), men varje helt ny arketyp kostar
konst, animation, tester och balansarbete. Att återanvända `RULES.enemyTypes`-tabellen och
`stepCharger` håller kostnaden nära noll för tre av fyra önskemål.

**Risker.** En flygande fiende som ignorerar täckning kan kännas orättvis om den samtidigt har
lång räckvidd — bör ha kort räckvidd/låg skada i utbyte mot att vara svår att blockera med skydd,
annars bryter den `design-encounters-toolkit.md`s "alltid en skydd-lösning"-regel. Den
studsande granaten riskerar att göra varningen svårare att läsa om studsen själv ser ut som en
explosion.

**Prioritet.** P2 (fast-fragile/slow-strong och den studsande granaten: billiga, kan göras
snabbt). Flygaren: P2–P3 beroende på hur mycket ny rörelselogik/tester den kräver.

**Acceptanskriterier.** Varje nytt mönster har minst ett test som visar både en verktygslösning
och en rörelse-/timinglösning (samma krav som redan gäller enligt
`design-encounters-toolkit.md` §1). Ingen ny typ bryter `encounters.maxHitFraction` (.3) eller
`encounters.telegraphMs` (1000 ms)-golvet.

**Öppna beslut för Robert.** (1) Godkänn att flygaren är den enda nya arketypen i denna omgång.
(2) Vilket område/nivå introducerar flygaren (samma "lär ut en gång, aldrig på L1"-princip som
guard-mötet)? (3) Ska den studsande granaten vara en ny `thrower`-variant eller ersätta dagens
granatkastare helt?

### E. Rum som taktiska pussel

**Nuläge.** Mycket av detta är redan byggt enligt `docs/design-encounters-toolkit.md`: varje
möte telegraferar ≥1 s, tar aldrig >30 % max HP per träff, och har alltid en verktygslösning och
en rörelse-/timinglösning (tabellen i §1 i det dokumentet). Låst dörr + nyckelkort i en låda
finns redan som en av de sju mötena (`RULES.encounters.door`, `placeDoor` i `encounters.js`) —
den längre sidovägen är alltid öppen, så en låst dörr är redan frivillig, inte ett tvång. Den
skyddade noden (`shield`-mötet, en generator som måste skjutas/EMP:as) är också redan live på
alla områden nivå 3.

**Förslag.** Bygg vidare på den låsta dörren med: (1) **Skjutdörrar med riskrum**: ett extra, helt
frivilligt sidorum bakom en skjutdörr, med tydligt tyngre motstånd men också tydligt bättre loot
(tiered crates — högre tier ju djupare in i riskrummet), samma "varning + två lösningar"-princip
som allt annat. (2) **Fjärrbrytare**: en brytare i rum A öppnar en dörr i rum B — en ny, synlig
kopplings-linje (t.ex. en ledningsfärg eller en etikett "DÖRR 2 · BRYTARE I VERKSTADEN") så att
spelaren alltid vet *att* något är kopplat, även innan de hittat brytaren (matchar den redan
låsta regeln "Locks explain themselves" i `AGENTS.md`).

**Varför, och varför vi avråder från "hela bunkern måste utforskas".** Att ge varje rum ett eget
litet beslut matchar redan produktens princip (encounters-toolkit §1). Men att göra *all*
utforskning obligatorisk motsäger `docs/ftue-design.md`s mål om snabba, lättlästa raider och
`AGENTS.md`s "Clarity over cleverness" — ett tvingat fullständigt genomsökt bunker-lager per raid
riskerar att förlänga varje raid utan att spelaren bett om det, och straffar den som vill gå
direkt mot extraktionen. **Rekommendation: gör riskrum och brytar-dörrar valfria med en synlig,
värd belöning (bättre loot, snabbare nod) snarare än en spärr som blockerar nod/exit-vägen** — i
linje med hur den låsta dörren redan fungerar idag (frivillig, sidoväg alltid öppen).

**Risker.** Om belöningen i riskrummet inte känns värd risken slutar spelare besöka dem helt
(bortkastat innehåll); om den är för bra blir den obligatorisk i praktiken ändå. Fjärrbrytare kan
kännas förvirrande utan en mycket tydlig visuell koppling — detta är ett UI-jobb lika mycket som
ett layout-jobb.

**Prioritet.** P2 (bygger på befintlig toolkit, men kräver ny layoutlogik i `encounters.js` och
`levels.js` för flerrumsberoenden, så inte en liten ändring).

**Acceptanskriterier.** (1) Varje ny riskrums-/brytarkonstruktion är valfri: nod, loot-väg och
exit går alltid att nå utan att besöka dem (samma test-princip som redan finns för den låsta
dörren). (2) En brytare-dörr-koppling är alltid visuellt/textuellt markerad innan och efter att
brytaren slagits om. (3) Tiered crates i riskrum följer samma telegraf-/skaderegler som allt
annat (§B, `maxHitFraction`).

**Öppna beslut för Robert.** (1) Godkänn principen "valfritt + belönat" i stället för
"obligatoriskt fullständigt utforskat" innan något byggs. (2) Hur många brytare-dörr-par per
nivå (ett är en bra start för speltest). (3) Är tiered crates en lootbordsändring (kräver
ekonomibeslut per `AGENTS.md`) eller bara en placeringsändring av befintliga bord?

### F. FTUE och informationsöverflöd

**Nuläge, bekräftat i kod** (inte bara i det något äldre `docs/ftue-design.md`, vars sista
statusrad är från v2.22.0 — koden på `main` ligger längre fram): `nodspel/ftue.js` och
`data/raid-ftue.js` har redan **försöks-rampen** (`FTUE.attempts`): försök 1 normal risk, försök
2 halv skada/75 % fiende-HP/80 % fart med repliken "BIT: rerouted power to your shields. Try
again.", försök 3 kvart skada/halv HP/60 % fart och **kan inte förloras i praktiken**
(`minHealth:1`) med repliken "BIT: I've got you this time." — detta *är* den
"tredje-försöket-garanterat"-regel som nämns i uppgiften, redan byggd. **Clutch-extraktionen**
(`startFtueClutch`) finns också: när alla noder i nivå 1 är aktiva spawnas en liten jaktvåg
(`FTUE.clutch.hunters=2`) med en nedräkning (`countdownMs=10000`) som enligt kommentaren i koden
"never closes the beam or ends a raid" — rent pressmedel, inte en faktisk spärr. **BIT:s
cold open** ligger enligt `ftue-design.md` §6 efter första extraktionen (flyttad dit på Roberts
beslut 2026-11-01), och **ljudregisterets röstrader är redan återanvändningsbara** och triggas av
spelhändelser snarare än hårdkodade platser: `hunters-inbound` (jaktvåg), `nice-shot`
(dödsstreak), `scrap-detected` (sällsynt plock), `extraction-marked` (exit avslöjad) — alla i
`nodspel/audio.js`, kopplade via `audioEvent()`-anrop som redan finns i `combat.js`/`round.js`.

Samtidigt är hand-in-knappen i basen fortfarande rakt av **"HAND IN"** (`app.js` rad ~1365,
`handInHtml()`), vilket matchar Carlos' konkreta klagomål. Basens skärmar (quest log, BIT-hub,
fabricator, vapenbänk) är alla fullskärmsöverlägg (`overlay()`-mönstret) som redan existerar
sida vid sida utan inbördes stegvis gömning — allt är synligt och tillgängligt från start för en
ny spelare, vilket är precis Johannes' "spelet kastar mycket utan introduktion".

**Förslag, i steg (bygger vidare, kastar inte bort det som redan fungerar):**
1. **Bevara uttryckligen:** försöks-rampen, clutch-extraktionen, cold-open-placeringen och de
   befintliga röstraderna. Inget av detta ska byggas om.
2. **Första meningsfulla mål:** en enda, namngiven handling per skärm (samma princip som redan
   finns i `ftue-design.md` §2 — "ett mål på skärmen åt gången") utökas till basen efter första
   extraktionen: bara Core-kortet är synligt, resten av byggnaderna/flikarna gömda tills de blir
   relevanta (`ftue-design.md` §2 nämner redan detta som nästa steg, "Kvar" i statusraden).
3. **Kontextuella introduktioner** i stället för text att läsa: när en ny skärmtyp (t.ex.
   BIT-hubben, quest log) blir tillgänglig för första gången, visa en kort, en-gångs pekpunkt på
   just den nya knappen — inte en separat förklaringsskärm.
4. **Progressiv disclosure, konkret ordning:** Core → Fabricator → Loadout → BIG MAP → Quest Log
   → BIT-hub, en i taget, matchar redan `ftue-design.md` §2.4's uppläggning men utökad till fler
   skärmar än bara de fyra som listas där idag.
5. **"Lämna in" → tydligare verb + förhandsvisning.** Byt etiketten "HAND IN" till något som
   beskriver resultatet, t.ex. "SLUTFÖR UPPDRAG", och visa en kort förhandsgranskning direkt på
   knappen eller precis ovanför den: vad som förbrukas (item-ikoner + antal) och vad som fås
   (belöningsikoner) — innan tryck, inte efter. Ingen ändring av vad hand-in-flödet faktiskt gör,
   bara namn + förhandsvisning.
6. **Ingen tvingad uppslagsbok.** Ingen ny "läs allt om spelet"-skärm. All ny information
   introduceras genom spel, inte genom text att bläddra igenom (matchar `AGENTS.md`s "Clarity
   over cleverness").

**Varför.** Carlos' "överväldigad, undviker skärmar" och Johannes' "kastar mycket utan
introduktion" är samma grundproblem från två håll: allt är synligt samtidigt och förklarat med
text i stället för kontext. Lösningen som redan påbörjats i FTUE (ett mål i taget, stegvis
upplåsning) är rätt riktning — den är bara inte klar än för hela basen, bara för själva den
första raiden.

**Risker.** Progressiv disclosure kan kännas som att spelet "gömmer" funktioner för en van
spelare som vill ha allt direkt — bör bara gälla nya profiler, inte återvändande spelare (samma
princip som redan gäller: "Returspelare oförändrat", `ftue-design.md` §3.2). Ett nytt
hand-in-namn kan kräva att leta igenom flera andra strängar (quest log, tooltips) som också
säger "hand in" på andra ställen i `app.js` — en sökning innan namnbyte behövs.

**Prioritet.** P1 för "Lämna in"-ordet + förhandsvisning (litet, text/UI, löser ett namngivet och
konkret klagomål direkt). P2 för stegvis bas-disclosure (större, rör flera skärmar).

**Acceptanskriterier.** (1) En ny profil ser aldrig mer än en olåst byggnad/flik i basen tills
den blivit relevant, enligt en fast, testbar ordning. (2) Hand-in-knappen visar en
förhandsgranskning av kostnad/belöning innan tryck. (3) Ingen av FTUE:s redan byggda delar
(försöksramp, clutch, cold-open-placering, röstrader) ändras av detta arbete — ett regressionstest
säkrar det (liknande testet som redan nämns i `ftue-design.md` §3.7, "test för att returspelare
inte påverkas").

**Öppna beslut för Robert.** (1) Godkänn "SLUTFÖR UPPDRAG" eller annat förslag till ny
hand-in-etikett. (2) Exakt ordning för stegvis bas-disclosure utöver de fyra som redan nämns i
`ftue-design.md` (quest log, BIT-hub var i ordningen?). (3) Ska kontextuella pekpunkter vara en
engångsföreteelse per skärmtyp (sparas i samma `localStorage`-mönster som FTUE-flaggan) eller
visas varje gång tills man interagerat?

## 3. Dokumentationsindex för Johannes

*Robert delar detta separat — ingen fil skickas automatiskt till Johannes av detta dokument.*
LLM-läsbar lista: sökväg, en rad om innehåll. PR #201-dokumenten (ej mergade i skrivande stund,
hämtade från `origin/docs/game-design-reference-2026-11-06`) är markerade **[PR #201]** och ska
läsas som föreslagen riktning, inte skeppad status — flera av dem är redan explicit
"superseded" av `core-meta-commerce.md` inbördes (se dess överskriftsnot i varje fil).

**Läsordning, rekommenderad:**
1. `AGENTS.md` — produktriktning, hårda regler, låsta beslut. Läs först, alltid.
2. `README.md` — vad prototypen faktiskt är och hur man startar den.
3. `docs/ftue-design.md` — de första två minuterna: nuläge, 4-stegsförslag, Roberts beslut.
4. `docs/design-encounters-toolkit.md` — "ett problem per nivå"-systemet: möten, verktyg,
   materialkurva. Grunden för förslag B/D/E i detta dokument.
5. `docs/design-combat-feel-oct28.md` — träffkänsla, hitstop, dash-iframes (refereras av
   perk-timing-logiken i förslag C).
6. `docs/design-stakes-perks-oct27.md` — perk-stapling, protokollfack, stakes/larm-förslag.
   Direkt relevant för förslag C, inte byggt än.
7. `docs/difficulty-bots.md` — headless bots, adaptiv svårighet (DDA), uppmätta baslinjer.
8. `docs/design-retention-quests.md` — Hard-läge, retention-questkedjor.
9. `docs/design-playtest-oct25.md`, `docs/design-t1-clear-loop.md` — tidigare playtest-cykler.
10. `docs/design-armory.md`, `docs/design-audio-oct28.md`, `docs/design-bit-skill-tree.md` —
    vapenbänk, ljudpipeline, BIT-talanger.
11. **[PR #201]** `docs/core-meta-commerce.md` — *läs detta före de andra PR #201-dokumenten*:
    det är uttryckligen den sammanfattande "single source of truth" som de andra hänvisar till
    och är överskriven av.
12. **[PR #201]** `docs/design-decisions.md` — beslutsregister, historik över vad som är
    godkänt kontra hypotetiskt.
13. **[PR #201]** `docs/game-design-reference.md` — bred spel-/loop-referens (ersatt i delar av
    `core-meta-commerce.md`, men bredare täckning).
14. **[PR #201]** `docs/eight-minute-raid-design.md` — detaljerat raid-pacing-förslag.
15. **[PR #201]** `docs/enemy-roles-difficulty-design.md` — fiendroller/svårighet, direkt
    relevant för förslag D.
16. **[PR #201]** `docs/tactical-encounter-grammar.md` — taktisk möte-grammatik, direkt
    relevant för förslag E.
17. **[PR #201]** `docs/combat-builds-design.md` — vapen/verktyg/stridsbygge-förslag.
18. **[PR #201]** `docs/raid-variety-system.md` — variation mellan återbesök i samma område.
19. **[PR #201]** `docs/world-mission-design.md` — världs- och uppdragsdesign.
20. **[PR #201]** `docs/progression-content-economy.md`, `docs/progression-simplification.md`,
    `docs/first-ten-extractions.md`, `docs/identity-home-meta.md` — meta-progression, de första
    tio extraktionerna, identitet/hem.
21. **[PR #201]** `docs/economy/README.md`, `docs/economy/first-ten-calibration.md`,
    `docs/economy/big-map-loot-implementation.md` — ekonomimodell och kalibrering.

## 4. Beslut som behövs

1. Godkänn/avslå principen i förslag C: terminal utan timer ersätter den automatiska,
   timade perk-väljaren — och välj paus kontra ingen paus av raidklockan (rekommendation: paus).
2. Godkänn att förslag D:s enda nya arketyp blir en flygande fiende (återanvänder redan
   modellerad `scout`-konst); resten av önskade mönster byggs som varianter/tillägg på
   grunt/rusher/thrower.
3. Godkänn principen "valfritt + belönat" för förslag E i stället för "hela bunkern måste
   utforskas", innan någon brytare/riskrums-layout byggs.
4. Godkänn ny hand-in-etikett (förslag: "SLUTFÖR UPPDRAG") och förhandsvisning av
   kostnad/belöning i förslag F.
5. Bekräfta eller korrigera gissningen om vad "unselected map parts"-feedbacken syftar på
   (§1.1) innan den stämplas som löst i fixPR:en.
6. Godkänn `rusher.windupMs` höjt till samma 1000 ms-golv som alla andra arketyper (förslag B).
7. Bestäm leash-tid/radie för förslag A (upptäckt + jakt) och om svärmfiender ska undantas.

---

**Sammanfattning (5 rader):** Speltestarna gillade fiendevariationen, BIT-uppgifterna och basens
UI, men fastnade på sköldade vakter, otydlig upptäckt/jakt, en stressig timad perk-väljare och
ett otydligt "Lämna in". En del UI-fixar (fullskärm, stängknapp, HUD, nivåtitelkort, grön
Continue-knapp, vakt-placering) är redan på väg i en separat PR. Sex designförslag (A–F) adresserar
resten: synligt jaktläge med leash, ett datafix för en enda otelegraferad fiendetyp (chargern),
en otimad perk-terminal, mestadels återanvända fiendearketyper plus en ny flygare, valfria
riskrum i stället för tvingad full utforskning, och en stegvis FTUE-fördjupning med tydligare
hand-in. Inget av förslagen är byggt eller ekonomiskt godkänt av detta dokument — sju konkreta
beslutspunkter väntar på Robert (§4). En dokumentationsindex (§3) ger Johannes en läsordning
genom befintliga design-docs plus PR #201, utan att duplicera innehållet.
