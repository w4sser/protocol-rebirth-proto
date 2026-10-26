# Designförslag: kärnstriden (PRB, v2.1.1 till nästa)

*Status: dokumentförslag för Roberts beslut, ingen implementation beställd. PvE; död förlorar allt man bär; ingen ny valuta; BIT kör en aktiv uppgift i taget. Live Fire förblir isolerat. BIT har inga cyan sidoremsor. Utgår från `docs/design-encounters-toolkit.md` och `docs/design-playtest-oct25.md`; ekonomiförändringar kräver separat ägarbeslut.*

Bakgrund – Lords speltest-feedback (ordagrant):

> "the core isn't fun, so nothing else matters. You just walk forward and shoot, at least for the ~5 raids I could be bothered to play. You walk around the shield guy, but you get that immediately and then you just do that. Look at Archero or something with a similar core that's fun enough. The levels seem to be the same, only 2 variants? One with a long corridor and one with a single room."

## Nordstjärna: plan → feedback → bättre plan

Lords uppföljningssvar (ordagrant):

> "Fun = problem solving that is challenging and interesting enough: different options that give different results, you can make a plan, get feedback on what worked and what didn't, and improve the plan next time. If a working plan is just walk forward and shoot, it is 100% not fun."

> "The first level is ok, I get bored when I play 2-3 levels in a row that are quite similar and not challenging."

Vi bedömer varje förslag mot **(a) konkurrerande planer med olika utfall**, **(b) begriplig återkoppling** och **(c) variation som gör att spelaren behöver ompröva planen mellan möten och försök**. L1 får vara enkel introduktion. Målet i L2/L3 är att gå fram och skjuta inte konsekvent dominerar alternativ som att vänta, flankera, söka skydd eller välja mål. En lyckad sådan runda är inte ensam ett misslyckande.

## Beslut 2026-10-26

Robert har godkänt planen med följande svar på de öppna frågorna i §10:

1. Ja till två-PR-experimentet och rörelseberoende assist, inklusive L1.
2. Åtta kort räcker; förenkla sista rummets val senare om alla bara tar extra tid.
3. Direkta HP-/tidseffekter är OK i prototypen; timertrycket behålls.
4. Perk kräver bara att rummets fiender är besegrade (inte alla reserver, noder eller generator).
5. Full paus av strid och timer under valet.
6. Befintliga mötespaket räcker för första testet.
7. Inga giriga ekonomikort tills vidare.
8. Passiv Spaning; BIT gör en uppgift åt gången. Regeln om inga cyan sidoremsor gäller bara BIT:s chassi; effekter får vara cyan.

## 1. Diagnos: kodfakta och speltesthypoteser

Kontrollerat mot nuvarande `nodspel/` (v2.1.1). Funktionsnamn nedan är sökbara ankare; förslag är inte beskrivningar av befintlig funktion.

**Sikte och träffar.** `RULES.weapon` i `levels.js` har `assistAngleDegrees:12`, `assistWidth:1.1`, `homingDegreesPerSecond:90`, `homingAngleDegrees:20`. `assistStrength:.65` är definierad men används inte av `assistAim()` i `weapon.js`. Mål måste klara vinkel, sidledsbredd, räckvidd och fri målspårning genom `weaponHit()`; levande aktiva fiender och ännu inaktiva noder kan vara mål. I `fireAimedWeapon()` avgörs en lyckad assisterad träff direkt genom `applyWeaponHit()`. Dess efterföljande tracer är visuell och kan inte skada igen. Fria, ännu oavgjorda projektiler styrs av `steerShot()` i `stepWeapon()`. Att enbart sänka homing påverkar alltså inte de omedelbara assisterade träffarna. Hypotes: assistens generösa behörighetsfönster bidrar till att ungefärligt sikte under rörelse räcker för ofta.

**Eldrytm och återhämtning.** Nivåernas baskylder är **2400 / 1400 / 1350 ms**, före typmultiplikatorer (sentry ×1,3, rusher ×0,8) och egna mötescykler. `stepGuard()` används av intro-vakt, guard-möte och turret-möte: varning, tre tidsförskjutna skott i samma riktning, återhämtning. Vanliga sentries går genom den vanliga skottloopen och skjuter en projektil åt gången. `RULES.combat.bulletSpeed` är 9 m/s. Mötesberäknad skada i `encounterDamage()` begränsas till 30 % av max HP; det är inte ett generellt tak för alla skadekällor.

En kvalificerande fiendedöd i `hitEnemy()` ger **upp till 12 HP**, klampat mot max HP; generatorn räknas inte som en kill. Vapenkills flyttar dessutom **upp till en patron från reserv till magasin**, begränsat av plats och reserv (`applyWeaponHit()`). BIT läker **5 HP/s endast när spelaren står still**: `stepBIT()` kräver både `!moving` och ingen uppmätt förflyttning. Påståendet att HP-flödet ofta blir positivt är en hypotes som kräver faktisk mätning av inkommande skada, kill-läkning och stillastående BIT-läkning.

**En känd kontring räcker länge.** Guard har en frontsköld med halvvinkel 70° (`shieldBlocks()`), torn har återhämtningsfönster och generatorn håller nodskölden aktiv. Kontringarna är läsbara, men Lord upplever att samma flankering sedan löser mötet varje gång. Koden bevisar inte en universell dominant strategi; kombinationer och placering måste prövas i speltest.

