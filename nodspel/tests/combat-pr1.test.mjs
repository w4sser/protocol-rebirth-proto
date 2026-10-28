import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RULES} from '../levels.js';
import {createRound} from '../round.js';
import {assistAim,assistPreview,assistWindow,createWeapon,fireAimedWeapon,steerShot,stepWeapon,playerDisplaced} from '../weapon.js';
import {createCombat,stepCombat,guardShotDirections} from '../combat.js';
import {moveWithActors} from '../physics.mjs';
import {createDash,startDash,stepDash} from '../dash.js';

const origin={x:0,z:0},aim={x:1,z:0},floors=[{x:0,z:0,w:30,d:30}];
const foe=(x,z)=>({id:'foe',kind:'enemy',aggro:true,facing:0,type:'runner',x,z,r:.48,health:3,active:true});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} vs ${expected}`);
function arena(enemy){
  const round=createRound('pr1',0);
  Object.assign(round.level,{nodes:[],enemies:[enemy],rooms:[{x:0,z:0,w:30,d:30}],floors,walls:[],boxes:[],start:origin});
  return round;
}

test('standing and moving windows enforce angle and width separately, also in L1',()=>{
  assert.deepEqual(assistWindow(),{angleDegrees:12,width:1.1});
  assert.deepEqual(assistWindow(RULES.weapon,true),{angleDegrees:7,width:.7});
  // First target fails only the moving angle; second fails only its width.
  for(const target of [foe(4,.6),foe(6.6,.78)]){
    assert.equal(assistAim(origin,aim,[target],[]).target,target);
    assert.equal(assistAim(origin,aim,[target],[],RULES.weapon,true).target,null);
    const round=arena(target),weapon=createWeapon();
    assert.equal(round.level.number,1);
    const shot=fireAimedWeapon(weapon,round,origin,aim,100,[],true);
    assert.equal(shot.movingAtFire,true);assert.equal(target.health,3);
    const standing=fireAimedWeapon(weapon,round,origin,aim,400,[],false);
    assert.equal(standing.resolved,undefined);assert.equal(target.health,3,'release does not damage');
    // Isolate the assisted shot from the earlier free shot.
    weapon.projectiles=[standing];stepWeapon(weapon,round,800,.5,[]);assert.equal(target.health,2);
    stepWeapon(weapon,round,900,.1,[]);assert.equal(target.health,2,'impact cannot damage twice');
  }
  const inside=foe(4,.2);
  assert.equal(assistAim(origin,aim,[inside],[],RULES.weapon,true).target,inside);
  const wall={x:2,z:0,w:.4,d:3};
  for(const moving of [false,true]){
    assert.equal(assistAim(origin,aim,[inside],[wall],RULES.weapon,moving).target,null);
    const round=arena({...inside}),weapon=createWeapon();
    fireAimedWeapon(weapon,round,origin,aim,100,[wall],moving);
    stepWeapon(weapon,round,200,.4,[wall]);assert.equal(round.level.enemies[0].health,3);
  }
});

test('preview matches both limits and uses the raw aim, with cover clipping',()=>{
  for(const moving of [false,true]){
    const window=assistWindow(RULES.weapon,moving),points=assistPreview(origin,aim,[],RULES.weapon,moving).slice(1);
    near(Math.max(...points.map(p=>Math.abs(Math.atan2(p.z,p.x))))*180/Math.PI,window.angleDegrees);
    near(Math.max(...points.map(p=>Math.abs(p.z))),window.width);
    near(Math.max(...points.map(p=>Math.hypot(p.x,p.z))),RULES.weapon.range);
    const clipped=assistPreview(origin,aim,[{x:2,z:0,w:.4,d:5}],RULES.weapon,moving);
    assert.ok(clipped.every(p=>p.x<=1.8+1e-6));
  }
});

test('movement uses displacement: walking, dash, and actor shove count; blocked input does not',()=>{
  const walk=moveWithActors(origin,{x:.1,z:0},[],[],floors,RULES.playerRadius);
  assert.equal(playerDisplaced(origin,walk),true);
  const wall=[{x:1,z:0,w:1,d:10}],against={x:.5-RULES.playerRadius,z:0};
  const blocked=moveWithActors(against,{x:.1,z:0},[],wall,floors,RULES.playerRadius);
  assert.equal(playerDisplaced(against,blocked),false);
  const dash=createDash();startDash(dash,aim,0);
  assert.equal(playerDisplaced(origin,stepDash(dash,origin,.04,[],[],floors)),true);
  const blockedDash=createDash();startDash(blockedDash,aim,0);
  assert.equal(playerDisplaced(against,stepDash(blockedDash,against,.04,[],wall,floors)),false);
  const pinned=[{x:.7,z:0,w:.2,d:5},{x:0,z:.58,w:5,d:.2},{x:0,z:-.58,w:5,d:.2}];
  const pushed=moveWithActors(origin,{x:0,z:0},[foe(.2,0)],pinned,floors,RULES.playerRadius);
  assert.equal(playerDisplaced(origin,pushed),true);
});

test('free projectile homing retains movement at fire time after player stops or starts',()=>{
  const round=arena(foe(6,2)),weapon=createWeapon();
  const moving=fireAimedWeapon(weapon,round,origin,aim,100,[],true);
  const standing=fireAimedWeapon(weapon,round,origin,aim,400,[],false);
  assert.equal(moving.resolved,undefined);assert.equal(standing.resolved,undefined);
  // Changing player state after release must not affect either projectile.
  steerShot(moving,round.level.enemies,[],weapon.rule,.1);
  steerShot(standing,round.level.enemies,[],weapon.rule,.1);
  near(Math.atan2(moving.dz,moving.dx)*180/Math.PI,3);
  near(Math.atan2(standing.dz,standing.dx)*180/Math.PI,9);
  const blocked={...moving,dx:1,dz:0};
  steerShot(blocked,round.level.enemies,[{x:2,z:0,w:.4,d:5}],weapon.rule,.1);
  near(blocked.dz,0);
});

function encounter(encounter,introGuard=false){
  const enemy={...foe(0,0),type:'sentry',encounter,introGuard,facing:Math.PI/2,aggro:true,speed:0};
  const round=arena(enemy),combat=createCombat(round.level,0);
  combat.graceUntil=0;combat.moveAt=0;combat.nextFire.set(enemy.id,0);
  return {enemy,round,combat};
}
test('turret warning and sequential fan share locked -15/0/+15 directions and original timing',()=>{
  const {enemy,round,combat}=encounter('turret'),cfg=RULES.encounters.turret;
  stepCombat(round,combat,{x:5,z:0},100,.001,[]);
  assert.equal(enemy.attackPhase,'warning');assert.equal(enemy.windupAt,100+cfg.warningMs);
  const lanes=guardShotDirections(enemy).map(d=>({...d}));
  lanes.forEach((d,i)=>near(Math.atan2(d.z,d.x)*180/Math.PI,[-15,0,15][i]));
  // Player movement and shooter displacement during the warning cannot retarget the fan.
  enemy.z=.2;
  stepCombat(round,combat,{x:4,z:2},100+cfg.warningMs-1,.001,[]);
  assert.deepEqual(guardShotDirections(enemy),lanes);assert.equal(enemy.attackPhase,'warning');
  const release=100+cfg.warningMs;
  stepCombat(round,combat,{x:4,z:2},release,.001,[]);
  assert.equal(combat.projectiles.length,3);
  combat.projectiles.forEach((shot,i)=>{
    near(shot.dx,lanes[i].x);near(shot.dz,lanes[i].z);
    assert.equal(shot.releaseAt,release+i*cfg.burstIntervalMs);
  });
  const end=release+2*cfg.burstIntervalMs;
  stepCombat(round,combat,{x:4,z:2},end,.001,[]);
  assert.equal(enemy.attackPhase,'recovery');assert.equal(enemy.recoverUntil,end+cfg.recoveryMs);
});

test('guard and intro retain parallel bursts; ordinary sentry retains a single shot',()=>{
  for(const intro of [false,true]){
    const {enemy,round,combat}=encounter('guard',intro),cfg=intro?RULES.intro:RULES.encounters.guard;
    stepCombat(round,combat,{x:5,z:0},100,.001,[]);
    assert.equal(guardShotDirections(enemy).length,1);
    stepCombat(round,combat,{x:4,z:1},100+cfg.warningMs,.001,[]);
    assert.equal(combat.projectiles.length,cfg.burstShots);
    for(const shot of combat.projectiles){near(shot.dx,1);near(shot.dz,0);}
  }
  const {enemy,round,combat}=encounter(undefined);round.level.enemyWindupMs=0;
  stepCombat(round,combat,{x:5,z:0},100,.001,[]);
  assert.equal(combat.projectiles.length,0);
  stepCombat(round,combat,{x:5,z:0},100+RULES.shooting.telegraphs.sentryMs,.001,[]);
  assert.equal(combat.projectiles.length,1);assert.equal(enemy.attackPhase,undefined);
});

test('game wiring shares movement for preview and release, draws all warning lanes and preserves BIT condition',()=>{
  const source=fs.readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(source,/fireAimedWeapon\(weapon,round,position,direction,clock,playerSolids,playerMoving,tap\)/);
  assert.match(source,/assistAim\(position,aim,\[\.\.\.round.level.enemies,\.\.\.round.level.nodes\],playerSolids,weapon.rule,playerMoving\)/);
  assert.match(source,/assistPreview\(position,aim,playerSolids,weapon.rule,playerMoving\)/);
  assert.match(source,/new THREE.LineSegments\(/);
  assert.match(source,/guardShotDirections\(v.enemy\)/);
  assert.match(source,/setDrawRange\(0,directions.length\*2\)/);
  assert.match(source,/\['warning','burst'\]\.includes\(v.enemy.attackPhase\)/);
  assert.match(source,/const moving=magnitude>\.12\|\|dashing\|\|Math.hypot/);
});
