# Protocol Rebirth — Cinematic World Events

**Status:** Owner-approved narrative direction; first implementation slice  
**Date:** 14 November 2026  
**Scope:** First three authored beats and cinematic runtime. Not a new quest, economy, or combat system.

> An endless world to explore. A mystery waiting to be understood. And a little companion who never stopped waiting for you.

## Creative promise

A vast, beautiful, quietly living Nordic world whose mysteries are worth returning to. Cinematics may temporarily interrupt presentation to show distant locations and events the Operator never witnessed. Concrete science-fiction explanations coexist with the genuinely unexplained; memory, love, death, connection and hope remain open to players' own interpretation. No single mandatory spiritual conclusion.

Visual pillars: Swedish archipelago, granite, pines, sea mist, violet/cold-blue summer night, restrained amber light, abandoned military research, small human warmth. **Dark, but never hopeless.**

## Do not change established gameplay

- First action: the existing risky, direct Bunker FTUE raid. BIT is **first found in the bunker after the first extraction**, in the existing cold open. No BIT in the first raid; no movie before combat.
- World order: **Bunker → Archipelago → Town**, with existing earned access rules.
- No cinematic can consume gear, let a raid timer run, or expose the player to combat. Safe points: post-raid intro, before raid gear is reserved, and calm home screen.
- Preserve Secure Slot, full extraction risk, free retry, locked BIT identity and existing progression.
- No new currencies, mandatory story quests, rewards for cinematics, daily chores, or FOMO.

## Three cinematic types

| Type | Typical trigger | Target duration | Purpose |
| --- | --- | --- | --- |
| Story Cinematic | Major discovery or milestone | 20–40 seconds | Advance central mystery and relationships |
| World Event | Authored remote world change | 10–25 seconds | Show a world that exists without the Operator |
| BIT Memory | Meaningful object, place or event | 10–20 seconds | Fragmentary, potentially unreliable recollection |

**Pacing:** Aim for one significant world beat every 5–10 days for an engaged player, plus early onboarding and some quiet weeks. This is a design cadence, not an expiring weekly reward or a guarantee of a new deployed event every calendar week. Story beats remain available until seen. Never launch a catch-up cinematic marathon on return.

The static prototype uses locally authored events and local save-state pacing. Synchronized global events require a future backend/content publishing design.

## Cinematic grammar

- Fullscreen, landscape 19.5:9 (2532×1170 reference). Mobile safe areas; test 844×390, 932×430, 667×375.
- 2–3 distinct shots, authored movements/holds, edited audio and subtitles. Let wide landscape shots breathe.
- Hide gameplay HUD during playback. Never cut away during active combat, extraction choice, result, a popup or lost connectivity.
- Skip is always available and produces the same once-only story state as normal completion. Replay is available after viewing; replay produces **no** new consequences.
- Captions must work with sound muted. Respect reduced motion. Avoid autoplay audio without user interaction.
- Use approved art first; dedicated cinematic plates and 3D camera shots are a separate art pass.
- BIT's locked face geometry, #75CFCC and silhouette from docs/bit-character-spec.md remain authoritative. Do not create a generic smiley or new face proportions.

## First three events

### CIN-001 — The Awakening

**Location:** Bunker, after the first successful FTUE raid.  
**Presentation:** Existing cold open, existing approved BIT and bunker art. The damaged drone recognizes Operator, but his memory is incomplete. This is intimate and hopeful, not a lore lecture.  
**Runtime:** Reuse the current scene, do not move it to pre-combat. Mark as seen in the new narrative ledger when its existing dismissal happens. A later archive replay may present this same story with the approved source art.

### CIN-002 — The World Beyond

**Location:** First legitimately selected Archipelago deployment, before gear is committed or the raid navigation begins.  
**Shots:** (1) sheltered pine forest and granite; (2) rising, expansive sea/island vista; (3) distant lighthouse across the water.  
**BIT lines:** "That lighthouse... I remember when it went dark." / "Why is it still shining?"  
**Outcome:** Curiosity, not a mandatory objective. On skip or completion, original deployment continues exactly once, including ordinary gear costs and raid timers only after the movie.

### CIN-003 — The Listening Station

**Location:** Faraway island, Operator absent.  
**Trigger:** Eligible after CIN-002 and a minimum return interval, when the player next has a safe home moment. Never during first FTUE or raid results.  
**Shots:** (1) silent shoreline; (2) abandoned radar dish slowly rotates, birds leave; (3) dim indoor console responds to a faint unidentified voice.  
**Outcome:** Set persistent listening-station-awake world-state flag. The next visit can reveal an ambient signal/dispatch; there is no quest marker or gameplay reward. An actual 3D radar animation is a later environment task.

## Narrative event director contract

Every event definition has: stable ID, kind, prerequisites, duration, shot/caption sequence, safe presentation point, viewed state, and optional persistent world consequence.

Persist viewed and world-state flags **inside the existing profile save**, not a global localStorage key. Complete once; replay is inert. When offline or absent, authored unseen events stay eligible until a later safe moment. Reentrant clicks must not double-launch raids. Save changes are additive; prior saved profiles remain valid.

The archive is a small optional entry point on the base screen, not a second full quest log.

## Acceptance tests

1. Fresh profile still enters first raid before BIT's bunker meeting.
2. CIN-002 is gated before inventory removal and cannot double-navigate; skip and finish preserve a single launch.
3. Already watched content never autoplays after reload; save slots are independent.
4. CIN-003 never interrupts active raid, current result/intro, or an open overlay.
5. Cinematic subtitles, SKIP and replay are usable on 844×390, 932×430, 667×375; reduced motion disables moves.
6. Story state updates exactly once; replay cannot change inventory or unlocks.
7. No expiry, no forced login, no extra currencies and no compulsory story objective.
8. Clearly distinguish prototype art and radar-signal hints from a finished 3D world animation.

## Future narrative

The lighthouse, forgotten research sites, ocean-floor signal network, the disappearance of people, and BIT's broken memories must eventually intersect. Explain experiment and consequences without requiring one literal explanation of the underlying existential phenomenon.

**Not locked:** name of the existential theme, final world truth, research-organization name, or exact calendar release schedule.
