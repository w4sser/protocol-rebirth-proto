// Keyboard robustness: gameplay keys must never activate a focused HUD button
// (Space on a focused "Open bag" used to open the inventory, which then
// swallowed WASD until the canvas was clicked).
export const GAME_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight']);
export function isGameKey(code){return GAME_KEYS.has(code);}
// Inputs inside an open dialog keep normal keyboard behaviour.
export function isTypingTarget(target){return !!target&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName));}
// After a pointer click, drop focus from HUD buttons so later keys reach the game.
export function releaseButtonFocus(event,doc){
  const button=event?.target?.closest?.('button');
  if(button&&event.detail!==0&&doc.activeElement===button)button.blur();
  return !!button;
}