**Upplevd variation och faktisk geometri.** Det finns **fem layoutvarianter per nivå, femton totalt**, med **1/2/3 huvudrum**. L2 varierar dimensioner, avstånd och objektplacering; L3 dessutom ruttriktningar och döda ändens riktning/längd. Bunker L1 har ett fast **13×12 kontrollrum plus skåpsgren**; Archipelago skalar rumsdimensioner ×1,25. Områdena delar generatorgrund med områdesanpassningar. Lords ”2 variants” beskriver upplevd variation, inte antalet kodlayouter. L3:s befintliga döda ände grenar från **rum 0**, medan extract placeras i **sista huvudrummet** (`generateLevel()`). En guardian vid extract måste därför placeras i sista rummet, inte i den befintliga grenen.

**Progression och Hard.** Observation: inget nuvarande in-raid perksystem; inget påstått kodcitat behövs. Hard har redan HP ×1,4, skada ×1,2, extra kroppar och möteskombinationer, bland annat Guard+Turret. Beteendemässiga elitmodifierare och en boss är nya förslag ovanpå detta. Noder, loot, vapenswap och meta-utrustning ger redan beslut; hypotesen är att de inte räcker för att bära själva striden över flera liknande nivåer.

**Rumsinträde är inte rensning.** `createCombat()` lägger startrummet i `visited` direkt. `stepCombat()` använder första inträde för ankomstgrace, inte för att avgöra om fiender är besegrade. Inaktiva L2-reserver väcks av `activateNode()`; svärmens medlemmar väntar på `stepSpawners()` och närhetstrigger. Ett nytt klartillstånd behövs enligt §5.

## 2. Referenser som designinspiration

Archero inspirerar växlingen mellan förflyttning och ett skottläge samt små återkommande uppgraderingsval. Survivor.io inspirerar en tillfällig byggidentitet under körningen. Soul Knight inspirerar läsbara rumsmöten och Brawl Stars tydliga roller och synliga projektiler. Detta är designreferenser, inte verifierade produktjämförelser eller ett förslag att kopiera deras kontroll eller ekonomi.

Översättning till vårt spel: behåll sikte som släpps för skott, pröva korta skottfönster mellan förflyttningar och få befintliga fiender att skapa olika prioriteringsproblem tillsammans.

## 3. Fem kärnpelare

1. **Rörelse och skottfönster är beslut.** Stanna för större assistfönster eller skjut i rörelse för lägre exponering; inget av alternativen ska vinna i alla möten.
2. **Läsbar fiende, varierande sammanhang.** Behåll tydliga varningar och befintliga skyddsregler. Variera kombination och skyddsvinkel före nya fiendetyper.
3. **Ett val efter varje rensat huvudrum.** Pick-1-av-3 ger en tillfällig in-raid plan, följd av synlig återkoppling om vad valet faktiskt gjorde.
4. **Risken tillhör extraction.** Loot förblir osäkrat tills extract. Ett perk får inte rädda buren loot vid död; ekonomi och lootnivå ändras endast efter separat ägarbeslut.
5. **Nästa möte ska motivera en bättre plan.** L2/L3 ska skilja sig genom befintliga hot och placering. Eskalering bedöms med spelarens planbyten, inte bara högre HP eller fler projektiler.

Pelarna är riktning, inte fem redan godkända resultat. (a) prövas med strategijämförelser, (b) levereras uttryckligen i §8 och (c) börjar med den begränsade mötesrotationen i §7.

## 4. Kärnexperiment: assist, fan och befintliga kombinationer

**Rörelseberoende assist.** PR1 berör uttryckligen `weapon.js`: `assistAim()`, dess förhandsvisning och anropet från `fireAimedWeapon()`. Första tuninghypotesen är att minska vinkel/bredd från 12°/1,1 m till 4°/0,4 m under rörelse; stillastående behåller dagens fönster. Detta är experimentvärden, inte utlovad balans. Rörelseläget utgår från faktisk förflyttning inklusive dash och knuff, med samma tillstånd vid siktesförhandsvisning och skott. En spak som hålls mot en vägg ska inte ensam räknas som förflyttning. BIT:s nuvarande striktare stillaståendevillkor ändras inte av experimentet.

Fria projektilers styrning är en separat ratt: testa lägre `homingDegreesPerSecond` under rörelse, utan att påstå att det ändrar redan assisterade träffar. Tillståndet vid avfyrning följer projektilen; att släppa spaken efter skott ska inte återställa stark homing. Behåll samma inputmetod och samma vapenroller. Global kontrolltuning påverkar även L1, vilket måste godkännas och förståelighetstestas; L1:s mötesinnehåll byggs inte om.

**Fan bara för turret-mötet i MVP.** I `stepGuard()` får `encounter==='turret'` tre låsta skottriktningar −15°/0°/+15° kring riktningen vid varningen, fortfarande med befintliga skottintervall och återhämtning. Fanens ytterkanter visas under hela befintliga varningen. Guard, intro-vakt och normal sentry behåller sina egna mönster. Separat sentry-fan eller patrullsvep ligger i obunden backlog. Hypotes: fan plus en flankerande fiende gör val mellan skydd, målordning och flytt under återhämtning mer intressanta. En bred fan kan också skapa luckor; den garanterar inte att gå-och-skjuta slutar fungera.

