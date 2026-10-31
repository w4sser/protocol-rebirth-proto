import {enterExit} from '../round.js';
// Existing progression tests specify the completion timestamp; begin the deliberate
// hold one second earlier. Lock and input timing are covered in extract-hold.test.mjs.
export function holdExit(round,position,now){
  enterExit(round,position,now-1000,true);
  return enterExit(round,position,now,true);
}
