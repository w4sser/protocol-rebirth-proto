import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,tickRound,exitIsOpen,enterExit,activateNode,takeDamage} from '../round.js';
import {extractScrapBonus} from '../levels.js';
import {walkMap} from '../encounters.js';
import {depthModeEnabled,initDepthRound,stepDepthRaid,goDeeper,chooseExtract,areaIsCleared,areaEnemies,generateDepthLevel,depthDoor,DEPTH} from '../depth-raid.js';
import {POWER_PAD_BIT_LINE} from '../pad-intro.js';
import {SHELF_BIT_LINE} from '../shelf-intro.js';
import {buildRaidResult} from '../raid-result.js';
import '../../data/bit-lines.js?v=2.28.59';

function startDepth(seed,now=0){
  const r=createRound(seed,now);
  initDepthRound(r,true,now);
  return r;
}
function killArea(r,zone){
  for(const e of r.level.enemies)if(e.depthArea===zone)e.health=0;
}
function walkTo(r,now,area){
  const dest=r.level.depthStarts.find(s=>s.depthArea===area);
  assert.ok(dest,`start for area ${area}`);
  return stepDepthRaid(r,now,dest);
}

test('depth mode: default off (Node Raid unchanged); opt-in via ?depth=1; FTUE/intro always off', () => {
  assert.equal(depthModeEnabled({area: 'bunker'}), false);
  assert.equal(depthModeEnabled({area: 'bunker', ftue: true}), false);
  assert.equal(depthModeEnabled({area: 'bunker', intro: true}), false);
  assert.equal(depthModeEnabled({area: 'archipelago'}), false);
  assert.equal(depthModeEnabled({area: 'town'}), false);
  assert.equal(depthModeEnabled({area: 'bunker', big: true}), false);
  assert.equal(depthModeEnabled({area: 'bunker', depthParam: '0'}), false);
  assert.equal(depthModeEnabled({area: 'bunker', depthParam: '1'}), true);
  assert.equal(depthModeEnabled({area: 'archipelago', depthParam: '1'}), true);
  assert.equal(depthModeEnabled({area: 'bunker', big: true, depthParam: '1'}), true);
  assert.equal(depthModeEnabled({area: 'bunker', ftue: true, depthParam: '1'}), false);
  assert.equal(depthModeEnabled({area: 'bunker', intro: true, depthParam: '1'}), false);
});

test('clearing the current area always opens the EXTRACT / GO DEEPER choice, even if later-area enemies are still alive', () => {
  const r=startDepth('clear-prompts',0);
  assert.equal(r.level.depth,true);
  assert.ok(areaEnemies(r,1).length>=1);
  assert.ok(areaEnemies(r,2).some(e=>e.health>0),'area 2 still has living enemies behind the door');
  assert.equal(stepDepthRaid(r,1000,r.level.start),null);
  assert.equal(r.depth.phase,'combat');
  killArea(r,1);
  assert.equal(areaIsCleared(r,1),true);
  assert.equal(stepDepthRaid(r,2000,r.level.start),'choice-opened');
  assert.equal(r.depth.phase,'choice');
  assert.equal(r.depth.choice.canGoDeeper,true);
  assert.ok(r.pauseAt!=null,'clock and combat freeze during the question');
  assert.ok(areaEnemies(r,2).some(e=>e.health>0));
});

test('an area with zero current-area enemies still prompts (no silent clear)', () => {
  const r=startDepth('zero-enemies',0);
  killArea(r,1);
  assert.equal(stepDepthRaid(r,50,r.level.start),'choice-opened');
  assert.equal(r.depth.phase,'choice');
});

test('area timers run 90/90/120s; hitting 0 in combat fails the raid and does not open extract', () => {
  assert.deepEqual(DEPTH.zoneTimerMs,[90000,90000,120000]);
  const r=startDepth('timeout-kills',0);
  tickRound(r,89999);
  assert.equal(stepDepthRaid(r,89999,{x:-999,z:-999}),null);
  assert.equal(r.over,false);
  assert.equal(exitIsOpen(r),false);
  tickRound(r,90000);
  assert.equal(stepDepthRaid(r,90000,{x:-999,z:-999}),'timeout');
  assert.equal(r.over,true);
  assert.equal(r.reason,'timeout');
  assert.equal(exitIsOpen(r),false);
});

test('the global 8-minute clock never fails a depth raid on its own', () => {
  const r=startDepth('global-clock',0);
  tickRound(r,9*60*1000);
  assert.equal(r.over,false);
  assert.equal(r.reason,null);
});

