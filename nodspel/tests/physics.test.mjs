import test from 'node:test';
import assert from 'node:assert/strict';
const physics = await import('../physics.mjs').catch(() => ({}));

test('player stops at a solid box even during a large movement', () => {
  assert.equal(typeof physics.movePlayer, 'function', 'movement is implemented');
  const p = physics.movePlayer({x: -3, z: 0}, {x: 8, z: 0}, [{x: 0,z: 0,w: 2,d: 2}], 10, .35);
  assert.ok(p.x <= -1.35 && p.x > -1.5);
});
test('player remains on the bounded floor and can slide along boxes', () => {
  assert.equal(typeof physics.movePlayer, 'function');
  const p = physics.movePlayer({x:-2,z:0}, {x:3,z:2}, [{x:0,z:0,w:2,d:6}], 10, .35);
  assert.ok(p.x <= -1.35);
  assert.ok(p.z > 1.9);
  const edge = physics.movePlayer({x:0,z:0}, {x:100,z:100}, [], 10,.35);
  assert.ok(edge.x <= 9.65 && edge.z <= 9.65);
});
test('a shot activates the node, but a box before the node blocks it', () => {
  assert.equal(typeof physics.traceShot, 'function');
  assert.equal(physics.traceShot({x:0,z:4},{x:0,z:-4},[],{x:0,z:0,r:1}), 'node');
  assert.equal(physics.traceShot({x:0,z:4},{x:0,z:-4},[{x:0,z:2,w:2,d:1}],{x:0,z:0,r:1}), 'wall');
  assert.equal(physics.traceShot({x:4,z:4},{x:4,z:-4},[],{x:0,z:0,r:1}), null);
});
test('a wall behind the node does not prevent activation', () => {
  assert.equal(typeof physics.traceShot, 'function');
  assert.equal(physics.traceShot({x:0,z:4},{x:0,z:-4},[{x:0,z:-2,w:2,d:1}],{x:0,z:0,r:1}), 'node');
});
test('the player cannot walk across a gap in disconnected floors',()=>{
  const p=physics.movePlayer({x:0,z:0},{x:10,z:0},[],[{x:0,z:0,w:4,d:4},{x:8,z:0,w:4,d:4}],.36);
  assert.ok(p.x>1.5 && p.x<=1.64);
});
test('the player can cross a corridor joining two floors',()=>{
  const p=physics.movePlayer({x:0,z:0},{x:8,z:0},[],[{x:0,z:0,w:4,d:4},{x:4,z:0,w:4,d:2},{x:8,z:0,w:4,d:4}],.36);
  assert.ok(Math.abs(p.x-8)<.01);
});
test('a shot hits the nearest node instead of passing through it to a farther node',()=>{
  assert.equal(typeof physics.traceTargets,'function');
  const near={id:'near',x:0,z:2,r:.8},far={id:'far',x:0,z:0,r:.8};
  assert.equal(physics.traceTargets({x:0,z:4},{x:0,z:-4},[],[far,near]).node.id,'near');
});
test('player shots can hit an enemy and cover stops the shot',()=>{
  const enemy={id:'foe',kind:'enemy',x:0,z:0,r:.48};
  assert.equal(physics.traceTargets({x:0,z:4},{x:0,z:-1},[],[enemy]).kind,'enemy');
  assert.equal(physics.traceTargets({x:0,z:4},{x:0,z:-1},[{x:0,z:2,w:2,d:.5}],[enemy]).kind,'wall');
});
