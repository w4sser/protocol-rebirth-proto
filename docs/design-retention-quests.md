# Retention design: BIT quests, deeper base, legendaries, hard variants, weekly op

Status: **proposal only, nothing built** (owner decision 2026-10-19, based on v1.67.x `origin/main`). All numbers are starting values for playtesting.
Grounded in `data/modules.js`, `data/quests.js` (v1.57 daily quests + `questFacts`), `data/items.js`, `data/retention.js`, `docs/economy-design.md`, `docs/design-encounters-toolkit.md`.

Problem: Core L2 / Storage L3 come within ~10-15 raids and then nothing pulls the player back. Goal: **always a next quest**, each area has its own reason, and one weekly social hook.

## 1. Quest system

### 1.1 UI (little text, tiles)
| Surface | Content |
|---|---|
| **Quest log** (BIT Bay, tab `quest`) | Left: area tabs (Bunker / Archipelago / Town icons) + Daily. Middle: chain list as tiles (icon, short title, progress pips). Right: selected quest: objective icons with counters, reward tiles, one TRACK toggle. Mockup: `docs/mockups/quests.html`. |
| **Tracked quest** | Max 1. Replaces the goal card when tracked (same slot, same component). Shows objective icon + `2/3`. In raid: small chip under the timer, ticks on progress; never covers HUD. |
| **Raid Prep** | Map area/level the tracked quest needs gets a cyan quest pip. |
| **Turn-in** | Automatic on extract → reward tiles in the existing result popup. No "go back to BIT" step. |
| **Next quest** | Next chain step auto-tracks if nothing else tracked. Player is never without a goal. |

### 1.2 Quest types (all from existing systems)
| Type | Objective | Engine source |
|---|---|---|
| Fetch | Extract with N of item X | `questFacts` items, raid result |
| Hunt | Kill N enemy type (grunt/sentry/rusher) in area | `questFacts` enemies |
| Solve | Beat encounter X with tool Y (e.g. turret with EMP) | encounters PR C |
| Search | Search N containers / houses (Town) | `questFacts.houses` |
| Survive | Extract from area L3 / hard variant | raid result |
| Hand-in | Deliver items from stash (sink) | stash |
| Build | Reach room level | modules |

Rules: chain quests are **permanent and ordered** (Tarkov style), 1 active step per chain, all chains visible. Dailies stay as today (`perDay: 3`, 1 free swap) and are joined by **3 weeklies** (bigger, give Contract Chips).

### 1.3 Chain 1: Bunker "Wake the Core" (opens after FTUE)
| # | Quest | Objective | Reward |
|---|---|---|---|
| B1 | Power Trace | Extract from Bunker L1 with 3 Cable | 40 Scrap, 20 XP |
| B2 | Guard Duty | Defeat the shield guard (flank or decoy) | 2 Decoy charges |
| B3 | Spare Parts | Hand in 2 Scrap Alloy + 1 Polymer Plate | 1 Contract Chip |
| B4 | Fuse Box | Extract from Bunker L2 with 2 Fuse | 60 Scrap, recipe: EMP |
| B5 | Lights Out | Disable a turret with EMP in Bunker L2 | 1 Power Cell, 1 Chip |
| B6 | Sentry Sweep | Kill 3 sentries in Bunker | 1 Circuit Board |
| B7 | Deep Relay | Extract from Bunker L3 with 1 Power Relay | 2 Chips, 30 XP |
| B8 | Swarm Protocol | Survive the swarm on L3 and extract | Unlock **Bunker Hard**, BIT cosmetic |

