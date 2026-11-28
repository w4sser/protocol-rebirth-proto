import test from 'node:test';import assert from 'node:assert/strict';
import {ftueHintsEligible,hintsPreviouslyDone,markHintsDone,createFtueHintState,tickFtueHints,
  noteFtueHintShot,noteFtueHintHit,ftueHintKeepShooting,ftueHintDone,FTUE_HINT_MOVE_METERS,
  FTUE_HINT_IDLE_MS,FTUE_HINT_REPLAY_IDLE_MS,FTUE_HINT_SHOW_MS,FTUE_HINT_MAX_RESHOWS} from '../ftue-hints.js';

function fakeStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)};}

test('eligibility: FTUE raid or a profile with 0 completed raids, never later raids',()=>{
  assert.equal(ftueHintsEligible({ftue:true,completedRaids:0}),true);
  assert.equal(ftueHintsEligible({ftue:false,completedRaids:0}),true);
  assert.equal(ftueHintsEligible({ftue:true,completedRaids:5}),true,'the scripted FTUE raid is always eligible');
  assert.equal(ftueHintsEligible({ftue:false,completedRaids:1}),false);
  assert.equal(ftueHintsEligible({ftue:false,completedRaids:50}),false);
  assert.equal(ftueHintsEligible({}),true,'default completedRaids is 0');
});

test('persistence: done flag round-trips through storage and survives a denied store',()=>{
  const storage=fakeStorage();
  assert.equal(hintsPreviouslyDone(storage),false);
  markHintsDone(storage);
  assert.equal(hintsPreviouslyDone(storage),true);
  const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
  assert.equal(hintsPreviouslyDone(denied),false);
  assert.doesNotThrow(()=>markHintsDone(denied));
});

test('move threshold: step only advances once displacement from the start reaches 3 m, not before',()=>{
  const state=createFtueHintState({startX:0,startZ:0,startMs:0});
  let events=tickFtueHints(state,{x:0,z:FTUE_HINT_MOVE_METERS-0.5,active:true,clockMs:100});
  assert.equal(state.step,'move');
  assert.deepEqual(events,[{type:'shown',step:'move'}],'fresh profile: the move hint shows on its first tick');
  events=tickFtueHints(state,{x:0,z:FTUE_HINT_MOVE_METERS,active:true,clockMs:200});
  assert.equal(state.step,'aim');
  assert.deepEqual(events,[{type:'done',step:'move',ms:200}]);
});

test('move threshold uses straight-line displacement from the start, not stick wiggle/path length',()=>{
  const state=createFtueHintState({startX:0,startZ:0,startMs:0});
  // Wiggling back and forth near the start, even repeatedly, never crosses the 3 m displacement.
  for(let i=0;i<20;i++)tickFtueHints(state,{x:0,z:i%2,active:true,clockMs:i*10});
  assert.equal(state.step,'move');
});

test('aim completes on the first shot fired, regardless of hits',()=>{
  const state=createFtueHintState({startX:0,startZ:0,startMs:0});
  tickFtueHints(state,{x:0,z:FTUE_HINT_MOVE_METERS,active:true,clockMs:100});
  assert.equal(state.step,'aim');
  const events=noteFtueHintShot(state,500);
  assert.equal(state.step,'done');
  assert.equal(ftueHintDone(state),true);
  assert.deepEqual(events,[{type:'done',step:'aim',ms:400}]);
});

test('a shot fired before the move threshold ends the hints outright',()=>{
  const state=createFtueHintState({startX:0,startZ:0,startMs:0});
  const events=noteFtueHintShot(state,50);
  assert.equal(state.step,'done');
  assert.deepEqual(events,[{type:'done',step:'move',ms:50}]);
});

test('keep-shooting nudge fires only after 3 shots land with zero hits',()=>{
  const state=createFtueHintState({startX:0,startZ:0,startMs:0});
  noteFtueHintShot(state,100);
  assert.equal(ftueHintKeepShooting(state),false);
  noteFtueHintShot(state,200);noteFtueHintShot(state,300);
  assert.equal(ftueHintKeepShooting(state),true);
  noteFtueHintHit(state);
  assert.equal(ftueHintKeepShooting(state),false,'a landed hit clears the nudge');
});

