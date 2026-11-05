// v2.25.1 regression (Robert: player spawned outside the level). Every generated spawn is on walkable floor, and
// safeSpawn snaps a bad spawn (outside / in a wall) to the nearest walkable point.
import test from 'node:test';import assert from 'node:assert/strict';
import {generateLevel,AREAS} from '../levels.js';import {spawnProblem,safeSpawn} from '../spawn.js';
test('generated spawns are walkable across areas, hard, depths 1-3 and seeds',()=>{
  for(const area of AREAS)for(const hard of [false,true])for(let n=1;n<=3;n++)for(let i=0;i<60;i++){
    const L=generateLevel(n,`sp${i}`,area,hard,false);assert.equal(spawnProblem(L),null,`${area} hard=${hard} L${n} sp${i} start ${JSON.stringify(L.start)}`);}
});
test('big-level spawns are walkable',()=>{for(const area of AREAS)for(let i=0;i<15;i++){const L=generateLevel(1,`big${i}`,area,false,true);assert.equal(spawnProblem(safeSpawn(L)&&L,safeSpawn(L)),null,`${area} big${i}`);}});
test('safeSpawn snaps a spawn outside the level or in a wall onto the nearest floor',()=>{
  const L=generateLevel(2,'snap','bunker',false,false);
  for(const bad of [{x:-500,z:-500},{x:L.rooms[0].x-L.rooms[0].w/2-1,z:L.rooms[0].z},L.walls[0]]){
    const p=safeSpawn(L,{x:bad.x,z:bad.z});assert.equal(spawnProblem(L,p),null,JSON.stringify(bad));}
  assert.deepEqual(safeSpawn(L),{x:L.start.x,z:L.start.z},'a valid spawn is kept');
});
test('the raid places the player through safeSpawn',async()=>{
  const fs=await import('node:fs');const src=fs.readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(src,/position=safeSpawn\(round\.level\)/);
});
