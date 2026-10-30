import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,takeDamage,tickRound,enterExit,hitEnemy,extractRound} from '../round.js';
import {createCombat,stepCombat,stepHazards} from '../combat.js';
import {createWeapon,fireAimedWeapon,stepWeapon,tickWeapon} from '../weapon.js';
import {createBIT,stepBIT} from '../bit.js';
import {createDash} from '../dash.js';
import {cards,perkState,ownRooms,updateClears,offer,choosePerk,safePick,recap,logCombat,deathLine,pausePick,resumePick,gameTime,dashInterval,reloadInterval} from '../perks.js';
const point={x:0,z:0},foe=(id,x=0)=>({id,kind:'enemy',aggro:true,facing:0,type:'grunt',x,z:0,r:.48,health:2,active:true});
function arena(){const r=createRound('pr2',0);Object.assign(r.level,{rooms:[{x:0,z:0,w:10,d:10},{x:20,z:0,w:10,d:10}],enemies:[foe('a'),foe('b',20)],nodes:[],hazards:[],walls:[],boxes:[],start:point,floors:[{x:10,z:0,w:40,d:20}],exit:{x:0,z:0,r:1}});return r;}
function select(r,id,index=0){const s=perkState(r),key=`${r.level.number}:${index}`;s.rooms[key]={state:'rewardPending',level:r.level.number,index,offer:[id]};s.queue.push(key);return choosePerk(r,key,id,100,createDash());}

