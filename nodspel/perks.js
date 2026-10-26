import '../data/raid-perks.js?v=2.3.1';
export const PERKS=globalThis.DATA.raidPerks;
export const cards=PERKS.cards;
export function perkState(round){return round.perks??= {taken:[],rooms:{},queue:[],events:[],summaries:{},chain:false,shieldRooms:[],shieldUntil:0};}
export function roomAt(level,p){return level.rooms.findIndex(r=>Math.abs(p.x-r.x)<=r.w/2&&Math.abs(p.z-r.z)<=r.d/2);}
export function roomKey(round,index=round.currentRoom??0){return `${round.level.number}:${index}`;}
export function ownRooms(level){
  for(const e of level.enemies){
    e.homeRoom??=roomAt(level,e);
  }
}
export function logCombat(round,event){
  const s=perkState(round),key=event.room??roomKey(round),e={at:round.gameNow??0,...event,room:key};
  s.events.push(e);if(s.events.length>PERKS.logLimit)s.events.splice(0,s.events.length-PERKS.logLimit);
  const sum=s.summaries[key]??={damage:{},lastHit:null,lastPerk:null};
  if(e.kind==='damage'){
    const id=`${e.source??'Unknown'} / ${e.attack??'hit'}`,d=sum.damage[id]??={amount:0,event:e};
    d.amount+=e.amount;d.event=e;sum.lastHit=e;round.lastDamageEvent=e;
  }
  if(e.kind==='perk')sum.lastPerk=e;
  return e;
}
export function recap(round,key){
  const sum=perkState(round).summaries[key],top=Object.entries(sum?.damage??{}).sort((a,b)=>b[1].amount-a[1].amount)[0];
  return [top?`${top[0]}: ${Number(top[1].amount.toFixed(1))} damage.`:'No damage taken in this room.',
    top?`${top[1].event.moving?'Moving':'Stationary'} when hit.`:'No incoming hits recorded.',
    sum?.lastPerk?.text??'No perk activation.'];
}
export function deathLine(round){const e=round.lastDamageEvent;return e?`Last hit: ${e.source} / ${e.attack}, ${Number(e.amount.toFixed(1))} damage. ${e.moving?'Moving':'Stationary'} when hit.`:'No damage event recorded.';}
export function lastCombatFeedback(round){
  const events=round.perks?.events??[],e=[...events].reverse().find(e=>e.kind==='perk'||e.kind==='outcome');
  if(!e)return '';
  if(e.kind==='perk')return e.text;
  const shot=events.find(s=>s.kind==='shot'&&s.shotId===e.shotId),reason=shot?.rejections?.[0]?.reason;
  return `${e.moving?'Moving':'Stationary'} at last shot: ${e.outcome}${e.outcome==='miss'&&reason?`; assist rejected: ${reason}`:''}.`;
}
export function reconLootVisible(round,box){
  if(box.collected)return false;
  const s=round.perks;if(s?.revealAll)return true;
  const index=roomAt(round.level,box);return hasPerk(round,'recon')&&index>=0&&!!s.rooms[roomKey(round,index)]&&s.rooms[roomKey(round,index)].state!=='unresolved';
}
export function updateClears(round,position){
  const s=perkState(round);if(round.over)return;
  ownRooms(round.level);const index=roomAt(round.level,position);if(index>=0)round.currentRoom=index;
  for(let i=0;i<round.level.rooms.length;i++){
    const key=roomKey(round,i),r=s.rooms[key]??={state:'unresolved',entered:false,level:round.level.number,index:i};
    if(index===i)r.entered=true;
    if(r.state==='unresolved'&&r.entered&&!round.level.enemies.some(e=>e.homeRoom===i&&e.type!=='generator'&&e.active!==false&&e.health>0)){
      r.state='clearPending';
      // A presented/minimized offer keeps its place: later clears must not invalidate its three cards.
      const presented=s.rooms[s.queue[0]]?.state==='rewardPending'?s.queue.shift():null;
      s.queue.push(key);s.queue.sort((a,b)=>{const x=s.rooms[a],y=s.rooms[b];return x.level-y.level||x.index-y.index;});
      if(presented)s.queue.unshift(presented);
    }
  }
}
export function safePick(round,combat,position,now,hazardState){
  const s=perkState(round),key=s.queue[0];if(!key||s.minimized===key||round.over)return null;
  const room=s.rooms[key];if(roomAt(round.level,position)!==room.index||room.level!==round.level.number)return null;
  if(round.level.enemies.some(e=>e.health>0&&e.active!==false&&e.type!=='generator'&&roomAt(round.level,e)===room.index))return null;
  // Conservative: already released shots, blasts and telegraphs must finish naturally.
  if(combat.projectiles.length||combat.blasts.length||round.level.enemies.some(e=>e.health>0&&(e.windupAt!=null||e.attackPhase==='warning'||e.attackPhase==='burst')))return null;
  if((round.level.hazards??[]).some(h=>Math.abs(position.x-h.x)<=h.w/2&&Math.abs(position.z-h.z)<=h.d/2&&hazardState(h,now)==='on'))return null;
  return key;
}
export function offer(round,key){
  const s=perkState(round),r=s.rooms[key];if(!r)return [];
  if(!r.offer){let seed=2166136261;for(const c of `${round.seed}:${key}`)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
    const pool=cards.filter(c=>!s.taken.includes(c.id)).map(c=>c.id);
    for(let i=pool.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
    r.offer=pool.slice(0,3);
  }r.state='rewardPending';return r.offer;
}
export function gameTime(round,wall){return round?.pauseAt??wall-(round?.pausedMs??0);}
export function pausePick(round,wall){if(round.pauseAt!=null)return;round.pauseAt=gameTime(round,wall);}
export function resumePick(round,wall){if(round.pauseAt==null)return;round.pausedMs=wall-round.pauseAt;round.pauseAt=null;}
export function addRaidTime(round,ms){round.durationMs+=ms;round.deadline+=ms;round.remainingMs+=ms;}
export function hasPerk(round,id){return !!round?.perks?.taken.includes(id)&&!round.perks.terminalCards?.includes(id);}
export function terminalPick(round,key){const r=perkState(round).rooms[key];return r?.level===3&&r.index===round.level.rooms.length-1;}
export function cardEffect(round,key,id){
  if(terminalPick(round,key))return {roll:'Reset dash now and add 3 s raid time.',recon:'Reveal all remaining loot boxes and add 5 s.',dressing:'Restore up to 20 HP and add 8 s raid time.'}[id]??cards.find(c=>c.id===id).effect;
  return cards.find(c=>c.id===id).effect;
}
export function choosePerk(round,key,id,now,dash){
  const s=perkState(round),r=s.rooms[key];
  if(round.over||s.queue[0]!==key||!r||r.state!=='rewardPending'||!r.offer?.includes(id)||s.taken.includes(id))return false;
  s.taken.push(id);r.state='rewarded';s.queue.shift();s.minimized=null;
  const terminal=terminalPick(round,key);(s.selectedEffects??={})[id]=cardEffect(round,key,id);if(terminal&&['roll','recon'].includes(id))(s.terminalCards??=[]).push(id);let text=`${cards.find(c=>c.id===id).name}: equipped.`;
  if(id==='dressing'){const hp=Math.min(PERKS.dressingHP,round.maxHealth-round.health);round.health+=hp;text=`Field Dressing: restored ${hp} HP.`;}
  if(id==='time'||terminal&&['roll','recon','dressing'].includes(id)){
    const ms=id==='time'?PERKS.timeMs:id==='roll'?PERKS.terminalDashMs:id==='recon'?PERKS.terminalReconMs:PERKS.terminalDressingMs;
    addRaidTime(round,ms);text=id==='time'?`Time Margin: added ${ms/1000} s.`:text+` Added ${ms/1000} s.`;
  }
  if(id==='roll'&&terminal){if(dash)dash.readyAt=now;text='Rolling: dash reset; added 3 s.';}
  if(id==='recon'&&terminal){s.revealAll=true;text=`Recon: ${round.level.lootBoxes.filter(b=>!b.collected).length} remaining loot boxes marked; added 5 s.`;}
  logCombat(round,{kind:['time','dressing'].includes(id)||terminal&&['roll','recon'].includes(id)?'perk':'choice',perk:id,at:now,room:key,text});return text;
}
export function reloadInterval(round,ms){return hasPerk(round,'reload')?Math.max(PERKS.reloadFloorMs,ms*PERKS.reloadMultiplier):ms;}
export function dashInterval(round,ms){return hasPerk(round,'roll')?Math.max(PERKS.dashFloorMs,ms*PERKS.dashMultiplier):ms;}
export function resetPerks(round){if(round.perks){round.perks.taken=[];round.perks.queue=[];round.perks.chain=false;round.perks.shieldUntil=0;round.perks.revealAll=false;round.perks.terminalCards=[];round.perks.selectedEffects={};}}
