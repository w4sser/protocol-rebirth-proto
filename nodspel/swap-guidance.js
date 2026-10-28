import {goalProgress} from './progression-goal.js?v=2.7.0';
import {RARITY_ORDER,rarityOf} from './rarity.js?v=2.7.0';

const itemDef=id=>globalThis.DATA.items.find(item=>item.id===id);
const relates=(part,id)=>part.kind==='currency'?!!itemDef(id)?.grantsCurrency?.[part.id]:part.id===id;

// A carried unit is needed if removing that one unit increases a goal deficit.
// This handles duplicates, supplies already at home, and salvage-to-currency conversion.
export function swapItemStatus(goal,bag,id,incoming=false){
  if(!goal)return null;
  const before=goalProgress(goal,bag).parts;
  if(!before.some(p=>relates(p,id)))return 'OTHER USE';
  if(incoming)return before.some(p=>relates(p,id)&&p.remaining>0)?'NEEDED NOW':'TARGET MET';
  const after=goalProgress(goal,{...bag,[id]:Math.max(0,(bag[id]||0)-1)}).parts;
  return before.some((p,i)=>after[i].remaining>p.remaining)?'NEEDED NOW':'TARGET MET';
}

export function suggestSwap(goal,bag,incoming){
  const before=goal?goalProgress(goal,bag).parts:[];
  const options=Object.entries(bag).filter(([id,n])=>n>0&&id!==incoming).map(([id])=>{
    const next={...bag,[id]:bag[id]-1,[incoming]:(bag[incoming]||0)+1};
    const after=goal?goalProgress(goal,next).parts:[];
    // Protect each requirement individually: gaining one resource never cancels
    // losing another required resource. Rarity breaks equally safe ties.
    const losses=after.map((p,i)=>Math.max(0,p.remaining-before[i].remaining));
    return {id,regressions:losses.filter(n=>n>0).length,loss:losses.reduce((sum,n,i)=>sum+n/before[i].need,0),rarity:RARITY_ORDER.indexOf(rarityOf(id))};
  });
  options.sort((a,b)=>a.regressions-b.regressions||a.loss-b.loss||a.rarity-b.rarity);
  return options[0]?.id??null;
}