### 1.4 Chain 2: Archipelago "Signals at Sea" (opens with Archipelago)
| # | Quest | Objective | Reward |
|---|---|---|---|
| A1 | Landfall | Extract from Archipelago L1 | 50 Scrap |
| A2 | Patrol Route | Pass a patrol unseen (stealth) or with decoy | 1 Optical Sensor |
| A3 | Salt Damage | Extract with 2 Servo from Archipelago L2 | 1 Chip, 30 XP |
| A4 | Buoy Network | Hand in 1 Transmitter | 2 Chips |
| A5 | Ghost Signal | Extract with 1 AI Fragment | **Tidal Coil** x1 (area material) |
| A6 | Rush Hour | Kill 4 rushers in Archipelago | 2 Grenade charges |
| A7 | Lighthouse | Extract from Archipelago L3 | 2 Tidal Coil, 1 Data Core |
| A8 | Storm Front | Extract from Archipelago Hard | Recipe: **Gull Drone** (legendary blueprint), 3 Chips |

Chain 3 Town "Ghost Town" (houses, locked doors, Frost Glass) follows the same pattern; chain 4 "Rebirth" needs Core L3.

## 2. Contract Chips (new currency) and alternative sources
Contract Chip = BIT's trade token. Spent at the BIT trader on unique items and blueprints. Quests are the **easiest** source, never the only one.

| Source | Amount | Note |
|---|---|---|
| Chain quest | 1-3 | Main source |
| Weekly task (3/week) | 2 each | |
| Weekly op top 50 % / top 10 % | 2 / 5 | Social |
| Rare loot `contract_chip` | ~1 per 6 raids at L3/Hard | New loot entry, weight 0.5 |
| Recycler: Encrypted Drive | 1 Drive → 2 Chips | Gives the dead item a sink |
| Sell Prewar Relic to BIT | 1 Relic → 1 Chip (alt to 250 Scrap) | |

| Chip sink | Price |
|---|---|
| Blueprint (weapon/legendary) | 6-12 |
| Area material x1 (Tidal Coil / Frost Glass) | 4 (cap 1/week) |
| Hard-variant entry pass (skip unlock) | 5 |
| BIT cosmetics | 3-8 |

## 3. Deeper base: room L2-L3
New area materials (own icons): **Tidal Coil** (Archipelago L2+, T3), **Frost Glass** (Town L2+ houses, T3), **Core Ash** (Hard variants, T4). Each area thus has a reason.

| Room | L2 (today -> proposal) | L3 (new) | L3 gives |
|---|---|---|---|
| Rebirth Core | 120 Scrap, Relay, Circuit, Power Cell, AI Fragment (unchanged) | 240 Scrap, 2 Relay, 2 Memory, 1 Encrypted Drive **+2 Core Ash** | Hard variants for all areas, recycler cap x2 |
| Fabricator | 100 Scrap, 2 Circuit, 1 Hydraulic **+1 Tidal Coil** | 220 Scrap, 2 Hydraulic, 2 Frost Glass, 1 Rebirth Shard | Legendary crafting, tool charges +1 |
| BIT Bay | 90 Scrap, 6 Data Cores, Memory, Sensor | 200 Scrap, 10 Data Cores, 2 Tidal Coil, 1 Neural Core | 2nd tracked daily, BIT scan +1 roll |
| Storage / Vault | 120 Scrap, 3 Plate, 2 Servo, 1 Hydraulic | 240 Scrap, 2 Hydraulic, 2 Circuit, 2 Servo **+2 Frost Glass** | +1 raid bag slot, secure pocket 1 |
| Living Quarters | L1 (new cost: 2 Plate, 1 Med Gel, 40 Scrap) | L2: 150 Scrap, 1 Purification Filter, 1 Bio Sample, 1 Frost Glass | Rest bonus: +10 % XP first raid/day |
| Recycler (in Core) | follows Core level | follows Core level | Drive -> Chips, area material 3 -> 1 upgrade |

Pacing target: L2 ~3 raids each (existing target), L3 ~6-8 raids each, total ~60-80 raids to max base.

