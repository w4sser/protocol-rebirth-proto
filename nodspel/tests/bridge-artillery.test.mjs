import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {generateLevel} from '../levels.js';
import {buildWorld} from '../world.js';
import {movePlayer} from '../physics.mjs';
import {BRIDGE_MIN_WIDTH,bridgeClearances,inBridgeClearance,bridgeWaypoint} from '../bridge-flow.mjs';
import {artilleryFlight} from '../artillery-flight.mjs';

// Runs on logical geometry, not the prettier visual coastline.
test('all archipelago bridges and their collision openings provide 4m of width',()=>{
  let checked=0;
  for(const n of [2,3])for(let i=0;i<30;i++){
    const level=generateLevel(n,'bridge-width-'+i,'archipelago');
    const zones=bridgeClearances(level);
    assert.equal(zones.length,level.floors.filter(f=>f.dir).length);
    for(const c of level.corridors){
      const short=c.dir.x?c.d:c.w;
      assert.ok(short>=BRIDGE_MIN_WIDTH-.001,`bridge ${c.x},${c.z} too narrow: ${short}`);
      const a={x:c.x,z:c.z};
      assert.ok(zones.some(z=>inBridgeClearance({x:a.x,z:a.z,w:.5,d:.5},[z])));
      checked++;
    }
    for(const c of level.boxes)assert.ok(!inBridgeClearance(c,zones),'no collision crates at bridge/landing');
  }
  assert.ok(checked>=60);
});
test('every rendered pine clears the full bridge and generous funnel landings',()=>{
  for(const n of [2,3])for(let i=0;i<6;i++){
    const level=generateLevel(n,'bridge-tree-'+i,'archipelago');
    const scene=new THREE.Scene(),world=buildWorld(level,scene,{quality:'low'});
    try{
      assert.ok(world.group.children.some(o=>o.name==='archipelago-bridge-apron'),'wooden approach flares exist');
      for(const p of world.group.children.filter(x=>x.name==='pine')){
        const b=new THREE.Box3().setFromObject(p);
        assert.ok(!inBridgeClearance({x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,w:b.max.x-b.min.x,d:b.max.z-b.min.z},bridgeClearances(level)),'tree blocks bridge');
      }
    }finally{world.dispose();}
  }
});
test('moving bots route through centered landings on either side of a bridge',()=>{
  for(const direction of [1,-1]){
    const level={archipelago:true,rooms:[
      {x:0,z:0,w:10,d:10},{x:17,z:0,w:10,d:10}
    ],corridors:[{x:8.5,z:0,w:7,d:4,dir:{x:1,z:0}}]};
    const actor=direction===1?{x:1,z:2}:{x:17,z:-2};
    const target=direction===1?{x:17,z:2}:{x:0,z:-2};
    const first=bridgeWaypoint(level,actor,target);
    assert.ok(first,'bridge entry waypoint');
    assert.ok(Math.abs(first.z)<.01,'entry lands on center line');
    actor.x=first.x;actor.z=first.z;
    const exit=bridgeWaypoint(level,actor,target);
    assert.ok(exit,'exit waypoint');
    assert.ok(Math.abs(exit.z)<.01,'exit stays on center line');
    assert.ok(direction===1?exit.x>first.x:exit.x<first.x);
  }
});
test('artillery shell remains visible for its entire real fuse, with an elevated arc',()=>{
  const b={fromX:-6,fromZ:3,x:4,z:-1,at:1000,detonateAt:2000,radius:2};
  const start=artilleryFlight(b,1000),mid=artilleryFlight(b,1500),end=artilleryFlight(b,2000);
  assert.equal(start.t,0);assert.equal(start.x,-6);assert.equal(start.z,3);
  assert.equal(end.t,1);assert.equal(end.x,4);assert.equal(end.z,-1);
  assert.ok(mid.y>start.y+1.5 && mid.y>end.y+2,'shell rises visibly over rocks');
  assert.equal(mid.x,-1);assert.equal(mid.z,1);
  assert.ok(start.size>.1&&mid.size>.2);
});
test('artillery rendering tracks live combat lob data, without altering collision damage',async()=>{
  const combat=await readFile(new URL('../combat.js',import.meta.url),'utf8');
  const game=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  const ground=await readFile(new URL('../ground-preview.js',import.meta.url),'utf8');
  assert.match(combat,/fromX:enemy.x,fromZ:enemy.z/);
  assert.match(game,/renderArtilleryShells\(clock\)/);
  assert.match(game,/artilleryFlight\(blast,clock\)/);
  assert.match(game,/new THREE.SphereGeometry\(\.21/);
  assert.match(ground,/if\(biome==='nature' && floor.dir\)continue/,'bridge planks are not painted over by ground assets');
});

test('artillery shell and landing rings are pre-created for shader prewarm',async()=>{
  const game=await readFile(new URL('../game.mjs',import.meta.url),'utf8');
  assert.match(game,/function makeArtilleryShell\b/);
  assert.match(game,/function makeToolFxRing\b/);
  assert.match(game,/makeArtilleryShell\(\);\s*makeToolFxRing\(\);\s*makeToolFxRing\(\);/);
  assert.match(game,/function prewarmShaders\b/);
});
