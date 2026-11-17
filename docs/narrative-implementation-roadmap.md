# Protocol Rebirth — Narrative Implementation Roadmap

**Plan v0.2 — 17 November 2026**  
**Status:** Scoped implementation plan based on [High-Level Lore & Narrative Bible](world-lore-high-level.md). No game changes are approved or delivered merely by merging this document.  
**Objective:** Prove that authored cinematics, mysterious world changes, and BIT's emotional presence make players want to return beyond loot/progression.

## 1. Existing production reality

The repository already has significant narrative infrastructure:

| Existing source | Current role | Our use |
| --- | --- | --- |
| [FTUE](ftue-design.md) and the current bunker cold open | First direct Bunker raid precedes BIT's greeting | **Preserve exactly**; link its completion to the new story ledger |
| [BIT narrator specification](bit-narrator.md) | System introduction, BIT cards, first death, Core and Fabricator cutscenes | **Reuse**, do not create a parallel narrator |
| ui/bit-card.js and ui/bit-card.css | One shared contextual BIT speech surface; raid cards are nonblocking | Reuse for short reactions and soft story clues |
| ui/bit-cutscene.js and ui/bit-cutscene.css | Approved fullscreen, two-image cinematic presentation with BIT bust, subtitles, safe UI sequencing and tap-to-continue | **Extend or compose this presentation**, not a duplicate fullscreen system |
| assets/production/bit-narrator/ | Approved narrator busts and expressions | Reuse assets unchanged; follow approved exception and BIT identity lock |
| app.js and save-slots.js | Base state, progression, per-profile saving and launch/return handoff | Store idempotent narrative state inside the profile |
| nodspel/game.mjs, nodspel/archipelago.js and supporting scene files | Actual playable Three.js raid world | Apply later world-state consequences without changing combat or extraction |
| docs/visual-north-star-rev06.md and docs/art-direction.md | Approved look: Nordic summer evening, readable low-poly, soft warmth | Art gates for every cinematic and environment consequence |

**Important branch reconciliation:** A prototype branch, feat/cinematic-world-events-v1, was started against older app code (2.28.28). Main has since advanced (observed at version 2.28.44), including the new BIT narration/cutscene components. **Do not merge that earlier branch verbatim.** Treat its draft document and scene ideas as research; rework the runtime against latest main and avoid maintaining two separate cinematic players. That branch has not been validated as ready-to-merge gameplay.

The currently established Core/death/Fabricator cinematic moments are **not new deliverables** under this roadmap. They remain part of the same narrative language and should continue working.

## 2. Design constraints

- **Never delay the first shot.** First experience stays direct Bunker FTUE, with real risk and retries. BIT's first meeting remains after the first successful extraction.
- New-system introductions must follow the existing rule: **BIT introduces a system before that system becomes available**, using shared components. Story mysteries are not mechanical tutorials.
- Major cinematics may leave the Operator completely, showing distant events. They **must interrupt presentation intentionally** and deliver an authored camera/sound moment; a text toast, static quest popup or slideshow labelled cinematic is not the target.
- Never take control away during active combat, danger, extraction, inventory choice or uncommitted raid-result settlement. Current safe triggers: after normal home arrival, between base interactions, and immediately before first Archipelago deployment **before committing the raid loadout**.
- Do not pause a live raid timer as a side effect or silently treat a camera cutaway as invulnerability. Any future in-raid cinematic requires a separate, explicit simulation/timer contract.
- A scene is one-time automatically per profile, optional to replay, and dismissible when the player wants. Match the existing 1-second accidental-tap guard / tap-to-continue behavior; do not introduce a short automatic timeout for base cinematics.
- Audio can enrich every scene but all story-critical information must remain understandable when muted.
- None of these events give gear, premium currency, XP or automatic extraction.
- A missed weekly story event remains available without expiry. No forced chore loop or FOMO.
- Existing BIT identity, the Operator's concealed face and Nordic summer-night art direction are non-negotiable.
- **Never name the country:** No explicit national identity, recognizable real national flag, unit or agency name, identifying map, precise address, or confirming place label in any player-facing story, dialogue, collectible, subtitle, cinematic or narrative marketing copy.
- **Approved narrative causality:** Underwater anomaly is first detected by anti-submarine hydrophones; the program grows from information reconstruction (A) into civilizational continuity and restart (C); the Incident results from a deliberately undertaken experiment known to be hazardous, with consequences the researchers did not anticipate. Resurrection of individuals (B) is not the project's official mission.

