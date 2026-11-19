import test from 'node:test';
import assert from 'node:assert/strict';
import {powerPadBitLine,POWER_PAD_BIT_LINE} from '../pad-intro.js';
import {createRound} from '../round.js';
import {buildRaidResult,readLaunch} from '../raid-result.js';
function setup(){const r=createRound('pad-intro',0,undefined,{completedRaids:2});r.level.enemies=[];return r;}
test('visible junction intro waits for calm first sight and stays quiet after seen',()=>{
  const r=setup(),j=r.level.junctions[0];
  assert.equal(powerPadBitLine(r,j,false,[]),POWER_PAD_BIT_LINE);
  assert.equal(POWER_PAD_BIT_LINE,"Water plus power. Nature's little I-told-you-so.");
  assert.equal(powerPadBitLine(r,j,true,[]),null);
  assert.equal(powerPadBitLine(r,{x:100,z:100},false,[]),null);
  r.level.enemies=[{health:1,aggro:true}];assert.equal(powerPadBitLine(r,j,false,[]),null);
  r.level.enemies[0].health=0;assert.equal(powerPadBitLine(r,j,false,[]),POWER_PAD_BIT_LINE);
});
test('no junction, a wall, pause and FTUE never trigger the intro',()=>{
  const r=setup(),j=r.level.junctions[0],pos={x:j.x,z:j.z-4};
  assert.equal(powerPadBitLine(r,pos,false,[{x:j.x,z:j.z-2,w:2,d:1}]),null);
  r.pauseAt=1;assert.equal(powerPadBitLine(r,j,false,[]),null);r.pauseAt=null;
  r.ftue=true;assert.equal(powerPadBitLine(r,j,false,[]),null);r.ftue=false;
  r.level.junctions=[];assert.equal(powerPadBitLine(r,j,false,[]),null);
});
test('power-pad seen id returns in terminal raid results, launch validates completed count',()=>{
  const r=setup();r.bitSeen=['power_pad_intro'];r.over=true;r.reason='death';
  assert.deepEqual(buildRaidResult(r).bitSeen,['power_pad_intro']);
  assert.equal(readLaunch('?raids=2').completedRaids,2);
  assert.equal(readLaunch('?raids=-5').completedRaids,0);
  assert.equal(readLaunch('?raids=no').completedRaids,0);
});
