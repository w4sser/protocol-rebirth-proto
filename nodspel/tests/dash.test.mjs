import test from 'node:test';
import assert from 'node:assert/strict';
import * as dash from '../dash.js';
import {RULES} from '../levels.js';
const floors=[{x:0,z:0,w:20,d:20}];
test('dash follows walking direction, travels a short distance and has a four second cooldown',()=>{
  const state=dash.createDash();assert.equal(dash.startDash(state,{x:1,z:0},100),true);
  let p={x:0,z:0};for(let i=0;i<10;i++)p=dash.stepDash(state,p,.03,[],[],floors);
  assert.ok(Math.abs(p.x-RULES.dash.distance)<1e-6);assert.equal(p.z,0);
  assert.equal(dash.startDash(state,{x:0,z:1},4099),false);
  assert.equal(dash.startDash(state,{x:0,z:1},4100),true);
});
test('dash sweeps walls, boxes and floor edges instead of teleporting through them',()=>{
  for(const [solids,floor] of [[[{x:1,z:0,w:.2,d:4}],floors],[[],[{x:0,z:0,w:2,d:2}]]]){
    const state=dash.createDash();dash.startDash(state,{x:1,z:0},0);
    const p=dash.stepDash(state,{x:0,z:0},1,[],solids,floor);
    assert.ok(p.x<.65);assert.ok(p.x>0);
  }
});
test('dash releases enemy contact without leaving actors overlapped',()=>{
  const state=dash.createDash(),enemy={x:0,z:0,r:.48,health:2};dash.startDash(state,{x:1,z:0},0);
  const p=dash.stepDash(state,{x:0,z:0},1,[enemy],[],floors);
  assert.ok(p.x>1);assert.ok(Math.hypot(p.x-enemy.x,p.z-enemy.z)>=RULES.playerRadius+enemy.r);
});
test('no walking direction does not consume dash cooldown',()=>{
  const state=dash.createDash();assert.equal(dash.startDash(state,{x:0,z:0},0),false);assert.equal(state.readyAt,0);
});
