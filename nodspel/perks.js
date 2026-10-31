import '../data/raid-perks.js?v=2.18.1';
import {heal} from './stakes.js?v=2.18.1';
import {RULES} from './levels.js?v=2.18.1';
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
  if(e.kind==='weakSide'){
    sum.weakSides??={};sum.weakSides[e.bonus]=(sum.weakSides[e.bonus]??0)+1;
    round.weakSides??={};round.weakSides[e.bonus]=(round.weakSides[e.bonus]??0)+1;
  }
  return e;
}
function weakSideSummary(counts){return Object.entries(counts??{}).map(([kind,count])=>`${kind==='flank'?'Flank':'Unaware'}: ${count} ${count===1?'hit':'hits'}.`).join(' ');}
export function recap(round,key){
  const sum=perkState(round).summaries[key],top=Object.entries(sum?.damage??{}).sort((a,b)=>b[1].amount-a[1].amount)[0];
  return [top?`${top[0]}: ${Number(top[1].amount.toFixed(1))} damage.`:'No damage taken in this room.',
    top?`${top[1].event.moving?'Moving':'Stationary'} when hit.`:'No incoming hits recorded.',
    sum?.lastPerk?.text??'No perk activation.',...(sum?.weakSides?[weakSideSummary(sum.weakSides)]:[])];
}
export function deathLine(round){const e=round.lastDamageEvent;const weak=round.weakSides?` ${weakSideSummary(round.weakSides)}`:'';return (e?`Last hit: ${e.source} / ${e.attack}, ${Number(e.amount.toFixed(1))} damage. ${e.moving?'Moving':'Stationary'} when hit.`:'No damage event recorded.')+weak;}
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
  const s=perkState(round);if(round.over)return [];
  ownRooms(round.level);const index=roomAt(round.level,position);if(index>=0)round.currentRoom=index;
  const cleared=[];
  for(let i=0;i<round.level.rooms.length;i++){
    const key=roomKey(round,i),r=s.rooms[key]??={state:'unresolved',entered:false,level:round.level.number,index:i};
    if(index===i)r.entered=true;
    // Defeated enemies stay in the level: require an actual encounter before rewarding a clear.
    // Dormant reserves count only after activation, just as they do when blocking a clear.
    const roomEnemies=round.level.enemies.filter(e=>e.homeRoom===i&&e.type!=='generator'&&e.active!==false);
    if(r.state==='unresolved'&&r.entered&&roomEnemies.length&&!roomEnemies.some(e=>e.health>0)){
      s.clearCount=(s.clearCount??0)+1;
      if(s.clearCount%PERKS.clearsPerOffer){r.state='cleared';cleared.push(key);continue;}
      r.state='clearPending';r.clearedAt=Math.max(...roomEnemies.map(e=>e.diedAt??round.gameNow??0));cleared.push(key);
      // A presented/minimized offer keeps its place: later clears must not invalidate its three cards.
      const presented=s.rooms[s.queue[0]]?.state==='rewardPending'?s.queue.shift():null;
      s.queue.push(key);s.queue.sort((a,b)=>{const x=s.rooms[a],y=s.rooms[b];return x.level-y.level||x.index-y.index;});
      if(presented)s.queue.unshift(presented);
    }
  }
  return cleared;
}
export function safePick(round,combat,position,now,hazardState){
  const s=perkState(round),key=s.queue[0];if(!key||s.minimized===key||round.over)return null;
  const room=s.rooms[key];if(roomAt(round.level,position)!==room.index||room.level!==round.level.number)return null;
  if(round.level.enemies.some(e=>e.health>0&&e.active!==false&&e.type!=='generator'&&roomAt(round.level,e)===room.index))return null;
  // Conservative: already released shots, blasts and telegraphs must finish naturally.
  if(combat.projectiles.some(b=>!b.sleeping)||combat.blasts.some(b=>!b.sleeping)||round.level.enemies.some(e=>!e.sleeping&&e.health>0&&(e.windupAt!=null||e.attackPhase==='warning'||e.attackPhase==='burst')))return null;
  if((round.level.hazards??[]).some(h=>Math.abs(position.x-h.x)<=h.w/2&&Math.abs(position.z-h.z)<=h.d/2&&hazardState(h,now)==='on'))return null;
  return key;
}
// Perk picker timing (docs/design-combat-feel-oct28.md §2.1.1): the room must be safePick()-safe continuously
// for calmMs before opening, and killDelayMs must have elapsed since the room's last kill. The raid
// timer keeps running throughout this wait; only openPerk() -> pausePick() actually freezes the game clock.
export function pickReady(round,combat,position,now,hazardState,readoutVisible=false){
  if(readoutVisible)return null;
  const s=perkState(round),key=safePick(round,combat,position,now,hazardState);
  if(!key){s.calmSince=null;s.calmKey=null;return null;}
  const room=s.rooms[key],lastKillAt=Math.max(room.clearedAt??now,room.lastKillAt??0);
  if(s.calmKey!==key||s.calmKillAt!==lastKillAt){s.calmKey=key;s.calmKillAt=lastKillAt;s.calmSince=now;}
  if(now-lastKillAt<RULES.perkPick.killDelayMs)return null;
  if(now-s.calmSince<RULES.perkPick.calmMs)return null;
  return key;
}
// Hitstop: a brief freeze of the paused game clock (gameTime/pausePick/resumePick), not a second clock. The
// real frame loop keeps rendering and reading input while paused; only the game simulation step is skipped
// (game.mjs resumes automatically once Date.now() reaches round.hitstopUntil). ms is extended, never shortened,
// if a new hitstop lands while one is already running (e.g. a kill right after a hit).
export function hitstop(round,ms,wall=Date.now()){
  advanceHitstop(round,wall);
  if(round.pauseAt!=null&&round.hitstopUntil==null)return;
  if(round.pauseAt==null)round.pauseAt=gameTime(round,wall);
  round.hitstopUntil=Math.max(round.hitstopUntil??wall,wall+ms);
}
export function advanceHitstop(round,wall){
  if(round?.hitstopUntil==null||wall<round.hitstopUntil)return;
  const until=round.hitstopUntil;round.hitstopUntil=null;resumePick(round,until);
}
export function inputPaused(round){return round?.pauseAt!=null&&round.hitstopUntil==null;}
export function offer(round,key){
  const s=perkState(round),r=s.rooms[key];if(!r)return [];
  if(!r.offer){let seed=2166136261;for(const c of `${round.seed}:${key}`)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
    const pool=cards.filter(c=>!s.taken.includes(c.id)).map(c=>c.id);
    for(let i=pool.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
    r.offer=pool.slice(0,3);
  }r.state='rewardPending';return r.offer;
}
export function gameTime(round,wall){return round?.pauseAt??wall-(round?.pausedMs??0);}
export function pausePick(round,wall){if(round.hitstopUntil!=null){advanceHitstop(round,wall);round.hitstopUntil=null;}if(round.pauseAt!=null)return;round.pauseAt=gameTime(round,wall);}
export function resumePick(round,wall){if(round.pauseAt==null)return;round.pausedMs=wall-round.pauseAt;round.pauseAt=null;}
export function hasPerk(round,id){return !!round?.perks?.taken.includes(id)&&!round.perks.terminalCards?.includes(id);}
export function terminalPick(round,key){const r=perkState(round).rooms[key];return r?.level===3&&r.index===round.level.rooms.length-1;}
export function cardEffect(round,key,id){
  if(terminalPick(round,key))return {roll:'Reset dash now.',recon:'Reveal all remaining loot boxes.',dressing:'Restore up to 20 HP immediately.'}[id]??cards.find(c=>c.id===id).effect;
  return cards.find(c=>c.id===id).effect;
}
export function choosePerk(round,key,id,now,dash){
  const s=perkState(round),r=s.rooms[key];
  if(round.over||s.queue[0]!==key||!r||r.state!=='rewardPending'||!r.offer?.includes(id)||s.taken.includes(id))return false;
  s.taken.push(id);r.state='rewarded';s.queue.shift();s.minimized=null;
  const terminal=terminalPick(round,key);(s.selectedEffects??={})[id]=cardEffect(round,key,id);if(terminal&&['roll','recon'].includes(id))(s.terminalCards??=[]).push(id);let text=`${cards.find(c=>c.id===id).name}: equipped.`;
  if(id==='dressing'){const hp=heal(round,now,Math.min(PERKS.dressingHP,round.maxHealth-round.health));text=`Field Dressing: restored ${hp} HP.`;}
  if(id==='roll'&&terminal){if(dash)dash.readyAt=now;text='Rolling: dash reset.';}
  if(id==='recon'&&terminal){s.revealAll=true;text=`Recon: ${round.level.lootBoxes.filter(b=>!b.collected).length} remaining loot boxes marked.`;}
  logCombat(round,{kind:id==='dressing'||terminal&&['roll','recon'].includes(id)?'perk':'choice',perk:id,at:now,room:key,text});return text;
}
// Resolve through choosePerk so automatic choices have exactly the same effects as manual ones.
export function autoPickPerks(round,now,dash,{all=false}={}){
  const s=perkState(round),picked=[];
  while(!round.over&&s.queue.length){
    const key=s.queue[0],id=offer(round,key)[0];
    if(id&&choosePerk(round,key,id,now,dash)){
      const text=`Auto-picked: ${cards.find(c=>c.id===id).name}`;
      logCombat(round,{kind:'perk',perk:id,room:key,at:now,text});picked.push(text);
    }else{
      // Exhausted offers cannot strand a room (all unique perks may already be owned).
      if(s.rooms[key])s.rooms[key].state='rewarded';
      s.queue.shift();s.minimized=null;
    }
    if(!all)break;
  }
  return picked;
}
export function reloadInterval(round,ms){return hasPerk(round,'reload')?Math.max(PERKS.reloadFloorMs,ms*PERKS.reloadMultiplier):ms;}
export function dashInterval(round,ms){return hasPerk(round,'roll')?Math.max(PERKS.dashFloorMs,ms*PERKS.dashMultiplier):ms;}
export function resetPerks(round){if(round.perks){round.raidPerksTaken=[...new Set([...(round.raidPerksTaken??[]),...round.perks.taken])];round.perks.taken=[];round.perks.queue=[];round.perks.chain=false;round.perks.shieldUntil=0;round.perks.revealAll=false;round.perks.terminalCards=[];round.perks.selectedEffects={};}}