**Lobbning.** Typen `thrower` går genom kastgrenen (`lobGrenade()`/`stepBlasts()`), snarare än vanlig projektilspårning mot skydd. Men målringen skapas bara när `windup>0`: vanliga L2/L3-throwers saknar idag både egen `windupMs` och nivåns `enemyWindupMs`, så typen ensam garanterar inte ett fungerande ring/kast. Den namngivna mötesvarianten `grenadier` sätter uttryckligen sin varning och egna stats; PR1 återanvänder just den fungerande mötesvarianten och förutsätter ingen fix av vanlig thrower. Ingen generell `lobber:true` byggs. Att lämna en ring kan gå utmärkt under gång och skytte. Hypotesen gäller hur ringens läge samspelar med andra hot, inte att lobbning i sig bevisar ett planbyte.

**Nordstjärnebedömning:** assist jämför säkert skottläge med rörelse; turret-fan jämför väntan i skydd med flytt/flank; kombinationer jämför målordning. Synliga varningar ger omedelbar feedback, men förklarar inte ensamma missar eller dödsorsak. PR2:s recap krävs innan vi påstår att hela feedbackloopen fungerar. Värden justeras efter jämförda utfall, inte automatiskt mot hårdare straff om spelaren fortsätter röra sig.

## 5. Pick-1-av-3 och verklig rumsrensning

### Rensningskontrakt för PR2

Nytt tillstånd per `(raid, nivå, huvudrumsindex)`: `unresolved`, `clearPending`, `rewardPending`, `rewarded`. Separat från `combat.visited`. Skåpsgren, korridor och död ände ger inte egna perks. Utvärdera först efter färdig områdes-/mötesplacering och att rummet faktiskt tagits i spel; ingen belöning under generering. Rumsrensning kräver att fienderna i huvudrummet är besegrade. Reserver, noder och generatorer är inte separata krav för perk-clear. Återanvänd befintliga kroppar.

- Fiender räknas till rummet där de placerades. En fiende som går till grannrummet tillhör fortfarande sitt hemrum; att locka den över en tröskel räknas inte som en kill. Rumsrensning bedöms mot fienderna i det rummet, inklusive reserver som tillhör det; ingen nodaktivering, svärmtrigger eller generatorförstörelse krävs separat.
- När dessa villkor uppfyllts är rummet `clearPending`. Vid första säkra presentation blir det `rewardPending`, vilket kvarstår även om pickern minimeras. För popup krävs dessutom att spelaren befinner sig där, inga levande främmande fiender finns i rummet och inga redan avlossade projektiler, pågående varningar eller bomber kan hota spelaren. En aktiv skadeplatta under spelaren skjuter också upp popupen. Hot och timer fortsätter tills ett säkert läge nås; ingen konstgjord projektilrensning används för belöningen.
- Avlägsna oaggro fiender i andra rum blockerar inte hela nivån. Ett tillkommande hot skjuter upp presentation, men återställer aldrig en redan utbetald belöning. Köade belöningar behåller sitt rums-ID; endast en popup visas åt gången. Vid nivåbyte presenteras en väntande belöning i det säkra nivåresultatet före fortsatt spel; rummet behöver inte återbesökas. **Händelseordning:** uppdatera fiendedöd och clear före `enterExit()` samma frame. Fånga en intjänad men väntande belöning före nästa nivå och före L3:s automatiska `secureBag()`/`over`/resultat; håll själva avslutet väntande medan valet är pausat och fullfölj sedan extraction utan ny strid. Detta är en uttrycklig ändring av dagens slutflöde, inte ett antagande att en picker kan öppnas efter att raiden redan avslutats. Vid extraction utan full rumsrensning skapas ingen extra clear-belöning. Död/timeout ger ingen ny perk, och en övergiven olöst rumsbelöning följer inte med som gratis clear.
- Rummet blir `rewarded` atomiskt med valet. Om ett nytt hot sedan kommer dit ges ingen andra perk. Inga nya respawns behövs för detta system. Validera att rummets fiender och clear-state räknas konsekvent även när fiender flyttar mellan rum.

**Pausbeslut:** när pickern öppnas pausas **både strid och raidtimer**, inklusive hazard, BIT-läkning, projektiler, spawner, vapencykler och verktyg. Pausen börjar inte vid `clearPending`. Använd en gemensam pausad speltid för samtliga dessa system: dagens `tickRound()` räknar mot absolut deadline, så att enbart stoppa renderloopen räcker inte. Även visibility- och knappvägar måste använda samma tid. Nollställ hållna rörelse-/siktes-/eldinputs vid öppning och återgång. Stängmärket uppe till vänster minimerar valet till en diskret väntande belöning och återupptar tiden; det väljer inget automatiskt. Återöppning pausar igen. Ett väntande val kräver ett uttryckligt val före fortsatt nivå eller avslutad extraction, men får aldrig tvinga in spelaren i nästa nivå.

### Exakt åtta MVP-perks

Poolen nedan ersätter den tidigare 19-kortskatalogen som implementationsunderlag. Ingen multiskottsmotor, lootomrullning, extra fiendespawn, ny aktiv knapp eller valuta ingår. Alla kort har **max en stack per raid**. Välj tre distinkta ännu ovalda kort, seedat på raid och rums-ID; inga omrullningar genom stäng/öppna. Högst sex huvudrum ger sex val, så minst tre ovalda kort finns inför det sjätte valet. Fördröjda val behandlas i rumsordning. Effekterna nollställs vid död, extract eller avslutad raid, aldrig vid vanligt nivåbyte.

