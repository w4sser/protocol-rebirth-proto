import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,tickRound,exitIsOpen,enterExit,activateNode,takeDamage,collectLoot,stepDoors} from '../round.js';
import {extractScrapBonus,generateLevel,RULES} from '../levels.js';
import {walkMap} from '../encounters.js';
import {traceTargets} from '../physics.mjs';
import {createWeapon,fireWeapon,stepWeapon,assistAim} from '../weapon.js';
import {depthModeEnabled,initDepthRound,stepDepthRaid,areaIsCleared,areaEnemies,generateDepthLevel,depthDoor,inDepthExtract,extractRadiusOf,combatRoomsWithCover,depthConnectorPaths,DEPTH_CLEAR_WIDTH,LINK_WIDTH,DEPTH} from '../depth-raid.js';
import {POWER_PAD_BIT_LINE} from '../pad-intro.js';
import {SHELF_BIT_LINE} from '../shelf-intro.js';
import {resultView} from '../result-screen.js';
import {buildRaidResult} from '../raid-result.js';
import '../../data/bit-lines.js?v=2.28.85';

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

test('death still loses the carried bag in depth mode', () => {
  const r=startDepth('depth-death',0);
  r.bag.scrap_alloy=3;
  takeDamage(r,1000,500);
  assert.equal(r.over,true);assert.equal(r.reason,'death');
  assert.equal(r.bag.scrap_alloy,0);assert.equal(r.lost.scrap_alloy,3);
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

// v2.28.78: choosing with feet must never pause combat or pay an early clear bonus.
for(const cleared of [false,true])test(`area 1 extract cleared=${cleared}: hold, bag and reward contract`,()=>{
 const r=startDepth('walk-extract');r.bag={cable:2};
 if(cleared){killArea(r,1);assert.equal(stepDepthRaid(r,10,r.level.start),'area-cleared');}
 assert.equal(r.depth.extractOpen,true);
 const beam=r.level.exit;
 assert.equal(stepDepthRaid(r,20,{x:beam.x+DEPTH.extractRadius+.01,z:beam.z}),null);
 assert.equal(r.depth.extracting,null);
 assert.equal(stepDepthRaid(r,30,beam),'extract-started');
 assert.equal(stepDepthRaid(r,400,beam),null);assert.equal(r.over,false);
 assert.equal(stepDepthRaid(r,410,r.level.start),'extract-canceled');
 assert.equal(stepDepthRaid(r,500,beam),'extract-started');
 assert.equal(stepDepthRaid(r,1300,beam),'zone-extracted');
 assert.equal(r.extracted.cable,2);assert.equal(r.depth.earlyExtract,!cleared);
 const result=buildRaidResult(r),view=resultView(r);
 assert.equal(result.earlyExtract,!cleared);
 assert.equal(view.bonus,cleared?extractScrapBonus(1):0);
 if(!cleared)assert.match(view.description,/Early extraction.*no clear bonus/);
 assert.equal(r.pauseAt,null);
});

test('last kill opens door and spawns one collectible clear cache without pause',()=>{
 const r=startDepth('clear-cache');const enemies=areaEnemies(r,1);
 enemies.slice(1).forEach(e=>e.health=0);stepDepthRaid(r,1,r.level.start);
 assert.equal(r.level.lootBoxes.some(b=>b.clearCache),false);
 enemies[0].health=0;assert.equal(stepDepthRaid(r,2,r.level.start),'area-cleared');
 assert.equal(depthDoor(r.level,1).locked,false);assert.equal(depthDoor(r.level,1).openedBy,'clear');
 const cache=r.level.lootBoxes.find(b=>b.clearCache);
 assert.equal(cache.item,DEPTH.clearCache.items[0]);assert.equal(cache.depthArea,1);assert.equal(cache.revealed,true);
 assert.equal(collectLoot(r,cache,3),true);assert.equal(cache.collected,true);
 stepDepthRaid(r,4,r.level.start);assert.equal(r.level.lootBoxes.filter(b=>b.clearCache).length,1);
 assert.equal(r.pauseAt,null);
});

test('hack uses pad hold, decays outside, alerts only current nearby enemies, and opens door',()=>{
 const r=startDepth('hack');const n=r.level.depthTerminals[0],door=depthDoor(r.level,1);
 const [near,far]=areaEnemies(r,1);near.x=n.x+2;near.z=n.z;far.x=n.x+DEPTH.hack.noiseRadius+1;far.z=n.z;
 near.aggro=far.aggro=false;const other=areaEnemies(r,2)[0];other.x=n.x;other.z=n.z;other.aggro=false;
 assert.equal(stepDepthRaid(r,100,n),'hack-start');assert.equal(n.progress,0);
 assert.equal(near.aggro,true);assert.equal(far.aggro,false);assert.equal(other.aggro,false);
 stepDepthRaid(r,2100,n);assert.equal(n.progress,.5);assert.equal(door.locked,true);
 stepDepthRaid(r,3100,r.level.start);assert.equal(n.progress,.25);
 stepDepthRaid(r,3200,n);assert.equal(n.progress,.25);
 stepDepthRaid(r,6199,n);assert.equal(door.locked,true);
 assert.equal(stepDepthRaid(r,6200,n),'hack-done');assert.equal(door.locked,false);assert.equal(door.openedBy,'hack');
 assert.equal(r.nodeInteraction,null);assert.equal(r.pauseAt,null);
});

test('keycard crate uses normal pickup and proximity unlock without a clear',()=>{
 const r=startDepth('keycard');const door=depthDoor(r.level,1),crate=r.level.lootBoxes.find(b=>b.key===door.key);
 assert.ok(crate);collectLoot(r,crate,10);assert.ok(r.keys.includes(door.key));
 assert.equal(stepDoors(r,door,20),true);assert.equal(door.locked,false);assert.equal(r.keys.length,0);
 assert.equal(door.openedBy,'keycard');assert.equal(areaIsCleared(r),false);
});

test('walk through open doors activates only current beam; early later extract has no bonuses',()=>{
 const r=startDepth('beam-transfer');const level=r.level,oldBeam={...level.exit};
 killArea(r,1);stepDepthRaid(r,100,level.start);
 assert.equal(walkTo(r,200,2),'area-entered');assert.equal(r.level,level);assert.equal(r.depth.extractOpen,true);
 assert.equal(inDepthExtract(r,oldBeam),false);assert.equal(inDepthExtract(r,level.depthExits[1]),true);
 assert.equal(r.depth.lastDoorPassed.how,'clear');assert.equal(r.pauseAt,null);
 stepDepthRaid(r,300,level.exit);stepDepthRaid(r,1100,level.exit);
 assert.equal(resultView(r).bonus,0);assert.equal(buildRaidResult(r).earlyExtract,true);
});

test('three cleared areas bank the ladder and final bonus',()=>{
 const r=startDepth('full-clear');let now=0;
 for(let zone=1;zone<=3;zone++){
  killArea(r,zone);assert.equal(stepDepthRaid(r,now+=100,r.level.depthStarts[zone-1]),'area-cleared');
  if(zone<3)assert.equal(walkTo(r,now+=100,zone+1),'area-entered');
 }
 stepDepthRaid(r,now+=100,r.level.exit);assert.equal(stepDepthRaid(r,now+800,r.level.exit),'zone3-complete');
 assert.equal(resultView(r).bonus,extractScrapBonus(3)+DEPTH.z3ClearBonusScrap);
 assert.equal(buildRaidResult(r).depthBonus,DEPTH.z3ClearBonusScrap);assert.equal(r.pauseAt,null);
});

test('terminal pads and keycards are reachable off the lane and never collide across seeds/areas',()=>{
 for(const seed of ['alpha','bravo','layout','gear-on-pad','seed19']){
  const L=generateDepthLevel(seed);assert.equal(L.depthTerminals.length,2);
  for(let zone=1;zone<=3;zone++){
   for(const d of L.doors)if(d.depth)d.locked=d.depthAreaFrom>=zone;
   const walk=walkMap(L);const near=p=>walk(p);
   if(zone<3){
    const n=L.depthTerminals.find(n=>n.depthArea===zone),key=L.lootBoxes.find(b=>b.key===depthDoor(L,zone).key);
    assert.equal(n.collider,false);
    assert.equal(traceTargets({x:n.x,z:n.z+DEPTH.hack.radius},n,L.walls,[n])?.kind,'node',`${seed} terminal must be visible before activation`);
    assert.ok(n.laneDistance>=DEPTH_CLEAR_WIDTH/2);assert.ok(near(n),`${seed} terminal ${zone}`);assert.ok(near(key),`${seed} key ${zone}`);
    for(const b of [...L.walls,...L.boxes])assert.ok(Math.abs(n.x-b.x)>=b.w/2+DEPTH.hack.radius||Math.abs(n.z-b.z)>=b.d/2+DEPTH.hack.radius);
   }
   assert.ok(near(L.depthStarts[zone-1]));
  }
 }
});


test('area clock remains a loss while global clock cannot fail Depth by itself',()=>{
 const r=startDepth('timeout-kills');r.bag={cable:2};
 assert.deepEqual(DEPTH.zoneTimerMs,[90000,90000,120000]);
 assert.equal(exitIsOpen(r),true);
 tickRound(r,89999);assert.equal(stepDepthRaid(r,89999,r.level.start),null);assert.equal(r.over,false);
 tickRound(r,90000);assert.equal(stepDepthRaid(r,90000,r.level.start),'timeout');
 assert.equal(r.reason,'timeout');assert.equal(r.lost.cable,2);assert.equal(r.pauseAt,null);
 const global=startDepth('global-clock');tickRound(global,9*60*1000);
 assert.equal(global.over,false);assert.equal(global.reason,null);
});

test('FTUE retains Node activation and extraction with depth explicitly disabled',()=>{
 const r=createRound('ftue-raid',0);
 initDepthRound(r,depthModeEnabled({area:'bunker',ftue:true,depthParam:'1'}),0);
 assert.equal(r.depth,null);r.ftue=true;
 for(const node of r.level.nodes)activateNode(r,node.id,0);
 assert.equal(exitIsOpen(r),true);assert.equal(enterExit(r,r.level.exit,1),'complete');
 assert.equal(r.cleared,true);assert.equal(r.reason,'extract');
});

test('beam/hack BIT intros have new stable IDs and unique dry lines',()=>{
 const lines=[DEPTH.bitLines.intro,DEPTH.bitLines.hack,DEPTH.bitLines.hackStart,DEPTH.bitLines.goDeeper];
 const known=new Set([POWER_PAD_BIT_LINE,SHELF_BIT_LINE]);
 for(const pool of Object.values(globalThis.DATA.bitSummary.pools))for(const line of pool.lines)known.add(line);
 for(const line of lines){assert.ok(line.length>0);assert.ok(!known.has(line));}
 assert.equal(new Set(lines).size,lines.length);
 assert.equal(DEPTH.bitLines.introId,'depth_walk_extract_intro');assert.equal(DEPTH.bitLines.hackId,'depth_loud_terminal_intro');
});

test('locked doors reject area crossing; key passage leaves old loot and enemies intact',()=>{
 const r=startDepth('no-forfeit'),level=r.level,count=level.enemies.length;
 assert.notEqual(walkTo(r,100,2),'area-entered');assert.equal(r.depth.zone,1);
 const door=depthDoor(level,1),key=level.lootBoxes.find(b=>b.key===door.key);
 const remaining=level.lootBoxes.find(b=>b.depthArea===1&&!b.key);
 collectLoot(r,key,200);stepDoors(r,door,210);
 assert.equal(walkTo(r,300,2),'area-entered');assert.equal(r.level,level);
 assert.equal(level.enemies.length,count);assert.ok(areaEnemies(r,1).some(e=>e.health>0));
 assert.equal(remaining.collected,false);assert.equal(r.depth.zoneDeadline,300+DEPTH.zoneTimerMs[1]);
 assert.equal(r.pauseAt,null);
});

test('uncleared final area pays no final or ladder bonus after earlier clears',()=>{
 const r=startDepth('final-early',0,{completedRaids:5});let now=0;
 for(let zone=1;zone<3;zone++){
  killArea(r,zone);stepDepthRaid(r,now+=100,r.level.depthStarts[zone-1]);walkTo(r,now+=100,zone+1);
 }
 assert.ok(r.level.junctions.length>0);
 stepDepthRaid(r,now+=100,r.level.exit);assert.equal(stepDepthRaid(r,now+800,r.level.exit),'zone-extracted');
 assert.equal(resultView(r).bonus,0);assert.equal(buildRaidResult(r).depthBonus,undefined);
 assert.equal(r.reason,'extract');assert.equal(r.depth.earlyExtract,true);
});


test('walk-through terminal cannot activate from shots, block bullets or attract aim assist',()=>{
 const r=startDepth('hack-no-shot'),n=r.level.depthTerminals[0],w=createWeapon();
 const origin={x:n.x-2,z:n.z},direction={x:1,z:0};
 assert.equal(activateNode(r,n.id,10),false);assert.equal(n.active,false);
 assert.equal(assistAim(origin,direction,[n],[]).target,null);
 // Isolate a real bullet sweep through the terminal from unrelated room targets.
 r.level.enemies=[];r.level.barrels=[];r.level.junctions=[];r.level.shelves=[];
 fireWeapon(w,origin,direction,100);stepWeapon(w,r,400,.3,[]);
 assert.equal(n.active,false);assert.equal(r.nodesLit,0);
 assert.equal(w.projectiles.length,1);assert.ok(w.projectiles[0].x>n.x);
});
