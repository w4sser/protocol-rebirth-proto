# Art Direction v07 – gameplay expression och mobil läsbarhet

**Status (9 november 2026):** v07 kompletterar den etablerade AD06-identiteten med gameplay-art direction som följer de ägargodkända besluten [M38–M41](design-decisions.md). Den är **inte en ny visuell stil**, en ny spelmekanik eller en beställning på komplett artproduktion. Exakta modeller, ansiktsuttryck, klipp, shaders, tider, teknik och kvalitetsnivåer avgörs i spelbara mobila tester.

**Historisk källa:** `ad06.pdf` (30 sidor, ägaren 14 okt). Nyckelsidor har tidigare renderats i `/workspace/art-direction/pages/` (p01, p07 palett, p08 läsbarhet, p22–23 BIT, p28 låst/öppet, p30 karta). AD06 låste ton, palett, OP-01 och BIT:s originalidentitet och betecknade UI/HUD, vapen, combat-VFX, fiender och biomer som ännu inte färdigdesignade.

**Företräde:** AD06:s ton, miljö, palett, typografi, produktionsåterhållsamhet och originalmaster gäller fortsatt. **v07 ersätter enbart tolkningen att OP-01 är den enda tillåtna spelbara looken och att BIT endast får visa ett statiskt standarduttryck**, samt tillför riktlinjer för rörelse, fiendereaktioner och visuell hierarki. Grundansiktets master och tidigare godkända referensassets skrivs inte över. Godkända M38–M41-regler gäller före äldre, motstridiga förslag (bland annat hitstop/slow motion i `design-combat-feel-oct28.md`).

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

## Ikonografi / UI-principer (mobil riktning, ej färdig HUD-layout)
1. "Read the game before the detail": om något bara fungerar i närbild bär det inte AD → ikoner = stora, läsbara siluetter i fysisk mobilstorlek, minimalt med fina detaljer.
2. Färg är semantik, inte dekor: cyan för system/BIT/extraction, amber för loot/belöning, coral för fara, neutral för resten.
3. Inga emoji, generiska smileys eller nationella symboler. BIT:s **originalansikte är identitetsmaster** (vertikala piller-ögon, fylld U-smile med avsmalnande bredd 32→64→32, originalmaster 1000×875). M40 tillåter **kontrollerad animerad variation i spelet**, inte att byta ut eller skriva över originalmaster. Se uttrycksreglerna nedan.
4. Rutter kommuniceras med landmärken, ljuspooler och materialkontrast – inte glödande stigar eller UI-pilar (gäller världen; UI-pilar i menyer ok).
5. Grundprioritet: läsbar Operator, BIT och omedelbara hot → rutter/gränser → skydd/landmärken/mål → atmosfär. **I aktiv strid har fiendesiluetter, inkommande attacker, telegrafer, siktlinje och kontroller alltid företräde framför BIT-emotes, kosmetik och dekorativa effekter.**

## Miljö
- Liten kit, koherent värld: 6 materialfamiljer – granit (cover/boundary/landmark), kustpinjer (crouched/sentinel/crown), kallakrigsbetong (portal/wall/slab), boundaries & cover, lågfrekvent mark. Ingen gräsmatta, inga engångsprops. Variation genom skala, rotation, överlapp, delvis begravning, ljus.
- Gångbar mark: plan, ljusare, kontinuerlig, låg texturbrus. Hård gräns: vertikal granit, tät vegetation, komprimerade valörer. Giltig rutt: inramat negativt rum, fri siktlinje, varmt destinationsljus.
- Bunkern inuti: CRT-glöd, kabeldragningar, enstaka lampor – aldrig dagsljus. Amber utility light är enda värmen.
- Kamera: pitch ≈52°, VFOV ≈38°, operatören 12–13 % av skärmhöjden (10–11 % vid vida hot, 14–15 % vid nära), fokus 2–3 m framför, övergång 0,4–0,7 s med hysteres. Förgrund tonas bara lokalt där den skymmer OP-01/hot.

