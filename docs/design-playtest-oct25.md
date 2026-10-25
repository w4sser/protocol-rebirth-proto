# Playtest follow-ups: shop, nav/deploy merge, weapons home, raid summary (design only, v1.96.1)

Status: proposal from Robert's v1.96.1 playtest. **No code yet.** Locked direction this must respect: PvE only;
death loses carried items; no pocket lint; no new currency; BIT runs one active task at a time. Grounded in
`data/items.js`, `data/vendors.js`, `data/progression.js`, `app.js`, `nodspel/round.js`, `nodspel/raid-result.js`.

## a) Shop rework: currency vs real money

**Problem:** The shop (`SCREENS.vendor`, quartermaster) sells everything for Scrap or Data Cores today. There is
no real-money path, and "Signals" is a fake-ad stub (`A.adSignals()` / `fakeAd()`) rather than a monetization
lane. The owner wants most items on soft currency, a few on real money, but the locked direction forbids adding
a new currency — so real-money items can't just mint a new premium coin.

**Proposal:** Keep Scrap/Data Cores/Chips exactly as they are for the vendor's normal stock (weapons, armor,
materials, blueprints — nothing changes there). Add a second, separate purchase path on the **same** vendor
screen: a short list of real-money SKUs that are bought directly (IAP receipt in, item out), never routed through
a currency balance at all. This satisfies "no new currency" literally — there is no new ledger value, just a
direct item grant gated by a store purchase.

Real-money SKUs are restricted to cosmetic/convenience so nothing is pay-to-win:
- Cosmetic: BIT skins/poses, weapon skins, callsign colors — no stat effect.
- Convenience: Armory/Stash slot packs, a one-time "restore lost loadout after death" token, time-skip on an
  active expedition. All of these save time or declutter; none change raid-mechanical odds, damage, or loot
  tables.
- Explicitly excluded: anything that changes drop rates, damage, extraction odds, or raid difficulty.

**Options/trade-offs:**
- *Direct IAP grant (recommended)* — no new currency, simplest to audit against "no pay-to-win," but means two
  separate purchase UIs on one screen (soft-currency stock vs. a real-money shelf).
- *Route real money through existing Signals* — Signals already exist and are ad-earned; selling Signals for
  real money reuses the plumbing, but it blurs an ad-currency into a paid-currency and risks reading as a new
  currency in spirit even if not in name. Likely rejected for that reason.
- *Real money only for an existing soft currency top-up (buy Scrap/Data Cores)* — classic mobile pattern, but
  directly funds stat-affecting purchases (weapons, upgrades) via a side door, which conflicts with
  "convenience/cosmetic only."

**Open questions:**
- Does "no pay-to-win" also rule out *time* savings like the expedition skip, since time pressure is part of
  the loop? Owner call needed before scoping that SKU.
- Who issues/validates receipts — is there a backend yet, or is this client-only until the leaderboard worker
  (see `docs/design-retention-quests.md` §7) exists? IAP validation probably wants a server regardless.
- Does the "restore lost loadout" token conflict with "death loses carried items" as a locked rule, even if it's
  paid? Leans toward reframing it as "re-buy your last loadout at normal cost, discounted," not an item return.

**Rough scope:** Shop UI split (new real-money shelf) — S/M. Store/IAP integration + receipt handling — size
unknown until a backend/store SDK is picked; likely the largest single piece. Cosmetic asset list — depends on
count agreed with owner.

## b) Merge RAID nav and DEPLOY

**Problem:** Today `A.go('prep')` (the RAID nav button) only opens Raid Prep; the actual commit happens later
when the player taps DEPLOY inside that screen (`A.deployNodeRaid()` / the older `A.deploy()` sim path). Two taps,
two separate mental "start a raid" moments, and a returning player who taps RAID expecting to deploy instead
lands on a prep screen they have to parse again.