| Perk | Exakt föreslagen effekt, inklusive gräns | Konkurrerande planer | Synligt utfall och spelarens justering nästa försök |
|---|---|---|---|
| Kedjereaktion | En kvalificerande vapenkill laddar nästa verkliga skott med +50 % skada. Max en laddning; den förbrukas även vid miss/block. Ingen laddning från generator; max en stack. | Börja med svagt mål och använd laddningen mot guard, eller fokusera farligast direkt. | Recap visar laddat skott, mål och faktisk extra skada eller miss/block. Nästa försök: byt första mål eller vänta tills flanken är öppen. |
| Lugn omladdning | Vapnets ordinarie omladdningsintervall −20 %, aldrig under 250 ms; ingen gratis ammunition, ingen ändrad magasinsstorlek; max en stack. | Håll skydd och återladda, eller riskera korta skottfönster med patroner kvar. | Vapencykel och recap visar sparad omladdningstid och reservbrist. Nästa försök: sök skydd tidigare eller välj ett annat kort om reserven är begränsningen. |
| Rullning | Dash-cooldown ×0,75 med golv 2000 ms; ingen ändrad dashsträcka eller osårbarhet; max en stack. **Vid L3:s sista clear i stället:** återställ dash omedelbart och ge 3 s raidtid, utan ny stack. | Spara dash till varningen eller använd den för flankering. | Recap visar dashar och om cooldown var klar vid senaste skada. Nästa försök: spara till senare skott eller flankera tidigare. |
| Nödsköld | Första skada som lämnar spelaren vid högst 20 % HP och över 0 HP aktiverar 50 % reduktion av efterföljande skada i 2 s. Den utlösande träffen reduceras inte; ingen återupplivning. En laddning per huvudrums-ID, användbar där och i dess anslutna gren; varje rum får sin budget en gång, aldrig via återinträde. Vid val i ett just rensat rum finns en första laddning där; nästa laddning hör till nästa tidigare obudgeterade rum; max en stack. | Retirera före låg HP eller använd korta räddningsfönstret för att nå skydd. | Tydlig aktiveringsmarkör; recap visar sparad skada och att laddningen är spenderad. Nästa försök: backa tidigare, inte förlita sig på samma sköld vid återinträde. |
| Fältmedik | BIT:s normala stillastående läkning 5 → 8 HP/s; samma rörelse-, HP- och uppgiftsvillkor som normalt, ingen parallell läkning; max en stack. | Stå säkert och läka eller fortsätt mot extract innan tiden tar slut. | Recap visar faktiskt läkt HP och stillastående läkningstid. Nästa försök: byt läkningsplats eller avstå kortet om stillastående kostar för mycket tid. |
| Spaning | Passiv markering av redan telegraferande fiendes identitet/riktning under dess befintliga varning samt av kvarvarande lootlådor i det rensade huvudrummet. Ingen tidigare skadestart, förlängd varning, lootroll eller aktiv BIT-uppgift; max en stack. **Vid L3:s sista clear i stället:** visa alla befintliga oinsamlade lådor i nivån och ge 5 s raidtid, utan ny stack. | Använd informationen för säker prioritering/lootväg eller välj rå stridsstyrka. | Markeringen och recap visar vilken källa som varnade och vilka befintliga lådor som återstod. Nästa försök: välj annan väg/mål; välj bort Spaning om egen läsning redan räcker. |
| Fältförband | Läk omedelbart upp till 20 HP vid valet, utan ändrad max HP, medkitförbrukning eller räddad loot; max en stack. **Vid L3:s sista clear i stället:** samma omedelbara läkning och dessutom 8 s raidtid, utan ny stack. | Säker HP nu eller framtida värde från Fältmedik. | Val och recap visar verklig HP-vinst, inklusive klampning. Nästa försök: välj tidigare återhämtning eller ett annat kort när HP redan är fullt. |
| Tidsmarginal | Lägg omedelbart 8 s till återstående raidtid, aktuell deadline och `durationMs`-taket som `tickRound()` använder, en gång; ingen effekt på cooldowns eller belöningstabeller; max en stack. | Lägg tiden på loot/säkert skottläge eller extrahera utan ytterligare risk. | Timer och recap visar tillägget och tid vid extract. Nästa försök: planera kortare lootväg om tillägget ändå inte räcker. |

Siffrorna är exakta för den föreslagna prototypen, inte slutbalans. Varje terminal tidsbonus uppdaterar också återstående tid, deadline och `durationMs`-tak tillsammans, så att dagens klampning i `tickRound()` inte äter upp bonusen. Nödsköldens rumsbudget lagras separat från clear-state; tröskelpassage och återinträde får inte ladda om den. I korridor används senast besökta huvudrums budget, inte en ny laddning. Alla procentsatser, tider och gränser placeras i `data/*.js` vid en senare implementation, inte som ny hårdkodad ekonomi/tuning i UI eller stridsfunktioner.