## 3. Minimum viable narrative architecture

Add a **small story director**, not a second cinematic renderer.

### Content data

Suggested source: data/narrative-events.js. Each entry defines:

- Stable ID, content revision, category (story, world, memory).
- Author-approved synopsis, exact player knowledge before/after, prerequisite and safe trigger surface.
- A shot sequence: image/camera reference, hold/transition, subtitle text, optional voice/audio cues.
- A story consequence ID when the world must change.
- Replay policy (viewed content only) and priority. No quest reward payload.

Keep dramatic lines and release conditions in data rather than scattering them across base and raid code.

### State

Use an additive object in the existing **profile save**:

- narrative.seen: event ID to first completion timestamp/revision.
- narrative.worldFlags: persistent world changes, for example listeningStationAwake.
- narrative.clues: recorded discoveries and one selected follow-up.
- narrative.pending: optional safe delayed event reference, never a stack of forced dialogs.

An additive migration must backfill old profiles which have already seen the existing BIT introduction. Skip/watched/reloaded actions must be **idempotent**. Do not share seen state across save slots or store it in a device-global key.

**Once-only policy:** Completion and skip record the same story knowledge and persistent world consequences, exactly once. Replay creates no new change. If a scene was interrupted by browser closure before acknowledgment, the event remains eligible; it must never leave gear reserved or a partially started raid.

### Playback

First investigate adding a reusable **three-shot sequence definition** to the current cutscene infrastructure, with the same visual stage, art preload, layout and blocking checks. If a separate lightweight sequencer is technically justified, it must reuse the existing fullscreen renderer and safety rules rather than implement a competing UI layer.

Story events should never simultaneously queue a BIT tutorial card, a build cutscene, the intro, or a raid result. A clear priority is recommended:

**Critical raid result / FTUE → required system introduction → first-time story cinematic → optional world event → ordinary BIT flavor.**

Use ordinary raid data and area unlock functions as source of truth. A cinematic must not grant or fake a region unlock.

### Publishing versus pacing

For the initial static GitHub Pages build, story content ships as **normal game updates**. A creative target of one meaningful beat per week means *authoring/publishing regularly*, **not forcing a five-day countdown on each player**.

- Event is eligible when its content is deployed and narrative prerequisites hold.
- The director presents at most one optional world event at a safe return moment; others remain queued, not expired.
- No account/server calendar or global shared event can be claimed for the current offline/local-save prototype.
- Content release metadata can be added later if we need season-like sequencing; it must not create a login obligation.

## 4. Implementation plan — incremental PRs

### PR N0 — Lore & scope (documentation only)

**Inputs:** This roadmap and the high-level lore bible.

**Deliverables:** Shared pillars, mystery boundaries, first six beats, dependencies, testable acceptance criteria and clear status of provisional truth.

**Done when:** Design, art and engineering agree on the unnamed setting, hydrophone discovery, A-to-C program evolution, known-risk experimental Incident, BIT and the anomaly without inventing spoiler-critical answers.

### PR N1 — Narrative event state and safe director

**Scope:** Logic only, no new art or cinematics yet.

**Tasks:** Define authored event schema and simple scheduler; profile-scoped seen/pending/world flags; once-only completion/skip/replay contract; safe entry points; return/reload behavior; debug preview controls that never mutate the main save.

**DoD:** Unit and integration tests prove no duplicate playback, cross-slot contamination, mid-raid interruption, forced catch-up or accidental inventory changes. A no-op event can be selected at a safe home moment.

