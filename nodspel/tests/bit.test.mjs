import test from 'node:test';import assert from 'node:assert/strict';import * as bit from '../bit.js';import {createRound} from '../round.js';
const floors=[{x:0,z:0,w:30,d:30}];
test('BIT heals five health per second only while stationary and caps at 100',()=>{
  const r=createRound('bit',0);r.health=80;const b=bit.createBIT({x:0,z:0});
  bit.stepBIT(b,r,{x:0,z:0},1,false,[],floors);assert.equal(r.health,85);assert.equal(b.healing,true);
  bit.stepBIT(b,r,{x:0,z:0},1,true,[],floors);assert.equal(r.health,85);assert.equal(b.healing,false);
  r.health=99;bit.stepBIT(b,r,{x:0,z:0},1,false,[],floors);assert.equal(r.health,100);
});
test('BIT cannot heal a dead player or an ended round',()=>{
  const r=createRound('ended',0),b=bit.createBIT({x:0,z:0});r.over=true;r.health=0;
  bit.stepBIT(b,r,{x:0,z:0},1,false,[],floors);assert.equal(r.health,0);assert.equal(b.healing,false);
});
test('BIT follows at a distance and remains outside cover',()=>{
  const r=createRound('follow',0),b=bit.createBIT({x:0,z:0});
  for(let i=1;i<=120;i++)bit.stepBIT(b,r,{x:i/20,z:0},.05,true,[],floors);
  assert.ok(b.x>3&&b.x<5);assert.equal(b.z,0);
  const wall={x:7,z:0,w:.4,d:6};for(let i=0;i<100;i++)bit.stepBIT(b,r,{x:9,z:0},.05,true,[wall],floors);
  assert.ok(b.x<6.8);
});
