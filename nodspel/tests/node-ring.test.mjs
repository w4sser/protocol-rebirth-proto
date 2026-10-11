import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from '../vendor/three.module.js';import {generateLevel} from '../levels.js';import * as world from '../world.js';
test('the floor ring fills with hold progress, clears on leaving, and clears the prompt state after activation',()=>{
  const w=world.buildWorld(generateLevel(1,'ring'),new THREE.Scene()),v=w.nodes[0];
  world.setNodeHold(v,.5);assert.equal(v.holdRing.visible,true);assert.equal(v.holdRing.geometry.drawRange.count,192);
  world.setNodeHold(v,0);assert.equal(v.holdRing.geometry.drawRange.count,0);
  v.node.active=true;world.setNodeHold(v,.8);assert.equal(v.holdRing.visible,false);assert.equal(v.holdRing.geometry.drawRange.count,0);
  w.dispose();
});
