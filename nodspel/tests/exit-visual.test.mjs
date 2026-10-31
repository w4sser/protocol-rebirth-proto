import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {generateLevel} from '../levels.js';
import * as world from '../world.js';
// The exit is dim/grey while locked and bright/teal the instant it unlocks (docs: TASK 1 extraction rework).
// setExit(open) is the pure edge-detector the renderer and the one-shot activation pulse + sound cue hang off:
// it only reports a fresh activation ('justOpened') on the locked -> unlocked transition, never while already
// open, never on re-lock, and fires again on a later unlock (level 1 -> level 2 -> level 3 node gates).
test('exit visual state flips dim to lit exactly once per unlock, not while already open or while locked',()=>{
  const w=world.buildWorld(generateLevel(1,'exit-visual'),new THREE.Scene());
  assert.equal(w.setExit(false),false,'still locked: no activation');
  assert.equal(w.setExit(true),true,'locked -> unlocked: activation pulse fires');
  assert.equal(w.setExit(true),false,'already open: no repeat activation');
  assert.equal(w.setExit(false),false,'re-locking is not an activation');
  assert.equal(w.setExit(true),true,'unlocking again fires a fresh activation');
  w.dispose();
});
