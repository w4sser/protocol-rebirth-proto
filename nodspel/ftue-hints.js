// Non-blocking FTUE move/shoot hints (PR 3, docs/ftue-design.md "Non-blocking move/shoot help").
// A small pure state machine, no DOM: game.mjs owns rendering, localStorage reads/writes and run-log
// wiring; this module only tracks step/move/shot/idle state so the rules (3 m move threshold, 8 s idle
// reshow cap, done persistence) stay unit-testable headless -- the same split as nodspel/dash.js and
// nodspel/item-hints.js.
export const FTUE_HINTS_KEY='pr_ftue_hints_v1';
export const FTUE_HINT_MOVE_METERS=3;
export const FTUE_HINT_SHOW_MS=4000;
export const FTUE_HINT_IDLE_MS=8000;
export const FTUE_HINT_REPLAY_IDLE_MS=12000;
export const FTUE_HINT_MAX_RESHOWS=3;
export const FTUE_HINT_KEEP_SHOOTING_SHOTS=3;

// Hints only ever run during the scripted FTUE raid or a fresh profile's first ordinary raid -- never
// again once a profile has completed one raid.
export function ftueHintsEligible({ftue=false,completedRaids=0}={}){
  return !!ftue||(Number(completedRaids)||0)===0;
}

// 'done' persistence (do not change SAVE_VERSION -- this is a plain localStorage key, same convention
// as nodspel/tutorial.js's nodspel.tutorial.seen and nodspel/ftue.js's pr_ftue_v1).
export function hintsPreviouslyDone(storage){
  try{return JSON.parse(storage?.getItem(FTUE_HINTS_KEY)||'null')?.done===true;}catch{return false;}
}
export function markHintsDone(storage){
  try{storage?.setItem(FTUE_HINTS_KEY,JSON.stringify({done:true}));}catch{}
}

export function createFtueHintState({startX=0,startZ=0,replay=false,startMs=0}={}){
  return {
    step:'move',startX,startZ,replay:!!replay,
    shotsFired:0,hitsLanded:0,
    stepStartMs:startMs,lastActivityMs:startMs,
    visible:false,shownAt:null,shownCountForStep:0,reshowCount:0,
  };
}

// A step's first appearance is instant for a fresh profile, but a replayed FTUE (the player already
// finished the hints once before, see hintsPreviouslyDone) waits for real idle before showing anything.
// Every later reappearance (reshow) always uses the shorter idle gap, replay or not.
function idleThreshold(state){
  return state.shownCountForStep>0?FTUE_HINT_IDLE_MS:(state.replay?FTUE_HINT_REPLAY_IDLE_MS:0);
}
function advanceStep(state,step,clockMs){
  state.step=step;state.stepStartMs=clockMs;state.lastActivityMs=clockMs;
  state.visible=false;state.shownAt=null;state.shownCountForStep=0;
}

// Call once per frame with the player's current position and whether the move/aim stick saw input
// this frame (resets the idle clock even before the move threshold is reached -- stick wiggle still
// counts as "the player is trying", it just cannot complete the move step by itself).
export function tickFtueHints(state,{x,z,active,clockMs}){
  const events=[];
  if(state.step==='done'){if(state.visible)state.visible=false;return events;}
  if(active)state.lastActivityMs=clockMs;
  if(state.step==='move'){
    const dist=Math.hypot(x-state.startX,z-state.startZ);
    if(dist>=FTUE_HINT_MOVE_METERS){
      events.push({type:'done',step:'move',ms:clockMs-state.stepStartMs});
      advanceStep(state,'aim',clockMs);
      return events;
    }
  }
  if(state.visible){
    if(clockMs-state.shownAt>=FTUE_HINT_SHOW_MS){state.visible=false;state.lastActivityMs=clockMs;}
    return events;
  }
  if(state.shownCountForStep>0&&state.reshowCount>=FTUE_HINT_MAX_RESHOWS)return events;
  if(clockMs-state.lastActivityMs>=idleThreshold(state)){
    state.visible=true;state.shownAt=clockMs;
    if(state.shownCountForStep>0){state.reshowCount++;events.push({type:'reshow',step:state.step});}
    else events.push({type:'shown',step:state.step});
    state.shownCountForStep++;
  }
  return events;
}

// Call exactly once per shot fired, from the real fire handler. A shot ends the hints outright --
// whichever step was showing, the player has demonstrably found the fire control.
export function noteFtueHintShot(state,clockMs){
  const events=[];
  state.shotsFired++;state.lastActivityMs=clockMs;
  if(state.step!=='done'){
    events.push({type:'done',step:state.step,ms:clockMs-state.stepStartMs});
    advanceStep(state,'done',clockMs);
  }
  return events;
}
// Call once per landed hit (any enemy damaged by the player), from the real hit-feedback handler.
export function noteFtueHintHit(state){state.hitsLanded++;}

// Optional lighter nudge: once 3 shots have landed with zero hits, the caller can show a plain
// "keep shooting" notice instead of/alongside the normal aim caption.
export function ftueHintKeepShooting(state){
  return state.shotsFired>=FTUE_HINT_KEEP_SHOOTING_SHOTS&&state.hitsLanded===0;
}

export function ftueHintDone(state){return state.step==='done';}
