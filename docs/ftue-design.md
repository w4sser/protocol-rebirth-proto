# FTUE – de första 2 minuterna (design, v2.21.1)

Mål: en ny spelare ska känna "aha" snabbt. Visa resultatet, inte en tutorial: in i en raid, känna striden, och avsluta med en clutch-extraktion i en tänd exit-stråle.

## 0. Design rule (Robert, playtest 2026-11-16): BIT always introduces every system first

**BIT ALWAYS introduces every new system/concept (rooms, quests, crafting, vault, power, materials)
before it is shown or unlocked. No UI element appears unexplained.**

This is a standing rule for every future FTUE/meta addition, not a one-off fix. Before shipping any
new unlockable room, UI element, or mechanic, check: has BIT already said what this is, in his voice,
through the shared narrator layout (`ui/bit-cutscene.js` / `ui/bit-card.js`, see
[docs/bit-narrator.md](bit-narrator.md))? If not, the UI element must stay hidden/gated until it has.
`docs/bit-narrator.md`'s "Current moments" and "Systems-first backlog" tables track which systems
already have an intro, which got one in PRB-162, and what's still missing. The bug-lint rule
`bit-introduces-systems-first` (`scripts/bug-lint.mjs`, see [docs/bug-lint.md](bug-lint.md)) checks the
two gates added for PRB-162 (the quest chip, the Vault cutscene) so this can't silently regress.

## 1. Nuläge (audit, ny profil, 844×390, v2.21.1)

| Steg | Skärm | Tryck | Tid (ca) |
|---|---|---|---|
| 1 | Startskärm (tema, fyrstråle, minimal PLAY) | 1 (PLAY eller var som helst) | 4 s |
| 1b | Svart fade (~3 s, inget att göra) | – | 7 s |
| 2 | Cold open med B.I.T. ("You made it out…") | 1 (ENTER THE FACILITY, kommer efter ~10 s) | 15 s |
| 3 | Bunkerhem, kort "Rebirth Core L1 · ACTIVATE" | 1 | 18 s |
| 4 | Core-popup (story, kostnad 2/2 Scrap Alloy) | 1 (BUILD) | 20 s |
| 5 | "CORE ONLINE"-terminalsekvens | 1 (ENTER THE FACILITY igen) | 26 s |
| 6 | Bunkerhem, RAID låses upp | 1 (RAID) | 28 s |
| 7 | Loadout-skärm (vapen, rustning, medkit, område, mål, BIG MAP, MISSION) | 1 (DEPLOY) | 31 s |
| 8 | Raid laddar, "Ready to raid?"-kort med kontroller | 1 (Start) | 35 s |
| 9 | Första fiende 4–6 m bort (inom räckvidd 7 m) | – | första skott ca 40 s |
| 10 | Exit öppnar först när alla noder är aktiverade; riktig extraktion först på nivå 3 | – | första extraktion ca 3–5 min |

Mätt 2026-11-01 på v2.21.1 (ENTER 15,6 s, DEPLOY 31,8 s, Start 35,3 s). Totalt 8 tryck och 8 skärmar innan första skottet, och 3 nivåer innan första extraktionen.

Friktion:
- Två "ENTER THE FACILITY" och en bygg-popup med story innan spelaren fått göra något roligt.
- Bunkerhemmet visar 6 byggnader, 5 flikar, XP och valuta direkt (mest låst brus).
- "Raid Exit" är markerad men gör inget innan Core är byggd, och RAID-fliken är låst utan förklaring.
- Loadout-skärmen visar BIG MAP BETA, MISSION, rustning och ett mål ("GOAL · FABRICATOR L1", kabel + scrap) som nybörjaren inte har kontext för.
- Raidens mål står som "NEED · Fabricator L1" plus "GATE CONTROL" och "EXIT · LOCKED": tre olika mål på en gång.
- Kontrollkortet är text att läsa i stället för något att göra.
- B.I.T. säger inget med röst i första raiden förrän något händer. Ingen rad säger "gå dit".
- Fältuppgraderingar (perk-val) och loot-popups kan avbryta första striden.
- Extraktionen, det bästa ögonblicket, ligger flera minuter bort (nivå 3).

## 2. Förslag: FTUE i 4 steg

