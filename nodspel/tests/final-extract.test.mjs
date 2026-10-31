import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,enterExit,activateNode,tickRound} from '../round.js';
import {generateLevel} from '../levels.js';
test('final extract stays at risk until an explicit full hold, including when it opens around the player',()=>{
  const r=createRound('final',0);r.level=generateLevel(3,'final');const p=r.level.exit;
  for(const n of r.level.nodes)activateNode(r,n.id,100);
  r.bag.cable=1;
  assert.equal(enterExit(r,p,100),null);tickRound(r,500);assert.equal(r.over,false);
  assert.equal(enterExit(r,p,500,true),null);assert.equal(enterExit(r,p,1499,true),null);
  assert.equal(enterExit(r,p,1500,true),'complete');assert.equal(r.extracted.cable,1);
});
