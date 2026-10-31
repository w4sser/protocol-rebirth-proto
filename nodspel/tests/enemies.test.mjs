import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {ENEMIES,ENEMY_TUNING,ENEMY_VISUALS,visualFor,rusherLungeSpeed,rusherBackBonus} from '../enemies.js?v=2.20.0';
import {createEnemyModelLoader} from '../enemy-models.js?v=2.20.0';
import {createRound,hitEnemy} from '../round.js?v=2.20.0';
import {createCombat,stepCombat,telegraphDuration} from '../combat.js?v=2.20.0';
import {shieldBlocks} from '../encounters.js?v=2.20.0';
import {applyEnemyDemo,applyEnemyDemoMixed} from '../enemy-demo.js?v=2.20.0';
import {initTool,throwTool} from '../tools.js?v=2.20.0';
import {RULES,generateLevel,setArea} from '../levels.js?v=2.20.0';

function glbNodeNames(id){
  const bytes=readFileSync(new URL(`../../assets/enemies/${id}.glb`,import.meta.url));
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  return new Set(gltf.nodes.map(n=>n.name));
}

for(const [id,spec] of Object.entries(ENEMIES))test(`${id}: frozen registry matches GLB named parts`,()=>{
  const bytes=readFileSync(new URL(`../../assets/enemies/${id}.glb`,import.meta.url));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const names=new Set(gltf.nodes.map(n=>n.name));
  for(const name of spec.parts)assert.ok(names.has(name),`${id}/${name}`);
  assert.ok(Object.isFrozen(spec)&&Object.isFrozen(spec.parts)&&Object.isFrozen(spec.stats));
  assert.ok(['shield_turret','rusher'].includes(id)?spec.phase===1:[2,3].includes(spec.phase));
  assert.equal(new Set(spec.parts).size,spec.parts.length);
  assert.ok(Object.values(spec.stats).every(n=>Number.isFinite(n)&&n>=0));
  assert.match(spec.model,new RegExp(`^../assets/enemies/${id}.glb\\?v=2.20.0$`));
  const vector=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(1,0,0),spec.forwardUpFix.rotateX).applyAxisAngle(new THREE.Vector3(0,1,0),spec.forwardUpFix.rotateY);
  assert.ok(vector.distanceTo(new THREE.Vector3(0,0,1))<1e-8);
  const up=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(1,0,0),spec.forwardUpFix.rotateX).applyAxisAngle(new THREE.Vector3(0,1,0),spec.forwardUpFix.rotateY);
  assert.ok(up.distanceTo(new THREE.Vector3(0,1,0))<1e-8);
});
test('throwing, malformed and timed out loaders return procedural fallback',async()=>{
  for(const load of [()=>{throw Error('offline');},()=>new THREE.Group(),()=>new Promise(()=>{})]){
    const fallback=new THREE.Group(),loader=createEnemyModelLoader({load,timeoutMs:10});
    const result=await loader('rusher',{fallback:()=>fallback});
    assert.equal(result.root,fallback);assert.equal(result.fallback,true);assert.deepEqual(result.parts,{});
  }
});
test('loads cache per id, clone per instance, and expose independent named pivots',async()=>{
  let requests=0;const source=new THREE.Group();
  for(const name of ENEMIES.rusher.parts){const node=new THREE.Group();node.name=name;source.add(node);}
  const loader=createEnemyModelLoader({load:async()=>{requests++;return source;}});
  const [a,b]=await Promise.all([loader('rusher'),loader('rusher')]);
  assert.equal(requests,1);assert.notEqual(a.root,b.root);assert.notEqual(a.parts.core,b.parts.core);
  a.parts.core.rotation.y=1;assert.equal(b.parts.core.rotation.y,0);
});
function arena(type='rusher',extra={}){
  const round=createRound('phase1',0),enemy={id:'phase1-enemy',kind:'enemy',type,x:0,z:0,r:.48,health:30,speed:2,facing:0,aggro:true,spawnedAt:-Infinity,rangeMul:1,cooldownMul:1,...extra};
  Object.assign(round.level,{rooms:[{x:0,z:0,w:30,d:30}],start:{x:0,z:5},enemies:[enemy],nodes:[],walls:[],boxes:[],hazards:[],floors:[{x:0,z:0,w:30,d:30}],firstGraceMs:0,enemyWindupMs:0});
  const combat=createCombat(round.level,0);combat.graceUntil=0;combat.moveAt=0;combat.nextFire.set(enemy.id,0);
  return {round,enemy,combat,player:{x:0,z:5}};
}
test('shield turret blocks the front 120 degrees, sides/back damage; EMP drops shield and stuns',()=>{
  const {round,enemy}=arena('sentry',{encounter:'shield_turret',frontShield:60,speed:0});
  assert.equal(shieldBlocks(enemy,{x:0,z:3}),true);
  assert.equal(shieldBlocks(enemy,{x:3,z:0}),false);
  assert.equal(shieldBlocks(enemy,{x:0,z:-3}),false);
  assert.equal(hitEnemy(round,enemy.id,100,1,{x:0,z:3}),false);assert.equal(enemy.health,30);
  assert.equal(hitEnemy(round,enemy.id,200,1,{x:0,z:-3}),true);assert.equal(enemy.health,28);
  initTool(round,{id:'tool_emp',n:1});throwTool(round,{x:0,z:1},enemy,300);
  assert.equal(enemy.stunnedUntil,300+RULES.tools.defs.tool_emp.stunMs);
  assert.equal(enemy.shieldDownUntil,enemy.stunnedUntil);
  assert.equal(hitEnemy(round,enemy.id,301,1,{x:0,z:3}),true);
  assert.equal(shieldBlocks(enemy,{x:0,z:3},enemy.stunnedUntil),true);
});
test('shield turret turns at 1.7 rad/s, warns for 1.1 s then bursts and recovers',()=>{
  const {round,enemy,combat,player}=arena('sentry',{encounter:'shield_turret',frontShield:60,speed:0,facing:-.2});
  stepCombat(round,combat,player,100,.1,[]);assert.ok(Math.abs(enemy.facing+.03)<1e-9);
  assert.equal(enemy.windupAt,1200);assert.equal(combat.projectiles.length,0);
  stepCombat(round,combat,player,1199,0,[]);assert.equal(enemy.attackPhase,'warning');
  stepCombat(round,combat,player,1200,0,[]);assert.equal(enemy.attackPhase,'burst');assert.equal(combat.projectiles.length,3);
  stepCombat(round,combat,player,1600,0,[]);assert.equal(enemy.attackPhase,'recovery');
});
test('rusher stalks the 4-6 m ring before an exact .6 s windup and straight 2.5x lunge',()=>{
  const {round,enemy,combat,player}=arena();
  stepCombat(round,combat,player,100,.1,[]);assert.equal(enemy.attackPhase,'stalk');assert.notEqual(enemy.x,0);
  stepCombat(round,combat,player,1500,0,[]);assert.equal(enemy.attackPhase,'warning');assert.equal(enemy.windupAt,2100);
  assert.equal(telegraphDuration(enemy,{enemyWindupMs:9000}),600);
  const direction={...enemy.chargeDirection};player.x=5;
  stepCombat(round,combat,player,2099,.1,[]);assert.equal(enemy.attackPhase,'warning');
  stepCombat(round,combat,player,2100,0,[]);assert.equal(enemy.attackPhase,'charge');
  const before={x:enemy.x,z:enemy.z};stepCombat(round,combat,player,2200,.1,[]);
  assert.ok(Math.abs(Math.hypot(enemy.x-before.x,enemy.z-before.z)-.5)<1e-9);
  assert.deepEqual(enemy.chargeDirection,direction);assert.equal(rusherLungeSpeed(enemy),5);
});
test('wall collision stuns rusher 1.5 s and doubles all back-half shots without stacking bonuses',()=>{
  const {round,enemy,combat,player}=arena('rusher',{stalkUntil:0});
  const wall={x:0,z:2,w:3,d:.4};
  stepCombat(round,combat,player,100,0,[wall]);stepCombat(round,combat,player,700,0,[wall]);
  stepCombat(round,combat,player,1100,.4,[wall]);assert.equal(enemy.stunnedUntil,2600);assert.equal(enemy.wallStunUntil,2600);
  const z=enemy.z;stepCombat(round,combat,player,2599,.1,[wall]);assert.equal(enemy.z,z);
  for(const [degrees,multiplier] of [[0,1],[89,1],[90,1],[91,2],[135,2],[180,2]]){
    const a=degrees*Math.PI/180,from={x:enemy.x+Math.sin(a)*3,z:enemy.z+Math.cos(a)*3};
    const before=enemy.health;hitEnemy(round,enemy.id,1500,1,from);assert.equal(before-enemy.health,multiplier,`${degrees} degrees`);
  }
  assert.equal(rusherBackBonus(enemy,{x:0,z:z-2},2600),null);
  stepCombat(round,combat,player,2600,0,[wall]);assert.equal(enemy.attackPhase,'stalk');
});
test('demo requires both flags and only changes bunker L1; both enemies have visible free positions',()=>{
  setArea('bunker');
  for(const search of ['','?enemydemo=1','?debug=1']){const level=generateLevel(1,'demo');assert.equal(applyEnemyDemo(level,search),false);}
  for(const seed of ['demo','other','phase1',...Array.from({length:120},(_,n)=>`demo-${n}`)]){
    const level=generateLevel(1,seed);assert.equal(applyEnemyDemo(level,'?debug=1&enemydemo=1'),true);
    assert.equal(level.enemies.filter(e=>e.id.startsWith('enemy-demo-')).length,2);
    assert.equal(applyEnemyDemo(level,'?debug=1&enemydemo=1'),false);
  }
  assert.equal(applyEnemyDemo(generateLevel(2,'demo'),'?debug=1&enemydemo=1'),false);
  assert.equal(applyEnemyDemo(generateLevel(1,'demo'),'?debug=1&enemydemo=1','town'),false);
});
test('mixed demo requires both flags, only changes bunker L1, and places all eight archetypes with free positions',()=>{
  setArea('bunker');
  for(const search of ['','?enemydemo=mixed','?debug=1','?debug=1&enemydemo=1']){const level=generateLevel(1,'demo');assert.equal(applyEnemyDemoMixed(level,search),false);}
  for(const seed of ['demo','other','phase1',...Array.from({length:60},(_,n)=>`demo-${n}`)]){
    const level=generateLevel(1,seed);assert.equal(applyEnemyDemoMixed(level,'?debug=1&enemydemo=mixed'),true);
    const added=level.enemies.filter(e=>e.id.startsWith('enemy-demo-'));
    assert.equal(added.length,8);
    assert.deepEqual([...new Set(added.map(e=>visualFor(e).archetype))].sort(),[...new Set(Object.values(ENEMY_VISUALS).map(v=>v.archetype))].sort());
    assert.equal(applyEnemyDemoMixed(level,'?debug=1&enemydemo=mixed'),false);
  }
  assert.equal(applyEnemyDemoMixed(generateLevel(2,'demo'),'?debug=1&enemydemo=mixed'),false);
  assert.equal(applyEnemyDemoMixed(generateLevel(1,'demo'),'?debug=1&enemydemo=mixed','town'),false);
});
// TASK 2: every enemy type/encounter the raid can actually spawn (nodspel/levels.js RULES.enemyTypes,
// nodspel/encounters.js, nodspel/stakes.js hunter waves) must resolve to a registered archetype visual,
// and that archetype's named parts must actually exist in its GLB (docs/enemy-model-mapping.md).
const VISUAL_CASES=[
  ['bare grunt',{type:'grunt'},'rusher'],
  ['bare rusher (charger)',{type:'rusher'},'rusher'],
  ['bare sentry',{type:'sentry'},'sniper'],
  ['bare thrower',{type:'thrower'},'artillery'],
  ['guard',{type:'grunt',encounter:'guard'},'tank'],
  ['grenadier',{type:'thrower',encounter:'grenadier'},'artillery'],
  ['turret (no shield)',{type:'sentry',encounter:'turret'},'shield_turret'],
  ['shield_turret',{type:'sentry',encounter:'shield_turret',archetype:'shield_turret'},'shield_turret'],
  ['patrol',{type:'grunt',encounter:'patrol'},'scout'],
  ['swarm rusher',{type:'rusher',encounter:'swarm',swarm:'s1'},'swarm_bot'],
  ['hunter-wave rusher (no encounter)',{type:'rusher',swarm:true,hunter:true},'swarm_bot'],
];
for(const [label,enemy,archetype] of VISUAL_CASES)test(`visualFor resolves ${label} to the ${archetype} registry visual`,()=>{
  const visual=visualFor(enemy);
  assert.ok(visual,label);assert.equal(visual.archetype,archetype);
  const names=glbNodeNames(visual.archetype);
  for(const name of ENEMIES[visual.archetype].parts)assert.ok(names.has(name),`${archetype}/${name}`);
  for(const name of visual.hideParts??[])assert.ok(names.has(name),`${archetype} hideParts/${name}`);
});
test('generator keeps its procedural mesh (an object, not an enemy) and never resolves a visual',()=>{
  assert.equal(visualFor({type:'generator',encounter:'shield'}),null);
  assert.equal(visualFor(null),null);
});
test('ENEMY_VISUALS only names real registered archetypes and stays frozen',()=>{
  assert.ok(Object.isFrozen(ENEMY_VISUALS));
  for(const visual of Object.values(ENEMY_VISUALS))assert.ok(Object.hasOwn(ENEMIES,visual.archetype));
});
test('L2 turret slots deterministically include both plain and shield variants across seeds',()=>{
  setArea('town');const found=new Set();
  try{for(let n=0;n<16;n++){
    const a=generateLevel(2,`phase1-${n}`),b=generateLevel(2,`phase1-${n}`);
    assert.deepEqual(a.enemies,b.enemies);
    for(const e of a.enemies)if(['turret','shield_turret'].includes(e.encounter))found.add(e.encounter);
    assert.ok(a.enemies.every(e=>!e.archetype||ENEMIES[e.archetype].phase===1));
  }assert.deepEqual([...found].sort(),['shield_turret','turret']);}finally{setArea('bunker');}
});

