# Ekonomidesign: Protocol Rebirth (förslag, ej implementerat)

Status: endast design (v1.49.0). Alla siffror är startvärden att balansera i speltest. Källor: `data/items.js`, `data/modules.js`, `data/recipes.js`, `data/vendors.js`, `data/raid_zones.js`, `data/progression.js`, `data/bit.js` och `nodspel/levels.js`.

## 1. Nuläge (inventering)

### Valutor
| Valuta | Källor idag | Sänkor idag | Kommentar |
|---|---|---|---|
| **Scrap** | Startsaldo 20, sälja föremål (sellValue × 0,6), "Scrap it" (sellValue × 0,5, kräver Fabricator L1), simulerade raids | Vendor-köp, recept (`scrapCost` 5–40), billig återhämtningsutrustning (15), raidkostnad | Fungerar som mjuk valuta, men har inga stora sänkor i mitten av spelet. |
| **Salvage** | `salvage_crate` (+8) i Node Raid, simulerade raids (halv vid död) | Modulbyggen (10–60) | Den viktigaste progressionsvalutan. |
| **Data Cores** | `data_core` (+2) i Node Raid, simulerade raids | BIT Bay L2 (6) | Har nästan inga sänkor och blir lätt "död" valuta. |
| **Signals** | Falsk reklam (+3) | Försäkring (2/5), återställd väska (4) | Premium/monetisering-prototyp. |
| **Bond XP / Operator XP** | Raids | – (nivåer) | Inte valuta, men progression. Operator-kurva: 50 + 25·(n−1) XP per nivå. |

### Föremål och användning idag
- **Modulkrav:** power_cell, scrap_alloy, cable, fuse, optical_sensor, polymer_plate, servo, circuit_board, hydraulic_component, memory_module, power_relay och ai_fragment.
- **Recept:** med_gel → medkit, scrap_alloy → ammo_pack, polymer_plate + scrap_alloy → scavenger_vest, bio_sample + polymer_plate → purification_filter, circuit_board + transmitter → power_relay, optical_sensor + servo + scrap_alloy → rifle_marksman.
- **Byteshandel:** 3 servo → hydraulic_component, 2 memory_module → transmitter, prewar_relic → power_cell.
- **Har ingen sänka idag (bara sälj):** encrypted_drive, rebirth_shard, neural_core, purification_filter (bara recept-output), ammo_pack (används inte av Node Raid) och bio_sample (används nästan inte).
- **Utrustning:** basic_carbine (gratis, oändlig), smg_vector, shotgun_breach, rifle_marksman, scavenger_vest (lås upp vid Fabricator L1), scout_rig och dampener_cloak.

## 2. Principer
1. **En mjuk valuta (Scrap)** för allt vardagligt: vendor, recept, reparation och senare försäkring.
2. **Material driver progression**, valuta driver bekvämlighet. Moduler kostar främst material och lite Salvage.
3. **Salvage slås ihop med Scrap på sikt** (förslag A), eller behålls som "byggvaluta" som bara modulerna använder (förslag B, mindre ändring).
4. **Data Cores = sällsynt "forsknings"-valuta**, alltså inte köpbar premiumvaluta. Den används för ritningar (weapon/gear-recept), modul-tier 2+ och BIT-färdigheter.
5. **Signals = enda premium-/annonsvalutan.** Den ger aldrig kraft, bara säkerhet och tid (försäkring, snabbare expedition, återställd väska).
6. **Risk = värde.** Allt man bär in i en raid kan förloras, och allt man hittar är förlorat om man inte extraherar (Tarkov-lik). Gratis-karbinen gör att man aldrig "står utan".

