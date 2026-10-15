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