**Sista rummets värde:** Efter L3:s sista clear finns inte ett nytt stridsrum att bygga för. Valet för just detta rum använder därför de tre terminala varianterna **Rullning, Spaning och Fältförband**, med ersättningseffekter direkt i tabellens effektkolumn. Det gäller oberoende av antal tidigare rensade rum och tidigare val, utan ny stack; äldre köade rumsbelöningar behandlas alltid först enligt rumsordningen ovan. Valet gäller transport/lootväg kontra återhämtning/tidmarginal före extract; inget ändrar lootinnehåll. Tidstillägget är användbart för återstående väg till extract även om HP är fullt eller lådorna tomma. Om belöningen måste fångas först när spelaren redan nått exit återstår däremot inget taktiskt terminalvärde; visa då valet tillsammans med avslutsrecapen och mät det som ett innehållslöst slutval, inte som lyckad planvariation. Om allt redan är hämtat och ingen transportåtgärd behövs kommer tidskortet rimligen dominera; vi påstår inte att slutvalet då är tre likvärdiga taktiska val. Mät detta separat och fråga Robert om sista belöningen hellre ska vara ett förenklat avslutsval efter MVP-testet. Ingen utgång låses för att spelaren ska tvingas ta ytterligare risk.

**Loot-timing:** `generateLevel()` bestämmer lådornas föremål innan striden; vissa kan redan vara insamlade vid clear. MVP lägger endast information över befintliga lådor. Inget insamlat eller genererat föremål omrullas retroaktivt. Framtida ”nästa rums loot”-kort får först påverka ett ännu inte genererat nästa nivåinnehåll eller uttryckligen nya, ännu inte rullade belöningar; inte tyst skriva om nuvarande rum. De måste uteslutas om inget framtida mål finns. Girig ficka (kapacitet), Högriskhandel/Plundrarens tur (lootnivå/chans), Djupdykare (extra låda/fiende) och Allt eller intet (`extractScrapBonus`) ingår inte i MVP och kräver Roberts ekonomibeslut innan specifikation/implementation.

### BIT:s enda aktiva uppgift

Spaning ovan är ett passivt UI-lager. Det upptar inte BIT:s uppgiftsplats och ändrar inte anfallsförvarningens tid. Fältmedik förstärker endast den befintliga uppgiften läkning. Ingen heal sker under en annan aktiv perk-uppgift.

Två tidigare idéer är uttryckligen obunden backlog, med följande kontrakt om Robert vill gå vidare:

- **Lockfågel:** en aktiv uppgift som lockar en rörlig fiende i 3 s, 20 s cooldown från start. Prioritet: raid slut avbryter allt; Lockfågel avbryter följ/läkning; Nödreparation får avbryta Lockfågel en gång vid sin tröskel. Avbrutet lock förbrukar hela cooldownen och återupptas inte automatiskt. Annars återgår BIT efter 3 s till normal läkning om spelaren står still och behöver HP, annars följ. Val: locka nu för flank eller spara till nästa hot; synligt utfall: locktid och utebliven BIT-läkning; nästa försök: lägg locket före flankeringen i stället för under reträtt.
- **Nödreparation:** en gång per raid vid övergång under 30 % HP, reservera en läkuppgift på högst 3 s och högst 10 extra HP utöver normal läkning; kräver fortfarande stillastående och levande spelare. Den avbryter Lockfågel enligt ovan. Rörelse avbryter läkning och förbrukar återstoden; ingen dold kö och ingen återupptagen gratis läkpuls. Efter fullföljd eller avbruten puls återgår BIT till normal prioritet läka/följ. Val: stanna i skydd för pulsen eller flytta undan hotet och förlora resten; synlig pulsbudget/recap visar utfall; nästa försök: retirera till skydd före tröskeln. Inte en ny beskrivning av dagens automatiska BIT-läkning.

**Bedömning:** varje behållet kort har ovan en konkurrerande plan, observerbar effekt och spelarjustering. Det gör dem prövbara, inte godkända mot alla tre kriterier. Variationen kommer från olika val ihop med olika möten; ett kort som alltid vinner eller bara ger obegriplig statistik skrivs om eller tas bort. Slutvalets begränsade variationsvärde är en uttrycklig öppen fråga.

## 6. Åtta taktiska fiendearketyper och kontringar

Detta är åtta taktiska roller, **inte åtta bokstavliga `enemyTypes`**. Kodens vanliga typer är grunt, rusher, sentry och thrower; encounter-varianter har ytterligare beteende. Tabellen separerar sentry och turret, samt ordinarie rusher och svärmmöte. Ingen ny fiendetyp behövs i MVP.

