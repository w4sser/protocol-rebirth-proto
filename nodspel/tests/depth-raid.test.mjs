import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,tickRound,exitIsOpen,enterExit,activateNode,takeDamage} from '../round.js';
import {extractScrapBonus} from '../levels.js';
import {depthModeEnabled,createDepthState,initDepthRound,stepDepthRaid,goDeeper,DEPTH} from '../depth-raid.js';
import {POWER_PAD_BIT_LINE} from '../pad-intro.js';
import {SHELF_BIT_LINE} from '../shelf-intro.js';
import {buildRaidResult} from '../raid-result.js';
import '../../data/bit-lines.js?v=2.28.57';

// ---- 1. depth mode on/off matrix ----
test('depth mode: on for bunker non-FTUE, off for FTUE/intro/other areas/big, overridable by ?depth=', () => {
  assert.equal(depthModeEnabled({area: 'bunker'}), true);
  assert.equal(depthModeEnabled({area: 'bunker', ftue: true}), false);
  assert.equal(depthModeEnabled({area: 'bunker', intro: true}), false);
  assert.equal(depthModeEnabled({area: 'archipelago'}), false);
  assert.equal(depthModeEnabled({area: 'town'}), false);
  assert.equal(depthModeEnabled({area: 'bunker', big: true}), false);
  assert.equal(depthModeEnabled({area: 'bunker', depthParam: '0'}), false);
  assert.equal(depthModeEnabled({area: 'archipelago', depthParam: '1'}), true);
  assert.equal(depthModeEnabled({area: 'bunker', big: true, depthParam: '1'}), true);
  // ?depth=1 never wins against FTUE/intro.
  assert.equal(depthModeEnabled({area: 'bunker', ftue: true, depthParam: '1'}), false);
  assert.equal(depthModeEnabled({area: 'bunker', intro: true, depthParam: '1'}), false);
});

// ---- 2. zone timers 90/90/120; hitting 0 opens a window; no timeout-fail ----
test('zone timers run 90/90/120s; hitting 0 opens the window without timing out the raid', () => {
  assert.deepEqual(DEPTH.zoneTimerMs, [90000, 90000, 120000]);
  const r = createRound('zones', 0);
  initDepthRound(r, true, 0);
  tickRound(r, 89999);
  assert.equal(stepDepthRaid(r, 89999, {x: -999, z: -999}), null);
  assert.equal(r.depth.window, false);
  tickRound(r, 90000);
  assert.equal(stepDepthRaid(r, 90000, {x: -999, z: -999}), 'window-opened');
  assert.equal(r.depth.window, true);
  assert.equal(r.over, false);
  // Even long past the global 8-minute clock, depth mode must not time the raid out.
  tickRound(r, 9 * 60 * 1000);
  assert.equal(r.over, false);
  assert.equal(r.reason, null);
});

// ---- 3. extract closed before the window, open (walk-in + 5s cancellable) during it, closed again after GO DEEPER ----
test('extract is closed before the window and requires a 5s walk-in countdown that a departure cancels', () => {
  const r = createRound('extract-gate', 0);
  initDepthRound(r, true, 0);
  const beam = r.level.exit;
  assert.equal(exitIsOpen(r), false);
  assert.equal(stepDepthRaid(r, 1000, beam), null);
  tickRound(r, 90000);
  assert.equal(stepDepthRaid(r, 90000, beam), 'window-opened');
  assert.equal(exitIsOpen(r), true);
  assert.equal(stepDepthRaid(r, 90100, beam), 'extract-started');
  assert.equal(stepDepthRaid(r, 92000, {x: beam.x + 50, z: beam.z + 50}), 'extract-canceled');
  assert.equal(r.over, false);
  assert.equal(r.depth.extracting, null);
  assert.equal(stepDepthRaid(r, 93000, beam), 'extract-started');
  assert.equal(stepDepthRaid(r, 93000 + DEPTH.extractCountdownMs - 1, beam), null);
  assert.equal(r.over, false);
  assert.equal(stepDepthRaid(r, 93000 + DEPTH.extractCountdownMs, beam), 'zone-extracted');
  assert.equal(r.over, true); assert.equal(r.reason, 'extract'); assert.equal(r.levelsCleared, 1);
  assert.equal(buildRaidResult(r).depthBonus, undefined, 'the Z3 clear bonus never pays out on a Z1/Z2 extract');
});
test('after GO DEEPER, extract is closed until the next zone window opens', () => {
  const r = createRound('go-deeper-gate', 0);
  initDepthRound(r, true, 0);
  tickRound(r, 90000); stepDepthRaid(r, 90000, r.level.exit);
  const res = goDeeper(r, 90500, r.level.start);
  assert.ok(res);
  assert.equal(r.depth.zone, 2);
  assert.equal(r.depth.window, false);
  assert.equal(exitIsOpen(r), false);
  assert.equal(stepDepthRaid(r, 90600, r.level.exit), null);
});

// ---- 4. 15s elapses with no choice: keep the beam open, keep GO DEEPER available, never auto-advance ----
test('letting the window sit past 15s with no choice keeps the beam open and GO DEEPER available', () => {
  const r = createRound('no-choice', 0);
  initDepthRound(r, true, 0);
  tickRound(r, 90000); stepDepthRaid(r, 90000, {x: -999, z: -999});
  assert.equal(r.depth.window, true);
  const farPast = 90000 + DEPTH.windowMs + 30000;
  assert.equal(stepDepthRaid(r, farPast, {x: -999, z: -999}), null);
  assert.equal(r.depth.window, true);
  assert.equal(r.level.number, 1);
  assert.equal(r.over, false);
  const res = goDeeper(r, farPast, r.level.start);
  assert.equal(res.nextZone, 2);
});