test('a fresh profile sees its first hint immediately, with no idle wait',()=>{
  const state=createFtueHintState({startX:0,startZ:0,replay:false,startMs:1000});
  const events=tickFtueHints(state,{x:0,z:0,active:false,clockMs:1000});
  assert.equal(state.visible,true);
  assert.deepEqual(events,[{type:'shown',step:'move'}]);
});

test('a replayed FTUE after the first success waits for idle > 12 s before showing anything',()=>{
  const state=createFtueHintState({startX:0,startZ:0,replay:true,startMs:0});
  let events=tickFtueHints(state,{x:0,z:0,active:false,clockMs:FTUE_HINT_REPLAY_IDLE_MS-1});
  assert.equal(state.visible,false);
  assert.deepEqual(events,[]);
  events=tickFtueHints(state,{x:0,z:0,active:false,clockMs:FTUE_HINT_REPLAY_IDLE_MS});
  assert.equal(state.visible,true);
  assert.deepEqual(events,[{type:'shown',step:'move'}]);
});

test('idle input (stick touched) resets the replay wait, so a trying player never gets the hint shoved at them',()=>{
  const state=createFtueHintState({startX:0,startZ:0,replay:true,startMs:0});
  tickFtueHints(state,{x:0,z:0,active:true,clockMs:FTUE_HINT_REPLAY_IDLE_MS-1});
  const events=tickFtueHints(state,{x:0,z:0,active:false,clockMs:FTUE_HINT_REPLAY_IDLE_MS});
  assert.equal(state.visible,false,'activity just before the deadline pushes the idle window out');
  assert.deepEqual(events,[]);
});

test('idle re-show cap: the hint auto-hides after its show window, reappears on idle, and stops after 3 reshows',()=>{
  const state=createFtueHintState({startX:0,startZ:0,replay:false,startMs:0});
  let clock=0;
  tickFtueHints(state,{x:0,z:0,active:false,clockMs:clock});
  assert.equal(state.visible,true,'first appearance is immediate for a fresh profile');
  let reshowEvents=0;
  for(let i=0;i<10;i++){
    clock+=FTUE_HINT_SHOW_MS;
    let events=tickFtueHints(state,{x:0,z:0,active:false,clockMs:clock});
    assert.equal(state.visible,false,'auto-hides after its show window');
    clock+=FTUE_HINT_IDLE_MS;
    events=tickFtueHints(state,{x:0,z:0,active:false,clockMs:clock});
    if(events.some(e=>e.type==='reshow')){reshowEvents++;assert.equal(state.visible,true);}
  }
  assert.equal(reshowEvents,FTUE_HINT_MAX_RESHOWS,'reshows stop after the cap, even though idle kept happening');
  assert.equal(state.reshowCount,FTUE_HINT_MAX_RESHOWS);
});

test('completing the step (move->aim) resets that step\'s own show history',()=>{
  const state=createFtueHintState({startX:0,startZ:0,replay:false,startMs:0});
  tickFtueHints(state,{x:0,z:0,active:false,clockMs:0}); // move hint shown immediately
  tickFtueHints(state,{x:0,z:FTUE_HINT_MOVE_METERS,active:true,clockMs:50}); // crosses into 'aim'
  assert.equal(state.step,'aim');
  assert.equal(state.shownCountForStep,0);
  assert.equal(state.reshowCount,0,'moving to a new step does not spend the raid-wide reshow budget');
  const events=tickFtueHints(state,{x:0,z:FTUE_HINT_MOVE_METERS,active:false,clockMs:50});
  assert.equal(state.visible,true,'the new step shows immediately too, for a fresh profile');
  assert.deepEqual(events,[{type:'shown',step:'aim'}]);
});

test('once the whole machine is done, it never becomes visible again',()=>{
  const state=createFtueHintState({startX:0,startZ:0,startMs:0});
  noteFtueHintShot(state,10);
  const events=tickFtueHints(state,{x:1000,z:1000,active:false,clockMs:999999});
  assert.equal(state.visible,false);
  assert.deepEqual(events,[]);
});
