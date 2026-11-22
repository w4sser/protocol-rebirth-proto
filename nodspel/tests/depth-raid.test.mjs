import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,tickRound,exitIsOpen,enterExit,activateNode,takeDamage,collectLoot} from '../round.js';
import {extractScrapBonus,generateLevel,RULES} from '../levels.js';
import {walkMap} from '../encounters.js';
import {depthModeEnabled,initDepthRound,stepDepthRaid,goDeeper,chooseExtract,areaIsCleared,areaEnemies,generateDepthLevel,depthDoor,inDepthExtract,extractRadiusOf,canPushDeeper,pushDeeper,nearDepthDoor,combatRoomsWithCover,depthConnectorPaths,DEPTH_CLEAR_WIDTH,LINK_WIDTH,DEPTH} from '../depth-raid.js';
import {POWER_PAD_BIT_LINE} from '../pad-intro.js';
import {SHELF_BIT_LINE} from '../shelf-intro.js';
import {buildRaidResult} from '../raid-result.js';
import '../../data/bit-lines.js?v=2.28.65';

function startDepth(seed,now=0,ctx={}){
  const r=createRound(seed,now,undefined,{completedRaids:ctx.completedRaids??0});
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

test('EXTRACT opens the beam after a clear; walking onto the lit pad extracts immediately; Z1 extract pays no Z3 bonus', () => {
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
  assert.equal(extractRadiusOf(r),DEPTH.extractRadius);
  assert.equal(beam.r,DEPTH.extractRadius);
  // 1.2 m is on the glowing pad / inside the fence, but was outside the old r=1 trigger.
  const onPad={x:beam.x+1.2,z:beam.z};
  assert.equal(inDepthExtract(r,onPad),true);
  assert.equal(inDepthExtract(r,{x:beam.x+1.6,z:beam.z}),false);
  assert.equal(stepDepthRaid(r,1200,onPad),'zone-extracted');
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
  assert.equal(stepDepthRaid(r,1900,beam),'zone3-complete');
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
  const lines=[DEPTH.bitLines.intro,DEPTH.bitLines.goDeeper,DEPTH.bitLines.extract,DEPTH.bitLines.extractFinal,DEPTH.bitLines.finalArea,DEPTH.bitLines.push];
  const known=new Set([POWER_PAD_BIT_LINE,SHELF_BIT_LINE]);
  for(const pool of Object.values(globalThis.DATA.bitSummary.pools))for(const line of pool.lines)known.add(line);
  for(const line of lines){assert.ok(line.length>0);assert.ok(!known.has(line),`reused an existing BIT line: ${line}`);}
  assert.equal(new Set(lines).size,lines.length);
  assert.equal(DEPTH.bitLines.introId,'depth_choice_intro');
  assert.equal(DEPTH.bitLines.pushId,'depth_push_intro');
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

function assertLinkedIds(level,label){
  for(const j of level.junctions??[]){
    assert.ok((level.hazards??[]).some(h=>h.id===j.padId),`${label}: junction ${j.id} padId ${j.padId} has no hazard`);
    if(j.patrolId)assert.ok((level.enemies??[]).some(e=>e.id===j.patrolId),`${label}: junction patrolId ${j.patrolId} has no enemy`);
  }
  for(const h of level.hazards??[]){
    if(h.junctionId)assert.ok((level.junctions??[]).some(j=>j.id===h.junctionId),`${label}: hazard junctionId ${h.junctionId} has no junction`);
  }
  for(const s of level.shelves??[]){
    if(s.guardId)assert.ok((level.enemies??[]).some(e=>e.id===s.guardId),`${label}: shelf guardId ${s.guardId} has no enemy`);
  }
  for(const e of level.encounters??[]){
    if(e.enemyId)assert.ok((level.enemies??[]).some(en=>en.id===e.enemyId),`${label}: encounter enemyId ${e.enemyId} has no enemy`);
  }
}

test('retag prefixes pad, junction, patrol, guard and enemy refs so a progressed Depth Raid can build the world', () => {
  const seeds=['repro-depth','probe-seed','alpha','bravo','charlie','delta','echo','foxtrot','golf','seed0','seed7','seed19'];
  let pads=0,shelves=0;
  for(const seed of seeds)for(const raids of [0,2,3,5,8]){
    const L=generateDepthLevel(seed,{completedRaids:raids});
    assertLinkedIds(L,`${seed} raids=${raids}`);
    if((L.junctions??[]).length)pads++;
    if((L.shelves??[]).length)shelves++;
  }
  assert.ok(pads>0,'expected at least one power pad once completedRaids unlocks them');
  assert.ok(shelves>0,'expected at least one shelf once completedRaids unlocks them');
});

test('progressed Depth Raid (5 completed raids) walks A1 through A3 and extracts at the area-3 hatch', () => {
  const r=startDepth('progressed-final',0,{completedRaids:5});
  assert.ok((r.level.junctions??[]).length>=1,'pads present on a progressed save');
  assert.equal((r.level.extracts??[]).length,3);
  for(let i=0;i<3;i++){
    assert.equal(r.level.extracts[i].x,r.level.depthExits[i].x);
    assert.equal(r.level.extracts[i].z,r.level.depthExits[i].z);
    assert.equal(r.level.extracts[i].depthArea,i+1);
  }
  killArea(r,1);stepDepthRaid(r,1000,r.level.start);goDeeper(r,1100);walkTo(r,1200,2);
  killArea(r,2);stepDepthRaid(r,1300,r.level.depthStarts[1]);goDeeper(r,1400);walkTo(r,1500,3);
  assert.equal(r.depth.zone,3);
  killArea(r,3);
  assert.equal(stepDepthRaid(r,1600,r.level.depthStarts[2]),'choice-opened');
  assert.equal(r.depth.choice.canGoDeeper,false);
  chooseExtract(r,1800);
  const beam=r.level.exit,a3=r.level.depthExits[2],a1=r.level.depthExits[0];
  assert.ok(Math.hypot(beam.x-a3.x,beam.z-a3.z)<1e-6,'EXTRACT in area 3 uses the area-3 hatch, not the area-1 pad');
  assert.ok(Math.hypot(beam.x-a1.x,beam.z-a1.z)>2,'the area-3 hatch is not the area-1 pad');
  const room=r.level.rooms.find(rm=>Math.abs(beam.x-rm.x)<=rm.w/2&&Math.abs(beam.z-rm.z)<=rm.d/2);
  assert.equal(room?.depthArea,3);
  assert.equal(exitIsOpen(r),true);
  assert.equal(stepDepthRaid(r,1900,beam),'zone3-complete');
  assert.equal(r.over,true);assert.equal(r.reason,'complete');assert.equal(r.cleared,true);assert.equal(r.levelsCleared,3);
});

test('Depth Raid keeps area 1 at stock difficulty and ramps HP, damage and enemy count in areas 2 and 3', () => {
  const scale=DEPTH.areaScale;
  assert.deepEqual(scale[0],{enemyCountAdd:0,healthMul:1,damageMul:1});
  assert.equal(scale[1].enemyCountAdd,2);assert.equal(scale[1].healthMul,1.25);assert.equal(scale[1].damageMul,1.15);
  assert.equal(scale[2].enemyCountAdd,3);assert.equal(scale[2].healthMul,1.5);assert.equal(scale[2].damageMul,1.3);
  const seeds=['probe-seed','alpha','bravo','charlie','delta','echo','foxtrot','golf'];
  let extras2=0,extras3=0;
  for(const seed of seeds){
    const raw=[1,2,3].map(n=>generateLevel(n,seed,'bunker',false,false));
    const L=generateDepthLevel(seed);
    const byArea=z=>L.enemies.filter(e=>e.depthArea===z);
    assert.equal(byArea(1).length,raw[0].enemies.length,seed);
    assert.equal(L.depthAreaRules[0].enemyDamage,raw[0].enemyDamage,seed);
    assert.equal(L.depthAreaRules[0].dmgMul,raw[0].dmgMul??1,seed);
    assert.equal(L.depthAreaRules[1].enemyDamage,Math.round((raw[1].enemyDamage)*scale[1].damageMul),seed);
    assert.equal(L.depthAreaRules[2].enemyDamage,Math.round((raw[2].enemyDamage)*scale[2].damageMul),seed);
    const a2=byArea(2),a3=byArea(3);
    assert.ok(a2.length>=raw[1].enemies.length,seed);
    assert.ok(a2.length<=raw[1].enemies.length+scale[1].enemyCountAdd,seed);
    assert.ok(a3.length>=raw[2].enemies.length,seed);
    assert.ok(a3.length<=raw[2].enemies.length+scale[2].enemyCountAdd,seed);
    extras2+=a2.length-raw[1].enemies.length;
    extras3+=a3.length-raw[2].enemies.length;
    const rawGen=raw[2].enemies.find(e=>e.type==='generator');
    const dGen=a3.find(e=>e.type==='generator');
    if(rawGen&&dGen)assert.equal(dGen.health,Math.max(1,Math.round(rawGen.health*scale[2].healthMul)),seed);
    const rawA2=raw[1].enemies.find(e=>e.type!=='generator'&&!e.swarm);
    const dA2=a2.find(e=>e.id?.endsWith(rawA2?.id??'__none__')||(rawA2&&e.type===rawA2.type&&Math.abs((e.health/scale[1].healthMul)-rawA2.health)<1));
    if(rawA2){
      const match=a2.find(e=>Math.max(1,Math.round(rawA2.health*scale[1].healthMul))===e.health);
      assert.ok(match,`${seed} expected an area-2 enemy with scaled HP`);
    }
  }
  assert.ok(extras2>=seeds.length,`expected extras in area 2 across seeds, got ${extras2}`);
  assert.ok(extras3>=seeds.length,`expected extras in area 3 across seeds, got ${extras3}`);
});

test('the open extract trigger covers the visible pad, fires on entry, and is not blocked by a gear crate in the beam', () => {
  assert.equal(DEPTH.extractCountdownMs,0);
  assert.equal(DEPTH.extractRadius,1.45);
  const r=startDepth('gear-on-pad',0,{completedRaids:5});
  killArea(r,1);stepDepthRaid(r,1000,r.level.start);goDeeper(r,1100);walkTo(r,1200,2);
  killArea(r,2);
  assert.equal(stepDepthRaid(r,1300,r.level.depthStarts[1]),'choice-opened');
  // Before EXTRACT is chosen the beam must not extract, even if you stand on the hatch.
  const hatch=r.level.depthExits[1];
  assert.equal(inDepthExtract(r,hatch),false);
  assert.equal(stepDepthRaid(r,1400,hatch),null);
  chooseExtract(r,1500);
  assert.equal(r.level.exit.r,DEPTH.extractRadius);
  assert.ok(Math.hypot(r.level.exit.x-hatch.x,r.level.exit.z-hatch.z)<1e-6,'area 2 extract uses the area-2 hatch');
  r.level.lootBoxes.push({id:'cloak-on-beam',x:hatch.x+.8,z:hatch.z,item:'dampener_cloak',collected:false,revealed:true,marked:false});
  collectLoot(r,{x:hatch.x+.8,z:hatch.z},1600,null);
  const onPad={x:hatch.x+1.2,z:hatch.z};
  assert.equal(inDepthExtract(r,onPad),true,'the visible pad (1.2 m from centre) must count as in the beam');
  assert.equal(stepDepthRaid(r,1700,onPad),'zone-extracted');
  assert.equal(r.over,true);assert.equal(r.reason,'extract');assert.equal(r.levelsCleared,2);
});

test('pushing through the door without a clear is GO DEEPER and forfeits extract in that area', () => {
  const r=startDepth('push-without-clear',0);
  assert.equal(areaIsCleared(r,1),false);
  assert.equal(canPushDeeper(r),true);
  assert.equal(goDeeper(r,0),null,'the cleared-area GO DEEPER choice is still gated on the popup');
  const door=depthDoor(r.level,1);
  assert.equal(door.locked,true);
  assert.ok(nearDepthDoor(r,{x:door.x,z:door.z},1.7));
  const res=pushDeeper(r,500);
  assert.ok(res?.pushed);
  assert.equal(res.nextZone,2);
  assert.equal(door.locked,false);
  assert.equal(r.depth.phase,'travel');
  assert.equal(r.depth.extractOpen,false);
  assert.equal(r.depth.forfeitZones[0],1);
  assert.equal(canPushDeeper(r),false);
  assert.equal(walkTo(r,600,2),'area-entered');
  assert.equal(r.depth.zone,2);
  assert.equal(exitIsOpen(r),false);
  // leftover area-1 loot cannot be extracted: even standing on the old hatch does nothing
  const a1=r.level.depthExits[0];
  assert.equal(stepDepthRaid(r,700,a1),null);
  assert.equal(r.over,false);
  assert.equal(r.depth.extractOpen,false);
});

test('extract still requires a clear: pushing is the risky path, clearing still opens the choice', () => {
  const r=startDepth('clear-still-prompts',0);
  assert.equal(canPushDeeper(r),true);
  killArea(r,1);
  assert.equal(canPushDeeper(r),false);
  assert.equal(stepDepthRaid(r,1000,r.level.start),'choice-opened');
  assert.equal(r.depth.choice.canGoDeeper,true);
  assert.equal(pushDeeper(r,1100),null,'once the area is clear, the player uses the EXTRACT / GO DEEPER popup');
});

test('depth corridors keep at least 2.4 m of clear width', () => {
  assert.equal(DEPTH_CLEAR_WIDTH,2.4);
  assert.ok(LINK_WIDTH-2*RULES.wallThickness>=2.4-1e-9);
  const seeds=['probe-seed','alpha','bravo','charlie','delta','echo','foxtrot','golf','layout','gear-on-pad'];
  for(const seed of seeds){
    const L=generateDepthLevel(seed);
    const corridors=[...(L.corridors??[]),...(L.deadEnds??[])];
    assert.ok(corridors.length>=2,seed);
    for(const c of corridors){
      // Cross-section, not length: a short dead-end can be shorter than it is wide.
      const width=c.width??(c.dir?(c.dir.x?c.d:c.w):Math.min(c.w,c.d));
      assert.ok(width+1e-9>=LINK_WIDTH,`${seed} corridor slab ${width} < ${LINK_WIDTH} at ${c.x},${c.z}`);
      assert.ok(width-2*RULES.wallThickness+1e-9>=2.4,`${seed} clear width ${width-2*RULES.wallThickness} < 2.4`);
    }
  }
});
