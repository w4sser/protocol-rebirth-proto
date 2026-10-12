# Meta ↔ Core-integration (Protocol Rebirth)

Status: förslag + första steg implementerat (RaidResult v1 via localStorage).

## 1. Nuläge

### Meta (repo-roten: `index.html`, `app.js`, `data/*.js`)
- **Sparning:** `localStorage["pr_meta_save"]`, `SAVE_VERSION = 7` (migrering från v6 finns). Ett objekt `S` med bl.a.
  `cur` (valutor: `scrap`, `salvage`, `dataCores`, …), `stash` (item-id → antal), `modules` (modul-id → nivå),
  `bondXp`, `tracked` (spårad uppgradering), `zoneIntel`, `raids`, `deaths`, `baseState`, `roomUnlocks`, `log`.
- **Items:** `data/items.js` – t.ex. `cable`, `fuse`, `scrap_alloy`, `power_cell`, `medkit`, `ammo_pack`, `basic_carbine` …
- **Raid idag:** helt simulerad. `resolveRaid(cfg)` med `cfg = {zoneId, routeId, riskId, loadout:[itemIds], insuranceId, trackedItemId}`
  rullar loot/salvage/dataCores/utfall; `applyRaidResult(R)` lägger in loot + utrustning i stash, valutor, bond-XP,
  försäkring/secure item vid död, beat-progression. Inget spel körs.

### Core (`nodspel/`, Node Raid)
- Seedad runda (`createRound(seed, now)`), 3 nivåer, 8 min, väska 4 platser.
- Loot-typer: `scrap_alloy`, `power_cell`, `cable`, `fuse`, `medkit` (+ `ammo_pack` som blir reservammo, ej väska).
  **Alla id:n finns redan i metans `data/items.js`.**
- Vid exit flyttas väskan till `round.extracted` (SECURED); vid död/timeout flyttas väskan till `round.lost`.
- Utgångsläge: start-loadout från `RULES.loadout` (hälsa 100, ammo 12). Order-inläsning (`order.json`, `readOrder`) och
  resultatexport (`raidResult`, `result.json`, `localStorage['nodspel.result.json']`, nedladdningslänk) är bortkommenterade.

## 2. Mismatchar
| Område | Meta förväntar | Core producerar/tar emot |
|---|---|---|
| Start | zon, rutt, risk, loadout (item-id:n), försäkring, spårat item | bara seed (slumpad eller URL) |
| Utfall | `extract` / död | `complete`, `death`, `timeout` (+ mellanläge `extraction` per nivå) |
| Loot | lista item-id:n, rullad mot zonens loot-tabell | 5 fasta typer, egna pooler i `RULES.loot` |
| Valutor | `salvage`, `dataCores` per raid | inga |
| Loadout tillbaka | hela loadouten vid extract, försäkring vid död | vapen/ammo inte modellerat utåt (gammal `raidResult` hade `weaponReturned`/`ammoReturned`) |
| Delvis säkrat | finns inte (allt eller inget) | loot säkrad på tidigare nivåer behålls även vid död |
| Timeout | finns inte | egen utgång, väskan förloras |
| Idempotens | – | inget raid-id; samma resultat kan läsas flera gånger |
| Format | – | gammal `result.json` saknade schema/version/id |

## 3. Föreslaget kontrakt

### 3.1 Launch params (meta → core), v1 (ej implementerat än)
Via URL-query (fungerar för statisk hosting, delbart, testbart):
```
nodspel/index.html?raidId=<uuid>&seed=<str>&zone=industrial&route=maintenance_tunnels&risk=standard
  &health=100&ammo=12&weapon=basic_carbine&objective=cable,fuse&return=../index.html
```
Alternativt (för större payloads) `localStorage["pr_raid_order_v1"]` med samma fält som JSON
`{schema:"protocol-rebirth/raid-order", version:1, raidId, seed, zone, route, risk, loadout:{weapon, ammo}, health, objective:[]}`.
Core validerar (som gamla `readOrder`) och faller tillbaka till `RULES.loadout` vid ogiltig input.

### 3.2 RaidResult (core → meta), v1 (IMPLEMENTERAT)
Nyckel: `localStorage["pr_raid_result_v1"]` (samma origin, eftersom `nodspel/` serveras under metans origin).
```json
{
  "schema": "protocol-rebirth/raid-result",
  "version": 1,
  "raidId": "nodspel:<seed>",
  "seed": "<seed>",
  "outcome": "extract | death | timeout",
  "levelsCleared": 0,
  "enemiesDefeated": 0,
  "nodesLit": 0,
  "remainingMs": 0,
  "extracted": ["cable", "scrap_alloy"],
  "lost": ["fuse"],
  "endedAt": 1760000000000
}
```
Regler:
- Skrivs bara när hela rundan är slut (`round.over`), aldrig vid mellanliggande nivå-exit.
- `extracted` = allt som säkrats vid någon exit (även om spelaren dör senare). `lost` = väskan vid död/timeout.
- `outcome`: `complete → extract`, `death → death`, `timeout → timeout`.
- Meta validerar schema/version, att `extracted` bara innehåller kända item-id:n, och ingesterar **en gång per `raidId`**
  (`S.coreRaidsIngested`, max 50 senaste). Nyckeln tas bort efter läsning (även ogiltig data, så den inte fastnar).
