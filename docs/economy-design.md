# Ekonomidesign: Protocol Rebirth (förslag, ej implementerat)

Status: endast design (v1.34.1). Alla siffror är startvärden att balansera i speltest. Källor: `data/items.js`, `data/modules.js`, `data/recipes.js`, `data/vendors.js`, `data/raid_zones.js`, `data/progression.js`, `data/bit.js` och `nodspel/levels.js`.

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