**Proposal:** One nav entry, one flow: RAID always opens Raid Prep (loadout review stays — gear risk is a real
decision per the opening-loop doc), but the big primary button *on that screen* becomes the only DEPLOY, and the
nav button itself never pretends to launch anything. Visually, make the nav button read "RAID" (destination) and
the in-screen button read "DEPLOY" (commit) so the two taps map to two distinct verbs instead of two things named
the same. This is a rename/consolidation of *presentation*, not new state — `A.go('prep')` and
`A.deployNodeRaid()` already do different jobs; the confusion is naming, not logic.

**Options/trade-offs:**
- *Keep two steps, fix naming/affordance (recommended)* — matches "raids last 5-8 min, loadout is a decision";
  no loss of the pre-raid risk check. Minimal change: copy/label pass, maybe a loadout-summary chip on the nav
  button itself (last-used kit) so returning players recognize it's "their" prep screen.
- *Single-tap deploy from nav with last loadout* — RAID nav directly launches with the previous kit, DEPLOY
  screen becomes an optional long-press/edit path. Faster for repeat raids, but risks deploying with a loadout
  the player forgot to check (gear risk is real — a silent re-deploy could lose gear nobody meant to risk).
- *Remove the standalone DEPLOY button, fold it into Raid Prep's confirm-and-go gesture (swipe/hold)* — trendy,
  but adds input-method complexity for a mobile-landscape target with no clear gain over a labeled button.

**Open questions:**
- Should `A.deploy()` (older in-app sim path) be retired now that `A.deployNodeRaid()` is the real flow, or does
  something still depend on the sim screen? Needs a code-level check before implementation, out of scope for
  this design doc.
- Does the nav button need a loadout-preview badge, or is that scope creep for what's really a naming fix?

**Rough scope:** XS-S — label/copy change, nav button badge (optional), no new state machine.

## c) Bring weapons home (backpack-based pickup)

**Problem:** In-raid pickup today auto-equips a found weapon straight into the gear slot (`collectLoot()` →
`equipGear()`), or offers a swap prompt if the slot is full (`round.gearOffer`). There's no intermediate "carry
it, decide later" step, and on death the game drops `round.bag` but never explicitly "secures" `round.equip` —
the currently equipped weapon is just lost with no distinct moment where the player sees that happen.

**Proposal:** A picked-up weapon goes to a small in-raid backpack slot (separate from the bag's material
counters), not straight to the equipped slot. The player swaps *from* the backpack into the active gear slot
whenever they choose, mid-raid, same as today's swap prompt but player-initiated instead of forced at pickup
time. On extraction, everything in the backpack plus whatever's equipped comes home together (extends the
existing `gearOut`/bag merge in `buildRaidResult()`). On death, the backpack and the equipped weapon are both
lost — same rule as bag loot today, just now covering gear explicitly instead of leaving it as an unstated gap.

**Options/trade-offs:**
- *Small fixed backpack (e.g. 2-3 weapon slots), explicit drop-full handling (recommended)* — mirrors the bag's
  existing capacity pattern, keeps pressure ("do I carry a 3rd gun or extract") without becoming a second
  inventory system to manage. Needs a full-backpack UI moment (swap-or-leave), distinct from today's forced
  gearOffer.
- *Unlimited backpack* — simplest mentally, but removes the only new decision this feature adds (what to carry
  vs. risk) and makes "bring weapons home" a non-choice.
- *Auto-equip stays, backpack only for the extras* — smallest change from today, but doesn't fix the actual
  complaint (forced equip mid-fight is still jarring); likely doesn't satisfy what Robert flagged.