// ---- 5. GO DEEPER advances the zone, spawns a horde, starts the next timer, closes extract ----
test('GO DEEPER advances the zone, starts its timer, closes extract and spawns a refuse horde', () => {
  const r = createRound('go-deeper', 0);
  initDepthRound(r, true, 0);
  tickRound(r, 90000); stepDepthRaid(r, 90000, r.level.exit);
  const res = goDeeper(r, 90000, r.level.start);
  assert.ok(res);
  assert.equal(r.level.number, 2);
  assert.equal(r.depth.zone, 2);
  assert.equal(r.depth.zoneDurationMs, DEPTH.zoneTimerMs[1]);
  assert.equal(r.depth.zoneDeadline, 90000 + DEPTH.zoneTimerMs[1]);
  assert.equal(r.depth.window, false);
  assert.ok(res.spawned.length >= DEPTH.refuseHordeSize[0].min && res.spawned.length <= DEPTH.refuseHordeSize[0].max);
  for (const e of res.spawned) { assert.equal(e.type, 'rusher'); assert.ok(r.level.enemies.includes(e)); }
  assert.equal(exitIsOpen(r), false);
});
test('GO DEEPER is unavailable outside an open window, on zone 3, or mid-raid-over', () => {
  const r = createRound('no-go-deeper', 0);
  initDepthRound(r, true, 0);
  assert.equal(goDeeper(r, 0, r.level.start), null);
  tickRound(r, 90000); stepDepthRaid(r, 90000, r.level.exit);
  takeDamage(r, 1000, 90100);
  assert.equal(r.over, true);
  assert.equal(goDeeper(r, 90200, r.level.start), null);
});

// ---- 6. Z3 window extract banks all loot + extractScrapBonus for 3 zones + 25 clear bonus; death still loses the bag ----
test('Z3 window extract banks all loot, the full zone ladder bonus plus the 25 Scrap clear bonus', () => {
  const r = createRound('z3-clear', 0);
  initDepthRound(r, true, 0);
  tickRound(r, 90000); stepDepthRaid(r, 90000, r.level.exit); goDeeper(r, 90000, r.level.start);
  assert.equal(r.level.number, 2);
  tickRound(r, 180000); stepDepthRaid(r, 180000, r.level.exit); goDeeper(r, 180000, r.level.start);
  assert.equal(r.level.number, 3); assert.equal(r.depth.zone, 3);
  r.bag.scrap_alloy = 2;
  tickRound(r, 300000);
  assert.equal(stepDepthRaid(r, 300000, r.level.exit), 'window-opened');
  assert.equal(stepDepthRaid(r, 300100, r.level.exit), 'extract-started');
  assert.equal(stepDepthRaid(r, 300100 + DEPTH.extractCountdownMs, r.level.exit), 'zone3-complete');
  assert.equal(r.over, true); assert.equal(r.reason, 'complete'); assert.equal(r.cleared, true);
  assert.equal(r.levelsCleared, 3);
  assert.equal(r.extracted.scrap_alloy, 2); assert.equal(r.bag.scrap_alloy, 0);
  assert.equal(r.depth.z3ClearBonus, DEPTH.z3ClearBonusScrap);
  assert.equal(extractScrapBonus(r.levelsCleared), 5 + 10 + 15);
  // app.js's ingestRaidResult adds this on top of extractScrapBonus(r.levelsCleared) -- see app.js.
  assert.equal(buildRaidResult(r).depthBonus, DEPTH.z3ClearBonusScrap);
});
test('death still loses the carried bag in depth mode', () => {
  const r = createRound('depth-death', 0);
  initDepthRound(r, true, 0);
  r.bag.scrap_alloy = 3;
  takeDamage(r, 1000, 500);
  assert.equal(r.over, true); assert.equal(r.reason, 'death');
  assert.equal(r.bag.scrap_alloy, 0); assert.equal(r.lost.scrap_alloy, 3);
});

// ---- 7. FTUE raid 1 is unaffected ----
test('FTUE raid 1 is unaffected: depth mode never attaches, and its short L1 extract still works', () => {
  assert.equal(depthModeEnabled({area: 'bunker', ftue: true, depthParam: '1'}), false);
  const r = createRound('ftue-raid', 0);
  initDepthRound(r, depthModeEnabled({area: 'bunker', ftue: true}), 0);
  assert.equal(r.depth, null);
  r.ftue = true;
  for (const node of r.level.nodes) activateNode(r, node.id, 0);
  assert.equal(exitIsOpen(r), true);
  assert.equal(enterExit(r, r.level.exit, 1), 'complete');
  assert.equal(r.cleared, true); assert.equal(r.reason, 'extract');
});

// ---- 8. BIT intro line is unique; depth state exists under its own one-time seen-flag id ----
test('the depth BIT lines are unique, never reuse an existing BIT line, and the intro has a stable seen-flag id', () => {
  const lines = [DEPTH.bitLines.intro, DEPTH.bitLines.window, DEPTH.bitLines.goDeeper];
  const known = new Set([POWER_PAD_BIT_LINE, SHELF_BIT_LINE]);
  for (const pool of Object.values(globalThis.DATA.bitSummary.pools)) for (const line of pool.lines) known.add(line);
  for (const line of lines) { assert.ok(line.length > 0); assert.ok(!known.has(line), `reused an existing BIT line: ${line}`); }
  assert.equal(new Set(lines).size, lines.length);
  assert.equal(DEPTH.bitLines.introId, 'depth_intro');
});