test('real GLBs animate named pivots with shared geometry, individual pulses and no lights',async()=>{
  const {GLTFLoader}=await import('../vendor/GLTFLoader.js');
  const {attachEnemyModel,animateEnemyModel}=await import('../enemy-animation.js?v=2.20.0');
  const loader=createEnemyModelLoader({load:async url=>{
    const bytes=readFileSync(new URL(`../${url.split('?')[0]}`,import.meta.url));
    return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  }});
  function visual(enemy){const group=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());group.add(body);return {enemy,group,body};}
  const a=visual({type:'sentry',encounter:'shield_turret',health:3,facing:.7}),b=visual({...a.enemy});
  await Promise.all([attachEnemyModel(a,()=>false,loader),attachEnemyModel(b,()=>false,loader)]);
  assert.ok(a.enemyModel);assert.equal(a.body.visible,false);
  const pa=a.enemyModel.parts,pb=b.enemyModel.parts;
  assert.equal(pa.cannon.geometry,pb.cannon.geometry);assert.equal(pa.cannon.material,pb.cannon.material);
  assert.notEqual(pa.shield_arc.material,pb.shield_arc.material);
  animateEnemyModel(a,100);assert.equal(pa.turret_head_pivot.rotation.z,.7);
  a.enemy.shieldDownUntil=400;animateEnemyModel(a,200);assert.equal(pa.shield_arc.visible,false);
  animateEnemyModel(a,400);assert.equal(pa.shield_arc.visible,true);
  a.enemy.attackPhase='burst';a.enemy.burstStartedAt=400;const rest=pa.cannon.position.x;animateEnemyModel(a,401);assert.ok(pa.cannon.position.x<rest);
  const r=visual({type:'rusher',health:3,attackPhase:'stalk'});await attachEnemyModel(r,()=>false,loader);
  animateEnemyModel(r,100);assert.notEqual(r.enemyModel.parts.leg_front_left_pivot.rotation.y,0);
  r.enemy.windupAt=1000;animateEnemyModel(r,500);assert.ok(r.enemyModel.mount.rotation.x>0);
  assert.ok(r.enemyModel.parts.back_battery.material.emissiveIntensity>1);
  let lights=0;for(const v of [a,b,r])v.group.traverse(n=>{if(n.isLight)lights++;});assert.equal(lights,0);
  const failed=visual({type:'rusher'}),failure=createEnemyModelLoader({load:()=>{throw Error('offline');}});
  await attachEnemyModel(failed,()=>false,failure);assert.equal(failed.body.visible,true);assert.equal(failed.enemyModel,undefined);
  const disposed=visual({type:'rusher'});await attachEnemyModel(disposed,()=>true,loader);assert.equal(disposed.enemyModel,undefined);
});