## Karaktärer
- **OP-01 (grundreferens, inte exklusiv spelbar kropp)**: vuxen operatör, 7,5–8 huvuden lång, smal, rörlig, långbent. Könsneutral siluett, djup huva (bara ögonregionen syns), tyg över näsa/mun/hals, raka snitt. Stiliserad men aldrig söt/chibi. "Någon som gick in i faran medvetet." Andra kosmetiska Operator-utseenden får vara tydligt olika, men följer M38:s gemensamma spelmekanik och mobilanpassade läsbarhet.
- **BIT (identitetsmaster)**: mjuk rundad CRT-kropp, petrol-teal hölje, cyan skärm, vertikala piller-ögon, bred U-smile, kort antenn, liten sidomodul, liten amber statuslampa, lugn hover. Äldre tier 1–3-hårdvarureferenser och kosmetiska skal ska bevara en igenkännbar BIT-siluett och ansiktsfamilj; de innebär inte automatiskt nya förmågor. Personlighet: hjälpsam, lojal, fräck, galghumor. M40 tillåter selektiva uttrycksanimationer men inte att grunddesignen blir en annan figur.
- "Leendet tillhör världen": samma smile återkommer i miljön (skyltar, skärmar) – vänligt som kan kännas olustigt.


## M38 – Character art, kosmetiska identiteter

- **En Operator-mekanik; många uttryck.** OP-01 är ett visuellt ankare, inte ett unikt spelmekaniskt val. Huvudform, kläder, material, färg och silhouette får skapa olika kosmetiska identiteter, inklusive mänskliga och mer tekniska varianter, men alla behåller **samma rörelse, räckvidd, hitbox/kollision, vapentiming och taktiska utfall**. Ingen skin får ge mer effektiv kamouflage, ett vilseledande kroppsomfång eller en spelmässig fördel.
- **Förenlig rörelseläsning, inte nödvändigtvis identisk rigg.** Alla looks måste kunna visa samma funktionella beteenden och samma svar på input. En procedural karaktär får ha annan animationsimplementering, men får inte sakna upplevd run/aim/fire/hit/death-läsbarhet eller bete sig annorlunda mekaniskt.
- **Läsbar från kameran.** Ansiktsdetaljer och små plaggdetaljer är sekundära. Spelaren måste snabbt kunna hitta sin Operator, uppfatta facing/vapenriktning och särskilja karaktären från fiender i mörk terräng, vid eldstrid och i tät vegetation. Den visuella nivån ska fungera i riktig landskapsmobil, inte bara som porträtt eller närbild.
- **Kosmetik är permanent visuell äganderätt, inte skyddad utrustning.** Operator- och BIT-looks består över raiddöd; vapen, rustning och loot följer fortsatt riskreglerna D1. Skins introducerar inga klasser, aktiva skills eller nya progressionsträd. Bevisa grundupplevelsen med ett fåtal looks före en stor katalog.

## M39 – Character animation och vapenrespons

- **Action first.** Rörelse, riktningsbyte, sikte och skott ska visuellt följa spelarens avsikt snabbt och tydligt. Animation får ge vikt och momentum men får inte omotiverat låsa input, fördröja giltiga handlingar eller överta styrningen.
- **Gemensamt beteendespråk för alla skins:** idle/löpning, riktningsbyte, sikte, skjutning, dash, mottagen träff, interaktion, extraction och nederlag ska ha tillräckligt tydliga visuella tillstånd för spelets faktiska handlingar. Detta är en **valideringslista**, inte ett låst antal klipp eller krav på viss rigg.
- **Vapentyngd genom presentation.** Pose, upplevd rekyl, mynning/impact-återkoppling och återhämtning kan särskilja vapen och göra Basic Carbine tillfredsställande. Ingen animation får i sig skapa extra skada, ändra träffvalidering, flytta hitbox eller introducera ett nytt recovery-/interrupt-fönster.
- **Isometrisk disciplin.** Viktiga poses måste synas från aktuell kameravinkel och i normal gameplay-skala. Överdrivet svängande vapen, kroppar som skymmer siktlinje och teatraliska rörelser prioriteras bort när de konkurrerar med fiendehot.
- **Detaljer öppna för produktionstest:** antal klipp, blend/cancel-regler, root motion, rigg, timing, styrkänsla, tillgänglighet och mobilprestanda. M39 ger inte generell tillåtelse till hitstop eller slow motion.

## M40 – BIT expression utan identitetsförlust