**Dependency:** Latest main, current shared BIT and cutscene code. Do not cherry-pick the older cinematic renderer without review.

### PR N2 — Extend existing cinematic presentation

**Scope:** Presentation, not story progression.

**Tasks:** Support authored 2–3-shot sequences using the approved existing cutscene visual system; camera push/pan and restrained transitions; silence, subtitles, sound-mix hooks; safe-area controls; one-second tap guard and TAP TO CONTINUE; reduced-motion and replay. Keep the existing Core, first-death and Fabricator scenes unchanged.

**DoD:** Side-by-side mobile captures show 844×390, 932×430 and 667×375; subtitles remain readable; tap dismissal and reduced motion work; no competing BIT cards/popups; no broken existing scenes.

**Art:** Create a storyboard and shot list before committing final image plates. Existing landscape/splash artwork is a temporary **blocking reference only**, not an acceptable final scene for an emotional reveal.

### PR N3 — CIN-001: The Awakening integration

**Scope:** Integrate the already-existing emotional first meeting into the narrative ledger.

**Tasks:** Preserve direct first raid; on existing BIT cold-open dismissal record CIN-001; make the event replayable in a small archive without replaying FTUE/build rewards; cross-check BIT narrator priority.

**DoD:** Brand-new user: first combat occurs before BIT greeting; first successful raid triggers exactly one greeting; later sessions never repeat it automatically; archive replay is harmless; existing VO/subtitles work.

**Art:** Reuse the currently approved bunker and BIT source images. No new BIT face or extra greeting scene.

### PR N4 — CIN-002: The World Beyond

**Scope:** First **earned** Archipelago arrival cinematic.

**Shots:** (A) sheltered trees and granite; (B) camera climbs to reveal calm sea, islands and Nordic pink-violet dusk; (C) distant lighthouse flashes and BIT remembers it being dark.

**Trigger:** Before first legitimate Archipelago deployment. The user has already fulfilled the existing world unlocks. Do not fire on a debug-only area unlock unless the developer explicitly previews the event.

**Integration:** Preserve exactly one launch after the scene is dismissed, with gear reserved once and raid navigation once. Reload/skip cannot bypass normal world access or grant extra supplies.

**DoD:** Fresh and returning profile tests, a preview capture at normal mobile size, a convincing emotional panorama, and first-deploy safe timing. Playtest asks if players remember the lighthouse without an objective marker.

**Art dependency:** Commission dedicated wide landscape shots using the approved Archipelago visual target. No snow/Hoth lighting, no rectangular islands or generic high-poly rocks.

### PR N5 — CIN-003: The Listening Station

**Scope:** First cinematic event occurring without Operator present.

**Shots:** (A) deserted island; (B) dormant dish begins to rotate and birds react; (C) an empty communications room associated with the old coastal surveillance network wakes, and an unidentified voice breaks through static. Radar and hydrophones are separate sensor systems, even if networked through a common station.

**Trigger:** First appropriate quiet home moment after CIN-002 and an authored progression/content readiness rule. No real-time countdown requirement.

**Consequence:** Set a persistent listening-station-awake world flag. The playable Archipelago must expose **at least one recognizable consequence**: a distant radar/antenna state, ambient transmission, changed light or a discoverable receiver. A label on the base screen alone is insufficient for this vertical slice.

**DoD:** Scene appears once, never in combat; returning players can see it later; repeated loads preserve the remote world state; an actual next raid makes players recognize that something has changed.

**Art/audio dependencies:** Three remote-scene shots, simple dish/indicator animation or an authored visual transition, radio static and a restrained voice fragment. The voice's speaker identity must remain uncommitted.

### PR N6 — CIN-004: The Voice + first discoverable clue

**Scope:** Connect the off-screen event to the player's choices.

**Trigger:** Player investigates an existing plausible radio/communications site during a normal raid or returns with an appropriate piece of evidence. No random drop required for mandatory narrative knowledge.