test('the area clock does not tick while the choice is open', () => {
  const r=startDepth('paused-choice',0);
  killArea(r,1);
  stepDepthRaid(r,10000,r.level.start);
  const left=r.depth.zoneRemainingMs;
  assert.equal(r.depth.phase,'choice');
  assert.equal(stepDepthRaid(r,40000,r.level.start),null);
  assert.equal(r.depth.zoneRemainingMs,left);
  assert.equal(r.over,false);
});

test('EXTRACT opens the beam after a clear; walk-in is a 5s cancellable countdown; Z1 extract pays no Z3 bonus', () => {
  const r=startDepth('extract-choice',0);
  r.bag.scrap_alloy=2;
  killArea(r,1);
  assert.equal(stepDepthRaid(r,1000,r.level.start),'choice-opened');
  assert.equal(exitIsOpen(r),false);
  const door=depthDoor(r.level,1);
  assert.equal(door.locked,true);
  assert.ok(chooseExtract(r,1100));
  assert.equal(r.depth.extractOpen,true);
  assert.equal(exitIsOpen(r),true);
  assert.equal(door.locked,true,'EXTRACT does not unlock the depth door');
  const beam=r.level.exit;
  assert.equal(stepDepthRaid(r,1200,beam),'extract-started');
  assert.equal(stepDepthRaid(r,2200,{x:beam.x+50,z:beam.z+50}),'extract-canceled');
  assert.equal(r.over,false);
  assert.equal(stepDepthRaid(r,3000,beam),'extract-started');
  assert.equal(stepDepthRaid(r,3000+DEPTH.extractCountdownMs-1,beam),null);
  assert.equal(stepDepthRaid(r,3000+DEPTH.extractCountdownMs,beam),'zone-extracted');
  assert.equal(r.over,true);assert.equal(r.reason,'extract');assert.equal(r.levelsCleared,1);
  assert.equal(buildRaidResult(r).depthBonus,undefined,'the Z3 clear bonus never pays out on a Z1 extract');
});

test('GO DEEPER unlocks the door in the same level, does not spawn a horde, and starts the next timer only on entry', () => {
  const r=startDepth('go-deeper-walk',0);
  assert.equal(goDeeper(r,0),null,'GO DEEPER is unavailable mid-combat');
  const levelRef=r.level;
  const beforeEnemies=r.level.enemies.length;
  killArea(r,1);
  stepDepthRaid(r,1000,r.level.start);
  const res=goDeeper(r,1100);
  assert.ok(res);
  assert.equal(res.nextZone,2);
  assert.equal(r.level,levelRef,'same stitched level, no generateLevel swap');
  assert.equal(r.level.enemies.length,beforeEnemies,'no refuse horde');
  assert.equal(depthDoor(r.level,1).locked,false);
  assert.equal(r.depth.phase,'travel');
  assert.equal(r.depth.zone,1);
  assert.equal(r.depth.extractOpen,false);
  assert.equal(exitIsOpen(r),false);
  assert.equal(r.depth.zoneDurationMs,DEPTH.zoneTimerMs[0]);
  assert.equal(stepDepthRaid(r,1200,r.level.start),null,'still in area 1, timer has not advanced');
  assert.equal(r.depth.zone,1);
  assert.equal(walkTo(r,1300,2),'area-entered');
  assert.equal(r.depth.zone,2);
  assert.equal(r.depth.phase,'combat');
  assert.equal(r.depth.zoneDurationMs,DEPTH.zoneTimerMs[1]);
  assert.equal(r.depth.zoneDeadline,1300+DEPTH.zoneTimerMs[1]);
  assert.equal(exitIsOpen(r),false);
});

test('after GO DEEPER, extract stays closed until the next area is cleared and EXTRACT is chosen', () => {
  const r=startDepth('locked-after-deeper',0);
  killArea(r,1);stepDepthRaid(r,1000,r.level.start);goDeeper(r,1100);walkTo(r,1200,2);
  assert.equal(exitIsOpen(r),false);
  const beam=r.level.exit;
  assert.equal(stepDepthRaid(r,1300,beam),null);
  assert.equal(r.over,false);
  killArea(r,2);
  assert.equal(stepDepthRaid(r,1400,r.level.depthStarts[1]),'choice-opened');
  chooseExtract(r,1500);
  assert.equal(exitIsOpen(r),true);
});

test('GO DEEPER is unavailable on area 3 or after the raid is over', () => {
  const r=startDepth('no-go-deeper',0);
  takeDamage(r,1000,100);
  assert.equal(r.over,true);
  assert.equal(goDeeper(r,200),null);
});

