// Shared deterministic save seeds for the screenshot harness and browser layout regression.
export function chipSave(st,beats,built){
  st.introSeen=true;st.ftuePath=false; // Existing quest-introduced profile.
  st.beat=beats.findIndex(b=>b.id==='raid_1')+1;
  st.raids=1;st.modules.rebirth_core=1;st.modules.fabricator=built?1:0;
  st.baseState='core_habitable';st.roomUnlocks={fabricator:built};
  st.chains={bunker:{step:1,prog:0}};st.trackedQuest='bunker';
  st.stash={};st.cur.scrap=25;st.power={value:95,at:Date.now(),offlineDrained:0,reinforceAt:0,lastRoom:null,maintain:null};
  st.bitCardsSeen={core_restored:true,raid_briefing:true,fabricator_built:built,quest_intro:true,vault_intro:true};return st;
}
// Runs in the page. Return every actual intersection, even when the chip is non-interactive.
export function questChipRoomOverlaps(){
  // Portrait phones show the full-screen rotate guard, so the base is not interactive.
  const rotate=document.getElementById('rotate');
  if(rotate&&rotate.offsetHeight&&getComputedStyle(rotate).visibility!=='hidden')return [];
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
// BIT base briefings must leave every room label, room hitbox and goal chip visible.
export function baseBitCardRoomOverlaps(){
  const card=document.querySelector('.bit-card:not(.ctx-raid):not([hidden])');
  if(!card)return ['expected visible base BIT card'];
  const a=card.getBoundingClientRect(),errors=[];
  if(a.left<47||a.right>innerWidth-47||a.top<0||a.bottom>innerHeight-21)errors.push('BIT card outside safe area');
  for(const room of document.querySelectorAll('.baseviewer .mapspot,.baseviewer .mapspot .tag,.baseviewer>.progress-goal,.baseviewer>.goalpill')){
    if(!room.getClientRects().length||getComputedStyle(room).visibility==='hidden')continue;
    const b=room.getBoundingClientRect();
    if(Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top))errors.push(`BIT card covers ${room.getAttribute('aria-label')||room.textContent}`);
  }
  const bubble=card.querySelector('.bit-card-bubble'),cs=getComputedStyle(bubble);
  const height=bubble.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
  if(height>2*parseFloat(cs.lineHeight)+1)errors.push('BIT briefing exceeds two lines');
  return errors;
}