- **Bevara ansiktets signatur.** Två vertikala pillerögon och den breda U-formade munnen förblir igenkännbara. Den godkända masterasseten `assets/bit-face-master.svg` är referens och ska inte skrivas över. Inga ögonbryn, tänder, pupiller, utbytbara emojiansikten eller dekorativa yttre cyanstrips. Undvik en ny figur för varje känsla.
- **Tillåt kontrollerat uttryck i gameplay.** Förstahandsmedel är blickens/ögonens återhållsamma förändring, CRT-ljus, lutning, höjd, hover-rytm, antenn och små kroppsposer. Varsam förändring inom samma ögon- och smile-familj får undersökas i artprover, **utan att ansiktsgeometrin eller ett nytt uttrycksalfabet låses här**. Originallogotyp och statiska masterassets förblir oförändrade.
- **Reagera på verkliga händelser, inte på ständig timer.** Undersökande förflyttning, synligt hot, skada på Operator, värdefullt fynd, ruttval, extraction och misslyckande får skapa korta, begripliga reaktioner. BIT ska kännas närvarande i vanliga raids men ska vara stillsamt när spelaren behöver sikta, undvika skott eller förstå resultatet av strid.
- **Kroppsspråk före extra UI.** Ingen ny obligatorisk popup, reaktionsmätare, oönskad dialog, ständig blinkning eller HUD-indikator för humör. Viktig information får aldrig kräva ljud.
- **Uttryck är inte en power.** BIT finns och får visa personlighet före BIT Bay L1. Aktivt stridsstöd följer fortsatt M28–M35 och kräver färdig BIT Bay L1 samt spelaraktivering; en animation ger inte försvar, distraktion, loot-räddning, avslöjad garanterad loot eller automatisk extraction. Kosmetiska BIT-looks påverkar inte spelmekanik.

## M41 – Enemy art och combat feedback

| Faktiskt utfall | Visuellt och ljudmässigt mål | Får inte misstolkas som |
| --- | --- | --- |
| **Validerad skadande träff** | Synlig, lokal reaktion hos rätt fiende, lämplig impact/VFX och distinkt kort ljudsignal när ljud används | En miss, blockering eller nytt stagger/stun |
| **Sköld/armor blockerar enligt faktiska regler** | Tydligt annat material- och impact-svar än skadande träff; vid behov läsbart från sidan/ryggen | Bekräftad skada när ingen skada registrerades |
| **Bekräftat besegrad fiende** | Ett igenkännbart avslut: pose/kollaps, kort effekt och/eller ljud som skiljer sig från vanlig träff; försvinnandet får inte se ut som en missad träff | Extra loot, ytterligare kill-registrering eller nytt mekaniskt tillstånd |
| **Miss/icke-validerad träff** | Endast faktisk världskontakt eller projektilutfall; ingen falsk målreaktion | Skada eller eliminerad fiende |

- **Event-sanning före spektakel.** Alla målreaktioner styrs av verkliga validerade spelhändelser. Visuellt ryck, deformation eller rörelse är *presentation*, inte knockback, nytt attackavbrott, stun, extra damage, immunity eller förändrad kollision. Befintliga giltiga mekaniska effekter får inte tyst tas bort.
- **Arketyper har olika rytm, gemensamt språk.** Snabba fiender, bepansrade mål, sköldar och turrets kan reagera olika, men spelaren ska förstå skada, blockering och död utan att kunna deras animationer i förväg. Fiendens hot, frontsköld, angreppstelegraf och motspel måste vara synliga hela tiden.
- **Basic Carbine är baslinjen.** En vanlig träff och besegrad fiende ska kännas tillfredsställande med startvapnet och utan dyra skins, avancerade vapen eller extra abilities. Feedbacken får stödja, inte dölja, positionsval och taktiska kombinationer.
- **Återanvänd före ny teknik.** Befintligt `nodspel/fx-feedback.js` har redan impact/hit/shield/explosion-flöden; verifiera deras eventkoppling och komplettera där det brister innan ett separat effektsystem föreslås. Äldre `design-combat-feel-oct28.md` innehåller *föreslagna* hitstop-/slowmotion-värden; de är **inte** beslutade av M41 och får inte följa med automatiskt.
- **Ljud är förstärkning.** Spelaren ska förstå träff, block och defeat även när mobilen är mutad. Effekter får inte maskera skott, projektiler, hottelegrafer, interaktionspunkter, extraction eller UI-kontroller. Ingen ny timing, partikelbudget eller teknik låses här.

