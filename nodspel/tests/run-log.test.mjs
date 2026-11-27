import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunLog,recordEvent,recordFirst,recordAreaEntered,recordAreaCleared,recordDoorPassed,recordChoice,recordExtract,recordDeath,recordTimeout,recordLootCollected,recordPauseOpen,noteActivity,finishRunLog,saveRunLog,loadRunLogs,clearRunLogs,classifyUserAgent,buildDeviceInfo,RUN_LOG_KEY} from '../run-log.js';
import {createRound,tickRound,takeDamage,collectLoot,stepDoors} from '../round.js';
import {initDepthRound,stepDepthRaid} from '../depth-raid.js';

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

test('walking and hacking event schema preserves zone and cleared state',()=>{
 const log=createRunLog({mode:'depth'});
 recordEvent(log,'hack_start',{zone:1},10);
 recordEvent(log,'hack_done',{zone:1},4010);
 recordChoice(log,1,'deeper',4100);recordDoorPassed(log,1,'hack',4100);
 recordExtract(log,2,false,6000);
 assert.deepEqual(log.events.map(e=>e.type),['hack_start','hack_done','choice','door_passed','extract']);
 assert.equal(log.events.at(-1).cleared,false);
 assert.equal(log.events[3].how,'hack');
});

// Drive real depth transitions, then mirror game.mjs onDepthStep/finishRound event wiring.
// Storage, caps and totals tests above remain independent of the gameplay state machine.
for (const how of ['clear','hack','key']) test(`depth walk timeline via ${how}, early extract and no pause`,()=>{
 const r=createRound(`timeline-${how}`,0);initDepthRound(r,true,0);
 const log=createRunLog({mode:'depth'});recordAreaEntered(log,1,0);
 let now=100;
 if(how==='clear'){
  for(const e of r.level.enemies)if(e.depthArea===1)e.health=0;
  assert.equal(stepDepthRaid(r,now,r.level.start),'area-cleared');
  recordAreaCleared(log,1,now,now);
 }else if(how==='hack'){
  const n=r.level.depthTerminals[0];
  assert.equal(stepDepthRaid(r,now,n),'hack-start');recordEvent(log,'hack_start',{zone:1},now);
  now+=4000;assert.equal(stepDepthRaid(r,now,n),'hack-done');recordEvent(log,'hack_done',{zone:1},now);
 }else{
  const door=r.level.doors.find(d=>d.depth),box=r.level.lootBoxes.find(b=>b.key===door.key);
  assert.equal(collectLoot(r,box,now),true);assert.equal(stepDoors(r,door,now),true);
 }
 now+=100;assert.equal(stepDepthRaid(r,now,r.level.depthStarts[1]),'area-entered');
 const passed=r.depth.lastDoorPassed;assert.deepEqual(passed,{zone:1,how});
 recordChoice(log,passed.zone,'deeper',now);recordDoorPassed(log,passed.zone,passed.how,now);recordAreaEntered(log,2,now);
 now+=100;assert.equal(stepDepthRaid(r,now,r.level.exit),'extract-started');
 now+=800;assert.equal(stepDepthRaid(r,now,r.level.exit),'zone-extracted');
 recordChoice(log,2,'extract',now);recordExtract(log,2,r.depth.extractCleared,now);
 const prefix=how==='clear'?['area_cleared']:how==='hack'?['hack_start','hack_done']:[];
 assert.deepEqual(log.events.map(e=>e.type),['area_entered',...prefix,'choice','door_passed','area_entered','choice','extract']);
 assert.deepEqual(log.events.at(-1),{t:now,type:'extract',zone:2,cleared:false});
 assert.equal(log.events.some(e=>e.type==='pause_open'),false);assert.equal(r.pauseAt,null);
});

test('depth death preserves zone and cause for terminal run-log event',()=>{
 const r=createRound('timeline-death',0);initDepthRound(r,true,0);tickRound(r,0);
 takeDamage(r,10000,500);assert.equal(r.over,true);assert.equal(r.reason,'death');
 const log=createRunLog({mode:'depth'});recordDeath(log,'Sentry projectile',r.depth.zone,500);
 assert.deepEqual(log.events,[{t:500,type:'death',cause:'Sentry projectile',zone:1}]);
});