Princip: ett steg = en handling. B.I.T. guidar med befintliga röstrader. Meta och menyer väntar till efter första extraktionen.

1. **Tryck för att börja** – splash, tema, minimal PLAY och svart fade som i v2.21.1. Ett tryck går direkt till en kort cold open (B.I.T. tänds, 2 rader, ingen knapp, auto efter ~4 s) och sedan rakt in i raiden. Core, bygg-popup och loadout hoppas över (fast standard-loadout).
2. **Skjut** – en kort scriptad första raid (1 rum, fast seed). Två grunts står synliga framför spelaren. Kontrollerna visas som pulserande ringar på sticksen, inte som ett kort. B.I.T.: `hunters-inbound` när fienderna aktiveras, `nice-shot` vid första kill (en gång).
3. **Ta loot** – en glödande låda på vägen till exit. Ingen popup, bara en räknare i väskan. B.I.T.: `scrap-detected`.
4. **Clutch-extrakt** – exit-strålen tänds direkt (`extraction-marked`). När spelaren rör sig mot den kommer en liten hunter-våg (larm, 2–3 rushers) och en kort extraktionsnedräkning. Spelaren hinner alltid i första raiden (garanterat: skada kapad så spelaren inte kan dö, fiender något långsammare). Ut i strålen → resultatskärm → B.I.T. `welcome-back` i bunkerhemmet, där Core-bygget presenteras som nästa enda steg.

Mål: första skott under 15 s efter första trycket, första extraktion under 90 s.

Regler under FTUE:
- Ett mål på skärmen åt gången (markör + kort text: "SKJUT", "TA LÅDAN", "TILL STRÅLEN").
- Inga fältuppgraderingar, ingen BIG MAP, inget MISSION-kort, ingen XP-popup i första raiden.
- Efter första raiden låses meta upp en sak i taget: Core → Fabricator → Loadout → BIG MAP.
- Kameran ändras inte. Ingen ny konst, inga ändringar i ChatGPT-ägda filer/.glb/ljus; bara befintliga modeller och ljud.

## 3. Implementation (små PR:er)

1. **FTUE-flagga och mätning** – `pr_ftue_v1` i localStorage, plus lokala tidsstämplar (första tryck, första skott, första kill, första extrakt) i debug-overlay. Inga externa tjänster.
2. **Direktväg in** – ny profil: start → kort cold open → raid med fast loadout. Hoppar Core/loadout. Returspelare oförändrat.
3. **Scriptad första raid** – fast seed/layout i levels (1 rum, 2 grunts, 1 låda, exit), inga perks, skadetak, en mål-markör åt gången.
4. **Clutch-extrakt** – tänd strålen direkt, hunter-våg vid närmande, nedräkning, garanterad lyckad extrakt. Återanvänd `hunter-wave`, `extraction-marked`, larm.
5. **Kontrollhint i stället för kort** – pulserande ringar på sticksen, försvinner efter första rörelse/skott.
6. **Stegvis meta** – efter första extrakt: bara Core-kortet syns, övriga byggnader/flikar dolda tills de blir relevanta.
7. **Layout-check och tester** – FTUE-skärmar i layout-check (844, 667, iPhone SAFE=1) och ett test för att returspelare inte påverkas.

## 4. Mått

- Tid och tryck från första tryck till första skott (mål < 15 s, ≤ 2 tryck).
- Tid till första extrakt (mål < 90 s) och andel som extraherar i första raiden (mål ~100 %).
- Andel som startar en andra raid.
- Avhopp per steg (sista FTUE-steget som nåddes, sparas lokalt och syns i debug).

## 5. Öppna frågor till Robert

1. Får första raiden vara garanterad (spelaren kan inte dö), eller vill du ha verklig risk redan där?
2. Ska cold open med B.I.T.-texten vara kvar (kortad) före första raiden, eller komma efter första extraktionen?
3. Behöver vi nya B.I.T.-röstrader (t.ex. "gå till strålen", "nu!"), eller räcker de 8 befintliga?

## 6. Beslut (Robert, 2026-11-01)