test('Area 3 clear offers extract with the 25 Scrap bonus and banks the bag plus the zone ladder', () => {
  const r=startDepth('z3-clear',0);
  r.bag.scrap_alloy=2;
  killArea(r,1);stepDepthRaid(r,1000,r.level.start);goDeeper(r,1100);walkTo(r,1200,2);
  killArea(r,2);stepDepthRaid(r,1300,r.level.depthStarts[1]);goDeeper(r,1400);walkTo(r,1500,3);
  assert.equal(r.depth.zone,3);
  killArea(r,3);
  assert.equal(stepDepthRaid(r,1600,r.level.depthStarts[2]),'choice-opened');
  assert.equal(r.depth.choice.canGoDeeper,false);
  assert.equal(goDeeper(r,1700),null);
  chooseExtract(r,1800);
  const beam=r.level.exit;
  assert.equal(stepDepthRaid(r,1900,beam),'extract-started');
  assert.equal(stepDepthRaid(r,1900+DEPTH.extractCountdownMs,beam),'zone3-complete');
  assert.equal(r.over,true);assert.equal(r.reason,'complete');assert.equal(r.cleared,true);
  assert.equal(r.levelsCleared,3);
  assert.equal(r.extracted.scrap_alloy,2);assert.equal(r.bag.scrap_alloy,0);
  assert.equal(r.depth.z3ClearBonus,DEPTH.z3ClearBonusScrap);
  assert.equal(extractScrapBonus(r.levelsCleared),5+10+15);
  assert.equal(buildRaidResult(r).depthBonus,DEPTH.z3ClearBonusScrap);
});

test('death still loses the carried bag in depth mode', () => {
  const r=startDepth('depth-death',0);
  r.bag.scrap_alloy=3;
  takeDamage(r,1000,500);
  assert.equal(r.over,true);assert.equal(r.reason,'death');
  assert.equal(r.bag.scrap_alloy,0);assert.equal(r.lost.scrap_alloy,3);
});

test('FTUE raid 1 is unaffected: depth mode never attaches, and its short L1 extract still works', () => {
  assert.equal(depthModeEnabled({area:'bunker',ftue:true,depthParam:'1'}),false);
  const r=createRound('ftue-raid',0);
  initDepthRound(r,depthModeEnabled({area:'bunker',ftue:true}),0);
  assert.equal(r.depth,null);
  r.ftue=true;
  for(const node of r.level.nodes)activateNode(r,node.id,0);
  assert.equal(exitIsOpen(r),true);
  assert.equal(enterExit(r,r.level.exit,1),'complete');
  assert.equal(r.cleared,true);assert.equal(r.reason,'extract');
});

test('the depth BIT lines are unique, never reuse an existing BIT line, and the intro has a stable seen-flag id', () => {
  const lines=[DEPTH.bitLines.intro,DEPTH.bitLines.goDeeper];
  const known=new Set([POWER_PAD_BIT_LINE,SHELF_BIT_LINE]);
  for(const pool of Object.values(globalThis.DATA.bitSummary.pools))for(const line of pool.lines)known.add(line);
  for(const line of lines){assert.ok(line.length>0);assert.ok(!known.has(line),`reused an existing BIT line: ${line}`);}
  assert.equal(new Set(lines).size,lines.length);
  assert.equal(DEPTH.bitLines.introId,'depth_choice_intro');
});

test('stitched depth layouts keep areas apart, lock two depth doors, and become walkable after each unlock', () => {
  const seeds=['probe-seed','alpha','bravo','charlie','delta','echo','foxtrot','golf'];
  const tryNear=(walk,p)=>{
    if(walk(p))return true;
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,q={x:p.x+Math.cos(a)*1.2,z:p.z+Math.sin(a)*1.2};
      if(walk(q))return true;
    }
    return false;
  };
  for(const seed of seeds){
    const L=generateDepthLevel(seed);
    const doors=(L.doors??[]).filter(d=>d.depth);
    assert.equal(doors.length,2,seed);
    for(const r of L.rooms)for(const q of L.rooms){
      if(r===q||r.depthArea>=q.depthArea)continue;
      assert.ok(Math.abs(r.x-q.x)>=(r.w+q.w)/2-0.05||Math.abs(r.z-q.z)>=(r.d+q.d)/2-0.05,`overlap ${seed}`);
    }
    let walk=walkMap(L);
    assert.equal(tryNear(walk,L.depthStarts[1]),false,seed);
    depthDoor(L,1).locked=false;walk=walkMap(L);
    assert.equal(tryNear(walk,L.depthStarts[1]),true,seed);
    assert.equal(tryNear(walk,L.depthStarts[2]),false,seed);
    depthDoor(L,2).locked=false;walk=walkMap(L);
    assert.equal(tryNear(walk,L.depthStarts[2]),true,seed);
  }
});
