import {audioEvent} from './audio.js?v=2.9.0';
// v2.7.0 stakes PR1 (docs/design-stakes-perks-oct27.md section 4): heal budget, alarm + hunter waves, bag
// weight. No heat mechanic - waves run on a fixed clock. All tuning lives in data/raid-stakes.js.
import {traceTargets} from './physics.mjs?v=2.9.0';
import {RULES,randomFromSeed} from './levels.js?v=2.9.0';
import {bagItems,bagValue,ITEM_SELL} from './raid.js?v=2.9.0';
import '../data/raid-stakes.js?v=2.9.0';
import '../data/raid-camera.js?v=2.9.0';
export const RAID_CAMERA = globalThis.DATA.raidCamera;
export const STAKES = globalThis.DATA.raidStakes;

// The budget is a fixed 60 HP, set once here regardless of the round's starting max HP, so Vitality
// progression (a higher maxHealth) never raises or lowers the raid's lifetime healing allowance.
export function createStakesState() {
  return { healed: 0, budget: STAKES.healBudgetHP, budgetLowNotified: false, budgetEmptyNotified: false,
    alarmTriggered: false, waveNumber: 0, nextWaveAt: STAKES.alarmDelayMs, pendingSpawn: null, hunterDirection: null };
}

// ---- heal budget: a lifetime cap shared by BIT regen, medkits, kill reward and perk heals ----
export function healBudget(round) { return round?.stakes?.budget ?? STAKES.healBudgetHP; }
export function healRemaining(round) { return Math.max(0, healBudget(round) - (round.stakes?.healed ?? 0)); }
// Clamps `amount` to both the remaining budget and the headroom to max HP, applies it to round.health,
// and raises a one-shot notice (round.healBudgetLow / round.healBudgetEmpty) the first time each threshold is crossed.
export function heal(round, now, amount) {
  const s = round?.stakes;
  if (!s || round.over || !Number.isFinite(amount) || amount <= 0) return 0;
  const remaining = Math.max(0, healBudget(round) - s.healed), headroom = Math.max(0, (round.maxHealth ?? 100) - round.health);
  const applied = Math.min(amount, remaining, headroom);
  if (applied > 0) {
    round.health += applied; s.healed += applied;
    if (round.telemetry) round.telemetry.healed = (round.telemetry.healed || 0) + applied;
  }
  const left = Math.max(0, healBudget(round) - s.healed);
  if (left <= 0 && !s.budgetEmptyNotified) { s.budgetEmptyNotified = true; audioEvent('heal-low'); round.healBudgetEmpty = { at: now }; }
  else if (left <= STAKES.healLowThreshold && !s.budgetLowNotified) { s.budgetLowNotified = true; audioEvent('heal-low'); round.healBudgetLow = { at: now }; }
  return applied;
}

// ---- carried-value HUD line: pulse only on an increase, never on a decrease (drop/spend/death) ----
// Bag materials plus backpack gear/weapons not yet equipped - both are lost on death, so both are at stake.
export function carriedValue(round) { return bagValue(round?.bag) + (round?.backpack ?? []).reduce((sum, id) => sum + (ITEM_SELL[id] ?? 0), 0); }
export function carryValuePulsed(previous, next) { return Number.isFinite(previous) && Number.isFinite(next) && next > previous; }

// ---- bag weight: a fuller bag is slower and louder ----
export function carriedWeight(round) {
  const capacity = round?.bagCapacity ?? RULES.loot.capacity;
  if (capacity <= 0) return 0;
  const carried = bagItems(round?.bag ?? {}).length + (round?.backpack?.length ?? 0);
  return Math.max(0, Math.min(1, carried / capacity));
}
export function speedMultiplier(round) { return 1 - carriedWeight(round) * STAKES.bagWeight.maxSpeedPenalty; }
export function detectionMultiplier(round) { return 1 + carriedWeight(round) * STAKES.bagWeight.maxDetectionBonus; }