## 3. Materialtiers (förslag)
| Tier | Roll | Exempel |
|---|---|---|
| **T1 Vanlig** | Bulk, finns överallt, säljs billigt | scrap_alloy, cable, fuse, polymer_plate, med_gel |
| **T2 Ovanlig** | Mittspelets flaskhals, nivå 2+ eller zon 2 | servo, circuit_board, power_cell, bio_sample, optical_sensor |
| **T3 Sällsynt** | Djupa nivåer, gate för modul L2 och vapen | hydraulic_component, memory_module, transmitter, power_relay, purification_filter |
| **T4 Protocol** | Story/endgame, kan inte köpas | ai_fragment, encrypted_drive, rebirth_shard, neural_core |
| **Valuable** | Ren säljvara/byteshandel | prewar_relic |

Föreslagen justering: servo och circuit_board flyttas från "common" till T2, och power_cell flyttas från "uncommon" till T2 (ingen ändring). Rarity-fältet i `items.js` bör spegla tiern.

## 4. Tabell över alla material
Droppvikt = relativ vikt i Node Raid-lootbordet. Nivå 1 / 2 / 3 enligt förslaget; "–" betyder att den inte droppar.

| Material | Tier | Källa | Huvudanvändning | Föreslagen vikt N1 / N2 / N3 |
|---|---|---|---|---|
| scrap_alloy | T1 | Loot överallt, vendor 25 | Core L1, ammo, väst, gevär | 4 / 2 / 1 |
| cable | T1 | Loot, vendor 40 | Fabricator L1, BIT Bay L1 | 3 / 1 / – |
| fuse | T1 | Loot, vendor 50 | Fabricator L1 | 2 / 3 / – |
| polymer_plate | T1 | Loot, vendor 55 | Storage L1, väst, filter | 2 / 3 / 1 |
| med_gel | T1 | Loot (zon 1), vendor 45 | Medkit | 2 / 2 / 1 |
| power_cell | T2 | Loot, byteshandel (relic) | Core L1 | 2 / 2 / 1 |
| servo | T2 | Loot, vendor 60 | Storage L1, gevär, byteshandel | 1 / 3 / 1 |
| circuit_board | T2 | Loot | Core L2, Fabricator L2, relä | – / 2 / 2 |
| optical_sensor | T2 | Loot | BIT Bay L1, gevär | – / 2 / 1 |
| bio_sample | T2 | Loot (zon 2) | Filter, ny: avancerad medkit | – / 1 / 2 |
| hydraulic_component | T3 | Loot djupt, byteshandel (3 servo) | Fabricator L2 | – / – / 2 |
| memory_module | T3 | Loot djupt | BIT Bay L2, byteshandel | – / – / 2 |
| transmitter | T3 | Byteshandel, zon 2 | Relä, ny: kontrakt | – / – / 1 |
| power_relay | T3 | Loot djupt, recept | Core L2 | – / – / 1 |
| purification_filter | T3 | Recept, zon 2 | Ny: Living Quarters / zon-tillgång | – / – / 1 |
| ai_fragment | T4 | Loot djupt (sällsynt) | Core L2, story | – / – / 0,5 |
| encrypted_drive | T4 | Zon 2, bossar | Ny: dekryptering → Data Cores/ritningar | – / – / 0,5 |
| rebirth_shard | T4 | Endgame | Ny: Core L3 | – / – / – |
| neural_core | T4 | Endgame | Ny: BIT-uppgradering | – / – / – |
| prewar_relic | Valuable | Sällsynt loot | Sälj (250) / byteshandel | – / 0,5 / 1 |
| salvage_crate | Valuta | Loot | → Salvage (+8) | 2 / 4 / 4 |
| data_core | Valuta | Loot | → Data Cores (+2) | – / 2 / 3 |

Utrustning i loot (behålls låg): smg_vector och shotgun_breach 1 på N2/N3, rifle_marksman 1 på N3, scout_rig och dampener_cloak 1 på N2/N3. Scavenger Vest droppar inte; den låses upp vid Fabricator L1 (recept + vendor).

