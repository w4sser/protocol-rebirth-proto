import {goalProgress} from './progression-goal.js?v=2.28.0';
import {RARITY_ORDER,rarityOf} from './rarity.js?v=2.28.0';

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
    return {id,regressions:losses.filter(n=>n>0).length,loss:losses.reduce((sum,n,i)=>sum+n/before[i].need,0),rarity:RARITY_ORDER.indexOf(rarityOf(id)),protectedItem:Number(!!(itemDef(id)?.scouts||itemDef(id)?.protocolTarget)),value:itemDef(id)?.sellValue??0};
  });
  options.sort((a,b)=>a.regressions-b.regressions||a.loss-b.loss||a.protectedItem-b.protectedItem||a.value-b.value||a.rarity-b.rarity);
  return options[0]?.id??null;
}
// Advice is conservative: never recommend an action that increases any tracked
// upgrade deficit. A player can still override it with Choose other.
export function swapRecommendation(goal,bag,incoming){
  const dropId=suggestSwap(goal,bag,incoming);
  if(!dropId)return {action:'keep',dropId:null,reason:'No better trade available'};
  const before=goal?goalProgress(goal,bag).parts:[];
  const next={...bag,[dropId]:bag[dropId]-1,[incoming]:(bag[incoming]||0)+1};
  const after=goal?goalProgress(goal,next).parts:[];
  const lost=before.some((p,i)=>after[i].remaining>p.remaining);
  if(lost)return {action:'keep',dropId,reason:'Protects your upgrade materials'};
  if(before.some((p,i)=>after[i].remaining<p.remaining))return {action:'swap',dropId,reason:'Advances your tracked upgrade'};
  const oldItem=itemDef(dropId),newItem=itemDef(incoming);
  if(oldItem?.scouts||oldItem?.protocolTarget)return {action:'keep',dropId,reason:'Keep this progression item'};
  if(newItem?.scouts||newItem?.protocolTarget)return {action:'swap',dropId,reason:'Useful progression item'};
  const oldValue=oldItem?.sellValue??0,newValue=newItem?.sellValue??0;
  if(newValue>oldValue)return {action:'swap',dropId,reason:'Higher loot value'};
  if(newValue<oldValue)return {action:'keep',dropId,reason:'Current loot is worth more'};
  const rarityRank=id=>RARITY_ORDER.indexOf(rarityOf(id));
  return rarityRank(incoming)>rarityRank(dropId)
    ? {action:'swap',dropId,reason:'Higher rarity loot'}
    : {action:'keep',dropId,reason:'No improvement over your current loot'};
}
