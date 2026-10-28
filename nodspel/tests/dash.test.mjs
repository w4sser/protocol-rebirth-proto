import test from 'node:test';
import assert from 'node:assert/strict';
import * as dash from '../dash.js';
import {RULES} from '../levels.js';
const floors=[{x:0,z:0,w:20,d:20}];
test('longer dash drains a visible charge which fills gradually and cannot fire early',()=>{
  const s=dash.createDash();assert.equal(dash.dashCharge(s,100),1);assert.equal(RULES.dash.distance,4.8);
  dash.startDash(s,{x:1,z:0},100);assert.equal(dash.dashCharge(s,100),0);assert.equal(dash.dashCharge(s,1350),.5);
  s.remaining=0;assert.equal(dash.startDash(s,{x:1,z:0},1350),false);assert.equal(dash.dashCharge(s,2600),1);
});
test('dash follows walking direction, travels a short distance and has a shorter cooldown',()=>{
  const state=dash.createDash();assert.equal(dash.startDash(state,{x:1,z:0},100),true);
  let p={x:0,z:0};for(let i=0;i<10;i++)p=dash.stepDash(state,p,.03,[],[],floors);
  assert.ok(Math.abs(p.x-RULES.dash.distance)<1e-6);assert.equal(p.z,0);
  assert.equal(dash.startDash(state,{x:0,z:1},2599),false);
  assert.equal(dash.startDash(state,{x:0,z:1},2600),true);
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
test('dodge i-frames cover only the first 0.15 s of the 0.22 s dash',()=>{
  assert.equal(RULES.dash.iframeMs,150);
  const state=dash.createDash();dash.startDash(state,{x:1,z:0},1000);
  assert.equal(dash.dashInvulnerable(state,1000),true);
  assert.equal(dash.dashInvulnerable(state,1149),true);
  assert.equal(dash.dashInvulnerable(state,1150),false,'i-frames end at 150 ms, well inside the 220 ms dash');
  dash.stepDash(state,{x:0,z:0},RULES.dash.durationSeconds,[],[],floors); // dash finishes
  assert.equal(dash.dashInvulnerable(state,1150),false,'no invulnerability once the dash itself has ended');
  assert.equal(dash.dashInvulnerable(null,1000),false,'no dash state never grants invulnerability');
});
