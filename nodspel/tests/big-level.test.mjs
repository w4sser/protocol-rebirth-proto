import test from 'node:test';
import assert from 'node:assert/strict';
import {generateZoneGraph,graphDistances,cullingRooms,graphRoomAt} from '../zone-graph.js';
import {generateBigLevel,updateBigCulling,extractAvailable} from '../big-level.js';
import {generateLevel,setLevelMode,RULES} from '../levels.js';
import {reachable} from '../town-layout.js';
import {createRound,enterExit,collectLoot,activateNode} from '../round.js';
import {createCombat,stepCombat} from '../combat.js';
import {levelMapSVG} from '../level-map.js';

const seeds=Array.from({length:40},(_,i)=>`big-${i}`);
test('big generation is deterministic, diverse and uses 6-12 authored room footprints',()=>{
  const counts=new Set();for(const seed of seeds){const a=generateZoneGraph(seed);assert.deepEqual(a,generateZoneGraph(seed));counts.add(a.nodes.length);assert.ok(a.nodes.length>=6&&a.nodes.length<=12);
    for(const room of a.nodes.slice(1)){const layout=RULES.layouts[2].find(l=>l.id===room.layoutId);assert.deepEqual([room.w,room.d],[layout.rooms[room.templateIndex].w,layout.rooms[room.templateIndex].d]);assert.equal(room.x%2,0);assert.equal(Math.abs(room.z%2),0);}
    assert.deepEqual(generateBigLevel(seed),generateBigLevel(seed));
  }assert.equal(counts.size,7);
});
test('connected seeded spanning tree plus 1-3 loops; sockets and corridors do not overlap rooms',()=>{
  for(const seed of seeds){const g=generateZoneGraph(seed);assert.equal(Object.keys(graphDistances(g)).length,g.nodes.length);assert.ok(g.edges.length>=g.nodes.length&&g.edges.length<=g.nodes.length+2);
    for(const a of g.nodes)for(const b of g.nodes)if(a.id<b.id)assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||Math.abs(a.z-b.z)>=(a.d+b.d)/2);
    for(const e of g.edges){assert.ok(e.start.x===e.end.x||e.start.z===e.end.z);assert.equal(e.corridor.width,1.8);for(const room of g.nodes)if(![e.a,e.b].includes(room.id))assert.ok(Math.abs(room.x-e.corridor.x)>=(room.w+e.corridor.w)/2||Math.abs(room.z-e.corridor.z)>=(room.d+e.corridor.d)/2);}
  }
});
test('three reachable extract types, farthest always-open exit, and three distinct POIs',()=>{
  for(const seed of seeds){const g=generateZoneGraph(seed),d=graphDistances(g);assert.equal(g.extracts.length,3);assert.deepEqual(g.extracts.map(e=>e.type),['open','timed','key']);assert.equal(d[g.extracts[0].roomId],Math.max(...Object.values(d)));assert.ok(g.extracts.every(e=>d[e.roomId]!=null));assert.equal(g.pois.length,3);assert.equal(new Set(g.pois.map(p=>p.roomId)).size,3);assert.deepEqual(g.pois.map(p=>p.type),['vault','generator','bit-signal']);}
});
test('physical floor/solid flood fill reaches every objective, pickup, enemy and extract',()=>{
  for(const seed of seeds.slice(0,12)){const l=generateBigLevel(seed);assert.ok(reachable(l,RULES.playerRadius,.3,l.extracts.map(e=>({...e,reach:e.r}))),seed);const ids=l.enemies.map(e=>e.id);assert.equal(new Set(ids).size,ids.length);assert.ok(l.encounters.some(e=>e.type==='shield'),seed);assert.ok(l.enemies.some(e=>e.type==='generator'),seed);}
});
test('culling is exactly active room plus neighbours, including corridors; sleeping enemies do not simulate',()=>{
  const l=generateBigLevel('cull'),round={...createRound('cull',0),level:l},combat=createCombat(l,0);
  for(const room of l.rooms){const expected=new Set([room.id,...l.graph.edges.filter(e=>e.a===room.id||e.b===room.id).map(e=>e.a===room.id?e.b:e.a)]);assert.deepEqual(cullingRooms(l.graph,room.id),expected);assert.deepEqual(updateBigCulling(l,room,10000,combat),expected);for(const enemy of l.enemies)assert.equal(enemy.sleeping,!expected.has(enemy.roomId));}
  const edge=l.graph.edges[0];assert.equal(graphRoomAt(l.graph,edge.corridor,edge.a),edge.a);
  updateBigCulling(l,l.start,20000,combat);const asleep=l.enemies.filter(e=>e.sleeping),before=asleep.map(e=>JSON.stringify(e));stepCombat(round,combat,l.start,21000,.04,l.walls);assert.deepEqual(asleep.map(e=>JSON.stringify(e)),before);
});
test('wake restores encounter deadlines and leaves encounter activation intact',()=>{
  const l=generateBigLevel('wake'),enemy=l.enemies.find(e=>e.roomId===l.rooms.at(-1).id);enemy.windupAt=2000;enemy.spawnedAt=500;enemy.aimLockAt=1500;enemy.active=false;
  updateBigCulling(l,l.start,1000);assert.equal(enemy.sleeping,true);updateBigCulling(l,l.rooms[enemy.roomId],6000);assert.equal(enemy.windupAt,7000);assert.equal(enemy.spawnedAt,5500);assert.equal(enemy.aimLockAt,6500);assert.equal(enemy.active,false);
});
test('extract windows and vault key gate real extraction without requiring every terminal',()=>{
  for(const type of ['open','timed','key']){const round=createRound(`extract-${type}`,0);round.level=generateBigLevel(round.seed);const e=round.level.extracts.find(e=>e.type===type);round.bag.cable=1;
    if(type!=='open'){assert.equal(enterExit(round,e,0),null);assert.equal(round.over,false);}
    if(type==='key'){const key=round.level.lootBoxes.find(b=>b.key===e.key);assert.equal(collectLoot(round,key,1),false);activateNode(round,key.requiresNode,2);collectLoot(round,key,3);assert.ok(round.keys.includes(e.key));}
    const now=type==='timed'?60000:4;assert.equal(enterExit(round,e,now),'complete');assert.equal(round.over,true);assert.equal(round.extracted.cable,1);assert.equal(round.extractionId,e.id);
  }
  const round=createRound('window',0),e=generateBigLevel('window').extracts[1];round.remainingMs=round.durationMs-59999;assert.equal(extractAvailable(e,round),false);round.remainingMs=round.durationMs-60000;assert.equal(extractAvailable(e,round),true);round.remainingMs=round.durationMs-240000;assert.equal(extractAvailable(e,round),false);
});
test('default levels remain unchanged and the explicit mode switch gates big layouts',()=>{
  const before=generateLevel(1,'default');setLevelMode('big');try{assert.equal(generateLevel(1,'default').big,true);}finally{setLevelMode(null);}assert.deepEqual(generateLevel(1,'default'),before);
});
test('review SVG includes room rectangles, corridors, POIs, spawn and extract markers',()=>{const svg=levelMapSVG(generateZoneGraph('svg'),{standalone:true});assert.match(svg,/<svg/);for(const text of ['Vault','GENERATOR','Spawn','Always open extract','Timed extract','Key extract'])assert.ok(svg.toLowerCase().includes(text.toLowerCase()),text);});