## 4. Legendary finds (6)
Drop: only Area L3 boss rooms, Hard variants, hard enemies (shield guard, swarm leader). Base rate 1 % per container at L3, 3 % Hard, guaranteed first-time from chain finales (blueprint). Max 1 equipped legendary per raid; lost on death (Tarkov risk).

| Item | Slot | Unique effect | Where |
|---|---|---|---|
| **Gull Drone** | tool | Auto-marks enemies in 8 m for 20 s, 1 charge | Archipelago Hard, A8 blueprint |
| **Frostbite Carbine** | weapon | Hits slow target 30 % for 1 s | Town L3 locked house |
| **Bunker Key Ring** | gear | Opens any locked door without card | Bunker Hard boss |
| **Shard Lantern** | gear | Shows all containers with T3+ loot on minimap | Core Ash recipe (Fabricator L3) |
| **Echo Plate** | armour | First lethal hit leaves you at 1 HP, once | Shield guard Hard (2 %) |
| **BIT Overclock Chip** | BIT | Extraction-odds and loot scan always on, +1 loot roll | Weekly op top 10 % OR 1 % swarm leader |

## 5. Hard variants
| Rule | Value |
|---|---|
| Unlock | Chain finale of that area (B8/A8/T8) or 5 Chips; needs Core L3 for all |
| Enemies | +40 % HP, +20 % damage, warnings stay (>= 1 s, max 30 % HP per hit) |
| Encounters | Always 2 per level (L3 combos from toolkit doc), plus 1 elite (shield guard with patrol) |
| Timer | -20 % |
| Loot | +1 tier shift (T1 weights halved, T3 x2), Core Ash 1-2 per run, legendary 3 % |
| Map | Coral border tile, same layout seeds as normal but remixed with `seed ^ HARD` |
| Fail-safe | No new gear losses beyond normal rules; free carbine always |

## 6. Weekly operation + leaderboard
| Step | What |
|---|---|
| 1 | Week id = ISO week (`2026-W43`), Monday 00:00 UTC. Seed = `hash(weekId + SERVER_SALT_PUBLIC_PART)` delivered by `GET /week` (also computable client side for offline play). |
| 2 | Weekly op tile on the world map: fixed area + level + 1 modifier (e.g. "no medkits", "dark"). Unlimited attempts, best counts. |
| 3 | Raid loads with the week seed; kit is a **fixed loadout** (fair, no pay-to-win). |
| 4 | On extract: score = extracted value (sum of sellValue) + time bonus. Client POSTs run summary. |
| 5 | Result popup: rank, percentile, top 3 callsigns, button **Share** -> `https://w4sser.github.io/protocol-rebirth-proto/?op=2026-W43&beat=<runId>` (Web Share API, fallback copy). |
| 6 | Link opens the weekly op with "Beat CALLSIGN: 1 840" banner. Later: ghost = stored path samples of that run (v2). |
| 7 | Week end: Chips by percentile claimed on next login (`GET /reward?week=&device=`). |

Identity: no accounts. `deviceId` = random UUID in localStorage; `callsign` = 3-12 chars [A-Z0-9_], profanity list, changeable 1/week.

## 7. Backend recommendation: **Cloudflare Workers + D1**
| Option | Free tier (verified 2026-10-19) | Verdict |
|---|---|---|
| **Cloudflare Workers + D1** | Workers 100 000 req/day, 10 ms CPU/req; D1 5 M rows read/day, 100 000 rows written/day, 5 GB; free limits hard-fail (no bill) since 2026-09-01. KV: 100 000 reads, 1 000 writes/day. | **Pick.** Huge headroom, never bills, SQL for ranking, no cold starts, native CORS in code. |
| Netlify Functions + Blobs | Free = 300 credits/month hard cap, functions 10 credits/GB-h, requests 2 credits/10 000; **projects pause** when credits run out. Blobs: last-write-wins KV, no query. | Familiar, but a viral week pauses it; leaderboard sort in KV is awkward. |
| Supabase Free | 500 MB Postgres, unlimited API requests, 5 GB egress, **pauses after 1 week inactivity**, 2 projects | Good DB, but pausing and exposing DB via anon key needs RLS care. |
| Firebase Spark | Firestore 50 000 reads / 20 000 writes per day, 1 GiB; **Cloud Functions not available on Spark** (Blaze only) | No server validation without billing -> weak anti-cheat. |