| Arketyp och kodstatus | Beteende/mönster idag | Kontring och konkurrerande planer | Placering och prövbar kombination |
|---|---|---|---|
| Grunt, vanlig typ | Närmar sig till standoff 3,5 m, ett rakt skott per cykel. | Bryt siktlinjen eller döda före nästa skott. | Alla nivåer; svag ensam men kan täcka reträtten från en guard. Mät om målordning ändras. |
| Rusher, vanlig typ | Snabbare rörelse, standoff 1,2 m, kortare skotträckvidd; inte en ren kontaktfiende. | Ta tidigt eller använd dash/korridor och fokusera annat hot. | L2/L3-blandningar, men även Archipelago L1 har rusher i mixen. Mät avstånd/skada vid vald prioritet. |
| Sentry, vanlig typ | Stillastående, räckvidd ×1,35, cooldown ×1,3; **enskilda skott**, inte `stepGuard()`-salva. | Skydd, sidledsrörelse eller EMP. | L2/L3-mix. Behåller enkelprojektil i PR1; separat sentry-fan är backlog. Guard+Sentry kan täcka en flank utan nytt mönster. |
| Turret, encounter på sentry-chassi | `stepGuard()`: varning, tre skott, `recoveryMs:2600`. PR1 föreslår fan endast här. | EMP eller vänta i skydd och flytta under recovery. | Town L2 normalt, även Hard-planer. Turret+Rusher jämför tidig rusher-kill med snabb turret-neutralisering. |
| Kastare, vanlig thrower / grenadier-variant | Vanlig thrower använder kastgrenen men saknar normalt varning/målring på L2/L3 (se §4). Grenadier anger uttrycklig varning och egna värden: **2 bas-HP**, varning 1200 ms, fuse 1000 ms; HP skalas av område/Hard. | Lämna ringen eller döda före kast; en redan kastad bomb landar även om kastaren dör. | Vanlig mix L2/L3, grenadier Archipelago L2 och Hard även L1. Med svärm: välj fri golvyta eller tidig kastar-kill. Det är en hypotes om planbyte. |
| Guard, encounter | 70° frontsköld, långsam vändning, varning/salva/recovery. Intro-vakten saknar denna frontsköld och är separat. | Flankera, locka med verktyg eller vänta in fönster. | Bunker L2 och Hard-planer. Para med befintlig sentry/turret så flanken behöver planeras; ensam lösning får vara enkel i inlärningen. |
| Patrull, encounter | Fast slinga, 35° synkon, 1 s alert före aggro; skada väcker den direkt. | Smyg bakom eller slå till från vald position. | L1 i områdesplanerna, med Hard-kombinationer. Ger val mellan undvikande och full clear; missad perk är priset för undvikande. |
| Svärm, encounter av rushers | 4–5 förplacerade inaktiva medlemmar, trigger 6,5 m, varning och utsläpp innan normal strid. | Granat på klustret eller fall tillbaka så korridoren köar dem. | L3-planer; med sentry eller kastare kan reträttväg kontra målordning bli ett nytt problem. Testa, anta inte att rörelse/skytte upphör fungera. |

**Generatorn är en stödjande objektiventitet**, inte en nionde stridsarketyp eller vanlig kill. Skjut den för permanent nodöppning, EMP för tillfällig nodöppning. Perk-clear följer rumsrensningskravet i §5; extraction behåller befintliga nodregler.

Återkoppling måste skilja kastare/torn/sentry och attacktyp. När två hot är aktiva visar recap deras observerade händelser, inte en påhittad slutsats att en viss kombo orsakade döden.

## 7. Rums- och nivåplan

**MVP återanvänder befintlig geometri och seedning.** Inga dörrlås, inga 12–16 nya mallar, inget raidräknarsystem. L1:s mötesinnehåll är introduktion enligt dagens områdes-/Hard-regler. L2 behåller två rum och passage, L3 tre huvudrum och den befintliga grenen från rum 0. Perk-clear är frivilligt djup i striden; exit kräver fortsatt aktiva noder, inte clear av varje fiende.

PR1:s begränsade placeringsändring provar två mötespaket per nivå, valda från seed och anpassade till faktiskt tillgängliga skyddsvinklar:

| Nivå | Paket A | Paket B | Vad spelaren kan ompröva |
|---|---|---|---|
| L2 | Guard + vanlig Sentry i nodrummet | Turret + vanlig Rusher i nodrummet | Flankera under enskilda skott eller ta rusher först och vänta på tornets recovery. |
| L3 | Svärm + vanlig Sentry i svärmrummet | Svärm + befintlig Grenadier i svärmrummet | Backa till korridoren eller lämna ringens yta och prioritera kastaren. |

Återanvänd/omplacera befintliga kroppar där det går; lägg inte ett helt nytt paket ovanpå Hard-planen. Paketet ersätter motsvarande offensiva mötesval, medan befintliga stödobjektiv som generator behålls. Placeringen måste kontrolleras efter områdesanpassningen; om båda hotens verkningsytor inte kan mötas utan blockerad nod/exit används ett validerat befintligt paket och avvikelsen loggas för testet. Garantera inte taktisk kombination enbart för att två typer finns någonstans på samma nivå.

Raid 2–3 får möjlighet till andra paket och layouter via seed; vi lovar inte att varje slumpad raid är svårare än den förra. För jämförbart test körs först ett paket, sedan det andra, sedan återbesök av det första med en ny plan. Ingen ny sparad raidprogression ingår. Om upplevelsen fortfarande är likformig är det ett underkänt variationsförsök, inte argument för att automatiskt lägga på mörker.

**Obunden innehållsbacklog, inte del av PR2:**