import * as THREE from '../vendor/three.module.js';
import {createRoomVisibility} from '../big-level-culling.js';
import {safePick,perkState,roomKey} from '../perks.js';
test('instanced room batches cull sleeping geometry without changing materials or asset transforms',()=>{
  const level=generateBigLevel('instances'),group=new THREE.Group(),geometry=new THREE.BoxGeometry(2,.1,2),material=new THREE.MeshBasicMaterial();
  const mesh=new THREE.InstancedMesh(geometry,material,level.rooms.length),matrix=new THREE.Matrix4();
  for(const [i,room] of level.rooms.entries())mesh.setMatrixAt(i,matrix.makeTranslation(room.x,0,room.z));group.add(mesh);
  const world={group,enemies:[]},apply=createRoomVisibility(level,world),awake=updateBigCulling(level,level.start);
  apply(awake);let total=0,visible=0;group.traverse(o=>{if(!o.isInstancedMesh)return;assert.equal(o.geometry,geometry);assert.equal(o.material,material);for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix),room=level.rooms.find(r=>r.x===p.x&&r.z===p.z);assert.ok(room);assert.equal(o.parent.visible,awake.has(room.id));total++;if(o.parent.visible)visible++;}});assert.equal(total,level.rooms.length);assert.equal(visible,awake.size);
  // A hunter spawned after the initial registration must join culling too.
  const far=level.rooms.find(r=>!awake.has(r.id)),enemy={x:far.x,z:far.z,roomId:0},enemyGroup=new THREE.Group();group.add(enemyGroup);world.enemies.push({enemy,group:enemyGroup});apply(awake);assert.equal(enemyGroup.parent.visible,false);updateBigCulling(level,far);apply(level.awakeRooms);assert.equal(enemyGroup.parent.visible,true);
  const transient=new THREE.Mesh(geometry,material);transient.position.set(far.x,0,far.z);group.add(transient);apply(awake);assert.equal(transient.parent,group);assert.equal(transient.visible,false);group.remove(transient);apply(awake);assert.equal(transient.parent,null);
  enemy.x=level.start.x;enemy.z=level.start.z;updateBigCulling(level,level.start);assert.equal(enemy.sleeping,undefined);apply(level.awakeRooms);assert.equal(enemyGroup.parent.visible,true);
});
test('enemies are culled by current room and frozen attacks do not block a local perk',()=>{
  const round=createRound('perk-cull',0),level=round.level=generateBigLevel('perk-cull'),combat=createCombat(level,0);updateBigCulling(level,level.start,1000,combat);
  const remote=level.rooms.find(r=>!level.awakeRooms.has(r.id)),enemy=level.enemies.find(e=>e.roomId===0);enemy.x=remote.x;enemy.z=remote.z;updateBigCulling(level,remote,2000,combat);assert.equal(enemy.sleeping,false);
  updateBigCulling(level,level.start,3000,combat);enemy.windupAt=5000;assert.equal(enemy.sleeping,true);
  for(const e of level.enemies)if(e.roomId===0&&e!==enemy)e.health=0;
  const s=perkState(round),key=roomKey(round,0);s.queue=[key];s.rooms[key]={state:'clearPending',index:0,level:1};
  combat.projectiles=[{id:'sleep-shot',x:remote.x,z:remote.z,dx:1,dz:0,life:1,releaseAt:4000}];combat.blasts=[{id:'sleep-blast',x:remote.x,z:remote.z,detonateAt:4000,at:3000,radius:2}];
  updateBigCulling(level,level.start,3000,combat);assert.equal(safePick(round,combat,level.start,3500,()=> 'off'),key);
  const shot={...combat.projectiles[0]},blast={...combat.blasts[0]};stepCombat(round,combat,level.start,10000,.04,level.walls);assert.deepEqual(combat.projectiles[0],shot);assert.deepEqual(combat.blasts[0],blast);
  updateBigCulling(level,remote,13000,combat);assert.equal(combat.projectiles[0].releaseAt,14000);assert.equal(combat.blasts[0].detonateAt,14000);
});
