import test from 'node:test';
import assert from 'node:assert/strict';
import {makeShelf} from '../levels.js';
import {shelfBitLine,SHELF_BIT_LINE} from '../shelf-intro.js';
import {createRound} from '../round.js';
import {buildRaidResult} from '../raid-result.js';
function setup(){const r=createRound('intro-shelf',0);r.level.shelves=[makeShelf('s',0,0)];r.level.enemies=[];r.level.walls=[];return r;}
test('exact shelf line at first nearby visible upright shelf, calm and unseen',()=>{
 const r=setup();assert.equal(shelfBitLine(r,{x:0,z:3},false),SHELF_BIT_LINE);
 assert.equal(SHELF_BIT_LINE,'Gravity: still free, still rude.');
 assert.equal(shelfBitLine(r,{x:0,z:3},true),null);
 assert.equal(shelfBitLine(r,{x:0,z:8},false),null);
 r.level.walls=[{x:0,z:1,w:4,d:.4}];assert.equal(shelfBitLine(r,{x:0,z:3},false),null);
});
test('no shelf card in combat, FTUE, pause, terminal state or during/after collapse',()=>{
 for(const state of [{ftue:{}},{pauseAt:1},{over:true}])assert.equal(shelfBitLine(Object.assign(setup(),state),{x:0,z:3},false),null);
 const r=setup();r.level.enemies=[{health:2,aggro:true}];assert.equal(shelfBitLine(r,{x:0,z:3},false),null);
 r.level.enemies[0].health=0;assert.equal(shelfBitLine(r,{x:0,z:3},false),SHELF_BIT_LINE);
 r.level.shelves[0].tipAt=1;assert.equal(shelfBitLine(r,{x:0,z:3},false),null);
 r.level.shelves[0].active=true;assert.equal(shelfBitLine(r,{x:0,z:3},false),null);
});
test('shelf intro returns through RaidResult on death and timeout',()=>{
 for(const reason of ['death','timeout']){const r=setup();r.bitSeen=['shelf_intro'];r.over=true;r.reason=reason;assert.deepEqual(buildRaidResult(r).bitSeen,['shelf_intro']);}
});
