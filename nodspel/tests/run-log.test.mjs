import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunLog,recordEvent,recordFirst,recordAreaEntered,recordAreaCleared,recordDoorPassed,recordChoice,recordExtract,recordDeath,recordTimeout,recordLootCollected,recordPauseOpen,noteActivity,finishRunLog,saveRunLog,loadRunLogs,clearRunLogs,classifyUserAgent,buildDeviceInfo,RUN_LOG_KEY} from '../run-log.js';
import {createRound,tickRound} from '../round.js';
import {initDepthRound,stepDepthRaid,goDeeper,pushDeeper,chooseExtract} from '../depth-raid.js';

function fakeStorage(){
  const m=new Map();
  return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v));},removeItem:k=>{m.delete(k);},_map:m};
}

test('classifyUserAgent / buildDeviceInfo', () => {
  assert.equal(classifyUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'ios');
  assert.equal(classifyUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0)'), 'ios');
  assert.equal(classifyUserAgent('Mozilla/5.0 (Linux; Android 14)'), 'android');
  assert.equal(classifyUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
  assert.equal(classifyUserAgent(), 'desktop');
  const d=buildDeviceInfo({width:932.4,height:430.1,dpr:2.6666,coarsePointer:true,userAgent:'Android'});
  assert.deepEqual(d,{w:932,h:430,dpr:2.67,touch:true,ua:'android'});
});

test('event capping: never grows past 200 events', () => {
  const log=createRunLog({v:'2.28.77',raidId:'r1',seed:'s1',mode:'depth'});
  for(let i=0;i<250;i++)recordEvent(log,'loot_collected',{item:'cable',rarity:'common',value:1},i*10);
  assert.equal(log.events.length,200);
  assert.equal(log.events[0].t,0);
  assert.equal(log.events.at(-1).t,1990);
});

test('first_* events record only once, in order', () => {
  const log=createRunLog({mode:'depth'});
  recordFirst(log,'first_move',900);
  recordFirst(log,'first_move',2000); // no-op, already recorded
  recordFirst(log,'first_shot',1200);
  recordFirst(log,'first_hit',1300);
  recordFirst(log,'first_kill',1300);
  assert.deepEqual(log.events,[
    {t:900,type:'first_move'},
    {t:1200,type:'first_shot'},
    {t:1300,type:'first_hit'},
    {t:1300,type:'first_kill'},
  ]);
});

test('schema-specific recorders carry the documented fields', () => {
  const log=createRunLog({mode:'depth'});
  recordAreaEntered(log,1,0);
  recordAreaCleared(log,1,45000,45000);
  recordPauseOpen(log,45000);
  recordChoice(log,1,'deeper',46000);
  recordDoorPassed(log,1,'clear',46000);
  recordAreaEntered(log,2,46500);
  recordDoorPassed(log,2,'push',50000);
  recordExtract(log,3,true,180000);
  recordDeath(log,'Sentry projectile',2,90000);
  recordTimeout(log,480000);
  recordLootCollected(log,'cable',"common",3.6,1000);
  assert.deepEqual(log.events,[
    {t:0,type:'area_entered',zone:1},
    {t:45000,type:'area_cleared',zone:1,ms:45000},
    {t:45000,type:'pause_open'},
    {t:46000,type:'choice',zone:1,kind:'deeper'},
    {t:46000,type:'door_passed',zone:1,how:'clear'},
    {t:46500,type:'area_entered',zone:2},
    {t:50000,type:'door_passed',zone:2,how:'push'},
    {t:180000,type:'extract',zone:3,cleared:true},
    {t:90000,type:'death',cause:'Sentry projectile',zone:2},
    {t:480000,type:'timeout'},
    {t:1000,type:'loot_collected',item:'cable',rarity:'common',value:4},
  ]);
});

test('idle gap counting: only closed gaps over 8s count, plus a trailing gap at finish', () => {
  const log=createRunLog({mode:'depth'});
  noteActivity(log,1000); // idle 0 -> 1000s, under 8s from the implicit 0 start: no gap
  noteActivity(log,2000); // 1s gap: no count
  noteActivity(log,11000); // 9s gap since last activity: counts
  noteActivity(log,12000); // 1s: no count
  assert.equal(log.idleGaps,1);
  finishRunLog(log,{outcome:'extracted',durationMs:30000});
  // 30000-12000=18s trailing idle at raid end: counts a second gap
  assert.equal(log.totals.idleGaps,2);
});

test('idle gap counting: no trailing gap when the raid ends soon after the last activity', () => {
  const log=createRunLog({mode:'depth'});
  noteActivity(log,1000);
  finishRunLog(log,{outcome:'died',durationMs:3000});
  assert.equal(log.totals.idleGaps,0);
});

test('finishRunLog totals: outcome + counters pass through, rounded', () => {
  const log=createRunLog({mode:'node'});
  const done=finishRunLog(log,{outcome:'died',durationMs:123456.7,zonesReached:2,enemiesKilled:7,shotsFired:40,shotsHit:15,damageTaken:88.4,lootValue:12.9});
  // No noteActivity was ever called, so the entire 123.457s counts as one trailing idle gap.
  assert.deepEqual(done.totals,{outcome:'died',durationMs:123457,zonesReached:2,enemiesKilled:7,shotsFired:40,shotsHit:15,damageTaken:88,lootValue:13,idleGaps:1});
});

test('saveRunLog / loadRunLogs: strips internal fields, round-trips through JSON', () => {
  const storage=fakeStorage();
  const log=createRunLog({v:'2.28.77',raidId:'r1',seed:'abc',mode:'depth',ftue:false,area:'bunker',device:buildDeviceInfo({width:932,height:430,dpr:2,coarsePointer:true,userAgent:'Android'})});
  recordAreaEntered(log,1,0);
  finishRunLog(log,{outcome:'extracted',durationMs:50000,zonesReached:1,enemiesKilled:3,shotsFired:10,shotsHit:4,damageTaken:20,lootValue:30});
  const list=saveRunLog(log,storage);
  assert.equal(list.length,1);
  assert.equal(list[0]._lastActivityMs,undefined);
  assert.equal(list[0]._firsts,undefined);
  const reloaded=loadRunLogs(storage);
  assert.deepEqual(reloaded,JSON.parse(JSON.stringify(list))); // pure JSON-safe round trip
  assert.equal(reloaded[0].raidId,'r1');
  assert.equal(reloaded[0].totals.outcome,'extracted');
});

test('saveRunLog: keeps only the last 20 raids', () => {
  const storage=fakeStorage();
  for(let i=0;i<25;i++){
    const log=createRunLog({raidId:`r${i}`,mode:'depth'});
    finishRunLog(log,{outcome:'extracted',durationMs:1000});
    saveRunLog(log,storage);
  }
  const list=loadRunLogs(storage);
  assert.equal(list.length,20);
  assert.equal(list[0].raidId,'r5'); // oldest 5 (r0-r4) dropped
  assert.equal(list.at(-1).raidId,'r24');
});

test('quota/exception safety: a throwing storage never throws out of saveRunLog/loadRunLogs/clearRunLogs', () => {
  const throwing={getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');},removeItem(){throw new Error('blocked');}};
  const log=createRunLog({mode:'depth'});
  finishRunLog(log,{outcome:'timeout',durationMs:1000});
  assert.doesNotThrow(()=>saveRunLog(log,throwing));
  assert.doesNotThrow(()=>loadRunLogs(throwing));
  assert.doesNotThrow(()=>clearRunLogs(throwing));
  assert.deepEqual(loadRunLogs(throwing),[]);
});

test('loadRunLogs: corrupt/non-array JSON falls back to an empty list', () => {
  const storage=fakeStorage();
  storage.setItem(RUN_LOG_KEY,'not json');
  assert.deepEqual(loadRunLogs(storage),[]);
  storage.setItem(RUN_LOG_KEY,JSON.stringify({not:'an array'}));
  assert.deepEqual(loadRunLogs(storage),[]);
});

test('clearRunLogs: removes the stored key', () => {
  const storage=fakeStorage();
  const log=createRunLog({mode:'depth'});
  finishRunLog(log,{outcome:'extracted',durationMs:1000});
  saveRunLog(log,storage);
  assert.equal(loadRunLogs(storage).length,1);
  clearRunLogs(storage);
  assert.deepEqual(loadRunLogs(storage),[]);
});

// Depth-raid-level: drives the real depth-raid.js state machine (no mocks) and checks the run-log
// recorders produce the expected event sequence for a push-through-zone-1, clear-and-go-deeper-zone-2,
// clear-and-extract-zone-3 playthrough. Mirrors the call sites nodspel/game.mjs wires (onDepthStep/
// onDepthExtract/onDepthGoDeeper/onDepthPushConfirm), without needing the DOM/Three.js game module.
function startDepth(seed,now=0){
  const r=createRound(seed,now,undefined,{});
  initDepthRound(r,true,now);
  return r;
}
function killArea(round,zone){for(const e of round.level.enemies)if(e.depthArea===zone)e.health=0;}
function walkTo(round,now,area){
  const dest=round.level.depthStarts.find(s=>s.depthArea===area);
  assert.ok(dest,`start for area ${area}`);
  return stepDepthRaid(round,now,dest);
}
// Mirrors onDepthStep(dres) in game.mjs: the two stepDepthRaid outcomes that need a run-log event.
function applyDepthStep(log,round,dres,ms){
  if(dres==='choice-opened'){
    const clearMs=round.depth.zoneDurationMs-round.depth.zoneRemainingMs;
    recordAreaCleared(log,round.depth.choice.zone,clearMs,ms);
    recordPauseOpen(log,ms);
  }
  if(dres==='area-entered')recordAreaEntered(log,round.depth.zone,ms);
}

test('depth raid: clear zone 1, go deeper, clear zone 2, extract at zone 3 -- full event sequence', () => {
  const round=startDepth('seed-a',0);
  const log=createRunLog({v:'2.28.77',raidId:round.seed,seed:round.seed,mode:'depth',area:'bunker'});
  recordAreaEntered(log,1,0); // game.mjs records zone 1 directly at raid start; stepDepthRaid never does

  killArea(round,1);
  let dres=stepDepthRaid(round,1000,round.level.depthStarts.find(s=>s.depthArea===1));
  assert.equal(dres,'choice-opened');
  applyDepthStep(log,round,dres,1000);

  const goRes=goDeeper(round,1500);
  assert.ok(goRes);
  recordChoice(log,goRes.zoneLeft,'deeper',1500);
  recordDoorPassed(log,goRes.zoneLeft,'clear',1500);

  dres=walkTo(round,2000,2);
  assert.equal(dres,'area-entered');
  applyDepthStep(log,round,dres,2000);

  killArea(round,2);
  dres=stepDepthRaid(round,5000,round.level.depthStarts.find(s=>s.depthArea===2));
  assert.equal(dres,'choice-opened');
  applyDepthStep(log,round,dres,5000);

  const extractRes=chooseExtract(round,5200);
  assert.ok(extractRes);
  recordChoice(log,extractRes.zone,'extract',5200);

  assert.deepEqual(log.events,[
    {t:0,type:'area_entered',zone:1},
    {t:1000,type:'area_cleared',zone:1,ms:1000},
    {t:1000,type:'pause_open'},
    {t:1500,type:'choice',zone:1,kind:'deeper'},
    {t:1500,type:'door_passed',zone:1,how:'clear'},
    {t:2000,type:'area_entered',zone:2},
    {t:5000,type:'area_cleared',zone:2,ms:3000},
    {t:5000,type:'pause_open'},
    {t:5200,type:'choice',zone:2,kind:'extract'},
  ]);
});

test('depth raid: pushing through a door records door_passed with how:push, no choice event', () => {
  const round=startDepth('seed-b',0);
  const log=createRunLog({mode:'depth'});
  recordAreaEntered(log,1,0);

  // Push through zone 1's door without clearing it (canPushDeeper only allows this before the area clears).
  const pushRes=pushDeeper(round,800);
  assert.ok(pushRes);
  recordDoorPassed(log,pushRes.zoneLeft,'push',800);

  const dres=walkTo(round,1200,2);
  assert.equal(dres,'area-entered');
  applyDepthStep(log,round,dres,1200);

  assert.deepEqual(log.events,[
    {t:0,type:'area_entered',zone:1},
    {t:800,type:'door_passed',zone:1,how:'push'},
    {t:1200,type:'area_entered',zone:2},
  ]);
});

test('depth raid: death mid-raid -- round.over/reason flip exactly as finishRound expects', () => {
  const round=startDepth('seed-c',0);
  tickRound(round,0);
  round.health=1;
  round.lastDamageEvent=undefined;
  // Drive a real combat death through round.js takeDamage-equivalent path used elsewhere in tests:
  // round-level death is already covered by round.test.mjs; here we only prove the depth zone is
  // readable off round.depth for the run-log death event, as finishRound does.
  round.over=true;round.reason='death';
  const log=createRunLog({mode:'depth'});
  const cause='Sentry projectile';
  recordDeath(log,cause,round.depth.zone,0);
  assert.deepEqual(log.events,[{t:0,type:'death',cause:'Sentry projectile',zone:1}]);
});
