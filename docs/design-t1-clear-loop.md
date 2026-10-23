# T1 · Tydlig loop (PRB-89)

Status: **godkänt av Robert 2026-10-23** — mildare energi (§3). Build startar med **T1-A**.  
Branch: `design/t1-clear-loop` (design). Implementation: `feat/t1-handin-payoff` (T1-A).  
Grund: playtest 2026-10-23, `data/quests.js` (Wake the Core), `data/progression.js` (world map), `data/modules.js` (Core L2/L3), area-progression-minne (Bunker → Archipelago → Town).

## Problem (playtest)

Hand-in oklart · urgency saknas · varför fortsätta · Town-unlock oklart · vad strävar jag efter.

## Mål

Spelaren ska **alltid** veta nästa steg i loopen:

**Väck Core → skydda bunkern → öppna nästa zon.**

---

## 1. Player goal loop (UI)

| Fas | Spelarmål | UI-yta |
|---|---|---|
| **Väck Core** | Höj Rebirth Core (L1 → L2 → L3) och följ kedjan *Wake the Core* | **Tracked quest** i goal-card-sloten på basen (ersätter upgrade-goal när quest trackas, redan beslutat i retention-design). Under FTUE: goal card som idag. |
| **Skydda bunkern** | Håll bunker-energi uppe; underhålls-/reinforce-quests | Samma tracked-slot visar aktiva underhålls-/energi-quests när kedjan pausar eller energi är låg (se §3). Energi-mätare alltid synlig på basen. |
| **Öppna nästa zon** | Core-nivå + scout-extract med kartföremål | **World map**: låst zon visar *vad som saknas* (Core N / scout-item). Vid unlock: "NEW" + zoom (redan byggt). |

**Regler (mass market):**

1. Max **1** tracked quest. Nästa kedjesteg auto-trackas om inget annat är valt.
2. Tracked quest = samma komponent som goal card (ikon + `2/3` + kort titel). Inget långt textblock.
3. Raid Prep: cyan quest-pip på den area/nivå tracked quest kräver.
4. Loopen syns också som tre steg på world map (Bunker lit → Archipelago → Town), med amber glow mot *nästa* mål.

**Exempel efter FTUE:** tracked = *Power Trace* (B1). Goal-card-slot: Cable-ikon `0/3` + "Power Trace". World map: Bunker lit; Archipelago amber "Core 2 + chart".

---

## 2. Hand-in payoff copy

**Regel:** varje hand-in / quest-complete säger **vad det låser upp** (rum / zon / vapen / verktyg / hard), inte bara `+chips` / `+XP`.

### UI (hand-in-popup + result-popup)

- Rubrik: quest-titel.
- Rad 1 (stor): **UNLOCKAR:** … (1–2 konkreta saker).
- Rad 2 (mindre): chips / scrap / XP som idag.
- Om unlock saknas: **UNLOCKAR:** *Nästa steg: &lt;nästa quest-titel&gt;* så kedjan känns som progression.

### Exempel — *Wake the Core* (nuvarande kedja)

| Steg | Nuvarande reward (data) | Föreslagen payoff-copy |
|---|---|---|
| B1 Power Trace | 40 scrap, 20 XP | **UNLOCKAR:** nästa steg *Guard Duty* · Core-spår fortsatt |
| B2 Guard Duty | 2 Decoy | **UNLOCKAR:** Decoy ×2 i stash · nästa *Spare Parts* |
| B3 Spare Parts (hand-in) | 1 Chip | **UNLOCKAR:** 1 Contract Chip (BIT-shop) · nästa *Fuse Box* (Bunker L2) |
| B4 Fuse Box | 60 scrap + recipe EMP | **UNLOCKAR:** **EMP-recept** · Bunker L2-verktyg |
| B5 Lights Out | Power Cell + Chip | **UNLOCKAR:** Power Cell till Core/rum · Chip |
| B6 Sentry Sweep | Circuit Board | **UNLOCKAR:** Circuit Board (Core L2-del) |
| B7 Deep Relay | 2 Chips, 30 XP | **UNLOCKAR:** Power Relay hemma · närmare Core L3 / Town-access |
| B8 Swarm Protocol | Hard bunker + cosmetic | **UNLOCKAR:** **Bunker Hard** · BIT-look Arctic |

Hand-in B3 konkret popup-text (förslag):

> **Spare Parts**  
> **UNLOCKAR:** 1 Contract Chip — byt hos BIT  
> + kedja: *Fuse Box* (hämta Fuse från Bunker L2)

`reward.unlock` i data finns redan för B4/B8 men grantas inte fullt — T1 copy ska spegla avsedd unlock även innan grant-PR:n landar (kopiera från `unlock`-fältet + nästa steg-titel).

---

## 3. Bunker energy / urgency (ny, enkel)

Mass-market: en mätare, tydlig drain, tydlig fail, tydlig recovery. Ingen sim med tio system.

### Mätare

- Namn: **Bunker power** (svenska UI: *Bunkerström*).
- Placering: bas-HUD, bredvid/ovan scrap — tunn cyan bar 0–100.
- Start efter FTUE (Core L1): **100**.
- Visuell: full = cyan; &lt;30 = amber (varning); &lt;10 = coral pulse.

### Vad som dränerar

| Källa | Drain | Kommentar |
|---|---|---|
| Tid i bas (idle) | ~1 / **15–20 min** realtid | Mild tick — inte straffklocka |
| Offline (app stängd) | **nästan ingen** (cap ~2–3 totalt medan stängd) | Inte ett straff för att lägga undan spelet |
| Genomförd raid (oavsett utfall) | **1–2** | Lätt "övervarv", inte 3–5 |
| Rum på L2+ | +1 extra per sådan nivå vid raid-retur | Mer bas = mer att skydda |

