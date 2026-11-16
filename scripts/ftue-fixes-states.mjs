// Shared deterministic save seeds for the screenshot harness and browser layout regression.
export function chipSave(st,beats,built){
  st.introSeen=true;
  st.beat=beats.findIndex(b=>b.id==='raid_1')+1;
  st.raids=1;st.modules.rebirth_core=1;st.modules.fabricator=built?1:0;
  st.baseState='core_habitable';st.roomUnlocks={fabricator:built};
  st.chains={bunker:{step:1,prog:0}};st.trackedQuest='bunker';
  st.stash={};st.cur.scrap=25;st.power={value:95,at:Date.now(),offlineDrained:0,reinforceAt:0,lastRoom:null,maintain:null};
  st.bitCardsSeen={};return st;
}
// Runs in the page. Return every actual intersection, even when the chip is non-interactive.
export function questChipRoomOverlaps(){
  const shown=e=>e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
  const chips=[...document.querySelectorAll('.baseviewer>.progress-goal,.baseviewer>.goalpill')].filter(shown);
  const rooms=[...document.querySelectorAll('.baseviewer .mapspot,.baseviewer .mapspot .tag')].filter(shown);
  const errors=[];
  if(chips.length!==1)errors.push(`expected one discoverable quest/goal chip, got ${chips.length}`);
  for(const chip of chips){
    const a=chip.getBoundingClientRect();
    if(a.left<0||a.top<0||a.right>innerWidth||a.bottom>innerHeight)errors.push('chip outside viewport');
    for(const room of rooms){
      const b=room.getBoundingClientRect();
      if(Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top))errors.push(`chip covers ${room.getAttribute('aria-label')||room.textContent}`);
      // Every visible room center must remain independent of the quest chip's hit area.
      const x=b.left+b.width/2,y=b.top+b.height/2;
      if(x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&chip.contains(document.elementFromPoint(x,y)))errors.push('chip swallows room tap');
    }
  }
  return errors;
}
