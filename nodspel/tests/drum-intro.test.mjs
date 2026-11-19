import test from 'node:test';
import assert from 'node:assert/strict';
import {fuelDrumBitLine,FUEL_DRUM_BIT_LINE} from '../drum-intro.js';
import {createRound} from '../round.js';
import {makeDrum,RULES} from '../levels.js';

function setup(){
  const r=createRound('drum-intro',0);
  r.level.barrels=[makeDrum('d1',0,0,{})];
  r.level.enemies=[];
  return r;
}

test('shows the BIT line on first sight of an undetonated drum in a calm beat',()=>{
  const r=setup();
  assert.equal(fuelDrumBitLine(r,{x:RULES.drum.introRange-.1,z:0},false),FUEL_DRUM_BIT_LINE);
});
test('stays quiet once already seen (per profile)',()=>{
  const r=setup();
  assert.equal(fuelDrumBitLine(r,{x:0,z:0},true),null);
});
test('stays quiet with no drum in the level',()=>{
  const r=createRound('no-drums',0);r.level.barrels=[];
  assert.equal(fuelDrumBitLine(r,{x:0,z:0},false),null);
});
test('stays quiet out of range',()=>{
  const r=setup();
  assert.equal(fuelDrumBitLine(r,{x:RULES.drum.introRange+1,z:0},false),null);
});
test('stays quiet mid-firefight (an aggro enemy), waiting for a calmer moment',()=>{
  const r=setup();
  r.level.enemies=[{id:'e1',health:5,aggro:true}];
  assert.equal(fuelDrumBitLine(r,{x:0,z:0},false),null);
  r.level.enemies[0].aggro=false;
  assert.equal(fuelDrumBitLine(r,{x:0,z:0},false),FUEL_DRUM_BIT_LINE);
});
test('an already-detonated drum does not trigger the intro',()=>{
  const r=setup();r.level.barrels[0].active=true;
  assert.equal(fuelDrumBitLine(r,{x:0,z:0},false),null);
});