**Beat:** BIT recognizes a human voice but not the source. Player learns one concrete thing (for example, that the signal is being repeated by a real installation) while the larger mystery remains.

**DoD:** One active story lead, no new quest currency, discovery and evidence readable at phone scale, no unrecoverable story loss on failed extraction, and a satisfying connection back to CIN-003.

**Narrative gate:** Do not reveal the identity of the speaker until the private World Truth establishes who it is.

### PR N7 — Story cadence, QA and content authoring pipeline

**Scope:** After the first three playable scenes are validated.

**Tasks:** Scene backlog and ownership (writing / AD / audio / engineering / QA), release-version content manifest, archive UI, deterministic story triggers, local narrative debug panel, profiling/asset preload, optional release pacing, authoring templates and CI coverage.

**DoD:** A new scene can be added by content data, shot assets and acceptance tests, without hardcoded new modal/raid logic. No weeklies, login streaks or backend dependency introduced.

**Next scene proposals:** CIN-005 Beneath the Sea and CIN-006 Someone Answers, only after the World Truth and lighthouse mechanism are coherent enough to reward investigation.

## 5. Concrete shot / asset backlog

| Event | Required asset direction | BIT | Reality check |
| --- | --- | --- | --- |
| CIN-001 | Existing dark bunker discovery and approved CRT portrait | Damaged, underplayed, emotionally present | Reuse current finished sources |
| CIN-002 | Three cinematic compositions of the actual northern summer-night Archipelago, pine/granite/coastline, distant lighthouse | Existing approved BIT or off-camera line; no generic new face | New dedicated art/3D camera pass needed |
| CIN-003 | Remote radar island, mechanical wake-up, deserted communications room | Absent; the scene stands without him | New art and at least one visible playable-world consequence |
| CIN-004 | Radio equipment/evidence plus short BIT memory reaction | Existing approved narrator bust/body | Script depends on World Truth decisions |
| CIN-005/006 | Deep sea and lighthouse behavior, coherent research infrastructure | Optional | Concept only; do not build final meaning prematurely |

**Reference:** Landscape 19.5:9, 2532×1170 composition with safe text/character placement for 844×390. Match the existing game's shipped compression/art pipeline. The Operator's face is always hidden; BIT follows the canonical v3 design and existing approved narrator-art exceptions. Use minimal amber and restrained cyan; avoid neon, holograms, kawaii reinterpretation and winter atmosphere.

Record source, frame coordinates, aspect/safe-zone notes, mobile art weight and ownership for each commissioned scene.

## 6. Content delivery model — first pilot

**Opening (milestone-driven, not weekly):** CIN-001 first BIT meeting; Core/Fabricator/first-death existing cinematic beats; CIN-002 first Archipelago arrival.

**Pilot beat A (off-screen):** CIN-003 radar installation wakes. A later raid shows its actual consequence.

**Pilot beat B (discovery):** CIN-004 The Voice follows the clue at the player's own pace.

**Later beats:** CIN-005/006 raise stakes, but require the underlying World Truth and playable lighthouse/evidence chain to be designed first.

For a team producing roughly one new major beat per week, count **one authored asset/script/event package** per delivery, not one forced event per player per calendar week. Smaller BIT character moments can appear more often, but should not become repetitive system popups. Quiet weeks are allowed.

## 7. Narrative template for every new event

Each entry is a short content brief with:

1. **Player state:** What does the player already know? Which world can they reach?
2. **Question:** What mystery or emotional need does this serve?
3. **Cinematic:** 2–3 shots, camera intention, duration/hold, script and audio.
4. **What becomes known:** At least one new answer or meaningful character change.
5. **What remains open:** A deliberate unanswered question, not a missing quest instruction.
6. **World consequence:** What visibly changes in gameplay or at home?
7. **Eligibility and replay:** Exact safe trigger, one-time state, catch-up policy.
8. **Production evidence:** Approved art references, mobile capture, test/CI results, human playtest observations.

