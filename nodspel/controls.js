import {RULES} from './levels.js?v=1.36.0';
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
export function releaseAim(gesture,cancelled=false){return cancelled?null:gesture.direction;}