1. Första raiden har riktig risk. Dör man testar man igen; försök 2 är lättare, försök 3 går inte att förlora (assist-ramp).
2. Cold open flyttas till EFTER första extraktionen. Skjutandet ska komma direkt.
3. Befintliga B.I.T.-rader återanvänds. De flesta spelar utan ljud, så allt viktigt måste också stå som text på skärmen.

Status: v2.22.0 = PR1 + PR2 (flagga/mätning + direktväg in, cold open efter första extraktionen, retry utan bas-omväg). Kvar: fast scriptat rum + assist-ramp, clutch-extrakt, stegvis meta, layout-check för FTUE.


## v2.28.52: one path through the Vault

New players extract, wake BIT, and restore the Core directly. On the lit base BIT introduces the Fabricator and sends them for its materials. The next successful extraction offers one BUILD FABRICATOR action. Building plays the existing dark/powered pair, then the ROOM ONLINE reward. BIT introduces the Vault over the base; its powered cutscene plays only on build. Affordable goals expose a labelled BUILD button placed clear of room targets.

Quest introduction and Power Trace begin on the next base return after the Vault cutscene completes, never on its dismissal. This gives the player one base-building target at a time. No quest chip, daily quests, chain tracking or raid quest parameter is exposed before the Vault is online and narrated. Players who already received quests retain access; migration never removes buildings, materials or progress. The additive `ftuePath` flag selects this sequence and does not change SAVE_VERSION. BIT first-sight narration is deferred during the pre-wake FTUE raid without consuming its seen flags; the explosive-barrel encounter is unchanged.

Reload recovery also covers the interval between the first extraction and waking BIT: the ingested loot funds the same direct Core build even though the in-memory result summary is gone. Incomplete Core, Fabricator and Vault scenes and base briefings resume without a second payment.

Saves created before the one-path flag retain the previous flow when their original `raid_1` beat is complete, the Fabricator exists, or quest progress/introduction is recorded. Only fresh profiles and older saves still inside that original introduction adopt the new path.

## PR 3: non-blocking move/shoot help (v2.28.81)

Players unfamiliar with twin-stick controls used to get a static "Ready to raid?" card and nothing
else once the raid actually started. A small pure state machine (`nodspel/ftue-hints.js`, steps
`move` -> `aim` -> `done`) now drives a ghost-thumb glyph + short caption that fades in over the
relevant stick instead: "DRAG TO MOVE" over the move stick until the player has moved >= 3 m from
the start (real displacement, not stick wiggle), then "TAP TO FIRE. DRAG TO AIM" over the aim zone
until the first shot is fired. If there is no relevant input for 8 s (game clock, pause excluded)
the current step's hint fades back in, up to 3 times per raid, then it stops nagging. Everything is
`pointer-events:none`, inside the safe area, and never overlaps another control at 844x390, 667x375
or 932x430 -- the raid never pauses and input is never blocked (bug-lint `ftue-hints-non-blocking`).
Desktop (pointer not coarse) gets a plain keyboard-hint line instead of the ghost+stick overlay,
since the touch sticks themselves are hidden there. An optional lighter nudge, "KEEP SHOOTING", is a
plain `notice()` toast shown once if 3 shots land with zero hits.

Hints only ever run during the scripted FTUE raid or a fresh profile's first ordinary raid
(`ftueHintsEligible()`; never once a profile has completed a raid -- bug-lint `ftue-hints-ftue-only`).
Completion persists in the plain localStorage key `pr_ftue_hints_v1` (no `SAVE_VERSION` bump, same
convention as `nodspel.tutorial.seen`/`pr_ftue_v1`): a replayed FTUE after the first success only
shows a hint again after 12 s of real idle, instead of immediately.

BIT stays silent during the scripted FTUE raid -- it is only met in the bunker after extraction (see
the comment in `data/raid-ftue.js`), so the FTUE raid uses the plain captions above only, nothing
through the BIT card. A fresh profile's first *ordinary* raid has already met BIT, so that cohort
alone gets one dry line per step through the existing top-right BIT card
(`nodspel/hint-bit-lines.js`): "Left thumb walks. Right thumb shoots. It is less complicated than it
sounds." on the move hint, "Tap to auto-aim. Drag if you have opinions." on the aim hint.

The run log (`docs/run-log.md`) gains three events: `hint_shown {step}`, `hint_done {step, ms}` and
`hint_reshow {step}`.