Sources: developers.cloudflare.com/workers/platform/limits/, developers.cloudflare.com/d1/platform/pricing/, developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/, cloudflare.com/plans/developer-platform-pricing/, docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/, netlify.com/pricing, supabase.com/pricing, supabase.com/docs/guides/platform/free-project-pausing, firebase.google.com/pricing, firebase.google.com/docs/firestore/quotas.

Budget check: 1 000 players x 10 runs/day = 10 000 POST + ~30 000 GET -> well under 100 000 req/day; writes ~10 000 rows/day of 100 000.

### 7.1 API sketch (Worker, ~150 lines)
```
GET  /week                      -> { week:"2026-W43", seed:123456789, area:"archipelago", level:3, mod:"dark", endsAt }
POST /run                       body { week, seed, deviceId, callsign, value, timeMs, kills, items:{id:n}, v:"1.70.0" }
                                -> { ok, runId, rank, of, best }
GET  /leaderboard?week=2026-W43&limit=50 -> [{ rank, callsign, value, timeMs, runId }]   (cached 60 s)
GET  /run/:runId                -> { callsign, value, timeMs }   (for "beat my run")
```
D1: `runs(id, week, device, callsign, value, time_ms, created)`, index `(week, value DESC)`; `best(week, device)` upsert.

### 7.2 CORS and anti-cheat (simple, no accounts)
| Check | Rule |
|---|---|
| CORS | `Access-Control-Allow-Origin: https://w4sser.github.io` only, OPTIONS handled |
| Week/seed | `week` must be current (or previous within 1 h grace); `seed` must equal server seed |
| Plausibility | `value <= sum(sellValue of items)`, items only from that area/level loot table, item count <= raid bag max (10), `timeMs` between 30 s and level timer, value <= cap per level (e.g. 2 500) |
| Rate limit | Per deviceId and per IP hash: 20 POST/hour (D1 counter or Workers rate-limit binding) |
| Callsign | Regex + small deny list; server sanitises |
| Version | Reject `v` older than min supported |
| Later | Store replay inputs for top 10 and re-sim server side (core is deterministic per seed) |
Accepted risk: a determined cheater can forge a plausible run; caps keep the board sane, owner can delete rows.

## 8. Build order (small PRs)
| PR | Content | Size |
|---|---|---|
| A | Quest data model: `data/quests.js` chains (Bunker + Archipelago), save shape, `act('quest/track')`, auto turn-in on extract, tests | M |
| B | Quest log in BIT Bay + tracked quest on goal card / raid chip (mockup), layout-check | M |
| C | Contract Chips currency + icon + BIT trader + alt sources (loot entry, Drive recycle, Relic) | S |
| D | Area materials (Tidal Coil, Frost Glass, Core Ash) in loot tables + `questFacts` regen + icons | S |
| E | Room L3 / Living Quarters L2 costs and effects in `data/modules.js` | M |
| F | Hard variants (rule table in `nodspel/levels.js`, map tile, unlock) | M |
| G | Legendaries: 2 first (Echo Plate, Gull Drone), then the rest | M |
| H | Weekly op client (offline: local seed + local best, share link) | S |
| I | Cloudflare Worker + D1 (`/week`, `/run`, `/leaderboard`), CORS, caps, rate limit; separate `server/` folder | M |
| J | Leaderboard UI + "beat my run" banner + weekly Chip reward | S |
| K (later) | Town chain + ghost runs | L |

A-C give the core loop in ~3 PRs; H works without a backend, so I/J can follow when ready.
