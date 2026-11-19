import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPixelFeedback} from '../fx-feedback.js?v=2.28.55';

test('revealing and collecting loot never spawns a pixel chest, including initial revealed supplies',()=>{
 const events=[],pixel={enabled:true,clear(){},stop(){},update(){},spawn(name){events.push(name);}};
 const feedback=createPixelFeedback(pixel,{}),level={enemies:[]},loot={x:1,z:2,revealed:false,collected:false};
 const world={lootBoxes:[{loot}]},round={level,health:100,over:false};
 for(const state of [{},{revealed:true},{collected:true}]){
   Object.assign(loot,state);feedback.sync(round,world,{x:0,z:0},1,.016);
 }
 assert.deepEqual(events,[]);
 feedback.reset(level);feedback.sync(round,world,{x:0,z:0},2,.016);assert.deepEqual(events,[]);
 // The existing world-space burst and textual pickup path stay wired.
 const game=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
 assert.match(game,/v\.loot\.collected&&v\.group\.visible\)world\.spawnLootBurst/);
 assert.match(game,/pickupToast\(round\.lastBagPickup\.item\)/);
});
