import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,hitEnemy,activateNode,enterExit} from '../round.js';
import {setArea} from '../levels.js?v=2.28.25';
import {perkState,updateClears,ownRooms,safePick,pickReady} from '../perks.js';

const point={x:0,z:0};
const foe=(id,x=0,over={})=>({id,kind:'enemy',type:'grunt',x,z:0,r:.48,health:2,active:true,...over});
const idleCombat={projectiles:[],blasts:[]};
const pickAt=(r,p)=>safePick(r,idleCombat,p,100,()=> 'off');
function arena(enemies){
  const r=createRound('room-clear',0);
  Object.assign(r.level,{rooms:[{x:0,z:0,w:10,d:10},{x:20,z:0,w:10,d:10}],enemies,nodes:[],hazards:[],walls:[],boxes:[],start:point,floors:[{x:10,z:0,w:40,d:20}],exit:{x:0,z:0,r:1}});
  return r;
}

test('a room that never had an enemy never triggers a room clear',()=>{
  const r=arena([foe('b',20)]); // the only enemy in the level lives in room 1; room 0 is genuinely empty
  updateClears(r,point);
  assert.equal(perkState(r).rooms['1:0'].state,'unresolved');
  // staying, leaving and returning must never flip an empty room to cleared
  updateClears(r,point);updateClears(r,{x:20,z:0});updateClears(r,point);
  assert.equal(perkState(r).rooms['1:0'].state,'unresolved');
  assert.equal(pickAt(r,point),null);
  assert.equal(enterExit(r,point,100),'next','the exit opens straight to the next level, no mid-raid perk offer');
});

// Round upgrades removed (v2.28.25, PRB-146): a room resolves straight to 'cleared' the instant its last
// enemy dies -- updateClears never queues an offer, so safePick/pickReady have nothing to return.
test('a room with enemies clears exactly once after all of them die, with no offer ever queued',()=>{
  const r=arena([foe('a'),foe('c')]); // two enemies both homed to room 0
  updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved');
  hitEnemy(r,'a',100,2);updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved');assert.deepEqual(perkState(r).queue,[]);
  hitEnemy(r,'c',100,2);updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'cleared');assert.deepEqual(perkState(r).queue,[]);
  assert.equal(pickAt(r,point),null);assert.equal(pickReady(r,idleCombat,point,100,()=> 'off'),null);
  // repeated frames in the same room never re-fire the clear or change its state
  updateClears(r,point);updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'cleared');assert.deepEqual(perkState(r).queue,[]);
});

test('a room whose only enemy is a dormant reserve clears only once it activates and is defeated',()=>{
  const r=arena([{...foe('reserve'),active:false}]);
  updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved');
  // the reserve is alive but still asleep: entering/leaving the room must not clear it for free
  updateClears(r,point);updateClears(r,{x:20,z:0});updateClears(r,point);
  assert.equal(perkState(r).rooms['1:0'].state,'unresolved');
  assert.equal(pickAt(r,point),null);
  const reserve=r.level.enemies[0];
  assert.equal(hitEnemy(r,reserve.id,100,1),true,'attacking wakes dormant defenders');
  assert.equal(reserve.active,true);assert.equal(reserve.aggro,true);
  r.level.nodes.push({id:'wake',active:false});activateNode(r,'wake',100);
  updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'unresolved','woken but still alive');
  hitEnemy(r,reserve.id,200,reserve.health);assert.equal(reserve.health,0);
  updateClears(r,point);assert.equal(perkState(r).rooms['1:0'].state,'cleared');assert.deepEqual(perkState(r).queue,[]);
});

for(const area of ['bunker','archipelago'])test(`${area}: normal round loading and exit progression never queue a perk offer`,()=>{
  setArea(area);
  try{
  const r=createRound('reserves',0);
  assert.equal(r.level.area??'bunker',area);
  updateClears(r,r.level.start);
  assert.deepEqual(perkState(r).queue,[],'generated L1 starts with living enemies, not a free clear');
  assert.equal(pickAt(r,r.level.start),null);
  // Load L2 through the normal exit after defeating L1 -- no perk picker ever stands in the way.
  for(const n of r.level.nodes)activateNode(r,n.id,100);
  for(const e of r.level.enemies)hitEnemy(r,e.id,200,e.health);
  updateClears(r,r.level.start);
  assert.equal(perkState(r).rooms['1:0'].state,'cleared');assert.deepEqual(perkState(r).queue,[]);
  assert.equal(pickAt(r,r.level.start),null);
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
  updateClears(r,p);assert.equal(perkState(r).rooms[key].state,'cleared');assert.deepEqual(perkState(r).queue,[]);
  assert.equal(pickAt(r,p),null);
  }finally{setArea('bunker');}
});