| Idé | Krävt taktiskt val, feedback och nästa plan innan den får byggas |
|---|---|
| Fler rumsmallar och ruttval | Kort säker väg med mindre loot kontra synlig extra risk. Visa vad som offras; spelaren ska kunna välja kortare nästa gång. Områdes-/lootbalans kräver beslut. |
| Mörker | Endast som val mellan kort mörk rutt och längre belyst rutt, med lika läsbara varningar och förhandsvisad risk. Visa rutt/tid/skador; byt väg nästa försök. Generellt sänkt synradie över hela rummet är skuret eftersom det mest höjer svårighet. |
| Översvämning | Lokal långsam genväg kontra torr omväg med exponerad siktlinje; varningar får inte göra den långsamma vägen omöjlig att lämna. Visa väg/tid/träffar; nästa försök väntar man in salvan eller tar omvägen. Global rörelsedebuff och stapling med mörker är skuret. |
| Marksman, generell lobbning, beteendeeliter | Ange nytt prioriterings-/positionsval per typ och egen telegraf/attackkälla. Visa det extra mönstrets effekt; spelaren ska kunna byta kontring. Mer HP i sig klarar inte detta. Ingen extra elit-HP ovanpå Hard av misstag. |
| Core Guardian | Endast i **L3:s sista huvudrum nära extract**, aldrig i rum-0-grenen. Möjlig sköldfas följd av fanfas, med tydlig fasvarning. Flank kontra vänta, sedan flytt under fan; recap visar fas och attack så nästa försök kan ändra timing. Två faser bevisar inte automatiskt två meningsfulla planer. |
| Rumslås | Kräver separat ritning för vägar och klartillstånd. Backtracking till redan tillgänglig extraction och valet Extract efter färdig nivå ska bevaras; inget krav att gå in i nästa nivå eller slå boss där för att säkra redan möjlig extraction. |

Ingen av backlograderna är ett leveranslöfte. De gamla extra perkidéerna är inte godkända som implementationskatalog; BIT-idéernas förslag till arbitration finns i §5. Ekonomikorten behöver ett separat beslutsunderlag.

## 8. MVP: två avgränsade PR:er efter ägarbeslut

**PR1: skottfönster och befintliga hot.** Endast rörelseberoende assistbehörighet och separat fri-projektiltuning i `weapon.js`, samma förhandsvisning/inputkoppling i `game.mjs`, turret-fan med synlig varningsbredd i `combat.js`/rendering samt §7:s två befintliga mötespaket per nivå i placeringslogiken. Tuning går via `data/*.js`; dagens `RULES` är källan för diagnosen, inte tillstånd att bryta dataguardrailen. Ingen perk-infrastruktur, mörker, raidräknare, ny arketyp, generell lobber, boss eller gate. PR1 testas mot dagens kontroll på samma seeds. Vi kan bedöma val/variation och direkta varningar här, men lovar inte full dödsförklaring före PR2.

**PR2: clear/perk/feedback-slice.** Endast §5:s rumsägarskap, clear-state och säker kö; åtta specificerade engångskort och tre uttryckliga terminala varianter; pausad pick-1-av-3; samt den lilla lokala recap nedan. Ingen full tidigare 19-perkpool, inga loot-/valutaförändringar, nya fiender, rumsgeneratorer eller gates. Ingen beständig perkprogression eller SAVE_VERSION-ändring för tillfälligt raidstate. Alla spelhandlingar kopplas genom projektets `act()`-väg. Versionskravet tillämpas om dessa kod-PR:er senare byggs; denna dokumentrevision ändrar ingen version.

**Spelarsynlig feedback är ett leveranskrav i PR2:**

- Vid clear visar pickerns befintliga `.pop-card`-yta en högst tre rader lång rumsrecap före valen: relevant attackkälla/attacktyp och skada; spelarens rörelseläge vid händelsen; en faktisk perk-effekt eller ”ingen aktivering”. Exempel: ”Turret, fan: 18 HP. Stillastående vid träffen. Nödsköld: 6 HP skada undveks.” Visa verkliga värden, inte utlovade exempelvärden.
- Vid död visar samma struktur sista skadehändelsen och senaste relevanta skott/perk-händelsen i befintlig resultatyta. För ett missat skott: ”I rörelse vid skottet; utanför assistvinkel; projektilen missade.” Skriv inte ”du missade för att du rörde dig” utan jämförelseunderlag. Tips kan föreslå att testa ett stillastående skottfönster, inte påstå orsak.
- Ny **begränsad lokal instrumentering**, högst 32 senaste stridshändelser plus summeringar per rum: stabil käll-/fiendeidentitet, attacktyp, tid/rums-ID, rörelse vid avfyrning respektive mottagen träff, assistkandidaters prövade avslag (vinkel/bredd/räckvidd/skymd, eller inget mål), skottets faktiska träff/miss/block och perk-aktivering/uppmätt effekt. Ingen extern telemetritjänst. Behåll skott-ID för att koppla fri projektil till avfyrningsläget; en tracer är inte en andra attack.
- `round.lastHit.source` täcker namngivna mötesskott; vanliga skott får idag `null`. `deathTip()` ger inget tips för vanliga fiender/hazards. Ny källmetadata för dessa och hazard-skada måste därför läggas till; det går inte att återanvända dagens fält som komplett dödsanalys. Kombopåståenden behöver flera tidskopplade händelser och är inte scope: visa ”Rusher aktiv; Turret träffade” om båda är observerade, inte ”Rusher tvingade dig in i fanen”.
- Använd befintlig popup `.pop-card`/`.pop-x`, stängmärke uppe till vänster, säker yta och `--ad-*`-tokens. Orange reserveras för primär handling. Små, korta aktiveringsmarkörer får inte täcka HUD, timer eller världsetiketter. Inga nya symbolglyfer, ad-hoc-modaler eller fastpositionerade informationsrutor.

