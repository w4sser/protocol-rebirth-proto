import {RULES} from './levels.js?v=2.22.1';
export function beginAim(x,y){return {origin:{x,y},direction:null,target:null};}
export function facingDirection(aiming,walking,aim){return aiming?aim:walking;}
export function dragAim(gesture,x,y){
  const dx=x-gesture.origin.x,dy=y-gesture.origin.y,length=Math.hypot(dx,dy);
  if(length<RULES.aimControls.deadZonePx){gesture.target=null;return gesture.direction;}
  gesture.target={x:dx/length,y:dy/length};
  if(!gesture.direction)gesture.direction={...gesture.target};
  return gesture.direction;
}
export function stepAim(gesture,dt){
  if(!gesture?.target||!gesture.direction)return gesture?.direction??null;
  const rule=RULES.aimControls,from=Math.atan2(gesture.direction.y,gesture.direction.x),to=Math.atan2(gesture.target.y,gesture.target.x);
  const difference=Math.atan2(Math.sin(to-from),Math.cos(to-from));
  const limit=rule.maxTurnRadiansPerSecond*Math.max(0,dt);
  const turn=Math.max(-limit,Math.min(limit,difference*(1-Math.exp(-Math.max(0,dt)/rule.responseSeconds))));
  gesture.direction={x:Math.cos(from+turn),y:Math.sin(from+turn)};return gesture.direction;
}
// Brawl Stars cancel (docs/design-combat-feel-oct28.md §2.2a point 5): once the thumb is dragged back into
// the deadzone, gesture.target goes null (see dragAim) even though gesture.direction stays latched — release
// at that point is a cancel, not a shot in the stale direction.
export function releaseAim(gesture,cancelled=false){return cancelled||!gesture?.target?null:gesture.direction;}

// Remember modal-owned pointers until their release, even if the modal closes first.
export function createFireInputGate(){
  const suppressed=new Set();
  return {handle(event,modalOpen){
    const pointer=event.pointerId;
    if(event.type==='pointerdown'){
      if(modalOpen)suppressed.add(pointer);else suppressed.delete(pointer);
      return modalOpen;
    }
    if(event.type==='pointerup'||event.type==='pointercancel'){
      const blocked=modalOpen||suppressed.has(pointer);suppressed.delete(pointer);return blocked;
    }
    return modalOpen;
  }};
}

// Activate on release without depending on a browser-synthesized touch click.
export function bindHUDTap(button,activate){
  let pointer=null,suppressClick=false;
  button.addEventListener('pointerdown',e=>{
    if(e.button!=null&&e.button!==0||pointer!==null)return;
    e.preventDefault();pointer=e.pointerId;suppressClick=false;
    try{button.setPointerCapture(e.pointerId);}catch{}
  });
  button.addEventListener('pointerup',e=>{
    if(e.pointerId!==pointer)return;
    pointer=null;suppressClick=true;e.preventDefault();activate();
  });
  const cancel=()=>{pointer=null;};
  button.addEventListener('pointercancel',cancel);
  button.addEventListener('lostpointercapture',cancel);
  button.addEventListener('click',e=>{
    if(suppressClick&&e.detail!==0){suppressClick=false;e.preventDefault();return;}
    suppressClick=false;activate();
  });
}

// All floating-stick geometry shares the touchdown origin, including the visible thumb.
export function stickOffset(origin,x,y){
  const dx=x-origin.x,dy=y-origin.y,length=Math.hypot(dx,dy),radius=RULES.aimControls.stickRadiusPx;
  const scale=length>radius?radius/length:1;
  return {x:dx*scale,y:dy*scale,manual:length>=RULES.aimControls.deadZonePx};
}
export function finishGesture(gesture,x,y,elapsed,dragged,cancelled=false){
  if(cancelled)return null;
  dragAim(gesture,x,y);
  if(!gesture.target)return !dragged&&elapsed<RULES.aimControls.tapMs?'tap':null;
  return gesture.target;
}
