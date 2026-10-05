export function beginAim(x,y){return {origin:{x,y},direction:null};}
export function dragAim(gesture,x,y){
  const dx=x-gesture.origin.x,dy=y-gesture.origin.y,length=Math.hypot(dx,dy);
  if(length>=6)gesture.direction={x:dx/length,y:dy/length};
  return gesture.direction;
}
export function releaseAim(gesture,cancelled=false){return cancelled?null:gesture.direction;}
