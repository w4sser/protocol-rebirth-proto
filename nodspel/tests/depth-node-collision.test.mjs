// v2.28.67 (Robert 22 Nov 2026 playtest, CONTROL ROOM screenshot): a leftover Node Raid node
// pad ("GATE CONTROL") must be walk-through and bullet-through in Depth Areas. Depth Raid
// already clears round.level.nodes (retagPart in depth-level.js), so this guards the actual
// shared collider builder (setCollisions() in game.mjs) against a future regression -- a leaked
// or re-introduced node must never grow a player/bullet collider while round.level.depth is set.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RULES} from '../levels.js';
import {houseSolids} from '../house.js';
import {doorSolids,exitIsOpen} from '../round.js';
import {movePlayer,traceTargets} from '../physics.mjs';

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

function computePlayerSolids(level){
  const ctx=vm.createContext({round:{level,depth:level.depth},houseSolids,doorSolids,exitIsOpen,solids:[],playerSolids:[]});
  vm.runInContext(setCollisionsSrc+'\nsetCollisions();',ctx);
  return ctx.playerSolids;
}

const R=RULES.playerRadius;
function baseLevel(depth){
  return {depth,walls:[],boxes:[],doors:[],barrels:[],
    nodes:[{id:'node-1',x:0,z:0,r:.8,active:false}],
    exit:{x:50,z:50,r:1},extracts:[{x:50,z:50,r:1}]};
}

test('a leaked node never grows a player collider in a Depth round, but still does in Node Raid', () => {
  const depthSolids=computePlayerSolids(baseLevel(true));
  assert.ok(!depthSolids.some(s=>Math.hypot(s.x,s.z)<0.1&&(s.w>=1||s.d>=1)),'no 1.4x1.4 node collider in a depth round');
  const nodeRaidSolids=computePlayerSolids(baseLevel(false));
  assert.ok(nodeRaidSolids.some(s=>s.x===0&&s.z===0&&s.w===1.4&&s.d===1.4),'Node Raid still colliders its own interactable node pads');
});

test('the player can walk straight through a leftover Depth node pad at full speed', () => {
  const level=baseLevel(true);
  const solids=computePlayerSolids(level);
  let p={x:-3,z:0};
  const speed=RULES.playerStats.base.speed,dt=1/60,steps=Math.ceil(6/(speed*dt));
  let traveled=0;
  for(let s=0;s<steps;s++){
    const before=p;
    p=movePlayer(p,{x:speed*dt,z:0},solids,Infinity,R);
    traveled+=Math.hypot(p.x-before.x,p.z-before.z);
  }
  assert.ok(traveled/6>=0.95,`expected >=95% speed retained walking through the node pad, got ${(traveled/6*100).toFixed(1)}%`);
  assert.ok(Math.abs(p.x-3)<0.2,`expected to reach the far side, stopped at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
});

test('a shot through a leftover Depth node pad is not blocked by it', () => {
  const level=baseLevel(true);
  const solids=computePlayerSolids(level);
  const shooter={x:-5,z:0},target={x:5,z:0,r:.4,kind:'player'};
  const hit=traceTargets(shooter,target,solids,[target]);
  assert.equal(hit?.kind,'player',`expected the shot to reach the far target, got blocked by ${hit?.kind}`);
});
