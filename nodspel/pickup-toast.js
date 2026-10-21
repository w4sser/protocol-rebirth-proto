// In-raid pickup toasts (bag pickups only): icon + name in the item's rarity colour, near the bag panel, stacked, fading after
// TOAST_MS, never more than TOAST_MAX at once. Pure list logic; game.mjs renders it.
export const TOAST_MAX=3,TOAST_MS=1800;
let seq=0;
export function liveToasts(list,now){return list.filter(t=>now-t.at<TOAST_MS);}
// Returns the new list. The same item picked up again while its toast is still showing becomes one toast with a count.
export function pushPickup(list,item,now){
  const live=liveToasts(list,now),last=live[live.length-1];
  if(last&&last.item===item)return [...live.slice(0,-1),{...last,n:last.n+1,at:now}];
  return [...live,{id:++seq,item,n:1,at:now}].slice(-TOAST_MAX);
}