## 5. Källor
- **Loot per nivå/zon:** djupare nivå ger högre tier (tabellen ovan), och zon 2 (Transit, Core L2) har bio/elektronik.
- **Återvinning:** "Scrap it" utökas till alla tiers (T1 0,5×, T2 0,4×, T3 0,3× sellValue) så att överskott alltid blir Scrap.
- **Kontrakt (nytt):** dagliga eller BIT-uppdrag, till exempel "extrahera med 2 circuit_board", ger Scrap och ibland en Data Core. De ger riktning utan att ge gratis material.
- **Expeditioner** (finns): små T1-mängder som tröst mellan sessioner.

## 6. Sänkor
- **Modulbyggen:** huvudsänkan för material och Salvage.
- **Tillverkning:** vapen och utrustning kostar T2/T3 + Scrap + (ny) en ritning för Data Cores. Förbrukningsvaror (medkit, ammo) kostar T1 + lite Scrap.
- **Vendor:** T1 och enkel utrustning för Scrap, gatade bakom progression (som Scavenger Vest vid Fabricator L1).
- **Reparation/hållbarhet (senare, valfritt):** utrustning tappar hållbarhet per raid och repareras för Scrap.
- **Försäkring (senare):** Scrap-pris = 25 % av utrustningens värde, eller Signals. Försäkrad utrustning kommer tillbaka efter en timer.

## 7. Tempomål
| Mål | Raids (ca) |
|---|---|
| Core L1 | 0 (startpaket) |
| Fabricator L1 | 1 (guidad raid) |
| Första egna vapen (SMG via vendor eller loot) | 3–5 |
| Storage L1 / BIT Bay L1 | 2–3 vardera |
| Fabricator L2 / Core L2 | 6–10 vardera |
| Operator nivå 5 | ca 15–20 raids (ca 20 XP per raid) |

En raid tar ca 3–5 min, så sikta på att en ny uppgradering är inom räckhåll var 2–3 raid tidigt och var 4–6 raid i mitten av spelet.

## 8. Risk vid död och extraktion
- Det man tar in (vapen, väst, medkits) är **förlorat vid död**. Gratis-karbinen gör att man alltid kan gå in "nakent".
- Det man hittar är **säkrat först vid extraktion**. Längre ner = mer värde = mer risk.
- **Säkert fack** (secure container, finns): 1 föremål överlever alltid.
- **Försäkring** (senare): mildrar förlusten mot Scrap eller Signals, aldrig 100 %.
- Säljvärdet på utrustning sätter priset på risken: att ta in ett gevär för 160 Scrap ska kännas som ett beslut.

## 9. Öppna frågor till ägaren
1. Ska Salvage slås ihop med Scrap (A) eller vara kvar som separat byggvaluta (B)?
2. Ska Data Cores vara ren forskningsvaluta (ritningar/BIT) eller också kunna köpas?
3. Vill du ha hållbarhet/reparation på utrustning, eller bara förlust vid död?
4. Ska försäkring kosta Scrap, Signals eller båda?
5. Ska vapen främst komma från loot, vendor eller tillverkning, och vilken andel för vardera?
6. Ska Operator-nivå låsa upp saker (vendor-hyllor, zoner) eller bara vara status?
7. Vad ska T4-föremålen (rebirth_shard, neural_core, encrypted_drive) användas till: Core L3, BIT eller story?
8. Ska "Scrap it" fungera för alla tiers?
9. Behövs en lagergräns för valutor, eller bara stash-platser för föremål?
10. Hur aggressiv ska Signals-monetiseringen vara i prototypen?

## 10. Ägarens beslut – implementerat i v1.49.0
1. **Salvage är sammanslagen med Scrap.** Scrap är nu den enda mjuka valutan.
   - Gamla sparfiler konverteras med **1 Salvage = 2 Scrap** (`SALVAGE_TO_SCRAP`).
   - `salvage_crate` ger **16 Scrap**.
   - Alla Salvage-kostnader är dubblade och betalas i Scrap: Core L2 120, Fabricator L1 20 / L2 100, BIT Bay L1 20 / L2 90 (+6 Data Cores), Storage L1 50.
   - Simulerade raids ger 20–50 Scrap (Industrial) och 30–70 Scrap (Transit).
   - Kontraktsbelöningarna är 30 och 20 Scrap.