**Rule:** No cinematic is "done" merely because a screen appeared. The world or relationship must actually feel changed.

## 8. Technical acceptance / regression matrix

| Risk | Required verification |
| --- | --- |
| FTUE regression | Direct first raid, genuine risk/retry and BIT meeting order remain unchanged |
| Double deployment | CIN-002 skip/continue/rapid taps produce one launch, one gear reservation, one raid result |
| Interrupted session | Reload before/after scene dismissal is deterministic and cannot lose or duplicate items |
| Save contamination | Separate profiles never inherit each other's narrative seen flags |
| Scene stacking | No event starts over intro, death/result, Core/Fabricator cutscene, modal, active raid or BIT card |
| Story loss | Long-absent player can encounter unseen scenes at safe opportunities without an autoplay marathon |
| Visual coherence | Mobile safe areas, correct summer-night look, full-screen authored shot quality |
| Unnamed setting | Player-facing narrative, art overlays, props, maps and captions never reveal the real nation or official identity |
| Narrative causality | Evidence remains compatible with hydrophone discovery, information reconstruction evolving to civilizational continuity, and a deliberately risky experiment with unforeseen outcomes |
| BIT identity | Use only locked face/body and approved narrator busts; no new facial geometry |
| Accessibility | Readable captions with muted audio, keyboard/touch dismissal, reduced motion |
| World consequence | After CIN-003, an ordinary later Archipelago raid exposes a visible/audible persistent state |
| Performance | No heavy cinematic assets loaded into active combat unnecessarily; verify low-end mobile budgets |
| Regression / shipping | Run targeted story tests, full npm test / Node Raid suite, npm run verify, repository QA gate and mandatory GitHub CI before merge. Verify Pages publish afterward |

Use screenshot evidence at the normal gameplay camera **and** cinematic framing. A passing unit test does not establish the emotional quality of the scene.

## 9. Playtest success criteria

In an unprompted playtest, ask after the first Archipelago visit:

- Can the player describe the lighthouse from memory without having been given a quest marker?
- Do they wonder what happened in the world, and can they name a specific question?
- Does BIT feel like a companion rather than a tutorial popup?
- Did the cinematic feel like a welcome interruption or an unwanted delay?
- After an off-screen event, did they notice an actual change in the next environment?
- Would they voluntarily return to discover more, even without a new reward?

Observe behavior as well as answers: second raid, voluntary exploration of relevant spaces, replay, and drop-off during cinematics. Do not infer retention improvement from an attractive screenshot alone.

## 10. Dependencies / owner decisions

**Ready to implement without another lore decision:** PR N1 event director and state contract; PR N2 reusable cinematic presentation; CIN-001 integration; the emotional/visual framing of CIN-002.

**Needs a concrete art review:** CIN-002 wide reveal; CIN-003 radar shots and world-state asset; any new BIT depictions.

**Needs World Truth before writing answers:** The signal's underlying origin and meaning; the mechanism, scope and unanticipated consequences of the deliberate experiment; why the lighthouse functions; the radio speaker; BIT's original instruction to wait; and Operator's history. The A-to-C purpose and known-risk decision are already settled. Keep late-game spoilers out of the public repository.

**Coordination:** Grok is already developing broader BIT presence in the bunker. This roadmap must not replace that work, duplicate its cards or overwrite its art. Integrate with shipped shared components and the BIT-narrator rules.

**Delivery workflow:** One scoped PR per implementation concern. Do not merge until mandatory CI and QA pass; capture before/after shots and verify GitHub Pages. The earlier unmerged cinematic prototype branch is **not** a shortcut around these checks.

---

**Recommended immediate next action:** Implement PR N1 against the latest shared cutscene system while story/AD creates the CIN-002/CIN-003 storyboards and world evidence aligned with the approved historic spine. Do not disclose the country or prematurely settle the experiment's hidden mechanism.
