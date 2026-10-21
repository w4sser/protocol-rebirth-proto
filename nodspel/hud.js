export function healthSegments(health,maxHealth,unit=1){return Array.from({length:Math.ceil(maxHealth/unit)},(_,i)=>Math.max(0,Math.min(1,(health-i*unit)/unit)));}
export function createHealthSegments(container,maxHealth,unit=1){
  const segments=healthSegments(maxHealth,maxHealth,unit).map(()=>document.createElement('i'));container.replaceChildren(...segments);return segments;
}
export function renderHealthSegments(segments,health,maxHealth,unit=1){
  const values=healthSegments(health,maxHealth,unit);
  segments.forEach((el,i)=>{el.style.setProperty('--health-fill',`${values[i]*100}%`);el.classList.toggle('empty',values[i]===0);});
}

// enterExit prepares the next level; the checkpoint still presents the one just cleared.
export function displayLevel(round,checkpoint=false){return checkpoint?(round.exitLevel??round.level):round.level;}
export function renderRoundClock(round,checkpoint,main,summary){
  const seconds=Math.ceil(round.remainingMs/1000),text=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  if(main.textContent!==text)main.textContent=text;
  if(checkpoint&&summary.textContent!==text)summary.textContent=text;
  return seconds;
}

// Tracked chain quest chip under the timer: live count = saved progress + what this raid has carried / killed so far.
export function questChip(quest,round){
  if(!quest)return null;
  const live=quest.type==='extract'?(quest.level&&!(round?.levelsCleared>=quest.level-1))?0:Math.max(0,Math.floor(round?.bag?.[quest.target]||0)):quest.type==='kill'?Math.max(0,Math.floor(round?.killsByType?.[quest.target]||0)):(round?.levelsCleared>=quest.target?1:0);
  const prog=Math.min(quest.n,quest.prog+live);
  return {type:quest.type,item:quest.type==='extract'?quest.target:null,prog,n:quest.n,done:prog>=quest.n};
}

// Compact room progress (top-right): three level pips (done / current / next) and the gate-control count shown as an icon tile.
export const ROOM_COUNT=3;
export function roomPips(number,total=ROOM_COUNT){return Array.from({length:total},(_,i)=>i+1<number?'done':i+1===number?'cur':'next');}
export function roomProgress(level,total=ROOM_COUNT){
  const lit=level.nodes.filter(n=>n.active).length,count=level.nodes.length;
  return {pips:roomPips(level.number,total),lit,total:count,text:`${lit}/${count}`,done:count>0&&lit>=count,label:`Room ${level.number} of ${total}: ${level.title}, gate controls ${lit} of ${count}`};
}
// Bag as icon tiles: one tile per item type with its count, in carry order.
export function bagTiles(bag){return Object.entries(bag??{}).filter(([,n])=>n>0).map(([id,n])=>({id,n}));}