2. **Data Cores kan köpas** hos vendorn: **1 Data Core = 120 Scrap eller 2 Signals**. Loot (`data_core` → 2) är fortfarande huvudkällan.
3. **Ingen hållbarhet.** Utrustningen förloras bara vid död. Hållbarhet kan läggas till senare som ett fält per föremål utan att ändra resten.
4. **Vapen kommer från tillverkning och loot.** Vendorn säljer inte längre SMG eller Shotgun. Ritningar (`blueprint:true`) i Fabricator:

| Vapen | Fabricator | Material | Scrap |
|---|---|---|---|
| Vector SMG | L1 | 3 scrap_alloy (T1), 1 servo (T2), 1 polymer_plate (T1) | 40 |
| Breach Shotgun | L2 | 2 scrap_alloy, 2 servo, 1 hydraulic_component (T3) | 60 |
| Marksman Rifle | L2 | 1 optical_sensor, 1 circuit_board (T2), 1 encrypted_drive (T4), 2 scrap_alloy | 80 |

5. **Döda föremål har fått sänkor:**
   - **encrypted_drive** används i receptet för Marksman Rifle och i dekryptering. Den droppar nu också på Node Raid nivå 3.
   - **rebirth_shard** kan omvandlas till 6 Data Cores (Fab L2, 20 Scrap) och droppar på nivå 3.
   - **neural_core** kan omvandlas till 12 Data Cores (Fab L2, 30 Scrap) och droppar på nivå 3 och i Transit.
   - **bio_sample** ger 1 bio_sample + 1 med_gel → 2 medkits (Fab L1), och används också i Purification Filter.
   - **ammo_pack** är borttagen ur receptet, vendorn och lootborden, eftersom Node Raid inte använder ammo. Föremålet finns kvar i datan så att gamla sparfiler fungerar.

## 11. Operator-nivå: upplåsningar nivå 1–10 (endast design)
Kurvan finns redan: 50 + 25·(n−1) XP per nivå, så nivå 10 nås vid 1 350 XP, vilket är ca 50–60 raids. Principen är att varannan nivå ger ett nytt **val eller system** och varannan en liten **kraftökning**, så att varje nivå känns. Ingen upplåsning får göra döden riskfri.

| Nivå | Upplåsning | Typ | Motivering |
|---|---|---|---|
| 1 | Grundoperatör, gratis karbin, 1 förbrukningsplats | Start | Enkel start. |
| 2 | **Andra förbrukningsplatsen** (Item 2) | Loadout | Första beslutet: ta två medkits, eller ett och plats för något annat. Lär ut risk. |
| 3 | **Loot-radar**: BIT pingar närmaste lootlåda i Node Raid (ikon på kartan, 10 s cooldown) | BIT-förmåga | Minskar letandet och knyter BIT till raiden. |
| 4 | **Vendor tier 2**: Scout Rig, Dampener Cloak och fler T2-material på hyllan | Vendor | Ger Scrap en ny sänka i mittspelet. |
| 5 | **+1 väskplats** (kapacitet 4 → 5) | Perk | Större vinst per extraktion och mer att förlora. Ren risk/belöning. |
| 6 | **Dash-laddning ×2** (två dashes, delad cooldown) | Perk | Skicklighetsbaserad överlevnad; nya sätt att undvika fiender. |
| 7 | **Ritning: förbättrade vapen** (t.ex. Vector SMG Mk II, +1 mag) via Fabricator | Ritning | Tillverkningen förblir den huvudsakliga vägen till vapen. |
| 8 | **Snabbare nod-laddning** (−15 % hålltid på noder) | Perk | Kortare exponering och fler noder per raid; passar stealth-builds. |
| 9 | **BIT-räddning+**: BIT kan rädda ett utrustat föremål vid död (en gång per 3 raids) | BIT-förmåga | Mildrar förlusten utan att ta bort den; knyter till bond. |
| 10 | **Kosmetisk operatörsskin "Rebirth Veteran"** + titel i lobbyn | Kosmetik | Statusmål; ingen kraft. |