**Beslutat (Robert):** mildare energi — siffrorna ovan ersätter den ursprungliga aggressivare tabellen.

### Vad som failar vid låg energi

| Nivå | Effekt |
|---|---|
| **&lt; 30** | Varning: BIT-rad "Strömmen dippar. Förstärk väggarna." Rum-plattor dimmas lätt. |
| **&lt; 10** | **Rum stängs av** (utom Core + 1 senast använda rum): Fabricator/BIT Bay/Storage går inte att öppna för craft/hand-in tills energi ≥ 25. RAID fortfarande möjligt. |
| **0** | Samma som &lt;10 + tracked quest tvingas till underhåll (se recovery). Ingen hardcore-wipe, ingen loot-förlust i basen. |

### Recovery (spelaren förstår på 5 sek)

1. **Förstärk väggar** — 1-tap på basen (**billigare**: scrap-only, låg kostnad; ingen del krävs i T1). +25 energi. Cooldown/kort animation.
2. **Core maintenance-quest** (kort kedja eller dailyliknande, 1 aktiv): t.ex. *Hand in 2 Cable* eller *Extract 1 Fuse* → +40 energi + liten chip/scrap. Syns som tracked när energi &lt; 30 eller spelaren trycker på mätaren.
3. Core-upgrade (L2/L3) ger engångs **+30** (faciteten andas).

**Utanför scope T1:** fiender som attackerar basen, PvE-defense-minispel.

---

## 4. Town unlock clarity (world map)

Align med befintlig area-progression (`DATA.worldMap.areas`):

| Area | Krav (redan i data) |
|---|---|
| Archipelago | Core **2** + extract **Archipelago Chart** från Bunker |
| **Town** | Core **3** + extract **Town Survey** från Archipelago |

### UI-krav (T1)

När Town är låst och spelaren öppnar world map / trycker Town:

1. **Checklista** (2 rader, ikoner):  
   - ☐/☑ Core L3  
   - ☐/☑ Town Survey (scout från Archipelago)
2. Om Core &lt; 3: CTA "Höj Core" → bas / Core-platta.  
   Om Core ≥ 3 men saknar survey: CTA "SCOUT" → Raid Prep med Archipelago förvald + quest-pip om tracked scout-steg finns.
3. Amber destination-beacon (redan) + short blurb: *"Core 3 + Town Survey från Archipelago."*
4. Vid unlock: befintlig NEW + zoom behålls.

Samma mönster för Archipelago (Core 2 + Archipelago Chart) så spelaren lär sig en gång.

---

## 5. Build slices (små PR:ar)

| PR | Innehåll | Storlek | Beroende |
|---|---|---|---|
| **T1-A** | Hand-in / quest-complete payoff-copy: `unlock`-rad i popup + datafält `payoff`/`unlocksText` för Wake the Core (B1–B8). Inga nya system. | S | — |
| **T1-B** | Goal-loop UX: tracked quest speglar fas (Core / protect / next zone) med 1-radig context under titeln; auto-track nästa. | S | A hjälper men ej hård |
| **T1-C** | World map Town/Archipelago unlock-checklista + CTA (Core N / scout item). | S | — |
| **T1-D** | Bunker energy: mätare, drain-regler, room power-down, reinforce + maintenance quest. | M | B för tracked handoff |
| **T1-E** | Polish/copy pass + layout-check 667×375; BIT one-liners för låg energi / Town scout. | S | A–D |

**Ordning:** A → C parallellt → B → D → E.  
**Inte i T1:** nya zoner, hard grants om de saknas, weekly op, Town-kedja *Ghost Town*.

---

## 6. Acceptance criteria

1. Efter FTUE ser spelaren alltid **ett** tydligt nästa mål i goal-card-sloten (tracked quest eller Core-upgrade).
2. Varje hand-in i *Wake the Core* visar **UNLOCKAR:** … (rum/zon/vapen/verktyg/nästa steg), verifierat i hand-in-popup på telefonbredd.
3. World map Town (låst) visar Core 3 + Town Survey; fel CTA går till rätt yta.
4. Energi &lt; 10 stänger av minst ett icke-Core-rum; reinforce eller maintenance-quest återställer till ≥ 25; RAID går fortfarande.
5. Inga game-code-ändringar i *denna* design-PR; implementation bara efter Robert-godkännande av detta doc.
6. CI / layout-check grön på respektive build-PR.

---

## 7. Beslut (Robert 2026-10-23)

1. **Energi-aggressivitet:** **mildare** — idle ~1/15–20 min, raid drain 1–2, rum av vid **&lt;10**, varning vid **&lt;30**. (Inte den vassare varianten.)
2. **Reinforce-kostnad:** **billigare / scrap-only** i T1 (ingen del krävs).
3. **Underhåll vs Wake the Core:** oförändrat öppet för T1-D — default: prompt ovanpå tills playtest säger annat.
4. **Payoff-språk:** UI-label **UNLOCKAR:** (svenska etikett) + engelsk body-copy som spelet i övrigt.
5. **B8 / hard unlock:** T1-A **visar** "UNLOCKAR: Bunker Hard · BIT look Arctic" även om grant redan finns / speglas från `reward.unlock`.
6. **Idle-drain offline:** **nästan ingen** offline-drain (cap ~2–3).

---

## Build-ordning efter godkännande

Starta **T1-A** (payoff-copy) först; **T1-C** parallellt ok. **T1-D (energi) senare — implementera inte ännu.** PRB-89 = In Progress.
