// v2.28.75 (Robert 24 Nov 2026 Depth Raid playtest, t451u item 4): setCollisions() still pushed a
// 2x0.22 solid onto unopened Depth extract/exit pads. Depth extract points must always be walk-through,
// open or closed -- the beam/extract interaction is a radius check (depthExtractOpen in world.js,
// inDepthExtract), never a physical collider. This guards the shared collider builder in game.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RULES} from '../levels.js';
import {houseSolids} from '../house.js';
import {doorSolids,exitIsOpen} from '../round.js';
import {movePlayer} from '../physics.mjs';

function extractSetCollisions(){
  const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
  const start=source.indexOf('function setCollisions(');
  let i=source.indexOf('{',start),depth=0;
  for(;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){depth--;if(depth===0)return source.slice(start,i+1);}
  }
  throw new Error('setCollisions not found in game.mjs');
}
const setCollisionsSrc=extractSetCollisions();

function computeSolids(level,depthState){
  const ctx=vm.createContext({round:{level,depth:depthState},houseSolids,doorSolids,exitIsOpen,solids:[],playerSolids:[]});
  vm.runInContext(setCollisionsSrc+'\nsetCollisions();',ctx);
  return {solids:ctx.solids,playerSolids:ctx.playerSolids};
}

const R=RULES.playerRadius;
function baseLevel(){
  return {depth:true,walls:[],boxes:[],doors:[],barrels:[],nodes:[],
    exit:{x:50,z:50,r:1},extracts:[{x:50,z:50,r:1}]};
}

test('Depth extract pads never grow a collider, closed or open', () => {
  for(const extractOpen of [false,true]){
    const {solids,playerSolids}=computeSolids(baseLevel(),{extractOpen});
    const nearExit=(s)=>Math.hypot(s.x-50,s.z-50)<1.2;
    assert.ok(!solids.some(nearExit),`extractOpen=${extractOpen}: no solid near the extract pad in solids`);
    assert.ok(!playerSolids.some(nearExit),`extractOpen=${extractOpen}: no solid near the extract pad in playerSolids`);
  }
});

test('the player can walk straight across a closed Depth extract pad at full speed', () => {
  const {playerSolids}=computeSolids(baseLevel(),{extractOpen:false});
  let p={x:47,z:50};
  const speed=RULES.playerStats.base.speed,dt=1/60,steps=Math.ceil(6/(speed*dt));
  let traveled=0;
  for(let s=0;s<steps;s++){
    const before=p;
    p=movePlayer(p,{x:speed*dt,z:0},playerSolids,Infinity,R);
    traveled+=Math.hypot(p.x-before.x,p.z-before.z);
  }
  assert.ok(traveled/6>=0.95,`expected >=95% speed retained crossing the closed extract pad, got ${(traveled/6*100).toFixed(1)}%`);
  assert.ok(Math.abs(p.x-53)<0.2,`expected to reach the far side, stopped at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
});
