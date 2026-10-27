// v2.5.0 stakes PR1 (docs/design-stakes-perks-oct27.md section 4): heal budget, alarm + hunter waves, bag
// weight. No heat mechanic - waves run on a fixed clock. All tuning lives in data/raid-stakes.js.
import {RULES,randomFromSeed} from './levels.js?v=2.5.0';
import {bagItems} from './raid.js?v=2.5.0';
import '../data/raid-stakes.js?v=2.5.0';
export const STAKES = globalThis.DATA.raidStakes;

// `maxHealth` is the round's STARTING max HP: the budget is fixed once here, so a later maxHealth change
// (armor swap, perk) never shrinks or grows the raid's lifetime healing allowance.
export function createStakesState(maxHealth = 100) {
  return { healed: 0, budget: Math.round((maxHealth ?? 100) * STAKES.healBudgetFraction), budgetLowNotified: false, budgetEmptyNotified: false,
    alarmTriggered: false, waveNumber: 0, nextWaveAt: STAKES.alarmDelayMs, pendingRoom: null, hunterDirection: null };
}

// ---- heal budget: a lifetime cap shared by BIT regen, medkits, kill reward and perk heals ----
export function healBudget(round) { return round?.stakes?.budget ?? Math.round((round?.maxHealth ?? 100) * STAKES.healBudgetFraction); }
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
  if (left <= 0 && !s.budgetEmptyNotified) { s.budgetEmptyNotified = true; round.healBudgetEmpty = { at: now }; }
  else if (left <= STAKES.healLowThreshold && !s.budgetLowNotified) { s.budgetLowNotified = true; round.healBudgetLow = { at: now }; }
  return applied;
}

// ---- carried-value HUD line: pulse only on an increase, never on a decrease (drop/spend/death) ----
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
  return Math.min(STAKES.waveSizeMax, Math.ceil(waveNumber / 2)) + (STAKES.waveLevelBonus[round.level.number - 1] ?? 0);
}
// A reachable point in an already-cleared room, away from the player's current room, so hunters start out of sight.
function spawnRoom(round, excludeIndex) {
  const level = round.level, roomsState = round.perks?.rooms ?? {};
  const cleared = Object.values(roomsState).filter(r => r.level === level.number && r.state !== 'unresolved' && r.index !== excludeIndex);
  const index = cleared.length ? cleared[0].index : level.rooms.findIndex((_, i) => i !== excludeIndex);
  return level.rooms[index < 0 ? 0 : index];
}
function freeSpawnPoint(level, room, rng) {
  const solids = [...level.walls, ...level.boxes];
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = rng() * Math.PI * 2, radius = .6 + rng() * Math.max(.1, Math.min(room.w, room.d) / 2 - 1.4);
    const p = { x: room.x + Math.cos(angle) * radius, z: room.z + Math.sin(angle) * radius };
    if (!solids.some(o => Math.abs(p.x - o.x) < o.w / 2 + .6 && Math.abs(p.z - o.z) < o.d / 2 + .6)) return p;
  }
  return { x: room.x, z: room.z };
}
// Hunters are seeded 'rusher' enemies (1 HP, existing rusher speed/range/standoff): a push, not a wall.
// `swarm:true` reuses the doorway-routing + unstick-sidestep combat already built for swarm rushers.
function spawnWave(round, now, waveNumber, room) {
  const level = round.level, rng = randomFromSeed(`${round.seed}:wave:${level.number}:${waveNumber}`);
  const count = waveSize(round, waveNumber), type = RULES.enemyTypes.rusher;
  const speed = (RULES.levels[level.number - 1]?.enemySpeed ?? 1.5) * type.speedMul;
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const p = freeSpawnPoint(level, room, rng);
    const enemy = { id: `hunter-${level.number}-${waveNumber}-${i}`, kind: 'enemy', x: p.x, z: p.z, r: .48,
      health: STAKES.waveRusherHealth, speed, type: 'rusher', rangeMul: type.rangeMul, cooldownMul: type.cooldownMul,
      standoff: type.standoff, active: true, aggro: true, swarm: true, graceMs: 0, spawnedAt: now, hunter: true };
    level.enemies.push(enemy); spawned.push(enemy);
  }
  return spawned;
}
// Advances the alarm/wave clock one frame. Call only while the raid is actually running (the caller's
// existing pause/over guard already skips this, same as every other per-frame step function).
// `playerPosition`/`currentRoomIndex` (round.currentRoom, kept up to date by the caller every frame) locate
// the player without this module depending on perks.js's roomAt (would cycle back through stakes.js).
export function stepStakes(round, now, playerPosition, currentRoomIndex) {
  const s = round.stakes; if (!s || round.over) return { spawned: [] };
  const elapsed = elapsedMs(round);
  if (!s.alarmTriggered) {
    if (elapsed < STAKES.alarmDelayMs) return { spawned: [] };
    s.alarmTriggered = true; s.nextWaveAt = elapsed + STAKES.waveIntervalMs; round.alarmTriggered = { at: now };
    return { spawned: [] };
  }
  const untilWave = s.nextWaveAt - elapsed;
  if (untilWave <= STAKES.waveWarnMs && !s.pendingRoom) {
    s.pendingRoom = spawnRoom(round, currentRoomIndex);
    const dx = s.pendingRoom.x - playerPosition.x, dz = s.pendingRoom.z - playerPosition.z, len = Math.hypot(dx, dz) || 1;
    s.hunterDirection = { x: dx / len, z: dz / len };
  }
  if (elapsed < s.nextWaveAt) return { spawned: [] };
  const waveNumber = s.waveNumber + 1, room = s.pendingRoom ?? spawnRoom(round, currentRoomIndex);
  const spawned = spawnWave(round, now, waveNumber, room);
  s.waveNumber = waveNumber; s.nextWaveAt = elapsed + STAKES.waveIntervalMs; s.pendingRoom = null;
  round.waveSpawned = { at: now, waveNumber, count: spawned.length };
  return { spawned };
}
// Non-null only inside the warning window before the next wave; the HUD countdown/arrow key off this.
export function waveCountdownMs(round) {
  const s = round.stakes; if (!s?.alarmTriggered) return null;
  const left = s.nextWaveAt - elapsedMs(round);
  return left > 0 && left <= STAKES.waveWarnMs ? left : null;
}
