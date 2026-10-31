import {holdExit} from './exit-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as hud from '../hud.js';
import {createRound,activateNode,enterExit,tickRound} from '../round.js';

test('checkpoint keeps the completed level and lit nodes until continuing',()=>{
  const r=createRound('c8dbc438-3',0);
  activateNode(r,r.level.nodes[0].id,1000);
  holdExit(r,r.level.exit,2000);
  assert.equal(typeof hud.displayLevel,'function');
  const displayed=hud.displayLevel(r,true);
  assert.equal(displayed.number,1);
  assert.equal(displayed.nodes.length,1);
  assert.equal(displayed.nodes.filter(n=>n.active).length,1);
  assert.equal(hud.displayLevel(r,false).number,2);
});

test('checkpoint summary clock follows the raid clock; final result stays frozen',()=>{
  const r=createRound('clock-ui',0),main={textContent:''},summary={textContent:''};
  assert.equal(typeof hud.renderRoundClock,'function');
  tickRound(r,224000);hud.renderRoundClock(r,true,main,summary);
  assert.equal(main.textContent,'4:16');assert.equal(summary.textContent,'4:16');
  tickRound(r,232000);hud.renderRoundClock(r,true,main,summary);
  assert.equal(main.textContent,'4:08');assert.equal(summary.textContent,'4:08');
  tickRound(r,480000);hud.renderRoundClock(r,true,main,summary);
  assert.equal(summary.textContent,'0:00');
  tickRound(r,500000);hud.renderRoundClock(r,true,main,summary);
  assert.equal(summary.textContent,'0:00');
});