// ---- alarm + hunter waves ----
// Elapsed raid time, not wall-clock: durationMs - remainingMs already freezes while round.pauseAt is set
// (tickRound skips updating remainingMs during a perk pick), so this reads 0 extra time across a pause.
export function elapsedMs(round) { return Math.max(0, (round.durationMs ?? 0) - (round.remainingMs ?? 0)); }
function waveSize(round, waveNumber) {
  return Math.min(STAKES.waveSizeMax, Math.ceil(waveNumber / STAKES.waveSizeDivisor)) + (STAKES.waveLevelBonus[round.level.number - 1] ?? 0);
}
// Every rectangular footprint a hunter wave could appear in: rooms, inter-room corridors/dead ends, and
// (bunker L1) the start room's closet branch - the only "elsewhere" on an otherwise single-room level.
function spawnZones(level) {
  return [...level.rooms, ...(level.corridors ?? []), ...(level.deadEnds ?? []), ...(level.closet ? [level.closet] : [])];
}
// Traverse the authored room/branch graph with locked doors acting as closed edges.
// Testing both endpoint legs also handles a player standing inside a closet doorway.
function reachableZones(level, playerPosition) {
  const zones = spawnZones(level), locked = (level.doors ?? []).filter(d => d.locked);
  const clear = (a, b) => !traceTargets(a, b, locked, []);
  const reached = new Set(zones.filter(z => inside(playerPosition, z) && clear(playerPosition, z)));
  const queue = [...reached];
  for (const zone of queue) {
    for (const next of zones) {
      if (reached.has(next)) continue;
      if (Math.abs(zone.x - next.x) > (zone.w + next.w) / 2 + 1e-6 ||
          Math.abs(zone.z - next.z) > (zone.d + next.d) / 2 + 1e-6 || !clear(zone, next)) continue;
      reached.add(next); queue.push(next);
    }
  }
  return { zones: [...reached], locked };
}
function inside(p, zone) {
  return Math.abs(p.x - zone.x) <= zone.w / 2 && Math.abs(p.z - zone.z) <= zone.d / 2;
}
// Use a conservative sphere around the rendered hunter. In-view candidates are rejected even
// behind cover: a ground-level sightline cannot prove occlusion from the elevated camera.
function outsideCamera(p, target) {
  const c = RAID_CAMERA, o = c.offset, v = STAKES.hunterCamera;
  const horizontal = Math.hypot(o.x, o.z), length = Math.hypot(horizontal, o.y);
  const dx = p.x - target.x, dy = v.centreHeight - (target.y ?? 0), dz = p.z - target.z;
  const x = (o.z * dx - o.x * dz) / horizontal;
  const y = (-o.x * o.y * dx + horizontal * horizontal * dy - o.z * o.y * dz) / (length * horizontal);
  const halfWidth = c.halfHeight * v.maxAspect * v.frustumMargin + v.radius;
  const halfHeight = c.halfHeight * v.frustumMargin + v.radius;
  return (x > halfWidth ? 1 : 0) | (x < -halfWidth ? 2 : 0) |
    (y > halfHeight ? 4 : 0) | (y < -halfHeight ? 8 : 0);
}
function hiddenFromCamera(p, player, cameraTarget) {
  const settled = { x: player.x, z: player.z + RAID_CAMERA.targetOffsetZ };
  // Require the same separating frustum plane at both follow endpoints, so the entire
  // interpolation stays outside even when the camera is still catching up with the player.
  return cameraTarget ? (outsideCamera(p, settled) & outsideCamera(p, cameraTarget)) !== 0 : outsideCamera(p, settled) !== 0;
}
// A failed search returns null. Neither a zone centre nor a too-close "best effort" is safe.
function freeSpawnPoint(level, zone, rng, playerPosition, locked, cameraTarget) {
  const solids = [...level.walls, ...level.boxes, ...locked];
  for (let attempt = 0; attempt < STAKES.spawnAttempts; attempt++) {
    const angle = rng() * Math.PI * 2;
    const radius = STAKES.spawnRadiusMin + rng() * Math.max(STAKES.spawnRadiusFloor, Math.min(zone.w, zone.d) / 2 - STAKES.spawnWallClearance);
    const p = { x: zone.x + Math.cos(angle) * radius, z: zone.z + Math.sin(angle) * radius };
    if (!inside(p, zone)) continue;
    if (solids.some(o => Math.abs(p.x - o.x) < o.w / 2 + STAKES.spawnSolidMargin && Math.abs(p.z - o.z) < o.d / 2 + STAKES.spawnSolidMargin)) continue;
    if (Math.hypot(p.x - playerPosition.x, p.z - playerPosition.z) < STAKES.hunterMinSpawnDistanceM) continue;
    if (traceTargets(zone, p, locked, [])) continue;
    if (!hiddenFromCamera(p, playerPosition, cameraTarget)) continue;
    // Keep the existing player-sightline constraint as an additional conservative filter.
    if (!traceTargets(playerPosition, p, solids, [])) continue;
    return p;
  }
  return null;
}
function huntSpawnPoint(round, playerPosition, currentRoomIndex, rng, cameraTarget) {
  const level = round.level, currentRoom = level.rooms[currentRoomIndex];
  const { zones, locked } = reachableZones(level, playerPosition);
  for (const zone of zones) {
    if (zone === currentRoom) continue;
    const point = freeSpawnPoint(level, zone, rng, playerPosition, locked, cameraTarget);
    if (point) return { zone, point };
  }
  return null;
}
// Hunters are seeded 'rusher' enemies (1 HP, existing rusher speed/range/standoff): a push, not a wall.
// `swarm:true` reuses the doorway-routing + unstick-sidestep combat already built for swarm rushers.
// Every hunter's own point is measured against the player again here (not just the zone picked for the
// wave), so a wide zone can't let one straggler land closer than the minimum.
function spawnWave(round, now, waveNumber, zone, rng, playerPosition, cameraTarget) {
  const level = round.level, type = RULES.enemyTypes.rusher;
  const count = waveSize(round, waveNumber);
  const speed = (RULES.levels[level.number - 1]?.enemySpeed ?? 1.5) * type.speedMul;
  const spawned = [], locked = (level.doors ?? []).filter(d => d.locked);
  for (let i = 0; i < count; i++) {
    const p = freeSpawnPoint(level, zone, rng, playerPosition, locked, cameraTarget);
    if (!p) return [];
    const enemy = { id: `hunter-${level.number}-${waveNumber}-${i}`, kind: 'enemy', x: p.x, z: p.z, r: .48,
      health: STAKES.waveRusherHealth, speed, type: 'rusher', rangeMul: type.rangeMul, cooldownMul: type.cooldownMul,
      standoff: type.standoff, active: true, aggro: true, swarm: true, graceMs: 0, spawnedAt: now, hunter: true };
    spawned.push(enemy);
  }
  level.enemies.push(...spawned);
  return spawned;
}
// Advances the alarm/wave clock one frame. Call only while the raid is actually running (the caller's
// existing pause/over guard already skips this, same as every other per-frame step function).
// `playerPosition`/`currentRoomIndex` (round.currentRoom, kept up to date by the caller every frame) locate
// the player without this module depending on perks.js's roomAt (would cycle back through stakes.js).
export function stepStakes(round, now, playerPosition, currentRoomIndex, cameraTarget = null) {
  const s = round.stakes; if (!s || round.over) return { spawned: [] };
  const elapsed = elapsedMs(round);
  if (!s.alarmTriggered) {
    if (elapsed < STAKES.alarmDelayMs) return { spawned: [] };
    audioEvent('alarm');
    s.alarmTriggered = true; s.nextWaveAt = elapsed + STAKES.waveIntervalMs; round.alarmTriggered = { at: now };
    return { spawned: [] };
  }
  const untilWave = s.nextWaveAt - elapsed;
  if (untilWave <= STAKES.waveWarnMs && !s.pendingSpawn) {
    s.pendingSpawn = huntSpawnPoint(round, playerPosition, currentRoomIndex, randomFromSeed(`${round.seed}:wave:${round.level.number}:${s.waveNumber + 1}:aim`), cameraTarget);
  }
  // Direction is recomputed every frame from the player's current position (not just once, when the
  // countdown opened), so walking past or around the target keeps the arrow pointing the right way.
  s.hunterDirection = null;
  if (s.pendingSpawn) {
    const dx = s.pendingSpawn.point.x - playerPosition.x, dz = s.pendingSpawn.point.z - playerPosition.z, len = Math.hypot(dx, dz) || 1;
    s.hunterDirection = { x: dx / len, z: dz / len };
  }
  if (elapsed < s.nextWaveAt) return { spawned: [] };
  const waveNumber = s.waveNumber + 1, rng = randomFromSeed(`${round.seed}:wave:${round.level.number}:${waveNumber}`);
  // Re-picked from the player's position right now: the countdown's zone goes stale if they walked toward
  // it, so it is never reused blindly at the moment hunters actually spawn.
  const spawn = huntSpawnPoint(round, playerPosition, currentRoomIndex, rng, cameraTarget);
  const spawned = spawn ? spawnWave(round, now, waveNumber, spawn.zone, rng, playerPosition, cameraTarget) : [];
  if (!spawned.length) {
    s.nextWaveAt = elapsed + STAKES.waveRetryMs;
    s.pendingSpawn = null; s.hunterDirection = null;
    return { spawned: [] };
  }
  s.waveNumber = waveNumber; s.nextWaveAt = elapsed + STAKES.waveIntervalMs; s.pendingSpawn = null;
  audioEvent('hunter-wave');
  round.waveSpawned = { at: now, waveNumber, count: spawned.length };
  return { spawned };
}
// Non-null only inside the warning window before the next wave; the HUD countdown/arrow key off this.
export function waveCountdownMs(round) {
  const s = round.stakes; if (!s?.alarmTriggered) return null;
  const left = s.nextWaveAt - elapsedMs(round);
  return left > 0 && left <= STAKES.waveWarnMs ? left : null;
}

// ---- hunter-wave edge arrow ----
const INV_ROOT2 = 1 / Math.sqrt(2);
// World-space hunter direction -> a point on the viewport border (inset by `margin`), in the direction the
// isometric camera renders that world vector, plus the arrow's rotation in degrees. Scales the ray from the
// screen centre until it first crosses the inset rectangle, so the arrow sits right at the edge instead of
// on a small fixed-radius circle (which leaves a large gap on wide/short viewports).
export function hunterArrowScreenPoint(dir, viewWidth, viewHeight, margin = 20) {
  const sx = (dir.x - dir.z) * INV_ROOT2, sy = (dir.x + dir.z) * INV_ROOT2, len = Math.hypot(sx, sy) || 1;
  const nx = sx / len, ny = sy / len;
  const cx = viewWidth / 2, cy = viewHeight / 2, halfW = Math.max(1, cx - margin), halfH = Math.max(1, cy - margin);
  const scale = Math.min(nx ? halfW / Math.abs(nx) : Infinity, ny ? halfH / Math.abs(ny) : Infinity);
  return { x: cx + nx * scale, y: cy + ny * scale, angleDeg: Math.atan2(ny, nx) * 180 / Math.PI };
}