**Open questions:**
- Does a backpack weapon take a raid-bag slot (today's material capacity) or its own separate count? Separate
  seems right so weapon pickups don't crowd out material hauls, but needs an owner call.
- What happens to the currently-equipped weapon when the backpack is full and the player picks up one more —
  forced choice popup, or does it just fail to pick up until they free a slot?
- Interaction with merge/upgrade duplicates (`docs/design-armory.md` §b): do backpack dupes merge in-raid, or
  only after they're home? Simplicity argues for "only at home."

**Rough scope:** M — new in-raid UI (backpack row + swap-from-backpack gesture), `round` state for backpack
contents, raid-result wiring to merge backpack into home stash on extract, death-loss wiring for backpack +
equipped gear, layout-check pass for the new UI element.

## d) End-of-raid summary screen with a BIT line

**Problem:** Raid result already reports `gearOut` + extracted bag contents (`buildRaidResult()`), but there's
no single "here's everything you got" moment with personality — results currently read as plain ledger output,
which undersells a good extraction and doesn't give BIT (the game's one recurring character) a voice at the
moment players most want feedback.

**Proposal:** On extraction, before returning to base, show one summary screen: a list of every item/currency
gained this raid (materials, Scrap, weapons/gear brought home, XP, quest progress if any), followed by one short
BIT line reacting to the haul — dry or mildly snarky, never cheering unconditionally. BIT's tone should read as
a square CRT smiley with deadpan commentary, consistent with its existing voice elsewhere (quest turn-ins, bond
badge), not a new character voice.

Sample lines (10, illustrative, final copy later) with the rule that picked them:
1. "Four scrap alloy. I've seen vending machines haul more." — *empty/near-empty extraction*
2. "You extracted. Nothing died. Low bar, you cleared it." — *no gear lost, no kills needed*
3. "A memory module. Hoarding those now? Fine, be mysterious." — *rare/T3+ item in the haul*
4. "You brought the gun home this time. Wonders happen." — *first extraction with weapon-in-backpack feature,
   or any raid where equipped gear survives (contrast with past deaths)*
5. "Quest complete. I'll allow a moment of pride. One moment." — *quest/chain step completed this raid*
6. "You left a leg behind. Figuratively. I checked twice." — *close call: shield/HP ended very low*
7. "That's the fourth polymer plate today. The stash is judging you." — *duplicate of a common T1 item, already
   plentiful in stash*
8. "No loot, no kills, you just... walked. Impressive, somehow." — *very short raid, minimal activity*
9. "Legendary. I'm recalibrating my expectations of you upward. Slightly." — *legendary/rare blueprint drop*
10. "Extraction secured. Try not to die next time — I have a reputation." — *generic fallback, nothing else
    triggered*

**Line-picking rules:** evaluate triggers top-to-bottom in priority order (rare/legendary drop > quest complete
> weapon-survived milestone > close call > near-empty > duplicate-glut > short-raid > generic fallback); first
match wins so BIT never says two things at once. Each line fires at most once per raid. Keep a small pool (~3-4)
per trigger so repeat raids don't always hear the identical line — rotate randomly within the matched trigger's
pool.

**Options/trade-offs:**
- *Static per-trigger pools, client-side pick (recommended)* — no backend, fits the "no new currency / no new
  system weight" spirit, easy to extend by adding lines to a pool in `data/bit-lines.js`-style table.
- *Fully random line regardless of haul* — cheapest to build, but loses the "BIT actually reacted to what I did"
  payoff, which is the point of the feature.
- *BIT line generated dynamically (templated with numbers)* — more variety, more maintenance and localization
  risk; better as a v2 if the static pool feels repetitive.

**Open questions:**
- Does this screen replace or sit before the existing extraction result popup — one merged screen, or summary
  first then today's popup? Leans toward merging into one screen to avoid an extra tap.
- Should the BIT line account for talent/branch state (e.g. Scavenger players hear loot-flavored lines more
  often)? Nice-to-have, not needed for v1.
- Final tone pass needs owner sign-off — "snarky" has a wide range and should stay likable, not mean.

**Rough scope:** S-M — new summary screen (reuses `.pop-card` popup component per the one-popup rule), a
small `data/*.js` table of BIT line pools + trigger evaluation order, wiring from `buildRaidResult()` into the
trigger checks.