## Mobile visual hierarchy – företräde i spelbar scen

1. **Operator och direkt säkerhetskritisk information:** spelposition, riktning, omedelbara fiendehot, projektiler och hottelegrafer.
2. **Aktuellt stridsutfall och navigering:** verkliga träff-/block-/kill-signaler, skydd, gångbar mark, valbar väg, interactables och extraction.
3. **BIT och kontext:** BIT:s siluett, närvaro och korta meningsfulla uttryck – alltid nedtonade under aktiv eldstrid.
4. **Världsbyggnad och dekor:** atmosfär, sekundära props, subtila partiklar och mikrodetaljer; första nivån att reducera på Low.

Testa alltid på liten landskapsmobil med både ljud av/på och effektbegränsat läge. Läsbarheten ska inte bero på rim light, en liten ansiktsdetalj, avancerad shader eller exklusiva höginställningar. Föredra stora rena former och få men distinkta effekter framför hög partikel-/texturtäthet. Sikta mot spelets befintliga Low-prestandamål; nya numeriska grafikbudgetar fastställs först genom mätning.

**Konceptbilder kontra spelproduktion:** Tidigare telefon- och miljökoncept som närmar sig fotorealism är referenser för *stämning, ljussättning, komposition och materialkänsla*. De är inte krav på detaljerad fotorealistisk geometri, högfrekventa texturer eller nya efterbearbetningseffekter. Världens stiliserade low-poly-grund och produktionsrestriktioner är oförändrade.

## Kontrollpunkter i nuvarande implementation (inte en leveransrapport)

- `nodspel/characters.js` listar `operator`, `punk` och `robot`. De två förstnämnda delar deklarerade animationer; `robot` är procedural och deklarerar null för alla namngivna klipp. Det bevisar **inte** att roboten saknar all procedural rörelse, men M38–M39 kräver **upplevd animations- och beteendeparitet** på telefon innan den kan betraktas som likvärdig.
- `nodspel/fx-feedback.js` innehåller flera visuella händelser. Det bevisar inte M41:s godkända kvalitet i praktiken; särskilt träff kontra block och synlig defeat behöver speltestas.
- Källkoden ovan är en inventering vid dokumentrevisionen, inte bevis på att den spelbara versionen redan uppfyller M38–M41.

## Nästa steg: mobil proof-of-fun / vertical slice (ej implementeringsorder)

Bygg *först efter separat kod-/assetgodkännande* en liten vanlig raidscen med en fullt responsiv Operator, Basic Carbine, ett fåtal befintliga representativa fiender, faktabunden hit/block/defeat-feedback och 2–3 meningsfulla, eventstyrda BIT-reaktioner. Testa även en andra visuellt avvikande Operator-look (gärna den procedurala roboten om användbar) för att kontrollera paritet, **inte** för att fylla ett skinutbud.

**Validera på riktig telefon i normal kamera/Low och ljud av/på:**
- Kan spelaren förutsäga rörelse, tydligt sikta/skjuta, se sin Operator och uppfatta hits och defeats utan tvekan?
- Skiljer spelaren mellan skada, sköldblock, miss och bekräftad död; syns fiendehot, projektiler och motspel samtidigt?
- Märks BIT:s reaktioner som karaktär utan att konkurrera med strid eller skapa intryck av en låst/olåst förmåga?
- Spelar skilda skins identiskt mekaniskt och känns deras rörelser lika responsiva?
- Håller frame pacing/läsbarhet under täta möten och effektbegränsad mobilgrafik; fungerar allt med avstängt ljud?

**Rapportera observationer och missförstånd** (felavlästa hits/kills, upplevd orättvis skada, skymda hot, tappad kontroll och FPS/frame pacing) innan fler skins, större uttrycksbibliotek eller komplexare FX tas fram. Exakta animationer, timings, systemval och mobilbudget låses först efter denna validering.

## Ursprunglig AD06-milstolpe (historisk referens)
Spelbar "bunker approach slice": OP-01 identifierbar på 0,25 s, OP-01/BIT/närmaste hot skiljbara utan HUD, huvudrutt/valfri belöning/extraction läses via ljus, ingen ocklusion av OP-01, mobil-rimlig produktion, känslan mörk men hoppfull.
