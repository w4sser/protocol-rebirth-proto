import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,hitEnemy,activateNode,enterExit} from '../round.js';
import {setArea} from '../levels.js?v=2.7.3';
import {perkState,updateClears,ownRooms,safePick,offer,choosePerk} from '../perks.js';

const point={x:0,z:0};
const foe=(id,x=0,over={})=>({id,kind:'enemy',type:'grunt',x,z:0,r:.48,health:2,active:true,...over});
const idleCombat={projectiles:[],blasts:[]};
const pickAt=(r,p)=>safePick(r,idleCombat,p,100,()=> 'off');
function arena(enemies){
  const r=createRound('room-clear',0);
  Object.assign(r.level,{rooms:[{x:0,z:0,w:10,d:10},{x:20,z:0,w:10,d:10}],enemies,nodes:[],hazards:[],walls:[],boxes:[],start:point,floors:[{x:10,z:0,w:40,d:20}],exit:{x:0,z:0,r:1}});
  return r;
}

test('a room that never had an enemy never triggers room clear or a perk offer',()=>{
  const r=arena([foe('b',20)]); // the only enemy in the level lives in room 1; room 0 is genuinely empty
  updateClears(r,point);
  assert.equal(perkState(r).rooms['1:0'].state,'unresolved');assert.deepEqual(perkState(r).queue,[]);
  // staying, leaving and returning must never flip an empty room to clearPending
  updateClears(r,point);updateClears(r,{x:20,z:0});updateClears(r,point);
  assert.equal(perkState(r).rooms['1:0'].state,'unresolved');assert.deepEqual(perkState(r).queue,[]);
  assert.equal(pickAt(r,point),null);
  assert.equal(enterExit(r,point,100),'next','the exit opens straight to the next level, never pausing on a perk offer');
});

test('a room with enemies triggers room clear exactly once after all of them die',()=>{
  const r=arena([foe('a'),foe('c')]); // two enemies both homed to room 0
  updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved');
  hitEnemy(r,'a',100,2);updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved');assert.deepEqual(perkState(r).queue,[]);
  hitEnemy(r,'c',100,2);updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'clearPending');assert.deepEqual(perkState(r).queue,['1:0']);
  assert.equal(pickAt(r,point),'1:0');
  const ids=offer(r,'1:0');assert.equal(ids.length,3);assert.ok(choosePerk(r,'1:0',ids[0],100));
  // repeated frames in the same room never duplicate the queue entry or re-fire the clear
  updateClears(r,point);updateClears(r,point);assert.deepEqual(perkState(r).queue,[]);
  assert.equal(perkState(r).rooms['1:0'].state,'rewarded');assert.equal(pickAt(r,point),null);
});

test('a room whose only enemy is a dormant reserve clears only once it activates and is defeated',()=>{
  const r=arena([{...foe('reserve'),active:false}]);
  updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved');assert.deepEqual(perkState(r).queue,[]);
  // the reserve is alive but still asleep: entering/leaving the room must not clear it for free
  updateClears(r,point);updateClears(r,{x:20,z:0});updateClears(r,point);
  assert.equal(perkState(r).rooms['1:0'].state,'unresolved');assert.deepEqual(perkState(r).queue,[]);
  assert.equal(pickAt(r,point),null);
  const reserve=r.level.enemies[0];
  assert.equal(hitEnemy(r,reserve.id,100,1),true,'attacking wakes dormant defenders');
  assert.equal(reserve.active,true);assert.equal(reserve.aggro,true);
  r.level.nodes.push({id:'wake',active:false});activateNode(r,'wake',100);
  updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved','woken but still alive');
  hitEnemy(r,reserve.id,200,reserve.health);assert.equal(reserve.health,0);
  updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'clearPending');assert.deepEqual(perkState(r).queue,['1:0']);
});

for(const area of ['bunker','archipelago'])test(`${area}: normal round loading and exit progression grant no perk before the L2 start reserve activates and dies`,()=>{
  setArea(area);
  try{
  const r=createRound('reserves',0);
  assert.equal(r.level.area??'bunker',area);
  updateClears(r,r.level.start);
  assert.deepEqual(perkState(r).queue,[],'generated L1 starts with living enemies, not a free clear');
  assert.equal(pickAt(r,r.level.start),null);
  // Load L2 through the normal exit after defeating L1 and choosing its earned perk.
  for(const n of r.level.nodes)activateNode(r,n.id,100);
  for(const e of r.level.enemies)hitEnemy(r,e.id,200,e.health);
  updateClears(r,r.level.start);
  const first=pickAt(r,r.level.start);assert.equal(first,'1:0');
  assert.ok(choosePerk(r,first,offer(r,first)[0],200));
  assert.equal(enterExit(r,r.level.exit,300),'next');assert.equal(r.level.number,2);
  ownRooms(r.level);
  const room=r.level.rooms[0],p={x:room.x,z:room.z};
  const roomEnemies=r.level.enemies.filter(e=>e.homeRoom===0&&e.type!=='generator');
  assert.ok(roomEnemies.length>0,'the start room must have at least one enemy assigned to it for this scenario');
  assert.ok(roomEnemies.every(e=>e.active===false),'every enemy homed to the start room starts dormant');
  updateClears(r,p);
  const key=`${r.level.number}:0`;
  assert.equal(perkState(r).rooms[key].state,'unresolved');assert.deepEqual(perkState(r).queue,[]);
  assert.equal(pickAt(r,p),null);
  // walking through the empty-looking start room repeatedly must not grant a free clear
  updateClears(r,p);updateClears(r,r.level.exit);updateClears(r,p);
  assert.equal(perkState(r).rooms[key].state,'unresolved');assert.deepEqual(perkState(r).queue,[]);
  activateNode(r,r.level.nodes[0].id,1000); // lighting any node wakes every dormant non-swarm reserve
  assert.ok(roomEnemies.every(e=>e.active!==false));
  updateClears(r,p);assert.equal(perkState(r).rooms[key].state,'unresolved','woken reserves still block the clear until defeated');
  for(const e of roomEnemies)hitEnemy(r,e.id,2000,e.health);
  assert.ok(roomEnemies.every(e=>e.health===0));
  updateClears(r,p);assert.equal(perkState(r).rooms[key].state,'clearPending');assert.deepEqual(perkState(r).queue,[key]);
  assert.equal(pickAt(r,p),key);assert.equal(offer(r,key).length,3);
  }finally{setArea('bunker');}
});
