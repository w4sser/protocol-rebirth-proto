import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {roomPips,roomProgress,bagTiles} from '../hud.js?v=2.3.0';
import {createRound,activateNode} from '../round.js?v=2.3.0';
const src=f=>readFileSync(new URL(f,import.meta.url),'utf8');

test('three pips: done, current, next',()=>{
  assert.deepEqual(roomPips(1),['cur','next','next']);assert.deepEqual(roomPips(2),['done','cur','next']);assert.deepEqual(roomPips(3),['done','done','cur']);
});
test('room progress counts lit gate controls',()=>{
  const r=createRound('hud-1',0),p0=roomProgress(r.level);
  assert.equal(p0.lit,0);assert.equal(p0.total,r.level.nodes.length);assert.equal(p0.done,false);assert.deepEqual(p0.pips,['cur','next','next']);
  for(const n of r.level.nodes)activateNode(r,n.id,1000);
  const p1=roomProgress(r.level);assert.equal(p1.lit,p1.total);assert.equal(p1.done,true);assert.equal(p1.text,`${p1.total}/${p1.total}`);assert(/Room 1 of 3/.test(p1.label));
});
test('bag renders as icon tiles with counts, empty entries skipped',()=>{
  assert.deepEqual(bagTiles({cable:2,fuse:0,servo:1}),[{id:'cable',n:2},{id:'servo',n:1}]);assert.deepEqual(bagTiles({}),[]);assert.deepEqual(bagTiles(undefined),[]);
});
test('markup: icon room box, seed hidden unless debug, no text-only gate line',()=>{
  const html=src('../index.html'),g=src('../game.mjs');
  assert(/id="room-pips"/.test(html)&&/id="room-obj"/.test(html));assert(!/GATE CONTROLS/.test(html+g),'no "GATE CONTROLS n/n" text box');
  assert(/sl\.hidden=!SEED_LABEL/.test(g)&&/SEED_LABEL=DEBUG&&[^\n]*'seed-label'/.test(g),'seed only with ?debug=1&seed-label=1');assert(/id="seed-label" hidden/.test(html));
  assert(/class="item-tile|item-tile/.test(g)&&/need-tiles/.test(g),'bag + NEED rows are item tiles');
});
