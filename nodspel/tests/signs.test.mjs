import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLevel} from '../levels.js';
const api=await import('../objectives.js').catch(()=>({}));
test('signs stay until their own targets are completed',()=>{
  assert.equal(typeof api.routeComplete,'function');
  const l=generateLevel(2,'signs'),loot=l.routeChoices.find(c=>c.kind==='loot'),nodes=l.routeChoices.find(c=>c.kind==='node');
  assert.equal(api.routeComplete(l,loot),false);assert.equal(api.routeComplete(l,nodes),false);
  l.lootBoxes.find(b=>!b.marked).collected=true;
  assert.equal(api.routeComplete(l,loot),false,'other loot does not remove the marker');
  l.lootBoxes.find(b=>b.marked).collected=true;assert.equal(api.routeComplete(l,loot),true);
  l.nodes[0].active=true;assert.equal(api.routeComplete(l,nodes),false,'another node still needs activation');
  l.nodes[1].active=true;assert.equal(api.routeComplete(l,nodes),true);
});