- Versionsbyte = ny `version` + ny nyckel; meta ignorerar okända versioner.
- `postMessage` är ett framtida alternativ om core körs i iframe; samma JSON-objekt skickas då som `{type:"raid-result", result}`.

## 4. Steg-för-steg-plan
1. **(Klar)** Core skriver RaidResult v1 till localStorage (`nodspel/raid-result.js`, anrop i `finishRound`). Meta läser och
   ingesterar vid uppstart (`ingestPendingCoreResult` i `app.js`): stash += extracted, `raids++`, `deaths++` vid död,
   loggar `CORE_RAID_INGESTED`. Tester i `nodspel/tests/raid-result.test.mjs` och `test/logic.test.js`.
2. **Launch:** knapp ”Deploy (Node Raid)” i metans raid-prep som genererar `raidId`+seed och öppnar `nodspel/` med
   launch params. Core läser `seed` från URL (stödet för `requestedSeed` finns redan i `reset`).
3. **Loadout in:** återaktivera `readOrder` i core för `health`/`ammo`/`weapon`; meta reserverar loadouten i stash vid deploy.
4. **Ekonomi-mappning i meta:** härled `salvage`/`dataCores`/bond-XP från RaidResult (t.ex. per `levelsCleared`/`nodesLit`)
   i `data/` (ingen hårdkodning), och kör befintlig död-logik (försäkring, secure item) på loadouten.
   Bestäm hur `timeout` hanteras (föreslag: som död men utan `deaths++`).
5. **Loot-pooler:** låt metans zon/rutt styra core-loot (skicka viktad pool i ordern) så att spårat item kan dyka upp.
6. **Retur till meta:** core-knapp ”Tillbaka till basen” (`return`-param) när rundan är slut; meta visar resultatskärm
   för ingesterad raid och avancerar beats som vid `extract`.
7. **Slutligen:** ersätt simulerade `resolveRaid` för de zoner som har core-stöd; behåll simuleringen som fallback/dev.

## 5. Risker
- **Avbruten runda:** stängs fliken mitt i raid skrivs inget resultat – säkrad loot från tidigare nivåer går förlorad.
  Åtgärd senare: skriv `status:"in_progress"`-snapshot eller ingestera delta per exit.
- **Fusk/manipulation:** localStorage är fritt redigerbart. Acceptabelt i prototyp; validering + item-whitelist finns.
- **Origin:** fungerar bara om meta och core delar origin (samma host/port). Annars krävs URL-retur eller `postMessage`.
- **Samtidiga flikar:** meta öppen i annan flik läser först vid nästa laddning; dubbletter skyddas av `raidId`.
  Seed som återanvänds manuellt ger samma `raidId` → ignoreras (önskat tills launch params ger unika id:n).
- **Balans:** core-loot (max 4 per exit, få typer) matchar inte metans loot-tabeller och kostnader – kräver tuning i `data/`.
- **Spara-format:** `S.coreRaidsIngested` läggs till lat (ingen `SAVE_VERSION`-höjning); gamla sparningar fungerar.
- **Parallellt arbete:** branchen `ux-playtest-fixes` ändrar UI i båda delarna; ändringarna här är små och avgränsade
  (ny fil i core, tre rader i `game.mjs`, ett nytt block + en rad init i `app.js`) för att minimera konflikter.

## 6. Status: steg 2 + 6 (minimal loop) – implementerat
- Meta: knappen **DEPLOY — NODE RAID** i raid-prep (både guidad och vanlig) skapar `raidId` (`meta-<tid>-<hex>`) + seed,
  loggar `CORE_RAID_LAUNCHED` och öppnar `./nodspel/?seed=..&raidId=..&return=../index.html` i samma flik.
- Core: `readLaunch()` läser `seed`/`raidId`/`return`. `raidId` valideras (`[A-Za-z0-9_.:-]{1,64}`) och används bara för den
  startade seeden (Restart ger `nodspel:<seed>`). `return` godtas bara som relativ sökväg på samma origin
  (inget schema, ingen `//`, inga `\`, inga `:`). Vid rundans slut visas **Return to base** som skriver resultatet och navigerar tillbaka.
- Meta: vid uppstart ingesteras resultatet (som förut) och en kort toast visar utfall + loot.
- Ekonomi- och timeout-semantik är **oförändrad**: loadout reserveras/förbrukas inte, inga salvage/dataCores, ingen beat-progression.

### Öppna designfrågor
1. Ska Node Raid-deploy kräva/förbruka loadout (vapen, ammo, försäkring) och fuel?
2. Ska `timeout` räknas som död (`deaths++`, försäkring) eller som ett eget, mildare utfall?
3. Ska core-raids ge `salvage`/`dataCores`/bond-XP, och i så fall enligt vilken formel (data i `data/`)?
4. Ska en core-extract avancera FTUE-beats på samma sätt som den simulerade raiden?
5. Ska knappen ersätta den simulerade DEPLOY i guidad FTUE, eller ligga kvar som alternativ?
6. Restart i core efter en startad raid: tillåtet (eget id, loot räknas) eller ska Restart döljas när `return` finns?