**Verifiering inför respektive kod-PR:** assist direktträff/fria skott och skymda mål; turret kontra normal sentry/guard/intro; nåbara kombinationsplaceringar; därefter separat clear-test för rummets fiender, rumsvandring och exakt en belöning. Testa paus även via dold flik/knappar, sista rum, full HP, tomma lootlådor och tidigare maxade kort. Kör repots tester och `npm run verify` inklusive popup-fit i de tre mobilformaten. Detta är framtida implementationskrav; dokumentändringen kräver endast dokument-/kodfaktagranskning.

**Nordstjärnebedömning av MVP:** PR1 testar konkurrerande skott-/positionsplaner och kombinationer. PR2 gör valens effekt och attacker begripliga och ger nästa försök något konkret att ändra. Varken slumpade kort eller fler kroppar räcker som bevis på variation. Om en enda strategi fortsatt konsekvent dominerar måste experimentet omprövas före backlogexpansion.

## 9. Playtest och mått

Kör cirka fem raider med samma öppna fråga till Lord: ”Är kärnan kul, oavsett loot?” Separera PR1:s kontrolltest från PR2:s perk-/recaptest. Jämför samma vapen/område/Hard och seed med baslinjen; låt testordningen variera mellan spelare så inlärning inte förväxlas med förbättring.

- **Planer:** jämför gå-och-skjuta, stopp/skott/flytt och skydd/flank i avsedda L2/L3-möten. Logga clear/extract, skada, tid och resurskostnad. Fråga vilken plan spelaren avsåg och vad de ändrar vid återbesöket. Kriteriet är om gå-och-skjuta konsekvent dominerar alternativen över relevanta paket, inte om den någonsin lyckas.
- **Träffar och HP:** skada och träffar per rum, inkommande källa, HP före/efter, kill-läkning och stationär BIT-läkning separat. Positiv HP-trend och lägre skada efter inlärning är hypoteser; skada måste inte sjunka direkt när hoten blir bättre.
- **Sikte:** andel skott stilla/i rörelse, assistbehörighet och avslag, träff/miss/block per läge och vapen. Läget är observation, inte bevis på rörelsens kausala inverkan. Jämför kontrollerade seeds innan tuning skärps.
- **Tempo:** aktiv rumstid, faktisk clear-tid, tid för säkert vänteläge och separat paustid för perkval. Dashanvändning, cooldown vid skada och om dash kom efter varning; inga påståenden om spelarens avsikt utan fråga.
- **Perks:** valandel per erbjudande, verkliga aktiveringar, effektstorlek och planändring nästa rum/försök. Följ terminala kort separat: finns loot/transport/läkningsbehov kvar eller är tidskortet självklart? Jämför även total tidstillägg mot timertryck; inga giriga ekonomiperks finns i detta MVP.
- **Återkoppling:** fråga före recap vad som träffade/dödade och vad spelaren gjorde. Visa sedan recap och fråga vilken annan plan de vill testa. Jämför med loggen även för vanliga fiender och hazards; en korrekt intern logg utan begriplig spelaråterkoppling klarar inte (b).
- **Variation och lust:** känns nivå 2 respektive 3 olika, och skiljer sig raid 3 från raid 1? Kan spelaren beskriva ett nytt problem och ett ändrat val? Vill de fortsätta efter cirka fem raider? Fler raidstarter ensamt bevisar inte att striden är rolig.

Redovisa resultat och spridning per paket/vapen, inte bara ett totalsnitt. Fem raider ger kvalitativ riktning, inte statistisk säkerhet. Om Lord fortfarande upplever likformighet eller inte kan förklara utfallet är briefens mål inte uppnått, även om balanseringen ser rimlig ut i loggen.

## 10. Öppna frågor till Robert

Besluten nedan är besvarade i [Beslut 2026-10-26](#beslut-2026-10-26).

1. Godkänner du två-PR-experimentet och rörelseberoende **assistbehörighet**, inklusive påverkan på L1:s globala kontroll, före någon kod byggs?
2. Är åtta engångskort och de tre terminala varianterna rätt liten slice? Ska sista rummets val senare förenklas om tidstillägget konsekvent blir det enda relevanta utfallet?
3. Är föreslagna direkta HP-/tidseffekter acceptabla för prototypen, eller vill du behålla nuvarande timertryck och ersätta Tidsmarginal/terminala tidsbonusar innan implementation?
4. Godkänner du att perk-clear kräver att rummets fiender är besegrade, utan separat krav på reserver, noder eller generator, samtidigt som dagens nodbaserade extraction bevaras och undvikande kan ge utebliven perk?
5. Är full paus av både strid och raidtimer under val acceptabel, med minimering och återupptagen tid via stängmärket?
6. Räcker de befintliga mötespaketen för första variationstestet? Vilket specifikt upprepat problem ska i så fall motivera nästa backlogförslag: rum, Marksman, beteendeelit eller guardian i sista rummet?
7. Vill du alls gå vidare med giriga kort som ändrar kapacitet, befintlig valuta eller lootnivå? De kräver separat ekonomiförslag och godkännande; inget sådant tillstånd antas här.
8. Godkänner du passiv Spaning samt föreslagen exklusiv BIT-arbitration för de obundna idéerna Lockfågel/Nödreparation? Gäller regeln om inga cyan sidoremsor bara chassit eller också nya effekter?