Egna förslag efter nivå 10: perk-val vid varje ny nivå (välj 1 av 2), till exempel tystare steg eller längre extraktionsfönster, och prestige-säsonger.

Öppet: ska nivåerna låsa upp zoner, eller ska zonerna förbli knutna till Core-nivån? (Förslag: Core-nivån styr zoner och Operator-nivån styr förmågor.)

## 12. Idle/offline-system (v1.56.0, godkänt av ägaren)
Alla siffror finns i `data/retention.js` → `DATA.idle`. Tiden räknas på spartiden (väggklocka i localStorage). Om klockan ställs bakåt pausas allt tills tiden har kommit ikapp. Ingenting blir klart i förväg och ingenting går förlorat. Inga push-notiser.

| System | Siffror | Balans |
|---|---|---|
| **Scrap-återvinnare** (i Rebirth Core) | 10 / 14 / 20 Scrap per timme vid Core L1 / L2 / L3 (v1.64, tidigare 6 / 10 / 15); lagret rymmer 8 h = 80 / 112 / 160 Scrap; samla in med ett tryck (chip vid Core + kort i Core-popupen) | En natt ≈ 1–2 raids värt Scrap (en raid ger ca 47–72, se nedan). Det kompletterar raids och ersätter dem inte. |
| **Byggtimer** L2+ | Fabricator/BIT Bay/Storage: L2 15 min, L3 60 min; Rebirth Core: L2 30 min, L3 120 min. Den **första** L2+-uppgraderingen är direkt (FTUE-valet) | Kostnaden betalas vid start, så inget kan förloras. Rummet får byggställning och blinkande bärnstenslampa. Bygget blir klart även offline. |
| **Fabricator-kö** | Platser: L1 2, L2 3. Tider: medkit 3 min, väst 8, filter 10, relä/syntes 12–15, SMG 20, Shotgun/Rifle 30. Den första tillverkningen är direkt (FTUE) | Jobben körs efter varandra. Material och Scrap tas vid köläggning, och full kö tar ingenting. |
| **BIT-scavenging** | 20 min (BIT Bay L1), 15 min (L2), gratis, misslyckas aldrig: 8–15 Scrap + 1–2 T1-delar (scrap_alloy, cable, fuse, polymer_plate, med_gel) + 15 % chans på en T2-del (servo, circuit_board, power_cell) | Ungefär 1/4 av en raids värde per körning. Kan inte köras samtidigt som en expedition. |
| **Välkommen tillbaka** | Visas efter ≥ 2 min borta och bara om något hände. Det är en liten remsa överst på basen, inte en blockerande popup, och den stängs med X | Listar färdiga byggen, tillverkning, BIT:s fynd och lagrad Scrap. |

Timvärde i passiv Scrap: L1 ca 10/h + scavenging ca 30/h om spelaren skickar BIT varje gång, mot ca 700–1000/h aktivt i raids (47–72 Scrap per raid på 3–5 min). Passivt ger alltså klart under 10 % av aktivt spel, så raids förblir huvudkällan.

### 12.1 Scrap i Node Raid (v1.64, Oscars playtest)
Den gamla simulerade `scrapRange` gäller inte längre. Node Raid ger Scrap från två källor, och bara vid extract (död/timeout = 0):

