import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRound,activateNode,enterExit,exitAt} from '../round.js';
import {generateBigLevel} from '../big-level.js';

function open(){const r=createRound('hold',0);for(const n of r.level.nodes)activateNode(r,n.id,0);return r;}
test('locked exits reject walking, taps and long holds',()=>{
  const r=createRound('locked',0),p=r.level.exit;
  for(const t of [0,1,1000,5000])assert.equal(enterExit(r,p,t,true),null);
  assert.equal(r.level.number,1);assert.equal(r.extractHold,null);
});
test('open exit requires a continuous full second, release and leaving cancel',()=>{
  const r=open(),p={...r.level.exit};
  assert.equal(enterExit(r,p,0),null);
  assert.equal(enterExit(r,p,0,true),null);
  assert.equal(enterExit(r,p,999,true),null);
  assert.equal(enterExit(r,p,999,false),null);assert.equal(r.extractHold,null);
  enterExit(r,p,1000,true);enterExit(r,{x:-999,z:-999},1500,true);assert.equal(r.extractHold,null);
  assert.equal(enterExit(r,p,1501,true),null);
  assert.equal(enterExit(r,p,2500,true),null);
  assert.equal(enterExit(r,p,2501,true),'next');
});
test('timed and key extracts never accumulate a hold while locked',()=>{
  for(const type of ['timed','key']){
    const r=createRound(type,0);r.level=generateBigLevel(type);const p=r.level.extracts.find(e=>e.type===type);
    assert.equal(exitAt(r,p),null);enterExit(r,p,0,true);enterExit(r,p,5000,true);
    assert.equal(r.over,false);assert.equal(r.extractHold,null);
    if(type==='key')r.keys=[p.key];
    const t=type==='timed'?p.opensAtMs:5001;
    assert.equal(enterExit(r,p,t,true),null);
    assert.equal(enterExit(r,p,t+999,true),null);
    assert.equal(enterExit(r,p,t+1000,true),'complete');
  }
});
test('pause interrupts a pending hold',()=>{const r=open(),p=r.level.exit;enterExit(r,p,0,true);r.pauseAt=500;enterExit(r,p,500,true);assert.equal(r.extractHold,null);r.pauseAt=null;assert.equal(enterExit(r,p,1000,true),null);});

test('an extract marked opens at four minutes cannot be used earlier by any input',()=>{
 const r=createRound('four-minutes',0);r.level=generateBigLevel(r.seed);
 const p=r.level.extracts[0];p.opensAtMs=240000;
 for(const holding of [false,true])for(const t of [0,1000,239999]){enterExit(r,p,t,holding);assert.equal(r.over,false);assert.equal(r.extractHold,null);}
 assert.equal(enterExit(r,p,240000,true),null);
 assert.equal(enterExit(r,p,240999,true),null);
 assert.equal(enterExit(r,p,241000,true),'complete');
});

test('production release handler completes a full hold between frames, short holds and cancellation do not',()=>{
 const source=readFileSync(new URL('../game.mjs',import.meta.url),'utf8');
 const start=source.indexOf('function endExtractHold('),end=source.indexOf("for(const type of ['pointerup'",start);
 for(const [type,now,completed] of [['pointerup',999,false],['pointerup',1000,true],['keyup',1000,true],['pointercancel',1000,false]]){
  const round=open(),position={...round.level.exit};enterExit(round,position,0,true);let finished=false;
  const context=vm.createContext({round,position,extractHeld:true,gameClock:()=>now,enterExit,finishRound:()=>{finished=true;}});
  vm.runInContext(source.slice(start,end),context);context.endExtractHold({type});
  assert.equal(finished,completed,type+' at '+now);assert.equal(round.extractHold,null);assert.equal(context.extractHeld,false);
 }
});