test('room clear uses original ownership, excludes inactive reserves and generator, rewards once',()=>{
  const r=arena();r.level.enemies.push({...foe('reserve'),active:false},{...foe('generator'),type:'generator'});ownRooms(r.level);
  r.level.enemies[0].x=20;updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved');
  r.level.enemies[0].health=0;updateClears(r,point);assert.deepEqual(perkState(r).queue,['1:0']);
  const ids=offer(r,'1:0');assert.equal(new Set(ids).size,3);assert.ok(choosePerk(r,'1:0',ids[0],100));
  r.level.enemies.push(foe('late'));updateClears(r,point);r.level.enemies.at(-1).health=0;updateClears(r,point);
  assert.deepEqual(perkState(r).queue,[]);assert.equal(perkState(r).rooms['1:1'].entered,false);
});
test('activated living reserves block clear until defeated, including after ownership was assigned inactive',()=>{
  const r=arena(),reserve={...foe('reserve'),active:false};r.level.enemies.push(reserve);ownRooms(r.level);
  updateClears(r,point);reserve.active=true;r.level.enemies[0].health=0;updateClears(r,point);
  assert.equal(perkState(r).rooms['1:0'].state,'unresolved');assert.deepEqual(perkState(r).queue,[]);
  reserve.health=0;updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'clearPending');assert.deepEqual(perkState(r).queue,['1:0']);
});
test('a dormant swarm body cannot grant a clear; branches never grant rewards',()=>{
  const r=arena();r.level.enemies=[{...foe('swarm'),active:false,swarm:'spawn'}];updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved');assert.equal(perkState(r).queue.length,0);
  updateClears(r,{x:100,z:100});assert.equal(Object.keys(perkState(r).rooms).length,2);
  r.level.enemies[0].active=true;r.level.enemies[0].health=0;updateClears(r,point);assert.equal(perkState(r).queue.length,1);
});
test('safe queue waits for foreign bodies, projectiles, bombs, warnings and active hazard',()=>{
  const r=arena(),c=createCombat(r.level,0);r.level.enemies[0].health=0;updateClears(r,point);
  assert.equal(safePick(r,c,point,1,()=> 'off'),'1:0');
  for(const field of ['projectiles','blasts']){c[field].push({});assert.equal(safePick(r,c,point,1,()=> 'off'),null);c[field]=[];}
  r.level.enemies[1].x=0;assert.equal(safePick(r,c,point,1,()=> 'off'),null);r.level.enemies[1].x=20;
  r.level.hazards=[{...point,w:2,d:2}];assert.equal(safePick(r,c,point,1,()=> 'on'),null);
  r.level.enemies[1].windupAt=20;assert.equal(safePick(r,c,point,1,()=> 'off'),null);
});
test('all six offers have three distinct untaken cards, stable across reopening',()=>{
  const r=arena(),s=perkState(r);assert.equal(cards.length,8);
  for(let i=0;i<6;i++){const key=`${i}:0`;s.rooms[key]={state:'clearPending',level:1,index:0};s.queue.push(key);const ids=offer(r,key);assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert.ok(ids.every(id=>!s.taken.includes(id)));assert.deepEqual(offer(r,key),ids);assert.ok(choosePerk(r,key,ids[0],100));assert.equal(choosePerk(r,key,ids[0],100),false);}
});
test('a minimized presented offer cannot be invalidated by a later clear in an earlier room',()=>{
  const r=arena();r.level.enemies[1].health=0;updateClears(r,{x:20,z:0});const before=offer(r,'1:1');perkState(r).minimized='1:1';
  r.level.enemies[0].health=0;updateClears(r,point);assert.deepEqual(perkState(r).queue,['1:1','1:0']);assert.deepEqual(offer(r,'1:1'),before);
  assert.ok(choosePerk(r,'1:1',before[0],100));assert.ok(offer(r,'1:0').every(id=>id!==before[0]));
});
test('full paused clock freezes deadline, enemies, hazards, weapon and BIT including long hidden tab',()=>{
  const r=arena(),c=createCombat(r.level,0),w=createWeapon(30),bit=createBIT(point);r.health=50;r.level.hazards=[{...point,w:2,d:2,phaseMs:0,dps:20}];
  fireAimedWeapon(w,r,point,{x:1,z:0},100,[]);const snapshot=JSON.stringify({ammo:w.ammo,shots:w.projectiles,health:r.health,enemies:r.level.enemies});
  tickRound(r,1000);const remaining=r.remainingMs;pausePick(r,1000);tickRound(r,9999999);stepCombat(r,c,point,9999999,1,[]);stepHazards(r,point,9999999,1);stepWeapon(w,r,9999999,1,[]);tickWeapon(w,9999999,r);stepBIT(bit,r,point,1,false,[],r.level.floors);
  assert.equal(r.remainingMs,remaining);assert.equal(r.over,false);assert.equal(gameTime(r,9999999),1000);
  assert.equal(JSON.stringify({ammo:w.ammo,shots:w.projectiles,health:r.health,enemies:r.level.enemies}),snapshot);
  resumePick(r,10000000);assert.equal(gameTime(r,10000000),1000);tickRound(r,gameTime(r,10001000));assert.equal(r.remainingMs,remaining-1000);
  pausePick(r,10001000);resumePick(r,10011000);assert.equal(gameTime(r,10012000),3000);
});
test('chain consumes charge on real shot, adds measured damage, never from generators',()=>{
  const r=arena();r.level.enemies=[foe('weak',2),{...foe('strong',5),health:10}];select(r,'chain');const w=createWeapon(Infinity,{damage:2});
  const a=fireAimedWeapon(w,r,point,{x:1,z:0},1000,[]);assert.ok(a);assert.equal(perkState(r).chain,false);stepWeapon(w,r,1200,.2,[]);assert.equal(perkState(r).chain,true);
  const b=fireAimedWeapon(w,r,point,{x:1,z:0},2000,[]);assert.equal(b.bonus,true);assert.equal(r.level.enemies[1].health,10);stepWeapon(w,r,2400,.4,[]);assert.equal(r.level.enemies[1].health,7);assert.equal(perkState(r).chain,false);
  assert.match(perkState(r).events.find(e=>e.perk==='chain'&&e.text.includes('extra'))?.text,/1 extra damage/);
  perkState(r).chain=true;fireAimedWeapon(w,r,point,{x:-1,z:0},3000,[]);assert.equal(perkState(r).chain,false);stepWeapon(w,r,3100,5,[]);assert.ok(perkState(r).events.some(e=>e.outcome==='miss'));
  r.level.enemies=[{...foe('gen',2),type:'generator'}];fireAimedWeapon(w,r,point,{x:1,z:0},4000,[]);assert.equal(perkState(r).chain,false);
});
test('reload interval and dash floors apply without changing ammunition budgets',()=>{
  const r=arena();select(r,'reload');select(r,'roll');assert.equal(reloadInterval(r,1000),800);assert.equal(reloadInterval(r,100),250);assert.equal(dashInterval(r,6000),4500);assert.equal(dashInterval(r,1000),1500);
  const w=createWeapon(10,{capacity:2,reloadMs:1000});fireAimedWeapon(w,r,point,{x:-1,z:0},1000,[]);assert.equal(w.reloadAt,1800);const total=w.ammo+w.reserve;tickWeapon(w,1800,r);assert.equal(w.ammo+w.reserve,total);assert.equal(w.ammo,2);
});
test('emergency shield does not reduce trigger or revive, budgets each room once',()=>{
  const r=arena();select(r,'shield');r.health=30;takeDamage(r,15,1000);assert.equal(r.health,15);takeDamage(r,10,1100);assert.equal(r.health,10);
  assert.match(recap(r,'1:0')[2],/prevented 5/);takeDamage(r,4,4000);assert.equal(r.health,6);takeDamage(r,2,4100);assert.equal(r.health,4);
  r.currentRoom=1;r.health=25;takeDamage(r,10,5000);takeDamage(r,10,5100);assert.equal(r.health,10);
  r.currentRoom=0;takeDamage(r,100,8000);assert.equal(r.reason,'death');assert.equal(r.health,0);assert.equal(perkState(r).taken.length,0);
});
test('field medic shares normal stationary healing constraints and clamps HP',()=>{
  const r=arena();select(r,'medic');r.health=80;const bit=createBIT(point);stepBIT(bit,r,point,1,false,[],r.level.floors);assert.equal(r.health,88);
  stepBIT(bit,r,point,1,true,[],r.level.floors);assert.equal(r.health,88);r.health=98;stepBIT(bit,r,point,1,false,[],r.level.floors);assert.equal(r.health,100);assert.match(recap(r,'1:0')[2],/healed 2 HP/);
});
test('health clamps and combat perks preserve the raid clock and reset on extraction',()=>{
  const r=arena();r.health=95;select(r,'dressing');assert.equal(r.health,100);assert.match(recap(r,'1:0')[2],/5 HP/);const deadline=r.deadline,duration=r.durationMs;select(r,'ricochet');assert.equal(r.deadline,deadline);assert.equal(r.durationMs,duration);tickRound(r,100);assert.equal(r.remainingMs,duration-100);
  r.levelsCleared=1;assert.ok(extractRound(r,100));assert.equal(perkState(r).taken.length,0);
});
test('terminal rolling, recon and dressing apply immediate effects without timer bonuses',()=>{
  for(const id of ['roll','recon','dressing']){const r=arena();r.level.number=3;r.health=50;const key='3:1',s=perkState(r);s.rooms[key]={state:'rewardPending',level:3,index:1,offer:[id]};s.queue=[key];const dash=createDash();dash.readyAt=9000;const deadline=r.deadline;assert.ok(choosePerk(r,key,id,100,dash));assert.equal(r.deadline,deadline);if(id==='roll')assert.equal(dash.readyAt,100);if(id==='recon')assert.equal(s.revealAll,true);if(id==='dressing')assert.equal(r.health,70);}
});
test('recap aggregates most damaging source, preserves movement, real effect and 32-event bound',()=>{
  const r=arena();logCombat(r,{kind:'damage',source:'Sentry',sourceId:'e1',attack:'projectile',amount:9,moving:true});
  logCombat(r,{kind:'damage',source:'Shock pad',sourceId:'h1',attack:'electric hazard',amount:5,moving:false});
  logCombat(r,{kind:'damage',source:'Sentry',sourceId:'e1',attack:'projectile',amount:9,moving:true});
  for(let i=0;i<50;i++)logCombat(r,{kind:'shot',shotId:i});
  assert.equal(perkState(r).events.length,32);const lines=recap(r,'1:0');assert.equal(lines.length,3);assert.match(lines[0],/Sentry.*18 damage/);assert.match(lines[1],/Moving/);assert.equal(lines[2],'No perk activation.');
  logCombat(r,{kind:'perk',text:'Emergency Shield: prevented 6 damage.'});assert.match(recap(r,'1:0')[2],/6 damage/);
});
test('ordinary enemies and hazards record stable source metadata and truthful death line, bag is lost',()=>{
  const r=arena();r.bag.cable=2;r.playerMoving=true;r.health=1;r.lastHit={source:'grunt',enemyId:'enemy-7',attack:'projectile'};takeDamage(r,10,100);assert.match(deathLine(r),/grunt.*projectile.*Moving/);assert.equal(r.bag.cable,0);assert.equal(r.lost.cable,2);assert.equal(r.extracted.cable,0);assert.equal(r.lastDamageEvent.sourceId,'enemy-7');
  const h=arena();h.level.hazards=[{...point,id:'pad-1',w:2,d:2,dps:20,phaseMs:0}];stepHazards(h,point,2500,1);assert.equal(h.lastDamageEvent.sourceId,'pad-1');assert.match(deathLine(h),/Shock pad.*electric hazard.*Stationary/);
});
test('last clear before exit auto-picks and secures the terminal bag',()=>{
  const r=arena();r.level.number=3;r.level.exitArmed=true;r.bag.cable=1;r.level.enemies[0].health=0;
  assert.equal(enterExit(r,point,100),'complete');assert.equal(r.over,true);assert.equal(r.extracted.cable,1);assert.equal(perkState(r).taken.length,0);assert.equal(r.raidPerksTaken.length,1);

});