| Källa | Siffror |
|---|---|
| **Salvage Crate** (tar en bagplats) | 24 Scrap (tidigare 16). L1-vikt 4 av 15 (tidigare 2), L1 har 2 lådor (tidigare 1) |
| **Extract-bonus** (tar ingen bagplats) | +5 / +10 / +15 per klarad nivå L1 / L2 / L3, alltså 5 / 15 / 30 totalt. Visas på resultatskärmen |

Förväntad Scrap per extraherad raid (från de riktiga loot-tabellerna): L1+L2 ca 47 (tidigare ca 15), hela raiden ca 72 (tidigare ca 22).

| Mål (efter Fabricator L1) | Scrap | Raids före | Raids nu |
|---|---|---|---|
| Storage L1 (BIT Bay L1 + Storage L1) | 70 | 4 | 1 (2 om bara L1+L2 klaras) |
| Första L2-uppgraderingen (Fabricator L2) | 170 | 8 | 3 |
| Rebirth Core L2 (alla L1 + L2 på vägen) | 500 | 23 | 7 |

Rebirth Core L2 kostar nu 1 Circuit Board + 1 Power Cell (i stället för 2 Circuit Board), så Power Cell har en riktig användning. `test/oscar.test.mjs` räknar om målen från datan så att de inte kan glida.

## 13. BIT Quests (v1.57)

Daily short goals in the BIT tab. They exist to point the player at the next unlock, not to farm.

- **3 quests per day**, generated on first BIT visit (or first raid) of the local day. No refill when they complete. **1 free swap** per day.
- Shown only once the FTUE is over (`choice_upgrade` beat reached) and BIT Bay is built. FTUE untouched.
- **Solvability:** `data/quests.js > questFacts` lists per area/zone the enemies (seen in >=60% of generated levels), loot items (>=20%) and house containers (Town only). The generator only offers quests whose facts are reachable now: unlocked areas, zones up to highest cleared + 1. `nodspel/tests/quest-facts.test.mjs` resamples the level generator so the table can't drift.
- **Types and sizes by tier** (tier 0 = Bunker only, 1 = Archipelago / Core L2, 2 = Town / Core L3):

| Type | Tier 0 | Tier 1 | Tier 2 |
|---|---|---|---|
| Kill grunts | 3-4 | 4-6 | 6-8 |
| Kill sentries | 1 | 1-2 | 2-3 |
| Kill rushers | 1-2 | 2-3 | 2-4 |
| Search houses (Town) | 2 | 2-3 | 3-4 |
| Extract item | 1 | 1 | 1-2 |
| Clear zone + extract | 1 | 1 | 1 |

- **Nudges first:** the tracked missing upgrade part (extract it) and the scout clear of the area that unlocks the next one.
- **Reward: pick 1 of 3 cards.** Two of {Scrap 30/45/60, 1 component (tracked part if possible), Operator XP 20/30/40} plus a **mystery box**:

| Rarity | Weight | Contents |
|---|---|---|
| Common | 30% | 15 Scrap |
| Uncommon | 35% | 30 Scrap + 1 T1 part |
| Rare | 22% | 50 Scrap + 1 T2 part |
| Epic | 10% | 70 Scrap + 2 T2 parts |
| Legendary | 3% | 120 Scrap + 2 T2 parts + 2 Data Cores |

- Each claim gives **+12 BIT Bond XP**. Max per day: 3 quests, about 150 Scrap equivalent, which is below one Town extract. Scavenging is separate and runs at the same time.

## 14. L1-materialreduktion (v1.60.0, godkänt, PRB-73 PR A)
Nivå 1 droppar bara Scrap Alloy, Cable och Polymer Plate (+ Salvage Crate som ger Scrap). Power Cell och Servo droppar från nivå 2. BIT Bay L1 kostar 2 Cable + 1 Polymer Plate + 20 Scrap, Storage L1 kostar 2 Polymer Plate + 2 Scrap Alloy + 50 Scrap, och Optical Sensor har flyttats till BIT Bay L2. Se docs/design-encounters-toolkit.md §3.
