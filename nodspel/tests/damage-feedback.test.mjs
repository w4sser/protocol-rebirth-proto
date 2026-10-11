import test from 'node:test';import assert from 'node:assert/strict';import {createRound,hitEnemy} from '../round.js';
test('damage feedback records the actual health removed, including a killing hit',()=>{
  const round=createRound('feedback',0),e=round.level.enemies[0];
  hitEnemy(round,e.id,100,1);assert.equal(e.lastDamage,1);assert.equal(e.lastHitAt,100);
  hitEnemy(round,e.id,200,5);assert.equal(e.lastDamage,1);assert.equal(e.health,0);assert.equal(e.lastHitAt,200);
});
